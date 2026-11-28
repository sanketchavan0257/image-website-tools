import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useImageStore } from '../store/useImageStore';
import { getPlanLimits } from '../config/plans';
import {
  getBillingCycleOption,
  getPlanCyclePrice,
  calculateProRataRefund,
  requestProRataRefund,
  cancelAutoPaySubscription,
  openDirectRazorpayCheckout,
  fetchRefundLiveStatus,
  RefundLiveStatus,
  cancelMembershipOnServer,
} from '../services/razorpayService';
import { formatCurrency, getCurrencyConfig } from '../config/currencies';
import { PaymentRecord } from '../types/auth';
import { auth } from '../services/firebase';
import {
  CreditCard,
  ShieldCheck,
  Sparkles,
  Flame,
  Crown,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Receipt,
  Copy,
  Check,
  Download,
  Lock,
  Layers,
  XCircle,
  AlertTriangle,
  X,
  RotateCcw,
  ArrowLeft,
  Repeat,
  Loader2,
  Clock,
  Landmark,
  RefreshCw,
} from 'lucide-react';

interface BillingViewProps {
  onNavigate: (path: string) => void;
}


// Shows the exact payment date AND time (in the viewer's local time zone)
function formatPaidDateTime(iso: string | undefined, withZone = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(withZone ? { timeZoneName: 'short' as const } : {}),
  });
}


// A real Razorpay payment id looks like pay_AbC123... (subscription ids are sub_..., local ones pay_usr_...)
function isRealRazorpayPaymentId(id?: string): boolean {
  return Boolean(id && /^pay_[A-Za-z0-9]+$/.test(id) && !id.startsWith('pay_usr_'));
}

// Adds N working days (Mon-Fri) to a date
function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

type StepState = 'done' | 'active' | 'upcoming' | 'failed';

