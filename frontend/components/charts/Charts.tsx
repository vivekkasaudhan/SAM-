'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, ComposedChart,
} from 'recharts';
import { historyService } from '@/services/api';
import type { HistoryPoint } from '@/types/environment';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';

const TIME_FILTERS = [
  { label: '1H', hours: 1, interval: 5 },
  { label: '6H', hours: 6, interval: 15 },
  { label: '24H', hours: 24, interval: 30 },
  { label: '7D', hours: 168, interval: 360 },
];

interface WaterLevelChartProps {
  lat: number;
  lon: number;
  warningLevel: number;
  dangerLevel: number;
}

function TimeFilterButton({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
        active
          ? 'bg-brand-500 text-white shadow-sm'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
    </button>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <div className="font-semibold text-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function WaterLevelChart({ lat, lon, warningLevel, dangerLevel }: WaterLevelChartProps) {
  const [filter, setFilter] = useState(TIME_FILTERS[2]);
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    historyService
      .getHistory(lat, lon, 'water_level', filter.hours, filter.interval)
      .then(res => setData(res.history))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [lat, lon, filter]);

  const formatTick = (ts: string) => {
    try {
      const d = parseISO(ts.replace('Z', ''));
      if (filter.hours <= 6) return format(d, 'HH:mm');
      if (filter.hours <= 48) return format(d, 'HH:mm');
      return format(d, 'dd/MM');
    } catch { return ts; }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  const minVal = Math.max(0, Math.min(...data.map(d => d.value)) - 0.3);
  const maxVal = Math.max(dangerLevel + 0.5, Math.max(...data.map(d => d.value)) + 0.2);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {TIME_FILTERS.map(f => (
          <TimeFilterButton key={f.label} label={f.label} active={filter.label === f.label} onClick={() => setFilter(f)} />
        ))}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-amber-400 border-dashed border-t-2 border-amber-400 inline-block" /> Warning {warningLevel.toFixed(1)}m</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-red-500 inline-block" /> Danger {dangerLevel.toFixed(1)}m</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="wlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}>
                <animate attributeName="stopColor" values="#3b82f6;#06b6d4;#2563eb;#3b82f6" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.04} />
            </linearGradient>

            {/* Continuous Animated Water Wave ('Lahr') Pattern */}
            <pattern id="waterLahrWavesDashboard" width="180" height="80" patternUnits="userSpaceOnUse">
              <path d="M 0 20 Q 45 6, 90 20 T 180 20 L 180 80 L 0 80 Z" fill="rgba(59, 130, 246, 0.08)">
                <animateTransform attributeName="transform" type="translate" from="0,0" to="-180,0" dur="2.2s" repeatCount="indefinite" />
              </path>
              <path d="M 0 20 Q 45 6, 90 20 T 180 20" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="2">
                <animateTransform attributeName="transform" type="translate" from="0,0" to="-180,0" dur="2.2s" repeatCount="indefinite" />
              </path>
              <path d="M 0 45 Q 45 32, 90 45 T 180 45" fill="none" stroke="rgba(6, 182, 212, 0.35)" strokeWidth="1.6">
                <animateTransform attributeName="transform" type="translate" from="-90,0" to="90,0" dur="3s" repeatCount="indefinite" />
              </path>
              <circle cx="35" cy="65" r="1.8" fill="rgba(255, 255, 255, 0.6)">
                <animate attributeName="cy" values="75;15" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.9;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle cx="120" cy="55" r="2.2" fill="rgba(147, 197, 253, 0.6)">
                <animate attributeName="cy" values="78;20" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.8;0" dur="2.2s" repeatCount="indefinite" />
              </circle>
            </pattern>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="timestamp" tickFormatter={formatTick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis domain={[minVal, maxVal]} tickFormatter={v => `${v.toFixed(1)}m`} tick={{ fontSize: 11 }} width={50} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={warningLevel} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: '⚠ Warning', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
          <ReferenceLine y={dangerLevel} stroke="#ef4444" strokeWidth={2} label={{ value: '🔴 Danger', position: 'right', fill: '#ef4444', fontSize: 10 }} />
          <Area type="monotone" dataKey="value" name="Water Level (m)" stroke="#3b82f6" fill="url(#wlGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          {/* Animated Water Wave ('Lahr') Overlay */}
          <Area type="monotone" dataKey="value" stroke="none" fill="url(#waterLahrWavesDashboard)" fillOpacity={1} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Weather Chart ────────────────────────────────────────────────────────────
interface WeatherChartProps {
  lat: number;
  lon: number;
  forecastData?: any;
}

export function WeatherChart({ lat, lon, forecastData }: WeatherChartProps) {
  // We use forecast data from the environment endpoint (Open-Meteo hourly)
  // If no forecast, show placeholder
  if (!forecastData?.forecast?.temperature_2m) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        Weather forecast chart will appear here
      </div>
    );
  }

  const times: string[] = forecastData.forecast.time || [];
  const temps: number[] = forecastData.forecast.temperature_2m || [];
  const precip: number[] = forecastData.forecast.precipitation || [];
  const humidity: number[] = forecastData.forecast.relative_humidity_2m || [];

  const chartData = times.slice(0, 48).map((t, i) => ({
    time: t,
    temp: temps[i] ?? 0,
    precip: precip[i] ?? 0,
    humidity: humidity[i] ?? 0,
  }));

  const formatTime = (t: string) => {
    try { return format(parseISO(t), 'HH:mm'); } catch { return t; }
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11 }} interval={3} />
        <YAxis yAxisId="temp" orientation="left" tickFormatter={v => `${v}°`} tick={{ fontSize: 11 }} />
        <YAxis yAxisId="precip" orientation="right" tickFormatter={v => `${v}mm`} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Area yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#f97316" fill="url(#tempGrad)" strokeWidth={2} dot={false} />
        <Bar yAxisId="precip" dataKey="precip" name="Rain (mm)" fill="#3b82f6" opacity={0.7} barSize={4} />
        <Line yAxisId="temp" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#8b5cf6" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Water Quality Chart ──────────────────────────────────────────────────────
