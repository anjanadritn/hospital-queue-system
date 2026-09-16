import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Clock,
  ShieldCheck,
  MapPin,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Car,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
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

export default function DepartureCard({ travelInfo: initialTravelInfo }) {
  const [currentTravelInfo, setCurrentTravelInfo] = useState(initialTravelInfo);
  const [selectedOrigin, setSelectedOrigin] = useState(
    initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude
      ? (initialTravelInfo.patient_address || 'Current GPS Location')
      : (initialTravelInfo?.patient_address || 'Tumkur Bus Stand')
  );
  const [calculating, setCalculating] = useState(false);
  const [minsUntilDeparture, setMinsUntilDeparture] = useState(null);

  // Live GPS tracking state
  const [liveCoords, setLiveCoords] = useState(() => {
    if (initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude) {
      return [
        Number(initialTravelInfo.origin_longitude),
        Number(initialTravelInfo.origin_latitude)
      ];
    }
    return null;
  });

  const [gpsStatus, setGpsStatus] = useState(
    (initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude)
      ? 'watching'
      : 'idle'
  );

  const [liveTrackingActive, setLiveTrackingActive] = useState(
    Boolean(
      (initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude) ||
      initialTravelInfo?.is_approximate_location === false
    )
  );

  const lastRecalcPosRef = useRef(
    initialTravelInfo?.origin_latitude && initialTravelInfo?.origin_longitude
      ? { lat: Number(initialTravelInfo.origin_latitude), lon: Number(initialTravelInfo.origin_longitude) }
      : null
  );
  const lastRecalcTimeRef = useRef(Date.now());
  const isRecalculatingRef = useRef(false);

  // Sync state when parent travelInfo prop changes
  useEffect(() => {
    if (initialTravelInfo) {
      setCurrentTravelInfo(initialTravelInfo);
      if (initialTravelInfo.origin_latitude && initialTravelInfo.origin_longitude) {
        setSelectedOrigin(initialTravelInfo.patient_address || 'Current GPS Location');
        const coords = [Number(initialTravelInfo.origin_longitude), Number(initialTravelInfo.origin_latitude)];
        setLiveCoords(coords);
        lastRecalcPosRef.current = {
          lat: Number(initialTravelInfo.origin_latitude),
          lon: Number(initialTravelInfo.origin_longitude)
        };
      } else if (initialTravelInfo.patient_address) {
        setSelectedOrigin(initialTravelInfo.patient_address);
      }

      if (!initialTravelInfo.recommended_departure_time && (initialTravelInfo.patient_address || initialTravelInfo.origin_latitude)) {
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
    }
  }, [initialTravelInfo]);

  // Real-time calculation of time remaining until departure
  useEffect(() => {
    const info = currentTravelInfo || initialTravelInfo;
    if (!info?.recommended_departure_iso) return;

    const updateTimer = () => {
      try {
        const depTime = new Date(info.recommended_departure_iso).getTime();
        const now = new Date().getTime();
        const diffMins = Math.round((depTime - now) / 60000);
        setMinsUntilDeparture(diffMins);
      } catch {
        setMinsUntilDeparture(null);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 30000);
    return () => clearInterval(timer);
  }, [currentTravelInfo, initialTravelInfo]);

  // Watch GPS Position and throttle route recalculation (movement >= 75m or interval)
  useEffect(() => {
    if (!liveTrackingActive || typeof window === 'undefined' || !navigator?.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lon = Number(pos.coords.longitude.toFixed(6));

        // 1. Move patient marker in real-time immediately
        setLiveCoords([lon, lat]);
        setGpsStatus('watching');

        const now = Date.now();
        const lastPos = lastRecalcPosRef.current;
        const lastTime = lastRecalcTimeRef.current;

        let distMeters = Infinity;
        if (lastPos) {
          distMeters = calculateHaversineMeters(lastPos.lat, lastPos.lon, lat, lon);
        }

        const timeElapsed = now - lastTime;
        // Throttled recalculation:
        // - Initial position fix
        // - Meaningful movement >= 75m (between 50m and 100m) with at least 10s cooldown
        // - Movement >= 25m after 60s
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
            origin: 'Current GPS Location',
            origin_latitude: lat,
            origin_longitude: lon,
            expected_consultation_iso: activeInfo?.expected_consultation_iso,
            safety_buffer_min: activeInfo?.safety_buffer_min || 10
          }).then((res) => {
            if (res && res.recommended_departure_time) {
              setCurrentTravelInfo(res);
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
          setLiveCoords(null);
        } else {
          setGpsStatus('unavailable');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [liveTrackingActive, initialTravelInfo]);

  if (!currentTravelInfo && !initialTravelInfo) return null;
  const travelInfo = currentTravelInfo || initialTravelInfo;

  // Manual origin change (user chooses landmark from dropdown)
  const handleOriginChange = async (origin) => {
    setSelectedOrigin(origin);
    // Pause live GPS tracking when user explicitly chooses a landmark
    setLiveTrackingActive(false);
    setLiveCoords(null);
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

  // Button click to enable/refresh live GPS
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setCalculating(true);
    setLiveTrackingActive(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lon = Number(pos.coords.longitude.toFixed(6));
          setLiveCoords([lon, lat]);
          setGpsStatus('watching');
          lastRecalcPosRef.current = { lat, lon };
          lastRecalcTimeRef.current = Date.now();

          const res = await hospitalApi.calculateTravelDeparture({
            origin: 'Current GPS Location',
            origin_latitude: lat,
            origin_longitude: lon,
            expected_consultation_iso: travelInfo.expected_consultation_iso,
            safety_buffer_min: travelInfo.safety_buffer_min || 10
          });
          if (res && res.recommended_departure_time) {
            setCurrentTravelInfo(res);
            setSelectedOrigin('Current GPS Location');
          }
        } catch (e) {
          console.warn('Could not calculate departure with GPS:', e);
        } finally {
          setCalculating(false);
        }
      },
      (geoErr) => {
        setCalculating(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setLiveTrackingActive(false);
          setLiveCoords(null);
        } else {
          setGpsStatus('unavailable');
        }
        alert('GPS location permission denied or unavailable. Using approximate landmark.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
              {travelInfo.is_approximate_location === false || liveCoords ? (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {gpsStatus === 'watching' ? 'Live GPS Active' : 'Exact GPS Route'}
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  Approximate Landmark Transit
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
              gpsStatus === 'watching'
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/50 text-emerald-200'
                : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-400/40 text-sky-200'
            }`}
            title="Update departure using real browser GPS"
          >
            {gpsStatus === 'watching' ? (
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-sky-300" />
            )}
            <span>{gpsStatus === 'watching' ? 'Live GPS Watching' : 'Use Live GPS'}</span>
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

      {/* Main Hero Countdown & Departure Banner */}
      <div className="my-6 text-center bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs font-extrabold uppercase tracking-widest text-teal-300">
            Recommended Departure Time
          </span>
          {minsUntilDeparture !== null && (
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                minsUntilDeparture > 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {minsUntilDeparture > 0 ? `In ~${minsUntilDeparture} mins` : 'Depart Immediately'}
            </span>
          )}
        </div>

        <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-100 to-teal-200">
          {travelInfo.recommended_departure_time || '10:45 AM'}
        </div>

        <p className="text-xs text-slate-300 font-medium max-w-xl mx-auto leading-relaxed">
          {travelInfo.departure_alert || `🚗 Start from ${selectedOrigin} around ${travelInfo.recommended_departure_time} to arrive at SIMSRH Tumakuru ~${travelInfo.safety_buffer_min || 10} mins before your consultation.`}
        </p>
      </div>

      {/* Grid Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center relative z-10">
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Transit Distance</span>
          <span className="text-lg font-black text-white">{travelInfo.distance_km || 6.4} km</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Travel Duration</span>
          <span className="text-lg font-black text-sky-300">{travelInfo.travel_time_min || 18} mins</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">Safety Buffer</span>
          <span className="text-lg font-black text-teal-300">+{travelInfo.safety_buffer_min || 10} mins</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider mb-0.5">OPD Turn Window</span>
          <span className="text-lg font-black text-white">{travelInfo.expected_consultation_time || '11:15 AM'}</span>
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
          isWatching={gpsStatus === 'watching'}
        />
      </div>

    </div>
  );
}
