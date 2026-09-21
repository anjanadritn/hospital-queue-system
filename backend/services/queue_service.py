import re
from datetime import datetime, timezone, timedelta
try:
    from zoneinfo import ZoneInfo
    HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    HOSPITAL_TZ = timezone(timedelta(hours=5, minutes=30))
from typing import Optional, List, Tuple, Dict
from database.mongodb import get_db, serialize_doc, serialize_docs
from services.prediction_service import get_wait_time_prediction, predict_consultation_duration_service
from services.notification_service import create_notification, format_turn_approaching_sms
from services.travel_service import calculate_travel_metrics
from services.otp_service import generate_consultation_otp
from services.leave_service import (
    calculate_recommended_leave_time,
    evaluate_and_update_leave_reminders,
    SAFETY_BUFFER_MIN
)
from services.slot_service import validate_and_normalize_slot

SAFE_DEPARTMENT_CATEGORIES = {
    "Cardiology": "Cardiology Consultation",
    "General Medicine": "General Consultation",
    "Orthopedics": "Orthopedic Consultation",
    "Pediatrics": "Pediatric Consultation",
    "Dermatology": "Dermatology Consultation",
    "Neurology": "Neurology Consultation",
    "ENT": "ENT Consultation",
    "Gastroenterology": "Gastroenterology Consultation",
    "Pulmonology": "Pulmonology Consultation",
    "Ophthalmology": "Ophthalmology Consultation"
}

IN_MEMORY_QUEUE = []

def generate_queue_id(doctor_id: Optional[str] = None) -> str:
    """
    Generate sequential, gapless queue tokens scoped to the doctor's queue.
    Prevents cross-doctor token number consumption.
    Preserves existing IDs in the database and respects MongoDB uniqueness constraint.
    """
    try:
        db = get_db()
        clean_doc = str(doctor_id).strip() if doctor_id else None
        if clean_doc and clean_doc.startswith("U_DOC_"):
            clean_doc = clean_doc.replace("U_DOC_", "")
        if clean_doc:
            clean_doc = re.sub(r"[^A-Za-z0-9_]", "", clean_doc)
        if not clean_doc:
            clean_doc = None

        all_existing_ids = set(db.queue.distinct("queue_id"))
        for q in IN_MEMORY_QUEUE:
            if q.get("queue_id"):
                all_existing_ids.add(q["queue_id"])

        if clean_doc:
            # Query tokens for this specific doctor
            doc_query = {"doctor_id": clean_doc}
            doctor_tokens = db.queue.distinct("queue_id", doc_query)
            for q in IN_MEMORY_QUEUE:
                if q.get("doctor_id") == clean_doc and q.get("queue_id"):
                    doctor_tokens.append(q["queue_id"])

            # Extract sequence numbers for this doctor
            seq_numbers = []
            for tid in doctor_tokens:
                s = str(tid).strip()
                # 1. Match prefixed format: <doctor_id>-Q<digits> or <doctor_id>-<digits>
                m_pref = re.match(rf"^{re.escape(clean_doc)}-Q?(\d+)$", s, re.IGNORECASE)
                if m_pref:
                    seq_numbers.append(int(m_pref.group(1)))
                    continue
                # 2. Match legacy Q<digits> assigned to this doctor
                m_legacy = re.match(r"^Q(\d+)$", s, re.IGNORECASE)
                if m_legacy:
                    seq_numbers.append(int(m_legacy.group(1)))

            next_seq = (max(seq_numbers) + 1) if seq_numbers else 1
            candidate = f"{clean_doc}-Q{next_seq:03d}"
            while candidate in all_existing_ids:
                next_seq += 1
                candidate = f"{clean_doc}-Q{next_seq:03d}"
            return candidate
        else:
            # Fallback for unscoped queue
            all_q_nums = [
                int(m.group(1)) for qid in all_existing_ids 
                if (m := re.match(r"^Q(\d+)$", str(qid), re.IGNORECASE))
            ]
            next_seq = (max(all_q_nums) + 1) if all_q_nums else 1
            candidate = f"Q{next_seq:03d}"
            while candidate in all_existing_ids:
                next_seq += 1
                candidate = f"Q{next_seq:03d}"
            return candidate
    except Exception:
        if doctor_id:
            clean = str(doctor_id).strip().replace("U_DOC_", "")
            clean = re.sub(r"[^A-Za-z0-9_]", "", clean)
            count = len([q for q in IN_MEMORY_QUEUE if q.get("doctor_id") == clean])
            return f"{clean}-Q{count + 1:03d}"
        return f"Q{len(IN_MEMORY_QUEUE) + 1:03d}"

def get_patient_arrival_deadline(entry: dict) -> Optional[datetime]:
    """
    Computes or retrieves the authoritative arrival deadline (expected arrival + 2 min grace period)
    for a patient, normalized to HOSPITAL_TZ.
    """
    if not entry:
        return None

    # 1. Direct stored arrival deadline ISO
    deadline_iso = entry.get("arrival_deadline_iso") or entry.get("expected_arrival_deadline_iso") or entry.get("travel_info", {}).get("arrival_deadline_iso")
    if deadline_iso:
        try:
            dt = datetime.fromisoformat(str(deadline_iso).replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=HOSPITAL_TZ)
        except Exception:
            pass

    # 2. From expected_arrival_iso + 2 minutes
    arrival_iso = entry.get("expected_arrival_iso") or entry.get("expected_hospital_arrival_iso") or entry.get("travel_info", {}).get("expected_hospital_arrival_iso")
    if arrival_iso:
        try:
            dt = datetime.fromisoformat(str(arrival_iso).replace("Z", "+00:00"))
            dt = dt if dt.tzinfo else dt.replace(tzinfo=HOSPITAL_TZ)
            return dt + timedelta(minutes=2)
        except Exception:
            pass

    # 3. From expected_consultation_iso, safety buffer, and travel duration
    exp_consult_iso = entry.get("expected_consultation_iso") or entry.get("travel_info", {}).get("expected_consultation_iso")
    if exp_consult_iso:
        try:
            consult_dt = datetime.fromisoformat(str(exp_consult_iso).replace("Z", "+00:00"))
            consult_dt = consult_dt if consult_dt.tzinfo else consult_dt.replace(tzinfo=HOSPITAL_TZ)
            buffer_min = int(entry.get("safety_buffer_min") or entry.get("travel_info", {}).get("safety_buffer_min") or SAFETY_BUFFER_MIN)
            travel_min = int(entry.get("travel_time_min") or entry.get("travel_info", {}).get("travel_time_min") or 15)
            rec_dep = consult_dt - timedelta(minutes=travel_min + buffer_min)
            now_h = datetime.now(HOSPITAL_TZ)
            if entry.get("leaving_now"):
                dep_t = now_h
                if entry.get("leaving_now_at"):
                    try:
                        dep_t = datetime.fromisoformat(str(entry["leaving_now_at"]).replace("Z", "+00:00")).astimezone(HOSPITAL_TZ)
                    except Exception:
                        pass
                arrival_dt = dep_t + timedelta(minutes=travel_min)
            elif now_h >= rec_dep:
                arrival_dt = now_h + timedelta(minutes=travel_min)
            else:
                arrival_dt = rec_dep + timedelta(minutes=travel_min)
            return arrival_dt + timedelta(minutes=2)
        except Exception:
            pass

    # 4. From expected_hospital_arrival string ("HH:MM AM/PM") and consultation_date
    arrival_str = entry.get("expected_hospital_arrival") or entry.get("expected_arrival_time") or entry.get("travel_info", {}).get("expected_hospital_arrival")
    consult_date = entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date")
    if arrival_str and consult_date:
        try:
            date_part = datetime.strptime(str(consult_date).split("T")[0], "%Y-%m-%d").date()
            time_part = datetime.strptime(arrival_str.strip(), "%I:%M %p").time()
            arrival_dt = datetime.combine(date_part, time_part).replace(tzinfo=HOSPITAL_TZ)
            return arrival_dt + timedelta(minutes=2)
        except Exception:
            pass

    return None

def _normalize_joined_dt(val) -> datetime:
    """
    Normalizes joined_at (string, datetime, or None) to a timezone-aware UTC datetime
    for robust chronological queue priority sorting without ISO string collation errors.
    """
    if not val:
        return datetime.max.replace(tzinfo=timezone.utc)
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=HOSPITAL_TZ).astimezone(timezone.utc)
        return val.astimezone(timezone.utc)
    try:
        dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=HOSPITAL_TZ)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.max.replace(tzinfo=timezone.utc)

