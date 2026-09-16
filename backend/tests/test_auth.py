import pytest
from app import create_app

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_patient_otp_send_and_verify(client):
    # 1. Send OTP
    send_res = client.post("/auth/send-otp", json={"phone": "9888877777", "purpose": "ACCOUNT_VERIFICATION"})
    assert send_res.status_code == 200
    otp = send_res.get_json()["development_otp"]
    assert len(otp) == 6

    # 2. Verify OTP
    verify_res = client.post("/auth/verify-otp", json={"phone": "9888877777", "otp": otp, "purpose": "ACCOUNT_VERIFICATION"})
    assert verify_res.status_code == 200
    assert verify_res.get_json()["verified"] == True

def test_patient_registration_flow(client):
    # Clean up test user phone number to ensure idempotent test runs
    from database.mongodb import get_db
    try:
        db = get_db()
        db.users.delete_many({"phone": "9777766666"})
        db.auth_otps.delete_many({"phone": "9777766666"})
    except Exception:
        pass
    from services.auth_service import IN_MEMORY_USERS, IN_MEMORY_AUTH_OTPS
    IN_MEMORY_USERS[:] = [u for u in IN_MEMORY_USERS if u.get("phone") != "9777766666"]
    IN_MEMORY_AUTH_OTPS.pop("9777766666_ACCOUNT_VERIFICATION", None)

    # Send OTP
    send_res = client.post("/auth/send-otp", json={"phone": "9777766666", "purpose": "ACCOUNT_VERIFICATION"})
    otp = send_res.get_json()["development_otp"]

    # Register patient
    reg_res = client.post("/auth/register", json={
        "name": "New Patient",
        "phone": "9777766666",
        "email": "newpatient@test.com",
        "password": "MySecretPassword123!",
        "otp": otp
    })
    assert reg_res.status_code == 201
    data = reg_res.get_json()
    assert "token" in data
    assert data["user"]["phone_verified"] == True

def test_verified_patient_login(client):
    res = client.post("/auth/login", json={"phone": "9876543211", "password": "PatientPass123!", "role": "patient"})
    assert res.status_code == 200
    data = res.get_json()
    assert "token" in data
    assert data["user"]["role"] == "patient"

def test_phone_normalization_login(client):
    res = client.post("/auth/login", json={"phone": "+91 9876543211", "password": "PatientPass123!", "role": "patient"})
    assert res.status_code == 200
    assert res.get_json()["user"]["role"] == "patient"

def test_wrong_password_login_rejected(client):
    res = client.post("/auth/login", json={"phone": "9876543211", "password": "WrongPassword!"})
    assert res.status_code == 401
    assert "Invalid phone number or password." in res.get_json()["error"]

def test_role_mismatch_login_rejected(client):
    res = client.post("/auth/login", json={"phone": "9876543211", "password": "PatientPass123!", "role": "doctor"})
    assert res.status_code == 401
    assert "does not match account credentials" in res.get_json()["error"]

def test_doctor_login(client):
    res = client.post("/auth/login", json={"phone": "9876543210", "password": "DoctorPass123!", "role": "doctor"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["role"] == "doctor"

def test_admin_login(client):
    res = client.post("/auth/login", json={"phone": "9999999999", "password": "AdminPass123!", "role": "admin"})
    assert res.status_code == 200
    data = res.get_json()
    assert data["user"]["role"] == "admin"

def test_patient_unauthorized_to_admin_api(client):
    login_res = client.post("/auth/login", json={"phone": "9876543211", "password": "PatientPass123!"})
    token = login_res.get_json()["token"]

    admin_res = client.get("/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert admin_res.status_code == 403
    assert "Unauthorized" in admin_res.get_json()["error"]

def test_doctor_unauthorized_to_admin_api(client):
    login_res = client.post("/auth/login", json={"phone": "9876543210", "password": "DoctorPass123!"})
    token = login_res.get_json()["token"]

    admin_res = client.get("/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert admin_res.status_code == 403

def test_admin_authorized_access(client):
    login_res = client.post("/auth/login", json={"phone": "9999999999", "password": "AdminPass123!"})
    token = login_res.get_json()["token"]

    admin_res = client.get("/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert admin_res.status_code == 200
    assert admin_res.get_json()["status"] == "OPERATIONAL"

def test_forgot_password_flow(client):
    fp_res = client.post("/auth/forgot-password", json={"phone": "9876543211"})
    assert fp_res.status_code == 200
    otp = fp_res.get_json()["development_otp"]

    rp_res = client.post("/auth/reset-password", json={
        "phone": "9876543211",
        "otp": otp,
        "new_password": "NewResetPassword123!"
    })
    assert rp_res.status_code == 200

    login_res = client.post("/auth/login", json={"phone": "9876543211", "password": "NewResetPassword123!"})
    assert login_res.status_code == 200

def test_auth_otp_sms_disabled(client):
    """When MSG91_SMS_ENABLED=False, OTP generation succeeds and no SMS is sent."""
    from unittest.mock import patch
    with patch("config.config.MSG91_SMS_ENABLED", False):
        with patch("services.sms_service.sms_service.send_otp") as mock_send_otp:
            res = client.post("/auth/send-otp", json={"phone": "9876500001", "purpose": "ACCOUNT_VERIFICATION"})
            assert res.status_code == 200
            data = res.get_json()
            assert "development_otp" in data
            assert len(data["development_otp"]) == 6
            assert data.get("sms_sent") is False
            mock_send_otp.assert_not_called()

def test_auth_otp_sms_enabled_success(client):
    """When MSG91_SMS_ENABLED=True, sms_service.send_otp is called and OTP verification works."""
    from unittest.mock import patch
    mock_otp_return = (True, {"type": "success", "message": "OTP sent successfully"}, None)

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_otp", return_value=mock_otp_return) as mock_send_otp:
        
        res = client.post("/auth/send-otp", json={"phone": "9876500002", "purpose": "ACCOUNT_VERIFICATION"})
        assert res.status_code == 200
        data = res.get_json()
        assert data.get("sms_sent") is True
        otp = data["development_otp"]
        
        # Verify sms_service.send_otp was called with normalized phone and OTP
        mock_send_otp.assert_called_once_with("9876500002", otp)

        # Confirm verification still works seamlessly
        verify_res = client.post("/auth/verify-otp", json={"phone": "9876500002", "otp": otp, "purpose": "ACCOUNT_VERIFICATION"})
        assert verify_res.status_code == 200
        assert verify_res.get_json()["verified"] is True

def test_auth_otp_sms_enabled_failure_resilience(client):
    """When SMS gateway fails/times out, OTP generation and verification must NOT fail."""
    from unittest.mock import patch
    mock_failure_return = (False, {"status": "timeout"}, "Gateway request timed out")

    with patch("config.config.MSG91_SMS_ENABLED", True), \
         patch("services.sms_service.sms_service.send_otp", return_value=mock_failure_return) as mock_send_otp:
        
        # OTP generation must succeed even though SMS failed
        res = client.post("/auth/send-otp", json={"phone": "9876500003", "purpose": "ACCOUNT_VERIFICATION"})
        assert res.status_code == 200
        data = res.get_json()
        assert data.get("sms_sent") is False
        otp = data["development_otp"]
        assert len(otp) == 6
        mock_send_otp.assert_called_once_with("9876500003", otp)

        # Verification must still succeed
        verify_res = client.post("/auth/verify-otp", json={"phone": "9876500003", "otp": otp, "purpose": "ACCOUNT_VERIFICATION"})
        assert verify_res.status_code == 200
        assert verify_res.get_json()["verified"] is True
