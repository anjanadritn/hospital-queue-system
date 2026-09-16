from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.prediction_service import get_wait_time_prediction, predict_consultation_duration_service
from services.notification_service import create_notification
from services.travel_service import calculate_travel_metrics
from services.otp_service import generate_consultation_otp

IN_MEMORY_QUEUE = []

def generate_queue_id() -> str:
    try:
        db = get_db()
        count = db.queue.count_documents({}) + 1
        return f"Q{count:03d}"
    except Exception:
        return f"Q{len(IN_MEMORY_QUEUE) + 1:03d}"

def recalculate_queue_positions(doctor_id: Optional[str] = None, department: Optional[str] = None):
    """
    Recalculates queue positions and wait times for all active patients.
    Wait times are strictly based on the actual patients ahead, summing their
    Random Forest predicted consultation durations (plus any active in-consultation remaining time).
    When patients are completed or skipped, all remaining active patients advance automatically.
    Emergency patients maintain top priority (Tier 0).
    """
    active_statuses = ["waiting", "arrived", "ready", "called", "OTP_GENERATED", "missed", "missed_consultation"]
    try:
        db = get_db()
        # If neither doctor_id nor department provided, recalculate for all active queues
        if not doctor_id and not department:
            active_docs = db.queue.distinct("doctor_id", {"status": {"$in": active_statuses}})
            if active_docs:
                for doc in active_docs:
                    if doc:
                        recalculate_queue_positions(doctor_id=doc)
                return
            active_depts = db.queue.distinct("department", {"status": {"$in": active_statuses}})
            for dept in active_depts:
                if dept:
                    recalculate_queue_positions(department=dept)
            return

        query = {"status": {"$in": active_statuses}}
        in_consult_query = {"status": "in_consultation"}
        if doctor_id:
            query["doctor_id"] = doctor_id
            in_consult_query["doctor_id"] = doctor_id
        elif department:
            query["department"] = department
            in_consult_query["department"] = department

        # Check for currently in-consultation patient with doctor
        in_consult_entry = db.queue.find_one(in_consult_query)
        in_consult_remaining = 0
        if in_consult_entry:
            dur = in_consult_entry.get("predicted_duration")
            if not dur:
                dur = predict_consultation_duration_service(
                    symptoms=in_consult_entry.get("symptoms", ["general"]),
                    department=in_consult_entry.get("department", "General Medicine"),
                    priority=in_consult_entry.get("priority", "normal"),
                    doctor_id=in_consult_entry.get("doctor_id") or doctor_id,
                    queue_position=1
                )
            in_consult_remaining = max(3, int(dur * 0.5))

        waiting_entries = list(db.queue.find(query))

        def priority_sort_key(entry):
            p = str(entry.get("priority", "normal")).lower()
            s = str(entry.get("status", "waiting")).lower()
            is_emergency = 0 if p == "emergency" else 1
            is_missed = 1 if s in ["missed", "missed_consultation"] else 0
            tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
            return (tier, entry.get("joined_at", ""), entry.get("queue_id", ""))

        waiting_entries.sort(key=priority_sort_key)

        cumulative_wait = in_consult_remaining
        for idx, entry in enumerate(waiting_entries, start=1):
            symptoms = entry.get("symptoms", ["general"])
            dept = entry.get("department", "General Medicine")
            prio = entry.get("priority", "normal")
            doc_id = entry.get("doctor_id") or doctor_id or "D001"
            is_emergency = (str(prio).lower() == "emergency")
            current_status = entry.get("status", "waiting")

            # Predict consultation duration for THIS patient using Random Forest
            predicted_dur = predict_consultation_duration_service(
                symptoms=symptoms if isinstance(symptoms, list) else ["general"],
                department=dept,
                priority=prio,
                doctor_id=doc_id,
                queue_position=idx
            )

            # Wait time based on actual patients ahead in queue
            if idx == 1:
                if is_emergency:
                    predicted_wait = max(2, in_consult_remaining) if in_consult_remaining > 0 else 5
                elif current_status in ["ready", "called", "in_consultation"]:
                    predicted_wait = max(2, in_consult_remaining) if in_consult_remaining > 0 else 5
                else:
                    predicted_wait = max(5, in_consult_remaining) if in_consult_remaining > 0 else 5
            else:
                predicted_wait = max(5, cumulative_wait)

            # Accumulate this patient's consultation duration for patients behind
            cumulative_wait += predicted_dur

            new_status = current_status
            if current_status in ["waiting", "ready"]:
                new_status = "ready" if idx == 1 else "waiting"
            elif current_status in ["missed", "missed_consultation"]:
                new_status = "missed"

            # Dynamic travel and departure calculation based on real wait time
            city = entry.get("city") or entry.get("patient_address") or "Tumkur City"
            entry_coords = None
            if entry.get("origin_latitude") is not None and entry.get("origin_longitude") is not None:
                try:
                    entry_coords = [float(entry["origin_longitude"]), float(entry["origin_latitude"])]
                except (ValueError, TypeError):
                    entry_coords = None
            travel_info = calculate_travel_metrics(patient_address=city, wait_time_min=predicted_wait, origin_coords=entry_coords)

            db.queue.update_one(
                {"queue_id": entry["queue_id"]},
                {"$set": {
                    "position": idx,
                    "predicted_duration": predicted_dur,
                    "predicted_wait_time": predicted_wait,
                    "status": new_status,
                    "travel_info": travel_info
                }}
            )

            # Turn is approaching notification for top positions
            if idx <= 2 and not entry.get("approaching_notified") and new_status != "missed":
                try:
                    create_notification(
                        patient_id=entry.get("patient_id", "P001"),
                        notification_type="TURN_APPROACHING",
                        title="Your Turn is Approaching!",
                        message=f"Your token {entry['queue_id']} is now #{idx} in line. Estimated waiting time is ~{predicted_wait} mins. Please be near Room {entry.get('room_number', '204')}.",
                        booking_id=entry["queue_id"]
                    )
                    db.queue.update_one({"queue_id": entry["queue_id"]}, {"$set": {"approaching_notified": True}})
                except Exception:
                    pass
        return
    except Exception:
        pass

    # In-memory queue fallback
    waiting = [q for q in IN_MEMORY_QUEUE if q.get("status") in active_statuses]
    if doctor_id:
        waiting = [q for q in waiting if q.get("doctor_id") == doctor_id]
    elif department:
        waiting = [q for q in waiting if q.get("department") == department]

    in_consult = next((q for q in IN_MEMORY_QUEUE if q.get("status") == "in_consultation" and (not doctor_id or q.get("doctor_id") == doctor_id)), None)
    in_consult_remaining = max(3, int((in_consult.get("predicted_duration") or 15) * 0.5)) if in_consult else 0

    def p_key(entry):
        p = str(entry.get("priority", "normal")).lower()
        s = str(entry.get("status", "waiting")).lower()
        is_emergency = 0 if p == "emergency" else 1
        is_missed = 1 if s in ["missed", "missed_consultation"] else 0
        tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
        return (tier, entry.get("joined_at", ""), entry.get("queue_id", ""))

    waiting.sort(key=p_key)

    cumulative_wait = in_consult_remaining
    for idx, entry in enumerate(waiting, start=1):
        symptoms = entry.get("symptoms", ["general"])
        dept = entry.get("department", "General Medicine")
        prio = entry.get("priority", "normal")
        doc_id = entry.get("doctor_id") or doctor_id or "D001"
        is_emergency = (str(prio).lower() == "emergency")
        current_status = entry.get("status", "waiting")

        predicted_dur = predict_consultation_duration_service(
            symptoms=symptoms if isinstance(symptoms, list) else ["general"],
            department=dept,
            priority=prio,
            doctor_id=doc_id,
            queue_position=idx
        )

        if idx == 1:
            if is_emergency:
                predicted_wait = max(2, in_consult_remaining) if in_consult_remaining > 0 else 5
            elif current_status in ["ready", "called", "in_consultation"]:
                predicted_wait = max(2, in_consult_remaining) if in_consult_remaining > 0 else 5
            else:
                predicted_wait = max(5, in_consult_remaining) if in_consult_remaining > 0 else 5
        else:
            predicted_wait = max(5, cumulative_wait)

        cumulative_wait += predicted_dur

        entry["position"] = idx
        entry["predicted_duration"] = predicted_dur
        entry["predicted_wait_time"] = predicted_wait
        if idx == 1 and current_status in ["waiting", "ready"]:
            entry["status"] = "ready"
        elif current_status in ["missed", "missed_consultation"]:
            entry["status"] = "missed"

