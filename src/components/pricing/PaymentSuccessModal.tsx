import React from 'react';
import {
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { PlanType, BillingCycle } from '../../types';
import {
  PLAN_PRICING,
  getBillingCycleOption,
  calculatePlanExpiryDate,
} from '../../services/razorpayService';
import { formatCurrency } from '../../config/currencies';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  paymentId: string;
  plan: PlanType;
  billingCycle?: BillingCycle;
  autoPayEnabled?: boolean;
  amount: number;
  currency?: string;
  onClose: () => void;
  onNavigateHome: () => void;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  paymentId,
  plan,
  billingCycle = 'monthly',
  autoPayEnabled = false,
  amount,
  currency = 'INR',
  onClose,
  onNavigateHome,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const planInfo = plan !== 'free' ? PLAN_PRICING[plan] : null;
  const cycleOpt = getBillingCycleOption(billingCycle);
  const expiryDateStr = new Date(calculatePlanExpiryDate(billingCycle)).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleCopyPaymentId = () => {
    navigator.clipboard.writeText(paymentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200"
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

        {/* Animated Celebration Icon */}
        <div className="mx-auto w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <span className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
          Payment Successful • Razorpay Verified
        </span>

        <h3 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
          Welcome to {planInfo?.name || 'Pro Membership'}!
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Your payment has been verified and your new membership limits are now live across all tools in PixiForge.
        </p>

        {/* Receipt Box */}
        <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500">Plan Activated</span>
            <span className="font-bold text-slate-900 capitalize">
              {plan} Membership ({cycleOpt.label})
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500">Valid Till</span>
            <span className="font-bold text-slate-800">{expiryDateStr}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500">AutoPay Renewal</span>
            <span className={`font-bold ${autoPayEnabled ? 'text-emerald-700' : 'text-slate-600'}`}>
              {autoPayEnabled ? 'ON (Auto-Renews)' : 'OFF (One-Time)'}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-bold text-emerald-700">
              {formatCurrency(amount, currency, { includeCode: true })}
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
            <span className="text-slate-500">Payment ID</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-800">
              <span>{paymentId}</span>
              <button
                type="button"
                onClick={handleCopyPaymentId}
                className="p-1 hover:bg-slate-200 rounded text-slate-500 cursor-pointer"
                title="Copy Payment ID"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Status</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Active & Synced to Cloud</span>
            </span>
          </div>
        </div>

        {/* Perks Highlights */}
        {planInfo && (
          <div className="text-left bg-blue-50/50 rounded-2xl p-3.5 border border-blue-100/70 mb-5">
            <span className="text-[11px] font-bold text-blue-900 block mb-1.5">Unlocked Superpowers:</span>
            <div className="grid grid-cols-2 gap-1 text-[11px] text-blue-800">
              <div>✓ {planInfo.batchLimit}</div>
              <div>✓ {planInfo.fileLimit}</div>
              <div>✓ 100% Ad-Free Canvas</div>
              <div>✓ Priority Cloud Sync</div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onNavigateHome();
          }}
          className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Start Using Unlocked Image Tools</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
