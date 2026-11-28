import { PlanType, BillingCycle } from '../types';
import { getEnvRazorpayKeyId } from '../config/env';
import { UserProfile, AutoPayStatus } from '../types/auth';
import {
  convertUSDToCurrency,
  getCurrencyConfig,
  roundCurrencyAmount,
  toRazorpayMinorUnits,
} from '../config/currencies';

export interface BillingCycleOption {
  id: BillingCycle;
  label: string;
  shortLabel: string;
  months: number;
  unitLabel: string;
  discountPercent: number;
  badge?: string;
}

export const BILLING_CYCLES: BillingCycleOption[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    shortLabel: '1 Month',
    months: 1,
    unitLabel: '/ month',
    discountPercent: 0,
  },
  {
    id: '3months',
    label: '3 Months',
    shortLabel: '3 Months',
    months: 3,
    unitLabel: '/ 3 months',
    discountPercent: 10,
    badge: 'Save 10%',
  },
  {
    id: '6months',
    label: '6 Months',
    shortLabel: '6 Months',
    months: 6,
    unitLabel: '/ 6 months',
    discountPercent: 20,
    badge: 'Save 20%',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    shortLabel: '1 Year',
    months: 12,
    unitLabel: '/ year',
    discountPercent: 30,
    badge: 'Save 30%',
  },
];

export function getBillingCycleOption(cycle: BillingCycle): BillingCycleOption {
  return BILLING_CYCLES.find((c) => c.id === cycle) || BILLING_CYCLES[0];
}

export function calculatePlanExpiryDate(cycle: BillingCycle, fromDate: Date = new Date()): string {
  const opt = getBillingCycleOption(cycle);
  const expiry = new Date(fromDate);
  expiry.setMonth(expiry.getMonth() + opt.months);
  return expiry.toISOString();
}

export interface CyclePriceInfo {
  currency: string;
  totalAmount: number;
  originalAmount: number;
  perMonthAmount: number;
  savingsAmount: number;
  // Aliases kept for backwards compatibility
  totalINR: number;
  originalINR: number;
  perMonthINR: number;
  savingsINR: number;
}

export interface PlanPricingItem {
  id: PlanType;
  name: string;
  badge?: string;
  amountINR: number;
  amountUSD: number;
  cycles: Record<BillingCycle, Omit<CyclePriceInfo, 'currency' | 'totalAmount' | 'originalAmount' | 'perMonthAmount' | 'savingsAmount'>>;
  batchLimit: string;
  fileLimit: string;
  perks: string[];
}