// Refund tracker: Membership cancelled -> Refund processing -> Refund processed
function RefundStatusModal({ record, onClose }: { record: PaymentRecord; onClose: () => void }) {
  const [live, setLive] = useState<RefundLiveStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const currency = record.currency || 'INR';

  const load = React.useCallback(async () => {
    if (!record.refundId) return;
    setLoading(true);
    const res = await fetchRefundLiveStatus(record.refundId);
    setLive(res);
    setLoading(false);
  }, [record.refundId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Keep checking every 30 seconds until Razorpay says processed / failed
  React.useEffect(() => {
    if (live && (live.status === 'processed' || live.status === 'failed')) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [live, load]);

  // If Razorpay status is unknown, treat the refund as "processing" (safe default)
  const refundState: 'pending' | 'processed' | 'failed' =
    live?.status === 'processed' ? 'processed' : live?.status === 'failed' ? 'failed' : 'pending';

  const baseDate = new Date(live?.createdAt || record.cancelledAt || Date.now());
  const expectedBy = addWorkingDays(Number.isNaN(baseDate.getTime()) ? new Date() : baseDate, 7);
  const expectedPassed = refundState === 'processed' && Date.now() > expectedBy.getTime();
  const isInstant = live?.speedProcessed === 'instant';

  const steps: { title: string; subtitle: string; time?: string; state: StepState }[] = [
    {
      title: 'Membership cancelled',
      subtitle: 'Your membership has been cancelled.',
      time: formatPaidDateTime(record.cancelledAt),
      state: 'done',
    },
    {
      title: 'Refund processing',
      subtitle:
        refundState === 'failed'
          ? 'Refund could not be completed. Please contact support with your Refund ID.'
          : 'Takes 3-5 working days',
      state: refundState === 'failed' ? 'failed' : refundState === 'pending' ? 'active' : 'done',
    },
    {
      title: 'Refund processed',
      subtitle: "Amount will be credited to customer's bank account within 5-7 working days after the refund has processed.",
      state: refundState === 'processed' ? 'done' : 'upcoming',
    },
  ];

  const dot = (st: StepState) =>
    st === 'done'
      ? 'bg-emerald-500 text-white'
      : st === 'active'
      ? 'bg-amber-400 text-white animate-pulse'
      : st === 'failed'
      ? 'bg-rose-500 text-white'
      : 'bg-slate-200 text-slate-400';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Refund Status</h3>
          <p className="text-xs text-slate-500 mt-1">
            Refund amount:{' '}
            <strong className="text-emerald-700">{formatCurrency(record.refundAmount ?? 0, currency)}</strong>
            {isInstant && (
              <span className="ml-2 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Instant refund
              </span>
            )}
          </p>
        </div>

        <ol className="space-y-0">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${dot(step.state)}`}>
                  {step.state === 'done' ? (
                    <Check className="w-4 h-4" />
                  ) : step.state === 'failed' ? (
                    <X className="w-4 h-4" />
                  ) : step.state === 'active' ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <span className="text-[11px] font-black">{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-8 ${step.state === 'done' ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
              <div className="pb-5">
                <p
                  className={`text-sm font-extrabold ${
                    step.state === 'upcoming' ? 'text-slate-400' : step.state === 'failed' ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {step.title}
                </p>
                {step.time && <p className="text-[11px] font-bold text-slate-500">{step.time}</p>}
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{step.subtitle}</p>
              </div>
            </li>
          ))}
        </ol>

        {refundState === 'processed' && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 space-y-1">
            <p className="font-extrabold flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" /> Refund sent to your bank
            </p>
            <p>
              {expectedPassed
                ? 'The refund should have reached your account by now. If you have not received it, please contact your bank and share the details below.'
                : `Expected to reach your account by ${expectedBy.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at the latest.`}
            </p>
            {live?.arn && (
              <p className="font-mono text-[11px]">
                Bank reference (ARN): <strong>{live.arn}</strong>
              </p>
            )}
          </div>
        )}

        <div className="text-[11px] text-slate-500 space-y-1">
          {record.refundId && (
            <p className="font-mono">
              Refund ID: <strong className="text-slate-700">{record.refundId}</strong>
            </p>
          )}
          <p>
            Razorpay confirms when the refund is processed. Banks do not report the exact time money lands in your account.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{loading ? 'Checking…' : 'Refresh status'}</span>
        </button>
      </div>
    </div>
  );
}

