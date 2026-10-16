'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle, Info, ShieldAlert, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
import { alertService, Alert, AlertSummary } from '@/services/api';
import { format, parseISO } from 'date-fns';
import type { RiskData, RiskFactor, RiskLevel } from '@/types/environment';

interface RiskSectionProps {
  risk: RiskData;
}

const RISK_CONFIG: Record<RiskLevel, { bg: string; border: string; text: string; icon: React.FC<{ className?: string }>; label: string }> = {
  LOW: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle, label: 'LOW' },
  MODERATE: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200', text: 'text-amber-700 dark:text-amber-400', icon: Info, label: 'MODERATE' },
  HIGH: { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200', text: 'text-orange-700 dark:text-orange-400', icon: AlertTriangle, label: 'HIGH' },
  CRITICAL: { bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-300', text: 'text-red-700 dark:text-red-400', icon: AlertOctagon, label: 'CRITICAL' },
};

const CATEGORY_LABELS: Record<string, { label: string; emoji: string }> = {
  FLOOD: { label: 'Flood Risk', emoji: '🌊' },
  WATER_QUALITY: { label: 'Water Quality Risk', emoji: '💧' },
  AIR_QUALITY: { label: 'Air Quality Risk', emoji: '🌫️' },
  EXTREME_WEATHER: { label: 'Extreme Weather Risk', emoji: '⛈️' },
};

function RiskScoreBar({ score, level }: { score: number; level: RiskLevel }) {
  const color =
    level === 'CRITICAL' ? 'bg-red-500' :
    level === 'HIGH' ? 'bg-orange-500' :
    level === 'MODERATE' ? 'bg-amber-400' :
    'bg-emerald-500';

  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
  );
}

