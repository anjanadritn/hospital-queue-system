import pytest
from datetime import datetime, date, timedelta, timezone
from app import create_app
from services.auth_service import generate_jwt_token
from services.appointment_service import book_appointment
from services.queue_service import (
    join_queue,
    get_queue_status,
    complete_consultation,
    skip_patient_service,
    escalate_emergency,
    recalculate_queue_positions,
    get_public_live_queue,
    IN_MEMORY_QUEUE
)
from services.slot_service import (
    validate_and_normalize_slot,
    get_slot_counts,
    get_admin_slot_analytics
)
from services.leave_service import (
    confirm_leaving_now,
    evaluate_and_update_leave_reminders,
    LEAVE_STATUS_NOT_REQUIRED,
    LEAVE_STATUS_LEAVE_NOW_SENT,
    LEAVE_STATUS_REMINDER_SENT,
    LEAVE_STATUS_URGENT_SENT,
    LEAVE_STATUS_CONFIRMED,
    REMINDER_INTERVAL_MIN
)
from database.mongodb import get_db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def patient_token():
    user = {"user_id": "U_PAT_SLOT", "patient_id": "P_SLOT_001", "name": "Slot Patient", "phone": "9876543299", "role": "patient"}
    return generate_jwt_token(user)

@pytest.fixture
def admin_token():
    user = {"user_id": "U_ADM_001", "name": "Super Admin", "role": "admin"}
    return generate_jwt_token(user)

@pytest.fixture(autouse=True)
def clean_test_data():
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.appointments.delete_many({"doctor_id": {"$regex": "^TEST_SLOT_"}})
        db.queue.delete_many({"doctor_id": {"$regex": "^TEST_SLOT_"}})
    except Exception:
        pass
    yield
    IN_MEMORY_QUEUE.clear()
    try:
        db = get_db()
        db.appointments.delete_many({"doctor_id": {"$regex": "^TEST_SLOT_"}})
        db.queue.delete_many({"doctor_id": {"$regex": "^TEST_SLOT_"}})
    except Exception:
        pass

