import React from 'react';
import { useImageStore } from '../../store/useImageStore';
import { Sparkles, Check, X, ShieldCheck } from 'lucide-react';

interface PlanLimitModalProps {
  onNavigateToPricing?: () => void;
}

export const PlanLimitModal: React.FC<PlanLimitModalProps> = ({ onNavigateToPricing }) => {
  const { planModalOpen, planModalMessage, setPlanModalOpen, setPro } = useImageStore();

  if (!planModalOpen) return null;

  const handleTestPro = () => {
    setPro(true);
    setPlanModalOpen(false);
  };

  const handleViewPricing = () => {
    setPlanModalOpen(false);
    if (onNavigateToPricing) {
      onNavigateToPricing();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800">
        <button
          onClick={() => setPlanModalOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">Plan Limit Reached</h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            {planModalMessage ||
              'Need to process larger batches or bigger images? Upgrade to Pro, Max, or Ultra for higher processing limits.'}
          </p>

          <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Pro:</strong> 100 images / batch & 100 MB</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-indigo-500 shrink-0" />
              <span><strong>Max:</strong> 300 images / batch & 250 MB</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-amber-500 shrink-0" />
              <span><strong>Ultra:</strong> 1,000 images / batch & 1 GB files</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleViewPricing}
              className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>View All 4 Plans</span>
            </button>
            <button
              onClick={handleTestPro}
              className="py-3 px-4 rounded-xl font-medium text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              title="Test upgraded features immediately"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Quick Test</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
