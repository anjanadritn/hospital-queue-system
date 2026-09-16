import os
import logging
from typing import Optional, List, Dict, Any
import requests
from config import config

logger = logging.getLogger(__name__)

# Default OpenRouteService Directions API Endpoint (v2 driving-car)
DEFAULT_ORS_ENDPOINT = "https://api.heigit.org/openrouteservice/v2/directions/driving-car"

_ROUTE_CACHE: Dict[str, Dict[str, Any]] = {}

class LocationService:
    """
    OpenRouteService Directions & Route Abstraction Layer.
    Uses OPENROUTESERVICE_API_KEY from environment/Flask config.
    Communicates with ORS using [longitude, latitude] coordinate ordering.
    Returns real road distance, travel duration, and GeoJSON route geometry.
    Gracefully handles API failures, timeouts, and missing credentials.
    """
    def __init__(self):
        self.endpoint = os.getenv("OPENROUTESERVICE_ENDPOINT", DEFAULT_ORS_ENDPOINT).rstrip("/")
        # URL for GeoJSON feature output
        self.geojson_url = f"{self.endpoint}/geojson" if not self.endpoint.endswith("/geojson") else self.endpoint
        self._api_key = getattr(config, "OPENROUTESERVICE_API_KEY", "") or os.getenv("OPENROUTESERVICE_API_KEY", "")

    @property
    def api_key(self) -> str:
        if not self._api_key:
            self._api_key = getattr(config, "OPENROUTESERVICE_API_KEY", "") or os.getenv("OPENROUTESERVICE_API_KEY", "")
        return self._api_key

    def get_route_directions(
        self,
        origin_coords: List[float],
        destination_coords: List[float],
        timeout_sec: float = 6.0
    ) -> Optional[Dict[str, Any]]:
        """
        Queries OpenRouteService for driving-car directions between two coordinates.
        Coordinates MUST be in [longitude, latitude] order.

        Returns dict containing:
          - distance_km (float)
          - travel_time_min (int)
          - distance_meters (float)
          - duration_seconds (float)
          - route_geometry (dict in GeoJSON LineString format)
          - source ("openrouteservice")
        Returns None if request fails or key is missing.
        """
        if not self.api_key:
            logger.debug("OpenRouteService API key not configured. Skipping ORS request.")
            return None

        if not origin_coords or len(origin_coords) != 2 or not destination_coords or len(destination_coords) != 2:
            logger.warning(f"Invalid coordinates provided to ORS: origin={origin_coords}, destination={destination_coords}")
            return None

        # Coordinates in [longitude, latitude]
        start_lon, start_lat = float(origin_coords[0]), float(origin_coords[1])
        dest_lon, dest_lat = float(destination_coords[0]), float(destination_coords[1])

        cache_key = f"{round(start_lon, 4)},{round(start_lat, 4)}->{round(dest_lon, 4)},{round(dest_lat, 4)}"
        if cache_key in _ROUTE_CACHE:
            return _ROUTE_CACHE[cache_key].copy()

        headers = {
            "Authorization": self.api_key.strip(),
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json, application/geo+json",
            "User-Agent": "HospitalQueueSystem/1.0"
        }

        # Search within 1000m radius of coordinates for valid routable road graph nodes
        body = {
            "coordinates": [
                [start_lon, start_lat],
                [dest_lon, dest_lat]
            ],
            "radiuses": [1000, 1000]
        }

        try:
            response = requests.post(
                self.geojson_url,
                json=body,
                headers=headers,
                timeout=timeout_sec
            )

            if response.status_code != 200:
                logger.warning(f"OpenRouteService returned status {response.status_code}: {response.text[:200]}")
                return None

            data = response.json()

            # Process GeoJSON FeatureCollection response
            features = data.get("features")
            if features and len(features) > 0:
                first_feature = features[0]
                summary = first_feature.get("properties", {}).get("summary", {})
                distance_m = float(summary.get("distance", 0.0))
                duration_s = float(summary.get("duration", 0.0))
                geometry = first_feature.get("geometry", {})

                dist_km = round(distance_m / 1000.0, 1)
                dur_min = max(1, int(round(duration_s / 60.0)))

                res = {
                    "distance_km": dist_km,
                    "travel_time_min": dur_min,
                    "distance_meters": distance_m,
                    "duration_seconds": duration_s,
                    "route_geometry": geometry,
                    "source": "openrouteservice"
                }
                _ROUTE_CACHE[cache_key] = res
                return res.copy()

            # Fallback parsing for standard routes JSON if geojson flag not applied
            routes = data.get("routes")
            if routes and len(routes) > 0:
                first_route = routes[0]
                summary = first_route.get("summary", {})
                distance_m = float(summary.get("distance", 0.0))
                duration_s = float(summary.get("duration", 0.0))
                geometry = first_route.get("geometry")

                dist_km = round(distance_m / 1000.0, 1)
                dur_min = max(1, int(round(duration_s / 60.0)))

                res = {
                    "distance_km": dist_km,
                    "travel_time_min": dur_min,
                    "distance_meters": distance_m,
                    "duration_seconds": duration_s,
                    "route_geometry": geometry,
                    "source": "openrouteservice"
                }
                _ROUTE_CACHE[cache_key] = res
                return res.copy()

            logger.warning("OpenRouteService response contained neither features nor routes.")
            return None

        except requests.exceptions.Timeout:
            logger.warning(f"OpenRouteService request timed out after {timeout_sec}s.")
            return None
        except requests.exceptions.RequestException as req_err:
            logger.warning(f"OpenRouteService request failed: {req_err}")
            return None
        except Exception as e:
            logger.warning(f"Unexpected error querying OpenRouteService: {e}")
            return None

    def get_travel_time(self, patient_location: str, hospital_location: str = "Hospital Central") -> Optional[int]:
        """
        Legacy compatibility helper.
        """
        # Returns 20 default if not called with coordinate pairs
        return 20


location_service = LocationService()

def get_travel_time_min(patient_location: str, hospital_location: str = "Hospital Central") -> Optional[int]:
    return location_service.get_travel_time(patient_location, hospital_location)