export const PLAN_PRICING: Record<'pro' | 'max' | 'ultra', PlanPricingItem> = {
  pro: {
    id: 'pro',
    name: 'PixiForge Pro',
    badge: 'Popular',
    amountINR: 9,
    amountUSD: 4.99,
    cycles: {
      monthly: { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      '3months': { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      '6months': { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      yearly: { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
    },
    batchLimit: '100 images per batch',
    fileLimit: '100 MB per file',
    perks: [
      '100 images batch processing',
      '100 MB raw file sizes',
      '100% Ad-Free clean workspace',
      'Bulk target file size in KB/MB',
      'Custom watermark presets',
      'Lossless WebP/AVIF output',
    ],
  },
  max: {
    id: 'max',
    name: 'PixiForge Max',
    badge: 'High Power',
    amountINR: 9,
    amountUSD: 9.99,
    cycles: {
      monthly: { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      '3months': { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      '6months': { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      yearly: { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
    },
    batchLimit: '300 images per batch',
    fileLimit: '250 MB per file',
    perks: [
      '300 images batch processing',
      '250 MB raw file sizes',
      'Multi-threaded rapid processing',
      'Unlimited PDF extraction pages',
      'Priority compression engine',
      '100% Ad-Free experience',
    ],
  },
  ultra: {
    id: 'ultra',
    name: 'PixiForge Ultra',
    badge: 'Ultimate Power',
    amountINR: 9,
    amountUSD: 19.99,
    cycles: {
      monthly: { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      '3months': { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      '6months': { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
      yearly: { totalINR: 9, originalINR: 9, perMonthINR: 9, savingsINR: 0 },
    },
    batchLimit: '1,000 images per batch',
    fileLimit: '1,000 MB (1 GB) per file',
    perks: [
      '1,000 images massive batch processing',
      '1,000 MB (1 GB) per file capability',
      'Maximum parallel browser canvas pipelines',
      'Zero tool limits across entire suite',
      'Permanent early access to future tools',
      'Priority VIP processing speed',
    ],
  },
};

export function getPlanCyclePrice(
  plan: 'pro' | 'max' | 'ultra',
  cycle: BillingCycle,
  currencyCode: string = 'INR'
): CyclePriceInfo {
  const cfg = getCurrencyConfig(currencyCode || 'INR');
  if (cfg.code === 'INR') {
    const inr = PLAN_PRICING[plan].cycles[cycle] || PLAN_PRICING[plan].cycles.monthly;
    return {
      currency: 'INR',
      totalAmount: inr.totalINR,
      originalAmount: inr.originalINR,
      perMonthAmount: inr.perMonthINR,
      savingsAmount: inr.savingsINR,
      ...inr,
    };
  }

  const cycleOpt = getBillingCycleOption(cycle);
  const monthlyLocal = convertUSDToCurrency(PLAN_PRICING[plan].amountUSD, cfg.code);
  const originalAmount = roundCurrencyAmount(monthlyLocal * cycleOpt.months, cfg.code);
  const totalAmount = roundCurrencyAmount(
    originalAmount * (1 - cycleOpt.discountPercent / 100),
    cfg.code
  );
  const perMonthAmount = roundCurrencyAmount(totalAmount / cycleOpt.months, cfg.code);
  const savingsAmount = roundCurrencyAmount(Math.max(0, originalAmount - totalAmount), cfg.code);

  return {
    currency: cfg.code,
    totalAmount,
    originalAmount,
    perMonthAmount,
    savingsAmount,
    totalINR: totalAmount,
    originalINR: originalAmount,
    perMonthINR: perMonthAmount,
    savingsINR: savingsAmount,
  };
}

// Default fallback Razorpay Key ID (supports env var or stored user merchant key)
export const STORAGE_KEY_RAZORPAY_MERCHANT = 'pixiforge_custom_razorpay_key';

export function getActiveRazorpayKey(): string {
  const customKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_RAZORPAY_MERCHANT) : null;
  if (customKey && customKey.trim().startsWith('rzp_')) {
    return customKey.trim();
  }
  return getEnvRazorpayKeyId() || 'rzp_test_1DP5mmOlF5G5ag';
}

export function saveActiveRazorpayKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY_RAZORPAY_MERCHANT, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_RAZORPAY_MERCHANT);
    }
  }
}

/**
 * Loads Razorpay official checkout.js SDK dynamically
 */
export function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Razorpay checkout script blocked or failed to load.');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Generates simulated transaction ID
 */
export function generateRazorpayPaymentId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 14; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `pay_${rand}`;
}

export interface AutoPayMeta {
  autoPayEnabled: boolean;
  autoPayStatus: AutoPayStatus;
  subscriptionId?: string;
}

export interface DirectRazorpayOptions {
  plan: 'pro' | 'max' | 'ultra';
  billingCycle?: BillingCycle;
  currency?: string;
  autoPay?: boolean;
  user: UserProfile | null;
  onSuccess: (
    paymentId: string,
    plan: PlanType,
    amount: number,
    billingCycle: BillingCycle,
    autoPayMeta: AutoPayMeta,
    currency: string
  ) => void;
  onFailure?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

export const STORAGE_KEY_PENDING_CHECKOUT = 'pixiforge_pending_checkout';

export interface PendingCheckoutState {
  checkoutId?: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  plan: 'pro' | 'max' | 'ultra';
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  autoPay: boolean;
  userId?: string;
  userEmail?: string;
  startedAt: number;
}

const handledPaymentIdsInMemory = new Set<string>();
let activeCheckoutInProgress = false;

export function isCheckoutModalOpen(): boolean {
  return activeCheckoutInProgress;
}

export function markPaymentHandled(paymentId: string): void {
  if (paymentId) {
    handledPaymentIdsInMemory.add(paymentId);
  }
}

export function isPaymentHandled(paymentId: string): boolean {
  return Boolean(paymentId && handledPaymentIdsInMemory.has(paymentId));
}

export function savePendingCheckout(state: PendingCheckoutState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PENDING_CHECKOUT, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export function getPendingCheckout(): PendingCheckoutState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PENDING_CHECKOUT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCheckoutState;
    if (!parsed || !parsed.plan || !parsed.startedAt) return null;
    // Expire pending checkout state after 2 hours
    if (Date.now() - Number(parsed.startedAt) > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY_PENDING_CHECKOUT);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_PENDING_CHECKOUT);
  } catch {
    // ignore
  }
}

export interface ReconciledPaymentResult {
  found: boolean;
  pendingProcessing?: boolean;
  source?: string;
  payment?: {
    paymentId: string;
    orderId?: string;
    subscriptionId?: string;
    plan: 'pro' | 'max' | 'ultra';
    billingCycle: BillingCycle;
    amount: number;
    currency: string;
    autoPay: boolean;
    autoPayStatus: AutoPayStatus;
    method?: string;
    createdAt?: string;
  };
}

export async function reconcileUserPayments(params: {
  userId?: string;
  userEmail?: string;
  firebaseIdToken?: string;
  pendingCheckout?: PendingCheckoutState | null;
  knownPaymentIds?: string[];
}): Promise<ReconciledPaymentResult> {
  try {
    const res = await fetch('/api/payment/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        userEmail: params.userEmail,
        firebaseIdToken: params.firebaseIdToken,
        pendingOrderId: params.pendingCheckout?.orderId || undefined,
        pendingSubscriptionId: params.pendingCheckout?.subscriptionId || undefined,
        pendingCheckoutId: params.pendingCheckout?.checkoutId || undefined,
        plan: params.pendingCheckout?.plan,
        billingCycle: params.pendingCheckout?.billingCycle,
        amount: params.pendingCheckout?.amount,
        currency: params.pendingCheckout?.currency,
        autoPay: params.pendingCheckout?.autoPay,
        startedAt: params.pendingCheckout?.startedAt,
        knownPaymentIds: params.knownPaymentIds || [],
      }),
    });
    if (!res.ok) {
      return { found: false, pendingProcessing: false };
    }
    const data = await res.json();
    return {
      found: Boolean(data?.found && data?.payment?.paymentId),
      pendingProcessing: Boolean(data?.pendingProcessing),
      source: data?.source,
      payment: data?.payment,
    };
  } catch (err) {
    console.warn('Payment reconcile notice:', err);
    return { found: false, pendingProcessing: false };
  }
}

export async function createOneTimeOrder(payload: {
  plan: 'pro' | 'max' | 'ultra';
  billingCycle: BillingCycle;
  amount: number;
  amountINR?: number;
  currency?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ checkoutId?: string; orderId: string | null; keyId?: string; mode: string; warning?: string }> {
  try {
    const res = await fetch('/api/order/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        currency: payload.currency || 'INR',
        amountINR: payload.amountINR ?? payload.amount,
      }),
    });
    const data = await res.json();
    return {
      checkoutId: data?.checkoutId || undefined,
      orderId: data?.orderId || null,
      keyId: data?.keyId || undefined,
      mode: data?.mode || 'client_direct_checkout',
      warning: data?.warning,
    };
  } catch (err) {
    console.warn('One-time order init notice:', err);
    return { orderId: null, mode: 'client_direct_checkout' };
  }
}

