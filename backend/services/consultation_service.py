import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Any, Dict
from database.mongodb import get_db, serialize_doc, serialize_docs

logger = logging.getLogger("smart-hospital-backend")

def archive_consultation(
    queue_or_booking_id: str,
    doctor_notes: Optional[str] = None,
    diagnosis: Optional[str] = None,
    advice: Optional[str] = None,
    actual_duration_mins: int = 15,
    prescriptions: Optional[List[dict]] = None,
    lab_tests: Optional[List[Any]] = None
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Archives a completed consultation into the permanent db.consultations collection.
    Clearly captures:
    - Patient identification
    - Vitals recorded at consultation
    - Patient-reported complaints & duration
    - Doctor-recorded clinical notes, diagnosis (if any), advice (if any), and structured prescriptions
    NOTE: Never invent or fabricate a diagnosis. If not provided, it remains None.
    """
    try:
        db = get_db()
        # Find the consultation from queue or appointments
        entry = (
            db.queue.find_one({"$or": [{"queue_id": queue_or_booking_id}, {"booking_id": queue_or_booking_id}]}) or
            db.appointments.find_one({"booking_id": queue_or_booking_id})
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        consultation_id = f"CON_{queue_or_booking_id}"

        patient_id = entry.get("patient_id") if entry else None
        patient_name = entry.get("patient_name") or entry.get("name") if entry else "Patient"

        # Lookup doctor name
        doctor_name = "Assigned Medical Officer"
        doctor_id = entry.get("doctor_id") if entry else None
        department = entry.get("department") if entry else "General Medicine"

        if doctor_id:
            doc_record = db.doctors.find_one({"doctor_id": doctor_id})
            if doc_record:
                doctor_name = doc_record.get("name", doctor_name)
                department = doc_record.get("department", department)

        # Retrieve vitals at time of consultation
        vitals = {
            "age": entry.get("age") if entry else None,
            "gender": entry.get("gender") if entry else None,
            "height_cm": entry.get("height_cm") if entry else None,
            "weight_kg": entry.get("weight_kg") if entry else None,
            "city": entry.get("city") or entry.get("address") if entry else "Tumakuru"
        }

        # Calculate BMI if height and weight exist
        bmi = None
        if vitals.get("height_cm") and vitals.get("weight_kg"):
            try:
                h_m = float(vitals["height_cm"]) / 100.0
                w_kg = float(vitals["weight_kg"])
                if h_m > 0:
                    bmi = round(w_kg / (h_m * h_m), 1)
            except Exception:
                pass
        vitals["bmi"] = bmi

        # Clean doctor inputs (strip, keep None if empty)
        clean_notes = str(doctor_notes).strip() if doctor_notes and str(doctor_notes).strip() else None
        clean_diagnosis = str(diagnosis).strip() if diagnosis and str(diagnosis).strip() else None
        clean_advice = str(advice).strip() if advice and str(advice).strip() else None

        # Clean structured prescriptions: list of { medicine, dosage, frequency, duration, instructions }
        clean_prescriptions = []
        if prescriptions and isinstance(prescriptions, list):
            for p in prescriptions:
                if isinstance(p, dict) and (p.get("medicine") or p.get("name")):
                    item = {
                        "medicine": str(p.get("medicine") or p.get("name")).strip(),
                        "dosage": str(p.get("dosage") or "").strip(),
                        "frequency": str(p.get("frequency") or "").strip(),
                        "duration": str(p.get("duration") or "").strip(),
                        "instructions": str(p.get("instructions") or "").strip()
                    }
                    if p.get("rxcui"):
                        item["rxcui"] = str(p["rxcui"]).strip()
                    if p.get("term_type") or p.get("tty"):
                        item["term_type"] = str(p.get("term_type") or p.get("tty")).strip()
                    clean_prescriptions.append(item)

        consultation_doc = {
            "consultation_id": consultation_id,
            "queue_id": entry.get("queue_id") if entry else queue_or_booking_id,
            "booking_id": entry.get("booking_id") if entry else queue_or_booking_id,
            "patient_id": patient_id,
            "patient_name": patient_name,
            "doctor_id": doctor_id,
            "doctor_name": doctor_name,
            "department": department,
            "room_number": entry.get("room_number") or entry.get("consultation_room") or "Room 204",
            "consultation_date": entry.get("consultation_date") or now_iso.split("T")[0] if entry else now_iso.split("T")[0],
            "consultation_time": now_iso.split("T")[1][:5] if "T" in now_iso else "10:00",
            "completed_at": now_iso,
            "patient_reported": {
                "symptoms": entry.get("symptoms", []) if entry else [],
                "custom_symptoms": entry.get("custom_symptoms", "") if entry else "",
                "duration_days": entry.get("duration_days") if entry else None,
                "priority": entry.get("priority", "normal") if entry else "normal"
            },
            "vitals_at_consultation": vitals,
            "doctor_assessment": {
                "notes": clean_notes,
                "diagnosis": clean_diagnosis, # None if not entered by doctor
                "advice": clean_advice
            },
            "prescriptions": clean_prescriptions,
            "actual_duration_mins": actual_duration_mins,
            "status": "completed",
            "updated_at": now_iso
        }

        # Update or insert into db.consultations
        db.consultations.update_one(
            {"consultation_id": consultation_id},
            {"$set": consultation_doc},
            upsert=True
        )

        # Also mirror notes into db.queue and db.appointments
        update_mirror = {
            "status": "completed",
            "doctor_notes": clean_notes,
            "diagnosis": clean_diagnosis,
            "advice": clean_advice,
            "prescriptions": clean_prescriptions,
            "completed_at": now_iso,
            "actual_duration_mins": actual_duration_mins
        }
        db.queue.update_many(
            {"$or": [{"queue_id": queue_or_booking_id}, {"booking_id": queue_or_booking_id}]},
            {"$set": update_mirror}
        )
        db.appointments.update_many(
            {"booking_id": queue_or_booking_id},
            {"$set": update_mirror}
        )

        # ----------------------------------------------------
        # PHARMACY & LAB HAND-OFF AUTOMATION
        # ----------------------------------------------------
        # 1. Automatically create Pharmacy Order if prescriptions exist
        if clean_prescriptions:
            try:
                from services.order_service import create_or_update_pharmacy_order_from_consultation
                pharm_order, _ = create_or_update_pharmacy_order_from_consultation(consultation_doc)
                if pharm_order and pharm_order.get("order_id"):
                    consultation_doc["pharmacy_order_id"] = pharm_order.get("order_id")
                    db.consultations.update_one(
                        {"consultation_id": consultation_id},
                        {"$set": {"pharmacy_order_id": pharm_order.get("order_id")}}
                    )
            except Exception as pharm_ex:
                logger.warning(f"Error auto-creating pharmacy order for {consultation_id}: {pharm_ex}")

        # 2. Automatically create Lab Order if lab tests requested
        if lab_tests:
            try:
                from services.order_service import create_lab_order_from_consultation
                lab_order, _ = create_lab_order_from_consultation(consultation_doc, lab_tests)
                if lab_order and lab_order.get("order_id"):
                    consultation_doc["lab_order_id"] = lab_order.get("order_id")
                    db.consultations.update_one(
                        {"consultation_id": consultation_id},
                        {"$set": {"lab_order_id": lab_order.get("order_id")}}
                    )
            except Exception as lab_ex:
                logger.warning(f"Error auto-creating lab order for {consultation_id}: {lab_ex}")

        return serialize_doc(consultation_doc), None
    except Exception as e:
        logger.error(f"Error archiving consultation: {e}", exc_info=True)
        return None, str(e)


def get_patient_consultations(patient_id: str) -> List[dict]:
    """
    Returns full chronological medical history for a patient.
    Aggregates from permanent db.consultations, completed db.queue, and db.appointments,
    de-duplicating by reference and sorting newest first.
    """
    try:
        db = get_db()
        results_map = {}

        # 1. From db.consultations
        cons_docs = list(db.consultations.find({"patient_id": patient_id}))
        for c in cons_docs:
            c_ser = serialize_doc(c)
            ref_key = c_ser.get("booking_id") or c_ser.get("queue_id") or c_ser.get("consultation_id")
            results_map[ref_key] = c_ser

        # 2. From completed db.queue
        queue_docs = list(db.queue.find({"patient_id": patient_id, "status": "completed"}))
        for q in queue_docs:
            q_ser = serialize_doc(q)
            ref_key = q_ser.get("booking_id") or q_ser.get("queue_id")
            if ref_key not in results_map:
                # Construct consistent consultation record
                vitals = {
                    "age": q_ser.get("age"),
                    "gender": q_ser.get("gender"),
                    "height_cm": q_ser.get("height_cm"),
                    "weight_kg": q_ser.get("weight_kg"),
                    "city": q_ser.get("city") or "Tumakuru"
                }
                bmi = None
                if vitals.get("height_cm") and vitals.get("weight_kg"):
                    try:
                        h_m = float(vitals["height_cm"]) / 100.0
                        w_kg = float(vitals["weight_kg"])
                        if h_m > 0:
                            bmi = round(w_kg / (h_m * h_m), 1)
                    except Exception:
                        pass
                vitals["bmi"] = bmi

                doc_record = db.doctors.find_one({"doctor_id": q_ser.get("doctor_id")})
                doc_name = doc_record.get("name") if doc_record else "Assigned Specialist"

                results_map[ref_key] = {
                    "consultation_id": f"CON_{ref_key}",
                    "queue_id": q_ser.get("queue_id"),
                    "booking_id": q_ser.get("booking_id"),
                    "patient_id": patient_id,
                    "patient_name": q_ser.get("patient_name") or q_ser.get("name") or "Patient",
                    "doctor_id": q_ser.get("doctor_id"),
                    "doctor_name": doc_name,
                    "department": q_ser.get("department", "General Medicine"),
                    "room_number": q_ser.get("room_number") or "Room 204",
                    "consultation_date": q_ser.get("consultation_date") or q_ser.get("created_at", "").split("T")[0],
                    "consultation_time": q_ser.get("joined_at", "").split("T")[1][:5] if "T" in q_ser.get("joined_at", "") else "10:00",
                    "completed_at": q_ser.get("completed_at") or q_ser.get("updated_at"),
                    "patient_reported": {
                        "symptoms": q_ser.get("symptoms", []),
                        "custom_symptoms": q_ser.get("custom_symptoms", ""),
                        "duration_days": q_ser.get("duration_days"),
                        "priority": q_ser.get("priority", "normal")
                    },
                    "vitals_at_consultation": vitals,
                    "doctor_assessment": {
                        "notes": q_ser.get("doctor_notes") or q_ser.get("notes"),
                        "diagnosis": q_ser.get("diagnosis"),
                        "advice": q_ser.get("advice")
                    },
                    "prescriptions": q_ser.get("prescriptions", []),
                    "actual_duration_mins": q_ser.get("actual_duration_mins", 15),
                    "status": "completed"
                }

        # 3. From completed db.appointments
        apt_docs = list(db.appointments.find({"patient_id": patient_id, "status": "completed"}))
        for a in apt_docs:
            a_ser = serialize_doc(a)
            ref_key = a_ser.get("booking_id")
            if ref_key not in results_map:
                vitals = {
                    "age": a_ser.get("age"),
                    "gender": a_ser.get("gender"),
                    "height_cm": a_ser.get("height_cm"),
                    "weight_kg": a_ser.get("weight_kg"),
                    "city": a_ser.get("city") or "Tumakuru"
                }
                bmi = None
                if vitals.get("height_cm") and vitals.get("weight_kg"):
                    try:
                        h_m = float(vitals["height_cm"]) / 100.0
                        w_kg = float(vitals["weight_kg"])
                        if h_m > 0:
                            bmi = round(w_kg / (h_m * h_m), 1)
                    except Exception:
                        pass
                vitals["bmi"] = bmi

                doc_record = db.doctors.find_one({"doctor_id": a_ser.get("doctor_id")})
                doc_name = doc_record.get("name") if doc_record else "Assigned Specialist"

                results_map[ref_key] = {
                    "consultation_id": f"CON_{ref_key}",
                    "queue_id": a_ser.get("queue_id") or a_ser.get("booking_id"),
                    "booking_id": ref_key,
                    "patient_id": patient_id,
                    "patient_name": a_ser.get("patient_name") or a_ser.get("name") or "Patient",
                    "doctor_id": a_ser.get("doctor_id"),
                    "doctor_name": doc_name,
                    "department": a_ser.get("department", "General Medicine"),
                    "room_number": a_ser.get("room_number") or "Room 204",
                    "consultation_date": a_ser.get("consultation_date"),
                    "consultation_time": "10:00",
                    "completed_at": a_ser.get("completed_at") or a_ser.get("updated_at"),
                    "patient_reported": {
                        "symptoms": a_ser.get("symptoms", []),
                        "custom_symptoms": a_ser.get("custom_symptoms", ""),
                        "duration_days": a_ser.get("duration_days"),
                        "priority": a_ser.get("priority", "normal")
                    },
                    "vitals_at_consultation": vitals,
                    "doctor_assessment": {
                        "notes": a_ser.get("doctor_notes") or a_ser.get("notes"),
                        "diagnosis": a_ser.get("diagnosis"),
                        "advice": a_ser.get("advice")
                    },
                    "prescriptions": a_ser.get("prescriptions", []),
                    "actual_duration_mins": a_ser.get("actual_duration_mins", 15),
                    "status": "completed"
                }

        # Resolve master patient info once for enriching records
        patient_master = db.patients.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]}) or \
                         db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        master_name = patient_master.get("name") if patient_master else None
        master_city = patient_master.get("city") or patient_master.get("address") if patient_master else "Tumakuru"

        # Convert to list and sort descending by consultation_date / completed_at
        consultations = list(results_map.values())
        for c in consultations:
            # Guarantee patient full name
            if master_name and (not c.get("patient_name") or c.get("patient_name") == "Patient"):
                c["patient_name"] = master_name
            if not c.get("patient_id"):
                c["patient_id"] = patient_id

            # Ensure vitals consistency
            if "vitals_at_consultation" not in c or not c["vitals_at_consultation"]:
                c["vitals_at_consultation"] = {}
            v = c["vitals_at_consultation"]
            if not v.get("city") or v.get("city") == "Tumakuru":
                v["city"] = c.get("city") or master_city
            if v.get("height_cm") and v.get("weight_kg") and not v.get("bmi"):
                try:
                    h_m = float(v["height_cm"]) / 100.0
                    w_kg = float(v["weight_kg"])
                    if h_m > 0:
                        v["bmi"] = round(w_kg / (h_m * h_m), 1)
                except Exception:
                    pass

        consultations.sort(
            key=lambda x: str(x.get("completed_at") or x.get("consultation_date") or ""),
            reverse=True
        )
        return consultations
    except Exception as e:
        logger.error(f"Error fetching patient consultations: {e}", exc_info=True)
        return []


def get_consultation_by_id(consultation_id: str) -> Optional[dict]:
    try:
        db = get_db()
        doc = db.consultations.find_one({
            "$or": [
                {"consultation_id": consultation_id},
                {"booking_id": consultation_id},
                {"queue_id": consultation_id}
            ]
        })
        if doc:
            serialized = serialize_doc(doc)
            pharm_order = db.pharmacy_orders.find_one({"consultation_id": doc.get("consultation_id")})
            if pharm_order:
                serialized["pharmacy_order"] = serialize_doc(pharm_order)
            lab_order = db.lab_orders.find_one({"consultation_id": doc.get("consultation_id")})
            if lab_order:
                serialized["lab_order"] = serialize_doc(lab_order)
            return serialized

        # Fallback to queue
        q_doc = db.queue.find_one({"$or": [{"queue_id": consultation_id}, {"booking_id": consultation_id}]})
        if q_doc:
            return serialize_doc(q_doc)

        # Fallback to appointments
        a_doc = db.appointments.find_one({"booking_id": consultation_id})
        if a_doc:
            return serialize_doc(a_doc)

        return None
    except Exception as e:
        logger.error(f"Error fetching consultation by id: {e}", exc_info=True)
        return None
