from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.time_service import ist_isoformat

DEFAULT_DEPARTMENTS = [
    {
        "department_id": "DEPT001",
        "name": "Cardiology",
        "description": "Comprehensive cardiac care, ECG, diagnostic evaluations & advanced heart monitoring.",
        "room": "Room 204",
        "head_doctor": "Dr. Ananya Sharma",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT002",
        "name": "General Medicine",
        "description": "Primary healthcare, fever triage, diabetes management & routine medical checkups.",
        "room": "Room 101",
        "head_doctor": "Dr. Rajesh Kumar",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT003",
        "name": "Orthopedics",
        "description": "Joint replacement, fracture trauma care, spine clinic & musculoskeletal wellness.",
        "room": "Room 305",
        "head_doctor": "Dr. Sunita Patel",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT004",
        "name": "Pediatrics",
        "description": "Dedicated pediatric consultations, neonatal monitoring, infant health & immunizations.",
        "room": "Room 108",
        "head_doctor": "Dr. Vikram Sethi",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT005",
        "name": "Dermatology",
        "description": "Clinical skincare, allergy patch testing, psoriasis & cosmetic dermatology care.",
        "room": "Room 212",
        "head_doctor": "Dr. Meera Deshmukh",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT006",
        "name": "Neurology",
        "description": "Brain and nervous system disorders, headache clinic, epilepsy & stroke rehabilitation.",
        "room": "Room 402",
        "head_doctor": "Dr. Arvind Rao",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT007",
        "name": "ENT",
        "description": "Ear, nose & throat surgery, audiology screening, sinusitis & tonsil treatments.",
        "room": "Room 115",
        "head_doctor": "Dr. Kavita Menon",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT008",
        "name": "Gastroenterology",
        "description": "Digestive endoscopy, liver & pancreatic disorders, acid reflux & GI treatments.",
        "room": "Room 310",
        "head_doctor": "Dr. Manoj Joshi",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT009",
        "name": "Pulmonology",
        "description": "Chest medicine, asthma therapy, chronic cough, COPD & sleep apnea consultations.",
        "room": "Room 201",
        "head_doctor": "Dr. Priya Iyer",
        "is_active": True,
        "specialists_count": 1
    },
    {
        "department_id": "DEPT010",
        "name": "Ophthalmology",
        "description": "Comprehensive vision testing, cataract consultations, glaucoma & retinal health.",
        "room": "Room 250",
        "head_doctor": "Dr. Abhijit Gupta",
        "is_active": True,
        "specialists_count": 1
    }
]

def generate_department_id() -> str:
    try:
        db = get_db()
        count = db.departments.count_documents({}) + 1
        return f"DEPT{count:03d}"
    except Exception:
        return f"DEPT{len(DEFAULT_DEPARTMENTS) + 1:03d}"

def get_all_departments(active_only: bool = False) -> List[dict]:
    try:
        db = get_db()
        query = {"is_active": True} if active_only else {}
        depts = list(db.departments.find(query))
        if depts:
            return serialize_docs(depts)
    except Exception:
        pass

    if active_only:
        return [d for d in DEFAULT_DEPARTMENTS if d.get("is_active", True)]
    return DEFAULT_DEPARTMENTS

def get_department_by_id(department_id: str) -> Optional[dict]:
    try:
        db = get_db()
        dept = db.departments.find_one({"department_id": department_id})
        if dept:
            return serialize_doc(dept)
    except Exception:
        pass

    for d in DEFAULT_DEPARTMENTS:
        if d["department_id"] == department_id or d["name"].lower() == department_id.lower():
            return d
    return None

def create_department(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    name = data.get("name", "").strip()
    if not name:
        return None, "Department name is required"

    try:
        db = get_db()
        existing = db.departments.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
        if existing:
            return None, "Department with this name already exists"

        dept_id = generate_department_id()
        now = ist_isoformat()

        dept_doc = {
            "department_id": dept_id,
            "name": name,
            "description": data.get("description", "").strip(),
            "room": data.get("room", "OPD Block"),
            "head_doctor": data.get("head_doctor", "Senior Specialist"),
            "is_active": data.get("is_active", True),
            "specialists_count": data.get("specialists_count", 1),
            "created_at": now,
            "updated_at": now
        }

        db.departments.insert_one(dept_doc)
        return serialize_doc(dept_doc), None
    except Exception as e:
        dept_id = f"DEPT{len(DEFAULT_DEPARTMENTS) + 1:03d}"
        new_d = {
            "department_id": dept_id,
            "name": name,
            "description": data.get("description", "").strip(),
            "room": data.get("room", "OPD Block"),
            "head_doctor": data.get("head_doctor", "Senior Specialist"),
            "is_active": True,
            "specialists_count": 1
        }
        DEFAULT_DEPARTMENTS.append(new_d)
        return new_d, None

def update_department(department_id: str, data: dict) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        dept = db.departments.find_one({"department_id": department_id})
        if not dept:
            return None, "Department not found"

        now = ist_isoformat()
        update_fields = {"updated_at": now}

        if "name" in data:
            name = data["name"].strip()
            dup = db.departments.find_one({
                "name": {"$regex": f"^{name}$", "$options": "i"},
                "department_id": {"$ne": department_id}
            })
            if dup:
                return None, "Another department with this name already exists"
            update_fields["name"] = name

        for field in ["description", "room", "head_doctor"]:
            if field in data:
                update_fields[field] = data[field].strip()

        if "is_active" in data:
            update_fields["is_active"] = bool(data["is_active"])

        db.departments.update_one({"department_id": department_id}, {"$set": update_fields})
        updated = db.departments.find_one({"department_id": department_id})
        return serialize_doc(updated), None
    except Exception as e:
        for d in DEFAULT_DEPARTMENTS:
            if d["department_id"] == department_id:
                if "name" in data: d["name"] = data["name"]
                if "description" in data: d["description"] = data["description"]
                return d, None
        return None, "Department not found"

def soft_delete_department(department_id: str) -> Tuple[bool, Optional[str]]:
    try:
        db = get_db()
        dept = db.departments.find_one({"department_id": department_id})
        if not dept:
            return False, "Department not found"

        now = ist_isoformat()
        db.departments.update_one({"department_id": department_id}, {"$set": {"is_active": False, "updated_at": now}})
        return True, None
    except Exception:
        for d in DEFAULT_DEPARTMENTS:
            if d["department_id"] == department_id:
                d["is_active"] = False
                return True, None
        return False, "Department not found"
