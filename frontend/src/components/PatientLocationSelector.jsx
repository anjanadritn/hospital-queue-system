import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  MapPin,
  Navigation,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Compass,
  Edit3,
  Check,
  Building2,
  Home
} from 'lucide-react';
import { hospitalApi } from '../api/hospitalApi';
import { getBrowserLocation } from '../services/locationService';
import { useLanguage } from '../context/LanguageContext';

const OSM_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

// Default center: Tumakuru / Chikkaballapur regional midpoint
const DEFAULT_CENTER = [77.1000, 13.3400]; // [lon, lat]

/**
 * PatientLocationSelector
 * 
 * Modular, mobile-friendly location selection component.
 * Allows choosing:
 *   - "device_gps": Use current device GPS (requires booker to confirm physical presence with patient)
 *   - "map_selected": Search village/locality + interactive map pin drop + confirmation
 *   - "manual": Manual text entry marked as approximate location
 */
export default function PatientLocationSelector({
  value,
  onChange,
  bookingFor = 'family_member',
  relation = 'Mother'
}) {
  const { t } = useLanguage();

  // Mode: 'map_selected' | 'device_gps' | 'manual'
  const [mode, setMode] = useState(value?.location_source || (bookingFor === 'myself' ? 'device_gps' : 'map_selected'));

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Selected coordinates [lon, lat] and display address
  const [coords, setCoords] = useState(() => {
    if (value?.origin_latitude && value?.origin_longitude) {
      return [Number(value.origin_longitude), Number(value.origin_latitude)];
    }
    return null;
  });

  const [address, setAddress] = useState(value?.patient_address || value?.location_address || value?.city || '');
  const [confirmed, setConfirmed] = useState(Boolean(value?.location_source && (value?.origin_latitude || value?.location_source === 'manual')));

  // Device GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  // Manual entry fields
  const [manualCity, setManualCity] = useState(value?.city || '');
  const [manualArea, setManualArea] = useState(value?.area || '');
  const [manualLandmark, setManualLandmark] = useState(value?.landmark || '');

  // MapLibre references
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Synchronize internal state when value prop changes externally
  useEffect(() => {
    if (value?.location_source) {
      setMode(value.location_source);
    }
    if (value?.origin_latitude && value?.origin_longitude) {
      setCoords([Number(value.origin_longitude), Number(value.origin_latitude)]);
    }
  }, [value]);

  // When switching to 'myself', force GPS mode and clear stale family location data
  useEffect(() => {
    if (bookingFor === 'myself') {
      setMode('device_gps');
      setConfirmed(false);
      setGpsError(null);
    }
  }, [bookingFor]);

  // Handle Mode Change
  const handleSelectMode = (newMode) => {
    setMode(newMode);
    setConfirmed(false);
    setGpsError(null);

    if (newMode === 'manual') {
      const fullManual = [manualLandmark, manualArea, manualCity].filter(Boolean).join(', ') || manualCity || 'Tumakuru';
      onChange({
        location_source: 'manual',
        origin_latitude: null,
        origin_longitude: null,
        is_approximate_location: true,
        is_approximate: true,
        patient_address: fullManual,
        location_address: fullManual,
        city: manualCity || 'Tumakuru',
        location_captured_at: new Date().toISOString()
      });
      setConfirmed(true);
    }
  };

  // 1. DEVICE GPS HANDLER
  const handleAcquireDeviceGps = async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const res = await getBrowserLocation({ timeout: 12000 });
      if (res.success && res.latitude && res.longitude) {
        const lat = res.latitude;
        const lon = res.longitude;
        setCoords([lon, lat]);
        const locLabel = `Current Device GPS (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`;
        setAddress(locLabel);
        setConfirmed(true);

        onChange({
          location_source: 'device_gps',
          origin_latitude: lat,
          origin_longitude: lon,
          is_approximate_location: false,
          is_approximate: false,
          patient_address: locLabel,
          location_address: locLabel,
          city: 'Current GPS Location',
          location_captured_at: new Date().toISOString()
        });
      } else {
        setGpsError(res.error || 'Unable to retrieve device GPS. Please use Map Selection or Manual Entry.');
      }
    } catch (err) {
      setGpsError(err.message || 'GPS request failed.');
    } finally {
      setGpsLoading(false);
    }
  };

  // 2. SEARCH HANDLER (Debounced)
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await hospitalApi.searchLocations(searchQuery.trim());
        setSuggestions(results || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Error searching locations:', err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reverse Geocode Coordinate Helper
  const reverseGeocodeCoords = useCallback(async (lat, lon) => {
    try {
      const res = await hospitalApi.reverseGeocode(lat, lon);
      if (res?.display_name) {
        setAddress(res.display_name);
        return res.display_name;
      }
    } catch (err) {
      console.debug('Reverse geocode error:', err);
    }
    const fallback = `Patient Location (${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`;
    setAddress(fallback);
    return fallback;
  }, []);

  // Update map pin when coords change
  const updateMapMarker = useCallback((lng, lat) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 13 });

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 rounded-full bg-sky-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold animate-bounce';
      el.innerHTML = '📍';

      markerRef.current = new maplibregl.Marker({
        element: el,
        draggable: true
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);

      markerRef.current.on('dragend', async () => {
        const newLngLat = markerRef.current.getLngLat();
        setCoords([newLngLat.lng, newLngLat.lat]);
        setConfirmed(false);
        await reverseGeocodeCoords(newLngLat.lat, newLngLat.lng);
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [reverseGeocodeCoords]);

  // Initialize MapLibre GL when Map Mode is active
  useEffect(() => {
    if (mode !== 'map_selected' || !mapContainerRef.current) return;

    if (!mapRef.current) {
      const initialCenter = coords || DEFAULT_CENTER;
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OSM_STYLE,
        center: initialCenter,
        zoom: coords ? 13 : 10,
        attributionControl: false
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

      map.on('load', () => {
        mapRef.current = map;
        if (coords) {
          updateMapMarker(coords[0], coords[1]);
        }
      });

      map.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        setCoords([lng, lat]);
        setConfirmed(false);
        updateMapMarker(lng, lat);
        await reverseGeocodeCoords(lat, lng);
      });
    } else {
      // Resize on tab visibility
      setTimeout(() => mapRef.current?.resize(), 100);
      if (coords) {
        updateMapMarker(coords[0], coords[1]);
      }
    }

    return () => {
      // Keep map instance alive across rerenders unless component unmounts
    };
  }, [mode, coords, updateMapMarker, reverseGeocodeCoords]);

  // Handle Selection from Suggestions
  const handleSelectSuggestion = (item) => {
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    setCoords([lon, lat]);
    setAddress(item.display_name);
    setSearchQuery(item.name || item.display_name);
    setShowSuggestions(false);
    setConfirmed(false);
    updateMapMarker(lon, lat);
  };

  // Confirm Map Selection
  const handleConfirmMapLocation = () => {
    if (!coords) return;
    setConfirmed(true);
    const resolvedCity = address.split(',')[0] || 'Tumakuru';
    onChange({
      location_source: 'map_selected',
      origin_latitude: coords[1],
      origin_longitude: coords[0],
      is_approximate_location: false,
      is_approximate: false,
      patient_address: address || `${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E`,
      location_address: address || `${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E`,
      city: resolvedCity,
      location_captured_at: new Date().toISOString()
    });
  };

  // Handle Manual Entry Change
  const handleManualChange = (field, val) => {
    let newCity = manualCity;
    let newArea = manualArea;
    let newLandmark = manualLandmark;

    if (field === 'city') {
      newCity = val;
      setManualCity(val);
    } else if (field === 'area') {
      newArea = val;
      setManualArea(val);
    } else if (field === 'landmark') {
      newLandmark = val;
      setManualLandmark(val);
    }

    const fullAddr = [newLandmark, newArea, newCity].filter(Boolean).join(', ') || newCity || 'Tumakuru';
    setAddress(fullAddr);
    setConfirmed(Boolean(newCity.trim()));

    onChange({
      location_source: 'manual',
      origin_latitude: null,
      origin_longitude: null,
      is_approximate_location: true,
      is_approximate: true,
      patient_address: fullAddr,
      location_address: fullAddr,
      city: newCity || 'Tumakuru',
      location_captured_at: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-4 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-sky-600" />
            {bookingFor === 'myself'
              ? <span>Where are you currently?</span>
              : <span>{t('patient_current_location', 'Where is the patient currently?')}</span>
            }
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {bookingFor === 'myself'
              ? 'Using the current location of this device to calculate your driving distance and arrival time to SIMSRH.'
              : `Specify ${relation || 'patient'}'s actual physical location for accurate travel distance and Leave Now alerts.`}
          </p>
        </div>

        {bookingFor === 'family_member' && (
          <span className="self-start sm:self-auto px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md text-[10px] font-extrabold">
            Family Booking • No Booker GPS Override
          </span>
        )}
      </div>

      {/* LOCATION OPTION TILES — only GPS shown for 'myself', all three shown for family */}
      {bookingFor === 'myself' ? (
        /* MYSELF: single GPS tile */
        <div className="grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => handleSelectMode('device_gps')}
            className="p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between bg-sky-50 border-sky-500 ring-2 ring-sky-200 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-600 text-white">
                <Navigation className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">
                  {t('use_my_current_location', 'Use my current location')}
                </div>
                <div className="text-[10px] text-sky-600 font-bold">Device GPS · Precise</div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">
              Allows accurate OpenRouteService driving calculation from your current spot to SIMSRH.
            </div>
          </button>
        </div>
      ) : (
        /* FAMILY: all three location tiles */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* OPTION A: Use My Current Location */}
          <button
            type="button"
            onClick={() => handleSelectMode('device_gps')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              mode === 'device_gps'
                ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200 shadow-xs'
                : 'bg-white border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                mode === 'device_gps' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <Navigation className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">
                  {t('use_my_current_location', 'Use my current location')}
                </div>
                <div className="text-[10px] text-slate-400">Device GPS</div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">
              Only if physically with patient
            </div>
          </button>

          {/* OPTION B: Set Patient's Location (Map + Search) */}
          <button
            type="button"
            onClick={() => handleSelectMode('map_selected')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              mode === 'map_selected'
                ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200 shadow-xs'
                : 'bg-white border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                mode === 'map_selected' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">
                  {t('set_patient_location', "Set patient's location")}
                </div>
                <div className="text-[10px] text-emerald-700 font-extrabold">Recommended for Family</div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">
              Search village/town or place map pin
            </div>
          </button>

          {/* OPTION C: Enter Location Manually */}
          <button
            type="button"
            onClick={() => handleSelectMode('manual')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              mode === 'manual'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 shadow-xs'
                : 'bg-white border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                mode === 'manual' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <Edit3 className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-black text-slate-900">
                  {t('enter_location_manually', 'Enter location manually')}
                </div>
                <div className="text-[10px] text-amber-700 font-bold">Approximate</div>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">
              City, village, locality text entry
            </div>
          </button>
        </div>
      )}

      {/* MODE A CONTENT: DEVICE GPS */}
      {mode === 'device_gps' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 flex items-start gap-2">
            <Navigation className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{t('device_location_notice', 'This uses the current location of this device.')}</span>
              <p className="text-[11px] text-sky-800 mt-0.5">
                {bookingFor === 'family_member'
                  ? `Only select this if you are physically with ${relation || 'the patient'} right now.`
                  : 'Allows accurate OpenRouteService driving calculation from your current spot to SIMSRH.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleAcquireDeviceGps}
              disabled={gpsLoading}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {gpsLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Capturing Device GPS...</span>
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5" />
                  <span>Acquire Current GPS</span>
                </>
              )}
            </button>

            {confirmed && coords && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-bold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Device GPS Active: {coords[1].toFixed(4)}° N, {coords[0].toFixed(4)}° E</span>
              </div>
            )}
          </div>

          {gpsError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{gpsError}</span>
            </div>
          )}
        </div>
      )}

      {/* MODE B CONTENT: SET PATIENT'S LOCATION (MAP + SEARCH) */}
      {mode === 'map_selected' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
          {/* Search Input with Autocomplete */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search_locality_placeholder', 'Search village, locality, city, or landmark (e.g. Alipur, Chikkaballapur)...')}
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                />
                {searching && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 absolute right-3 top-3" />
                )}
              </div>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-sky-50 transition flex items-start gap-2 text-xs text-slate-800 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">{item.name || item.city}</div>
                      <div className="text-[10px] text-slate-500 leading-snug">{item.display_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Map Display */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <div
              ref={mapContainerRef}
              className="w-full h-64 bg-slate-100"
              style={{ minHeight: '240px' }}
            />

            <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 flex items-center justify-between shadow-xs pointer-events-none">
              <span className="font-medium flex items-center gap-1">
                <span>📍</span>
                <span>{t('select_location_on_map', 'Click anywhere or drag pin to position patient')}</span>
              </span>
              {coords && (
                <span className="font-mono font-bold text-sky-700">
                  {coords[1].toFixed(4)}° N, {coords[0].toFixed(4)}° E
                </span>
              )}
            </div>
          </div>

          {/* Selected Location Details & Confirmation Button */}
          {coords && (
            <div className="p-3.5 bg-gradient-to-r from-sky-50 to-teal-50 border border-sky-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-sky-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>Selected Patient Location</span>
                </div>
                <div className="text-xs font-black text-slate-900 max-w-md">
                  {address || `${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E`}
                </div>
                <div className="text-[10px] text-slate-500">
                  Location source: <strong>Map Selected (Exact Coordinates)</strong>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmMapLocation}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                  confirmed
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-sky-600 text-white hover:bg-sky-700 active:scale-95'
                }`}
              >
                {confirmed ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Location Confirmed</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('confirm_location_btn', 'Confirm Location')}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODE C CONTENT: MANUAL ENTRY */}
      {mode === 'manual' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-200">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">{t('approximate_location_notice', 'Approximate location — travel time may vary.')}</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Using manual text will estimate road distance from the nearest town/city center to SIMSRH.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                City / Village *
              </label>
              <div className="relative">
                <Home className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={manualCity}
                  onChange={(e) => handleManualChange('city', e.target.value)}
                  placeholder="e.g. Alipur, Chikkaballapur, Tumakuru"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Area / Locality
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={manualArea}
                  onChange={(e) => handleManualChange('area', e.target.value)}
                  placeholder="e.g. Near Bus Stand, Main Bazar"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Address / Landmark
              </label>
              <input
                type="text"
                value={manualLandmark}
                onChange={(e) => handleManualChange('landmark', e.target.value)}
                placeholder="e.g. Beside Gram Panchayat"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none transition"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
