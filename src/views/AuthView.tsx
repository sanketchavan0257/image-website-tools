import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import {
  requestOtpEmail,
  verifyOtpEmail,
  completeServerSignup,
  resetServerPassword,
  verifyServerLogin,
  syncFirebaseLoginToServer,
} from '../services/emailService';
import { saveUserToFirestore, getUserProfileWithStatus, updateUserNameInFirestore } from '../services/firestoreService';
import {
  Mail,
  Lock,
  User,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ShieldCheck,
  ArrowLeft,
  ExternalLink,
  Zap,
  LockKeyhole,
  Cpu,
} from 'lucide-react';

interface AuthViewProps {
  initialTab?: 'login' | 'signup' | 'forgot';
  onNavigate: (path: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ initialTab = 'login', onNavigate }) => {
  const {
    user,
    setSessionUser,
    isEmailRegistered,
    getAccountNameByEmail,
    updatePasswordOnly,
    signupWithEmail,
    loginWithEmail,
    syncAccountPassword,
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'forgot'>(initialTab);
  const [otpVerificationToken, setOtpVerificationToken] = useState<string | null>(null);

  // Sync tab with route path
  useEffect(() => {
    setActiveTab(initialTab);
    setStep('form');
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtpVerificationToken(null);
    setOtpDigits(['', '', '', '', '', '']);
  }, [initialTab]);

  // Determine redirect URL (e.g. back to /pricing if user clicked membership)
  const getDestinationUrl = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramRedirect = urlParams.get('redirect');
      if (paramRedirect) return paramRedirect;
      const stored = sessionStorage.getItem('pixiforge_auth_redirect');
      if (stored) {
        sessionStorage.removeItem('pixiforge_auth_redirect');
        return stored;
      }
    } catch (e) {
      // fallback
    }
    return '/';
  };

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 6 Individual OTP Boxes state
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Flow State: 'form' | 'otp' | 'new_password'
  const [step, setStep] = useState<'form' | 'otp' | 'new_password'>('form');

  // UI Feedback States
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Focus the first OTP box when entering the 'otp' step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Countdown Timer for OTP Resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user && step !== 'new_password') {
      // Optional: onNavigate('/');
    }
  }, [user, onNavigate, step]);

  const currentOtpString = otpDigits.join('');

  // -------------------------------------------------------------
  // TAB SWITCHER HANDLER
  // -------------------------------------------------------------
  const switchTab = (tab: 'login' | 'signup' | 'forgot') => {
    setActiveTab(tab);
    setStep('form');
    setErrorMessage(null);
    setSuccessMessage(null);
    setOtpVerificationToken(null);
    setOtpDigits(['', '', '', '', '', '']);
    setPassword('');
    setConfirmPassword('');

    if (tab === 'login') onNavigate('/login');
    else if (tab === 'signup') onNavigate('/signup');
    else if (tab === 'forgot') onNavigate('/forgot-password');
  };

  // -------------------------------------------------------------
  // 6-BOX OTP HANDLERS
  // -------------------------------------------------------------
  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');

    if (!cleanVal) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    const digit = cleanVal.slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    if (index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        digitInputRefs.current[index - 1]?.focus();
      } else {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePasteOtp = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);

    const nextFocusIndex = Math.min(pasted.length, 5);
    digitInputRefs.current[nextFocusIndex]?.focus();
  };

  // -------------------------------------------------------------
  // STEP 1: REQUEST REAL 6-DIGIT OTP EMAIL (NO RESET LINK)
  // -------------------------------------------------------------
  const handleRequestOtp = async (purpose: 'signup' | 'forgot') => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (purpose === 'signup') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name first.');
        return;
      }
      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (isEmailRegistered(cleanEmail)) {
        setErrorMessage('An account with this email already exists. Please Sign In.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const otpRes = await requestOtpEmail(cleanEmail, purpose);

      if (!otpRes.success) {
        setErrorMessage(
          otpRes.error || 'Could not send OTP email. Please check email settings or try again.'
        );
        return;
      }

      setOtpVerificationToken(null);
      setStep('otp');
      setOtpDigits(['', '', '', '', '', '']);
      setTimer(60);
      setCanResend(false);
      setSuccessMessage(
        `6-digit OTP sent to ${cleanEmail}! Please check your Gmail Inbox or Spam folder.`
      );
    } catch (e: any) {
      console.error('Failed sending OTP email:', e);
      setErrorMessage(e?.message || 'Failed to connect to email server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 2: VERIFY 6-BOX OTP WITH SERVER
  // -------------------------------------------------------------
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = currentOtpString.trim();

    if (cleanOtp.length !== 6) {
      setErrorMessage('Please fill in all 6 OTP boxes.');
      return;
    }

    setIsSubmitting(true);

    try {
      const purpose = activeTab === 'forgot' ? 'forgot' : 'signup';
      const verifyRes = await verifyOtpEmail(cleanEmail, cleanOtp, purpose);

      if (!verifyRes.success || !verifyRes.verificationToken) {
        setErrorMessage(
          verifyRes.error || 'Invalid or expired Email OTP code. Please enter the correct 6 digits.'
        );
        return;
      }

      if (activeTab === 'signup') {
        // 1. Create account in Firebase Auth
        let firebaseUid = '';
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          if (cred.user) {
            firebaseUid = cred.user.uid;
            await updateProfile(cred.user, { displayName: name.trim() });
          }
        } catch (fbErr: any) {
          console.warn('Firebase registration notice:', fbErr?.code, fbErr?.message);
          if (fbErr?.code === 'auth/email-already-in-use') {
            try {
              const signinCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
              firebaseUid = signinCred.user.uid;
              if (name.trim()) {
                await updateProfile(signinCred.user, { displayName: name.trim() }).catch(() => {});
              }
            } catch {
              setErrorMessage('An account with this email already exists. Please Sign In or use Forgot Password.');
              return;
            }
          }
        }

        const activeUserId = firebaseUid || auth.currentUser?.uid || undefined;

        // 2. Persist hashed credential record on server
        await completeServerSignup({
          email: cleanEmail,
          name: name.trim() || 'User',
          password,
          verificationToken: verifyRes.verificationToken,
          firebaseUid: activeUserId,
        });

        // 3. Save User Profile document into Cloud Firestore
        if (activeUserId) {
          try {
            await saveUserToFirestore({
              userId: activeUserId,
              name: name.trim() || 'User',
              email: cleanEmail,
              plan: 'free',
            });
          } catch (fsErr) {
            console.error('[Firestore] User save exception:', fsErr);
          }
        }

        // 4. Save session in local store
        signupWithEmail(name, cleanEmail, password, undefined, activeUserId);

        setSuccessMessage('Account created & verified successfully! Redirecting...');
        setTimeout(() => onNavigate(getDestinationUrl()), 1000);
      } else if (activeTab === 'forgot') {
        setOtpVerificationToken(verifyRes.verificationToken);
        setStep('new_password');
        setPassword('');
        setConfirmPassword('');
        setSuccessMessage('OTP verified successfully! Now enter your new password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3 (Forgot Password): SAVE NEW PASSWORD
  // -------------------------------------------------------------
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (!otpVerificationToken) {
      setErrorMessage('OTP session expired. Please verify a fresh 6-digit OTP.');
      setStep('form');
      return;
    }

    setIsSubmitting(true);

    try {
      const resetRes = await resetServerPassword({
        email: cleanEmail,
        newPassword: cleanPassword,
        verificationToken: otpVerificationToken,
      });

      if (!resetRes.success) {
        setErrorMessage(resetRes.error || 'Failed to update password. Please verify OTP again.');
        return;
      }

      const localRes = updatePasswordOnly(cleanEmail, cleanPassword, resetRes.user);
      if (!localRes.success) {
        setErrorMessage(localRes.error || 'Failed to update local session.');
        return;
      }

      syncAccountPassword(cleanEmail, cleanPassword, resetRes.user?.name);

      if (auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail) {
        try {
          await updatePassword(auth.currentUser, cleanPassword);
        } catch (pwErr) {
          console.warn('Firebase Auth password update note:', pwErr);
        }
      }

      setOtpVerificationToken(null);
      setSuccessMessage('Password reset successfully! Logged in. Redirecting...');
      setTimeout(() => onNavigate(getDestinationUrl()), 800);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // DIRECT SIGN-IN (Login Tab)
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Try Firebase Auth with clean trimmed password first, then untrimmed
      let fbUser: any = null;
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
        fbUser = cred.user;
      } catch (fbErr1: any) {
        if (password !== cleanPassword) {
          try {
            const cred2 = await signInWithEmailAndPassword(auth, cleanEmail, password);
            fbUser = cred2.user;
          } catch (fbErr2) {
            console.warn('Firebase login attempt fallback to local:', fbErr1?.code, fbErr2);
          }
        } else {
          console.warn('Firebase login attempt fallback to local:', fbErr1?.code);
        }
      }

      const emailPrefix = cleanEmail.split('@')[0];
      const isRealName = (val?: string | null) =>
        Boolean(
          val &&
            val.trim() &&
            val.trim().toLowerCase() !== emailPrefix.toLowerCase() &&
            val.trim() !== 'User' &&
            val.trim() !== 'Google User'
        );
      const localSavedName = getAccountNameByEmail(cleanEmail);

      if (fbUser) {
        let userPlan: 'free' | 'pro' | 'max' | 'ultra' = 'free';
        let fsName: string | undefined;
        let resolvedName = '';
        try {
          const { data: fsProfile, offline } = await getUserProfileWithStatus(fbUser.uid);
          if (fsProfile?.name) {
            fsName = fsProfile.name;
          }
          resolvedName =
            [fsName, fbUser.displayName, localSavedName].find(isRealName)?.trim() ||
            fsName ||
            fbUser.displayName ||
            localSavedName ||
            emailPrefix ||
            'User';

          if (isRealName(resolvedName) && fbUser.displayName !== resolvedName) {
            await updateProfile(fbUser, { displayName: resolvedName }).catch(() => {});
          }

          const fsHasPayment =
            Boolean(fsProfile?.lastPaymentId) ||
            (Array.isArray(fsProfile?.paymentHistory) && fsProfile.paymentHistory.length > 0);
          if (fsProfile?.plan && (fsProfile.plan === 'free' || fsHasPayment)) {
            userPlan = fsProfile.plan as any;
          } else if (!offline && !fsProfile) {
            await saveUserToFirestore({
              userId: fbUser.uid,
              name: resolvedName,
              email: fbUser.email || cleanEmail,
              plan: 'free',
            });
          }
          if (!offline && fsProfile && isRealName(resolvedName) && !isRealName(fsProfile.name)) {
            await updateUserNameInFirestore(fbUser.uid, resolvedName);
          }
        } catch (fsErr) {
          console.warn('[Firestore] Profile sync warning:', fsErr);
        }

        if (!resolvedName) {
          resolvedName =
            [fsName, fbUser.displayName, localSavedName].find(isRealName)?.trim() ||
            fsName ||
            fbUser.displayName ||
            localSavedName ||
            emailPrefix ||
            'User';
        }

        // Sync password & display name with local & server credential store
        syncAccountPassword(cleanEmail, cleanPassword, resolvedName);
        fbUser
          .getIdToken()
          .then((idToken: string) =>
            syncFirebaseLoginToServer({
              idToken,
              password: cleanPassword,
              name: resolvedName,
            })
          )
          .catch(() => {});

        setSessionUser({
          id: fbUser.uid,
          name: resolvedName,
          email: fbUser.email || cleanEmail,
          authMethod: 'email',
          plan: userPlan,
          createdAt: new Date().toISOString(),
          avatarColor: 'bg-blue-600',
          emailVerified: fbUser.emailVerified,
        });
        setSuccessMessage('Signed in successfully! Redirecting...');
        setTimeout(() => onNavigate(getDestinationUrl()), 800);
        return;
      }

      // 2. Server scrypt verification (handles users who reset password via Forgot Password OTP)
      const serverRes = await verifyServerLogin(cleanEmail, cleanPassword);
      if (serverRes.success && serverRes.user) {
        const displayName = serverRes.user.name || localSavedName || emailPrefix || 'User';
        syncAccountPassword(cleanEmail, cleanPassword, displayName);
        setSessionUser({
          id: serverRes.user.id,
          name: displayName,
          email: serverRes.user.email,
          authMethod: 'email',
          plan: 'free',
          createdAt: serverRes.user.createdAt || new Date().toISOString(),
          avatarColor: 'bg-blue-600',
          emailVerified: true,
        });
        setSuccessMessage('Signed in successfully! Redirecting...');
        setTimeout(() => onNavigate(getDestinationUrl()), 800);
        return;
      }

      // 3. Local store fallback
      const res = loginWithEmail(cleanEmail, cleanPassword);
      if (res.success) {
        setSuccessMessage('Signed in successfully! Redirecting...');
        setTimeout(() => onNavigate(getDestinationUrl()), 800);
      } else {
        setErrorMessage(res.error || 'Incorrect email or password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // GOOGLE 1-CLICK SIGN IN
  // -------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const emailPrefix = (fbUser.email || '').split('@')[0];
      const isRealName = (val?: string | null) =>
        Boolean(
          val &&
            val.trim() &&
            (!emailPrefix || val.trim().toLowerCase() !== emailPrefix.toLowerCase()) &&
            val.trim() !== 'User' &&
            val.trim() !== 'Google User'
        );
      const localSavedName = fbUser.email ? getAccountNameByEmail(fbUser.email) : undefined;

      let userPlan: 'free' | 'pro' | 'max' | 'ultra' = 'free';
      let fsName: string | undefined;
      try {
        const { data: fsProfile, offline } = await getUserProfileWithStatus(fbUser.uid);
        if (fsProfile?.name) {
          fsName = fsProfile.name;
        }
        const candidateName =
          [fsName, fbUser.displayName, localSavedName].find(isRealName)?.trim() ||
          fsName ||
          fbUser.displayName ||
          localSavedName ||
          'Google User';
        const fsHasPayment =
          Boolean(fsProfile?.lastPaymentId) ||
          (Array.isArray(fsProfile?.paymentHistory) && fsProfile.paymentHistory.length > 0);
        if (fsProfile?.plan && (fsProfile.plan === 'free' || fsHasPayment)) {
          userPlan = fsProfile.plan as any;
        } else if (!offline && !fsProfile) {
          await saveUserToFirestore({
            userId: fbUser.uid,
            name: candidateName,
            email: fbUser.email || undefined,
            plan: 'free',
          });
        }
        if (!offline && fsProfile && isRealName(candidateName) && !isRealName(fsProfile.name)) {
          await updateUserNameInFirestore(fbUser.uid, candidateName);
        }
      } catch (fsErr) {
        console.warn('[Firestore] Google user sync warning:', fsErr);
      }

      const resolvedName =
        [fsName, fbUser.displayName, localSavedName].find(isRealName)?.trim() ||
        fsName ||
        fbUser.displayName ||
        localSavedName ||
        'Google User';

      setSessionUser({
        id: fbUser.uid,
        name: resolvedName,
        email: fbUser.email || undefined,
        authMethod: 'google',
        plan: userPlan,
        createdAt: new Date().toISOString(),
        avatarColor: 'bg-indigo-600',
        emailVerified: fbUser.emailVerified,
      });

      setSuccessMessage(`Welcome, ${resolvedName}! Signed in with Google. Redirecting...`);
      setTimeout(() => onNavigate(getDestinationUrl()), 1000);
    } catch (err: any) {
      console.warn('Google sign in error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Google Sign-In popup was closed.');
      } else {
        setErrorMessage(err?.message || 'Failed to sign in with Google.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-center animate-fade-in bg-white lg:bg-slate-50 lg:py-6 lg:px-6 overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-full flex-1 lg:flex-initial lg:max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white lg:rounded-3xl lg:shadow-xl lg:border lg:border-slate-100 overflow-hidden min-h-full lg:min-h-0">
        {/* ========================================================= */}
        {/* LEFT COLUMN: BRAND HIGHLIGHTS (DESKTOP ONLY - HIDDEN ON MOBILE/TAB) */}
        {/* ========================================================= */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 lg:p-8 text-white flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10 space-y-3">
            <button
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-xs font-semibold mb-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Image Tools</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xl shadow-inner">
                ⚡
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">PixiForge</h1>
                <p className="text-xs text-blue-200 font-medium">Client-Side Image Studio</p>
              </div>
            </div>

            <p className="text-sm text-blue-100/90 pt-2 leading-relaxed">
              Professional image compression, resizing, conversion and cropping. Fast, secure, and private.
            </p>
          </div>

          {/* Key Features List */}
          <div className="relative z-10 my-8 space-y-4">
            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <LockKeyhole className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">100% Client-Side Privacy</h3>
                <p className="text-[11px] text-blue-100/80 mt-0.5">
                  Your photos are processed directly in your browser. Never uploaded to cloud storage.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Instant Speed</h3>
                <p className="text-[11px] text-blue-100/80 mt-0.5">
                  Zero upload waiting times. Batch convert WebP, JPG, PNG & compress in milliseconds.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-2xl border border-white/10">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-blue-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Pro, Max & Ultra Tiers</h3>
                <p className="text-[11px] text-blue-100/80 mt-0.5">
                  Access 100MB files, bulk conversions, DPI adjustment & lossless image optimization.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-[11px] text-blue-200 font-medium">
            <span>🛡️ End-to-End Encrypted</span>
            <span>Google Firebase Verified</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: FULL AUTHENTICATION CARD                    */}
        {/* ========================================================= */}
        <div className="relative w-full lg:col-span-7 px-4 py-14 sm:px-6 lg:p-8 flex flex-col min-h-full justify-center items-center overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Mobile/Tablet Back to tools link (At the very top) */}
          <div className="lg:hidden absolute top-3 left-4 sm:left-6 z-10">
            <button
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 text-xs font-semibold transition-colors cursor-pointer w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Image Tools</span>
            </button>
          </div>

          {/* Centered Block: From 'Sign in to your Account' to 'Don't have an account?' */}
          <div className="w-full max-w-md mx-auto flex flex-col justify-center md:[zoom:1.25] lg:[zoom:1]">
            {/* Top Title & Step Indicator (Centered) */}
            <div className="mb-4 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight text-center">
                {step === 'otp'
                  ? 'Verify 6-Digit Email OTP'
                  : step === 'new_password'
                  ? 'Set New Password'
                  : activeTab === 'login'
                  ? 'Sign in to your Account'
                  : activeTab === 'signup'
                  ? 'Create a New Account'
                  : 'Reset Your Password'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 max-w-sm mx-auto text-center leading-relaxed">
                {step === 'otp'
                  ? `Enter the 6-digit code sent for ${email}`
                  : step === 'new_password'
                  ? `Create a new secure password for ${email}`
                  : activeTab === 'login'
                  ? 'Access your saved settings, presets, and unlocked image tool limits.'
                  : activeTab === 'signup'
                  ? 'Sign up with free Email OTP verification in under 30 seconds.'
                  : 'Enter your registered email address to receive a 6-digit reset OTP.'}
              </p>
            </div>

            {/* Tab Switcher (Visible in initial form step) */}
            {step === 'form' && (
              <div className="grid grid-cols-3 bg-slate-100/90 p-1 rounded-xl text-xs font-bold text-slate-600 mb-3.5 text-center">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === 'login' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('signup')}
                  className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === 'signup' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  New Account
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className={`py-2 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === 'forgot' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Forgot Password
                </button>
              </div>
            )}

            {/* Quick Google Sign In (Available on Login tab) */}
            {step === 'form' && activeTab === 'login' && (
              <div className="mb-3.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2.5 transition-colors shadow-2xs cursor-pointer hover:border-slate-300 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google (1-Click)</span>
                </button>

                <div className="relative flex py-2.5 items-center">
                  <div className="grow border-t border-slate-200"></div>
                  <span className="shrink mx-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Or with Email
                  </span>
                  <div className="grow border-t border-slate-200"></div>
                </div>
              </div>
            )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{successMessage}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: DEDICATED 6-BOX OTP VERIFICATION PAGE             */}
          {/* ========================================================= */}
          {step === 'otp' && (
            <div className="space-y-5 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to email details</span>
              </button>

              {/* EMAIL INBOX HINT CARD */}
              <div className="p-3.5 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 rounded-2xl border border-blue-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-700 truncate">
                    OTP sent to: <strong className="text-slate-900">{email}</strong>
                  </span>
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2 shrink-0"
                  >
                    <span>Open Gmail</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-500">
                  Check your Primary Inbox or Spam/Promotions folder for the 6-digit OTP code. Valid for 10 minutes.
                </p>
              </div>

              {/* 6-BOX OTP FORM */}
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <label className="text-xs font-bold text-slate-800">
                      Enter 6-Digit OTP (6 Boxes)
                    </label>
                    {canResend ? (
                      <button
                        type="button"
                        onClick={() => handleRequestOtp(activeTab as any)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Resend OTP</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Resend in {timer}s
                      </span>
                    )}
                  </div>

                  {/* THE 6 SEPARATE BOXES */}
                  <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handlePasteOtp}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          digitInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        className={`w-full aspect-square text-center font-mono text-2xl font-black rounded-2xl border-2 transition-all shadow-inner focus:outline-hidden ${
                          digit
                            ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || currentOtpString.length !== 6}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs tracking-wide transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Verifying OTP...</span>
                  ) : (
                    <>
                      <span>
                        {activeTab === 'signup'
                          ? 'Verify OTP & Complete Registration'
                          : 'Verify OTP & Continue'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3 (Forgot Password): DEDICATED NEW PASSWORD PAGE     */}
          {/* ========================================================= */}
          {step === 'new_password' && (
            <div className="space-y-5 animate-fade-in">
              <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  OTP verified for <strong>{email}</strong>. Please set your new password below.
                </span>
              </div>

              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? (
                    <span>Saving Password...</span>
                  ) : (
                    <>
                      <span>Save New Password & Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: INITIAL DETAILS FORM                              */}
          {/* ========================================================= */}
          {step === 'form' && (
            <form
              onSubmit={(e) => {
                if (activeTab === 'login') {
                  handleLoginSubmit(e);
                } else if (activeTab === 'signup') {
                  e.preventDefault();
                  handleRequestOtp('signup');
                } else if (activeTab === 'forgot') {
                  e.preventDefault();
                  handleRequestOtp('forgot');
                }
              }}
              className="space-y-3"
            >
              {/* Full Name (Sign Up only) */}
              {activeTab === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sanket Chavan"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {activeTab === 'forgot' ? 'Registered Email Address' : 'Email Address'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                {activeTab === 'forgot' && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    We will send a 6-digit OTP to your email (no reset link).
                  </p>
                )}
              </div>

              {/* Password (Login & Signup step 1 only) */}
              {activeTab !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    {activeTab === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchTab('forgot')}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
              >
                {isSubmitting ? (
                  <span>Please wait...</span>
                ) : (
                  <>
                    <span>
                      {activeTab === 'login' && 'Sign In'}
                      {activeTab === 'signup' && 'Send Email OTP & Continue'}
                      {activeTab === 'forgot' && 'Send Password Reset OTP'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Bottom Switcher */}
              <div className="pt-3 text-center text-xs text-slate-500 border-t border-slate-100 space-y-1.5">
                {activeTab === 'login' && (
                  <p>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('signup')}
                      className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Create New Account (OTP)
                    </button>
                  </p>
                )}

                {activeTab === 'signup' && (
                  <p>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                )}

                {activeTab === 'forgot' && (
                  <p>
                    Remembered your password?{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
