/**
 * Authoritative Landmark Presets for Tumakuru / SIMSRH Hospital Catchment Area.
 * Coordinates are formatted as:
 * - coords: [longitude, latitude] (GeoJSON / MapLibre standard)
 * - lat, lon: numeric degrees
 */

export const TUMKUR_PRESETS = {
  'Tumkur Bus Stand': { coords: [77.1011, 13.3392], lat: 13.3392, lon: 77.1011, distance_km: 5.2, travel_time_min: 15 },
  'Batawadi': { coords: [77.1147, 13.3558], lat: 13.3558, lon: 77.1147, distance_km: 3.8, travel_time_min: 10 },
  'Kyatsandra': { coords: [77.1620, 13.3310], lat: 13.3310, lon: 77.1620, distance_km: 11.0, travel_time_min: 22 },
  'SSIT Campus': { coords: [77.0863, 13.3245], lat: 13.3245, lon: 77.0863, distance_km: 7.5, travel_time_min: 18 },
  'Sira Gate': { coords: [77.0980, 13.3520], lat: 13.3520, lon: 77.0980, distance_km: 3.2, travel_time_min: 8 },
  'Gubbi Gate': { coords: [77.0920, 13.3410], lat: 13.3410, lon: 77.0920, distance_km: 5.0, travel_time_min: 14 },
  'Tumkur Railway Station': { coords: [77.1040, 13.3440], lat: 13.3440, lon: 77.1040, distance_km: 4.8, travel_time_min: 13 },
  'B.H. Road Tumkur': { coords: [77.1000, 13.3400], lat: 13.3400, lon: 77.1000, distance_km: 5.1, travel_time_min: 14 },
  'Siddaganga Matha': { coords: [77.1440, 13.3180], lat: 13.3180, lon: 77.1440, distance_km: 10.5, travel_time_min: 25 },
  'Alipur, Gauribidanur': { coords: [77.4200, 13.6100], lat: 13.6100, lon: 77.4200, distance_km: 53.0, travel_time_min: 52 },
  'Alipur': { coords: [77.4200, 13.6100], lat: 13.6100, lon: 77.4200, distance_km: 53.0, travel_time_min: 52 },
};

export const TUMKUR_OPTIONS = Object.keys(TUMKUR_PRESETS);
