import pytest
from datetime import datetime, timedelta, timezone
from services.queue_service import (
    join_queue,
    get_queue_status,
    recalculate_queue_positions,
    IN_MEMORY_QUEUE,
    HOSPITAL_TZ
)
from services.otp_service import verify_arrival_otp
from database.mongodb import get_db

@pytest.fixture(autouse=True)
def clean_test_queues():
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$regex": "^TEST_ARRIVE_DOC"}})
        db.appointments.delete_many({"doctor_id": {"$regex": "^TEST_ARRIVE_DOC"}})
        db.consultation_otps.delete_many({"doctor_id": {"$regex": "^TEST_ARRIVE_DOC"}})
    except Exception:
        pass
    yield
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$regex": "^TEST_ARRIVE_DOC"}})
        db.appointments.delete_many({"doctor_id": {"$regex": "^TEST_ARRIVE_DOC"}})
        db.consultation_otps.delete_many({"doctor_id": {"$regex": "^TEST_ARRIVE_DOC"}})
    except Exception:
        pass

def test_arrival_verification_recalculates_queue_and_removes_travel():
    """
    Test Arrival Verification Requirements:
    1. Patient treated as physically present at hospital (arrived_at_hospital=True, verified_by_admin=True)
    2. Old pre-arrival consultation time replaced by fresh consultation time
    3. Position and wait time recalculated using existing queue + Random Forest
    4. Fresh expected consultation time equals current time + predicted wait
    5. Travel-focused info removed (GPS route, distance, Leave Now, departure time, travel duration)
    6. 30-minute target status indicator computed correctly
    """
    doc_id = "TEST_ARRIVE_DOC_1"
    today_str = datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")

    # Patient 1 joins (ahead in line)
    p1, err1 = join_queue({
        "patient_id": "PAT_ARR_001",
        "doctor_id": doc_id,
        "department": "General Medicine",
        "priority": "normal",
        "symptoms": ["Mild fever"]
    })
    assert err1 is None
    assert p1["position"] == 1

    # Patient 2 joins with travel metrics
    p2, err2 = join_queue({
        "patient_id": "PAT_ARR_002",
        "doctor_id": doc_id,
        "department": "General Medicine",
        "priority": "normal",
        "symptoms": ["Persistent cough"],
        "city": "Kyatsandra",
        "origin_latitude": 13.3100,
        "origin_longitude": 77.1500
    })
    assert err2 is None
    assert p2["position"] == 2

    # Verify Patient 2 BEFORE arrival has travel info
    p2_initial, _ = get_queue_status(p2["queue_id"])
    assert p2_initial.get("arrived_at_hospital") is not True
    assert p2_initial.get("verified_by_admin") is not True
    assert p2_initial.get("recommended_departure_time") is not None
    assert p2_initial.get("expected_arrival_time") is not None
    initial_consult_time = p2_initial.get("expected_consultation_time")
    assert initial_consult_time is not None

    # Retrieve arrival OTP for Patient 2
    db = get_db()
    otp_doc = db.consultation_otps.find_one({"$or": [{"queue_id": p2["queue_id"]}, {"booking_id": p2.get("booking_id")}]})
    arrival_otp = otp_doc.get("otp") if otp_doc else p2_initial.get("arrival_otp") or "123456"

    # Simulate reception admin verifying arrival OTP
    success, err, res = verify_arrival_otp(p2["queue_id"], arrival_otp, verified_by="Reception Desk 1")
    assert success is True, f"Arrival OTP verification failed: {err}"
    assert res.get("verified") is True

    # Check updated status from get_queue_status
    p2_after, _ = get_queue_status(p2["queue_id"])
    assert p2_after["arrived_at_hospital"] is True
    assert p2_after["verified_by_admin"] is True
    assert p2_after["status"] == "arrived"

    # 1. Travel info removed
    assert p2_after.get("recommended_departure_time") is None
    assert p2_after.get("expected_arrival_time") is None
    assert p2_after.get("arrival_deadline_time") is None
    assert p2_after.get("leaving_now") is False

    travel_info = p2_after.get("travel_info", {})
    assert travel_info.get("is_arrived") is True
    assert travel_info.get("arrival_verified") is True
    assert "route_geometry" not in travel_info or travel_info.get("route_geometry") is None
    assert "distance_km" not in travel_info or travel_info.get("distance_km") is None

    # 2. Recalculated position & wait time
    assert p2_after["position"] == 2
    expected_wait = p1["predicted_duration"]
    assert p2_after["predicted_wait_time"] == expected_wait

    # 3. Fresh expected consultation time based on current time + predicted wait
    now_h = datetime.now(HOSPITAL_TZ)
    fresh_expected_iso = p2_after.get("expected_consultation_iso")
    assert fresh_expected_iso is not None
    fresh_dt = datetime.fromisoformat(fresh_expected_iso.replace("Z", "+00:00")).astimezone(HOSPITAL_TZ)
    diff_seconds = abs((fresh_dt - (now_h + timedelta(minutes=expected_wait))).total_seconds())
    assert diff_seconds < 120, f"Expected fresh consultation time to be within 2 minutes of now + {expected_wait}m, got diff of {diff_seconds}s"

    # 4. 30-minute target status
    if expected_wait <= 30:
        assert p2_after.get("target_30_status") == "on_track"
        assert p2_after.get("target_30_label") == "On track"
    else:
        assert p2_after.get("target_30_status") == "exceeds_target"
        assert p2_after.get("target_30_label") == "Queue exceeds 30-minute target"

def test_30_minute_target_status_threshold():
    """
    Test 30-minute target:
    - predicted wait <= 30 min -> "on_track"
    - predicted wait > 30 min -> "exceeds_target"
    """
    doc_id = "TEST_ARRIVE_DOC_TARGET"

    # Add multiple patients to exceed 30 min
    patients = []
    for i in range(5):
        p, _ = join_queue({
            "patient_id": f"PAT_TARGET_{i}",
            "doctor_id": doc_id,
            "department": "Orthopedics",
            "priority": "normal",
            "symptoms": ["Severe fracture pain", "Joint swelling"]
        })
        patients.append(p)

    recalculate_queue_positions(doctor_id=doc_id)

    # Position 1 has wait <= 30 min
    p_first, _ = get_queue_status(patients[0]["queue_id"])
    assert p_first["predicted_wait_time"] <= 30
    assert p_first["target_30_status"] == "on_track"
    assert p_first["target_30_label"] == "On track"

    # Later patient has wait > 30 min
    p_last, _ = get_queue_status(patients[-1]["queue_id"])
    assert p_last["predicted_wait_time"] > 30
    assert p_last["target_30_status"] == "exceeds_target"
    assert p_last["target_30_label"] == "Queue exceeds 30-minute target"

def test_emergency_priority_remains_unchanged():
    """
    Emergency priority sorting must remain intact when arrivals are verified.
    """
    doc_id = "TEST_ARRIVE_DOC_EMERGENCY"

    # Normal patient 1
    p1, _ = join_queue({
        "patient_id": "PAT_NORM_1",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "normal",
        "symptoms": ["General checkup"]
    })

    # Emergency patient arrives
    p_em, _ = join_queue({
        "patient_id": "PAT_EMERGENCY",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "emergency",
        "symptoms": ["Chest pain emergency"]
    })

    recalculate_queue_positions(doctor_id=doc_id)

    p_em_status, _ = get_queue_status(p_em["queue_id"])
    assert p_em_status["position"] == 1
    assert p_em_status["priority"] == "emergency"