# 1. booking requires consultation slot
def test_1_booking_requires_consultation_slot(client, patient_token):
    payload = {
        "doctor_id": "TEST_SLOT_DOC1",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat(),
        "symptoms": ["Chest tightness"]
    }
    res = client.post("/appointments/book", json=payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 400
    assert "consultation_slot is required" in res.get_json()["error"]

# 2. valid morning slot accepted
def test_2_valid_morning_slot_accepted(client, patient_token):
    payload = {
        "doctor_id": "TEST_SLOT_DOC1",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat(),
        "consultation_slot": "morning",
        "symptoms": ["Chest tightness"]
    }
    res = client.post("/appointments/book", json=payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 201
    data = res.get_json()
    assert data["consultation_slot"]["slot_id"] == "morning"
    assert data["consultation_slot"]["display_time"] == "09:00 AM – 01:00 PM"
    assert data["slot_id"] == "morning"

# 3. valid evening slot accepted
def test_3_valid_evening_slot_accepted(client, patient_token):
    payload = {
        "doctor_id": "TEST_SLOT_DOC1",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat(),
        "consultation_slot": "evening",
        "symptoms": ["Palpitations"]
    }
    res = client.post("/appointments/book", json=payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 201
    data = res.get_json()
    assert data["consultation_slot"]["slot_id"] == "evening"
    assert data["consultation_slot"]["display_time"] == "02:00 PM – 09:00 PM"
    assert data["slot_id"] == "evening"

# 4. invalid slot rejected
def test_4_invalid_slot_rejected(client, patient_token):
    payload = {
        "doctor_id": "TEST_SLOT_DOC1",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat(),
        "consultation_slot": "midnight_night_shift",
        "symptoms": ["Headache"]
    }
    res = client.post("/appointments/book", json=payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 400
    assert "Invalid consultation slot" in res.get_json()["error"]

# 5. slot counts are calculated from database
def test_5_slot_counts_calculated_from_database(client, patient_token):
    today_str = date.today().isoformat()
    doc_id = "TEST_SLOT_COUNTS"

    # Book 2 morning appointments and 1 evening appointment
    for i in range(2):
        client.post("/appointments/book", json={
            "doctor_id": doc_id,
            "department": "General Medicine",
            "consultation_date": today_str,
            "consultation_slot": "morning",
            "symptoms": ["Fever"]
        }, headers={"Authorization": f"Bearer {patient_token}"})

    client.post("/appointments/book", json={
        "doctor_id": doc_id,
        "department": "General Medicine",
        "consultation_date": today_str,
        "consultation_slot": "evening",
        "symptoms": ["Cough"]
    }, headers={"Authorization": f"Bearer {patient_token}"})

    res = client.get(f"/appointments/slots?date={today_str}&doctor_id={doc_id}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["slots"]["morning"]["total_booked"] >= 2
    assert data["slots"]["evening"]["total_booked"] >= 1

# 6. queue is separated/handled correctly by slot
def test_6_queue_separated_by_slot():
    today_str = date.today().isoformat()
    doc_id = "TEST_SLOT_SEP"

    # Join morning slot queue
    m1, _ = join_queue({
        "patient_id": "PAT_M1",
        "doctor_id": doc_id,
        "department": "Orthopedics",
        "consultation_date": today_str,
        "consultation_slot": "morning"
    })
    m2, _ = join_queue({
        "patient_id": "PAT_M2",
        "doctor_id": doc_id,
        "department": "Orthopedics",
        "consultation_date": today_str,
        "consultation_slot": "morning"
    })

    # Join evening slot queue for same doctor
    e1, _ = join_queue({
        "patient_id": "PAT_E1",
        "doctor_id": doc_id,
        "department": "Orthopedics",
        "consultation_date": today_str,
        "consultation_slot": "evening"
    })

    # Morning queue positions: m1 is #1, m2 is #2
    status_m1, _ = get_queue_status(m1["queue_id"])
    status_m2, _ = get_queue_status(m2["queue_id"])
    assert status_m1["position"] == 1
    assert status_m2["position"] == 2

    # Evening queue position: e1 is #1 in the evening slot queue!
    status_e1, _ = get_queue_status(e1["queue_id"])
    assert status_e1["position"] == 1
    assert status_e1["slot_id"] == "evening"

# 7. consultation completion reorders queue
def test_7_consultation_completion_reorders_queue():
    doc_id = "TEST_SLOT_COMPL"
    p1, _ = join_queue({"patient_id": "P1", "doctor_id": doc_id, "department": "Cardiology", "consultation_slot": "morning"})
    p2, _ = join_queue({"patient_id": "P2", "doctor_id": doc_id, "department": "Cardiology", "consultation_slot": "morning"})
    p3, _ = join_queue({"patient_id": "P3", "doctor_id": doc_id, "department": "Cardiology", "consultation_slot": "morning"})

    # Complete P1
    comp_res, err = complete_consultation(booking_id=p1["queue_id"], actual_duration_mins=14)
    assert err is None
    assert comp_res["status"] == "completed"

    status_p2, _ = get_queue_status(p2["queue_id"])
    status_p3, _ = get_queue_status(p3["queue_id"])

    assert status_p2["position"] == 1
    assert status_p2["is_next"] == True
    assert status_p3["position"] == 2
    assert status_p3["is_next"] == False

# 8. skip reorders queue
def test_8_skip_reorders_queue():
    doc_id = "TEST_SLOT_SKIP"
    p1, _ = join_queue({"patient_id": "P1", "doctor_id": doc_id, "department": "ENT", "consultation_slot": "morning"})
    p2, _ = join_queue({"patient_id": "P2", "doctor_id": doc_id, "department": "ENT", "consultation_slot": "morning"})

    # Skip P1
    skip_res, err = skip_patient_service(p1["queue_id"])
    assert err is None
    assert skip_res["status"] == "missed"

    status_p1, _ = get_queue_status(p1["queue_id"])
    status_p2, _ = get_queue_status(p2["queue_id"])

    assert status_p2["position"] == 1
    assert status_p2["is_next"] == True
    assert status_p1["position"] == 2
    assert status_p1["status"] == "missed"

# 9. emergency reorders queue according to existing rules
def test_9_emergency_reorders_queue():
    doc_id = "TEST_SLOT_EMERG"
    p_norm, _ = join_queue({"patient_id": "PN", "doctor_id": doc_id, "department": "Cardiology", "priority": "normal", "consultation_slot": "morning"})
    p_em, _ = join_queue({"patient_id": "PE", "doctor_id": doc_id, "department": "Cardiology", "priority": "emergency", "consultation_slot": "morning"})

    status_em, _ = get_queue_status(p_em["queue_id"])
    status_norm, _ = get_queue_status(p_norm["queue_id"])

    assert status_em["position"] == 1
    assert status_em["is_next"] == True
    assert status_norm["position"] == 2
    assert status_norm["is_next"] == False

# 10. Random Forest prediction is recalculated after queue changes
def test_10_random_forest_prediction_recalculated():
    doc_id = "TEST_SLOT_RF"
    p1, _ = join_queue({"patient_id": "P1", "doctor_id": doc_id, "department": "General Medicine", "consultation_slot": "morning"})
    p2, _ = join_queue({"patient_id": "P2", "doctor_id": doc_id, "department": "General Medicine", "consultation_slot": "morning"})

    init_p2_wait = p2["predicted_wait_time"]
    assert init_p2_wait == p1["predicted_duration"]

    # Complete P1
    complete_consultation(p1["queue_id"], actual_duration_mins=10)

    # After recalculation, P2 is #1 and wait time drops to 5 min base
    status_p2, _ = get_queue_status(p2["queue_id"])
    assert status_p2["position"] == 1
    assert status_p2["predicted_wait_time"] == 5

# 11. expected consultation times are updated
def test_11_expected_consultation_times_updated():
    doc_id = "TEST_SLOT_EXP"
    p1, _ = join_queue({"patient_id": "P1", "doctor_id": doc_id, "department": "Cardiology", "consultation_slot": "morning"})
    p2, _ = join_queue({"patient_id": "P2", "doctor_id": doc_id, "department": "Cardiology", "consultation_slot": "morning"})

    status_p1, _ = get_queue_status(p1["queue_id"])
    status_p2, _ = get_queue_status(p2["queue_id"])

    assert status_p1.get("expected_consultation_time") is not None
    assert status_p2.get("expected_consultation_time") is not None
    assert status_p1.get("expected_consultation_iso") is not None

# 12. leave-now state is stored
def test_12_leave_now_state_stored():
    doc_id = "TEST_SLOT_LN"
    p1, _ = join_queue({
        "patient_id": "P1",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "city": "Batawadi",
        "consultation_slot": "morning"
    })

    custom_coords = [77.1147, 13.3558]
    res, err = confirm_leaving_now(p1["queue_id"], origin_coords=custom_coords)
    assert err is None
    assert res["leaving_now"] == True
    assert res["leaving_now_at"] is not None
    assert res["leave_reminder_status"] == "LEAVING_CONFIRMED"
    assert res["origin_latitude"] == custom_coords[1]
    assert res["origin_longitude"] == custom_coords[0]

# 13. duplicate leave-now clicks are handled safely
def test_13_duplicate_leave_now_handled_safely():
    doc_id = "TEST_SLOT_DUP"
    p1, _ = join_queue({"patient_id": "P1", "doctor_id": doc_id, "department": "Cardiology", "consultation_slot": "morning"})

    res1, err1 = confirm_leaving_now(p1["queue_id"])
    assert err1 is None
    first_time = res1["leaving_now_at"]

    # Click second time
    res2, err2 = confirm_leaving_now(p1["queue_id"])
    assert err2 is None
    assert res2["leaving_now"] == True
    assert res2["leaving_now_at"] == first_time  # Idempotent preserved

# 14. reminder state prevents duplicate notifications
def test_14_reminder_state_prevents_duplicate_notifications():
    now = datetime.now(timezone.utc)
    entry = {
        "queue_id": "Q_TEST_REM",
        "patient_id": "P_TEST_REM",
        "status": "waiting",
        "position": 2,
        "travel_time_min": 15,
        "expected_consultation_iso": (now + timedelta(minutes=18)).isoformat(),  # Dep time = now - 2 min (time to leave)
        "leave_reminder_status": LEAVE_STATUS_LEAVE_NOW_SENT,
        "leave_reminder_sent_at": now.isoformat()  # Just sent 0 minutes ago
    }

    # Evaluate immediately again: should NOT send another alert because interval has not elapsed
    eval_res = evaluate_and_update_leave_reminders(entry)
    assert eval_res["action"] == "none"
    assert eval_res["state"] == LEAVE_STATUS_LEAVE_NOW_SENT

# 15. urgent reminder is generated after configured interval
def test_15_urgent_reminder_generated_after_configured_interval():
    now = datetime.now(timezone.utc)
    # 6 minutes have passed since reminder sent
    six_mins_ago = (now - timedelta(minutes=6)).isoformat()
    entry = {
        "queue_id": "Q_TEST_URGENT",
        "patient_id": "P_TEST_URG",
        "status": "waiting",
        "position": 1,
        "travel_time_min": 15,
        "expected_consultation_iso": (now + timedelta(minutes=15)).isoformat(),
        "leave_reminder_status": LEAVE_STATUS_REMINDER_SENT,
        "leave_reminder_sent_at": six_mins_ago
    }

    eval_res = evaluate_and_update_leave_reminders(entry)
    assert eval_res["action"] == "sent"
    assert eval_res["state"] == LEAVE_STATUS_URGENT_SENT

# 16. notifications stop after leaving/arrival/completion/missed/cancelled
def test_16_notifications_stop_after_terminal_states():
    now = datetime.now(timezone.utc)
    base_entry = {
        "queue_id": "Q_TEST_TERM",
        "patient_id": "P_TEST_TERM",
        "travel_time_min": 15,
        "expected_consultation_iso": (now + timedelta(minutes=15)).isoformat(),
        "leave_reminder_sent_at": (now - timedelta(minutes=20)).isoformat()
    }

    for terminal_status in ["completed", "missed", "cancelled", "no_show"]:
        entry = {**base_entry, "status": terminal_status}
        res = evaluate_and_update_leave_reminders(entry)
        assert res["action"] == "none"

    # Stop after leaving confirmed
    entry_leaving = {**base_entry, "status": "waiting", "leaving_now": True, "leave_reminder_status": LEAVE_STATUS_CONFIRMED}
    res_leaving = evaluate_and_update_leave_reminders(entry_leaving)
    assert res_leaving["action"] == "none"

    # Stop after arrived at hospital
    entry_arrived = {**base_entry, "status": "arrived", "arrived_at_hospital": True}
    res_arrived = evaluate_and_update_leave_reminders(entry_arrived)
    assert res_arrived["action"] == "none"

# 17. public queue response contains no PII
def test_17_public_queue_response_contains_no_pii(client):
    doc_id = "TEST_SLOT_PUB"
    # Join with sensitive clinical and demographic data
    join_queue({
        "patient_id": "SECRET_PAT_999",
        "patient_name": "Confidential John Doe",
        "phone": "9998887776",
        "email": "private.patient@hospital.org",
        "age": 52,
        "gender": "Male",
        "patient_address": "Private Secret House 123",
        "symptoms": ["Severe chest pain", "Substernal pressure radiating to left arm"],
        "custom_symptoms": "Very sensitive medical condition details",
        "doctor_id": doc_id,
        "department": "Cardiology",
        "consultation_slot": "morning"
    })

    res = client.get("/queue/public")
    assert res.status_code == 200
    data = res.get_json()

    raw_response_text = res.get_data(as_text=True)

    # CRITICAL ZERO-PII CHECKS:
    assert "Confidential John Doe" not in raw_response_text
    assert "9998887776" not in raw_response_text
    assert "private.patient@hospital.org" not in raw_response_text
    assert "Private Secret House 123" not in raw_response_text
    assert "Substernal pressure" not in raw_response_text
    assert "Very sensitive medical condition details" not in raw_response_text
    assert "SECRET_PAT_999" not in raw_response_text

    # Safe public indicators check:
    assert "currently_consulting" in data
    assert "next_patient" in data
    assert "upcoming_patients" in data
    assert "total_active_queue" in data

# 18. admin booking details operational roster
def test_18_admin_booking_details_operational_roster(client, admin_token):
    """
    Verify GET /admin/appointments returns operational booking details:
    - Token number
    - Doctor name
    - Department
    - Consultation date
    - Consultation slot
    - Exact booked date/time
    - Current queue position
    - Current status
    Without exposing patient phone numbers, emails, addresses, or symptoms.
    """
    # Book test appointment with sensitive details
    book_res, err = book_appointment({
        "patient_id": "PAT_ADM_SECRET",
        "patient_name": "Confidential Admin Patient",
        "patient_phone": "9123456780",
        "email": "confidential.patient@testclinic.com",
        "doctor_id": "TEST_DOC_ADM_1",
        "department": "Cardiology",
        "slot_id": "evening",
        "consultation_date": date.today().isoformat(),
        "symptoms": ["Secret Severe Palpitations"],
        "custom_symptoms": "Confidential acute shortness of breath",
        "patient_address": "Secret Lane 404, Tumakuru"
    })
    assert err is None
    assert book_res is not None
    q_id = book_res.get("queue_id")

    # Fetch admin appointments
    res = client.get(
        "/admin/appointments",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    bookings = res.get_json()
    assert isinstance(bookings, list)
    assert len(bookings) > 0

    # Locate the created booking
    target_booking = next((b for b in bookings if b.get("queue_id") == q_id or b.get("token_number") == q_id), None)
    assert target_booking is not None

    # Verify all 8 required operational fields
    assert target_booking["token_number"] == q_id
    assert target_booking["doctor_name"] is not None
    assert target_booking["department"] == "Cardiology"
    assert target_booking["consultation_date"] == date.today().isoformat()
    assert "consultation_slot" in target_booking
    assert target_booking["consultation_slot"]["slot_id"] == "evening"
    assert "display_time" in target_booking["consultation_slot"]
    assert "created_at" in target_booking
    assert target_booking["current_queue_position"] is not None
    assert target_booking["current_status"] is not None

    # Verify that unnecessary personal and clinical data are NOT exposed
    raw_json = res.get_data(as_text=True)
    assert "9123456780" not in raw_json
    assert "confidential.patient@testclinic.com" not in raw_json
    assert "Secret Lane 404" not in raw_json
    assert "Secret Severe Palpitations" not in raw_json
    assert "Confidential acute shortness of breath" not in raw_json

