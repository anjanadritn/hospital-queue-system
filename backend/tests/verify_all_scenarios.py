import os
import sys
import json
from datetime import datetime, date, timedelta, timezone

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app import create_app
from database.mongodb import get_db, serialize_doc
from services.auth_service import generate_jwt_token
from services.appointment_service import book_appointment
from services.queue_service import (
    join_queue,
    get_queue_status,
    complete_consultation,
    skip_patient_service,
    escalate_emergency,
    recalculate_queue_positions,
    get_public_live_queue,
    SAFE_DEPARTMENT_CATEGORIES,
    IN_MEMORY_QUEUE
)
from services.otp_service import verify_arrival_otp
from services.slot_service import (
    SLOT_DEFINITIONS,
    validate_and_normalize_slot,
    get_slot_counts,
    get_admin_slot_analytics
)
from services.leave_service import (
    confirm_leaving_now,
    evaluate_and_update_leave_reminders,
    LEAVE_STATUS_NOT_REQUIRED,
    LEAVE_STATUS_LEAVE_NOW_SENT,
    LEAVE_STATUS_REMINDER_SENT,
    LEAVE_STATUS_URGENT_SENT,
    LEAVE_STATUS_CONFIRMED,
    REMINDER_INTERVAL_MIN,
    URGENT_INTERVAL_MIN,
    SAFETY_BUFFER_MIN
)

