import React, { useEffect } from 'react';
import { LogOut, X, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../../types/auth';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  user,
  onConfirm,
  onCancel,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-7 transition-all transform scale-100 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header with Icon */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
            <LogOut className="w-6 h-6" />
          </div>
          <div className="min-w-0 pr-6">
            <h3 id="logout-modal-title" className="text-lg font-bold text-slate-900 tracking-tight">
              Sign out of PixiForge?
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to log out? You will be redirected to the Home page.
            </p>
          </div>
        </div>

        {/* User Account Info Chip */}
        {user && (
          <div className="flex items-center gap-3 p-3.5 my-5 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 text-left">
              <span className="font-semibold text-slate-800 text-sm block truncate">
                {user.name || 'User'}
              </span>
              <span className="text-xs text-slate-500 block truncate">
                {user.email || user.phone || 'Registered Member'}
              </span>
            </div>
            <span className="ml-auto text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 shrink-0">
              {user.plan || 'Free'}
            </span>
          </div>
        )}

        {/* Actions: Cancel and OK / Log Out */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-semibold text-sm transition-all cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-sm transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
