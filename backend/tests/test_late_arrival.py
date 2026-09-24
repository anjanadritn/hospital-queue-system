import pytest
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    HOSPITAL_TZ = timezone(timedelta(hours=5, minutes=30))

from services.queue_service import (
    join_queue,
    recalculate_queue_positions,
    evaluate_late_arrivals,
    mark_patient_arrived,
    get_patient_arrival_deadline,
    IN_MEMORY_QUEUE
)
from services.appointment_service import book_appointment
from services.otp_service import verify_arrival_otp
from database.mongodb import get_db

DOC_LATE_1 = "DOC_TEST_LATE1"
DOC_LATE_2 = "DOC_TEST_LATE2"

@pytest.fixture(autouse=True)
def clean_late_test_data():
    """Ensure clean test data for late arrival tests"""
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$in": [DOC_LATE_1, DOC_LATE_2]}})
        db.appointments.delete_many({"doctor_id": {"$in": [DOC_LATE_1, DOC_LATE_2]}})
        db.consultation_otps.delete_many({"doctor_id": {"$in": [DOC_LATE_1, DOC_LATE_2]}})
    except Exception:
        pass
    yield
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$in": [DOC_LATE_1, DOC_LATE_2]}})
        db.appointments.delete_many({"doctor_id": {"$in": [DOC_LATE_1, DOC_LATE_2]}})
        db.consultation_otps.delete_many({"doctor_id": {"$in": [DOC_LATE_1, DOC_LATE_2]}})
    except Exception:
        pass


def test_1_patient_arrives_within_2_minutes_stays_in_position():
    """
    1. Patient arrives within 2 minutes grace period -> stays in position.
    """
    db = get_db()
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    # Patient 1
    p1, err1 = join_queue({
        "patient_id": "P_LATE_1",
        "doctor_id": DOC_LATE_1,
        "department": "Cardiology",
        "consultation_date": today_str,
        "slot_id": "morning"
    })
    assert err1 is None
    assert p1["position"] == 1

    # Patient 2
    p2, err2 = join_queue({
        "patient_id": "P_LATE_2",
        "doctor_id": DOC_LATE_1,
        "department": "Cardiology",
        "consultation_date": today_str,
        "slot_id": "morning"
    })
    assert err2 is None
    assert p2["position"] == 2

    # Verify arrival OTP for Patient 1 within grace period
    otp1 = p1.get("arrival_otp", "123456")
    ok1, _, _ = verify_arrival_otp(p1["queue_id"], otp1, verified_by="Test Reception")
    if not ok1:
        mark_patient_arrived(p1["queue_id"])

    # Verify arrival OTP for Patient 2 within grace period
    otp2 = p2.get("arrival_otp", "123456")
    ok2, _, _ = verify_arrival_otp(p2["queue_id"], otp2, verified_by="Test Reception")
    if not ok2:
        mark_patient_arrived(p2["queue_id"])

    # Simulate evaluation occurring after the expected arrival time
    deadline = get_patient_arrival_deadline(p1)
    eval_time = (deadline or datetime.now(HOSPITAL_TZ)) + timedelta(minutes=5)
    reordered = evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=eval_time)

    assert len(reordered) == 0

    # Patient 1 must still be position 1, Patient 2 must still be position 2
    q1 = db.queue.find_one({"queue_id": p1["queue_id"]})
    q2 = db.queue.find_one({"queue_id": p2["queue_id"]})
    assert q1["position"] == 1
    assert q2["position"] == 2
    assert q1.get("late_arrival_reordered") is not True


def test_2_patient_exceeds_2_minutes_moves_to_end():
    """
    2. Patient exceeds 2 minutes grace period without arriving -> moves to end of queue.
    """
    db = get_db()
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    p1, _ = join_queue({"patient_id": "P_EXCEED_1", "doctor_id": DOC_LATE_1, "department": "General Medicine", "consultation_date": today_str, "slot_id": "morning"})
    p2, _ = join_queue({"patient_id": "P_EXCEED_2", "doctor_id": DOC_LATE_1, "department": "General Medicine", "consultation_date": today_str, "slot_id": "morning"})
    p3, _ = join_queue({"patient_id": "P_EXCEED_3", "doctor_id": DOC_LATE_1, "department": "General Medicine", "consultation_date": today_str, "slot_id": "morning"})

    assert p1["position"] == 1
    assert p2["position"] == 2
    assert p3["position"] == 3

    # Set expected arrival deadline for P1 in the past (5 minutes ago)
    now_ist = datetime.now(HOSPITAL_TZ)
    past_arrival = now_ist - timedelta(minutes=10)
    past_deadline = past_arrival + timedelta(minutes=2)

    db.queue.update_one(
        {"queue_id": p1["queue_id"]},
        {"$set": {
            "expected_arrival_iso": past_arrival.isoformat(),
            "arrival_deadline_iso": past_deadline.isoformat(),
            "travel_info.arrival_deadline_iso": past_deadline.isoformat()
        }}
    )

    # Patient 1 has NOT arrived. Run late arrival evaluation at current time (which is > deadline)
    reordered = evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=now_ist)
    assert len(reordered) == 1
    assert reordered[0]["queue_id"] == p1["queue_id"]

    # Verify positions: P2 should now be #1, P3 should now be #2, P1 should be #3 (END)
    q1 = db.queue.find_one({"queue_id": p1["queue_id"]})
    q2 = db.queue.find_one({"queue_id": p2["queue_id"]})
    q3 = db.queue.find_one({"queue_id": p3["queue_id"]})

    assert q2["position"] == 1
    assert q3["position"] == 2
    assert q1["position"] == 3
    assert q1.get("late_arrival_reordered") is True


