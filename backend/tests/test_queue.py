import pytest
from datetime import datetime, timezone
from services.queue_service import (
    join_queue,
    get_queue_status,
    complete_consultation,
    skip_patient_service,
    escalate_emergency,
    recalculate_queue_positions,
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
