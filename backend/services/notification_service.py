from datetime import datetime, timezone
from typing import Optional, List, Tuple
from database.mongodb import get_db, serialize_doc, serialize_docs

IN_MEMORY_NOTIFS = []

def generate_notification_id() -> str:
    try:
        db = get_db()
        count = db.notifications.count_documents({}) + 1
        return f"N{count:03d}"
    except Exception:
        return f"N{len(IN_MEMORY_NOTIFS) + 1:03d}"

def create_notification(
    patient_id: str,
    notification_type: str,
    title: str,
    message: str,
    booking_id: Optional[str] = None
) -> Tuple[Optional[dict], Optional[str]]:
    now_str = datetime.now(timezone.utc).isoformat()
    notif_id = generate_notification_id()

    notif_doc = {
        "notification_id": notif_id,
        "patient_id": patient_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "booking_id": booking_id,
        "read": False,
        "created_at": now_str
    }

    try:
        db = get_db()
        db.notifications.insert_one(notif_doc)
        updated = db.notifications.find_one({"notification_id": notif_id})
        return serialize_doc(updated), None
    except Exception:
        IN_MEMORY_NOTIFS.append(notif_doc)
        return serialize_doc(notif_doc), None

def get_patient_notifications(patient_id: str) -> dict:
    items = []
    try:
        db = get_db()
        notifs = list(db.notifications.find({"patient_id": patient_id}).sort("created_at", -1))
        if notifs:
            items = serialize_docs(notifs)
    except Exception:
        pass

    if not items:
        user_notifs = [n for n in IN_MEMORY_NOTIFS if n.get("patient_id") == patient_id]
        user_notifs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        items = serialize_docs(user_notifs)

    unread_count = sum(1 for n in items if not n.get("read"))
    return {
        "notifications": items,
        "unread_count": unread_count
    }

def mark_notification_read(notification_id: str) -> Tuple[Optional[dict], Optional[str]]:
    now_str = datetime.now(timezone.utc).isoformat()
    try:
        db = get_db()
        db.notifications.update_one(
            {"notification_id": notification_id},
            {"$set": {"read": True, "read_at": now_str}}
        )
        updated = db.notifications.find_one({"notification_id": notification_id})
        if updated:
            return serialize_doc(updated), None
    except Exception:
        pass

    for n in IN_MEMORY_NOTIFS:
        if n["notification_id"] == notification_id:
            n["read"] = True
            n["read_at"] = now_str
            return serialize_doc(n), None

    return None, f"Notification '{notification_id}' not found"

def mark_all_notifications_read(patient_id: str) -> Tuple[dict, Optional[str]]:
    now_str = datetime.now(timezone.utc).isoformat()
    try:
        db = get_db()
        db.notifications.update_many(
            {"patient_id": patient_id, "read": False},
            {"$set": {"read": True, "read_at": now_str}}
        )
    except Exception:
        pass

    for n in IN_MEMORY_NOTIFS:
        if n.get("patient_id") == patient_id and not n.get("read"):
            n["read"] = True
            n["read_at"] = now_str

    return {"message": "All notifications marked as read", "unread_count": 0}, None