def evaluate_late_arrivals(
    doctor_id: Optional[str] = None,
    consultation_date: Optional[str] = None,
    slot_id: Optional[str] = None,
    now_dt: Optional[datetime] = None,
    skip_recalculate: bool = False
) -> List[dict]:
    """
    Evaluates waiting patients against the 2-minute late-arrival grace period.
    If a patient has NOT been verified/marked arrived after expected_arrival + 2 minutes:
      1. Move that patient to the END of their own doctor-specific queue.
      2. Preserve the same queue token.
      3. Preserve the same appointment and booking.
      4. Do NOT cancel or delete the appointment.
      5. Recalculate queue positions, RF wait times, expected consultation times, and departure times.
      6. Do not affect queues belonging to other doctors.
    - If patient arrives before deadline, do nothing.
    - If patient is already arrived, called, in consultation, completed, cancelled, missed, or terminal, do nothing.
    - If patient was moved once (late_arrival_reordered: True), do not move repeatedly.
    """
    now_hospital = now_dt or datetime.now(HOSPITAL_TZ)
    if now_hospital.tzinfo is None:
        now_hospital = now_hospital.replace(tzinfo=HOSPITAL_TZ)
    else:
        now_hospital = now_hospital.astimezone(HOSPITAL_TZ)

    reordered_patients = []
    affected_partitions = set()

    try:
        db = get_db()
        query = {
            "status": {"$in": ["waiting", "ready"]},
            "arrived_at_hospital": {"$ne": True},
            "verified_by_admin": {"$ne": True},
            "late_arrival_reordered": {"$ne": True},
            "is_current": {"$ne": True}
        }
        if doctor_id:
            query["doctor_id"] = doctor_id
        if slot_id:
            clean_slot = str(slot_id).strip()
            if "eve" in clean_slot.lower() or "after" in clean_slot.lower():
                query["$or"] = [
                    {"slot_id": {"$regex": "eve|after", "$options": "i"}},
                    {"consultation_slot.slot_id": {"$regex": "eve|after", "$options": "i"}}
                ]
            else:
                query["$or"] = [
                    {"slot_id": {"$regex": "morn", "$options": "i"}},
                    {"consultation_slot.slot_id": {"$regex": "morn", "$options": "i"}}
                ]
        if consultation_date:
            target_date_str = str(consultation_date).split("T")[0].strip()
            date_clause = {
                "$or": [
                    {"consultation_date": {"$regex": f"^{target_date_str}"}},
                    {"consultation_slot.date": {"$regex": f"^{target_date_str}"}}
                ]
            }
            query["$and"] = query.get("$and", []) + [date_clause]

        candidates = list(db.queue.find(query))
        for candidate in candidates:
            # Check exclusions
            if candidate.get("arrived_at_hospital") or candidate.get("verified_by_admin"):
                continue
            if candidate.get("status") in ["arrived", "called", "in_consultation", "completed", "cancelled", "missed", "missed_consultation", "no_show"]:
                continue
            if candidate.get("late_arrival_reordered"):
                continue

            deadline = get_patient_arrival_deadline(candidate)
            if not deadline:
                continue

            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=HOSPITAL_TZ)
            else:
                deadline = deadline.astimezone(HOSPITAL_TZ)

            # Within grace period: do nothing
            if now_hospital <= deadline:
                continue

            # Exceeded 2-minute grace period! Move to end of doctor's queue.
            cand_doc_id = candidate.get("doctor_id")
            cand_dept = candidate.get("department", "General Medicine")
            cand_date = candidate.get("consultation_date") or candidate.get("consultation_slot", {}).get("date")
            cand_slot = candidate.get("slot_id") or candidate.get("consultation_slot", {}).get("slot_id")

            # Find latest timestamp among active waiting entries for this doctor
            doc_waiting = list(db.queue.find({
                "doctor_id": cand_doc_id,
                "status": {"$in": ["waiting", "ready"]}
            }))
            latest_time = now_hospital
            for w in doc_waiting:
                w_joined = w.get("joined_at")
                if w_joined:
                    try:
                        w_dt = datetime.fromisoformat(str(w_joined).replace("Z", "+00:00"))
                        w_dt = w_dt if w_dt.tzinfo else w_dt.replace(tzinfo=HOSPITAL_TZ)
                        if w_dt.astimezone(HOSPITAL_TZ) > latest_time:
                            latest_time = w_dt.astimezone(HOSPITAL_TZ)
                    except Exception:
                        pass

            new_joined_dt = latest_time + timedelta(seconds=1)
            new_joined_iso = new_joined_dt.isoformat()

            orig_joined = candidate.get("original_joined_at") or candidate.get("joined_at") or now_hospital.isoformat()

            db.queue.update_one(
                {"queue_id": candidate["queue_id"]},
                {"$set": {
                    "late_arrival_reordered": True,
                    "late_arrival_moved_at": now_hospital.isoformat(),
                    "original_joined_at": orig_joined,
                    "joined_at": new_joined_iso,
                    "late_arrival_note": "Moved to end of queue due to late arrival (>2 min grace period)."
                }}
            )

            booking_id = candidate.get("booking_id")
            if booking_id:
                db.appointments.update_one(
                    {"booking_id": booking_id},
                    {"$set": {
                        "late_arrival_reordered": True,
                        "late_arrival_moved_at": now_hospital.isoformat(),
                        "original_joined_at": orig_joined,
                        "joined_at": new_joined_iso,
                        "late_arrival_note": "Moved to end of queue due to late arrival (>2 min grace period)."
                    }}
                )

            # In-memory queue sync if present
            for q in IN_MEMORY_QUEUE:
                if q.get("queue_id") == candidate["queue_id"]:
                    q["late_arrival_reordered"] = True
                    q["late_arrival_moved_at"] = now_hospital.isoformat()
                    q["original_joined_at"] = orig_joined
                    q["joined_at"] = new_joined_iso
                    q["late_arrival_note"] = "Moved to end of queue due to late arrival (>2 min grace period)."

            try:
                create_notification(
                    patient_id=candidate.get("patient_id", "P001"),
                    notification_type="LATE_ARRIVAL_REORDERED",
                    title="Queue Position Updated (Late Arrival)",
                    message=f"You did not arrive within the 2-minute grace period for Token {candidate['queue_id']}. Your appointment is preserved, but you have been moved to the end of the OPD queue. Please verify your OTP at reception upon arrival.",
                    booking_id=candidate["queue_id"]
                )
            except Exception:
                pass

            reordered_patients.append({
                "queue_id": candidate["queue_id"],
                "booking_id": candidate.get("booking_id"),
                "doctor_id": cand_doc_id,
                "department": cand_dept,
                "consultation_date": cand_date,
                "slot_id": cand_slot,
                "late_arrival_moved_at": now_hospital.isoformat()
            })
            affected_partitions.add((cand_doc_id, cand_dept, cand_date, cand_slot))

    except Exception:
        pass

    # In-memory queue fallback evaluation
    for q in IN_MEMORY_QUEUE:
        if q.get("status") in ["waiting", "ready"] and not q.get("arrived_at_hospital") and not q.get("verified_by_admin") and not q.get("late_arrival_reordered") and not q.get("is_current"):
            if doctor_id and q.get("doctor_id") != doctor_id:
                continue
            deadline = get_patient_arrival_deadline(q)
            if deadline:
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=HOSPITAL_TZ)
                else:
                    deadline = deadline.astimezone(HOSPITAL_TZ)
                if now_hospital > deadline:
                    q["late_arrival_reordered"] = True
                    q["late_arrival_moved_at"] = now_hospital.isoformat()
                    q["original_joined_at"] = q.get("original_joined_at") or q.get("joined_at")
                    q["joined_at"] = (now_hospital + timedelta(seconds=1)).isoformat()
                    q["late_arrival_note"] = "Moved to end of queue due to late arrival (>2 min grace period)."
                    reordered_patients.append({
                        "queue_id": q.get("queue_id"),
                        "booking_id": q.get("booking_id"),
                        "doctor_id": q.get("doctor_id"),
                        "department": q.get("department"),
                        "consultation_date": q.get("consultation_date"),
                        "slot_id": q.get("slot_id"),
                        "late_arrival_moved_at": now_hospital.isoformat()
                    })
                    affected_partitions.add((q.get("doctor_id"), q.get("department"), q.get("consultation_date"), q.get("slot_id")))

    # Recalculate affected doctor queues
    if not skip_recalculate and affected_partitions:
        for (part_doc, part_dept, part_date, part_slot) in affected_partitions:
            recalculate_queue_positions(
                doctor_id=part_doc,
                department=part_dept,
                consultation_date=part_date,
                slot_id=part_slot,
                check_late_arrivals=False
            )

    return reordered_patients

