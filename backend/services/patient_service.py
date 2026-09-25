from datetime import datetime, timezone
import re
from typing import Optional, Tuple, List
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.time_service import ist_isoformat

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

    patient_id = user.get("patient_id") or generate_patient_id()
    now = ist_isoformat()

    patient_doc = {
        "patient_id": patient_id,
        "user_id": user_id,
        "name": data.get("name", "").strip() or user.get("name", "Patient"),
        "age": int(data["age"]) if "age" in data and data["age"] not in [None, ""] else user.get("age"),
        "gender": data.get("gender", "").strip() or user.get("gender"),
        "phone": data.get("phone", "").strip() or user.get("phone", ""),
        "height_cm": float(data["height_cm"]) if "height_cm" in data and data["height_cm"] not in [None, ""] else user.get("height_cm"),
        "weight_kg": float(data["weight_kg"]) if "weight_kg" in data and data["weight_kg"] not in [None, ""] else user.get("weight_kg"),
        "city": str(data.get("city") or data.get("address") or user.get("city") or "Tumakuru").strip(),
        "address": str(data.get("address") or data.get("city") or user.get("address") or "").strip(),
        "email": user.get("email", ""),
        "created_at": now,
        "updated_at": now
    }

    db.patients.insert_one(patient_doc)
    # Ensure user has patient_id
    if not user.get("patient_id"):
        db.users.update_one({"user_id": user_id}, {"$set": {"patient_id": patient_id}})

    return serialize_doc(patient_doc), None

def get_patient_by_id(patient_id: str) -> Optional[dict]:
    db = get_db()
    doc = db.patients.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
    if not doc:
        # Fallback to check users collection
        u = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if u and u.get("role") == "patient":
            # auto-create/sync patient record
            now = ist_isoformat()
            p_id = u.get("patient_id") or f"P{patient_id}"
            p_doc = {
                "patient_id": p_id,
                "user_id": u.get("user_id"),
                "name": u.get("name", "Patient"),
                "phone": u.get("phone", ""),
                "email": u.get("email", ""),
                "age": u.get("age"),
                "gender": u.get("gender"),
                "height_cm": u.get("height_cm"),
                "weight_kg": u.get("weight_kg"),
                "city": u.get("city") or "Tumakuru",
                "address": u.get("address", ""),
                "created_at": u.get("created_at") or now,
                "updated_at": now
            }
            db.patients.update_one({"patient_id": p_id}, {"$set": p_doc}, upsert=True)
            return serialize_doc(p_doc)
        return None
    return serialize_doc(doc)

def get_patient_by_user_id(user_id: str) -> Optional[dict]:
    db = get_db()
    doc = db.patients.find_one({"user_id": user_id})
    if not doc:
        return get_patient_by_id(user_id)
    return serialize_doc(doc)

def update_patient_profile(patient_id: str, data: dict) -> Tuple[Optional[dict], Optional[str]]:
    db = get_db()
    patient = db.patients.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
    if not patient:
        # Check users collection
        u = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if not u:
            return None, "Patient profile not found"
        # Auto create
        now = ist_isoformat()
        real_pid = u.get("patient_id") or patient_id
        db.patients.update_one(
            {"patient_id": real_pid},
            {"$set": {
                "patient_id": real_pid,
                "user_id": u.get("user_id"),
                "name": u.get("name"),
                "phone": u.get("phone"),
                "email": u.get("email"),
                "created_at": now,
                "updated_at": now
            }},
            upsert=True
        )
        patient = db.patients.find_one({"patient_id": real_pid})

    actual_pid = patient.get("patient_id", patient_id)
    user_id = patient.get("user_id")

    now = ist_isoformat()
    update_fields = {"updated_at": now}

    if "name" in data and str(data["name"]).strip():
        update_fields["name"] = str(data["name"]).strip()
    if "age" in data and data["age"] not in [None, ""]:
        try:
            update_fields["age"] = int(data["age"])
        except (ValueError, TypeError):
            pass
    if "gender" in data and str(data["gender"]).strip():
        update_fields["gender"] = str(data["gender"]).strip()
    if "phone" in data and str(data["phone"]).strip():
        update_fields["phone"] = str(data["phone"]).strip()
    if "email" in data:
        update_fields["email"] = str(data["email"]).strip()
    if "height_cm" in data and data["height_cm"] not in [None, ""]:
        try:
            update_fields["height_cm"] = float(data["height_cm"])
        except (ValueError, TypeError):
            pass
    if "weight_kg" in data and data["weight_kg"] not in [None, ""]:
        try:
            update_fields["weight_kg"] = float(data["weight_kg"])
        except (ValueError, TypeError):
            pass
    if "city" in data and str(data["city"]).strip():
        update_fields["city"] = str(data["city"]).strip()
    if "address" in data:
        update_fields["address"] = str(data["address"]).strip()
    if "date_of_birth" in data and data["date_of_birth"]:
        update_fields["date_of_birth"] = str(data["date_of_birth"]).strip()
    if "village" in data and str(data["village"]).strip():
        update_fields["village"] = str(data["village"]).strip()

    # Update in db.patients
    db.patients.update_one({"patient_id": actual_pid}, {"$set": update_fields})
    
    # Also update in db.users so user profile in auth stays synchronized
    if user_id:
        user_sync = {k: v for k, v in update_fields.items() if k != "patient_id"}
        db.users.update_one({"user_id": user_id}, {"$set": user_sync})

    updated = db.patients.find_one({"patient_id": actual_pid})
    return serialize_doc(updated), None

