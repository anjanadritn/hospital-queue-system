import requests
import json
import datetime

BASE_URL = "http://127.0.0.1:5000"

def test_patient_appointments():
    print("=== Testing Patient Profile & Appointment Bookings Flow ===")

    # 1. Login as patient
    login_payload = {
        "phone": "9876543211",
        "password": "PatientPass123!"
    }
    r = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    auth_data = r.json()
    token = auth_data.get("token")
    patient_id = auth_data.get("patient_id") or auth_data.get("user", {}).get("patient_id") or "P001"
    headers = {"Authorization": f"Bearer {token}"}
    print(f"[OK] Logged in successfully. Patient ID: {patient_id}")

    # 2. Get doctors list
    r_docs = requests.get(f"{BASE_URL}/doctors", headers=headers)
    assert r_docs.status_code == 200, f"Get doctors failed: {r_docs.text}"
    doctors = r_docs.json()
    print(f"[OK] Fetched {len(doctors)} doctors from system.")
    doc1 = next((d for d in doctors if d["doctor_id"] == "D001"), doctors[0])
    doc2 = next((d for d in doctors if d["doctor_id"] == "D002"), doctors[1])
    print(f"Doctor 1: {doc1.get('name')} ({doc1.get('department')}) - ID: {doc1.get('doctor_id')}")
    print(f"Doctor 2: {doc2.get('name')} ({doc2.get('department')}) - ID: {doc2.get('doctor_id')}")

    today_str = datetime.date.today().isoformat()

    # 3. Book appointment 1 for Myself with Doctor 1
    booking1_payload = {
        "patient_id": patient_id,
        "patient_name": "Ramesh Kumar",
        "phone": "9876543211",
        "age": 35,
        "gender": "Male",
        "booking_for": "myself",
        "relation": "self",
        "doctor_id": doc1["doctor_id"],
        "department": doc1["department"],
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "priority": "normal",
        "symptoms": ["Chest discomfort", "Shortness of breath"],
        "custom_symptoms": "Mild palpitations during stairs",
        "duration_days": 2,
        "height_cm": 172,
        "weight_kg": 74
    }
    r_b1 = requests.post(f"{BASE_URL}/appointments/book", json=booking1_payload, headers=headers)
    assert r_b1.status_code in [200, 201], f"Booking 1 failed: {r_b1.status_code} {r_b1.text}"
    b1_data = r_b1.json()
    print(f"[OK] Booking 1 confirmed: ID={b1_data.get('booking_id')}, Token={b1_data.get('queue_id')}, Doctor={b1_data.get('doctor_name')}")

    # 4. Book appointment 2 for Family Member (Father) with Doctor 2
    booking2_payload = {
        "patient_id": patient_id,
        "patient_name": "Suresh Sharma",
        "phone": "9876543211",
        "age": 68,
        "gender": "Male",
        "booking_for": "family_member",
        "relation": "Father",
        "doctor_id": doc2["doctor_id"],
        "department": doc2["department"],
        "consultation_date": today_str,
        "consultation_slot": "evening",
        "priority": "normal",
        "symptoms": ["General fatigue", "High blood sugar"],
        "custom_symptoms": "Routine diabetic checkup",
        "duration_days": 5,
        "height_cm": 165,
        "weight_kg": 70
    }
    r_b2 = requests.post(f"{BASE_URL}/appointments/book", json=booking2_payload, headers=headers)
    assert r_b2.status_code in [200, 201], f"Booking 2 failed: {r_b2.status_code} {r_b2.text}"
    b2_data = r_b2.json()
    print(f"[OK] Booking 2 confirmed: ID={b2_data.get('booking_id')}, Token={b2_data.get('queue_id')}, Doctor={b2_data.get('doctor_name')}, Patient={b2_data.get('patient_name')} (Father)")

    # 5. Fetch all appointments for logged-in patient
    r_apts = requests.get(f"{BASE_URL}/appointments/patient/{patient_id}", headers=headers)
    assert r_apts.status_code == 200, f"Get appointments failed: {r_apts.text}"
    apts = r_apts.json()
    print(f"[OK] Retrieved {len(apts)} appointments for patient {patient_id}")

    # Verify both bookings are present in the list
    b1_found = next((a for a in apts if a.get("booking_id") == b1_data.get("booking_id")), None)
    b2_found = next((a for a in apts if a.get("booking_id") == b2_data.get("booking_id")), None)

    assert b1_found is not None, "Booking 1 not found in appointments list!"
    assert b2_found is not None, "Booking 2 not found in appointments list!"

    print("\n--- Verifying Booking 1 (Myself) Details ---")
    print(f"Booking ID: {b1_found.get('booking_id')}")
    print(f"Patient Name: {b1_found.get('patient_name')}")
    print(f"Age / Gender: {b1_found.get('age')} / {b1_found.get('gender')}")
    print(f"Doctor Name: {b1_found.get('doctor_name')}")
    print(f"Department / Specialization: {b1_found.get('department')} / {b1_found.get('specialization')}")
    print(f"Consultation Date: {b1_found.get('consultation_date')}")
    print(f"Slot Time: {b1_found.get('slot_time')}")
    print(f"Queue Token: {b1_found.get('queue_id')}")
    print(f"Booking Status: {b1_found.get('status')}")
    print(f"Queue Status: {b1_found.get('queue_status')}")

    assert b1_found.get("doctor_name") == doc1.get("name"), f"Expected {doc1.get('name')}, got {b1_found.get('doctor_name')}"
    assert b1_found.get("booking_id") == b1_data.get("booking_id")
    assert b1_found.get("queue_id") == b1_data.get("queue_id")

    print("\n--- Verifying Booking 2 (Family Member) Details ---")
    print(f"Booking ID: {b2_found.get('booking_id')}")
    print(f"Patient Name: {b2_found.get('patient_name')} (Relation: {b2_found.get('relation')})")
    print(f"Age / Gender: {b2_found.get('age')} / {b2_found.get('gender')}")
    print(f"Doctor Name: {b2_found.get('doctor_name')}")
    print(f"Department / Specialization: {b2_found.get('department')} / {b2_found.get('specialization')}")
    print(f"Consultation Date: {b2_found.get('consultation_date')}")
    print(f"Slot Time: {b2_found.get('slot_time')}")
    print(f"Queue Token: {b2_found.get('queue_id')}")
    print(f"Booking Status: {b2_found.get('status')}")
    print(f"Queue Status: {b2_found.get('queue_status')}")

    assert b2_found.get("patient_name") == "Suresh Sharma", f"Expected 'Suresh Sharma', got {b2_found.get('patient_name')}"
    assert b2_found.get("age") == 68, f"Expected 68, got {b2_found.get('age')}"
    assert b2_found.get("gender") == "Male", f"Expected 'Male', got {b2_found.get('gender')}"
    assert b2_found.get("doctor_name") == doc2.get("name"), f"Expected {doc2.get('name')}, got {b2_found.get('doctor_name')}"
    assert b2_found.get("relation") == "Father", f"Expected 'Father', got {b2_found.get('relation')}"
    assert b2_found.get("doctor_name") != b1_found.get("doctor_name"), "Both doctors should be distinct!"

    # 6. Test Cancel functionality on Booking 2
    print("\n--- Testing Cancel on Family Booking 2 ---")
    cancel_res = requests.post(
        f"{BASE_URL}/appointments/{b2_found.get('booking_id')}/cancel",
        json={"reason": "Patient requested reschedule"},
        headers=headers
    )
    assert cancel_res.status_code == 200, f"Cancel failed: {cancel_res.status_code} {cancel_res.text}"
    print(f"[OK] Cancel successful: {cancel_res.json().get('message')}")

    # Re-fetch appointments to verify status updated to 'cancelled'
    r_after = requests.get(f"{BASE_URL}/appointments/patient/{patient_id}", headers=headers)
    apts_after = r_after.json()
    b2_after = next((a for a in apts_after if a.get("booking_id") == b2_data.get("booking_id")), None)
    assert b2_after.get("status") == "cancelled", f"Expected status 'cancelled', got {b2_after.get('status')}"
    assert b2_after.get("cancellation_reason") == "Patient requested reschedule"
    print(f"[OK] Verified status updated to 'cancelled' with cancellation reason preserved.")

    print("\nALL PATIENT APPOINTMENT BOOKING TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_patient_appointments()
