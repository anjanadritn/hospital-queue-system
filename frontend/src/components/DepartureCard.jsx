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

const TUMKUR_OPTIONS = [
  'Tumkur Bus Stand',
  'Batawadi',
  'Kyatsandra',
  'SSIT Campus',
  'Sira Gate',
  'Gubbi Gate',
  'Tumkur Railway Station',
  'B.H. Road Tumkur',
  'Siddaganga Matha'
];

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
  const [currentTravelInfo, setCurrentTravelInfo] = useState(initialTravelInfo);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [isLeavingSubmitting, setIsLeavingSubmitting] = useState(false);
  const [leavingError, setLeavingError] = useState(null);
  const [lastGpsReading, setLastGpsReading] = useState(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState(null);

  // Exact GPS state: only true if verified from real browser GPS reading
  const [isExactGps, setIsExactGps] = useState(() => {
    return Boolean(
      initialTravelInfo?.location_source === 'gps' &&
      initialTravelInfo?.is_approximate_location === false &&
      initialTravelInfo?.origin_latitude &&
      initialTravelInfo?.origin_longitude
    );
  });

  const [selectedOrigin, setSelectedOrigin] = useState(() => {
    if (
      initialTravelInfo?.location_source === 'gps' &&
      initialTravelInfo?.origin_latitude &&
      initialTravelInfo?.origin_longitude &&
      initialTravelInfo?.is_approximate_location === false
    ) {
      return 'Current GPS Location';
    }
    return initialTravelInfo?.patient_address || initialTravelInfo?.city || 'Tumakuru';
  });

  const [calculating, setCalculating] = useState(false);
  const [minsUntilDeparture, setMinsUntilDeparture] = useState(null);

  // Live GPS tracking state: [lon, lat]
  const [liveCoords, setLiveCoords] = useState(() => {
    if (
      initialTravelInfo?.location_source === 'gps' &&
      initialTravelInfo?.origin_latitude &&
      initialTravelInfo?.origin_longitude &&
      initialTravelInfo?.is_approximate_location === false
    ) {
      return [
        Number(initialTravelInfo.origin_longitude),
        Number(initialTravelInfo.origin_latitude)
      ];
    }
    return null;
  });

  const [gpsStatus, setGpsStatus] = useState(() => {
    if (
      initialTravelInfo?.location_source === 'gps' &&
      initialTravelInfo?.origin_latitude &&
      initialTravelInfo?.origin_longitude &&
      initialTravelInfo?.is_approximate_location === false
    ) {
      return 'watching';
    }
    return 'idle';
  });

  const [liveTrackingActive, setLiveTrackingActive] = useState(() => {
    return Boolean(
      initialTravelInfo?.location_source === 'gps' &&
      initialTravelInfo?.origin_latitude &&
      initialTravelInfo?.origin_longitude &&
      initialTravelInfo?.is_approximate_location === false
    );
  });

  const lastRecalcPosRef = useRef(
    initialTravelInfo?.location_source === 'gps' &&
    initialTravelInfo?.origin_latitude &&
    initialTravelInfo?.origin_longitude &&
    initialTravelInfo?.is_approximate_location === false
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
      // When live GPS is active or route metrics were calculated in prev,
      // NEVER overwrite GPS coordinates, distance, travel duration, route geometry,
      // or dynamic arrival/deadline times with stale values from polling
      const hasLiveMetrics = Boolean(
        (isExactGps && liveCoords && liveCoords.length === 2) ||
        (prev.location_source === 'gps') ||
        (prev.distance_km != null && prev.distance_km !== initialTravelInfo.distance_km)
      );

      if (hasLiveMetrics) {
        return {
          ...initialTravelInfo,
          origin_latitude: prev.origin_latitude || (liveCoords ? liveCoords[1] : null) || initialTravelInfo.origin_latitude,
          origin_longitude: prev.origin_longitude || (liveCoords ? liveCoords[0] : null) || initialTravelInfo.origin_longitude,
          origin_coordinates: prev.origin_coordinates || liveCoords || initialTravelInfo.origin_coordinates,
          distance_km: prev.distance_km != null ? prev.distance_km : initialTravelInfo.distance_km,
          travel_time_min: prev.travel_time_min != null ? prev.travel_time_min : initialTravelInfo.travel_time_min,
          travel_time_minutes: prev.travel_time_minutes != null ? prev.travel_time_minutes : (prev.travel_time_min || initialTravelInfo.travel_time_minutes),
          route_geometry: prev.route_geometry || initialTravelInfo.route_geometry,
          patient_address: prev.patient_address || initialTravelInfo.patient_address || 'Current GPS Location',
          is_approximate_location: prev.is_approximate_location != null ? prev.is_approximate_location : false,
          location_source: prev.location_source || 'gps',
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

    if (!isExactGps) {
      if (
        initialTravelInfo.location_source === 'gps' &&
        initialTravelInfo.origin_latitude &&
        initialTravelInfo.origin_longitude &&
        initialTravelInfo.is_approximate_location === false
      ) {
        setSelectedOrigin(initialTravelInfo.patient_address || 'Current GPS Location');
        const coords = [Number(initialTravelInfo.origin_longitude), Number(initialTravelInfo.origin_latitude)];
        setLiveCoords(coords);
        setIsExactGps(true);
        setGpsStatus('watching');
        lastRecalcPosRef.current = {
          lat: Number(initialTravelInfo.origin_latitude),
          lon: Number(initialTravelInfo.origin_longitude)
        };
      } else if (initialTravelInfo.patient_address) {
        setSelectedOrigin(initialTravelInfo.patient_address);
      }
    }

    if (!initialTravelInfo.recommended_departure_time && !isExactGps && (initialTravelInfo.patient_address || initialTravelInfo.origin_latitude)) {
      const orig = initialTravelInfo.patient_address || initialTravelInfo.city || 'Tumakuru';
      hospitalApi.calculateTravelDeparture({
        origin: orig,
        origin_latitude: initialTravelInfo.origin_latitude,
        origin_longitude: initialTravelInfo.origin_longitude,
        expected_consultation_iso: initialTravelInfo.expected_consultation_iso,
        safety_buffer_min: 10
      }).then((res) => {
        if (res && res.recommended_departure_time) {
          setCurrentTravelInfo(res);
        }
      }).catch((err) => console.warn('Could not calculate initial departure:', err));
    }
  }, [initialTravelInfo, isExactGps]);

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

  // Watch GPS Position and throttle route recalculation (movement >= 75m or interval)
  useEffect(() => {
    if (!liveTrackingActive || typeof window === 'undefined' || !navigator?.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));

        // Move patient marker in real-time immediately with newest coordinate
        setLiveCoords([lon, lat]);
        setIsExactGps(true);
        setGpsStatus('watching');
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
            origin: 'Current GPS Location',
            origin_latitude: lat,
            origin_longitude: lon,
            expected_consultation_iso: activeInfo?.expected_consultation_iso,
            safety_buffer_min: activeInfo?.safety_buffer_min || 10,
            leaving_now: activeInfo?.leaving_now,
            leaving_now_at: activeInfo?.leaving_now_at
          }).then((res) => {
            if (res && res.recommended_departure_time) {
              setCurrentTravelInfo({
                ...res,
                origin_latitude: lat,
                origin_longitude: lon,
                is_approximate_location: false,
                location_source: 'gps'
              });
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
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setLiveTrackingActive(false);
          setIsExactGps(false);
          setLiveCoords(null);
        } else {
          setGpsStatus('unavailable');
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
  }, [liveTrackingActive, initialTravelInfo]);

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

  // Manual origin change (user chooses landmark from dropdown)
  const handleOriginChange = async (origin) => {
    setSelectedOrigin(origin);
    setLiveTrackingActive(false);
    setLiveCoords(null);
    setIsExactGps(false);
    setGpsStatus('idle');
    lastRecalcPosRef.current = null;
    setCalculating(true);

    try {
      const res = await hospitalApi.calculateTravelDeparture({
        origin: origin,
        expected_consultation_iso: travelInfo.expected_consultation_iso,
        safety_buffer_min: travelInfo.safety_buffer_min || 10
      });
      if (res && res.recommended_departure_time) {
        setCurrentTravelInfo(res);
      }
    } catch (e) {
      console.warn('Could not recalculate departure time from backend:', e);
    } finally {
      setCalculating(false);
    }
  };

  // Button click to enable/refresh live GPS (GPS reading alone does NOT trigger leaving_now)
  const handleUseCurrentLocation = async () => {
    setCalculating(true);
    setGpsStatus('fetching');
    setGpsErrorMessage(null);

    console.log('[Live GPS] Requesting fresh high-accuracy device GPS (maximumAge: 0)...');

    const loc = await getBrowserLocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    console.log('[Live GPS] Result from locationService:', loc);

    if (loc.success) {
      const lat = Number(loc.latitude.toFixed(6));
      const lon = Number(loc.longitude.toFixed(6));
      const accuracy = loc.accuracy ? Math.round(loc.accuracy) : null;
      const newCoords = [lon, lat];

      console.log(`[Live GPS] Fresh Browser GPS coordinates acquired: lat=${lat}, lon=${lon}, accuracy=±${accuracy}m`);

      // 2. Store returned coordinates
      setLiveCoords(newCoords);
      setIsExactGps(true);
      setGpsStatus('watching');
      setLiveTrackingActive(true);
      setSelectedOrigin('Current GPS Location');
      setLastGpsReading({ lat, lon, accuracy, timestamp: new Date().toLocaleTimeString() });
      lastRecalcPosRef.current = { lat, lon };
      lastRecalcTimeRef.current = Date.now();

      try {
        const activeInfo = currentTravelInfo || initialTravelInfo;
        console.log(`[Live GPS] Calling route calculation with exact coordinates: origin_latitude=${lat}, origin_longitude=${lon}`);
        const res = await hospitalApi.calculateTravelDeparture({
          queue_id: activeInfo?.queue_id || activeInfo?.booking_id,
          origin: 'Current GPS Location',
          origin_latitude: lat,
          origin_longitude: lon,
          expected_consultation_iso: activeInfo?.expected_consultation_iso,
          safety_buffer_min: activeInfo?.safety_buffer_min || 10,
          leaving_now: activeInfo?.leaving_now,
          leaving_now_at: activeInfo?.leaving_now_at
        });
        console.log('[Live GPS] Route calculation response:', res);
        if (res && res.recommended_departure_time) {
          console.log(`[Live GPS] Route updated successfully: distance_km=${res.distance_km}, travel_time_min=${res.travel_time_min}`);
          setCurrentTravelInfo(prev => ({
            ...prev,
            ...res,
            origin_latitude: lat,
            origin_longitude: lon,
            origin_coordinates: newCoords,
            distance_km: res.distance_km,
            travel_time_min: res.travel_time_min,
            travel_time_minutes: res.travel_time_minutes || res.travel_time_min,
            route_geometry: res.route_geometry,
            patient_address: 'Current GPS Location',
            is_approximate_location: false,
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
      console.warn('[Live GPS] Browser GPS failed or was denied:', loc);
      setCalculating(false);
      setIsExactGps(false);
      setLiveCoords(null);
      setLiveTrackingActive(false);
      if (loc.code === 1) {
        setGpsStatus('denied');
        setGpsErrorMessage('GPS Permission Denied — Using approximate location');
      } else {
        setGpsStatus('unavailable');
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
      // 1. Capture fresh browser GPS reading (high accuracy, no cache)
      let coords = null;
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
              <h3 className="font-extrabold text-base text-white tracking-tight">Smart Patient Departure Engine</h3>
              {isExactGps && liveCoords ? (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>✓ Exact GPS Active</span>
                </span>
              ) : (gpsStatus === 'denied' || gpsStatus === 'unavailable') ? (
                <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span>GPS unavailable — Using approximate location</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span>Approximate Landmark Transit</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-sky-300 font-medium">Destination: SIMSRH Campus, Sira Road, NH4, Lingapura, Tumakuru – 572106</p>
          </div>
        </div>

        {/* Origin Selector & GPS button */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={calculating}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer disabled:opacity-50 border ${
              isExactGps
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/40 text-sky-200'
            }`}
            title="Update departure using real browser GPS"
          >
            {calculating ? (
              <RefreshCw className="w-3.5 h-3.5 text-sky-300 animate-spin" />
            ) : isExactGps ? (
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-sky-300" />
            )}
            <span>
              {calculating
                ? 'Locating...'
                : isExactGps
                  ? 'Live GPS Active'
                  : 'Live GPS'}
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
              {selectedOrigin && !TUMKUR_OPTIONS.includes(selectedOrigin) && (
                <option value={selectedOrigin} className="bg-slate-900 text-emerald-300 font-medium">
                  📍 {selectedOrigin}
                </option>
              )}
              {TUMKUR_OPTIONS.map((loc) => (
                <option key={loc} value={loc} className="bg-slate-900 text-white font-medium">
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Temporary Debug GPS Pill / Log Console */}
      {(lastGpsReading || (isExactGps && liveCoords)) && (
        <div className="mb-4 px-3.5 py-2 rounded-2xl bg-sky-950/80 border border-sky-400/40 text-[11px] font-mono text-sky-200 flex items-center justify-between flex-wrap gap-2 shadow-inner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>
              Device GPS: <strong className="text-emerald-300">{liveCoords ? `${liveCoords[1].toFixed(6)}°N, ${liveCoords[0].toFixed(6)}°E` : 'Acquiring...'}</strong>
              {lastGpsReading?.accuracy ? ` (±${lastGpsReading.accuracy}m)` : ''}
            </span>
          </div>
          <div className="text-slate-300 text-[10px]">
            Active Route: <strong className="text-sky-300">{travelInfo.distance_km != null ? travelInfo.distance_km : 0.0} km</strong> ({travelInfo.travel_time_min ?? travelDuration} mins to SIMSRH)
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
                2-Minute Grace Period Expired
              </span>
              {displayArrivalDeadline && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500/40">
                  Deadline was: {displayArrivalDeadline}
                </span>
              )}
            </div>

            <div className="text-3xl sm:text-5xl font-black text-red-400 font-mono tracking-tight mb-2 uppercase">
              ARRIVAL DEADLINE PASSED
            </div>

            <p className="text-sm font-bold text-red-100 max-w-xl mx-auto leading-relaxed">
              Your 2-minute grace period has expired. You may be moved to the end of your doctor's queue.
            </p>

            {travelInfo.late_arrival_reordered && (
              <div className="mt-3 text-xs bg-amber-500/20 text-amber-200 border border-amber-500/40 rounded-xl px-4 py-2 inline-block font-semibold">
                ⚠️ Notice: Your position has been updated to the end of Dr. {travelInfo.doctor_name || "your doctor"}'s queue due to late arrival.
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
                Action Required
              </span>
              {displayArrivalTime && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Expected Arrival: {displayArrivalTime} (Passed)
                </span>
              )}
            </div>

            <div className="text-3xl sm:text-5xl font-black text-rose-300 font-mono tracking-tight mb-2 uppercase">
              URGENT — YOU MAY BE LATE
            </div>

            <p className="text-sm font-bold text-rose-100 max-w-xl mx-auto leading-relaxed">
              Your expected hospital arrival time has passed. Leave immediately to avoid missing your queue position.
            </p>

            <div className="mt-3 text-xs bg-rose-950/70 text-rose-200 border border-rose-500/40 rounded-xl px-4 py-2 inline-block font-medium">
              ⚠️ Arriving late may cause you to be moved to the <strong>END of your doctor's queue</strong> after the 2-minute arrival deadline ({displayArrivalDeadline || 'soon'}).
            </div>
          </div>
        )}

        {/* STATE 3: LEAVE_NOW (Recommended departure reached, but before expected arrival) */}
        {departureState === DEPARTURE_STATES.LEAVE_NOW && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
                Departure Window Active
              </span>
              {displayDepartureTime && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Recommended: {displayDepartureTime}
                </span>
              )}
            </div>

            <div className="text-4xl sm:text-6xl font-black text-amber-300 font-mono tracking-tight mb-2 animate-pulse">
              LEAVE NOW
            </div>

            <p className="text-sm font-bold text-amber-100 max-w-xl mx-auto leading-relaxed">
              Your recommended departure time has arrived.
            </p>

            <p className="text-xs text-slate-300 mt-1 max-w-xl mx-auto">
              Start your journey from {selectedOrigin} immediately to reach SIMSRH on schedule before your expected arrival ({displayArrivalTime || 'soon'}).
            </p>
          </div>
        )}

        {/* STATE 4: BEFORE_DEPARTURE (Normal countdown before departure time) */}
        {departureState === DEPARTURE_STATES.BEFORE_DEPARTURE && (
          <div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xs font-extrabold uppercase tracking-widest text-teal-300">
                Recommended Departure Time
              </span>
              {minsUntilDeparture !== null && (
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                    minsUntilDeparture > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {minsUntilDeparture > 0 ? `In ~${minsUntilDeparture} mins` : 'Depart Soon'}
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
                Hospital Arrival Verified
              </span>
            </div>

            <div className="text-3xl sm:text-5xl font-black text-emerald-300 font-mono tracking-tight mb-2">
              ARRIVED AT SIMSRH
            </div>

            <p className="text-xs text-slate-300 font-medium max-w-xl mx-auto leading-relaxed">
              Your arrival has been verified. Please wait in the OPD lounge for your token to be called.
            </p>
          </div>
        )}

        {/* Authoritative Arrival & Deadline Times Bar */}
        {(displayArrivalTime || displayArrivalDeadline) && departureState !== DEPARTURE_STATES.ARRIVED_OR_TERMINAL && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-4 flex-wrap text-xs text-slate-300">
            {displayArrivalTime && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Expected Hospital Arrival:</span>
                <span className="font-bold text-sky-200">{displayArrivalTime}</span>
              </div>
            )}
            {displayArrivalDeadline && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">2-Min Arrival Deadline:</span>
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
                You are en route to SIMSRH
                {travelInfo.leaving_now_at
                  ? ` (Departed at ${new Date(travelInfo.leaving_now_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })})`
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
                  <span>Synchronizing Departure & GPS...</span>
                </>
              ) : (
                <>
                  <Car className="w-4 h-4" />
                  <span>I'm Leaving Now</span>
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

      {/* Grid Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center relative z-10">
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Transit Distance</span>
          <span className="text-lg font-black text-white">{travelInfo.distance_km != null ? travelInfo.distance_km : 0.2} km</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Travel Duration</span>
          <span className="text-lg font-black text-sky-300">{travelDuration} mins</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Safety Buffer</span>
          <span className="text-lg font-black text-teal-300">+{safetyBuffer} mins</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">OPD Turn Window</span>
          <span className="text-lg font-black text-white">{displayTurnWindow}</span>
        </div>
      </div>

      {/* Interactive Live Transit Route Map (MapLibre + OpenFreeMap + Throttled Live GPS) */}
      <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Live Road Route Navigation
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
          isWatching={isExactGps && gpsStatus === 'watching'}
          gpsStatus={gpsStatus}
        />
      </div>

    </div>
  );
}