function RiskCard({ factor }: { factor: RiskFactor }) {
  const cfg = RISK_CONFIG[factor.level];
  const IconComp = cfg.icon;
  const cat = CATEGORY_LABELS[factor.category] ?? { label: factor.category, emoji: '⚠️' };

  return (
    <div className={`p-5 rounded-xl border-2 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{cat.emoji}</span>
          <span className="font-semibold text-sm">{cat.label}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <IconComp className="h-3.5 w-3.5" />
          {cfg.label}
        </div>
      </div>

      <RiskScoreBar score={factor.score} level={factor.level} />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Risk Score</span>
        <span className={`font-bold ${cfg.text}`}>{factor.score.toFixed(0)}/100</span>
      </div>

      {/* Description as bullet points */}
      <div className="mt-3 space-y-1">
        {factor.description.split('. ').filter(Boolean).map((point, i) => (
          <div key={i} className={`text-xs flex items-start gap-1.5 ${cfg.text}`}>
            <span className="mt-0.5">•</span>
            <span>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskSection({ risk }: RiskSectionProps) {
  const overallCfg = RISK_CONFIG[risk.overall_level];
  const OverallIcon = overallCfg.icon;

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);

  const fetchAlertData = async () => {
    setLoadingAlerts(true);
    try {
      const [alertsData, summaryData] = await Promise.all([
        alertService.getAlerts({ status: 'ACTIVE', limit: 10 }),
        alertService.getAlertSummary(),
      ]);
      setAlerts(alertsData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load early-warning alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    fetchAlertData();
  }, []);

  const handleEvaluateNow = async () => {
    setEvaluating(true);
    try {
      await alertService.evaluateAlerts();
      await fetchAlertData();
    } catch (err) {
      console.error('Failed to run alerts evaluation:', err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    setAcknowledgingId(alertId);
    try {
      await alertService.acknowledgeAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      if (summary) {
        setSummary({
          ...summary,
          total_active: Math.max(0, summary.total_active - 1),
        });
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '--';
    try {
      return format(parseISO(ts.replace('Z', '')), 'MMM dd, HH:mm');
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Early-Warning System (EWS) Live Alert Feed ─────────────────────────── */}
      <div className="p-6 rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60 dark:border-navy-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Groundwater Early-Warning Risk & Anomaly System
                </h3>
                {summary && summary.total_active > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    {summary.total_active} Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Continuous automated surveillance detecting rapid drawdown, threshold crossings, stale telemetry, and forecast risks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEvaluateNow}
              disabled={evaluating || loadingAlerts}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
              title="Trigger instant rule & forecast risk evaluation across all wells"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              <span>{evaluating ? 'Evaluating...' : 'Evaluate All Wells'}</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-muted/30 dark:bg-navy-950/40 border border-border/50 text-center">
              <div className="text-[11px] font-bold text-muted-foreground uppercase">Active Alerts</div>
              <div className="text-xl font-mono font-bold text-foreground">{summary.total_active}</div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-center">
              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase">Critical Severity</div>
              <div className="text-xl font-mono font-bold text-rose-600 dark:text-rose-400">{summary.critical_count}</div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase">Warning Severity</div>
              <div className="text-xl font-mono font-bold text-amber-600 dark:text-amber-400">{summary.warning_count}</div>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-center">
              <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase">Predictive (7–15d)</div>
              <div className="text-xl font-mono font-bold text-purple-600 dark:text-purple-400">{summary.forecast_alert_count}</div>
            </div>
          </div>
        )}

        {/* Alert List or Empty State */}
        {loadingAlerts && alerts.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto text-cyan-500" />
            <p>Evaluating telemetry and retrieving risk assessment alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <div className="text-sm font-bold text-foreground">Zero Active Early-Warning Alerts</div>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              All monitored groundwater stations are within baseline thresholds, telemetry feeds are active, and no rapid drawdowns or imminent critical crossings are projected.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => {
              const isCrit = a.severity === 'CRITICAL';
              const isWarn = a.severity === 'WARNING';
              const borderTheme = isCrit
                ? 'border-rose-500/40 bg-rose-500/5'
                : isWarn
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-cyan-500/40 bg-cyan-500/5';
              const badgeTheme = isCrit
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                : isWarn
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';

              return (
                <div
                  key={a.id}
                  className={`p-4 rounded-2xl border ${borderTheme} space-y-2.5 transition-all shadow-xs`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeTheme}`}>
                        {a.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        a.is_forecast
                          ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30'
                          : 'bg-muted/80 text-foreground border-border/60'
                      }`}>
                        {a.is_forecast ? `PREDICTIVE FORECAST (+${a.forecast_horizon_days}d)` : 'OBSERVED TELEMETRY'}
                      </span>
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-muted/80 text-foreground">
                        {a.well_name ? `${a.well_name} (${a.well_id})` : a.well_id}
                      </span>
                      <strong className="text-xs font-bold text-foreground">
                        {a.alert_type.replace(/_/g, ' ')}
                      </strong>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(a.created_at)}
                      </span>
                      <button
                        onClick={() => handleAcknowledgeAlert(a.id)}
                        disabled={acknowledgingId === a.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border/80 hover:border-foreground/30 disabled:opacity-50 transition-all flex items-center gap-1"
                        title="Acknowledge and archive this alert"
                      >
                        {acknowledgingId === a.id ? (
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
                      <strong className="text-foreground uppercase">{a.metric}</strong>
                    </div>
                    {a.observed_value != null && (
                      <div>
                        <span className="text-muted-foreground">Observed: </span>
                        <strong className={isCrit ? 'text-rose-500' : 'text-amber-500'}>
                          {a.observed_value} {a.unit}
                        </strong>
                      </div>
                    )}
                    {a.threshold_value != null && (
                      <div>
                        <span className="text-muted-foreground">Threshold: </span>
                        <strong className="text-foreground">
                          {a.threshold_value} {a.unit}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Scientific Reason & Diagnostic */}
                  <div className="text-xs text-foreground/90 leading-relaxed">
                    <span className="font-semibold text-muted-foreground">Diagnosis: </span>
                    {a.reason}
                  </div>

                  {/* Recommended Next Action */}
                  <div className="text-xs text-foreground/90 bg-muted/30 dark:bg-navy-950/40 p-2.5 rounded-xl border border-border/40">
                    <strong className="text-cyan-600 dark:text-cyan-400">Recommended Action: </strong>
                    {a.recommended_action}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Overall Environmental Risk Banner ──────────────────────────────────── */}
      <div className={`p-6 rounded-2xl border-2 ${overallCfg.bg} ${overallCfg.border}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <OverallIcon className={`h-8 w-8 ${overallCfg.text}`} />
            <div>
              <div className="text-sm text-muted-foreground">Overall Environmental Risk</div>
              <div className={`text-3xl font-bold ${overallCfg.text}`}>{risk.overall_level}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${overallCfg.text}`}>{risk.overall_score.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">/ 100</div>
          </div>
        </div>

        {/* Overall score bar */}
        <div className="h-3 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              risk.overall_level === 'CRITICAL' ? 'bg-red-500' :
              risk.overall_level === 'HIGH' ? 'bg-orange-500' :
              risk.overall_level === 'MODERATE' ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, risk.overall_score)}%` }}
          />
        </div>

        <div className="mt-2">
          <DataSourceBadge info={risk.data_source} />
        </div>
      </div>

      {/* Individual risk factor cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risk.factors.map((factor) => (
          <RiskCard key={factor.category} factor={factor} />
        ))}
      </div>

      {/* Methodology note */}
      <div className="p-4 rounded-xl bg-muted/50 border text-sm">
        <div className="font-semibold mb-1">About SAM Risk & Anomaly System</div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          SAM continuously couples hydrological telemetry, open weather forecasts, and time-series
          autoregressive trajectories to detect early warning signs. Observed alerts reflect empirical probe
          and sensor violations, while predictive alerts provide advance situational notice without guaranteeing
          impending crisis.
        </div>
      </div>
    </div>
  );
}
