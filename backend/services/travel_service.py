from datetime import datetime, timedelta, timezone
from typing import Dict

def calculate_travel_metrics(
    patient_address: str = "Home Location",
    expected_consultation_iso: str = None,
    safety_buffer_min: int = 10
) -> Dict:
    """
    Travel & Recommended Departure Time Engine:
    Recommended Departure Time = Expected Consultation Start - Travel Time - Safety Buffer (10 mins)
    """
    distance_km = 6.4
    travel_time_min = 18

    now = datetime.now(timezone.utc)

    if expected_consultation_iso:
        try:
            consultation_dt = datetime.fromisoformat(expected_consultation_iso.replace("Z", "+00:00"))
        except Exception:
            consultation_dt = now + timedelta(minutes=45)
    else:
        consultation_dt = now + timedelta(minutes=45)

    arrival_dt = consultation_dt - timedelta(minutes=safety_buffer_min)
    departure_dt = arrival_dt - timedelta(minutes=travel_time_min)

    consultation_str = consultation_dt.strftime("%I:%M %p")
    arrival_str = arrival_dt.strftime("%I:%M %p")
    departure_str = departure_dt.strftime("%I:%M %p")

    return {
        "patient_address": patient_address,
        "distance_km": distance_km,
        "travel_time_min": travel_time_min,
        "safety_buffer_min": safety_buffer_min,
        "expected_consultation_time": consultation_str,
        "expected_consultation_iso": consultation_dt.isoformat(),
        "expected_hospital_arrival": arrival_str,
        "recommended_departure_time": departure_str,
        "recommended_departure_iso": departure_dt.isoformat(),
        "departure_alert": f"🚗 Leave home around {departure_str} to arrive ~10 mins before your consultation at {consultation_str}."
    }
