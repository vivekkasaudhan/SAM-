'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  MapPin,
  Cpu,
  Clock,
  Radio,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Calendar,
  Layers,
  Thermometer,
  CloudSun,
  Wind,
  ShieldAlert,
  Droplet,
  Info,
  Waves,
  LineChart as LineChartIcon,
  User,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import {
  wellService,
  alertService,
  authService,
  isSubadmin,
  HistoricalAnalysisResponse,
  Alert,
} from '@/services/api';
import { WellWaterLevel } from '@/components/visualization/WellWaterLevel';
import { LithologySection } from '@/components/lithology/LithologySection';
import { WellForecastView } from './WellForecastView';
import { Skeleton } from '@/components/ui/skeleton';

export type HistoryRange = 'recent' | '1y' | '2y' | '3y' | 'custom';

interface WellDetailsModalProps {
  wellId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectOnMap?: (lat: number, lon: number, name: string) => void;
}

export function WellDetailsModal({
  wellId,
  isOpen,
  onClose,
  onSelectOnMap,
}: WellDetailsModalProps) {
  const [well, setWell] = useState<any | null>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainModalTab, setMainModalTab] = useState<'telemetry' | 'lithology' | 'forecast'>('telemetry');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'water-level' | 'water-quality'>('water-level');

  // Task 2: Historical Water-Level Analysis state
  const [historyRange, setHistoryRange] = useState<HistoryRange>('recent');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [historyAnalysis, setHistoryAnalysis] = useState<HistoricalAnalysisResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  const handleAcknowledgeAlert = async (alertId: number) => {
    setAcknowledgingId(alertId);
    try {
      await alertService.acknowledgeAlert(alertId);
      if (well) {
        setWell({
          ...well,
          active_alerts: (well.active_alerts || []).filter((a: any) => a.id !== alertId),
        });
      }
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const fetchHistoryAnalysis = useCallback(
    async (id: string, range: HistoryRange, start?: string, end?: string) => {
      setHistoryLoading(true);
      try {
        const analysis = await wellService.getWellHistoryAnalysis(id, {
          range,
          start_date: range === 'custom' && start ? new Date(start).toISOString() : undefined,
          end_date: range === 'custom' && end ? new Date(end).toISOString() : undefined,
        });
        setHistoryAnalysis(analysis);
        const sorted = (analysis.readings || []).slice().sort((a: any, b: any) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
        setReadings(sorted);
      } catch (err: any) {
        console.error('Failed to load historical analysis:', err);
      } finally {
        setHistoryLoading(false);
      }
    },
    []
  );

  const fetchWellData = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const wellData = await wellService.getWell(id);
        setWell(wellData);
        await fetchHistoryAnalysis(id, historyRange, customStartDate, customEndDate);
      } catch (err: any) {
        console.error('Failed to load well details:', err);
        setError(err?.response?.data?.detail || 'Failed to retrieve well telemetry details.');
      } finally {
        setLoading(false);
      }
    },
    [fetchHistoryAnalysis, historyRange, customStartDate, customEndDate]
  );

  const handleRangeChange = (newRange: HistoryRange) => {
    setHistoryRange(newRange);
    if (well?.id) {
      fetchHistoryAnalysis(well.id, newRange, customStartDate, customEndDate);
    }
  };

  const handleApplyCustomDate = () => {
    if (well?.id && customStartDate && customEndDate) {
      fetchHistoryAnalysis(well.id, 'custom', customStartDate, customEndDate);
    }
  };

  useEffect(() => {
    if (isOpen && wellId) {
      setMainModalTab('telemetry');
      fetchWellData(wellId);
    } else {
      setWell(null);
      setReadings([]);
      setHistoryAnalysis(null);
      setHistoryRange('recent');
    }
  }, [isOpen, wellId, fetchWellData]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentUser = React.useMemo(() => {
    return authService.getCurrentUser();
  }, []);

  const isReadOnlyForUser = Boolean(
    currentUser &&
    isSubadmin(currentUser) &&
    well?.created_by != null &&
    String(well.created_by) !== String(currentUser.id)
  );

  if (!isOpen) return null;

  const reading = well?.latest_reading;
  const activeSensors = (well?.sensors || []).filter((s: any) => s.is_active !== false);
  const readingStatus = reading?.status || 'SIMULATED';

  // Construct location breadcrumbs
  const breadcrumbs = well
    ? [well.country || 'India', well.state, well.district, well.city].filter(Boolean)
    : [];

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '--';
    try {
      return format(parseISO(ts.replace('Z', '')), 'MMM dd, yyyy HH:mm:ss');
    } catch {
      return ts;
    }
  };

  const formatTickTime = (ts: string) => {
    try {
      const d = parseISO(ts.replace('Z', ''));
      if (historyRange === 'recent') return format(d, 'HH:mm');
      if (historyRange === '1y') return format(d, 'MMM dd');
      if (historyRange === '2y' || historyRange === '3y') return format(d, 'MMM yyyy');
      return format(d, 'MMM dd, yy');
    } catch {
      return ts;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/70 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="well-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-2xl overflow-hidden">
        {/* ── Modal Header ────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-border/60 dark:border-navy-800 bg-muted/20 dark:bg-navy-950/40">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono font-bold px-2 py-0.5 rounded bg-muted dark:bg-navy-950 text-foreground border border-border/60">
                {well?.id || wellId}
              </span>
              <span>•</span>
              <span className="font-medium text-foreground/80">{breadcrumbs.join(' › ')}</span>
              {/* Creator Metadata */}
              {well?.creator && (
                <>
                  <span>•</span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-semibold"
                    title={`Created by ${well.creator.name || well.creator.username} (${well.creator.email || ''})`}
                  >
                    <User className="h-2.5 w-2.5" />
                    <span>Owner: {well.creator.name || well.creator.username}</span>
                    {well.creator.email && (
                      <span className="font-mono opacity-80">({well.creator.email})</span>
                    )}
                  </span>
                </>
              )}
              {/* Read-Only Status Indicator */}
              {isReadOnlyForUser && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/30 text-[10px] font-bold">
                  Read-only Station
                </span>
              )}
            </div>

            <h2
              id="well-detail-title"
              className="text-xl sm:text-2xl font-black tracking-tight text-foreground"
            >
              {well?.name || 'Loading Well Details...'}
            </h2>

            {well?.location_description && (
              <p className="text-xs text-muted-foreground italic">{well.location_description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => wellId && fetchWellData(wellId)}
              disabled={loading}
              className="p-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="Close Dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── High-Level Navigation Tabs ─────────────────────────── */}
        <div className="flex items-center gap-2 px-6 pt-2 border-b border-border/60 bg-muted/10 dark:bg-navy-950/20 text-xs font-bold shrink-0">
          <button
            onClick={() => setMainModalTab('telemetry')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              mainModalTab === 'telemetry'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Waves className="h-4 w-4" />
            <span>Hydrological Telemetry & Trends</span>
            {well?.active_alerts != null && well.active_alerts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-600 dark:text-rose-400 font-mono font-bold flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                {well.active_alerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainModalTab('lithology')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              mainModalTab === 'lithology'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Subsurface Lithology & Stratigraphy</span>
            {well?.lithology_count != null && well.lithology_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono">
                {well.lithology_count}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainModalTab('forecast')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
              mainModalTab === 'forecast'
                ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <span>Groundwater Level Forecasting</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-400 font-mono">
              7–15d
            </span>
          </button>
        </div>

        {/* ── Modal Scrollable Body ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !well ? (
            <div className="space-y-6 animate-pulse">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-72 w-full rounded-2xl" />
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-center space-y-3">
              <AlertOctagon className="h-10 w-10 mx-auto text-destructive" />
              <div className="font-bold text-base">Telemetry Offline or Unavailable</div>
              <div className="text-xs opacity-90 max-w-md mx-auto">{error}</div>
            </div>
          ) : (
            well && (
              mainModalTab === 'telemetry' ? (
                <>
                  {/* ── Active Early-Warning Alerts & Anomaly Section ── */}
                  {well.active_alerts && well.active_alerts.length > 0 && (
                    <div className="p-5 rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-800 shadow-md space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-500">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                              <span>Active Early-Warning & Risk Alerts</span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                                {well.active_alerts.length} Active
                              </span>
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                              Automated anomaly detection across telemetry freshness, physical thresholds, and predictive trajectories
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 pt-1">
                        {well.active_alerts.map((alert: any) => {
                          const isCritical = alert.severity === 'CRITICAL';
                          const isWarning = alert.severity === 'WARNING';
                          const borderClass = isCritical
                            ? 'border-rose-500/40 bg-rose-500/5'
                            : isWarning
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'border-cyan-500/40 bg-cyan-500/5';
                          const badgeClass = isCritical
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : isWarning
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';

                          return (
                            <div
                              key={alert.id}
                              className={`p-4 rounded-2xl border ${borderClass} space-y-2.5 transition-all`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeClass}`}>
                                    {alert.severity}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    alert.is_forecast
                                      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                      : 'bg-muted/80 text-foreground border-border/60'
                                  }`}>
                                    {alert.is_forecast ? `PREDICTIVE FORECAST (+${alert.forecast_horizon_days}d)` : 'OBSERVED TELEMETRY'}
                                  </span>
                                  <strong className="text-xs font-bold text-foreground">
                                    {alert.alert_type.replace(/_/g, ' ')}
                                  </strong>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                                    <Clock className="h-3 w-3" />
                                    Detected {formatTimestamp(alert.created_at)}
                                  </span>
                                  <button
                                    onClick={() => handleAcknowledgeAlert(alert.id)}
                                    disabled={acknowledgingId === alert.id}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border/80 hover:border-foreground/30 disabled:opacity-50 transition-all flex items-center gap-1"
                                    title="Mark alert as acknowledged"
                                  >
                                    {acknowledgingId === alert.id ? (
                                      <RefreshCw className="h-3 w-3 animate-spin text-cyan-500" />
                                    ) : (
                                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                    )}
                                    <span>Acknowledge</span>
                                  </button>
                                </div>
                              </div>

                              {/* Telemetry Metric & Threshold comparison */}
                              <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-card/60 dark:bg-navy-950/60 p-2.5 rounded-xl border border-border/50">
                                <div>
                                  <span className="text-muted-foreground">Parameter: </span>
                                  <strong className="text-foreground uppercase">{alert.metric}</strong>
                                </div>
                                {alert.observed_value != null && (
                                  <div>
                                    <span className="text-muted-foreground">Observed: </span>
                                    <strong className={isCritical ? 'text-rose-500' : 'text-amber-500'}>
                                      {alert.observed_value} {alert.unit}
                                    </strong>
                                  </div>
                                )}
                                {alert.threshold_value != null && (
                                  <div>
                                    <span className="text-muted-foreground">Threshold: </span>
                                    <strong className="text-foreground">
                                      {alert.threshold_value} {alert.unit}
                                    </strong>
                                  </div>
                                )}
                              </div>

                              {/* Scientific Reason & Diagnostic */}
                              <div className="text-xs text-foreground/90 leading-relaxed">
                                <span className="font-semibold text-muted-foreground">Diagnosis: </span>
                                {alert.reason}
                              </div>

                              {/* Recommended Next Action */}
                              <div className="text-xs text-foreground/90 bg-muted/30 dark:bg-navy-950/40 p-2.5 rounded-xl border border-border/40">
                                <strong className="text-cyan-600 dark:text-cyan-400">Recommended Action: </strong>
                                {alert.recommended_action}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Top Section: Animated Tube + Current Telemetry Grid ──── */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-3xl bg-muted/20 dark:bg-navy-950/30 border border-border/60 dark:border-navy-800">
                    {/* Left: Large Animated Water Level Tube (4 cols) */}
                    <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-card/60 dark:bg-navy-900/60 border border-border/60 dark:border-navy-800 shadow-inner">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Waves className="h-3.5 w-3.5 text-cyan-500" />
                        <span>Stage Telemetry</span>
                      </div>

                    <WellWaterLevel
                      waterLevel={reading?.water_level_m}
                      warningLevel={well.warning_level_m || 7.5}
                      dangerLevel={well.danger_level_m || 8.5}
                      criticalLowLevel={1.2}
                      height={240}
                      compact={false}
                      showTicks={true}
                      trend={well.water_level_trend}
                      wellName={well.name}
                    />

                    {well.water_level_change_1h_m != null && (
                      <div className="text-[11px] text-muted-foreground mt-3 font-mono">
                        1h Delta:{' '}
                        <span
                          className={`font-bold ${
                            well.water_level_change_1h_m > 0
                              ? 'text-rose-500'
                              : well.water_level_change_1h_m < 0
                              ? 'text-cyan-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {well.water_level_change_1h_m > 0 ? '+' : ''}
                          {well.water_level_change_1h_m.toFixed(3)} m
                        </span>
                      </div>
                    )}

                    <button
                      onClick={() => setMainModalTab('lithology')}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition-all shadow-2xs"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>View Lithology Profile &rarr;</span>
                    </button>
                  </div>

                  {/* Right: Key Parameters & Attribution (8 cols) */}
                  <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
                    {/* Status & Freshness Ribbon */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-muted-foreground">Data Pipeline:</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            readingStatus === 'LIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : readingStatus === 'ESTIMATED'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {readingStatus === 'LIVE' ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                          ) : (
                            <Radio className="h-3 w-3 text-amber-500" />
                          )}
                          <span>{readingStatus}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Synchronized: {formatTimestamp(reading?.timestamp)}</span>
                      </div>
                    </div>

                    {/* Parameter Values Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {/* pH */}
                      <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 shadow-xs">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          💧 pH Value
                        </div>
                        <div className="text-xl font-black font-mono text-teal-600 dark:text-teal-400">
                          {reading?.ph != null ? reading.ph.toFixed(2) : '--'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {reading?.ph != null && reading.ph >= 6.5 && reading.ph <= 8.5
                            ? 'Optimal neutral'
                            : 'Borderline range'}
                        </div>
                      </div>

                      {/* TDS */}
                      <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 shadow-xs">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          🧪 TDS (Salinity)
                        </div>
                        <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                          {reading?.tds_ppm != null ? `${Math.round(reading.tds_ppm)} ppm` : '--'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {reading?.tds_ppm != null && reading.tds_ppm < 500
                            ? 'Fresh potable'
                            : 'Mineralized'}
                        </div>
                      </div>

                      {/* Turbidity */}
                      <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 shadow-xs">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          🌫️ Turbidity
                        </div>
                        <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                          {reading?.turbidity_ntu != null ? `${reading.turbidity_ntu.toFixed(1)} NTU` : '--'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {reading?.turbidity_ntu != null && reading.turbidity_ntu < 5
                            ? 'Clear water'
                            : 'Sediment present'}
                        </div>
                      </div>

                      {/* Dissolved Oxygen */}
                      <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 shadow-xs">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          🫧 Dissolved O₂
                        </div>
                        <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {reading?.dissolved_oxygen_mg_l != null
                            ? `${reading.dissolved_oxygen_mg_l.toFixed(1)} mg/L`
                            : '--'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Aeration stage
                        </div>
                      </div>

                      {/* Water Temp */}
                      <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 shadow-xs">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          🌡️ Water Temp
                        </div>
                        <div className="text-xl font-black font-mono text-orange-600 dark:text-orange-400">
                          {reading?.temperature_c != null ? `${reading.temperature_c.toFixed(1)}°C` : '--'}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Aquifer thermal
                        </div>
                      </div>

                      {/* Warning / Danger Thresholds */}
                      <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800 shadow-xs">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                          ⚠️ Well Limits
                        </div>
                        <div className="text-xs font-mono font-bold text-foreground space-y-0.5">
                          <div className="text-amber-600 dark:text-amber-400">
                            Warn: {well.warning_level_m}m
                          </div>
                          <div className="text-rose-600 dark:text-rose-400">
                            Danger: {well.danger_level_m}m
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sensor Attribution Chips */}
                    <div className="p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 dark:border-navy-800">
                      <div className="text-[11px] font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-cyan-500" />
                        <span>Installed Transceiver & Sensor Attribution</span>
                      </div>
                      {activeSensors.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {activeSensors.map((s: any) => (
                            <span
                              key={s.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs bg-muted/60 dark:bg-navy-950/60 border border-border/60 text-foreground"
                            >
                              <strong className="text-cyan-500">{s.id}:</strong> {s.sensor_type} ({s.model})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No physical IoT probe is installed at this station. Readings are synthesized by the AquaSense Hydrological Simulation Engine.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Middle Section: Historical Trends (Recharts) ─────────── */}
                <div className="p-6 rounded-3xl bg-muted/20 dark:bg-navy-950/30 border border-border/60 dark:border-navy-800 space-y-4">
                  {/* Title & Chart Mode Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-500">
                        <LineChartIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground">
                          Persistent Telemetry Time-Series & Historical Analysis
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          Real database records query for well {well.id}
                        </p>
                      </div>
                    </div>

                    {/* Chart Tab Toggle */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs">
                      <button
                        onClick={() => setActiveHistoryTab('water-level')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          activeHistoryTab === 'water-level'
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Water Stage
                      </button>
                      <button
                        onClick={() => setActiveHistoryTab('water-quality')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          activeHistoryTab === 'water-quality'
                            ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400 shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Water Quality
                      </button>
                      <button
                        onClick={() => setMainModalTab('forecast')}
                        className="px-2.5 py-1 rounded-lg font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-all flex items-center gap-1"
                        title="Open Groundwater Level Forecasting & Backtesting"
                      >
                        <TrendingUp className="h-3 w-3" />
                        <span>Forecast ↗</span>
                      </button>
                    </div>
                  </div>

                  {/* Range Selector Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-border/40">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Range:
                      </span>
                      {(
                        [
                          { id: 'recent', label: 'Live / Recent' },
                          { id: '1y', label: 'Last 1 Year' },
                          { id: '2y', label: 'Last 2 Years' },
                          { id: '3y', label: 'Last 3 Years' },
                          { id: 'custom', label: 'Custom Range' },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.id}
                          type="button"
                          onClick={() => handleRangeChange(btn.id)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                            historyRange === btn.id
                              ? 'bg-cyan-500 text-white shadow-xs'
                              : 'bg-card dark:bg-navy-900 border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* Metadata & Provenance Tags */}
                    {historyAnalysis && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-muted/60 dark:bg-navy-900 border border-border/60 text-foreground font-mono">
                          {historyAnalysis.total_records} records
                        </span>
                        {historyAnalysis.data_source_summary?.SIMULATED != null && historyAnalysis.data_source_summary.SIMULATED > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                            Simulated: {historyAnalysis.data_source_summary.SIMULATED}
                          </span>
                        )}
                        {historyAnalysis.data_source_summary?.LIVE != null && historyAnalysis.data_source_summary.LIVE > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                            Physical Sensor: {historyAnalysis.data_source_summary.LIVE}
                          </span>
                        )}
                        {historyAnalysis.aggregation !== 'raw' && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium capitalize">
                            {historyAnalysis.aggregation} Aggregation
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom Date Range Picker */}
                  {historyRange === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-card dark:bg-navy-900 border border-border/60 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">From:</span>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">To:</span>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCustomDate}
                        disabled={!customStartDate || !customEndDate || historyLoading}
                        className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-medium transition-colors"
                      >
                        Apply Filter
                      </button>
                    </div>
                  )}

                  {/* Missing Telemetry Warning Banner (No Fabrication Guarantee) */}
                  {historyAnalysis?.has_missing_data && historyAnalysis.missing_periods && historyAnalysis.missing_periods.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 space-y-1 text-xs">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Historical Telemetry Notice</span>
                      </div>
                      <div className="pl-6 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                        {historyAnalysis.missing_periods.map((gap, idx) => (
                          <p key={idx}>
                            • No database records exist between <strong className="text-foreground">{formatTimestamp(gap.from)}</strong> and <strong className="text-foreground">{formatTimestamp(gap.to)}</strong> ({gap.reason}).
                          </p>
                        ))}
                        <p className="text-foreground/90 font-medium pt-0.5">
                          AquaSense Data Integrity: Only verified records from the database are plotted. No synthetic observations have been fabricated to fill unmonitored historical gaps.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Chart Loading or Content */}
                  {historyLoading ? (
                    <div className="h-72 flex flex-col items-center justify-center border border-dashed rounded-2xl text-xs text-muted-foreground space-y-2">
                      <RefreshCw className="h-5 w-5 animate-spin text-cyan-500" />
                      <span>Querying persistent time-series telemetry...</span>
                    </div>
                  ) : readings.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-dashed rounded-2xl text-xs text-muted-foreground space-y-1">
                      <Info className="h-5 w-5 text-muted-foreground/60" />
                      <p>No historical telemetry logged for this period.</p>
                      {historyAnalysis?.has_missing_data && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          This station has no recorded sensor observations prior to its initial commissioning date.
                        </p>
                      )}
                    </div>
                  ) : activeHistoryTab === 'water-level' ? (
                    /* Water Stage Chart */
                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={readings} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="wellWaterGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                              <stop offset="95%" stopColor="#0e7490" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatTickTime}
                            minTickGap={25}
                            interval="preserveStartEnd"
                            stroke="currentColor"
                            opacity={0.6}
                            fontSize={11}
                          />
                          <YAxis
                            unit="m"
                            domain={[0, Math.ceil((well.danger_level_m || 8.5) * 1.2)]}
                            stroke="currentColor"
                            opacity={0.6}
                            fontSize={11}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const pData = payload[0].payload;
                              const isSim = pData.status === 'SIMULATED' || (!pData.status && well.monitoring_type !== 'PHYSICAL_SENSOR');
                              return (
                                <div className="p-3 rounded-xl bg-card border border-border shadow-xl text-xs font-mono space-y-1">
                                  <div className="font-bold text-foreground">
                                    {formatTimestamp(label)}
                                  </div>
                                  <div className="text-cyan-500 font-bold">
                                    Water Stage: {Number(pData.water_level_m).toFixed(2)} m
                                  </div>
                                  {pData.min_water_level_m != null && pData.max_water_level_m != null && (
                                    <div className="text-[11px] text-muted-foreground flex justify-between gap-3">
                                      <span>Daily Min/Max:</span>
                                      <span className="font-bold text-foreground">
                                        {Number(pData.min_water_level_m).toFixed(2)}m – {Number(pData.max_water_level_m).toFixed(2)}m
                                      </span>
                                    </div>
                                  )}
                                  {pData.reading_count != null && (
                                    <div className="text-[10px] text-muted-foreground">
                                      Aggregated from {pData.reading_count} samples
                                    </div>
                                  )}
                                  <div className="pt-1">
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                                        isSim
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      }`}
                                    >
                                      {isSim ? 'Simulated Observation' : 'Live Physical Telemetry'}
                                    </span>
                                  </div>
                                </div>
                              );
                            }}
                          />
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
                          <ReferenceLine
                            y={1.2}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                            label={{ value: 'Critical Low (1.2m)', fill: '#ef4444', fontSize: 10, position: 'bottom' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="water_level_m"
                            stroke="#06b6d4"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#wellWaterGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    /* Water Quality Multi-Line Chart */
                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={readings} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatTickTime}
                            minTickGap={25}
                            interval="preserveStartEnd"
                            stroke="currentColor"
                            opacity={0.6}
                            fontSize={11}
                          />
                          <YAxis stroke="currentColor" opacity={0.6} fontSize={11} />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                <div className="p-3 rounded-xl bg-card border border-border shadow-xl text-xs font-mono space-y-1">
                                  <div className="font-bold text-foreground">{formatTimestamp(label)}</div>
                                  {payload.map((p) => (
                                    <div key={p.name} style={{ color: p.color }} className="flex justify-between gap-3">
                                      <span>{p.name}:</span>
                                      <span className="font-bold">{p.value}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="ph" name="pH" stroke="#14b8a6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="turbidity_ntu" name="Turbidity (NTU)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="dissolved_oxygen_mg_l" name="DO (mg/L)" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* ── Bottom Section: Weather, Air Quality & Risk Context ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Weather Context */}
                  <div className="p-4 rounded-2xl bg-card dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <CloudSun className="h-4 w-4 text-cyan-500" />
                      <span>Atmospheric Weather</span>
                    </div>
                    {well.weather ? (
                      <div className="space-y-1 text-xs">
                        <div className="text-xl font-bold text-foreground font-mono">
                          {well.weather.temperature_2m != null ? `${well.weather.temperature_2m.toFixed(1)}°C` : '--'}
                        </div>
                        <div className="text-muted-foreground flex justify-between">
                          <span>Humidity:</span>
                          <strong>{well.weather.relative_humidity_2m}%</strong>
                        </div>
                        <div className="text-muted-foreground flex justify-between">
                          <span>Precipitation:</span>
                          <strong>{well.weather.precipitation || 0} mm</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic py-2">
                        Atmospheric radar context not cached.
                      </div>
                    )}
                  </div>

                  {/* Air Quality Context */}
                  <div className="p-4 rounded-2xl bg-card dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <Wind className="h-4 w-4 text-teal-500" />
                      <span>Air Quality Grid</span>
                    </div>
                    {well.air_quality ? (
                      <div className="space-y-1 text-xs">
                        <div className="text-xl font-bold text-foreground font-mono">
                          AQI {well.air_quality.aqi != null ? Math.round(well.air_quality.aqi) : '--'}
                        </div>
                        <div className="text-muted-foreground flex justify-between">
                          <span>Status:</span>
                          <strong>{well.air_quality.category || 'Moderate'}</strong>
                        </div>
                        <div className="text-muted-foreground flex justify-between">
                          <span>PM 2.5:</span>
                          <strong>{well.air_quality.pm25 != null ? `${well.air_quality.pm25} µg/m³` : '--'}</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic py-2">
                        AQI grid node not reporting.
                      </div>
                    )}
                  </div>

                  {/* Environmental Risk Intelligence */}
                  <div className="p-4 rounded-2xl bg-card dark:bg-navy-950/40 border border-border/60 dark:border-navy-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <span>Environmental Risk Score</span>
                    </div>
                    {well.risk ? (
                      <div className="space-y-1 text-xs">
                        <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                          {well.risk.overall_score != null ? `${well.risk.overall_score}/100` : '--'}
                        </div>
                        <div className="text-muted-foreground flex justify-between">
                          <span>Risk Level:</span>
                          <strong className="uppercase">{well.risk.overall_level || 'LOW'}</strong>
                        </div>
                        <div className="text-muted-foreground flex justify-between">
                          <span>Engine:</span>
                          <span>Hydrological Matrix v1</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic py-2">
                        Risk matrix evaluating.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : mainModalTab === 'lithology' ? (
              <LithologySection
                well={well}
                waterLevelM={reading?.water_level_m}
                onProfileUpdated={() => fetchWellData(well.id)}
              />
            ) : (
              <WellForecastView
                wellId={well.id}
                well={well}
                historicalReadings={readings}
              />
            )
          )
        )}
      </div>

        {/* ── Modal Footer ────────────────────────────────────────── */}
        <div className="p-4 px-6 border-t border-border/60 dark:border-navy-800 bg-muted/20 dark:bg-navy-950/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-cyan-500" />
            <span className="font-mono">
              {well?.latitude?.toFixed(4)}°N, {well?.longitude?.toFixed(4)}°E
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onSelectOnMap && well && (
              <button
                onClick={() => {
                  onSelectOnMap(well.latitude, well.longitude, well.name);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold transition-all shadow-xs"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Locate on GIS Canvas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