export function WaterQualityChart({ lat, lon }: { lat: number; lon: number }) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'ph' | 'turbidity' | 'tds' | 'dissolved_oxygen'>('ph');

  useEffect(() => {
    setLoading(true);
    historyService
      .getHistory(lat, lon, 'water_quality', 24, 30)
      .then(res => setData(res.history))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [lat, lon]);

  const METRICS = [
    { key: 'ph' as const, label: 'pH', color: '#06b6d4', unit: '' },
    { key: 'turbidity' as const, label: 'Turbidity', color: '#8b5cf6', unit: ' NTU' },
    { key: 'tds' as const, label: 'TDS', color: '#f59e0b', unit: ' ppm' },
    { key: 'dissolved_oxygen' as const, label: 'DO', color: '#10b981', unit: ' mg/L' },
  ];

  const active = METRICS.find(m => m.key === metric)!;

  if (loading) return <Skeleton className="h-64 w-full" />;

  const chartData = data.map(d => ({
    timestamp: d.timestamp,
    value: (d as any)[metric] ?? d.value,
  }));

  const formatTick = (ts: string) => {
    try { return format(parseISO(ts.replace('Z', '')), 'HH:mm'); } catch { return ''; }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {METRICS.map(m => (
          <TimeFilterButton key={m.key} label={m.label} active={metric === m.key} onClick={() => setMetric(m.key)} />
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="timestamp" tickFormatter={formatTick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={v => `${v.toFixed(2)}${active.unit}`} tick={{ fontSize: 11 }} width={55} />
          <Tooltip content={<CustomTooltip />} />
          {metric === 'ph' && (
            <>
              <ReferenceLine y={6.5} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Min 6.5', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
              <ReferenceLine y={8.5} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Max 8.5', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
            </>
          )}
          <Line type="monotone" dataKey="value" name={`${active.label}${active.unit}`} stroke={active.color} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: active.color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Air Quality Chart ────────────────────────────────────────────────────────
export function AirQualityChart({ lat, lon }: { lat: number; lon: number }) {
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    historyService
      .getHistory(lat, lon, 'air_quality', 24, 30)
      .then(res => setData(res.history))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [lat, lon]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  const formatTick = (ts: string) => {
    try { return format(parseISO(ts.replace('Z', '')), 'HH:mm'); } catch { return ''; }
  };

  // AQI zone fills
  const getAqiColor = (aqi: number) => {
    if (aqi > 200) return '#9333ea';
    if (aqi > 150) return '#ef4444';
    if (aqi > 100) return '#f97316';
    if (aqi > 50) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="space-y-3">
      {/* AQI bands legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[['Good', '#10b981', '0-50'], ['Moderate', '#f59e0b', '51-100'], ['Unhealthy*', '#f97316', '101-150'], ['Unhealthy', '#ef4444', '151-200'], ['Very Unhealthy', '#9333ea', '200+']].map(([l, c, r]) => (
          <span key={l as string} className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c as string }} />
            {l} ({r})
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="timestamp" tickFormatter={formatTick} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={150} stroke="#f97316" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
          <Area type="monotone" dataKey="value" name="AQI" stroke="#3b82f6" fill="url(#aqiGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
