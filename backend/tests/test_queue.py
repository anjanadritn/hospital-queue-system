import pytest
from datetime import datetime, timezone
from services.queue_service import (
    join_queue,
    get_queue_status,
    complete_consultation,
    skip_patient_service,
    escalate_emergency,
    recalculate_queue_positions,
    update_queue_status,
    IN_MEMORY_QUEUE,
)
from database.mongodb import get_db

@pytest.fixture(autouse=True)
def clean_test_queues():
    """Ensure test queues are clean in both MongoDB and in-memory fallback"""
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$regex": "^TEST_DOC_"}})
        db.appointments.delete_many({"doctor_id": {"$regex": "^TEST_DOC_"}})
    except Exception:
        pass
    yield
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$regex": "^TEST_DOC_"}})
        db.appointments.delete_many({"doctor_id": {"$regex": "^TEST_DOC_"}})
    except Exception:
        pass

def test_queue_wait_time_based_on_patients_ahead():
    """
    Verify that wait time for a patient is strictly determined by
    the sum of Random Forest predicted durations of the actual patients ahead.
    """
    doc_id = "TEST_DOC_WAIT"
    # Patient 1 joins
    p1, err1 = join_queue({
        "patient_id": "PAT_001",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "normal",
        "symptoms": ["Chest discomfort"]
    })
    assert err1 is None
    assert p1["position"] == 1
    # Position 1 patient with doctor ready has base wait of 5 mins
    assert p1["predicted_wait_time"] == 5

    # Patient 2 joins
    p2, err2 = join_queue({
        "patient_id": "PAT_002",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "normal",
        "symptoms": ["Palpitations"]
    })
    assert err2 is None
    assert p2["position"] == 2
    # Patient 2's wait time must equal Patient 1's predicted duration
    assert p2["predicted_wait_time"] == p1["predicted_duration"]

    # Patient 3 joins
    p3, err3 = join_queue({
        "patient_id": "PAT_003",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "normal",
        "symptoms": ["Dizziness"]
    })
    assert err3 is None
    assert p3["position"] == 3
    # Patient 3's wait time must equal Patient 1's duration + Patient 2's duration
    expected_p3_wait = p1["predicted_duration"] + p2["predicted_duration"]
    assert p3["predicted_wait_time"] == expected_p3_wait

def test_complete_patient_recalculates_remaining_patients():
    """
    When a patient is completed, all remaining active patients must automatically
    advance in position and have their predicted wait times recalculated downward.
    """
    doc_id = "TEST_DOC_COMP"
    p1, _ = join_queue({"patient_id": "PAT_A", "doctor_id": doc_id, "department": "General Medicine", "priority": "normal"})
    p2, _ = join_queue({"patient_id": "PAT_B", "doctor_id": doc_id, "department": "General Medicine", "priority": "normal"})
    p3, _ = join_queue({"patient_id": "PAT_C", "doctor_id": doc_id, "department": "General Medicine", "priority": "normal"})

    assert p2["position"] == 2
    assert p2["predicted_wait_time"] == p1["predicted_duration"]
    assert p3["position"] == 3
    assert p3["predicted_wait_time"] == p1["predicted_duration"] + p2["predicted_duration"]

    # Complete Patient A
    comp_res, comp_err = complete_consultation(booking_id=p1["queue_id"], actual_duration_mins=12)
    assert comp_err is None
    assert comp_res["status"] == "completed"

    # Verify Patient B and Patient C have automatically updated
    status_b, _ = get_queue_status(p2["queue_id"])
    status_c, _ = get_queue_status(p3["queue_id"])

    # Patient B is now #1, wait time drops to 5 mins
    assert status_b["position"] == 1
    assert status_b["predicted_wait_time"] == 5

    # Patient C is now #2, wait time drops to Patient B's predicted duration
    assert status_c["position"] == 2
    assert status_c["predicted_wait_time"] == status_b["predicted_duration"]

