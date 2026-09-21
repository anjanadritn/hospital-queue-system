import logging
from datetime import datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    HOSPITAL_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    HOSPITAL_TZ = timezone(timedelta(hours=5, minutes=30))
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
    "Siddaganga Matha": {"distance_km": 11.2, "travel_time_min": 28, "coordinates": [77.1425, 13.3167]},
    "Alipur, Gauribidanur": {"distance_km": 53.0, "travel_time_min": 52, "coordinates": [77.4200, 13.6100]},
    "Alipur": {"distance_km": 53.0, "travel_time_min": 52, "coordinates": [77.4200, 13.6100]}
}

DEFAULT_ORIGIN_COORDINATES = [77.1000, 13.3400]  # Central Tumakuru

def calculate_travel_metrics(
    patient_address: str = "Tumkur City",
    expected_consultation_iso: str = None,
    safety_buffer_min: int = 10,
    wait_time_min: int = None,
    origin_coords: Optional[List[float]] = None,
    leaving_now: bool = False,
    leaving_now_at: Optional[str] = None,
    location_source: Optional[str] = None,
    is_approximate: Optional[bool] = None,
    location_address: Optional[str] = None,
    origin_mode: Optional[str] = None,
    origin_lat: Optional[float] = None,
    origin_lng: Optional[float] = None,
    origin_label: Optional[str] = None
) -> Dict:
    """
    Smart Patient Arrival & Recommended Departure Time Engine:
    Destination: Shridevi Institute of Medical Sciences and Research Hospital (SIMSRH), Lingapura, Tumakuru.
    Formula: Recommended Departure Time = Expected Consultation Start - Travel Duration - Safety Buffer

    Queries OpenRouteService for real road distance, travel duration, and GeoJSON geometry.
    Falls back gracefully to TUMKUR_LANDMARKS static lookup if ORS is unreachable.
    Supports patient-specific location sources: device_gps, map_selected, manual, gps, preset, landmark_approximate.
    """
    matched = None

    # Harmonize explicit origin_mode ("gps" or "preset")
    mode = str(origin_mode or "").strip().lower()
    if not mode:
        if location_source == "preset":
            mode = "preset"
        elif location_source in ["gps", "device_gps"]:
            mode = "gps"

    # Harmonize explicit origin_lat / origin_lng coordinates
    if origin_lat is not None and origin_lng is not None:
        try:
            origin_coords = [float(origin_lng), float(origin_lat)]
        except (ValueError, TypeError):
            pass

    # If preset mode, ensure coordinates are populated from TUMKUR_LANDMARKS if missing
    if mode == "preset":
        location_source = "preset"
        resolved_approximate = False
        resolved_source = "preset"
        search_name = origin_label or location_address or patient_address or ""
        if not origin_coords or origin_coords[0] is None or origin_coords[1] is None:
            for landmark, data in TUMKUR_LANDMARKS.items():
                if landmark.lower() in search_name.lower() or search_name.lower() in landmark.lower():
                    matched = data
                    if "coordinates" in data:
                        origin_coords = data["coordinates"]
                    break

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
        if mode == "preset":
            resolved_approximate = False
            resolved_source = "preset"
        elif is_approximate is not None:
            resolved_approximate = bool(is_approximate)
            resolved_source = location_source or "gps"
        else:
            resolved_approximate = (location_source == "manual")
            resolved_source = location_source or "gps"
    else:
        target_coords = None
        origin_lat = None
        origin_lon = None
        resolved_approximate = True
        resolved_source = location_source or "landmark_approximate"

    if not has_gps and patient_address:
        for landmark, data in TUMKUR_LANDMARKS.items():
            if landmark.lower() in str(patient_address).lower() or str(patient_address).lower() in landmark.lower():
                matched = data
                if not target_coords and "coordinates" in data:
                    target_coords = data["coordinates"]
                break

    if not target_coords:
        target_coords = DEFAULT_ORIGIN_COORDINATES

    if target_coords and (origin_lat is None or origin_lon is None):
        origin_lon = float(target_coords[0])
        origin_lat = float(target_coords[1])

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

    now = datetime.now(HOSPITAL_TZ)

    if expected_consultation_iso:
        try:
            consultation_dt = datetime.fromisoformat(expected_consultation_iso.replace("Z", "+00:00"))
            if consultation_dt.tzinfo is not None:
                consultation_dt = consultation_dt.astimezone(HOSPITAL_TZ)
            else:
                consultation_dt = consultation_dt.replace(tzinfo=HOSPITAL_TZ)
        except Exception:
            consultation_dt = now + timedelta(minutes=35)
    elif wait_time_min is not None and int(wait_time_min) > 0:
        consultation_dt = now + timedelta(minutes=int(wait_time_min))
    else:
        consultation_dt = now + timedelta(minutes=35)

    rec_departure_dt = consultation_dt - timedelta(minutes=travel_time_min + safety_buffer_min)

    # Dynamic Arrival Logic:
    # 1. Departed -> Departure Time + Live Travel Duration
    # 2. Not Departed & Recommended Departure Passed -> Current Time + Live Travel Duration
    # 3. On Schedule -> Recommended Departure + Live Travel Duration (Consultation - Safety Buffer)
    if leaving_now:
        dep_time = now
        if leaving_now_at:
            try:
                pdt = datetime.fromisoformat(str(leaving_now_at).replace("Z", "+00:00"))
                dep_time = pdt if pdt.tzinfo else pdt.replace(tzinfo=HOSPITAL_TZ)
                dep_time = dep_time.astimezone(HOSPITAL_TZ)
            except Exception:
                dep_time = now
        arrival_dt = dep_time + timedelta(minutes=travel_time_min)
        departure_dt = dep_time
        alert_msg = f"🚗 En route to SIMSRH from {patient_address or 'your location'}. Expected arrival around {arrival_dt.strftime('%I:%M %p')}."
    elif now >= rec_departure_dt:
        arrival_dt = now + timedelta(minutes=travel_time_min)
        departure_dt = rec_departure_dt
        alert_msg = f"🚗 Depart immediately from {patient_address or 'your location'} (recommended departure was {departure_dt.strftime('%I:%M %p')}, travel: {travel_time_min} mins) to arrive at SIMSRH around {arrival_dt.strftime('%I:%M %p')} for your consultation at {consultation_dt.strftime('%I:%M %p')}."
    else:
        arrival_dt = rec_departure_dt + timedelta(minutes=travel_time_min)
        departure_dt = rec_departure_dt
        alert_msg = f"🚗 Start from {patient_address or 'your location'} around {departure_dt.strftime('%I:%M %p')} to arrive at SIMSRH ~{safety_buffer_min} mins before your consultation at {consultation_dt.strftime('%I:%M %p')}."

    arrival_deadline_dt = arrival_dt + timedelta(minutes=2)

    consultation_str = consultation_dt.strftime("%I:%M %p")
    arrival_str = arrival_dt.strftime("%I:%M %p")
    departure_str = departure_dt.strftime("%I:%M %p")
    arrival_deadline_str = arrival_deadline_dt.strftime("%I:%M %p")

    return {
        "hospital_name": HOSPITAL_NAME,
        "hospital_location": HOSPITAL_DESTINATION,
        "hospital_website": HOSPITAL_WEBSITE,
        "hospital_coordinates": HOSPITAL_COORDINATES,
        "origin_coordinates": target_coords,
        "origin_latitude": origin_lat,
        "origin_longitude": origin_lon,
        "is_approximate_location": resolved_approximate,
        "is_approximate": resolved_approximate,
        "location_source": resolved_source,
        "location_address": location_address or patient_address or "Tumkur City",
        "approximate_notice": "Approximate location — travel time may vary." if resolved_approximate else None,
        "emergency_care": "24/7 Emergency Care Available",
        "patient_address": patient_address or "Tumkur City",
        "distance_km": distance_km,
        "travel_time_min": travel_time_min,
        "travel_time_minutes": travel_time_min,
        "safety_buffer_min": safety_buffer_min,
        "expected_consultation_time": consultation_str,
        "expected_consultation_iso": consultation_dt.isoformat(),
        "expected_hospital_arrival": arrival_str,
        "expected_hospital_arrival_iso": arrival_dt.isoformat(),
        "arrival_deadline_time": arrival_deadline_str,
        "arrival_deadline_iso": arrival_deadline_dt.isoformat(),
        "recommended_departure_time": departure_str,
        "recommended_departure_iso": departure_dt.isoformat(),
        "departure_alert": alert_msg,
        "route_geometry": route_geometry,
        "source": source,
        "leaving_now": leaving_now,
        "leaving_now_at": leaving_now_at,
        "origin_mode": mode or resolved_source,
        "origin_lat": origin_lat,
        "origin_lng": origin_lon,
        "origin_label": origin_label or location_address or patient_address or "Tumkur City"
    }
