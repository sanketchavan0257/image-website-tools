export interface RuntimeEnvConfig {
  ADMIN_EMAIL?: string;
  SUPPORT_EMAIL?: string;
  SUPPORT_PHONE?: string;
  RAZORPAY_KEY_ID?: string;
}

declare global {
  interface Window {
    __PIXIFORGE_ENV__?: RuntimeEnvConfig;
  }
}

function readEnvVar(runtimeKey: keyof RuntimeEnvConfig, viteKey: string): string {
  const runtimeVal =
    typeof window !== 'undefined' ? window.__PIXIFORGE_ENV__?.[runtimeKey] : undefined;
  if (typeof runtimeVal === 'string' && runtimeVal.trim()) {
    return runtimeVal.trim();
  }
  const viteVal = (import.meta as any).env?.[viteKey];
  if (typeof viteVal === 'string' && viteVal.trim()) {
    return viteVal.trim();
  }
  return '';
}

export function getAdminEmail(): string {
  return readEnvVar('ADMIN_EMAIL', 'VITE_ADMIN_EMAIL').toLowerCase();
}

export function getSupportEmail(): string {
  return (
    readEnvVar('SUPPORT_EMAIL', 'VITE_SUPPORT_EMAIL').toLowerCase() ||
    getAdminEmail()
  );
}

export function getSupportPhone(): string {
  return readEnvVar('SUPPORT_PHONE', 'VITE_SUPPORT_PHONE') || '+91 98765 43210';
}

export function getEnvRazorpayKeyId(): string {
  return readEnvVar('RAZORPAY_KEY_ID', 'VITE_RAZORPAY_KEY_ID');
}
