import React, { useState, useEffect } from 'react';
import { useImageStore } from './store/useImageStore';
import { TOOLS, getToolBySlug } from './config/tools';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HomeView } from './views/HomeView';
import { ToolUploadView } from './views/ToolUploadView';
import { ToolEditorView } from './views/ToolEditorView';
import { PricingView } from './views/PricingView';
import { BillingView } from './views/BillingView';
import { AdminView } from './views/AdminView';
import { HelpView } from './views/HelpView';
import { PolicyView } from './views/PolicyView';
import { PlanLimitModal } from './components/common/PlanLimitModal';
import { AuthModal } from './components/auth/AuthModal';
import { AuthView } from './views/AuthView';
import { SEOHelper } from './components/common/SEOHelper';
import { AlertCircle, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useAuthStore } from './store/useAuthStore';
import { getUserFromFirestore, updateUserPlanInFirestore } from './services/firestoreService';
import {
  calculatePlanExpiryDate,
  checkAutoPaySubscriptionStatus,
  clearPendingCheckout,
  getPendingCheckout,
  isCheckoutModalOpen,
  isPaymentHandled,
  markPaymentHandled,
  reconcileUserPayments,
} from './services/razorpayService';
import { trackWebsiteVisit, syncCurrentViewToFirestore } from './services/analyticsService';
import { PaymentSuccessModal } from './components/pricing/PaymentSuccessModal';
import { BillingCycle, PlanType } from './types';
import { PaymentRecord } from './types/auth';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const {
    images,
    activeToolId,
    setActiveToolId,
    toastMessage,
    setToastMessage,
  } = useImageStore();

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [reconciledReceipt, setReconciledReceipt] = useState<{
    paymentId: string;
    plan: PlanType;
    billingCycle: BillingCycle;
    autoPayEnabled: boolean;
    amount: number;
    currency: string;
  } | null>(null);

  // Record website visit once per page load (Country, State, District, Taluka + timestamp)
  useEffect(() => {
    trackWebsiteVisit(window.location.pathname || '/').catch(() => {});
  }, []);

  // Inspect Razorpay callback query params if a redirect/callback flow landed on the page
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const rzpStatus = searchParams.get('rzp_status');
      const rzpError = searchParams.get('rzp_error');
      if (rzpStatus) {
        if (rzpStatus === 'failed') {
          clearPendingCheckout();
          setToastMessage(rzpError || 'Payment could not be completed. Please try again.');
        }
        ['rzp_status', 'rzp_error', 'rzp_payment_id', 'rzp_order_id', 'rzp_subscription_id'].forEach((k) =>
          searchParams.delete(k)
        );
        const cleanQuery = searchParams.toString();
        const nextUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      // ignore URL parse errors
    }
  }, [setToastMessage]);

  // Persistent login + strict membership expiry/AutoPay verification + automatic post-refresh payment recovery
  useEffect(() => {
    let active = true;
    let pendingRetryTimer: number | null = null;

    const applyReconciledPaymentToStore = (
      payment: NonNullable<Awaited<ReturnType<typeof reconcileUserPayments>>['payment']>,
      skipModalIfHandled = true
    ) => {
      if (skipModalIfHandled && isPaymentHandled(payment.paymentId)) {
        return false;
      }
      markPaymentHandled(payment.paymentId);
      clearPendingCheckout();

      const authState = useAuthStore.getState();
      if (authState.user) {
        authState.updateUserPlan(payment.plan, {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          billingCycle: payment.billingCycle,
          autoPayEnabled: payment.autoPay,
          autoPayStatus: payment.autoPayStatus,
          subscriptionId: payment.subscriptionId,
        });
      }
      useImageStore.getState().setPlan(payment.plan);

      if (active) {
        setIsVerifyingPayment(false);
        setReconciledReceipt({
          paymentId: payment.paymentId,
          plan: payment.plan,
          billingCycle: payment.billingCycle,
          autoPayEnabled: payment.autoPay,
          amount: payment.amount,
          currency: payment.currency,
        });
      }
      return true;
    };

    const schedulePendingCheckoutRetries = (
      userId?: string,
      userEmail?: string,
      firebaseIdToken?: string,
      knownPaymentIds: string[] = []
    ) => {
      const pending = getPendingCheckout();
      if (!pending || !active) return;

      if (pendingRetryTimer !== null) {
        window.clearTimeout(pendingRetryTimer);
        pendingRetryTimer = null;
      }

      setIsVerifyingPayment(true);
      let attempt = 0;
      const delays = [1800, 2500, 3500, 5000, 7000];

      const runAttempt = async () => {
        if (!active) return;
        const latestPending = getPendingCheckout();
        if (!latestPending) {
          setIsVerifyingPayment(false);
          return;
        }
        const rec = await reconcileUserPayments({
          userId,
          userEmail,
          firebaseIdToken,
          pendingCheckout: latestPending,
          knownPaymentIds,
        });
        if (!active) return;
        if (rec.found && rec.payment) {
          applyReconciledPaymentToStore(rec.payment, true);
          return;
        }
        if (attempt < delays.length) {
          const delay = delays[attempt++];
          pendingRetryTimer = window.setTimeout(() => {
            void runAttempt();
          }, delay);
        } else {
          setIsVerifyingPayment(false);
          // Clear stale pending marker after all retries if Razorpay shows no pending processing
          if (!rec.pendingProcessing && Date.now() - latestPending.startedAt > 120_000) {
            clearPendingCheckout();
          }
        }
      };

      pendingRetryTimer = window.setTimeout(() => {
        void runAttempt();
      }, 1000);
    };

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        syncCurrentViewToFirestore(fbUser.uid).catch(() => {});
        const { user, setSessionUser } = useAuthStore.getState();
        const isSameUser = Boolean(user && user.id === fbUser.uid);
        let plan: 'free' | 'pro' | 'max' | 'ultra' = isSameUser ? ((user?.plan as any) || 'free') : 'free';
        let billingCycle = isSameUser ? user?.billingCycle : undefined;
        let planExpiresAt = isSameUser ? user?.planExpiresAt : undefined;
        let lastPaymentId = isSameUser ? user?.lastPaymentId : undefined;
        let lastPaymentAmount = isSameUser ? user?.lastPaymentAmount : undefined;
        let lastPaymentCurrency = isSameUser ? user?.lastPaymentCurrency : undefined;
        let lastPaymentDate = isSameUser ? user?.lastPaymentDate : undefined;
        let paymentHistory = isSameUser ? user?.paymentHistory : undefined;
        let autoPayEnabled = isSameUser ? user?.autoPayEnabled : undefined;
        let autoPayStatus = isSameUser ? user?.autoPayStatus : undefined;
        let subscriptionId = isSameUser ? user?.subscriptionId : undefined;
        let autoPayUpdatedAt = isSameUser ? user?.autoPayUpdatedAt : undefined;
        let fsName: string | undefined;
        try {
          const fsProfile = await getUserFromFirestore(fbUser.uid);
          if (fsProfile?.name) {
            fsName = fsProfile.name;
          }
          if (fsProfile?.plan) {
            plan = fsProfile.plan as any;
          }
          if (fsProfile?.billingCycle) {
            billingCycle = fsProfile.billingCycle;
          }
          if (fsProfile?.planExpiresAt) {
            planExpiresAt = fsProfile.planExpiresAt;
          }
          if (fsProfile?.lastPaymentId) {
            lastPaymentId = fsProfile.lastPaymentId;
          }
          if (fsProfile?.lastPaymentAmount !== undefined) {
            lastPaymentAmount = fsProfile.lastPaymentAmount;
          }
          if (fsProfile?.lastPaymentCurrency) {
            lastPaymentCurrency = fsProfile.lastPaymentCurrency;
          }
          if (fsProfile?.lastPaymentDate) {
            lastPaymentDate = fsProfile.lastPaymentDate;
          }
          if (fsProfile?.paymentHistory && fsProfile.paymentHistory.length > 0) {
            paymentHistory = fsProfile.paymentHistory;
          }
          if (fsProfile?.autoPayEnabled !== undefined) {
            autoPayEnabled = fsProfile.autoPayEnabled;
          }
          if (fsProfile?.autoPayStatus) {
            autoPayStatus = fsProfile.autoPayStatus;
          }
          if (fsProfile?.subscriptionId) {
            subscriptionId = fsProfile.subscriptionId;
          }
          if (fsProfile?.autoPayUpdatedAt) {
            autoPayUpdatedAt = fsProfile.autoPayUpdatedAt;
          }
        } catch (err) {
          console.warn('[App] Firestore user profile sync note:', err);
        }

        // Reconcile any verified Razorpay webhook/GPay/UPI payment made before browser refresh or app kill
        const knownPaymentIds = Array.from(
          new Set(
            [
              lastPaymentId,
              ...(Array.isArray(paymentHistory) ? paymentHistory.map((p) => p.paymentId) : []),
            ].filter(Boolean) as string[]
          )
        );
        const pendingCheckout = getPendingCheckout();
        let fbIdToken: string | undefined;
        try {
          fbIdToken = await fbUser.getIdToken();
        } catch {
          // optional token
        }

        const reconciled = await reconcileUserPayments({
          userId: fbUser.uid,
          userEmail: fbUser.email || user?.email,
          firebaseIdToken: fbIdToken,
          pendingCheckout,
          knownPaymentIds,
        });

        let newlyReconciledPayment: NonNullable<typeof reconciled.payment> | null = null;
        if (reconciled.found && reconciled.payment && !isPaymentHandled(reconciled.payment.paymentId)) {
          const recPay = reconciled.payment;
          markPaymentHandled(recPay.paymentId);
          clearPendingCheckout();
          newlyReconciledPayment = recPay;

          const nowIso = new Date().toISOString();
          plan = recPay.plan;
          billingCycle = recPay.billingCycle;
          // Membership starts when the customer PAID (Razorpay time), not when they opened the site
          const paidAtRaw = recPay.createdAt ? new Date(recPay.createdAt) : null;
          const paidDate =
            paidAtRaw && !Number.isNaN(paidAtRaw.getTime()) && paidAtRaw.getTime() <= Date.now()
              ? paidAtRaw
              : new Date();
          const paidIso = paidDate.toISOString();
          planExpiresAt = calculatePlanExpiryDate(recPay.billingCycle, paidDate);
          autoPayEnabled = recPay.autoPay;
          autoPayStatus = recPay.autoPayStatus;
          if (recPay.subscriptionId) {
            subscriptionId = recPay.subscriptionId;
          }
          autoPayUpdatedAt = nowIso;
          lastPaymentId = recPay.paymentId;
          lastPaymentAmount = recPay.amount;
          lastPaymentCurrency = recPay.currency;
          lastPaymentDate = paidIso;

          const newRecord: PaymentRecord = {
            paymentId: recPay.paymentId,
            plan: recPay.plan,
            billingCycle: recPay.billingCycle,
            amount: recPay.amount,
            currency: recPay.currency,
            date: paidIso,
            expiresAt: planExpiresAt,
            autoPay: recPay.autoPay,
            subscriptionId: recPay.subscriptionId,
          };
          paymentHistory = [
            newRecord,
            ...(paymentHistory || []).filter((r) => r.paymentId !== newRecord.paymentId),
          ].slice(0, 20);

          updateUserPlanInFirestore(fbUser.uid, plan, {
            paymentId: recPay.paymentId,
            amount: recPay.amount,
            currency: recPay.currency,
            billingCycle,
            planExpiresAt,
            autoPayEnabled,
            autoPayStatus,
            subscriptionId,
            paymentHistory: paymentHistory as any,
          }).catch(() => {});
        } else if (pendingCheckout) {
          schedulePendingCheckoutRetries(
            fbUser.uid,
            fbUser.email || user?.email,
            fbIdToken,
            knownPaymentIds
          );
        }

        // Guard: if a profile holds a paid plan with zero payment records (legacy seeded state), reset to free
        const hasAnyPayment = Boolean(lastPaymentId) || (Array.isArray(paymentHistory) && paymentHistory.length > 0);
        if (plan !== 'free' && !hasAnyPayment) {
          plan = 'free';
          billingCycle = undefined;
          planExpiresAt = undefined;
          autoPayEnabled = false;
          autoPayStatus = 'off';
          updateUserPlanInFirestore(fbUser.uid, 'free', {
            autoPayEnabled: false,
            autoPayStatus: 'off',
          }).catch(() => {});
        }

        // Strict expiry check: if planExpiresAt has passed, verify AutoPay renewal or downgrade to Free
        if (plan !== 'free' && planExpiresAt) {
          const expiryMs = new Date(planExpiresAt).getTime();
          if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
            let renewed = false;
            if (autoPayEnabled && subscriptionId && !subscriptionId.startsWith('sub_pref_')) {
              const subCheck = await checkAutoPaySubscriptionStatus(subscriptionId);
              if (subCheck.isActive && subCheck.currentEndISO) {
                planExpiresAt = subCheck.currentEndISO;
                autoPayStatus = 'active';
                renewed = true;
                updateUserPlanInFirestore(fbUser.uid, plan, {
                  billingCycle,
                  planExpiresAt,
                  autoPayEnabled: true,
                  autoPayStatus: 'active',
                  subscriptionId,
                }).catch(() => {});
              }
            }

            if (!renewed) {
              plan = 'free';
              billingCycle = undefined;
              planExpiresAt = undefined;
              autoPayEnabled = false;
              autoPayStatus = 'cancelled';
              updateUserPlanInFirestore(fbUser.uid, 'free', {
                autoPayEnabled: false,
                autoPayStatus: 'cancelled',
              }).catch(() => {});
            }
          }
        }

        const latestStoreState = useAuthStore.getState();
        const latestStoreUser = latestStoreState.user;
        const latestSameUser = Boolean(latestStoreUser && latestStoreUser.id === fbUser.uid);
        const localSavedName = fbUser.email ? latestStoreState.getAccountNameByEmail(fbUser.email) : undefined;
        const emailPrefix = (fbUser.email || '').split('@')[0];
        const isRealName = (val?: string | null) =>
          Boolean(
            val &&
              val.trim() &&
              (!emailPrefix || val.trim().toLowerCase() !== emailPrefix.toLowerCase()) &&
              val.trim() !== 'User' &&
              val.trim() !== 'Google User'
          );
        const resolvedName =
          [fsName, fbUser.displayName, latestSameUser ? latestStoreUser?.name : undefined, localSavedName]
            .find(isRealName)
            ?.trim() ||
          fsName ||
          fbUser.displayName ||
          (latestSameUser ? latestStoreUser?.name : undefined) ||
          localSavedName ||
          emailPrefix ||
          'User';

        const restoredUser = {
          id: fbUser.uid,
          name: resolvedName,
          email: fbUser.email || user?.email,
          phone: fbUser.phoneNumber || user?.phone,
          authMethod: user?.authMethod || (fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email'),
          plan,
          billingCycle,
          planExpiresAt,
          autoPayEnabled,
          autoPayStatus,
          subscriptionId,
          autoPayUpdatedAt,
          lastPaymentId,
          lastPaymentAmount,
          lastPaymentCurrency,
          lastPaymentDate,
          paymentHistory,
          createdAt: user?.createdAt || new Date().toISOString(),
          avatarColor: user?.avatarColor || 'bg-blue-600',
          emailVerified: fbUser.emailVerified,
        };

        setSessionUser(restoredUser as any);
        useImageStore.getState().setPlan(plan);

        if (newlyReconciledPayment && active) {
          setIsVerifyingPayment(false);
          setReconciledReceipt({
            paymentId: newlyReconciledPayment.paymentId,
            plan: newlyReconciledPayment.plan,
            billingCycle: newlyReconciledPayment.billingCycle,
            autoPayEnabled: newlyReconciledPayment.autoPay,
            amount: newlyReconciledPayment.amount,
            currency: newlyReconciledPayment.currency,
          });
        }
      } else {
        // Ensure non-Firebase/local sessions also recover pending GPay/UPI payments & enforce expiry checks
        const { user, setSessionUser } = useAuthStore.getState();
        let localPlan = user?.plan || 'free';
        const pendingCheckout = getPendingCheckout();

        if (user || pendingCheckout) {
          const knownIds = Array.from(
            new Set(
              [
                user?.lastPaymentId,
                ...(Array.isArray(user?.paymentHistory) ? user.paymentHistory.map((p) => p.paymentId) : []),
              ].filter(Boolean) as string[]
            )
          );
          const rec = await reconcileUserPayments({
            userId: user?.id || pendingCheckout?.userId,
            userEmail: user?.email || pendingCheckout?.userEmail,
            pendingCheckout,
            knownPaymentIds: knownIds,
          });
          if (rec.found && rec.payment && !isPaymentHandled(rec.payment.paymentId)) {
            applyReconciledPaymentToStore(rec.payment, true);
            localPlan = rec.payment.plan;
          } else if (pendingCheckout) {
            schedulePendingCheckoutRetries(
              user?.id || pendingCheckout.userId,
              user?.email || pendingCheckout.userEmail,
              undefined,
              knownIds
            );
          }
        }

        const refreshedUser = useAuthStore.getState().user;
        localPlan = refreshedUser?.plan || localPlan;
        if (refreshedUser && localPlan !== 'free' && refreshedUser.planExpiresAt) {
          const expiryMs = new Date(refreshedUser.planExpiresAt).getTime();
          if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
            let renewed = false;
            if (refreshedUser.autoPayEnabled && refreshedUser.subscriptionId && !refreshedUser.subscriptionId.startsWith('sub_pref_')) {
              const subCheck = await checkAutoPaySubscriptionStatus(refreshedUser.subscriptionId);
              if (subCheck.isActive && subCheck.currentEndISO) {
                setSessionUser({
                  ...refreshedUser,
                  planExpiresAt: subCheck.currentEndISO,
                  autoPayStatus: 'active',
                });
                renewed = true;
              }
            }
            if (!renewed) {
              localPlan = 'free';
              setSessionUser({
                ...refreshedUser,
                plan: 'free',
                billingCycle: undefined,
                planExpiresAt: undefined,
                autoPayEnabled: false,
                autoPayStatus: 'cancelled',
              });
            }
          }
        }
        useImageStore.getState().setPlan(localPlan);
      }
    });

    const handleVisibilityRecovery = () => {
      if (document.visibilityState === 'hidden') return;
      if (isCheckoutModalOpen()) return;
      const pending = getPendingCheckout();
      if (!pending) return;
      const currentUser = useAuthStore.getState().user;
      const knownIds = Array.from(
        new Set(
          [
            currentUser?.lastPaymentId,
            ...(Array.isArray(currentUser?.paymentHistory)
              ? currentUser.paymentHistory.map((p) => p.paymentId)
              : []),
          ].filter(Boolean) as string[]
        )
      );
      void (async () => {
        let token: string | undefined;
        try {
          token = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
        } catch {
          // ignore
        }
        const rec = await reconcileUserPayments({
          userId: currentUser?.id || pending.userId,
          userEmail: currentUser?.email || pending.userEmail,
          firebaseIdToken: token,
          pendingCheckout: pending,
          knownPaymentIds: knownIds,
        });
        if (rec.found && rec.payment) {
          applyReconciledPaymentToStore(rec.payment, true);
        }
      })();
    };

    document.addEventListener('visibilitychange', handleVisibilityRecovery);
    window.addEventListener('focus', handleVisibilityRecovery);

    return () => {
      active = false;
      if (pendingRetryTimer !== null) {
        window.clearTimeout(pendingRetryTimer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityRecovery);
      window.removeEventListener('focus', handleVisibilityRecovery);
      unsubscribe();
    };
  }, []);

  // Handle browser back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    // Query (?redirect=...) ani hash kadhun route match sathi fakt path thev
    const pathOnly = path.split('?')[0].split('#')[0] || '/';
    setCurrentPath(pathOnly);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Determine current route matching
  const isEditor = currentPath.endsWith('/editor');
  const cleanPath = currentPath.replace(/\/editor$/, '');
  const activeTool = getToolBySlug(cleanPath);

  // Sync activeToolId in store
  useEffect(() => {
    if (activeTool && activeTool.id !== activeToolId) {
      setActiveToolId(activeTool.id);
    }
  }, [activeTool, activeToolId, setActiveToolId]);

  // Handle auto-redirect when images are prepared
  const handleImagesReady = (toolSlug: string) => {
    navigate(`/${toolSlug}/editor`);
  };

  const isAuthPage =
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/forgot-password';

  return (
    <div
      className={`${
        isAuthPage ? 'h-screen overflow-hidden' : 'min-h-screen'
      } flex flex-col bg-slate-50 text-slate-800 antialiased selection:bg-blue-500 selection:text-white font-sans`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-sm bg-slate-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-slide-in">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="flex-1 font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* SEO & Social Metadata Handler */}
      <SEOHelper currentPath={currentPath} activeTool={activeTool} />

      {/* Global Header */}
      <Header currentPath={currentPath} onNavigate={navigate} />

      {/* Main View Router */}
      <main
        className={`flex-1 ${
          isAuthPage
            ? 'flex flex-col overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            : ''
        }`}
      >
        {currentPath === '/' && <HomeView onNavigate={navigate} />}

        {currentPath === '/pricing' && <PricingView onNavigate={navigate} />}

        {currentPath === '/billing' && <BillingView onNavigate={navigate} />}

        {currentPath === '/admin' && <AdminView onNavigate={navigate} />}

        {currentPath === '/help' && <HelpView onNavigate={navigate} />}

        {currentPath === '/terms' && <PolicyView policy="terms" onNavigate={navigate} />}

        {currentPath === '/privacy-policy' && <PolicyView policy="privacy" onNavigate={navigate} />}

        {currentPath === '/refund-policy' && <PolicyView policy="refund" onNavigate={navigate} />}

        {currentPath === '/shipping-policy' && <PolicyView policy="shipping" onNavigate={navigate} />}

        {currentPath === '/login' && <AuthView initialTab="login" onNavigate={navigate} />}

        {currentPath === '/signup' && <AuthView initialTab="signup" onNavigate={navigate} />}

        {currentPath === '/forgot-password' && <AuthView initialTab="forgot" onNavigate={navigate} />}

        {activeTool && !isEditor && (
          <ToolUploadView
            tool={activeTool}
            onImagesReady={() => handleImagesReady(activeTool.slug)}
            onNavigate={navigate}
          />
        )}

        {activeTool && isEditor && (
          <ToolEditorView tool={activeTool} onNavigate={navigate} />
        )}

        {!activeTool &&
          currentPath !== '/' &&
          currentPath !== '/pricing' &&
          currentPath !== '/billing' &&
          currentPath !== '/admin' &&
          currentPath !== '/help' &&
          currentPath !== '/terms' &&
          currentPath !== '/privacy-policy' &&
          currentPath !== '/refund-policy' &&
          currentPath !== '/shipping-policy' &&
          currentPath !== '/login' &&
          currentPath !== '/signup' &&
          currentPath !== '/forgot-password' && (
          <div className="max-w-md mx-auto text-center py-24 px-4 space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Page Not Found</h2>
            <p className="text-sm text-slate-500">
              The tool or page you requested could not be located.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Return to All Tools
            </button>
          </div>
        )}
      </main>

      {/* Global Footer (Hidden on auth pages for 100% full-screen view) */}
      {!isAuthPage && <Footer onNavigate={navigate} />}

      {/* Global Pending Payment Verification Banner (after mobile refresh from GPay / UPI app) */}
      {isVerifyingPayment && !reconciledReceipt && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-blue-600 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-blue-400">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
          <span className="font-semibold">तुमचे GPay / UPI पेमेंट Razorpay सोबत तपासत आहे...</span>
        </div>
      )}

      {/* Global Recovered Payment Success Celebration Modal */}
      {reconciledReceipt && (
        <PaymentSuccessModal
          isOpen={Boolean(reconciledReceipt)}
          paymentId={reconciledReceipt.paymentId}
          plan={reconciledReceipt.plan}
          billingCycle={reconciledReceipt.billingCycle}
          autoPayEnabled={reconciledReceipt.autoPayEnabled}
          amount={reconciledReceipt.amount}
          currency={reconciledReceipt.currency}
          onClose={() => setReconciledReceipt(null)}
          onNavigateHome={() => navigate('/')}
        />
      )}

      {/* Plan Limits Warning / Upgrade Modal */}
      <PlanLimitModal onNavigateToPricing={() => navigate('/pricing')} />

      {/* Authentication (Login / New Account / Forgot Password) Modal */}
      <AuthModal />
    </div>
  );
}
