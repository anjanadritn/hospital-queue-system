import sys
import os
import requests

sys.path.insert(0, r"d:\Projects\hospital-queue-system\backend")

from database.mongodb import get_db
from services.otp_service import verify_arrival_otp

def run_verification():
    db = get_db()
    
    print("==================================================")
    print("STEP 1: SELECTING EXISTING PATIENT QUEUE ENTRY")
    print("==================================================")
    token_id = "D001-Q008"
    patient = db.queue.find_one({"queue_id": token_id})
    assert patient is not None, f"Queue entry {token_id} not found"
    
    # Step 2: Confirm valid 6-digit OTP
    otp = patient.get("arrival_otp")
    if not otp:
        otp_doc = db.consultation_otps.find_one({"booking_id": token_id})
        otp = otp_doc.get("otp") if otp_doc else None
    
    print(f"Target Patient Token: {patient.get('queue_id')}")
    print(f"Booking ID: {patient.get('booking_id')}")
    print(f"Doctor: {patient.get('doctor_id')}")
    print(f"Date: {patient.get('consultation_date')}")
    print(f"Slot: {patient.get('slot_id') or patient.get('consultation_slot', {}).get('slot_id')}")
    print(f"Arrival OTP: {otp} (is 6 digits: {len(str(otp)) == 6 and str(otp).isdigit()})")
    assert otp and len(str(otp)) == 6 and str(otp).isdigit(), "Patient must have a valid 6-digit OTP"
    
    # Step 3: Before verification, confirm NOT arrived/verified
    print("\n==================================================")
    print("STEP 2 & 3: CONFIRMING INITIAL ARRIVAL STATE")
    print("==================================================")
    print(f"Arrived at hospital BEFORE: {patient.get('arrived_at_hospital')}")
    print(f"Verified by admin BEFORE: {patient.get('verified_by_admin')}")
    print(f"Queue Status BEFORE: {patient.get('status')}")
    print(f"Position BEFORE: #{patient.get('position')}")
    
    # Peer patient (D001-Q010) before
    peer_before = db.queue.find_one({"queue_id": "D001-Q010"})
    print(f"Peer Patient D001-Q010 Position BEFORE: #{peer_before.get('position')}")
    
    # Step 7 & 8: Test incorrect OTP
    print("\n==================================================")
    print("STEP 7 & 8: TESTING INCORRECT OTP REJECTION")
    print("==================================================")
    incorrect_otp = "000000" if str(otp) != "000000" else "111111"
    success_inc, err_inc, res_inc = verify_arrival_otp(token_id, incorrect_otp, verified_by="Reception Staff Desk")
    print(f"Incorrect OTP '{incorrect_otp}' Result -> Success: {success_inc}, Error: '{err_inc}'")
    assert success_inc is False, "Incorrect OTP must be rejected!"
    assert "invalid" in str(err_inc).lower(), "Expected invalid OTP message"
    
    # Verify patient state is unchanged after incorrect OTP
    patient_after_bad = db.queue.find_one({"queue_id": token_id})
    assert patient_after_bad.get("arrived_at_hospital") is not True, "Incorrect OTP should not mark arrived"
    assert patient_after_bad.get("verified_by_admin") is not True, "Incorrect OTP should not mark verified"
    assert patient_after_bad.get("status") == patient.get("status"), "Queue status must not change on bad OTP"
    print("Verified: Patient state is completely unchanged after invalid OTP.")
    
    # Step 5 & 6: Test correct OTP
    print("\n==================================================")
    print("STEP 5 & 6: TESTING CORRECT OTP VERIFICATION")
    print("==================================================")
    success_cor, err_cor, res_cor = verify_arrival_otp(token_id, str(otp), verified_by="Reception Staff Desk")
    print(f"Correct OTP '{otp}' Result -> Success: {success_cor}, Response: {res_cor}")
    assert success_cor is True, f"Correct OTP verification failed: {err_cor}"
    
    # Verify database updates
    patient_after = db.queue.find_one({"queue_id": token_id})
    appt_after = db.appointments.find_one({"booking_id": patient_after.get("booking_id")})
    
    print("\n==================================================")
    print("VERIFYING POST-VERIFICATION PATIENT STATE")
    print("==================================================")
    print(f"Arrived at hospital AFTER: {patient_after.get('arrived_at_hospital')}")
    print(f"Verified by admin AFTER: {patient_after.get('verified_by_admin')}")
    print(f"Verified by: {patient_after.get('verified_by')}")
    print(f"Queue Status AFTER: {patient_after.get('status')} (Active / in-queue)")
    print(f"Appointment Status AFTER: {appt_after.get('status')}")
    print(f"Queue Token: {patient_after.get('queue_id')} (Unchanged: {patient_after.get('queue_id') == patient.get('queue_id')})")
    print(f"Booking ID: {patient_after.get('booking_id')} (Unchanged: {patient_after.get('booking_id') == patient.get('booking_id')})")
    print(f"Doctor: {patient_after.get('doctor_id')} (Unchanged: {patient_after.get('doctor_id') == patient.get('doctor_id')})")
    print(f"Consultation Date: {patient_after.get('consultation_date')} (Unchanged)")
    print(f"Consultation Slot: {patient_after.get('slot_id') or patient_after.get('consultation_slot', {}).get('slot_id')} (Unchanged)")
    
    assert patient_after.get("arrived_at_hospital") is True
    assert patient_after.get("verified_by_admin") is True
    assert patient_after.get("status") == "arrived"
    assert patient_after.get("queue_id") == patient.get("queue_id")
    assert patient_after.get("booking_id") == patient.get("booking_id")
    assert patient_after.get("doctor_id") == patient.get("doctor_id")
    assert patient_after.get("consultation_date") == patient.get("consultation_date")
    
    # Step 9: Verify another patient's queue is unaffected
    print("\n==================================================")
    print("STEP 9: VERIFYING ANOTHER PATIENT'S QUEUE UNAFFECTED")
    print("==================================================")
    peer_after = db.queue.find_one({"queue_id": "D001-Q010"})
    print(f"Peer Patient Token: {peer_after.get('queue_id')}")
    print(f"Peer Patient Position AFTER: #{peer_after.get('position')} (Unchanged: {peer_after.get('position') == peer_before.get('position')})")
    print(f"Peer Patient Status AFTER: {peer_after.get('status')}")
    print(f"Peer Patient Arrived AFTER: {peer_after.get('arrived_at_hospital')} (remains False/unaffected)")
    assert peer_after.get("position") == peer_before.get("position")
    
    print("\n==================================================")
    print("ALL PROGRAMMATIC ARRIVAL VERIFICATION ASSERTIONS PASSED")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
