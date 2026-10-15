'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { AirQualityChart } from '@/components/charts/Charts';
import type { AirQualityData } from '@/types/environment';

interface AirQualitySectionProps {
  airQuality: AirQualityData;
  lat: number;
  lon: number;
}

const AQI_LEVELS = [
  { min: 0, max: 50, label: 'Good', color: 'bg-emerald-500', textColor: 'text-emerald-600', description: 'Air quality is satisfactory, and air pollution poses little or no risk.' },
  { min: 51, max: 100, label: 'Moderate', color: 'bg-amber-400', textColor: 'text-amber-600', description: 'Acceptable quality. Some pollutants may concern very sensitive people.' },
  { min: 101, max: 150, label: 'Unhealthy for Sensitive', color: 'bg-orange-500', textColor: 'text-orange-600', description: 'Sensitive groups may experience health effects.' },
  { min: 151, max: 200, label: 'Unhealthy', color: 'bg-red-500', textColor: 'text-red-600', description: 'Everyone may experience health effects.' },
  { min: 201, max: 300, label: 'Very Unhealthy', color: 'bg-purple-600', textColor: 'text-purple-600', description: 'Health alert: everyone may experience serious health effects.' },
  { min: 301, max: 500, label: 'Hazardous', color: 'bg-rose-900', textColor: 'text-rose-700', description: 'Health warning of emergency conditions.' },
];

function getAqiLevel(aqi: number) {
  return AQI_LEVELS.find(l => aqi >= l.min && aqi <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1];
}

interface PollutantCardProps {
  label: string;
  value: string;
  unit: string;
  limit: string;
  emoji: string;
  isHigh?: boolean;
}

function PollutantCard({ label, value, unit, limit, emoji, isHigh }: PollutantCardProps) {
  return (
    <div className={`p-3 rounded-xl border ${isHigh ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : 'bg-muted/50'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-muted-foreground">{emoji} {label}</span>
        {isHigh && <span className="text-xs font-bold text-red-500">HIGH</span>}
      </div>
      <div className={`text-2xl font-bold ${isHigh ? 'text-red-600' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{unit}</div>
      <div className="text-xs text-muted-foreground mt-1">Safe limit: {limit}</div>
    </div>
  );
}

export function AirQualitySection({ airQuality: aq, lat, lon }: AirQualitySectionProps) {
  const level = getAqiLevel(aq.aqi);
  const aqiPct = Math.min(100, (aq.aqi / 300) * 100);

  return (
    <div className="space-y-6">
      {/* AQI Overview */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-6">
          {/* AQI Dial */}
          <div className="text-center">
            <div className={`text-6xl font-bold ${level.textColor}`}>{Math.round(aq.aqi)}</div>
            <div className="text-xs text-muted-foreground">AQI</div>
          </div>
          <div>
            <div className={`text-xl font-bold ${level.textColor}`}>{level.label}</div>
            <div className="text-sm text-muted-foreground max-w-xs mt-1">{level.description}</div>
          </div>
        </div>
        <DataSourceBadge info={aq.data_source} />
      </div>

      {/* AQI scale */}
      <div className="space-y-1">
        <div className="h-3 w-full rounded-full overflow-hidden flex">
          {AQI_LEVELS.map(l => (
            <div key={l.label} className={`flex-1 ${l.color}`} title={l.label} />
          ))}
        </div>
        <div className="relative h-2">
          <div
            className="absolute w-3 h-3 bg-foreground rounded-full -top-1 transition-all duration-500 -translate-x-1/2"
            style={{ left: `${aqiPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300+</span>
        </div>
      </div>

      {/* Pollutant cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <PollutantCard label="PM2.5" value={aq.pm25.toFixed(1)} unit="μg/m³" limit="35 μg/m³" emoji="🔬" isHigh={aq.pm25 > 35} />
        <PollutantCard label="PM10" value={aq.pm10.toFixed(1)} unit="μg/m³" limit="50 μg/m³" emoji="🔬" isHigh={aq.pm10 > 50} />
        <PollutantCard label="NO₂" value={aq.no2.toFixed(1)} unit="μg/m³" limit="40 μg/m³" emoji="🏭" isHigh={aq.no2 > 40} />
        <PollutantCard label="SO₂" value={aq.so2.toFixed(1)} unit="μg/m³" limit="20 μg/m³" emoji="⚗️" isHigh={aq.so2 > 20} />
        <PollutantCard label="O₃" value={aq.o3.toFixed(1)} unit="μg/m³" limit="60 μg/m³" emoji="🌀" isHigh={aq.o3 > 60} />
        <PollutantCard label="CO" value={aq.co.toFixed(2)} unit="mg/m³" limit="4 mg/m³" emoji="💨" isHigh={aq.co > 4} />
      </div>

      {/* Historical chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">24-Hour AQI Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <AirQualityChart lat={lat} lon={lon} />
        </CardContent>
      </Card>

      {/* Health advice */}
      <Card className={`border-2 ${aq.aqi > 150 ? 'border-red-300' : aq.aqi > 100 ? 'border-amber-300' : 'border-emerald-300'}`}>
        <CardContent className="p-4">
          <div className="font-semibold text-sm mb-1">Health Advisory</div>
          <div className="text-sm text-muted-foreground">{level.description}</div>
          {aq.aqi > 100 && (
            <div className="mt-2 text-xs text-muted-foreground">
              🩺 Sensitive groups (children, elderly, respiratory conditions) should limit outdoor exposure.
            </div>
          )}
          {aq.aqi > 200 && (
            <div className="mt-1 text-xs text-red-600 font-medium">
              ⚠️ All residents should avoid prolonged outdoor activity.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
