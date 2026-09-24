import pytest
from services.queue_service import (
    join_queue,
    get_queue_status,
    complete_consultation,
    skip_patient_service,
    escalate_emergency,
    get_all_queues,
    get_public_live_queue,
    recalculate_queue_positions,
    IN_MEMORY_QUEUE
)
from database.mongodb import get_db

@pytest.fixture(autouse=True)
def clean_test_isolation_data():
    """Ensure test doctor queues are clean in MongoDB and in-memory"""
    test_docs = ["TEST_DOC_A", "TEST_DOC_B", "TEST_DOC_PLQ_A", "TEST_DOC_PLQ_B"]
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$in": test_docs}})
        db.appointments.delete_many({"doctor_id": {"$in": test_docs}})
    except Exception:
        pass
    yield
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.queue.delete_many({"doctor_id": {"$in": test_docs}})
        db.appointments.delete_many({"doctor_id": {"$in": test_docs}})
    except Exception:
        pass

def test_strictly_independent_queue_positions_per_doctor():
    """
    Patients booked with Doctor A must NEVER be counted in Doctor B's queue.
    Even in the same department, Doctor A and Doctor B must each start at position 1.
    """
    # Doctor A Patient 1
    pa1, err_a1 = join_queue({
        "patient_id": "P_ISO_A1",
        "doctor_id": "TEST_DOC_A",
        "department": "Cardiology",
        "priority": "normal",
        "slot_id": "morning"
    })
    assert err_a1 is None
    assert pa1["position"] == 1

    # Doctor A Patient 2
    pa2, err_a2 = join_queue({
        "patient_id": "P_ISO_A2",
        "doctor_id": "TEST_DOC_A",
        "department": "Cardiology",
        "priority": "normal",
        "slot_id": "morning"
    })
    assert err_a2 is None
    assert pa2["position"] == 2

    # Doctor B Patient 1 (in same department: Cardiology)
    pb1, err_b1 = join_queue({
        "patient_id": "P_ISO_B1",
        "doctor_id": "TEST_DOC_B",
        "department": "Cardiology",
        "priority": "normal",
        "slot_id": "morning"
    })
    assert err_b1 is None
    # Must be position 1 for Doctor B, NOT position 3!
    assert pb1["position"] == 1

    # Doctor B Patient 2
    pb2, err_b2 = join_queue({
        "patient_id": "P_ISO_B2",
        "doctor_id": "TEST_DOC_B",
        "department": "Cardiology",
        "priority": "normal",
        "slot_id": "morning"
    })
    assert err_b2 is None
    # Must be position 2 for Doctor B, NOT position 4!
    assert pb2["position"] == 2

    # Doctor B's patient wait time must depend ONLY on Doctor B's patients
    assert pb2["predicted_wait_time"] == pb1["predicted_duration"]

def test_complete_doctor_a_patient_does_not_affect_doctor_b():
    """
    Completing a patient for Doctor A must advance Doctor A's queue
    while Doctor B's queue remains completely unaffected.
    """
    pa1, _ = join_queue({"patient_id": "P_A1", "doctor_id": "TEST_DOC_A", "department": "Orthopedics", "slot_id": "morning"})
    pa2, _ = join_queue({"patient_id": "P_A2", "doctor_id": "TEST_DOC_A", "department": "Orthopedics", "slot_id": "morning"})
    pb1, _ = join_queue({"patient_id": "P_B1", "doctor_id": "TEST_DOC_B", "department": "Orthopedics", "slot_id": "morning"})
    pb2, _ = join_queue({"patient_id": "P_B2", "doctor_id": "TEST_DOC_B", "department": "Orthopedics", "slot_id": "morning"})

    # Complete Doctor A's patient 1
    comp_res, _ = complete_consultation(booking_id=pa1["queue_id"], actual_duration_mins=15)
    assert comp_res["status"] == "completed"

    # Doctor A Patient 2 must now be #1
    status_pa2, _ = get_queue_status(pa2["queue_id"])
    assert status_pa2["position"] == 1

    # Doctor B's queue must be untouched: PB1 still #1, PB2 still #2
    status_pb1, _ = get_queue_status(pb1["queue_id"])
    status_pb2, _ = get_queue_status(pb2["queue_id"])
    assert status_pb1["position"] == 1
    assert status_pb2["position"] == 2