def test_skip_patient_recalculates_and_moves_to_end():
    """
    When a patient is skipped, they are marked as 'missed' and moved to the
    end of the active queue. All remaining active patients advance, and wait times
    are recalculated for everyone.
    """
    doc_id = "TEST_DOC_SKIP"
    p1, _ = join_queue({"patient_id": "PAT_X", "doctor_id": doc_id, "department": "Orthopedics", "priority": "normal"})
    p2, _ = join_queue({"patient_id": "PAT_Y", "doctor_id": doc_id, "department": "Orthopedics", "priority": "normal"})
    p3, _ = join_queue({"patient_id": "PAT_Z", "doctor_id": doc_id, "department": "Orthopedics", "priority": "normal"})

    # Skip Patient X (who was #1)
    skip_res, skip_err = skip_patient_service(p1["queue_id"])
    assert skip_err is None
    assert skip_res["status"] == "missed"

    status_x, _ = get_queue_status(p1["queue_id"])
    status_y, _ = get_queue_status(p2["queue_id"])
    status_z, _ = get_queue_status(p3["queue_id"])

    # Patient Y advances to position 1, wait time drops to 5 mins
    assert status_y["position"] == 1
    assert status_y["predicted_wait_time"] == 5

    # Patient Z advances to position 2, wait time drops to Patient Y's duration
    assert status_z["position"] == 2
    assert status_z["predicted_wait_time"] == status_y["predicted_duration"]

    # Skipped Patient X is moved to the end (position 3)
    assert status_x["position"] == 3
    # Patient X now waits behind both Y and Z
    assert status_x["predicted_wait_time"] == status_y["predicted_duration"] + status_z["predicted_duration"]

def test_emergency_priority_maintained():
    """
    Emergency patients jump to top priority (position 1) ahead of normal patients.
    Wait times for normal patients behind the emergency patient automatically
    include the emergency patient's predicted consultation duration.
    """
    doc_id = "TEST_DOC_EMERG"
    p1, _ = join_queue({"patient_id": "PAT_NORM1", "doctor_id": doc_id, "department": "Cardiology", "priority": "normal"})
    p2, _ = join_queue({"patient_id": "PAT_NORM2", "doctor_id": doc_id, "department": "Cardiology", "priority": "normal"})

    # Emergency patient joins
    p_em, err_em = join_queue({
        "patient_id": "PAT_EMERGENCY",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "emergency",
        "symptoms": ["Severe chest pain", "Collapse"]
    })
    assert err_em is None

    status_em, _ = get_queue_status(p_em["queue_id"])
    status_n1, _ = get_queue_status(p1["queue_id"])
    status_n2, _ = get_queue_status(p2["queue_id"])

    # Emergency patient is promoted to position 1
    assert status_em["position"] == 1
    assert status_em["priority"] == "emergency"
    assert status_em["predicted_wait_time"] <= 5

    # Normal patient 1 is pushed to position 2, waiting behind the emergency patient
    assert status_n1["position"] == 2
    assert status_n1["predicted_wait_time"] == status_em["predicted_duration"]

    # Normal patient 2 is pushed to position 3, waiting behind both emergency and normal 1
    assert status_n2["position"] == 3
    assert status_n2["predicted_wait_time"] == status_em["predicted_duration"] + status_n1["predicted_duration"]


