import React, { useState, useEffect } from 'react';
import { X, Key, ShieldCheck, Check, AlertCircle, ExternalLink } from 'lucide-react';
import {
  getActiveRazorpayKey,
  saveActiveRazorpayKey,
  STORAGE_KEY_RAZORPAY_MERCHANT,
} from '../../services/razorpayService';

interface RazorpayKeyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const RazorpayKeyConfigModal: React.FC<RazorpayKeyConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const current = localStorage.getItem(STORAGE_KEY_RAZORPAY_MERCHANT) || '';
      setKeyInput(current);
      setSavedSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanKey = keyInput.trim();

    if (cleanKey && !cleanKey.startsWith('rzp_')) {
      setError('Razorpay Key ID "rzp_test_" किंवा "rzp_live_" ने सुरू असावी (उदा. rzp_live_xxxxxxxx).');
      return;
    }

    saveActiveRazorpayKey(cleanKey);
    setSavedSuccess(true);
    if (onSaved) onSaved();
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const activeKey = getActiveRazorpayKey();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-7 text-slate-800 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
              Razorpay Merchant Key
            </h3>
            <p className="text-xs text-slate-500">
              तुमच्या खात्यात थेट पेमेंट येण्यासाठी तुमची Key ID टाका
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Razorpay Key ID (Key ID)
            </label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="rzp_live_xxxxxxxxxxxxxx किंवा rzp_test_..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Razorpay Dashboard &gt; Settings &gt; API Keys मधून Key ID मिळवा.
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">सध्या कार्यरत Key:</span>
              <span className="font-mono font-bold text-slate-800 text-[11px]">
                {activeKey.slice(0, 10)}•••••
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              * जर तुम्ही तुमची Key टाकली तर सर्व पैसे थेट तुमच्या Razorpay डॅशबोर्डवर जमा होतील.
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Key यशस्वीरीत्या सेव्ह झाली! आता थेट तुमच्या खात्यावर पेमेंट्स येतील.</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-sm cursor-pointer"
            >
              Save Key ID
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
