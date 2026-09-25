import logging
from datetime import datetime, timedelta
from services.time_service import HOSPITAL_TZ, now_ist, ist_isoformat, now_utc
from typing import Optional, Dict, Tuple
from database.mongodb import get_db, serialize_doc
from services.travel_service import calculate_travel_metrics, HOSPITAL_NAME, HOSPITAL_DESTINATION
from services.notification_service import create_notification

logger = logging.getLogger(__name__)

# Configurable intervals (in minutes)
REMINDER_INTERVAL_MIN = 5
URGENT_INTERVAL_MIN = 10
SAFETY_BUFFER_MIN = 10

# State machine states
LEAVE_STATUS_NOT_REQUIRED = "NOT_REQUIRED"
LEAVE_STATUS_LEAVE_NOW_SENT = "LEAVE_NOW_SENT"
LEAVE_STATUS_REMINDER_SENT = "REMINDER_SENT"
LEAVE_STATUS_URGENT_SENT = "URGENT_REMINDER_SENT"
LEAVE_STATUS_CONFIRMED = "LEAVING_CONFIRMED"
LEAVE_STATUS_ARRIVED = "ARRIVED"
LEAVE_STATUS_COMPLETED = "COMPLETED"
LEAVE_STATUS_MISSED = "MISSED"
LEAVE_STATUS_CANCELLED = "CANCELLED"

FINAL_LEAVE_STATES = [
    LEAVE_STATUS_CONFIRMED,
    LEAVE_STATUS_ARRIVED,
    LEAVE_STATUS_COMPLETED,
    LEAVE_STATUS_MISSED,
    LEAVE_STATUS_CANCELLED
]

def calculate_recommended_leave_time(
    expected_consultation_iso: Optional[str] = None,
    travel_time_min: int = 15,
    safety_buffer_min: int = SAFETY_BUFFER_MIN
) -> Tuple[datetime, str, str]:
    """
    Computes recommended departure datetime and strings:
    recommended_departure = expected_consultation_time - travel_time - safety_buffer
    Returns (departure_dt, departure_str, expected_consultation_str)
    """
    now = datetime.now(HOSPITAL_TZ)
    if expected_consultation_iso:
        try:
            consultation_dt = datetime.fromisoformat(expected_consultation_iso.replace("Z", "+00:00"))
            if consultation_dt.tzinfo is not None:
                consultation_dt = consultation_dt.astimezone(HOSPITAL_TZ)
            else:
                consultation_dt = consultation_dt.replace(tzinfo=HOSPITAL_TZ)
        except Exception:
            consultation_dt = now + timedelta(minutes=30)
    else:
        consultation_dt = now + timedelta(minutes=30)

    departure_dt = consultation_dt - timedelta(minutes=(travel_time_min + safety_buffer_min))
    departure_str = departure_dt.strftime("%I:%M %p")
    consultation_str = consultation_dt.strftime("%I:%M %p")

    return departure_dt, departure_str, consultation_str

