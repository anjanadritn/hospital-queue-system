import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests
import json
import datetime
import jwt
from config import config

BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    print("=== Testing Fix for 403 on POST /appointments/book ===")
    today_str = datetime.date.today().isoformat()

    # 1. Login as standard patient (P001)
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "phone": "9876543211",
        "password": "PatientPass123!"
    })
    assert login_res.status_code == 200, f"Patient login failed: {login_res.text}"
    patient_token = login_res.json()["token"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    print("[OK] Patient logged in successfully.")

    # 2. Test Normal 'Myself' Booking
    myself_payload = {
        "booking_for": "myself",
        "relation": "self",
        "patient_name": "Ramesh Kumar",
        "phone": "9876543211",
        "age": 35,
        "gender": "Male",
        "doctor_id": "D001",
        "department": "Cardiology",
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "priority": "normal",
        "symptoms": ["Chest pain"],
        "duration_days": 1,
        "height_cm": 175,
        "weight_kg": 75
    }
    r_myself = requests.post(f"{BASE_URL}/appointments/book", json=myself_payload, headers=patient_headers)
    print(f"Myself booking response: {r_myself.status_code}")
    assert r_myself.status_code in [200, 201], f"Expected 201 for myself booking, got {r_myself.status_code}: {r_myself.text}"
    data_myself = r_myself.json()
    print(f"[OK] Myself booking created: ID={data_myself.get('booking_id')}, Token={data_myself.get('queue_id')}")

    # 3. Test Family / Dependent Booking
    family_payload = {
        "booking_for": "family_member",
        "relation": "Mother",
        "patient_name": "Kamala Sharma",
        "phone": "9876543211",
        "age": 62,
        "gender": "Female",
        "doctor_id": "D002",
        "department": "General Medicine",
        "consultation_date": today_str,
        "consultation_slot": "evening",
        "priority": "normal",
        "symptoms": ["Fever", "Cough"],
        "duration_days": 3,
        "height_cm": 155,
        "weight_kg": 60
    }
    r_family = requests.post(f"{BASE_URL}/appointments/book", json=family_payload, headers=patient_headers)
    print(f"Family booking response: {r_family.status_code}")
    assert r_family.status_code in [200, 201], f"Expected 201 for family booking, got {r_family.status_code}: {r_family.text}"
    data_family = r_family.json()
    print(f"[OK] Family booking created: ID={data_family.get('booking_id')}, Token={data_family.get('queue_id')}")

    # 4. Test Token with 'Patient' (Capitalized) and 'user' roles to ensure no 403
    secret = config.JWT_SECRET_KEY
    for test_role in ["Patient", "PATIENT", "user", "User", None]:
        payload_token = {
            "patient_id": "P001",
            "user_id": "U_PAT_P001",
            "name": "Ramesh Kumar",
            "phone": "9876543211",
            "role": test_role,
            "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)
        }
        custom_token = jwt.encode(payload_token, secret, algorithm="HS256")
        r_role = requests.post(f"{BASE_URL}/appointments/book", json=myself_payload, headers={"Authorization": f"Bearer {custom_token}"})
        print(f"Role '{test_role}' booking status: {r_role.status_code}")
        assert r_role.status_code in [200, 201], f"Role {test_role} should succeed but got {r_role.status_code}: {r_role.text}"
    print("[OK] Verified case-insensitivity and alias handling for patient roles (none returned 403).")

    # 5. Security check: Ensure Doctor or Admin CANNOT book appointments (must return 403)
    doc_login = requests.post(f"{BASE_URL}/auth/login", json={"phone": "9876543210", "password": "DoctorPass123!"})
    if doc_login.status_code == 200:
        doc_token = doc_login.json()["token"]
        r_doc_book = requests.post(f"{BASE_URL}/appointments/book", json=myself_payload, headers={"Authorization": f"Bearer {doc_token}"})
        print(f"Doctor booking attempt status: {r_doc_book.status_code}")
        assert r_doc_book.status_code == 403, f"Doctor should be rejected with 403, got {r_doc_book.status_code}"
        print("[OK] Verified security preserved: Doctor access to patient booking is rejected with 403.")

    admin_login = requests.post(f"{BASE_URL}/auth/login", json={"phone": "9999999999", "password": "AdminPass123!"})
    if admin_login.status_code == 200:
        admin_token = admin_login.json()["token"]
        r_admin_book = requests.post(f"{BASE_URL}/appointments/book", json=myself_payload, headers={"Authorization": f"Bearer {admin_token}"})
        print(f"Admin booking attempt status: {r_admin_book.status_code}")
        assert r_admin_book.status_code == 403, f"Admin should be rejected with 403, got {r_admin_book.status_code}"
        print("[OK] Verified security preserved: Admin access to patient booking is rejected with 403.")

    # 6. Unauthenticated check (no token -> 401)
    r_no_auth = requests.post(f"{BASE_URL}/appointments/book", json=myself_payload)
    assert r_no_auth.status_code == 401, f"Missing token should return 401, got {r_no_auth.status_code}"
    print("[OK] Verified unauthenticated requests return 401.")

    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
