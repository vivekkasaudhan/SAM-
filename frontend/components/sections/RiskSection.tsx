'use client';

import React from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle, Info } from 'lucide-react';
import { DataSourceBadge } from '@/components/dashboard/DataSourceBadge';
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

  return (
    <div className="space-y-6">
      {/* Overall risk banner */}
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
        <div className="font-semibold mb-1">About Risk Assessment</div>
        <div className="text-muted-foreground text-xs leading-relaxed">
          Risk scores are calculated using a rule-based algorithm considering water levels vs. thresholds,
          water quality parameters, air quality index, and weather conditions. The overall risk score
          is a weighted combination of individual risk factors. This system is designed to be replaced
          by an ML model in future versions.
        </div>
      </div>
    </div>
  );
}
