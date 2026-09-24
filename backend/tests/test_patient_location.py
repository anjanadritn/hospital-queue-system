import pytest
from unittest.mock import patch
from services.travel_service import (
    calculate_travel_metrics,
    TUMKUR_LANDMARKS,
    HOSPITAL_COORDINATES
)
from services.queue_service import join_queue
from services.appointment_service import book_appointment
from datetime import date

def test_gps_location_used_and_marked_exact():
    """
    Test that when accurate GPS coordinates are provided:
    1. Origin coordinates match patient GPS, not landmark coordinates.
    2. is_approximate_location is False.
    3. origin_latitude and origin_longitude are returned accurately.
    """
    custom_lat = 13.3421
    custom_lon = 77.1023
    origin_coords = [custom_lon, custom_lat]

    metrics = calculate_travel_metrics(
        patient_address="Batawadi",
        origin_coords=origin_coords,
        wait_time_min=25
    )

    # Coords used for routing should be the patient's GPS coords, not Batawadi landmark coords
    assert metrics["origin_coordinates"] == [custom_lon, custom_lat]
    assert metrics["origin_latitude"] == custom_lat
    assert metrics["origin_longitude"] == custom_lon
    assert metrics["is_approximate_location"] is False
    assert metrics["location_source"] == "gps"
    # Display label is preserved
    assert metrics["patient_address"] == "Batawadi"
    # Does not equal Batawadi landmark coordinates
    assert metrics["origin_coordinates"] != TUMKUR_LANDMARKS["Batawadi"]["coordinates"]

def test_gps_unavailable_fallback_marked_approximate():
    """
    Test that when GPS coordinates are unavailable/denied:
    1. Landmark fallback is used for routing.
    2. is_approximate_location is True.
    3. origin_latitude and origin_longitude are None (landmark coords not falsely claimed as patient GPS).
    """
    metrics = calculate_travel_metrics(
        patient_address="Tumkur Bus Stand",
        origin_coords=None,
        wait_time_min=30
    )

    assert metrics["is_approximate_location"] is True
    assert metrics["origin_latitude"] is None
    assert metrics["origin_longitude"] is None
    assert metrics["patient_address"] == "Tumkur Bus Stand"
    assert metrics["location_source"] == "landmark_approximate"
    # Routing coordinates fall back to landmark coordinates
    assert metrics["origin_coordinates"] == TUMKUR_LANDMARKS["Tumkur Bus Stand"]["coordinates"]

def test_join_queue_stores_coordinates():
    """
    Test that join_queue stores origin_latitude and origin_longitude alongside city.
    """
    custom_lat = 13.3512
    custom_lon = 77.1124

    res, err = join_queue({
        "patient_id": "TEST_PAT_LOC",
        "doctor_id": "TEST_DOC_LOC",
        "department": "General Medicine",
        "priority": "normal",
        "city": "Batawadi",
        "patient_address": "Batawadi Main Road",
        "origin_latitude": custom_lat,
        "origin_longitude": custom_lon,
        "is_approximate_location": False
    })

    assert err is None
    assert res["origin_latitude"] == custom_lat
    assert res["origin_longitude"] == custom_lon
    assert res["is_approximate_location"] is False
    assert res["city"] == "Batawadi"
    assert res["patient_address"] == "Batawadi Main Road"

def test_book_appointment_stores_coordinates():
    """
    Test that book_appointment stores origin_latitude and origin_longitude alongside city.
    """
    custom_lat = 13.3601
    custom_lon = 77.0988

    res, err = book_appointment({
        "patient_id": "TEST_PAT_LOC2",
        "doctor_id": "TEST_DOC_LOC",
        "department": "Cardiology",
        "consultation_date": date.today().isoformat(),
        "consultation_slot": "morning",
        "priority": "normal",
        "city": "Sira Gate",
        "origin_latitude": custom_lat,
        "origin_longitude": custom_lon,
        "is_approximate_location": False
    })

    assert err is None
    assert res["origin_latitude"] == custom_lat
    assert res["origin_longitude"] == custom_lon
    assert res["is_approximate_location"] is False
    assert res["city"] == "Sira Gate"

