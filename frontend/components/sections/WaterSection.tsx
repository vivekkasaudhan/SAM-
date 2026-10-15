'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { WaterLevelChart } from '@/components/charts/Charts';
import type { WaterLevelData } from '@/types/environment';

interface WaterSectionProps {
  waterLevel: WaterLevelData;
  lat: number;
  lon: number;
}

function LevelBar({ level, warning, danger }: { level: number; warning: number; danger: number }) {
  const maxDisplay = danger * 1.15;
  const levelPct = Math.min(100, (level / maxDisplay) * 100);
  const warnPct = (warning / maxDisplay) * 100;
  const dangerPct = (danger / maxDisplay) * 100;

  const barColor =
    level >= danger ? 'bg-red-500' :
    level >= warning ? 'bg-amber-500' :
    'bg-blue-500';

  return (
    <div className="relative py-4">
      {/* Track */}
      <div className="h-6 w-full bg-muted rounded-full overflow-hidden relative">
        {/* Normal zone */}
        <div className="absolute h-full bg-emerald-200 dark:bg-emerald-900/40" style={{ width: `${warnPct}%` }} />
        {/* Warning zone */}
        <div className="absolute h-full bg-amber-200 dark:bg-amber-900/40" style={{ left: `${warnPct}%`, width: `${dangerPct - warnPct}%` }} />
        {/* Danger zone */}
        <div className="absolute h-full bg-red-200 dark:bg-red-900/40" style={{ left: `${dangerPct}%`, right: 0 }} />
        {/* Level indicator */}
        <div
          className={`absolute h-full rounded-full transition-all duration-500 ${barColor} opacity-90`}
          style={{ width: `${levelPct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>0 m</span>
        <span className="text-amber-600 font-medium" style={{ marginLeft: `${warnPct - 5}%` }}>⚠ {warning.toFixed(1)}m</span>
        <span className="text-red-600 font-medium">🔴 {danger.toFixed(1)}m</span>
      </div>
    </div>
  );
}

export function WaterSection({ waterLevel: wl, lat, lon }: WaterSectionProps) {
  const status =
    wl.water_level >= wl.danger_level_m ? 'DANGER' :
    wl.water_level >= wl.warning_level_m ? 'WARNING' : 'NORMAL';

  const TrendIcon =
    wl.trend === 'RISING' ? TrendingUp :
    wl.trend === 'FALLING' ? TrendingDown : Minus;

  const trendColor =
    wl.trend === 'RISING' ? 'text-red-500' :
    wl.trend === 'FALLING' ? 'text-blue-500' : 'text-gray-400';

  const statusStyles: Record<string, string> = {
    NORMAL: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-400',
    WARNING: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 text-amber-700 dark:text-amber-400',
    DANGER: 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-700 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status !== 'NORMAL' && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${statusStyles[status]}`}>
          {status === 'DANGER' ? <AlertOctagon className="h-5 w-5 flex-shrink-0" /> : <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
          <div>
            <div className="font-bold text-sm">
              {status === 'DANGER' ? '⚠️ Water Level in DANGER Zone' : '⚠️ Water Level in WARNING Zone'}
            </div>
            <div className="text-xs opacity-80">
              Current level {wl.water_level.toFixed(2)} m — {status === 'DANGER' ? `Danger threshold exceeded by ${(wl.water_level - wl.danger_level_m).toFixed(2)}m` : `${(wl.warning_level_m - wl.water_level).toFixed(2)}m below danger threshold`}
            </div>
          </div>
        </div>
      )}

      {/* Current reading + source */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-end gap-3">
            <div className="text-6xl font-bold">{wl.water_level != null ? wl.water_level.toFixed(2) : '--'}<span className="text-2xl text-muted-foreground ml-1">m</span></div>
            <div className={`flex items-center gap-1 pb-2 ${trendColor}`}>
              <TrendIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">{wl.trend}</span>
            </div>
          </div>
          {typeof wl.change_1h_m === 'number' && (
            <div className="text-muted-foreground mt-1">
              <span className={wl.change_1h_m >= 0 ? 'text-red-500' : 'text-blue-500'}>
                {wl.change_1h_m >= 0 ? '+' : ''}{wl.change_1h_m.toFixed(3)} m
              </span>
              {' '}in the last hour
            </div>
          )}
        </div>
        <DataSourceBadge info={wl.data_source} />
      </div>

      {/* Level bar */}
      <LevelBar level={wl.water_level ?? 0} warning={wl.warning_level_m ?? 7.5} danger={wl.danger_level_m ?? 8.5} />

      {/* Thresholds */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <div className="text-xs text-muted-foreground">Current</div>
          <div className="text-xl font-bold text-blue-600">{wl.water_level != null ? wl.water_level.toFixed(2) : '--'} m</div>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-center border border-amber-200">
          <div className="text-xs text-amber-600">Warning Level</div>
          <div className="text-xl font-bold text-amber-600">{wl.warning_level_m != null ? wl.warning_level_m.toFixed(2) : '7.50'} m</div>
        </div>
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-center border border-red-200">
          <div className="text-xs text-red-600">Danger Level</div>
          <div className="text-xl font-bold text-red-600">{wl.danger_level_m != null ? wl.danger_level_m.toFixed(2) : '8.50'} m</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <div className="text-xs text-muted-foreground">Historical Max</div>
          <div className="text-xl font-bold">{wl.historical_max_m != null ? wl.historical_max_m.toFixed(2) : '--'} m</div>
        </div>
      </div>

      {typeof wl.flow_rate_cumecs === 'number' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>💧 Flow Rate:</span>
          <span className="font-semibold text-foreground">{wl.flow_rate_cumecs.toFixed(1)} m³/s (cumecs)</span>
        </div>
      )}

      {/* Time-series chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Water Level History & Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <WaterLevelChart
            lat={lat}
            lon={lon}
            warningLevel={wl.warning_level_m}
            dangerLevel={wl.danger_level_m}
          />
        </CardContent>
      </Card>
    </div>
  );
}