def test_skip_patient_for_doctor_a_does_not_reorder_doctor_b():
    """
    Skipping a patient for Doctor A moves them to the end of Doctor A's queue,
    without touching Doctor B's queue positions or times.
    """
    pa1, _ = join_queue({"patient_id": "P_SK_A1", "doctor_id": "TEST_DOC_A", "department": "General Medicine", "slot_id": "evening"})
    pa2, _ = join_queue({"patient_id": "P_SK_A2", "doctor_id": "TEST_DOC_A", "department": "General Medicine", "slot_id": "evening"})
    pb1, _ = join_queue({"patient_id": "P_SK_B1", "doctor_id": "TEST_DOC_B", "department": "General Medicine", "slot_id": "evening"})

    # Skip Doctor A patient 1
    skip_res, _ = skip_patient_service(pa1["queue_id"])
    assert skip_res["status"] == "missed"

    # Doctor A patient 2 is now #1
    status_pa2, _ = get_queue_status(pa2["queue_id"])
    assert status_pa2["position"] == 1

    # Doctor B patient 1 remains #1 with 0 change
    status_pb1, _ = get_queue_status(pb1["queue_id"])
    assert status_pb1["position"] == 1

def test_doctor_isolation_in_all_queues_and_public_board():
    """
    Verify get_all_queues with doctor_id filter and public live queue separation by doctor.
    """
    join_queue({"patient_id": "P_API_A", "doctor_id": "TEST_DOC_A", "department": "Cardiology", "slot_id": "morning"})
    join_queue({"patient_id": "P_API_B", "doctor_id": "TEST_DOC_B", "department": "Cardiology", "slot_id": "morning"})

    # get_all_queues with doctor_id
    doc_a_queues, _ = get_all_queues(doctor_id="TEST_DOC_A")
    assert all(q.get("doctor_id") == "TEST_DOC_A" for q in doc_a_queues)
    assert not any(q.get("doctor_id") == "TEST_DOC_B" for q in doc_a_queues)

    # get_public_live_queue with doctor_id
    pub_doc_a = get_public_live_queue(doctor_id="TEST_DOC_A")
    assert pub_doc_a["total_active_queue"] == 1
    assert "TEST_DOC_A" in pub_doc_a["doctor_queues"]
    assert "TEST_DOC_B" not in pub_doc_a["doctor_queues"]

    # get_public_live_queue global board contains distinct doctor queue entries
    pub_global = get_public_live_queue()
    assert "TEST_DOC_A" in pub_global["doctor_queues"]
    assert "TEST_DOC_B" in pub_global["doctor_queues"]

def test_doctor_cannot_process_other_doctor_queue_via_api():
    """
    Doctor A can only see and process Doctor A's queue.
    Doctor A calling or skipping Doctor B's queue token via API must be rejected with 403 Forbidden.
    """
    from app import create_app
    from services.auth_service import generate_jwt_token

    app = create_app()
    app.config["TESTING"] = True

    doc_a_token = generate_jwt_token({
        "user_id": "U_DOC_TEST_A",
        "doctor_id": "TEST_DOC_A",
        "role": "doctor",
        "name": "Dr. A"
    })
    doc_b_token = generate_jwt_token({
        "user_id": "U_DOC_TEST_B",
        "doctor_id": "TEST_DOC_B",
        "role": "doctor",
        "name": "Dr. B"
    })

    # Create patient for Doctor B
    pb, _ = join_queue({
        "patient_id": "P_SEC_B",
        "doctor_id": "TEST_DOC_B",
        "department": "Cardiology",
        "slot_id": "morning"
    })
    q_b_id = pb["queue_id"]

    with app.test_client() as client:
        # Doctor A attempts to call Doctor B's patient -> 403
        res_call = client.post(
            f"/queue/{q_b_id}/call",
            headers={"Authorization": f"Bearer {doc_a_token}"}
        )
        assert res_call.status_code == 403
        assert "Unauthorized" in res_call.get_json()["error"]

        # Doctor A attempts to start Doctor B's patient -> 403
        res_start = client.post(
            f"/queue/{q_b_id}/start",
            headers={"Authorization": f"Bearer {doc_a_token}"}
        )
        assert res_start.status_code == 403

        # Doctor A attempts to skip Doctor B's patient -> 403
        res_skip = client.post(
            f"/queue/{q_b_id}/skip",
            headers={"Authorization": f"Bearer {doc_a_token}"}
        )
        assert res_skip.status_code == 403

        # Doctor A calls /queue/all -> Returns ONLY Doctor A's queue
        res_all_a = client.get(
            "/queue/all",
            headers={"Authorization": f"Bearer {doc_a_token}"}
        )
        assert res_all_a.status_code == 200
        items_a = res_all_a.get_json()
        assert not any(q.get("queue_id") == q_b_id for q in items_a)

        # Doctor B attempts to call Doctor B's patient -> Allowed (200)
        res_b_call = client.post(
            f"/queue/{q_b_id}/call",
            headers={"Authorization": f"Bearer {doc_b_token}"}
        )
        assert res_b_call.status_code == 200