def sync_or_update_patient_profile(
    patient_id: Optional[str] = None,
    phone: Optional[str] = None,
    data: Optional[dict] = None
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Syncs or updates a patient's persistent profile during booking or profile updates.
    Maintains synchronization between db.patients and db.users.
    """
    if not data:
        data = {}
    db = get_db()
    now = ist_isoformat()

    # Locate existing patient by patient_id or phone
    query_conds = []
    if patient_id:
        query_conds.extend([{"patient_id": patient_id}, {"user_id": patient_id}])
    if phone and str(phone).strip():
        clean_phone = re.sub(r"\D", "", str(phone).strip())
        if len(clean_phone) >= 10:
            query_conds.append({"phone": clean_phone[-10:]})

    patient = None
    if query_conds:
        patient = db.patients.find_one({"$or": query_conds})

    user = None
    if not patient and query_conds:
        user = db.users.find_one({"$or": query_conds})

    actual_pid = (
        (patient and patient.get("patient_id")) or
        (user and user.get("patient_id")) or
        patient_id or
        generate_patient_id()
    )
    user_id = (
        (patient and patient.get("user_id")) or
        (user and user.get("user_id"))
    )

    update_fields = {"updated_at": now}
    if "name" in data and str(data["name"]).strip():
        update_fields["name"] = str(data["name"]).strip()
    elif user and user.get("name"):
        update_fields["name"] = user.get("name")

    if "phone" in data and str(data["phone"]).strip():
        update_fields["phone"] = str(data["phone"]).strip()
    elif user and user.get("phone"):
        update_fields["phone"] = user.get("phone")

    if "email" in data and str(data["email"]).strip():
        update_fields["email"] = str(data["email"]).strip()
    elif user and user.get("email"):
        update_fields["email"] = user.get("email")

    if "age" in data and data["age"] not in [None, ""]:
        try:
            update_fields["age"] = int(data["age"])
        except (ValueError, TypeError):
            pass
    elif user and user.get("age") is not None:
        update_fields["age"] = user.get("age")

    if "gender" in data and str(data["gender"]).strip():
        update_fields["gender"] = str(data["gender"]).strip()
    elif user and user.get("gender"):
        update_fields["gender"] = user.get("gender")

    if "height_cm" in data and data["height_cm"] not in [None, ""]:
        try:
            update_fields["height_cm"] = float(data["height_cm"])
        except (ValueError, TypeError):
            pass
    elif user and user.get("height_cm") is not None:
        update_fields["height_cm"] = user.get("height_cm")

    if "weight_kg" in data and data["weight_kg"] not in [None, ""]:
        try:
            update_fields["weight_kg"] = float(data["weight_kg"])
        except (ValueError, TypeError):
            pass
    elif user and user.get("weight_kg") is not None:
        update_fields["weight_kg"] = user.get("weight_kg")

    if "city" in data and str(data["city"]).strip():
        update_fields["city"] = str(data["city"]).strip()
    elif user and user.get("city"):
        update_fields["city"] = user.get("city")

    if "address" in data and str(data["address"]).strip():
        update_fields["address"] = str(data["address"]).strip()
    elif user and user.get("address"):
        update_fields["address"] = user.get("address")

    # Upsert in db.patients
    db.patients.update_one(
        {"patient_id": actual_pid},
        {
            "$set": update_fields,
            "$setOnInsert": {
                "patient_id": actual_pid,
                "user_id": user_id,
                "created_at": now
            }
        },
        upsert=True
    )

    # Synchronize db.users
    if user_id:
        user_sync = {k: v for k, v in update_fields.items() if k not in ["patient_id", "created_at"]}
        db.users.update_one({"user_id": user_id}, {"$set": user_sync})

    updated = db.patients.find_one({"patient_id": actual_pid})
    return serialize_doc(updated), None


def search_patients(query_str: Optional[str] = None) -> List[dict]:
    """
    Search patients by Patient ID, Name, Phone number, or Village/City for Admin Patient Records.
    Computes accurate total completed consultations / visits and last visit date using deduplicated records.
    """
    from services.consultation_service import get_patient_consultations

    db = get_db()
    filter_q = {}
    if query_str and query_str.strip():
        q_clean = query_str.strip()
        regex_pattern = {"$regex": re.escape(q_clean), "$options": "i"}
        filter_q = {
            "$or": [
                {"patient_id": regex_pattern},
                {"name": regex_pattern},
                {"phone": regex_pattern},
                {"city": regex_pattern},
                {"address": regex_pattern}
            ]
        }

    # Fetch patients
    patients = list(db.patients.find(filter_q).sort([("updated_at", -1)]))

    # Also check if any users with role 'patient' are not in db.patients yet
    existing_user_ids = {p.get("user_id") for p in patients if p.get("user_id")}
    existing_patient_ids = {p.get("patient_id") for p in patients if p.get("patient_id")}
    existing_phones = {p.get("phone") for p in patients if p.get("phone")}

    user_patients = list(db.users.find({"role": "patient"}))
    for u in user_patients:
        u_uid = u.get("user_id")
        u_pid = u.get("patient_id")
        u_phone = u.get("phone")
        if (
            (not u_uid or u_uid not in existing_user_ids) and
            (not u_pid or u_pid not in existing_patient_ids) and
            (not u_phone or u_phone not in existing_phones)
        ):
            p_doc = {
                "patient_id": u_pid or f"P_{u_uid}",
                "user_id": u_uid,
                "name": u.get("name", "Patient"),
                "phone": u_phone or "",
                "email": u.get("email", ""),
                "age": u.get("age"),
                "gender": u.get("gender"),
                "height_cm": u.get("height_cm"),
                "weight_kg": u.get("weight_kg"),
                "city": u.get("city") or u.get("address") or "Tumakuru",
                "created_at": u.get("created_at")
            }
            if not query_str or any(
                query_str.strip().lower() in str(p_doc.get(field, "")).lower()
                for field in ["patient_id", "name", "phone", "city"]
            ):
                patients.append(p_doc)

    # Compute visit counts and last visit for each patient
    enhanced_list = []
    for p in patients:
        pid = p.get("patient_id")
        p_ser = serialize_doc(p)

        consultations = get_patient_consultations(pid)
        total_visits = len(consultations)

        last_visit_date = None
        if consultations:
            first_c = consultations[0]
            last_visit_date = (
                first_c.get("consultation_date") or
                first_c.get("completed_at", "").split("T")[0] or
                first_c.get("created_at", "").split("T")[0]
            )

        p_ser["total_visits"] = total_visits
        p_ser["last_visit_date"] = last_visit_date
        enhanced_list.append(p_ser)

    return enhanced_list


def update_profile_picture(patient_id: str, image_bytes: bytes, mime_type: str) -> tuple:
    """
    Stores a profile picture for the given patient_id.
    - Validates MIME type: only jpeg, png, webp allowed.
    - Validates size: max 2 MB.
    - Stores as base64 data-URI in db.patients and db.users.
    - Returns (updated_patient_doc, error_string).
    """
    import base64

    ALLOWED_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    MAX_BYTES = 2 * 1024 * 1024  # 2 MB

    if mime_type not in ALLOWED_MIMES:
        return None, f"Invalid image type '{mime_type}'. Allowed types: JPEG, PNG, WebP."
    if len(image_bytes) > MAX_BYTES:
        size_kb = len(image_bytes) // 1024
        return None, f"Image too large ({size_kb} KB). Maximum allowed size is 2 MB."

    b64_data = base64.b64encode(image_bytes).decode("utf-8")
    data_uri = f"data:{mime_type};base64,{b64_data}"
    now = ist_isoformat()

    try:
        db = get_db()
        # Find patient record
        patient = db.patients.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if not patient:
            # Try via users collection
            user = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
            if not user:
                return None, "Patient profile not found"
            actual_pid = user.get("patient_id") or patient_id
            user_id = user.get("user_id")
        else:
            actual_pid = patient.get("patient_id", patient_id)
            user_id = patient.get("user_id")

        # Update patients collection
        db.patients.update_one(
            {"patient_id": actual_pid},
            {"$set": {"profile_picture": data_uri, "updated_at": now}},
            upsert=True
        )
        # Sync to users collection
        if user_id:
            db.users.update_one(
                {"user_id": user_id},
                {"$set": {"profile_picture": data_uri, "updated_at": now}}
            )

        updated = db.patients.find_one({"patient_id": actual_pid})
        result = serialize_doc(updated) if updated else {"patient_id": actual_pid, "profile_picture": data_uri}
        result.pop("password_hash", None)
        return result, None
    except Exception as ex:
        return None, f"Failed to save profile picture: {str(ex)}"


def remove_profile_picture(patient_id: str) -> tuple:
    """
    Removes the profile picture for the given patient_id from db.patients and db.users.
    Returns (updated_patient_doc, error_string).
    """
    now = ist_isoformat()
    try:
        db = get_db()
        patient = db.patients.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if not patient:
            user = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
            if not user:
                return None, "Patient profile not found"
            actual_pid = user.get("patient_id") or patient_id
            user_id = user.get("user_id")
        else:
            actual_pid = patient.get("patient_id", patient_id)
            user_id = patient.get("user_id")

        db.patients.update_one(
            {"patient_id": actual_pid},
            {"$set": {"profile_picture": None, "updated_at": now}}
        )
        if user_id:
            db.users.update_one(
                {"user_id": user_id},
                {"$set": {"profile_picture": None, "updated_at": now}}
            )

        updated = db.patients.find_one({"patient_id": actual_pid})
        result = serialize_doc(updated) if updated else {"patient_id": actual_pid, "profile_picture": None}
        result.pop("password_hash", None)
        return result, None
    except Exception as ex:
        return None, f"Failed to remove profile picture: {str(ex)}"

