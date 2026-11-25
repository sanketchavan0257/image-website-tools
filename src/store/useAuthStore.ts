import { create } from 'zustand';
import { UserProfile, StoredUserAccount, AuthModalTab, OtpSessionState, PaymentRecord, AutoPayStatus } from '../types/auth';
import { PlanType, BillingCycle } from '../types';
import { updateUserPlanInFirestore, updateAutoPayInFirestore } from '../services/firestoreService';
import { calculatePlanExpiryDate } from '../services/razorpayService';
import { getAdminEmail } from '../config/env';

const STORAGE_KEY_AUTH_USER = 'pixiforge_auth_user';
const STORAGE_KEY_ACCOUNTS_DB = 'pixiforge_users_db';

export function getConfiguredAdminEmail(): string {
  return getAdminEmail();
}

export function isAdminUser(user: UserProfile | null | undefined): boolean {
  const adminEmail = getAdminEmail();
  return Boolean(adminEmail && user?.email && user.email.trim().toLowerCase() === adminEmail);
}

// Helper to generate a random 6-digit OTP code
export function generateRandomOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to get random avatar colors
const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
];

function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Initial seed accounts if none exist in localStorage
function getStoredAccounts(): StoredUserAccount[] {
  let accounts: StoredUserAccount[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS_DB);
    if (raw) {
      accounts = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed reading stored accounts', e);
  }

  // Ensure default accounts exist
  const defaultSeeds: StoredUserAccount[] = [
    {
      id: 'usr_demo_1',
      name: 'Demo User',
      email: 'demo@pixiforge.app',
      phone: '+91 9876543210',
      authMethod: 'email',
      passwordHash: 'password123',
      plan: 'free',
      createdAt: new Date().toISOString(),
      avatarColor: 'bg-blue-600',
    },
  ];

  const configuredAdmin = getAdminEmail();
  if (configuredAdmin) {
    defaultSeeds.push({
      id: 'usr_admin_1',
      name: configuredAdmin.split('@')[0] || 'Admin',
      email: configuredAdmin,
      authMethod: 'email',
      passwordHash: 'password123',
      plan: 'free',
      createdAt: new Date().toISOString(),
      avatarColor: 'bg-indigo-600',
    });
  }

  // Clean up any legacy auto-seeded unpaid admin/local pro state that has zero payment records
  for (const acc of accounts) {
    const hasPaymentRecord =
      Boolean(acc.lastPaymentId) || (Array.isArray(acc.paymentHistory) && acc.paymentHistory.length > 0);
    if (acc.plan !== 'free' && !hasPaymentRecord && (acc.id === 'usr_admin_1' || (configuredAdmin && acc.email?.toLowerCase() === configuredAdmin))) {
      acc.plan = 'free';
      delete acc.billingCycle;
      delete acc.planExpiresAt;
      acc.autoPayEnabled = false;
      acc.autoPayStatus = 'off';
    }
  }

  for (const seed of defaultSeeds) {
    if (!accounts.some((a) => a.email?.toLowerCase() === seed.email?.toLowerCase())) {
      accounts.push(seed);
    }
  }

  saveStoredAccounts(accounts);
  return accounts;
}

function saveStoredAccounts(accounts: StoredUserAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS_DB, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed saving accounts', e);
  }
}

