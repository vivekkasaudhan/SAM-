'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  Droplets,
  AlertTriangle,
  FileSpreadsheet,
  Columns,
  Sparkles,
  Info,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { LithologyLayer, GeologyProfile, getMaterialLabel } from '@/types/lithology';
import { lithologyService, authService, canManageWell } from '@/services/api';
import { VerticalGeologyProfile } from './VerticalGeologyProfile';
import { LithologyLayerList } from './LithologyLayerList';
import { LithologyLayerModal } from './LithologyLayerModal';
import { DeleteLayerDialog } from './DeleteLayerDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface LithologySectionProps {
  well: any;
  waterLevelM?: number | null;
  onProfileUpdated?: () => void;
}

export function LithologySection({
  well,
  waterLevelM,
  onProfileUpdated,
}: LithologySectionProps) {
  const [profile, setProfile] = useState<GeologyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // View mode: 'split' (Profile + Inspector) vs 'table' (Tabular sequence)
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [layerToEdit, setLayerToEdit] = useState<LithologyLayer | null>(null);
  const [layerToDelete, setLayerToDelete] = useState<LithologyLayer | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<LithologyLayer | null>(null);

  // Seeding demo state
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const currentUser = React.useMemo(() => authService.getCurrentUser(), []);
  const canManage = React.useMemo(() => canManageWell(currentUser, well), [currentUser, well]);

  const fetchProfile = useCallback(async () => {
    if (!well?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await lithologyService.getProfile(well.id);
      setProfile(data);
      if (data.stratigraphic_column?.length > 0) {
        setSelectedLayer(data.stratigraphic_column[0]);
      } else {
        setSelectedLayer(null);
      }
    } catch (err: any) {
      console.error('Failed to load geological profile:', err);
      setError(err?.response?.data?.detail || 'Failed to retrieve subsurface stratigraphy profile.');
    } finally {
      setLoading(false);
    }
  }, [well?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Seed illustrative demo layers
  const handleSeedDemo = async () => {
    if (!well?.id) return;
    setSeedingDemo(true);
    setError(null);
    setSuccessBanner(null);
    try {
      const resp = await lithologyService.seedDemoLayers(well.id);
      setSuccessBanner(resp.message || 'Illustrative demo stratigraphy successfully loaded.');
      await fetchProfile();
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      console.error('Failed to seed demo stratigraphy:', err);
      setError(err?.response?.data?.detail || 'Failed to seed illustrative demo stratigraphy.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleLayerSaved = () => {
    fetchProfile();
    if (onProfileUpdated) onProfileUpdated();
    setSuccessBanner('Stratigraphic layer saved successfully.');
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  const handleLayerDeleted = () => {
    fetchProfile();
    if (onProfileUpdated) onProfileUpdated();
    setSuccessBanner('Stratigraphic layer removed successfully.');
    setTimeout(() => setSuccessBanner(null), 4000);
  };

  return (
    <div className="space-y-5">
      {/* ── Top Action & Summary Bar ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-3xl bg-muted/20 dark:bg-navy-950/40 border border-border/70 dark:border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-foreground tracking-tight">
              Subsurface Stratigraphy & Lithology Logging
            </h3>
            {profile && profile.layer_count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                {profile.depth_coverage_pct.toFixed(0)}% Logged
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Geological layers, hydraulic conductivity, unlogged intervals, and potential aquifer horizons
          </p>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center p-1 rounded-xl bg-card dark:bg-navy-900 border border-border/60 text-xs">
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'visual'
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vertical Stratigraphic Column View"
            >
              <Columns className="h-3.5 w-3.5" />
              <span>Visual Column</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Tabular Succession Sequence"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Data Table</span>
            </button>
          </div>

          <button
            onClick={fetchProfile}
            disabled={loading}
            className="p-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
            title="Refresh Geological Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>

          {canManage && (
            <button
              onClick={() => {
                setLayerToEdit(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs shadow-xs hover:shadow-glow-aqua transition-all active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Stratum</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !profile ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-destructive/10 border border-destructive/30 text-destructive text-center space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
          <div className="font-bold text-sm">Failed to Load Stratigraphy</div>
          <p className="text-xs max-w-md mx-auto opacity-90">{error}</p>
        </div>
      ) : profile && profile.layer_count === 0 ? (
        /* ── Informative Empty State ───────────────────────────────── */
        <div className="p-8 sm:p-12 rounded-3xl bg-card/60 dark:bg-navy-900/60 border border-dashed border-border/80 dark:border-navy-750 text-center space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
            <Layers className="h-10 w-10 animate-pulse" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h4 className="text-lg font-bold text-foreground">No Subsurface Lithology Recorded</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No geological strata or drilling logs have been attached to this monitoring station yet.
              {canManage
                ? ' Log the first physical borehole layer or load an illustrative demo profile for visualization.'
                : ' Stratigraphic logging is managed by authorized administrators.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {canManage ? (
              <>
                <button
                  onClick={() => {
                    setLayerToEdit(null);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 via-cyan-600 to-teal-500 hover:from-brand-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Geological Stratum</span>
                </button>

                <button
                  onClick={handleSeedDemo}
                  disabled={seedingDemo}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                  title="Generate a 30m illustrative demo profile for testing"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>{seedingDemo ? 'Generating Demo Strata...' : 'Load Illustrative Demo (30m Profile)'}</span>
                </button>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-muted-foreground text-xs font-semibold">
                <Lock className="h-3.5 w-3.5" />
                Read-only: Contact well creator to submit borehole core logs.
              </span>
            )}
          </div>
        </div>
      ) : (
        profile && (
          <>
            {/* ── Summary Parameter Tiles (4 Metrics) ───────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Total Logged Depth */}
              <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/70 dark:border-navy-800 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Logged Depth
                </span>
                <div className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400">
                  {profile.total_logged_depth_m.toFixed(1)} m
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {well.total_depth_m ? `of ${well.total_depth_m}m total well` : 'Ground surface datum'}
                </div>
              </div>

              {/* Stratigraphic Horizons */}
              <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/70 dark:border-navy-800 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Layer Horizons
                </span>
                <div className="text-xl font-black font-mono text-foreground">
                  {profile.layer_count} <span className="text-xs font-normal text-muted-foreground">strata</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Dominant: <strong>{profile.dominant_material ? getMaterialLabel(profile.dominant_material) : '--'}</strong>
                </div>
              </div>

              {/* Aquifer Horizons */}
              <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/70 dark:border-navy-800 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Aquifer Units
                </span>
                <div className="text-xl font-black font-mono text-teal-600 dark:text-teal-400 flex items-baseline gap-1">
                  <span>{profile.aquifer_layers_count}</span>
                  <span className="text-xs font-normal text-muted-foreground">potential</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {profile.has_aquifer_layer ? 'Water-bearing strata present' : 'No aquifers identified'}
                </div>
              </div>

              {/* Unlogged Gaps */}
              <div className="p-3.5 rounded-2xl bg-card dark:bg-navy-900 border border-border/70 dark:border-navy-800 shadow-2xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Borehole Gaps
                </span>
                <div
                  className={`text-xl font-black font-mono ${
                    profile.gaps.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {profile.gaps.length}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {profile.gaps.length === 1 ? 'gap' : 'gaps'}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {profile.gaps.length === 0 ? 'Continuous stratigraphy' : 'Unlogged intervals present'}
                </div>
              </div>
            </div>

            {/* ── Active View Mode (Visual vs Table) ─────────────────── */}
            {viewMode === 'visual' ? (
              <VerticalGeologyProfile
                layers={profile.stratigraphic_column}
                gaps={profile.gaps}
                wellTotalDepthM={profile.well_total_depth_m}
                totalLoggedDepthM={profile.total_logged_depth_m}
                waterLevelM={waterLevelM}
                warningLevelM={well.warning_level_m}
                dangerLevelM={well.danger_level_m}
                selectedLayerId={selectedLayer?.id}
                onSelectLayer={(l) => setSelectedLayer(l)}
              />
            ) : (
              <LithologyLayerList
                layers={profile.stratigraphic_column}
                gaps={profile.gaps}
                canManage={canManage}
                onEditLayer={(layer) => {
                  setLayerToEdit(layer);
                  setIsModalOpen(true);
                }}
                onDeleteLayer={(layer) => setLayerToDelete(layer)}
                onSelectLayer={(layer) => {
                  setSelectedLayer(layer);
                  setViewMode('visual');
                }}
              />
            )}

            {/* Secondary Option: Seed Demo Replace or Add */}
            {canManage && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 border border-border/60 text-xs">
                <div className="text-muted-foreground">
                  Need representative test data? You can populate an illustrative 30 m benchmark stratigraphy.
                </div>
                <button
                  onClick={handleSeedDemo}
                  disabled={seedingDemo}
                  className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold transition-all disabled:opacity-50"
                >
                  {seedingDemo ? 'Loading...' : 'Populate 30m Demo Strata'}
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* ── Add / Edit Layer Modal ──────────────────────────────────── */}
      {isModalOpen && (
        <LithologyLayerModal
          wellId={well.id}
          wellName={well.name}
          wellTotalDepthM={well.total_depth_m || profile?.well_total_depth_m}
          layerToEdit={layerToEdit}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onLayerSaved={handleLayerSaved}
        />
      )}

      {/* ── Delete Confirmation Dialog ─────────────────────────────── */}
      {layerToDelete && (
        <DeleteLayerDialog
          wellId={well.id}
          layer={layerToDelete}
          isOpen={!!layerToDelete}
          onClose={() => setLayerToDelete(null)}
          onDeleted={handleLayerDeleted}
        />
      )}
    </div>
  );
}
