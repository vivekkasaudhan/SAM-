'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Trash2,
  Save,
  AlertTriangle,
  AlertCircle,
  MapPin,
  Sliders,
  Globe,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { wellService } from '@/services/api';

interface EditWellModalProps {
  well: any | null;
  isOpen: boolean;
  onClose: () => void;
  onWellUpdated: (updated: any) => void;
  onDeleteRequest?: (well: any) => void;
}

export function EditWellModal({
  well,
  isOpen,
  onClose,
  onWellUpdated,
  onDeleteRequest,
}: EditWellModalProps) {
  const [name, setName] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [lat, setLat] = useState<number>(0);
  const [lon, setLon] = useState<number>(0);
  const [warningLevel, setWarningLevel] = useState<number>(7.5);
  const [dangerLevel, setDangerLevel] = useState<number>(8.5);
  const [totalDepth, setTotalDepth] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (well) {
      setName(well.name || '');
      setLocationDescription(well.location_description || '');
      setCountry(well.country || 'India');
      setState(well.state || '');
      setDistrict(well.district || '');
      setCity(well.city || '');
      setLat(well.latitude || 0);
      setLon(well.longitude || 0);
      setWarningLevel(well.warning_level_m || 7.5);
      setDangerLevel(well.danger_level_m || 8.5);
      setTotalDepth(well.total_depth_m != null ? String(well.total_depth_m) : '');
      setIsActive(well.is_active ?? true);
      setError(null);
    }
  }, [well]);

  if (!isOpen || !well) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Well name cannot be empty.');
      return;
    }

    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lon) || lon < -180 || lon > 180) {
      setError('Coordinates must be valid geographical numbers (-90 to 90, -180 to 180).');
      return;
    }

    if (Number(warningLevel) <= 0 || Number(dangerLevel) <= 0) {
      setError('Warning and danger levels must be greater than zero.');
      return;
    }

    if (Number(warningLevel) >= Number(dangerLevel)) {
      setError('Warning level must be strictly less than danger level.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await wellService.updateWell(well.id, {
        name: name.trim(),
        location_description: locationDescription.trim() || null,
        country: country.trim() || 'India',
        state: state.trim() || null,
        district: district.trim() || null,
        city: city.trim() || null,
        latitude: lat,
        longitude: lon,
        warning_level_m: Number(warningLevel),
        danger_level_m: Number(dangerLevel),
        total_depth_m: totalDepth ? parseFloat(totalDepth) : null,
        is_active: isActive,
      });
      onWellUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update well station.');
    } finally {
      setSaving(false);
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
      <div className="relative w-full max-w-2xl my-6 bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-6 border-b border-border/60 dark:border-navy-800 bg-muted/20 dark:bg-navy-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              <Edit2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground tracking-tight">
                  Edit Well Station
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted dark:bg-navy-950 text-foreground border border-border/60">
                  {well.id}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Update spatial coordinates, geographic hierarchy, safety thresholds, and active status
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
        <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Section 1: Identity & Geographic Scope */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
              <Globe className="h-3.5 w-3.5 text-cyan-500" />
              <span>Identity & Geographic Hierarchy</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-foreground">
                  Well Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-foreground">Location Description / Landmark</label>
                <input
                  type="text"
                  value={locationDescription}
                  onChange={(e) => setLocationDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">State / Province</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">District / County</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">City / Municipality</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Spatial Coordinates */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
              <MapPin className="h-3.5 w-3.5 text-cyan-500" />
              <span>Spatial Coordinates</span>
            </div>

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
          </div>

          {/* Section 3: Hydrological Thresholds & Active Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/40">
              <Sliders className="h-3.5 w-3.5 text-amber-500" />
              <span>Safety Thresholds & Activation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Warning Level (m)
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
                  Danger Level (m)
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
                  Total Well Depth (m)
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

            <div className="p-4 rounded-2xl bg-muted/40 dark:bg-navy-950/40 border border-border/60 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-foreground">Operational Status</div>
                <div className="text-[11px] text-muted-foreground">
                  {isActive
                    ? 'Station is active and broadcasting telemetry on GIS network'
                    : 'Station is deactivated / in maintenance mode'}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          {/* ── Modal Footer ───────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60 dark:border-navy-800">
            {onDeleteRequest ? (
              <button
                type="button"
                onClick={() => onDeleteRequest(well)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Well...</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 via-cyan-600 to-teal-500 hover:from-brand-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
