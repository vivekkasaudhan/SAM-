'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MonitoringStation } from '@/types/environment';
import { stationService, locationService, wellService, authService, isSubadmin } from '@/services/api';
import { Layers, MapPin, Eye, Check, Navigation, ArrowUpRight, User } from 'lucide-react';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';

// Fix Leaflet default icon paths in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createDivIcon(color: string, emoji: string, size = 32) {
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="transform:rotate(45deg);font-size:${size * 0.45}px;line-height:1;">${emoji}</div>
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

const SELECTED_ICON = createDivIcon('#2563eb', '📍', 36);
const WELL_ICON = createDivIcon('#0284c7', '🚰', 30);
const WATER_STATION_ICON = createDivIcon('#0284c7', '🌊', 28);
const AIR_STATION_ICON = createDivIcon('#10b981', '🌿', 28);
const IOT_ICON = createDivIcon('#8b5cf6', '📡', 28);

export function getWellRiskStatus(st: MonitoringStation): 'DANGER' | 'WARNING' | 'NORMAL' {
  const wl = st.latest_reading?.water_level_m;
  if (wl == null) return 'NORMAL';
  const danger = st.danger_level_m ?? 8.5;
  const warn = st.warning_level_m ?? 7.0;
  if (wl >= danger) return 'DANGER';
  if (wl >= warn) return 'WARNING';
  return 'NORMAL';
}

