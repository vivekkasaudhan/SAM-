'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  Calendar,
  CloudRain,
  Layers,
  CheckCircle2,
  Activity,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Gauge,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  wellService,
  GroundwaterForecastResponse,
  ForecastPoint,
  HistoricalAnalysisResponse,
} from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';

interface WellForecastViewProps {
  wellId: string;
  well: any;
  historicalReadings?: any[];
}

export function WellForecastView({
  wellId,
  well,
  historicalReadings = [],
}: WellForecastViewProps) {
  const [horizon, setHorizon] = useState<7 | 15>(7);
  const [historyContext, setHistoryContext] = useState<'recent' | '1y' | '2y' | '3y'>('recent');
  const [forecast, setForecast] = useState<GroundwaterForecastResponse | null>(null);
  const [contextReadings, setContextReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [contextLoading, setContextLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  // Fetch forecast data
  const fetchForecast = useCallback(async (h: 7 | 15) => {
    setLoading(true);
    setError(null);
    try {
      const data = await wellService.getWellForecast(wellId, {
        horizon: h,
        include_backtest: true,
      });
      setForecast(data);
    } catch (err: any) {
      console.error('Failed to load groundwater forecast:', err);
      setError(err?.response?.data?.detail || 'Failed to generate groundwater forecast.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  // Fetch historical context data when user toggles 1y / 2y / 3y
  useEffect(() => {
    if (historyContext === 'recent') {
      setContextReadings(historicalReadings);
      return;
    }

    let isMounted = true;
    setContextLoading(true);
    wellService
      .getWellHistoryAnalysis(wellId, { range: historyContext })
      .then((res: HistoricalAnalysisResponse) => {
        if (isMounted) {
          setContextReadings(res.readings || []);
        }
      })
      .catch((err) => {
        console.error(`Failed to load ${historyContext} history for forecast context:`, err);
        if (isMounted) {
          setContextReadings(historicalReadings);
        }
      })
      .finally(() => {
        if (isMounted) setContextLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [wellId, historyContext, historicalReadings]);

  useEffect(() => {
    fetchForecast(horizon);
  }, [fetchForecast, horizon]);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '--';
    try {
      return format(parseISO(ts.replace('Z', '')), 'MMM dd, yyyy HH:mm');
    } catch {
      return ts;
    }
  };

  const formatChartDate = (ts: string) => {
    try {
      const d = parseISO(ts.replace('Z', ''));
      if (historyContext === '1y' || historyContext === '2y' || historyContext === '3y') {
        return format(d, 'MMM yy');
      }
      return format(d, 'MMM dd');
    } catch {
      return ts;
    }
  };

  // Build combined chart dataset: historical context observations + future predictions
  const chartData = useMemo(() => {
    if (!forecast || forecast.status !== 'SUCCESS') return [];

    const combined: any[] = [];
    const obsList = contextReadings && contextReadings.length > 0 ? contextReadings : historicalReadings;

    // Filter historical points to avoid rendering millions of dots in multi-year view
    // If multi-year, pick every Nth sample or daily sample
    const maxHistSamples = historyContext === 'recent' ? 14 : 120;
    const step = Math.max(1, Math.floor(obsList.length / maxHistSamples));
    const sampledObs: any[] = [];

    for (let i = 0; i < obsList.length; i += step) {
      sampledObs.push(obsList[i]);
    }
    // Always include the absolute latest observation as the anchor
    if (obsList.length > 0 && sampledObs[sampledObs.length - 1] !== obsList[obsList.length - 1]) {
      sampledObs.push(obsList[obsList.length - 1]);
    }

    sampledObs.forEach((r: any) => {
      combined.push({
        timestamp: r.timestamp,
        dateLabel: formatChartDate(r.timestamp),
        observed_water_level: Number(r.water_level_m),
        predicted_water_level: null,
        confidence_lower: null,
        confidence_upper: null,
        is_prediction: false,
      });
    });

    // Bridge anchor point
    if (sampledObs.length > 0 && forecast.predictions.length > 0) {
      const lastObs = sampledObs[sampledObs.length - 1];
      combined[combined.length - 1].predicted_water_level = Number(lastObs.water_level_m);
      combined[combined.length - 1].confidence_lower = Number(lastObs.water_level_m);
      combined[combined.length - 1].confidence_upper = Number(lastObs.water_level_m);
    }

    // Add forecast predictions
    (forecast.predictions || []).forEach((p: ForecastPoint) => {
      combined.push({
        timestamp: p.timestamp,
        dateLabel: formatChartDate(p.timestamp),
        observed_water_level: null,
        predicted_water_level: Number(p.estimated_water_level_m),
        confidence_lower: Number(p.confidence_lower),
        confidence_upper: Number(p.confidence_upper),
        expected_rainfall_mm: p.expected_rainfall_mm,
        recharge_component_m: p.recharge_component_m,
        is_prediction: true,
      });
    });

    return combined;
  }, [forecast, contextReadings, historicalReadings, historyContext]);

  // Key summary values
  const latestObs = useMemo(() => {
    const list = historicalReadings.length > 0 ? historicalReadings : contextReadings;
    return list.length > 0 ? list[list.length - 1] : null;
  }, [historicalReadings, contextReadings]);

  const targetPrediction = useMemo(() => {
    if (!forecast?.predictions || forecast.predictions.length === 0) return null;
    return forecast.predictions[forecast.predictions.length - 1];
  }, [forecast]);

  const deltaMeters = useMemo(() => {
    if (!latestObs || !targetPrediction) return null;
    return Number(targetPrediction.estimated_water_level_m) - Number(latestObs.water_level_m);
  }, [latestObs, targetPrediction]);

  const warningThreshold = well?.warning_level_m || 7.5;
  const dangerThreshold = well?.danger_level_m || 8.5;

  // Threshold crossing risk assessment
  const thresholdAlert = useMemo(() => {
    if (!forecast?.predictions) return null;
    for (const p of forecast.predictions) {
      if (p.estimated_water_level_m >= dangerThreshold) {
        return {
          type: 'DANGER',
          message: `Projected to cross Danger threshold (${dangerThreshold}m) on ${formatChartDate(p.timestamp)}`,
          days: p.day_offset,
        };
      }
      if (p.estimated_water_level_m >= warningThreshold) {
        return {
          type: 'WARNING',
          message: `Projected to approach Warning threshold (${warningThreshold}m) on ${formatChartDate(p.timestamp)}`,
          days: p.day_offset,
        };
      }
    }
    return null;
  }, [forecast, dangerThreshold, warningThreshold]);

  if (loading && !forecast) {
    return (
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
        <h4 className="font-bold text-sm">Forecast Model Unavailable</h4>
        <p className="text-xs max-w-md mx-auto opacity-90">{error}</p>
        <button
          type="button"
          onClick={() => fetchForecast(horizon)}
          className="px-4 py-1.5 text-xs rounded-xl bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-all cursor-pointer"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  if (forecast?.status === 'INSUFFICIENT_DATA') {
    return (
      <div className="p-6 rounded-2xl bg-muted/20 dark:bg-navy-950/30 border border-border/70 dark:border-navy-800 space-y-4">
        <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <h4 className="font-bold text-sm text-foreground">
              Empirical Forecast Unavailable — Insufficient Telemetry History
            </h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-7">
            AquaSense Data Integrity Guarantee: We do not invent synthetic predictions when empirical observations are insufficient.
          </p>

          <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs font-mono space-y-1.5 text-foreground">
            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span className="font-semibold">{forecast.reason}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recorded Observations: </span>
              <strong>{forecast.data_freshness?.total_readings ?? 0} samples</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Required Baseline: </span>
              <span className="text-cyan-500 font-semibold">At least 5 readings spanning ≥ 24.0 hours</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isDemo = forecast?.is_demo;

  return (
    <div className="space-y-5">
      {/* ── Model Header & Controls Bar ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 dark:bg-navy-950/30 border border-border/70 dark:border-navy-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span>Groundwater Trajectory Estimation</span>
            </h3>

            {isDemo ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                <Sparkles className="h-3 w-3" />
                <span>DEMO FORECAST — BASED ON SIMULATED DATA</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <Activity className="h-3 w-3" />
                <span>PHYSICAL TELEMETRY MODEL</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Physics-informed hydrological trend with precipitation recharge and stratigraphy infiltration
          </p>
        </div>

        {/* Forecast Horizon Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setHorizon(7)}
              className={`px-3 py-1 rounded-lg transition-all ${
                horizon === 7
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setHorizon(15)}
              className={`px-3 py-1 rounded-lg transition-all ${
                horizon === 15
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              15 Days
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchForecast(horizon)}
            disabled={loading}
            className="p-2 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 cursor-pointer"
            title="Recalculate forecast"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-purple-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Summary Metric Cards Row (5 concise cards) ───────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Card 1: Latest Observed */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Latest Observed
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400">
              {latestObs?.water_level_m != null ? Number(latestObs.water_level_m).toFixed(2) : '--'}
            </span>
            <span className="text-xs text-muted-foreground">m</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
            {latestObs?.timestamp ? formatChartDate(latestObs.timestamp) : 'Recent'}
          </span>
        </div>

        {/* Card 2: Projected Level (+7d / +15d) */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {horizon}-Day Projection
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
              {targetPrediction ? Number(targetPrediction.estimated_water_level_m).toFixed(2) : '--'}
            </span>
            <span className="text-xs text-muted-foreground">m</span>
            {deltaMeters != null && (
              <span
                className={`ml-1 text-[11px] font-bold ${
                  deltaMeters > 0.05
                    ? 'text-rose-500'
                    : deltaMeters < -0.05
                    ? 'text-emerald-500'
                    : 'text-muted-foreground'
                }`}
              >
                {deltaMeters > 0 ? `+${deltaMeters.toFixed(2)}` : deltaMeters.toFixed(2)}m
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            CI: {targetPrediction?.confidence_lower?.toFixed(2)}m – {targetPrediction?.confidence_upper?.toFixed(2)}m
          </span>
        </div>

        {/* Card 3: Expected Trajectory */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Expected Trend
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {deltaMeters != null && deltaMeters > 0.05 ? (
              <>
                <TrendingUp className="h-5 w-5 text-rose-500" />
                <span className="text-sm font-bold text-rose-500">Rising Stage</span>
              </>
            ) : deltaMeters != null && deltaMeters < -0.05 ? (
              <>
                <TrendingDown className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-bold text-emerald-500">Receding</span>
              </>
            ) : (
              <>
                <Minus className="h-5 w-5 text-cyan-500" />
                <span className="text-sm font-bold text-cyan-500">Stable</span>
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {forecast?.environmental_drivers?.linear_trend_m_per_day != null
              ? `${(forecast.environmental_drivers.linear_trend_m_per_day * 100).toFixed(1)} cm/day rate`
              : 'Hydrogeological balance'}
          </span>
        </div>

        {/* Card 4: Threshold Risk Level */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Threshold Status
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {thresholdAlert?.type === 'DANGER' ? (
              <span className="text-sm font-black text-rose-500 flex items-center gap-1">
                <ShieldAlert className="h-4 w-4" /> Crossing Danger
              </span>
            ) : thresholdAlert?.type === 'WARNING' ? (
              <span className="text-sm font-bold text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Near Warning
              </span>
            ) : (
              <span className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Safe Range
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 truncate">
            Limit: {warningThreshold}m Warn / {dangerThreshold}m Danger
          </span>
        </div>

        {/* Card 5: Freshness & Samples (hidden on smallest screens, visible on lg) */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 col-span-2 sm:col-span-1 flex flex-col justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Model Baseline
          </span>
          <div className="text-sm font-bold text-foreground mt-1">
            {forecast?.data_freshness?.total_readings ?? 0} observations
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
            {forecast?.data_freshness?.data_span_days
              ? `${forecast.data_freshness.data_span_days} days empirical span`
              : `${forecast?.data_freshness?.data_span_hours?.toFixed(0) ?? 0}h span`}
          </span>
        </div>
      </div>

      {/* Threshold Alert Banner (if predicted crossing) */}
      {thresholdAlert && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            thresholdAlert.type === 'DANGER'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{thresholdAlert.message}</span>
          </div>
          <span className="text-[11px] font-bold underline cursor-pointer shrink-0">
            Recommended Action: Inspect Drainage / Sump Pumps
          </span>
        </div>
      )}

      {/* ── Forecast Visualization Chart ────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-card dark:bg-navy-900/70 border border-border/70 dark:border-navy-800 space-y-3">
        {/* Chart Subheader: Legend & Historical Context Range Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Series Legend */}
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="w-3 h-0.5 bg-cyan-500 inline-block rounded-full" />
              <span>Historical Observation</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="w-3 h-0.5 bg-purple-500 border-b border-dashed border-purple-500 inline-block" />
              <span>{horizon}-Day Projection</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="w-3 h-2 bg-purple-500/20 inline-block rounded-xs" />
              <span>95% Confidence Band</span>
            </span>
          </div>

          {/* Historical Context Toggle */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[11px] text-muted-foreground mr-1">Context:</span>
            {(['recent', '1y', '2y', '3y'] as const).map((rKey) => (
              <button
                key={rKey}
                type="button"
                onClick={() => setHistoryContext(rKey)}
                disabled={contextLoading}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  historyContext === rKey
                    ? 'bg-cyan-500 text-white'
                    : 'bg-muted/60 dark:bg-navy-950 text-muted-foreground hover:text-foreground'
                }`}
              >
                {rKey === 'recent' ? '14d' : rKey.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Recharts Chart Canvas */}
        <div className="h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="dateLabel"
                stroke="currentColor"
                opacity={0.6}
                fontSize={11}
                minTickGap={25}
              />
              <YAxis
                unit="m"
                domain={[0, Math.ceil(dangerThreshold * 1.25)]}
                stroke="currentColor"
                opacity={0.6}
                fontSize={11}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload;
                  return (
                    <div className="p-3 rounded-xl bg-card dark:bg-navy-900 border border-border shadow-xl text-xs font-mono space-y-1.5 min-w-[210px]">
                      <div className="font-bold text-foreground border-b border-border/50 pb-1">
                        {formatTimestamp(p.timestamp)}
                      </div>

                      {!p.is_prediction ? (
                        <div className="text-cyan-600 dark:text-cyan-400 font-bold flex justify-between">
                          <span>Observed Stage:</span>
                          <span>{Number(p.observed_water_level).toFixed(2)} m</span>
                        </div>
                      ) : (
                        <>
                          <div className="text-purple-600 dark:text-purple-400 font-bold flex justify-between">
                            <span>Projected Stage:</span>
                            <span>{Number(p.predicted_water_level).toFixed(2)} m</span>
                          </div>
                          <div className="text-muted-foreground flex justify-between text-[11px]">
                            <span>95% CI Range:</span>
                            <span className="font-semibold text-foreground">
                              {p.confidence_lower?.toFixed(2)}m – {p.confidence_upper?.toFixed(2)}m
                            </span>
                          </div>
                          {p.expected_rainfall_mm != null && (
                            <div className="text-blue-500 flex justify-between text-[11px]">
                              <span>Expected Rain:</span>
                              <span>{p.expected_rainfall_mm} mm</span>
                            </div>
                          )}
                          {p.recharge_component_m != null && p.recharge_component_m > 0 && (
                            <div className="text-teal-500 flex justify-between text-[11px]">
                              <span>Recharge Lift:</span>
                              <span>+{p.recharge_component_m} m</span>
                            </div>
                          )}
                        </>
                      )}

                      <div className="pt-1 border-t border-border/40 text-[10px] text-muted-foreground font-sans">
                        {!p.is_prediction ? 'Historical Observation' : 'Baseline Hydrological Model'}
                      </div>
                    </div>
                  );
                }}
              />

              {/* Warning Threshold */}
              <ReferenceLine
                y={warningThreshold}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: 'Warning', fill: '#f59e0b', fontSize: 10, position: 'top' }}
              />
              {/* Danger Threshold */}
              <ReferenceLine
                y={dangerThreshold}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{ value: 'Danger', fill: '#f43f5e', fontSize: 10, position: 'top' }}
              />

              {/* 95% Confidence Band */}
              <Area
                type="monotone"
                dataKey="confidence_upper"
                stroke="none"
                fill="url(#forecastBandGrad)"
                connectNulls={false}
              />

              {/* Historical Line (Solid Cyan) */}
              <Line
                type="monotone"
                dataKey="observed_water_level"
                stroke="#06b6d4"
                strokeWidth={2.2}
                dot={{ r: 2.5, fill: '#06b6d4' }}
                connectNulls={false}
              />

              {/* Forecast Prediction Line (Dashed Purple) */}
              <Line
                type="monotone"
                dataKey="predicted_water_level"
                stroke="#8b5cf6"
                strokeWidth={2.2}
                strokeDasharray="4 4"
                dot={{ r: 2.5, fill: '#8b5cf6' }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Forecast Insight & Subsurface Drivers ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Driver 1: Atmospheric Precipitation */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-500">
            <CloudRain className="h-3.5 w-3.5" />
            <span>Precipitation Recharge</span>
          </div>
          <div className="text-lg font-black text-foreground">
            {forecast?.environmental_drivers?.expected_rainfall_sum_mm ?? 0.0} mm
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {forecast?.environmental_drivers?.rainfall_forecast_source}
          </p>
        </div>

        {/* Driver 2: Lithological Permeability */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-500">
            <Layers className="h-3.5 w-3.5" />
            <span>Lithology Permeability</span>
          </div>
          <div className="text-lg font-black text-foreground flex items-baseline gap-1.5">
            <span>{forecast?.environmental_drivers?.lithology_conductivity_factor ?? 1.0}x</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({forecast?.environmental_drivers?.dominant_lithology})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Subsurface permeability factor applied to infiltration recharge
          </p>
        </div>

        {/* Driver 3: Suggested Operational Action */}
        <div className="p-3.5 rounded-xl bg-card dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-500">
            <Activity className="h-3.5 w-3.5" />
            <span>Recommended Action</span>
          </div>
          <div className="text-xs font-semibold text-foreground pt-0.5">
            {thresholdAlert?.type === 'DANGER'
              ? 'Schedule de-watering / inspect pump readiness'
              : thresholdAlert?.type === 'WARNING'
              ? 'Monitor 6-hour recharge telemetry cycles'
              : 'Maintain standard monitoring schedule'}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Automated environmental intelligence advisory
          </p>
        </div>
      </div>

      {/* ── Technical Details & Backtesting Accordion ───────────────── */}
      {forecast?.backtest && (
        <div className="p-4 rounded-xl bg-muted/20 dark:bg-navy-950/30 border border-border/60 dark:border-navy-800">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="w-full flex items-center justify-between text-xs font-bold text-foreground hover:text-cyan-500 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Model Verification & Chronological Backtesting</span>
              <span className="text-[10px] font-normal font-mono text-muted-foreground">
                (MAE: {forecast.backtest.mae?.toFixed(3)}m • RMSE: {forecast.backtest.rmse?.toFixed(3)}m)
              </span>
            </div>
            {showTechnicalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showTechnicalDetails && (
            <div className="pt-3 mt-3 border-t border-border/50 space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-lg bg-card dark:bg-navy-900 border border-border/60">
                  <div className="text-[10px] text-muted-foreground">MAE (Mean Absolute Error)</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {forecast.backtest.mae != null ? `${forecast.backtest.mae.toFixed(3)} m` : '--'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-card dark:bg-navy-900 border border-border/60">
                  <div className="text-[10px] text-muted-foreground">RMSE (Root Mean Square)</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {forecast.backtest.rmse != null ? `${forecast.backtest.rmse.toFixed(3)} m` : '--'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-card dark:bg-navy-900 border border-border/60">
                  <div className="text-[10px] text-muted-foreground">Holdout Test Samples</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {forecast.backtest.test_samples} points
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-card dark:bg-navy-900 border border-border/60">
                  <div className="text-[10px] text-muted-foreground">Training Horizon</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 font-mono">
                    {forecast.backtest.train_samples} points
                  </div>
                </div>
              </div>

              {/* Scientific Limitations */}
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span>Model Assumptions & Constraints</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {(forecast.backtest.limitations || []).map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
