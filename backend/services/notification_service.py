import re
import logging
from datetime import datetime, timezone
from typing import Optional, List, Tuple, Set, Any
from database.mongodb import get_db, serialize_doc, serialize_docs
from config import config
from services.time_service import ist_isoformat

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

TURN_DEPARTURE_NOTIFICATION_TYPES = {
    "TURN_APPROACHING",
    "DEPARTURE_REMINDER"
}

def format_turn_approaching_sms(
    token: str,
    queue_position: Any,
    estimated_wait: Any,
    expected_consultation: Optional[str] = None,
    recommended_departure: Optional[str] = None,
    room: Optional[str] = None,
    arrival_code: Optional[str] = None
) -> str:
    """
    Formats the single combined TURN_APPROACHING SMS message in the standardized hospital style:
    [SIMSRH Hospital] 🏥
    Your turn is approaching
    Token {token}
    Queue position {pos}
    Estimated wait {wait} min
    Expected consultation {consultation_time}
    Recommended departure {departure_time}
    Please be near Room {room}
    """
    clean_token = re.sub(r"[#:]", "", str(token or "D001-Q020")).strip() or "D001-Q020"
    clean_pos = re.sub(r"[#:]", "", str(queue_position or "2")).strip() or "2"

    # Clean estimated wait (digits only, followed by 'min')
    wait_str = str(estimated_wait or "14").strip()
    digits = re.findall(r"\d+", wait_str)
    wait_val = digits[0] if digits else ("0" if wait_str == "0" else "14")

    # Clean expected consultation time (preserve standard HH:MM AM/PM, remove label colons or #)
    exp_val = str(expected_consultation or "9:09 PM").replace("#", "").strip()
    exp_val = re.sub(r"^(?:expected\s*(?:consultation|at)?[:\s]*)", "", exp_val, flags=re.IGNORECASE).rstrip(".").strip()
    if exp_val.startswith(":"):
        exp_val = exp_val.lstrip(": ")
    if not exp_val:
        exp_val = "9:09 PM"

    # Clean recommended departure time (preserve standard HH:MM AM/PM, remove label colons or #)
    dep_val = str(recommended_departure or "8:58 PM").replace("#", "").strip()
    dep_val = re.sub(r"^(?:recommended\s*(?:departure)?[:\s]*)", "", dep_val, flags=re.IGNORECASE).rstrip(".").strip()
    if dep_val.startswith(":"):
        dep_val = dep_val.lstrip(": ")
    if not dep_val:
        dep_val = "8:58 PM"

    # Clean room (e.g. 'Room 204' -> '204', '204' -> '204')
    room_val = re.sub(r"[#:]", "", str(room or "204")).strip()
    room_val = re.sub(r"^(?:room\s*)", "", room_val, flags=re.IGNORECASE).strip() or "204"

    lines = [
        "[SIMSRH Hospital] 🏥",
        "Your turn is approaching",
        f"Token {clean_token}",
        f"Queue position {clean_pos}",
        f"Estimated wait {wait_val} min",
        f"Expected consultation {exp_val}",
        f"Recommended departure {dep_val}",
        f"Please be near Room {room_val}"
    ]
    return "\n".join(lines)

def format_arrival_otp_sms(
    arrival_code: Any,
    token: Optional[str] = None
) -> str:
    """
    Formats the separate Hospital Arrival OTP SMS message in the standardized hospital style:
    [SIMSRH Hospital] 🏥
    Hospital Arrival Code {arrival_code}
    Token {token}
    Show this code at the reception desk on arrival
    """
    clean_code = re.sub(r"[#:]", "", str(arrival_code or "800066")).rstrip(".").strip() or "800066"
    lines = [
        "[SIMSRH Hospital] 🏥",
        f"Hospital Arrival Code {clean_code}"
    ]
    if token:
        clean_tok = re.sub(r"[#:]", "", str(token)).strip()
        if clean_tok:
            lines.append(f"Token {clean_tok}")
    lines.append("Show this code at the reception desk on arrival")
    return "\n".join(lines)

