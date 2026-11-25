// Transactional Email & Server OTP Service (dispatched via server.ts)

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  expiresInSeconds?: number;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  verificationToken?: string;
  error?: string;
}

export interface ServerAuthResult {
  success: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    createdAt?: string;
  };
  error?: string;
}

/**
 * Generates & sends a real 6-digit OTP email from the server (/api/auth/request-otp).
 * Never sends password reset links; strictly dispatches the 6-digit OTP code.
 */
export async function requestOtpEmail(
  email: string,
  purpose: 'signup' | 'forgot' = 'signup'
): Promise<SendOtpResult> {
  try {
    const response = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        purpose,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: 'Email API server is still starting or unreachable. Please wait 5 seconds and try again.',
      };
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return {
        success: true,
        messageId: data.messageId,
        provider: data.provider,
        expiresInSeconds: data.expiresInSeconds,
      };
    }
    return {
      success: false,
      error: data.error || `Failed to send OTP email (Status ${response.status})`,
    };
  } catch (err: any) {
    console.error('OTP request network error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to email server',
    };
  }
}

/**
 * Verifies a 6-digit OTP on the server (/api/auth/verify-otp) and receives a short-lived verification token.
 */
export async function verifyOtpEmail(
  email: string,
  otpCode: string,
  purpose: 'signup' | 'forgot' = 'signup'
): Promise<VerifyOtpResult> {
  try {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otpCode: otpCode.trim(),
        purpose,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success && data.verificationToken) {
      return {
        success: true,
        verificationToken: data.verificationToken,
      };
    }
    return {
      success: false,
      error: data.error || `Invalid or expired OTP code (Status ${response.status})`,
    };
  } catch (err: any) {
    console.error('OTP verify network error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to verify OTP with server',
    };
  }
}

/**
 * Finalizes signup credential storage on the server after OTP verification.
 */
export async function completeServerSignup(payload: {
  email: string;
  name: string;
  password: string;
  verificationToken: string;
  firebaseUid?: string;
}): Promise<ServerAuthResult> {
  try {
    const response = await fetch('/api/auth/complete-signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || `Signup sync failed (Status ${response.status})` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error completing signup' };
  }
}

/**
 * Resets password on the server using the Forgot Password OTP verification token.
 */
export async function resetServerPassword(payload: {
  email: string;
  newPassword: string;
  verificationToken: string;
}): Promise<ServerAuthResult> {
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || `Password reset failed (Status ${response.status})` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error resetting password' };
  }
}

/**
 * Verifies email + password against the server credential store (supports cross-device login after OTP password reset).
 */
export async function verifyServerLogin(
  email: string,
  password: string
): Promise<ServerAuthResult> {
  try {
    const response = await fetch('/api/auth/login-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success && data.user) {
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error };
  } catch {
    return { success: false };
  }
}

/**
 * Syncs an authenticated Firebase user's credential to the server store using their Firebase ID token.
 */
export async function syncFirebaseLoginToServer(payload: {
  idToken: string;
  password: string;
  name?: string;
}): Promise<void> {
  try {
    await fetch('/api/auth/sync-firebase-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // non-fatal background sync
  }
}

/**
 * Sends a 6-digit OTP email via server endpoint (/api/email/send-otp)
 */
export async function sendOtpEmailViaBrevo(
  toEmail: string,
  otpCode: string,
  purpose: 'signup' | 'forgot' = 'signup'
): Promise<SendOtpResult> {
  try {
    const response = await fetch('/api/email/send-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        toEmail: toEmail.trim(),
        otpCode,
        purpose,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, messageId: data.messageId, provider: data.provider };
    }
    return {
      success: false,
      error: data.error || `Email API error (Status ${response.status})`,
    };
  } catch (err: any) {
    console.error('OTP email network call error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to email gateway',
    };
  }
}

export interface ComplaintEmailPayload {
  ticketId: string;
  name: string;
  email: string;
  phone?: string;
  category: string;
  subject: string;
  message: string;
  userPlan?: string;
}

/**
 * Sends a user complaint ticket to the configured support email via server endpoint (/api/email/send-complaint)
 */
export async function sendComplaintEmailViaBrevo(
  payload: ComplaintEmailPayload
): Promise<SendOtpResult> {
  try {
    const response = await fetch('/api/email/send-complaint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      return { success: true, messageId: data.messageId };
    }
    return {
      success: false,
      error: data.error || `Email gateway error (Status ${response.status})`,
    };
  } catch (err: any) {
    console.error('Complaint email network error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to email gateway',
    };
  }
}