export function createWellMapIcon(name: string, riskStatus: 'DANGER' | 'WARNING' | 'NORMAL') {
  let pinColor = '#2563eb'; // BLUE for Normal level
  let glowColor = 'rgba(37, 99, 235, 0.45)';
  let dotColor = '#2563eb';
  let emoji = '🚰';

  if (riskStatus === 'DANGER') {
    pinColor = '#ef4444'; // RED for Danger level
    glowColor = 'rgba(239, 68, 68, 0.55)';
    dotColor = '#ef4444';
    emoji = '🚨';
  } else if (riskStatus === 'WARNING') {
    pinColor = '#eab308'; // YELLOW for Warning level
    glowColor = 'rgba(234, 179, 8, 0.55)';
    dotColor = '#eab308';
    emoji = '⚠️';
  }

  const safeName = (name || 'Well Station').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return L.divIcon({
    className: 'custom-well-map-pin',
    html: `
      <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        transform:translate(-50%, -100%);
        pointer-events:auto;
        cursor:pointer;
        user-select:none;
      ">
        <!-- Well Name Label Above Pointer (No Background Color) -->
        <div style="
          background:transparent;
          color:#0f172a;
          font-size:11px;
          font-weight:800;
          font-family:ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          white-space:nowrap;
          text-shadow:0 0 3px #ffffff, 0 0 5px #ffffff, -1px -1px 0 #ffffff, 1px -1px 0 #ffffff, -1px 1px 0 #ffffff, 1px 1px 0 #ffffff;
          margin-bottom:3px;
          max-width:180px;
          overflow:hidden;
          text-overflow:ellipsis;
          display:flex;
          align-items:center;
          gap:4px;
        ">
          <span style="
            width:6px;
            height:6px;
            border-radius:50%;
            background:${dotColor};
            box-shadow:0 0 2px rgba(0,0,0,0.5);
            flex-shrink:0;
            display:inline-block;
          "></span>
          <span style="overflow:hidden; text-overflow:ellipsis;">${safeName}</span>
        </div>

        <!-- Colored Teardrop Pointer Pin (Red: Danger, Yellow: Warning, Blue: Normal) -->
        <div style="
          width:30px;
          height:30px;
          background:${pinColor};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2.5px solid white;
          box-shadow:0 3px 12px rgba(0,0,0,0.45), 0 0 10px ${glowColor};
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <div style="transform:rotate(45deg); font-size:13px; line-height:1;">
            ${emoji}
          </div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -56],
  });
}

export interface MapFilterParams {
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  search?: string;
}

interface MapComponentProps {
  onLocationSelect: (lat: number, lon: number, name?: string) => void;
  selectedLat?: number | null;
  selectedLon?: number | null;
  filterParams?: MapFilterParams;
  onFilteredWellsCountChange?: (count: number) => void;
  onResetFilter?: () => void;
  onViewWellDetails?: (wellId: string) => void;
}

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lon !== null) {
      map.flyTo([lat, lon], Math.max(map.getZoom(), 9), { duration: 1.2 });
    }
  }, [lat, lon, map]);
  return null;
}

function MapScopeAdjuster({
  wells,
  filterParams,
}: {
  wells: MonitoringStation[];
  filterParams?: MapFilterParams;
}) {
  const map = useMap();
  const prevFilterKey = React.useRef('');

  useEffect(() => {
    const filterKey = `${filterParams?.country || ''}|${filterParams?.state || ''}|${filterParams?.district || ''}|${filterParams?.city || ''}`;
    if (prevFilterKey.current === filterKey && wells.length > 0) return;
    prevFilterKey.current = filterKey;

    if (wells.length >= 2) {
      const latLngs = wells.map((w) => L.latLng(w.lat, w.lon));
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14, duration: 1.2 });
    } else if (wells.length === 1) {
      map.flyTo([wells[0].lat, wells[0].lon], 13, { duration: 1.2 });
    } else if (filterParams?.state) {
      const st = filterParams.state.toLowerCase();
      if (st.includes('jharkhand')) map.flyTo([23.6102, 85.2799], 8, { duration: 1.2 });
      else if (st.includes('uttar pradesh') || st === 'up') map.flyTo([26.8467, 80.9462], 8, { duration: 1.2 });
      else if (st.includes('west bengal')) map.flyTo([22.9868, 87.855], 8, { duration: 1.2 });
      else if (st.includes('bihar')) map.flyTo([25.0961, 85.3131], 8, { duration: 1.2 });
      else if (st.includes('odisha')) map.flyTo([20.9517, 85.0985], 8, { duration: 1.2 });
      else if (st.includes('maharashtra')) map.flyTo([19.7515, 75.7139], 7, { duration: 1.2 });
      else if (st.includes('delhi')) map.flyTo([28.7041, 77.1025], 11, { duration: 1.2 });
      else if (st.includes('karnataka')) map.flyTo([15.3173, 75.7139], 7, { duration: 1.2 });
    } else if (filterParams?.country) {
      const c = filterParams.country.toLowerCase();
      if (c === 'india') map.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
      else if (c.includes('united states')) map.flyTo([37.0902, -95.7129], 4, { duration: 1.2 });
      else if (c.includes('united kingdom')) map.flyTo([55.3781, -3.436], 6, { duration: 1.2 });
    }
  }, [wells, filterParams, map]);

  return null;
}

export default function MapComponent({
  onLocationSelect,
  selectedLat,
  selectedLon,
  filterParams,
  onFilteredWellsCountChange,
  onResetFilter,
  onViewWellDetails,
}: MapComponentProps) {
  const [fixedStations, setFixedStations] = useState<MonitoringStation[]>([]);
  const [wells, setWells] = useState<MonitoringStation[]>([]);
  const [mounted, setMounted] = useState(false);

  // Floating selection preview panel state
  const [clickedLocation, setClickedLocation] = useState<{
    lat: number;
    lon: number;
    name: string;
  } | null>(null);

  // Map layer controls
  const [layers, setLayers] = useState({
    wells: true,
    waterStations: true,
    iotSensors: true,
    airStations: true,
  });

  const [showLayerPanel, setShowLayerPanel] = useState(false);

  const currentUser = React.useMemo(() => authService.getCurrentUser(), []);

  // 1. Fetch fixed stations (Water, Air, IoT) on mount
  useEffect(() => {
    setMounted(true);
    stationService
      .getNearbyStations(20.5937, 78.9629, 5000)
      .then((data) => {
        setFixedStations(data.filter((s) => s.type !== 'WELL'));
      })
      .catch(() => setFixedStations([]));
  }, []);

  // 2. Fetch wells whenever filterParams changes (delegated to backend database filtering)
  useEffect(() => {
    const query: Record<string, string> = {};
    if (filterParams?.country && filterParams.country.trim()) query.country = filterParams.country.trim();
    if (filterParams?.state && filterParams.state.trim()) query.state = filterParams.state.trim();
    if (filterParams?.district && filterParams.district.trim()) query.district = filterParams.district.trim();
    if (filterParams?.city && filterParams.city.trim()) query.city = filterParams.city.trim();
    if (filterParams?.search && filterParams.search.trim()) query.search = filterParams.search.trim();

    wellService
      .getWells(query)
      .then((wellsData) => {
        if (Array.isArray(wellsData)) {
          const formatted: MonitoringStation[] = wellsData.map((w: any) => ({
            id: w.id,
            name: w.name,
            lat: w.latitude,
            lon: w.longitude,
            type: 'WELL',
            distance_km: 0,
            is_active: w.is_active,
            latest_reading: w.latest_reading,
            warning_level_m: w.warning_level_m,
            danger_level_m: w.danger_level_m,
            location_description: w.location_description,
            country: w.country,
            state: w.state,
            district: w.district,
            city: w.city,
            created_by: w.created_by,
            creator: w.creator,
          }));
          setWells(formatted);
          onFilteredWellsCountChange?.(formatted.length);
        }
      })
      .catch(() => {
        setWells([]);
        onFilteredWellsCountChange?.(0);
      });
  }, [
    filterParams?.country,
    filterParams?.state,
    filterParams?.district,
    filterParams?.city,
    filterParams?.search,
    onFilteredWellsCountChange,
  ]);

  const stations = [...wells, ...fixedStations];

  const handleMapClick = useCallback(
    async (lat: number, lon: number) => {
      // Show floating inspection panel first
      setClickedLocation({
        lat,
        lon,
        name: `Fetching location...`,
      });

      try {
        const info = await locationService.reverseGeocode(lat, lon);
        setClickedLocation({
          lat,
          lon,
          name: info.display_name,
        });
      } catch {
        setClickedLocation({
          lat,
          lon,
          name: `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`,
        });
      }
    },
    []
  );

  const confirmAnalyze = () => {
    if (clickedLocation) {
      onLocationSelect(clickedLocation.lat, clickedLocation.lon, clickedLocation.name);
      setClickedLocation(null);
    }
  };

  if (!mounted) {
    return (
      <div className="w-full h-full bg-muted/40 flex items-center justify-center">
        <div className="text-muted-foreground text-sm font-medium animate-pulse">Initializing SAM GIS Map Engine...</div>
      </div>
    );
  }

  const center: [number, number] = [20.5937, 78.9629];

  return (
    <div className="relative w-full h-full">
      {/* Floating Layer Toggle Button & Menu */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
        <button
          onClick={() => setShowLayerPanel(!showLayerPanel)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/95 backdrop-blur border shadow-lg text-xs font-semibold hover:bg-accent transition-all text-foreground"
        >
          <Layers className="h-4 w-4 text-brand-500" />
          <span>Map Layers</span>
        </button>

        {showLayerPanel && (
          <div className="w-56 p-3 rounded-xl bg-card/95 backdrop-blur border shadow-2xl space-y-2 text-xs text-foreground animate-in fade-in slide-in-from-top-2">
            <div className="font-bold text-muted-foreground uppercase text-[10px] pb-1 border-b">
              Telemetry Layers
            </div>
            {[
              { id: 'wells', label: 'Registered Wells', emoji: '🚰' },
              { id: 'waterStations', label: 'Water Stations', emoji: '🌊' },
              { id: 'iotSensors', label: 'IoT Sensor Nodes', emoji: '📡' },
              { id: 'airStations', label: 'Air Quality Stations', emoji: '🌿' },
            ].map((layer) => (
              <label
                key={layer.id}
                className="flex items-center justify-between cursor-pointer py-1 hover:text-brand-500"
              >
                <span className="flex items-center gap-1.5">
                  <span>{layer.emoji}</span>
                  <span>{layer.label}</span>
                </span>
                <input
                  type="checkbox"
                  checked={(layers as any)[layer.id]}
                  onChange={(e) =>
                    setLayers({ ...layers, [layer.id]: e.target.checked })
                  }
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Floating Location Confirmation Panel per User Specification */}
      {clickedLocation && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-md p-4 rounded-2xl bg-card/95 backdrop-blur-md border shadow-2xl text-foreground animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-500">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                  Selected Location
                </div>
                <div className="text-sm font-bold line-clamp-1">{clickedLocation.name}</div>
              </div>
            </div>
            <button
              onClick={() => setClickedLocation(null)}
              className="text-xs text-muted-foreground hover:text-foreground p-1"
            >
              ✕
            </button>
          </div>

          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-4 bg-muted/40 p-2 rounded-lg">
            <span>Latitude: <strong>{clickedLocation.lat.toFixed(4)}° N</strong></span>
            <span>Longitude: <strong>{clickedLocation.lon.toFixed(4)}° E</strong></span>
          </div>

          <button
            onClick={confirmAnalyze}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>Analyze Location</span>
            <Navigation className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scope zero-wells notice */}
      {wells.length === 0 &&
        Boolean(
          filterParams?.country ||
            filterParams?.state ||
            filterParams?.district ||
            filterParams?.city
        ) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-xl bg-card/95 backdrop-blur border shadow-xl text-xs flex items-center gap-2 text-foreground animate-in fade-in">
            <span className="text-amber-500 font-bold">
              ⚠️ No monitoring wells registered in this geographic scope.
            </span>
            {onResetFilter && (
              <button
                onClick={onResetFilter}
                className="underline text-brand-600 font-semibold hover:text-brand-700 dark:text-brand-400 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

      {/* Leaflet Map Container */}
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapEvents onMapClick={handleMapClick} />
        <MapFlyTo lat={selectedLat ?? null} lon={selectedLon ?? null} />
        <MapScopeAdjuster wells={wells} filterParams={filterParams} />

        {/* Selected Location Marker */}
        {selectedLat !== null && selectedLat !== undefined && selectedLon !== null && selectedLon !== undefined && (
          <Marker position={[selectedLat, selectedLon]} icon={SELECTED_ICON}>
            <Popup>
              <div className="text-xs p-1">
                <div className="font-bold text-sm mb-1 text-blue-600">Active Analysis Target</div>
                <div>Lat: {selectedLat.toFixed(4)}° N</div>
                <div>Lon: {selectedLon.toFixed(4)}° E</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Registered Wells & Stations Layer */}
        {stations.map((st) => {
          if (st.type === 'WELL' && !layers.wells) return null;
          if (st.type === 'WATER' && !layers.waterStations) return null;
          if (st.type === 'IOT' && !layers.iotSensors) return null;
          if (st.type === 'AIR' && !layers.airStations) return null;

          const icon =
            st.type === 'WELL'
              ? createWellMapIcon(st.name, getWellRiskStatus(st))
              : st.type === 'IOT'
              ? IOT_ICON
              : st.type === 'AIR'
              ? AIR_STATION_ICON
              : WATER_STATION_ICON;

          return (
            <Marker
              key={st.id}
              position={[st.lat, st.lon]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  onLocationSelect(st.lat, st.lon, st.name);
                },
              }}
            >
              <Popup>
                {st.type === 'WELL' ? (
                  <div className="w-[270px] sm:w-80 max-w-[85vw] p-2 space-y-2 text-foreground font-sans">
                    <div className="flex items-start justify-between gap-2 border-b pb-2">
                      <div>
                        <div className="font-bold text-sm text-foreground line-clamp-1">{st.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: {st.id} • {st.lat.toFixed(4)}° N, {st.lon.toFixed(4)}° E
                        </div>
                        {st.location_description && (
                          <div className="text-[10px] text-muted-foreground italic line-clamp-1 mt-0.5">
                            {st.location_description}
                          </div>
                        )}
                        {/* Creator & Read-only indicator */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {st.creator && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/50"
                              title={`Registered by ${st.creator.name || st.creator.username} (${st.creator.email || ''})`}
                            >
                              <User className="h-2.5 w-2.5 text-cyan-500" />
                              <span>{st.creator.name || st.creator.username}</span>
                            </span>
                          )}
                          {currentUser &&
                            isSubadmin(currentUser) &&
                            st.created_by != null &&
                            String(st.created_by) !== String(currentUser.id) && (
                              <span className="inline-flex items-center text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-slate-500/10 px-1.5 py-0.5 rounded border border-slate-500/30">
                                Read-only
                              </span>
                            )}
                          {/* Lithology Status Chip */}
                          {st.lithology_status === 'RECORDED' ? (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/30"
                              title={`Geology Recorded: ${st.total_logged_depth_m || 0}m logged (${st.lithology_count || 0} strata)`}
                            >
                              <Layers className="h-2.5 w-2.5 text-teal-500" />
                              <span>Geology Logged</span>
                            </span>
                          ) : st.lithology_status === 'PARTIAL' ? (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30"
                              title="Partially logged lithology"
                            >
                              <Layers className="h-2.5 w-2.5 text-amber-500" />
                              <span>Partially Logged</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40"
                              title="No subsurface lithology recorded"
                            >
                              <Layers className="h-2.5 w-2.5 opacity-50" />
                              <span>No Lithology</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                          (st.latest_reading?.status || 'SIMULATED') === 'LIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {st.latest_reading?.status || 'SIMULATED'}
                      </span>
                    </div>

                    {st.latest_reading ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-center bg-muted/40 p-2 rounded-xl border">
                          {/* Animated Glass Tube */}
                          <div className="col-span-5 flex justify-center py-0.5">
                            <WellWaterLevel
                              waterLevel={st.latest_reading.water_level_m}
                              warningLevel={st.warning_level_m || 7.5}
                              dangerLevel={st.danger_level_m || 8.5}
                              height={130}
                              compact={true}
                              showTicks={false}
                              wellName={st.name}
                            />
                          </div>
                          {/* Parameters Grid */}
                          <div className="col-span-7 grid grid-cols-2 gap-1 text-[11px]">
                            <div className="p-1.5 rounded bg-background border flex flex-col">
                              <span className="text-[9px] text-muted-foreground">pH</span>
                              <span className="font-bold text-teal-600 dark:text-teal-400">
                                {st.latest_reading.ph != null ? st.latest_reading.ph.toFixed(2) : '--'}
                              </span>
                            </div>
                            <div className="p-1.5 rounded bg-background border flex flex-col">
                              <span className="text-[9px] text-muted-foreground">TDS</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400 truncate">
                                {st.latest_reading.tds_ppm != null ? `${st.latest_reading.tds_ppm} ppm` : '--'}
                              </span>
                            </div>
                            <div className="p-1.5 rounded bg-background border flex flex-col">
                              <span className="text-[9px] text-muted-foreground">Turbidity</span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 truncate">
                                {st.latest_reading.turbidity_ntu != null ? `${st.latest_reading.turbidity_ntu} NTU` : '--'}
                              </span>
                            </div>
                            <div className="p-1.5 rounded bg-background border flex flex-col">
                              <span className="text-[9px] text-muted-foreground">DO</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                {st.latest_reading.dissolved_oxygen_mg_l != null
                                  ? `${st.latest_reading.dissolved_oxygen_mg_l} mg/L`
                                  : '--'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {(st.warning_level_m || st.danger_level_m) && (
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 font-mono">
                            <span>Warn: <strong>{st.warning_level_m ?? 7.5} m</strong></span>
                            <span>Danger: <strong>{st.danger_level_m ?? 8.5} m</strong></span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 text-center text-muted-foreground text-xs italic bg-muted/30 rounded">
                        Telemetry calibrating...
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 pt-1">
                      {onViewWellDetails && (
                        <button
                          onClick={() => onViewWellDetails(st.id)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>View Full Details</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          onLocationSelect(st.lat, st.lon, st.name);
                          const el = document.getElementById('dashboard-overview');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="py-1.5 px-2.5 rounded-lg border border-border/80 hover:bg-muted text-foreground font-semibold text-xs shadow-xs transition-colors flex items-center justify-center cursor-pointer"
                        title="Analyze telemetry on main dashboard"
                      >
                        Dashboard ↓
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs p-1 space-y-1">
                    <div className="font-bold text-sm text-foreground">{st.name}</div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-muted-foreground">Type:</span>
                      <span className="px-1.5 py-0.5 rounded bg-muted font-bold text-[10px]">
                        {st.type}
                      </span>
                    </div>
                    <div className="text-muted-foreground">Status: 🟢 Active Telemetry</div>
                    <div className="text-muted-foreground font-mono text-[10px]">
                      {st.lat.toFixed(4)}° N, {st.lon.toFixed(4)}° E
                    </div>
                    <button
                      onClick={() => {
                        onLocationSelect(st.lat, st.lon, st.name);
                        const el = document.getElementById('dashboard-overview');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="mt-2 w-full px-2 py-1 rounded bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors text-xs"
                    >
                      Analyze Station Data ↓
                    </button>
                  </div>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