def test_position_one_zero_ahead_wait_time_vs_consultation_duration():
    """
    Regression test:
    For a patient at position #1 with AHEAD IN LINE = 0:
    1. predicted_duration (Random Forest prediction for THIS patient's visit) is separated
       from predicted_wait_time (time until THIS patient's consultation STARTS).
    2. When no doctor is currently consulting another patient, queue wait should be approximately 0
       (or the existing small service-start buffer of 5 mins), NOT the patient's own consultation duration.
    3. When another patient is currently in consultation, queue wait must represent the remaining
       time of that current consultation.
    """
    doc_id = "TEST_DOC_POS1_REGRESSION"

    # 1. Patient joins queue with zero patients ahead
    p1, err1 = join_queue({
        "patient_id": "PAT_POS1_001",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "normal",
        "symptoms": ["Chest pain", "Shortness of breath"]
    })
    assert err1 is None
    assert p1["position"] == 1

    status_p1, _ = get_queue_status(p1["queue_id"])
    assert status_p1["position"] == 1
    # Ahead in line must be 0
    ahead_in_line = max(0, status_p1["position"] - 1)
    assert ahead_in_line == 0

    # Predicted consultation duration is from Random Forest for THIS patient's visit (e.g. >= 10 mins)
    predicted_consultation_duration = status_p1["predicted_duration"]
    assert predicted_consultation_duration >= 10

    # Estimated queue wait must be the small service-start buffer (5m), NOT the patient's own duration
    assert status_p1["predicted_wait_time"] == 5
    assert status_p1["predicted_wait_time"] != predicted_consultation_duration

    # 2. Now introduce a patient currently in consultation with this doctor
    # Patient 0 joins and starts consultation
    p0, err0 = join_queue({
        "patient_id": "PAT_POS1_CURRENT",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "priority": "normal",
        "symptoms": ["Hypertension"]
    })
    assert err0 is None

    # Move p0 into consultation
    upd_res, upd_err = update_queue_status(p0["queue_id"], "in_consultation")
    assert upd_err is None

    # Check p1 status now that p0 is in consultation
    status_p1_after, _ = get_queue_status(p1["queue_id"])
    assert status_p1_after["position"] == 1

    # Queue wait must represent the remaining time of that active consultation
    expected_remaining = max(3, int(p0["predicted_duration"] * 0.5))
    assert status_p1_after["predicted_wait_time"] == expected_remaining
    # Must still NOT equal p1's own consultation duration
    assert status_p1_after["predicted_duration"] == predicted_consultation_duration
    assert status_p1_after["predicted_wait_time"] != status_p1_after["predicted_duration"]

def test_sequential_token_generation_per_queue():
    """
    Regression Test:
    Ensures that for a new queue, tokens are generated consistently and sequentially starting from 001.
    Verifies that doctor queues are isolated and another doctor's bookings do NOT create gaps
    (e.g., Doctor A getting 001, 002, 003, instead of skipping to 006 due to Doctor B's bookings).
    """
    db = get_db()
    doc_a = "TEST_DOC_SEQ_A"
    doc_b = "TEST_DOC_SEQ_B"
    try:
        db.queue.delete_many({"doctor_id": {"$in": [doc_a, doc_b]}})

        # 1. Doctor A starts new queue: Patient 1 & 2 join
        p_a1, err_a1 = join_queue({
            "patient_id": "PAT_SEQ_A1",
            "doctor_id": doc_a,
            "department": "Cardiology",
            "priority": "normal",
            "symptoms": ["General Checkup"]
        })
        assert err_a1 is None
        assert p_a1["queue_id"] == f"{doc_a}-Q001"

        p_a2, err_a2 = join_queue({
            "patient_id": "PAT_SEQ_A2",
            "doctor_id": doc_a,
            "department": "Cardiology",
            "priority": "normal",
            "symptoms": ["Checkup"]
        })
        assert err_a2 is None
        assert p_a2["queue_id"] == f"{doc_a}-Q002"

        # 2. Doctor B starts new queue: Patient 1 & 2 join
        # New queue must start from 001 consistently, not inheriting Doctor A's count!
        p_b1, err_b1 = join_queue({
            "patient_id": "PAT_SEQ_B1",
            "doctor_id": doc_b,
            "department": "General Medicine",
            "priority": "normal",
            "symptoms": ["Fever"]
        })
        assert err_b1 is None
        assert p_b1["queue_id"] == f"{doc_b}-Q001"

        p_b2, err_b2 = join_queue({
            "patient_id": "PAT_SEQ_B2",
            "doctor_id": doc_b,
            "department": "General Medicine",
            "priority": "normal",
            "symptoms": ["Cough"]
        })
        assert err_b2 is None
        assert p_b2["queue_id"] == f"{doc_b}-Q002"

        # 3. Doctor A receives a 3rd patient:
        # Must be sequential (Q003), NOT skipping numbers (e.g. Q005 or Q006) due to Doctor B's bookings!
        p_a3, err_a3 = join_queue({
            "patient_id": "PAT_SEQ_A3",
            "doctor_id": doc_a,
            "department": "Cardiology",
            "priority": "normal",
            "symptoms": ["Chest Pain"]
        })
        assert err_a3 is None
        assert p_a3["queue_id"] == f"{doc_a}-Q003"

    finally:
        db.queue.delete_many({"doctor_id": {"$in": [doc_a, doc_b]}})
        db.appointments.delete_many({"doctor_id": {"$in": [doc_a, doc_b]}})

