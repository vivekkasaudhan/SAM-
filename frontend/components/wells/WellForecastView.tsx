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
  Play,
  Pause,
  RotateCcw,
  Waves,
} from 'lucide-react';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';
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
  const [activeForecastDay, setActiveForecastDay] = useState<number>(0);
  const [isPlayingTrajectory, setIsPlayingTrajectory] = useState<boolean>(false);

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

  // Fetch historical context data when user toggles recent / 1y / 2y / 3y
  useEffect(() => {
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
          setContextReadings(historicalReadings || []);
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

  // Trajectory playback animation effect
  useEffect(() => {
    if (!isPlayingTrajectory) return;
    const interval = setInterval(() => {
      setActiveForecastDay((prev) => {
        if (prev >= horizon) {
          setIsPlayingTrajectory(false);
          return 0;
        }
        return prev + 1;
      });
    }, 1100);
    return () => clearInterval(interval);
  }, [isPlayingTrajectory, horizon]);

  const activeLevel = useMemo(() => {
    if (activeForecastDay === 0) {
      return latestObs?.water_level_m ?? 0;
    }
    const pred = forecast?.predictions?.[activeForecastDay - 1];
    return pred ? pred.estimated_water_level_m : (latestObs?.water_level_m ?? 0);
  }, [activeForecastDay, latestObs, forecast]);

  const activePredPoint = useMemo(() => {
    if (activeForecastDay === 0) return null;
    return forecast?.predictions?.[activeForecastDay - 1] ?? null;
  }, [activeForecastDay, forecast]);

  // Custom dot renderer for historical observations (crisp cyan points)
  const renderObservedDot = useCallback((props: any) => {
    const { cx, cy, payload, index } = props;
    if (payload?.observed_water_level == null) {
      return <g key={`obs-empty-${index}`} />;
    }
    return (
      <circle
        key={`obs-dot-${index}`}
        cx={cx}
        cy={cy}
        r={3}
        fill="#06b6d4"
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  }, []);

  // Custom dot renderer for forecast with pulsating radar ripple ring at Day 0 transition point
  const renderForecastDot = useCallback((props: any) => {
    const { cx, cy, payload, index } = props;
    if (payload?.predicted_water_level == null) {
      return <g key={`fc-empty-${index}`} />;
    }
    const isAnchor = !payload.is_prediction && payload.predicted_water_level != null;
    if (isAnchor) {
      return (
        <g key={`anchor-dot-${index}`}>
          <circle cx={cx} cy={cy} r={14} fill="none" stroke="#a855f7" strokeWidth={1.8} opacity={0.7}>
            <animate attributeName="r" values="4;18" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r={5.5} fill="#a855f7" stroke="#ffffff" strokeWidth={2} />
        </g>
      );
    }
    return (
      <circle
        key={`forecast-dot-${index}`}
        cx={cx}
        cy={cy}
        r={2.5}
        fill="#a855f7"
        stroke="#ffffff"
        strokeWidth={1.2}
      />
    );
  }, []);

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

      {/* ── Dynamic Animated Forecast Water Level Simulator ── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-blue-500/10 border border-purple-500/30 dark:border-purple-500/25 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <Waves className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                <span>Animated Groundwater Level Projection Simulator</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping" />
                  HIGH-SPEED FLOW ACTIVE
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Watch the aquifer column dynamically adapt and animate its water stage across the {horizon}-day forecast trajectory.
              </p>
            </div>
          </div>

          {/* Timeline Playback Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsPlayingTrajectory(!isPlayingTrajectory)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-all cursor-pointer"
            >
              {isPlayingTrajectory ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Play Trajectory</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlayingTrajectory(false);
                setActiveForecastDay(0);
              }}
              className="p-1.5 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Reset to Day 0 (Current Observation)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic Simulator Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-1">
          {/* Left Column: Animated Water Level Column Tube */}
          <div className="md:col-span-4 flex items-center justify-center p-3 rounded-2xl bg-card/60 dark:bg-navy-900/60 border border-border/50">
            <div className="flex flex-col items-center gap-2">
              <WellWaterLevel
                waterLevel={activeLevel}
                warningLevel={warningThreshold}
                dangerLevel={dangerThreshold}
                height={170}
                compact={false}
                showTicks={true}
                flowSpeed="fast"
                animateForecast={true}
                wellName={well?.name}
              />
              <span className="text-[11px] font-mono font-bold text-foreground">
                {activeForecastDay === 0 ? 'Current Observation' : `Forecast Day +${activeForecastDay}`}
              </span>
            </div>
          </div>

          {/* Right Column: Timeline Scrubber & Metrics */}
          <div className="md:col-span-8 space-y-3">
            {/* Day Selector Buttons */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-muted-foreground flex items-center justify-between">
                <span>Select Timeline Horizon Day:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">
                  {activeForecastDay === 0
                    ? 'Day 0 (Latest Recorded)'
                    : `Day +${activeForecastDay} (${activePredPoint?.timestamp ? formatChartDate(activePredPoint.timestamp) : ''})`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlayingTrajectory(false);
                    setActiveForecastDay(0);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    activeForecastDay === 0
                      ? 'bg-cyan-500 text-white shadow-xs'
                      : 'bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Now
                </button>
                {Array.from({ length: horizon }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setIsPlayingTrajectory(false);
                      setActiveForecastDay(day);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                      activeForecastDay === day
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    +{day}d
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Stage Readout Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div className="p-2.5 rounded-xl bg-card dark:bg-navy-900 border border-border/60">
                <span className="text-[10px] text-muted-foreground">Simulated Water Stage</span>
                <div className="text-base font-black font-mono text-foreground mt-0.5">
                  {Number(activeLevel).toFixed(2)} m
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-card dark:bg-navy-900 border border-border/60">
                <span className="text-[10px] text-muted-foreground">Trajectory Delta</span>
                <div className="text-base font-black font-mono mt-0.5">
                  {activeForecastDay === 0 ? (
                    <span className="text-muted-foreground">Baseline</span>
                  ) : (
                    <span
                      className={
                        Number(activeLevel) - Number(latestObs?.water_level_m || 0) > 0.05
                          ? 'text-rose-500'
                          : Number(activeLevel) - Number(latestObs?.water_level_m || 0) < -0.05
                          ? 'text-emerald-500'
                          : 'text-cyan-500'
                      }
                    >
                      {Number(activeLevel) - Number(latestObs?.water_level_m || 0) > 0 ? '+' : ''}
                      {(Number(activeLevel) - Number(latestObs?.water_level_m || 0)).toFixed(2)} m
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-card dark:bg-navy-900 border border-border/60 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground">Risk Status</span>
                <div className="text-xs font-bold mt-1">
                  {activeLevel >= dangerThreshold ? (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold border border-rose-500/30">
                      CRITICAL DANGER
                    </span>
                  ) : activeLevel >= warningThreshold ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold border border-amber-500/30">
                      WARNING STAGE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/30">
                      SAFE / NORMAL
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Forecast Visualization Chart ────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-card dark:bg-navy-900/70 border border-border/70 dark:border-navy-800 space-y-3">
        {/* Chart Subheader: Legend & Historical Context Range Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Series Legend & Dynamic Animation Status */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400">
              <span className="w-3.5 h-0.5 bg-cyan-500 inline-block rounded-full shadow-xs" />
              <span>Historical Observation</span>
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
              <span className="w-3.5 h-0.5 bg-purple-500 border-b-2 border-dashed border-purple-500 inline-block animate-pulse" />
              <span>{horizon}-Day Projection (Flowing Stream)</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <span className="w-3 h-2 bg-purple-500/25 inline-block rounded-xs" />
              <span>95% Confidence Band</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-sans text-[11px] font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              🌊 Moving Water Wave ("Lahr") Active
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
                    ? 'bg-cyan-500 text-white shadow-xs'
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
                {/* Fluid gradient across forecast water body */}
                <linearGradient id="forecastWaterSurfaceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35}>
                    <animate attributeName="stopColor" values="#8b5cf6;#a855f7;#6366f1;#06b6d4;#8b5cf6" dur="6s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="50%" stopColor="#a855f7" stopOpacity={0.16}>
                    <animate attributeName="offset" values="35%;65%;35%" dur="4s" repeatCount="indefinite" />
                  </stop>
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
                </linearGradient>

                {/* Seamless wide-format continuous rolling water waves (width=600, height=350: NO vertical cutoffs or tile blocks) */}
                <pattern id="forecastWaterWaveStream" width="600" height="350" patternUnits="userSpaceOnUse">
                  {/* Primary rolling crest wave */}
                  <path d="M 0 18 Q 150 4, 300 18 T 600 18 L 600 350 L 0 350 Z" fill="rgba(168, 85, 247, 0.08)">
                    <animateTransform attributeName="transform" type="translate" from="0,0" to="-300,0" dur="3s" repeatCount="indefinite" />
                  </path>
                  <path d="M 0 18 Q 150 4, 300 18 T 600 18" fill="none" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="2">
                    <animateTransform attributeName="transform" type="translate" from="0,0" to="-300,0" dur="3s" repeatCount="indefinite" />
                  </path>
                  {/* Secondary counter-moving ripple */}
                  <path d="M 0 40 Q 150 26, 300 40 T 600 40" fill="none" stroke="rgba(192, 132, 252, 0.35)" strokeWidth="1.5">
                    <animateTransform attributeName="transform" type="translate" from="-300,0" to="0,0" dur="4s" repeatCount="indefinite" />
                  </path>
                  {/* Gentle water current streaks */}
                  <path d="M 0 70 Q 150 58, 300 70 T 600 70" fill="none" stroke="rgba(139, 92, 246, 0.25)" strokeWidth="1.2">
                    <animateTransform attributeName="transform" type="translate" from="0,0" to="-300,0" dur="2.4s" repeatCount="indefinite" />
                  </path>
                  {/* Aeration micro-bubbles rising */}
                  <circle cx="90" cy="120" r="1.8" fill="rgba(255, 255, 255, 0.65)">
                    <animate attributeName="cy" values="180;20" dur="2.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;0.9;0" dur="2.2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="340" cy="140" r="2.2" fill="rgba(216, 180, 254, 0.7)">
                    <animate attributeName="cy" values="200;25" dur="2.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;0.8;0" dur="2.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="510" cy="100" r="1.5" fill="rgba(168, 85, 247, 0.8)">
                    <animate attributeName="cy" values="160;18" dur="1.9s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0;0.85;0" dur="1.9s" repeatCount="indefinite" />
                  </circle>
                </pattern>
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

              {/* 95% Confidence Band: Clean flowing water surface with seamless rolling waves */}
              <Area
                type="monotone"
                dataKey="confidence_upper"
                stroke="none"
                fill="url(#forecastWaterSurfaceGrad)"
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="confidence_upper"
                stroke="none"
                fill="url(#forecastWaterWaveStream)"
                fillOpacity={1}
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* Soft upper & lower CI boundary dashed indicator guides */}
              <Line
                type="monotone"
                dataKey="confidence_upper"
                stroke="rgba(168, 85, 247, 0.45)"
                strokeDasharray="3 3"
                strokeWidth={1.2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="confidence_lower"
                stroke="rgba(168, 85, 247, 0.35)"
                strokeDasharray="3 3"
                strokeWidth={1.2}
                dot={false}
                connectNulls={false}
              />

              {/* Historical Telemetry Line (Solid Cyan with crisp dots) */}
              <Line
                type="monotone"
                dataKey="observed_water_level"
                stroke="#06b6d4"
                strokeWidth={2.5}
                dot={renderObservedDot}
                activeDot={{ r: 5, fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Forecast Prediction Stream (Continuously Animated Flowing Dashes into the Future) */}
              <Line
                type="monotone"
                dataKey="predicted_water_level"
                className="forecast-flowing-stream"
                stroke="#8b5cf6"
                strokeWidth={2.8}
                dot={renderForecastDot}
                activeDot={{ r: 6, fill: '#a855f7', stroke: '#ffffff', strokeWidth: 2 }}
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
