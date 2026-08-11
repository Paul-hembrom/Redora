import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2, Layers, AlertOctagon } from 'lucide-react';

export interface DeleteChapterTarget {
  id: string;
  title: string;
}

interface DeleteChapterModalProps {
  isOpen: boolean;
  target: DeleteChapterTarget | null;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export default function DeleteChapterModal({
  isOpen,
  target,
  onClose,
  onSuccess,
}: DeleteChapterModalProps) {
  const [isCascadeRequired, setIsCascadeRequired] = useState(false);
  const [childCount, setChildCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsCascadeRequired(false);
      setChildCount(0);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, target]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !target) return null;

  const handleDelete = async (cascade = false) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const url = `/api/chapters/${target.id}${cascade ? '?cascade=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
      
      if (res.ok) {
        onSuccess(target.id);
        onClose();
        return;
      }

      const body = await res.json().catch(() => ({}));

      // 409 Conflict = chapter contains child sections that require cascade deletion
      if (res.status === 409 && body?.canCascade) {
        setIsCascadeRequired(true);
        setChildCount(body.childCount || 1);
        setIsSubmitting(false);
        return;
      }

      throw new Error(body?.error || `Deletion failed (HTTP ${res.status})`);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while deleting.');
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div 
        className="bg-[#0f0f11] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Red Accent Glow */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className={`p-3 rounded-xl border flex items-center justify-center shrink-0 ${
            isCascadeRequired 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'bg-red-500/10 border-red-500/30 text-red-400 shadow-lg shadow-red-500/10'
          }`}>
            {isCascadeRequired ? (
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            ) : (
              <Trash2 className="w-6 h-6" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-display font-semibold text-white tracking-tight">
              {isCascadeRequired ? 'Cascade Delete Required' : 'Delete Chapter'}
            </h3>
            <p className="text-xs text-white/50 font-normal">
              {isCascadeRequired 
                ? 'Multiple nested sections detected' 
                : 'Confirm chapter removal'}
            </p>
          </div>
        </div>

        {/* Target Topic Callout Box */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5 mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-red-400 font-semibold text-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-white/40">Target Chapter / Section</div>
            <div className="text-sm font-medium text-white truncate">{target.title}</div>
          </div>
        </div>

        {/* Content Views */}
        {!isCascadeRequired ? (
          <div className="space-y-3 mb-6 text-xs text-white/70 leading-relaxed font-normal">
            <p>
              Are you sure you want to delete <strong className="text-white font-semibold">"{target.title}"</strong>?
            </p>
            <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-xl text-red-300 text-[11px] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                All associated chat conversations, exercises, and study notes for this section will be permanently deleted. This cannot be undone.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mb-6 text-xs leading-relaxed">
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-200 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
                <AlertOctagon className="w-4 h-4 shrink-0" />
                <span>Chapter Contains {childCount} Sub-section{childCount > 1 ? 's' : ''}</span>
              </div>
              <p className="text-amber-200/90 text-[11px] leading-normal">
                This chapter cannot be deleted on its own because it contains child topics. Deleting it will perform a <strong className="text-amber-300 font-semibold">cascade delete</strong> that permanently removes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-100/80 pl-1">
                <li>The parent chapter <span className="text-amber-200">"{target.title}"</span></li>
                <li>All <strong className="text-amber-300">{childCount} nested sub-section{childCount > 1 ? 's' : ''}</strong></li>
                <li>All chat histories, summaries, and student data across all child sections</li>
              </ul>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {!isCascadeRequired ? (
            <button
              type="button"
              onClick={() => handleDelete(false)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-lg shadow-red-600/20 border border-red-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Chapter</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleDelete(true)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 active:bg-red-700 shadow-lg shadow-red-600/30 border border-red-500/40 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting All...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Chapter & {childCount} Section{childCount > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
