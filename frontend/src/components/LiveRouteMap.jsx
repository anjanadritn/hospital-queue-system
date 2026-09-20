import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass, Navigation, AlertTriangle, CheckCircle2 } from 'lucide-react';

const OPENFREEMAP_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors | OpenFreeMap'
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

const DEFAULT_HOSPITAL_COORDS = [77.096826, 13.376059]; // SIMSRH Lingapura Tumakuru [lon, lat]

function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function LiveRouteMap({
  travelInfo,
  liveCoords = null,
  isExactGps = false,
  isWatching = false,
  gpsStatus = 'idle',
  onRecenter = null
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const patientMarkerRef = useRef(null);
  const hospitalMarkerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const routeGeometry = travelInfo?.route_geometry;
  const coordinates = routeGeometry?.coordinates;

  // Real GPS coordinates take precedence when active, otherwise fallback to stored origin
  const hasLiveGps = Boolean(isExactGps && liveCoords && liveCoords.length === 2);
  const activeOriginCoords = hasLiveGps
    ? liveCoords
    : (travelInfo?.origin_coordinates || (coordinates && coordinates.length > 0 ? coordinates[0] : null));

  const hospitalCoords = travelInfo?.hospital_coordinates || DEFAULT_HOSPITAL_COORDS;
  const originName = hasLiveGps
    ? 'Your Location'
    : (travelInfo?.patient_address || 'Origin');
  const hospitalName = travelInfo?.hospital_name || 'SIMSRH Hospital';

  // 1. Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let mapInstance = null;

    try {
      const initialCenter = activeOriginCoords || hospitalCoords || [77.1000, 13.3400];

      mapInstance = new maplibregl.Map({
        container: mapContainerRef.current,
        style: OPENFREEMAP_STYLE,
        center: initialCenter,
        zoom: 12,
        attributionControl: false
      });

      // Navigation controls
      mapInstance.addControl(
        new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
        'top-right'
      );

      // Attribution control for OpenFreeMap and OpenStreetMap
      mapInstance.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>'
        }),
        'bottom-right'
      );

      const onReady = () => setMapReady(true);
      mapInstance.on('style.load', onReady);
      mapInstance.on('load', onReady);

      mapInstance.on('error', (e) => {
        if (e && e.error && e.error.message && e.error.message.includes('style')) {
          console.warn('MapLibre style fallback error:', e);
        }
      });

      mapRef.current = mapInstance;
    } catch (err) {
      console.warn('Failed to initialize MapLibre GL map:', err);
      setMapError(true);
    }

    return () => {
      if (patientMarkerRef.current) {
        patientMarkerRef.current.remove();
        patientMarkerRef.current = null;
      }
      if (hospitalMarkerRef.current) {
        hospitalMarkerRef.current.remove();
        hospitalMarkerRef.current = null;
      }
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch {
          // ignore
        }
      }
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 2. Draw or Update Route Geometry (Road Route or Straight-Line Fallback)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const updateRouteLayer = () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', updateRouteLayer);
        return;
      }

      const hasRouteCoords = coordinates && Array.isArray(coordinates) && coordinates.length > 1;
      let effectiveGeometry = routeGeometry;
      let isStaleRoute = false;

      if (hasRouteCoords && hasLiveGps && activeOriginCoords) {
        const startCoord = coordinates[0];
        const distToOrigin = calculateHaversineMeters(
          startCoord[1], startCoord[0],
          activeOriginCoords[1], activeOriginCoords[0]
        );
        // If route starts > 350m away from current exact GPS (e.g. old Tumakuru route), do not draw stale route
        if (distToOrigin > 350) {
          console.log(`[LiveRouteMap] Stale route detected (starts ${Math.round(distToOrigin)}m away from GPS). Drawing direct route from active GPS.`);
          isStaleRoute = true;
          effectiveGeometry = {
            type: 'LineString',
            coordinates: [activeOriginCoords, hospitalCoords]
          };
        }
      }

      if (hasRouteCoords && !isStaleRoute) {
        const geojsonData = {
          type: 'Feature',
          properties: {},
          geometry: effectiveGeometry
        };

        if (map.getSource('live-route-source')) {
          map.getSource('live-route-source').setData(geojsonData);
        } else {
          map.addSource('live-route-source', {
            type: 'geojson',
            data: geojsonData
          });

          // Outer glowing casing
          map.addLayer({
            id: 'live-route-casing',
            type: 'line',
            source: 'live-route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#0369a1', // sky-700
              'line-width': 8,
              'line-opacity': 0.4
            }
          });

          // Core vibrant route line
          map.addLayer({
            id: 'live-route-line',
            type: 'line',
            source: 'live-route-source',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#38bdf8', // sky-400
              'line-width': 4.5,
              'line-opacity': 0.95
            }
          });
        }
      } else if (activeOriginCoords && hospitalCoords) {
        // Draw route directly from active GPS to hospital
        const fallbackGeojson = {
          type: 'Feature',
          properties: {},
          geometry: effectiveGeometry && isStaleRoute ? effectiveGeometry : {
            type: 'LineString',
            coordinates: [activeOriginCoords, hospitalCoords]
          }
        };

        if (map.getSource('live-route-source')) {
          map.getSource('live-route-source').setData(fallbackGeojson);
        } else {
          map.addSource('live-route-source', {
            type: 'geojson',
            data: fallbackGeojson
          });

          map.addLayer({
            id: 'live-route-line',
            type: 'line',
            source: 'live-route-source',
            paint: {
              'line-color': '#38bdf8',
              'line-width': 3.5,
              'line-dasharray': [2, 2],
              'line-opacity': 0.85
            }
          });
        }
      } else if (map.getSource('live-route-source')) {
        map.getSource('live-route-source').setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    };

    updateRouteLayer();
  }, [mapReady, coordinates, routeGeometry, activeOriginCoords, hospitalCoords]);

  // 3. Update Patient / Origin Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !activeOriginCoords) return;

    if (!patientMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'patient-marker-wrapper cursor-pointer';

      if (hasLiveGps) {
        // Real GPS "You" marker with pulsing blue beacon
        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:38px;height:38px;background:rgba(14,165,233,0.35);border-radius:50%;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="width:32px;height:32px;background:#0284c7;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#ffffff;z-index:2;">
              You
            </div>
          </div>
        `;
      } else {
        // Landmark fallback marker (NOT labeled "You", NO fake moving marker)
        el.innerHTML = `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="width:30px;height:30px;background:#d97706;border:2px solid #ffffff;border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;color:#ffffff;z-index:2;">
              📍
            </div>
          </div>
        `;
      }

      const popupTitle = hasLiveGps ? 'You (Live GPS)' : `Landmark: ${originName}`;
      const popupBadge = hasLiveGps
        ? '<span style="color:#059669;font-size:10px;font-weight:700;">✓ Exact GPS Active</span>'
        : '<span style="color:#d97706;font-size:10px;font-weight:700;">Approximate Landmark</span>';

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false })
        .setHTML(`<div style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px;">${popupTitle}<br/>${popupBadge}</div>`);

      patientMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(activeOriginCoords)
        .setPopup(popup)
        .addTo(map);
    } else {
      // Smoothly update marker coordinates on every GPS tick
      patientMarkerRef.current.setLngLat(activeOriginCoords);

      // Refresh marker element if transitioning between landmark and live GPS
      const el = patientMarkerRef.current.getElement();
      if (el) {
        if (hasLiveGps) {
          el.innerHTML = `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;width:38px;height:38px;background:rgba(14,165,233,0.35);border-radius:50%;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>
              <div style="width:32px;height:32px;background:#0284c7;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#ffffff;z-index:2;">
                You
              </div>
            </div>
          `;
        } else {
          el.innerHTML = `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;">
              <div style="width:30px;height:30px;background:#d97706;border:2px solid #ffffff;border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;color:#ffffff;z-index:2;">
                📍
              </div>
            </div>
          `;
        }
      }

      if (patientMarkerRef.current.getPopup()) {
        const popupTitle = hasLiveGps ? 'You (Live GPS)' : `Landmark: ${originName}`;
        const popupBadge = hasLiveGps
          ? '<span style="color:#059669;font-size:10px;font-weight:700;">✓ Exact GPS Active</span>'
          : '<span style="color:#d97706;font-size:10px;font-weight:700;">Approximate Landmark</span>';
        patientMarkerRef.current.getPopup().setHTML(`<div style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px;">${popupTitle}<br/>${popupBadge}</div>`);
      }
    }
  }, [mapReady, activeOriginCoords, hasLiveGps, originName]);

  // 4. Update SIMSRH Hospital Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !hospitalCoords) return;

    if (!hospitalMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'simsrh-hospital-marker cursor-pointer';
      el.innerHTML = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:38px;height:38px;background:rgba(16,185,129,0.35);border-radius:50%;animation:pulse 2s infinite;"></div>
          <div style="width:32px;height:32px;background:#059669;border:2.5px solid #ffffff;border-radius:50%;box-shadow:0 4px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:15px;color:#ffffff;z-index:2;">
            🏥
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false })
        .setHTML(`
          <div style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px;">
            ${hospitalName}
            <br/><span style="font-size:9px;color:#64748b;font-weight:500;">Sira Road, Tumakuru</span>
          </div>
        `);

      hospitalMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(hospitalCoords)
        .setPopup(popup)
        .addTo(map);
    } else {
      hospitalMarkerRef.current.setLngLat(hospitalCoords);
    }
  }, [mapReady, hospitalCoords, hospitalName]);

  // 5. Fit bounds when route or points load
  const fitRouteBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const bounds = new maplibregl.LngLatBounds();

      if (hospitalCoords && Array.isArray(hospitalCoords) && hospitalCoords.length === 2) {
        bounds.extend(hospitalCoords);
      }

      if (activeOriginCoords && Array.isArray(activeOriginCoords) && activeOriginCoords.length === 2) {
        bounds.extend(activeOriginCoords);
      }

      if (coordinates && Array.isArray(coordinates) && coordinates.length > 1) {
        coordinates.forEach((coord) => {
          if (Array.isArray(coord) && coord.length === 2) {
            bounds.extend(coord);
          }
        });
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 60, bottom: 60, left: 60, right: 60 },
          maxZoom: 15,
          duration: 800
        });
      }
    } catch {
      // ignore
    }
  }, [coordinates, activeOriginCoords, hospitalCoords]);

  // Initial fit when map and coordinates are ready
  useEffect(() => {
    if (mapReady) {
      fitRouteBounds();
    }
  }, [mapReady, fitRouteBounds]);

  const handleRecenter = () => {
    if (onRecenter) {
      onRecenter();
    } else {
      fitRouteBounds();
    }
  };

  if (mapError) {
    return (
      <div className="w-full h-48 bg-slate-900/80 rounded-2xl border border-white/10 flex flex-col items-center justify-center text-center p-4">
        <AlertTriangle className="w-6 h-6 text-amber-400 mb-2" />
        <p className="text-xs text-slate-300 font-semibold">Live Route Navigation Offline</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Please follow the departure countdown schedule.</p>
      </div>
    );
  }

  const remainingDist = travelInfo?.distance_km ?? 6.4;
  const remainingTime = travelInfo?.travel_time_min ?? 18;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-sky-700/60 shadow-inner bg-slate-950">
      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-64 sm:h-76"
        style={{ minHeight: '260px' }}
      />

      {/* Floating Live Route Badge (Top-Left) */}
      <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs">
        {hasLiveGps ? (
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        )}
        <span className="font-bold text-white tracking-tight truncate max-w-[140px] sm:max-w-[180px]">
          {originName} → SIMSRH
        </span>
        <div className="flex items-center gap-1.5 border-l border-white/20 pl-2 text-[11px]">
          <span className="text-sky-300 font-bold">{remainingDist} km</span>
          <span className="text-slate-400">•</span>
          <span className="text-teal-300 font-bold">~{remainingTime}m</span>
        </div>
      </div>

      {/* Live GPS / Approximate Indicator (Top-Right) */}
      <div className="absolute top-3 right-12 z-10">
        {hasLiveGps ? (
          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-md shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>✓ Exact GPS Active</span>
          </span>
        ) : (gpsStatus === 'denied' || gpsStatus === 'unavailable') ? (
          <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-md shadow-xs">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>GPS unavailable — Using approximate location</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 backdrop-blur-md shadow-xs">
            <span>Landmark Transit</span>
          </span>
        )}
      </div>

      {/* Recenter Map Button (Bottom-Left) */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter Map & Route"
        className="absolute bottom-3 left-3 z-10 bg-slate-900/90 hover:bg-slate-800 active:bg-slate-700 text-white px-2.5 py-1.5 rounded-xl border border-white/15 shadow-md transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
      >
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-[10px] font-bold">Recenter Map</span>
      </button>
    </div>
  );
}
