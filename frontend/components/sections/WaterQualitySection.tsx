'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { WaterQualityChart } from '@/components/charts/Charts';
import type { WaterQualityData } from '@/types/environment';

interface WaterQualitySectionProps {
  waterQuality: WaterQualityData;
  lat: number;
  lon: number;
}

const QUALITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  GOOD: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200' },
  MODERATE: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200' },
  POOR: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200' },
  DANGEROUS: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200' },
};

interface MetricCardProps {
  label: string;
  value: string;
  normal: string;
  unit: string;
  status: 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS';
  description?: string;
}

function MetricCard({ label, value, normal, unit, status, description }: MetricCardProps) {
  const s = QUALITY_STYLES[status];
  return (
    <div className={`p-4 rounded-xl border ${s.bg} ${s.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-sm font-semibold text-muted-foreground">{label}</div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>{status}</span>
      </div>
      <div className={`text-3xl font-bold ${s.text}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{unit}</div>
      <div className="mt-2 text-xs text-muted-foreground">Normal: {normal}</div>
      {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}

function getPhStatus(ph: number): 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS' {
  if (ph < 5.5 || ph > 9.5) return 'DANGEROUS';
  if (ph < 6.0 || ph > 9.0) return 'POOR';
  if (ph < 6.5 || ph > 8.5) return 'MODERATE';
  return 'GOOD';
}
function getTurbidityStatus(t: number): 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS' {
  if (t > 100) return 'DANGEROUS';
  if (t > 25) return 'POOR';
  if (t > 10) return 'MODERATE';
  return 'GOOD';
}
function getTdsStatus(t: number): 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS' {
  if (t > 1000) return 'DANGEROUS';
  if (t > 500) return 'POOR';
  if (t > 300) return 'MODERATE';
  return 'GOOD';
}
function getDoStatus(d: number): 'GOOD' | 'MODERATE' | 'POOR' | 'DANGEROUS' {
  if (d < 2) return 'DANGEROUS';
  if (d < 5) return 'POOR';
  if (d < 6) return 'MODERATE';
  return 'GOOD';
}

export function WaterQualitySection({ waterQuality: wq, lat, lon }: WaterQualitySectionProps) {
  const overallStyle = QUALITY_STYLES[wq.category] ?? QUALITY_STYLES.GOOD;

  return (
    <div className="space-y-6">
      {/* Overall status */}
      <div className="flex items-start justify-between">
        <div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-lg ${overallStyle.bg} ${overallStyle.text} ${overallStyle.border}`}>
            💧 Overall Water Quality: {wq.category}
          </div>
          <div className="text-sm text-muted-foreground mt-2">Based on pH, turbidity, TDS, and dissolved oxygen readings</div>
        </div>
        <DataSourceBadge info={wq.data_source} />
      </div>

      {/* Parameter cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          label="pH Level"
          value={wq.ph.toFixed(2)}
          normal="6.5 – 8.5"
          unit="Dimensionless"
          status={getPhStatus(wq.ph)}
          description={wq.ph < 7 ? 'Slightly acidic' : wq.ph > 7.5 ? 'Slightly alkaline' : 'Neutral'}
        />
        <MetricCard
          label="Turbidity"
          value={wq.turbidity.toFixed(1)}
          normal="< 10 NTU"
          unit="NTU (Nephelometric)"
          status={getTurbidityStatus(wq.turbidity)}
          description={wq.turbidity > 10 ? 'Elevated — possible runoff' : 'Clear water'}
        />
        <MetricCard
          label="TDS"
          value={wq.tds.toFixed(0)}
          normal="< 500 ppm"
          unit="Parts per million"
          status={getTdsStatus(wq.tds)}
        />
        <MetricCard
          label="Water Temperature"
          value={`${wq.temperature.toFixed(1)}°C`}
          normal="10 – 30°C"
          unit="Celsius"
          status={wq.temperature > 30 || wq.temperature < 10 ? 'MODERATE' : 'GOOD'}
        />
        <MetricCard
          label="Dissolved Oxygen"
          value={`${wq.dissolved_oxygen.toFixed(1)} mg/L`}
          normal="> 6 mg/L"
          unit="mg/L"
          status={getDoStatus(wq.dissolved_oxygen)}
          description={wq.dissolved_oxygen < 5 ? 'Low — aquatic life stress' : 'Adequate for aquatic life'}
        />
        {wq.electrical_conductivity !== undefined && (
          <MetricCard
            label="Electrical Conductivity"
            value={`${wq.electrical_conductivity.toFixed(1)} μS/cm`}
            normal="< 800 μS/cm"
            unit="Microsiemens/cm"
            status={wq.electrical_conductivity > 800 ? 'POOR' : wq.electrical_conductivity > 500 ? 'MODERATE' : 'GOOD'}
          />
        )}
      </div>

      {/* Historical trends */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">24-Hour Quality Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <WaterQualityChart lat={lat} lon={lon} />
        </CardContent>
      </Card>

      {/* Drinking water standards note */}
      <div className="p-4 rounded-xl bg-muted/50 border text-sm space-y-2">
        <div className="font-semibold">Reference: WHO / BIS Drinking Water Standards</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <span>pH: 6.5–8.5</span>
          <span>Turbidity: &lt;1 NTU (drinking)</span>
          <span>TDS: &lt;500 ppm</span>
          <span>DO: &gt;6 mg/L (fish)</span>
        </div>
      </div>
    </div>
  );
}
