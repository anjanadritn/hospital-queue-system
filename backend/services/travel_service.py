import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from services.location_service import location_service

logger = logging.getLogger(__name__)

# Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)
HOSPITAL_NAME = "Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH)"
HOSPITAL_DESTINATION = "Sira Road, NH4, Lingapura, Tumakuru, Karnataka – 572106"
HOSPITAL_WEBSITE = "https://shridevmedical.org/"
# Hospital coordinates in [longitude, latitude] format for OpenRouteService
HOSPITAL_COORDINATES = [77.096826, 13.376059]

# Tumkur landmarks with static fallback metrics and [longitude, latitude] coordinates
TUMKUR_LANDMARKS = {
    "Tumkur Bus Stand": {"distance_km": 7.2, "travel_time_min": 20, "coordinates": [77.1011, 13.3392]},
    "Batawadi": {"distance_km": 5.5, "travel_time_min": 15, "coordinates": [77.1147, 13.3558]},
    "Kyatsandra": {"distance_km": 9.8, "travel_time_min": 24, "coordinates": [77.1620, 13.3310]},
    "SSIT Campus": {"distance_km": 6.8, "travel_time_min": 18, "coordinates": [77.1192, 13.3242]},
    "Sira Gate": {"distance_km": 4.2, "travel_time_min": 12, "coordinates": [77.0872, 13.3567]},
    "Gubbi Gate": {"distance_km": 8.0, "travel_time_min": 22, "coordinates": [77.0984, 13.3325]},
    "Tumkur Railway Station": {"distance_km": 7.5, "travel_time_min": 20, "coordinates": [77.1065, 13.3435]},
    "B.H. Road Tumkur": {"distance_km": 6.1, "travel_time_min": 16, "coordinates": [77.1025, 13.3410]},
    "Siddaganga Matha": {"distance_km": 11.2, "travel_time_min": 28, "coordinates": [77.1425, 13.3167]}
}

DEFAULT_ORIGIN_COORDINATES = [77.1000, 13.3400]  # Central Tumakuru

def calculate_travel_metrics(
    patient_address: str = "Tumkur City",
    expected_consultation_iso: str = None,
    safety_buffer_min: int = 10,
    wait_time_min: int = None,
    origin_coords: Optional[List[float]] = None
) -> Dict:
    """
    Smart Patient Arrival & Recommended Departure Time Engine:
    Destination: Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH), Lingapura, Tumakuru.
    Formula: Recommended Departure Time = Expected Consultation Start - Travel Duration - Safety Buffer

    Queries OpenRouteService for real road distance, travel duration, and GeoJSON geometry.
    Falls back gracefully to TUMKUR_LANDMARKS static lookup if ORS is unreachable.
    """
    matched = None
    has_gps = bool(
        origin_coords 
        and len(origin_coords) == 2 
        and origin_coords[0] is not None 
        and origin_coords[1] is not None
    )

    if has_gps:
        target_coords = [float(origin_coords[0]), float(origin_coords[1])]
        origin_lat = float(origin_coords[1])
        origin_lon = float(origin_coords[0])
        is_approximate = False
        location_source = "gps"
    else:
        target_coords = None
        origin_lat = None
        origin_lon = None
        is_approximate = True
        location_source = "landmark_approximate"

    if not has_gps and patient_address:
        for landmark, data in TUMKUR_LANDMARKS.items():
            if landmark.lower() in str(patient_address).lower() or str(patient_address).lower() in landmark.lower():
                matched = data
                if not target_coords and "coordinates" in data:
                    target_coords = data["coordinates"]
                break

    if not target_coords:
        target_coords = DEFAULT_ORIGIN_COORDINATES

    # Attempt real routing with OpenRouteService using exact patient coordinates
    route_data = None
    try:
        route_data = location_service.get_route_directions(
            origin_coords=target_coords,
            destination_coords=HOSPITAL_COORDINATES,
            timeout_sec=6.0
        )
    except Exception as ex:
        logger.warning(f"Error requesting OpenRouteService directions: {ex}")

    if route_data:
        distance_km = route_data["distance_km"]
        travel_time_min = route_data["travel_time_min"]
        route_geometry = route_data.get("route_geometry")
        source = "openrouteservice"
    else:
        # Offline fallback: if GPS was provided, compute road distance from patient's exact coordinates
        if has_gps:
            import math
            R = 6371.0
            dlat = math.radians(HOSPITAL_COORDINATES[1] - origin_lat)
            dlon = math.radians(HOSPITAL_COORDINATES[0] - origin_lon)
            a = math.sin(dlat / 2)**2 + math.cos(math.radians(origin_lat)) * math.cos(math.radians(HOSPITAL_COORDINATES[1])) * math.sin(dlon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            direct_dist = R * c
            distance_km = round(max(0.5, direct_dist * 1.35), 1)
            travel_time_min = max(3, int(round(distance_km * 2.5)))
            route_geometry = None
            source = "gps_offline_estimate"
        elif matched:
            distance_km = matched["distance_km"]
            travel_time_min = matched["travel_time_min"]
            route_geometry = None
            source = "fallback"
        else:
            distance_km = 6.4
            travel_time_min = 18
            route_geometry = None
            source = "fallback"

    now = datetime.now(timezone.utc)

    if wait_time_min is not None and int(wait_time_min) > 0:
        consultation_dt = now + timedelta(minutes=int(wait_time_min))
    elif expected_consultation_iso:
        try:
            consultation_dt = datetime.fromisoformat(expected_consultation_iso.replace("Z", "+00:00"))
        except Exception:
            consultation_dt = now + timedelta(minutes=35)
    else:
        consultation_dt = now + timedelta(minutes=35)

    arrival_dt = consultation_dt - timedelta(minutes=safety_buffer_min)
    departure_dt = arrival_dt - timedelta(minutes=travel_time_min)

    consultation_str = consultation_dt.strftime("%I:%M %p")
    arrival_str = arrival_dt.strftime("%I:%M %p")
    departure_str = departure_dt.strftime("%I:%M %p")

    return {
        "hospital_name": HOSPITAL_NAME,
        "hospital_location": HOSPITAL_DESTINATION,
        "hospital_website": HOSPITAL_WEBSITE,
        "hospital_coordinates": HOSPITAL_COORDINATES,
        "origin_coordinates": target_coords,
        "origin_latitude": origin_lat,
        "origin_longitude": origin_lon,
        "is_approximate_location": is_approximate,
        "location_source": location_source,
        "emergency_care": "24/7 Emergency Care Available",
        "patient_address": patient_address or "Tumkur City",
        "distance_km": distance_km,
        "travel_time_min": travel_time_min,
        "safety_buffer_min": safety_buffer_min,
        "expected_consultation_time": consultation_str,
        "expected_consultation_iso": consultation_dt.isoformat(),
        "expected_hospital_arrival": arrival_str,
        "recommended_departure_time": departure_str,
        "recommended_departure_iso": departure_dt.isoformat(),
        "departure_alert": f"🚗 Start from {patient_address} around {departure_str} to arrive at SIMSRH ~{safety_buffer_min} mins before your consultation at {consultation_str}.",
        "route_geometry": route_geometry,
        "source": source
    }
