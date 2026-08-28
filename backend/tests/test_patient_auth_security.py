import pytest
from datetime import date
from app import create_app
from services.auth_service import generate_jwt_token

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
def patient2_token():
    user = {"user_id": "U_PAT_P002", "patient_id": "P002", "name": "Patient 2", "phone": "9876543299", "role": "patient"}
    return generate_jwt_token(user)

@pytest.fixture
def doctor_token():
    user = {"user_id": "U_DOC_D001", "doctor_id": "D001", "name": "Doctor 1", "phone": "9876543210", "role": "doctor"}
    return generate_jwt_token(user)

@pytest.fixture
def admin_token():
    user = {"user_id": "U_ADMIN", "name": "Admin", "phone": "9999999999", "role": "admin"}
    return generate_jwt_token(user)


def test_anonymous_booking_rejected(client):
    res = client.post("/appointments/book", json={
        "doctor_id": "D001", "department": "Cardiology", "consultation_date": date.today().isoformat()
    })
    assert res.status_code == 401
    assert "Authentication required" in res.get_json()["error"]

def test_anonymous_queue_join_rejected(client):
    res = client.post("/queue/join", json={"department": "Cardiology"})
    assert res.status_code == 401
    assert "Authentication required" in res.get_json()["error"]

def test_anonymous_tracking_status_rejected(client):
    res = client.get("/queue/status/Q001")
    assert res.status_code == 401
    assert "Authentication required" in res.get_json()["error"]

def test_anonymous_arrival_rejected(client):
    res = client.post("/queue/Q001/arrive")
    assert res.status_code == 401
    assert "Authentication required" in res.get_json()["error"]

def test_patient_booking_after_login(client, patient_token):
    res = client.post("/appointments/book", json={
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat(),
        "symptoms": ["Chest Pain"]
    }, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 201
    assert "booking_id" in res.get_json()

def test_patient_queue_join_after_login(client, patient_token):
    res = client.post("/queue/join", json={
        "department": "Cardiology"
    }, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 201
    assert res.get_json()["status"] == "waiting"

def test_patient_can_only_access_own_queue(client, patient_token):
    # Join queue as P001
    join_res = client.post("/queue/join", json={"department": "Cardiology"}, headers={"Authorization": f"Bearer {patient_token}"})
    q_id = join_res.get_json()["queue_id"]

    # Read queue status as P001 (Owner) -> 200 OK
    status_res = client.get(f"/queue/status/{q_id}", headers={"Authorization": f"Bearer {patient_token}"})
    assert status_res.status_code == 200
    assert status_res.get_json()["patient_id"] == "P001"

    # Mark arrival as P001 (Owner) -> 200 OK
    arr_res = client.post(f"/queue/{q_id}/arrive", headers={"Authorization": f"Bearer {patient_token}"})
    assert arr_res.status_code == 200
    assert arr_res.get_json()["arrived_at_hospital"] == True

def test_patient_cannot_access_other_patient_queue(client, patient_token, patient2_token):
    # P001 creates queue entry
    join_res = client.post("/queue/join", json={"department": "Cardiology"}, headers={"Authorization": f"Bearer {patient_token}"})
    q_id = join_res.get_json()["queue_id"]

    # P002 attempts to view P001's queue status -> Forbidden 403
    status_res = client.get(f"/queue/status/{q_id}", headers={"Authorization": f"Bearer {patient2_token}"})
    assert status_res.status_code == 403
    assert "Unauthorized access" in status_res.get_json()["error"]

    # P002 attempts to mark arrival for P001's queue entry -> Forbidden 403
    arr_res = client.post(f"/queue/{q_id}/arrive", headers={"Authorization": f"Bearer {patient2_token}"})
    assert arr_res.status_code == 403
    assert "Unauthorized access" in arr_res.get_json()["error"]

def test_patient_cannot_use_another_patient_id(client, patient_token):
    # P001 attempts to spoof P999 in payload
    res = client.post("/appointments/book", json={
        "patient_id": "P999",
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat()
    }, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 201
    # Backend forces patient_id to P001 from JWT
    assert res.get_json()["patient_id"] == "P001"

def test_patient_cannot_access_doctor_all_queues(client, patient_token):
    res = client.get("/queue/all", headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 403

def test_doctor_cannot_book_patient_appointment(client, doctor_token):
    res = client.post("/appointments/book", json={
        "doctor_id": "D001", "department": "Cardiology", "consultation_date": date.today().isoformat()
    }, headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 403

def test_doctor_cannot_access_admin_api(client, doctor_token):
    res = client.get("/admin/stats", headers={"Authorization": f"Bearer {doctor_token}"})
    assert res.status_code == 403

def test_admin_accesses_admin_api(client, admin_token):
    res = client.get("/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.get_json()["status"] == "OPERATIONAL"