def join_queue(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    patient_id = str(data.get("patient_id", "P001")).strip()
    doctor_id = str(data.get("doctor_id", "D001")).strip()
    department = str(data.get("department", "General Medicine")).strip()
    priority = str(data.get("priority", "normal")).strip().lower()
    symptoms = data.get("symptoms", [])
    custom_symptoms = str(data.get("custom_symptoms", "")).strip()

    # Clinical Patient Details for Consultation View
    patient_name = str(data.get("name") or data.get("patient_name") or "Patient").strip()
    age = int(data["age"]) if "age" in data and data["age"] not in [None, ""] else None
    gender = str(data.get("gender", "Not Specified")).strip()
    duration_days = int(data["duration_days"]) if "duration_days" in data and data["duration_days"] not in [None, ""] else None
    height_cm = float(data["height_cm"]) if "height_cm" in data and data["height_cm"] not in [None, ""] else None
    weight_kg = float(data["weight_kg"]) if "weight_kg" in data and data["weight_kg"] not in [None, ""] else None
    city = str(data.get("city") or data.get("location") or data.get("address") or "Tumakuru").strip()
    pdo = str(data.get("pdo", "")).strip()
    booking_id = str(data.get("booking_id", "")).strip()

    if not patient_id:
        return None, "patient_id is required"

    # Fetch patient profile details fallback if missing
    patient_phone = str(data.get("phone", "")).strip()
    try:
        db = get_db()
        u = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if u:
            if patient_name == "Patient":
                patient_name = u.get("name", "Patient")
            if not patient_phone:
                patient_phone = u.get("phone", "")
            if not age and u.get("age"):
                age = u.get("age")
            if gender == "Not Specified" and u.get("gender"):
                gender = u.get("gender")
            if not city and u.get("city"):
                city = u.get("city")
    except Exception:
        pass

    queue_id = generate_queue_id()
    now_str = datetime.now(timezone.utc).isoformat()
    clean_priority = "emergency" if priority == "emergency" else "normal"

    # ML Consultation Duration Prediction
    predicted_dur = predict_consultation_duration_service(
        symptoms=symptoms if isinstance(symptoms, list) else ["general"],
        department=department,
        priority=clean_priority,
        doctor_id=doctor_id,
        queue_position=1
    )

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

    # Initial Travel Metrics based on City / Landmark / GPS
    travel_info = calculate_travel_metrics(patient_address=city, wait_time_min=predicted_dur, origin_coords=origin_coords)

    # Generate 6-digit Hospital Arrival Verification OTP
    otp_doc, _ = generate_consultation_otp(queue_id, patient_id, doctor_id)
    arrival_otp = otp_doc.get("otp", "") if otp_doc else "123456"

    # Fetch Doctor Consultation Room
    room_number = "Room 101"
    try:
        db = get_db()
        doc = db.doctors.find_one({"doctor_id": doctor_id})
        if doc and doc.get("consultation_room"):
            room_number = doc.get("consultation_room")
    except Exception:
        pass

    queue_entry = {
        "queue_id": queue_id,
        "booking_id": booking_id or queue_id,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "age": age,
        "gender": gender,
        "symptoms": symptoms,
        "custom_symptoms": custom_symptoms,
        "duration_days": duration_days,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "city": city,
        "patient_address": str(data.get("patient_address") or city).strip(),
        "origin_latitude": origin_latitude,
        "origin_longitude": origin_longitude,
        "is_approximate_location": is_approximate_location,
        "pdo": pdo,
        "doctor_id": doctor_id,
        "department": department,
        "priority": clean_priority,
        "position": 1,
        "status": "waiting",
        "room_number": room_number,
        "arrived_at_hospital": False,
        "verified_by_admin": False,
        "arrival_otp": arrival_otp,
        "joined_at": now_str,
        "predicted_duration": predicted_dur,
        "predicted_wait_time": predicted_dur,
        "travel_info": travel_info
    }

    try:
        db = get_db()
        db.queue.insert_one(queue_entry)
        recalculate_queue_positions(doctor_id=doctor_id, department=department)
        updated = db.queue.find_one({"queue_id": queue_id})
        res = serialize_doc(updated)
    except Exception:
        queue_entry.pop("_id", None)
        IN_MEMORY_QUEUE.append(queue_entry)
        recalculate_queue_positions(doctor_id=doctor_id, department=department)
        mem_entry = next((q for q in IN_MEMORY_QUEUE if q.get("queue_id") == queue_id), queue_entry)
        res = serialize_doc(mem_entry)

    pos = res.get("position", 1)
    wait_time = res.get("predicted_wait_time", predicted_dur)
    dep_time = res.get("travel_info", {}).get("recommended_departure_time", "Soon")

    # 1. Token assignment notification
    create_notification(
        patient_id=patient_id,
        notification_type="QUEUE_UPDATED",
        title="Queue Token Assigned",
        message=f"Queue Token {queue_id} assigned (Position #{pos}). Estimated waiting time is {wait_time} minutes.",
        booking_id=queue_id
    )

    # 2. Smart Departure notification
    create_notification(
        patient_id=patient_id,
        notification_type="DEPARTURE_REMINDER",
        title="Recommended Departure Time",
        message=f"Your recommended departure time from {city} is {dep_time}. Estimated waiting time is {wait_time} minutes.",
        booking_id=queue_id
    )

    # 3. Arrival OTP notification
    create_notification(
        patient_id=patient_id,
        notification_type="ARRIVAL_OTP_ISSUED",
        title="Hospital Arrival Code",
        message=f"Your 6-digit hospital arrival verification code is {arrival_otp}. Present this code at the reception desk upon arriving at SIMSRH.",
        booking_id=queue_id
    )

    if doctor_id:
        create_notification(
            patient_id=doctor_id,
            notification_type="PATIENT_JOINED_QUEUE",
            title="New Patient in OPD Queue",
            message=f"Patient {patient_name} (Token {queue_id}) joined your queue for {department}.",
            booking_id=queue_id
        )

    return res, None

def mark_patient_arrived(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            db.queue.update_one(
                {"queue_id": q_id},
                {"$set": {"arrived_at_hospital": True, "status": "arrived"}}
            )
            recalculate_queue_positions(doctor_id=entry.get("doctor_id"), department=entry.get("department"))
            updated = db.queue.find_one({"queue_id": q_id})
            res = serialize_doc(updated)
            create_notification(
                patient_id=entry["patient_id"],
                notification_type="ARRIVED_AT_HOSPITAL",
                title="Welcome to Smart Hospital",
                message=f"Status set to Hospital Queue Mode. Please take a seat near {entry.get('room_number', 'Room 204')}.",
                booking_id=q_id
            )
            return res, None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["arrived_at_hospital"] = True
            q["status"] = "arrived"
            recalculate_queue_positions(doctor_id=q.get("doctor_id"), department=q.get("department"))
            create_notification(
                patient_id=q["patient_id"],
                notification_type="ARRIVED_AT_HOSPITAL",
                title="Welcome to Smart Hospital",
                message=f"Status set to Hospital Queue Mode. Please take a seat near {q.get('room_number', 'Room 204')}.",
                booking_id=q["queue_id"]
            )
            return serialize_doc(q), None

    return None, f"Queue entry '{queue_id}' not found"

def update_queue_status(queue_id: str, new_status: str, metadata: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
    valid_statuses = ["waiting", "arrived", "ready", "called", "in_consultation", "completed", "no_show", "cancelled", "missed", "missed_consultation"]
    if new_status not in valid_statuses:
        return None, f"Invalid status '{new_status}'. Allowed: {valid_statuses}"

    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]}) or db.appointments.find_one({"booking_id": queue_id})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            b_id = entry.get("booking_id", queue_id)
            now_str = datetime.now(timezone.utc).isoformat()
            update_data = {"status": new_status, "updated_at": now_str}

            if new_status == "completed" and metadata:
                doc_notes = metadata.get("notes") or metadata.get("doctor_notes") or metadata.get("clinical_notes")
                diagnosis = metadata.get("diagnosis")
                advice = metadata.get("advice")
                duration = metadata.get("actual_duration_mins", 15)
                if doc_notes:
                    update_data["doctor_notes"] = str(doc_notes).strip()
                if diagnosis:
                    update_data["diagnosis"] = str(diagnosis).strip()
                if advice:
                    update_data["advice"] = str(advice).strip()
                update_data["actual_duration_mins"] = duration
                update_data["completed_at"] = now_str

            db.queue.update_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}, {"$set": update_data})
            db.appointments.update_one({"booking_id": b_id}, {"$set": update_data})
            recalculate_queue_positions(doctor_id=entry.get("doctor_id"), department=entry.get("department"))

            # Archive consultation record into permanent db.consultations
            if new_status == "completed":
                try:
                    from services.consultation_service import archive_consultation
                    archive_consultation(
                        queue_or_booking_id=q_id,
                        doctor_notes=update_data.get("doctor_notes"),
                        diagnosis=update_data.get("diagnosis"),
                        advice=update_data.get("advice"),
                        actual_duration_mins=update_data.get("actual_duration_mins", 15)
                    )
                except Exception as ex:
                    logger.warning(f"Error archiving consultation: {ex}")

            updated = db.queue.find_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}) or db.appointments.find_one({"booking_id": b_id})
            res = serialize_doc(updated)
            return res, None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["status"] = new_status
            if new_status == "completed" and metadata:
                q["doctor_notes"] = metadata.get("notes") or metadata.get("clinical_notes")
                q["diagnosis"] = metadata.get("diagnosis")
                q["advice"] = metadata.get("advice")
            recalculate_queue_positions(doctor_id=q.get("doctor_id"), department=q.get("department"))
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == queue_id:
            b["status"] = new_status
            return serialize_doc(b), None

    return None, f"Queue token '{queue_id}' not found"