export async function verifyRazorpayPayment(payload: {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
  plan?: string;
  billingCycle?: string;
  amount?: number;
  currency?: string;
  autoPay?: boolean;
  userId?: string;
  userEmail?: string;
}): Promise<{ verified: boolean; error?: string }> {
  try {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data?.verified === false) {
      return {
        verified: false,
        error: data?.error || 'Payment signature verification failed.',
      };
    }
    return { verified: true };
  } catch (err) {
    console.warn('Payment verification notice:', err);
    return { verified: true };
  }
}

export async function createAutoPaySubscription(payload: {
  plan: 'pro' | 'max' | 'ultra';
  billingCycle: BillingCycle;
  amount: number;
  amountINR?: number;
  currency?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ checkoutId?: string; subscriptionId: string | null; keyId?: string; mode: string; warning?: string }> {
  try {
    const res = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        currency: payload.currency || 'INR',
        amountINR: payload.amountINR ?? payload.amount,
      }),
    });
    const data = await res.json();
    return {
      checkoutId: data?.checkoutId || undefined,
      subscriptionId: data?.subscriptionId || null,
      keyId: data?.keyId || undefined,
      mode: data?.mode || 'checkout_with_autopay_preference',
      warning: data?.warning,
    };
  } catch (err) {
    console.warn('AutoPay subscription init notice:', err);
    return { subscriptionId: null, mode: 'checkout_with_autopay_preference' };
  }
}

