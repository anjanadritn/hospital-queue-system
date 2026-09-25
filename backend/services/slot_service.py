from datetime import date
from typing import Optional, Dict, Tuple, List
from database.mongodb import get_db
from services.time_service import (
    HOSPITAL_TZ, now_ist, today_iso_ist, is_slot_open,
    MORNING_SLOT_CUTOFF_HOUR, EVENING_SLOT_CUTOFF_HOUR
)

# Standard Hospital Consultation Slots
SLOT_DEFINITIONS = {
    "morning": {
        "slot_id": "morning",
        "slot_name": "Morning Slot",
        "start_time": "09:00 AM",
        "end_time": "01:00 PM",
        "display_time": "09:00 AM – 01:00 PM",
        "start_hour": 9,
        "end_hour": 13,
        "max_capacity": 40,
        # cutoff_hour: the hour (local 24h) AFTER which this slot is closed for same-day booking
        "cutoff_hour": 13   # 1:00 PM  — no more morning bookings once 13:00 is reached
    },
    "evening": {
        "slot_id": "evening",
        "slot_name": "Afternoon/Evening Slot",
        "start_time": "02:00 PM",
        "end_time": "09:00 PM",
        "display_time": "02:00 PM – 09:00 PM",
        "start_hour": 14,
        "end_hour": 21,
        "max_capacity": 50,
        # cutoff_hour: 2:00 PM  — walk-ins cannot be pre-booked once the slot starts
        "cutoff_hour": 14
    }
}

VALID_SLOT_IDS = list(SLOT_DEFINITIONS.keys())


def is_slot_time_closed(slot_id: str, target_date: str) -> Tuple[bool, str]:
    """
    Thin wrapper around time_service.is_slot_open for backwards compatibility.
    Returns (is_closed, reason) — delegates entirely to the centralized time service.
    """
    open_flag, reason = is_slot_open(slot_id, target_date)
    return not open_flag, reason


