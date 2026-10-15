'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

export interface WellWaterLevelProps {
  /** Current water level reading in meters (water-column height above sensor/well datum) */
  waterLevel: number | null | undefined;
  /** Warning threshold level in meters (default: 7.5m) */
  warningLevel?: number;
  /** Danger threshold level in meters (default: 8.5m) */
  dangerLevel?: number;
  /** Minimum scale level in meters (default: 0m) */
  minLevel?: number;
  /** Maximum scale level in meters (default: computed based on dangerLevel or 10m) */
  maxLevel?: number;
  /** Unit of measurement (default: "m") */
  unit?: string;
  /** Hydrological trend */
  trend?: 'RISING' | 'FALLING' | 'STABLE' | string;
  /** Explicit status override or computed from warning/danger */
  status?: string;
  /** Display height of the tube container in pixels or CSS height string */
  height?: number | string;
  /** Compact card mode vs full detailed mode */
  compact?: boolean;
  /** Whether to show graduation ticks on the side */
  showTicks?: boolean;
  /** Optional well name or identifier for accessibility */
  wellName?: string;
  /** Additional CSS class names */
  className?: string;
}

export function WellWaterLevel({
  waterLevel,
  warningLevel = 7.5,
  dangerLevel = 8.5,
  minLevel = 0,
  maxLevel,
  unit = 'm',
  trend,
  status: statusProp,
  height = 240,
  compact = false,
  showTicks = true,
  wellName,
  className = '',
}: WellWaterLevelProps) {
  // Validate and compute scale limits safely
  const safeWarningLevel = typeof warningLevel === 'number' && !isNaN(warningLevel) ? warningLevel : 7.5;
  const safeDangerLevel = typeof dangerLevel === 'number' && !isNaN(dangerLevel) ? dangerLevel : 8.5;
  const safeMin = typeof minLevel === 'number' && !isNaN(minLevel) ? minLevel : 0;
  
  const computedMax = useMemo(() => {
    if (typeof maxLevel === 'number' && !isNaN(maxLevel) && maxLevel > safeMin) {
      return maxLevel;
    }
    const current = typeof waterLevel === 'number' && !isNaN(waterLevel) ? waterLevel : 0;
    const highestTarget = Math.max(safeDangerLevel * 1.15, current * 1.12, 10.0);
    return Math.ceil(highestTarget);
  }, [maxLevel, safeMin, safeDangerLevel, waterLevel]);

  const hasReading = typeof waterLevel === 'number' && !isNaN(waterLevel);
  const currentLevel = hasReading ? (waterLevel as number) : null;

  // Calculate fill percentage (water-column height fills from bottom upward)
  const fillPercentage = useMemo(() => {
    if (currentLevel === null) return 0;
    const range = computedMax - safeMin;
    if (range <= 0) return 0;
    const rawPct = ((currentLevel - safeMin) / range) * 100;
    return Math.min(100, Math.max(0, rawPct));
  }, [currentLevel, safeMin, computedMax]);

  // Warning & Danger percentages for threshold markers
  const warningPercentage = useMemo(() => {
    const range = computedMax - safeMin;
    if (range <= 0) return 75;
    return Math.min(100, Math.max(0, ((safeWarningLevel - safeMin) / range) * 100));
  }, [safeWarningLevel, safeMin, computedMax]);

  const dangerPercentage = useMemo(() => {
    const range = computedMax - safeMin;
    if (range <= 0) return 85;
    return Math.min(100, Math.max(0, ((safeDangerLevel - safeMin) / range) * 100));
  }, [safeDangerLevel, safeMin, computedMax]);

  // Stage assessment (NORMAL, WARNING, DANGER)
  const currentStatus = useMemo(() => {
    if (statusProp) return statusProp.toUpperCase();
    if (currentLevel === null) return 'UNAVAILABLE';
    if (currentLevel >= safeDangerLevel) return 'DANGER';
    if (currentLevel >= safeWarningLevel) return 'WARNING';
    return 'NORMAL';
  }, [statusProp, currentLevel, safeDangerLevel, safeWarningLevel]);

  // Dynamic gradient styling according to current status
  const waterGradient = useMemo(() => {
    if (currentStatus === 'DANGER') {
      return 'from-rose-500 via-red-500 to-rose-700 shadow-[0_0_20px_rgba(244,63,94,0.4)]';
    }
    if (currentStatus === 'WARNING') {
      return 'from-amber-400 via-orange-400 to-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.35)]';
    }
    // Normal water stage: Vibrant aqua/cyan to deep marine blue
    return 'from-cyan-400 via-sky-500 to-teal-600 shadow-[0_0_20px_rgba(6,182,212,0.35)]';
  }, [currentStatus]);

  const meniscusColor = useMemo(() => {
    if (currentStatus === 'DANGER') return 'bg-rose-300 border-rose-200';
    if (currentStatus === 'WARNING') return 'bg-amber-200 border-amber-100';
    return 'bg-cyan-200 border-cyan-100';
  }, [currentStatus]);

  // Graduation tick marks
  const ticks = useMemo(() => {
    const count = compact ? 4 : 6;
    const step = (computedMax - safeMin) / (count - 1);
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(Math.round((safeMin + step * i) * 10) / 10);
    }
    return result;
  }, [computedMax, safeMin, compact]);

  const containerHeightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`relative flex items-center justify-center gap-3 select-none ${className}`}
      role="region"
      aria-label={`${wellName || 'Well'} water level visualization: ${
        currentLevel !== null ? `${currentLevel.toFixed(2)} ${unit}` : 'Reading unavailable'
      }`}
    >
      {/* ── Left Side Graduation Ticks ───────────────────────────── */}
      {showTicks && !compact && (
        <div
          className="flex flex-col justify-between text-[10px] font-mono font-medium text-muted-foreground/80 py-2 h-full text-right"
          style={{ height: containerHeightStyle }}
          aria-hidden="true"
        >
          {ticks
            .slice()
            .reverse()
            .map((val) => (
              <div key={val} className="flex items-center justify-end gap-1.5 h-3">
                <span>{val.toFixed(1)}{unit}</span>
                <span className="w-2 h-[1px] bg-border dark:bg-navy-700 inline-block" />
              </div>
            ))}
        </div>
      )}

      {/* ── Central Cylindrical Glass Tube ───────────────────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: containerHeightStyle }}
      >
        {/* Glass Outer Cylinder */}
        <div
          className={`relative overflow-hidden rounded-full border border-white/40 dark:border-cyan-500/30 bg-gradient-to-r from-white/10 via-white/5 to-white/20 dark:from-navy-950/60 dark:via-navy-900/40 dark:to-navy-950/70 backdrop-blur-md shadow-inner transition-all ${
            compact ? 'w-10' : 'w-14'
          }`}
          style={{ height: '100%' }}
        >
          {/* Specular Edge Highlights (Realistic Curved Glass Look) */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/40 to-transparent pointer-events-none z-20" />
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-white/30 to-transparent pointer-events-none z-20" />
          <div className="absolute top-1 left-2 right-2 h-2 rounded-full bg-white/20 blur-[1px] pointer-events-none z-20" />

          {/* Warning Level Horizontal Marker */}
          {warningPercentage > 0 && warningPercentage < 100 && (
            <div
              className="absolute left-0 right-0 border-b border-dashed border-amber-400/80 z-20 pointer-events-none transition-all"
              style={{ bottom: `${warningPercentage}%` }}
              title={`Warning Threshold: ${safeWarningLevel.toFixed(1)}${unit}`}
            >
              <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-amber-400 opacity-90 shadow-xs" />
            </div>
          )}

          {/* Danger Level Horizontal Marker */}
          {dangerPercentage > 0 && dangerPercentage < 100 && (
            <div
              className="absolute left-0 right-0 border-b border-dashed border-rose-500/80 z-20 pointer-events-none transition-all"
              style={{ bottom: `${dangerPercentage}%` }}
              title={`Danger Threshold: ${safeDangerLevel.toFixed(1)}${unit}`}
            >
              <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500 opacity-90 shadow-xs" />
            </div>
          )}

          {/* ── Realistic Liquid Column (fills upward) ─────────────── */}
          {hasReading ? (
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-b ${waterGradient} transition-all duration-700 ease-out z-10`}
              style={{
                height: `${Math.max(4, fillPercentage)}%`,
              }}
            >
              {/* Horizontal Water Meniscus (Surface Line & Ripple) */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 rounded-full -translate-y-1/2 border-t opacity-90 ${meniscusColor} shadow-xs`}
              />

              {/* Gentle Water Waves (respects prefers-reduced-motion) */}
              <div className="absolute inset-0 opacity-20 overflow-hidden pointer-events-none">
                <div className="w-[200%] h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent motion-safe:animate-[waveMotion_5s_ease-in-out_infinite_alternate] motion-reduce:animate-none" />
              </div>

              {/* Subtle micro-highlights inside liquid */}
              <div className="absolute bottom-3 left-1/3 w-1 h-1 rounded-full bg-white/40 opacity-50 pointer-events-none" />
              <div className="absolute bottom-7 right-1/4 w-1.5 h-1.5 rounded-full bg-white/30 opacity-40 pointer-events-none" />
            </div>
          ) : (
            /* Unavailable / Uncalibrated state */
            <div className="absolute inset-0 flex items-center justify-center p-1 text-center">
              <span className="text-[10px] font-mono text-muted-foreground/60 rotate-90 whitespace-nowrap">
                NO TELEMETRY
              </span>
            </div>
          )}

          {/* Subtle Glass Tube Bottom Cap */}
          <div className="absolute bottom-0 left-0 right-0 h-3 rounded-b-full bg-gradient-to-t from-white/20 to-transparent pointer-events-none z-20" />
        </div>
      </div>

      {/* ── Right Side Readout & Metadata ────────────────────────── */}
      <div className="flex flex-col justify-center space-y-1.5">
        {/* Prominent Reading */}
        <div className="flex items-baseline gap-1">
          <span
            className={`font-black tracking-tight text-foreground font-mono transition-all ${
              compact ? 'text-xl' : 'text-3xl'
            }`}
          >
            {currentLevel !== null ? currentLevel.toFixed(2) : '--'}
          </span>
          <span className="text-xs font-bold text-muted-foreground">{unit}</span>

          {/* Trend Icon */}
          {trend && (
            <span
              className={`ml-1 inline-flex items-center text-xs font-bold ${
                trend === 'RISING'
                  ? 'text-rose-500'
                  : trend === 'FALLING'
                  ? 'text-cyan-500'
                  : 'text-muted-foreground'
              }`}
              title={`Trend: ${trend}`}
            >
              {trend === 'RISING' && <TrendingUp className="h-4 w-4" />}
              {trend === 'FALLING' && <TrendingDown className="h-4 w-4" />}
              {trend === 'STABLE' && <Minus className="h-4 w-4" />}
            </span>
          )}
        </div>

        {/* Status Pill */}
        <div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs ${
              currentStatus === 'DANGER'
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : currentStatus === 'WARNING'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : currentStatus === 'NORMAL'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-muted/80 text-muted-foreground border-border/80'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentStatus === 'DANGER'
                  ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
                  : currentStatus === 'WARNING'
                  ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                  : currentStatus === 'NORMAL'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                  : 'bg-gray-400'
              }`}
            />
            <span>{currentStatus}</span>
          </span>
        </div>

        {/* Descriptive Measurement Label */}
        <div className="text-[10px] text-muted-foreground flex flex-col font-medium">
          <span className="font-semibold text-foreground/80">Water Column Stage</span>
          <span className="text-[9px] text-muted-foreground/80">
            Warn: {safeWarningLevel.toFixed(1)}{unit} · Danger: {safeDangerLevel.toFixed(1)}{unit}
          </span>
        </div>
      </div>
    </div>
  );
}
