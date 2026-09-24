import pytest
from datetime import date, timedelta
from app import create_app
from services.auth_service import generate_jwt_token
from database.mongodb import get_db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def patient_token():
    user = {"user_id": "U_PAT_P001", "patient_id": "P001", "name": "Patient 1", "phone": "9876543211", "role": "patient"}
    return generate_jwt_token(user)

@pytest.fixture
def other_patient_token():
    user = {"user_id": "U_PAT_P002", "patient_id": "P002", "name": "Patient 2", "phone": "9876543212", "role": "patient"}
    return generate_jwt_token(user)

@pytest.fixture
def admin_token():
    user = {"user_id": "U_ADM_001", "phone": "9999999999", "role": "admin", "name": "Admin User"}
    return generate_jwt_token(user)

def test_patient_can_cancel_booked_appointment(client, patient_token):
    """TEST 1 & 8 & 12: Patient can cancel own BOOKED appointment, metadata saved, notification created"""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    book_payload = {
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": tomorrow,
        "consultation_slot": "morning",
        "patient_name": "Test Patient",
        "priority": "normal",
        "symptoms": ["chest pain"]
    }
    b_res = client.post("/appointments/book", json=book_payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert b_res.status_code == 201
    booking_id = b_res.get_json()["booking_id"]

    # Cancel appointment
    c_res = client.post(
        f"/appointments/{booking_id}/cancel",
        json={"reason": "Schedule changed"},
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    assert c_res.status_code == 200
    c_data = c_res.get_json()
    assert c_data["status"] == "cancelled"
    assert c_data["cancelled_by"] == "patient"
    assert c_data["cancellation_reason"] == "Schedule changed"
    assert c_data["cancelled_at"] is not None

    # Verify preserved in DB
    db = get_db()
    apt_in_db = db.appointments.find_one({"booking_id": booking_id})
    assert apt_in_db is not None
    assert apt_in_db["status"] == "cancelled"
    assert apt_in_db["queue_position"] == "-"

    # Verify notification created
    notif = db.notifications.find_one({"booking_id": booking_id, "type": "APPOINTMENT_CANCELLED"})
    assert notif is not None
    assert "cancelled successfully" in notif["message"]

def test_patient_cannot_cancel_other_patient_appointment(client, patient_token, other_patient_token):
    """TEST 3: Patient cannot cancel another patient's appointment (403 Forbidden)"""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    book_payload = {
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": tomorrow,
        "consultation_slot": "morning",
        "patient_name": "Patient 1",
        "symptoms": ["palpitations"]
    }
    b_res = client.post("/appointments/book", json=book_payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert b_res.status_code == 201
    booking_id = b_res.get_json()["booking_id"]

    # Other patient attempts to cancel
    c_res = client.post(
        f"/appointments/{booking_id}/cancel",
        json={"reason": "Malicious attempt"},
        headers={"Authorization": f"Bearer {other_patient_token}"}
    )
    assert c_res.status_code == 403
    assert "Unauthorized" in c_res.get_json()["error"]

def test_cannot_cancel_nonexistent_appointment(client, patient_token):
    """TEST 4: Cannot cancel non-existent appointment (404 Not Found)"""
    c_res = client.post(
        "/appointments/B99999/cancel",
        json={"reason": "Does not exist"},
        headers={"Authorization": f"Bearer {patient_token}"}
    )
    assert c_res.status_code == 404
    assert "not found" in c_res.get_json()["error"].lower()

def test_cannot_cancel_already_cancelled_appointment(client, patient_token):
    """TEST 5: Cannot cancel an already cancelled appointment (409 Conflict)"""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    book_payload = {
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": tomorrow,
        "consultation_slot": "morning",
        "symptoms": ["chest pain"]
    }
    b_res = client.post("/appointments/book", json=book_payload, headers={"Authorization": f"Bearer {patient_token}"})
    booking_id = b_res.get_json()["booking_id"]

    # First cancel -> 200
    c1 = client.post(f"/appointments/{booking_id}/cancel", headers={"Authorization": f"Bearer {patient_token}"})
    assert c1.status_code == 200

    # Second cancel -> 409
    c2 = client.post(f"/appointments/{booking_id}/cancel", headers={"Authorization": f"Bearer {patient_token}"})
    assert c2.status_code == 409
    assert "already been cancelled" in c2.get_json()["error"]

def test_cannot_cancel_in_consultation_or_completed_appointment(client, patient_token):
    """TEST 6 & 7: Cannot cancel an in-consultation or completed appointment (409 Conflict)"""
    db = get_db()
    today_str = date.today().isoformat()

    # 1. In consultation
    book_payload = {
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "symptoms": ["chest pain"]
    }
    b1 = client.post("/appointments/book", json=book_payload, headers={"Authorization": f"Bearer {patient_token}"})
    bid1 = b1.get_json()["booking_id"]
    qid1 = b1.get_json().get("queue_id")

    # Mark as in_consultation
    db.appointments.update_one({"booking_id": bid1}, {"$set": {"status": "in_consultation"}})
    if qid1:
        db.queue.update_one({"queue_id": qid1}, {"$set": {"status": "in_consultation"}})

    c_in_consult = client.post(f"/appointments/{bid1}/cancel", headers={"Authorization": f"Bearer {patient_token}"})
    assert c_in_consult.status_code == 409
    assert "consultation has started" in c_in_consult.get_json()["error"]

    # 2. Completed
    b2 = client.post("/appointments/book", json=book_payload, headers={"Authorization": f"Bearer {patient_token}"})
    bid2 = b2.get_json()["booking_id"]
    qid2 = b2.get_json().get("queue_id")

    db.appointments.update_one({"booking_id": bid2}, {"$set": {"status": "completed"}})
    if qid2:
        db.queue.update_one({"queue_id": qid2}, {"$set": {"status": "completed"}})

    c_completed = client.post(f"/appointments/{bid2}/cancel", headers={"Authorization": f"Bearer {patient_token}"})
    assert c_completed.status_code == 409
    assert "consultation has started or is completed" in c_completed.get_json()["error"]

def test_cancellation_removes_from_queue_and_recalculates(client, patient_token, other_patient_token):
    """TEST 9, 10, 11: Queue integration & ML recalculation upon cancellation"""
    db = get_db()
    today_str = date.today().isoformat()

    # Book patient 1
    b1 = client.post("/appointments/book", json={
        "doctor_id": "D002",
        "department": "Dermatology",
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "symptoms": ["skin rash"]
    }, headers={"Authorization": f"Bearer {patient_token}"})
    assert b1.status_code == 201
    q1 = b1.get_json()["queue_id"]
    b1_id = b1.get_json()["booking_id"]

    # Book patient 2
    b2 = client.post("/appointments/book", json={
        "doctor_id": "D002",
        "department": "Dermatology",
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "symptoms": ["itching"]
    }, headers={"Authorization": f"Bearer {other_patient_token}"})
    assert b2.status_code == 201
    q2 = b2.get_json()["queue_id"]
    b2_id = b2.get_json()["booking_id"]

    # Patient 1 cancels
    c_res = client.post(f"/appointments/{b1_id}/cancel", json={"reason": "Unable to attend"}, headers={"Authorization": f"Bearer {patient_token}"})
    assert c_res.status_code == 200

    # Patient 1 queue entry marked cancelled
    q1_doc = db.queue.find_one({"queue_id": q1})
    assert q1_doc["status"] == "cancelled"
    assert q1_doc["position"] == 0

    # Patient 2 position advanced to #1
    q2_doc = db.queue.find_one({"queue_id": q2})
    assert q2_doc["status"] in ["waiting", "ready", "called"]
    assert q2_doc["position"] == 1
    assert q2_doc["predicted_wait_time"] is not None

def test_admin_appointments_monitor_shows_cancelled(client, patient_token, admin_token):
    """TEST 13 & 14: Admin can search and filter cancelled appointment"""
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    b_res = client.post("/appointments/book", json={
        "doctor_id": "D003",
        "department": "Orthopedics",
        "consultation_date": tomorrow,
        "consultation_slot": "morning",
        "symptoms": ["joint pain"]
    }, headers={"Authorization": f"Bearer {patient_token}"})
    booking_id = b_res.get_json()["booking_id"]
    token_num = b_res.get_json().get("queue_id")

    # Cancel
    client.post(f"/appointments/{booking_id}/cancel", json={"reason": "Booked by mistake"}, headers={"Authorization": f"Bearer {patient_token}"})

    # Admin fetches appointments
    adm_res = client.get("/admin/appointments", headers={"Authorization": f"Bearer {admin_token}"})
    assert adm_res.status_code == 200
    all_bookings = adm_res.get_json()

    # Verify appointment exists and is CANCELLED
    cancelled_entry = next((b for b in all_bookings if b.get("booking_id") == booking_id or b.get("token_number") == token_num), None)
    assert cancelled_entry is not None
    assert cancelled_entry["status"] == "cancelled"
    assert cancelled_entry["current_status"] == "cancelled"
    assert cancelled_entry["position"] == "-"
    assert cancelled_entry["current_queue_position"] == "-"