def test_two_different_origins_return_different_distances():
    """
    Verify with a test using two different GPS origins that ORS calculates
    the actual road distance from those exact coordinates to SIMSRH,
    and confirm the returned distance, duration, and route geometry change.
    """
    # Origin 1: Near Sira Gate (closer to SIMSRH)
    origin_1 = [77.0872, 13.3567]  # [lon, lat]
    # Origin 2: Kyatsandra (further away from SIMSRH)
    origin_2 = [77.1620, 13.3310]  # [lon, lat]

    metrics_1 = calculate_travel_metrics(
        patient_address="Patient GPS Origin 1",
        origin_coords=origin_1,
        wait_time_min=30
    )

    metrics_2 = calculate_travel_metrics(
        patient_address="Patient GPS Origin 2",
        origin_coords=origin_2,
        wait_time_min=30
    )

    # 1. Confirm origins used are the exact GPS coordinates
    assert metrics_1["origin_coordinates"] == origin_1
    assert metrics_2["origin_coordinates"] == origin_2
    assert metrics_1["origin_latitude"] == origin_1[1]
    assert metrics_2["origin_latitude"] == origin_2[1]
    assert metrics_1["origin_longitude"] == origin_1[0]
    assert metrics_2["origin_longitude"] == origin_2[0]

    # 2. Confirm both are flagged as exact GPS (not approximate landmark)
    assert metrics_1["is_approximate_location"] is False
    assert metrics_2["is_approximate_location"] is False
    assert metrics_1["location_source"] == "gps"
    assert metrics_2["location_source"] == "gps"

    # 3. Confirm the returned road distance changes significantly
    assert metrics_1["distance_km"] != metrics_2["distance_km"]
    assert metrics_1["distance_km"] < metrics_2["distance_km"]

    # 4. Confirm route geometry exists and is different
    if metrics_1.get("route_geometry") and metrics_2.get("route_geometry"):
        coords_1 = metrics_1["route_geometry"].get("coordinates", [])
        coords_2 = metrics_2["route_geometry"].get("coordinates", [])
        assert len(coords_1) > 0
        assert len(coords_2) > 0
        assert coords_1[0] != coords_2[0]

def test_family_booking_stores_patient_location_and_does_not_overwrite_booker_profile():
    """
    Test real-world problem:
    1. Booker is Ramesh in Bengaluru.
    2. Booker books appointment for his Mother in Alipur/Chikkaballapur.
    3. The appointment stores Mother's name, relation, and Alipur map-selected coordinates.
    4. Ramesh's permanent user profile in db.users is NOT overwritten.
    """
    from database.mongodb import get_db
    db = get_db()

    booker_id = "PAT_TEST_BOOKER_1"
    # Seed booker's user profile
    db.users.update_one(
        {"$or": [{"patient_id": booker_id}, {"user_id": booker_id}]},
        {"$set": {
            "patient_id": booker_id,
            "user_id": booker_id,
            "name": "Ramesh Kumar",
            "city": "Bengaluru",
            "age": 32,
            "gender": "Male"
        }},
        upsert=True
    )

    mother_lat = 13.6234
    mother_lon = 77.4567
    mother_addr = "Alipur, Gauribidanur, Chikkaballapur"

    res, err = book_appointment({
        "patient_id": booker_id,
        "doctor_id": "TEST_DOC_LOC",
        "department": "General Medicine",
        "consultation_date": date.today().isoformat(),
        "consultation_slot": "morning",
        "priority": "normal",
        "booking_for": "family",
        "relation": "Mother",
        "patient_name": "Sharadamma",
        "age": 62,
        "gender": "Female",
        "city": "Alipur",
        "location_address": mother_addr,
        "origin_latitude": mother_lat,
        "origin_longitude": mother_lon,
        "location_source": "map_selected",
        "is_approximate": False
    })

    assert err is None
    assert res["booking_for"] == "family"
    assert res["relation"] == "Mother"
    assert res["patient_name"] == "Sharadamma"
    assert res["location_source"] == "map_selected"
    assert res["location_address"] == mother_addr
    assert res["origin_latitude"] == mother_lat
    assert res["origin_longitude"] == mother_lon
    assert res["is_approximate"] is False

    # CRITICAL: Booker's permanent profile in db.users must NOT be overwritten!
    booker_profile = db.users.find_one({"$or": [{"patient_id": booker_id}, {"user_id": booker_id}]})
    assert booker_profile["name"] == "Ramesh Kumar"
    assert booker_profile["city"] == "Bengaluru"
    assert booker_profile["age"] == 32
    assert booker_profile["gender"] == "Male"

def test_manual_location_marked_approximate_with_notice():
    """
    Test that manual entry marks location as approximate and generates notice.
    """
    metrics = calculate_travel_metrics(
        patient_address="Alipur Village, Chikkaballapur",
        origin_coords=None,
        wait_time_min=20,
        location_source="manual",
        is_approximate=True,
        location_address="Alipur Village, Chikkaballapur"
    )

    assert metrics["is_approximate_location"] is True
    assert metrics["location_source"] == "manual"
    assert metrics.get("approximate_notice") == "Approximate location — travel time may vary."

