'use client';

import React from 'react';
import {
  MapPin,
  Cpu,
  Clock,
  ArrowUpRight,
  Layers,
  Thermometer,
  User,
  Radio,
  Lock,
} from 'lucide-react';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { authService, isSubadmin } from '@/services/api';

export interface WellData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  location_description?: string | null;
  warning_level_m?: number;
  danger_level_m?: number;
  total_depth_m?: number | null;
  lithology_count?: number;
  lithology_status?: 'RECORDED' | 'PARTIAL' | 'NONE' | string;
  total_logged_depth_m?: number;
  is_active?: boolean;
  created_by?: number | null;
  creator?: {
    id: number;
    name?: string | null;
    email?: string | null;
    username: string;
    role?: string | null;
  } | null;
  sensors?: Array<{
    id: string;
    sensor_type: string;
    model: string;
    is_active?: boolean;
  }>;
  latest_reading?: {
    water_level_m: number;
    ph: number;
    tds_ppm: number;
    turbidity_ntu: number;
    dissolved_oxygen_mg_l: number;
    temperature_c: number;
    status?: string;
    source?: string;
    timestamp?: string;
  } | null;
}

export interface WellCardProps {
  well: WellData;
  onViewDetails: (wellId: string) => void;
  onSelectOnMap?: (lat: number, lon: number, name: string) => void;
  className?: string;
}

