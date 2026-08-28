from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.connection import get_db
from utils.serializers import serialize_doc, serialize_docs

def generate_department_id() -> str:
    db = get_db()
    count = db.departments.count_documents({}) + 1
    return f"DEPT{count:03d}"

def get_all_departments(active_only: bool = False) -> List[dict]:
    db = get_db()
    query = {"is_active": True} if active_only else {}
    depts = list(db.departments.find(query))
    return serialize_docs(depts)

def get_department_by_id(department_id: str) -> Optional[dict]:
    db = get_db()
    dept = db.departments.find_one({"department_id": department_id})
    return serialize_doc(dept)

def create_department(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    db = get_db()
    name = data.get("name", "").strip()

    # Check duplicate name
    existing = db.departments.find_one({"name": {"$regex": f"^{name}$", "$options": "i"}})
    if existing:
        return None, "Department with this name already exists"

    dept_id = generate_department_id()
    now = datetime.now(timezone.utc).isoformat()

    dept_doc = {
        "department_id": dept_id,
        "name": name,
        "description": data.get("description", "").strip(),
        "is_active": data.get("is_active", True),
        "created_at": now,
        "updated_at": now
    }

    db.departments.insert_one(dept_doc)
    return serialize_doc(dept_doc), None

def update_department(department_id: str, data: dict) -> Tuple[Optional[dict], Optional[str]]:
    db = get_db()
    dept = db.departments.find_one({"department_id": department_id})
    if not dept:
        return None, "Department not found"

    now = datetime.now(timezone.utc).isoformat()
    update_fields = {"updated_at": now}

    if "name" in data:
        name = data["name"].strip()
        # Ensure name is unique among other departments
        dup = db.departments.find_one({
            "name": {"$regex": f"^{name}$", "$options": "i"},
            "department_id": {"$ne": department_id}
        })
        if dup:
            return None, "Another department with this name already exists"
        update_fields["name"] = name

    if "description" in data:
        update_fields["description"] = data["description"].strip()

    if "is_active" in data:
        update_fields["is_active"] = bool(data["is_active"])

    db.departments.update_one({"department_id": department_id}, {"$set": update_fields})
    updated = db.departments.find_one({"department_id": department_id})
    return serialize_doc(updated), None

def soft_delete_department(department_id: str) -> Tuple[bool, Optional[str]]:
    db = get_db()
    dept = db.departments.find_one({"department_id": department_id})
    if not dept:
        return False, "Department not found"

    now = datetime.now(timezone.utc).isoformat()
    db.departments.update_one({"department_id": department_id}, {"$set": {"is_active": False, "updated_at": now}})
    return True, None
