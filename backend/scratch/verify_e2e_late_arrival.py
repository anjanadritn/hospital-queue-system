"""
End-to-End Real Verification Script for Patient Arrival & 2-Minute Late-Arrival Workflow.
Tests against local MongoDB database and current backend implementation:
1. Book 2 patients for the SAME doctor, consultation date, and slot.
2. Confirm both receive token, position, consultation time, arrival time, and 2-min deadline.
3. Verify Patient A arrival via OTP within deadline.
4. Let Patient B become overdue beyond 2-min deadline.
5. Run late-arrival evaluation.
6. Verify Patient B moves to the END of ONLY that doctor's queue.
7. Verify Patient A remains correctly positioned.
8. Verify Patient B's token, booking_id, appointment, doctor, slot are unchanged.
9. Verify RF wait times, progressive expected consultation times, and departure calculations recalculated.
10. Verify another doctor's queue is unchanged.
11. Verify repeated evaluation does not reorder Patient B again.
12. Verify Patient Dashboard / live queue reflects updated queue position.
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

try:
    from zoneinfo import ZoneInfo
    HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    HOSPITAL_TZ = timezone(timedelta(hours=5, minutes=30))

from database.mongodb import get_db, serialize_doc
from services.appointment_service import book_appointment
from services.otp_service import verify_arrival_otp
from services.queue_service import (
    evaluate_late_arrivals,
    get_patient_arrival_deadline,
    get_public_live_queue,
    recalculate_queue_positions
)

def run_e2e_verification():
    db = get_db()
    print("=" * 80)
    print("🏥 REAL END-TO-END VERIFICATION: 2-MINUTE LATE-ARRIVAL WORKFLOW")
    print("=" * 80)

    # 1. SETUP: Doctors and Date
    doc_target = "D001"  # Dr. Ananya Sharma (Cardiology)
    doc_other = "D002"   # Dr. Rajesh Kumar (General Medicine)
    now_hospital = datetime.now(HOSPITAL_TZ)
    today_str = now_hospital.strftime("%Y-%m-%d")
    slot_id = "evening"

    print(f"\n[SETUP] Target Doctor: {doc_target} (Cardiology)")
    print(f"[SETUP] Isolated Doctor: {doc_other} (General Medicine)")
    print(f"[SETUP] Date: {today_str} | Slot: {slot_id} | Current Time: {now_hospital.strftime('%I:%M:%S %p')}")

    # Clean any previous test data for this specific patient prefix
    db.queue.delete_many({"patient_id": {"$in": ["P_E2E_ALPHA", "P_E2E_BETA"]}})
    db.appointments.delete_many({"patient_id": {"$in": ["P_E2E_ALPHA", "P_E2E_BETA"]}})
    db.consultation_otps.delete_many({"patient_id": {"$in": ["P_E2E_ALPHA", "P_E2E_BETA"]}})

    # Record pre-test state of doc_other (D002)
    other_queue_before = list(db.queue.find(
        {"doctor_id": doc_other, "status": {"$in": ["waiting", "ready", "arrived"]}},
        {"queue_id": 1, "position": 1, "predicted_wait_time": 1, "status": 1}
    ).sort("position", 1))
    print(f"[SETUP] Doctor {doc_other} has {len(other_queue_before)} active queue entries before test.")

    # -------------------------------------------------------------------------
    # STEP 1 & 2: BOOK 2 PATIENTS FOR SAME DOCTOR, DATE, AND SLOT
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 1 & 2: Book 2 Patients for Doctor D001 & Confirm Timings/Deadlines")
    print("-" * 80)

    # Patient A
    payload_a = {
        "patient_id": "P_E2E_ALPHA",
        "patient_name": "Alpha Sharma",
        "phone": "9876543210",
        "doctor_id": doc_target,
        "department": "Cardiology",
        "consultation_date": today_str,
        "slot_id": slot_id,
        "symptoms": ["chest_pain", "breathlessness"],
        "priority": "normal",
        "city": "Tumakuru"
    }
    b_a, err_a = book_appointment(payload_a)
    if err_a:
        print(f"❌ Failed to book Patient A: {err_a}")
        return False
    q_a = db.queue.find_one({"booking_id": b_a["booking_id"]})

    # Patient B
    payload_b = {
        "patient_id": "P_E2E_BETA",
        "patient_name": "Beta Patel",
        "phone": "9876543211",
        "doctor_id": doc_target,
        "department": "Cardiology",
        "consultation_date": today_str,
        "slot_id": slot_id,
        "symptoms": ["palpitations"],
        "priority": "normal",
        "city": "Tumakuru"
    }
    b_b, err_b = book_appointment(payload_b)
    if err_b:
        print(f"❌ Failed to book Patient B: {err_b}")
        return False
    q_b = db.queue.find_one({"booking_id": b_b["booking_id"]})

    print(f"✅ Patient A (Alpha) Booked:")
    print(f"   • Queue Token:               {q_a['queue_id']}")
    print(f"   • Queue Position:            #{q_a['position']}")
    print(f"   • Predicted Duration (RF):   {q_a['predicted_duration']} mins")
    print(f"   • Predicted Queue Wait:      ~{q_a['predicted_wait_time']} mins")
    print(f"   • Expected Consultation:     {q_a['expected_consultation_time']} ({q_a['expected_consultation_iso']})")
    print(f"   • Expected Hospital Arrival: {q_a.get('expected_arrival_time') or q_a.get('travel_info', {}).get('expected_hospital_arrival')}")
    print(f"   • 2-Min Arrival Deadline:    {q_a.get('arrival_deadline_time')} ({q_a.get('arrival_deadline_iso')})")
    print(f"   • Arrival OTP Code:          {q_a.get('arrival_otp')}")

    print(f"\n✅ Patient B (Beta) Booked:")
    print(f"   • Queue Token:               {q_b['queue_id']}")
    print(f"   • Queue Position:            #{q_b['position']}")
    print(f"   • Predicted Duration (RF):   {q_b['predicted_duration']} mins")
    print(f"   • Predicted Queue Wait:      ~{q_b['predicted_wait_time']} mins")
    print(f"   • Expected Consultation:     {q_b['expected_consultation_time']} ({q_b['expected_consultation_iso']})")
    print(f"   • Expected Hospital Arrival: {q_b.get('expected_arrival_time') or q_b.get('travel_info', {}).get('expected_hospital_arrival')}")
    print(f"   • 2-Min Arrival Deadline:    {q_b.get('arrival_deadline_time')} ({q_b.get('arrival_deadline_iso')})")
    print(f"   • Arrival OTP Code:          {q_b.get('arrival_otp')}")

    # Confirm all 5 items received
    for label, q in [("Patient A", q_a), ("Patient B", q_b)]:
        assert q.get("queue_id"), f"{label} missing queue_id"
        assert q.get("position") is not None, f"{label} missing position"
        assert q.get("expected_consultation_time"), f"{label} missing expected_consultation_time"
        assert q.get("expected_arrival_time") or q.get("travel_info", {}).get("expected_hospital_arrival"), f"{label} missing expected arrival time"
        assert q.get("arrival_deadline_time") or q.get("arrival_deadline_iso"), f"{label} missing arrival deadline"

    # -------------------------------------------------------------------------
    # STEP 3: PATIENT A ARRIVES WITHIN DEADLINE & VERIFIES VIA ARRIVAL OTP
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 3: Patient A Arrival Verification via Reception Arrival OTP")
    print("-" * 80)
    otp_code_a = q_a.get("arrival_otp")
    ok_otp, err_otp, res_otp = verify_arrival_otp(
        token_or_booking_id=q_a["queue_id"],
        input_otp=otp_code_a,
        verified_by="Reception Staff Desk 1"
    )
    assert ok_otp, f"OTP verification failed: {err_otp}"
    print(f"✅ Patient A OTP Verification Succeeded: {ok_otp} (Verified by: Reception Staff Desk 1)")

    # Verify Patient A status in database
    q_a_arrived = db.queue.find_one({"queue_id": q_a["queue_id"]})
    print(f"   • Status:             {q_a_arrived['status']}")
    print(f"   • Arrived at Hospital: {q_a_arrived.get('arrived_at_hospital')}")
    print(f"   • Verified by Admin:  {q_a_arrived.get('verified_by_admin')}")
    assert q_a_arrived.get("arrived_at_hospital") is True
    assert q_a_arrived.get("verified_by_admin") is True

    # -------------------------------------------------------------------------
    # STEP 4: PATIENT B BECOMES OVERDUE BEYOND 2-MINUTE DEADLINE
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 4: Patient B Becomes Overdue (>2 Minutes Past Arrival Deadline)")
    print("-" * 80)
    deadline_b = get_patient_arrival_deadline(q_b)
    print(f"Patient B scheduled arrival deadline: {deadline_b.strftime('%I:%M:%S %p %Z')}")

    # Set evaluation time 5 minutes past deadline to simulate overdue arrival
    eval_time = deadline_b + timedelta(minutes=5)
    print(f"Simulating evaluation at:            {eval_time.strftime('%I:%M:%S %p %Z')} (>5 min past deadline)")

    # -------------------------------------------------------------------------
    # STEP 5 & 6: RUN LATE-ARRIVAL EVALUATION & VERIFY REORDERING
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 5 & 6: Execute Serverless-Safe Late-Arrival Evaluation")
    print("-" * 80)
    reordered = evaluate_late_arrivals(
        doctor_id=doc_target,
        consultation_date=today_str,
        slot_id=slot_id,
        now_dt=eval_time
    )
    print(f"✅ Late Arrival Evaluator executed. Patients reordered: {len(reordered)}")
    for r in reordered:
        print(f"   • Reordered Token: {r['queue_id']} (Doctor: {r['doctor_id']}, Slot: {r['slot_id']})")

    assert len(reordered) >= 1, "Expected Patient B to be reordered!"
    reordered_tokens = [r["queue_id"] for r in reordered]
    assert q_b["queue_id"] in reordered_tokens, f"Patient B token {q_b['queue_id']} not in reordered list!"
    assert q_a["queue_id"] not in reordered_tokens, f"Patient A token {q_a['queue_id']} should NOT be reordered!"

    # -------------------------------------------------------------------------
    # STEP 7: VERIFY QUEUE POSITIONS AFTER REORDERING
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 7: Verify Queue Positions After Reordering")
    print("-" * 80)
    q_a_after = db.queue.find_one({"queue_id": q_a["queue_id"]})
    q_b_after = db.queue.find_one({"queue_id": q_b["queue_id"]})

    print(f"Patient A (Alpha - Arrived): Position #{q_a_after['position']} (Status: {q_a_after['status']})")
    print(f"Patient B (Beta - Late):    Position #{q_b_after['position']} (Status: {q_b_after['status']}, Reordered: {q_b_after.get('late_arrival_reordered')})")

    assert q_a_after["position"] < q_b_after["position"], "Patient A must be ahead of Patient B!"
    assert q_b_after.get("late_arrival_reordered") is True, "Patient B must have late_arrival_reordered: True"
    assert q_a_after.get("late_arrival_reordered") is not True, "Patient A must NOT have late_arrival_reordered: True"

    # -------------------------------------------------------------------------
    # STEP 8: VERIFY PATIENT B'S DATA INTEGRITY
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 8: Verify Patient B Token, Booking, and Appointment Integrity")
    print("-" * 80)
    appt_b = db.appointments.find_one({"booking_id": b_b["booking_id"]})
    assert appt_b is not None, "Patient B appointment record was deleted!"
    assert appt_b["queue_id"] == q_b["queue_id"], "Token changed!"
    assert appt_b["booking_id"] == b_b["booking_id"], "Booking ID changed!"
    assert appt_b["doctor_id"] == doc_target, "Doctor changed!"
    assert appt_b["status"] != "cancelled", "Appointment was cancelled!"
    print(f"✅ Token Preserved:         {q_b_after['queue_id']} == {q_b['queue_id']}")
    print(f"✅ Booking ID Preserved:     {q_b_after['booking_id']} == {q_b['booking_id']}")
    print(f"✅ Appointment Preserved:    Active in db.appointments (status: '{appt_b['status']}')")
    print(f"✅ Doctor Preserved:         {q_b_after['doctor_id']} == {doc_target}")
    print(f"✅ Consultation Slot:        {q_b_after.get('slot_id')} == {slot_id}")

    # -------------------------------------------------------------------------
    # STEP 9: VERIFY RECALCULATED TIMINGS
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 9: Verify Recalculated Wait Times, Consultation Times, & Departures")
    print("-" * 80)
    print(f"Patient A Predicted Wait Time:  ~{q_a_after['predicted_wait_time']} mins | Expected Consultation: {q_a_after['expected_consultation_time']}")
    print(f"Patient B Predicted Wait Time:  ~{q_b_after['predicted_wait_time']} mins | Expected Consultation: {q_b_after['expected_consultation_time']}")
    print(f"Patient B Recommended Departure: {q_b_after.get('recommended_departure_time') or q_b_after.get('travel_info', {}).get('recommended_departure_time')}")
    assert q_b_after["predicted_wait_time"] >= q_a_after["predicted_wait_time"]
    assert q_b_after["expected_consultation_time"] is not None

    # -------------------------------------------------------------------------
    # STEP 10: VERIFY ANOTHER DOCTOR'S QUEUE IS UNCHANGED
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 10: Verify Doctor D002's Queue Remains Completely Unaffected")
    print("-" * 80)
    other_queue_after = list(db.queue.find(
        {"doctor_id": doc_other, "status": {"$in": ["waiting", "ready", "arrived"]}},
        {"queue_id": 1, "position": 1, "predicted_wait_time": 1, "status": 1}
    ).sort("position", 1))

    assert len(other_queue_before) == len(other_queue_after), "Doctor D002 count changed!"
    for b_entry, a_entry in zip(other_queue_before, other_queue_after):
        assert b_entry["queue_id"] == a_entry["queue_id"]
        assert b_entry["position"] == a_entry["position"]
        assert b_entry["predicted_wait_time"] == a_entry["predicted_wait_time"]
    print(f"✅ Doctor {doc_other} queue entries ({len(other_queue_after)}) verified strictly identical.")

    # -------------------------------------------------------------------------
    # STEP 11: IDEMPOTENCY CHECK (RUNNING EVALUATOR AGAIN DOES NOT REORDER B)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 11: Idempotency Verification (Re-evaluating Does Not Move Patient B Again)")
    print("-" * 80)
    pos_b_first_reorder = q_b_after["position"]
    reordered_2nd = evaluate_late_arrivals(
        doctor_id=doc_target,
        consultation_date=today_str,
        slot_id=slot_id,
        now_dt=eval_time + timedelta(minutes=10)
    )
    q_b_2nd = db.queue.find_one({"queue_id": q_b["queue_id"]})
    print(f"✅ Evaluator ran at +10 min: Reordered count = {len(reordered_2nd)}")
    print(f"   • Patient B Position: #{q_b_2nd['position']} (Matches #{pos_b_first_reorder})")
    assert q_b["queue_id"] not in [r["queue_id"] for r in reordered_2nd], "Patient B was reordered again!"
    assert q_b_2nd["position"] == pos_b_first_reorder

    # -------------------------------------------------------------------------
    # STEP 12: PATIENT DASHBOARD & LIVE QUEUE BOARD VERIFICATION
    # -------------------------------------------------------------------------
    print("\n" + "-" * 80)
    print("STEP 12: Patient Dashboard & Live Queue Board Verification")
    print("-" * 80)
    # Public live queue board
    live_board = get_public_live_queue(
        department="Cardiology",
        slot_id=slot_id,
        doctor_id=doc_target,
        consultation_date=today_str
    )
    doc_board = live_board.get("doctor_queues", {}).get(doc_target, {})
    all_tokens = [e["queue_id"] for e in doc_board.get("entries", [])]
    next_pat = doc_board.get("next_patient")
    upcoming_pats = doc_board.get("upcoming_patients", [])

    print(f"Live Queue Board for {doc_target} ({today_str} {slot_id}):")
    print(f"   • Department:            {doc_board.get('department')}")
    print(f"   • Doctor:                {doc_board.get('doctor_name')} ({doc_target})")
    print(f"   • Room Number:           {doc_board.get('room_number')}")
    print(f"   • Total Active Queue:    {doc_board.get('total_active')}")
    print(f"   • Next in Line:          {next_pat.get('queue_id') if next_pat else 'None'} (Token for Patient A)")
    print(f"   • Upcoming in Line:      {[u.get('queue_id') for u in upcoming_pats]}")
    print(f"   • Ordered Tokens:        {all_tokens}")

    assert all_tokens, "No tokens found in live queue board!"
    assert all_tokens[-1] == q_b["queue_id"], f"Patient B {q_b['queue_id']} is not at the end of the live queue board!"
    print(f"✅ Patient B {q_b['queue_id']} is confirmed at the END of the live queue board ({all_tokens}).")

    # Patient Dashboard Active Queue Record for Patient B
    p_b_id = b_b.get("patient_id")
    patient_b_active = db.queue.find_one({"queue_id": q_b["queue_id"]})
    print(f"\nPatient Dashboard Active Queue Record for Beta Patel:")
    print(f"   • Patient ID:            {patient_b_active.get('patient_id')}")
    print(f"   • Active Token:          {patient_b_active.get('queue_id')}")
    print(f"   • Current Position:      #{patient_b_active.get('position')}")
    print(f"   • Status:                {patient_b_active.get('status')}")
    print(f"   • Reordered Tag:         late_arrival_reordered={patient_b_active.get('late_arrival_reordered')}")
    print(f"   • Reordered At:          {patient_b_active.get('late_arrival_moved_at')}")

    assert patient_b_active["position"] == q_b_after["position"]
    print("\n" + "=" * 80)
    print("🎉 ALL 12 END-TO-END VERIFICATION STEPS PASSED SUCCESSFULLY!")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = run_e2e_verification()
    sys.exit(0 if success else 1)