def test_3_same_token_and_appointment_preserved():
    """
    3. Same token, appointment, and booking are preserved; not cancelled or deleted.
    """
    db = get_db()
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    b1, err1 = book_appointment({"patient_id": "P_PRESERVE_1", "doctor_id": DOC_LATE_1, "department": "ENT", "consultation_date": today_str, "slot_id": "morning"})
    assert err1 is None
    b2, err2 = book_appointment({"patient_id": "P_PRESERVE_2", "doctor_id": DOC_LATE_1, "department": "ENT", "consultation_date": today_str, "slot_id": "morning"})
    assert err2 is None

    token_before = b1["queue_id"]
    booking_before = b1["booking_id"]

    # Set overdue arrival deadline for Patient 1
    now_ist = datetime.now(HOSPITAL_TZ)
    past_deadline = now_ist - timedelta(minutes=5)
    db.queue.update_one({"queue_id": token_before}, {"$set": {"arrival_deadline_iso": past_deadline.isoformat()}})
    db.appointments.update_one({"booking_id": booking_before}, {"$set": {"arrival_deadline_iso": past_deadline.isoformat()}})

    # Evaluate
    evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=now_ist)

    # Verify queue entry still exists with EXACT same queue token
    q1 = db.queue.find_one({"queue_id": token_before})
    assert q1 is not None
    assert q1["queue_id"] == token_before
    assert q1["booking_id"] == booking_before
    assert q1["status"] in ["waiting", "ready"]
    assert q1["status"] != "cancelled"
    assert q1.get("late_arrival_reordered") is True

    # Verify appointment still exists with EXACT same booking_id
    appt = db.appointments.find_one({"booking_id": booking_before})
    assert appt is not None
    assert appt["queue_id"] == token_before
    assert appt["booking_id"] == booking_before
    assert appt["status"] != "cancelled"
    assert appt.get("late_arrival_reordered") is True


def test_4_queue_is_recalculated_after_moving():
    """
    4. Queue positions, RF wait times, expected consultation times, and departure times are recalculated.
    """
    db = get_db()
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    p1, _ = join_queue({"patient_id": "P_RECALC_1", "doctor_id": DOC_LATE_1, "department": "Cardiology", "consultation_date": today_str, "slot_id": "morning"})
    p2, _ = join_queue({"patient_id": "P_RECALC_2", "doctor_id": DOC_LATE_1, "department": "Cardiology", "consultation_date": today_str, "slot_id": "morning"})

    p2_initial_wait = p2.get("predicted_wait_time", 20)

    # Set P1 overdue
    now_ist = datetime.now(HOSPITAL_TZ)
    past_deadline = now_ist - timedelta(minutes=5)
    db.queue.update_one({"queue_id": p1["queue_id"]}, {"$set": {"arrival_deadline_iso": past_deadline.isoformat()}})

    evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=now_ist)

    q1 = db.queue.find_one({"queue_id": p1["queue_id"]})
    q2 = db.queue.find_one({"queue_id": p2["queue_id"]})

    # P2 is now #1: its wait time should be minimal (position 1 wait)
    assert q2["position"] == 1
    assert q2["predicted_wait_time"] <= p2_initial_wait

    # P1 is now #2: its wait time must be recalculated to include P2's predicted duration
    assert q1["position"] == 2
    assert q1["predicted_wait_time"] >= q2["predicted_wait_time"]
    assert q1["expected_consultation_time"] is not None
    assert q1["recommended_departure_time"] is not None
    assert q1.get("travel_info") is not None


