'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Navigation,
  MapPin,
  CheckCircle2,
  X,
  Compass,
  AlertCircle,
  Cpu,
  Layers,
  Save,
  Loader2,
  Sliders,
  Globe,
  Droplet,
} from 'lucide-react';
import { wellService } from '@/services/api';

// Dynamic import with SSR disabled for Leaflet picker map
const LocationPickerMap = dynamic(
  () => import('./LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[260px] bg-muted/40 rounded-2xl flex items-center justify-center text-xs text-muted-foreground animate-pulse">
        Loading GIS Pin Location Map...
      </div>
    ),
  }
);

interface AddWellModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWellCreated: (well: any) => void;
}

export function AddWellModal({ isOpen, onClose, onWellCreated }: AddWellModalProps) {
  // 1. Basic Information
  const [name, setName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');

  // 2. Spatial Coordinates
  const [lat, setLat] = useState<number>(22.7772);
  const [lon, setLon] = useState<number>(86.1441);

  // 3. Hydrological Thresholds
  const [warningLevel, setWarningLevel] = useState<number>(7.5);
  const [dangerLevel, setDangerLevel] = useState<number>(8.5);
  const [totalDepth, setTotalDepth] = useState<string>('30.0');

  // 4. Sensor Telemetry Configuration
  const [sensorInstalled, setSensorInstalled] = useState(true);
  const [sensorType, setSensorType] = useState('Multi-Parameter Groundwater Sonde');
  const [sensorModel, setSensorModel] = useState('AquaSense-Probe-v2');

  // 5. Initial Baseline Readings (Optional)
  const [waterLevel, setWaterLevel] = useState<string>('6.5');
  const [ph, setPh] = useState<string>('7.2');
  const [tds, setTds] = useState<string>('350');
  const [turbidity, setTurbidity] = useState<string>('2.5');
  const [doVal, setDoVal] = useState<string>('6.2');
  const [waterTemp, setWaterTemp] = useState<string>('26.0');

  // Geolocation & Form state
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = Number(pos.coords.latitude.toFixed(6));
        const longitude = Number(pos.coords.longitude.toFixed(6));
        setLat(latitude);
        setLon(longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission denied. Please allow GPS access or click on the map.');
        } else {
          setGeoError('Location position unavailable. Please enter coordinates manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Well name is required.');
      return;
    }

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
      setFormError('Coordinates must be valid geographical numbers (-90 to 90, -180 to 180).');
      return;
    }

    if (Number(warningLevel) <= 0 || Number(dangerLevel) <= 0) {
      setFormError('Warning and danger levels must be greater than zero.');
      return;
    }

    if (Number(warningLevel) >= Number(dangerLevel)) {
      setFormError('Warning level must be strictly less than danger level.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload: any = {
      name: name.trim(),
      latitude: lat,
      longitude: lon,
      country: country.trim() || 'India',
      state: state.trim() || undefined,
      district: district.trim() || undefined,
      city: city.trim() || undefined,
      location_description: locationDescription.trim() || undefined,
      warning_level_m: Number(warningLevel) || 7.5,
      danger_level_m: Number(dangerLevel) || 8.5,
      total_depth_m: totalDepth.trim() ? parseFloat(totalDepth) : undefined,
      sensor_installed: sensorInstalled,
      sensor_type: sensorType,
      sensor_model: sensorModel,
    };

    if (waterLevel.trim()) payload.water_level_m = parseFloat(waterLevel);
    if (ph.trim()) payload.ph = parseFloat(ph);
    if (tds.trim()) payload.tds_ppm = parseFloat(tds);
    if (turbidity.trim()) payload.turbidity_ntu = parseFloat(turbidity);
    if (doVal.trim()) payload.dissolved_oxygen_mg_l = parseFloat(doVal);
    if (waterTemp.trim()) payload.temperature_c = parseFloat(waterTemp);

    try {
      const created = await wellService.createWell(payload);
      onWellCreated(created);
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to register well.';
      setFormError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6 bg-navy-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-4xl my-6 bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-6 border-b border-border/60 dark:border-navy-800 bg-muted/20 dark:bg-navy-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              <Droplet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-foreground tracking-tight">
                Register New Monitoring Well
              </h2>
              <p className="text-xs text-muted-foreground">
                Provision a groundwater station, configure sensors, and assign geographical bounds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Form Body ───────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{formError}</span>
            </div>
          )}

          {/* Section 1: Well Identification & Geographic Scope */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
              <Globe className="h-3.5 w-3.5 text-cyan-500" />
              <span>Well Identity & Geographic Hierarchy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Well Identifier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., NIT Jamshedpur Riverfront Well 3"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-foreground">Location Description / Landmark</label>
                <input
                  type="text"
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  placeholder="e.g., Academic Complex, South Campus Buffer"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="India"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">State / Province</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g., Jharkhand"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">District / County</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g., East Singhbhum"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">City / Municipality</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g., Jamshedpur"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Spatial Coordinates & GIS Map Pin */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-cyan-500" />
                <span>Geographical Coordinates & GIS Pin</span>
              </div>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={geoLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold border border-cyan-500/20 transition-all shadow-2xs disabled:opacity-50"
              >
                {geoLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Navigation className="h-3 w-3" />
                )}
                <span>Use GPS Location</span>
              </button>
            </div>

            {geoError && (
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs border border-amber-500/20">
                {geoError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Latitude (° N)</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Longitude (° E)</label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="h-64 rounded-2xl overflow-hidden border border-border/80 shadow-inner">
              <LocationPickerMap
                lat={lat}
                lon={lon}
                onLocationChange={(newLat, newLon) => {
                  setLat(newLat);
                  setLon(newLon);
                }}
              />
            </div>
          </div>

          {/* Section 3: Hydrological Thresholds */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
              <Sliders className="h-3.5 w-3.5 text-amber-500" />
              <span>Hydrological Safety Limits</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Warning Level Threshold (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={warningLevel}
                  onChange={(e) => setWarningLevel(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Danger Level Threshold (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={dangerLevel}
                  onChange={(e) => setDangerLevel(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-2xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  Total Drilled Depth (m)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={totalDepth}
                  onChange={(e) => setTotalDepth(e.target.value)}
                  placeholder="e.g. 30.0"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Telemetry Sensor Hardware */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Cpu className="h-3.5 w-3.5 text-teal-500" />
                <span>Sensor Transceiver Hardware</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={sensorInstalled}
                  onChange={(e) => setSensorInstalled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-cyan-500 focus:ring-cyan-500"
                />
                <span>Provision Active Transceiver</span>
              </label>
            </div>

            {sensorInstalled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Sensor Probe Type</label>
                  <select
                    value={sensorType}
                    onChange={(e) => setSensorType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Multi-Parameter Groundwater Sonde">
                      Multi-Parameter Groundwater Sonde
                    </option>
                    <option value="Ultrasonic Depth Transceiver">
                      Ultrasonic Depth Transceiver
                    </option>
                    <option value="Hydrochemical Optical Sensor">
                      Hydrochemical Optical Sensor
                    </option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">Hardware Model</label>
                  <input
                    type="text"
                    value={sensorModel}
                    onChange={(e) => setSensorModel(e.target.value)}
                    placeholder="AquaSense-Probe-v2"
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Initial Baseline Telemetry */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
              <Droplet className="h-3.5 w-3.5 text-blue-500" />
              <span>Initial Baseline Telemetry (Optional)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Water Level (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={waterLevel}
                  onChange={(e) => setWaterLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">pH Level</label>
                <input
                  type="number"
                  step="0.1"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">TDS (ppm)</label>
                <input
                  type="number"
                  step="1"
                  value={tds}
                  onChange={(e) => setTds(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Turbidity (NTU)</label>
                <input
                  type="number"
                  step="0.1"
                  value={turbidity}
                  onChange={(e) => setTurbidity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">DO (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={doVal}
                  onChange={(e) => setDoVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Water Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={waterTemp}
                  onChange={(e) => setWaterTemp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* ── Modal Footer ───────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60 dark:border-navy-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-cyan-600 to-teal-500 hover:from-brand-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registering Station...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Register Well Station</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
