import pytest
import os
from datetime import date, timedelta
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

def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"

def test_get_doctors(client):
    res = client.get("/doctors")
    assert res.status_code == 200
    doctors = res.get_json()
    assert isinstance(doctors, list)
    assert len(doctors) > 0

def test_symptom_search(client):
    res = client.get("/symptoms/search?q=fever")
    assert res.status_code == 200
    symptoms = res.get_json()
    assert isinstance(symptoms, list)
    assert any("fever" in s["name"].lower() for s in symptoms)

def test_valid_prediction_request(client):
    payload = {
        "symptoms": ["fever", "headache"],
        "department": "General Medicine",
        "priority": "normal",
        "queue_position": 5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "predicted_consultation_duration_min" in data
    assert isinstance(data["predicted_consultation_duration_min"], int)

def test_prediction_missing_symptoms(client):
    payload = {
        "department": "General Medicine",
        "priority": "normal",
        "queue_position": 5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 400
    assert "symptoms must be a list" in res.get_json()["error"]

def test_prediction_invalid_symptoms_type(client):
    payload = {
        "symptoms": "fever",
        "department": "General Medicine",
        "priority": "normal",
        "queue_position": 5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 400
    assert "symptoms must be a list" in res.get_json()["error"]

def test_prediction_missing_department(client):
    payload = {
        "symptoms": ["fever"],
        "department": "",
        "priority": "normal",
        "queue_position": 5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 400
    assert "department must be a non-empty string" in res.get_json()["error"]

def test_prediction_invalid_priority(client):
    payload = {
        "symptoms": ["fever"],
        "department": "General Medicine",
        "priority": "high",
        "queue_position": 5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 400
    assert "priority must be 'normal' or 'emergency'" in res.get_json()["error"]

def test_prediction_invalid_queue_position(client):
    payload = {
        "symptoms": ["fever"],
        "department": "General Medicine",
        "priority": "normal",
        "queue_position": 0
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 400
    assert "queue_position must be an integer >= 1" in res.get_json()["error"]

def test_mock_prediction_provider(client, monkeypatch):
    monkeypatch.setenv("PREDICTION_PROVIDER", "mock")
    payload = {
        "symptoms": ["fever", "headache"],
        "department": "General Medicine",
        "priority": "normal",
        "queue_position": 5
    }
    res = client.post("/predict", json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "predicted_consultation_duration_min" in data

def test_advance_booking_valid_2_days(client, patient_token):
    today_str = date.today().isoformat()
    tomorrow_str = (date.today() + timedelta(days=1)).isoformat()
    day_after_str = (date.today() + timedelta(days=2)).isoformat()

    for d_str in [today_str, tomorrow_str, day_after_str]:
        payload = {
            "patient_id": "P001",
            "doctor_id": "D001",
            "department": "Cardiology",
            "consultation_date": d_str,
            "symptoms": ["Fever", "Cough"],
            "custom_symptoms": "Mild weakness"
        }
        res = client.post("/appointments/book", json=payload, headers={"Authorization": f"Bearer {patient_token}"})
        assert res.status_code == 201
        data = res.get_json()
        assert data["consultation_date"] == d_str

def test_advance_booking_exceed_2_days_forbidden(client, patient_token):
    three_days_later = (date.today() + timedelta(days=3)).isoformat()
    payload = {
        "patient_id": "P001",
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": three_days_later,
        "symptoms": ["Fever"]
    }
    res = client.post("/appointments/book", json=payload, headers={"Authorization": f"Bearer {patient_token}"})
    assert res.status_code == 400
    data = res.get_json()
    assert "Appointments can only be booked up to 2 days in advance." in data["error"]

def test_consultation_otp_flow(client, patient_token):
    # 1. Book appointment
    book_res = client.post("/appointments/book", json={
        "patient_id": "P001",
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat()
    }, headers={"Authorization": f"Bearer {patient_token}"})
    booking_id = book_res.get_json()["booking_id"]

    # 2. Generate Consultation OTP
    gen_res = client.post(f"/consultation/{booking_id}/generate-otp", json={"patient_id": "P001", "doctor_id": "D001"}, headers={"Authorization": f"Bearer {patient_token}"})
    assert gen_res.status_code == 200
    otp_data = gen_res.get_json()
    otp_code = otp_data["otp"]
    assert len(otp_code) == 6

    # 3. Check OTP Status
    status_res = client.get(f"/consultation/{booking_id}/otp-status")
    assert status_res.status_code == 200
    assert status_res.get_json()["active"] == True
    assert status_res.get_json()["otp"] == otp_code

    # 4. Doctor verifies with invalid OTP
    bad_res = client.post(f"/doctor/consultation/{booking_id}/verify-otp", json={"otp": "000000"})
    assert bad_res.status_code == 400
    assert bad_res.get_json()["verified"] == False

    # 5. Doctor verifies with correct OTP
    good_res = client.post(f"/doctor/consultation/{booking_id}/verify-otp", json={"otp": otp_code})
    assert good_res.status_code == 200
    assert good_res.get_json()["verified"] == True
    assert good_res.get_json()["status"] == "in_consultation"

    # 6. Attempt re-using OTP
    reuse_res = client.post(f"/doctor/consultation/{booking_id}/verify-otp", json={"otp": otp_code})
    assert reuse_res.status_code == 400

    # 7. Complete Consultation
    comp_res = client.post(f"/doctor/consultation/{booking_id}/complete", json={"actual_duration_mins": 14})
    assert comp_res.status_code == 200
    assert comp_res.get_json()["status"] == "completed"
