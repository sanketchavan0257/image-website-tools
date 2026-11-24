import React, { useState, useEffect } from 'react';
import { useImageStore } from '../store/useImageStore';
import { useAuthStore } from '../store/useAuthStore';
import { PlanType, BillingCycle } from '../types';
import {
  Check,
  Sparkles,
  Flame,
  Crown,
  X,
  CreditCard,
  QrCode,
  Building,
  AlertCircle,
  Calendar,
  ArrowLeft,
  Globe,
} from 'lucide-react';
import {
  BILLING_CYCLES,
  getBillingCycleOption,
  getPlanCyclePrice,
  openDirectRazorpayCheckout,
} from '../services/razorpayService';
import {
  COUNTRY_LABELS,
  DetectedLocaleCurrency,
  POPULAR_CURRENCY_OPTIONS,
  SESSION_KEY_MANUAL_CURRENCY,
  detectInstantCurrencyAndCountry,
  fetchServerAutoCurrency,
  formatCurrency,
  getCurrencyConfig,
} from '../config/currencies';
import { PaymentSuccessModal } from '../components/pricing/PaymentSuccessModal';

interface PricingViewProps {
  onNavigate: (path: string) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({ onNavigate }) => {
  const { activePlan, setPlan, setToastMessage } = useImageStore();
  const { user, updateUserPlan } = useAuthStore();
  const currentPlan = activePlan || 'free';

  // Auto-detected country & local currency (zero-flicker instant sync + IP geo confirmation)
  const [localeCurrency, setLocaleCurrency] = useState<DetectedLocaleCurrency>(() =>
    detectInstantCurrencyAndCountry()
  );

  // Selected billing cycle (Monthly, 3 Months, 6 Months, Yearly)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  // AutoPay (Auto-Renewal) enabled by default
  const [autoPayEnabled, setAutoPayEnabled] = useState<boolean>(true);

  // Loading state while launching official Razorpay popup
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success Receipt Modal
  const [successReceipt, setSuccessReceipt] = useState<{
    paymentId: string;
    plan: PlanType;
    billingCycle: BillingCycle;
    autoPayEnabled: boolean;
    amount: number;
    currency: string;
  } | null>(null);

  // Verify visitor's country IP silently in background unless manually overridden
  useEffect(() => {
    let active = true;
    fetchServerAutoCurrency().then((detected) => {
      if (active && detected) {
        setLocaleCurrency(detected);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const activeCurrencyCode = localeCurrency.currencyCode;
  const activeCurrencyCfg = getCurrencyConfig(activeCurrencyCode);
  const activeCountryFlag = COUNTRY_LABELS[localeCurrency.countryCode]?.flag || '🌍';

  const handleManualCurrencyChange = (currencyCode: string) => {
    const chosen = POPULAR_CURRENCY_OPTIONS.find((opt) => opt.currencyCode === currencyCode);
    const cfg = getCurrencyConfig(currencyCode);
    const updated: DetectedLocaleCurrency = {
      countryCode: chosen?.countryCode || localeCurrency.countryCode,
      countryName:
        (chosen?.countryCode && COUNTRY_LABELS[chosen.countryCode]?.name) || cfg.name,
      currencyCode: cfg.code,
      symbol: cfg.symbol,
      source: 'manual',
    };
    try {
      sessionStorage.setItem(SESSION_KEY_MANUAL_CURRENCY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setLocaleCurrency(updated);
  };

  const activeCycleOption = getBillingCycleOption(billingCycle);
  const proPrice = getPlanCyclePrice('pro', billingCycle, activeCurrencyCode);
  const maxPrice = getPlanCyclePrice('max', billingCycle, activeCurrencyCode);
  const ultraPrice = getPlanCyclePrice('ultra', billingCycle, activeCurrencyCode);

  // If user completed login and returned with a pending membership plan, automatically launch Razorpay
  useEffect(() => {
    if (user) {
      try {
        const savedPlan = sessionStorage.getItem('pixiforge_pending_plan') as PlanType | null;
        const savedCycle = (sessionStorage.getItem('pixiforge_pending_cycle') as BillingCycle | null) || 'monthly';
        const savedCurrency = sessionStorage.getItem('pixiforge_pending_currency') || undefined;
        const savedAutoPayRaw = sessionStorage.getItem('pixiforge_pending_autopay');
        const savedAutoPay = savedAutoPayRaw === null ? true : savedAutoPayRaw === 'true';
        if (savedPlan && savedPlan !== 'free') {
          sessionStorage.removeItem('pixiforge_pending_plan');
          sessionStorage.removeItem('pixiforge_pending_cycle');
          sessionStorage.removeItem('pixiforge_pending_currency');
          sessionStorage.removeItem('pixiforge_pending_autopay');
          sessionStorage.removeItem('pixiforge_auth_redirect');
          setBillingCycle(savedCycle);
          setAutoPayEnabled(savedAutoPay);
          setToastMessage(`Welcome ${user.name || ''}! Proceeding to ${savedPlan.toUpperCase()} checkout...`);
          handleSelectPlan(savedPlan, savedCycle, savedAutoPay, savedCurrency);
        }
      } catch {
        // ignore
      }
    }
  }, [user]);

  const handleSelectPlan = async (
    plan: PlanType,
    cycleOverride?: BillingCycle,
    autoPayOverride?: boolean,
    currencyOverride?: string
  ) => {
    setErrorMessage(null);
    const chosenCycle = cycleOverride || billingCycle;
    const useAutoPay = typeof autoPayOverride === 'boolean' ? autoPayOverride : autoPayEnabled;
    const chosenCurrency = currencyOverride || activeCurrencyCode;

    if (plan === 'free') {
      setPlan('free');
      if (user) {
        updateUserPlan('free');
      }
      onNavigate('/');
      return;
    }

    // Require login for paid membership plans: Navigate to dedicated Login Page
    if (!user) {
      try {
        sessionStorage.setItem('pixiforge_pending_plan', plan);
        sessionStorage.setItem('pixiforge_pending_cycle', chosenCycle);
        sessionStorage.setItem('pixiforge_pending_currency', chosenCurrency);
        sessionStorage.setItem('pixiforge_pending_autopay', String(useAutoPay));
        sessionStorage.setItem('pixiforge_auth_redirect', '/pricing');
      } catch {
        // ignore
      }
      setToastMessage('मेंबरशिप घेण्यासाठी कृपया लॉगिन करा.');
      onNavigate('/login?redirect=/pricing');
      return;
    }

    setLoadingPlan(plan);

    await openDirectRazorpayCheckout({
      plan,
      billingCycle: chosenCycle,
      currency: chosenCurrency,
      autoPay: useAutoPay,
      user,
      onSuccess: (paymentId, paidPlan, amount, paidCycle, autoPayMeta, paidCurrency) => {
        setLoadingPlan(null);
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
        setSuccessReceipt({
          paymentId,
          plan: paidPlan,
          billingCycle: paidCycle,
          autoPayEnabled: autoPayMeta.autoPayEnabled,
          amount,
          currency: paidCurrency,
        });
      },
      onFailure: (err) => {
        setLoadingPlan(null);
        setErrorMessage(err || 'Payment process could not be completed. Please try again.');
      },
      onDismiss: () => {
        setLoadingPlan(null);
      },
    });
  };

  return (
    <div className="w-full pb-16">
      {/* Top-Left Back Button + Auto-Detected Currency Selector */}
      <div className="w-full px-3 sm:px-5 pt-2 pb-7 flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-slate-900 text-xs font-bold shadow-2xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-all" />
          <span>Back to Home</span>
        </button>

        {/* Auto-detected visitor currency pill with clean dropdown switcher */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs">
          <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            {localeCurrency.source === 'manual' ? 'Currency:' : 'Auto:'}
          </span>
          <span aria-hidden="true">{activeCountryFlag}</span>
          <select
            aria-label="Select display currency"
            value={activeCurrencyCode}
            onChange={(e) => handleManualCurrencyChange(e.target.value)}
            className="bg-transparent font-extrabold text-slate-800 text-xs focus:outline-hidden cursor-pointer pr-1"
          >
            {!POPULAR_CURRENCY_OPTIONS.some((o) => o.currencyCode === activeCurrencyCode) && (
              <option value={activeCurrencyCode}>
                {localeCurrency.countryName} ({activeCurrencyCode} {activeCurrencyCfg.symbol.trim()})
              </option>
            )}
            {POPULAR_CURRENCY_OPTIONS.map((opt) => (
              <option key={opt.currencyCode} value={opt.currencyCode}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Flexible Plans for Everyone</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Pick Your Power Plan
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto text-sm sm:text-base">
          Start 100% free with no login required, or upgrade to Pro, Max, or Ultra for massive batch limits and professional speed.
        </p>

        {/* Login notice shown only when user is not logged in */}
        {!user && (
          <div className="pt-2 flex justify-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs font-medium shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>मेंबरशिप खरेदी करण्यासाठी लॉगिन असणे आवश्यक आहे.</span>
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.setItem('pixiforge_auth_redirect', '/pricing');
                  } catch {
                    // ignore
                  }
                  onNavigate('/login?redirect=/pricing');
                }}
                className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer ml-1"
              >
                येथे लॉगिन करा
              </button>
            </div>
          </div>
        )}

        {/* Top Billing Duration Selector Bar (Monthly / 3 Months / 6 Months / Yearly) */}
        <div className="pt-5 flex flex-col items-center gap-2">
          <div
            role="tablist"
            aria-label="Billing duration selector"
            className="grid grid-cols-4 w-full max-w-md sm:w-auto sm:inline-flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-2xl bg-slate-100/95 border border-slate-200/90 shadow-xs"
          >
            {BILLING_CYCLES.map((cycle) => {
              const isSelected = billingCycle === cycle.id;
              return (
                <button
                  key={cycle.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setBillingCycle(cycle.id)}
                  className={`relative px-1 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {cycle.id === 'yearly' && <Calendar className="hidden sm:block w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  <span>{cycle.label}</span>
                </button>
              );
            })}
          </div>
          {activeCycleOption.discountPercent > 0 && (
            <p className="text-[11px] font-semibold text-emerald-700">
              {activeCycleOption.label} plan selected — enjoy {activeCycleOption.discountPercent}% instant savings across all paid tiers
            </p>
          )}

          {/* Payment Mode Selector: AutoPay (Default) vs One-Time Payment */}
          <div className="pt-1 flex flex-col items-center gap-1.5">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/90 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setAutoPayEnabled(true)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  autoPayEnabled
                    ? 'bg-white text-blue-700 shadow-xs ring-1 ring-blue-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AutoPay (Auto-Renewal)
              </button>
              <button
                type="button"
                onClick={() => setAutoPayEnabled(false)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  !autoPayEnabled
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                One-Time Payment
              </button>
            </div>
            {autoPayEnabled && proPrice.totalAmount < activeCurrencyCfg.minAutoPayAmount && (
              <p className="text-[11px] font-medium text-amber-700 max-w-md">
                Minimum {formatCurrency(activeCurrencyCfg.minAutoPayAmount, activeCurrencyCode)} is required for AutoPay Mandate; One-Time Order will be used automatically.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Global Error Notice if Razorpay is blocked or rejected */}
      {errorMessage && (
        <div className="max-w-xl mx-auto p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 text-xs font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 1. Free Plan */}
        <div
          className={`p-6 rounded-3xl border flex flex-col justify-between transition-all bg-[radial-gradient(ellipse_at_top_left,_rgba(219,234,254,0.85)_0%,_rgba(239,246,255,0.45)_28%,_#ffffff_35%,_#ffffff_100%)] ${
            currentPlan === 'free'
              ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-lg'
              : 'border-blue-200/90 shadow-xs hover:shadow-xl hover:border-blue-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold text-slate-900">Free</h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100/70 text-blue-800 border border-blue-200/70">
                Zero Login
              </span>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-black text-slate-900">
                {formatCurrency(0, activeCurrencyCode)}
              </span>
              <span className="text-slate-500 text-xs ml-1">/ forever</span>
            </div>
            <p className="text-xs text-slate-600 mb-5 min-h-[32px]">
              Essential quick image edits, format convertors, and social media exports.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>All 31 image tools included</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Up to <strong>5 images</strong> per batch</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Max <strong>10 MB</strong> file size</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>ZIP & Separate download</span>
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <X className="w-4 h-4 text-slate-300 shrink-0" />
                <span>Standard browser speed</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => handleSelectPlan('free')}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              currentPlan === 'free'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs hover:shadow-xs'
            }`}
          >
            {currentPlan === 'free' ? 'Active Plan' : 'Select Free'}
          </button>
        </div>

        {/* 2. Pro Plan */}
        <div
          className={`p-6 rounded-3xl border flex flex-col justify-between transition-all relative bg-[radial-gradient(ellipse_at_top_left,_rgba(191,219,254,0.95)_0%,_rgba(224,242,254,0.55)_30%,_#ffffff_38%,_#ffffff_100%)] ${
            currentPlan === 'pro'
              ? 'border-2 border-blue-600 ring-4 ring-blue-500/20 shadow-2xl shadow-blue-500/15'
              : 'border-2 border-blue-500 shadow-xl shadow-blue-500/10 hover:shadow-2xl hover:shadow-blue-500/20'
          }`}
        >
          <div className="absolute -top-3 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full shadow-md">
            Popular
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>Pro</span>
                <Sparkles className="w-4 h-4 text-blue-600" />
              </h3>
            </div>
            <div className="mb-4">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-3xl font-black text-slate-900">
                  {formatCurrency(proPrice.totalAmount, activeCurrencyCode)}
                </span>
                <span className="text-slate-500 text-xs">{activeCycleOption.unitLabel}</span>
                {proPrice.savingsAmount > 0 && (
                  <span className="text-xs text-slate-400 line-through ml-1">
                    {formatCurrency(proPrice.originalAmount, activeCurrencyCode)}
                  </span>
                )}
              </div>
              {proPrice.savingsAmount > 0 && (
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  {formatCurrency(proPrice.perMonthAmount, activeCurrencyCode)}/mo • Save {formatCurrency(proPrice.savingsAmount, activeCurrencyCode)}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-600 mb-5 min-h-[32px]">
              Perfect for creators & freelancers processing routine high-volume photos.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Up to <strong>100 images</strong> per batch</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Up to <strong>100 MB</strong> raw file sizes</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                <span><strong>100% Ad-Free</strong> clean workspace</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Bulk Target File Size (KB/MB)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Custom watermark presets</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={loadingPlan === 'pro'}
            onClick={() => handleSelectPlan('pro')}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentPlan === 'pro'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/25'
            }`}
          >
            {loadingPlan === 'pro' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {currentPlan === 'pro'
                ? 'Active Plan'
                : `Upgrade to Pro — ${formatCurrency(proPrice.totalAmount, activeCurrencyCode)}`}
            </span>
          </button>
        </div>

        {/* 3. Max Plan */}
        <div
          className={`p-6 rounded-3xl border flex flex-col justify-between transition-all relative bg-[radial-gradient(ellipse_at_top_left,_rgba(199,210,254,0.95)_0%,_rgba(224,231,255,0.55)_30%,_#ffffff_38%,_#ffffff_100%)] ${
            currentPlan === 'max'
              ? 'border-2 border-indigo-600 ring-4 ring-indigo-600/20 shadow-2xl shadow-indigo-500/15'
              : 'border border-indigo-200/90 shadow-sm hover:shadow-xl hover:border-indigo-400'
          }`}
        >
          <div className="absolute -top-3 right-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full shadow-md">
            High Power
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>Max</span>
                <Flame className="w-4 h-4 text-amber-500" />
              </h3>
            </div>
            <div className="mb-4">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-3xl font-black text-slate-900">
                  {formatCurrency(maxPrice.totalAmount, activeCurrencyCode)}
                </span>
                <span className="text-slate-500 text-xs">{activeCycleOption.unitLabel}</span>
                {maxPrice.savingsAmount > 0 && (
                  <span className="text-xs text-slate-400 line-through ml-1">
                    {formatCurrency(maxPrice.originalAmount, activeCurrencyCode)}
                  </span>
                )}
              </div>
              {maxPrice.savingsAmount > 0 && (
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  {formatCurrency(maxPrice.perMonthAmount, activeCurrencyCode)}/mo • Save {formatCurrency(maxPrice.savingsAmount, activeCurrencyCode)}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-600 mb-5 min-h-[32px]">
              Engineered for studios, e-commerce stores, and intensive workflows.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Up to <strong>300 images</strong> per batch</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Up to <strong>250 MB</strong> raw file sizes</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Multi-threaded rapid processing</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Full unlimited PDF extraction</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Priority lossless compression engine</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={loadingPlan === 'max'}
            onClick={() => handleSelectPlan('max')}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentPlan === 'max'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/25'
            }`}
          >
            {loadingPlan === 'max' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Flame className="w-3.5 h-3.5" />
            )}
            <span>
              {currentPlan === 'max'
                ? 'Active Plan'
                : `Upgrade to Max — ${formatCurrency(maxPrice.totalAmount, activeCurrencyCode)}`}
            </span>
          </button>
        </div>

        {/* 4. Ultra Plan */}
        <div
          className={`p-6 rounded-3xl border flex flex-col justify-between transition-all relative bg-[radial-gradient(ellipse_at_top_left,_rgba(216,180,254,0.85)_0%,_rgba(243,232,255,0.45)_28%,_#ffffff_35%,_#ffffff_100%)] ${
            currentPlan === 'ultra'
              ? 'border-2 border-purple-600 ring-4 ring-purple-500/20 shadow-2xl shadow-purple-500/15'
              : 'border border-purple-200/90 shadow-sm hover:shadow-xl hover:border-purple-400'
          }`}
        >
          <div className="absolute -top-3 right-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-wider py-1 px-3 rounded-full shadow-md">
            Ultimate
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>Ultra</span>
                <Crown className="w-4 h-4 text-purple-600" />
              </h3>
            </div>
            <div className="mb-4">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-3xl font-black text-slate-900">
                  {formatCurrency(ultraPrice.totalAmount, activeCurrencyCode)}
                </span>
                <span className="text-slate-500 text-xs">{activeCycleOption.unitLabel}</span>
                {ultraPrice.savingsAmount > 0 && (
                  <span className="text-xs text-slate-400 line-through ml-1">
                    {formatCurrency(ultraPrice.originalAmount, activeCurrencyCode)}
                  </span>
                )}
              </div>
              {ultraPrice.savingsAmount > 0 && (
                <div className="mt-1 text-[11px] font-bold text-emerald-700">
                  {formatCurrency(ultraPrice.perMonthAmount, activeCurrencyCode)}/mo • Save {formatCurrency(ultraPrice.savingsAmount, activeCurrencyCode)}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-600 mb-5 min-h-[32px]">
              Unlimited scale for agencies, bulk archives, and enterprise grade output.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Up to <strong>1,000 images</strong> per batch</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Up to <strong>1,000 MB (1 GB)</strong> per file</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Maximum parallel canvas pipelines</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Zero limits, VIP support priority</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Permanent early access to new tools</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={loadingPlan === 'ultra'}
            onClick={() => handleSelectPlan('ultra')}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              currentPlan === 'ultra'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/25'
            }`}
          >
            {loadingPlan === 'ultra' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Crown className="w-3.5 h-3.5" />
            )}
            <span>
              {currentPlan === 'ultra'
                ? 'Active Plan'
                : `Upgrade to Ultra — ${formatCurrency(ultraPrice.totalAmount, activeCurrencyCode)}`}
            </span>
          </button>
        </div>
      </div>

      {/* Payment Security Badge */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            {activeCurrencyCfg.symbol.trim()}
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-base">
              Global Razorpay Checkout ({activeCurrencyCode})
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeCurrencyCode === 'INR'
                ? 'Secure payments go directly to your Razorpay Merchant Account via UPI (GPay, PhonePe, Paytm), Cards & NetBanking.'
                : `Automatically localized for ${localeCurrency.countryName} (${activeCurrencyCode}). Pay securely with International Visa, Mastercard, Amex & Wallets — with full pro-rata refund support.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-600">
          {activeCurrencyCode === 'INR' && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
              <span>UPI (GPay / PhonePe)</span>
            </span>
          )}
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
            <span>{activeCurrencyCode === 'INR' ? 'Debit / Credit Cards' : 'Visa / Mastercard / Amex'}</span>
          </span>
          <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <Building className="w-3.5 h-3.5 text-violet-600" />
            <span>{activeCurrencyCode === 'INR' ? '50+ NetBanking' : 'Global Pro-Rata Refunds'}</span>
          </span>
        </div>
      </div>
      </div>

      {/* Payment Success Celebration & Receipt Modal */}
      {successReceipt && (
        <PaymentSuccessModal
          isOpen={Boolean(successReceipt)}
          paymentId={successReceipt.paymentId}
          plan={successReceipt.plan}
          billingCycle={successReceipt.billingCycle}
          autoPayEnabled={successReceipt.autoPayEnabled}
          amount={successReceipt.amount}
          currency={successReceipt.currency}
          onClose={() => setSuccessReceipt(null)}
          onNavigateHome={() => onNavigate('/')}
        />
      )}
    </div>
  );
};
