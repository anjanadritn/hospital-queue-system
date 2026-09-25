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

    # Identify returning patient profile by phone or patient_id
    if patient_phone:
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
        "department": department,
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
        "pdo": pdo,
        "doctor_id": doctor_id,
        "department": department,
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
        "room_number": "Room 204",
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
    try:
        db = get_db()
        apts = list(db.appointments.find({"patient_id": patient_id}).sort("created_at", -1))
        if apts:
            active_statuses = ["waiting", "arrived", "ready", "called", "OTP_GENERATED", "in_consultation"]
            active_q_map = {
                q.get("booking_id"): q
                for q in db.queue.find({
                    "patient_id": patient_id,
                    "status": {"$in": active_statuses}
                })
                if q.get("booking_id")
            }
            for apt in apts:
                b_id = apt.get("booking_id")
                if b_id in active_q_map:
                    live_q = active_q_map[b_id]
                    if live_q.get("expected_consultation_time"):
                        apt["expected_consultation_time"] = live_q["expected_consultation_time"]
                        apt["expected_consultation_iso"] = live_q.get("expected_consultation_iso")
                    if live_q.get("recommended_departure_time"):
                        apt["recommended_departure_time"] = live_q["recommended_departure_time"]
                        apt["recommended_departure_iso"] = live_q.get("recommended_departure_iso")
                    if live_q.get("travel_info"):
                        apt["travel_info"] = live_q["travel_info"]
                    apt["queue_position"] = live_q.get("position", apt.get("queue_position", 1))
                    apt["status"] = live_q.get("status", apt.get("status"))
            return serialize_docs(apts)
    except Exception:
        pass

    user_apts = [b for b in IN_MEMORY_BOOKINGS if b.get("patient_id") == patient_id]
    user_apts.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return serialize_docs(user_apts)
