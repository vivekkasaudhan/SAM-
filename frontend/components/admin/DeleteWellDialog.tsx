'use client';

import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface DeleteWellDialogProps {
  isOpen: boolean;
  well: { id: string; name: string } | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}

export function DeleteWellDialog({
  isOpen,
  well,
  onClose,
  onConfirm,
  deleting,
}: DeleteWellDialogProps) {
  if (!isOpen || !well) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md p-6 rounded-3xl bg-card dark:bg-navy-900 border border-rose-500/30 shadow-2xl space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 id="delete-dialog-title" className="text-lg font-extrabold text-foreground tracking-tight">
              Delete Monitoring Well?
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to delete <strong className="text-foreground">{well.name}</strong> (<code className="font-mono text-cyan-500">{well.id}</code>)?
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/30 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1">
          <div className="font-bold">⚠️ Destructive Operation:</div>
          <p className="opacity-90">
            This action will permanently delete the well registry and cascade-delete all attached sensors, calibration logs, and historical time-series readings. This cannot be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50 dark:border-navy-800">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl border border-border/80 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all active:scale-95 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting Well...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Permanently Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
