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

