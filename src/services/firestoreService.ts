import {
  doc,
  setDoc,
  getDoc,
  getDocFromCache,
  updateDoc,
  deleteField,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirestoreOfflineError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || '';
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('network-request-failed')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  if (isFirestoreOfflineError(error)) {
    console.warn(`[Firestore Offline] ${operationType} on ${path}:`, errInfo.error);
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  return errInfo;
}

export interface FirestorePaymentRecord {
  paymentId: string;
  plan: 'free' | 'pro' | 'max' | 'ultra';
  billingCycle: 'monthly' | '3months' | '6months' | 'yearly';
  amount: number;
  date: string;
  expiresAt?: string;
  autoPay?: boolean;
  subscriptionId?: string;
  status?: 'paid' | 'cancelled_refunded' | 'refund_pending';
  refundAmount?: number;
  refundId?: string;
  cancelledAt?: string;
  daysUsed?: number;
}

export interface FirestoreUserData {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  plan: 'free' | 'pro' | 'max' | 'ultra';
  billingCycle?: 'monthly' | '3months' | '6months' | 'yearly';
  planExpiresAt?: string;
  autoPayEnabled?: boolean;
  autoPayStatus?: 'active' | 'pending_mandate' | 'cancelled' | 'off';
  subscriptionId?: string;
  autoPayUpdatedAt?: string;
  lastPaymentId?: string;
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
  paymentHistory?: FirestorePaymentRecord[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Saves or updates a user profile document directly in Cloud Firestore
 * Collection: users
 * Document ID: userId (matches auth.currentUser.uid)
 */
export async function saveUserToFirestore(userData: {
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  plan?: 'free' | 'pro' | 'max' | 'ultra';
}): Promise<{ success: boolean; data?: FirestoreUserData; error?: string }> {
  const path = `users/${userData.userId}`;
  const now = new Date().toISOString();

  const payload: FirestoreUserData = {
    userId: userData.userId,
    name: (userData.name || 'User').trim().slice(0, 100),
    plan: userData.plan || 'free',
    createdAt: now,
    updatedAt: now,
  };

  if (userData.email) {
    payload.email = userData.email.trim().toLowerCase().slice(0, 150);
  }
  if (userData.phone) {
    payload.phone = userData.phone.trim().slice(0, 50);
  }

  try {
    const userRef = doc(db, 'users', userData.userId);
    // Use merge: true so existing fields like createdAt are preserved on subsequent writes
    await setDoc(userRef, payload, { merge: true });
    console.log(`[Firestore] User profile successfully written to ${path}`);
    return { success: true, data: payload };
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return { success: false, error: err?.message || 'Failed saving user to Firestore' };
  }
}

/**
 * Reads a user profile from Cloud Firestore with offline cache fallback & offline status reporting
 */
export async function getUserProfileWithStatus(
  userId: string
): Promise<{ data: FirestoreUserData | null; offline: boolean }> {
  if (!userId) {
    return { data: null, offline: false };
  }
  const path = `users/${userId}`;
  const userRef = doc(db, 'users', userId);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    try {
      const cached = await getDocFromCache(userRef);
      if (cached.exists()) {
        return { data: cached.data() as FirestoreUserData, offline: true };
      }
    } catch {
      // Cache miss while offline
    }
    return { data: null, offline: true };
  }

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { data: snap.data() as FirestoreUserData, offline: false };
    }
    return { data: null, offline: false };
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      try {
        const cached = await getDocFromCache(userRef);
        if (cached.exists()) {
          return { data: cached.data() as FirestoreUserData, offline: true };
        }
      } catch {
        // Cache miss while offline
      }
      handleFirestoreError(err, OperationType.GET, path);
      return { data: null, offline: true };
    }
    handleFirestoreError(err, OperationType.GET, path);
    return { data: null, offline: false };
  }
}

/**
 * Reads a user profile from Cloud Firestore
 */
export async function getUserFromFirestore(userId: string): Promise<FirestoreUserData | null> {
  const { data } = await getUserProfileWithStatus(userId);
  return data;
}

/**
 * Lists all user profiles from Cloud Firestore (Admin only per firestore.rules)
 */