def test_5_another_doctors_queue_is_unaffected():
    """
    5. Another doctor's queue is completely unaffected by late arrival in DOC_LATE_1.
    """
    db = get_db()
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    # Doctor 1 queue
    d1_p1, _ = join_queue({"patient_id": "P_D1_1", "doctor_id": DOC_LATE_1, "department": "Orthopedics", "consultation_date": today_str, "slot_id": "morning"})
    d1_p2, _ = join_queue({"patient_id": "P_D1_2", "doctor_id": DOC_LATE_1, "department": "Orthopedics", "consultation_date": today_str, "slot_id": "morning"})

    # Doctor 2 queue
    d2_p1, _ = join_queue({"patient_id": "P_D2_1", "doctor_id": DOC_LATE_2, "department": "Orthopedics", "consultation_date": today_str, "slot_id": "morning"})
    d2_p2, _ = join_queue({"patient_id": "P_D2_2", "doctor_id": DOC_LATE_2, "department": "Orthopedics", "consultation_date": today_str, "slot_id": "morning"})

    assert d2_p1["position"] == 1
    assert d2_p2["position"] == 2
    d2_p1_token = d2_p1["queue_id"]
    d2_p1_wait = d2_p1["predicted_wait_time"]

    # Make Doctor 1's patient 1 late
    now_ist = datetime.now(HOSPITAL_TZ)
    past_deadline = now_ist - timedelta(minutes=5)
    db.queue.update_one({"queue_id": d1_p1["queue_id"]}, {"$set": {"arrival_deadline_iso": past_deadline.isoformat()}})

    # Evaluate late arrivals for Doctor 1 only
    evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=now_ist)

    # Doctor 1: p1 moved to end
    q_d1_p1 = db.queue.find_one({"queue_id": d1_p1["queue_id"]})
    assert q_d1_p1["position"] == 2

    # Doctor 2: completely UNTOUCHED
    q_d2_p1 = db.queue.find_one({"queue_id": d2_p1_token})
    q_d2_p2 = db.queue.find_one({"queue_id": d2_p2["queue_id"]})

    assert q_d2_p1["position"] == 1
    assert q_d2_p2["position"] == 2
    assert q_d2_p1["predicted_wait_time"] == d2_p1_wait
    assert q_d2_p1.get("late_arrival_reordered") is not True
    assert q_d2_p2.get("late_arrival_reordered") is not True


def test_6_repeated_evaluation_does_not_move_same_patient_again():
    """
    6. If the patient is moved once, do not move them repeatedly on every evaluation (idempotent).
    """
    db = get_db()
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    p1, _ = join_queue({"patient_id": "P_IDEM_1", "doctor_id": DOC_LATE_1, "department": "Pediatrics", "consultation_date": today_str, "slot_id": "morning"})
    p2, _ = join_queue({"patient_id": "P_IDEM_2", "doctor_id": DOC_LATE_1, "department": "Pediatrics", "consultation_date": today_str, "slot_id": "morning"})
    p3, _ = join_queue({"patient_id": "P_IDEM_3", "doctor_id": DOC_LATE_1, "department": "Pediatrics", "consultation_date": today_str, "slot_id": "morning"})

    # P2 and P3 arrive on time
    mark_patient_arrived(p2["queue_id"])
    mark_patient_arrived(p3["queue_id"])

    # Make P1 overdue
    now_ist = datetime.now(HOSPITAL_TZ)
    past_deadline = now_ist - timedelta(minutes=5)
    db.queue.update_one({"queue_id": p1["queue_id"]}, {"$set": {"arrival_deadline_iso": past_deadline.isoformat()}})

    # First evaluation: moves P1 to end (order becomes: P2, P3, P1)
    reordered_1 = evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=now_ist)
    assert len(reordered_1) == 1
    assert reordered_1[0]["queue_id"] == p1["queue_id"]

    q1_first = db.queue.find_one({"queue_id": p1["queue_id"]})
    assert q1_first["position"] == 3
    moved_at_first = q1_first.get("late_arrival_moved_at")

    # Second evaluation 5 minutes later
    later_time = now_ist + timedelta(minutes=5)
    reordered_2 = evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=later_time)
    assert len(reordered_2) == 0  # No one reordered!

    # Third evaluation 15 minutes later
    even_later_time = now_ist + timedelta(minutes=15)
    reordered_3 = evaluate_late_arrivals(doctor_id=DOC_LATE_1, now_dt=even_later_time)
    assert len(reordered_3) == 0  # No one reordered!

    # Verify positions have not shifted again
    q1_final = db.queue.find_one({"queue_id": p1["queue_id"]})
    q2_final = db.queue.find_one({"queue_id": p2["queue_id"]})
    q3_final = db.queue.find_one({"queue_id": p3["queue_id"]})

    assert q2_final["position"] == 1
    assert q3_final["position"] == 2
    assert q1_final["position"] == 3
    assert q1_final.get("late_arrival_moved_at") == moved_at_first
