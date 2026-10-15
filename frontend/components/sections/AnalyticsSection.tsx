'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { analyticsService } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';

interface AnalyticsSectionProps {
  lat: number;
  lon: number;
}

const COMPARISONS = [
  {
    id: 'rainfall_vs_water_level',
    label: 'Rainfall vs Water Level',
    description: 'Correlation between rainfall accumulation and hydrological river stage changes',
  },
  {
    id: 'temp_vs_water_temp',
    label: 'Air Temp vs Water Temp',
    description: 'Diurnal air temperature variance compared with river water thermal inertia',
  },
  {
    id: 'rainfall_vs_turbidity',
    label: 'Rainfall vs Turbidity',
    description: 'Surface runoff erosion impact causing turbidity spikes during precipitation',
  },
  {
    id: 'water_level_vs_flood_risk',
    label: 'Water Level vs Flood Risk',
    description: 'Dynamic calculated flood hazard index as water levels approach threshold',
  },
  {
    id: 'ph_vs_time',
    label: 'pH Trend vs Safe Range',
    description: 'Temporal stability of chemical acidity/alkalinity relative to WHO limits (6.5 - 8.5)',
  },
  {
    id: 'turbidity_vs_time',
    label: 'Turbidity vs Threshold',
    description: 'Suspended sediment concentration vs standard 10 NTU clarity threshold',
  },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const source = payload[0]?.payload?.source || 'AquaSense Analytics Engine';
  return (
    <div className="bg-card border rounded-lg shadow-xl p-3 text-xs space-y-1 z-50">
      <div className="font-semibold text-foreground border-b pb-1 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span className="font-medium">{p.name}:</span>
          <span className="font-bold">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
      <div className="text-[10px] text-muted-foreground pt-1 border-t mt-1 flex items-center justify-between">
        <span>Source:</span>
        <span className="font-medium">{source}</span>
      </div>
    </div>
  );
};

export function AnalyticsSection({ lat, lon }: AnalyticsSectionProps) {
  const [selectedComp, setSelectedComp] = useState(COMPARISONS[0].id);
  const [hours, setHours] = useState(48);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsService
      .getAnalytics(lat, lon, selectedComp, hours)
      .then((res) => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [lat, lon, selectedComp, hours]);

  const activeMeta = COMPARISONS.find((c) => c.id === selectedComp)!;

  const renderChart = () => {
    switch (selectedComp) {
      case 'temp_vs_water_temp':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="display_time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => `${v}°C`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="air_temp_c" name="Air Temperature (°C)" stroke="#f97316" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="water_temp_c" name="Water Temperature (°C)" stroke="#0ea5e9" strokeWidth={2.5} dot={false} strokeDasharray="5 2" />
          </ComposedChart>
        );

      case 'rainfall_vs_turbidity':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="display_time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="turb" orientation="left" tickFormatter={(v) => `${v} NTU`} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="rain" orientation="right" tickFormatter={(v) => `${v}mm`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar yAxisId="rain" dataKey="rainfall_mm" name="Rainfall (mm)" fill="#0284c7" opacity={0.5} barSize={6} />
            <Line yAxisId="turb" type="monotone" dataKey="turbidity_ntu" name="Turbidity (NTU)" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        );

      case 'water_level_vs_flood_risk':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="display_time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="wl" orientation="left" tickFormatter={(v) => `${v}m`} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="risk" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area yAxisId="risk" type="monotone" dataKey="flood_risk_score" name="Flood Risk Score (0-100)" fill="#ef4444" stroke="#ef4444" fillOpacity={0.15} strokeWidth={2} dot={false} />
            <Line yAxisId="wl" type="monotone" dataKey="water_level_m" name="Water Level (m)" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        );

      case 'ph_vs_time':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="display_time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis domain={[5.0, 9.5]} tickFormatter={(v) => `${v}`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <ReferenceLine y={6.5} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Safe Min 6.5', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={8.5} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Safe Max 8.5', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
            <Line type="monotone" dataKey="ph" name="Water pH" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </ComposedChart>
        );

      case 'turbidity_vs_time':
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="display_time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => `${v} NTU`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <ReferenceLine y={10.0} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Clarity Threshold (10 NTU)', position: 'left', fill: '#f59e0b', fontSize: 10 }} />
            <Line type="monotone" dataKey="turbidity_ntu" name="Turbidity (NTU)" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </ComposedChart>
        );

      case 'rainfall_vs_water_level':
      default:
        return (
          <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="display_time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="water" orientation="left" tickFormatter={(v) => `${v}m`} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="rain" orientation="right" tickFormatter={(v) => `${v}mm`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <ReferenceLine yAxisId="water" y={5.5} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Warning (5.5m)', position: 'left', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine yAxisId="water" y={6.2} stroke="#ef4444" strokeWidth={1.5} label={{ value: 'Danger (6.2m)', position: 'left', fill: '#ef4444', fontSize: 10 }} />
            <Bar yAxisId="rain" dataKey="rainfall_mm" name="Rainfall (mm)" fill="#06b6d4" opacity={0.6} barSize={6} />
            <Line yAxisId="water" type="monotone" dataKey="water_level_m" name="Water Level (m)" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
          </ComposedChart>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-500" />
            Environmental Analytics & Correlation Engine
          </h2>
          <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {[24, 48, 72, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                hours === h
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {h === 168 ? '7 Days' : `${h}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Selector Chips */}
      <div className="flex flex-wrap gap-2">
        {COMPARISONS.map((comp) => (
          <button
            key={comp.id}
            onClick={() => setSelectedComp(comp.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selectedComp === comp.id
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card hover:bg-accent border-border text-muted-foreground'
            }`}
          >
            {comp.label}
          </button>
        ))}
      </div>

      {/* Main Chart Container */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">{activeMeta.label}</CardTitle>
            <div className="text-xs text-muted-foreground">Hover to view timestamp, values & telemetry source</div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : (
            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
