import pytest
import base64
from datetime import date, timedelta
from app import create_app
from database.mongodb import get_db
from services.auth_service import generate_jwt_token

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def patient1_token():
    user = {
        "user_id": "U_TEST_PAT_001",
        "patient_id": "P_TEST_001",
        "name": "Anjanadri Test",
        "phone": "9876543211",
        "email": "anjan@example.com",
        "role": "patient"
    }
    # Ensure patient in db
    db = get_db()
    db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {**user, "password_hash": "secret_hash_value", "otp": "999999"}},
        upsert=True
    )
    db.patients.update_one(
        {"patient_id": user["patient_id"]},
        {"$set": {
            "patient_id": user["patient_id"],
            "user_id": user["user_id"],
            "name": user["name"],
            "phone": user["phone"],
            "email": user["email"],
            "city": "Tumakuru"
        }},
        upsert=True
    )
    return generate_jwt_token(user)

@pytest.fixture
def patient2_token():
    user = {
        "user_id": "U_TEST_PAT_002",
        "patient_id": "P_TEST_002",
        "name": "Second Patient",
        "phone": "9876543299",
        "email": "second@example.com",
        "role": "patient"
    }
    db = get_db()
    db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {**user, "password_hash": "another_secret", "otp": "888888"}},
        upsert=True
    )
    db.patients.update_one(
        {"patient_id": user["patient_id"]},
        {"$set": {
            "patient_id": user["patient_id"],
            "user_id": user["user_id"],
            "name": user["name"],
            "phone": user["phone"],
            "email": user["email"],
            "city": "Bangalore"
        }},
        upsert=True
    )
    return generate_jwt_token(user)


