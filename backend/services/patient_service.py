from datetime import datetime, timezone
from typing import Optional, Tuple
from database.mongodb import get_db, serialize_doc

def generate_patient_id() -> str:
    db = get_db()
    count = db.patients.count_documents({}) + 1
    return f"P{count:03d}"

def create_patient_profile(user_id: str, data: dict) -> Tuple[Optional[dict], Optional[str]]:
    db = get_db()
    
    # Verify user exists
    user = db.users.find_one({"user_id": user_id})
    if not user:
        return None, "Associated user account not found"

    # Check if patient profile already exists for user
    existing = db.patients.find_one({"user_id": user_id})
    if existing:
        return serialize_doc(existing), None

    patient_id = generate_patient_id()
    now = datetime.now(timezone.utc).isoformat()

    patient_doc = {
        "patient_id": patient_id,
        "user_id": user_id,
        "name": data.get("name", "").strip(),
        "age": int(data["age"]) if "age" in data and data["age"] is not None else None,
        "gender": data.get("gender", "").strip(),
        "phone": data.get("phone", "").strip(),
        "email": user.get("email", ""),
        "created_at": now,
        "updated_at": now
    }

    db.patients.insert_one(patient_doc)
    return serialize_doc(patient_doc), None

def get_patient_by_id(patient_id: str) -> Optional[dict]:
    db = get_db()
    doc = db.patients.find_one({"patient_id": patient_id})
    return serialize_doc(doc)

def get_patient_by_user_id(user_id: str) -> Optional[dict]:
    db = get_db()
    doc = db.patients.find_one({"user_id": user_id})
    return serialize_doc(doc)

def update_patient_profile(patient_id: str, data: dict) -> Tuple[Optional[dict], Optional[str]]:
    db = get_db()
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        return None, "Patient profile not found"

    now = datetime.now(timezone.utc).isoformat()
    update_fields = {"updated_at": now}

    if "name" in data:
        update_fields["name"] = data["name"].strip()
    if "age" in data and data["age"] is not None:
        update_fields["age"] = int(data["age"])
    if "gender" in data:
        update_fields["gender"] = data["gender"].strip()
    if "phone" in data:
        update_fields["phone"] = data["phone"].strip()

    db.patients.update_one({"patient_id": patient_id}, {"$set": update_fields})
    updated = db.patients.find_one({"patient_id": patient_id})
    return serialize_doc(updated), None
