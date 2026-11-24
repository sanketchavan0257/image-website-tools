import React from 'react';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  RotateCcw,
  PackageCheck,
  Mail,
  Phone,
  Clock,
} from 'lucide-react';
import { getSupportEmail, getSupportPhone } from '../config/env';

export type PolicyType = 'terms' | 'privacy' | 'refund' | 'shipping';

interface PolicyViewProps {
  policy: PolicyType;
  onNavigate: (path: string) => void;
}

const POLICY_TABS: { id: PolicyType; label: string; path: string }[] = [
  { id: 'terms', label: 'Terms & Conditions', path: '/terms' },
  { id: 'privacy', label: 'Privacy Policy', path: '/privacy-policy' },
  { id: 'refund', label: 'Refund & Cancellation Policy', path: '/refund-policy' },
  { id: 'shipping', label: 'Shipping / Delivery Policy', path: '/shipping-policy' },
];

export const PolicyView: React.FC<PolicyViewProps> = ({ policy, onNavigate }) => {
  const supportEmail = getSupportEmail();
  const supportPhone = getSupportPhone();

  const renderPolicyBody = () => {
    if (policy === 'terms') {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Terms & Conditions
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: November 2026 • PixiForge Image Studio
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">1. Acceptance of Terms</h2>
              <p>
                By accessing or using PixiForge (pixiforge.app), its 31 image editing utilities, or purchasing any Pro, Max, or Ultra subscription plan, you agree to comply with these Terms & Conditions.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">2. Service Usage & Ownership</h2>
              <p>
                All tools are provided for lawful personal and commercial image editing. You retain 100% ownership and copyright of every image you process or export using PixiForge.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">3. Subscriptions & AutoPay Billing</h2>
              <p>
                Paid plans (Pro, Max, Ultra) expand batch capacity, file size limits, and unlock ad-free workflows. Payments are processed securely via Razorpay in your local currency. If you opt into AutoPay (recurring subscription), you may pause or cancel AutoPay anytime from your Billing & Invoices page before the next billing cycle.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">4. Prohibited Conduct</h2>
              <p>
                You agree not to automate abuse, attempt unauthorized API scraping, bypass payment verification, or upload unlawful/infringing content where server-assisted processing is invoked.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">5. Limitation of Liability</h2>
              <p>
                PixiForge is provided on an &ldquo;as is&rdquo; basis. Always keep backups of your original files. Our total liability for any billing claim is limited strictly to the subscription amount paid by you for the active billing period.
              </p>
            </section>
          </div>
        </div>
      );
    }

    if (policy === 'privacy') {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Last updated: November 2026 • Zero Server Image Storage
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">1. Client-Side Image Privacy</h2>
              <p>
                PixiForge processes resizing, cropping, compression, watermarking, and format conversion 100% locally inside your web browser using HTML5 Canvas and Web Workers. Your images are never saved to any server disk or database.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">2. AI Background Removal</h2>
              <p>
                When using the fast AI cutout mode, a resized temporary frame may be processed in memory exclusively to generate the alpha mask and is immediately discarded once the mask is returned. We never store, log, or train models on user photos.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">3. Account & Payment Information</h2>
              <p>
                If you create an account, we store only your display name, email address or phone number, active plan tier, and Razorpay transaction references via Firebase Authentication and Cloud Firestore so your subscription persists across devices. Card, UPI, and bank credentials are handled directly by Razorpay (PCI-DSS compliant) and never touch our servers.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">4. Data Deletion Requests</h2>
              <p>
                We never sell or rent personal data to third parties. You may request account deletion or billing record inquiries anytime by contacting our support team.
              </p>
            </section>
          </div>
        </div>
      );
    }

    if (policy === 'refund') {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Refund & Cancellation Policy
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Instant Cancellation & Fair Pro-Rata Refunds
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">1. Anytime Membership Cancellation</h2>
              <p>
                You can cancel your active PixiForge subscription anytime from the <strong>Billing & Invoices</strong> section. Cancelling immediately turns off any active AutoPay / recurring renewal mandate and reverts your account to the Free plan.
              </p>
            </section>

            <section className="space-y-2.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">2. Pro-Rata Refund Calculation & Usage Deduction</h2>
              <p>
                We provide a transparent pro-rata refund for unused days on active paid plans. Your pack price is divided by the total days in your billing cycle to compute the exact per-day rate, the amount for the days used is deducted, and the remaining balance is refunded in the exact original currency paid. Same-day cancellations with 0 used days qualify for a 100% full refund.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="font-extrabold text-slate-900">
                  How Deduction Works (Example: ₹299 Monthly Pack Cancelled After 10 Days)
                </div>
                <ul className="space-y-1 text-slate-700">
                  <li>
                    • <strong>Per-Day Rate:</strong> ₹299 ÷ 30 days = <strong>₹9.97 / day</strong>
                  </li>
                  <li>
                    • <strong>10 Days Used Deduction:</strong> (₹299 ÷ 30) × 10 days = <strong className="text-rose-700">- ₹99.67 deducted</strong>
                  </li>
                  <li>
                    • <strong>Final Refund to Your Account:</strong> ₹299 − ₹99.67 = <strong className="text-emerald-700">₹199.33 refunded</strong> (Remaining 20 days)
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">3. Refund Credit Timeline (7–9 Business Days)</h2>
              <p>
                Approved refunds are initiated immediately via Razorpay to your original payment method (UPI, Debit/Credit Card, or NetBanking). <strong>The refunded payment will be credited to your account within 7–9 business days</strong> depending on your bank or card issuer&apos;s processing schedule.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">4. Turning Off AutoPay Only</h2>
              <p>
                If you only want to stop future renewals without cancelling your current period, click <strong>Turn Off AutoPay</strong> in Billing & Invoices. Your paid access remains active until its expiry date with zero refund required.
              </p>
            </section>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Shipping / Delivery Policy
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              100% Digital SaaS Activation • Instant Delivery
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          <section className="space-y-1.5">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">1. Digital Product — No Physical Shipping</h2>
            <p>
              PixiForge is a 100% cloud/browser-based digital software service (SaaS). All plans, tools, and features are delivered digitally online; no physical goods or parcels are shipped.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">2. Instant Plan Activation</h2>
            <p>
              Upon successful payment confirmation from Razorpay, your upgraded membership tier (Pro, Max, or Ultra), expanded batch limits, and ad-free workspace are activated <strong>instantly (0-minute delivery)</strong> on your signed-in PixiForge account.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">3. Payment Confirmation & Invoices</h2>
            <p>
              Your payment ID, subscription validity, and downloadable receipt are immediately available inside <strong>Billing & Invoices</strong>. If a payment was deducted but your plan did not activate due to a network interruption, please raise a ticket on the Help & Support page with your Payment ID for immediate resolution.
            </p>
          </section>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full pb-20">
      {/* Top-Left Back Button */}
      <div className="w-full px-3 sm:px-5 pt-2 pb-5">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:text-slate-900 text-xs font-bold shadow-2xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-600 group-hover:-translate-x-0.5 transition-all" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Quick Policy Tabs */}
        <div className="flex flex-wrap gap-2">
          {POLICY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.path)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                policy === tab.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Policy Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-9 space-y-8">
          {renderPolicyBody()}

          {/* Support Contact Strip */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-blue-600"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>{supportEmail}</span>
                </a>
              )}
              {supportPhone && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{supportPhone}</span>
                </span>
              )}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Support Mon–Sat, 10 AM – 7 PM IST</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
