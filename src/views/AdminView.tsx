import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  useAuthStore,
  isAdminUser,
  getConfiguredAdminEmail,
} from '../store/useAuthStore';
import { useImageStore } from '../store/useImageStore';
import { UserProfile } from '../types/auth';
import { getAllUsersFromFirestore, getAdminUsersIssue, FirestoreUserData } from '../services/firestoreService';
import {
  getBillingCycleOption,
  getPlanCyclePrice,
  calculateProRataRefund,
  requestProRataRefund,
  cancelAutoPaySubscription,
} from '../services/razorpayService';
import { formatCurrency, roundCurrencyAmount } from '../config/currencies';
import { AdminAnalystView } from '../components/admin/AdminAnalystView';

interface RecentPaymentRow {
  paymentId: string;
  name: string;
  email: string;
  plan: string;
  amount: number;
  currency: string;
  date: string;
  refunded: boolean;
}

// Latest real Razorpay payments (pay_...) across all users, newest first
function buildRecentPayments(users: UserProfile[]): RecentPaymentRow[] {
  const rows: RecentPaymentRow[] = [];
  for (const u of users) {
    for (const r of u.paymentHistory || []) {
      if (!r?.paymentId || !r.paymentId.startsWith('pay_') || r.paymentId.startsWith('pay_usr_')) continue;
      rows.push({
        paymentId: r.paymentId,
        name: u.name || '',
        email: u.email || '',
        plan: String(r.plan || ''),
        amount: Number(r.amount) || 0,
        currency: r.currency || 'INR',
        date: r.date,
        refunded: r.status === 'cancelled_refunded' || r.status === 'refund_pending',
      });
    }
  }
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
}
import {
  ArrowLeft,
  Shield,
  Users,
  Sparkles,
  Flame,
  Crown,
  Layers,
  Repeat,
  RotateCcw,
  XCircle,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  ArrowRight,
  Globe,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminViewProps {
  onNavigate: (path: string) => void;
}

type AdminSectionTab = 'users' | 'analyst';
type AdminActionMode = 'only_autopay' | 'autopay_full_refund' | 'pro_rata_cancel';
type FilterTab = 'all' | 'paid' | 'autopay' | 'free';


function mapFirestoreToProfile(fs: FirestoreUserData): UserProfile {
  return {
    id: fs.userId,
    name: fs.name || 'User',
    email: fs.email,
    phone: fs.phone,
    authMethod: 'email',
    plan: fs.plan || 'free',
    billingCycle: fs.billingCycle,
    planExpiresAt: fs.planExpiresAt,
    autoPayEnabled: fs.autoPayEnabled,
    autoPayStatus: fs.autoPayStatus,
    subscriptionId: fs.subscriptionId,
    autoPayUpdatedAt: fs.autoPayUpdatedAt,
    lastPaymentId: fs.lastPaymentId,
    lastPaymentAmount: fs.lastPaymentAmount,
    lastPaymentCurrency: fs.lastPaymentCurrency,
    lastPaymentDate: fs.lastPaymentDate,
    paymentHistory: fs.paymentHistory as any,
    createdAt: fs.createdAt || new Date().toISOString(),
  };
}

export const AdminView: React.FC<AdminViewProps> = ({ onNavigate }) => {
  const {
    user,
    getAllKnownUsers,
    adminOnlyCancelAutoPay,
    adminCancelMembershipWithRefund,
  } = useAuthStore();
  const { setPlan } = useImageStore();

  const isAdmin = isAdminUser(user);

  const [activeSection, setActiveSection] = useState<AdminSectionTab>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [usersIssue, setUsersIssue] = useState<string | null>(null);
  const [remoteUserCount, setRemoteUserCount] = useState<number | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const USERS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // Filter / search badalla ki parat page 1 var ja
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchQuery]);

  // Action modal state
  const [modalState, setModalState] = useState<{
    targetUser: UserProfile;
    mode: AdminActionMode;
  } | null>(null);
  const [customDaysUsed, setCustomDaysUsed] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<{
    title: string;
    detail: string;
    refundId?: string;
  } | null>(null);

  const loadAllUsers = useCallback(async (silent: boolean = false) => {
    if (!silent) setIsLoadingUsers(true);
    try {
      const localUsers = getAllKnownUsers();
      let remoteProfiles: UserProfile[] = [];
      try {
        const fsDocs = await getAllUsersFromFirestore();
        remoteProfiles = fsDocs.map(mapFirestoreToProfile);
      } catch (err) {
        console.warn('Firestore admin user list notice:', err);
      }
      setUsersIssue(getAdminUsersIssue());
      setRemoteUserCount(remoteProfiles.length);

      const mergedMap = new Map<string, UserProfile>();
      for (const u of localUsers) {
        mergedMap.set(u.id, u);
      }
      for (const r of remoteProfiles) {
        const existingByEmail = r.email
          ? Array.from(mergedMap.values()).find(
              (m) => m.email?.toLowerCase() === r.email?.toLowerCase()
            )
          : undefined;
        if (existingByEmail && existingByEmail.id !== r.id) {
          mergedMap.set(r.id, { ...existingByEmail, ...r });
          mergedMap.delete(existingByEmail.id);
        } else {
          mergedMap.set(r.id, { ...(mergedMap.get(r.id) || {}), ...r });
        }
      }

      const merged = Array.from(mergedMap.values()).sort((a, b) => {
        const aPaid = a.plan !== 'free' ? 1 : 0;
        const bPaid = b.plan !== 'free' ? 1 : 0;
        if (bPaid !== aPaid) return bPaid - aPaid;
        return (b.lastPaymentDate || b.createdAt).localeCompare(
          a.lastPaymentDate || a.createdAt
        );
      });

      setUsersList(merged);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [getAllKnownUsers]);

  useEffect(() => {
    if (isAdmin) {
      loadAllUsers();
    }
  }, [isAdmin, loadAllUsers]);

  // Auto-refresh every 30s while the admin panel is open (silent: no spinner)
  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAllUsers(true);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isAdmin, loadAllUsers]);

  // Tell the admin when a NEW payment appears after the first load
  const seenPaymentIdsRef = useRef<Set<string> | null>(null);
  const [newPaymentAlert, setNewPaymentAlert] = useState<string | null>(null);
  useEffect(() => {
    if (usersList.length === 0) return;
    const rows = buildRecentPayments(usersList);
    const ids = new Set(rows.map((r) => r.paymentId));
    if (seenPaymentIdsRef.current === null) {
      seenPaymentIdsRef.current = ids;
      return;
    }
    const seen = seenPaymentIdsRef.current;
    const fresh = rows.filter((r) => !seen.has(r.paymentId));
    if (fresh.length > 0) {
      const f = fresh[0];
      setNewPaymentAlert(
        `New payment: ${f.email || f.name} bought ${f.plan.toUpperCase()} (${formatCurrency(f.amount, f.currency)})`
      );
    }
    ids.forEach((id) => seen.add(id));
  }, [usersList]);

  const getUserPaidInfo = (target: UserProfile) => {
    const history = target.paymentHistory || [];
    const activeRecord = history.find(
      (r) => r.status !== 'cancelled_refunded' && r.status !== 'refund_pending'
    );
    const currency = activeRecord?.currency || target.lastPaymentCurrency || 'INR';
    const realPaymentId = activeRecord?.paymentId || target.lastPaymentId || '';
    const hasRealPayment = Boolean(realPaymentId && !realPaymentId.startsWith('pay_usr_'));
    const amount = !hasRealPayment
      ? 0
      : activeRecord?.amount && activeRecord.amount > 0
      ? activeRecord.amount
      : target.lastPaymentAmount && target.lastPaymentAmount > 0
      ? target.lastPaymentAmount
      : target.plan !== 'free'
      ? getPlanCyclePrice(
          target.plan as 'pro' | 'max' | 'ultra',
          target.billingCycle || 'monthly',
          currency
        ).totalAmount
      : 0;
    const cycle = target.billingCycle || activeRecord?.billingCycle || 'monthly';
    const startDate = activeRecord?.date || target.lastPaymentDate || target.createdAt;
    const expiresAt = target.planExpiresAt || activeRecord?.expiresAt;
    return { amount, currency, cycle, startDate, expiresAt, paymentId: realPaymentId, hasRealPayment };
  };

  // Membership kadhi ghetli: fakt valid date asel tar return, nahitar null
  const getPurchaseDate = (target: UserProfile): Date | null => {
    const activeRecord = (target.paymentHistory || []).find(
      (r) => r.status !== 'cancelled_refunded' && r.status !== 'refund_pending'
    );
    const raw = activeRecord?.date || target.lastPaymentDate;
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const openActionModal = (targetUser: UserProfile, mode: AdminActionMode) => {
    setModalError(null);
    const paid = getUserPaidInfo(targetUser);
    const proRata = calculateProRataRefund({
      paidAmount: paid.amount,
      currency: paid.currency,
      billingCycle: paid.cycle,
      startDate: paid.startDate,
      expiresAt: paid.expiresAt,
    });
    setCustomDaysUsed(proRata.daysUsed);
    setModalState({ targetUser, mode });
  };

  const handleConfirmAdminAction = async (forcePlanCancelOnly = false) => {
    if (!modalState) return;
    const { targetUser, mode } = modalState;
    const paid = getUserPaidInfo(targetUser);
    setModalError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'only_autopay') {
        const subRes = await cancelAutoPaySubscription({
          subscriptionId: targetUser.subscriptionId,
          cancelAtCycleEnd: true,
        });
        if (!subRes.success) {
          setModalError(subRes.error || 'Failed to turn off AutoPay. Please try again.');
          return;
        }

        adminOnlyCancelAutoPay(targetUser.id);
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === targetUser.id
              ? { ...u, autoPayEnabled: false, autoPayStatus: 'cancelled' }
              : u
          )
        );
        setModalState(null);
        setActionBanner({
          title: `${targetUser.name}: Only AutoPay Cancelled`,
          detail:
            'Future automatic renewal payments have been stopped (0 refund). Their current membership will remain active until expiry.',
        });
        return;
      }

      // Modes 2 & 3: Cancel Membership + Issue Refund (Full 100% OR Pro-Rata)
      if (targetUser.autoPayEnabled || targetUser.subscriptionId) {
        await cancelAutoPaySubscription({
          subscriptionId: targetUser.subscriptionId,
          cancelAtCycleEnd: false,
        });
      }

      const defaultProRata = calculateProRataRefund({
        paidAmount: paid.amount,
        currency: paid.currency,
        billingCycle: paid.cycle,
        startDate: paid.startDate,
        expiresAt: paid.expiresAt,
      });

      const clampedDays = Math.min(
        defaultProRata.totalDays,
        Math.max(0, Math.round(customDaysUsed || 0))
      );
      const proRataDeducted = Math.min(
        paid.amount,
        roundCurrencyAmount((paid.amount / defaultProRata.totalDays) * clampedDays, paid.currency)
      );
      const proRataRefundAmount = roundCurrencyAmount(
        Math.max(0, paid.amount - proRataDeducted),
        paid.currency
      );

      let finalRefundAmount =
        forcePlanCancelOnly || !paid.hasRealPayment
          ? 0
          : mode === 'autopay_full_refund'
          ? paid.amount
          : proRataRefundAmount;
      const finalDaysUsed = mode === 'autopay_full_refund' ? 0 : clampedDays;

      let refundRes: {
        success: boolean;
        mode?: string;
        refundId?: string;
        refundAmount?: number;
        refundAmountINR?: number;
        error?: string;
      } = {
        success: true,
        mode: 'no_refund_needed',
        refundId: `rfnd_nopay_${Date.now()}`,
        refundAmount: 0,
        refundAmountINR: 0,
      };

      if (!forcePlanCancelOnly && paid.hasRealPayment && finalRefundAmount > 0) {
        refundRes = await requestProRataRefund({
          paymentId: paid.paymentId,
          refundAmount: finalRefundAmount,
          currency: paid.currency,
          plan: targetUser.plan,
          billingCycle: paid.cycle,
          userId: targetUser.id,
          userEmail: targetUser.email,
          daysUsed: finalDaysUsed,
          totalDays: defaultProRata.totalDays,
        });

        if (!refundRes.success) {
          setModalError(refundRes.error || 'Failed to process refund. Please try again.');
          return;
        }
        if (typeof refundRes.refundAmount === 'number') {
          finalRefundAmount = refundRes.refundAmount;
        } else if (typeof refundRes.refundAmountINR === 'number') {
          finalRefundAmount = refundRes.refundAmountINR;
        }
      }

      const finalRefundId = refundRes.refundId || `rfnd_${Date.now()}`;
      adminCancelMembershipWithRefund(targetUser.id, {
        refundType: mode === 'autopay_full_refund' ? 'full_autopay' : 'pro_rata',
        paymentId: paid.hasRealPayment ? paid.paymentId : undefined,
        refundId: finalRefundId,
        refundAmount: finalRefundAmount,
        daysUsed: finalDaysUsed,
        mode: refundRes.mode,
        fallbackUser: targetUser,
      });

      if (user && user.id === targetUser.id) {
        setPlan('free');
      }

      setUsersList((prev) =>
        prev.map((u) =>
          u.id === targetUser.id
            ? {
                ...u,
                plan: 'free',
                billingCycle: undefined,
                planExpiresAt: undefined,
                autoPayEnabled: false,
                autoPayStatus: 'cancelled',
              }
            : u
        )
      );

      setModalState(null);
      const formattedRefund = formatCurrency(finalRefundAmount, paid.currency, { includeCode: true });
      const formattedDeducted = formatCurrency(proRataDeducted, paid.currency);
      setActionBanner({
        title: !paid.hasRealPayment || forcePlanCancelOnly
          ? `${targetUser.name}: Membership Cancelled (Switched to Free)`
          : mode === 'autopay_full_refund'
          ? `${targetUser.name}: AutoPay Membership Cancelled — 100% Full Refund ${formattedRefund}`
          : `${targetUser.name}: Membership Cancelled — Pro-Rata Refund ${formattedRefund}`,
        detail: !paid.hasRealPayment
          ? 'This account had no Razorpay payment transaction. The membership has been removed and switched to Free (0 refund).'
          : forcePlanCancelOnly
          ? 'The membership has been cancelled immediately and switched to Free without issuing a gateway refund.'
          : mode === 'autopay_full_refund'
          ? `The full AutoPay-charged amount (${formattedRefund}) has been refunded to the user's original payment method, AutoPay is disabled, and the plan is now Free.`
          : `Deducted ${formattedDeducted} for ${finalDaysUsed} used day(s) and refunded the remaining ${formattedRefund} to the user's account. Plan is now Free.`,
        refundId: paid.hasRealPayment && !forcePlanCancelOnly ? finalRefundId : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Non-Admin / Logged-out Guard
  if (!user || !isAdmin) {
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

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-3">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-12 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Admin Panel Access
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {getConfiguredAdminEmail()
                  ? 'This Admin Panel is restricted to the authorized administrator account configured in your environment variables.'
                  : 'Admin email is not configured yet. Please set ADMIN_EMAIL (or VITE_ADMIN_EMAIL) in your .env file or Render Environment Variables.'}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              {!user && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.setItem('pixiforge_auth_redirect', '/admin');
                    } catch (e) {}
                    onNavigate('/login?redirect=/admin');
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Log In as Admin</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Stats
  const totalUsers = usersList.length;
  const paidUsers = usersList.filter((u) => u.plan !== 'free');
  const recentPayments = buildRecentPayments(usersList);
  const autoPayUsers = usersList.filter((u) => u.autoPayEnabled);
  const revenueByCurrency = paidUsers.reduce<Record<string, number>>((acc, u) => {
    const info = getUserPaidInfo(u);
    acc[info.currency] = roundCurrencyAmount((acc[info.currency] || 0) + info.amount, info.currency);
    return acc;
  }, {});
  const formattedActiveRevenue =
    Object.keys(revenueByCurrency).length === 0
      ? formatCurrency(0, 'INR')
      : Object.entries(revenueByCurrency)
          .map(([curr, amt]) => formatCurrency(amt, curr))
          .join(' + ');

  // Filter + Search
  const filteredUsers = usersList.filter((u) => {
    if (filterTab === 'paid' && u.plan === 'free') return false;
    if (filterTab === 'autopay' && !u.autoPayEnabled) return false;
    if (filterTab === 'free' && u.plan !== 'free') return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.lastPaymentId?.toLowerCase().includes(q) ||
      u.subscriptionId?.toLowerCase().includes(q)
    );
  });

  // Pagination (5 users per page)
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedUsers = filteredUsers.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);

  // Modal breakdown computation
  const modalBreakdown = modalState
    ? (() => {
        const paid = getUserPaidInfo(modalState.targetUser);
        const proRata = calculateProRataRefund({
          paidAmount: paid.amount,
          currency: paid.currency,
          billingCycle: paid.cycle,
          startDate: paid.startDate,
          expiresAt: paid.expiresAt,
        });
        const clampedDays = Math.min(proRata.totalDays, Math.max(0, Math.round(customDaysUsed || 0)));
        const deductedAmount = Math.min(
          paid.amount,
          roundCurrencyAmount((paid.amount / proRata.totalDays) * clampedDays, paid.currency)
        );
        const proRataRefundAmount = roundCurrencyAmount(
          Math.max(0, paid.amount - deductedAmount),
          paid.currency
        );
        return {
          paid,
          proRata,
          clampedDays,
          deductedAmount,
          proRataRefundAmount,
        };
      })()
    : null;

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 space-y-7">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Control Center</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Membership & AutoPay Admin
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage user plans with 3 controls: Only AutoPay Cancel, AutoPay Full Refund Cancel, or Pro-Rata Membership Cancel.
            </p>
          </div>

          {activeSection === 'users' && (
            <button
              type="button"
              disabled={isLoadingUsers}
              onClick={() => loadAllUsers()}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-extrabold shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              <span>Sync Users</span>
            </button>
          )}
        </div>

        {/* Admin Panel Sub-Navigation Bar: Users & Analyst */}
        <nav
          aria-label="Admin sections"
          className="bg-white rounded-2xl border border-slate-200/90 p-1.5 shadow-2xs inline-flex items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => setActiveSection('users')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'users'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeSection === 'users'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalUsers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('analyst')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeSection === 'analyst'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analyst</span>
          </button>
        </nav>

        {activeSection === 'analyst' ? (
          <AdminAnalystView />
        ) : (
          <>
            {/* Why users are missing (shown only when the Firestore user list could not load) */}
            {usersIssue && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold">
                ⚠️ Firestore madhun users yet nahit: {usersIssue}
              </div>
            )}
            {remoteUserCount !== null && !usersIssue && (
              <p className="text-[11px] text-slate-500">Firestore users loaded: {remoteUserCount}</p>
            )}

            {/* New payment alert */}
            {newPaymentAlert && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-bold flex items-center justify-between gap-3">
                <span>🔔 {newPaymentAlert}</span>
                <button
                  type="button"
                  onClick={() => setNewPaymentAlert(null)}
                  className="text-xs font-extrabold underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Recent Payments */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black text-slate-900">Recent Payments</h2>
                <span className="text-[11px] text-slate-500">Auto-refreshes every 30s</span>
              </div>
              {recentPayments.length === 0 ? (
                <p className="text-xs text-slate-500">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentPayments.map((p) => (
                    <li key={p.paymentId} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">{p.name || p.email}</div>
                        <div className="text-slate-500 truncate">
                          {p.email} · {p.paymentId}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-slate-900">
                          {p.plan.toUpperCase()} · {formatCurrency(p.amount, p.currency)}
                          {p.refunded ? ' (refunded)' : ''}
                        </div>
                        <div className="text-slate-500">{new Date(p.date).toLocaleString('en-IN')}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Success Action Banner */}
            {actionBanner && (
              <div className="p-5 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 text-xs">
                    <h3 className="text-sm font-black">{actionBanner.title}</h3>
                    <p className="text-emerald-800 leading-relaxed">{actionBanner.detail}</p>
                    {actionBanner.refundId && (
                      <p className="font-mono text-[11px] text-emerald-700">
                        Refund Ref ID: <strong>{actionBanner.refundId}</strong>
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActionBanner(null)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-950 underline self-end sm:self-center cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Total Users</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1.5">{totalUsers}</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Paid Members</span>
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-1.5">{paidUsers.length}</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>AutoPay ON</span>
              <Repeat className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1.5">{autoPayUsers.length}</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>Active Plan Value</span>
              <Globe className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5 truncate" title={formattedActiveRevenue}>
              {formattedActiveRevenue}
            </div>
          </div>
        </div>

        {/* 3 Cancellation Modes Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1">
            <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" />
              <span>1. Only AutoPay Cancel</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Stops only future AutoPay renewals (₹0 refund). The user’s current membership stays active until its expiry date.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1">
            <div className="font-extrabold text-blue-900 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>2. AutoPay Membership Cancel</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Refunds the entire AutoPay-debited amount (e.g. <strong>100% Full ₹299</strong> of ₹299) to the user’s account and immediately switches the plan to Free.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 space-y-1">
            <div className="font-extrabold text-rose-900 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              <span>3. Membership Cancel</span>
            </div>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              Normal cancellation: deducts per-day usage (e.g. ₹300/30 = ₹10/day), refunds the remaining balance, and switches the plan to Free.
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
            {(
              [
                { id: 'all', label: `All (${totalUsers})` },
                { id: 'paid', label: `Paid (${paidUsers.length})` },
                { id: 'autopay', label: `AutoPay ON (${autoPayUsers.length})` },
                { id: 'free', label: `Free (${totalUsers - paidUsers.length})` },
              ] as { id: FilterTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterTab === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search email, name, payment ID..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Users Membership Management List */}
        <div className="space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No matching users found</p>
              <p className="text-xs text-slate-500">
                Try changing the filter tab or search query.
              </p>
            </div>
          ) : (
            pagedUsers.map((member) => {
              const paidInfo = getUserPaidInfo(member);
              const purchaseDate = getPurchaseDate(member);
              const cycleLabel = member.billingCycle
                ? getBillingCycleOption(member.billingCycle).label
                : 'Monthly';
              const isPaid = member.plan !== 'free';

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                >
                  {/* Left: User & Plan Info */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-bold text-sm ${
                        member.plan === 'ultra'
                          ? 'bg-purple-100 text-purple-700'
                          : member.plan === 'max'
                          ? 'bg-indigo-100 text-indigo-700'
                          : member.plan === 'pro'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {member.plan === 'ultra' ? (
                        <Crown className="w-5 h-5" />
                      ) : member.plan === 'max' ? (
                        <Flame className="w-5 h-5" />
                      ) : member.plan === 'pro' ? (
                        <Sparkles className="w-5 h-5" />
                      ) : (
                        <Layers className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm truncate">
                          {member.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            member.plan === 'ultra'
                              ? 'bg-purple-100 text-purple-800'
                              : member.plan === 'max'
                              ? 'bg-indigo-100 text-indigo-800'
                              : member.plan === 'pro'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {member.plan}
                        </span>
                        {isPaid && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              member.autoPayEnabled
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Repeat className="w-3 h-3" />
                            <span>{member.autoPayEnabled ? 'AutoPay ON' : 'AutoPay OFF'}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 truncate">
                        {member.email || member.phone || member.id}
                      </p>

                      {isPaid ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                          <span>
                            Paid: <strong className="text-slate-900">{formatCurrency(paidInfo.amount, paidInfo.currency, { includeCode: true })}</strong> ({cycleLabel})
                          </span>
                          {purchaseDate && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-emerald-600" />
                              Purchased:{' '}
                              <strong>
                                {purchaseDate.toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </strong>
                            </span>
                          )}
                          {member.planExpiresAt && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-blue-600" />
                              Valid till:{' '}
                              <strong>
                                {new Date(member.planExpiresAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </strong>
                            </span>
                          )}
                          {member.subscriptionId && (
                            <span className="font-mono text-[10px] text-slate-400">
                              Sub: {member.subscriptionId}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">Free Plan — No active paid subscription</p>
                      )}
                    </div>
                  </div>

                  {/* Right: 3 Admin Action Buttons */}
                  {isPaid ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={!member.autoPayEnabled}
                        onClick={() => openActionModal(member, 'only_autopay')}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 ${
                          member.autoPayEnabled
                            ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800 cursor-pointer'
                            : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Stop AutoPay only; keep current membership active until expiry"
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>Only AutoPay Cancel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openActionModal(member, 'autopay_full_refund')}
                        className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Cancel AutoPay Membership with 100% Full Refund"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>AutoPay Membership Cancel (Full {formatCurrency(paidInfo.amount, paidInfo.currency)})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openActionModal(member, 'pro_rata_cancel')}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Normal Membership Cancel with Pro-Rata day-wise calculation"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Membership Cancel (Pro-Rata)</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 self-start lg:self-center">
                      No Active Plan
                    </span>
                  )}
                </div>
              );
            })
          )}

          {filteredUsers.length > USERS_PER_PAGE && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(safePage - 1)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Page {safePage} / {totalPages} • {filteredUsers.length} users
              </span>
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Confirmation Modal for the 3 Admin Actions */}
      {modalState && modalBreakdown && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in"
          onClick={() => !isSubmitting && setModalState(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setModalState(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  modalState.mode === 'only_autopay'
                    ? 'bg-amber-50 text-amber-600'
                    : modalState.mode === 'autopay_full_refund'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                {modalState.mode === 'only_autopay' ? (
                  <Repeat className="w-5 h-5" />
                ) : modalState.mode === 'autopay_full_refund' ? (
                  <RotateCcw className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {modalState.mode === 'only_autopay'
                    ? 'Only AutoPay Cancel'
                    : modalState.mode === 'autopay_full_refund'
                    ? 'AutoPay Membership Cancel (100% Full Refund)'
                    : 'Membership Cancel (Pro-Rata Refund)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  User: <strong>{modalState.targetUser.name}</strong> (
                  {modalState.targetUser.email || modalState.targetUser.phone})
                </p>
              </div>
            </div>

            {modalState.mode === 'only_autopay' && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-2 leading-relaxed">
                <p>
                  • Only <strong>AutoPay (Auto-Renewal)</strong> will be turned off.
                </p>
                <p>
                  • The user’s current <strong>{modalState.targetUser.plan.toUpperCase()}</strong> plan will stay active until{' '}
                  {modalState.targetUser.planExpiresAt
                    ? new Date(modalState.targetUser.planExpiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'the expiry date'}
                  .
                </p>
                <p>• No refund (₹0) will be issued.</p>
              </div>
            )}

            {modalState.mode === 'autopay_full_refund' && (
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Plan Amount Paid</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(modalBreakdown.paid.amount, modalBreakdown.paid.currency, { includeCode: true })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Usage Deduction</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(0, modalBreakdown.paid.currency)} (100% Full AutoPay Refund)
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-200 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Full Refund to User Account</span>
                  <span className="text-lg font-black text-blue-700">
                    {formatCurrency(modalBreakdown.paid.amount, modalBreakdown.paid.currency, { includeCode: true })}
                  </span>
                </div>
              </div>
            )}

            {modalState.mode === 'pro_rata_cancel' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Paid ({modalBreakdown.proRata.totalDays} days)</span>
                  <span className="font-bold text-slate-900">
                    {formatCurrency(modalBreakdown.paid.amount, modalBreakdown.paid.currency, { includeCode: true })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Per-Day Rate</span>
                  <span className="font-semibold text-slate-700">
                    {formatCurrency(modalBreakdown.proRata.perDayRate, modalBreakdown.paid.currency, { forceDecimals: true })} / day
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="admin-days-used" className="text-slate-600 font-semibold">
                    Days Used (Adjust if needed):
                  </label>
                  <input
                    id="admin-days-used"
                    type="number"
                    min={0}
                    max={modalBreakdown.proRata.totalDays}
                    value={customDaysUsed}
                    onChange={(e) => setCustomDaysUsed(Number(e.target.value))}
                    className="w-20 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-right font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                  />
                </div>
                <div className="flex items-center justify-between text-rose-700">
                  <span>Used Deduction ({modalBreakdown.clampedDays} days)</span>
                  <span className="font-bold">
                    - {formatCurrency(modalBreakdown.deductedAmount, modalBreakdown.paid.currency)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">Pro-Rata Refund to User Account</span>
                  <span className="text-lg font-black text-emerald-700">
                    {formatCurrency(modalBreakdown.proRataRefundAmount, modalBreakdown.paid.currency, { includeCode: true })}
                  </span>
                </div>
              </div>
            )}

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium space-y-2.5">
                <p>{modalError}</p>
                {modalState.mode !== 'only_autopay' && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleConfirmAdminAction(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    Force Cancel Plan Only (Switch to Free Without Gateway Refund)
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setModalState(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleConfirmAdminAction(false)}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60 ${
                  modalState.mode === 'only_autopay'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : modalState.mode === 'autopay_full_refund'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                }`}
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {isSubmitting
                    ? 'Processing...'
                    : modalState.mode === 'only_autopay'
                    ? 'Confirm Only AutoPay Cancel'
                    : !modalBreakdown.paid.hasRealPayment
                    ? `Confirm Cancel (Switch to Free • ${formatCurrency(0, modalBreakdown.paid.currency)})`
                    : modalState.mode === 'autopay_full_refund'
                    ? `Confirm Cancel & Full Refund ${formatCurrency(modalBreakdown.paid.amount, modalBreakdown.paid.currency)}`
                    : `Confirm Cancel & Refund ${formatCurrency(modalBreakdown.proRataRefundAmount, modalBreakdown.paid.currency)}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
