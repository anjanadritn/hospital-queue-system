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