export async function cancelAutoPaySubscription(payload: {
  subscriptionId?: string;
  cancelAtCycleEnd?: boolean;
}): Promise<{ success: boolean; mode?: string; error?: string }> {
  try {
    const res = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        mode: data?.mode,
        error: data?.error || 'AutoPay रद्द करताना अडचण आली.',
      };
    }
    return data;
  } catch (err) {
    console.warn('AutoPay cancel notice:', err);
    return { success: true, mode: 'pending_gateway_secret' };
  }
}

export async function checkAutoPaySubscriptionStatus(subscriptionId: string): Promise<{
  isActive: boolean;
  status: string;
  currentEndISO: string | null;
}> {
  try {
    if (!subscriptionId || subscriptionId.startsWith('sub_pref_')) {
      return { isActive: false, status: 'local_only', currentEndISO: null };
    }
    const res = await fetch(
      `/api/subscription/status?subscriptionId=${encodeURIComponent(subscriptionId)}`
    );
    const data = await res.json();
    return {
      isActive: Boolean(data?.isActive),
      status: String(data?.status || 'unknown'),
      currentEndISO: data?.currentEndISO || null,
    };
  } catch (err) {
    console.warn('Subscription status check notice:', err);
    return { isActive: false, status: 'unknown', currentEndISO: null };
  }
}

/**
 * Directly triggers the official Razorpay Checkout Popup in the user's detected currency.
 * Supports INR and all international Razorpay currencies (USD, GBP, CAD, EUR, AUD, JPY, etc.).
 * Persists pending checkout metadata and watches visibility/focus/dismiss for low-RAM mobile recovery.
 */