# 1. Authenticated patient can retrieve own profile
def test_authenticated_patient_can_retrieve_own_profile(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    
    # Via /patients/profile
    res1 = client.get("/patients/profile", headers=headers)
    assert res1.status_code == 200
    data1 = res1.get_json()
    assert data1["patient_id"] == "P_TEST_001"
    assert data1["name"] == "Anjanadri Test"

    # Via /patients/me
    res2 = client.get("/patients/me", headers=headers)
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2["patient_id"] == "P_TEST_001"


# 2. Patient cannot retrieve another patient's profile
def test_patient_cannot_retrieve_another_patient_profile(client, patient1_token, patient2_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    res = client.get("/patients/P_TEST_002", headers=headers)
    assert res.status_code == 403
    data = res.get_json()
    assert data["success"] is False
    assert "Unauthorized" in data["error"]


# 3. Patient can update own profile
def test_patient_can_update_own_profile(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    payload = {
        "name": "Anjanadri Updated",
        "date_of_birth": "2000-05-15",
        "gender": "Male",
        "phone": "9876543211",
        "email": "anjan.updated@example.com",
        "address": "123 Sira Road, Tumakuru",
        "city": "Tumakuru",
        "emergency_contact_name": "Father Name",
        "emergency_contact_phone": "9876543210"
    }
    res = client.put("/patients/profile", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["name"] == "Anjanadri Updated"
    assert data["date_of_birth"] == "2000-05-15"
    assert data["city"] == "Tumakuru"
    assert data["emergency_contact_name"] == "Father Name"


# 4. Patient cannot update another patient's profile
def test_patient_cannot_update_another_patient_profile(client, patient1_token, patient2_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    payload = {"name": "Hacked Name"}
    res = client.put("/patients/P_TEST_002", json=payload, headers=headers)
    assert res.status_code == 403
    data = res.get_json()
    assert data["success"] is False


# 5. Profile remains stored in MongoDB
def test_profile_remains_stored_in_mongodb(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    payload = {
        "name": "Persistent Anjan",
        "address": "Opposite SIMSRH Campus",
        "city": "Tumakuru City"
    }
    client.put("/patients/profile", json=payload, headers=headers)
    
    # Directly inspect MongoDB
    db = get_db()
    doc = db.patients.find_one({"patient_id": "P_TEST_001"})
    assert doc is not None
    assert doc["name"] == "Persistent Anjan"
    assert doc["address"] == "Opposite SIMSRH Campus"
    assert doc["city"] == "Tumakuru City"


# 6. Date validation works
def test_date_validation_works(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}

    # Future date rejected
    future_date = (date.today() + timedelta(days=30)).isoformat()
    res_future = client.put("/patients/profile", json={"date_of_birth": future_date}, headers=headers)
    assert res_future.status_code == 400
    assert "future" in res_future.get_json()["error"].lower()

    # Invalid date format rejected
    res_invalid = client.put("/patients/profile", json={"date_of_birth": "15-05-2000"}, headers=headers)
    assert res_invalid.status_code == 400
    assert "format" in res_invalid.get_json()["error"].lower()

    # Valid date accepted and auto-derives age
    past_date = "1995-06-20"
    res_valid = client.put("/patients/profile", json={"date_of_birth": past_date}, headers=headers)
    assert res_valid.status_code == 200
    assert res_valid.get_json()["date_of_birth"] == past_date
    assert res_valid.get_json()["age"] > 20


# 7. Phone validation works
def test_phone_validation_works(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}

    # Invalid short phone
    res_bad = client.put("/patients/profile", json={"phone": "12345"}, headers=headers)
    assert res_bad.status_code == 400
    assert "at least 10 digits" in res_bad.get_json()["error"]

    # Valid 10-digit phone
    res_good = client.put("/patients/profile", json={"phone": "9876543211"}, headers=headers)
    assert res_good.status_code == 200


# 8. Invalid image rejected
def test_invalid_image_rejected(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    fake_b64 = base64.b64encode(b"This is just a text file disguised as an image").decode()
    res = client.put("/patients/profile/picture", json={
        "image_base64": fake_b64,
        "mime_type": "image/jpeg"
    }, headers=headers)
    assert res.status_code == 400
    assert "does not match" in res.get_json()["error"] or "invalid" in res.get_json()["error"].lower()


# 9. Image larger than 2 MB rejected
def test_image_larger_than_2mb_rejected(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    # 2.2 MB with JPEG header
    large_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * (2 * 1024 * 1024 + 200000)
    b64_large = base64.b64encode(large_bytes).decode()
    res = client.put("/patients/profile/picture", json={
        "image_base64": b64_large,
        "mime_type": "image/jpeg"
    }, headers=headers)
    assert res.status_code == 400
    assert "2 mb" in res.get_json()["error"].lower() or "too large" in res.get_json()["error"].lower()


# 10. Supported JPEG/PNG/WebP accepted
def test_supported_image_types_accepted(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}

    # JPEG
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 200
    res_jpeg = client.put("/patients/profile/picture", json={
        "image_base64": base64.b64encode(jpeg_bytes).decode(),
        "mime_type": "image/jpeg"
    }, headers=headers)
    assert res_jpeg.status_code == 200
    assert res_jpeg.get_json()["profile_picture"].startswith("data:image/jpeg;base64,")

    # PNG
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 200
    res_png = client.put("/patients/profile/picture", json={
        "image_base64": base64.b64encode(png_bytes).decode(),
        "mime_type": "image/png"
    }, headers=headers)
    assert res_png.status_code == 200
    assert res_png.get_json()["profile_picture"].startswith("data:image/png;base64,")

    # WebP
    webp_bytes = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 200
    res_webp = client.put("/patients/profile/picture", json={
        "image_base64": base64.b64encode(webp_bytes).decode(),
        "mime_type": "image/webp"
    }, headers=headers)
    assert res_webp.status_code == 200
    assert res_webp.get_json()["profile_picture"].startswith("data:image/webp;base64,")


# 11. Profile image replacement works
def test_profile_image_replacement(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    
    # 1. First image (JPEG)
    jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x01" * 150
    client.put("/patients/profile/picture", json={
        "image_base64": base64.b64encode(jpeg_bytes).decode(),
        "mime_type": "image/jpeg"
    }, headers=headers)

    # 2. Replace with second image (PNG)
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x02" * 150
    res_replace = client.put("/patients/profile/picture", json={
        "image_base64": base64.b64encode(png_bytes).decode(),
        "mime_type": "image/png"
    }, headers=headers)
    assert res_replace.status_code == 200
    assert res_replace.get_json()["profile_picture"].startswith("data:image/png;base64,")

    # Verify directly in MongoDB
    db = get_db()
    p = db.patients.find_one({"patient_id": "P_TEST_001"})
    assert p["profile_picture"].startswith("data:image/png;base64,")


# 12. Profile image removal works
def test_profile_image_removal(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}
    
    # First upload an image
    jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x01" * 100
    client.put("/patients/profile/picture", json={
        "image_base64": base64.b64encode(jpeg_bytes).decode(),
        "mime_type": "image/jpeg"
    }, headers=headers)

    # Delete image
    res = client.delete("/patients/profile/picture", headers=headers)
    assert res.status_code == 200
    assert res.get_json()["profile_picture"] is None

    # Check MongoDB
    db = get_db()
    p = db.patients.find_one({"patient_id": "P_TEST_001"})
    assert p.get("profile_picture") is None


# 13. Authentication is required
def test_authentication_is_required(client):
    # GET /patients/profile without auth
    res_get = client.get("/patients/profile")
    assert res_get.status_code == 401

    # PUT /patients/profile without auth
    res_put = client.put("/patients/profile", json={"name": "Hacker"})
    assert res_put.status_code == 401

    # PUT picture without auth
    res_pic = client.put("/patients/profile/picture", json={})
    assert res_pic.status_code == 401

    # DELETE picture without auth
    res_del = client.delete("/patients/profile/picture")
    assert res_del.status_code == 401


# 14. Sensitive authentication fields are not returned
def test_sensitive_authentication_fields_not_returned(client, patient1_token):
    headers = {"Authorization": f"Bearer {patient1_token}"}

    # In GET
    res_get = client.get("/patients/profile", headers=headers)
    assert res_get.status_code == 200
    data_get = res_get.get_json()
    assert "password_hash" not in data_get
    assert "password" not in data_get
    assert "otp" not in data_get

    # In PUT
    res_put = client.put("/patients/profile", json={"city": "Tumakuru"}, headers=headers)
    assert res_put.status_code == 200
    data_put = res_put.get_json()
    assert "password_hash" not in data_put
    assert "password" not in data_put
    assert "otp" not in data_put
