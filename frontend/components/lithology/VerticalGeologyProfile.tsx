'use client';

import React, { useState, useMemo } from 'react';
import {
  LithologyLayer,
  DepthGap,
  getMaterialLabel,
  getMaterialColor,
  MATERIAL_METADATA,
  DATA_SOURCE_BADGES,
} from '@/types/lithology';
import {
  Droplets,
  HelpCircle,
  FileText,
  AlertTriangle,
  Sparkles,
  Info,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';

interface VerticalGeologyProfileProps {
  layers: LithologyLayer[];
  gaps: DepthGap[];
  wellTotalDepthM?: number | null;
  totalLoggedDepthM: number;
  waterLevelM?: number | null; // Water column height above sensor/datum (m)
  warningLevelM?: number | null;
  dangerLevelM?: number | null;
  selectedLayerId?: number | null;
  onSelectLayer?: (layer: LithologyLayer) => void;
  className?: string;
}

export function VerticalGeologyProfile({
  layers,
  gaps,
  wellTotalDepthM,
  totalLoggedDepthM,
  waterLevelM,
  warningLevelM,
  dangerLevelM,
  selectedLayerId,
  onSelectLayer,
  className = '',
}: VerticalGeologyProfileProps) {
  const [hoveredLayer, setHoveredLayer] = useState<LithologyLayer | null>(null);
  const [activeLayer, setActiveLayer] = useState<LithologyLayer | null>(null);

  // Maximum depth boundary for profile scaling
  const maxProfileDepth = useMemo(() => {
    const candidate = Math.max(
      wellTotalDepthM || 0,
      totalLoggedDepthM || 0,
      ...layers.map((l) => l.to_depth_m),
      10.0
    );
    return Math.ceil(candidate);
  }, [wellTotalDepthM, totalLoggedDepthM, layers]);

  // Combined sorted list of items (strata and unlogged gaps) to render vertically
  const profileItems = useMemo(() => {
    type ProfileSegment =
      | { type: 'layer'; data: LithologyLayer; from: number; to: number; thickness: number }
      | { type: 'gap'; data: DepthGap; from: number; to: number; thickness: number };

    const items: ProfileSegment[] = [];

    layers.forEach((l) => {
      items.push({
        type: 'layer',
        data: l,
        from: l.from_depth_m,
        to: l.to_depth_m,
        thickness: l.to_depth_m - l.from_depth_m,
      });
    });

    gaps.forEach((g) => {
      items.push({
        type: 'gap',
        data: g,
        from: g.from_depth_m,
        to: g.to_depth_m,
        thickness: g.length_m,
      });
    });

    // If total well depth extends beyond the deepest layer, add bottom unlogged segment
    const deepestLogged = Math.max(0, ...layers.map((l) => l.to_depth_m));
    if (wellTotalDepthM && wellTotalDepthM > deepestLogged + 0.05) {
      items.push({
        type: 'gap',
        data: {
          from_depth_m: deepestLogged,
          to_depth_m: wellTotalDepthM,
          length_m: roundTwo(wellTotalDepthM - deepestLogged),
        },
        from: deepestLogged,
        to: wellTotalDepthM,
        thickness: wellTotalDepthM - deepestLogged,
      });
    }

    return items.sort((a, b) => a.from - b.from);
  }, [layers, gaps, wellTotalDepthM]);

  // Selected or hovered layer to inspect
  const inspectedLayer = activeLayer || hoveredLayer || (selectedLayerId ? layers.find((l) => l.id === selectedLayerId) : layers[0]) || null;

  // Depth scale ticks
  const scaleTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = maxProfileDepth <= 15 ? 2 : maxProfileDepth <= 40 ? 5 : 10;
    for (let d = 0; d <= maxProfileDepth; d += step) {
      ticks.push(d);
    }
    if (ticks[ticks.length - 1] !== maxProfileDepth) {
      ticks.push(maxProfileDepth);
    }
    return ticks;
  }, [maxProfileDepth]);

  // Water level reference computation:
  // Note: Telemetry reading `waterLevelM` represents the water column height in the well.
  // If total well depth `wellTotalDepthM` is known, depth to water table from ground surface is (wellTotalDepthM - waterLevelM).
  const waterTableDepthFromSurface = useMemo(() => {
    if (typeof waterLevelM !== 'number' || isNaN(waterLevelM)) return null;
    if (wellTotalDepthM && wellTotalDepthM > 0) {
      const dtw = wellTotalDepthM - waterLevelM;
      return dtw >= 0 ? dtw : 0;
    }
    return null;
  }, [waterLevelM, wellTotalDepthM]);

  function roundTwo(v: number): number {
    return Math.round(v * 100) / 100;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── Top Legend & Method Bar ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/30 dark:bg-navy-950/40 border border-border/60 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Layers className="h-4 w-4 text-cyan-500" />
            <span>Stratigraphic Borehole Profile</span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 border border-amber-600 inline-block" />
              <span>Stratum (Known)</span>
            </span>
            <span className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-xs border border-dashed border-muted-foreground/60 inline-block"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, #64748b 0, #64748b 1px, transparent 0, transparent 4px)',
                }}
              />
              <span>Unlogged Gap</span>
            </span>
            <span className="flex items-center gap-1">
              <Droplets className="h-3 w-3 text-cyan-500" />
              <span>Potential Aquifer</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
          <span>Datum: Ground Surface (0.00 m)</span>
          <span>•</span>
          <span>Max Profile Depth: {maxProfileDepth} m</span>
        </div>
      </div>

      {/* ── Main Geological Profile: Two Columns (Column Visual + Inspector Card) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Scaled Vertical Column & Rulers (5 cols on lg) */}
        <div className="lg:col-span-5 p-4 rounded-3xl bg-card/60 dark:bg-navy-900/60 border border-border/70 dark:border-navy-800 shadow-enterprise dark:shadow-enterprise-dark">
          <div className="flex items-start justify-between text-xs font-bold text-muted-foreground mb-3 px-1">
            <span>DEPTH SCALE (m)</span>
            <span>STRATIGRAPHIC SUCCESSION</span>
            {waterTableDepthFromSurface !== null && <span>WATER TABLE</span>}
          </div>

          <div className="relative flex items-stretch gap-3 min-h-[460px] max-h-[640px] select-none py-1 overflow-y-auto pr-1">
            {/* Depth Ruler / Metric Ticks */}
            <div className="relative w-12 shrink-0 flex flex-col justify-between py-1 text-right text-[10px] font-mono text-muted-foreground/80 border-r border-border/70 pr-2">
              {scaleTicks.map((tick) => {
                const topPct = (tick / maxProfileDepth) * 100;
                return (
                  <div
                    key={tick}
                    className="absolute right-0 flex items-center gap-1 -translate-y-1/2"
                    style={{ top: `${topPct}%` }}
                  >
                    <span>{tick}m</span>
                    <span className="w-1.5 h-[1px] bg-border dark:bg-navy-700" />
                  </div>
                );
              })}
            </div>

            {/* Central Vertical Stratigraphic Column Container */}
            <div className="relative flex-1 rounded-2xl border-2 border-border/90 dark:border-navy-700 overflow-hidden shadow-inner bg-muted/20 dark:bg-navy-950/40 min-h-[440px]">
              {profileItems.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">No Stratigraphy Recorded</p>
                  <p className="text-[11px]">Borehole layers have not been logged yet for this station.</p>
                </div>
              ) : (
                profileItems.map((item, idx) => {
                  const heightPct = (item.thickness / maxProfileDepth) * 100;
                  const minPixelHeight = Math.max(34, (item.thickness / maxProfileDepth) * 440);

                  if (item.type === 'gap') {
                    return (
                      <div
                        key={`gap-${idx}-${item.from}`}
                        style={{ height: `${Math.max(6, heightPct)}%`, minHeight: `${Math.max(28, minPixelHeight)}px` }}
                        className="relative w-full border-b border-dashed border-border/80 flex items-center justify-between px-3 text-[10px] font-mono text-muted-foreground/75 bg-slate-100/50 dark:bg-slate-900/40"
                        title={`Unlogged Gap: ${item.from.toFixed(1)}m – ${item.to.toFixed(1)}m (${item.thickness.toFixed(1)}m unrecorded)`}
                      >
                        <div
                          className="absolute inset-0 pointer-events-none opacity-25"
                          style={{
                            backgroundImage:
                              'repeating-linear-gradient(-45deg, #94a3b8 0, #94a3b8 2px, transparent 0, transparent 8px)',
                          }}
                        />
                        <span className="relative z-10 italic">
                          ⚠️ Unlogged Gap ({item.from.toFixed(1)} – {item.to.toFixed(1)}m)
                        </span>
                        <span className="relative z-10 font-bold opacity-60">Δ {item.thickness.toFixed(1)}m</span>
                      </div>
                    );
                  }

                  // Geological Layer
                  const layer = item.data;
                  const isInspected = inspectedLayer?.id === layer.id;
                  const bgColor = getMaterialColor(layer.material_type, layer.color_code);
                  const isDemo = layer.data_source === 'illustrative_demo';
                  const isEstimated = layer.data_source === 'ESTIMATED';

                  return (
                    <div
                      key={`layer-${layer.id}`}
                      onClick={() => {
                        setActiveLayer(layer);
                        if (onSelectLayer) onSelectLayer(layer);
                      }}
                      onMouseEnter={() => setHoveredLayer(layer)}
                      onMouseLeave={() => setHoveredLayer(null)}
                      style={{
                        height: `${Math.max(8, heightPct)}%`,
                        minHeight: `${Math.max(38, minPixelHeight)}px`,
                        backgroundColor: bgColor,
                      }}
                      className={`relative w-full border-b border-black/20 dark:border-white/10 cursor-pointer transition-all duration-200 flex items-center justify-between px-3 text-white group ${
                        isInspected
                          ? 'ring-2 ring-cyan-400 z-10 shadow-lg brightness-110'
                          : 'hover:brightness-105'
                      }`}
                    >
                      {/* Subtle Lithology Shading & 3D bevel */}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/20 pointer-events-none" />

                      {/* Material label and depth */}
                      <div className="relative z-10 flex flex-col drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        <span className="text-xs font-black tracking-tight line-clamp-1 flex items-center gap-1.5">
                          <span>{getMaterialLabel(layer.material_type)}</span>
                          {layer.aquifer_indicator && (
                            <span
                              className="inline-flex items-center text-[10px] bg-cyan-500/90 text-white px-1.5 py-0.2 rounded-full font-bold shadow-xs"
                              title="Potential Aquifer Horizon"
                            >
                              <Droplets className="h-2.5 w-2.5 mr-0.5" />
                              Aquifer
                            </span>
                          )}
                          {isDemo && (
                            <span className="text-[9px] bg-amber-500/90 text-black px-1 rounded font-black uppercase">
                              Demo
                            </span>
                          )}
                          {isEstimated && (
                            <span className="text-[9px] bg-purple-500/90 text-white px-1 rounded font-bold uppercase">
                              Est.
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono opacity-90">
                          {layer.from_depth_m.toFixed(1)}m – {layer.to_depth_m.toFixed(1)}m ({layer.thickness_m.toFixed(1)}m)
                        </span>
                      </div>

                      {/* Right Tag / Chevron */}
                      <div className="relative z-10 text-[10px] font-mono font-bold opacity-80 group-hover:opacity-100">
                        {layer.confidence_level} CONF.
                      </div>
                    </div>
                  );
                })
              )}

              {/* Water Table Indicator Overlay Line (if depth to water is computed) */}
              {waterTableDepthFromSurface !== null && (
                <div
                  className="absolute left-0 right-0 border-b-2 border-cyan-400 z-20 pointer-events-none transition-all flex items-center justify-between px-2"
                  style={{
                    top: `${Math.min(98, Math.max(2, (waterTableDepthFromSurface / maxProfileDepth) * 100))}%`,
                  }}
                  title={`Computed Water Table Depth: ${waterTableDepthFromSurface.toFixed(2)}m below surface`}
                >
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-white font-mono font-bold text-[9px] shadow-md -translate-y-1/2">
                    ▼ DTW: {waterTableDepthFromSurface.toFixed(2)}m
                  </span>
                  <span className="text-[9px] font-bold text-cyan-200 bg-navy-950/80 px-1 rounded -translate-y-1/2 shadow-xs">
                    Water Surface
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Total Depth Indicator */}
          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
            <span>Borehole Base Datum</span>
            <span className="font-bold text-foreground">
              {wellTotalDepthM ? `Total Well Depth: ${wellTotalDepthM.toFixed(1)} m` : `Profile Base: ${maxProfileDepth.toFixed(1)} m`}
            </span>
          </div>
        </div>

        {/* Right Column: Interactive Stratigraphic Inspector (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          {inspectedLayer ? (
            <div className="p-5 rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-enterprise space-y-5 animate-in fade-in-50 duration-200">
              {/* Header: Title, Horizon Interval, Swatch */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/60">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-md border border-black/30 shadow-xs inline-block"
                      style={{ backgroundColor: getMaterialColor(inspectedLayer.material_type, inspectedLayer.color_code) }}
                    />
                    <span className="text-xs font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-muted dark:bg-navy-950 text-foreground border border-border/60">
                      Layer ID #{inspectedLayer.id}
                    </span>
                    {/* Aquifer badge */}
                    {inspectedLayer.aquifer_indicator && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                        <Droplets className="h-3 w-3" />
                        Potential Aquifer Horizon
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-foreground tracking-tight">
                    {getMaterialLabel(inspectedLayer.material_type)}
                  </h3>

                  <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                    Depth Interval: {inspectedLayer.from_depth_m.toFixed(2)} m – {inspectedLayer.to_depth_m.toFixed(2)} m
                    <span className="text-muted-foreground font-normal ml-2">
                      (Stratum Thickness: {inspectedLayer.thickness_m.toFixed(2)} m)
                    </span>
                  </div>
                </div>

                {/* Data Source Badge */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {(() => {
                    const badge = DATA_SOURCE_BADGES[inspectedLayer.data_source] || {
                      label: inspectedLayer.data_source,
                      variant: 'verified',
                      verified: true,
                    };
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${
                          badge.variant === 'demo'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            : badge.variant === 'estimated'
                            ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {badge.variant === 'demo' ? (
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                        ) : (
                          <ShieldCheck className="h-3 w-3 text-emerald-500" />
                        )}
                        <span>{badge.label}</span>
                      </span>
                    );
                  })()}

                  <span className="text-[10px] text-muted-foreground font-mono">
                    Confidence: <strong>{inspectedLayer.confidence_level}</strong>
                  </span>
                </div>
              </div>

              {/* Data Disclaimer if Demo or Estimated */}
              {inspectedLayer.data_source === 'illustrative_demo' && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Illustrative Demonstration Strata:</span> This geological layer was
                    generated for demonstration and testing purposes. Never treat illustrative demo layers as verified
                    field geological readings.
                  </div>
                </div>
              )}

              {inspectedLayer.data_source === 'ESTIMATED' && (
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs flex items-start gap-2.5">
                  <Info className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Estimated Geology:</span> Inferred from regional stratigraphy models. Not
                    yet confirmed by physical borehole core extraction.
                  </div>
                </div>
              )}

              {/* Description & Lithological Notes */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-cyan-500" />
                  <span>Geological Description & Field Notes</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 dark:bg-navy-950/40 border border-border/60 text-xs text-foreground leading-relaxed">
                  {inspectedLayer.description || (
                    <span className="text-muted-foreground italic">
                      No descriptive texture or geological notes entered for this layer.
                    </span>
                  )}
                </div>
              </div>

              {/* Observed Geotechnical & Hydraulic Properties */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-teal-500" />
                  <span>Observed Geotechnical & Hydrogeological Characteristics</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-navy-950/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Moisture
                    </span>
                    <span className="font-bold text-foreground">
                      {inspectedLayer.observed_properties?.moisture || 'Unspecified'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-navy-950/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Grain Size
                    </span>
                    <span className="font-bold text-foreground">
                      {inspectedLayer.observed_properties?.grain_size || 'Graded'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-navy-950/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Plasticity
                    </span>
                    <span className="font-bold text-foreground">
                      {inspectedLayer.observed_properties?.plasticity || 'None'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-muted/30 dark:bg-navy-950/30 border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Permeability
                    </span>
                    <span className="font-bold text-foreground">
                      {inspectedLayer.observed_properties?.permeability ||
                        (inspectedLayer.aquifer_indicator ? 'Moderate-High' : 'Low')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Aquifer Interpretation Box */}
              {inspectedLayer.aquifer_indicator && (
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-700 dark:text-cyan-300">
                    <Droplets className="h-4 w-4 text-cyan-500" />
                    <span>Aquifer Interpretation: Potential Water-Bearing Zone</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Identified as a potential water-bearing horizon based on geological permeability. This represents a
                    potential, not confirmed, aquifer horizon unless verified through pumping tests or flowmeter logging.
                  </p>
                </div>
              )}

              {/* Metadata Footer */}
              <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
                {inspectedLayer.source_reference && (
                  <div>
                    Reference: <strong>{inspectedLayer.source_reference}</strong>
                  </div>
                )}
                {inspectedLayer.attachment_url && (
                  <a
                    href={inspectedLayer.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>View Log Attachment</span>
                    <Maximize2 className="h-3 w-3" />
                  </a>
                )}
                {insiferDate(inspectedLayer.updated_at) && (
                  <div>Updated: {insiferDate(inspectedLayer.updated_at)}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-10 rounded-3xl bg-card/60 border border-dashed border-border/80 text-center space-y-2">
              <Layers className="h-8 w-8 text-muted-foreground/60 mx-auto" />
              <div className="text-sm font-bold text-foreground">Click Any Stratum to Inspect Geological Details</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Select a geological horizon on the vertical column to view textural descriptions, moisture, grain size,
                data source attribution, and aquifer indicators.
              </p>
            </div>
          )}

          {/* Hydrological Telemetry Independence Notice */}
          <div className="p-3 rounded-2xl bg-muted/20 dark:bg-navy-950/30 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-cyan-500 shrink-0" />
            <span>
              <strong>Scientific Rule:</strong> Subsurface stratigraphy is documented from drill logs and geophysical
              surveys. Groundwater telemetry operates independently; water levels are never inferred from rock types.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function insiferDate(ts?: string): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return ts;
  }
}