def skip_patient_service(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Skips the current patient if unavailable/not arrived.
    Marks status as 'missed' ("Missed Consultation"), moves that token to the END of the active queue
    by updating joined_at and missed_at, recalculates positions and Random Forest wait times for all
    remaining patients, and dispatches a missed consultation alert.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]}) or db.appointments.find_one({"booking_id": queue_id})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            b_id = entry.get("booking_id", queue_id)
            skip_count = entry.get("skip_count", 0) + 1

            db.queue.update_one(
                {"$or": [{"queue_id": q_id}, {"booking_id": b_id}]},
                {"$set": {
                    "status": "missed",
                    "missed_at": now_str,
                    "joined_at": now_str, # Sets joined time to now so token moves to end of line
                    "skip_count": skip_count,
                    "updated_at": now_str
                }}
            )
            db.appointments.update_one(
                {"booking_id": b_id},
                {"$set": {
                    "status": "missed",
                    "missed_at": now_str,
                    "skip_count": skip_count,
                    "updated_at": now_str
                }}
            )

            # Recalculate queue positions so remaining active patients advance
            recalculate_queue_positions(doctor_id=entry.get("doctor_id"), department=entry.get("department"))

            # Notify patient that consultation was missed and moved to end of line
            try:
                create_notification(
                    patient_id=entry.get("patient_id", "P001"),
                    notification_type="MISSED_CONSULTATION",
                    title="Consultation Call Missed",
                    message=f"Doctor called your token {q_id} but you were unavailable. Your token has been retained and moved to the end of the active queue. Please report to the reception desk or chamber.",
                    booking_id=q_id
                )
            except Exception:
                pass

            updated = db.queue.find_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}) or db.appointments.find_one({"booking_id": b_id})
            return serialize_doc(updated), None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["status"] = "missed"
            q["missed_at"] = now_str
            q["joined_at"] = now_str
            q["skip_count"] = q.get("skip_count", 0) + 1
            recalculate_queue_positions(doctor_id=q.get("doctor_id"), department=q.get("department"))
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == queue_id:
            b["status"] = "missed"
            b["missed_at"] = now_str
            b["skip_count"] = b.get("skip_count", 0) + 1
            return serialize_doc(b), None

    return None, f"Queue token '{queue_id}' not found"

