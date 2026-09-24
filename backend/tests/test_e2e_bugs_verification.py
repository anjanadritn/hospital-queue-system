import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests
from datetime import datetime, timezone

BASE_URL = "http://localhost:5000"

def test_full_flow():
    print("=== STARTING FULL END-TO-END VERIFICATION OF BUG 1 & BUG 2 ===")

    # Setup: Generate patient JWT token for P001 (Beta Patel) and P002
    from services.auth_service import generate_jwt_token
    token_p001 = generate_jwt_token({"user_id": "P001", "patient_id": "P001", "role": "patient", "name": "Beta Patel"})
    token_p002 = generate_jwt_token({"user_id": "P002", "patient_id": "P002", "role": "patient", "name": "Other Patient"})
    headers_p001 = {"Authorization": f"Bearer {token_p001}", "Content-Type": "application/json"}
    headers_p002 = {"Authorization": f"Bearer {token_p002}", "Content-Type": "application/json"}

    # ----------------------------------------------------
    # TEST 1 & 2: Fresh GPS route calculation & distance variation
    # ----------------------------------------------------
    # Scenario A: User is physically near SIMSRH (Lingapura Tumakuru)
    simsrh_lat, simsrh_lon = 13.3761, 77.0968
    res_near = requests.post(f"{BASE_URL}/travel/calculate", json={
        "origin": "Current GPS Location",
        "origin_latitude": simsrh_lat,
        "origin_longitude": simsrh_lon,
        "expected_consultation_iso": "2026-09-19T14:25:00+05:30",
        "safety_buffer_min": 10
    })
    assert res_near.status_code == 200, f"Expected 200, got {res_near.status_code}"
    data_near = res_near.json()
    print(f"[PASS] 1. Route Calculation near SIMSRH ({simsrh_lat}, {simsrh_lon}):")
    print(f"       Distance: {data_near.get('distance_km')} km, Travel Time: {data_near.get('travel_time_min')} mins, Source: {data_near.get('source')}")
    assert data_near.get('distance_km') <= 0.5, f"Distance near SIMSRH should be <= 0.5 km, got {data_near.get('distance_km')}"
    assert data_near.get('is_approximate_location') is False, "is_approximate_location must be False for GPS"
    assert data_near.get('location_source') == "gps", "location_source must be 'gps'"

    # Scenario B: User is further away in Central Tumakuru (Batawadi)
    batawadi_lat, batawadi_lon = 13.3558, 77.1147
    res_far = requests.post(f"{BASE_URL}/travel/calculate", json={
        "origin": "Current GPS Location",
        "origin_latitude": batawadi_lat,
        "origin_longitude": batawadi_lon,
        "expected_consultation_iso": "2026-09-19T14:25:00+05:30",
        "safety_buffer_min": 10
    })
    assert res_far.status_code == 200
    data_far = res_far.json()
    print(f"[PASS] 2. Route Calculation from Batawadi ({batawadi_lat}, {batawadi_lon}):")
    print(f"       Distance: {data_far.get('distance_km')} km, Travel Time: {data_far.get('travel_time_min')} mins")
    assert data_far.get('distance_km') > data_near.get('distance_km'), "Distance must change with new coordinates"
    assert data_far.get('distance_km') >= 3.0, f"Batawadi distance should be >= 3.0 km, got {data_far.get('distance_km')}"

    # ----------------------------------------------------
    # TEST 3: Fallback landmark calculation when GPS is absent
    # ----------------------------------------------------
    res_fallback = requests.post(f"{BASE_URL}/travel/calculate", json={
        "origin": "Tumkur Bus Stand",
        "expected_consultation_iso": "2026-09-19T14:25:00+05:30",
        "safety_buffer_min": 10
    })
    assert res_fallback.status_code == 200
    data_fallback = res_fallback.json()
    print(f"[PASS] 3. Fallback Landmark Route (Tumkur Bus Stand):")
    print(f"       Distance: {data_fallback.get('distance_km')} km, Approximate: {data_fallback.get('is_approximate_location')}")
    assert data_fallback.get('is_approximate_location') is True

    # ----------------------------------------------------
    # TEST 4: Security & ownership verification on leave-now
    # ----------------------------------------------------
    # Reset D001-Q010 state for testing
    from database.mongodb import get_db
    db = get_db()
    db.queue.update_one(
        {"queue_id": "D001-Q010"},
        {"$set": {
            "leaving_now": False,
            "leaving_now_at": None,
            "leave_reminder_status": "NOT_REQUIRED"
        }}
    )

    # 4a: Unauthenticated request -> 401
    res_unauth = requests.post(f"{BASE_URL}/queue/D001-Q010/leave-now", json={
        "origin_latitude": simsrh_lat,
        "origin_longitude": simsrh_lon
    })
    print(f"[PASS] 4a. Unauthenticated Request -> HTTP {res_unauth.status_code}: {res_unauth.json().get('error')}")
    assert res_unauth.status_code == 401
    assert "Authentication required" in res_unauth.json().get('error')

    # 4b: Unauthorized patient (P002 attempting to leave for P001's queue) -> 403
    res_forbidden = requests.post(f"{BASE_URL}/queue/D001-Q010/leave-now", headers=headers_p002, json={
        "origin_latitude": simsrh_lat,
        "origin_longitude": simsrh_lon
    })
    print(f"[PASS] 4b. Unauthorized Patient Mismatch -> HTTP {res_forbidden.status_code}: {res_forbidden.json().get('error')}")
    assert res_forbidden.status_code == 403
    assert "Unauthorized" in res_forbidden.json().get('error')

    # 4c: Nonexistent queue record -> 404
    res_notfound = requests.post(f"{BASE_URL}/queue/NONEXISTENT-Q999/leave-now", headers=headers_p001, json={
        "origin_latitude": simsrh_lat,
        "origin_longitude": simsrh_lon
    })
    print(f"[PASS] 4c. Nonexistent Queue Record -> HTTP {res_notfound.status_code}: {res_notfound.json().get('error')}")
    assert res_notfound.status_code == 404

    # ----------------------------------------------------
    # TEST 5: Legitimate Patient (P001) confirms leaving now with exact GPS
    # ----------------------------------------------------
    res_leave = requests.post(f"{BASE_URL}/queue/D001-Q010/leave-now", headers=headers_p001, json={
        "origin_latitude": simsrh_lat,
        "origin_longitude": simsrh_lon
    })
    assert res_leave.status_code == 200, f"Expected 200, got {res_leave.status_code}: {res_leave.text}"
    data_leave = res_leave.json()
    print(f"[PASS] 5. Authenticated Patient Leave-Now -> HTTP 200:")
    print(f"       leaving_now: {data_leave.get('queue_entry', {}).get('leaving_now')}")
    print(f"       leaving_now_at: {data_leave.get('queue_entry', {}).get('leaving_now_at')}")
    print(f"       distance_km: {data_leave.get('queue_entry', {}).get('distance_km')}")
    print(f"       expected_arrival: {data_leave.get('queue_entry', {}).get('expected_hospital_arrival')}")

    # Verify MongoDB persistence
    doc = db.queue.find_one({"queue_id": "D001-Q010"})
    assert doc.get("leaving_now") is True, "leaving_now must be True in DB"
    assert doc.get("leaving_now_at") is not None, "leaving_now_at must be persisted"
    assert doc.get("leave_reminder_status") == "LEAVING_CONFIRMED", "status must be LEAVING_CONFIRMED"
    assert doc.get("origin_latitude") == simsrh_lat, f"origin_latitude must be {simsrh_lat}"
    assert doc.get("origin_longitude") == simsrh_lon, f"origin_longitude must be {simsrh_lon}"
    assert doc.get("is_approximate_location") is False, "is_approximate_location must be False"
    assert doc.get("distance_km") == data_near.get('distance_km'), "distance_km must match calculation"

    # Verify Appointments MongoDB persistence
    appt = db.appointments.find_one({"booking_id": doc.get("booking_id")})
    assert appt.get("leaving_now") is True, "appointment leaving_now must be True"
    assert appt.get("leaving_now_at") is not None, "appointment leaving_now_at must be persisted"

    # ----------------------------------------------------
    # TEST 6: Idempotent repeat click
    # ----------------------------------------------------
    res_repeat = requests.post(f"{BASE_URL}/queue/D001-Q010/leave-now", headers=headers_p001, json={
        "origin_latitude": simsrh_lat,
        "origin_longitude": simsrh_lon
    })
    assert res_repeat.status_code == 200, f"Repeat click should succeed idempotently with 200, got {res_repeat.status_code}"
    data_repeat = res_repeat.json()
    print(f"[PASS] 6. Idempotent Repeat Leave-Now -> HTTP 200:")
    print(f"       leaving_now: {data_repeat.get('queue_entry', {}).get('leaving_now')}")
    print(f"       leaving_now_at: {data_repeat.get('queue_entry', {}).get('leaving_now_at')}")

    print("\n=======================================================")
    print("ALL 6 END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY")
    print("=======================================================")

if __name__ == "__main__":
    test_full_flow()
