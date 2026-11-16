import { PlanType, BillingCycle } from './index';

export type AutoPayStatus = 'active' | 'pending_mandate' | 'cancelled' | 'off';

export interface PaymentRecord {
  paymentId: string;
  plan: PlanType;
  billingCycle: BillingCycle;
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

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  authMethod: 'email' | 'mobile' | 'google';
  plan: PlanType;
  billingCycle?: BillingCycle;
  planExpiresAt?: string;
  autoPayEnabled?: boolean;
  autoPayStatus?: AutoPayStatus;
  subscriptionId?: string;
  autoPayUpdatedAt?: string;
  createdAt: string;
  avatarColor?: string;
  emailVerified?: boolean;
  lastPaymentId?: string;
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
  paymentHistory?: PaymentRecord[];
}

export interface StoredUserAccount extends UserProfile {
  passwordHash?: string; // Stored locally for simulation
}

export type AuthModalTab = 'login' | 'signup' | 'forgot';
export type AuthMethodType = 'email' | 'mobile';

export interface OtpSessionState {
  target: string; // email or phone
  code: string;
  expiresAt: number;
  purpose: 'login' | 'signup' | 'forgot';
}
