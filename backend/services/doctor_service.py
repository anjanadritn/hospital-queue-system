from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs

DEFAULT_DOCTORS = [
    {
        "doctor_id": "D001",
        "name": "Dr. Ananya Sharma",
        "specialization": "Interventional Cardiology",
        "department": "Cardiology",
        "experience": "12 years",
        "consultation_room": "Room 204",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "09:00 AM - 04:00 PM"
    },
    {
        "doctor_id": "D002",
        "name": "Dr. Rajesh Kumar",
        "specialization": "General Physician & Diabetology",
        "department": "General Medicine",
        "experience": "15 years",
        "consultation_room": "Room 101",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "08:30 AM - 05:00 PM"
    },
    {
        "doctor_id": "D003",
        "name": "Dr. Sunita Patel",
        "specialization": "Joint Replacement & Trauma",
        "department": "Orthopedics",
        "experience": "10 years",
        "consultation_room": "Room 305",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "10:00 AM - 03:00 PM"
    },
    {
        "doctor_id": "D004",
        "name": "Dr. Vikram Sethi",
        "specialization": "Pediatric Care & Immunization",
        "department": "Pediatrics",
        "experience": "8 years",
        "consultation_room": "Room 108",
        "available": True,
        "avg_consultation_duration": 10,
        "working_hours": "09:00 AM - 02:00 PM"
    },
    {
        "doctor_id": "D005",
        "name": "Dr. Meera Deshmukh",
        "specialization": "Clinical Dermatology & Allergy",
        "department": "Dermatology",
        "experience": "9 years",
        "consultation_room": "Room 212",
        "available": True,
        "avg_consultation_duration": 12,
        "working_hours": "11:00 AM - 05:00 PM"
    },
    {
        "doctor_id": "D006",
        "name": "Dr. Arvind Rao",
        "specialization": "Neurology & Epilepsy Specialist",
        "department": "Neurology",
        "experience": "14 years",
        "consultation_room": "Room 402",
        "available": True,
        "avg_consultation_duration": 20,
        "working_hours": "09:00 AM - 01:00 PM"
    },
    {
        "doctor_id": "D007",
        "name": "Dr. Kavita Menon",
        "specialization": "ENT & Sinus Surgery",
        "department": "ENT",
        "experience": "11 years",
        "consultation_room": "Room 115",
        "available": True,
        "avg_consultation_duration": 10,
        "working_hours": "10:00 AM - 04:00 PM"
    },
    {
        "doctor_id": "D008",
        "name": "Dr. Manoj Joshi",
        "specialization": "Gastroenterology & Hepatology",
        "department": "Gastroenterology",
        "experience": "13 years",
        "consultation_room": "Room 310",
        "available": True,
        "avg_consultation_duration": 15,
        "working_hours": "09:30 AM - 03:30 PM"
    }
]

def get_all_doctors(department_filter: Optional[str] = None) -> List[dict]:
    try:
        db = get_db()
        query = {"available": True}
        if department_filter:
            query["department"] = {"$regex": f"^{department_filter}$", "$options": "i"}
        docs = list(db.doctors.find(query))
        if docs:
            return serialize_docs(docs)
    except Exception:
        pass

    if department_filter:
        filtered = [d for d in DEFAULT_DOCTORS if d["department"].lower() == department_filter.lower()]
        return filtered
    return DEFAULT_DOCTORS

def get_doctor_by_id(doctor_id: str) -> Optional[dict]:
    try:
        db = get_db()
        doc = db.doctors.find_one({"doctor_id": doctor_id})
        if doc:
            return serialize_doc(doc)
    except Exception:
        pass

    for d in DEFAULT_DOCTORS:
        if d["doctor_id"] == doctor_id:
            return d
    return None

def add_doctor(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    doctor_id = data.get("doctor_id") or f"D{len(DEFAULT_DOCTORS) + 1:03d}"
    name = data.get("name")
    department = data.get("department")
    
    if not name or not department:
        return None, "name and department are required"

    doc = {
        "doctor_id": doctor_id,
        "name": name,
        "specialization": data.get("specialization", "Specialist"),
        "department": department,
        "experience": data.get("experience", "5 years"),
        "consultation_room": data.get("consultation_room", "Room 101"),
        "available": data.get("available", True),
        "avg_consultation_duration": data.get("avg_consultation_duration", 12),
        "working_hours": data.get("working_hours", "09:00 AM - 05:00 PM")
    }

    try:
        db = get_db()
        db.doctors.insert_one(doc)
        return serialize_doc(doc), None
    except Exception:
        DEFAULT_DOCTORS.append(doc)
        return doc, None