// Multi-layer persistence helpers (LocalStorage + 10-year Persistent Cookie)
function setSessionCookie(user: UserProfile | null) {
  try {
    if (typeof document === 'undefined') return;
    if (user) {
      const val = encodeURIComponent(JSON.stringify(user));
      // 10 years persistent cookie so closing Chrome/browser will NEVER logout
      document.cookie = `pixiforge_session=${val}; path=/; max-age=315360000; SameSite=Lax`;
    } else {
      document.cookie = `pixiforge_session=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch (e) {
    console.warn('Cookie session write notice:', e);
  }
}

function getSessionCookie(): UserProfile | null {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )pixiforge_session=([^;]*)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      return JSON.parse(decoded);
    }
  } catch (e) {
    console.warn('Cookie session parse notice:', e);
  }
  return null;
}

function normalizeExpiredSession(user: UserProfile | null): UserProfile | null {
  if (!user) return null;
  const configuredAdmin = getAdminEmail();
  const hasPaymentRecord =
    Boolean(user.lastPaymentId) || (Array.isArray(user.paymentHistory) && user.paymentHistory.length > 0);
  if (
    user.plan !== 'free' &&
    !hasPaymentRecord &&
    (user.id === 'usr_admin_1' || (configuredAdmin && user.email?.toLowerCase() === configuredAdmin))
  ) {
    const cleaned: UserProfile = {
      ...user,
      plan: 'free',
      billingCycle: undefined,
      planExpiresAt: undefined,
      autoPayEnabled: false,
      autoPayStatus: 'off',
    };
    saveSessionUser(cleaned);
    return cleaned;
  }
  if (user.plan !== 'free' && user.planExpiresAt && !user.autoPayEnabled) {
    const expiryMs = new Date(user.planExpiresAt).getTime();
    if (!Number.isNaN(expiryMs) && Date.now() > expiryMs) {
      const downgraded: UserProfile = {
        ...user,
        plan: 'free',
        billingCycle: undefined,
        planExpiresAt: undefined,
        autoPayEnabled: false,
        autoPayStatus: 'off',
      };
      saveSessionUser(downgraded);
      return downgraded;
    }
  }
  return user;
}

function getStoredSessionUser(): UserProfile | null {
  // Layer 1: Check localStorage first
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_USER);
    if (raw) {
      const parsed = normalizeExpiredSession(JSON.parse(raw));
      if (parsed && parsed.email) {
        // Keep cookie backup in sync
        setSessionCookie(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed reading user session from localStorage', e);
  }

  // Layer 2: Check persistent cookie backup (recovers session if Chrome cleared local state on exit)
  try {
    const fromCookie = normalizeExpiredSession(getSessionCookie());
    if (fromCookie && fromCookie.email) {
      try {
        localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(fromCookie));
      } catch (e) {}
      return fromCookie;
    }
  } catch (e) {
    console.error('Failed reading user session from cookie', e);
  }

  return null;
}

function saveSessionUser(user: UserProfile | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
      setSessionCookie(user);
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
      setSessionCookie(null);
    }
  } catch (e) {
    console.error('Failed saving user session', e);
  }
}

interface AuthStoreState {
  user: UserProfile | null;
  isAuthModalOpen: boolean;
  authModalTab: AuthModalTab;
  activeOtp: OtpSessionState | null;
  lastGeneratedOtp: string | null;

  // Modal actions
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: AuthModalTab) => void;
  clearActiveOtp: () => void;

  // OTP generator (simulated live SMS / email delivery)
  sendOtp: (target: string, purpose: 'login' | 'signup' | 'forgot') => string;
  verifyOtpCode: (target: string, code: string) => boolean;

  // Auth operations
  setSessionUser: (user: UserProfile) => void;
  isEmailRegistered: (email: string) => boolean;
  getAccountNameByEmail: (email: string) => string | undefined;
  syncAccountPassword: (email: string, password: string, optionalName?: string) => void;
  updatePasswordOnly: (email: string, newPassword: string, optionalUser?: { id?: string; name?: string }) => { success: boolean; error?: string };
  loginWithEmail: (email: string, password: string, optionalName?: string) => { success: boolean; error?: string };
  signupWithEmail: (name: string, email: string, password: string, code?: string, firebaseUid?: string) => { success: boolean; error?: string };
  loginWithMobileOtp: (phone: string, code: string, optionalName?: string) => { success: boolean; error?: string };
  resetPassword: (target: string, code: string, newPassword: string) => { success: boolean; error?: string };
  updateUserName: (newName: string) => void;
  logout: () => void;
  updateUserPlan: (
    plan: PlanType,
    paymentInfo?: {
      paymentId?: string;
      amount?: number;
      currency?: string;
      billingCycle?: BillingCycle;
      autoPayEnabled?: boolean;
      autoPayStatus?: AutoPayStatus;
      subscriptionId?: string;
    }
  ) => void;
  setAutoPayStatus: (autoPayData: {
    autoPayEnabled: boolean;
    autoPayStatus: AutoPayStatus;
    subscriptionId?: string;
  }) => void;
  cancelMembership: (refundInfo: { paymentId?: string; refundId?: string; refundAmount: number; daysUsed: number; mode?: string }) => void;

  // Admin panel operations
  getAllKnownUsers: () => UserProfile[];
  adminOnlyCancelAutoPay: (targetUserId: string) => void;
  adminCancelMembershipWithRefund: (
    targetUserId: string,
    refundInfo: {
      refundType: 'full_autopay' | 'pro_rata';
      paymentId?: string;
      refundId?: string;
      refundAmount: number;
      daysUsed: number;
      mode?: string;
      fallbackUser?: UserProfile;
    }
  ) => void;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: getStoredSessionUser(),
  isAuthModalOpen: false,
  authModalTab: 'login',
  activeOtp: null,
  lastGeneratedOtp: null,

  openAuthModal: (tab = 'login') => {
    set({ isAuthModalOpen: true, authModalTab: tab });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false });
  },

  setAuthModalTab: (tab) => {
    set({ authModalTab: tab });
  },

  clearActiveOtp: () => {
    set({ activeOtp: null, lastGeneratedOtp: null });
  },

  setSessionUser: (user: UserProfile) => {
    saveSessionUser(user);
    set({ user, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
  },

  syncAccountPassword: (email: string, password: string, optionalName?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = optionalName?.trim().slice(0, 100);
    if (!cleanEmail || !cleanPassword) return;

    const accounts = getStoredAccounts();
    const existing = accounts.find((a) => a.email?.toLowerCase() === cleanEmail);
    const emailPrefix = cleanEmail.split('@')[0];
    if (existing) {
      existing.passwordHash = cleanPassword;
      if (cleanName && cleanName.toLowerCase() !== emailPrefix.toLowerCase()) {
        existing.name = cleanName;
      }
      saveStoredAccounts(accounts);
    } else {
      const newAcc: StoredUserAccount = {
        id: `usr_${Date.now()}`,
        name: cleanName || emailPrefix,
        email: cleanEmail,
        authMethod: 'email',
        passwordHash: cleanPassword,
        plan: 'free',
        createdAt: new Date().toISOString(),
        avatarColor: getRandomAvatarColor(),
      };
      accounts.push(newAcc);
      saveStoredAccounts(accounts);
    }
  },

  getAccountNameByEmail: (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return undefined;
    const accounts = getStoredAccounts();
    const found = accounts.find((a) => a.email?.toLowerCase() === cleanEmail);
    return found?.name?.trim() || undefined;
  },

  isEmailRegistered: (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const configuredAdmin = getAdminEmail();
    if ((configuredAdmin && cleanEmail === configuredAdmin) || cleanEmail === 'demo@pixiforge.app') {
      return true;
    }
    const accounts = getStoredAccounts();
    return accounts.some((a) => a.email?.toLowerCase() === cleanEmail);
  },

  updatePasswordOnly: (email: string, newPassword: string, optionalUser?: { id?: string; name?: string }) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = newPassword.trim();
    const accounts = getStoredAccounts();
    let account = accounts.find((a) => a.email?.toLowerCase() === cleanEmail);
    const configuredAdmin = getAdminEmail();

    if (!account) {
      account = {
        id:
          optionalUser?.id ||
          (configuredAdmin && cleanEmail === configuredAdmin ? 'usr_admin_1' : `usr_${Date.now()}`),
        name:
          optionalUser?.name?.trim() ||
          cleanEmail.split('@')[0] ||
          (configuredAdmin && cleanEmail === configuredAdmin ? 'Admin' : 'User'),
        email: cleanEmail,
        authMethod: 'email',
        passwordHash: cleanPassword,
        plan: 'free',
        createdAt: new Date().toISOString(),
        avatarColor: configuredAdmin && cleanEmail === configuredAdmin ? 'bg-indigo-600' : getRandomAvatarColor(),
      };
      accounts.push(account);
    } else {
      account.passwordHash = cleanPassword;
      if (optionalUser?.id && account.id.startsWith('usr_') && !optionalUser.id.startsWith('usr_')) {
        account.id = optionalUser.id;
      }
      if (optionalUser?.name?.trim() && (!account.name || account.name === cleanEmail.split('@')[0])) {
        account.name = optionalUser.name.trim();
      }
    }

    saveStoredAccounts(accounts);

    const sessionUser: UserProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      authMethod: account.authMethod,
      plan: account.plan,
      createdAt: account.createdAt,
      avatarColor: account.avatarColor,
    };

    saveSessionUser(sessionUser);
    set({ user: sessionUser, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
    return { success: true };
  },

  sendOtp: (target: string, purpose: 'login' | 'signup' | 'forgot') => {
    const code = generateRandomOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    const session: OtpSessionState = {
      target: target.trim().toLowerCase(),
      code,
      expiresAt,
      purpose,
    };
    set({ activeOtp: session, lastGeneratedOtp: code });
    return code;
  },

  verifyOtpCode: (target: string, code: string) => {
    const { activeOtp } = get();
    if (!activeOtp) return false;
    const cleanTarget = target.trim().toLowerCase();
    const isTargetMatch = activeOtp.target === cleanTarget;
    const isCodeMatch = activeOtp.code === code.trim();
    const isNotExpired = Date.now() <= activeOtp.expiresAt;
    return isTargetMatch && isCodeMatch && isNotExpired;
  },

  loginWithEmail: (email: string, password: string, optionalName?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const rawPassword = password;
    const cleanPassword = password.trim();
    const cleanName = optionalName?.trim().slice(0, 100);

    const accounts = getStoredAccounts();
    let account = accounts.find((a) => a.email?.toLowerCase() === cleanEmail);

    const configuredAdmin = getAdminEmail();
    if (!account) {
      if (configuredAdmin && cleanEmail === configuredAdmin) {
        account = {
          id: 'usr_admin_1',
          name: cleanName || configuredAdmin.split('@')[0] || 'Admin',
          email: configuredAdmin,
          authMethod: 'email',
          passwordHash: cleanPassword,
          plan: 'free',
          createdAt: new Date().toISOString(),
          avatarColor: 'bg-indigo-600',
        };
        accounts.push(account);
        saveStoredAccounts(accounts);
      } else {
        return { success: false, error: 'No account found with this email. Please check or create a new account.' };
      }
    }

    // Strict password verification against stored credential
    const storedHash = account.passwordHash;
    const isDemoAccount = cleanEmail === 'demo@pixiforge.app';
    const isMatch = Boolean(
      storedHash &&
        (storedHash === rawPassword ||
          storedHash === cleanPassword ||
          storedHash.trim() === cleanPassword ||
          (isDemoAccount && cleanPassword === 'password123'))
    );

    if (!isMatch) {
      return { success: false, error: 'Incorrect password. Try again or click Forgot Password.' };
    }

    // Always sync the validated password and entered display name into the account record
    account.passwordHash = cleanPassword;
    if (cleanName) {
      account.name = cleanName;
    }
    saveStoredAccounts(accounts);

    const sessionUser: UserProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      authMethod: 'email',
      plan: account.plan,
      createdAt: account.createdAt,
      avatarColor: account.avatarColor || 'bg-blue-600',
    };

    saveSessionUser(sessionUser);
    set({ user: sessionUser, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
    return { success: true };
  },

  signupWithEmail: (name: string, email: string, password: string, code?: string, firebaseUid?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const { verifyOtpCode } = get();

    // Verify OTP if code is supplied
    if (code !== undefined) {
      if (!verifyOtpCode(cleanEmail, code)) {
        return { success: false, error: 'Invalid or expired Email OTP code. Please enter the correct code.' };
      }
    }

    const accounts = getStoredAccounts();
    const existing = accounts.find((a) => a.email?.toLowerCase() === cleanEmail);

    if (existing) {
      // Update password, Firebase UID (if supplied), and full name entered during signup
      existing.passwordHash = cleanPassword;
      if (firebaseUid) {
        existing.id = firebaseUid;
      }
      if (name.trim()) {
        existing.name = name.trim().slice(0, 100);
      }
      saveStoredAccounts(accounts);

      const sessionUser: UserProfile = {
        id: existing.id,
        name: existing.name || name.trim() || 'User',
        email: existing.email,
        phone: existing.phone,
        authMethod: 'email',
        plan: existing.plan || 'free',
        createdAt: existing.createdAt,
        avatarColor: existing.avatarColor || getRandomAvatarColor(),
      };

      saveSessionUser(sessionUser);
      set({ user: sessionUser, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
      return { success: true };
    }

    const newAccount: StoredUserAccount = {
      id: firebaseUid || `usr_${Date.now()}`,
      name: name.trim() || 'User',
      email: cleanEmail,
      authMethod: 'email',
      passwordHash: cleanPassword,
      plan: 'free',
      createdAt: new Date().toISOString(),
      avatarColor: getRandomAvatarColor(),
    };

    accounts.push(newAccount);
    saveStoredAccounts(accounts);

    const sessionUser: UserProfile = {
      id: newAccount.id,
      name: newAccount.name,
      email: newAccount.email,
      phone: newAccount.phone,
      authMethod: 'email',
      plan: 'free',
      createdAt: newAccount.createdAt,
      avatarColor: newAccount.avatarColor,
    };

    saveSessionUser(sessionUser);
    set({ user: sessionUser, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
    return { success: true };
  },

  loginWithMobileOtp: (phone: string, code: string, optionalName?: string) => {
    const { verifyOtpCode } = get();
    const cleanPhone = phone.trim();

    if (!verifyOtpCode(cleanPhone, code)) {
      return { success: false, error: 'Invalid or expired OTP code. Please try again.' };
    }

    const accounts = getStoredAccounts();
    let account = accounts.find((a) => a.phone === cleanPhone);

    if (!account) {
      // Auto-create account for new mobile OTP users
      account = {
        id: `usr_mob_${Date.now()}`,
        name: optionalName?.trim() || `User ${cleanPhone.slice(-4)}`,
        phone: cleanPhone,
        authMethod: 'mobile',
        plan: 'free',
        createdAt: new Date().toISOString(),
        avatarColor: getRandomAvatarColor(),
      };
      accounts.push(account);
      saveStoredAccounts(accounts);
    }

    const sessionUser: UserProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      authMethod: 'mobile',
      plan: account.plan,
      createdAt: account.createdAt,
      avatarColor: account.avatarColor,
    };

    saveSessionUser(sessionUser);
    set({ user: sessionUser, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
    return { success: true };
  },

  resetPassword: (target: string, code: string, newPassword: string) => {
    const { verifyOtpCode } = get();
    const cleanTarget = target.trim().toLowerCase();

    if (!verifyOtpCode(cleanTarget, code)) {
      return { success: false, error: 'Invalid or expired OTP code. Please enter the correct OTP.' };
    }

    const accounts = getStoredAccounts();
    const account = accounts.find(
      (a) => a.email?.toLowerCase() === cleanTarget || a.phone?.toLowerCase() === cleanTarget
    );

    if (!account) {
      return { success: false, error: 'Account not found for this email or mobile number.' };
    }

    account.passwordHash = newPassword;
    saveStoredAccounts(accounts);

    // Auto login with new password
    const sessionUser: UserProfile = {
      id: account.id,
      name: account.name,
      email: account.email,
      phone: account.phone,
      authMethod: account.authMethod,
      plan: account.plan,
      createdAt: account.createdAt,
      avatarColor: account.avatarColor,
    };

    saveSessionUser(sessionUser);
    set({ user: sessionUser, isAuthModalOpen: false, activeOtp: null, lastGeneratedOtp: null });
    return { success: true };
  },

  updateUserName: (newName: string) => {
    const cleanName = newName.trim().slice(0, 100);
    const { user } = get();
    if (!cleanName || !user) return;

    const updated: UserProfile = {
      ...user,
      name: cleanName,
    };
    saveSessionUser(updated);

    const accounts = getStoredAccounts();
    const account = accounts.find(
      (a) =>
        a.id === user.id ||
        (user.email && a.email?.toLowerCase() === user.email.toLowerCase()) ||
        (user.phone && a.phone === user.phone)
    );
    if (account) {
      account.name = cleanName;
      saveStoredAccounts(accounts);
    }

    set({ user: updated });
  },

  logout: () => {
    saveSessionUser(null);
    set({ user: null, activeOtp: null, lastGeneratedOtp: null });
  },

  updateUserPlan: (plan: PlanType, paymentInfo) => {
    const { user } = get();
    if (!user) return;
    const now = new Date().toISOString();
    const cycle: BillingCycle = paymentInfo?.billingCycle || 'monthly';
    const planExpiresAt = plan === 'free' ? undefined : calculatePlanExpiryDate(cycle);
    const autoPayEnabled = plan === 'free' ? false : paymentInfo?.autoPayEnabled ?? user.autoPayEnabled ?? false;
    const autoPayStatus: AutoPayStatus =
      plan === 'free'
        ? 'cancelled'
        : paymentInfo?.autoPayStatus || (autoPayEnabled ? 'active' : 'off');
    const subscriptionId = plan === 'free' ? user.subscriptionId : paymentInfo?.subscriptionId || user.subscriptionId;

    const existingHistory = user.paymentHistory || [];
    const normalizedCurrency = (paymentInfo?.currency || user.lastPaymentCurrency || 'INR').toUpperCase();
    const newRecord: PaymentRecord | null = paymentInfo?.paymentId
      ? {
          paymentId: paymentInfo.paymentId,
          plan,
          billingCycle: cycle,
          amount: paymentInfo.amount ?? 0,
          currency: normalizedCurrency,
          date: now,
          expiresAt: planExpiresAt,
          autoPay: autoPayEnabled,
          subscriptionId,
        }
      : null;

    const updatedHistory = newRecord
      ? [newRecord, ...existingHistory.filter((r) => r.paymentId !== newRecord.paymentId)].slice(0, 20)
      : existingHistory;

    const updated: UserProfile = {
      ...user,
      plan,
      ...(plan !== 'free'
        ? {
            billingCycle: cycle,
            planExpiresAt,
            autoPayEnabled,
            autoPayStatus,
            subscriptionId,
            autoPayUpdatedAt: now,
          }
        : {
            billingCycle: undefined,
            planExpiresAt: undefined,
            autoPayEnabled: false,
            autoPayStatus: 'cancelled',
            autoPayUpdatedAt: now,
          }),
      paymentHistory: updatedHistory,
      ...(paymentInfo?.paymentId
        ? {
            lastPaymentId: paymentInfo.paymentId,
            lastPaymentAmount: paymentInfo.amount,
            lastPaymentCurrency: normalizedCurrency,
            lastPaymentDate: now,
          }
        : {}),
    };
    saveSessionUser(updated);

    const accounts = getStoredAccounts();
    const account = accounts.find((a) => a.id === user.id);
    if (account) {
      account.plan = plan;
      account.paymentHistory = updatedHistory;
      account.autoPayUpdatedAt = now;
      if (plan !== 'free') {
        account.billingCycle = cycle;
        account.planExpiresAt = planExpiresAt;
        account.autoPayEnabled = autoPayEnabled;
        account.autoPayStatus = autoPayStatus;
        if (subscriptionId) account.subscriptionId = subscriptionId;
      } else {
        delete account.billingCycle;
        delete account.planExpiresAt;
        account.autoPayEnabled = false;
        account.autoPayStatus = 'cancelled';
      }
      if (paymentInfo?.paymentId) {
        account.lastPaymentId = paymentInfo.paymentId;
        account.lastPaymentAmount = paymentInfo.amount;
        account.lastPaymentCurrency = normalizedCurrency;
        account.lastPaymentDate = now;
      }
      saveStoredAccounts(accounts);
    }

    if (user.id) {
      updateUserPlanInFirestore(user.id, plan, {
        ...paymentInfo,
        currency: normalizedCurrency,
        billingCycle: plan !== 'free' ? cycle : undefined,
        planExpiresAt,
        autoPayEnabled,
        autoPayStatus,
        subscriptionId,
        paymentHistory: updatedHistory as any,
      }).catch((err) => {
        console.warn('Firestore plan sync warning:', err);
      });
    }

    set({ user: updated });
  },

  setAutoPayStatus: (autoPayData) => {
    const { user } = get();
    if (!user) return;
    const now = new Date().toISOString();
    const updated: UserProfile = {
      ...user,
      autoPayEnabled: autoPayData.autoPayEnabled,
      autoPayStatus: autoPayData.autoPayStatus,
      subscriptionId: autoPayData.subscriptionId ?? user.subscriptionId,
      autoPayUpdatedAt: now,
    };
    saveSessionUser(updated);

    const accounts = getStoredAccounts();
    const account = accounts.find((a) => a.id === user.id);
    if (account) {
      account.autoPayEnabled = autoPayData.autoPayEnabled;
      account.autoPayStatus = autoPayData.autoPayStatus;
      account.autoPayUpdatedAt = now;
      if (autoPayData.subscriptionId) {
        account.subscriptionId = autoPayData.subscriptionId;
      }
      saveStoredAccounts(accounts);
    }

    if (user.id) {
      updateAutoPayInFirestore(user.id, autoPayData).catch((err) => {
        console.warn('Firestore AutoPay sync warning:', err);
      });
    }

    set({ user: updated });
  },

  cancelMembership: (refundInfo) => {
    const { user } = get();
    if (!user) return;
    const now = new Date().toISOString();
    const refundStatus: PaymentRecord['status'] =
      refundInfo.mode === 'razorpay_api' ? 'cancelled_refunded' : 'refund_pending';

    const existingHistory = user.paymentHistory || [];
    let updatedHistory: PaymentRecord[] = [];

    if (existingHistory.length > 0) {
      const targetIndex = refundInfo.paymentId
        ? existingHistory.findIndex((r) => r.paymentId === refundInfo.paymentId)
        : 0;
      const idx = targetIndex >= 0 ? targetIndex : 0;
      updatedHistory = existingHistory.map((item, i) =>
        i === idx
          ? {
              ...item,
              status: refundStatus,
              refundAmount: refundInfo.refundAmount,
              refundId: refundInfo.refundId,
              cancelledAt: now,
              daysUsed: refundInfo.daysUsed,
            }
          : item
      );
    } else if (user.lastPaymentId || refundInfo.refundAmount >= 0) {
      updatedHistory = [
        {
          paymentId: refundInfo.paymentId || user.lastPaymentId || `pay_${Date.now()}`,
          plan: user.plan,
          billingCycle: user.billingCycle || 'monthly',
          amount: user.lastPaymentAmount || 0,
          currency: user.lastPaymentCurrency || 'INR',
          date: user.lastPaymentDate || user.createdAt,
          expiresAt: user.planExpiresAt,
          status: refundStatus,
          refundAmount: refundInfo.refundAmount,
          refundId: refundInfo.refundId,
          cancelledAt: now,
          daysUsed: refundInfo.daysUsed,
        },
      ];
    }

    const updated: UserProfile = {
      ...user,
      plan: 'free',
      billingCycle: undefined,
      planExpiresAt: undefined,
      autoPayEnabled: false,
      autoPayStatus: 'cancelled',
      autoPayUpdatedAt: now,
      paymentHistory: updatedHistory,
    };

    saveSessionUser(updated);

    const accounts = getStoredAccounts();
    const account = accounts.find((a) => a.id === user.id);
    if (account) {
      account.plan = 'free';
      account.paymentHistory = updatedHistory;
      account.autoPayEnabled = false;
      account.autoPayStatus = 'cancelled';
      account.autoPayUpdatedAt = now;
      delete account.billingCycle;
      delete account.planExpiresAt;
      saveStoredAccounts(accounts);
    }

    if (user.id) {
      updateUserPlanInFirestore(user.id, 'free', {
        autoPayEnabled: false,
        autoPayStatus: 'cancelled',
        paymentHistory: updatedHistory as any,
      }).catch((err) => {
        console.warn('Firestore cancel membership sync warning:', err);
      });
    }

    set({ user: updated });
  },

  getAllKnownUsers: () => {
    const accounts = getStoredAccounts();
    const mapped: UserProfile[] = accounts.map(({ passwordHash: _pw, ...profile }) => profile);
    const current = get().user;
    if (
      current &&
      !mapped.some(
        (u) =>
          u.id === current.id ||
          (current.email && u.email?.toLowerCase() === current.email.toLowerCase())
      )
    ) {
      mapped.unshift(current);
    }
    return mapped;
  },

  adminOnlyCancelAutoPay: (targetUserId: string) => {
    const now = new Date().toISOString();
    const accounts = getStoredAccounts();
    const account = accounts.find((a) => a.id === targetUserId);
    if (account) {
      account.autoPayEnabled = false;
      account.autoPayStatus = 'cancelled';
      account.autoPayUpdatedAt = now;
      saveStoredAccounts(accounts);
    }

    updateAutoPayInFirestore(targetUserId, {
      autoPayEnabled: false,
      autoPayStatus: 'cancelled',
    }).catch((err) => {
      console.warn('Firestore admin AutoPay cancel warning:', err);
    });

    const current = get().user;
    if (current && (current.id === targetUserId || (account?.email && current.email?.toLowerCase() === account.email.toLowerCase()))) {
      const updatedCurrent: UserProfile = {
        ...current,
        autoPayEnabled: false,
        autoPayStatus: 'cancelled',
        autoPayUpdatedAt: now,
      };
      saveSessionUser(updatedCurrent);
      set({ user: updatedCurrent });
    }
  },

  adminCancelMembershipWithRefund: (targetUserId, refundInfo) => {
    const now = new Date().toISOString();
    const refundStatus: PaymentRecord['status'] =
      refundInfo.mode === 'razorpay_api' ? 'cancelled_refunded' : 'refund_pending';

    const accounts = getStoredAccounts();
    const account = accounts.find((a) => a.id === targetUserId);
    const sourceProfile = account || refundInfo.fallbackUser;

    const existingHistory = sourceProfile?.paymentHistory || [];
    let updatedHistory: PaymentRecord[] = [];

    if (existingHistory.length > 0) {
      const targetIndex = refundInfo.paymentId
        ? existingHistory.findIndex((r) => r.paymentId === refundInfo.paymentId)
        : 0;
      const idx = targetIndex >= 0 ? targetIndex : 0;
      updatedHistory = existingHistory.map((item, i) =>
        i === idx
          ? {
              ...item,
              status: refundStatus,
              refundAmount: refundInfo.refundAmount,
              refundId: refundInfo.refundId,
              cancelledAt: now,
              daysUsed: refundInfo.daysUsed,
              autoPay: false,
            }
          : item
      );
    } else if (sourceProfile) {
      updatedHistory = [
        {
          paymentId: refundInfo.paymentId || sourceProfile.lastPaymentId || `pay_${Date.now()}`,
          plan: sourceProfile.plan,
          billingCycle: sourceProfile.billingCycle || 'monthly',
          amount: sourceProfile.lastPaymentAmount || refundInfo.refundAmount || 0,
          currency: sourceProfile.lastPaymentCurrency || 'INR',
          date: sourceProfile.lastPaymentDate || sourceProfile.createdAt,
          expiresAt: sourceProfile.planExpiresAt,
          autoPay: false,
          subscriptionId: sourceProfile.subscriptionId,
          status: refundStatus,
          refundAmount: refundInfo.refundAmount,
          refundId: refundInfo.refundId,
          cancelledAt: now,
          daysUsed: refundInfo.daysUsed,
        },
      ];
    }

    if (account) {
      account.plan = 'free';
      account.paymentHistory = updatedHistory;
      account.autoPayEnabled = false;
      account.autoPayStatus = 'cancelled';
      account.autoPayUpdatedAt = now;
      delete account.billingCycle;
      delete account.planExpiresAt;
      saveStoredAccounts(accounts);
    }

    updateUserPlanInFirestore(targetUserId, 'free', {
      autoPayEnabled: false,
      autoPayStatus: 'cancelled',
      paymentHistory: updatedHistory as any,
    }).catch((err) => {
      console.warn('Firestore admin cancel membership sync warning:', err);
    });

    const current = get().user;
    if (
      current &&
      (current.id === targetUserId ||
        (sourceProfile?.email && current.email?.toLowerCase() === sourceProfile.email.toLowerCase()))
    ) {
      const updatedCurrent: UserProfile = {
        ...current,
        plan: 'free',
        billingCycle: undefined,
        planExpiresAt: undefined,
        autoPayEnabled: false,
        autoPayStatus: 'cancelled',
        autoPayUpdatedAt: now,
        paymentHistory: updatedHistory,
      };
      saveSessionUser(updatedCurrent);
      set({ user: updatedCurrent });
    }
  },
}));
