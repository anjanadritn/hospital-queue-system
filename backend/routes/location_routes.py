import logging
from typing import List, Dict, Any
import requests
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

location_bp = Blueprint("location_bp", __name__)

# Curated regional landmarks and towns (Tumakuru, Chikkaballapur, Bengaluru rural)
# to guarantee instant and reliable results even without internet connection.
REGIONAL_DIRECTORY: List[Dict[str, Any]] = [
    {
        "display_name": "Alipur, Gauribidanur, Chikkaballapur, Karnataka, India",
        "name": "Alipur",
        "locality": "Gauribidanur, Chikkaballapur",
        "city": "Alipur",
        "latitude": 13.6100,
        "longitude": 77.4200,
        "is_approximate": False
    },
    {
        "display_name": "Chikkaballapur City, Chikkaballapur District, Karnataka, India",
        "name": "Chikkaballapur",
        "locality": "Chikkaballapur",
        "city": "Chikkaballapur",
        "latitude": 13.4355,
        "longitude": 77.7315,
        "is_approximate": False
    },
    {
        "display_name": "Gauribidanur, Chikkaballapur District, Karnataka, India",
        "name": "Gauribidanur",
        "locality": "Gauribidanur",
        "city": "Gauribidanur",
        "latitude": 13.6133,
        "longitude": 77.5186,
        "is_approximate": False
    },
    {
        "display_name": "Sidlaghatta, Chikkaballapur District, Karnataka, India",
        "name": "Sidlaghatta",
        "locality": "Sidlaghatta",
        "city": "Sidlaghatta",
        "latitude": 13.3912,
        "longitude": 77.8631,
        "is_approximate": False
    },
    {
        "display_name": "Bagepalli, Chikkaballapur District, Karnataka, India",
        "name": "Bagepalli",
        "locality": "Bagepalli",
        "city": "Bagepalli",
        "latitude": 13.7844,
        "longitude": 77.7942,
        "is_approximate": False
    },
    {
        "display_name": "Tumakuru City Center, Tumakuru, Karnataka, India",
        "name": "Tumakuru",
        "locality": "Tumakuru City",
        "city": "Tumakuru",
        "latitude": 13.3400,
        "longitude": 77.1000,
        "is_approximate": False
    },
    {
        "display_name": "Batawadi, Tumakuru, Karnataka, India",
        "name": "Batawadi",
        "locality": "Batawadi",
        "city": "Tumakuru",
        "latitude": 13.3558,
        "longitude": 77.1147,
        "is_approximate": False
    },
    {
        "display_name": "Kyatsandra, Tumakuru, Karnataka, India",
        "name": "Kyatsandra",
        "locality": "Kyatsandra",
        "city": "Tumakuru",
        "latitude": 13.3310,
        "longitude": 77.1620,
        "is_approximate": False
    },
    {
        "display_name": "Sira Gate, Tumakuru, Karnataka, India",
        "name": "Sira Gate",
        "locality": "Sira Gate",
        "city": "Tumakuru",
        "latitude": 13.3567,
        "longitude": 77.0872,
        "is_approximate": False
    },
    {
        "display_name": "Sira Town, Tumakuru District, Karnataka, India",
        "name": "Sira",
        "locality": "Sira",
        "city": "Sira",
        "latitude": 13.7438,
        "longitude": 76.9064,
        "is_approximate": False
    },
    {
        "display_name": "Gubbi, Tumakuru District, Karnataka, India",
        "name": "Gubbi",
        "locality": "Gubbi",
        "city": "Gubbi",
        "latitude": 13.3106,
        "longitude": 76.9392,
        "is_approximate": False
    },
    {
        "display_name": "Madhugiri, Tumakuru District, Karnataka, India",
        "name": "Madhugiri",
        "locality": "Madhugiri",
        "city": "Madhugiri",
        "latitude": 13.6631,
        "longitude": 77.2089,
        "is_approximate": False
    },
    {
        "display_name": "Kunigal, Tumakuru District, Karnataka, India",
        "name": "Kunigal",
        "locality": "Kunigal",
        "city": "Kunigal",
        "latitude": 13.0238,
        "longitude": 77.0272,
        "is_approximate": False
    },
    {
        "display_name": "Tiptur, Tumakuru District, Karnataka, India",
        "name": "Tiptur",
        "locality": "Tiptur",
        "city": "Tiptur",
        "latitude": 13.2575,
        "longitude": 76.4772,
        "is_approximate": False
    },
    {
        "display_name": "Koratagere, Tumakuru District, Karnataka, India",
        "name": "Koratagere",
        "locality": "Koratagere",
        "city": "Koratagere",
        "latitude": 13.5244,
        "longitude": 77.2378,
        "is_approximate": False
    },
    {
        "display_name": "Pavagada, Tumakuru District, Karnataka, India",
        "name": "Pavagada",
        "locality": "Pavagada",
        "city": "Pavagada",
        "latitude": 14.1011,
        "longitude": 77.2792,
        "is_approximate": False
    },
    {
        "display_name": "Nelamangala, Bengaluru Rural, Karnataka, India",
        "name": "Nelamangala",
        "locality": "Nelamangala",
        "city": "Nelamangala",
        "latitude": 13.0978,
        "longitude": 77.3917,
        "is_approximate": False
    },
    {
        "display_name": "Doddaballapura, Bengaluru Rural, Karnataka, India",
        "name": "Doddaballapura",
        "locality": "Doddaballapura",
        "city": "Doddaballapura",
        "latitude": 13.2928,
        "longitude": 77.5389,
        "is_approximate": False
    },
    {
        "display_name": "Bengaluru Central, Karnataka, India",
        "name": "Bengaluru",
        "locality": "Bengaluru",
        "city": "Bengaluru",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "is_approximate": False
    },
    {
        "display_name": "Yelahanka, Bengaluru, Karnataka, India",
        "name": "Yelahanka",
        "locality": "Yelahanka",
        "city": "Bengaluru",
        "latitude": 13.1007,
        "longitude": 77.5963,
        "is_approximate": False
    }
]


