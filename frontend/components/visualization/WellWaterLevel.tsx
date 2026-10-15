'use client';

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface WellWaterLevelProps {
  /** Current water level reading in meters (water-column height above sensor/well datum) */
  waterLevel: number | null | undefined;
  /** Warning threshold level in meters (default: 7.5m) */
  warningLevel?: number;
  /** Danger threshold level in meters (default: 8.5m) */
  dangerLevel?: number;
  /** Critical low / depletion threshold in meters (default: 1.2m) */
  criticalLowLevel?: number;
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
  criticalLowLevel = 1.2,
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
  // Validate thresholds
  const safeWarningLevel = typeof warningLevel === 'number' && !isNaN(warningLevel) ? warningLevel : 7.5;
  const safeDangerLevel = typeof dangerLevel === 'number' && !isNaN(dangerLevel) ? dangerLevel : 8.5;
  const safeCriticalLow = typeof criticalLowLevel === 'number' && !isNaN(criticalLowLevel) ? criticalLowLevel : 1.2;
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

  // Fill percentage
  const fillPercentage = useMemo(() => {
    if (currentLevel === null) return 0;
    const range = computedMax - safeMin;
    if (range <= 0) return 0;
    const rawPct = ((currentLevel - safeMin) / range) * 100;
    return Math.min(98, Math.max(2, rawPct));
  }, [currentLevel, safeMin, computedMax]);

  // Threshold marker percentages
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

  const criticalLowPercentage = useMemo(() => {
    const range = computedMax - safeMin;
    if (range <= 0) return 12;
    return Math.min(100, Math.max(0, ((safeCriticalLow - safeMin) / range) * 100));
  }, [safeCriticalLow, safeMin, computedMax]);

  // Status computation
  const currentStatus = useMemo(() => {
    if (statusProp) return statusProp.toUpperCase();
    if (currentLevel === null) return 'UNAVAILABLE';
    if (currentLevel >= safeDangerLevel) return 'DANGER';
    if (currentLevel >= safeWarningLevel) return 'WARNING';
    if (currentLevel <= safeCriticalLow) return 'DEPLETION';
    return 'NORMAL';
  }, [statusProp, currentLevel, safeDangerLevel, safeWarningLevel, safeCriticalLow]);

  // Liquid gradients & meniscus colors based on state
  const liquidGradient = useMemo(() => {
    switch (currentStatus) {
      case 'DANGER':
        return {
          fill: 'from-rose-600 via-rose-500 to-red-700',
          wave: '#f43f5e',
          waveGleam: '#fecdd3',
          glow: 'rgba(244,63,94,0.3)',
          badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
          label: 'CRITICAL HIGH',
        };
      case 'DEPLETION':
        return {
          fill: 'from-amber-600 via-orange-500 to-amber-700',
          wave: '#f97316',
          waveGleam: '#fed7aa',
          glow: 'rgba(249,115,22,0.3)',
          badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
          label: 'DEPLETION RISK',
        };
      case 'WARNING':
        return {
          fill: 'from-amber-500 via-amber-400 to-yellow-600',
          wave: '#f59e0b',
          waveGleam: '#fef3c7',
          glow: 'rgba(245,158,11,0.25)',
          badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
          label: 'HIGH STAGE',
        };
      default:
        return {
          // Deep authentic aquatic blue-to-cyan gradient
          fill: 'from-sky-500 via-cyan-500 to-blue-700',
          wave: '#06b6d4',
          waveGleam: '#a5f3fc',
          glow: 'rgba(6,182,212,0.25)',
          badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
          label: 'OPTIMAL STAGE',
        };
    }
  }, [currentStatus]);

  // Graduation tick marks
  const ticks = useMemo(() => {
    const count = compact ? 3 : 5;
    const step = (computedMax - safeMin) / (count - 1);
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(Math.round((safeMin + step * i) * 10) / 10);
    }
    return result;
  }, [computedMax, safeMin, compact]);

  const containerHeightStyle = typeof height === 'number' ? `${height}px` : height;
  const tubeWidthClass = compact ? 'w-11' : 'w-16';

  return (
    <div
      className={`relative flex items-center justify-center gap-3 select-none ${className}`}
      role="region"
      aria-label={`${wellName || 'Well'} water level: ${
        currentLevel !== null ? `${currentLevel.toFixed(2)} ${unit}` : 'Unavailable'
      }`}
    >
      {/* ── Left Side Graduation Ticks ───────────────────────────── */}
      {showTicks && !compact && (
        <div
          className="flex flex-col justify-between text-[10px] font-mono font-medium text-muted-foreground/70 py-3 h-full text-right"
          style={{ height: containerHeightStyle }}
          aria-hidden="true"
        >
          {ticks
            .slice()
            .reverse()
            .map((val) => (
              <div key={val} className="flex items-center justify-end gap-1.5 h-3">
                <span>{val.toFixed(1)}{unit}</span>
                <span className="w-2.5 h-[1px] bg-border dark:bg-navy-700 inline-block" />
              </div>
            ))}
        </div>
      )}

      {/* ── Central Cylindrical Glass Pipe & Water Column ────────── */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: containerHeightStyle }}
      >
        {/* Top Metallic Pipe Coupling Flange */}
        <div
          className={`absolute -top-1 z-30 h-2 rounded-t-sm bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 dark:from-navy-800 dark:via-slate-600 dark:to-navy-900 border border-border/80 shadow-xs flex items-center justify-around px-1 ${
            compact ? 'w-13' : 'w-18'
          }`}
        >
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shadow-2xs" />
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shadow-2xs" />
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shadow-2xs" />
        </div>

        {/* Outer Transparent Glass Borehole Tube */}
        <div
          className={`relative overflow-hidden rounded-full border border-white/60 dark:border-cyan-500/25 bg-gradient-to-r from-white/20 via-white/5 to-white/30 dark:from-navy-950/80 dark:via-navy-900/40 dark:to-navy-950/85 backdrop-blur-md shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)] transition-all ${tubeWidthClass}`}
          style={{ height: '100%' }}
        >
          {/* Specular Edge Refraction Lines */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/60 via-white/20 to-transparent pointer-events-none z-20" />
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-white/40 via-white/10 to-transparent pointer-events-none z-20" />
          {/* Central Cylindrical Highlight */}
          <div className="absolute inset-y-0 left-1/3 w-1 bg-white/15 blur-[0.5px] pointer-events-none z-20" />

          {/* Warning Level Horizontal Marker */}
          {warningPercentage > 0 && warningPercentage < 100 && (
            <div
              className="absolute left-0 right-0 border-b border-dashed border-amber-400/90 z-20 pointer-events-none transition-all"
              style={{ bottom: `${warningPercentage}%` }}
              title={`Warning Threshold: ${safeWarningLevel.toFixed(1)}${unit}`}
            >
              <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-amber-400 opacity-90 shadow-xs" />
            </div>
          )}

          {/* Danger Level Horizontal Marker */}
          {dangerPercentage > 0 && dangerPercentage < 100 && (
            <div
              className="absolute left-0 right-0 border-b border-dashed border-rose-500/90 z-20 pointer-events-none transition-all"
              style={{ bottom: `${dangerPercentage}%` }}
              title={`Danger Threshold: ${safeDangerLevel.toFixed(1)}${unit}`}
            >
              <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500 opacity-90 shadow-xs" />
            </div>
          )}

          {/* Critical Low Depletion Marker */}
          {criticalLowPercentage > 0 && criticalLowPercentage < 100 && (
            <div
              className="absolute left-0 right-0 border-b border-dashed border-orange-500/90 z-20 pointer-events-none transition-all"
              style={{ bottom: `${criticalLowPercentage}%` }}
              title={`Critical Depletion Threshold: ${safeCriticalLow.toFixed(1)}${unit}`}
            >
              <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-orange-500 opacity-90 shadow-xs" />
            </div>
          )}

          {/* ── Realistic Liquid Column (Smooth Height Transition) ── */}
          {hasReading ? (
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${liquidGradient.fill} transition-[height] duration-700 ease-in-out z-10 overflow-hidden`}
              style={{
                height: `${fillPercentage}%`,
                boxShadow: `0 0 16px ${liquidGradient.glow}`,
              }}
            >
              {/* Subtle animated meniscus wave surface */}
              <div className="absolute top-0 left-0 right-0 h-3 -translate-y-1/2 pointer-events-none overflow-hidden">
                <svg
                  viewBox="0 0 120 18"
                  className="w-[200%] h-full motion-safe:animate-[waveMotion_3.5s_linear_infinite] motion-reduce:animate-none opacity-85"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M 0 9 Q 15 2, 30 9 T 60 9 T 90 9 T 120 9 L 120 18 L 0 18 Z"
                    fill={liquidGradient.wave}
                    opacity="0.9"
                  />
                  <path
                    d="M 0 8 Q 15 1, 30 8 T 60 8 T 90 8 T 120 8"
                    stroke={liquidGradient.waveGleam}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.95"
                  />
                </svg>
              </div>

              {/* Liquid Depth Caustic Reflection */}
              <div className="absolute inset-y-0 left-1/4 w-1/3 bg-gradient-to-r from-white/20 via-white/5 to-transparent pointer-events-none" />

              {/* Rising micro-bubbles (sparingly, gentle) */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <span
                  className="absolute bottom-1 left-1/4 w-1 h-1 rounded-full bg-white/50 motion-safe:animate-[bubbleFloat_3.2s_ease-in_infinite] motion-reduce:hidden"
                  style={{ animationDelay: '0.2s' }}
                />
                <span
                  className="absolute bottom-2 right-1/3 w-1.2 h-1.2 rounded-full bg-white/40 motion-safe:animate-[bubbleFloat_4.1s_ease-in_infinite] motion-reduce:hidden"
                  style={{ animationDelay: '1.5s' }}
                />
                <span
                  className="absolute bottom-0 left-1/2 w-0.8 h-0.8 rounded-full bg-white/60 motion-safe:animate-[bubbleFloat_2.8s_ease-in_infinite] motion-reduce:hidden"
                  style={{ animationDelay: '2.4s' }}
                />
              </div>
            </div>
          ) : (
            /* Offline / Uncalibrated state */
            <div className="absolute inset-0 flex items-center justify-center p-1 text-center">
              <span className="text-[9px] font-mono text-muted-foreground/50 rotate-90 whitespace-nowrap">
                NO READING
              </span>
            </div>
          )}

          {/* Bottom Glass Curved Cap */}
          <div className="absolute bottom-0 left-0 right-0 h-2 rounded-b-full bg-gradient-to-t from-white/30 to-transparent pointer-events-none z-20" />
        </div>

        {/* Bottom Metallic Pipe Joint Flange */}
        <div
          className={`absolute -bottom-1 z-30 h-2 rounded-b-sm bg-gradient-to-r from-slate-300 via-slate-100 to-slate-400 dark:from-navy-800 dark:via-slate-600 dark:to-navy-900 border border-border/80 shadow-xs flex items-center justify-around px-1 ${
            compact ? 'w-13' : 'w-18'
          }`}
        >
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shadow-2xs" />
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shadow-2xs" />
          <span className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 shadow-2xs" />
        </div>
      </div>

      {/* ── Right Side Readout & Trend Indicator ─────────────────── */}
      <div className="flex flex-col justify-center space-y-1">
        {/* Numeric Depth Readout */}
        <div className="flex items-baseline gap-1">
          <span
            className={`font-black tracking-tight text-foreground font-mono transition-all ${
              compact ? 'text-lg' : 'text-2xl sm:text-3xl'
            }`}
          >
            {currentLevel !== null ? currentLevel.toFixed(2) : '--'}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">{unit}</span>

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
              title={`Aquifer Trend: ${trend}`}
            >
              {trend === 'RISING' && <TrendingUp className="h-3.5 w-3.5" />}
              {trend === 'FALLING' && <TrendingDown className="h-3.5 w-3.5" />}
              {trend === 'STABLE' && <Minus className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>

        {/* Stage Status Badge */}
        <div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-2xs ${liquidGradient.badge}`}
          >
            {currentStatus === 'DANGER' && <ShieldAlert className="h-2.5 w-2.5" />}
            {currentStatus === 'WARNING' && <AlertTriangle className="h-2.5 w-2.5" />}
            {currentStatus === 'NORMAL' && <CheckCircle2 className="h-2.5 w-2.5" />}
            <span>{liquidGradient.label}</span>
          </span>
        </div>

        {/* Relative Height Indicator for non-compact mode */}
        {!compact && (
          <div className="text-[10px] text-muted-foreground font-mono pt-0.5">
            Range: 0 – {computedMax}{unit}
          </div>
        )}
      </div>
    </div>
  );
}
