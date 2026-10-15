'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
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
  HelpCircle,
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
  Legend,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { wellService, GroundwaterForecastResponse, ForecastPoint } from '@/services/api';
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
  const [forecast, setForecast] = useState<GroundwaterForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showBacktestDetails, setShowBacktestDetails] = useState<boolean>(false);

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
      return format(parseISO(ts.replace('Z', '')), 'MMM dd');
    } catch {
      return ts;
    }
  };

  // Build combined chart dataset: recent observations + future predictions
  const chartData = React.useMemo(() => {
    if (!forecast || forecast.status !== 'SUCCESS') return [];

    const combined: any[] = [];

    // Add up to 10 latest historical observations (solid line)
    const recentObs = (historicalReadings || []).slice(-10);
    recentObs.forEach((r: any) => {
      combined.push({
        timestamp: r.timestamp,
        dateLabel: formatChartDate(r.timestamp),
        observed_water_level: Number(r.water_level_m),
        predicted_water_level: null,
        confidence_lower: null,
        confidence_upper: null,
        uncertainty_range: null,
        is_prediction: false,
      });
    });

    // Bridge the gap: make the last observation the starting point for prediction line
    if (recentObs.length > 0 && forecast.predictions.length > 0) {
      const lastObs = recentObs[recentObs.length - 1];
      // Attach prediction value to the anchor point so line is continuous
      combined[combined.length - 1].predicted_water_level = Number(lastObs.water_level_m);
      combined[combined.length - 1].confidence_lower = Number(lastObs.water_level_m);
      combined[combined.length - 1].confidence_upper = Number(lastObs.water_level_m);
    }

    // Add forecast predictions (dashed line + uncertainty band)
    (forecast.predictions || []).forEach((p: ForecastPoint) => {
      combined.push({
        timestamp: p.timestamp,
        dateLabel: formatChartDate(p.timestamp),
        observed_water_level: null,
        predicted_water_level: Number(p.estimated_water_level_m),
        confidence_lower: Number(p.confidence_lower),
        confidence_upper: Number(p.confidence_upper),
        // Difference for stacked area or range
        uncertainty_range: [Number(p.confidence_lower), Number(p.confidence_upper)],
        expected_rainfall_mm: p.expected_rainfall_mm,
        trend_component_m: p.trend_component_m,
        recharge_component_m: p.recharge_component_m,
        is_prediction: true,
      });
    });

    return combined;
  }, [forecast, historicalReadings]);

  if (loading && !forecast) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-3xl bg-destructive/10 border border-destructive/30 text-destructive text-center space-y-3">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
        <h4 className="font-bold text-sm">Forecast Model Error</h4>
        <p className="text-xs max-w-md mx-auto opacity-90">{error}</p>
        <button
          onClick={() => fetchForecast(horizon)}
          className="px-4 py-1.5 text-xs rounded-xl bg-destructive text-destructive-foreground font-semibold hover:opacity-90 transition-all"
        >
          Retry Forecast
        </button>
      </div>
    );
  }

  // Handle Insufficient Data Gracefully (No Fake Predictions)
  if (forecast?.status === 'INSUFFICIENT_DATA') {
    return (
      <div className="p-6 rounded-3xl bg-muted/20 dark:bg-navy-950/30 border border-border/60 dark:border-navy-800 space-y-6">
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">
                Empirical Forecast Unavailable — Insufficient Telemetry History
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                AquaSense Data Integrity Guarantee: We do not invent synthetic predictions when empirical observations are insufficient.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs space-y-2 text-foreground font-mono">
            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span className="font-semibold">{forecast.reason}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recorded Observations: </span>
              <span className="font-bold">{forecast.data_freshness?.total_readings ?? 0} samples</span>
            </div>
            <div>
              <span className="text-muted-foreground">Observed Span: </span>
              <span className="font-bold">{forecast.data_freshness?.data_span_hours ?? 0} hours</span>
            </div>
            <div>
              <span className="text-muted-foreground">Required Baseline: </span>
              <span className="text-cyan-500 font-bold">At least 5 readings spanning ≥ 24.0 hours</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            As the background simulation engine or physical IoT sensor records more telemetry cycles into the database, this station will automatically qualify for baseline forecasting and backtesting.
          </p>
        </div>
      </div>
    );
  }

  const isDemo = forecast?.is_demo;

  return (
    <div className="space-y-6">
      {/* ── Header: Model Status & Provenance Banner ───────────────────── */}
      <div className="p-6 rounded-3xl bg-muted/20 dark:bg-navy-950/30 border border-border/60 dark:border-navy-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isDemo
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                {isDemo ? 'Demo / Synthetic Telemetry Forecast' : 'Physical Sensor Telemetry Forecast'}
              </span>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground">
                Model: {forecast?.model_name} (v{forecast?.model_version})
              </span>
            </div>

            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span>Groundwater Level Trajectory Estimation</span>
            </h3>

            <p className="text-xs text-muted-foreground">
              {forecast?.disclaimer}
            </p>
          </div>

          {/* Horizon Controls & Refresh */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <div className="flex items-center p-1 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setHorizon(7)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  horizon === 7
                    ? 'bg-purple-500 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setHorizon(15)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  horizon === 15
                    ? 'bg-purple-500 text-white shadow-xs'
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
              className="p-2 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-50"
              title="Recalculate Forecast"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-purple-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Main Forecast Visualization Chart ──────────────────────── */}
        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-cyan-500 inline-block rounded-full" />
                <span className="text-[11px] font-medium text-foreground">Recent Observed Stage</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-purple-500 border-b border-dashed border-purple-500 inline-block" />
                <span className="text-[11px] font-medium text-foreground">Estimated Future Level</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-purple-500/20 inline-block rounded-xs" />
                <span className="text-[11px] font-medium text-foreground">95% Confidence Band</span>
              </span>
            </div>

            <span className="text-[11px] font-mono text-muted-foreground">
              Generated: {formatTimestamp(forecast?.generated_at)}
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastUncertaintyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="currentColor"
                  opacity={0.6}
                  fontSize={11}
                  minTickGap={20}
                />
                <YAxis
                  unit="m"
                  domain={[0, Math.ceil((well.danger_level_m || 8.5) * 1.25)]}
                  stroke="currentColor"
                  opacity={0.6}
                  fontSize={11}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload;
                    return (
                      <div className="p-3 rounded-2xl bg-card border border-border shadow-2xl text-xs font-mono space-y-1.5 min-w-[220px]">
                        <div className="font-bold text-foreground border-b border-border/60 pb-1">
                          {formatTimestamp(p.timestamp)}
                        </div>

                        {!p.is_prediction ? (
                          <div className="text-cyan-500 font-bold flex justify-between">
                            <span>Observed Stage:</span>
                            <span>{Number(p.observed_water_level).toFixed(2)} m</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-purple-500 font-bold flex justify-between">
                              <span>Estimated Stage:</span>
                              <span>{Number(p.predicted_water_level).toFixed(2)} m</span>
                            </div>
                            <div className="text-muted-foreground flex justify-between text-[11px]">
                              <span>95% Confidence:</span>
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
                                <span>Rain Recharge:</span>
                                <span>+{p.recharge_component_m} m</span>
                              </div>
                            )}
                          </>
                        )}

                        <div className="pt-1 border-t border-border/40">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold ${
                              !p.is_prediction
                                ? 'bg-cyan-500/10 text-cyan-500'
                                : 'bg-purple-500/10 text-purple-500'
                            }`}
                          >
                            {!p.is_prediction ? 'Historical Observation' : 'Baseline Model Prediction'}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Warning & Danger Thresholds */}
                <ReferenceLine
                  y={well.warning_level_m || 7.5}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Warning', fill: '#f59e0b', fontSize: 10, position: 'top' }}
                />
                <ReferenceLine
                  y={well.danger_level_m || 8.5}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: 'Danger', fill: '#f43f5e', fontSize: 10, position: 'top' }}
                />

                {/* Shaded 95% Confidence Interval Band */}
                <Area
                  type="monotone"
                  dataKey="confidence_upper"
                  stroke="none"
                  fill="url(#forecastUncertaintyGrad)"
                  connectNulls={false}
                />

                {/* Historical Observed Water Level (Solid Cyan) */}
                <Line
                  type="monotone"
                  dataKey="observed_water_level"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06b6d4' }}
                  connectNulls={false}
                />

                {/* Forecast Predicted Level (Dashed Purple) */}
                <Line
                  type="monotone"
                  dataKey="predicted_water_level"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#8b5cf6' }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Environmental Drivers & Subsurface Stratigraphy Cards ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Driver 1: Atmospheric Precipitation */}
        <div className="p-4 rounded-2xl bg-card dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-500">
            <CloudRain className="h-4 w-4" />
            <span>Atmospheric Recharge Driver</span>
          </div>
          <div className="text-xl font-black text-foreground">
            {forecast?.environmental_drivers?.expected_rainfall_sum_mm ?? 0.0} mm
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cumulative forecast precipitation over the {horizon}-day horizon ({forecast?.environmental_drivers?.rainfall_forecast_source}).
          </p>
        </div>

        {/* Driver 2: Lithological Permeability */}
        <div className="p-4 rounded-2xl bg-card dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-teal-500">
            <Layers className="h-4 w-4" />
            <span>Lithology Permeability Factor</span>
          </div>
          <div className="text-xl font-black text-foreground flex items-baseline gap-2">
            <span>{forecast?.environmental_drivers?.lithology_conductivity_factor ?? 1.0}x</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({forecast?.environmental_drivers?.dominant_lithology})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Infiltration rate scaled from subsurface stratigraphy logging. High permeability speeds infiltration response.
          </p>
        </div>

        {/* Driver 3: Hydrogeological Baseline Trend */}
        <div className="p-4 rounded-2xl bg-card dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-500">
            <Activity className="h-4 w-4" />
            <span>Baseline Trend & Recession</span>
          </div>
          <div className="text-xl font-black text-foreground">
            {forecast?.environmental_drivers?.linear_trend_m_per_day
              ? `${(forecast.environmental_drivers.linear_trend_m_per_day * 100).toFixed(2)} cm/day`
              : '0.00 cm/day'}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Unconfined head regression rate toward baseline level ({forecast?.environmental_drivers?.baseline_water_level_m}m).
          </p>
        </div>
      </div>

      {/* ── Chronological Backtesting & Quality Verification ──────────── */}
      {forecast?.backtest && (
        <div className="p-6 rounded-3xl bg-muted/20 dark:bg-navy-950/30 border border-border/60 dark:border-navy-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-sm text-foreground">
                  Chronological Backtesting Validation (Zero Data Leakage)
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Trained strictly on earlier observations; evaluated on holdout test window without lookahead bias.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowBacktestDetails(!showBacktestDetails)}
              className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>{showBacktestDetails ? 'Hide' : 'View'} Limitations & Metrics</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/60">
              <div className="text-[11px] text-muted-foreground">MAE (Mean Abs Error)</div>
              <div className="text-lg font-black text-foreground mt-0.5">
                {forecast.backtest.mae != null ? `${forecast.backtest.mae.toFixed(3)} m` : '--'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/60">
              <div className="text-[11px] text-muted-foreground">RMSE (Root Mean Sq)</div>
              <div className="text-lg font-black text-foreground mt-0.5">
                {forecast.backtest.rmse != null ? `${forecast.backtest.rmse.toFixed(3)} m` : '--'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/60">
              <div className="text-[11px] text-muted-foreground">Evaluation Samples</div>
              <div className="text-lg font-black text-foreground mt-0.5 font-mono">
                {forecast.backtest.test_samples} points
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/60">
              <div className="text-[11px] text-muted-foreground">Training Samples</div>
              <div className="text-lg font-black text-foreground mt-0.5 font-mono">
                {forecast.backtest.train_samples} points
              </div>
            </div>
          </div>

          {/* Model Limitations & Disclosures */}
          {showBacktestDetails && (
            <div className="p-4 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 space-y-2 text-xs">
              <div className="font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Empirical Model Assumptions & Limitations</span>
              </div>
              <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-5">
                {(forecast.backtest.limitations || []).map((lim, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {lim}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
