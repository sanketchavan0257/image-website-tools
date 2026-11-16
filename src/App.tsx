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
import { PlanLimitModal } from './components/common/PlanLimitModal';
import { AuthModal } from './components/auth/AuthModal';
import { AuthView } from './views/AuthView';
import { SEOHelper } from './components/common/SEOHelper';
import { AlertCircle, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { useAuthStore } from './store/useAuthStore';
import { getUserFromFirestore, updateUserPlanInFirestore } from './services/firestoreService';
import { checkAutoPaySubscriptionStatus } from './services/razorpayService';
import { trackWebsiteVisit, syncCurrentViewToFirestore } from './services/analyticsService';

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

  // Record website visit once per page load (Country, State, District, Taluka + timestamp)
  useEffect(() => {
    trackWebsiteVisit(window.location.pathname || '/').catch(() => {});
  }, []);

  // Persistent login + strict membership expiry/AutoPay verification
  useEffect(() => {
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
          lastPaymentDate,
          paymentHistory,
          createdAt: user?.createdAt || new Date().toISOString(),
          avatarColor: user?.avatarColor || 'bg-blue-600',
          emailVerified: fbUser.emailVerified,
        };

        setSessionUser(restoredUser as any);
        useImageStore.getState().setPlan(plan);
      } else {
        // Ensure non-Firebase/local sessions also enforce expiry & AutoPay checks
        const { user, setSessionUser } = useAuthStore.getState();
        let localPlan = user?.plan || 'free';
        if (user && localPlan !== 'free' && user.planExpiresAt) {
          const expiryMs = new Date(user.planExpiresAt).getTime();
          if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
            let renewed = false;
            if (user.autoPayEnabled && user.subscriptionId && !user.subscriptionId.startsWith('sub_pref_')) {
              const subCheck = await checkAutoPaySubscriptionStatus(user.subscriptionId);
              if (subCheck.isActive && subCheck.currentEndISO) {
                setSessionUser({
                  ...user,
                  planExpiresAt: subCheck.currentEndISO,
                  autoPayStatus: 'active',
                });
                renewed = true;
              }
            }
            if (!renewed) {
              localPlan = 'free';
              setSessionUser({
                ...user,
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

    return () => unsubscribe();
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

      {/* Plan Limits Warning / Upgrade Modal */}
      <PlanLimitModal onNavigateToPricing={() => navigate('/pricing')} />

      {/* Authentication (Login / New Account / Forgot Password) Modal */}
      <AuthModal />
    </div>
  );
}