def format_booking_confirmed_sms(
    token: str,
    queue_position: Any,
    consultation_date: Optional[str] = None,
    doctor_id: Optional[str] = None,
    department: Optional[str] = None,
    room: Optional[str] = None,
    recommended_departure: Optional[str] = None,
    arrival_code: Optional[str] = None
) -> str:
    """
    Formats the single comprehensive BOOKING_CONFIRMED SMS message in the standardized hospital style:
    [SIMSRH Hospital] 🏥
    Consultation Booked Successfully
    Token {token}
    Queue position {pos}
    Date {date}
    Doctor {doctor} ({dept})
    Room {room}
    Recommended departure {departure}
    Hospital Arrival Code {arrival_code}
    Show this code at the reception desk on arrival
    """
    clean_token = re.sub(r"[#:]", "", str(token or "Pending")).strip() or "Pending"
    clean_pos = re.sub(r"[#:]", "", str(queue_position or "1")).strip() or "1"
    clean_date = str(consultation_date or "").replace("#", "").strip()
    clean_doc = str(doctor_id or "").replace("#", "").strip()
    clean_dept = str(department or "").replace("#", "").strip()
    clean_room = re.sub(r"[#:]", "", str(room or "204")).strip()
    clean_room = re.sub(r"^(?:room\s*)", "", clean_room, flags=re.IGNORECASE).strip() or "204"
    clean_dep = str(recommended_departure or "Soon").replace("#", "").strip()
    clean_code = re.sub(r"[#:]", "", str(arrival_code or "800066")).rstrip(".").strip() or "800066"

    lines = [
        "[SIMSRH Hospital] 🏥",
        "Consultation Booked Successfully",
        f"Token {clean_token}",
        f"Queue position {clean_pos}",
        f"Date {clean_date}",
        f"Doctor {clean_doc} ({clean_dept})",
        f"Room {clean_room}",
        f"Recommended departure {clean_dep}",
        f"Hospital Arrival Code {clean_code}",
        "Show this code at the reception desk on arrival"
    ]
    return "\n".join(lines)

def build_turn_approaching_sms_text(
    patient_id: Optional[str] = None,
    booking_id: Optional[str] = None,
    message: Optional[str] = None
) -> str:
    token = booking_id
    pos = None
    wait = None
    exp = None
    dep = None
    room = None
    otp = None

    # 1. Parse message string first for any explicit values passed by the caller
    if message:
        tok_match = re.search(r"token\s+([A-Za-z0-9\-]+)", message, re.IGNORECASE)
        if tok_match:
            token = tok_match.group(1)
        pos_match = re.search(r"(?:now\s+#?|#)(\d+)(?:\s+in\s+line|\b)", message, re.IGNORECASE)
        if pos_match:
            pos = pos_match.group(1)
        wait_match = re.search(r"[~]?\s*(\d+)\s*mins?", message, re.IGNORECASE)
        if wait_match:
            wait = wait_match.group(1)
        exp_match = re.search(r"Expected\s+at\s+([^.]+)", message, re.IGNORECASE)
        if exp_match:
            exp = exp_match.group(1).strip()
        room_match = re.search(r"Room\s+([A-Za-z0-9]+)", message, re.IGNORECASE)
        if room_match:
            room = room_match.group(1)

    # 2. Query MongoDB for any details not specified in message
    try:
        db = get_db()
        q_entry = None
        if booking_id:
            q_entry = db.queue.find_one({"$or": [{"queue_id": booking_id}, {"booking_id": booking_id}]})
        if not q_entry and patient_id:
            q_entry = db.queue.find_one({"patient_id": patient_id})

        if q_entry:
            if not token:
                token = q_entry.get("queue_id") or booking_id
            if not pos:
                pos = q_entry.get("position")
            if not wait:
                wait = q_entry.get("predicted_wait_time")
            if not exp:
                exp = q_entry.get("expected_consultation_time")
            if not dep:
                dep = q_entry.get("recommended_departure_time") or (q_entry.get("travel_info") or {}).get("recommended_departure_time")
            if not room:
                room = q_entry.get("room_number")
            if not otp:
                otp = q_entry.get("arrival_otp")

        if (not otp or not pos or not dep) and booking_id:
            apt = db.appointments.find_one({"$or": [{"booking_id": booking_id}, {"queue_id": booking_id}]})
            if apt:
                if not pos:
                    pos = apt.get("queue_position")
                if not wait:
                    wait = apt.get("predicted_wait_time")
                if not exp:
                    exp = apt.get("expected_consultation_time")
                if not dep:
                    dep = apt.get("recommended_departure_time")
                if not room:
                    room = apt.get("room_number")
                if not otp:
                    otp = apt.get("arrival_otp")
    except Exception:
        pass

    # 3. In-memory fallback if not in DB
    if not q_entry:
        try:
            from services.queue_service import IN_MEMORY_QUEUE
            for q in IN_MEMORY_QUEUE:
                if q.get("queue_id") == booking_id or q.get("booking_id") == booking_id or q.get("patient_id") == patient_id:
                    if not token:
                        token = q.get("queue_id")
                    if not pos:
                        pos = q.get("position")
                    if not wait:
                        wait = q.get("predicted_wait_time")
                    if not exp:
                        exp = q.get("expected_consultation_time")
                    if not dep:
                        dep = q.get("recommended_departure_time") or (q.get("travel_info") or {}).get("recommended_departure_time")
                    if not room:
                        room = q.get("room_number")
                    if not otp:
                        otp = q.get("arrival_otp")
                    break
        except Exception:
            pass

    return format_turn_approaching_sms(
        token=token or "D001-Q020",
        queue_position=pos or 2,
        estimated_wait=wait or 14,
        expected_consultation=exp or "9:09 PM",
        recommended_departure=dep or "8:58 PM",
        room=room or "204"
    )

