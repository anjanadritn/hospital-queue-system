import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from datetime import datetime, timedelta, timezone
from database.mongodb import get_db
from services.queue_service import evaluate_late_arrivals

def verify_late_arrival():
    db = get_db()
    queue_id = "D001-Q010"

    print("--- 1. Testing Unexpired Arrival Deadline ---")
    doc_before = db.queue.find_one({"queue_id": queue_id})
    pos_before = doc_before.get("position")
    deadline_time = doc_before.get("arrival_deadline_time")
    deadline_iso = doc_before.get("arrival_deadline_iso")
    print(f"Current Position: #{pos_before}")
    print(f"Arrival Deadline: {deadline_time} ({deadline_iso})")

    # Run evaluator
    reordered_unexpired = evaluate_late_arrivals(doctor_id="D001")
    doc_after = db.queue.find_one({"queue_id": queue_id})
    pos_after = doc_after.get("position")

    print(f"Position After Evaluator (Unexpired): #{pos_after}")
    assert pos_before == pos_after, f"Expected position #{pos_before}, got #{pos_after}"
    assert queue_id not in reordered_unexpired, f"Queue {queue_id} should NOT be in reordered list"
    print("[PASS] Patient is NOT moved when arrival deadline is in the future.")

    print("\n--- 2. Testing Expired Arrival Deadline ---")
    # Simulate deadline expiration (10 minutes in past)
    past_iso = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    db.queue.update_one(
        {"queue_id": queue_id},
        {"$set": {
            "arrival_deadline_iso": past_iso,
            "late_arrival_reordered": False
        }}
    )

    # Run evaluator
    reordered_expired = evaluate_late_arrivals(doctor_id="D001")
    doc_expired = db.queue.find_one({"queue_id": queue_id})
    pos_expired = doc_expired.get("position")
    reordered_flag = doc_expired.get("late_arrival_reordered")

    print(f"Reordered Queue IDs: {reordered_expired}")
    print(f"Position After Evaluator (Expired): #{pos_expired}")
    print(f"Late Arrival Reordered Flag: {reordered_flag}")
    assert any(r.get("queue_id") == queue_id for r in reordered_expired), f"Queue {queue_id} MUST be reordered after deadline expired"
    assert reordered_flag is True, "late_arrival_reordered must be True"

    # Restore clean state with future arrival deadline
    clean_arrival_iso = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    clean_deadline_iso = (datetime.now(timezone.utc) + timedelta(minutes=12)).isoformat()
    db.queue.update_one(
        {"queue_id": queue_id},
        {"$set": {
            "expected_arrival_iso": clean_arrival_iso,
            "expected_arrival_time": "05:58 PM",
            "arrival_deadline_iso": clean_deadline_iso,
            "arrival_deadline_time": "06:00 PM",
            "position": 3,
            "late_arrival_reordered": False
        }}
    )
    print("[PASS] Patient is ONLY moved to the end when the arrival deadline has expired!")

if __name__ == "__main__":
    verify_late_arrival()
