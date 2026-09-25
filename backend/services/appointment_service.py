from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.ml_service import predict_consultation_duration
from services.travel_service import calculate_travel_metrics
from services.notification_service import create_notification, format_booking_confirmed_sms
from services.time_service import ist_isoformat, today_iso_ist

IN_MEMORY_BOOKINGS = []

def generate_booking_id() -> str:
    try:
        db = get_db()
        import re
        all_ids = db.appointments.distinct("booking_id")
        max_num = max([int(m.group(1)) for bid in all_ids if (m := re.match(r"^B(\d+)$", str(bid)))] or [0])
        return f"B{max_num + 1:03d}"
    except Exception:
        return f"B{len(IN_MEMORY_BOOKINGS) + 1:03d}"

def book_appointment(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    """
    Advance Consultation Booking Engine:
    - Enforces STRICT 2-day advance booking limit.
    - Runs Random Forest ML model for consultation duration prediction.
    - Computes travel metrics & recommended departure time.
    - Generates BOOKING_CONFIRMED and DEPARTURE_REMINDER notifications.
    """
    patient_id = data.get("patient_id", "P001").strip()
    doctor_id = data.get("doctor_id", "D001").strip()
    department = data.get("department", "Cardiology").strip()
    consultation_date_str = data.get("consultation_date", "").strip()
    priority = data.get("priority", "normal").strip().lower()
    symptoms = data.get("symptoms", [])
    custom_symptoms = data.get("custom_symptoms", "").strip()

    if not consultation_date_str:
        consultation_date_str = date.today().isoformat()

    # 1. STRICT 2-DAY ADVANCE BOOKING RULE VALIDATION
    try:
        booking_date = datetime.strptime(consultation_date_str, "%Y-%m-%d").date()
        today = date.today()
        max_allowed_date = today + timedelta(days=2)

        if booking_date < today:
            return None, "Cannot book consultations for past dates"
        if booking_date > max_allowed_date:
            return None, "Appointments can only be booked up to 2 days in advance."
    except ValueError:
        return None, "Invalid date format. Use YYYY-MM-DD"

    # MANDATORY CONSULTATION SLOT VALIDATION
    from services.slot_service import validate_and_normalize_slot
    raw_slot = data.get("consultation_slot") or data.get("slot") or data.get("slot_id")
    if not raw_slot:
        return None, "consultation_slot is required. Please select either 'morning' or 'evening' slot."

    slot_obj, slot_err = validate_and_normalize_slot(raw_slot, consultation_date=consultation_date_str)
    if slot_err:
        return None, slot_err

    booking_id = generate_booking_id()
    now_str = ist_isoformat()

    # Extract clinical data for doctor consultation
    patient_name = data.get("patient_name") or data.get("name") or "Patient"
    patient_phone = data.get("patient_phone") or data.get("phone", "")
    age = int(data["age"]) if "age" in data and data["age"] not in [None, ""] else None
    gender = str(data.get("gender", "Not Specified")).strip()
    duration_days = int(data["duration_days"]) if "duration_days" in data and data["duration_days"] not in [None, ""] else 1
    height_cm = float(data["height_cm"]) if "height_cm" in data and data["height_cm"] not in [None, ""] else None
    weight_kg = float(data["weight_kg"]) if "weight_kg" in data and data["weight_kg"] not in [None, ""] else None
    email = str(data.get("email") or data.get("patient_email") or "").strip()
    city = str(data.get("city") or data.get("address") or data.get("location") or "Tumakuru").strip()
    pdo = str(data.get("pdo", "")).strip()

    # Identify returning patient profile by phone or patient_id ONLY if booking for myself
    if str(data.get("booking_for", "myself")).lower() == "myself" and patient_phone:
        import re
        clean_p = re.sub(r"\D", "", str(patient_phone).strip())
        if len(clean_p) >= 10:
            try:
                db_lookup = get_db()
                existing_p = db_lookup.patients.find_one({"phone": clean_p[-10:]}) or db_lookup.users.find_one({"phone": clean_p[-10:]})
                if existing_p and existing_p.get("patient_id"):
                    patient_id = existing_p.get("patient_id")
            except Exception:
                pass

    # 2. RANDOM FOREST ML PREDICTION FOR CONSULTATION DURATION
    predicted_duration = predict_consultation_duration(
        symptoms=symptoms,
        department=department,
        doctor_id=doctor_id,
        priority=priority
    )

    # 3. AUTO-ASSIGN QUEUE TOKEN & HOSPITAL ARRIVAL OTP
    from services.queue_service import join_queue
    origin_latitude = None
    origin_longitude = None
    raw_lat = data.get("origin_latitude") if data.get("origin_latitude") is not None else data.get("latitude")
    raw_lon = data.get("origin_longitude") if data.get("origin_longitude") is not None else data.get("longitude")
    if raw_lat is not None and raw_lon is not None:
        try:
            origin_latitude = float(raw_lat)
            origin_longitude = float(raw_lon)
        except (ValueError, TypeError):
            origin_latitude = None
            origin_longitude = None

    is_approximate_location = (origin_latitude is None or origin_longitude is None) or bool(data.get("is_approximate_location", False))
    origin_coords = [origin_longitude, origin_latitude] if (origin_latitude is not None and origin_longitude is not None) else None
    patient_address = str(data.get("patient_address") or city).strip()

    booking_for = str(data.get("booking_for") or "myself").strip().lower()
    relation = str(data.get("relation") or ("self" if booking_for == "myself" else "Family Member")).strip()
    booked_by = str(data.get("booked_by") or patient_id).strip()

    # Retrieve accurate doctor details from MongoDB or default doctors catalog
    doctor_name = "Dr. Specialist"
    specialization = department or "General Medicine"
    consultation_room = "Room 204"
    try:
        from database.mongodb import get_db
        db_inst = get_db()
        doc_rec = db_inst.doctors.find_one({"doctor_id": doctor_id}) if db_inst is not None else None
        if doc_rec:
            doctor_name = doc_rec.get("name", doctor_name)
            specialization = doc_rec.get("specialization") or doc_rec.get("department", specialization)
            consultation_room = doc_rec.get("consultation_room") or doc_rec.get("room_number", consultation_room)
            if not department or department == "General Medicine":
                department = doc_rec.get("department", department)
        else:
            from services.doctor_service import DEFAULT_DOCTORS
            for d in DEFAULT_DOCTORS:
                if d.get("doctor_id") == doctor_id:
                    doctor_name = d.get("name", doctor_name)
                    specialization = d.get("specialization") or d.get("department", specialization)
                    consultation_room = d.get("consultation_room") or d.get("room_number", consultation_room)
                    if not department or department == "General Medicine":
                        department = d.get("department", department)
                    break
    except Exception:
        pass

    location_source = str(data.get("location_source") or ("device_gps" if (origin_latitude and not is_approximate_location) else ("manual" if is_approximate_location else "gps"))).strip()
    location_address = str(data.get("location_address") or data.get("display_address") or patient_address or city).strip()
    location_captured_at = str(data.get("location_captured_at") or now_str).strip()
    is_approximate = (origin_latitude is None or origin_longitude is None) or bool(data.get("is_approximate") or data.get("is_approximate_location", False)) or (location_source == "manual")

    queue_payload = {
        "patient_id": patient_id,
        "patient_name": patient_name,
        "phone": patient_phone,
        "email": email,
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "department": department,
        "specialization": specialization,
        "consultation_room": consultation_room,
        "room_number": consultation_room,
        "booked_by": booked_by,
        "booked_by_user_id": data.get("booked_by_user_id"),
        "booked_by_patient_id": data.get("booked_by_patient_id"),
        "booked_by_phone": data.get("booked_by_phone"),
        "priority": priority,
        "symptoms": symptoms,
        "custom_symptoms": custom_symptoms,
        "age": age,
        "gender": gender,
        "duration_days": duration_days,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "city": city,
        "patient_address": patient_address,
        "origin_latitude": origin_latitude,
        "origin_longitude": origin_longitude,
        "is_approximate_location": is_approximate,
        "is_approximate": is_approximate,
        "location_source": location_source,
        "location_address": location_address,
        "location_captured_at": location_captured_at,
        "booking_for": booking_for,
        "relation": relation,
        "pdo": pdo,
        "booking_id": booking_id,
        "consultation_date": consultation_date_str,
        "consultation_slot": slot_obj,
        "slot_id": slot_obj.get("slot_id", "morning"),
        "suppress_sms": True
    }
    queue_res, queue_err = join_queue(queue_payload)

    queue_id = queue_res.get("queue_id") if queue_res else None
    arrival_otp = queue_res.get("arrival_otp") if queue_res else "123456"
    queue_position = queue_res.get("position", 1) if queue_res else 1
    wait_time = queue_res.get("predicted_wait_time", 5) if queue_res else 5
    travel_info = queue_res.get("travel_info") if queue_res and queue_res.get("travel_info") else calculate_travel_metrics(
        patient_address=location_address,
        wait_time_min=wait_time,
        origin_coords=origin_coords,
        location_source=location_source,
        is_approximate=is_approximate,
        location_address=location_address
    )

    booking_doc = {
        "booking_id": booking_id,
        "queue_id": queue_id,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "email": email,
        "patient_email": email,
        "age": age,
        "gender": gender,
        "duration_days": duration_days,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "city": city,
        "patient_address": patient_address,
        "origin_latitude": origin_latitude,
        "origin_longitude": origin_longitude,
        "latitude": origin_latitude,
        "longitude": origin_longitude,
        "is_approximate_location": is_approximate,
        "is_approximate": is_approximate,
        "location_source": location_source,
        "location_address": location_address,
        "display_address": location_address,
        "location_captured_at": location_captured_at,
        "booking_for": booking_for,
        "relation": relation,
        "booked_by": booked_by,
        "booked_by_user_id": data.get("booked_by_user_id"),
        "booked_by_patient_id": data.get("booked_by_patient_id"),
        "booked_by_phone": data.get("booked_by_phone"),
        "pdo": pdo,
        "doctor_id": doctor_id,
        "doctor_name": doctor_name,
        "department": department,
        "specialization": specialization,
        "doctor_specialization": specialization,
        "consultation_date": consultation_date_str,
        "consultation_slot": slot_obj,
        "slot_id": slot_obj.get("slot_id", "morning"),
        "leaving_now": False,
        "leaving_now_at": None,
        "leave_reminder_status": "NOT_REQUIRED",
        "leave_reminder_sent_at": None,
        "priority": "emergency" if priority == "emergency" else "normal",
        "symptoms": symptoms,
        "custom_symptoms": custom_symptoms,
        "predicted_consultation_duration": predicted_duration,
        "predicted_wait_time": wait_time,
        "expected_consultation_time": queue_res.get("expected_consultation_time") if queue_res else None,
        "expected_consultation_iso": queue_res.get("expected_consultation_iso") if queue_res else None,
        "recommended_departure_time": queue_res.get("recommended_departure_time") or (travel_info.get("recommended_departure_time") if travel_info else None),
        "recommended_departure_iso": queue_res.get("recommended_departure_iso") or (travel_info.get("recommended_departure_iso") if travel_info else None),
        "queue_position": queue_position,
        "arrival_otp": arrival_otp,
        "room_number": consultation_room,
        "consultation_room": consultation_room,
        "status": "booked",
        "travel_info": travel_info,
        "created_at": now_str
    }

    try:
        db = get_db()
        db.appointments.insert_one(booking_doc)

        # Trigger authoritative queue recalculation to ensure DB consistency across queue & appointments
        try:
            from services.queue_service import recalculate_queue_positions
            recalculate_queue_positions(
                doctor_id=doctor_id,
                department=department,
                consultation_date=consultation_date_str,
                slot_id=slot_obj.get("slot_id")
            )
        except Exception:
            pass

        # Update returning patient profile with latest vitals ONLY if booking for myself,
        # preventing family member appointment details from overwriting the user's permanent profile.
        if booking_for == "myself" and (patient_id or patient_phone):
            try:
                from services.patient_service import sync_or_update_patient_profile
                sync_profile_data = {
                    "name": patient_name,
                    "phone": patient_phone,
                    "age": age,
                    "gender": gender,
                    "height_cm": height_cm,
                    "weight_kg": weight_kg,
                    "city": city,
                    "address": city
                }
                if email:
                    sync_profile_data["email"] = email
                sync_or_update_patient_profile(
                    patient_id=patient_id,
                    phone=patient_phone,
                    data=sync_profile_data
                )
            except Exception as sync_ex:
                pass

        updated = db.appointments.find_one({"booking_id": booking_id})
        res = serialize_doc(updated)
    except Exception:
        IN_MEMORY_BOOKINGS.append(booking_doc)
        res = serialize_doc(booking_doc)

    # 4. GENERATE IN-APP NOTIFICATIONS
    clean_room = str(booking_doc.get("room_number", "Room 204")).replace("Room", "").replace("room", "").strip() or "204"
    dep_time = (travel_info.get("recommended_departure_time") if travel_info else None) or queue_res.get("recommended_departure_time") or "Soon"
    booking_sms = format_booking_confirmed_sms(
        token=queue_id or "Pending",
        queue_position=queue_position,
        consultation_date=consultation_date_str,
        doctor_id=doctor_id,
        department=department,
        room=clean_room,
        recommended_departure=dep_time,
        arrival_code=arrival_otp
    )

    create_notification(
        patient_id=patient_id,
        notification_type="BOOKING_CONFIRMED",
        title="Consultation Booked Successfully",
        message=f"Confirmed for {consultation_date_str} with {doctor_id} ({department}). Queue Token: {queue_id} (Position #{queue_position}). Room {clean_room}.",
        booking_id=booking_id,
        sms_text=booking_sms
    )

    if doctor_id:
        create_notification(
            patient_id=doctor_id,
            notification_type="APPOINTMENT_SCHEDULED",
            title="New Advance Appointment",
            message=f"Patient {patient_name} booked consultation for {consultation_date_str} in {department}. Token: {queue_id}.",
            booking_id=booking_id
        )

    return res, None

def get_booking_by_id(booking_id: str) -> Optional[dict]:
    try:
        db = get_db()
        apt = db.appointments.find_one({"booking_id": booking_id})
        if apt:
            return serialize_doc(apt)
    except Exception:
        pass

    for b in IN_MEMORY_BOOKINGS:
        if b["booking_id"] == booking_id:
            return serialize_doc(b)
    return None

def get_patient_appointments(patient_id: str) -> List[dict]:
    clean_pid = str(patient_id).strip()
    try:
        db = get_db()
        search_ids = {clean_pid}
        try:
            u = db.users.find_one({"$or": [{"patient_id": clean_pid}, {"user_id": clean_pid}, {"phone": clean_pid}]})
            if u:
                if u.get("patient_id"): search_ids.add(str(u["patient_id"]))
                if u.get("user_id"): search_ids.add(str(u["user_id"]))
                if u.get("phone"): search_ids.add(str(u["phone"]))
            p = db.patients.find_one({"$or": [{"patient_id": clean_pid}, {"phone": clean_pid}]})
            if p:
                if p.get("patient_id"): search_ids.add(str(p["patient_id"]))
                if p.get("user_id"): search_ids.add(str(p["user_id"]))
                if p.get("phone"): search_ids.add(str(p["phone"]))
        except Exception:
            pass

        id_list = list(search_ids)
        query = {
            "$or": [
                {"patient_id": {"$in": id_list}},
                {"booked_by": {"$in": id_list}},
                {"booked_by_patient_id": {"$in": id_list}},
                {"booked_by_user_id": {"$in": id_list}},
                {"booked_by_phone": {"$in": id_list}},
                {"user_id": {"$in": id_list}},
                {"phone": {"$in": id_list}},
                {"patient_phone": {"$in": id_list}}
            ]
        }
        apts = list(db.appointments.find(query).sort("created_at", -1))
        
        # Doctor lookup map for full enrichment
        doctor_map = {}
        try:
            for d in db.doctors.find({}):
                if d.get("doctor_id"):
                    doctor_map[d["doctor_id"]] = d
        except Exception:
            pass
        if not doctor_map:
            try:
                from services.doctor_service import DEFAULT_DOCTORS
                for d in DEFAULT_DOCTORS:
                    doctor_map[d["doctor_id"]] = d
            except Exception:
                pass

        # Live queue lookup by booking_id or queue_id
        b_ids = [a.get("booking_id") for a in apts if a.get("booking_id")]
        q_ids = [a.get("queue_id") for a in apts if a.get("queue_id")]
        q_map = {}
        if b_ids or q_ids:
            try:
                for q in db.queue.find({"$or": [{"booking_id": {"$in": b_ids}}, {"queue_id": {"$in": q_ids}}]}):
                    if q.get("booking_id"):
                        q_map[q["booking_id"]] = q
                    if q.get("queue_id"):
                        q_map[q["queue_id"]] = q
            except Exception:
                pass

        for apt in apts:
            doc_id = apt.get("doctor_id")
            if doc_id and doc_id in doctor_map:
                d_info = doctor_map[doc_id]
                if not apt.get("doctor_name") or apt.get("doctor_name") == "Dr. Specialist":
                    apt["doctor_name"] = d_info.get("name", "Dr. Specialist")
                if not apt.get("specialization"):
                    apt["specialization"] = d_info.get("specialization") or d_info.get("department", apt.get("department"))
                if not apt.get("department"):
                    apt["department"] = d_info.get("department", "General Medicine")
                if not apt.get("room_number") or apt.get("room_number") == "Room 204":
                    apt["room_number"] = d_info.get("consultation_room") or d_info.get("room_number", "Room 204")
                if not apt.get("consultation_room"):
                    apt["consultation_room"] = apt.get("room_number")

            # Check queue status
            b_id = apt.get("booking_id")
            q_id = apt.get("queue_id")
            live_q = q_map.get(b_id) or (q_map.get(q_id) if q_id else None)
            if live_q:
                live_status = live_q.get("status")
                apt["queue_status"] = live_status
                apt["current_queue_status"] = live_status
                if live_q.get("position") is not None:
                    apt["queue_position"] = live_q["position"]
                if live_q.get("expected_consultation_time"):
                    apt["expected_consultation_time"] = live_q["expected_consultation_time"]
                    apt["expected_consultation_iso"] = live_q.get("expected_consultation_iso")
                if live_q.get("recommended_departure_time"):
                    apt["recommended_departure_time"] = live_q["recommended_departure_time"]
                    apt["recommended_departure_iso"] = live_q.get("recommended_departure_iso")
                if live_q.get("travel_info"):
                    apt["travel_info"] = live_q["travel_info"]
                
                # If active in queue, sync appointment status if appropriate
                if live_status in ["called", "in_consultation", "completed", "cancelled"]:
                    apt["status"] = live_status
            else:
                apt["queue_status"] = apt.get("status", "booked")
                apt["current_queue_status"] = apt.get("status", "booked")

            if apt.get("status") == "cancelled":
                apt["queue_position"] = "-"

            # Normalize slot time
            if not apt.get("slot_time"):
                c_slot = apt.get("consultation_slot")
                if isinstance(c_slot, dict):
                    apt["slot_time"] = c_slot.get("display_time") or c_slot.get("slot_name")
                elif apt.get("slot_id") == "morning":
                    apt["slot_time"] = "09:00 AM – 01:00 PM"
                elif apt.get("slot_id") == "evening":
                    apt["slot_time"] = "02:00 PM – 09:00 PM"

        return serialize_docs(apts)
    except Exception:
        pass

    user_apts = [b for b in IN_MEMORY_BOOKINGS if (
        b.get("patient_id") == clean_pid or
        b.get("booked_by") == clean_pid or
        b.get("booked_by_patient_id") == clean_pid or
        b.get("booked_by_user_id") == clean_pid or
        b.get("user_id") == clean_pid
    )]
    user_apts.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    for apt in user_apts:
        if apt.get("status") == "cancelled":
            apt["queue_position"] = "-"
    return serialize_docs(user_apts)

def cancel_appointment(
    booking_id: str,
    authenticated_patient_id: str,
    reason: Optional[str] = None,
    is_admin: bool = False
) -> Tuple[Optional[dict], Optional[str], int]:
    """
    Cancels an appointment booked by a patient prior to consultation start.
    - Preserves appointment in MongoDB as auditable historical data (does NOT delete).
    - Status updated to 'cancelled' with cancellation metadata (timestamp, reason, cancelled_by).
    - If linked to active queue, marks queue entry as 'cancelled' and removes from active line.
    - Recalculates queue positions and Random Forest wait-time predictions for remaining patients.
    - Emits in-app cancellation notification to the patient.
    """
    import logging
    logger = logging.getLogger(__name__)

    clean_bid = str(booking_id).strip()
    db = None
    apt = None
    try:
        db = get_db()
        apt = db.appointments.find_one({"$or": [{"booking_id": clean_bid}, {"queue_id": clean_bid}]})
    except Exception:
        pass

    if not apt:
        for b in IN_MEMORY_BOOKINGS:
            if b.get("booking_id") == clean_bid or b.get("queue_id") == clean_bid:
                apt = b
                break

    if not apt:
        return None, f"Appointment '{clean_bid}' not found", 404

    # Patient ownership verification
    booking_owners = {
        apt.get("patient_id"),
        apt.get("booked_by"),
        apt.get("booked_by_patient_id"),
        apt.get("booked_by_user_id"),
        apt.get("user_id")
    }
    booking_owners.discard(None)
    booking_owners.discard("")
    
    auth_aliases = {authenticated_patient_id}
    if db is not None:
        try:
            u = db.users.find_one({"$or": [{"patient_id": authenticated_patient_id}, {"user_id": authenticated_patient_id}, {"phone": authenticated_patient_id}]})
            if u:
                if u.get("patient_id"): auth_aliases.add(str(u["patient_id"]))
                if u.get("user_id"): auth_aliases.add(str(u["user_id"]))
                if u.get("phone"): auth_aliases.add(str(u["phone"]))
        except Exception:
            pass

    if not is_admin and not (booking_owners & auth_aliases):
        return None, "Unauthorized: You can only cancel your own appointments", 403

    current_status = str(apt.get("status", "booked")).lower()

    if current_status == "cancelled":
        return None, "Appointment has already been cancelled", 409

    if current_status in ["in_consultation", "completed"]:
        return None, "This appointment can no longer be cancelled because the consultation has started or is completed", 409

    if current_status in ["missed", "missed_consultation", "no_show"]:
        return None, "This appointment cannot be cancelled because it was missed or marked no-show", 409

    # Check linked queue entry status in DB/memory to prevent race condition if doctor just started consultation
    q_entry = None
    q_id = apt.get("queue_id")
    if db is not None:
        try:
            q_entry = db.queue.find_one({"$or": [{"booking_id": apt.get("booking_id")}, {"queue_id": q_id}]})
        except Exception:
            pass

    if not q_entry:
        try:
            from services.queue_service import IN_MEMORY_QUEUE
            for q in IN_MEMORY_QUEUE:
                if q.get("booking_id") == apt.get("booking_id") or (q_id and q.get("queue_id") == q_id):
                    q_entry = q
                    break
        except Exception:
            pass

    if q_entry:
        q_status = str(q_entry.get("status", "")).lower()
        if q_status in ["in_consultation", "completed"]:
            return None, "This appointment can no longer be cancelled because the consultation has started or is completed", 409
        if q_status == "cancelled" and current_status != "cancelled":
            current_status = "cancelled"

    now_iso = datetime.now(timezone.utc).isoformat()

    cancellation_metadata = {
        "status": "cancelled",
        "cancelled_at": now_iso,
        "cancelled_by": "patient" if not is_admin else "admin",
        "cancellation_reason": str(reason).strip() if reason else None,
        "cancellation_source": "patient" if not is_admin else "admin",
        "queue_position": "-",
        "updated_at": now_iso
    }

    actual_booking_id = apt.get("booking_id", clean_bid)
    doc_id = apt.get("doctor_id") or (q_entry and q_entry.get("doctor_id"))
    dept = apt.get("department") or (q_entry and q_entry.get("department"))
    c_date = apt.get("consultation_date") or (q_entry and q_entry.get("consultation_date")) or (apt.get("consultation_slot") or {}).get("date")
    slot_id = apt.get("slot_id") or (q_entry and q_entry.get("slot_id")) or (apt.get("consultation_slot") or {}).get("slot_id")

    if db is not None:
        try:
            # Atomic update ensuring status hasn't transitioned to in_consultation/completed/cancelled
            upd_res = db.appointments.update_one(
                {
                    "booking_id": actual_booking_id,
                    "status": {"$nin": ["in_consultation", "completed", "cancelled", "missed", "missed_consultation", "no_show"]}
                },
                {"$set": cancellation_metadata}
            )
            if upd_res.matched_count == 0:
                fresh_check = db.appointments.find_one({"booking_id": actual_booking_id})
                if fresh_check:
                    if fresh_check.get("status") in ["in_consultation", "completed"]:
                        return None, "This appointment can no longer be cancelled because the consultation has started or is completed", 409
                    if fresh_check.get("status") == "cancelled":
                        return None, "Appointment has already been cancelled", 409
                return None, "Unable to cancel appointment due to concurrent state change", 409

            # Mark queue entry as cancelled and remove from active position
            if q_id or actual_booking_id:
                queue_update = {
                    "status": "cancelled",
                    "cancelled_at": now_iso,
                    "cancelled_by": cancellation_metadata["cancelled_by"],
                    "cancellation_reason": cancellation_metadata["cancellation_reason"],
                    "cancellation_source": cancellation_metadata["cancellation_source"],
                    "is_current": False,
                    "is_next": False,
                    "position": 0,
                    "updated_at": now_iso
                }
                db.queue.update_one(
                    {"$or": [{"booking_id": actual_booking_id}, {"queue_id": q_id}]},
                    {"$set": queue_update}
                )
        except Exception as db_err:
            logger.error(f"MongoDB error cancelling appointment: {db_err}")

    # Mirror in memory
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == actual_booking_id:
            b.update(cancellation_metadata)
    try:
        from services.queue_service import IN_MEMORY_QUEUE
        for q in IN_MEMORY_QUEUE:
            if q.get("booking_id") == actual_booking_id or (q_id and q.get("queue_id") == q_id):
                q["status"] = "cancelled"
                q["cancelled_at"] = now_iso
                q["cancelled_by"] = cancellation_metadata["cancelled_by"]
                q["cancellation_reason"] = cancellation_metadata["cancellation_reason"]
                q["cancellation_source"] = cancellation_metadata["cancellation_source"]
                q["is_current"] = False
                q["is_next"] = False
                q["position"] = 0
                q["updated_at"] = now_iso
    except Exception:
        pass

    # Recalculate queue positions and ML wait times for remaining active patients
    try:
        from services.queue_service import recalculate_queue_positions
        recalculate_queue_positions(
            doctor_id=doc_id,
            department=dept,
            consultation_date=c_date,
            slot_id=slot_id
        )
    except Exception as recalc_err:
        logger.warning(f"Queue recalculation error after cancellation: {recalc_err}")

    # Send in-app notification to patient
    doctor_name = doc_id or "Doctor"
    try:
        if db is not None and doc_id:
            doc_rec = db.doctors.find_one({"doctor_id": doc_id})
            if doc_rec and doc_rec.get("name"):
                doctor_name = doc_rec["name"]
    except Exception:
        pass

    try:
        patient_notif_target = booking_patient_id or authenticated_patient_id
        create_notification(
            patient_id=patient_notif_target,
            notification_type="APPOINTMENT_CANCELLED",
            title="Appointment Cancelled",
            message=f"Your appointment with {doctor_name} has been cancelled successfully.",
            booking_id=actual_booking_id,
            suppress_sms=True
        )
    except Exception as notif_err:
        logger.warning(f"Error creating cancellation notification: {notif_err}")

    # Fetch fresh record
    final_apt = None
    if db is not None:
        try:
            final_apt = db.appointments.find_one({"booking_id": actual_booking_id})
        except Exception:
            pass
    if not final_apt:
        for b in IN_MEMORY_BOOKINGS:
            if b.get("booking_id") == actual_booking_id:
                final_apt = b
                break

    return serialize_doc(final_apt or apt), None, 200