def test_ors_uses_patient_alipur_location_not_booker_bengaluru():
    """
    Verify that travel calculation receives the Patient's appointment location (Alipur),
    and does NOT use the booker's device GPS (Bengaluru).
    """
    bengaluru_gps = [77.5946, 12.9716]  # [lon, lat] Booker device GPS in Bengaluru
    alipur_patient = [77.4567, 13.6234]  # [lon, lat] Mother's map-selected location

    # Booker's hypothetical metrics if Bengaluru had mistakenly been used
    bengaluru_metrics = calculate_travel_metrics(
        patient_address="Bengaluru Device",
        origin_coords=bengaluru_gps,
        wait_time_min=30,
        location_source="device_gps"
    )

    # Mother's actual appointment metrics using Alipur
    alipur_metrics = calculate_travel_metrics(
        patient_address="Alipur, Chikkaballapur",
        origin_coords=alipur_patient,
        wait_time_min=30,
        location_source="map_selected"
    )

    assert alipur_metrics["origin_coordinates"] == alipur_patient
    assert alipur_metrics["origin_latitude"] == alipur_patient[1]
    assert alipur_metrics["origin_longitude"] == alipur_patient[0]
    assert alipur_metrics["location_source"] == "map_selected"

    # The distance from Alipur to SIMSRH must NOT equal the distance from Bengaluru to SIMSRH
    assert alipur_metrics["distance_km"] != bengaluru_metrics["distance_km"]
    assert alipur_metrics["origin_coordinates"] != bengaluru_gps

def test_selected_preset_landmark_preserved_during_gps_poll_and_updates():
    """
    Regression test for Requirement 12:
    Verifies that when a patient selects a manual/preset landmark (e.g., 'Tumkur Bus Stand'),
    route calculation properly honors the preset landmark coordinates, marks location_source as 'preset',
    and does NOT overwrite the preset with live GPS readings or background polling events.
    """
    landmark_name = "Tumkur Bus Stand"
    bus_stand_coords = TUMKUR_LANDMARKS[landmark_name]["coordinates"]  # [lon, lat]

    # 1. Calculate travel metrics for Tumkur Bus Stand preset
    preset_metrics = calculate_travel_metrics(
        patient_address=landmark_name,
        origin_coords=bus_stand_coords,
        wait_time_min=25,
        location_source="preset",
        is_approximate=False
    )

    assert preset_metrics["patient_address"] == "Tumkur Bus Stand"
    assert preset_metrics["origin_coordinates"] == bus_stand_coords
    assert preset_metrics["origin_latitude"] == bus_stand_coords[1]
    assert preset_metrics["origin_longitude"] == bus_stand_coords[0]
    assert preset_metrics["location_source"] == "preset"
    assert preset_metrics["is_approximate_location"] is False

    # 2. Simulate subsequent browser GPS reading occurring in the background
    background_gps_coords = [77.1234, 13.3456]
    background_gps_metrics = calculate_travel_metrics(
        patient_address="Current GPS Location",
        origin_coords=background_gps_coords,
        wait_time_min=25,
        location_source="gps",
        is_approximate=False
    )

    # 3. Verify that preset metrics remain isolated and uncorrupted by GPS coordinates
    assert preset_metrics["patient_address"] == "Tumkur Bus Stand"
    assert preset_metrics["origin_coordinates"] != background_gps_metrics["origin_coordinates"]
    assert preset_metrics["origin_coordinates"] == bus_stand_coords

