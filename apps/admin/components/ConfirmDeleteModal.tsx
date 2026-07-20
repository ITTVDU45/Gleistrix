'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  itemCount: number;
  itemType?: string;
  confirmText?: string;
  title?: string;
  description?: string;
}

/**
 * Wiederverwendbare Bestätigungs-Modal für Löschvorgänge
 * 
 * Erfordert Eingabe eines Bestätigungstextes (default: "Löschen")
 * Zeigt Warnung und ist modular für verschiedene Bereiche nutzbar
 */
export function ConfirmDeleteModal({
  isOpen,
  onConfirm,
  onCancel,
  itemCount,
  itemType = 'Elemente',
  confirmText = 'Löschen',
  title,
  description
}: ConfirmDeleteModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isDeleting, onCancel]);

  const isConfirmEnabled = inputValue.trim().toLowerCase() === confirmText.toLowerCase();

  const handleConfirm = useCallback(async () => {
    if (!isConfirmEnabled || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setIsDeleting(false);
    }
  }, [isConfirmEnabled, isDeleting, onConfirm]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmEnabled && !isDeleting) {
      handleConfirm();
    }
  }, [isConfirmEnabled, isDeleting, handleConfirm]);

  if (!isOpen) return null;

  const displayTitle = title || `${itemCount} ${itemCount === 1 ? itemType.replace(/e$/, '') : itemType} endgültig löschen?`;
  const displayDescription = description || `Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Daten werden ebenfalls gelöscht.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!isDeleting ? onCancel : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-center text-slate-900 dark:text-white mb-2">
          {displayTitle}
        </h2>

        {/* Description */}
        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
          {displayDescription}
        </p>

        {/* Confirm Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Geben Sie <span className="font-bold text-red-600 dark:text-red-400">"{confirmText}"</span> ein, um zu bestätigen:
          </label>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={confirmText}
            disabled={isDeleting}
            autoFocus
            className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 
                       bg-white dark:bg-slate-700 text-slate-900 dark:text-white
                       focus:ring-2 focus:ring-red-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600
                       text-slate-700 dark:text-slate-300 font-medium
                       hover:bg-slate-100 dark:hover:bg-slate-700
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isDeleting}
            className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-medium
                       hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 transition-colors"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Löschen...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Endgültig löschen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