def confirm_leaving_now(queue_id: str, origin_coords: Optional[list] = None) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Patient clicks 'I'M LEAVING NOW'.
    Stores:
      - leaving_now = True
      - leaving_now_at timestamp
      - current GPS coordinates
      - destination hospital
      - route distance
      - estimated travel duration
      - expected arrival time
      - leave_reminder_status = "LEAVING_CONFIRMED"
    Safe against duplicate clicks (idempotent).
    """
    now = now_utc()
    now_str = now.isoformat()

    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]}) or \
                db.appointments.find_one({"booking_id": queue_id})

        if not entry:
            return None, f"Queue record '{queue_id}' not found"

        q_id = entry.get("queue_id", queue_id)
        b_id = entry.get("booking_id", queue_id)

        # Idempotent safety: if already confirmed leaving, return current record safely
        if entry.get("leaving_now") and entry.get("leave_reminder_status") == LEAVE_STATUS_CONFIRMED:
            return serialize_doc(entry), None

        # Check status is not terminal
        status = entry.get("status", "waiting")
        if status in ["completed", "cancelled", "no_show"]:
            return None, f"Cannot confirm departure for consultation with status '{status}'"

        # Coordinates handling
        coords = origin_coords
        if not coords and entry.get("origin_longitude") is not None and entry.get("origin_latitude") is not None:
            coords = [float(entry["origin_longitude"]), float(entry["origin_latitude"])]

        # Recalculate dynamic travel metrics with current GPS
        patient_address = entry.get("patient_address") or entry.get("city") or "Tumakuru"
        wait_time = entry.get("predicted_wait_time", 20)
        travel_metrics = calculate_travel_metrics(
            patient_address=patient_address,
            wait_time_min=wait_time,
            origin_coords=coords,
            safety_buffer_min=SAFETY_BUFFER_MIN,
            leaving_now=True,
            leaving_now_at=now_str
        )

        arrival_time_str = travel_metrics.get("expected_hospital_arrival") or (now + timedelta(minutes=travel_metrics.get("travel_time_min", 15))).strftime("%I:%M %p")

        update_fields = {
            "leaving_now": True,
            "leaving_now_at": now_str,
            "leave_reminder_status": LEAVE_STATUS_CONFIRMED,
            "destination_hospital": HOSPITAL_NAME,
            "destination_address": HOSPITAL_DESTINATION,
            "distance_km": travel_metrics.get("distance_km"),
            "travel_time_min": travel_metrics.get("travel_time_min"),
            "travel_time_minutes": travel_metrics.get("travel_time_min"),
            "expected_hospital_arrival": arrival_time_str,
            "travel_info": travel_metrics,
            "updated_at": now_str
        }

        if travel_metrics.get("expected_hospital_arrival_iso"):
            update_fields["expected_hospital_arrival_iso"] = travel_metrics["expected_hospital_arrival_iso"]
            update_fields["expected_arrival_iso"] = travel_metrics["expected_hospital_arrival_iso"]
        if travel_metrics.get("expected_hospital_arrival"):
            update_fields["expected_arrival_time"] = travel_metrics["expected_hospital_arrival"]
        if travel_metrics.get("arrival_deadline_time"):
            update_fields["arrival_deadline_time"] = travel_metrics["arrival_deadline_time"]
        if travel_metrics.get("arrival_deadline_iso"):
            update_fields["arrival_deadline_iso"] = travel_metrics["arrival_deadline_iso"]

        if coords:
            update_fields["origin_longitude"] = float(coords[0])
            update_fields["origin_latitude"] = float(coords[1])
            update_fields["is_approximate_location"] = False
        else:
            update_fields["is_approximate_location"] = entry.get("is_approximate_location", True)

        db.queue.update_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}, {"$set": update_fields})
        db.appointments.update_one({"booking_id": b_id}, {"$set": update_fields})

        # Send in-app notification confirming departure
        try:
            create_notification(
                patient_id=entry.get("patient_id", "P001"),
                notification_type="LEAVING_CONFIRMED",
                title="Departure Confirmed",
                message=f"You're on your way to SIMSRH! Distance: {travel_metrics.get('distance_km')} km (~{travel_metrics.get('travel_time_min')} mins). Expected arrival: {arrival_time_str}. Token: {q_id}.",
                booking_id=q_id
            )
        except Exception:
            pass

        updated = db.queue.find_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}) or \
                  db.appointments.find_one({"booking_id": b_id})
        return serialize_doc(updated), None

    except Exception as ex:
        logger.error(f"Error in confirm_leaving_now: {ex}")
        return None, str(ex)

def evaluate_and_update_leave_reminders(queue_entry: Dict) -> Dict:
    """
    Evaluates an active patient queue entry for leave-now alerts and reminders.
    Rules:
      - Stops if status is terminal (completed, cancelled, missed, no_show) or arrived or leaving confirmed.
      - If now >= recommended departure time:
          1. If status is NOT_REQUIRED or unset: send LEAVE_NOW_SENT alert.
          2. If status is LEAVE_NOW_SENT and elapsed >= REMINDER_INTERVAL_MIN (5 min): send REMINDER_SENT.
          3. If status is REMINDER_SENT and elapsed >= REMINDER_INTERVAL_MIN (total 10 min): send URGENT_REMINDER_SENT.
      - Prevents duplicate alerts and tracks timestamps in the database.
    """
    queue_id = queue_entry.get("queue_id")
    status = queue_entry.get("status", "waiting")
    is_arrived = queue_entry.get("arrived_at_hospital", False) or status == "arrived"
    is_leaving = queue_entry.get("leaving_now", False)

    # Immediately terminate reminder flow if terminal or leaving/arrived
    current_reminder_state = queue_entry.get("leave_reminder_status", LEAVE_STATUS_NOT_REQUIRED)
    if is_arrived:
        return {"action": "none", "state": LEAVE_STATUS_ARRIVED}
    if is_leaving or current_reminder_state == LEAVE_STATUS_CONFIRMED:
        return {"action": "none", "state": LEAVE_STATUS_CONFIRMED}
    if status in ["completed", "missed", "cancelled", "no_show"]:
        return {"action": "none", "state": status.upper()}

    now = now_utc()
    expected_iso = queue_entry.get("expected_consultation_iso")
    travel_time = queue_entry.get("travel_time_min") or queue_entry.get("travel_info", {}).get("travel_time_min", 15)
    buffer_min = int(queue_entry.get("safety_buffer_min") or queue_entry.get("travel_info", {}).get("safety_buffer_min") or SAFETY_BUFFER_MIN)
    departure_dt, dep_str, exp_str = calculate_recommended_leave_time(
        expected_consultation_iso=expected_iso,
        travel_time_min=travel_time,
        safety_buffer_min=buffer_min
    )

    # If it's not yet time to leave (and more than 2 minutes remain), keep NOT_REQUIRED
    if now < (departure_dt - timedelta(minutes=2)):
        return {"action": "none", "state": LEAVE_STATUS_NOT_REQUIRED}

    last_sent_iso = queue_entry.get("leave_reminder_sent_at")
    last_sent_dt = None
    if last_sent_iso:
        try:
            last_sent_dt = datetime.fromisoformat(last_sent_iso.replace("Z", "+00:00"))
        except Exception:
            last_sent_dt = None

    elapsed_mins = (now - last_sent_dt).total_seconds() / 60.0 if last_sent_dt else 999.0

    target_state = None
    notif_title = ""
    notif_msg = ""
    notif_type = ""

    pos = queue_entry.get("position", 1)
    patient_id = queue_entry.get("patient_id", "P001")

    if current_reminder_state in [None, LEAVE_STATUS_NOT_REQUIRED]:
        target_state = LEAVE_STATUS_LEAVE_NOW_SENT
        notif_type = "LEAVE_NOW_ALERT"
        notif_title = "Please Leave for Hospital Now"
        notif_msg = (
            f"Your consultation is approaching (Expected: {exp_str}). Token {queue_id} is position #{pos}. "
            f"Estimated travel: {travel_time} mins. Please leave for SIMSRH now."
        )
    elif current_reminder_state == LEAVE_STATUS_LEAVE_NOW_SENT and elapsed_mins >= REMINDER_INTERVAL_MIN:
        target_state = LEAVE_STATUS_REMINDER_SENT
        notif_type = "LEAVE_REMINDER"
        notif_title = "Reminder: Please Leave for Hospital"
        notif_msg = (
            f"Reminder: Your consultation at SIMSRH is approaching (Token {queue_id}). "
            f"Estimated travel time is {travel_time} mins. Please confirm you are on your way."
        )
    elif current_reminder_state == LEAVE_STATUS_REMINDER_SENT and elapsed_mins >= REMINDER_INTERVAL_MIN:
        target_state = LEAVE_STATUS_URGENT_SENT
        notif_type = "URGENT_LEAVE_ALERT"
        notif_title = "URGENT: Leave for Hospital Immediately"
        notif_msg = (
            f"Please leave for the hospital immediately! Your consultation is approaching (Token {queue_id}, position #{pos}). "
            f"Travel time of {travel_time} mins must be considered to prevent losing your queue slot."
        )

    if target_state:
        try:
            db = get_db()
            db.queue.update_one(
                {"queue_id": queue_id},
                {"$set": {
                    "leave_reminder_status": target_state,
                    "leave_reminder_sent_at": now.isoformat(),
                    "recommended_departure_time": dep_str,
                    "recommended_departure_iso": departure_dt.isoformat()
                }}
            )
            create_notification(
                patient_id=patient_id,
                notification_type=notif_type,
                title=notif_title,
                message=notif_msg,
                booking_id=queue_id
            )
            return {"action": "sent", "state": target_state}
        except Exception as ex:
            logger.error(f"Failed to record reminder state: {ex}")

    return {"action": "none", "state": current_reminder_state}