export const BillingView: React.FC<BillingViewProps> = ({ onNavigate }) => {
  const { user, cancelMembership, setAutoPayStatus, updateUserPlan } = useAuthStore();
  const { activePlan, setPlan } = useImageStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusRecord, setStatusRecord] = useState<PaymentRecord | null>(null);
  const [isTogglingAutoPay, setIsTogglingAutoPay] = useState(false);
  const [autoPayNotice, setAutoPayNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cancel & Pro-Rata Refund Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccessBanner, setCancelSuccessBanner] = useState<{
    refundAmount: number;
    currency: string;
    refundId: string;
    daysUsed: number;
    totalDays: number;
    mode?: string;
    status?: string;
  } | null>(null);

  const currentPlan = user?.plan || activePlan || 'free';
  const limits = getPlanLimits(currentPlan);
  const cycleOpt = user?.billingCycle ? getBillingCycleOption(user.billingCycle) : null;

  // Construct unified invoice list (paymentHistory + legacy single lastPaymentId fallback)
  const paymentRecords: PaymentRecord[] = (() => {
    if (!user) return [];
    if (user.paymentHistory && user.paymentHistory.length > 0) {
      // Hide Rs 0 AutoPay-mandate rows (sub_...); the real payment row (pay_...) is the invoice.
      const visible = user.paymentHistory.filter(
        (r) => !(String(r.paymentId || '').startsWith('sub_') && !(Number(r.amount) > 0))
      );
      return visible.length > 0 ? visible : user.paymentHistory;
    }
    if (user.lastPaymentId) {
      return [
        {
          paymentId: user.lastPaymentId,
          plan: user.plan,
          billingCycle: user.billingCycle || 'monthly',
          amount: user.lastPaymentAmount || 0,
          currency: user.lastPaymentCurrency || 'INR',
          date: user.lastPaymentDate || user.createdAt,
          expiresAt: user.planExpiresAt,
          status: 'paid',
        },
      ];
    }
    return [];
  })();

  // Determine the active paid record, its exact currency, & pro-rata refund breakdown
  const latestPaidRecord = paymentRecords.find(
    (r) =>
      r.status !== 'cancelled_refunded' &&
      r.status !== 'refund_pending' &&
      isRealRazorpayPaymentId(r.paymentId) &&
      Number(r.amount) > 0
  );
  const activeCurrency = latestPaidRecord?.currency || user?.lastPaymentCurrency || 'INR';
  const activeCurrencyCfg = getCurrencyConfig(activeCurrency);
  const realPaymentId = isRealRazorpayPaymentId(latestPaidRecord?.paymentId)
    ? (latestPaidRecord?.paymentId as string)
    : isRealRazorpayPaymentId(user?.lastPaymentId)
    ? (user?.lastPaymentId as string)
    : '';
  const hasRealPayment = isRealRazorpayPaymentId(realPaymentId);
  const activePaidAmount = (() => {
    if (!hasRealPayment) return 0;
    if (latestPaidRecord?.amount && latestPaidRecord.amount > 0) return latestPaidRecord.amount;
    if (user?.lastPaymentAmount && user.lastPaymentAmount > 0) return user.lastPaymentAmount;
    if (currentPlan !== 'free') {
      return getPlanCyclePrice(currentPlan, user?.billingCycle || 'monthly', activeCurrency).totalAmount;
    }
    return 0;
  })();

  const activeStartDate = latestPaidRecord?.date || user?.lastPaymentDate || user?.createdAt;
  const refundBreakdown = calculateProRataRefund({
    paidAmount: activePaidAmount,
    currency: activeCurrency,
    billingCycle: user?.billingCycle || latestPaidRecord?.billingCycle || 'monthly',
    startDate: activeStartDate,
    expiresAt: user?.planExpiresAt || latestPaidRecord?.expiresAt,
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmCancelMembership = async () => {
    if (!user || currentPlan === 'free') return;
    setCancelError(null);
    setIsProcessingCancel(true);

    try {
      // The SERVER decides the refund (amount, days, plan). The browser only says "cancel".
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      if (!idToken) {
        setCancelError('Please log out, log in again, and then cancel.');
        return;
      }

      const res = await cancelMembershipOnServer(idToken);
      if (!res.success) {
        setCancelError(res.error || 'Could not cancel the membership. Please try again.');
        return;
      }

      const finalRefundAmount = res.refundAmount ?? 0;
      const finalRefundCurrency = res.currency || activeCurrency;
      const finalRefundId = res.refundId || `rfnd_none_${Date.now()}`;

      cancelMembership({
        paymentId: res.paymentId,
        refundId: finalRefundId,
        refundAmount: finalRefundAmount,
        daysUsed: res.daysUsed ?? 0,
        mode: 'razorpay_api',
        skipFirestoreSync: true,
      });
      setPlan('free');

      setIsCancelModalOpen(false);
      setAutoPayNotice(null);
      setCancelSuccessBanner({
        refundAmount: finalRefundAmount,
        currency: finalRefundCurrency,
        refundId: finalRefundId,
        daysUsed: res.daysUsed ?? 0,
        totalDays: res.totalDays ?? refundBreakdown.totalDays,
        mode: 'razorpay_api',
        status: res.status,
      });
    } finally {
      setIsProcessingCancel(false);
    }
  };

  const handleTurnOffAutoPay = async () => {
    if (!user || currentPlan === 'free') return;
    setAutoPayNotice(null);
    setIsTogglingAutoPay(true);
    try {
      const cancelRes = await cancelAutoPaySubscription({
        subscriptionId: user.subscriptionId,
        cancelAtCycleEnd: true,
      });
      if (!cancelRes.success) {
        setAutoPayNotice({
          type: 'error',
          message: cancelRes.error || 'AutoPay बंद करताना अडचण आली. कृपया पुन्हा प्रयत्न करा.',
        });
        return;
      }
      setAutoPayStatus({
        autoPayEnabled: false,
        autoPayStatus: 'cancelled',
      });
      setAutoPayNotice({
        type: 'success',
        message: 'AutoPay बंद केले आहे. तुमचा सध्याचा प्लॅन वैध तारखेपर्यंत चालू राहील आणि पुढच्या वेळी ऑटोमॅटिक पैसे कट होणार नाहीत.',
      });
    } finally {
      setIsTogglingAutoPay(false);
    }
  };

  const handleEnableAutoPay = async () => {
    if (!user || currentPlan === 'free') return;
    setAutoPayNotice(null);
    const chosenCycle = user.billingCycle || 'monthly';
    const priceInfo = getPlanCyclePrice(currentPlan as 'pro' | 'max' | 'ultra', chosenCycle, activeCurrency);
    if (priceInfo.totalAmount < activeCurrencyCfg.minAutoPayAmount) {
      setAutoPayNotice({
        type: 'error',
        message: `AutoPay Mandate requires at least ${formatCurrency(activeCurrencyCfg.minAutoPayAmount, activeCurrency)}.`,
      });
      return;
    }
    setIsTogglingAutoPay(true);
    await openDirectRazorpayCheckout({
      plan: currentPlan as 'pro' | 'max' | 'ultra',
      billingCycle: chosenCycle,
      currency: activeCurrency,
      autoPay: true,
      user,
      onSuccess: (paymentId, paidPlan, amount, paidCycle, autoPayMeta, paidCurrency) => {
        setIsTogglingAutoPay(false);
        setPlan(paidPlan);
        updateUserPlan(paidPlan, {
          paymentId,
          amount,
          currency: paidCurrency,
          billingCycle: paidCycle,
          autoPayEnabled: autoPayMeta.autoPayEnabled,
          autoPayStatus: autoPayMeta.autoPayStatus,
          subscriptionId: autoPayMeta.subscriptionId,
        });
        setAutoPayNotice({
          type: 'success',
          message: 'AutoPay (UPI AutoPay / Card) यशस्वीरित्या सुरू झाले आहे! पुढील बिलिंग तारखेला मेंबरशिप आपोआप रिन्यू होईल.',
        });
      },
      onFailure: (err) => {
        setIsTogglingAutoPay(false);
        setAutoPayNotice({
          type: 'error',
          message: err || 'AutoPay सुरू करताना पेमेंट प्रक्रिया पूर्ण होऊ शकली नाही.',
        });
      },
      onDismiss: () => {
        setIsTogglingAutoPay(false);
      },
    });
  };

  const handleDownloadReceipt = (record: PaymentRecord) => {
    const recCurrency = record.currency || user?.lastPaymentCurrency || 'INR';
    const cycleLabel = getBillingCycleOption(record.billingCycle || 'monthly').label;
    const paidDate = formatPaidDateTime(record.date, true);
    const validTill = record.expiresAt
      ? new Date(record.expiresAt).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'Active';

    const lines = [
      '========================================',
      '          PIXIFORGE IMAGE STUDIO        ',
      '         PAYMENT RECEIPT / INVOICE      ',
      '========================================',
      `Receipt / Payment ID : ${record.paymentId}`,
      `Account Holder       : ${user?.name || 'User'}`,
      `Account Email        : ${user?.email || user?.phone || 'N/A'}`,
      '----------------------------------------',
      `Plan                 : PixiForge ${record.plan.toUpperCase()}`,
      `Billing Cycle        : ${cycleLabel}`,
      `AutoPay              : ${record.autoPay ? 'Enabled (Auto-Renewal)' : 'One-Time'}`,
      `Amount Paid          : ${formatCurrency(record.amount, recCurrency, { includeCode: true })}`,
      `Payment Date         : ${paidDate}`,
      `Valid Till           : ${validTill}`,
      `Payment Gateway      : Razorpay Verified`,
      `Status               : ${
        record.status === 'cancelled_refunded'
          ? 'CANCELLED & REFUNDED'
          : record.status === 'refund_pending'
          ? 'CANCELLED (REFUND INITIATED)'
          : 'PAID'
      }`,
    ];

    if (record.refundAmount !== undefined) {
      lines.push('----------------------------------------');
      lines.push(`Days Used            : ${record.daysUsed ?? 0} days`);
      lines.push(`Pro-Rata Refund      : ${formatCurrency(record.refundAmount, recCurrency, { includeCode: true })}`);
      if (record.refundId) {
        lines.push(`Refund Reference ID  : ${record.refundId}`);
      }
      if (record.cancelledAt) {
        lines.push(
          `Cancelled Date       : ${new Date(record.cancelledAt).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`
        );
      }
    }

    lines.push('========================================');
    lines.push('Thank you for choosing PixiForge!');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PixiForge-Receipt-${record.paymentId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const daysRemaining = (() => {
    if (!user?.planExpiresAt || currentPlan === 'free') return null;
    const diff = new Date(user.planExpiresAt).getTime() - Date.now();
    if (Number.isNaN(diff) || diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  // Guest View -> Redirect cleanly to standard /login page
  if (!user) {
    return (
      <div className="w-full pb-20">
        <div className="w-full px-3 sm:px-5 pt-2 pb-7">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-slate-900 text-xs font-bold shadow-2xs transition-all cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-all" />
            <span>Back to Home</span>
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-12 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Billing & Subscription
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Sign in to view your active membership plan, billing cycle validity, cancel with pro-rata refund, and download payment receipts.
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem('pixiforge_auth_redirect', '/billing');
                } catch (e) {}
                onNavigate('/login?redirect=/billing');
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Log In to View Billing</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/pricing')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              View Plans & Pricing
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      {/* Top-Left Back Button */}
      <div className="w-full px-3 sm:px-5 pt-2 pb-7">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-slate-900 text-xs font-bold shadow-2xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-all" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Billing & Invoices</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Subscription & Billing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your active PixiForge plan, renewal timeline, pro-rata refunds, and payment history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/pricing')}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>{currentPlan === 'free' ? 'Upgrade Plan' : 'Change / Extend Plan'}</span>
        </button>
      </div>

      {/* Refund Initiated / Pending Secret Confirmation Banner */}
      {cancelSuccessBanner && (
        <div
          className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in ${
            cancelSuccessBanner.mode === 'razorpay_api'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : cancelSuccessBanner.mode === 'pending_gateway_secret'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-slate-50 border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                cancelSuccessBanner.mode === 'razorpay_api'
                  ? 'bg-emerald-100 text-emerald-700'
                  : cancelSuccessBanner.mode === 'pending_gateway_secret'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs">
              <h3 className="text-sm font-black">
                {cancelSuccessBanner.mode === 'razorpay_api'
                  ? `Membership Cancelled & ${formatCurrency(cancelSuccessBanner.refundAmount, cancelSuccessBanner.currency, { includeCode: true })} Refund Initiated!`
                  : cancelSuccessBanner.mode === 'pending_gateway_secret'
                  ? 'Membership Cancelled — पण Razorpay वर रिफंड पाठवता आला नाही'
                  : 'Membership Cancelled (Switched to Free)'}
              </h3>
              <p className="leading-relaxed opacity-90">
                {cancelSuccessBanner.mode === 'razorpay_api' ? (
                  <>
                    तुमची वापरलेली <strong>{cancelSuccessBanner.daysUsed} दिवसांची</strong> रक्कम वजा करून उरलेले{' '}
                    <strong>{formatCurrency(cancelSuccessBanner.refundAmount, cancelSuccessBanner.currency, { includeCode: true })}</strong> तुमच्या मूळ पेमेंट अकाउंटवर (UPI / बँक / कार्ड) Razorpay द्वारे पाठवले आहेत (५-७ कामाच्या दिवसांत जमा होतील).
                  </>
                ) : cancelSuccessBanner.mode === 'pending_gateway_secret' ? (
                  cancelSuccessBanner.status === 'no_gateway_payment_found' ? (
                    <>
                      हा Payment ID तुमच्या सध्याच्या सर्व्हरवरील Razorpay Key मध्ये सापडला नाही (किंवा पेमेंट वेगळ्या / Test Key मधून झाले होते). कृपया Razorpay Dashboard मधून पेमेंट तपासा किंवा मॅन्युअल रिफंड करा.
                    </>
                  ) : (
                    <>
                      सर्व्हरवर <strong>RAZORPAY_KEY_ID</strong> आणि <strong>RAZORPAY_KEY_SECRET</strong> सेट नसल्यामुळे Razorpay कडे ऑटोमॅटिक रिफंड API विनंती गेली नाही. ऑटोमॅटिक रिफंडसाठी Secrets मध्ये दोन्ही की जोडा, किंवा Razorpay Dashboard मधून मॅन्युअल रिफंड करा.
                    </>
                  )
                ) : (
                  <>तुमची मेंबरशिप रद्द करून अकाउंट Free प्लॅनवर केले आहे.</>
                )}
              </p>
              <p className="font-mono text-[11px] opacity-80">
                Reference ID: <strong>{cancelSuccessBanner.refundId}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCancelSuccessBanner(null)}
            className="text-xs font-bold underline self-end sm:self-center cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Plan & Limits Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Subscription Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col justify-between space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                  currentPlan === 'ultra'
                    ? 'bg-purple-100 text-purple-700'
                    : currentPlan === 'max'
                    ? 'bg-indigo-100 text-indigo-700'
                    : currentPlan === 'pro'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {currentPlan === 'ultra' ? (
                  <Crown className="w-6 h-6" />
                ) : currentPlan === 'max' ? (
                  <Flame className="w-6 h-6" />
                ) : currentPlan === 'pro' ? (
                  <Sparkles className="w-6 h-6" />
                ) : (
                  <Layers className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    PixiForge {limits.name}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Account: <span className="font-semibold text-slate-700">{user.email || user.phone || user.name}</span>
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Billing Cycle
              </span>
              <span className="text-sm font-extrabold text-slate-900">
                {currentPlan === 'free'
                  ? 'Free Forever'
                  : cycleOpt?.label || 'Monthly'}
              </span>
            </div>
          </div>

          {/* Validity & Plan Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 font-semibold block text-[11px]">Batch Capacity</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                {limits.maxFilesPerBatch.toLocaleString('en-IN')} images / batch
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[11px]">Max File Size</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                {limits.maxFileSizeMB >= 1000 ? '1 GB' : `${limits.maxFileSizeMB} MB`} per file
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[11px]">Valid Till</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  {currentPlan === 'free'
                    ? 'No Expiry'
                    : user.planExpiresAt
                    ? new Date(user.planExpiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Active Plan'}
                </span>
              </span>
              {daysRemaining !== null && (
                <span className="text-[10px] font-bold text-emerald-700 mt-0.5 block">
                  {daysRemaining} days remaining
                </span>
              )}
            </div>
          </div>

          {/* AutoPay (Auto-Renewal) Control Panel for Paid Plans */}
          {currentPlan !== 'free' && (
            <div className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      user.autoPayEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900">Membership AutoPay</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          user.autoPayEnabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.autoPayEnabled ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                        />
                        {user.autoPayEnabled ? 'AutoPay ON' : 'AutoPay OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {user.autoPayEnabled ? (
                        <>
                          पुढील ऑटो-रिन्यूअल:{' '}
                          <strong className="text-slate-700">
                            {formatCurrency(
                              getPlanCyclePrice(
                                currentPlan as 'pro' | 'max' | 'ultra',
                                user.billingCycle || 'monthly',
                                activeCurrency
                              ).totalAmount,
                              activeCurrency
                            )}
                          </strong>{' '}
                          ({cycleOpt?.label || 'Monthly'}) • ऑटोमॅटिक रिन्यू होईल.
                        </>
                      ) : (
                        <>
                          AutoPay बंद आहे. मेंबरशिप आपोआप रिन्यू होण्यासाठी <strong>Enable AutoPay</strong> वर क्लिक करा.
                        </>
                      )}
                    </p>
                    {user.subscriptionId && (
                      <p className="font-mono text-[10px] text-slate-400">
                        Mandate / Sub ID: {user.subscriptionId}
                      </p>
                    )}
                  </div>
                </div>

                {user.autoPayEnabled ? (
                  <button
                    type="button"
                    disabled={isTogglingAutoPay}
                    onClick={handleTurnOffAutoPay}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 disabled:opacity-60"
                  >
                    {isTogglingAutoPay ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>Turn Off AutoPay</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isTogglingAutoPay}
                    onClick={handleEnableAutoPay}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 disabled:opacity-60"
                  >
                    {isTogglingAutoPay ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Repeat className="w-3.5 h-3.5" />
                    )}
                    <span>Enable AutoPay</span>
                  </button>
                )}
              </div>

              {autoPayNotice && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] font-medium ${
                    autoPayNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {autoPayNotice.message}
                </div>
              )}
            </div>
          )}

          {/* Cancel Membership Bar (Only for paid plans) */}
          {currentPlan !== 'free' && (
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Need to stop? Cancel anytime and get a <strong className="text-slate-700">pro-rata refund</strong> for unused days back to your account.
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancelError(null);
                  setIsCancelModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Membership</span>
              </button>
            </div>
          )}
        </div>

        {/* Plan Perks / Payment Method Info Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Included Benefits</span>
            </h3>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>All 31 client-side tools</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{limits.hasAds ? 'Standard workspace' : '100% Ad-Free workspace'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{limits.bulkTargetFileSize ? 'Bulk Target KB/MB enabled' : 'Standard compression'}</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{limits.customWatermark ? 'Custom watermark presets' : 'Basic watermark'}</span>
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Payments & Refunds</span>
            <span className="font-extrabold text-slate-800">Razorpay UPI / Cards</span>
          </div>
        </div>
      </div>

      {/* Payment & Invoice History */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Payment History & Receipts</h3>
              <p className="text-xs text-slate-500">All verified payments and pro-rata refunds on your account</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {paymentRecords.length} {paymentRecords.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {paymentRecords.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">No payment receipts yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once you subscribe to Pro, Max, or Ultra, your Razorpay payment IDs and downloadable invoices will appear here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/pricing')}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Explore Membership Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paymentRecords.map((record) => {
              const recCurrency = record.currency || user?.lastPaymentCurrency || 'INR';
              const cycleLabel = getBillingCycleOption(record.billingCycle || 'monthly').label;
              const paidDateStr = formatPaidDateTime(record.date);
              const isRefunded =
                record.status === 'cancelled_refunded' || record.status === 'refund_pending';

              return (
                <div
                  key={record.paymentId}
                  className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 capitalize">
                        PixiForge {record.plan} ({cycleLabel})
                      </span>
                      {record.status === 'cancelled_refunded' ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Cancelled • Refunded {formatCurrency(record.refundAmount ?? 0, recCurrency)}
                        </span>
                      ) : record.status === 'refund_pending' ? (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Cancelled • Refund {formatCurrency(record.refundAmount ?? 0, recCurrency)} Initiated
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>Date: <strong className="text-slate-700">{paidDateStr}</strong></span>
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        Payment ID: {record.paymentId}
                        <button
                          type="button"
                          onClick={() => handleCopyId(record.paymentId)}
                          className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy Payment ID"
                        >
                          {copiedId === record.paymentId ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </span>
                      {isRefunded && record.refundId && (
                        <span className="font-mono text-[11px] text-amber-700">
                          Refund ID: {record.refundId}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="text-base font-black text-slate-900 block">
                        {formatCurrency(record.amount, recCurrency)}
                      </span>
                      {isRefunded && record.refundAmount !== undefined && (
                        <span className="text-[11px] font-bold text-emerald-700 block">
                          Refunded: {formatCurrency(record.refundAmount, recCurrency)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(record)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Receipt</span>
                    </button>
                    {isRefunded && (
                      <button
                        type="button"
                        onClick={() => setStatusRecord(record)}
                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Status</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {statusRecord && <RefundStatusModal record={statusRecord} onClose={() => setStatusRecord(null)} />}

      {/* Cancel Membership & Pro-Rata Refund Alert Dialog */}
      {isCancelModalOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="cancel-membership-alert-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in"
          onClick={() => !isProcessingCancel && setIsCancelModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={isProcessingCancel}
              onClick={() => setIsCancelModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="cancel-membership-alert-title" className="text-lg font-black text-slate-900 tracking-tight">
                  Cancel Active Membership?
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your <strong className="capitalize">{currentPlan}</strong> ({cycleOpt?.label || 'Monthly'}) pack of{' '}
                  <strong>{formatCurrency(refundBreakdown.paidAmount, activeCurrency)}</strong> is divided by{' '}
                  <strong>{refundBreakdown.totalDays} days</strong>:
                </p>
              </div>
            </div>

            {/* Dynamic Pack Division & Pro-Rata Refund Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700">Pack Calculation</span>
                <span className="font-mono font-black text-slate-900">
                  {formatCurrency(refundBreakdown.paidAmount, activeCurrency)} ÷ {refundBreakdown.totalDays} days = {formatCurrency(refundBreakdown.perDayRate, activeCurrency, { forceDecimals: true })}/day
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 pt-1">
                <span>Your Pack Price ({cycleOpt?.label || 'Monthly'})</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(refundBreakdown.paidAmount, activeCurrency)}
                </span>
              </div>

              <div className="flex items-center justify-between text-rose-700 pb-2.5 border-b border-slate-200">
                <span>
                  Used ({refundBreakdown.daysUsed} / {refundBreakdown.totalDays} days × {formatCurrency(refundBreakdown.perDayRate, activeCurrency, { forceDecimals: true })}/day)
                </span>
                <span className="font-bold">
                  - {formatCurrency(refundBreakdown.usedAmount, activeCurrency)}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-sm font-black text-emerald-900 block">
                    Refundable Amount
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    Remaining {refundBreakdown.remainingDays} days balance
                  </span>
                </div>
                <span className="text-2xl font-black text-emerald-700">
                  {formatCurrency(refundBreakdown.refundAmount, activeCurrency, { includeCode: true })}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
              Press <strong>OK</strong> to cancel your membership, turn <strong>OFF AutoPay</strong> immediately, switch to the Free plan, and refund{' '}
              <strong>{formatCurrency(refundBreakdown.refundAmount, activeCurrency, { includeCode: true })}</strong> to your original payment method. Press <strong>Cancel</strong> to keep your plan.
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {cancelError}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isProcessingCancel}
                onClick={() => setIsCancelModalOpen(false)}
                className="w-full sm:w-auto min-w-[100px] px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessingCancel}
                onClick={handleConfirmCancelMembership}
                className="w-full sm:w-auto min-w-[110px] px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                {isProcessingCancel ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>OK</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