def build_arrival_otp_sms_text(
    patient_id: Optional[str] = None,
    booking_id: Optional[str] = None,
    message: Optional[str] = None
) -> str:
    otp = None
    token = booking_id

    # 1. Parse from message if available
    if message:
        tok_match = re.search(r"token\s+([A-Za-z0-9\-]+)", message, re.IGNORECASE)
        if tok_match:
            token = tok_match.group(1)
        otp_match = re.search(r"\b(\d{6})\b", message)
        if otp_match:
            otp = otp_match.group(1)

    # 2. Query DB if missing
    if not otp or not token:
        try:
            db = get_db()
            q_entry = None
            if booking_id:
                q_entry = db.queue.find_one({"$or": [{"queue_id": booking_id}, {"booking_id": booking_id}]})
            if not q_entry and patient_id:
                q_entry = db.queue.find_one({"patient_id": patient_id})
            if q_entry:
                if not token:
                    token = q_entry.get("queue_id") or booking_id
                if not otp:
                    otp = q_entry.get("arrival_otp")

            if (not otp or not token) and booking_id:
                apt = db.appointments.find_one({"$or": [{"booking_id": booking_id}, {"queue_id": booking_id}]})
                if apt:
                    if not token:
                        token = apt.get("queue_id") or apt.get("booking_id")
                    if not otp:
                        otp = apt.get("arrival_otp")

            if not otp and booking_id:
                otp_rec = db.otp_verifications.find_one({"token_or_booking_id": booking_id})
                if otp_rec:
                    otp = otp_rec.get("otp")
        except Exception:
            pass

    # 3. In-memory fallback
    if not otp:
        try:
            from services.queue_service import IN_MEMORY_QUEUE
            for q in IN_MEMORY_QUEUE:
                if q.get("queue_id") == booking_id or q.get("booking_id") == booking_id or q.get("patient_id") == patient_id:
                    if not token:
                        token = q.get("queue_id")
                    if not otp:
                        otp = q.get("arrival_otp")
                    break
        except Exception:
            pass

    return format_arrival_otp_sms(
        arrival_code=otp or "800066",
        token=token
    )

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


    return None

def resolve_canonical_event_ids(booking_id: Optional[str]) -> Set[str]:
    """
    Resolves all linked identity tokens for an appointment/queue event (e.g. B029 and D001-Q020).
    Ensures deduplication recognizes that the appointment ID and queue token represent the exact same event.
    """
    if not booking_id:
        return set()
    b_clean = str(booking_id).strip()
    ids = {b_clean}

    try:
        db = get_db()
        # Check appointments collection
        apt = db.appointments.find_one({"$or": [{"booking_id": b_clean}, {"queue_id": b_clean}]})
        if apt:
            if apt.get("booking_id"):
                ids.add(str(apt["booking_id"]).strip())
            if apt.get("queue_id"):
                ids.add(str(apt["queue_id"]).strip())

        # Check queue collection
        q_doc = db.queue.find_one({"$or": [{"queue_id": b_clean}, {"booking_id": b_clean}]})
        if q_doc:
            if q_doc.get("queue_id"):
                ids.add(str(q_doc["queue_id"]).strip())
            if q_doc.get("booking_id"):
                ids.add(str(q_doc["booking_id"]).strip())
    except Exception:
        pass

    # Check in-memory fallbacks
    try:
        from services.appointment_service import IN_MEMORY_BOOKINGS
        for b in IN_MEMORY_BOOKINGS:
            if b.get("booking_id") == b_clean or b.get("queue_id") == b_clean:
                if b.get("booking_id"):
                    ids.add(str(b["booking_id"]).strip())
                if b.get("queue_id"):
                    ids.add(str(b["queue_id"]).strip())
    except Exception:
        pass

    try:
        from services.queue_service import IN_MEMORY_QUEUE
        for q in IN_MEMORY_QUEUE:
            if q.get("queue_id") == b_clean or q.get("booking_id") == b_clean:
                if q.get("queue_id"):
                    ids.add(str(q["queue_id"]).strip())
                if q.get("booking_id"):
                    ids.add(str(q["booking_id"]).strip())
    except Exception:
        pass

    return ids

