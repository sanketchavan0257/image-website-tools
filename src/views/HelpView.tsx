import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { sendComplaintEmailViaBrevo } from '../services/emailService';
import { getSupportEmail, getSupportPhone } from '../config/env';
import {
  ArrowLeft,
  Mail,
  Phone,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  HelpCircle,
  CreditCard,
  Receipt,
  ExternalLink,
  MessageSquareWarning,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface HelpViewProps {
  onNavigate: (path: string) => void;
}

const COMPLAINT_CATEGORIES = [
  'AutoPay / Recurring Charge Issue',
  'Membership Cancellation / Refund Issue',
  'Payment Deducted – Plan Not Activated',
  'Image Tool Bug / Error',
  'Account / Login Issue',
  'Other',
];

export const HelpView: React.FC<HelpViewProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const supportEmail = getSupportEmail();
  const supportMobile = getSupportPhone();
  const [copiedField, setCopiedField] = useState<'email' | 'mobile' | null>(null);

  // Complaint Form State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fallbackGmailUrl, setFallbackGmailUrl] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<{
    ticketId: string;
    subject: string;
    category: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.name || '');
      setEmail((prev) => prev || user.email || '');
      setPhone((prev) => prev || user.phone || '');
    }
  }, [user]);

  const handleCopy = (value: string, field: 'email' | 'mobile') => {
    try {
      navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const buildGmailFallbackUrl = (ticketId: string) => {
    const emailSubject = `[PixiForge Complaint #${ticketId}] ${category}: ${subject.trim()}`;
    const emailBody = [
      `Ticket ID: #${ticketId}`,
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Mobile: ${phone.trim() || 'Not provided'}`,
      `Plan: ${(user?.plan || 'free').toUpperCase()}`,
      `Category: ${category}`,
      `Subject: ${subject.trim()}`,
      '',
      'Complaint Details:',
      message.trim(),
    ].join('\n');

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      supportEmail
    )}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFallbackGmailUrl(null);

    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Please enter a valid email address so we can reply to you.');
      return;
    }
    if (!subject.trim()) {
      setFormError('Please enter a short subject for your complaint.');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setFormError('Please describe your complaint in at least 10 characters.');
      return;
    }

    const ticketId = `CMP-${Date.now().toString().slice(-6)}`;
    setIsSubmitting(true);

    try {
      const res = await sendComplaintEmailViaBrevo({
        ticketId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        category,
        subject: subject.trim(),
        message: message.trim(),
        userPlan: user?.plan || 'free',
      });

      if (res.success) {
        setSubmittedTicket({
          ticketId,
          subject: subject.trim(),
          category,
        });
        setSubject('');
        setMessage('');
      } else {
        if (supportEmail) {
          setFallbackGmailUrl(buildGmailFallbackUrl(ticketId));
        }
        setFormError(
          res.error ||
            (supportEmail
              ? `Automatic email gateway was blocked right now. Click "Send via Gmail" below to dispatch this complaint directly to ${supportEmail}.`
              : 'Support email is not configured in environment variables (SUPPORT_EMAIL / ADMIN_EMAIL).')
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full pb-20">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 space-y-8">
        {/* Page Heading */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help & Support</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How Can We Help You?
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Have a question about plans, AutoPay renewals, refunds, or any image tool? Contact our support team directly via Email, Mobile Number, or the Complaint Form below.
          </p>
        </div>

        {/* Contact Cards: Email & Mobile Number */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Email Support Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Email Support</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  For billing receipts, AutoPay queries, refunds & technical help
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                {supportEmail ? (
                  <>
                    <a
                      href={`mailto:${supportEmail}?subject=${encodeURIComponent('PixiForge Support Request')}`}
                      target="_top"
                      className="font-mono text-xs sm:text-sm font-bold text-slate-900 hover:text-blue-600 truncate select-all transition-colors"
                    >
                      {supportEmail}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(supportEmail, 'email')}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      {copiedField === 'email' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    Configure SUPPORT_EMAIL or ADMIN_EMAIL in environment variables
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {supportEmail ? (
                <>
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supportEmail)}&su=${encodeURIComponent('PixiForge Support Request')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 transition-all"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Send Email</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                  <div className="text-center">
                    <a
                      href={`mailto:${supportEmail}?subject=${encodeURIComponent('PixiForge Support Request')}`}
                      target="_top"
                      className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 underline underline-offset-2 transition-colors"
                    >
                      Or open default Mail App
                    </a>
                  </div>
                </>
              ) : (
                <div className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-xs font-extrabold flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>Email Not Configured</span>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Support Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-7 flex flex-col justify-between space-y-5">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Mobile Number</h2>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Available Mon – Sat, 10:00 AM – 7:00 PM IST</span>
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <a
                  href={`tel:${supportMobile.replace(/\s+/g, '')}`}
                  target="_top"
                  className="font-mono text-xs sm:text-sm font-bold text-slate-900 hover:text-emerald-600 select-all transition-colors"
                >
                  {supportMobile}
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(supportMobile, 'mobile')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedField === 'mobile' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <a
                href={`tel:${supportMobile.replace(/\s+/g, '')}`}
                target="_top"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all"
              >
                <Phone className="w-4 h-4" />
                <span>Call Support</span>
              </a>
              <p className="text-center text-[11px] text-slate-400">
                Opens your phone dialer pad with this number
              </p>
            </div>
          </div>
        </div>

        {/* Complaint Form */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                Submit a Complaint
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Facing an issue with AutoPay, refund, payment, or any tool? Submit your complaint below and it will be sent directly to{' '}
                <strong>{supportEmail || 'our support desk'}</strong>.
              </p>
            </div>
          </div>

          {submittedTicket ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1 text-xs">
                  <h3 className="text-sm font-black">
                    Complaint Sent Successfully! (Ticket #{submittedTicket.ticketId})
                  </h3>
                  <p className="text-emerald-800 leading-relaxed">
                    Your complaint regarding <strong>{submittedTicket.category}</strong> ({submittedTicket.subject}) has been emailed directly to{' '}
                    <strong>{supportEmail || 'our support team'}</strong>. Our team will reply to your email shortly.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubmittedTicket(null)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Submit Another Complaint
              </button>
            </div>
          ) : (
            <form onSubmit={handleComplaintSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="complaint-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="complaint-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>

                <div>
                  <label htmlFor="complaint-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Your Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="complaint-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>

                <div>
                  <label htmlFor="complaint-phone" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mobile Number
                  </label>
                  <input
                    id="complaint-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="complaint-category" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Complaint Category
                  </label>
                  <select
                    id="complaint-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
                  >
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="complaint-subject" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="complaint-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., AutoPay deducted after cancellation"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="complaint-message" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Complaint Details <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="complaint-message"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue clearly (include Payment ID or Subscription ID if applicable)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-y"
                />
              </div>

              {formError && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">{formError}</span>
                  </div>
                  {fallbackGmailUrl && (
                    <a
                      href={fallbackGmailUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send via Gmail</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-slate-400">
                  Delivered directly to <strong>{supportEmail || 'support desk'}</strong>
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending Complaint...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Complaint</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Helpful Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('/pricing')}
            className="text-left p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 transition-all space-y-1.5 cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 group-hover:text-blue-600">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>Plans & AutoPay</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Compare Free, Pro, Max & Ultra tiers or manage AutoPay settings.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/billing')}
            className="text-left p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/90 transition-all space-y-1.5 cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 group-hover:text-blue-600">
              <Receipt className="w-4 h-4 text-blue-600" />
              <span>Billing & Refunds</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Check active plan validity, turn off AutoPay, or request cancellation.
            </p>
          </button>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Browser Privacy</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All 31 image tools run locally in your browser with zero server uploads.
            </p>
          </div>
        </div>

        {/* Quick FAQ */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 space-y-4">
          <h3 className="text-base font-black text-slate-900">Frequently Asked Questions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="font-bold text-slate-900">How do I turn off AutoPay?</p>
              <p className="text-slate-600 leading-relaxed">
                Open the <strong>Billing</strong> page and click <strong>Turn Off AutoPay</strong>, or email/call us with your registered email address for immediate help.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <p className="font-bold text-slate-900">How long do refunds take?</p>
              <p className="text-slate-600 leading-relaxed">
                Refunds are initiated immediately upon cancellation and typically credit back to your UPI, card, or bank account within 1–7 working days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
