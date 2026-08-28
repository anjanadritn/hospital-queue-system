from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.prediction_service import get_wait_time_prediction
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
    try:
        db = get_db()
        query = {"status": {"$in": ["waiting", "arrived", "ready", "OTP_GENERATED"]}}
        if doctor_id:
            query["doctor_id"] = doctor_id
        elif department:
            query["department"] = department

        waiting_entries = list(db.queue.find(query))
        def priority_sort_key(entry):
            p = str(entry.get("priority", "normal")).lower()
            return (0 if p == "emergency" else 1, entry.get("joined_at", ""))

        waiting_entries.sort(key=priority_sort_key)

        for idx, entry in enumerate(waiting_entries, start=1):
            predicted_time = get_wait_time_prediction(
                symptoms=entry.get("symptoms", ["general"]),
                department=entry.get("department", "General"),
                priority=entry.get("priority", "normal"),
                queue_position=idx
            )
            
            new_status = entry.get("status", "waiting")
            if idx == 1 and (entry.get("arrived_at_hospital") or new_status == "arrived"):
                new_status = "ready"
                generate_consultation_otp(entry["queue_id"], entry.get("patient_id", "P001"), entry.get("doctor_id", "D001"))

            db.queue.update_one(
                {"queue_id": entry["queue_id"]},
                {"$set": {"position": idx, "predicted_wait_time": predicted_time, "status": new_status}}
            )
        return
    except Exception:
        pass

    waiting = [q for q in IN_MEMORY_QUEUE if q.get("status") in ["waiting", "arrived", "ready", "OTP_GENERATED"]]
    def p_key(entry):
        p = str(entry.get("priority", "normal")).lower()
        return (0 if p == "emergency" else 1, entry.get("joined_at", ""))
    waiting.sort(key=p_key)

    for idx, entry in enumerate(waiting, start=1):
        entry["position"] = idx
        entry["predicted_wait_time"] = get_wait_time_prediction(
            symptoms=entry.get("symptoms", ["general"]),
            department=entry.get("department", "General"),
            priority=entry.get("priority", "normal"),
            queue_position=idx
        )
        if idx == 1 and (entry.get("arrived_at_hospital") or entry.get("status") == "arrived"):
            entry["status"] = "ready"
            generate_consultation_otp(entry["queue_id"], entry.get("patient_id", "P001"), entry.get("doctor_id", "D001"))

def join_queue(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    patient_id = data.get("patient_id", "P001").strip()
    doctor_id = data.get("doctor_id", "D001").strip()
    department = data.get("department", "Cardiology").strip()
    priority = data.get("priority", "normal").strip().lower()
    symptoms = data.get("symptoms", [])
    custom_symptoms = data.get("custom_symptoms", "").strip()

    if not patient_id:
        return None, "patient_id is required"

    queue_id = generate_queue_id()
    now_str = datetime.now(timezone.utc).isoformat()
    clean_priority = "emergency" if priority == "emergency" else "normal"

    travel_info = calculate_travel_metrics()

    queue_entry = {
        "queue_id": queue_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "department": department,
        "priority": clean_priority,
        "symptoms": symptoms,
        "custom_symptoms": custom_symptoms,
        "position": 1,
        "status": "waiting",
        "room_number": "Room 204",
        "arrived_at_hospital": False,
        "joined_at": now_str,
        "predicted_wait_time": 15,
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
        res = serialize_doc(queue_entry)

    create_notification(
        patient_id=patient_id,
        notification_type="QUEUE_UPDATED",
        title="Queue Token Assigned",
        message=f"Queue token {queue_id} created. Position #{res.get('position', 1)}.",
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

def complete_consultation(booking_id: str, actual_duration_mins: int = 15) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": booking_id}, {"booking_id": booking_id}]}) or \
                db.appointments.find_one({"booking_id": booking_id})
        if entry:
            q_id = entry.get("queue_id", booking_id)
            b_id = entry.get("booking_id", booking_id)
            db.queue.update_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}, {"$set": {"status": "completed", "actual_duration_mins": actual_duration_mins}})
            db.appointments.update_one({"booking_id": b_id}, {"$set": {"status": "completed", "actual_duration_mins": actual_duration_mins}})
            recalculate_queue_positions(doctor_id=entry.get("doctor_id"), department=entry.get("department"))
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

def get_all_queues(department_filter: Optional[str] = None) -> List[dict]:
    try:
        db = get_db()
        query = {}
        if department_filter:
            query["department"] = {"$regex": f"^{department_filter}$", "$options": "i"}

        entries = list(db.queue.find(query))
        if entries:
            def priority_sort(entry):
                p = str(entry.get("priority", "normal")).lower()
                return (0 if p == "emergency" else 1, entry.get("position", 999), entry.get("joined_at", ""))
            entries.sort(key=priority_sort)
            return serialize_docs(entries)
    except Exception:
        pass

    def p_sort(entry):
        p = str(entry.get("priority", "normal")).lower()
        return (0 if p == "emergency" else 1, entry.get("position", 999), entry.get("joined_at", ""))
    sorted_mem = sorted(IN_MEMORY_QUEUE, key=p_sort)
    return serialize_docs(sorted_mem)

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