def complete_consultation(booking_id: str, actual_duration_mins: int = 15, doctor_notes: Optional[str] = None, diagnosis: Optional[str] = None, advice: Optional[str] = None) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": booking_id}, {"booking_id": booking_id}]}) or \
                db.appointments.find_one({"booking_id": booking_id})
        if entry:
            q_id = entry.get("queue_id", booking_id)
            b_id = entry.get("booking_id", booking_id)
            now_str = datetime.now(timezone.utc).isoformat()
            update_data = {
                "status": "completed",
                "actual_duration_mins": actual_duration_mins,
                "completed_at": now_str
            }
            if doctor_notes:
                update_data["doctor_notes"] = str(doctor_notes).strip()
            if diagnosis:
                update_data["diagnosis"] = str(diagnosis).strip()
            if advice:
                update_data["advice"] = str(advice).strip()

            db.queue.update_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}, {"$set": update_data})
            db.appointments.update_one({"booking_id": b_id}, {"$set": update_data})
            recalculate_queue_positions(doctor_id=entry.get("doctor_id"), department=entry.get("department"))

            try:
                from services.consultation_service import archive_consultation
                archive_consultation(
                    queue_or_booking_id=q_id,
                    doctor_notes=doctor_notes,
                    diagnosis=diagnosis,
                    advice=advice,
                    actual_duration_mins=actual_duration_mins
                )
            except Exception as ex:
                logger.warning(f"Error archiving consultation: {ex}")

            entry["status"] = "completed"
            entry["actual_duration_mins"] = actual_duration_mins
            return serialize_doc(entry), None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == booking_id or q.get("booking_id") == booking_id:
            q["status"] = "completed"
            q["actual_duration_mins"] = actual_duration_mins
            recalculate_queue_positions(doctor_id=q.get("doctor_id"), department=q.get("department"))
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == booking_id:
            b["status"] = "completed"
            b["actual_duration_mins"] = actual_duration_mins
            return serialize_doc(b), None

    return None, f"Consultation '{booking_id}' not found"

