'use client';

import React from 'react';
import { Waves, Info } from 'lucide-react';

export interface WaterFlowPipeProps {
  /** Pipe geometry: horizontal conduit, vertical riser, or 90-degree elbow manifold */
  orientation?: 'horizontal' | 'vertical' | 'elbow';
  /** Direction of liquid movement */
  flowDirection?: 'forward' | 'reverse';
  /** Whether the pump or gravity flow animation is active */
  active?: boolean;
  /** Numerical flow rate if hardware sensor or calibrated estimate exists */
  flowRateLpm?: number | null;
  /** Whether flow is a conceptual visualization or physical telemetry */
  isConceptual?: boolean;
  /** Width of the component */
  width?: number | string;
  /** Height of the component */
  height?: number | string;
  /** Label describing the hydraulic conduit */
  label?: string;
  /** Additional styling classes */
  className?: string;
}

export function WaterFlowPipe({
  orientation = 'horizontal',
  flowDirection = 'forward',
  active = true,
  flowRateLpm = null,
  isConceptual = true,
  width = '100%',
  height,
  label = 'Aquifer Intake Conduit',
  className = '',
}: WaterFlowPipeProps) {
  const isReverse = flowDirection === 'reverse';

  // Determine container dimensions
  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height:
      height != null
        ? typeof height === 'number'
          ? `${height}px`
          : height
        : orientation === 'vertical'
        ? '160px'
        : '56px',
  };

  return (
    <div
      className={`relative flex flex-col justify-center rounded-2xl p-2.5 bg-card/60 dark:bg-navy-900/60 border border-border/70 dark:border-navy-800 backdrop-blur-md shadow-xs ${className}`}
      style={containerStyle}
      role="region"
      aria-label={`${label}: ${active ? 'Fluid flow active' : 'Fluid flow idle'}`}
    >
      {/* ── Top Header / Label Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] mb-1.5 px-1">
        <div className="flex items-center gap-1.5 text-foreground font-semibold">
          <Waves className={`h-3.5 w-3.5 text-cyan-500 ${active ? 'animate-pulse' : 'opacity-50'}`} />
          <span>{label}</span>
        </div>

        {/* Status / Flow Rate Pill */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {flowRateLpm != null ? (
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 font-bold">
              {flowRateLpm.toFixed(1)} L/min
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 dark:bg-navy-950 text-muted-foreground border border-border/50 text-[10px]"
              title="Conceptual fluid dynamics simulation. No physical in-line flowmeter installed on this wellhead."
            >
              <span>{active ? 'Simulated Inflow' : 'Static Aquifer Head'}</span>
              <Info className="h-2.5 w-2.5 opacity-60" />
            </span>
          )}
        </div>
      </div>

      {/* ── Animated Transparent Pipe SVG ────────────────────────── */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden rounded-xl">
        {orientation === 'horizontal' && (
          <svg
            className="w-full h-8 overflow-visible"
            viewBox="0 0 400 32"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Liquid Core Gradient */}
              <linearGradient id="pipeWaterGradH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9" />
              </linearGradient>

              {/* Glass Tube Specular Reflection */}
              <linearGradient id="glassReflectionH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="25%" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="70%" stopColor="#ffffff" stopOpacity="0.0" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
              </linearGradient>

              {/* Flange Metal Gradient */}
              <linearGradient id="flangeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="50%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
            </defs>

            {/* Left Coupling Flange Collar */}
            <rect x="0" y="2" width="10" height="28" rx="2" fill="url(#flangeGrad)" stroke="#475569" strokeWidth="0.8" />
            <circle cx="5" cy="8" r="1.5" fill="#1e293b" />
            <circle cx="5" cy="24" r="1.5" fill="#1e293b" />

            {/* Right Coupling Flange Collar */}
            <rect x="390" y="2" width="10" height="28" rx="2" fill="url(#flangeGrad)" stroke="#475569" strokeWidth="0.8" />
            <circle cx="395" cy="8" r="1.5" fill="#1e293b" />
            <circle cx="395" cy="24" r="1.5" fill="#1e293b" />

            {/* Outer Transparent Glass Pipe Body */}
            <rect
              x="10"
              y="5"
              width="380"
              height="22"
              rx="4"
              fill="rgba(6, 182, 212, 0.08)"
              stroke="rgba(255, 255, 255, 0.35)"
              strokeWidth="1.2"
              className="dark:stroke-cyan-500/30"
            />

            {/* Inner Flowing Water Stream */}
            {active && (
              <>
                <rect
                  x="12"
                  y="7"
                  width="376"
                  height="18"
                  rx="3"
                  fill="url(#pipeWaterGradH)"
                />

                {/* Animated Stream Lines / Dash Pattern */}
                <line
                  x1="12"
                  y1="13"
                  x2="388"
                  y2="13"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="18 14"
                  strokeLinecap="round"
                  opacity="0.65"
                  className="motion-safe:animate-[pipeFlowH_2.2s_linear_infinite] motion-reduce:animate-none"
                  style={{
                    animationDirection: isReverse ? 'reverse' : 'normal',
                  }}
                />
                <line
                  x1="12"
                  y1="20"
                  x2="388"
                  y2="20"
                  stroke="#cffafe"
                  strokeWidth="1.2"
                  strokeDasharray="12 18"
                  strokeLinecap="round"
                  opacity="0.5"
                  className="motion-safe:animate-[pipeFlowH_1.8s_linear_infinite] motion-reduce:animate-none"
                  style={{
                    animationDirection: isReverse ? 'reverse' : 'normal',
                  }}
                />

                {/* Drifting Micro-Bubbles */}
                <circle cx="80" cy="14" r="1.5" fill="#ffffff" opacity="0.75" />
                <circle cx="190" cy="18" r="2" fill="#ffffff" opacity="0.6" />
                <circle cx="290" cy="12" r="1.2" fill="#ffffff" opacity="0.8" />
              </>
            )}

            {/* Glass Surface Specular Glare (Top Refraction) */}
            <rect
              x="10"
              y="5"
              width="380"
              height="8"
              rx="2"
              fill="url(#glassReflectionH)"
              pointerEvents="none"
            />
          </svg>
        )}

        {orientation === 'vertical' && (
          <svg
            className="w-12 h-full overflow-visible"
            viewBox="0 0 32 160"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="pipeWaterGradV" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Top Coupling Flange */}
            <rect x="2" y="0" width="28" height="10" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />
            {/* Bottom Coupling Flange */}
            <rect x="2" y="150" width="28" height="10" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="0.8" />

            {/* Transparent Pipe */}
            <rect
              x="5"
              y="10"
              width="22"
              height="140"
              rx="4"
              fill="rgba(6, 182, 212, 0.08)"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="1.2"
              className="dark:stroke-cyan-500/30"
            />

            {/* Flowing Water Column */}
            {active && (
              <>
                <rect x="7" y="12" width="18" height="136" rx="3" fill="url(#pipeWaterGradV)" />
                <line
                  x1="16"
                  y1="12"
                  x2="16"
                  y2="148"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="16 12"
                  strokeLinecap="round"
                  opacity="0.6"
                  className="motion-safe:animate-[pipeFlowV_2.2s_linear_infinite] motion-reduce:animate-none"
                  style={{ animationDirection: isReverse ? 'reverse' : 'normal' }}
                />
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