def validate_and_normalize_slot(slot_input, consultation_date: Optional[str] = None) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Validates and standardizes consultation slot input.
    Accepts:
      - slot_id string (e.g. 'morning', 'evening')
      - slot dictionary (e.g. {'slot_id': 'morning', ...})
    Also enforces time-based availability for same-day bookings:
      - Morning slot is closed for today's bookings at/after 13:00
      - Evening slot is closed for today's bookings at/after 14:00
    Returns normalized slot dictionary with slot_id, slot_name, start_time, end_time, display_time, date.
    """
    if not slot_input:
        return None, "consultation_slot is required. Please select either 'morning' or 'evening' slot."

    slot_id = None
    if isinstance(slot_input, dict):
        slot_id = str(slot_input.get("slot_id", "")).strip().lower()
    elif isinstance(slot_input, str):
        slot_id = slot_input.strip().lower()

    if slot_id not in SLOT_DEFINITIONS:
        # Also check for variations like 'afternoon', 'evening', 'morning_slot'
        if "morn" in slot_id:
            slot_id = "morning"
        elif "eve" in slot_id or "after" in slot_id:
            slot_id = "evening"
        else:
            return None, f"Invalid consultation slot '{slot_input}'. Must be 'morning' (09:00 AM – 01:00 PM) or 'evening' (02:00 PM – 09:00 PM)."

    target_date = consultation_date or date.today().isoformat()

    # —— TIME-BASED AVAILABILITY CHECK (server-side enforcement) ——
    time_closed, close_reason = is_slot_time_closed(slot_id, target_date)
    if time_closed:
        return None, close_reason

    template = SLOT_DEFINITIONS[slot_id].copy()
    template.pop("cutoff_hour", None)   # don't expose internal field to clients
    template["date"] = target_date
    return template, None

def get_slot_counts(consultation_date: Optional[str] = None, doctor_id: Optional[str] = None, department: Optional[str] = None) -> Dict:
    """
    Returns real database-driven counts for Morning and Evening consultation slots.
    """
    target_date = consultation_date or today_iso_ist()
    slots_result = {}

    try:
        db = get_db()
        for s_id, s_def in SLOT_DEFINITIONS.items():
            query = {
                "$or": [
                    {"consultation_date": target_date},
                    {"consultation_slot.date": target_date},
                    {"created_at": {"$regex": f"^{target_date}"}}
                ],
                "$and": [
                    {
                        "$or": [
                            {"consultation_slot.slot_id": s_id},
                            {"slot_id": s_id}
                        ]
                    }
                ]
            }
            if doctor_id:
                query["$and"].append({"doctor_id": doctor_id})
            if department:
                query["$and"].append({"department": department})

            # Appointments count
            total_booked = db.appointments.count_documents(query)

            # Queue active count
            queue_query = {
                "$or": [
                    {"consultation_date": target_date},
                    {"consultation_slot.date": target_date},
                    {"joined_at": {"$regex": f"^{target_date}"}}
                ],
                "$and": [
                    {
                        "$or": [
                            {"consultation_slot.slot_id": s_id},
                            {"slot_id": s_id}
                        ]
                    }
                ]
            }
            if doctor_id:
                queue_query["$and"].append({"doctor_id": doctor_id})
            if department:
                queue_query["$and"].append({"department": department})

            waiting_count = db.queue.count_documents({**queue_query, "status": {"$in": ["waiting", "ready", "called"]}})
            arrived_count = db.queue.count_documents({**queue_query, "status": "arrived"})
            completed_count = db.queue.count_documents({**queue_query, "status": "completed"})

            slots_result[s_id] = {
                **{k: v for k, v in s_def.items() if k != 'cutoff_hour'},
                "date": target_date,
                "total_booked": max(total_booked, waiting_count + arrived_count + completed_count),
                "waiting": waiting_count,
                "arrived": arrived_count,
                "completed": completed_count,
                "active_queue_count": waiting_count + arrived_count,
                "available": max(0, s_def["max_capacity"] - max(total_booked, waiting_count + completed_count)),
                "booked_count": max(total_booked, waiting_count + arrived_count + completed_count),
                "remaining_capacity": max(0, s_def["max_capacity"] - max(total_booked, waiting_count + completed_count)),
                "is_full": max(total_booked, waiting_count + completed_count) >= s_def["max_capacity"],
                # Time-based availability: closed for same-day once cutoff passes
                **dict(zip(["time_closed", "time_closed_reason"], is_slot_time_closed(s_id, target_date)))
            }
        return slots_result
    except Exception:
        # Fallback for in-memory or connection issues
        for s_id, s_def in SLOT_DEFINITIONS.items():
            time_closed, time_closed_reason = is_slot_time_closed(s_id, target_date)
            slots_result[s_id] = {
                **{k: v for k, v in s_def.items() if k != 'cutoff_hour'},
                "date": target_date,
                "total_booked": 0,
                "waiting": 0,
                "arrived": 0,
                "completed": 0,
                "available": s_def["max_capacity"],
                "booked_count": 0,
                "remaining_capacity": s_def["max_capacity"],
                "is_full": False,
                "time_closed": time_closed,
                "time_closed_reason": time_closed_reason
            }
        return slots_result

def get_admin_slot_analytics(consultation_date: Optional[str] = None) -> Dict:
    """
    Returns full operational metrics breakdown per consultation slot for Admin Dashboard:
    - total booked
    - arrived
    - waiting
    - completed
    - missed/skipped
    - cancelled
    - emergency cases
    - remaining patients
    - live operational averages
    """
    target_date = consultation_date or today_iso_ist()
    breakdown = {}

    try:
        db = get_db()
        for s_id, s_def in SLOT_DEFINITIONS.items():
            slot_matcher = {
                "$or": [
                    {"consultation_slot.slot_id": s_id},
                    {"slot_id": s_id}
                ]
            }

            date_matcher = {
                "$or": [
                    {"consultation_date": target_date},
                    {"consultation_slot.date": target_date},
                    {"joined_at": {"$regex": f"^{target_date}"}},
                    {"created_at": {"$regex": f"^{target_date}"}}
                ]
            }

            base_filter = {"$and": [slot_matcher, date_matcher]}

            booked = db.appointments.count_documents(base_filter)
            queue_entries = list(db.queue.find(base_filter))

            arrived = sum(1 for q in queue_entries if q.get("status") == "arrived" or q.get("arrived_at_hospital"))
            waiting = sum(1 for q in queue_entries if q.get("status") in ["waiting", "ready", "called"])
            completed = sum(1 for q in queue_entries if q.get("status") == "completed")
            missed = sum(1 for q in queue_entries if q.get("status") in ["missed", "missed_consultation"])
            cancelled = sum(1 for q in queue_entries if q.get("status") in ["cancelled", "no_show"])
            emergency = sum(1 for q in queue_entries if q.get("priority") == "emergency")
            remaining = waiting + arrived + emergency

            breakdown[s_id] = {
                "slot_id": s_id,
                "slot_name": s_def["slot_name"],
                "display_time": s_def["display_time"],
                "start_time": s_def["start_time"],
                "end_time": s_def["end_time"],
                "date": target_date,
                "total_booked": max(booked, len(queue_entries)),
                "arrived": arrived,
                "waiting": waiting,
                "completed": completed,
                "missed": missed,
                "cancelled": cancelled,
                "emergency_cases": emergency,
                "emergency": emergency,
                "remaining_patients": remaining
            }

        # Overall active queue averages
        active_queue = list(db.queue.find({"status": {"$in": ["waiting", "arrived", "ready", "called", "in_consultation"]}}))
        active_waiting = sum(1 for q in active_queue if q.get("status") in ["waiting", "ready", "called"])
        in_consultation = sum(1 for q in active_queue if q.get("status") == "in_consultation")
        emergency_total = sum(1 for q in active_queue if q.get("priority") == "emergency")

        durations = [q.get("predicted_duration", 12) for q in active_queue if q.get("predicted_duration")]
        waits = [q.get("predicted_wait_time", 15) for q in active_queue if q.get("predicted_wait_time")]

        avg_duration = round(sum(durations) / len(durations), 1) if durations else 12.5
        avg_wait = round(sum(waits) / len(waits), 1) if waits else 14.0

        return {
            "date": target_date,
            "slots": breakdown,
            "current_active_queue": len(active_queue),
            "current_patients_waiting": active_waiting,
            "current_consultations": in_consultation,
            "emergency_patients": emergency_total,
            "average_predicted_waiting_time": avg_wait,
            "average_predicted_consultation_duration": avg_duration
        }
    except Exception:
        for s_id, s_def in SLOT_DEFINITIONS.items():
            breakdown[s_id] = {
                "slot_id": s_id,
                "slot_name": s_def["slot_name"],
                "display_time": s_def["display_time"],
                "start_time": s_def["start_time"],
                "end_time": s_def["end_time"],
                "date": target_date,
                "total_booked": 0,
                "arrived": 0,
                "waiting": 0,
                "completed": 0,
                "missed": 0,
                "cancelled": 0,
                "emergency_cases": 0,
                "remaining_patients": 0
            }
        return {
            "date": target_date,
            "slots": breakdown,
            "current_active_queue": 0,
            "current_patients_waiting": 0,
            "current_consultations": 0,
            "emergency_patients": 0,
            "average_predicted_waiting_time": 15.0,
            "average_predicted_consultation_duration": 12.0
        }