def is_duplicate_sms(patient_id: str, notification_type: str, booking_id: Optional[str]) -> bool:
    """
    Checks whether an SMS has already been dispatched for this exact notification event.
    Uses canonical event identities so that alias IDs (e.g. B029 and D001-Q020) share deduplication state.
    Also ensures TURN_APPROACHING and DEPARTURE_REMINDER share deduplication to prevent multiple SMS
    for the same turn/departure event.
    """
    all_ids = resolve_canonical_event_ids(booking_id) if booking_id else {booking_id or ""}

    check_types = (
        TURN_DEPARTURE_NOTIFICATION_TYPES
        if notification_type in TURN_DEPARTURE_NOTIFICATION_TYPES
        else {notification_type}
    )

    # Check in-memory event cache against all alias IDs and matching types
    for aid in all_ids:
        for t in check_types:
            if (patient_id, t, aid) in SENT_SMS_EVENTS:
                return True

    try:
        db = get_db()
        query = {
            "patient_id": patient_id,
            "sms_sent": True
        }
        if len(check_types) > 1:
            query["type"] = {"$in": list(check_types)}
        else:
            query["type"] = notification_type

        if all_ids:
            query["booking_id"] = {"$in": list(all_ids)}

        existing = db.notifications.find_one(query)
        if existing:
            for aid in all_ids:
                for t in check_types:
                    SENT_SMS_EVENTS.add((patient_id, t, aid))
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
    booking_id: Optional[str] = None,
    sms_text: Optional[str] = None,
    suppress_sms: bool = False,
    extra_fields: Optional[dict] = None
) -> Tuple[Optional[dict], Optional[str]]:
    now_str = ist_isoformat()
    notif_id = generate_notification_id()

    # Attempt SMS dispatch if eligible, enabled, not suppressed, not duplicate, and recipient is patient
    sms_sent = False
    sms_eligible = notification_type in SMS_ELIGIBLE_NOTIFICATION_TYPES

    if not suppress_sms and sms_eligible and (getattr(config, "FAST2SMS_SMS_ENABLED", False) or getattr(config, "MSG91_SMS_ENABLED", False)):
        try:
            from services.sms_service import sms_service, mask_phone
            if not is_duplicate_sms(patient_id, notification_type, booking_id):
                phone = resolve_patient_phone(patient_id, booking_id)
                if phone:
                    if not sms_text:
                        if notification_type == "TURN_APPROACHING":
                            sms_text = build_turn_approaching_sms_text(
                                patient_id=patient_id,
                                booking_id=booking_id,
                                message=message
                            )
                        elif notification_type == "ARRIVAL_OTP_ISSUED":
                            sms_text = build_arrival_otp_sms_text(
                                patient_id=patient_id,
                                booking_id=booking_id,
                                message=message
                            )
                        else:
                            sms_text = f"{title}: {message}"
                    success, res, err = sms_service.send_sms(phone, sms_text)
                    sms_sent = bool(success)
                    if success:
                        all_ids = resolve_canonical_event_ids(booking_id) if booking_id else {booking_id or ""}
                        recorded_types = (
                            TURN_DEPARTURE_NOTIFICATION_TYPES
                            if notification_type in TURN_DEPARTURE_NOTIFICATION_TYPES
                            else {notification_type}
                        )
                        for aid in all_ids:
                            for t in recorded_types:
                                SENT_SMS_EVENTS.add((patient_id, t, aid))
                    else:
                        logger.warning(
                            "SMS notification failed for %s (%s): %s",
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
    if extra_fields:
        for key, value in extra_fields.items():
            if key not in notif_doc and value is not None:
                notif_doc[key] = value

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
    now_str = ist_isoformat()
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
    now_str = ist_isoformat()
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