def get_queue_status(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]})
        if entry:
            return serialize_doc(entry), None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == queue_id:
            return serialize_doc(b), None

    return None, f"Queue entry '{queue_id}' not found"

def get_all_queues(department_filter: Optional[str] = None) -> Tuple[List[dict], Optional[str]]:
    try:
        db = get_db()
        query = {}
        if department_filter:
            query["department"] = {"$regex": f"^{department_filter}$", "$options": "i"}

        entries = list(db.queue.find(query))
        if entries:
            def priority_sort(entry):
                p = str(entry.get("priority", "normal")).lower()
                s = str(entry.get("status", "waiting")).lower()
                is_emergency = 0 if p == "emergency" else 1
                is_missed = 1 if s in ["missed", "missed_consultation"] else 0
                tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
                return (tier, entry.get("position", 999), entry.get("joined_at", ""))
            entries.sort(key=priority_sort)

            # Attach patient name/phone from the users collection if missing
            patient_ids = list({e.get("patient_id") for e in entries if e.get("patient_id")})
            users_lookup = {}
            if patient_ids:
                for u in db.users.find({"patient_id": {"$in": patient_ids}}):
                    users_lookup[u.get("patient_id")] = {
                        "patient_name": u.get("name"),
                        "patient_phone": u.get("phone")
                    }
            for entry in entries:
                info = users_lookup.get(entry.get("patient_id"), {})
                if not entry.get("patient_name") or entry.get("patient_name") == "Unknown":
                    entry["patient_name"] = info.get("patient_name", "Patient")
                if not entry.get("patient_phone"):
                    entry["patient_phone"] = info.get("patient_phone", "")

            return serialize_docs(entries), None
    except Exception:
        pass

    def p_sort(entry):
        p = str(entry.get("priority", "normal")).lower()
        s = str(entry.get("status", "waiting")).lower()
        is_emergency = 0 if p == "emergency" else 1
        is_missed = 1 if s in ["missed", "missed_consultation"] else 0
        tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
        return (tier, entry.get("position", 999), entry.get("joined_at", ""))
    sorted_mem = sorted(IN_MEMORY_QUEUE, key=p_sort)
    return serialize_docs(sorted_mem), None

