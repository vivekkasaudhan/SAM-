'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CloudSun,
  Waves,
  FlaskConical,
  Wind,
  Thermometer,
  Gauge,
  Droplets,
  CloudRain,
  Activity,
  AlertCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';
import type { EnvironmentData, WaterTrend } from '@/types/environment';
import { getWeatherLabel, getWeatherIcon } from '@/types/environment';

// ─── Status Config with Enterprise Navy & Aqua Highlights ─────────────────────
const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  NORMAL: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  GOOD: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  MODERATE: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  WARNING: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  POOR: {
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    dot: 'bg-orange-500',
  },
  HIGH: {
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    dot: 'bg-orange-500',
  },
  DANGER: {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  DANGEROUS: {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  CRITICAL: {
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dot: 'bg-rose-600',
  },
  UNHEALTHY: {
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    dot: 'bg-orange-500',
  },
  HAZARDOUS: {
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-500',
  },
};

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.NORMAL;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border ${style.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{status}</span>
    </span>
  );
}

function TrendBadge({ trend, change }: { trend: WaterTrend; change?: number | null }) {
  const isRising = trend === 'RISING';
  const isFalling = trend === 'FALLING';

  return (
    <div
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border ${
        isRising
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          : isFalling
          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
          : 'bg-muted/60 text-muted-foreground border-border/80'
      }`}
    >
      {isRising && <TrendingUp className="h-3.5 w-3.5 text-rose-500" />}
      {isFalling && <TrendingDown className="h-3.5 w-3.5 text-cyan-500" />}
      {!isRising && !isFalling && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
      <span>
        {typeof change === 'number'
          ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} m (1h)`
          : trend || 'STABLE'}
      </span>
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-muted-foreground/80">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-right">
        <span className="font-semibold text-foreground">{value}</span>
        {subtext && <span className="text-[10px] text-muted-foreground ml-1">({subtext})</span>}
      </div>
    </div>
  );
}

