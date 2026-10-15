'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { LithologyLayer, getMaterialLabel } from '@/types/lithology';
import { lithologyService } from '@/services/api';

interface DeleteLayerDialogProps {
  layer: LithologyLayer | null;
  wellId: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (layerId: number) => void;
}

export function DeleteLayerDialog({
  layer,
  wellId,
  isOpen,
  onClose,
  onDeleted,
}: DeleteLayerDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !layer) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await lithologyService.deleteLayer(wellId, layer.id);
      onDeleted(layer.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete layer:', err);
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to delete geological layer.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-md animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-layer-title"
      aria-describedby="delete-layer-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-card dark:bg-navy-900 border border-border/80 dark:border-navy-750 shadow-2xl p-6 space-y-4">
        {/* Warning Icon & Heading */}
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h3 id="delete-layer-title" className="text-lg font-black text-foreground">
              Delete Geological Stratum?
            </h3>
            <p id="delete-layer-desc" className="text-xs text-muted-foreground mt-1">
              Are you sure you want to remove this logged geological layer from well{' '}
              <strong className="text-foreground">{wellId}</strong>?
            </p>
          </div>
        </div>

        {/* Stratum Details Card */}
        <div className="p-3.5 rounded-2xl bg-muted/40 dark:bg-navy-950/40 border border-border/60 text-xs space-y-1 font-mono">
          <div className="font-bold text-foreground">
            {getMaterialLabel(layer.material_type)}
          </div>
          <div className="text-muted-foreground">
            Interval: {layer.from_depth_m.toFixed(2)} m – {layer.to_depth_m.toFixed(2)} m ({layer.thickness_m.toFixed(2)} m thickness)
          </div>
          {layer.data_source === 'illustrative_demo' && (
            <div className="text-amber-600 dark:text-amber-400 font-sans text-[11px] pt-1">
              * Note: This is an illustrative demo layer.
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs">
            {error}
          </div>
        )}

        <div className="text-[11px] text-muted-foreground italic">
          This operation permanently removes this stratigraphic stratum and updates the well's logged coverage.
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold shadow-md shadow-destructive/20 transition-all active:scale-95 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Deletion</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