export function WellCard({
  well,
  onViewDetails,
  onSelectOnMap,
  className = '',
}: WellCardProps) {
  const reading = well.latest_reading;
  const activeSensors = (well.sensors || []).filter((s) => s.is_active !== false);
  const primarySensor = activeSensors[0];

  const currentUser = React.useMemo(() => {
    return authService.getCurrentUser();
  }, []);

  const isReadOnlyForUser = Boolean(
    currentUser &&
    isSubadmin(currentUser) &&
    well.created_by != null &&
    String(well.created_by) !== String(currentUser.id)
  );

  // Format relative timestamp
  const relativeTime = React.useMemo(() => {
    if (!reading?.timestamp) return 'No readings yet';
    try {
      const d = parseISO(reading.timestamp.replace('Z', ''));
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return reading.timestamp;
    }
  }, [reading?.timestamp]);

  // Clean location hierarchy string
  const locationString = [
    well.city,
    well.district && well.district !== well.city ? well.district : null,
    well.state,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={`group relative flex flex-col justify-between p-5 rounded-2xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-sm hover:shadow-md hover:border-cyan-500/40 transition-all duration-200 ${className}`}
    >
      {/* ── Card Header: Identifiers, Badges & Location ─────────────── */}
      <div className="space-y-2 pb-3 border-b border-border/50 dark:border-navy-800 min-w-0">
        {/* Row 1: ID, Node Status, Lithology & Read-only */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-foreground bg-muted/80 dark:bg-navy-950 px-2 py-0.5 rounded border border-border/70 shrink-0">
              {well.id}
            </span>

            {/* Active Live Telemetry Status Dot */}
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground truncate"
              title={primarySensor ? `Telemetry transceiver: ${primarySensor.model}` : 'Automated aquifer monitoring node'}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              <span className="truncate max-w-[130px]">
                {primarySensor ? primarySensor.model : 'Virtual Node'}
              </span>
            </span>
          </div>

          {/* Right badges: Lithology indicator & Permissions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isReadOnlyForUser && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/20"
                title="Read-only: Managed by another subadmin"
              >
                <Lock className="h-2.5 w-2.5" />
                <span>Read-only</span>
              </span>
            )}

            {well.lithology_status === 'RECORDED' ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/25"
                title={`Lithology Logged: ${well.total_logged_depth_m || 0}m logged (${well.lithology_count || 0} strata)`}
              >
                <Layers className="h-2.5 w-2.5 text-teal-500" />
                <span>Strata Logged</span>
              </span>
            ) : well.lithology_status === 'PARTIAL' ? (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25"
                title="Subsurface lithology partially logged"
              >
                <Layers className="h-2.5 w-2.5 text-amber-500" />
                <span>Partial Log</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Row 2: Station Name */}
        <h3
          className="font-bold text-base text-foreground tracking-tight truncate min-w-0 group-hover:text-cyan-500 transition-colors"
          title={well.name}
        >
          {well.name}
        </h3>

        {/* Row 3: Geographical Coordinates & Location */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
          <MapPin className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
          <span
            className="truncate min-w-0 font-medium"
            title={locationString || well.location_description || 'India'}
          >
            {locationString || well.location_description || 'India'}
          </span>
          <span className="text-muted-foreground/40 shrink-0">•</span>
          <span className="font-mono text-[11px] shrink-0 text-muted-foreground/80">
            {well.latitude.toFixed(3)}°, {well.longitude.toFixed(3)}°
          </span>
        </div>
      </div>

      {/* ── Card Body: Water Level Tube + Environmental Readings ────── */}
      <div className="py-3.5 grid grid-cols-12 gap-3 items-center">
        {/* Left Column: Realistic Water Column Tube */}
        <div className="col-span-5 flex justify-center py-0.5">
          <WellWaterLevel
            waterLevel={reading?.water_level_m}
            warningLevel={well.warning_level_m || 7.5}
            dangerLevel={well.danger_level_m || 8.5}
            height={135}
            compact={true}
            showTicks={false}
            wellName={well.name}
          />
        </div>

        {/* Right Column: Hydrochemical & Physical Metrics 2x2 Grid */}
        <div className="col-span-7 grid grid-cols-2 gap-1.5 min-w-0">
          {/* pH */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">pH</span>
            <span className="text-sm font-black font-mono text-teal-600 dark:text-teal-400">
              {reading?.ph != null ? reading.ph.toFixed(2) : '--'}
            </span>
          </div>

          {/* TDS */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">TDS</span>
            <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400 truncate">
              {reading?.tds_ppm != null ? `${Math.round(reading.tds_ppm)} ppm` : '--'}
            </span>
          </div>

          {/* Turbidity */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Turbidity</span>
            <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 truncate">
              {reading?.turbidity_ntu != null ? `${reading.turbidity_ntu.toFixed(1)} NTU` : '--'}
            </span>
          </div>

          {/* Dissolved Oxygen */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Dissolved O₂</span>
            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {reading?.dissolved_oxygen_mg_l != null
                ? `${reading.dissolved_oxygen_mg_l.toFixed(1)} mg/L`
                : '--'}
            </span>
          </div>

          {/* Water Temp & Depth Bar */}
          <div className="col-span-2 px-2.5 py-1.5 rounded-xl bg-muted/30 dark:bg-navy-950/30 border border-border/40 dark:border-navy-800 flex items-center justify-between text-xs">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
              <Thermometer className="h-3 w-3 text-orange-500" />
              <span>Temp</span>
            </span>
            <span className="font-mono font-bold text-foreground">
              {reading?.temperature_c != null ? `${reading.temperature_c.toFixed(1)}°C` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Card Footer: Owner / Timestamp & Action Buttons ─────────── */}
      <div className="pt-3 border-t border-border/50 dark:border-navy-800 flex items-center justify-between gap-2 text-xs min-w-0">
        <div className="flex items-center gap-2 min-w-0 text-muted-foreground text-[11px]">
          {/* Well Owner / Creator */}
          {well.creator && (
            <span
              className="inline-flex items-center gap-1 truncate max-w-[120px] font-medium"
              title={`Registered by: ${well.creator.name || well.creator.username} (${well.creator.email || ''})`}
            >
              <User className="h-3 w-3 text-cyan-500 shrink-0" />
              <span className="truncate">{well.creator.name || well.creator.username}</span>
            </span>
          )}

          {well.creator && <span className="text-muted-foreground/40 shrink-0">•</span>}

          {/* Last updated relative time */}
          <span className="flex items-center gap-1 shrink-0 font-medium" title={reading?.timestamp || ''}>
            <Clock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span>{relativeTime}</span>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onSelectOnMap && (
            <button
              type="button"
              onClick={() => onSelectOnMap(well.latitude, well.longitude, well.name)}
              className="p-1.5 rounded-lg border border-border/80 dark:border-navy-750 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs cursor-pointer"
              title="Focus on GIS map"
            >
              <MapPin className="h-3.5 w-3.5 text-cyan-500" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onViewDetails(well.id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <span>Details</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