// ─── 1. Atmospheric & Weather Card ────────────────────────────────────────────
function WeatherCard({ data }: { data: EnvironmentData }) {
  const w = data.weather;
  const label = getWeatherLabel(w.weather_code);
  const iconEmoji = getWeatherIcon(w.weather_code);

  return (
    <div className="flex flex-col justify-between p-5 rounded-2xl bg-card border border-border/70 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark hover:border-cyan-500/40 transition-all duration-200">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <CloudSun className="h-4 w-4" />
            </div>
            <span>Atmospheric Telemetry</span>
          </div>
          <StatusPill status="NORMAL" />
        </div>

        <div className="pt-4 flex items-center justify-between">
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {w.temperature_2m != null ? `${w.temperature_2m.toFixed(1)}°C` : '--'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span>Feels like {w.apparent_temperature != null ? `${w.apparent_temperature.toFixed(1)}°C` : '--'}</span>
              <span>·</span>
              <span className="font-medium text-foreground">{label}</span>
            </div>
          </div>
          <div className="text-3xl filter drop-shadow-sm p-1">{iconEmoji}</div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 divide-y divide-border/40">
          <MetricItem
            icon={<Droplets className="h-3.5 w-3.5 text-cyan-500" />}
            label="Relative Humidity"
            value={`${w.relative_humidity_2m ?? '--'}%`}
          />
          <MetricItem
            icon={<CloudRain className="h-3.5 w-3.5 text-blue-500" />}
            label="Precipitation"
            value={`${w.precipitation != null ? w.precipitation.toFixed(1) : '0.0'} mm`}
          />
          <MetricItem
            icon={<Wind className="h-3.5 w-3.5 text-teal-500" />}
            label="Surface Wind"
            value={`${w.wind_speed_10m != null ? w.wind_speed_10m.toFixed(0) : '0'} km/h`}
          />
          <MetricItem
            icon={<Gauge className="h-3.5 w-3.5 text-indigo-500" />}
            label="Barometric Pressure"
            value={`${w.surface_pressure != null ? w.surface_pressure.toFixed(0) : '1013'} hPa`}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50">
        <DataSourceBadge info={w.data_source} />
      </div>
    </div>
  );
}

// ─── 2. Hydrological Stage & Water Level Card ─────────────────────────────────
function WaterLevelCard({ data }: { data: EnvironmentData }) {
  const wl = data.water_level;
  const dangerLevel = wl.danger_level_m ?? 8.5;
  const warningLevel = wl.warning_level_m ?? 7.5;
  const currentLevel = wl.water_level ?? 0;

  const status =
    currentLevel >= dangerLevel
      ? 'DANGER'
      : currentLevel >= warningLevel
      ? 'WARNING'
      : 'NORMAL';

  return (
    <div className="flex flex-col justify-between p-5 rounded-2xl bg-card border border-border/70 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark hover:border-cyan-500/40 transition-all duration-200">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Waves className="h-4 w-4" />
            </div>
            <span>Hydrological Stage</span>
          </div>
          <StatusPill status={status} />
        </div>

        {/* Animated Tube & Level Readings Layout */}
        <div className="pt-4 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5 flex justify-center py-1">
            <WellWaterLevel
              waterLevel={wl.water_level}
              warningLevel={warningLevel}
              dangerLevel={dangerLevel}
              height={140}
              compact={true}
              showTicks={false}
              trend={wl.trend}
            />
          </div>

          <div className="col-span-7 space-y-2">
            <div>
              <div className="text-2xl font-black font-mono tracking-tight text-foreground">
                {wl.water_level != null ? `${wl.water_level.toFixed(2)} m` : '--'}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Water-column stage
              </div>
            </div>
            <TrendBadge trend={wl.trend} change={wl.change_1h_m} />

            <div className="pt-2 border-t border-border/40 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warn Limit:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{warningLevel.toFixed(1)}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Danger Limit:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{dangerLevel.toFixed(1)}m</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50 divide-y divide-border/40">
          {typeof wl.flow_rate_cumecs === 'number' && (
            <MetricItem
              icon={<Waves className="h-3.5 w-3.5 text-cyan-500" />}
              label="Catchment Discharge"
              value={`${wl.flow_rate_cumecs.toFixed(0)} m³/s`}
            />
          )}
          {wl.nearest_station && (
            <MetricItem
              icon={<Waves className="h-3.5 w-3.5 text-teal-500" />}
              label="Telemetry Station"
              value={wl.nearest_station}
            />
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50">
        <DataSourceBadge info={wl.data_source} />
      </div>
    </div>
  );
}

// ─── 3. Water Quality Index Card ──────────────────────────────────────────────
function WaterQualityCard({ data }: { data: EnvironmentData }) {
  const wq = data.water_quality;
  const status = wq.category || 'GOOD';

  return (
    <div className="flex flex-col justify-between p-5 rounded-2xl bg-card border border-border/70 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark hover:border-cyan-500/40 transition-all duration-200">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <FlaskConical className="h-4 w-4" />
            </div>
            <span>Water Quality Index</span>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="pt-4 flex items-baseline justify-between">
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-foreground">
              {wq.ph != null ? `pH ${wq.ph.toFixed(2)}` : '--'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Normal Potability: 6.5 – 8.5 pH
            </div>
          </div>
          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
            {status}
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 divide-y divide-border/40">
          <MetricItem
            icon={<Zap className="h-3.5 w-3.5 text-amber-500" />}
            label="Total Dissolved Solids"
            value={wq.tds != null ? `${wq.tds.toFixed(0)} ppm` : '--'}
            subtext="TDS"
          />
          <MetricItem
            icon={<Waves className="h-3.5 w-3.5 text-blue-500" />}
            label="Turbidity Optical Stage"
            value={wq.turbidity != null ? `${wq.turbidity.toFixed(1)} NTU` : '--'}
          />
          <MetricItem
            icon={<Thermometer className="h-3.5 w-3.5 text-rose-400" />}
            label="Water Core Temp"
            value={wq.temperature != null ? `${wq.temperature.toFixed(1)}°C` : '--'}
          />
          <MetricItem
            icon={<Droplets className="h-3.5 w-3.5 text-teal-500" />}
            label="Dissolved Oxygen"
            value={wq.dissolved_oxygen != null ? `${wq.dissolved_oxygen.toFixed(1)} mg/L` : '--'}
            subtext="DO"
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50">
        <DataSourceBadge info={wq.data_source} />
      </div>
    </div>
  );
}

// ─── 4. Environmental Air Quality & Risk Card ─────────────────────────────────
function AirQualityCard({ data }: { data: EnvironmentData }) {
  const aq = data.air_quality;
  const aqiVal = aq.aqi ?? 0;

  const aqiStatus =
    aqiVal > 200
      ? 'CRITICAL'
      : aqiVal > 150
      ? 'DANGEROUS'
      : aqiVal > 100
      ? 'UNHEALTHY'
      : aqiVal > 50
      ? 'MODERATE'
      : 'GOOD';

  const aqiTextColor =
    aqiVal > 200
      ? 'text-purple-600 dark:text-purple-400'
      : aqiVal > 150
      ? 'text-rose-600 dark:text-rose-400'
      : aqiVal > 100
      ? 'text-orange-600 dark:text-orange-400'
      : aqiVal > 50
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="flex flex-col justify-between p-5 rounded-2xl bg-card border border-border/70 dark:border-navy-750 shadow-enterprise dark:shadow-enterprise-dark hover:border-cyan-500/40 transition-all duration-200">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Wind className="h-4 w-4" />
            </div>
            <span>Air Quality Index</span>
          </div>
          <StatusPill status={aqiStatus} />
        </div>

        <div className="pt-4 flex items-baseline justify-between">
          <div>
            <div className={`text-3xl font-extrabold tracking-tight ${aqiTextColor}`}>
              {aq.aqi != null ? `AQI ${Math.round(aq.aqi)}` : '--'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Category: <span className="font-medium text-foreground">{aq.category || 'Moderate'}</span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border/60">
            CPCB / EPA
          </span>
        </div>

        <div className="mt-4 pt-3 border-t border-border/50 divide-y divide-border/40">
          <MetricItem
            icon={<span className="text-muted-foreground text-xs font-mono font-bold">PM</span>}
            label="PM 2.5 Fine Particulate"
            value={aq.pm25 != null ? `${aq.pm25.toFixed(1)} μg/m³` : '--'}
          />
          <MetricItem
            icon={<span className="text-muted-foreground text-xs font-mono font-bold">PM</span>}
            label="PM 10 Coarse Particulate"
            value={aq.pm10 != null ? `${aq.pm10.toFixed(1)} μg/m³` : '--'}
          />
          <MetricItem
            icon={<Activity className="h-3.5 w-3.5 text-cyan-500" />}
            label="Nitrogen Dioxide (NO₂)"
            value={aq.no2 != null ? `${aq.no2.toFixed(1)} μg/m³` : '--'}
          />
          <MetricItem
            icon={<Activity className="h-3.5 w-3.5 text-teal-500" />}
            label="Surface Ozone (O₃)"
            value={aq.o3 != null ? `${aq.o3.toFixed(1)} μg/m³` : '--'}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50">
        <DataSourceBadge info={aq.data_source} />
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function EnvironmentOverview({ data }: { data: EnvironmentData }) {
  return (
    <section aria-label="Core Environmental Telemetry Overview" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span>Core Environmental Telemetry</span>
        </h2>
        <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline-block">
          Synced across satellite feeds, IoT loggers & hydrological simulations
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <WeatherCard data={data} />
        <WaterLevelCard data={data} />
        <WaterQualityCard data={data} />
        <AirQualityCard data={data} />
      </div>
    </section>
  );
}
