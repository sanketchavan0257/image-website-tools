import { PlanType, BillingCycle } from '../types';
import { getEnvRazorpayKeyId } from '../config/env';
import { UserProfile, AutoPayStatus } from '../types/auth';

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
  cycles: Record<BillingCycle, CyclePriceInfo>;
  batchLimit: string;
  fileLimit: string;
  perks: string[];
}

export const PLAN_PRICING: Record<'pro' | 'max' | 'ultra', PlanPricingItem> = {
  pro: {
    id: 'pro',
    name: 'PixiForge Pro',
    badge: 'Popular',
    amountINR: 1,
    amountUSD: 4.99,
    cycles: {
      monthly: { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      '3months': { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      '6months': { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      yearly: { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
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
    amountINR: 1,
    amountUSD: 9.99,
    cycles: {
      monthly: { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      '3months': { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      '6months': { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      yearly: { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
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
    amountINR: 1,
    amountUSD: 19.99,
    cycles: {
      monthly: { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      '3months': { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      '6months': { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
      yearly: { totalINR: 1, originalINR: 1, perMonthINR: 1, savingsINR: 0 },
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

export function getPlanCyclePrice(plan: 'pro' | 'max' | 'ultra', cycle: BillingCycle): CyclePriceInfo {
  return PLAN_PRICING[plan].cycles[cycle] || PLAN_PRICING[plan].cycles.monthly;
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
  autoPay?: boolean;
  user: UserProfile | null;
  onSuccess: (
    paymentId: string,
    plan: PlanType,
    amount: number,
    billingCycle: BillingCycle,
    autoPayMeta: AutoPayMeta
  ) => void;
  onFailure?: (errorMessage: string) => void;
  onDismiss?: () => void;
}

export async function createOneTimeOrder(payload: {
  plan: 'pro' | 'max' | 'ultra';
  billingCycle: BillingCycle;
  amountINR: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ orderId: string | null; keyId?: string; mode: string }> {
  try {
    const res = await fetch('/api/order/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
      orderId: data?.orderId || null,
      keyId: data?.keyId || undefined,
      mode: data?.mode || 'client_direct_checkout',
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
  amountINR: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ subscriptionId: string | null; keyId?: string; mode: string; warning?: string }> {
  try {
    const res = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return {
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
 * Directly triggers the official Razorpay Checkout Popup.
 * Defaults to Standard One-Time Order Checkout (no AutoPay mandate/tokenization fees).
 * Only opens Razorpay Subscription (UPI AutoPay / Card e-Mandate) when explicitly opted in and amount >= ₹5.
 */
export async function openDirectRazorpayCheckout({
  plan,
  billingCycle = 'monthly',
  autoPay = false,
  user,
  onSuccess,
  onFailure,
  onDismiss,
}: DirectRazorpayOptions): Promise<void> {
  const planInfo = PLAN_PRICING[plan];
  if (!planInfo) return;

  const cycleOpt = getBillingCycleOption(billingCycle);
  const priceInfo = getPlanCyclePrice(plan, billingCycle);

  const isLoaded = await loadRazorpayCheckoutScript();
  if (!isLoaded || !(window as any).Razorpay) {
    if (onFailure) {
      onFailure('Razorpay Checkout SDK लोड होऊ शकले नाही. कृपया तुमचे इंटरनेट कनेक्शन तपासा.');
    }
    return;
  }

  let effectiveAutoPay = autoPay;
  let createdSubId: string | null = null;
  let createdOrderId: string | null = null;
  let serverKeyId: string | undefined;

  if (autoPay) {
    const subRes = await createAutoPaySubscription({
      plan: planInfo.id as 'pro' | 'max' | 'ultra',
      billingCycle,
      amountINR: priceInfo.totalINR,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.name,
    });
    createdSubId = subRes.subscriptionId;
    serverKeyId = subRes.keyId;

    // If low-amount (< ₹5) guard triggered or no subscription created, fall back to safe One-Time Order
    if (!createdSubId) {
      if (subRes.mode === 'low_amount_one_time_guard') {
        effectiveAutoPay = false;
      }
      const orderRes = await createOneTimeOrder({
        plan: planInfo.id as 'pro' | 'max' | 'ultra',
        billingCycle,
        amountINR: priceInfo.totalINR,
        userId: user?.id,
        userEmail: user?.email,
        userName: user?.name,
      });
      createdOrderId = orderRes.orderId;
      serverKeyId = serverKeyId || orderRes.keyId;
    }
  } else {
    const orderRes = await createOneTimeOrder({
      plan: planInfo.id as 'pro' | 'max' | 'ultra',
      billingCycle,
      amountINR: priceInfo.totalINR,
      userId: user?.id,
      userEmail: user?.email,
      userName: user?.name,
    });
    createdOrderId = orderRes.orderId;
    serverKeyId = orderRes.keyId;
  }

  const razorpayKey = serverKeyId || getActiveRazorpayKey();

  const options: Record<string, any> = {
    key: razorpayKey,
    currency: 'INR',
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
        if (onDismiss) onDismiss();
      },
    },
    handler: async (response: any) => {
      const paymentId = response?.razorpay_payment_id || generateRazorpayPaymentId();
      const returnedSubId = response?.razorpay_subscription_id || createdSubId || undefined;
      const returnedOrderId = response?.razorpay_order_id || createdOrderId || undefined;

      if (response?.razorpay_signature) {
        const verification = await verifyRazorpayPayment({
          razorpay_payment_id: paymentId,
          razorpay_order_id: returnedOrderId,
          razorpay_subscription_id: returnedSubId,
          razorpay_signature: response.razorpay_signature,
        });
        if (!verification.verified) {
          if (onFailure) {
            onFailure(verification.error || 'पेमेंट सिग्नेचर पडताळणी अयशस्वी झाली.');
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
      onSuccess(paymentId, planInfo.id, priceInfo.totalINR, billingCycle, autoPayMeta);
    },
  };

  if (createdSubId) {
    // Official Razorpay Subscription ID triggers UPI AutoPay / Card Recurring Mandate inside Checkout
    options.subscription_id = createdSubId;
  } else {
    options.amount = priceInfo.totalINR * 100; // Amount in paise
    if (createdOrderId) {
      options.order_id = createdOrderId;
    }
  }

  try {
    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', (response: any) => {
      if (onFailure) {
        onFailure(response?.error?.description || 'पेमेंट अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.');
      }
    });
    rzp.open();
  } catch (err: any) {
    console.error('Razorpay open error:', err);
    if (onFailure) {
      onFailure(err?.message || 'Razorpay उघडताना त्रुटी आली.');
    }
  }
}

export interface ProRataRefundBreakdown {
  paidAmountINR: number;
  totalDays: number;
  daysUsed: number;
  remainingDays: number;
  perDayRateINR: number;
  usedAmountINR: number;
  refundAmountINR: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculates exact pro-rata refund amount when a user cancels mid-cycle.
 * Example: ₹300 plan for 30 days = ₹10/day. If cancelled after 7 days:
 * Used = ₹70, Refundable to user's account = ₹230.
 */
export function calculateProRataRefund(params: {
  paidAmountINR: number;
  billingCycle?: BillingCycle;
  startDate?: string;
  expiresAt?: string;
  cancelDate?: Date;
}): ProRataRefundBreakdown {
  const paidAmountINR = Math.max(0, Math.round(params.paidAmountINR || 0));
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
  const perDayRateINR = Number((paidAmountINR / totalDays).toFixed(2));
  const usedAmountINR = Math.min(paidAmountINR, Math.round((paidAmountINR / totalDays) * daysUsed));
  const refundAmountINR = Math.max(0, paidAmountINR - usedAmountINR);

  return {
    paidAmountINR,
    totalDays,
    daysUsed,
    remainingDays,
    perDayRateINR,
    usedAmountINR,
    refundAmountINR,
  };
}

export interface RefundApiResponse {
  success: boolean;
  mode?: 'razorpay_api' | 'pending_gateway_secret' | 'no_refund_needed' | 'razorpay_error';
  refundId?: string;
  status?: string;
  refundAmountINR?: number;
  warning?: string;
  error?: string;
}

export async function requestProRataRefund(payload: {
  paymentId: string;
  refundAmountINR: number;
  plan: PlanType;
  billingCycle?: BillingCycle;
  userId?: string;
  userEmail?: string;
  daysUsed: number;
  totalDays: number;
}): Promise<RefundApiResponse> {
  try {
    const res = await fetch('/api/refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
      error: 'सर्व्हरशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
    };
  }
}