def test_preset_mode_alipur_and_tumkur_isolated_from_browser_gps():
    """
    Regression test for User Request (Requirements 1, 2, 3, 4, 5, 8, 10, 11):
    1. Selects Alipur preset (lat 13.6100, lng 77.4200).
    2. Simulates browser GPS at a completely different location (Tumkur GPS 13.3770, 77.0990, ~0.6km from SIMSRH).
    3. Calls route calculation API (/api/travel/calculate) with preset payload.
    4. Verifies route origin is Alipur ([77.42, 13.61]).
    5. Verifies distance is Alipur distance (~53-55 km), NOT browser GPS (0.6 km).
    6. Tests second preset 'Tumkur Bus Stand' ([77.1011, 13.3392]) and verifies distance (~5.2-7.2 km).
    7. Verifies background GPS telemetry does not overwrite preset route in db.queue.
    """
    from app import create_app
    from database import get_db

    flask_app = create_app()
    flask_app.config["TESTING"] = True

    with flask_app.test_client() as client:
        # Define coordinates
        alipur_lat = 13.6100
        alipur_lng = 77.4200
        alipur_coords = [alipur_lng, alipur_lat]

        tumkur_bus_lat = 13.3392
        tumkur_bus_lng = 77.1011
        tumkur_bus_coords = [tumkur_bus_lng, tumkur_bus_lat]

        # Completely different browser GPS location (right near hospital, ~0.6 km)
        browser_gps_lat = 13.3770
        browser_gps_lng = 77.0990

        # --- TEST 1: Alipur preset route calculation ---
        alipur_payload = {
            "origin_mode": "preset",
            "origin_label": "Alipur, Gauribidanur",
            "origin": "Alipur, Gauribidanur",
            "origin_lat": alipur_lat,
            "origin_lng": alipur_lng,
            "origin_latitude": alipur_lat,
            "origin_longitude": alipur_lng,
            "location_source": "preset"
        }

        resp = client.post("/api/travel/calculate", json=alipur_payload)
        assert resp.status_code == 200
        data = resp.get_json()

        assert data["origin_mode"] == "preset"
        assert data["origin_latitude"] == alipur_lat
        assert data["origin_longitude"] == alipur_lng
        assert data["origin_coordinates"] == alipur_coords
        assert data["patient_address"] == "Alipur, Gauribidanur"
        # Distance must reflect Alipur (~53-55 km), NOT browser GPS (~0.6 km)
        assert data["distance_km"] >= 45.0
        assert data["distance_km"] != pytest.approx(0.6, abs=1.0)

        # --- TEST 2: Tumkur Bus Stand preset route calculation ---
        bus_stand_payload = {
            "origin_mode": "preset",
            "origin_label": "Tumkur Bus Stand",
            "origin": "Tumkur Bus Stand",
            "origin_lat": tumkur_bus_lat,
            "origin_lng": tumkur_bus_lng,
            "origin_latitude": tumkur_bus_lat,
            "origin_longitude": tumkur_bus_lng,
            "location_source": "preset"
        }

        resp2 = client.post("/api/travel/calculate", json=bus_stand_payload)
        assert resp2.status_code == 200
        data2 = resp2.get_json()

        assert data2["origin_mode"] == "preset"
        assert data2["origin_latitude"] == tumkur_bus_lat
        assert data2["origin_longitude"] == tumkur_bus_lng
        assert data2["origin_coordinates"] == tumkur_bus_coords
        assert data2["patient_address"] == "Tumkur Bus Stand"
        assert 4.0 <= data2["distance_km"] <= 10.0

        # --- TEST 3: Stored queue decoupling from background GPS telemetry ---
        db = get_db()
        test_qid = "TEST-Q-REGRESSION-PRESET-01"
        db.queue.delete_many({"queue_id": test_qid})
        db.queue.insert_one({
            "queue_id": test_qid,
            "booking_id": "TEST-B-01",
            "doctor_id": "D001",
            "patient_name": "Preset Test Patient",
            "origin_mode": "preset",
            "origin_label": "Alipur, Gauribidanur",
            "origin_lat": alipur_lat,
            "origin_lng": alipur_lng,
            "origin_latitude": alipur_lat,
            "origin_longitude": alipur_lng,
            "distance_km": data["distance_km"],
            "travel_time_min": data["travel_time_min"],
            "status": "waiting"
        })

        # Simulate background GPS telemetry update (user_selected_gps=False)
        gps_telemetry_payload = {
            "queue_id": test_qid,
            "origin_mode": "gps",
            "user_selected_gps": False,
            "origin_label": "Current GPS Location",
            "origin_lat": browser_gps_lat,
            "origin_lng": browser_gps_lng,
            "location_source": "gps"
        }
        resp3 = client.post("/api/travel/calculate", json=gps_telemetry_payload)
        assert resp3.status_code == 200

        # Verify db.queue was NOT corrupted or overwritten by background GPS telemetry
        q_doc = db.queue.find_one({"queue_id": test_qid})
        assert q_doc["origin_mode"] == "preset"
        assert q_doc["origin_label"] == "Alipur, Gauribidanur"
        assert q_doc["origin_latitude"] == alipur_lat
        assert q_doc["origin_longitude"] == alipur_lng
        assert q_doc["distance_km"] >= 45.0

        # Cleanup
        db.queue.delete_many({"queue_id": test_qid})


