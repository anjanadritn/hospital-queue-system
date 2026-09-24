import pytest
from unittest.mock import patch
from services.location_service import location_service
from services.travel_service import (
    calculate_travel_metrics,
    TUMKUR_LANDMARKS,
    HOSPITAL_COORDINATES
)

def test_location_service_ors_returns_route_and_geometry():
    """
    Test that LocationService connects to OpenRouteService and returns
    road distance, duration, and GeoJSON LineString geometry using [longitude, latitude].
    """
    origin = [77.1011, 13.3392]  # Tumkur Bus Stand [lon, lat]
    dest = HOSPITAL_COORDINATES   # SIMSRH [lon, lat]

    res = location_service.get_route_directions(origin, dest, timeout_sec=6.0)
    if res is not None:
        assert res["source"] == "openrouteservice"
        assert res["distance_km"] > 0
        assert res["travel_time_min"] > 0
        assert "route_geometry" in res
        geom = res["route_geometry"]
        assert geom.get("type") == "LineString"
        assert isinstance(geom.get("coordinates"), list)
        assert len(geom["coordinates"]) > 0
        # Verify coordinates order is [longitude, latitude] (~77 E, ~13 N)
        first_pt = geom["coordinates"][0]
        assert 76.0 < first_pt[0] < 78.5  # Longitude
        assert 12.5 < first_pt[1] < 14.5  # Latitude

def test_travel_service_metrics_structure():
    """
    Test that calculate_travel_metrics returns all required fields for patient tracking.
    """
    metrics = calculate_travel_metrics(
        patient_address="Batawadi",
        safety_buffer_min=10,
        wait_time_min=30
    )

    assert metrics["hospital_name"] == "Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)"
    assert metrics["patient_address"] == "Batawadi"
    assert metrics["distance_km"] > 0
    assert metrics["travel_time_min"] > 0
    assert metrics["safety_buffer_min"] == 10
    assert "recommended_departure_time" in metrics
    assert "departure_alert" in metrics
    assert metrics["source"] in ["openrouteservice", "fallback"]

def test_travel_service_offline_fallback():
    """
    Test that if OpenRouteService fails or times out,
    calculate_travel_metrics seamlessly falls back to the static TUMKUR_LANDMARKS table.
    """
    with patch.object(location_service, "get_route_directions", return_value=None):
        metrics = calculate_travel_metrics(
            patient_address="Tumkur Bus Stand",
            safety_buffer_min=10,
            wait_time_min=45
        )

        assert metrics["source"] == "fallback"
        assert metrics["distance_km"] == TUMKUR_LANDMARKS["Tumkur Bus Stand"]["distance_km"]
        assert metrics["travel_time_min"] == TUMKUR_LANDMARKS["Tumkur Bus Stand"]["travel_time_min"]
        assert metrics["route_geometry"] is None
        assert "recommended_departure_time" in metrics