def test_departure_engine_uses_current_doctor_queue_consultation_time():
    """
    Test that departure engine strictly uses the doctor-specific queue's current expected consultation time.
    Formula: recommended_departure = current_expected_consultation_time - live_travel_duration - safety_buffer.
    Displayed OPD turn window must match current expected consultation time.
    """
    from datetime import datetime
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("Asia/Kolkata")
    except Exception:
        from datetime import timezone, timedelta
        tz = timezone(timedelta(hours=5, minutes=30))

    # Join patient with Doctor A in evening slot
    p1, err1 = join_queue({
        "patient_id": "P_DEP_TEST",
        "doctor_id": "TEST_DOC_A",
        "department": "Cardiology",
        "slot_id": "evening",
        "consultation_date": datetime.now(tz).strftime("%Y-%m-%d"),
        "city": "Current GPS Location",
        "origin_latitude": 13.375966,
        "origin_longitude": 77.09848
    })
    assert err1 is None
    q_id = p1["queue_id"]

    # Retrieve status
    status, err_stat = get_queue_status(q_id)
    assert err_stat is None

    expected_time = status["expected_consultation_time"]
    expected_iso = status["expected_consultation_iso"]
    rec_dep_time = status["recommended_departure_time"]
    rec_dep_iso = status["recommended_departure_iso"]
    travel_info = status["travel_info"]

    assert expected_time is not None
    assert rec_dep_time is not None
    # Stale 01:33 PM / 01:22 PM must never be present
    assert expected_time != "01:33 PM"
    assert rec_dep_time != "01:22 PM"

    # Verify formula: recommended_departure = current_expected_consultation_time - travel_time - safety_buffer
    travel_min = travel_info.get("travel_time_min") or travel_info.get("travel_time_minutes")
    safety_min = travel_info.get("safety_buffer_min", 10)
    assert travel_min is not None

    exp_dt = datetime.fromisoformat(expected_iso)
    dep_dt = datetime.fromisoformat(rec_dep_iso)
    diff_minutes = round((exp_dt - dep_dt).total_seconds() / 60)
    assert diff_minutes == (travel_min + safety_min)

    # Verify departure alert string contains the current times
    assert expected_time in travel_info.get("departure_alert", "")
    assert rec_dep_time in travel_info.get("departure_alert", "")

def test_patient_live_queue_isolation_by_doctor_slot_and_date():
    """
    Verify that get_public_live_queue isolates strictly by:
    doctor_id + consultation_date + consultation_slot
    with zero PII and full queue_entries progression for the Patient Dashboard.
    """
    from app import create_app
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    date_target = "2026-09-19"
    date_other = "2026-09-20"

    # Join Doctor A, 2026-09-19, evening
    p1, _ = join_queue({
        "patient_id": "PAT_PLQ_1",
        "patient_name": "Private Patient One",
        "patient_phone": "9876543210",
        "doctor_id": "TEST_DOC_PLQ_A",
        "department": "Cardiology",
        "slot_id": "evening",
        "consultation_date": date_target,
        "symptoms": ["Private Chest Pain"]
    })

    # Join Doctor B, 2026-09-19, evening
    p2, _ = join_queue({
        "patient_id": "PAT_PLQ_2",
        "patient_name": "Private Patient Two",
        "doctor_id": "TEST_DOC_PLQ_B",
        "department": "Cardiology",
        "slot_id": "evening",
        "consultation_date": date_target
    })

    # Join Doctor A, 2026-09-20, evening
    p3, _ = join_queue({
        "patient_id": "PAT_PLQ_3",
        "patient_name": "Private Patient Three",
        "doctor_id": "TEST_DOC_PLQ_A",
        "department": "Cardiology",
        "slot_id": "evening",
        "consultation_date": date_other
    })

    # 1. Query strictly for Doctor A + date_target + evening
    pub = get_public_live_queue(
        doctor_id="TEST_DOC_PLQ_A",
        slot_id="evening",
        consultation_date=date_target
    )

    assert pub["total_active_queue"] == 1
    assert len(pub["queue_entries"]) == 1
    entry = pub["queue_entries"][0]
    assert entry["token"] == p1["queue_id"]
    assert entry["doctor_id"] == "TEST_DOC_PLQ_A"
    assert entry["position"] == 1

    # Zero PII verification
    assert "Private Patient One" not in str(pub)
    assert "9876543210" not in str(pub)
    assert "Private Chest Pain" not in str(pub)
    assert "PAT_PLQ_1" not in str(pub)

    # Doctor B's patient must never be in Doctor A's queue
    assert "TEST_DOC_PLQ_B" not in str(pub)
    assert p2["queue_id"] not in str(pub)

    # Other date patient must not be in this date's queue
    assert p3["queue_id"] not in str(pub)

    # 2. Test via public API route with date query parameter
    res = client.get(f"/queue/public?doctor_id=TEST_DOC_PLQ_A&slot_id=evening&date={date_target}")
    assert res.status_code == 200
    api_data = res.get_json()
    assert api_data["total_active_queue"] == 1
    assert api_data["queue_entries"][0]["token"] == p1["queue_id"]
    assert "Private Patient One" not in str(api_data)