def recalculate_queue_positions(
    doctor_id: Optional[str] = None,
    department: Optional[str] = None,
    consultation_date: Optional[str] = None,
    slot_id: Optional[str] = None,
    check_late_arrivals: bool = True
):
    """
    Authoritative single-source queue recalculation engine:
    Recalculates positions, Random Forest predicted durations, cumulative wait times,
    progressive expected consultation start times, and recommended departure times.
    Separates queues cleanly by doctor/department, consultation date, and consultation slot.
    Dynamically advances next patient upon consultation completion, skip, or emergency promotion.
    """
    active_statuses = ["waiting", "arrived", "ready", "called", "OTP_GENERATED", "missed", "missed_consultation"]
    try:
        db = get_db()
        today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

        # Auto-heal active queue entries with missing consultation_date or slot_id
        try:
            unhealed = list(db.queue.find({
                "status": {"$in": active_statuses},
                "$or": [
                    {"consultation_date": None},
                    {"consultation_date": {"$exists": False}},
                    {"slot_id": None},
                    {"slot_id": {"$exists": False}}
                ]
            }))
            for ue in unhealed:
                c_date = ue.get("consultation_date") or ue.get("consultation_slot", {}).get("date")
                s_id = ue.get("slot_id") or ue.get("consultation_slot", {}).get("slot_id")
                b_id = ue.get("booking_id")
                if b_id and (not c_date or not s_id):
                    appt = db.appointments.find_one({"booking_id": b_id})
                    if appt:
                        c_date = c_date or appt.get("consultation_date") or appt.get("consultation_slot", {}).get("date")
                        s_id = s_id or appt.get("slot_id") or appt.get("consultation_slot", {}).get("slot_id")
                if not c_date:
                    c_date = today_str
                if not s_id:
                    joined_str = ue.get("joined_at")
                    hour = datetime.now(HOSPITAL_TZ).hour
                    if joined_str:
                        try:
                            dt = datetime.fromisoformat(str(joined_str).replace("Z", "+00:00")).astimezone(HOSPITAL_TZ)
                            hour = dt.hour
                        except Exception:
                            pass
                    s_id = "evening" if hour >= 14 else "morning"

                slot_info, _ = validate_and_normalize_slot(s_id, consultation_date=c_date)
                if not slot_info:
                    slot_info, _ = validate_and_normalize_slot("morning", consultation_date=c_date)

                db.queue.update_one(
                    {"_id": ue["_id"]},
                    {"$set": {
                        "consultation_date": c_date,
                        "slot_id": slot_info.get("slot_id", s_id),
                        "consultation_slot": slot_info
                    }}
                )
                if b_id:
                    db.appointments.update_one(
                        {"booking_id": b_id},
                        {"$set": {
                            "consultation_date": c_date,
                            "slot_id": slot_info.get("slot_id", s_id),
                            "consultation_slot": slot_info
                        }}
                    )
        except Exception:
            pass

        # Strict doctor partition: If doctor_id is not specified, recalculate independently for each distinct doctor
        if not doctor_id:
            active_docs = list({d for d in db.queue.distinct("doctor_id", {"status": {"$in": active_statuses}}) if d})
            if not active_docs:
                try:
                    active_docs = list({d for d in db.doctors.distinct("doctor_id") if d})
                except Exception:
                    active_docs = []
            if active_docs:
                for doc in active_docs:
                    recalculate_queue_positions(doctor_id=doc, consultation_date=consultation_date, slot_id=slot_id, check_late_arrivals=check_late_arrivals)
                return
            return

        # If consultation_date is not specified, check if multiple distinct dates exist for this doctor
        if not consultation_date:
            date_filter_check = {"doctor_id": doctor_id, "status": {"$in": active_statuses}}
            distinct_dates = list({
                d for d in (
                    db.queue.distinct("consultation_date", date_filter_check) +
                    db.queue.distinct("consultation_slot.date", date_filter_check)
                ) if d
            })
            if len(distinct_dates) > 1:
                for d in distinct_dates:
                    recalculate_queue_positions(doctor_id=doctor_id, department=department, consultation_date=d, slot_id=slot_id, check_late_arrivals=check_late_arrivals)
                return
            elif len(distinct_dates) == 1:
                consultation_date = distinct_dates[0]
            else:
                consultation_date = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

        # If slot_id is not specified, check if multiple distinct slots exist for this doctor and date
        if not slot_id:
            slot_filter_check = {"doctor_id": doctor_id, "status": {"$in": active_statuses}}
            if consultation_date:
                slot_filter_check["$or"] = [{"consultation_date": consultation_date}, {"consultation_slot.date": consultation_date}]
            distinct_slots = list({
                s for s in (
                    db.queue.distinct("slot_id", slot_filter_check) +
                    db.queue.distinct("consultation_slot.slot_id", slot_filter_check)
                ) if s
            })
            if len(distinct_slots) > 1:
                for s in distinct_slots:
                    recalculate_queue_positions(doctor_id=doctor_id, department=department, consultation_date=consultation_date, slot_id=s, check_late_arrivals=check_late_arrivals)
                return
            elif len(distinct_slots) == 1:
                slot_id = distinct_slots[0]

        query = {"doctor_id": doctor_id, "status": {"$in": active_statuses}}
        in_consult_query = {"doctor_id": doctor_id, "status": "in_consultation"}

        if slot_id:
            slot_clause = {"$or": [{"consultation_slot.slot_id": slot_id}, {"slot_id": slot_id}]}
            query["$and"] = query.get("$and", []) + [slot_clause]
            in_consult_query["$and"] = in_consult_query.get("$and", []) + [slot_clause]

        if consultation_date:
            date_clause = {"$or": [{"consultation_date": consultation_date}, {"consultation_slot.date": consultation_date}]}
            query["$and"] = query.get("$and", []) + [date_clause]
            in_consult_query["$and"] = in_consult_query.get("$and", []) + [date_clause]

        # Current hospital local time (IST)
        now_hospital = datetime.now(HOSPITAL_TZ)

        # Serverless-safe evaluation of 2-minute late arrivals before queue sorting
        if check_late_arrivals:
            try:
                evaluate_late_arrivals(
                    doctor_id=doctor_id,
                    consultation_date=consultation_date,
                    slot_id=slot_id,
                    now_dt=now_hospital,
                    skip_recalculate=True
                )
            except Exception:
                pass

        # Check for currently in-consultation patient with doctor
        in_consult_entry = db.queue.find_one(in_consult_query)
        in_consult_remaining = 0
        if in_consult_entry:
            dur = in_consult_entry.get("predicted_duration")
            if not dur:
                dur = predict_consultation_duration_service(
                    symptoms=in_consult_entry.get("symptoms", ["general"]),
                    department=in_consult_entry.get("department", "General Medicine"),
                    priority=in_consult_entry.get("priority", "normal"),
                    doctor_id=in_consult_entry.get("doctor_id") or doctor_id,
                    queue_position=1
                )
            in_consult_remaining = max(3, int(dur * 0.5))
            db.queue.update_one(
                {"queue_id": in_consult_entry["queue_id"]},
                {"$set": {
                    "is_current": True,
                    "is_next": False,
                    "position": 0,
                    "predicted_wait_time": 0,
                    "expected_consultation_time": now_hospital.strftime("%I:%M %p"),
                    "expected_consultation_iso": now_hospital.isoformat()
                }}
            )

        waiting_entries = list(db.queue.find(query))
        total_active_count = len(waiting_entries) + (1 if in_consult_entry else 0)

        def priority_sort_key(entry):
            p = str(entry.get("priority", "normal")).lower()
            s = str(entry.get("status", "waiting")).lower()
            is_emergency = 0 if p == "emergency" else 1
            is_missed = 1 if s in ["missed", "missed_consultation"] else 0
            tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
            is_late = 1 if entry.get("late_arrival_reordered") else 0
            joined_dt = _normalize_joined_dt(entry.get("joined_at"))
            return (tier, is_late, joined_dt, entry.get("queue_id", ""))

        waiting_entries.sort(key=priority_sort_key)

        # Determine target consultation date
        target_date = now_hospital.date()
        if consultation_date:
            try:
                target_date = datetime.strptime(str(consultation_date).split("T")[0], "%Y-%m-%d").date()
            except Exception:
                target_date = now_hospital.date()

        # Slot hours:
        # Evening / Slot 2: 02:00 PM (14:00) to 09:00 PM (21:00)
        # Morning / Slot 1: 09:00 AM (09:00) to 01:00 PM (13:00)
        is_evening_slot = bool(slot_id and ("eve" in str(slot_id).lower() or "after" in str(slot_id).lower()))
        start_hour, start_min = (14, 0) if is_evening_slot else (9, 0)
        end_hour, end_min = (21, 0) if is_evening_slot else (13, 0)

        slot_start_dt = datetime(target_date.year, target_date.month, target_date.day, start_hour, start_min, tzinfo=HOSPITAL_TZ)
        slot_end_dt = datetime(target_date.year, target_date.month, target_date.day, end_hour, end_min, tzinfo=HOSPITAL_TZ)

        if target_date == now_hospital.date():
            if now_hospital < slot_start_dt:
                # Slot hasn't started yet today (e.g. morning booking for evening slot)
                # Next patient is expected at the slot start time (e.g. 02:00 PM for Slot 2)
                base_start_dt = slot_start_dt
            elif slot_start_dt <= now_hospital <= slot_end_dt:
                # Currently during active slot hours
                base_start_dt = now_hospital + timedelta(minutes=in_consult_remaining)
            else:
                # After the scheduled slot end time today, but queue still being processed
                base_start_dt = now_hospital + timedelta(minutes=in_consult_remaining)
        elif target_date > now_hospital.date():
            # Future consultation date: queue starts at the slot start time on that date
            base_start_dt = slot_start_dt
        else:
            # Past date fallback
            base_start_dt = slot_start_dt

        accumulated_dt = base_start_dt
        cumulative_wait = in_consult_remaining
        for idx, entry in enumerate(waiting_entries, start=1):
            symptoms = entry.get("symptoms", ["general"])
            dept = entry.get("department", "General Medicine")
            prio = entry.get("priority", "normal")
            doc_id = entry.get("doctor_id") or doctor_id or "D001"
            is_emergency = (str(prio).lower() == "emergency")
            current_status = entry.get("status", "waiting")

            # Predict consultation duration for THIS patient using Random Forest
            predicted_dur = predict_consultation_duration_service(
                symptoms=symptoms if isinstance(symptoms, list) else ["general"],
                department=dept,
                priority=prio,
                doctor_id=doc_id,
                queue_position=idx
            )

            # Progressive expected start time
            expected_dt = accumulated_dt
            expected_time_str = expected_dt.strftime("%I:%M %p")
            expected_time_iso = expected_dt.isoformat()

            # Wait time based on actual patients ahead in queue
            if idx == 1:
                if in_consult_remaining > 0:
                    predicted_wait = in_consult_remaining
                elif is_emergency:
                    predicted_wait = 2
                elif current_status == "called":
                    predicted_wait = 0
                else:
                    predicted_wait = 5
            else:
                predicted_wait = max(5, cumulative_wait)

            # Accumulate this patient's consultation duration for patients behind
            cumulative_wait += predicted_dur
            accumulated_dt += timedelta(minutes=predicted_dur)

            is_arrived = bool(
                entry.get("arrived_at_hospital") or
                entry.get("verified_by_admin") or
                current_status == "arrived"
            )

            # 30-minute target indicator (treat 30 mins as operational target, not a guaranteed consultation time)
            target_30_status = "on_track" if predicted_wait <= 30 else "exceeds_target"
            target_30_label = "On track" if predicted_wait <= 30 else "Queue exceeds 30-minute target"

            if is_arrived:
                # 1. Treat patient as physically present at SIMSRH
                # 2. Do NOT continue showing old pre-arrival consultation time
                # 4. Generate fresh expected consultation time based on current time + predicted wait
                fresh_consult_dt = now_hospital + timedelta(minutes=predicted_wait)
                expected_time_str = fresh_consult_dt.strftime("%I:%M %p")
                expected_time_iso = fresh_consult_dt.isoformat()

                # 5. Remove/replace travel-focused information after arrival verification:
                # GPS route, distance, Leave Now, departure time, travel duration
                recommended_departure_str = None
                recommended_departure_iso = None
                expected_arrival_str = None
                expected_arrival_iso = None
                arrival_deadline_str = None
                arrival_deadline_iso = None

                new_status = "arrived" if current_status in ["waiting", "ready", "arrived", "OTP_GENERATED"] else current_status

                travel_info = {
                    "arrived_at_hospital": True,
                    "verified_by_admin": bool(entry.get("verified_by_admin", True)),
                    "status": new_status,
                    "is_arrived": True,
                    "arrival_verified": True,
                    "expected_consultation_time": expected_time_str,
                    "expected_consultation_iso": expected_time_iso,
                    "predicted_wait_time": predicted_wait,
                    "target_30_status": target_30_status,
                    "target_30_label": target_30_label,
                    "doctor_name": entry.get("doctor_name"),
                    "room_number": entry.get("room_number", "Room 101"),
                    "patient_address": entry.get("patient_address") or entry.get("city") or "SIMSRH OPD"
                }
            else:
                new_status = current_status
                if current_status in ["waiting", "ready"]:
                    new_status = "ready" if idx == 1 else "waiting"
                elif current_status in ["missed", "missed_consultation"]:
                    new_status = "missed"

                # Dynamic travel and departure calculation based on real wait time
                existing_travel = entry.get("travel_info")
                joined_str = entry.get("original_joined_at") or entry.get("joined_at")
                joined_dt = now_hospital
                if joined_str:
                    try:
                        jdt = datetime.fromisoformat(str(joined_str).replace("Z", "+00:00"))
                        joined_dt = jdt if jdt.tzinfo else jdt.replace(tzinfo=HOSPITAL_TZ)
                        joined_dt = joined_dt.astimezone(HOSPITAL_TZ)
                    except Exception:
                        joined_dt = now_hospital

                leaving_now = bool(entry.get("leaving_now"))
                leaving_now_at = entry.get("leaving_now_at")

                if existing_travel and isinstance(existing_travel, dict) and ("travel_time_minutes" in existing_travel or "travel_time_min" in existing_travel):
                    travel_time_min = int(existing_travel.get("travel_time_minutes") or existing_travel.get("travel_time_min") or 15)
                    safety_buffer_min = int(existing_travel.get("safety_buffer_min") or SAFETY_BUFFER_MIN)
                    patient_addr = existing_travel.get("patient_address") or entry.get("city") or "Current Location"

                    rec_departure_dt = expected_dt - timedelta(minutes=travel_time_min + safety_buffer_min)

                    if leaving_now:
                        dep_time = now_hospital
                        if leaving_now_at:
                            try:
                                pdt = datetime.fromisoformat(str(leaving_now_at).replace("Z", "+00:00"))
                                dep_time = pdt if pdt.tzinfo else pdt.replace(tzinfo=HOSPITAL_TZ)
                                dep_time = dep_time.astimezone(HOSPITAL_TZ)
                            except Exception:
                                dep_time = now_hospital
                        arrival_dt = dep_time + timedelta(minutes=travel_time_min)
                        departure_dt = dep_time
                        departure_alert = f"🚗 En route to SIMSRH from {patient_addr}. Expected arrival around {arrival_dt.strftime('%I:%M %p')}."
                    elif now_hospital >= rec_departure_dt:
                        arrival_dt = now_hospital + timedelta(minutes=travel_time_min)
                        departure_dt = rec_departure_dt
                        departure_alert = f"🚗 Depart immediately from {patient_addr} (recommended departure was {departure_dt.strftime('%I:%M %p')}, estimated travel: {travel_time_min} mins) to arrive at SIMSRH around {arrival_dt.strftime('%I:%M %p')} for your consultation at {expected_time_str}."
                    else:
                        arrival_dt = rec_departure_dt + timedelta(minutes=travel_time_min)
                        departure_dt = rec_departure_dt
                        departure_alert = f"🚗 Start from {patient_addr} around {departure_dt.strftime('%I:%M %p')} to arrive at SIMSRH ~{safety_buffer_min} mins before your consultation at {expected_time_str}."

                    arrival_deadline_dt = arrival_dt + timedelta(minutes=2)
                    recommended_departure_str = departure_dt.strftime("%I:%M %p")
                    recommended_departure_iso = departure_dt.isoformat()
                    expected_arrival_str = arrival_dt.strftime("%I:%M %p")
                    expected_arrival_iso = arrival_dt.isoformat()
                    arrival_deadline_str = arrival_deadline_dt.strftime("%I:%M %p")
                    arrival_deadline_iso = arrival_deadline_dt.isoformat()
                    travel_info = {
                        **existing_travel,
                        "travel_time_min": travel_time_min,
                        "travel_time_minutes": travel_time_min,
                        "safety_buffer_min": safety_buffer_min,
                        "recommended_departure_time": recommended_departure_str,
                        "recommended_departure_iso": recommended_departure_iso,
                        "expected_consultation_time": expected_time_str,
                        "expected_consultation_iso": expected_time_iso,
                        "expected_hospital_arrival": expected_arrival_str,
                        "expected_hospital_arrival_iso": expected_arrival_iso,
                        "arrival_deadline_time": arrival_deadline_str,
                        "arrival_deadline_iso": arrival_deadline_iso,
                        "departure_alert": departure_alert,
                        "leaving_now": leaving_now,
                        "leaving_now_at": leaving_now_at
                    }
                else:
                    entry_mode = entry.get("origin_mode")
                    if entry_mode == "preset":
                        loc_source = "preset"
                        is_approx = False
                        lat = entry.get("origin_lat") if entry.get("origin_lat") is not None else entry.get("origin_latitude")
                        lon = entry.get("origin_lng") if entry.get("origin_lng") is not None else entry.get("origin_longitude")
                        loc_addr = entry.get("origin_label") or entry.get("location_address") or entry.get("display_address") or entry.get("patient_address") or "Tumkur City"
                        entry_coords = [float(lon), float(lat)] if (lat is not None and lon is not None) else None
                    else:
                        city = entry.get("city") or entry.get("patient_address") or "Tumkur City"
                        entry_coords = None
                        if entry.get("origin_latitude") is not None and entry.get("origin_longitude") is not None:
                            try:
                                entry_coords = [float(entry["origin_longitude"]), float(entry["origin_latitude"])]
                            except (ValueError, TypeError):
                                entry_coords = None
                        loc_source = entry.get("location_source")
                        is_approx = entry.get("is_approximate") if entry.get("is_approximate") is not None else entry.get("is_approximate_location")
                        loc_addr = entry.get("location_address") or entry.get("display_address") or entry.get("patient_address") or city

                    travel_info = calculate_travel_metrics(
                        patient_address=loc_addr,
                        wait_time_min=predicted_wait,
                        expected_consultation_iso=expected_time_iso,
                        origin_coords=entry_coords,
                        safety_buffer_min=SAFETY_BUFFER_MIN,
                        leaving_now=leaving_now,
                        leaving_now_at=leaving_now_at,
                        location_source=loc_source,
                        is_approximate=is_approx,
                        location_address=loc_addr,
                        origin_mode=entry_mode,
                        origin_label=loc_addr
                    )
                    recommended_departure_str = travel_info.get("recommended_departure_time")
                    recommended_departure_iso = travel_info.get("recommended_departure_iso")
                    expected_arrival_str = travel_info.get("expected_hospital_arrival")
                    expected_arrival_iso = travel_info.get("expected_hospital_arrival_iso")
                    arrival_deadline_str = travel_info.get("arrival_deadline_time")
                    arrival_deadline_iso = travel_info.get("arrival_deadline_iso")

            db_update = {
                "position": idx,
                "is_late": bool(entry.get("late_arrival_reordered")),
                "total_active_queue": total_active_count,
                "predicted_duration": predicted_dur,
                "predicted_wait_time": predicted_wait,
                "expected_consultation_time": expected_time_str,
                "expected_consultation_iso": expected_time_iso,
                "expected_arrival_time": expected_arrival_str,
                "expected_arrival_iso": expected_arrival_iso,
                "arrival_deadline_time": arrival_deadline_str,
                "arrival_deadline_iso": arrival_deadline_iso,
                "recommended_departure_time": recommended_departure_str,
                "recommended_departure_iso": recommended_departure_iso,
                "target_30_status": target_30_status,
                "target_30_label": target_30_label,
                "is_next": (idx == 1),
                "is_current": False,
                "status": new_status,
                "travel_info": travel_info
            }
            if is_arrived:
                db_update["arrived_at_hospital"] = True
                db_update["verified_by_admin"] = bool(entry.get("verified_by_admin", True))
                db_update["leaving_now"] = False
                db_update["leaving_now_at"] = None
                db_update["departure_alert"] = None
                db_update["leave_reminder_status"] = "ARRIVED"

            db.queue.update_one(
                {"queue_id": entry["queue_id"]},
                {"$set": db_update}
            )

            # Sync position and timings to appointments collection if linked
            booking_id = entry.get("booking_id")
            if booking_id:
                try:
                    db.appointments.update_one(
                        {"booking_id": booking_id},
                        {"$set": {
                            "queue_position": idx,
                            "predicted_consultation_duration": predicted_dur,
                            "predicted_wait_time": predicted_wait,
                            "expected_consultation_time": expected_time_str,
                            "expected_consultation_iso": expected_time_iso,
                            "expected_arrival_time": expected_arrival_str,
                            "expected_arrival_iso": expected_arrival_iso,
                            "arrival_deadline_time": arrival_deadline_str,
                            "arrival_deadline_iso": arrival_deadline_iso,
                            "recommended_departure_time": recommended_departure_str,
                            "recommended_departure_iso": recommended_departure_iso,
                            "target_30_status": target_30_status,
                            "target_30_label": target_30_label,
                            "status": new_status,
                            "travel_info": travel_info
                        }}
                    )
                except Exception:
                    pass

            # Evaluate durable leave reminder state
            try:
                updated_entry = {**entry, "position": idx, "predicted_wait_time": predicted_wait, "expected_consultation_iso": expected_time_iso, "status": new_status}
                evaluate_and_update_leave_reminders(updated_entry)
            except Exception:
                pass

            # Turn is approaching notification for top positions
            today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")
            entry_date = str(entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date") or "").strip()
            is_today = (not entry_date) or (entry_date == today_str)
            is_advance_future = bool(entry_date and entry_date > today_str)
            is_booked_only = (new_status == "booked") or (entry.get("status") == "booked" and not entry.get("arrived_at_hospital"))

            if (
                idx <= 2
                and not entry.get("approaching_notified")
                and not entry.get("suppress_sms")
                and new_status not in ["missed", "missed_consultation", "booked", "cancelled", "completed"]
                and is_today
                and not is_advance_future
                and not is_booked_only
                and predicted_wait <= 30
            ):
                try:
                    arrival_code = entry.get("arrival_otp")
                    if not arrival_code and booking_id:
                        try:
                            apt = db.appointments.find_one({"booking_id": booking_id})
                            if apt:
                                arrival_code = apt.get("arrival_otp")
                        except Exception:
                            pass
                    if not arrival_code:
                        try:
                            otp_rec = db.otp_verifications.find_one({"token_or_booking_id": entry["queue_id"]})
                            if otp_rec:
                                arrival_code = otp_rec.get("otp")
                        except Exception:
                            pass

                    clean_room = str(entry.get("room_number", "204")).replace("Room", "").replace("room", "").strip() or "204"

                    sms_content = format_turn_approaching_sms(
                        token=entry["queue_id"],
                        queue_position=idx,
                        estimated_wait=predicted_wait,
                        expected_consultation=expected_time_str,
                        recommended_departure=recommended_departure_str,
                        room=clean_room,
                        arrival_code=arrival_code or "800066"
                    )

                    create_notification(
                        patient_id=entry.get("patient_id", "P001"),
                        notification_type="TURN_APPROACHING",
                        title="Your Turn is Approaching!",
                        message=f"Your token {entry['queue_id']} is now #{idx} in line. Estimated waiting time is ~{predicted_wait} mins. Expected at {expected_time_str}. Please be near Room {entry.get('room_number', '204')}.",
                        booking_id=entry["queue_id"],
                        sms_text=sms_content
                    )
                    db.queue.update_one({"queue_id": entry["queue_id"]}, {"$set": {"approaching_notified": True}})
                except Exception:
                    pass
        return
    except Exception:
        pass

    # In-memory queue fallback
    now = datetime.now(timezone.utc)
    if not doctor_id:
        active_docs = list({q.get("doctor_id") for q in IN_MEMORY_QUEUE if q.get("doctor_id") and q.get("status") in active_statuses})
        if active_docs:
            for doc in active_docs:
                recalculate_queue_positions(doctor_id=doc, consultation_date=consultation_date, slot_id=slot_id)
            return
        return

    waiting = [q for q in IN_MEMORY_QUEUE if q.get("status") in active_statuses and q.get("doctor_id") == doctor_id]
    if consultation_date:
        waiting = [q for q in waiting if (q.get("consultation_date") == consultation_date or q.get("consultation_slot", {}).get("date") == consultation_date)]
    if slot_id:
        waiting = [q for q in waiting if (q.get("slot_id") == slot_id or q.get("consultation_slot", {}).get("slot_id") == slot_id)]

    in_consult = next((q for q in IN_MEMORY_QUEUE if q.get("status") == "in_consultation" and q.get("doctor_id") == doctor_id), None)
    in_consult_remaining = max(3, int((in_consult.get("predicted_duration") or 15) * 0.5)) if in_consult else 0
    if in_consult:
        in_consult["is_current"] = True
        in_consult["is_next"] = False
        in_consult["position"] = 0

    def p_key(entry):
        p = str(entry.get("priority", "normal")).lower()
        s = str(entry.get("status", "waiting")).lower()
        is_emergency = 0 if p == "emergency" else 1
        is_missed = 1 if s in ["missed", "missed_consultation"] else 0
        tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
        is_late = 1 if entry.get("late_arrival_reordered") else 0
        joined_dt = _normalize_joined_dt(entry.get("joined_at"))
        return (tier, is_late, joined_dt, entry.get("queue_id", ""))

    waiting.sort(key=p_key)

    cumulative_wait = in_consult_remaining
    accumulated_dt = now + timedelta(minutes=in_consult_remaining)
    for idx, entry in enumerate(waiting, start=1):
        symptoms = entry.get("symptoms", ["general"])
        dept = entry.get("department", "General Medicine")
        prio = entry.get("priority", "normal")
        doc_id = entry.get("doctor_id") or doctor_id or "D001"
        is_emergency = (str(prio).lower() == "emergency")
        current_status = entry.get("status", "waiting")

        predicted_dur = predict_consultation_duration_service(
            symptoms=symptoms if isinstance(symptoms, list) else ["general"],
            department=dept,
            priority=prio,
            doctor_id=doc_id,
            queue_position=idx
        )

        expected_dt = accumulated_dt
        expected_time_str = expected_dt.strftime("%I:%M %p")
        expected_time_iso = expected_dt.isoformat()

        if idx == 1:
            if in_consult_remaining > 0:
                predicted_wait = in_consult_remaining
            elif is_emergency:
                predicted_wait = 2
            elif current_status == "called":
                predicted_wait = 0
            else:
                predicted_wait = 5
        else:
            predicted_wait = max(5, cumulative_wait)

        cumulative_wait += predicted_dur
        accumulated_dt += timedelta(minutes=predicted_dur)

        is_arrived = bool(
            entry.get("arrived_at_hospital") or
            entry.get("verified_by_admin") or
            current_status == "arrived"
        )
        target_30_status = "on_track" if predicted_wait <= 30 else "exceeds_target"
        target_30_label = "On track" if predicted_wait <= 30 else "Queue exceeds 30-minute target"

        if is_arrived:
            fresh_consult_dt = now + timedelta(minutes=predicted_wait)
            expected_time_str = fresh_consult_dt.strftime("%I:%M %p")
            expected_time_iso = fresh_consult_dt.isoformat()
            new_status = "arrived" if current_status in ["waiting", "ready", "arrived", "OTP_GENERATED"] else current_status
            entry["arrived_at_hospital"] = True
            entry["verified_by_admin"] = bool(entry.get("verified_by_admin", True))
            entry["leaving_now"] = False
            entry["leaving_now_at"] = None
            entry["departure_alert"] = None
            entry["recommended_departure_time"] = None
            entry["recommended_departure_iso"] = None
            entry["expected_arrival_time"] = None
            entry["expected_arrival_iso"] = None
            entry["arrival_deadline_time"] = None
            entry["arrival_deadline_iso"] = None
            entry["travel_info"] = {
                "arrived_at_hospital": True,
                "verified_by_admin": bool(entry.get("verified_by_admin", True)),
                "status": new_status,
                "is_arrived": True,
                "arrival_verified": True,
                "expected_consultation_time": expected_time_str,
                "expected_consultation_iso": expected_time_iso,
                "predicted_wait_time": predicted_wait,
                "target_30_status": target_30_status,
                "target_30_label": target_30_label,
                "doctor_name": entry.get("doctor_name"),
                "room_number": entry.get("room_number", "Room 101")
            }
        else:
            new_status = current_status
            if idx == 1 and current_status in ["waiting", "ready"]:
                new_status = "ready"
            elif current_status in ["missed", "missed_consultation"]:
                new_status = "missed"

        entry["position"] = idx
        entry["predicted_duration"] = predicted_dur
        entry["predicted_wait_time"] = predicted_wait
        entry["expected_consultation_time"] = expected_time_str
        entry["expected_consultation_iso"] = expected_time_iso
        entry["target_30_status"] = target_30_status
        entry["target_30_label"] = target_30_label
        entry["is_next"] = (idx == 1)
        entry["is_current"] = False
        entry["status"] = new_status

def join_queue(data: dict) -> Tuple[Optional[dict], Optional[str]]:
    patient_id = str(data.get("patient_id", "P001")).strip()
    doctor_id = str(data.get("doctor_id", "D001")).strip()
    department = str(data.get("department", "General Medicine")).strip()
    priority = str(data.get("priority", "normal")).strip().lower()
    symptoms = data.get("symptoms", [])
    custom_symptoms = str(data.get("custom_symptoms", "")).strip()

    # Clinical Patient Details for Consultation View
    patient_name = str(data.get("name") or data.get("patient_name") or "Patient").strip()
    age = int(data["age"]) if "age" in data and data["age"] not in [None, ""] else None
    gender = str(data.get("gender", "Not Specified")).strip()
    duration_days = int(data["duration_days"]) if "duration_days" in data and data["duration_days"] not in [None, ""] else None
    height_cm = float(data["height_cm"]) if "height_cm" in data and data["height_cm"] not in [None, ""] else None
    weight_kg = float(data["weight_kg"]) if "weight_kg" in data and data["weight_kg"] not in [None, ""] else None
    city = str(data.get("city") or data.get("location") or data.get("address") or "Tumakuru").strip()
    pdo = str(data.get("pdo", "")).strip()
    booking_id = str(data.get("booking_id", "")).strip()
    suppress_sms = bool(data.get("suppress_sms", False))

    if not patient_id:
        return None, "patient_id is required"

    # Fetch patient profile details fallback if missing
    patient_phone = str(data.get("phone", "")).strip()
    try:
        db = get_db()
        u = db.users.find_one({"$or": [{"patient_id": patient_id}, {"user_id": patient_id}]})
        if u:
            if patient_name == "Patient":
                patient_name = u.get("name", "Patient")
            if not patient_phone:
                patient_phone = u.get("phone", "")
            if not age and u.get("age"):
                age = u.get("age")
            if gender == "Not Specified" and u.get("gender"):
                gender = u.get("gender")
            if not city and u.get("city"):
                city = u.get("city")
    except Exception:
        pass

    queue_id = generate_queue_id(doctor_id=doctor_id)
    now_str = datetime.now(timezone.utc).isoformat()
    clean_priority = "emergency" if priority == "emergency" else "normal"

    # ML Consultation Duration Prediction
    predicted_dur = predict_consultation_duration_service(
        symptoms=symptoms if isinstance(symptoms, list) else ["general"],
        department=department,
        priority=clean_priority,
        doctor_id=doctor_id,
        queue_position=1
    )

    origin_latitude = None
    origin_longitude = None
    raw_lat = data.get("origin_latitude") if data.get("origin_latitude") is not None else data.get("latitude")
    raw_lon = data.get("origin_longitude") if data.get("origin_longitude") is not None else data.get("longitude")
    if raw_lat is not None and raw_lon is not None:
        try:
            origin_latitude = float(raw_lat)
            origin_longitude = float(raw_lon)
        except (ValueError, TypeError):
            origin_latitude = None
            origin_longitude = None

    is_approximate_location = (origin_latitude is None or origin_longitude is None) or bool(data.get("is_approximate_location", False))
    origin_coords = [origin_longitude, origin_latitude] if (origin_latitude is not None and origin_longitude is not None) else None

    booking_for = str(data.get("booking_for") or "myself").strip().lower()
    relation = str(data.get("relation") or ("self" if booking_for == "myself" else "Family Member")).strip()
    location_source = str(data.get("location_source") or ("device_gps" if (origin_latitude and not is_approximate_location) else ("manual" if is_approximate_location else "gps"))).strip()
    location_address = str(data.get("location_address") or data.get("display_address") or data.get("patient_address") or city).strip()
    location_captured_at = str(data.get("location_captured_at") or now_str).strip()
    is_approximate = (origin_latitude is None or origin_longitude is None) or bool(data.get("is_approximate") or data.get("is_approximate_location", False)) or (location_source == "manual")

    # Initial Travel Metrics based on City / Landmark / Patient Coords
    travel_info = calculate_travel_metrics(
        patient_address=location_address or city,
        wait_time_min=predicted_dur,
        origin_coords=origin_coords,
        location_source=location_source,
        is_approximate=is_approximate,
        location_address=location_address
    )

    # Generate 6-digit Hospital Arrival Verification OTP
    otp_doc, _ = generate_consultation_otp(queue_id, patient_id, doctor_id)
    arrival_otp = otp_doc.get("otp", "") if otp_doc else "123456"

    # Fetch Doctor Consultation Room
    room_number = "Room 101"
    try:
        db = get_db()
        doc = db.doctors.find_one({"doctor_id": doctor_id})
        if doc and doc.get("consultation_room"):
            room_number = doc.get("consultation_room")
    except Exception:
        pass

    # Slot and Consultation Date handling
    consultation_date_str = str(data.get("consultation_date") or "").strip()
    raw_slot = data.get("consultation_slot") or data.get("slot") or data.get("slot_id") or "morning"
    slot_info, _ = validate_and_normalize_slot(raw_slot, consultation_date=consultation_date_str or None)
    if not slot_info:
        slot_info, _ = validate_and_normalize_slot("morning", consultation_date=consultation_date_str or None)
    slot_id = slot_info.get("slot_id", "morning")

    queue_entry = {
        "queue_id": queue_id,
        "booking_id": booking_id or queue_id,
        "patient_id": patient_id,
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "age": age,
        "gender": gender,
        "symptoms": symptoms,
        "custom_symptoms": custom_symptoms,
        "duration_days": duration_days,
        "height_cm": height_cm,
        "weight_kg": weight_kg,
        "city": city,
        "patient_address": str(data.get("patient_address") or city).strip(),
        "origin_latitude": origin_latitude,
        "origin_longitude": origin_longitude,
        "latitude": origin_latitude,
        "longitude": origin_longitude,
        "is_approximate_location": is_approximate,
        "is_approximate": is_approximate,
        "location_source": location_source,
        "location_address": location_address,
        "display_address": location_address,
        "location_captured_at": location_captured_at,
        "booking_for": booking_for,
        "relation": relation,
        "pdo": pdo,
        "doctor_id": doctor_id,
        "department": department,
        "priority": clean_priority,
        "position": 1,
        "status": "waiting",
        "room_number": room_number,
        "consultation_date": consultation_date_str or slot_info.get("date"),
        "consultation_slot": slot_info,
        "slot_id": slot_id,
        "leaving_now": False,
        "leaving_now_at": None,
        "leave_reminder_status": "NOT_REQUIRED",
        "leave_reminder_sent_at": None,
        "expected_consultation_time": None,
        "expected_consultation_iso": None,
        "is_next": False,
        "is_current": False,
        "arrived_at_hospital": False,
        "verified_by_admin": False,
        "late_arrival_reordered": False,
        "late_arrival_moved_at": None,
        "arrival_otp": arrival_otp,
        "joined_at": now_str,
        "suppress_sms": suppress_sms,
        "predicted_duration": predicted_dur,
        "predicted_wait_time": 2 if clean_priority == "emergency" else 5,
        "travel_info": travel_info
    }

    try:
        db = get_db()
        db.queue.insert_one(queue_entry)
        recalculate_queue_positions(
            doctor_id=doctor_id,
            department=department,
            consultation_date=consultation_date_str or slot_info.get("date"),
            slot_id=slot_id
        )
        updated = db.queue.find_one({"queue_id": queue_id})
        res = serialize_doc(updated)
    except Exception:
        queue_entry.pop("_id", None)
        IN_MEMORY_QUEUE.append(queue_entry)
        recalculate_queue_positions(
            doctor_id=doctor_id,
            department=department,
            consultation_date=consultation_date_str or slot_info.get("date"),
            slot_id=slot_id
        )
        mem_entry = next((q for q in IN_MEMORY_QUEUE if q.get("queue_id") == queue_id), queue_entry)
        res = serialize_doc(mem_entry)

    pos = res.get("position", 1)
    wait_time = res.get("predicted_wait_time", 2 if clean_priority == "emergency" else 5)
    dep_time = res.get("travel_info", {}).get("recommended_departure_time", "Soon")

    # 1. Token assignment notification
    create_notification(
        patient_id=patient_id,
        notification_type="QUEUE_UPDATED",
        title="Queue Token Assigned",
        message=f"Queue Token {queue_id} assigned (Position #{pos}). Estimated waiting time is {wait_time} minutes.",
        booking_id=queue_id,
        suppress_sms=suppress_sms
    )

    # 2. Smart Departure notification
    create_notification(
        patient_id=patient_id,
        notification_type="DEPARTURE_REMINDER",
        title="Recommended Departure Time",
        message=f"Your recommended departure time from {city} is {dep_time}. Estimated waiting time is {wait_time} minutes.",
        booking_id=queue_id,
        suppress_sms=suppress_sms
    )

    # 3. Arrival OTP notification
    create_notification(
        patient_id=patient_id,
        notification_type="ARRIVAL_OTP_ISSUED",
        title="Hospital Arrival Code",
        message=f"Your 6-digit hospital arrival verification code is {arrival_otp}. Present this code at the reception desk upon arriving at SIMSRH.",
        booking_id=queue_id,
        suppress_sms=suppress_sms
    )

    if doctor_id:
        create_notification(
            patient_id=doctor_id,
            notification_type="PATIENT_JOINED_QUEUE",
            title="New Patient in OPD Queue",
            message=f"Patient {patient_name} (Token {queue_id}) joined your queue for {department}.",
            booking_id=queue_id
        )

    return res, None

def mark_patient_arrived(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            db.queue.update_one(
                {"queue_id": q_id},
                {"$set": {"arrived_at_hospital": True, "status": "arrived"}}
            )
            recalculate_queue_positions(
                doctor_id=entry.get("doctor_id"),
                department=entry.get("department"),
                consultation_date=entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date"),
                slot_id=entry.get("slot_id") or entry.get("consultation_slot", {}).get("slot_id")
            )
            updated = db.queue.find_one({"queue_id": q_id})
            res = serialize_doc(updated)
            create_notification(
                patient_id=entry["patient_id"],
                notification_type="ARRIVED_AT_HOSPITAL",
                title="Welcome to Smart Hospital",
                message=f"Status set to Hospital Queue Mode. Please take a seat near {entry.get('room_number', 'Room 204')}.",
                booking_id=q_id
            )
            return res, None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["arrived_at_hospital"] = True
            q["status"] = "arrived"
            recalculate_queue_positions(
                doctor_id=q.get("doctor_id"),
                department=q.get("department"),
                consultation_date=q.get("consultation_date") or q.get("consultation_slot", {}).get("date"),
                slot_id=q.get("slot_id") or q.get("consultation_slot", {}).get("slot_id")
            )
            create_notification(
                patient_id=q["patient_id"],
                notification_type="ARRIVED_AT_HOSPITAL",
                title="Welcome to Smart Hospital",
                message=f"Status set to Hospital Queue Mode. Please take a seat near {q.get('room_number', 'Room 204')}.",
                booking_id=q["queue_id"]
            )
            return serialize_doc(q), None

    return None, f"Queue entry '{queue_id}' not found"

def update_queue_status(queue_id: str, new_status: str, metadata: Optional[dict] = None) -> Tuple[Optional[dict], Optional[str]]:
    valid_statuses = ["waiting", "arrived", "ready", "called", "in_consultation", "completed", "no_show", "cancelled", "missed", "missed_consultation"]
    if new_status not in valid_statuses:
        return None, f"Invalid status '{new_status}'. Allowed: {valid_statuses}"

    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]}) or db.appointments.find_one({"booking_id": queue_id})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            b_id = entry.get("booking_id", queue_id)
            now_str = datetime.now(timezone.utc).isoformat()
            update_data = {"status": new_status, "updated_at": now_str}

            if new_status == "completed" and metadata:
                doc_notes = metadata.get("notes") or metadata.get("doctor_notes") or metadata.get("clinical_notes")
                diagnosis = metadata.get("diagnosis")
                advice = metadata.get("advice")
                duration = metadata.get("actual_duration_mins", 15)
                if doc_notes:
                    update_data["doctor_notes"] = str(doc_notes).strip()
                if diagnosis:
                    update_data["diagnosis"] = str(diagnosis).strip()
                if advice:
                    update_data["advice"] = str(advice).strip()
                update_data["actual_duration_mins"] = duration
                update_data["completed_at"] = now_str

            db.queue.update_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}, {"$set": update_data})
            db.appointments.update_one({"booking_id": b_id}, {"$set": update_data})
            recalculate_queue_positions(
                doctor_id=entry.get("doctor_id"),
                department=entry.get("department"),
                consultation_date=entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date"),
                slot_id=entry.get("slot_id") or entry.get("consultation_slot", {}).get("slot_id")
            )

            # Archive consultation record into permanent db.consultations
            if new_status == "completed":
                try:
                    from services.consultation_service import archive_consultation
                    archive_consultation(
                        queue_or_booking_id=q_id,
                        doctor_notes=update_data.get("doctor_notes"),
                        diagnosis=update_data.get("diagnosis"),
                        advice=update_data.get("advice"),
                        actual_duration_mins=update_data.get("actual_duration_mins", 15)
                    )
                except Exception as ex:
                    logger.warning(f"Error archiving consultation: {ex}")

            updated = db.queue.find_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}) or db.appointments.find_one({"booking_id": b_id})
            res = serialize_doc(updated)
            return res, None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["status"] = new_status
            if new_status == "completed" and metadata:
                q["doctor_notes"] = metadata.get("notes") or metadata.get("clinical_notes")
                q["diagnosis"] = metadata.get("diagnosis")
                q["advice"] = metadata.get("advice")
            recalculate_queue_positions(
                doctor_id=q.get("doctor_id"),
                department=q.get("department"),
                consultation_date=q.get("consultation_date") or q.get("consultation_slot", {}).get("date"),
                slot_id=q.get("slot_id") or q.get("consultation_slot", {}).get("slot_id")
            )
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == queue_id:
            b["status"] = new_status
            return serialize_doc(b), None

    return None, f"Queue token '{queue_id}' not found"