export async function getAllUsersFromFirestore(): Promise<FirestoreUserData[]> {
  if (!auth.currentUser) {
    return [];
  }
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({
      ...(d.data() as FirestoreUserData),
      userId: (d.data() as FirestoreUserData).userId || d.id,
    }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

/**
 * Updates subscription plan and AutoPay details for a user in Cloud Firestore
 */
export async function updateUserPlanInFirestore(
  userId: string,
  plan: 'free' | 'pro' | 'max' | 'ultra',
  paymentInfo?: {
    paymentId?: string;
    amount?: number;
    currency?: string;
    billingCycle?: 'monthly' | '3months' | '6months' | 'yearly';
    planExpiresAt?: string;
    autoPayEnabled?: boolean;
    autoPayStatus?: 'active' | 'pending_mandate' | 'cancelled' | 'off';
    subscriptionId?: string;
    paymentHistory?: FirestorePaymentRecord[];
  }
): Promise<boolean> {
  if (!auth.currentUser || (userId.startsWith('usr_') && auth.currentUser.uid !== userId)) {
    return false;
  }
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      plan,
      updatedAt: now,
    };
    if (plan === 'free') {
      updatePayload.billingCycle = deleteField();
      updatePayload.planExpiresAt = deleteField();
      updatePayload.autoPayEnabled = false;
      updatePayload.autoPayStatus = paymentInfo?.autoPayStatus || 'cancelled';
      updatePayload.autoPayUpdatedAt = now;
    } else {
      if (paymentInfo?.billingCycle) {
        updatePayload.billingCycle = paymentInfo.billingCycle;
      }
      if (paymentInfo?.planExpiresAt) {
        updatePayload.planExpiresAt = paymentInfo.planExpiresAt;
      }
      if (paymentInfo?.autoPayEnabled !== undefined) {
        updatePayload.autoPayEnabled = paymentInfo.autoPayEnabled;
        updatePayload.autoPayUpdatedAt = now;
      }
      if (paymentInfo?.autoPayStatus) {
        updatePayload.autoPayStatus = paymentInfo.autoPayStatus;
      }
      if (paymentInfo?.subscriptionId) {
        updatePayload.subscriptionId = paymentInfo.subscriptionId;
      }
    }
    if (paymentInfo?.paymentId) {
      updatePayload.lastPaymentId = paymentInfo.paymentId;
      if (paymentInfo.amount !== undefined) {
        updatePayload.lastPaymentAmount = paymentInfo.amount;
      }
      updatePayload.lastPaymentDate = now;
    }
    if (paymentInfo?.paymentHistory) {
      updatePayload.paymentHistory = paymentInfo.paymentHistory.slice(0, 20);
    }
    await updateDoc(userRef, updatePayload);
    console.log(`[Firestore] Updated plan to "${plan}" for ${path}`);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    return false;
  }
}

/**
 * Updates AutoPay status independently in Cloud Firestore
 */
export async function updateAutoPayInFirestore(
  userId: string,
  autoPayData: {
    autoPayEnabled: boolean;
    autoPayStatus: 'active' | 'pending_mandate' | 'cancelled' | 'off';
    subscriptionId?: string;
  }
): Promise<boolean> {
  if (!auth.currentUser || (userId.startsWith('usr_') && auth.currentUser.uid !== userId)) {
    return false;
  }
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const now = new Date().toISOString();
    const payload: Record<string, any> = {
      autoPayEnabled: autoPayData.autoPayEnabled,
      autoPayStatus: autoPayData.autoPayStatus,
      autoPayUpdatedAt: now,
      updatedAt: now,
    };
    if (autoPayData.subscriptionId) {
      payload.subscriptionId = autoPayData.subscriptionId;
    }
    await updateDoc(userRef, payload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    return false;
  }
}

/**
 * Updates only the user's display name in Cloud Firestore without modifying subscription or payment fields
 */
export async function updateUserNameInFirestore(userId: string, name: string): Promise<boolean> {
  const cleanName = name.trim().slice(0, 100);
  if (!cleanName || !auth.currentUser || (userId.startsWith('usr_') && auth.currentUser.uid !== userId)) {
    return false;
  }
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      name: cleanName,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err: any) {
    if (err?.code === 'not-found') {
      const saved = await saveUserToFirestore({
        userId,
        name: cleanName,
        email: auth.currentUser.email || undefined,
        plan: 'free',
      });
      return saved.success;
    }
    handleFirestoreError(err, OperationType.UPDATE, path);
    return false;
  }
}

