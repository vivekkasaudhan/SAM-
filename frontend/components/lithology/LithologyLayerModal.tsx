'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Save,
  AlertOctagon,
  AlertTriangle,
  Info,
  Droplets,
  FileText,
  ShieldCheck,
  Link as LinkIcon,
} from 'lucide-react';
import {
  LithologyLayer,
  ConfidenceLevel,
  MATERIAL_METADATA,
  getMaterialLabel,
  getMaterialColor,
} from '@/types/lithology';
import { lithologyService } from '@/services/api';

interface LithologyLayerModalProps {
  wellId: string;
  wellName?: string;
  wellTotalDepthM?: number | null;
  layerToEdit?: LithologyLayer | null;
  isOpen: boolean;
  onClose: () => void;
  onLayerSaved: (layer: LithologyLayer) => void;
}

export function LithologyLayerModal({
  wellId,
  wellName,
  wellTotalDepthM,
  layerToEdit,
  isOpen,
  onClose,
  onLayerSaved,
}: LithologyLayerModalProps) {
  const isEditing = Boolean(layerToEdit);

  // Form states
  const [fromDepth, setFromDepth] = useState<string>('');
  const [toDepth, setToDepth] = useState<string>('');
  const [materialType, setMaterialType] = useState<string>('sand');
  const [colorCode, setColorCode] = useState<string>('#E6C280');
  const [description, setDescription] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('CORE_SAMPLE');
  const [confidenceLevel, setConfidenceLevel] = useState<ConfidenceLevel>('HIGH');
  const [aquiferIndicator, setAquiferIndicator] = useState<boolean>(false);
  const [sourceReference, setSourceReference] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>('');

  // Observed properties
  const [moisture, setMoisture] = useState<string>('Damp');
  const [grainSize, setGrainSize] = useState<string>('Medium');
  const [plasticity, setPlasticity] = useState<string>('Non-plastic');
  const [permeability, setPermeability] = useState<string>('Moderate');

  const [saving, setSaving] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Populate form on edit / open
  useEffect(() => {
    if (layerToEdit) {
      setFromDepth(String(layerToEdit.from_depth_m));
      setToDepth(String(layerToEdit.to_depth_m));
      setMaterialType(layerToEdit.material_type || 'sand');
      setColorCode(layerToEdit.color_code || getMaterialColor(layerToEdit.material_type));
      setDescription(layerToEdit.description || '');
      setDataSource(layerToEdit.data_source || 'CORE_SAMPLE');
      setConfidenceLevel(layerToEdit.confidence_level || 'HIGH');
      setAquiferIndicator(Boolean(layerToEdit.aquifer_indicator));
      setSourceReference(layerToEdit.source_reference || '');
      setAttachmentUrl(layerToEdit.attachment_url || '');

      const props = layerToEdit.observed_properties || {};
      setMoisture(props.moisture || 'Damp');
      setGrainSize(props.grain_size || 'Medium');
      setPlasticity(props.plasticity || 'Non-plastic');
      setPermeability(props.permeability || 'Moderate');
    } else {
      // Defaults for new layer
      setFromDepth('');
      setToDepth('');
      setMaterialType('sand');
      setColorCode(MATERIAL_METADATA.sand.defaultColor);
      setDescription('');
      setDataSource('CORE_SAMPLE');
      setConfidenceLevel('HIGH');
      setAquiferIndicator(false);
      setSourceReference('');
      setAttachmentUrl('');
      setMoisture('Damp');
      setGrainSize('Medium');
      setPlasticity('Non-plastic');
      setPermeability('Moderate');
    }
    setClientError(null);
    setApiError(null);
  }, [layerToEdit, isOpen]);

  // Handle material type change to update default color
  const handleMaterialChange = (newType: string) => {
    setMaterialType(newType);
    const meta = MATERIAL_METADATA[newType];
    if (meta) {
      setColorCode(meta.defaultColor);
      // Auto-set sensible aquifer default for sand/gravel
      if (newType === 'sand' || newType === 'gravel' || newType === 'fractured_rock') {
        setAquiferIndicator(true);
        setPermeability('High');
      } else if (newType === 'clay' || newType === 'granite') {
        setAquiferIndicator(false);
        setPermeability('Very Low');
      }
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setApiError(null);

    const fDepth = parseFloat(fromDepth);
    const tDepth = parseFloat(toDepth);

    // Frontend validations
    if (isNaN(fDepth) || fDepth < 0) {
      setClientError('Start depth must be a non-negative number (0 metres or deeper).');
      return;
    }
    if (isNaN(tDepth) || tDepth <= 0) {
      setClientError('End depth must be a positive number greater than 0 metres.');
      return;
    }
    if (tDepth <= fDepth) {
      setClientError(`End depth (${tDepth}m) must be strictly greater than start depth (${fDepth}m).`);
      return;
    }
    if (wellTotalDepthM && wellTotalDepthM > 0 && tDepth > wellTotalDepthM + 0.05) {
      setClientError(`End depth (${tDepth}m) exceeds well total depth policy (${wellTotalDepthM}m).`);
      return;
    }

    const payload = {
      from_depth_m: fDepth,
      to_depth_m: tDepth,
      material_type: materialType,
      description: description.trim() || undefined,
      color_code: colorCode || undefined,
      data_source: dataSource,
      confidence_level: confidenceLevel,
      aquifer_indicator: aquiferIndicator,
      source_reference: sourceReference.trim() || undefined,
      attachment_url: attachmentUrl.trim() || undefined,
      observed_properties: {
        moisture,
        grain_size: grainSize,
        plasticity,
        permeability,
      },
    };

    setSaving(true);
    try {
      let saved: LithologyLayer;
      if (isEditing && layerToEdit) {
        saved = await lithologyService.updateLayer(wellId, layerToEdit.id, payload);
      } else {
        saved = await lithologyService.createLayer(wellId, payload);
      }
      onLayerSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save geological layer:', err);
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setApiError(detail);
      } else if (Array.isArray(detail)) {
        setApiError(detail.map((d: any) => d.msg || d).join(', '));
      } else {
        setApiError('Failed to save geological layer. Please review depth interval boundaries.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-navy-950/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lithology-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60 dark:border-navy-800 bg-muted/20 dark:bg-navy-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 id="lithology-modal-title" className="text-lg font-black text-foreground">
                {isEditing ? 'Edit Geological Stratum' : 'Add Geological Stratum'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {wellName ? `Well: ${wellName} (${wellId})` : `Well ID: ${wellId}`}
                {wellTotalDepthM && ` • Total Well Depth: ${wellTotalDepthM}m`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Validation Error Alerts */}
          {(clientError || apiError) && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertOctagon className="h-4 w-4 shrink-0" />
                <span>Geological Interval Validation Error</span>
              </div>
              <p className="text-xs leading-relaxed">{clientError || apiError}</p>
            </div>
          )}

          {/* Section 1: Depths & Material Type */}
          <div className="space-y-3">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>1. Stratigraphic Interval & Rock Classification</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* From Depth */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span>Start Depth (m) *</span>
                  <span className="text-[10px] text-muted-foreground font-mono">From surface (≥ 0)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={fromDepth}
                  onChange={(e) => setFromDepth(e.target.value)}
                  placeholder="e.g. 0.0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* To Depth */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground flex items-center justify-between">
                  <span>End Depth (m) *</span>
                  <span className="text-[10px] text-muted-foreground font-mono">&gt; Start depth</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={toDepth}
                  onChange={(e) => setToDepth(e.target.value)}
                  placeholder="e.g. 3.5"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-background text-foreground font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Material Type Selector */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Geological Material / Lithology Type *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(MATERIAL_METADATA).map(([key, meta]) => {
                  const isSelected = materialType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleMaterialChange(key)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500'
                          : 'border-border/60 hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-sm border border-black/30 shrink-0"
                        style={{ backgroundColor: meta.defaultColor }}
                      />
                      <span className="truncate font-semibold text-[11px]">{getMaterialLabel(key)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Customization */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 border border-border/50">
              <span
                className="w-8 h-8 rounded-xl border border-black/30 shadow-xs shrink-0"
                style={{ backgroundColor: colorCode }}
              />
              <div className="flex-1">
                <span className="text-[11px] font-semibold text-foreground block">Stratum Display Color (HEX)</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Default: {MATERIAL_METADATA[materialType]?.defaultColor || '#94A3B8'}
                </span>
              </div>
              <input
                type="color"
                value={colorCode}
                onChange={(e) => setColorCode(e.target.value)}
                className="w-10 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                title="Pick customized stratum color"
              />
            </div>
          </div>

          {/* Section 2: Hydrogeology & Aquifer Indicator */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>2. Hydrogeology & Aquifer Interpretation</span>
            </h4>

            {/* Aquifer Checkbox Toggle */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 cursor-pointer">
              <input
                type="checkbox"
                checked={aquiferIndicator}
                onChange={(e) => setAquiferIndicator(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-cyan-600 rounded border-border/80 focus:ring-cyan-500"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5" />
                  Mark as Potential Aquifer Horizon
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Check this if the stratum has sufficient intergranular or fracture permeability to yield groundwater.
                  Labeled as potential, not confirmed, unless proven by pumping tests.
                </p>
              </div>
            </label>

            {/* Observed Geotechnical Properties */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-semibold text-muted-foreground text-[10px] uppercase">Moisture</label>
                <select
                  value={moisture}
                  onChange={(e) => setMoisture(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-border/70 bg-background text-foreground"
                >
                  <option value="Dry">Dry</option>
                  <option value="Damp">Damp</option>
                  <option value="Wet">Wet</option>
                  <option value="Saturated">Saturated</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground text-[10px] uppercase">Grain Size</label>
                <select
                  value={grainSize}
                  onChange={(e) => setGrainSize(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-border/70 bg-background text-foreground"
                >
                  <option value="Very Fine">Very Fine</option>
                  <option value="Fine">Fine</option>
                  <option value="Medium">Medium</option>
                  <option value="Coarse">Coarse</option>
                  <option value="Very Coarse">Very Coarse</option>
                  <option value="Graded">Graded</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground text-[10px] uppercase">Plasticity</label>
                <select
                  value={plasticity}
                  onChange={(e) => setPlasticity(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-border/70 bg-background text-foreground"
                >
                  <option value="Non-plastic">Non-plastic</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground text-[10px] uppercase">Permeability</label>
                <select
                  value={permeability}
                  onChange={(e) => setPermeability(e.target.value)}
                  className="w-full mt-1 p-2 rounded-xl border border-border/70 bg-background text-foreground"
                >
                  <option value="Very Low">Very Low (Aquitard)</option>
                  <option value="Low">Low</option>
                  <option value="Moderate">Moderate</option>
                  <option value="High">High (Aquifer)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Data Provenance & Attribution */}
          <div className="space-y-3 pt-2 border-t border-border/60">
            <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>3. Data Provenance & Confidence</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-semibold text-foreground">Data Logging Source *</label>
                <select
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value)}
                  className="w-full mt-1.5 p-2.5 rounded-xl border border-border/70 bg-background text-foreground"
                >
                  <option value="CORE_SAMPLE">Borehole Core Sample (Verified)</option>
                  <option value="DRILL_CUTTINGS">Drilling Log / Cuttings (Verified)</option>
                  <option value="GEOPHYSICAL_LOG">Geophysical Well Log (Verified)</option>
                  <option value="HISTORICAL_RECORD">Historical Geological Report (Verified)</option>
                  <option value="FIELD_OBSERVATION">Field Geological Observation</option>
                  <option value="ESTIMATED">Estimated / Inferred Stratigraphy</option>
                  <option value="illustrative_demo">Illustrative Demo Strata (Testing only)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground">Confidence Level *</label>
                <select
                  value={confidenceLevel}
                  onChange={(e) => setConfidenceLevel(e.target.value as ConfidenceLevel)}
                  className="w-full mt-1.5 p-2.5 rounded-xl border border-border/70 bg-background text-foreground"
                >
                  <option value="HIGH">HIGH — Verified by physical core / caliper</option>
                  <option value="MEDIUM">MEDIUM — Drill cuttings or regional log</option>
                  <option value="LOW">LOW — Estimated / inferred boundary</option>
                </select>
              </div>
            </div>

            {/* Field Description */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Geological Description & Textural Observations</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Coarse sub-angular quartz sand with weathered feldspar clasts. Saturated with high hydraulic conductivity."
                className="w-full p-3 rounded-xl border border-border/70 bg-background text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500 leading-relaxed"
              />
            </div>

            {/* Source Reference & URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Source Reference (Optional)</label>
                <input
                  type="text"
                  value={sourceReference}
                  onChange={(e) => setSourceReference(e.target.value)}
                  placeholder="e.g. Core Box #3, GSI Report 2024-B"
                  className="w-full px-3 py-2 rounded-xl border border-border/70 bg-background text-foreground text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Attachment Link (Optional)</label>
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://example.org/borehole-photo.jpg"
                  className="w-full px-3 py-2 rounded-xl border border-border/70 bg-background text-foreground text-xs"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-cyan-600 to-teal-500 hover:from-brand-500 hover:to-cyan-500 text-white font-bold shadow-md shadow-brand-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Stratum...' : isEditing ? 'Update Stratum' : 'Save Stratum'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
