'use client';

import React from 'react';
import type { DataSourceInfo } from '@/types/environment';

interface DataSourceBadgeProps {
  info: DataSourceInfo;
  showDetail?: boolean;
}

const CONFIG = {
  LIVE: {
    dot: 'bg-emerald-500 animate-pulse',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'LIVE',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
  ESTIMATED: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'ESTIMATED',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  SIMULATED: {
    dot: 'bg-cyan-500',
    text: 'text-slate-600 dark:text-slate-400',
    label: 'TELEMETRY MODEL',
    bg: 'bg-slate-100/70 dark:bg-navy-950/70 border-border/70',
  },
  UNAVAILABLE: {
    dot: 'bg-gray-400',
    text: 'text-gray-500 dark:text-gray-400',
    label: 'UNAVAILABLE',
    bg: 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700',
  },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'just now';
  // Ensure ISO timestamp without timezone is treated as UTC
  const normalizedStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`;
  const parsedTime = new Date(normalizedStr).getTime();
  if (isNaN(parsedTime)) return 'just now';

  const diff = Math.max(0, Math.floor((Date.now() - parsedTime) / 1000));
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function DataSourceBadge({ info, showDetail = true }: DataSourceBadgeProps) {
  const cfg = CONFIG[info.status] ?? CONFIG.UNAVAILABLE;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={cfg.text}>{cfg.label}</span>
      {showDetail && (
        <span className="text-muted-foreground font-normal">
          · {info.source_label}
        </span>
      )}
      {showDetail && info.updated_at && (
        <span className="text-muted-foreground font-normal">
          · {timeAgo(info.updated_at)}
        </span>
      )}
    </div>
  );
}

// Compact variant just shows the dot + label inline
export function DataStatusDot({ status }: { status: DataSourceInfo['status'] }) {
  const cfg = CONFIG[status] ?? CONFIG.UNAVAILABLE;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