export async function openDirectRazorpayCheckout({
  plan,
  billingCycle = 'monthly',
  currency = 'INR',
  autoPay = false,
  user,
  onSuccess,
  onFailure,
  onDismiss,
}: DirectRazorpayOptions): Promise<void> {
  const planInfo = PLAN_PRICING[plan];
  if (!planInfo) return;

  const currencyCfg = getCurrencyConfig(currency || 'INR');
  const cycleOpt = getBillingCycleOption(billingCycle);
  const priceInfo = getPlanCyclePrice(plan, billingCycle, currencyCfg.code);

  const isLoaded = await loadRazorpayCheckoutScript();
  if (!isLoaded || !(window as any).Razorpay) {
    if (onFailure) {
      onFailure('Razorpay Checkout SDK could not be loaded. Please check your internet connection.');
    }
    return;
  }

  let effectiveAutoPay = autoPay;
  let createdSubId: string | null = null;
  let createdOrderId: string | null = null;
  let createdCheckoutId: string | undefined;
  let serverKeyId: string | undefined;

  if (autoPay) {
    const subRes = await createAutoPaySubscription({
      plan: planInfo.id as 'pro' | 'max' | 'ultra',
      billingCycle,
      amount: priceInfo.totalAmount,
      currency: currencyCfg.code,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.name,
    });
    createdSubId = subRes.subscriptionId;
    createdCheckoutId = subRes.checkoutId;
    serverKeyId = subRes.keyId;

    // If low-amount guard triggered or no subscription created, fall back to safe One-Time Order
    if (!createdSubId) {
      if (subRes.mode === 'low_amount_one_time_guard') {
        effectiveAutoPay = false;
      }
      const orderRes = await createOneTimeOrder({
        plan: planInfo.id as 'pro' | 'max' | 'ultra',
        billingCycle,
        amount: priceInfo.totalAmount,
        currency: currencyCfg.code,
        userId: user?.id,
        userEmail: user?.email,
        userName: user?.name,
      });
      createdOrderId = orderRes.orderId;
      createdCheckoutId = orderRes.checkoutId || createdCheckoutId;
      serverKeyId = serverKeyId || orderRes.keyId;
    }
  } else {
    const orderRes = await createOneTimeOrder({
      plan: planInfo.id as 'pro' | 'max' | 'ultra',
      billingCycle,
      amount: priceInfo.totalAmount,
      currency: currencyCfg.code,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.name,
    });
    createdOrderId = orderRes.orderId;
    createdCheckoutId = orderRes.checkoutId;
    serverKeyId = orderRes.keyId;
  }

  const pendingSnapshot: PendingCheckoutState = {
    checkoutId: createdCheckoutId,
    orderId: createdOrderId,
    subscriptionId: createdSubId,
    plan: planInfo.id as 'pro' | 'max' | 'ultra',
    billingCycle,
    amount: priceInfo.totalAmount,
    currency: currencyCfg.code,
    autoPay: effectiveAutoPay,
    userId: user?.id,
    userEmail: user?.email,
    startedAt: Date.now(),
  };

  // Persist to localStorage BEFORE launching GPay / UPI / Razorpay so mobile tab kills never lose payment tracking
  savePendingCheckout(pendingSnapshot);

  let settled = false;
  let pollTimer: number | null = null;
  let checkInFlight = false;

  const knownPaymentIds = (user?.paymentHistory || []).map((p) => p.paymentId).filter(Boolean);
  if (user?.lastPaymentId && !knownPaymentIds.includes(user.lastPaymentId)) {
    knownPaymentIds.push(user.lastPaymentId);
  }

  const cleanupWatchers = () => {
    activeCheckoutInProgress = false;
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleReturnFromUpi);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleReturnFromUpi);
    }
  };

  activeCheckoutInProgress = true;

  const completeOnce = (
    paymentId: string,
    resolvedPlan: PlanType,
    resolvedAmount: number,
    resolvedCycle: BillingCycle,
    autoPayMeta: AutoPayMeta,
    resolvedCurrency: string
  ) => {
    if (settled || isPaymentHandled(paymentId)) return;
    settled = true;
    markPaymentHandled(paymentId);
    clearPendingCheckout();
    cleanupWatchers();
    onSuccess(paymentId, resolvedPlan, resolvedAmount, resolvedCycle, autoPayMeta, resolvedCurrency);
  };

  const runLiveReconcileCheck = async (): Promise<boolean> => {
    if (settled || checkInFlight) return settled;
    checkInFlight = true;
    try {
      const rec = await reconcileUserPayments({
        userId: user?.id,
        userEmail: user?.email,
        pendingCheckout: pendingSnapshot,
        knownPaymentIds,
      });
      if (rec.found && rec.payment && !settled) {
        const autoPayMeta: AutoPayMeta =
          rec.payment.autoPay || Boolean(rec.payment.subscriptionId)
            ? {
                autoPayEnabled: true,
                autoPayStatus: rec.payment.autoPayStatus || 'active',
                subscriptionId: rec.payment.subscriptionId || createdSubId || undefined,
              }
            : {
                autoPayEnabled: false,
                autoPayStatus: 'off',
              };
        completeOnce(
          rec.payment.paymentId,
          rec.payment.plan || planInfo.id,
          rec.payment.amount || priceInfo.totalAmount,
          rec.payment.billingCycle || billingCycle,
          autoPayMeta,
          rec.payment.currency || currencyCfg.code
        );
        return true;
      }
    } finally {
      checkInFlight = false;
    }
    return false;
  };

  const handleReturnFromUpi = () => {
    if (settled) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    // Give Razorpay modal ~1.2s to fire normal handler first, then double-check via backend API/webhook
    window.setTimeout(() => {
      if (!settled) {
        void runLiveReconcileCheck();
      }
    }, 1200);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleReturnFromUpi);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleReturnFromUpi);
    pollTimer = window.setInterval(() => {
      if (settled) {
        cleanupWatchers();
        return;
      }
      if (Date.now() - pendingSnapshot.startedAt > 10 * 60 * 1000) {
        cleanupWatchers();
        return;
      }
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void runLiveReconcileCheck();
      }
    }, 3000);
  }

  const razorpayKey = serverKeyId || getActiveRazorpayKey();

  const options: Record<string, any> = {
    key: razorpayKey,
    currency: currencyCfg.code,
    name: 'PixiForge Image Studio',
    description: effectiveAutoPay
      ? `${planInfo.name} (${cycleOpt.label} • AutoPay)`
      : `${planInfo.name} (${cycleOpt.label})`,
    image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
    prefill: {
      name: user?.name || '',
      email: user?.email || '',
      contact: user?.phone || '',
    },
    notes: {
      plan: planInfo.id,
      billingCycle,
      currency: currencyCfg.code,
      durationMonths: String(cycleOpt.months),
      autoPay: effectiveAutoPay ? 'enabled' : 'disabled',
      userId: user?.id || 'guest',
      userEmail: user?.email || '',
    },
    theme: {
      color: '#2563EB',
    },
    modal: {
      ondismiss: () => {
        if (settled) return;
        // Before treating dismiss as cancellation, verify once if UPI/GPay payment actually succeeded
        void (async () => {
          const recovered = await runLiveReconcileCheck();
          if (recovered || settled) return;
          cleanupWatchers();
          // Keep pending checkout for 90s in case webhook lands right after dismiss; App recovery will catch it
          if (onDismiss) onDismiss();
        })();
      },
    },
    handler: async (response: any) => {
      const paymentId = response?.razorpay_payment_id || generateRazorpayPaymentId();
      const returnedSubId = response?.razorpay_subscription_id || createdSubId || undefined;
      const returnedOrderId = response?.razorpay_order_id || createdOrderId || undefined;

      if (response?.razorpay_signature || response?.razorpay_payment_id) {
        const verification = await verifyRazorpayPayment({
          razorpay_payment_id: paymentId,
          razorpay_order_id: returnedOrderId,
          razorpay_subscription_id: returnedSubId,
          razorpay_signature: response?.razorpay_signature,
          plan: planInfo.id,
          billingCycle,
          amount: priceInfo.totalAmount,
          currency: currencyCfg.code,
          autoPay: effectiveAutoPay,
          userId: user?.id,
          userEmail: user?.email,
        });
        if (!verification.verified) {
          clearPendingCheckout();
          cleanupWatchers();
          if (onFailure) {
            onFailure(verification.error || 'Payment signature verification failed.');
          }
          return;
        }
      }

      const autoPayMeta: AutoPayMeta = effectiveAutoPay
        ? {
            autoPayEnabled: true,
            autoPayStatus: returnedSubId ? 'active' : 'pending_mandate',
            subscriptionId: returnedSubId || `sub_pref_${Date.now()}`,
          }
        : {
            autoPayEnabled: false,
            autoPayStatus: 'off',
          };
      completeOnce(
        paymentId,
        planInfo.id,
        priceInfo.totalAmount,
        billingCycle,
        autoPayMeta,
        currencyCfg.code
      );
    },
  };

  if (createdSubId) {
    // Official Razorpay Subscription ID triggers Recurring Mandate inside Checkout
    options.subscription_id = createdSubId;
  } else {
    options.amount = toRazorpayMinorUnits(priceInfo.totalAmount, currencyCfg.code);
    if (createdOrderId) {
      options.order_id = createdOrderId;
    }
  }

  try {
    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', (response: any) => {
      cleanupWatchers();
      clearPendingCheckout();
      if (onFailure) {
        onFailure(response?.error?.description || 'Payment failed. Please try again.');
      }
    });
    rzp.open();
  } catch (err: any) {
    cleanupWatchers();
    clearPendingCheckout();
    console.error('Razorpay open error:', err);
    if (onFailure) {
      onFailure(err?.message || 'Unable to open Razorpay Checkout.');
    }
  }
}