def skip_patient_service(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Skips the current patient if unavailable/not arrived.
    Marks status as 'missed' ("Missed Consultation"), moves that token to the END of the active queue
    by updating joined_at and missed_at, recalculates positions and Random Forest wait times for all
    remaining patients, and dispatches a missed consultation alert.
    """
    now_str = datetime.now(timezone.utc).isoformat()
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]}) or db.appointments.find_one({"booking_id": queue_id})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            b_id = entry.get("booking_id", queue_id)
            skip_count = entry.get("skip_count", 0) + 1

            db.queue.update_one(
                {"$or": [{"queue_id": q_id}, {"booking_id": b_id}]},
                {"$set": {
                    "status": "missed",
                    "missed_at": now_str,
                    "joined_at": now_str, # Sets joined time to now so token moves to end of line
                    "skip_count": skip_count,
                    "updated_at": now_str
                }}
            )
            db.appointments.update_one(
                {"booking_id": b_id},
                {"$set": {
                    "status": "missed",
                    "missed_at": now_str,
                    "skip_count": skip_count,
                    "updated_at": now_str
                }}
            )

            # Recalculate queue positions so remaining active patients advance
            recalculate_queue_positions(
                doctor_id=entry.get("doctor_id"),
                department=entry.get("department"),
                consultation_date=entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date"),
                slot_id=entry.get("slot_id") or entry.get("consultation_slot", {}).get("slot_id")
            )

            # Notify patient that consultation was missed and moved to end of line
            try:
                create_notification(
                    patient_id=entry.get("patient_id", "P001"),
                    notification_type="MISSED_CONSULTATION",
                    title="Consultation Call Missed",
                    message=f"Doctor called your token {q_id} but you were unavailable. Your token has been retained and moved to the end of the active queue. Please report to the reception desk or chamber.",
                    booking_id=q_id
                )
            except Exception:
                pass

            updated = db.queue.find_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}) or db.appointments.find_one({"booking_id": b_id})
            return serialize_doc(updated), None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["status"] = "missed"
            q["missed_at"] = now_str
            q["joined_at"] = now_str
            q["skip_count"] = q.get("skip_count", 0) + 1
            recalculate_queue_positions(
                doctor_id=q.get("doctor_id"),
                department=q.get("department"),
                consultation_date=q.get("consultation_date") or q.get("consultation_slot", {}).get("date"),
                slot_id=q.get("slot_id") or q.get("consultation_slot", {}).get("slot_id")
            )
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == queue_id:
            b["status"] = "missed"
            b["missed_at"] = now_str
            b["skip_count"] = b.get("skip_count", 0) + 1
            return serialize_doc(b), None

    return None, f"Queue token '{queue_id}' not found"

def complete_consultation(booking_id: str, actual_duration_mins: int = 15, doctor_notes: Optional[str] = None, diagnosis: Optional[str] = None, advice: Optional[str] = None) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": booking_id}, {"booking_id": booking_id}]}) or \
                db.appointments.find_one({"booking_id": booking_id})
        if entry:
            q_id = entry.get("queue_id", booking_id)
            b_id = entry.get("booking_id", booking_id)
            now_str = datetime.now(timezone.utc).isoformat()
            update_data = {
                "status": "completed",
                "actual_duration_mins": actual_duration_mins,
                "completed_at": now_str
            }
            if doctor_notes:
                update_data["doctor_notes"] = str(doctor_notes).strip()
            if diagnosis:
                update_data["diagnosis"] = str(diagnosis).strip()
            if advice:
                update_data["advice"] = str(advice).strip()

            db.queue.update_one({"$or": [{"queue_id": q_id}, {"booking_id": b_id}]}, {"$set": update_data})
            db.appointments.update_one({"booking_id": b_id}, {"$set": update_data})
            recalculate_queue_positions(
                doctor_id=entry.get("doctor_id"),
                department=entry.get("department"),
                consultation_date=entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date"),
                slot_id=entry.get("slot_id") or entry.get("consultation_slot", {}).get("slot_id")
            )

            try:
                from services.consultation_service import archive_consultation
                archive_consultation(
                    queue_or_booking_id=q_id,
                    doctor_notes=doctor_notes,
                    diagnosis=diagnosis,
                    advice=advice,
                    actual_duration_mins=actual_duration_mins
                )
            except Exception as ex:
                logger.warning(f"Error archiving consultation: {ex}")

            entry["status"] = "completed"
            entry["actual_duration_mins"] = actual_duration_mins
            return serialize_doc(entry), None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == booking_id or q.get("booking_id") == booking_id:
            q["status"] = "completed"
            q["actual_duration_mins"] = actual_duration_mins
            recalculate_queue_positions(
                doctor_id=q.get("doctor_id"),
                department=q.get("department"),
                consultation_date=q.get("consultation_date") or q.get("consultation_slot", {}).get("date"),
                slot_id=q.get("slot_id") or q.get("consultation_slot", {}).get("slot_id")
            )
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == booking_id:
            b["status"] = "completed"
            b["actual_duration_mins"] = actual_duration_mins
            return serialize_doc(b), None

    return None, f"Consultation '{booking_id}' not found"

def get_queue_status(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]})
        if entry:
            active_statuses = ["waiting", "arrived", "ready", "called", "OTP_GENERATED", "missed", "missed_consultation"]
            if entry.get("status") in active_statuses and (not entry.get("expected_consultation_time") or not entry.get("consultation_date") or not entry.get("slot_id")):
                recalculate_queue_positions(
                    doctor_id=entry.get("doctor_id"),
                    department=entry.get("department"),
                    consultation_date=entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date"),
                    slot_id=entry.get("slot_id") or entry.get("consultation_slot", {}).get("slot_id")
                )
                entry = db.queue.find_one({"queue_id": entry.get("queue_id", queue_id)}) or entry
            return serialize_doc(entry), None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            return serialize_doc(q), None

    from services.appointment_service import IN_MEMORY_BOOKINGS
    for b in IN_MEMORY_BOOKINGS:
        if b.get("booking_id") == queue_id:
            return serialize_doc(b), None

    return None, f"Queue entry '{queue_id}' not found"

def get_all_queues(department_filter: Optional[str] = None, doctor_id: Optional[str] = None) -> Tuple[List[dict], Optional[str]]:
    try:
        db = get_db()
        query = {}
        if doctor_id:
            query["doctor_id"] = doctor_id
        if department_filter:
            query["department"] = {"$regex": f"^{department_filter}$", "$options": "i"}

        entries = list(db.queue.find(query))
        if entries:
            def priority_sort(entry):
                p = str(entry.get("priority", "normal")).lower()
                s = str(entry.get("status", "waiting")).lower()
                is_emergency = 0 if p == "emergency" else 1
                is_missed = 1 if s in ["missed", "missed_consultation"] else 0
                tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
                return (tier, entry.get("position", 999), entry.get("joined_at", ""))
            entries.sort(key=priority_sort)

            # Attach patient name/phone from the users collection if missing
            patient_ids = list({e.get("patient_id") for e in entries if e.get("patient_id")})
            users_lookup = {}
            if patient_ids:
                for u in db.users.find({"patient_id": {"$in": patient_ids}}):
                    users_lookup[u.get("patient_id")] = {
                        "patient_name": u.get("name"),
                        "patient_phone": u.get("phone")
                    }
            for entry in entries:
                info = users_lookup.get(entry.get("patient_id"), {})
                if not entry.get("patient_name") or entry.get("patient_name") == "Unknown":
                    entry["patient_name"] = info.get("patient_name", "Patient")
                if not entry.get("patient_phone"):
                    entry["patient_phone"] = info.get("patient_phone", "")

            return serialize_docs(entries), None
    except Exception:
        pass

    def p_sort(entry):
        p = str(entry.get("priority", "normal")).lower()
        s = str(entry.get("status", "waiting")).lower()
        is_emergency = 0 if p == "emergency" else 1
        is_missed = 1 if s in ["missed", "missed_consultation"] else 0
        tier = 0 if is_emergency == 0 else (2 if is_missed == 1 else 1)
        return (tier, entry.get("position", 999), entry.get("joined_at", ""))
    sorted_mem = sorted(IN_MEMORY_QUEUE, key=p_sort)
    if doctor_id:
        sorted_mem = [q for q in sorted_mem if q.get("doctor_id") == doctor_id]
    if department_filter:
        sorted_mem = [q for q in sorted_mem if str(q.get("department", "")).lower() == department_filter.lower()]
    return serialize_docs(sorted_mem), None

def escalate_emergency(queue_id: str) -> Tuple[Optional[dict], Optional[str]]:
    try:
        db = get_db()
        entry = db.queue.find_one({"$or": [{"queue_id": queue_id}, {"booking_id": queue_id}]})
        if entry:
            q_id = entry.get("queue_id", queue_id)
            now_str = datetime.now(timezone.utc).isoformat()
            db.queue.update_one({"queue_id": q_id}, {"$set": {"priority": "emergency", "updated_at": now_str}})
            recalculate_queue_positions(
                doctor_id=entry.get("doctor_id"),
                department=entry.get("department"),
                consultation_date=entry.get("consultation_date") or entry.get("consultation_slot", {}).get("date"),
                slot_id=entry.get("slot_id") or entry.get("consultation_slot", {}).get("slot_id")
            )
            updated = db.queue.find_one({"queue_id": q_id})
            res = serialize_doc(updated)

            create_notification(
                patient_id=entry["patient_id"],
                notification_type="EMERGENCY_QUEUE_UPDATE",
                title="Emergency Priority Promoted",
                message=f"Queue token {q_id} promoted to Emergency Priority. Your position is now #1.",
                booking_id=q_id
            )

            # Alert Assigned Doctor for Immediate Triage
            doc_id = entry.get("doctor_id")
            if doc_id:
                create_notification(
                    patient_id=doc_id,
                    notification_type="EMERGENCY_ALERT",
                    title="URGENT: Emergency Patient Escalated",
                    message=f"Patient {entry.get('patient_name', 'Patient')} (Token {q_id}) has been escalated to EMERGENCY PRIORITY in {entry.get('department', 'OPD')}.",
                    booking_id=q_id
                )
            return res, None
    except Exception:
        pass

    for q in IN_MEMORY_QUEUE:
        if q.get("queue_id") == queue_id or q.get("booking_id") == queue_id:
            q["priority"] = "emergency"
            recalculate_queue_positions(
                doctor_id=q.get("doctor_id"),
                department=q.get("department"),
                consultation_date=q.get("consultation_date") or q.get("consultation_slot", {}).get("date"),
                slot_id=q.get("slot_id") or q.get("consultation_slot", {}).get("slot_id")
            )
            create_notification(
                patient_id=q["patient_id"],
                notification_type="EMERGENCY_QUEUE_UPDATE",
                title="Emergency Priority Promoted",
                message=f"Queue token {q.get('queue_id')} promoted to Emergency Priority. Your position is now #1.",
                booking_id=q.get("queue_id")
            )
            return serialize_doc(q), None

    return None, f"Queue entry '{queue_id}' not found"

def sanitize_public_entry(entry: dict) -> dict:
    """
    STRICT PRIVACY (Zero PII) sanitizer:
    Strictly removes:
      - patient names (name, patient_name)
      - phone numbers (phone, patient_phone)
      - email addresses (email, patient_email)
      - age, gender, address, city, patient_address
      - raw symptoms (symptoms, custom_symptoms)
      - medical history, clinical notes, doctor_notes, diagnosis, advice
      - OTPs (arrival_otp, otp)
      - patient account IDs (patient_id, user_id)
    Returns only safe public operational indicators.
    """
    dept = entry.get("department", "General Medicine")
    category = SAFE_DEPARTMENT_CATEGORIES.get(dept, f"{dept} Consultation")
    slot = entry.get("consultation_slot") or {}
    
    # Safe doctor display name: use existing doctor name if stored, or look up in doctors collection
    doctor_display = entry.get("doctor_name")
    doc_id = entry.get("doctor_id")
    if not doctor_display or doctor_display == doc_id:
        if doc_id:
            try:
                db = get_db()
                doc_doc = db.doctors.find_one({"doctor_id": doc_id}, {"name": 1})
                if doc_doc and doc_doc.get("name"):
                    doctor_display = doc_doc["name"]
            except Exception:
                pass
    if not doctor_display:
        doctor_display = doc_id or "On-Duty Physician"

    return {
        "token": entry.get("queue_id"),
        "queue_id": entry.get("queue_id"),
        "department": dept,
        "consultation_category": category,
        "doctor": doctor_display,
        "doctor_id": entry.get("doctor_id"),
        "room_number": entry.get("room_number", "Room 204"),
        "position": entry.get("position", 1),
        "status": entry.get("status", "waiting"),
        "predicted_duration": entry.get("predicted_duration", 15),
        "estimated_wait_time": entry.get("predicted_wait_time", 5),
        "expected_consultation_time": entry.get("expected_consultation_time") or "Approaching",
        "expected_consultation_iso": entry.get("expected_consultation_iso"),
        "is_current": bool(entry.get("is_current") or entry.get("status") == "in_consultation"),
        "is_next": bool(entry.get("is_next") or (entry.get("position") == 1 and entry.get("status") != "in_consultation")),
        "is_late": bool(entry.get("late_arrival_reordered") or entry.get("is_late")),
        "late_arrival_reordered": bool(entry.get("late_arrival_reordered")),
        "total_active_queue": entry.get("total_active_queue"),
        "consultation_slot": {
            "slot_id": slot.get("slot_id", entry.get("slot_id", "morning")),
            "slot_name": slot.get("slot_name", "Morning Slot"),
            "display_time": slot.get("display_time", "09:00 AM – 01:00 PM"),
            "date": slot.get("date", entry.get("consultation_date"))
        } if (slot or entry.get("slot_id")) else None
    }

def get_public_live_queue(
    department: Optional[str] = None,
    slot_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    consultation_date: Optional[str] = None
) -> Dict:
    """
    Returns sanitized public live consultation queue board data for the homepage.
    Guarantees STRICT ZERO PII compliance.
    Includes both overall list and clean doctor-specific queue partitions.
    """
    active_statuses = ["in_consultation", "ready", "called", "waiting", "arrived"]
    and_clauses = [{"status": {"$in": active_statuses}}]
    if doctor_id:
        and_clauses.append({"doctor_id": doctor_id})
    if department:
        and_clauses.append({"department": {"$regex": f"^{department}$", "$options": "i"}})
    if slot_id:
        and_clauses.append({"$or": [{"consultation_slot.slot_id": slot_id}, {"slot_id": slot_id}]})
    if consultation_date:
        and_clauses.append({"$or": [
            {"consultation_date": consultation_date},
            {"consultation_slot.date": consultation_date}
        ]})

    query = {"$and": and_clauses} if len(and_clauses) > 1 else and_clauses[0]

    try:
        db = get_db()
        entries = list(db.queue.find(query).sort([("position", 1), ("joined_at", 1)]))
    except Exception:
        entries = [q for q in IN_MEMORY_QUEUE if q.get("status") in active_statuses]
        if doctor_id:
            entries = [q for q in entries if q.get("doctor_id") == doctor_id]
        if department:
            entries = [q for q in entries if str(q.get("department", "")).lower() == department.lower()]
        if slot_id:
            entries = [q for q in entries if (q.get("slot_id") == slot_id or q.get("consultation_slot", {}).get("slot_id") == slot_id)]
        if consultation_date:
            entries = [q for q in entries if (q.get("consultation_date") == consultation_date or q.get("consultation_slot", {}).get("date") == consultation_date)]

    sanitized = [sanitize_public_entry(e) for e in entries]

    currently_consulting = [e for e in sanitized if e["is_current"] or e["status"] == "in_consultation"]
    next_patients = [e for e in sanitized if e["is_next"] and not e["is_current"]]
    upcoming = [e for e in sanitized if not e["is_current"] and not e["is_next"]]

    # Build separate doctor queues mapping
    doctor_queues = {}
    for item in sanitized:
        doc_key = item.get("doctor_id") or item.get("doctor") or "General"
        if doc_key not in doctor_queues:
            doctor_queues[doc_key] = {
                "doctor_id": item.get("doctor_id"),
                "doctor_name": item.get("doctor"),
                "department": item.get("department"),
                "room_number": item.get("room_number"),
                "currently_consulting": [],
                "next_patient": None,
                "upcoming_patients": [],
                "entries": [],
                "total_active": 0
            }
        dq = doctor_queues[doc_key]
        dq["total_active"] += 1
        dq["entries"].append(item)
        if item.get("is_current") or item.get("status") == "in_consultation":
            dq["currently_consulting"].append(item)
        elif item.get("is_next") or item.get("position") == 1:
            if not dq["next_patient"]:
                dq["next_patient"] = item
            else:
                dq["upcoming_patients"].append(item)
        else:
            dq["upcoming_patients"].append(item)

    return {
        "doctor_queues": doctor_queues,
        "queue_entries": sanitized,
        "currently_consulting": currently_consulting,
        "next_patient": next_patients[0] if next_patients else None,
        "next_patients": next_patients,
        "upcoming_patients": upcoming,
        "total_active_queue": len(sanitized),
        "last_updated": datetime.now(timezone.utc).isoformat()
    }