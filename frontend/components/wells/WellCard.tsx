'use client';

import React from 'react';
import {
  MapPin,
  Cpu,
  Clock,
  ArrowUpRight,
  Eye,
  Radio,
  Activity,
  Layers,
  Thermometer,
  Droplet,
  Waves,
  User,
} from 'lucide-react';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
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

  // Format location string
  const locationString = [
    well.city,
    well.district && well.district !== well.city ? well.district : null,
    well.state,
  ]
    .filter(Boolean)
    .join(', ');

  const readingStatus = reading?.status || 'SIMULATED';

  return (
    <div
      className={`group relative flex flex-col justify-between p-5 rounded-3xl bg-card/85 dark:bg-navy-900/85 backdrop-blur-xl border border-border/80 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark hover:border-cyan-500/50 hover:shadow-glow-aqua transition-all duration-300 ${className}`}
    >
      {/* ── Header: Well Identifier, Location & Badges ────────────── */}
      <div className="space-y-3 pb-3 border-b border-border/50 dark:border-navy-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted dark:bg-navy-950 text-foreground border border-border/60">
                {well.id}
              </span>

              {/* Sensor Hardware Status */}
              {primarySensor ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                  <Cpu className="h-2.5 w-2.5" />
                  <span>{primarySensor.model}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                  Unmetered Node
                </span>
              )}

              {/* Creator Info */}
              {well.creator && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/50"
                  title={`Registered by ${well.creator.name || well.creator.username} (${well.creator.email || ''})`}
                >
                  <User className="h-2.5 w-2.5 text-cyan-500" />
                  <span className="truncate max-w-[90px]">{well.creator.name || well.creator.username}</span>
                </span>
              )}

              {/* Read-only indicator for other subadmins */}
              {isReadOnlyForUser && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-500/10 px-2 py-0.5 rounded-full border border-slate-500/30">
                  Read-only
                </span>
              )}
            </div>

            <h3 className="font-extrabold text-base tracking-tight text-foreground line-clamp-1 group-hover:text-cyan-500 transition-colors">
              {well.name}
            </h3>
          </div>

          {/* Correct Data Source Badge */}
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
              readingStatus === 'LIVE'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : readingStatus === 'ESTIMATED'
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {readingStatus === 'LIVE' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)] inline-block" />
            ) : (
              <Radio className="h-3 w-3 text-amber-500" />
            )}
            <span>{readingStatus}</span>
          </span>
        </div>

        {/* Location & Coordinates */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
            <span className="truncate max-w-[220px]">
              {locationString || well.location_description || 'India'}
            </span>
          </div>
          <span className="text-muted-foreground/40">•</span>
          <span className="font-mono text-[11px]">
            {well.latitude.toFixed(4)}°N, {well.longitude.toFixed(4)}°E
          </span>
        </div>
      </div>

      {/* ── Body: Animated Glass Water Tube + Hydrochemical Readings ── */}
      <div className="py-4 grid grid-cols-12 gap-3 items-center">
        {/* Animated Water Level Tube (Left side, ~150px) */}
        <div className="col-span-5 flex justify-center py-1">
          <WellWaterLevel
            waterLevel={reading?.water_level_m}
            warningLevel={well.warning_level_m || 7.5}
            dangerLevel={well.danger_level_m || 8.5}
            height={150}
            compact={true}
            showTicks={false}
            wellName={well.name}
          />
        </div>

        {/* Water Quality Parameters Grid (Right side) */}
        <div className="col-span-7 grid grid-cols-2 gap-1.5">
          {/* pH */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground">pH Level</span>
            <span className="text-sm font-black font-mono text-teal-600 dark:text-teal-400">
              {reading?.ph != null ? reading.ph.toFixed(2) : '--'}
            </span>
          </div>

          {/* TDS */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground">TDS</span>
            <span className="text-sm font-black font-mono text-blue-600 dark:text-blue-400 truncate">
              {reading?.tds_ppm != null ? `${Math.round(reading.tds_ppm)} ppm` : '--'}
            </span>
          </div>

          {/* Turbidity */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground">Turbidity</span>
            <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 truncate">
              {reading?.turbidity_ntu != null ? `${reading.turbidity_ntu.toFixed(1)} NTU` : '--'}
            </span>
          </div>

          {/* Dissolved Oxygen */}
          <div className="p-2 rounded-xl bg-muted/40 dark:bg-navy-950/40 border border-border/50 dark:border-navy-800 flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground">Dissolved O₂</span>
            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {reading?.dissolved_oxygen_mg_l != null
                ? `${reading.dissolved_oxygen_mg_l.toFixed(1)} mg/L`
                : '--'}
            </span>
          </div>

          {/* Water Temperature (Full width) */}
          <div className="col-span-2 px-2.5 py-1.5 rounded-xl bg-muted/30 dark:bg-navy-950/30 border border-border/40 dark:border-navy-800 flex items-center justify-between text-xs">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
              <Thermometer className="h-3 w-3 text-orange-500" /> Water Temp
            </span>
            <span className="font-mono font-bold text-foreground">
              {reading?.temperature_c != null ? `${reading.temperature_c.toFixed(1)}°C` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer: Timestamp & Action Controls ─────────────────────── */}
      <div className="pt-3 border-t border-border/50 dark:border-navy-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate">
          <Clock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
          <span className="truncate">{relativeTime}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onSelectOnMap && (
            <button
              onClick={() => onSelectOnMap(well.latitude, well.longitude, well.name)}
              className="p-2 rounded-xl border border-border/70 dark:border-navy-750 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs"
              title="Focus on interactive GIS map"
            >
              <Layers className="h-3.5 w-3.5 text-cyan-500" />
            </button>
          )}

          <button
            onClick={() => onViewDetails(well.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs shadow-xs hover:shadow-glow-aqua transition-all active:scale-95 cursor-pointer"
          >
            <span>View Details</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