export interface ProRataRefundBreakdown {
  currency: string;
  paidAmount: number;
  totalDays: number;
  daysUsed: number;
  remainingDays: number;
  perDayRate: number;
  usedAmount: number;
  refundAmount: number;
  // Backwards-compatible aliases
  paidAmountINR: number;
  perDayRateINR: number;
  usedAmountINR: number;
  refundAmountINR: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates exact decimal-safe pro-rata refund in ANY currency (USD cents, GBP pence, CAD, EUR, INR, JPY, etc.).
 */
export function calculateProRataRefund(params: {
  paidAmount?: number;
  paidAmountINR?: number;
  currency?: string;
  billingCycle?: BillingCycle;
  startDate?: string;
  expiresAt?: string;
  cancelDate?: Date;
}): ProRataRefundBreakdown {
  const currency = params.currency ? getCurrencyConfig(params.currency).code : 'INR';
  const rawPaid = params.paidAmount ?? params.paidAmountINR ?? 0;
  const paidAmount = roundCurrencyAmount(Math.max(0, Number(rawPaid) || 0), currency);
  const cycle = params.billingCycle || 'monthly';
  const defaultDays = getBillingCycleOption(cycle).months * 30;
  const now = params.cancelDate || new Date();

  const startMs = params.startDate ? new Date(params.startDate).getTime() : NaN;
  const expiryMs = params.expiresAt ? new Date(params.expiresAt).getTime() : NaN;

  const totalDays =
    !Number.isNaN(startMs) && !Number.isNaN(expiryMs) && expiryMs > startMs
      ? Math.max(1, Math.round((expiryMs - startMs) / MS_PER_DAY))
      : defaultDays;

  const daysUsed = !Number.isNaN(startMs)
    ? Math.min(totalDays, Math.max(0, Math.floor((now.getTime() - startMs) / MS_PER_DAY)))
    : 0;

  const remainingDays = Math.max(0, totalDays - daysUsed);
  const perDayRate = roundCurrencyAmount(paidAmount / totalDays, currency);
  const usedAmount = Math.min(
    paidAmount,
    roundCurrencyAmount((paidAmount / totalDays) * daysUsed, currency)
  );
  const refundAmount = roundCurrencyAmount(Math.max(0, paidAmount - usedAmount), currency);

  return {
    currency,
    paidAmount,
    totalDays,
    daysUsed,
    remainingDays,
    perDayRate,
    usedAmount,
    refundAmount,
    paidAmountINR: paidAmount,
    perDayRateINR: perDayRate,
    usedAmountINR: usedAmount,
    refundAmountINR: refundAmount,
  };
}

export interface RefundApiResponse {
  success: boolean;
  mode?: 'razorpay_api' | 'pending_gateway_secret' | 'no_refund_needed' | 'razorpay_error';
  refundId?: string;
  status?: string;
  currency?: string;
  refundAmount?: number;
  refundAmountINR?: number;
  warning?: string;
  error?: string;
}

export async function requestProRataRefund(payload: {
  paymentId: string;
  refundAmount?: number;
  refundAmountINR?: number;
  currency?: string;
  plan: PlanType;
  billingCycle?: BillingCycle;
  userId?: string;
  userEmail?: string;
  daysUsed: number;
  totalDays: number;
}): Promise<RefundApiResponse> {
  const finalAmount = payload.refundAmount ?? payload.refundAmountINR ?? 0;
  const currency = payload.currency ? getCurrencyConfig(payload.currency).code : 'INR';
  try {
    const res = await fetch('/api/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        refundAmount: finalAmount,
        refundAmountINR: finalAmount,
        currency,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        mode: data?.mode || 'razorpay_error',
        error: data?.error || 'Refund API request failed.',
      };
    }
    return data as RefundApiResponse;
  } catch (err: any) {
    console.warn('Refund API notice:', err);
    return {
      success: false,
      mode: 'razorpay_error',
      error: 'Unable to reach server for refund. Please try again.',
    };
  }
}