def escalate_emergency(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            now_str = datetime.now(timezone.utc).isoformat()
            db.queue.update_one({"queue_id": q_id}, {"$set": {"priority": "emergency", "updated_at": now_str}})
            recalculate_queue_positions(doctor_id=entry.get("doctor_id"), department=entry.get("department"))
            updated = db.queue.find_one({"queue_id": q_id})
            res = serialize_doc(updated)

            create_notification(
                patient_id=entry["patient_id"],
                notification_type="EMERGENCY_QUEUE_UPDATE",
                title="Emergency Priority Promoted",
                message=f"Queue token {q_id} promoted to Emergency Priority. Your position is now #1.",
                booking_id=q_id
            )

            # Alert Assigned Doctor for Immediate Triage
            doc_id = entry.get("doctor_id")
            if doc_id:
                create_notification(
                    patient_id=doc_id,
                    notification_type="EMERGENCY_ALERT",
                    title="URGENT: Emergency Patient Escalated",
                    message=f"Patient {entry.get('patient_name', 'Patient')} (Token {q_id}) has been escalated to EMERGENCY PRIORITY in {entry.get('department', 'OPD')}.",
                    booking_id=q_id
                )
            return res, None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["priority"] = "emergency"
            recalculate_queue_positions(doctor_id=q.get("doctor_id"), department=q.get("department"))
            create_notification(
                patient_id=q["patient_id"],
                notification_type="EMERGENCY_QUEUE_UPDATE",
                title="Emergency Priority Promoted",
                message=f"Queue token {q.get('queue_id')} promoted to Emergency Priority. Your position is now #1.",
                booking_id=q.get("queue_id")
            )
            return serialize_doc(q), None

    return None, f"Queue entry '{queue_id}' not found"