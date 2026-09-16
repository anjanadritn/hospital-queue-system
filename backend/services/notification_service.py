import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Set
from database.mongodb import get_db, serialize_doc, serialize_docs
from config import config

logger = logging.getLogger(__name__)

IN_MEMORY_NOTIFS = []
SENT_SMS_EVENTS: Set[Tuple[str, str, str]] = set()

SMS_ELIGIBLE_NOTIFICATION_TYPES = {
    "BOOKING_CONFIRMED",
    "DEPARTURE_REMINDER",
    "ARRIVAL_OTP_ISSUED",
    "TURN_APPROACHING",
    "MISSED_CONSULTATION"
}

def resolve_patient_phone(patient_id: str, booking_id: Optional[str] = None) -> Optional[str]:
    """
    Resolves patient's phone number safely from database or in-memory records.
    Strictly filters out doctors and administrators so SMS is never sent to staff.
    """
    if not patient_id:
        return None

    # Exclude doctors, admins, and system accounts
    p_lower = str(patient_id).strip().lower()
    if (
        p_lower.startswith("d")
        or p_lower.startswith("u_doc")
        or p_lower.startswith("u_admin")
        or p_lower in ("admin", "doctor", "system")
    ):
        return None

    try:
        db = get_db()
        # 1. Look up user record
        user = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if user:
            if user.get("role") in ("doctor", "admin", "staff"):
                return None
            if user.get("phone"):
                return str(user["phone"]).strip()

        # 2. Look up patient profile
        patient = db.patients.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if patient and patient.get("phone"):
            return str(patient["phone"]).strip()

        # 3. Look up queue/booking record
        if booking_id:
            q_entry = db.queue.find_one({
                "$and": [
                    {"$or": [{"queue_id": booking_id}, {"booking_id": booking_id}]},
                    {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]}
                ]
            })
            if q_entry and (q_entry.get("patient_phone") or q_entry.get("phone")):
                return str(q_entry.get("patient_phone") or q_entry.get("phone")).strip()

            apt = db.appointments.find_one({
                "$and": [
                    {"booking_id": booking_id},
                    {"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]}
                ]
            })
            if apt and (apt.get("patient_phone") or apt.get("phone")):
                return str(apt.get("patient_phone") or apt.get("phone")).strip()
    except Exception:
        pass

    # In-memory fallback
    try:
        from services.auth_service import IN_MEMORY_USERS
        for u in IN_MEMORY_USERS:
            if u.get("patient_id") == patient_id or u.get("user_id") == patient_id:
                if u.get("role") in ("doctor", "admin", "staff"):
                    return None
                if u.get("phone"):
                    return str(u["phone"]).strip()
    except Exception:
        pass

    return None

def is_duplicate_sms(patient_id: str, notification_type: str, booking_id: Optional[str]) -> bool:
    """Checks whether an SMS has already been dispatched for this exact notification event."""
    event_key = (patient_id, notification_type, booking_id or "")
    if event_key in SENT_SMS_EVENTS:
        return True

    try:
        db = get_db()
        query = {
            "patient_id": patient_id,
            "type": notification_type,
            "sms_sent": True
        }
        if booking_id:
            query["booking_id"] = booking_id

        existing = db.notifications.find_one(query)
        if existing:
            SENT_SMS_EVENTS.add(event_key)
            return True
    except Exception:
        pass

    return False

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

    # Attempt SMS dispatch if eligible, enabled, not duplicate, and recipient is patient
    sms_sent = False
    sms_eligible = notification_type in SMS_ELIGIBLE_NOTIFICATION_TYPES

    if sms_eligible and getattr(config, "MSG91_SMS_ENABLED", False):
        try:
            from services.sms_service import sms_service, mask_phone
            if not is_duplicate_sms(patient_id, notification_type, booking_id):
                phone = resolve_patient_phone(patient_id, booking_id)
                if phone:
                    sms_text = f"{title}: {message}"
                    success, res, err = sms_service.send_sms(phone, sms_text)
                    sms_sent = bool(success)
                    if success:
                        SENT_SMS_EVENTS.add((patient_id, notification_type, booking_id or ""))
                    else:
                        logger.warning(
                            "MSG91 SMS notification failed for %s (%s): %s",
                            mask_phone(phone),
                            notification_type,
                            err
                        )
                else:
                    logger.info("SMS skipped: No phone or non-patient recipient for %s", patient_id)
            else:
                logger.info("SMS skipped: Duplicate notification event for %s (%s)", patient_id, notification_type)
        except Exception as ex:
            logger.warning("Error during SMS notification dispatch: %s", type(ex).__name__)

    notif_doc = {
        "notification_id": notif_id,
        "patient_id": patient_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "booking_id": booking_id,
        "read": False,
        "created_at": now_str,
        "sms_sent": sms_sent
    }

    try:
        db = get_db()
        res = db.notifications.insert_one(notif_doc)
        updated = db.notifications.find_one({"_id": res.inserted_id})
        return serialize_doc(updated or notif_doc), None
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
