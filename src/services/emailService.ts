// Transactional Email Service (dispatched via server.ts using .env / Render env variables)

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
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
      return { success: true, messageId: data.messageId };
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
