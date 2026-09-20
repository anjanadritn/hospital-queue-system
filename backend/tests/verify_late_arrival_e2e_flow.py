import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, r"d:\Projects\hospital-queue-system\backend")

try:
    from zoneinfo import ZoneInfo
    HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    HOSPITAL_TZ = timezone(timedelta(hours=5, minutes=30))

from database.mongodb import get_db
from services.queue_service import evaluate_late_arrivals, recalculate_queue_positions

def run_test():
    db = get_db()
    
    print("==================================================")
    print("STEP 1: PREPARING EXISTING PATIENT QUEUE ENTRY")
    print("==================================================")
    
    # We use existing entry D001-Q010 and peer D001-Q008
    q010 = db.queue.find_one({"queue_id": "D001-Q010"})
    q008 = db.queue.find_one({"queue_id": "D001-Q008"})
    
    assert q010 is not None, "D001-Q010 must exist in DB"
    assert q008 is not None, "D001-Q008 must exist in DB"
    
    # Set initial order so Q010 is position 2 and Q008 is position 3
    # Q010 joined earlier than Q008
    t_base = datetime.now(HOSPITAL_TZ) - timedelta(minutes=30)
    t_q010 = (t_base + timedelta(minutes=5)).isoformat()
    t_q008 = (t_base + timedelta(minutes=10)).isoformat()
    
    # BEFORE STATE: Q010 has an arrival deadline in the FUTURE (not yet expired)
    future_arrival = datetime.now(HOSPITAL_TZ) + timedelta(minutes=10)
    future_deadline = future_arrival + timedelta(minutes=2)
    
    db.queue.update_one(
        {"queue_id": "D001-Q010"},
        {"$set": {
            "joined_at": t_q010,
            "original_joined_at": t_q010,
            "late_arrival_reordered": False,
            "status": "waiting",
            "arrived_at_hospital": False,
            "verified_by_admin": False,
            "expected_arrival_iso": future_arrival.isoformat(),
            "arrival_deadline_iso": future_deadline.isoformat(),
            "travel_info.arrival_deadline_iso": future_deadline.isoformat()
        }}
    )
    db.appointments.update_one(
        {"booking_id": q010.get("booking_id")},
        {"$set": {"late_arrival_reordered": False, "status": "confirmed"}}
    )
    
    db.queue.update_one(
        {"queue_id": "D001-Q008"},
        {"$set": {
            "joined_at": t_q008,
            "original_joined_at": t_q008,
            "late_arrival_reordered": False,
            "status": "waiting",
            "arrived_at_hospital": False,
            "verified_by_admin": False,
            # Future deadline for Q008 as well
            "arrival_deadline_iso": (datetime.now(HOSPITAL_TZ) + timedelta(minutes=30)).isoformat()
        }}
    )
    
    # Recalculate positions for D001 initial state
    recalculate_queue_positions(doctor_id="D001", consultation_date="2026-09-19", slot_id="evening")
    
    # Also record state of another doctor before evaluation
    other_doc_id = "D002"
    other_before = list(db.queue.find({"doctor_id": other_doc_id}).sort("position", 1))
    
    # Record BEFORE state of D001-Q010
    q010_before = db.queue.find_one({"queue_id": "D001-Q010"})
    q008_before = db.queue.find_one({"queue_id": "D001-Q008"})
    
    print("\n==================================================")
    print("STEP 2: RECORDED 'BEFORE' QUEUE METRICS")
    print("==================================================")
    print(f"Token: {q010_before.get('queue_id')}")
    print(f"Booking ID: {q010_before.get('booking_id')}")
    print(f"Doctor: {q010_before.get('doctor_id')}")
    print(f"Consultation Date: {q010_before.get('consultation_date')}")
    print(f"Consultation Slot: {q010_before.get('consultation_slot', {}).get('slot_name', 'Evening')}")
    print(f"Queue Position BEFORE: #{q010_before.get('position')}")
    print(f"Peer Q008 Position BEFORE: #{q008_before.get('position')}")
    print(f"Expected Arrival BEFORE: {q010_before.get('expected_arrival_time')}")
    print(f"Arrival Deadline BEFORE: {q010_before.get('arrival_deadline_time')}")
    print(f"Expected Consultation BEFORE: {q010_before.get('expected_consultation_time')}")
    print(f"Predicted Wait Time BEFORE: {q010_before.get('predicted_wait_time')} min")
    print(f"Late Arrival Flag BEFORE: {q010_before.get('late_arrival_reordered')}")
    
    assert q010_before.get("position") == 2, f"Expected Q010 to be position 2, got {q010_before.get('position')}"
    assert q008_before.get("position") == 3, f"Expected Q008 to be position 3, got {q008_before.get('position')}"
    
    print("\n==================================================")
    print("STEP 3: SIMULATING 2-MINUTE ARRIVAL DEADLINE EXPIRATION")
    print("==================================================")
    # The 2-minute deadline expires:
    past_arrival = datetime.now(HOSPITAL_TZ) - timedelta(minutes=10)
    past_deadline = past_arrival + timedelta(minutes=2)
    db.queue.update_one(
        {"queue_id": "D001-Q010"},
        {"$set": {
            "expected_arrival_time": past_arrival.strftime("%I:%M %p"),
            "expected_arrival_iso": past_arrival.isoformat(),
            "arrival_deadline_time": past_deadline.strftime("%I:%M %p"),
            "arrival_deadline_iso": past_deadline.isoformat(),
            "travel_info.arrival_deadline_iso": past_deadline.isoformat()
        }}
    )
    
    # Running evaluate_late_arrivals at current time (current time > deadline)
    now_ist = datetime.now(HOSPITAL_TZ)
    reordered = evaluate_late_arrivals(doctor_id="D001", now_dt=now_ist)
    print(f"Late arrival evaluator reordered count: {len(reordered)}")
    for r in reordered:
        print(f"  Reordered: {r.get('queue_id')} for Doctor {r.get('doctor_id')}")
        
    print("\n==================================================")
    print("STEP 4 & 5: VERIFYING AFTER-EVALUATION METRICS")
    print("==================================================")
    q010_after = db.queue.find_one({"queue_id": "D001-Q010"})
    q008_after = db.queue.find_one({"queue_id": "D001-Q008"})
    appt_after = db.appointments.find_one({"booking_id": q010_after.get("booking_id")})
    
    # 4. Patient validations
    print(f"Token: {q010_after.get('queue_id')} (same token: {q010_after.get('queue_id') == q010_before.get('queue_id')})")
    print(f"Booking ID: {q010_after.get('booking_id')} (same booking: {q010_after.get('booking_id') == q010_before.get('booking_id')})")
    print(f"Status: {q010_after.get('status')} (NOT cancelled/deleted: {q010_after.get('status') in ['waiting', 'ready']})")
    print(f"Appointment status: {appt_after.get('status')} (NOT cancelled)")
    print(f"Doctor: {q010_after.get('doctor_id')} (same doctor: {q010_after.get('doctor_id') == q010_before.get('doctor_id')})")
    print(f"Date: {q010_after.get('consultation_date')} (same date: {q010_after.get('consultation_date') == q010_before.get('consultation_date')})")
    print(f"Slot: {q010_after.get('consultation_slot', {}).get('slot_id')} (same slot)")
    print(f"Position BEFORE: #{q010_before.get('position')} -> AFTER: #{q010_after.get('position')} (Moved to END)")
    print(f"Peer Q008 Position BEFORE: #{q008_before.get('position')} -> AFTER: #{q008_after.get('position')} (Promoted)")
    print(f"late_arrival_reordered flag AFTER: {q010_after.get('late_arrival_reordered')}")
    
    # 5. Recalculation validations
    print(f"Predicted Wait Time BEFORE: {q010_before.get('predicted_wait_time')}m -> AFTER: {q010_after.get('predicted_wait_time')}m")
    print(f"Expected Consultation BEFORE: {q010_before.get('expected_consultation_time')} -> AFTER: {q010_after.get('expected_consultation_time')}")
    print(f"Peer Q008 Expected Consultation: {q008_after.get('expected_consultation_time')}")
    
    assert q010_after.get("queue_id") == "D001-Q010"
    assert q010_after.get("booking_id") == q010_before.get("booking_id")
    assert q010_after.get("status") in ["waiting", "ready"]
    assert q010_after.get("late_arrival_reordered") is True
    assert q010_after.get("position") == 3, f"Expected Q010 to move to end (#3), got #{q010_after.get('position')}"
    assert q008_after.get("position") == 2, f"Expected Q008 to be promoted to #2, got #{q008_after.get('position')}"
    assert appt_after.get("status") != "cancelled"
    
    print("\n==================================================")
    print("STEP 7: VERIFYING OTHER DOCTOR QUEUE UNAFFECTED")
    print("==================================================")
    other_after = list(db.queue.find({"doctor_id": other_doc_id}).sort("position", 1))
    assert len(other_before) == len(other_after), "Other doctor queue length changed!"
    for b_item, a_item in zip(other_before, other_after):
        assert b_item.get("queue_id") == a_item.get("queue_id")
        assert b_item.get("position") == a_item.get("position")
        assert b_item.get("predicted_wait_time") == a_item.get("predicted_wait_time")
        assert b_item.get("expected_consultation_time") == a_item.get("expected_consultation_time")
        print(f"  Doctor {other_doc_id} Token {a_item.get('queue_id')}: Position #{a_item.get('position')}, Wait {a_item.get('predicted_wait_time')}m - UNAFFECTED")
        
    print("\n==================================================")
    print("SUCCESS: ALL BACKEND LATE-ARRIVAL ASSERTIONS PASSED")
    print("==================================================")

if __name__ == "__main__":
    run_test()