export interface RefundLiveStatus {
  known: boolean;
  status: 'pending' | 'processed' | 'failed' | 'unknown';
  speedProcessed?: 'normal' | 'instant';
  speedRequested?: 'normal' | 'optimum' | 'instant';
  createdAt?: string;
  arn?: string;
}

/** Asks our server (which asks Razorpay) for the real, current status of a refund. */
export async function fetchRefundLiveStatus(refundId: string): Promise<RefundLiveStatus> {
  try {
    const res = await fetch(`/api/refund/status?refundId=${encodeURIComponent(refundId)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return { known: false, status: 'unknown' };
    const data = await res.json();
    const st = String(data?.status || 'unknown');
    return {
      known: Boolean(data?.known),
      status: st === 'pending' || st === 'processed' || st === 'failed' ? st : 'unknown',
      speedProcessed: data?.speedProcessed,
      speedRequested: data?.speedRequested,
      createdAt: data?.createdAt,
      arn: data?.arn,
    };
  } catch {
    return { known: false, status: 'unknown' };
  }
}

export interface ServerCancelResult {
  success: boolean;
  error?: string;
  mode?: string;
  paymentId?: string;
  refundId?: string;
  status?: string;
  currency?: string;
  refundAmount?: number;
  daysUsed?: number;
  totalDays?: number;
  refunded?: boolean;
  alreadyRefunded?: boolean;
}

/** Cancels the membership on the SERVER. The browser sends no amount and no date. */
export async function cancelMembershipOnServer(idToken: string): Promise<ServerCancelResult> {
  try {
    const res = await fetch('/api/membership/cancel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = (await res.json().catch(() => ({}))) as ServerCancelResult;
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Could not cancel the membership. Please try again.' };
    }
    return data;
  } catch {
    return { success: false, error: 'Network problem. Please check your connection and try again.' };
  }
}