@location_bp.route("/location/search", methods=["GET"])
@location_bp.route("/api/location/search", methods=["GET"])
def search_location():
    """
    Search for villages, towns, cities, and landmarks in India / Karnataka.
    Returns matched locations with latitude and longitude for map placement.
    """
    query = str(request.args.get("q") or "").strip().lower()
    if not query:
        return jsonify([]), 200

    results = []
    seen = set()

    # 1. Search local directory
    for item in REGIONAL_DIRECTORY:
        d_name = item["display_name"].lower()
        sub_name = item["name"].lower()
        loc_name = item["locality"].lower()
        if query in d_name or query in sub_name or query in loc_name or any(w in d_name for w in query.split() if len(w) > 2):
            key = f"{round(item['latitude'], 3)},{round(item['longitude'], 3)}"
            if key not in seen:
                seen.add(key)
                results.append(item)

    # 2. Query OpenStreetMap Nominatim for live coverage
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "json",
            "countrycodes": "in",
            "limit": 6,
            "addressdetails": 1
        }
        headers = {
            "User-Agent": "HospitalQueueSystem/1.0 (SIMSRH Medical Platform)"
        }
        resp = requests.get(url, params=params, headers=headers, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            for item in data:
                try:
                    lat = float(item["lat"])
                    lon = float(item["lon"])
                    key = f"{round(lat, 3)},{round(lon, 3)}"
                    if key in seen:
                        continue
                    seen.add(key)
                    addr = item.get("address", {})
                    city = addr.get("village") or addr.get("town") or addr.get("city") or addr.get("county") or item.get("name", query)
                    locality = addr.get("state_district") or addr.get("state") or "Karnataka"
                    results.append({
                        "display_name": item.get("display_name", f"{city}, {locality}"),
                        "name": item.get("name", city),
                        "locality": locality,
                        "city": city,
                        "latitude": round(lat, 6),
                        "longitude": round(lon, 6),
                        "is_approximate": False
                    })
                except Exception:
                    continue
    except Exception as ex:
        logger.debug(f"Nominatim search skipped or timed out: {ex}")

    # Fallback if no exact match: provide an approximate result for the query
    if not results and len(query) >= 3:
        results.append({
            "display_name": f"{query.title()}, Karnataka, India",
            "name": query.title(),
            "locality": "Karnataka",
            "city": query.title(),
            "latitude": 13.3400,
            "longitude": 77.1000,
            "is_approximate": True
        })

    return jsonify(results[:8]), 200


@location_bp.route("/location/reverse", methods=["GET"])
@location_bp.route("/api/location/reverse", methods=["GET"])
def reverse_geocode():
    """
    Reverse geocode coordinates into a human-readable display address.
    """
    lat_str = request.args.get("lat")
    lon_str = request.args.get("lon")
    if not lat_str or not lon_str:
        return jsonify({"error": "lat and lon parameters are required"}), 400

    try:
        lat = float(lat_str)
        lon = float(lon_str)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid coordinates"}), 400

    # Attempt Nominatim reverse geocoding
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json"
        }
        headers = {
            "User-Agent": "HospitalQueueSystem/1.0 (SIMSRH Medical Platform)"
        }
        resp = requests.get(url, params=params, headers=headers, timeout=2.5)
        if resp.status_code == 200:
            data = resp.json()
            display_name = data.get("display_name")
            addr = data.get("address", {})
            city = addr.get("village") or addr.get("town") or addr.get("city") or addr.get("suburb") or "Selected Location"
            locality = addr.get("state_district") or addr.get("state") or "Karnataka"
            return jsonify({
                "display_name": display_name,
                "city": city,
                "locality": locality,
                "latitude": round(lat, 6),
                "longitude": round(lon, 6)
            }), 200
    except Exception as ex:
        logger.debug(f"Reverse geocode skipped or timed out: {ex}")

    # Fallback to coordinate string
    return jsonify({
        "display_name": f"Selected Location ({round(lat, 4)}° N, {round(lon, 4)}° E)",
        "city": "Patient Location",
        "locality": "Karnataka",
        "latitude": round(lat, 6),
        "longitude": round(lon, 6)
    }), 200
