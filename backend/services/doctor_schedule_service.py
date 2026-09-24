from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.connection import get_db
from utils.serializers import serialize_doc, serialize_docs

def generate_schedule_id() -> str:
    db = get_db()
    count = db.doctor_schedules.count_documents({}) + 1
    return f"S{count:03d}"

def create_schedule(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    db = get_db()
    doctor_id = data.get("doctor_id", "").strip()
    date_str = data.get("date", "").strip() # YYYY-MM-DD
    start_time = data.get("start_time", "").strip() # HH:MM
    end_time = data.get("end_time", "").strip() # HH:MM

    if not doctor_id or not date_str or not start_time or not end_time:
        return None, "doctor_id, date, start_time, and end_time are required"

    doctor = db.doctors.find_one({"doctor_id": doctor_id})
    if not doctor:
        return None, "Doctor not found"

    schedule_id = generate_schedule_id()
    now = datetime.now(timezone.utc).isoformat()

    sch_doc = {
        "schedule_id": schedule_id,
        "doctor_id": doctor_id,
        "date": date_str,
        "start_time": start_time,
        "end_time": end_time,
        "available": data.get("available", True),
        "created_at": now,
        "updated_at": now
    }

    db.doctor_schedules.insert_one(sch_doc)
    return serialize_doc(sch_doc), None

def check_doctor_availability(doctor_id: str, date_str: str, time_str: str) -> bool:
    """
    Checks if a doctor has an active schedule on date_str covering time_str.
    If no schedule explicitly defined, checks if doctor.available is True.
    """
    db = get_db()
    doctor = db.doctors.find_one({"doctor_id": doctor_id})
    if not doctor or not doctor.get("available", True):
        return False

    sch = db.doctor_schedules.find_one({"doctor_id": doctor_id, "date": date_str})
    if not sch:
        # Default to doctor's overall availability if no specific date schedule set
        return True

    if not sch.get("available", True):
        return False

    # Optional time range check
    start = sch.get("start_time", "00:00")
    end = sch.get("end_time", "23:59")
    if start <= time_str <= end:
        return True

    return False
