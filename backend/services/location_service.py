import logging
import urllib.request
import json
from typing import Optional
from config import config

logger = logging.getLogger(__name__)

class LocationService:
    """
    Location & Travel Time Abstraction Layer.
    Uses GOOGLE_MAPS_API_KEY from environment configuration if configured.
    Provides graceful fallback if API key is missing or external request fails.
    """
    def __init__(self):
        self.api_key = getattr(config, "GOOGLE_MAPS_API_KEY", "")

    def get_travel_time(self, patient_location: str, hospital_location: str = "Hospital Central") -> Optional[int]:
        """
        Returns estimated travel time in minutes.
        If Google Maps API key is configured, queries Distance Matrix API.
        Otherwise provides a clean fallback estimate without crashing.
        """
        if not patient_location:
            return None

        if self.api_key and self.api_key != "your-google-maps-api-key-here":
            try:
                url = f"https://maps.googleapis.com/maps/api/distancematrix/json?origins={urllib.parse.quote(patient_location)}&destinations={urllib.parse.quote(hospital_location)}&key={self.api_key}"
                req = urllib.request.Request(url, headers={"User-Agent": "HospitalQueueBackend/1.0"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    data = json.loads(resp.read().decode())
                    if data.get("status") == "OK":
                        duration_sec = data["rows"][0]["elements"][0]["duration"]["value"]
                        return int(round(duration_sec / 60))
            except Exception as e:
                logger.warning(f"Google Maps API request failed: {e}. Falling back to default location estimate.")

        # Development Fallback: 20 minutes default travel time
        return 20

location_service = LocationService()

def get_travel_time_min(patient_location: str, hospital_location: str = "Hospital Central") -> Optional[int]:
    return location_service.get_travel_time(patient_location, hospital_location)
