import pytest
from app import create_app
from database.mongodb import get_db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_patient_password_change_lifecycle(client):
    # 1. Login with initial demo credentials
    login_res = client.post("/api/auth/login", json={
        "phone": "9876543211",
        "password": "PatientPass123!",
        "role": "patient"
    })
    assert login_res.status_code == 200, f"Initial login failed: {login_res.get_json()}"
    token = login_res.get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Test rejection with wrong current password
    bad_res = client.post("/api/patients/me/change-password", headers=headers, json={
        "current_password": "WrongPassword999!",
        "new_password": "NewSecretPass456!",
        "confirm_password": "NewSecretPass456!"
    })
    assert bad_res.status_code == 400
    assert "Current password is incorrect" in bad_res.get_json()["error"]

    # 3. Test rejection with short new password
    short_res = client.post("/api/patients/me/change-password", headers=headers, json={
        "current_password": "PatientPass123!",
        "new_password": "123",
        "confirm_password": "123"
    })
    assert short_res.status_code == 400
    assert "at least 6 characters" in short_res.get_json()["error"]

    # 4. Test rejection when confirm password does not match
    mismatch_res = client.post("/api/patients/me/change-password", headers=headers, json={
        "current_password": "PatientPass123!",
        "new_password": "NewSecretPass456!",
        "confirm_password": "DifferentPassword!"
    })
    assert mismatch_res.status_code == 400
    assert "do not match" in mismatch_res.get_json()["error"]

    # 5. Successfully change password
    ok_res = client.post("/api/patients/me/change-password", headers=headers, json={
        "current_password": "PatientPass123!",
        "new_password": "NewSecretPass456!",
        "confirm_password": "NewSecretPass456!"
    })
    assert ok_res.status_code == 200
    assert ok_res.get_json()["success"] is True

    # 6. Verify old password no longer works
    old_login = client.post("/api/auth/login", json={
        "phone": "9876543211",
        "password": "PatientPass123!",
        "role": "patient"
    })
    assert old_login.status_code == 401

    # 7. Verify new password logs in successfully
    new_login = client.post("/api/auth/login", json={
        "phone": "9876543211",
        "password": "NewSecretPass456!",
        "role": "patient"
    })
    assert new_login.status_code == 200
    new_token = new_login.get_json()["token"]

    # 8. Revert back to original password so other tests and demo remain undisturbed
    revert_res = client.post("/api/patients/me/change-password", headers={"Authorization": f"Bearer {new_token}"}, json={
        "current_password": "NewSecretPass456!",
        "new_password": "PatientPass123!",
        "confirm_password": "PatientPass123!"
    })
    assert revert_res.status_code == 200

def test_patient_data_isolation(client):
    # Login as Patient 1 (9876543211 / P001)
    login_p1 = client.post("/api/auth/login", json={
        "phone": "9876543211",
        "password": "PatientPass123!",
        "role": "patient"
    })
    token_p1 = login_p1.get_json()["token"]
    headers_p1 = {"Authorization": f"Bearer {token_p1}"}

    # Attempt to view another patient's appointment records (e.g. P999 or P002)
    hacked_apts = client.get("/api/appointments/patient/P_ANOTHER_PATIENT", headers=headers_p1)
    assert hacked_apts.status_code == 403

    # Attempt to view another patient's profile directly
    hacked_profile = client.get("/api/patients/P_ANOTHER_PATIENT", headers=headers_p1)
    assert hacked_profile.status_code == 403

    # Attempt to view another patient's medical history
    hacked_history = client.get("/api/patients/P_ANOTHER_PATIENT/history", headers=headers_p1)
    assert hacked_history.status_code == 403
