import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Clock,
  ShieldCheck,
  MapPin,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Car,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { getBrowserLocation } from '../services/locationService';
import {
  DEPARTURE_STATES,
  parseIsoOrTime,
  isPatientArrivedOrTerminal,
  getDepartureState
} from '../services/departureStateService';
import LiveRouteMap from './LiveRouteMap';
import { useLanguage } from '../context/LanguageContext';

import { TUMKUR_PRESETS, TUMKUR_OPTIONS } from '../constants/tumkurPresets.js';
export { TUMKUR_PRESETS, TUMKUR_OPTIONS };

/**
 * Calculates straight-line distance in meters between two coordinates using the Haversine formula
 */
function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DepartureCard({ travelInfo: initialTravelInfo, onRefreshQueue }) {
  const { t } = useLanguage();
  const [currentTravelInfo, setCurrentTravelInfo] = useState(initialTravelInfo);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isLeavingSubmitting, setIsLeavingSubmitting] = useState(false);
  const [leavingError, setLeavingError] = useState(null);
  const [lastGpsReading, setLastGpsReading] = useState(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState(null);

  // 1. Explicit Origin Mode: 'gps' | 'preset'
  const [originMode, setOriginMode] = useState(() => {
    if (initialTravelInfo?.origin_mode === 'preset' || initialTravelInfo?.location_source === 'preset') {
      return 'preset';
    }
    if (initialTravelInfo?.origin_mode === 'gps') {
      return 'gps';
    }
    const isDeviceGps = initialTravelInfo?.location_source === 'gps' || initialTravelInfo?.location_source === 'device_gps';
    const isApprox = initialTravelInfo?.is_approximate_location ?? initialTravelInfo?.is_approximate;
    if (isDeviceGps && !isApprox && initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude) {
      return 'gps';
    }
    return 'preset';
  });

  // 2. Selected Origin (name shown in dropdown)
  const [selectedOrigin, setSelectedOrigin] = useState(() => {
    if (initialTravelInfo?.origin_mode === 'preset' && initialTravelInfo?.origin_label) {
      return initialTravelInfo.origin_label;
    }
    const isDeviceGps = initialTravelInfo?.location_source === 'gps' || initialTravelInfo?.location_source === 'device_gps';
    const isApprox = initialTravelInfo?.is_approximate_location ?? initialTravelInfo?.is_approximate;
    if (initialTravelInfo?.origin_mode === 'gps' || (isDeviceGps && !isApprox && initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude)) {
      return 'Current GPS Location';
    }
    const candidate = initialTravelInfo?.origin_label || initialTravelInfo?.location_address || initialTravelInfo?.patient_address || initialTravelInfo?.city;
    if (candidate && TUMKUR_PRESETS[candidate]) {
      return candidate;
    }
    if (candidate) {
      const found = Object.keys(TUMKUR_PRESETS).find(k => k.toLowerCase() === candidate.toLowerCase());
      if (found) return found;
    }
    return candidate || 'Tumkur Bus Stand';
  });

  // 3. Selected Preset details
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const isGpsMode = initialTravelInfo?.origin_mode === 'gps' || (
      (initialTravelInfo?.location_source === 'gps' || initialTravelInfo?.location_source === 'device_gps') &&
      !(initialTravelInfo?.is_approximate_location ?? initialTravelInfo?.is_approximate) &&
      initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude
    );
    if (isGpsMode && initialTravelInfo?.origin_mode !== 'preset') {
      return null;
    }
    const candidate = initialTravelInfo?.origin_label || initialTravelInfo?.location_address || initialTravelInfo?.patient_address || initialTravelInfo?.city;
    if (candidate && TUMKUR_PRESETS[candidate]) {
      return { name: candidate, ...TUMKUR_PRESETS[candidate] };
    }
    if (candidate) {
      const foundKey = Object.keys(TUMKUR_PRESETS).find(k => k.toLowerCase() === candidate.toLowerCase());
      if (foundKey) {
        return { name: foundKey, ...TUMKUR_PRESETS[foundKey] };
      }
    }
    if (initialTravelInfo?.origin_lat && initialTravelInfo?.origin_lng) {
      return {
        name: candidate || 'Selected Location',
        coords: [Number(initialTravelInfo.origin_lng), Number(initialTravelInfo.origin_lat)],
        lat: Number(initialTravelInfo.origin_lat),
        lon: Number(initialTravelInfo.origin_lng)
      };
    }
    return TUMKUR_PRESETS['Tumkur Bus Stand'] ? { name: 'Tumkur Bus Stand', ...TUMKUR_PRESETS['Tumkur Bus Stand'] } : null;
  });

  // 4. Browser GPS State (hardware/browser reading independent of user route mode)
  const [browserGps, setBrowserGps] = useState(() => {
    const isDeviceGps = initialTravelInfo?.location_source === 'gps' || initialTravelInfo?.location_source === 'device_gps';
    const isApprox = initialTravelInfo?.is_approximate_location ?? initialTravelInfo?.is_approximate;
    const hasCoords = initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude && isDeviceGps && !isApprox;
    return {
      coords: hasCoords ? [Number(initialTravelInfo.origin_longitude), Number(initialTravelInfo.origin_latitude)] : null,
      accuracy: null,
      status: hasCoords ? 'watching' : 'idle',
      timestamp: null
    };
  });

  // 5. Active Route Origin Coordinates (derived or tracked)
  // Requirement 2: In preset mode, route origin MUST = selectedPreset latitude/longitude. NEVER use browser GPS!
  const [liveCoords, setLiveCoords] = useState(() => {
    const isPreset = initialTravelInfo?.origin_mode === 'preset' || initialTravelInfo?.location_source === 'preset' || (
      initialTravelInfo?.location_source !== 'gps' && initialTravelInfo?.location_source !== 'device_gps'
    );
    if (isPreset) {
      const candidate = initialTravelInfo?.origin_label || initialTravelInfo?.location_address || initialTravelInfo?.patient_address || initialTravelInfo?.city;
      if (candidate && TUMKUR_PRESETS[candidate]) {
        return TUMKUR_PRESETS[candidate].coords;
      }
      if (candidate) {
        const foundKey = Object.keys(TUMKUR_PRESETS).find(k => k.toLowerCase() === candidate.toLowerCase());
        if (foundKey) return TUMKUR_PRESETS[foundKey].coords;
      }
      if (initialTravelInfo?.origin_lat && initialTravelInfo?.origin_lng) {
        return [Number(initialTravelInfo.origin_lng), Number(initialTravelInfo.origin_lat)];
      }
      return TUMKUR_PRESETS['Tumkur Bus Stand']?.coords || null;
    }
    if (initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude) {
      return [Number(initialTravelInfo.origin_longitude), Number(initialTravelInfo.origin_latitude)];
    }
    return null;
  });

  // Keep isExactGps boolean for route: true only when in GPS mode and browser GPS is verified
  const isExactGps = Boolean(
    originMode === 'gps' &&
    browserGps.coords &&
    browserGps.status === 'watching'
  );

  const [liveTrackingActive, setLiveTrackingActive] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [minsUntilDeparture, setMinsUntilDeparture] = useState(null);

  // Refs for callbacks to prevent stale closures
  const originModeRef = useRef(originMode);
  originModeRef.current = originMode;

  const selectedOriginRef = useRef(selectedOrigin);
  selectedOriginRef.current = selectedOrigin;

  const selectedPresetRef = useRef(selectedPreset);
  selectedPresetRef.current = selectedPreset;

  const lastRecalcPosRef = useRef(
    (initialTravelInfo?.location_source === 'gps' || initialTravelInfo?.location_source === 'device_gps') &&
    initialTravelInfo?.origin_latitude &&
    initialTravelInfo?.origin_longitude &&
    !(initialTravelInfo?.is_approximate_location ?? initialTravelInfo?.is_approximate)
      ? { lat: Number(initialTravelInfo.origin_latitude), lon: Number(initialTravelInfo.origin_longitude) }
      : null
  );
  const lastRecalcTimeRef = useRef(Date.now());
  const isRecalculatingRef = useRef(false);

  // Lightweight timer every 30 seconds to recalculate current departure state and time diffs
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Sync state when parent travelInfo prop changes (e.g. 5-second queue polling)
  useEffect(() => {
    if (!initialTravelInfo) return;

    setCurrentTravelInfo(prev => {
      if (!prev) return initialTravelInfo;

      // If user selected a preset/manual origin:
      if (originModeRef.current === 'preset') {
        return {
          ...prev,
          // Update queue status from queue poll
          expected_consultation_time: initialTravelInfo.expected_consultation_time || prev.expected_consultation_time,
          expected_consultation_iso: initialTravelInfo.expected_consultation_iso || prev.expected_consultation_iso,
          consultation_slot: initialTravelInfo.consultation_slot || prev.consultation_slot,
          consultation_date: initialTravelInfo.consultation_date || prev.consultation_date,
          doctor_name: initialTravelInfo.doctor_name || prev.doctor_name,
          status: initialTravelInfo.status || prev.status,
          queue_id: initialTravelInfo.queue_id || prev.queue_id,
          booking_id: initialTravelInfo.booking_id || prev.booking_id,
          leaving_now: initialTravelInfo.leaving_now !== undefined ? initialTravelInfo.leaving_now : prev.leaving_now,
          leaving_now_at: initialTravelInfo.leaving_now_at || prev.leaving_now_at,
          late_arrival_reordered: initialTravelInfo.late_arrival_reordered !== undefined ? initialTravelInfo.late_arrival_reordered : prev.late_arrival_reordered,
          arrived_at_hospital: initialTravelInfo.arrived_at_hospital !== undefined ? initialTravelInfo.arrived_at_hospital : prev.arrived_at_hospital,
          verified_by_admin: initialTravelInfo.verified_by_admin !== undefined ? initialTravelInfo.verified_by_admin : prev.verified_by_admin,
          // PRESERVE PRESET ROUTE METRICS
          patient_address: selectedOriginRef.current,
          location_address: selectedOriginRef.current,
          origin_latitude: prev.origin_latitude,
          origin_longitude: prev.origin_longitude,
          origin_coordinates: prev.origin_coordinates,
          origin_mode: 'preset',
          origin_label: selectedOriginRef.current,
          distance_km: prev.distance_km,
          travel_time_min: prev.travel_time_min,
          travel_time_minutes: prev.travel_time_minutes || prev.travel_time_min,
          route_geometry: prev.route_geometry,
          location_source: 'preset',
          is_approximate_location: false,
          is_approximate: false,
          expected_hospital_arrival: prev.expected_hospital_arrival || initialTravelInfo.expected_hospital_arrival,
          expected_hospital_arrival_iso: prev.expected_hospital_arrival_iso || initialTravelInfo.expected_hospital_arrival_iso,
          expected_arrival_time: prev.expected_arrival_time || prev.expected_hospital_arrival || initialTravelInfo.expected_arrival_time,
          expected_arrival_iso: prev.expected_arrival_iso || prev.expected_hospital_arrival_iso || initialTravelInfo.expected_arrival_iso,
          arrival_deadline_time: prev.arrival_deadline_time || initialTravelInfo.arrival_deadline_time,
          arrival_deadline_iso: prev.arrival_deadline_iso || initialTravelInfo.arrival_deadline_iso,
          recommended_departure_time: prev.recommended_departure_time || initialTravelInfo.recommended_departure_time,
          recommended_departure_iso: prev.recommended_departure_iso || initialTravelInfo.recommended_departure_iso,
          departure_alert: prev.departure_alert || initialTravelInfo.departure_alert
        };
      }

      // In GPS mode:
      const hasLiveMetrics = Boolean(
        prev.location_source === 'gps' ||
        (prev.distance_km != null && prev.distance_km !== initialTravelInfo.distance_km)
      );

      if (hasLiveMetrics) {
        return {
          ...initialTravelInfo,
          origin_latitude: prev.origin_latitude || initialTravelInfo.origin_latitude,
          origin_longitude: prev.origin_longitude || initialTravelInfo.origin_longitude,
          origin_coordinates: prev.origin_coordinates || initialTravelInfo.origin_coordinates,
          distance_km: prev.distance_km != null ? prev.distance_km : initialTravelInfo.distance_km,
          travel_time_min: prev.travel_time_min != null ? prev.travel_time_min : initialTravelInfo.travel_time_min,
          travel_time_minutes: prev.travel_time_minutes != null ? prev.travel_time_minutes : (prev.travel_time_min || initialTravelInfo.travel_time_minutes),
          route_geometry: prev.route_geometry || initialTravelInfo.route_geometry,
          patient_address: 'Current GPS Location',
          location_address: 'Current GPS Location',
          is_approximate_location: false,
          is_approximate: false,
          location_source: 'gps',
          expected_hospital_arrival: prev.expected_hospital_arrival || initialTravelInfo.expected_hospital_arrival,
          expected_hospital_arrival_iso: prev.expected_hospital_arrival_iso || initialTravelInfo.expected_hospital_arrival_iso,
          expected_arrival_time: prev.expected_arrival_time || prev.expected_hospital_arrival || initialTravelInfo.expected_arrival_time,
          expected_arrival_iso: prev.expected_arrival_iso || prev.expected_hospital_arrival_iso || initialTravelInfo.expected_arrival_iso,
          arrival_deadline_time: prev.arrival_deadline_time || initialTravelInfo.arrival_deadline_time,
          arrival_deadline_iso: prev.arrival_deadline_iso || initialTravelInfo.arrival_deadline_iso,
          recommended_departure_time: prev.recommended_departure_time || initialTravelInfo.recommended_departure_time,
          recommended_departure_iso: prev.recommended_departure_iso || initialTravelInfo.recommended_departure_iso,
          departure_alert: prev.departure_alert || initialTravelInfo.departure_alert
        };
      }
      return {
        ...prev,
        ...initialTravelInfo
      };
    });

    // When in preset mode, NEVER overwrite selectedOrigin or liveCoords on polling!
    if (originModeRef.current === 'preset') {
      if (selectedPresetRef.current?.coords) {
        setLiveCoords(selectedPresetRef.current.coords);
      }
      return;
    }

    // In GPS mode, if no active GPS coordinates yet, check initialTravelInfo
    if (originModeRef.current === 'gps' && !browserGps.coords) {
      const isDeviceGps = initialTravelInfo.location_source === 'gps' || initialTravelInfo.location_source === 'device_gps';
      const isApprox = initialTravelInfo.is_approximate_location ?? initialTravelInfo.is_approximate;
      if (isDeviceGps && initialTravelInfo.origin_latitude && initialTravelInfo.origin_longitude && !isApprox) {
        setSelectedOrigin('Current GPS Location');
        const coords = [Number(initialTravelInfo.origin_longitude), Number(initialTravelInfo.origin_latitude)];
        setLiveCoords(coords);
        setBrowserGps(prev => ({
          ...prev,
          coords,
          status: 'watching'
        }));
      }
    }
  }, [initialTravelInfo]);

  // Real-time calculation of time remaining until departure
  useEffect(() => {
    const info = currentTravelInfo || initialTravelInfo;
    const depMs = parseIsoOrTime(
      info?.recommended_departure_iso,
      info?.recommended_departure_time,
      info?.consultation_date
    );
    if (!depMs) {
      setMinsUntilDeparture(null);
      return;
    }
    const diffMins = Math.round((depMs - currentTime) / 60000);
    setMinsUntilDeparture(diffMins);
  }, [currentTravelInfo, initialTravelInfo, currentTime]);

  // Watch GPS Position in background without clobbering manual presets
  useEffect(() => {
    if (!liveTrackingActive || typeof window === 'undefined' || !navigator?.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));
        const accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
        const newCoords = [lon, lat];

        // 1. ALWAYS update background browser GPS state
        setBrowserGps({
          coords: newCoords,
          accuracy,
          status: 'watching',
          timestamp: new Date().toLocaleTimeString()
        });
        setLastGpsReading({ lat, lon, accuracy, timestamp: new Date().toLocaleTimeString() });

        // 2. ONLY update route and selectedOrigin IF originMode is 'gps'!
        if (originModeRef.current !== 'gps') {
          // User is currently in manual preset mode (e.g. "Tumkur Bus Stand").
          // Background GPS update must NOT overwrite user's preset selection or route!
          return;
        }

        // We are in GPS mode: update active route coordinates
        setLiveCoords(newCoords);
        setSelectedOrigin('Current GPS Location');

        const now = Date.now();
        const lastPos = lastRecalcPosRef.current;
        const lastTime = lastRecalcTimeRef.current;

        let distMeters = Infinity;
        if (lastPos) {
          distMeters = calculateHaversineMeters(lastPos.lat, lastPos.lon, lat, lon);
        }

        const timeElapsed = now - lastTime;
        const shouldRecalculate =
          !lastPos ||
          (distMeters >= 75 && timeElapsed >= 10000) ||
          (distMeters >= 25 && timeElapsed >= 60000);

        if (shouldRecalculate && !isRecalculatingRef.current) {
          isRecalculatingRef.current = true;
          lastRecalcPosRef.current = { lat, lon };
          lastRecalcTimeRef.current = now;

          const activeInfo = currentTravelInfo || initialTravelInfo;
          hospitalApi.calculateTravelDeparture({
            queue_id: activeInfo?.queue_id || activeInfo?.booking_id,
            origin_mode: 'gps',
            user_selected_gps: false,
            origin_label: 'Current GPS Location',
            origin: 'Current GPS Location',
            origin_lat: lat,
            origin_lng: lon,
            origin_latitude: lat,
            origin_longitude: lon,
            location_source: 'gps',
            expected_consultation_iso: activeInfo?.expected_consultation_iso,
            safety_buffer_min: activeInfo?.safety_buffer_min || 10,
            leaving_now: activeInfo?.leaving_now,
            leaving_now_at: activeInfo?.leaving_now_at
          }).then((res) => {
            if (res && res.recommended_departure_time && originModeRef.current === 'gps') {
              setCurrentTravelInfo(prev => ({
                ...prev,
                ...res,
                origin_mode: 'gps',
                origin_label: 'Current GPS Location',
                origin_latitude: lat,
                origin_longitude: lon,
                origin_coordinates: newCoords,
                patient_address: 'Current GPS Location',
                location_address: 'Current GPS Location',
                is_approximate_location: false,
                is_approximate: false,
                location_source: 'gps'
              }));
              setSelectedOrigin('Current GPS Location');
            }
          }).catch((err) => {
            console.warn('Could not recalculate departure with live GPS:', err);
          }).finally(() => {
            isRecalculatingRef.current = false;
          });
        }
      },
      (err) => {
        setBrowserGps(prev => ({
          ...prev,
          status: err.code === 1 ? 'denied' : 'unavailable'
        }));
        if (err.code === 1 && originModeRef.current === 'gps') {
          setGpsErrorMessage('GPS Permission Denied — Using approximate location');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [liveTrackingActive]);

  if (!currentTravelInfo && !initialTravelInfo) return null;
  const travelInfo = currentTravelInfo || initialTravelInfo;

  const travelDuration = Number(
    travelInfo?.travel_time_min ||
    travelInfo?.travel_time_minutes ||
    initialTravelInfo?.travel_time_min ||
    initialTravelInfo?.travel_time_minutes ||
    18
  );

  const safetyBuffer = Number(
    travelInfo?.safety_buffer_min ||
    initialTravelInfo?.safety_buffer_min ||
    10
  );

  // Current doctor-specific expected consultation time (OPD Turn Window)
  const displayTurnWindow =
    travelInfo?.expected_consultation_time ||
    initialTravelInfo?.expected_consultation_time ||
    '11:15 AM';

  const consultIso = travelInfo?.expected_consultation_iso || initialTravelInfo?.expected_consultation_iso;
  const baseDate = travelInfo?.consultation_date || initialTravelInfo?.consultation_date;

  // 1. Recommended Departure Time
  let displayDepartureTime = travelInfo?.recommended_departure_time || initialTravelInfo?.recommended_departure_time;
  let depMs = null;
  if (consultIso) {
    try {
      const consultMs = new Date(consultIso).getTime();
      if (!isNaN(consultMs)) {
        const offsetMin = travelDuration + safetyBuffer;
        depMs = consultMs - (offsetMin * 60 * 1000);
        const depDate = new Date(depMs);
        displayDepartureTime = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    } catch {
      // fallback to backend string
    }
  }

  if (!depMs) {
    depMs = parseIsoOrTime(
      travelInfo?.recommended_departure_iso || initialTravelInfo?.recommended_departure_iso,
      displayDepartureTime,
      baseDate
    );
  }

  // 2. Dynamic Hospital Arrival & Deadline Calculation:
  // - Departed (leaving_now == true) -> departure time + live travel duration
  // - Not departed + recommended departure passed (currentTime >= depMs) -> currentTime + live travel duration
  // - On schedule (currentTime < depMs) -> recommended departure + live travel duration
  const isDeparted = Boolean(travelInfo?.leaving_now || initialTravelInfo?.leaving_now);
  const leavingNowAtMs = parseIsoOrTime(
    travelInfo?.leaving_now_at || initialTravelInfo?.leaving_now_at,
    null,
    baseDate
  );

  let arrivalMs = null;
  if (isDeparted) {
    const startMs = leavingNowAtMs || currentTime;
    arrivalMs = startMs + (travelDuration * 60 * 1000);
  } else if (depMs && currentTime >= depMs) {
    arrivalMs = currentTime + (travelDuration * 60 * 1000);
  } else if (depMs) {
    arrivalMs = depMs + (travelDuration * 60 * 1000);
  } else {
    const parsedArrival = parseIsoOrTime(
      travelInfo?.expected_hospital_arrival_iso || travelInfo?.expected_arrival_iso,
      travelInfo?.expected_hospital_arrival || travelInfo?.expected_arrival_time,
      baseDate
    );
    arrivalMs = parsedArrival || (currentTime + travelDuration * 60 * 1000);
  }

  const deadlineMs = arrivalMs + (2 * 60 * 1000);

  const displayArrivalTime = new Date(arrivalMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const displayArrivalDeadline = new Date(deadlineMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Authoritative dynamic departure state from CURRENT browser/server time and dynamic travel metrics
  const evaluatedTravelInfo = {
    ...travelInfo,
    expected_hospital_arrival: displayArrivalTime,
    expected_hospital_arrival_iso: new Date(arrivalMs).toISOString(),
    expected_arrival_time: displayArrivalTime,
    expected_arrival_iso: new Date(arrivalMs).toISOString(),
    arrival_deadline_time: displayArrivalDeadline,
    arrival_deadline_iso: new Date(deadlineMs).toISOString(),
    recommended_departure_time: displayDepartureTime,
    recommended_departure_iso: depMs ? new Date(depMs).toISOString() : (travelInfo?.recommended_departure_iso || initialTravelInfo?.recommended_departure_iso)
  };

  const departureState = getDepartureState(evaluatedTravelInfo, currentTime);

  // Manual origin change (user chooses landmark from dropdown or Current GPS Location)
  const handleOriginChange = async (origin) => {
    if (origin === 'Current GPS Location' || origin === '__GPS__') {
      await handleUseCurrentLocation();
      return;
    }

    const preset = TUMKUR_PRESETS[origin];
    setOriginMode('preset');
    setSelectedOrigin(origin);
    setSelectedPreset(preset ? { name: origin, ...preset } : null);
    if (preset) {
      setLiveCoords(preset.coords);
    }
    lastRecalcPosRef.current = null;
    setCalculating(true);

    try {
      const activeInfo = currentTravelInfo || initialTravelInfo;
      const payload = {
        queue_id: activeInfo?.queue_id || activeInfo?.booking_id,
        origin_mode: 'preset',
        origin_label: origin,
        origin: origin,
        origin_lat: preset ? preset.lat : null,
        origin_lng: preset ? preset.lon : null,
        origin_latitude: preset ? preset.lat : null,
        origin_longitude: preset ? preset.lon : null,
        location_source: 'preset',
        is_approximate: false,
        expected_consultation_iso: activeInfo?.expected_consultation_iso,
        safety_buffer_min: activeInfo?.safety_buffer_min || 10
      };
      const res = await hospitalApi.calculateTravelDeparture(payload);
      if (res && res.recommended_departure_time) {
        setCurrentTravelInfo(prev => ({
          ...prev,
          ...res,
          origin_mode: 'preset',
          origin_label: origin,
          patient_address: origin,
          location_address: origin,
          origin_latitude: preset ? preset.lat : res.origin_latitude,
          origin_longitude: preset ? preset.lon : res.origin_longitude,
          origin_coordinates: preset ? preset.coords : res.origin_coordinates,
          distance_km: res.distance_km,
          travel_time_min: res.travel_time_min,
          travel_time_minutes: res.travel_time_minutes || res.travel_time_min,
          route_geometry: res.route_geometry,
          location_source: 'preset',
          is_approximate_location: false,
          is_approximate: false
        }));
      }
    } catch (e) {
      console.warn('Could not recalculate departure time from backend:', e);
    } finally {
      setCalculating(false);
    }
  };

  // Explicit switch / refresh to Live GPS
  const handleUseCurrentLocation = async () => {
    setCalculating(true);
    setGpsErrorMessage(null);
    setOriginMode('gps');
    setSelectedOrigin('Current GPS Location');
    setSelectedPreset(null);

    // If we already have fresh browser GPS reading from background watcher:
    if (browserGps.coords && browserGps.coords.length === 2) {
      const [lon, lat] = browserGps.coords;
      setLiveCoords(browserGps.coords);
      lastRecalcPosRef.current = { lat, lon };
      lastRecalcTimeRef.current = Date.now();

      try {
        const activeInfo = currentTravelInfo || initialTravelInfo;
        const res = await hospitalApi.calculateTravelDeparture({
          queue_id: activeInfo?.queue_id || activeInfo?.booking_id,
          origin_mode: 'gps',
          user_selected_gps: true,
          origin_label: 'Current GPS Location',
          origin: 'Current GPS Location',
          origin_lat: lat,
          origin_lng: lon,
          origin_latitude: lat,
          origin_longitude: lon,
          location_source: 'gps',
          expected_consultation_iso: activeInfo?.expected_consultation_iso,
          safety_buffer_min: activeInfo?.safety_buffer_min || 10,
          leaving_now: activeInfo?.leaving_now,
          leaving_now_at: activeInfo?.leaving_now_at
        });
        if (res && res.recommended_departure_time) {
          setCurrentTravelInfo(prev => ({
            ...prev,
            ...res,
            origin_mode: 'gps',
            origin_label: 'Current GPS Location',
            origin_latitude: lat,
            origin_longitude: lon,
            origin_coordinates: [lon, lat],
            distance_km: res.distance_km,
            travel_time_min: res.travel_time_min,
            travel_time_minutes: res.travel_time_minutes || res.travel_time_min,
            route_geometry: res.route_geometry,
            patient_address: 'Current GPS Location',
            location_address: 'Current GPS Location',
            is_approximate_location: false,
            is_approximate: false,
            location_source: 'gps'
          }));
          setSelectedOrigin('Current GPS Location');
        }
      } catch (e) {
        console.warn('[Live GPS] Could not calculate departure with cached GPS:', e);
      } finally {
        setCalculating(false);
      }
      return;
    }

    // Otherwise, fetch fresh browser location
    setBrowserGps(prev => ({ ...prev, status: 'fetching' }));
    const loc = await getBrowserLocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    if (loc.success) {
      const lat = Number(loc.latitude.toFixed(6));
      const lon = Number(loc.longitude.toFixed(6));
      const accuracy = loc.accuracy ? Math.round(loc.accuracy) : null;
      const newCoords = [lon, lat];

      setLiveCoords(newCoords);
      setBrowserGps({
        coords: newCoords,
        accuracy,
        status: 'watching',
        timestamp: new Date().toLocaleTimeString()
      });
      setSelectedOrigin('Current GPS Location');
      setLastGpsReading({ lat, lon, accuracy, timestamp: new Date().toLocaleTimeString() });
      lastRecalcPosRef.current = { lat, lon };
      lastRecalcTimeRef.current = Date.now();

      try {
        const activeInfo = currentTravelInfo || initialTravelInfo;
        const res = await hospitalApi.calculateTravelDeparture({
          queue_id: activeInfo?.queue_id || activeInfo?.booking_id,
          origin_mode: 'gps',
          user_selected_gps: true,
          origin_label: 'Current GPS Location',
          origin: 'Current GPS Location',
          origin_lat: lat,
          origin_lng: lon,
          origin_latitude: lat,
          origin_longitude: lon,
          location_source: 'gps',
          expected_consultation_iso: activeInfo?.expected_consultation_iso,
          safety_buffer_min: activeInfo?.safety_buffer_min || 10,
          leaving_now: activeInfo?.leaving_now,
          leaving_now_at: activeInfo?.leaving_now_at
        });
        if (res && res.recommended_departure_time) {
          setCurrentTravelInfo(prev => ({
            ...prev,
            ...res,
            origin_mode: 'gps',
            origin_label: 'Current GPS Location',
            origin_latitude: lat,
            origin_longitude: lon,
            origin_coordinates: newCoords,
            distance_km: res.distance_km,
            travel_time_min: res.travel_time_min,
            travel_time_minutes: res.travel_time_minutes || res.travel_time_min,
            route_geometry: res.route_geometry,
            patient_address: 'Current GPS Location',
            location_address: 'Current GPS Location',
            is_approximate_location: false,
            is_approximate: false,
            location_source: 'gps'
          }));
          setSelectedOrigin('Current GPS Location');
        }
      } catch (e) {
        console.warn('[Live GPS] Could not calculate departure with GPS:', e);
      } finally {
        setCalculating(false);
      }
    } else {
      setCalculating(false);
      setBrowserGps(prev => ({ ...prev, status: loc.code === 1 ? 'denied' : 'unavailable' }));
      if (loc.code === 1) {
        setGpsErrorMessage('GPS Permission Denied — Using approximate location');
      } else {
        setGpsErrorMessage('GPS Unavailable — Using approximate location');
      }
    }
  };

  // MANUAL "I'M LEAVING NOW" ACTION
  const handleConfirmLeavingNow = async () => {
    if (isLeavingSubmitting) return;
    setIsLeavingSubmitting(true);
    setLeavingError(null);

    const activeInfo = currentTravelInfo || initialTravelInfo;
    const queueId = activeInfo?.queue_id || activeInfo?.booking_id;
    if (!queueId) {
      setLeavingError('No active queue token found to record departure.');
      setIsLeavingSubmitting(false);
      return;
    }

    try {
      // 1. Determine whether device GPS should be captured:
      // Only capture device GPS if location_source is explicitly device_gps/gps and NOT map_selected or manual
      const isDeviceGpsBooking = (activeInfo?.location_source === 'device_gps' || activeInfo?.location_source === 'gps');
      let coords = null;

      if (isDeviceGpsBooking) {
        try {
          const loc = await getBrowserLocation({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          });
          if (loc && loc.success) {
            const lat = Number(loc.latitude.toFixed(6));
            const lon = Number(loc.longitude.toFixed(6));
            coords = [lon, lat];
            setLiveCoords(coords);
            setIsExactGps(true);
            setGpsStatus('watching');
            setLiveTrackingActive(true);
            setSelectedOrigin('Current GPS Location');
            setLastGpsReading({ lat, lon, accuracy: loc.accuracy ? Math.round(loc.accuracy) : null, timestamp: new Date().toLocaleTimeString() });
            lastRecalcPosRef.current = { lat, lon };
            lastRecalcTimeRef.current = Date.now();
          }
        } catch (locErr) {
          console.warn('Could not capture fresh GPS for departure, using recorded coordinates:', locErr);
        }

        // If no fresh GPS, use currently active exact GPS coordinates if available
        if (!coords && liveCoords && isExactGps) {
          coords = liveCoords;
        }
      } else {
        // Patient location was selected on map or entered manually:
        // NEVER substitute the booker's browser GPS for the patient's selected location!
        if (liveCoords && liveCoords.length === 2) {
          coords = liveCoords;
        } else if (activeInfo?.origin_latitude != null && activeInfo?.origin_longitude != null) {
          coords = [Number(activeInfo.origin_longitude), Number(activeInfo.origin_latitude)];
        }
      }

      console.log(`[Leaving Now] Confirming departure for ${queueId} with coords:`, coords);

      // 2. Call backend confirmLeavingNow API (stores timestamp, updates departure and travel metrics)
      const res = await hospitalApi.confirmLeavingNow(queueId, coords);
      console.log('[Leaving Now] API response:', res);
      if (res) {
        const updated = res.queue_entry || res.data || res;
        setCurrentTravelInfo(prev => ({
          ...prev,
          ...updated,
          leaving_now: true,
          leaving_now_at: updated.leaving_now_at || new Date().toISOString()
        }));

        if (onRefreshQueue) {
          try {
            await onRefreshQueue();
          } catch {
            // refresh callback best effort
          }
        }
      }
    } catch (err) {
      console.error('Failed to confirm leaving now:', err);
      const serverMsg = err.response?.data?.error || err.response?.data?.message;
      if (err.response?.status === 401) {
        setLeavingError('Authentication required: Please log in as the patient to record departure.');
      } else if (err.response?.status === 403) {
        setLeavingError(serverMsg || 'Unauthorized: You can only record departure for your own active queue token.');
      } else if (serverMsg) {
        setLeavingError(serverMsg);
      } else {
        setLeavingError(err.message || 'Could not record departure. Please retry.');
      }
    } finally {
      setIsLeavingSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-sky-800/80">
      
      {/* Decorative background circle */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-white/10 gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-tr from-sky-500/30 to-teal-500/30 rounded-2xl flex items-center justify-center text-sky-400 border border-sky-400/40 shadow-inner">
            <Car className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base text-white tracking-tight">{t('when_to_leave', 'Smart Patient Departure Engine')}</h3>
              {originMode === 'preset' ? (
                <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded-full border border-sky-500/30 flex items-center gap-1">
                  <span>📌 {t('using_selected_location', 'Using selected location')}</span>
                </span>
              ) : travelInfo?.is_approximate || travelInfo?.is_approximate_location || travelInfo?.location_source === 'manual' ? (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span>{t('approximate_notice', 'Approximate location — travel time may vary.')}</span>
                </span>
              ) : travelInfo?.location_source === 'map_selected' ? (
                <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2.5 py-0.5 rounded-full border border-sky-500/30 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-sky-400" />
                  <span>{t('location_source_map', 'Map Selected')}</span>
                </span>
              ) : isExactGps && liveCoords ? (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>✓ {t('live_gps_active', 'Exact GPS Active')}</span>
                </span>
              ) : (browserGps.status === 'denied' || browserGps.status === 'unavailable') ? (
                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span>{t('gps_unavailable', 'GPS unavailable — Using approximate location')}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span>{t('approx_landmark', 'Approximate Landmark Transit')}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-sky-300 font-medium">{t('destination', 'Destination')}: {t('destination_address', 'SIMSRH Campus, Sira Road, NH4, Lingapura, Tumakuru – 572106')}</p>
          </div>
        </div>

        {/* Origin Selector & GPS button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={calculating}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer disabled:opacity-50 border ${
              originMode === 'gps' && isExactGps
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/40 text-sky-200'
            }`}
            title="Switch route to real browser GPS"
          >
            {calculating ? (
              <RefreshCw className="w-3.5 h-3.5 text-sky-300 animate-spin" />
            ) : originMode === 'gps' && isExactGps ? (
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-sky-300" />
            )}
            <span>
              {calculating
                ? t('locating', 'Locating...')
                : originMode === 'gps' && isExactGps
                  ? t('live_gps_active', 'Live GPS Active')
                  : t('current_gps_location', 'Current GPS Location')}
            </span>
          </button>

          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10 backdrop-blur-sm">
            <MapPin className="w-4 h-4 text-sky-400 ml-1.5 shrink-0" />
            <select
              value={selectedOrigin}
              onChange={(e) => handleOriginChange(e.target.value)}
              disabled={calculating}
              className="bg-transparent text-white text-xs font-bold rounded-xl pr-2 focus:outline-none cursor-pointer"
            >
              <option value="Current GPS Location" className="bg-slate-900 text-emerald-300 font-semibold">
                📍 {t('current_gps_location', 'Current GPS Location')}
              </option>
              {TUMKUR_OPTIONS.map((loc) => (
                <option key={loc} value={loc} className="bg-slate-900 text-white font-medium">
                  {loc}
                </option>
              ))}
              {selectedOrigin && selectedOrigin !== 'Current GPS Location' && !TUMKUR_OPTIONS.includes(selectedOrigin) && (
                <option value={selectedOrigin} className="bg-slate-900 text-sky-300 font-medium">
                  📌 {selectedOrigin}
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Preset Selected Location Notice */}
      {originMode === 'preset' && (
        <div className="mb-4 px-3.5 py-2 rounded-2xl bg-sky-950/80 border border-sky-400/40 text-xs text-sky-200 flex items-center justify-between flex-wrap gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{t('origin', 'Origin')}: <strong className="text-white">{selectedOrigin}</strong></span>
          </div>
          <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-400/30 flex items-center gap-1">
            <span>📌 {t('using_selected_location', 'Using selected location')}</span>
          </span>
        </div>
      )}

      {/* Explicit Approximate Location Notice as required */}
      {originMode !== 'preset' && (travelInfo?.is_approximate || travelInfo?.is_approximate_location || travelInfo?.location_source === 'manual') && (
        <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-amber-950/80 border border-amber-500/50 text-xs text-amber-200 flex items-center gap-2.5 shadow-inner">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-semibold">{t('approximate_notice', 'Approximate location — travel time may vary.')}</span>
        </div>
      )}

      {/* Map Selected Location Notice */}
      {originMode !== 'preset' && travelInfo?.location_source === 'map_selected' && (
        <div className="mb-4 px-3.5 py-2 rounded-2xl bg-sky-950/80 border border-sky-400/40 text-xs text-sky-200 flex items-center justify-between flex-wrap gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{t('patient_location', 'Patient Location')}: <strong className="text-white">{travelInfo?.location_address || travelInfo?.patient_address || selectedOrigin}</strong></span>
          </div>
          <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-400/30">
            {t('location_source_map', 'Map Selected')}
          </span>
        </div>
      )}

      {/* Route & GPS Metrics Info Pill */}
      {(lastGpsReading || browserGps.coords || (originMode === 'gps' && liveCoords)) && (
        <div className="mb-4 px-3.5 py-2 rounded-2xl bg-sky-950/80 border border-sky-400/40 text-[11px] font-mono text-sky-200 flex items-center justify-between flex-wrap gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${originMode === 'gps' && isExactGps ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'} shrink-0`} />
            <span>
              {originMode === 'gps' ? (
                <>
                  {t('device_gps', { coords: '' }, 'Device GPS')}: <strong className="text-emerald-300">{liveCoords ? `${liveCoords[1].toFixed(6)}°N, ${liveCoords[0].toFixed(6)}°E` : 'Acquiring...'}</strong>
                  {lastGpsReading?.accuracy ? ` (±${lastGpsReading.accuracy}m)` : ''}
                </>
              ) : (
                <>
                  <span>Origin: <strong className="text-sky-300">{selectedOrigin}</strong></span>
                  {browserGps.coords && (
                    <span className="text-slate-400 ml-1.5 font-sans text-[10px]">
                      (GPS: {browserGps.coords[1].toFixed(4)}°N, {browserGps.coords[0].toFixed(4)}°E)
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="text-slate-300 text-[10px]">
            {t('route_metrics', { distance: travelInfo.distance_km != null ? travelInfo.distance_km : 0.0, duration: travelInfo.travel_time_min ?? travelDuration }, `Active Route: ${travelInfo.distance_km != null ? travelInfo.distance_km : 0.0} km (${travelInfo.travel_time_min ?? travelDuration} mins to SIMSRH)`)}
          </div>
        </div>
      )}

      {/* GPS Error Alert if permission denied or unavailable */}
      {gpsErrorMessage && !isExactGps && (
        <div className="mb-4 px-3.5 py-2 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-[11px] text-rose-200 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="font-semibold">{gpsErrorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setGpsErrorMessage(null)}
            className="text-rose-400 hover:text-white text-xs cursor-pointer ml-2 px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Hero Countdown & Departure Banner with Authoritative State Evaluation */}
      <div className={`my-6 text-center backdrop-blur-md rounded-3xl p-6 border relative z-10 transition-all ${
        departureState === DEPARTURE_STATES.VERY_LATE
          ? 'bg-rose-950/40 border-red-500/50 shadow-2xl shadow-rose-950/50 ring-1 ring-red-500/40'
          : departureState === DEPARTURE_STATES.URGENT
          ? 'bg-orange-950/40 border-amber-500/50 shadow-2xl shadow-amber-950/50 ring-1 ring-amber-500/40'
          : departureState === DEPARTURE_STATES.LEAVE_NOW
          ? 'bg-amber-950/30 border-amber-400/40 shadow-xl'
          : 'bg-white/5 border-white/10'
      }`}>

        {/* STATE 1: VERY_LATE (Arrival deadline has passed without arrival verification) */}
        {departureState === DEPARTURE_STATES.VERY_LATE && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
                {t('late_arrival_warning_subtitle', '2-Minute Grace Period Expired')}
              </span>
              {displayArrivalDeadline && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500/40">
                  {t('arrival_deadline', 'Deadline was')}: {displayArrivalDeadline}
                </span>
              )}
            </div>

            <div className="text-3xl sm:text-5xl font-black text-red-400 font-mono tracking-tight mb-2 uppercase">
              {t('arrival_deadline', 'ARRIVAL DEADLINE PASSED')}
            </div>

            <p className="text-sm font-bold text-red-100 max-w-xl mx-auto leading-relaxed">
              {t('late_arrival_desc', "Your 2-minute grace period has expired. You may be moved to the end of your doctor's queue.")}
            </p>

            {travelInfo.late_arrival_reordered && (
              <div className="mt-3 text-xs bg-amber-500/20 text-amber-200 border border-amber-500/40 rounded-xl px-4 py-2 inline-block font-semibold">
                ⚠️ {t('details', 'Notice')}: {t('late_arrival_desc', `Your position has been updated to the end of Dr. ${travelInfo.doctor_name || "your doctor"}'s queue due to late arrival.`)}
              </div>
            )}
          </div>
        )}

        {/* STATE 2: URGENT (Expected hospital arrival has passed, but within 2-minute deadline) */}
        {departureState === DEPARTURE_STATES.URGENT && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
                {t('emergency_priority', 'Action Required')}
              </span>
              {displayArrivalTime && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {t('expected_arrival', 'Expected Arrival')}: {displayArrivalTime} ({t('urgent', 'Passed')})
                </span>
              )}
            </div>

            <div className="text-3xl sm:text-5xl font-black text-rose-300 font-mono tracking-tight mb-2 uppercase">
              {t('urgent', 'URGENT — YOU MAY BE LATE')}
            </div>

            <p className="text-sm font-bold text-rose-100 max-w-xl mx-auto leading-relaxed">
              {t('hurry_leave_immediately', 'Your expected hospital arrival time has passed. Leave immediately to avoid missing your queue position.')}
            </p>

            <div className="mt-3 text-xs bg-rose-950/70 text-rose-200 border border-rose-500/40 rounded-xl px-4 py-2 inline-block font-medium">
              ⚠️ {t('late_warning_buffer', `Arriving late may cause you to be moved to the END of your doctor's queue after the 2-minute arrival deadline (${displayArrivalDeadline || 'soon'}).`)}
            </div>
          </div>
        )}

        {/* STATE 3: LEAVE_NOW (Recommended departure reached, but before expected arrival) */}
        {departureState === DEPARTURE_STATES.LEAVE_NOW && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                {t('departure_status', 'Departure Window Active')}
              </span>
              {displayDepartureTime && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {t('safe_departure_time', 'Recommended')}: {displayDepartureTime}
                </span>
              )}
            </div>

            <div className="text-4xl sm:text-6xl font-black text-amber-300 font-mono tracking-tight mb-2 animate-pulse">
              {t('leave_now', 'LEAVE NOW')}
            </div>

            <p className="text-sm font-bold text-amber-100 max-w-xl mx-auto leading-relaxed">
              {t('hurry_leave_immediately', 'Your recommended departure time has arrived.')}
            </p>

            <p className="text-xs text-slate-300 mt-1 max-w-xl mx-auto">
              {t('safe_on_time', `Start your journey from ${selectedOrigin} immediately to reach SIMSRH on schedule before your expected arrival (${displayArrivalTime || 'soon'}).`)}
            </p>
          </div>
        )}

        {/* STATE 4: BEFORE_DEPARTURE (Normal countdown before departure time) */}
        {departureState === DEPARTURE_STATES.BEFORE_DEPARTURE && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-teal-300">
                {t('safe_departure_time', 'Recommended Departure Time')}
              </span>
              {minsUntilDeparture !== null && (
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    minsUntilDeparture > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {minsUntilDeparture > 0 ? `In ~${minsUntilDeparture} ${t('mins_short', 'mins')}` : t('leave_now', 'Depart Soon')}
                </span>
              )}
            </div>

            <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-100 to-teal-200">
              {displayDepartureTime || '10:45 AM'}
            </div>

            <p className="text-xs text-slate-300 font-medium max-w-xl mx-auto leading-relaxed">
              {travelInfo.departure_alert || `🚗 Start from ${selectedOrigin} around ${displayDepartureTime} to arrive at SIMSRH Tumakuru ~${safetyBuffer} mins before your consultation at ${displayTurnWindow}.`}
            </p>
          </div>
        )}

        {/* STATE 5: ARRIVED_OR_TERMINAL (Patient already arrived or consultation closed) */}
        {departureState === DEPARTURE_STATES.ARRIVED_OR_TERMINAL && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {t('arrival_verified_title', 'Hospital Arrival Verified')}
              </span>
            </div>

            <div className="text-3xl sm:text-5xl font-black text-emerald-300 font-mono tracking-tight mb-2">
              {t('arrival_verified_title', 'ARRIVED AT SIMSRH')}
            </div>

            <p className="text-xs text-slate-300 font-medium max-w-xl mx-auto leading-relaxed">
              {t('otp_verified_success', 'Your arrival has been verified. Please wait in the OPD lounge for your token to be called.')}
            </p>
          </div>
        )}

        {/* Authoritative Arrival & Deadline Times Bar */}
        {(displayArrivalTime || displayArrivalDeadline) && departureState !== DEPARTURE_STATES.ARRIVED_OR_TERMINAL && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-4 flex-wrap text-xs text-slate-300">
            {displayArrivalTime && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">{t('expected_arrival', 'Expected Hospital Arrival')}:</span>
                <span className="font-bold text-sky-200">{displayArrivalTime}</span>
              </div>
            )}
            {displayArrivalDeadline && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">{t('arrival_deadline', '2-Min Arrival Deadline')}:</span>
                <span className="font-bold text-rose-300">{displayArrivalDeadline}</span>
              </div>
            )}
          </div>
        )}

        {/* MANUAL "I'M LEAVING NOW" ACTION BUTTON */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center justify-center gap-2">
          {travelInfo.leaving_now ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {t('patient_en_route', 'You are en route to SIMSRH')}
                {travelInfo.leaving_now_at
                  ? ` (${t('you_have_departed', { time: new Date(travelInfo.leaving_now_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) }, `Departed at ${new Date(travelInfo.leaving_now_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`)})`
                  : ''}
              </span>
            </div>
          ) : !isPatientArrivedOrTerminal(travelInfo) ? (
            <button
              type="button"
              id="btn-leaving-now"
              onClick={handleConfirmLeavingNow}
              disabled={isLeavingSubmitting}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 ${
                departureState === DEPARTURE_STATES.VERY_LATE || departureState === DEPARTURE_STATES.URGENT
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-rose-900/40 animate-pulse'
                  : departureState === DEPARTURE_STATES.LEAVE_NOW
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-900/40'
                  : 'bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-400 hover:to-sky-400 text-slate-950 shadow-sky-900/40'
              }`}
            >
              {isLeavingSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('marking_departure', 'Synchronizing Departure & GPS...')}</span>
                </>
              ) : (
                <>
                  <Car className="w-4 h-4" />
                  <span>{t('i_am_leaving_now', "I'm Leaving Now")}</span>
                </>
              )}
            </button>
          ) : null}

          {leavingError && (
            <div className="text-[11px] text-rose-300 font-semibold mt-1">
              {leavingError}
            </div>
          )}
        </div>

      </div>

      {/* Grid Metrics - ONLY for pre-arrival patients */}
      {departureState !== DEPARTURE_STATES.ARRIVED_OR_TERMINAL && !isPatientArrivedOrTerminal(travelInfo) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center relative z-10">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">{t('route_metrics', 'Transit Distance')}</span>
            <span className="text-lg font-black text-white">{travelInfo.distance_km != null ? travelInfo.distance_km : 0.2} {t('km_short', 'km')}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">{t('live_travel_duration', 'Travel Duration')}</span>
            <span className="text-lg font-black text-sky-300">{travelDuration} {t('mins_short', 'mins')}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">{t('safety_buffer_included', 'Safety Buffer')}</span>
            <span className="text-lg font-black text-teal-300">+{safetyBuffer} {t('mins_short', 'mins')}</span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">{t('expected_consultation_label', 'OPD Turn Window')}</span>
            <span className="text-lg font-black text-white">{displayTurnWindow}</span>
          </div>
        </div>
      )}

      {/* Interactive Live Transit Route Map (MapLibre + OpenFreeMap + Throttled Live GPS) - ONLY for pre-arrival */}
      {departureState !== DEPARTURE_STATES.ARRIVED_OR_TERMINAL && !isPatientArrivedOrTerminal(travelInfo) && (
        <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                {t('when_to_leave', 'Live Road Route Navigation')}
              </span>
            </div>
            <span className="text-[10px] text-sky-300/80 font-medium">
              OpenRouteService • OpenFreeMap
            </span>
          </div>
          <LiveRouteMap
            travelInfo={travelInfo}
            liveCoords={liveCoords}
            isExactGps={isExactGps}
            isWatching={isExactGps && browserGps.status === 'watching'}
            gpsStatus={browserGps.status}
            originMode={originMode}
            selectedOriginName={selectedOrigin}
            selectedPresetCoords={selectedPreset?.coords}
          />
        </div>
      )}

    </div>
  );
}
