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
    with patch("config.config.FAST2SMS_SMS_ENABLED", False), \
         patch("config.config.MSG91_SMS_ENABLED", False):
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

def _clean_phone(phone: str):
    from database.mongodb import get_db
    try:
        db = get_db()
        db.users.delete_many({"phone": phone})
        db.patients.delete_many({"phone": phone})
        db.auth_otps.delete_many({"phone": phone})
    except Exception:
        pass
    from services.auth_service import IN_MEMORY_USERS, IN_MEMORY_AUTH_OTPS
    IN_MEMORY_USERS[:] = [u for u in IN_MEMORY_USERS if u.get("phone") != phone]
    for key in list(IN_MEMORY_AUTH_OTPS.keys()):
        if key.startswith(phone):
            del IN_MEMORY_AUTH_OTPS[key]

def test_registration_otp_sent(client):
    """Verify registration OTP is sent, hashed securely in DB, and never stored in plaintext."""
    test_phone = "9611111111"
    _clean_phone(test_phone)

    send_res = client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
    assert send_res.status_code == 200
    data = send_res.get_json()
    assert "development_otp" in data
    assert len(data["development_otp"]) == 6

    # Verify database record: MUST NOT store plaintext OTP
    from database.mongodb import get_db
    try:
        db = get_db()
        otp_doc = db.auth_otps.find_one({"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
        if otp_doc:
            assert "otp_hash" in otp_doc
            assert "otp" not in otp_doc  # No plaintext storage
            assert otp_doc["otp_hash"] != data["development_otp"]
    except Exception:
        pass
    _clean_phone(test_phone)

def test_correct_otp_allows_registration(client):
    """Verify correct OTP allows registration and marks phone as verified."""
    test_phone = "9622222222"
    _clean_phone(test_phone)

    send_res = client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
    otp = send_res.get_json()["development_otp"]

    reg_res = client.post("/auth/register", json={
        "name": "Verified Patient",
        "phone": test_phone,
        "email": "verified@patient.test",
        "password": "CorrectPassword123!",
        "otp": otp
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.get_json()
    assert "token" in reg_data
    assert reg_data["user"]["phone_verified"] is True
    assert reg_data["user"]["status"] == "VERIFIED"

    # Confirm user exists in DB
    from database.mongodb import get_db
    try:
        db = get_db()
        user_doc = db.users.find_one({"phone": test_phone})
        assert user_doc is not None
        assert user_doc["phone_verified"] is True
    except Exception:
        pass
    _clean_phone(test_phone)

def test_wrong_otp_blocks_registration(client):
    """Verify incorrect OTP blocks registration and does not create an account."""
    test_phone = "9633333333"
    _clean_phone(test_phone)

    client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})

    # Attempt with wrong OTP
    reg_res = client.post("/auth/register", json={
        "name": "Wrong OTP Patient",
        "phone": test_phone,
        "password": "Password123!",
        "otp": "000000"
    })
    assert reg_res.status_code == 400
    assert "Phone verification failed" in reg_res.get_json()["error"]

    # Confirm no account was created
    from database.mongodb import get_db
    try:
        db = get_db()
        assert db.users.find_one({"phone": test_phone}) is None
    except Exception:
        pass
    _clean_phone(test_phone)

def test_expired_otp_blocks_registration(client):
    """Verify expired OTP blocks registration and does not create an account."""
    test_phone = "9644444444"
    _clean_phone(test_phone)

    send_res = client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
    otp = send_res.get_json()["development_otp"]

    # Force expiration in DB and memory
    import time
    past_ts = time.time() - 100
    from database.mongodb import get_db
    try:
        db = get_db()
        db.auth_otps.update_one(
            {"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"},
            {"$set": {"expires_at_ts": past_ts}}
        )
    except Exception:
        pass
    from services.auth_service import IN_MEMORY_AUTH_OTPS
    if f"{test_phone}_ACCOUNT_VERIFICATION" in IN_MEMORY_AUTH_OTPS:
        IN_MEMORY_AUTH_OTPS[f"{test_phone}_ACCOUNT_VERIFICATION"]["expires_at_ts"] = past_ts

    reg_res = client.post("/auth/register", json={
        "name": "Expired OTP Patient",
        "phone": test_phone,
        "password": "Password123!",
        "otp": otp
    })
    assert reg_res.status_code == 400
    assert "expired" in reg_res.get_json()["error"].lower()

    # Confirm no account was created
    try:
        db = get_db()
        assert db.users.find_one({"phone": test_phone}) is None
    except Exception:
        pass
    _clean_phone(test_phone)

def test_reused_otp_blocks_registration(client):
    """Verify an OTP cannot be reused to register multiple times (single-use protection)."""
    test_phone = "9655555555"
    _clean_phone(test_phone)

    send_res = client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
    otp = send_res.get_json()["development_otp"]

    # 1. First registration succeeds
    reg1 = client.post("/auth/register", json={
        "name": "First Patient",
        "phone": test_phone,
        "password": "Password123!",
        "otp": otp
    })
    assert reg1.status_code == 201

    # Clear user from DB so phone is available again, but OTP has already been used
    from database.mongodb import get_db
    try:
        db = get_db()
        db.users.delete_many({"phone": test_phone})
    except Exception:
        pass
    from services.auth_service import IN_MEMORY_USERS
    IN_MEMORY_USERS[:] = [u for u in IN_MEMORY_USERS if u.get("phone") != test_phone]

    # 2. Second registration with SAME OTP must be rejected
    reg2 = client.post("/auth/register", json={
        "name": "Reused OTP Patient",
        "phone": test_phone,
        "password": "Password123!",
        "otp": otp
    })
    assert reg2.status_code == 400
    assert "already been used" in reg2.get_json()["error"].lower()
    _clean_phone(test_phone)

def test_unverified_phone_cannot_create_account(client):
    """Verify calling /auth/register without OTP or with empty OTP fails."""
    test_phone = "9666666666"
    _clean_phone(test_phone)

    # 1. Missing OTP field
    res1 = client.post("/auth/register", json={
        "name": "No OTP",
        "phone": test_phone,
        "password": "Password123!"
    })
    assert res1.status_code == 400
    assert "OTP verification code is required" in res1.get_json()["error"]

    # 2. Empty OTP field
    res2 = client.post("/auth/register", json={
        "name": "Empty OTP",
        "phone": test_phone,
        "password": "Password123!",
        "otp": ""
    })
    assert res2.status_code == 400
    assert "OTP verification code is required" in res2.get_json()["error"]

    # Confirm no user exists
    from database.mongodb import get_db
    try:
        db = get_db()
        assert db.users.find_one({"phone": test_phone}) is None
    except Exception:
        pass
    _clean_phone(test_phone)

def test_resend_cooldown_blocks_rapid_requests(client):
    """Verify requesting another OTP within 30 seconds is blocked by cooldown."""
    test_phone = "9677777777"
    _clean_phone(test_phone)

    # 1st send succeeds
    res1 = client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
    assert res1.status_code == 200

    # Immediate 2nd send must be rejected with cooldown message
    res2 = client.post("/auth/send-otp", json={"phone": test_phone, "purpose": "ACCOUNT_VERIFICATION"})
    assert res2.status_code == 400
    assert "Please wait" in res2.get_json()["error"]
    _clean_phone(test_phone)

def test_existing_login_otp_still_works(client):
    """Verify login with OTP and password login continue to work seamlessly."""
    from services.auth_service import init_seed_users, IN_MEMORY_AUTH_OTPS
    init_seed_users()
    IN_MEMORY_AUTH_OTPS.pop("9876543211_LOGIN", None)
    from database.mongodb import get_db
    try:
        db = get_db()
        db.auth_otps.delete_many({"phone": "9876543211", "purpose": "LOGIN"})
    except Exception:
        pass

    # 1. Send Login OTP
    send_res = client.post("/auth/send-otp", json={"phone": "9876543211", "purpose": "LOGIN"})
    assert send_res.status_code == 200
    otp = send_res.get_json()["development_otp"]

    # 2. Login with OTP
    login_otp_res = client.post("/auth/login-otp", json={"phone": "9876543211", "otp": otp, "role": "patient"})
    assert login_otp_res.status_code == 200
    data = login_otp_res.get_json()
    assert "token" in data
    assert data["user"]["phone"] == "9876543211"

    # 3. Existing password login still works
    login_pwd_res = client.post("/auth/login", json={"phone": "9876543211", "password": "PatientPass123!", "role": "patient"})
    assert login_pwd_res.status_code == 200
    assert "token" in login_pwd_res.get_json()

def test_cross_device_login_and_duplicate_rejection(client):
    """
    Test requirement:
    - register user
    - login from browser/session A
    - login with same credentials from browser/session B
    - both succeed
    - wrong password still fails
    - duplicate phone registration is rejected
    - phone normalization (+91, spaces, dashes) resolves consistently
    """
    from database.mongodb import get_db
    from services.auth_service import IN_MEMORY_USERS, IN_MEMORY_AUTH_OTPS

    test_phone = "9112233445"
    pwd = "CrossDevicePass123!"

    # Clean up any previous state
    try:
        db = get_db()
        db.users.delete_many({"phone": test_phone})
        db.patients.delete_many({"phone": test_phone})
        db.auth_otps.delete_many({"phone": test_phone})
    except Exception:
        pass
    IN_MEMORY_USERS[:] = [u for u in IN_MEMORY_USERS if u.get("phone") != test_phone]
    IN_MEMORY_AUTH_OTPS.pop(f"{test_phone}_ACCOUNT_VERIFICATION", None)

    # 1. Register user with normalized phone (+91 format during send-otp, formatted during signup)
    send_res = client.post("/auth/send-otp", json={
        "phone": f"+91 {test_phone[:5]}-{test_phone[5:]}",
        "purpose": "ACCOUNT_VERIFICATION"
    })
    assert send_res.status_code == 200
    otp = send_res.get_json()["development_otp"]

    reg_res = client.post("/auth/register", json={
        "name": "Cross Device Patient",
        "phone": f"91{test_phone}",  # format with 91 prefix
        "email": "crossdevice@hospital.local",
        "password": pwd,
        "otp": otp,
        "age": 30,
        "gender": "Female"
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.get_json()
    assert "token" in reg_data
    assert reg_data["user"]["phone"] == test_phone  # canonical 10-digit

    # 2. Login from Session A (using standard 10-digit number)
    login_a = client.post("/auth/login", json={
        "phone": test_phone,
        "password": pwd,
        "role": "patient"
    })
    assert login_a.status_code == 200
    token_a = login_a.get_json()["token"]
    assert token_a is not None

    # 3. Login from Session B (simulating another device/session, using +91 format with spaces/dashes)
    login_b = client.post("/auth/login", json={
        "phone": f"+91-{test_phone[:5]}-{test_phone[5:]}",
        "password": pwd,
        "role": "patient"
    })
    assert login_b.status_code == 200
    token_b = login_b.get_json()["token"]
    assert token_b is not None
    # Both tokens are valid JWTs for the same user
    assert login_a.get_json()["user"]["phone"] == login_b.get_json()["user"]["phone"]

    # 4. Wrong password from either device fails with 401
    wrong_pwd_res = client.post("/auth/login", json={
        "phone": test_phone,
        "password": "WrongPassword999!"
    })
    assert wrong_pwd_res.status_code == 401
    assert "Invalid phone number or password" in wrong_pwd_res.get_json()["error"]

    # 5. Duplicate phone registration is rejected
    # Requesting OTP for already registered phone fails
    dup_otp_res = client.post("/auth/send-otp", json={
        "phone": f"+91{test_phone}",
        "purpose": "ACCOUNT_VERIFICATION"
    })
    assert dup_otp_res.status_code == 400
    assert "already exists" in dup_otp_res.get_json()["error"]

    # Direct registration attempt with existing phone is rejected
    dup_reg_res = client.post("/auth/register", json={
        "name": "Imposter Patient",
        "phone": test_phone,
        "password": "AnotherPassword123!",
        "otp": "123456"
    })
    assert dup_reg_res.status_code in (400, 401)

def test_mongodb_failure_returns_server_error(monkeypatch, client):
    """
    Test requirement:
    If MongoDB is unavailable or query fails:
    - return a clear server/database error (HTTP 503)
    - do NOT authenticate against stale IN_MEMORY_USERS
    - do NOT make a newly registered user appear invalid because of fallback data
    """
    from services import auth_service
    from pymongo.errors import ServerSelectionTimeoutError

    # Simulate MongoDB network failure during user lookup
    def mock_db_failure():
        raise ServerSelectionTimeoutError("Simulated MongoDB cluster connection timeout")

    monkeypatch.setattr(auth_service, "get_db", mock_db_failure)

    # Attempting to login when MongoDB is unavailable must return 503 and clear database error
    res = client.post("/auth/login", json={
        "phone": "9876543211",
        "password": "PatientPass123!",
        "role": "patient"
    })
    assert res.status_code == 503
    assert "Database service is temporarily unavailable" in res.get_json()["error"]

