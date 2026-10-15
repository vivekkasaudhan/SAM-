'use client';

import React from 'react';
import {
  LithologyLayer,
  DepthGap,
  getMaterialLabel,
  getMaterialColor,
  DATA_SOURCE_BADGES,
} from '@/types/lithology';
import {
  Edit2,
  Trash2,
  Droplets,
  AlertTriangle,
  ShieldCheck,
  Maximize2,
  Lock,
} from 'lucide-react';

interface LithologyLayerListProps {
  layers: LithologyLayer[];
  gaps: DepthGap[];
  canManage: boolean;
  onEditLayer: (layer: LithologyLayer) => void;
  onDeleteLayer: (layer: LithologyLayer) => void;
  onSelectLayer?: (layer: LithologyLayer) => void;
}

export function LithologyLayerList({
  layers,
  gaps,
  canManage,
  onEditLayer,
  onDeleteLayer,
  onSelectLayer,
}: LithologyLayerListProps) {
  // Combine layers and gaps into a unified chronological sequence
  const sequence = React.useMemo(() => {
    type RowItem =
      | { type: 'layer'; data: LithologyLayer; from: number; to: number }
      | { type: 'gap'; data: DepthGap; from: number; to: number };

    const items: RowItem[] = [];
    layers.forEach((l) => items.push({ type: 'layer', data: l, from: l.from_depth_m, to: l.to_depth_m }));
    gaps.forEach((g) => items.push({ type: 'gap', data: g, from: g.from_depth_m, to: g.to_depth_m }));

    return items.sort((a, b) => a.from - b.from);
  }, [layers, gaps]);

  if (layers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="font-semibold text-foreground">
          Documented Geological Succession ({layers.length} horizons)
        </span>
        <span className="font-mono text-[11px]">Sorted by depth ascending</span>
      </div>

      <div className="rounded-2xl border border-border/80 dark:border-navy-750 overflow-hidden bg-card/80 dark:bg-navy-900/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 dark:bg-navy-950/40 border-b border-border/60 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Depth Interval</th>
                <th className="py-3 px-3.5">Material & Stratum</th>
                <th className="py-3 px-3.5">Hydraulic Interpretation</th>
                <th className="py-3 px-3.5">Data Provenance</th>
                <th className="py-3 px-3.5">Confidence</th>
                <th className="py-3 px-3.5">Description & Observations</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-foreground">
              {sequence.map((item, idx) => {
                if (item.type === 'gap') {
                  const gap = item.data;
                  return (
                    <tr
                      key={`gap-row-${idx}`}
                      className="bg-amber-500/5 dark:bg-amber-500/10 text-muted-foreground italic font-mono text-[11px]"
                    >
                      <td className="py-2.5 px-3.5 font-bold text-amber-600 dark:text-amber-400">
                        {gap.from_depth_m.toFixed(2)}m – {gap.to_depth_m.toFixed(2)}m
                      </td>
                      <td colSpan={5} className="py-2.5 px-3.5 font-sans">
                        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Unlogged Gap: {gap.length_m.toFixed(2)}m unrecorded depth interval</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-[10px] text-muted-foreground/60">
                        No Data
                      </td>
                    </tr>
                  );
                }

                const layer = item.data;
                const badge = DATA_SOURCE_BADGES[layer.data_source] || {
                  label: layer.data_source,
                  variant: 'verified',
                  verified: true,
                };
                const swatchColor = getMaterialColor(layer.material_type, layer.color_code);

                return (
                  <tr
                    key={`layer-row-${layer.id}`}
                    onClick={() => onSelectLayer && onSelectLayer(layer)}
                    className="hover:bg-muted/30 dark:hover:bg-navy-800/30 transition-colors cursor-pointer group"
                  >
                    {/* Depth Interval */}
                    <td className="py-3 px-3.5 font-mono">
                      <div className="font-bold text-foreground">
                        {layer.from_depth_m.toFixed(2)} – {layer.to_depth_m.toFixed(2)} m
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Thickness: {layer.thickness_m.toFixed(2)} m
                      </div>
                    </td>

                    {/* Material & Stratum */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-sm border border-black/30 shrink-0 shadow-2xs"
                          style={{ backgroundColor: swatchColor }}
                        />
                        <span className="font-bold text-foreground line-clamp-1">
                          {getMaterialLabel(layer.material_type)}
                        </span>
                      </div>
                    </td>

                    {/* Hydraulic Interpretation */}
                    <td className="py-3 px-3.5">
                      {layer.aquifer_indicator ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                          <Droplets className="h-3 w-3" />
                          Potential Aquifer
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Confining / Aquitard</span>
                      )}
                    </td>

                    {/* Data Provenance Badge */}
                    <td className="py-3 px-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${
                          badge.variant === 'demo'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : badge.variant === 'estimated'
                            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {badge.variant === 'demo' ? (
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />
                        ) : (
                          <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                        )}
                        <span>{badge.label}</span>
                      </span>
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-3.5">
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          layer.confidence_level === 'HIGH'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : layer.confidence_level === 'MEDIUM'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {layer.confidence_level}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-3.5 max-w-[240px]">
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">
                        {layer.description || 'No notes entered'}
                      </p>
                      {layer.source_reference && (
                        <div className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 truncate mt-0.5">
                          Ref: {layer.source_reference}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEditLayer(layer)}
                            className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-2xs"
                            title="Edit stratum properties"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => onDeleteLayer(layer)}
                            className="p-1.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-all shadow-2xs"
                            title="Delete stratum"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md"
                          title="Read-only access (Station created by another user)"
                        >
                          <Lock className="h-2.5 w-2.5" />
                          Read-only
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