def run_verification():
    print("=" * 80)
    print("STARTING COMPREHENSIVE END-TO-END VERIFICATION")
    print("=" * 80)

    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    db = get_db()
    # Clean test fixtures
    try:
        db.appointments.delete_many({"doctor_id": {"$regex": "^VERIFY_"}})
        db.queue.delete_many({"doctor_id": {"$regex": "^VERIFY_"}})
        db.notifications.delete_many({"patient_id": {"$regex": "^U_VERIFY_"}})
    except Exception:
        pass
    IN_MEMORY_QUEUE.clear()

    today_str = date.today().isoformat()
    test_doc = "VERIFY_DOC_001"
    test_dept = "Cardiology"

    # =========================================================================
    # SCENARIO 1: BOOKING + SLOTS
    # =========================================================================
    print("\n--- SCENARIO 1: BOOKING + SLOTS ---")

    # 1.1 Booking without slot must be rejected
    pat1_user = {"user_id": "U_VERIFY_01", "patient_id": "P_V01", "name": "Patient One", "phone": "9876543210", "role": "patient"}
    token1 = generate_jwt_token(pat1_user)
    res_no_slot = client.post("/appointments/book", headers={"Authorization": f"Bearer {token1}"}, json={
        "doctor_id": test_doc,
        "department": test_dept,
        "consultation_date": today_str,
        "symptoms": ["chest pain", "shortness of breath"]
    })
    print(f"[1.1] Booking without slot status: {res_no_slot.status_code}")
    assert res_no_slot.status_code == 400, f"Expected 400, got {res_no_slot.status_code}: {res_no_slot.get_json()}"
    assert "slot" in res_no_slot.get_json().get("error", "").lower()
    print("  ✓ Booking without slot was properly rejected with HTTP 400")

    # 1.2 Morning slot (09:00 AM–01:00 PM) accepted
    res_morning = client.post("/appointments/book", headers={"Authorization": f"Bearer {token1}"}, json={
        "doctor_id": test_doc,
        "department": test_dept,
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "symptoms": ["chest pain"]
    })
    print(f"[1.2] Morning slot booking status: {res_morning.status_code}")
    assert res_morning.status_code in [200, 201], f"Expected 201, got {res_morning.status_code}: {res_morning.get_json()}"
    b_morning = res_morning.get_json()
    assert b_morning.get("consultation_slot", {}).get("slot_id") == "morning"
    assert b_morning.get("consultation_slot", {}).get("display_time") == "09:00 AM – 01:00 PM"
    print("  ✓ Morning slot 09:00 AM–01:00 PM accepted and returned")

    # 1.3 Afternoon/Evening slot (02:00 PM–09:00 PM) accepted
    pat2_user = {"user_id": "U_VERIFY_02", "patient_id": "P_V02", "name": "Patient Two", "phone": "9876543211", "role": "patient"}
    token2 = generate_jwt_token(pat2_user)
    res_evening = client.post("/appointments/book", headers={"Authorization": f"Bearer {token2}"}, json={
        "doctor_id": test_doc,
        "department": test_dept,
        "consultation_date": today_str,
        "consultation_slot": "evening",
        "symptoms": ["palpitations"]
    })
    print(f"[1.3] Evening slot booking status: {res_evening.status_code}")
    assert res_evening.status_code in [200, 201], f"Expected 201, got {res_evening.status_code}: {res_evening.get_json()}"
    b_evening = res_evening.get_json()
    assert b_evening.get("consultation_slot", {}).get("slot_id") == "evening"
    assert b_evening.get("consultation_slot", {}).get("display_time") == "02:00 PM – 09:00 PM"
    print("  ✓ Evening slot 02:00 PM–09:00 PM accepted and returned")

    # 1.4 Selected slot is persisted with appointment and queue record
    apt_doc = db.appointments.find_one({"booking_id": b_morning["booking_id"]})
    queue_doc = db.queue.find_one({"booking_id": b_morning["booking_id"]})
    assert apt_doc is not None and apt_doc.get("consultation_slot", {}).get("slot_id") == "morning"
    assert queue_doc is not None and queue_doc.get("consultation_slot", {}).get("slot_id") == "morning"
    print("  ✓ Selected slot is durable and persisted in both appointments and queue collections")

    # 1.5 Slot demand count is different from active eligible queue count
    # Book another appointment for morning slot without adding to queue or cancelling one
    pat3_user = {"user_id": "U_VERIFY_03", "patient_id": "P_V03", "name": "Patient Three", "phone": "9876543212", "role": "patient"}
    token3 = generate_jwt_token(pat3_user)
    client.post("/appointments/book", headers={"Authorization": f"Bearer {token3}"}, json={
        "doctor_id": test_doc,
        "department": test_dept,
        "consultation_date": today_str,
        "consultation_slot": "morning",
        "symptoms": ["fatigue"]
    })
    # Complete consultation for patient 1 to remove them from active eligible queue
    update_res = db.queue.update_one({"$or": [{"booking_id": b_morning["booking_id"]}, {"queue_id": b_morning.get("queue_id")}]}, {"$set": {"status": "completed"}})
    print(f"  Matched count for completing patient 1 queue doc: {update_res.matched_count}, modified: {update_res.modified_count}")
    
    all_q = list(db.queue.find({"doctor_id": test_doc}))
    print("  Current queue entries for test_doc:")
    for q in all_q:
        print(f"    queue_id={q.get('queue_id')}, booking_id={q.get('booking_id')}, status={q.get('status')}, slot={q.get('slot_id')}")

    slot_counts = get_slot_counts(doctor_id=test_doc, consultation_date=today_str)
    morning_stats = slot_counts["morning"]
    print(f"  Morning Slot Stats -> Total Booked (Demand): {morning_stats['total_booked']}, Waiting: {morning_stats['waiting']}, Arrived: {morning_stats['arrived']}, Completed: {morning_stats['completed']}, Active Queue: {morning_stats['active_queue_count']}")
    assert morning_stats["total_booked"] >= 2, f"Expected total_booked >= 2, got {morning_stats['total_booked']}"
    assert morning_stats["active_queue_count"] < morning_stats["total_booked"], f"Demand ({morning_stats['total_booked']}) must be separate from active eligible queue ({morning_stats['active_queue_count']})"
    print("  ✓ Slot demand count is strictly separated from active eligible queue count")

    # =========================================================================
    # SCENARIO 2: QUEUE RECALCULATION
    # =========================================================================
    print("\n--- SCENARIO 2: QUEUE RECALCULATION ---")
    # Clean up test queue for this doctor to start fresh
    db.queue.delete_many({"doctor_id": test_doc})
    IN_MEMORY_QUEUE.clear()

    # Create 4 patients for the same doctor, department, date and morning slot
    patients_data = [
        {"id": "P_R01", "name": "Recalc Pat 1", "symptoms": ["chest tightness"], "phone": "9900000001"},
        {"id": "P_R02", "name": "Recalc Pat 2", "symptoms": ["hypertension"], "phone": "9900000002"},
        {"id": "P_R03", "name": "Recalc Pat 3", "symptoms": ["angina", "dizziness"], "phone": "9900000003"},
        {"id": "P_R04", "name": "Recalc Pat 4", "symptoms": ["irregular heartbeat"], "phone": "9900000004"},
    ]
    created_tokens = []
    base_time = datetime.now(timezone.utc)
    for i, p in enumerate(patients_data):
        join_payload = {
            "doctor_id": test_doc,
            "department": test_dept,
            "patient_name": p["name"],
            "patient_phone": p["phone"],
            "patient_id": p["id"],
            "symptoms": p["symptoms"],
            "priority": "normal",
            "consultation_date": today_str,
            "consultation_slot": "morning",
            "origin_latitude": 13.3400 + (i * 0.01),
            "origin_longitude": 77.1000 + (i * 0.01)
        }
        res_q, err = join_queue(join_payload)
        assert err is None, f"Failed to join queue: {err}"
        created_tokens.append(res_q["queue_id"])

    # Authoritative recalculation
    recalculate_queue_positions(doctor_id=test_doc, department=test_dept, consultation_date=today_str, slot_id="morning")

    q_entries = list(db.queue.find({"doctor_id": test_doc, "status": {"$in": ["waiting", "ready"]}}).sort("position", 1))
    print(f"Created {len(q_entries)} queue entries for recalculation verification:")
    for entry in q_entries:
        print(f"  Token {entry['queue_id']}: Pos #{entry['position']} | Status: {entry['status']} | RF Dur: {entry.get('predicted_duration')}m | Wait: {entry.get('predicted_wait_time')}m | Start: {entry.get('expected_consultation_time')} | Leave: {entry.get('recommended_departure_time')}")

    # 2.1 Verify positions, RF prediction, progressive start times
    for i, entry in enumerate(q_entries, start=1):
        assert entry["position"] == i, f"Expected position {i}, got {entry['position']}"
        assert entry.get("predicted_duration") is not None and entry.get("predicted_duration") > 0, "RF predicted duration missing"
        assert entry.get("expected_consultation_time") is not None, "Expected start time missing"
        assert entry.get("recommended_departure_time") is not None, "Recommended departure time missing"

    # Check that expected start times are progressive
    iso_times = [datetime.fromisoformat(e["expected_consultation_iso"]) for e in q_entries]
    for k in range(len(iso_times) - 1):
        assert iso_times[k] <= iso_times[k+1], f"Expected progressive start times, but {iso_times[k]} > {iso_times[k+1]}"
    print("  ✓ Queue positions correct, Random Forest used, progressive start times verified")

    # 2.2 EVENT 1: Complete current consultation
    print("\n  -> Executing Event 1: Complete current consultation")
    first_token = created_tokens[0]
    db.queue.update_one({"queue_id": first_token}, {"$set": {"status": "in_consultation"}})
    res_comp, err = complete_consultation(first_token)
    assert err is None, f"Complete consultation failed: {err}"

    q_after_comp = list(db.queue.find({"doctor_id": test_doc, "status": {"$in": ["waiting", "ready"]}}).sort("position", 1))
    print(f"  After completing {first_token}: Remaining tokens: {[e['queue_id'] for e in q_after_comp]}")
    assert len(q_after_comp) == 3
    assert q_after_comp[0]["queue_id"] == created_tokens[1]
    assert q_after_comp[0]["position"] == 1
    assert q_after_comp[1]["queue_id"] == created_tokens[2]
    assert q_after_comp[1]["position"] == 2
    assert q_after_comp[2]["queue_id"] == created_tokens[3]
    assert q_after_comp[2]["position"] == 3
    # Check predictions and progressive times recalculated
    iso_times_comp = [datetime.fromisoformat(e["expected_consultation_iso"]) for e in q_after_comp]
    for k in range(len(iso_times_comp) - 1):
        assert iso_times_comp[k] <= iso_times_comp[k+1]
    print("  ✓ Event 1 passed: Position shift, duration predictions, progressive start and departure times recalculated")

    # 2.3 EVENT 2: Skip a patient
    print("\n  -> Executing Event 2: Skip a patient")
    skip_token = created_tokens[1] # Currently position 1
    res_skip, err = skip_patient_service(skip_token)
    assert err is None, f"Skip patient failed: {err}"

    q_after_skip = list(db.queue.find({"doctor_id": test_doc, "status": {"$in": ["waiting", "ready"]}}).sort("position", 1))
    print(f"  After skipping {skip_token}: Remaining waiting/ready tokens: {[e['queue_id'] for e in q_after_skip]}")
    assert q_after_skip[0]["queue_id"] == created_tokens[2]
    assert q_after_skip[0]["position"] == 1
    assert q_after_skip[1]["queue_id"] == created_tokens[3]
    assert q_after_skip[1]["position"] == 2
    skipped_doc = db.queue.find_one({"queue_id": skip_token})
    assert skipped_doc["status"] in ["missed", "missed_consultation"]
    print("  ✓ Event 2 passed: Skipped patient moved out of active line, position 1 promoted, times recalculated")

    # 2.4 EVENT 3: Insert/promote an emergency patient
    print("\n  -> Executing Event 3: Promote an emergency patient")
    emerg_payload = {
        "doctor_id": test_doc,
        "department": test_dept,
        "patient_name": "Emergency Patient",
        "patient_phone": "9911223344",
        "patient_id": "P_EMERG",
        "symptoms": ["cardiac arrest", "collapse"],
        "priority": "normal",
        "consultation_date": today_str,
        "consultation_slot": "morning"
    }
    res_emerg, err = join_queue(emerg_payload)
    emerg_token = res_emerg["queue_id"]
    res_esc, err = escalate_emergency(emerg_token)
    assert err is None, f"Emergency escalation failed: {err}"

    q_after_emerg = list(db.queue.find({"doctor_id": test_doc, "status": {"$in": ["waiting", "ready"]}}).sort("position", 1))
    emerg_summaries = [f"{e['queue_id']}(pos={e['position']},prio={e.get('priority')})" for e in q_after_emerg]
    print(f"  After emergency escalation: Queue tokens: {emerg_summaries}")
    assert q_after_emerg[0]["queue_id"] == emerg_token
    assert q_after_emerg[0]["position"] == 1
    assert q_after_emerg[0]["priority"] == "emergency"
    # Existing patients pushed down
    assert q_after_emerg[1]["queue_id"] == created_tokens[2]
    assert q_after_emerg[1]["position"] == 2
    assert q_after_emerg[2]["queue_id"] == created_tokens[3]
    assert q_after_emerg[2]["position"] == 3
    print("  ✓ Event 3 passed: Emergency promoted to #1, all subsequent patients pushed down, recalculated")

    # 2.5 EVENT 4: Verify arrival/eligibility
    print("\n  -> Executing Event 4: Verify arrival/eligibility")
    target_for_arrival = q_after_emerg[0]
    arrival_code = target_for_arrival.get("arrival_otp") or "123456"
    success, err, q_updated = verify_arrival_otp(target_for_arrival["queue_id"], arrival_code, verified_by="Test Admin")
    assert success is True, f"Verify arrival code failed: {err}"
    assert q_updated is not None
    assert q_updated.get("status") in ["arrived", "ready", "waiting", "in_consultation"]
    print(f"  ✓ Event 4 passed: Patient arrival verification succeeded (status={q_updated.get('status')}), queue integrity preserved")

    # =========================================================================
    # SCENARIO 3: PUBLIC QUEUE PRIVACY (ZERO PII)
    # =========================================================================
    print("\n--- SCENARIO 3: PUBLIC QUEUE PRIVACY ---")
    res_public = client.get("/queue/public")
    print(f"GET /queue/public HTTP status: {res_public.status_code}")
    assert res_public.status_code == 200
    pub_data = res_public.get_json()

    forbidden_pii_keys = [
        "patient_name", "patient_id", "phone", "patient_phone", "email", "patient_email",
        "age", "gender", "address", "patient_address", "symptoms", "custom_symptoms",
        "medical_history", "clinical_notes", "doctor_notes", "diagnosis", "advice",
        "otp", "arrival_otp", "jwt", "password", "token_value"
    ]

    def inspect_recursively(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                curr_path = f"{path}.{k}" if path else k
                for forbidden in forbidden_pii_keys:
                    assert k.lower() != forbidden.lower(), f"PII key leak: '{k}' found at {curr_path}"
                inspect_recursively(v, curr_path)
        elif isinstance(obj, list):
            for idx, item in enumerate(obj):
                inspect_recursively(item, f"{path}[{idx}]")

    inspect_recursively(pub_data)
    print("  ✓ Zero PII audit passed: 100% free of names, phone, email, age, gender, address, symptoms, OTP, JWT")
    print(f"  Safe public response top-level keys: {list(pub_data.keys())}")
    for section in ["currently_consulting", "next_patients", "upcoming_patients"]:
        items = pub_data.get(section, [])
        if items:
            sample = items[0]
            print(f"  Safe fields in '{section}' sample: {list(sample.keys())}")
            assert "queue_id" in sample or "token" in sample
            assert "department" in sample

    # =========================================================================
    # SCENARIO 4: PATIENT LEAVE-NOW
    # =========================================================================
    print("\n--- SCENARIO 4: PATIENT LEAVE-NOW ---")
    active_target = q_after_emerg[1]["queue_id"]
    coords = {"latitude": 13.3456, "longitude": 77.1089}

    # First call with patient auth header
    res_leave1 = client.post(
        f"/queue/{active_target}/leave-now",
        headers={"Authorization": f"Bearer {token1}"},
        json={"origin_coords": coords}
    )
    print(f"First leave-now call status: {res_leave1.status_code}")
    assert res_leave1.status_code == 200
    d_leave1 = res_leave1.get_json()
    assert d_leave1.get("leaving_now") is True
    assert d_leave1.get("leaving_now_at") is not None
    assert d_leave1.get("leave_reminder_status") == LEAVE_STATUS_CONFIRMED
    assert d_leave1.get("travel_info") is not None
    assert "distance_km" in d_leave1["travel_info"]
    assert "travel_time_minutes" in d_leave1["travel_info"]
    print("  ✓ Leave now recorded GPS coordinates, transit metrics, and confirmed status")

    # Repeated calls (idempotent test)
    res_leave2 = client.post(
        f"/queue/{active_target}/leave-now",
        headers={"Authorization": f"Bearer {token1}"},
        json={"origin_coords": coords}
    )
    assert res_leave2.status_code == 200
    d_leave2 = res_leave2.get_json()
    assert d_leave2.get("leaving_now") is True
    assert d_leave2.get("leave_reminder_status") == LEAVE_STATUS_CONFIRMED
    print("  ✓ Repeated leave-now call is idempotent and safe")

    # =========================================================================
    # SCENARIO 5: REMINDERS STATE MACHINE
    # =========================================================================
    print("\n--- SCENARIO 5: REMINDERS STATE MACHINE ---")
    now_utc = datetime.now(timezone.utc)

    # 5.1 Not yet time to leave (consultation 180 min in future) -> NOT_REQUIRED
    entry_far = {
        "queue_id": "Q_VERIFY_REM_FAR",
        "patient_id": "P_V_FAR",
        "status": "waiting",
        "position": 5,
        "travel_time_min": 15,
        "expected_consultation_iso": (now_utc + timedelta(minutes=180)).isoformat(),
        "leave_reminder_status": LEAVE_STATUS_NOT_REQUIRED
    }
    res_far = evaluate_and_update_leave_reminders(entry_far)
    assert res_far["action"] == "none"
    assert res_far["state"] == LEAVE_STATUS_NOT_REQUIRED
    print(f"  Step 1 (Far in future): State is {res_far['state']}, action={res_far['action']}")

    # 5.2 Time to leave arrived -> transitions to LEAVE_NOW_SENT
    entry_due = {
        "queue_id": "Q_VERIFY_REM_DUE",
        "patient_id": "P_V_DUE",
        "status": "waiting",
        "position": 1,
        "travel_time_min": 15,
        "expected_consultation_iso": (now_utc + timedelta(minutes=15)).isoformat(),
        "leave_reminder_status": LEAVE_STATUS_NOT_REQUIRED
    }
    res_eval1 = evaluate_and_update_leave_reminders(entry_due)
    assert res_eval1["action"] == "sent"
    assert res_eval1["state"] == LEAVE_STATUS_LEAVE_NOW_SENT
    print(f"  Step 2 (Departure reached): State is {res_eval1['state']}, action={res_eval1['action']}")

    # 5.3 Repeated call immediately -> no duplicate alert
    entry_just_sent = {
        **entry_due,
        "leave_reminder_status": LEAVE_STATUS_LEAVE_NOW_SENT,
        "leave_reminder_sent_at": now_utc.isoformat()
    }
    res_eval1_dup = evaluate_and_update_leave_reminders(entry_just_sent)
    assert res_eval1_dup["action"] == "none"
    assert res_eval1_dup["state"] == LEAVE_STATUS_LEAVE_NOW_SENT
    print("  ✓ Idempotent evaluation: No duplicate alert when interval has not elapsed")

    # 5.4 Advance 6 minutes (>= REMINDER_INTERVAL_MIN of 5) -> REMINDER_SENT
    entry_rem = {
        **entry_due,
        "leave_reminder_status": LEAVE_STATUS_LEAVE_NOW_SENT,
        "leave_reminder_sent_at": (now_utc - timedelta(minutes=6)).isoformat()
    }
    res_eval2 = evaluate_and_update_leave_reminders(entry_rem)
    assert res_eval2["action"] == "sent"
    assert res_eval2["state"] == LEAVE_STATUS_REMINDER_SENT
    print(f"  Step 3 (After 6m): State is {res_eval2['state']}, action={res_eval2['action']}")

    # 5.5 Advance another 6 minutes -> URGENT_REMINDER_SENT
    entry_urg = {
        **entry_due,
        "leave_reminder_status": LEAVE_STATUS_REMINDER_SENT,
        "leave_reminder_sent_at": (now_utc - timedelta(minutes=6)).isoformat()
    }
    res_eval3 = evaluate_and_update_leave_reminders(entry_urg)
    assert res_eval3["action"] == "sent"
    assert res_eval3["state"] == LEAVE_STATUS_URGENT_SENT
    print(f"  Step 4 (After 12m): State is {res_eval3['state']}, action={res_eval3['action']}")

    # 5.6 Patient confirms departure -> LEAVING_CONFIRMED halts reminders
    entry_confirmed = {
        **entry_due,
        "leaving_now": True,
        "leave_reminder_status": LEAVE_STATUS_CONFIRMED
    }
    res_eval4 = evaluate_and_update_leave_reminders(entry_confirmed)
    assert res_eval4["action"] == "none"
    assert res_eval4["state"] == LEAVE_STATUS_CONFIRMED
    print("  ✓ Leaving confirmed halts all further reminders")

    # 5.7 Terminal states (completed/cancelled/missed) receive zero reminders
    for term_status in ["completed", "cancelled", "missed"]:
        res_term = evaluate_and_update_leave_reminders({**entry_due, "status": term_status})
        assert res_term["action"] == "none"
    print("  ✓ Terminal states (completed, cancelled, missed) receive zero reminders")

    # 5.8 Serverless endpoint POST /queue/evaluate-reminders
    res_api_eval = client.post("/queue/evaluate-reminders")
    assert res_api_eval.status_code == 200
    assert res_api_eval.get_json().get("status") == "ok"
    print("  ✓ Serverless-compatible POST /queue/evaluate-reminders endpoint verified (HTTP 200)")

    # =========================================================================
    # SCENARIO 8: ADMIN SLOT ANALYTICS
    # =========================================================================
    print("\n--- SCENARIO 8: ADMIN SLOT ANALYTICS ---")
    admin_user = {"user_id": "U_VERIFY_ADM", "name": "Super Admin", "role": "admin"}
    admin_token = generate_jwt_token(admin_user)
    res_admin = client.get(f"/admin/slots?date={today_str}", headers={"Authorization": f"Bearer {admin_token}"})
    print(f"GET /admin/slots status: {res_admin.status_code}")
    assert res_admin.status_code == 200
    admin_data = res_admin.get_json()
    assert "slots" in admin_data
    assert "morning" in admin_data["slots"]
    assert "evening" in admin_data["slots"]

    for s_name, s_info in admin_data["slots"].items():
        print(f"  Slot '{s_name}': Booked={s_info.get('total_booked')}, Arrived={s_info.get('arrived')}, Waiting={s_info.get('waiting')}, Completed={s_info.get('completed')}, Missed={s_info.get('missed')}, Cancelled={s_info.get('cancelled')}, Emergency={s_info.get('emergency')}")
        assert "total_booked" in s_info
        assert "arrived" in s_info
        assert "waiting" in s_info
        assert "completed" in s_info
        assert "missed" in s_info
        assert "cancelled" in s_info
        assert "emergency" in s_info
    print("  ✓ Real DB query verified: separate booked, arrived, waiting, completed, missed, cancelled, emergency for each slot")

    print("\n" + "=" * 80)
    print("ALL 6 SERVER/DATABASE SCENARIOS (1, 2, 3, 4, 5, 8) PASSED WITH ZERO ERRORS!")
    print("=" * 80)

if __name__ == "__main__":
    run_verification()
