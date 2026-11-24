import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { signOut, updateProfile } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { updateUserNameInFirestore } from '../../services/firestoreService';
import { LogoutConfirmModal } from '../auth/LogoutConfirmModal';
import { useImageStore } from '../../store/useImageStore';
import { useAuthStore, isAdminUser } from '../../store/useAuthStore';
import { TOOLS, TOOL_CATEGORIES } from '../../config/tools';
import {
  Sparkles,
  Layers,
  ShieldCheck,
  ChevronDown,
  Menu,
  X,
  Zap,
  User,
  LogOut,
  KeyRound,
  ArrowRight,
  Home,
  Wrench,
  CreditCard,
  ChevronRight,
  Flame,
  Crown,
  Receipt,
  Shield,
  HelpCircle,
  Pencil,
  Check,
  FileText,
  RotateCcw,
  PackageCheck,
} from 'lucide-react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate }) => {
  const { activePlan, setPlan, isPro, togglePro } = useImageStore();
  const currentPlan = activePlan || (isPro ? 'pro' : 'free');
  const { user, openAuthModal, logout, setAuthModalTab, updateUserName } = useAuthStore();
  const isAdmin = isAdminUser(user);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameDraft.trim().slice(0, 100);
    if (!cleanName || !user) return;
    setIsSavingName(true);
    try {
      updateUserName(cleanName);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: cleanName }).catch(() => {});
        await updateUserNameInFirestore(auth.currentUser.uid, cleanName).catch(() => {});
      } else if (user.id && !user.id.startsWith('usr_')) {
        await updateUserNameInFirestore(user.id, cleanName).catch(() => {});
      }
      setIsEditingName(false);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleConfirmLogout = async () => {
    setIsLogoutConfirmOpen(false);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Firebase signOut notice:', err);
    }
    logout();
    onNavigate('/');
  };

  // Prevent background scrolling when mobile sidebar is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close any open header dropdown when clicking anywhere outside it or pressing Escape
  useEffect(() => {
    if (!toolsDropdownOpen && !otherDropdownOpen && !userMenuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (toolsDropdownOpen && !target?.closest('[data-header-dropdown="popular"]')) {
        setToolsDropdownOpen(false);
      }
      if (otherDropdownOpen && !target?.closest('[data-header-dropdown="other"]')) {
        setOtherDropdownOpen(false);
      }
      if (userMenuOpen && !target?.closest('[data-header-dropdown="profile"]')) {
        setUserMenuOpen(false);
        setIsEditingName(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToolsDropdownOpen(false);
        setOtherDropdownOpen(false);
        setUserMenuOpen(false);
        setIsEditingName(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toolsDropdownOpen, otherDropdownOpen, userMenuOpen]);

  const renderProfileDropdown = (align: 'left' | 'right') => {
    if (!user || !userMenuOpen) return null;
    return (
      <div
        className={`absolute ${
          align === 'left' ? 'left-0' : 'right-0'
        } top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in text-xs space-y-1`}
      >
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 mb-1">
            {isEditingName ? (
              <form onSubmit={handleSaveProfileName} className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-600">
                  Display Name
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={100}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="e.g. Sanket Chavan"
                  className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingName || !nameDraft.trim()}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>{isSavingName ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-slate-900 text-sm truncate">{user.name}</span>
                  <button
                    type="button"
                    title="Edit profile name"
                    onClick={() => {
                      setNameDraft(user.name || '');
                      setIsEditingName(true);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                  currentPlan === 'ultra'
                    ? 'bg-amber-100 text-amber-800'
                    : currentPlan === 'max'
                    ? 'bg-indigo-100 text-indigo-700'
                    : currentPlan === 'pro'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {currentPlan.toUpperCase()}
                </span>
              </div>
            )}
            <p className="text-[11px] text-slate-500 truncate">
              {user.email || user.phone}
            </p>
            <span className="text-[10px] text-slate-400 block">
              Auth via {user.authMethod === 'mobile' ? 'Mobile OTP' : 'Email'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(false);
              onNavigate('/forgot-password');
            }}
            className="w-full text-left p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <KeyRound className="w-4 h-4 text-slate-400" />
            <span>Change Password</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(false);
              onNavigate('/pricing');
            }}
            className="w-full text-left p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Upgrade / Plans</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(false);
              onNavigate('/billing');
            }}
            className="w-full text-left p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-2 cursor-pointer font-medium"
          >
            <Receipt className="w-4 h-4 text-blue-600" />
            <span>Billing & Invoices</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                onNavigate('/admin');
              }}
              className="w-full text-left p-2 rounded-xl hover:bg-indigo-50 text-indigo-700 transition-colors flex items-center gap-2 cursor-pointer font-bold"
            >
              <Shield className="w-4 h-4 text-indigo-600" />
              <span>Admin Panel</span>
            </button>
          )}

          <div className="border-t border-slate-100 my-1" />

          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(false);
              setIsLogoutConfirmOpen(true);
            }}
            className="w-full text-left p-2 rounded-xl hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 cursor-pointer font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile/Tablet Profile Icon (before PixiForge) + Brand / Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          {user && (
            <div data-header-dropdown="profile" className="relative lg:hidden">
              <button
                type="button"
                onClick={() => {
                  setToolsDropdownOpen(false);
                  setOtherDropdownOpen(false);
                  setUserMenuOpen(!userMenuOpen);
                }}
                className="flex items-center transition-transform active:scale-95 cursor-pointer select-none"
                aria-label="User account menu"
              >
                <div
                  className={`w-8 h-8 rounded-full ${
                    user.avatarColor || 'bg-blue-600'
                  } text-white flex items-center justify-center font-bold text-xs shadow-xs hover:ring-2 hover:ring-blue-500/30 transition-all`}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </button>
              {renderProfileDropdown('left')}
            </div>
          )}

          <div
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
          >
            <div className="hidden lg:flex w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                Pixi<span className="text-blue-600">Forge</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex flex-1 items-center justify-center gap-2 md:gap-3 lg:gap-4 xl:gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onNavigate('/')}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              currentPath === '/' ? 'text-blue-600 font-semibold bg-blue-50' : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            All
          </button>

          {/* Tools Mega Dropdown */}
          <div data-header-dropdown="popular" className="relative">
            <button
              type="button"
              onClick={() => {
                setOtherDropdownOpen(false);
                setUserMenuOpen(false);
                setToolsDropdownOpen(!toolsDropdownOpen);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl whitespace-nowrap hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>Popular</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {toolsDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in text-xs">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                  Phase 1 Ready Tools
                </div>
                {[
                  { name: 'Image Resizer', path: '/image-resizer', desc: 'Pixels, %, social media' },
                  { name: 'Image Compressor', path: '/image-compressor', desc: 'Target KB/MB or presets' },
                  { name: 'Image Cropper', path: '/image-cropper', desc: '1:1, 16:9, free crop' },
                  { name: 'JPG to PNG', path: '/jpg-to-png', desc: 'Lossless PNG converter' },
                  { name: 'PNG to JPG', path: '/png-to-jpg', desc: 'With transparency background' },
                  { name: 'WebP Converter', path: '/webp-converter', desc: 'Modern next-gen WebP' },
                ].map((t) => (
                  <button
                    key={t.path}
                    onClick={() => {
                      onNavigate(t.path);
                      setToolsDropdownOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-blue-50/70 hover:text-blue-700 transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-semibold text-slate-800">{t.name}</span>
                    <span className="text-[10px] text-slate-400">{t.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('/pricing')}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              currentPath === '/pricing' ? 'text-blue-600 font-semibold bg-blue-50' : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Pricing
          </button>

          <button
            onClick={() => onNavigate('/billing')}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              currentPath === '/billing' ? 'text-blue-600 font-semibold bg-blue-50' : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Billing
          </button>

          {/* Desktop Help link */}
          <button
            onClick={() => onNavigate('/help')}
            className={`hidden lg:inline-flex px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
              currentPath === '/help' ? 'text-blue-600 font-semibold bg-blue-50' : 'hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Help
          </button>

          {/* Other Dropdown (after Help & before Admin on PC; replaces Help on tablet with Help & Support included inside) */}
          <div data-header-dropdown="other" className="relative">
            <button
              type="button"
              onClick={() => {
                setToolsDropdownOpen(false);
                setUserMenuOpen(false);
                setOtherDropdownOpen(!otherDropdownOpen);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                ['/terms', '/privacy-policy', '/refund-policy', '/shipping-policy'].includes(currentPath)
                  ? 'text-blue-600 font-semibold bg-blue-50'
                  : currentPath === '/help'
                  ? 'text-blue-600 font-semibold bg-blue-50 lg:text-slate-600 lg:font-medium lg:bg-transparent lg:hover:text-slate-900 lg:hover:bg-slate-50'
                  : 'hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>Other</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {otherDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in text-xs space-y-0.5">
                {[
                  { name: 'Help & Support', path: '/help', tabletOnly: true },
                  { name: 'Terms & Conditions', path: '/terms', tabletOnly: false },
                  { name: 'Privacy Policy', path: '/privacy-policy', tabletOnly: false },
                  { name: 'Refund & Cancellation Policy', path: '/refund-policy', tabletOnly: false },
                  { name: 'Shipping / Delivery Policy', path: '/shipping-policy', tabletOnly: false },
                ].map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      onNavigate(item.path);
                      setOtherDropdownOpen(false);
                    }}
                    className={`${
                      item.tabletOnly ? 'flex lg:hidden' : 'flex'
                    } w-full text-left px-3 py-2.5 rounded-xl transition-colors items-center justify-between cursor-pointer font-semibold ${
                      currentPath === item.path
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-blue-50/70 hover:text-blue-700'
                    }`}
                  >
                    <span>{item.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <button
              onClick={() => onNavigate('/admin')}
              className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                currentPath === '/admin' ? 'text-indigo-700 font-semibold bg-indigo-50' : 'hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Right Action: Plan Switcher + User Auth */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Plan Selector (Free, Pro, Max, Ultra) */}
          <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setPlan('free')}
              className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentPlan === 'free'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Free Plan (5 images, 10 MB)"
            >
              Free
            </button>
            <button
              onClick={() => setPlan('pro')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                currentPlan === 'pro'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Pro Plan (100 images, 100 MB)"
            >
              <Sparkles className="w-3 h-3" />
              <span>Pro</span>
            </button>
            <button
              onClick={() => setPlan('max')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                currentPlan === 'max'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Max Plan (300 images, 250 MB)"
            >
              <Flame className="w-3 h-3 text-amber-300" />
              <span>Max</span>
            </button>
            <button
              onClick={() => setPlan('ultra')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                currentPlan === 'ultra'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Ultra Plan (1,000 images, 1 GB)"
            >
              <Crown className="w-3 h-3 text-slate-950" />
              <span>Ultra</span>
            </button>
          </div>

          {/* User Auth Section */}
          {user ? (
            /* Logged In User Dropdown (Desktop right side; shown before PixiForge on mobile & tablet) */
            <div data-header-dropdown="profile" className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => {
                  setToolsDropdownOpen(false);
                  setOtherDropdownOpen(false);
                  setUserMenuOpen(!userMenuOpen);
                }}
                className="flex items-center transition-transform active:scale-95 cursor-pointer select-none"
                aria-label="User account menu"
              >
                <div
                  className={`w-8 h-8 rounded-full ${
                    user.avatarColor || 'bg-blue-600'
                  } text-white flex items-center justify-center font-bold text-xs shadow-xs hover:ring-2 hover:ring-blue-500/30 transition-all`}
                >
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </button>
              {renderProfileDropdown('right')}
            </div>
          ) : (
            /* Free / Guest: Modern Animated Brand Blue Log In Button (Icon-Free, Glow-Free) */
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="relative group px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md hover:shadow-blue-500/25 cursor-pointer overflow-hidden"
            >
              {/* Subtle modern light sweep effect across button on hover */}
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
              <span className="relative z-10">Log In</span>
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle sidebar menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>

    {/* Professional Slide-over Mobile Sidebar Portal (Mounted directly to document.body) */}
    {mobileMenuOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 z-[9999] md:hidden">
        {/* Backdrop Blur Overlay */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-backdrop-fade cursor-pointer"
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Off-canvas Sidebar Panel sliding in from the right edge with 100% full width */}
        <aside className="fixed inset-0 w-full h-screen bg-white shadow-2xl flex flex-col z-10 animate-slide-from-right">
          {/* Sidebar Top Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
            <div
              onClick={() => {
                onNavigate('/');
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-slate-900">
                  Pixi<span className="text-blue-600">Forge</span>
                </span>
                <span className="block text-[10px] text-slate-400 font-medium">Free Pro Photo Suite</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Account Status Card */}
            {user ? (
              <div className="p-3 bg-gradient-to-br from-slate-50 to-blue-50/40 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 text-sm block truncate">{user.name}</span>
                    <span className="text-xs text-slate-500 block truncate">{user.email || user.phone}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsLogoutConfirmOpen(true);
                  }}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 rounded-2xl border border-blue-100 flex items-center justify-between gap-2 shadow-xs">
                <div>
                  <span className="font-bold text-blue-900 text-xs block">Free Guest Access</span>
                  <span className="text-[11px] text-blue-700 block">All tools work with zero login</span>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigate('/login');
                  }}
                  className="relative group px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold cursor-pointer shadow-sm hover:shadow-md transition-all active:scale-95 shrink-0 overflow-hidden"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                  <span className="relative z-10">Log In</span>
                </button>
              </div>
            )}

            {/* Membership Plan Switcher (Free, Pro, Max, Ultra) */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Membership Plan</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    currentPlan === 'ultra'
                      ? 'bg-amber-100 text-amber-800'
                      : currentPlan === 'max'
                      ? 'bg-indigo-100 text-indigo-700'
                      : currentPlan === 'pro'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {currentPlan.toUpperCase()} Active
                </span>
              </div>

              <div className="grid grid-cols-4 bg-slate-200/70 p-1 rounded-xl text-xs font-bold gap-1">
                <button
                  type="button"
                  onClick={() => setPlan('free')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                    currentPlan === 'free'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Free</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlan('pro')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    currentPlan === 'pro'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Pro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlan('max')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    currentPlan === 'max'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Flame className="w-3 h-3 text-amber-300" />
                  <span>Max</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlan('ultra')}
                  className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    currentPlan === 'ultra'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Crown className="w-3 h-3 text-slate-950" />
                  <span>Ultra</span>
                </button>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Navigation
              </div>

              <button
                onClick={() => {
                  onNavigate('/');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Home className="w-4 h-4 text-blue-600" />
                  <span>Home & All Tools</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/pricing');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/pricing'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Pricing & Plans</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/billing');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/billing'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>Billing & Invoices</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/help');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/help'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-emerald-600" />
                  <span>Help & Support</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/terms');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/terms'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Terms & Conditions</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/privacy-policy');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/privacy-policy'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Privacy Policy</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/refund-policy');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/refund-policy'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span>Refund & Cancellation Policy</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  onNavigate('/shipping-policy');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                  currentPath === '/shipping-policy'
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PackageCheck className="w-4 h-4 text-indigo-600" />
                  <span>Shipping / Delivery Policy</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isAdmin && (
                <button
                  onClick={() => {
                    onNavigate('/admin');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                    currentPath === '/admin'
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>Admin Panel</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Popular Tools List */}
            <div className="space-y-1">
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Popular Tools
              </div>

              {[
                { name: 'Image Resizer', path: '/image-resizer', desc: 'Custom pixels & social' },
                { name: 'Image Compressor', path: '/image-compressor', desc: 'Target KB/MB size' },
                { name: 'Image Cropper', path: '/image-cropper', desc: 'Crop 1:1, 16:9, custom' },
                { name: 'Image Watermark', path: '/watermark-image', desc: 'Text & image stamps' },
                { name: 'JPG to PNG', path: '/jpg-to-png', desc: 'Lossless conversion' },
                { name: 'PNG to JPG', path: '/png-to-jpg', desc: 'Color background' },
                { name: 'WebP Converter', path: '/webp-converter', desc: 'Next-gen WebP' },
              ].map((t) => (
                <button
                  key={t.path}
                  onClick={() => {
                    onNavigate(t.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                    currentPath === t.path
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-[10px] text-slate-400">{t.desc}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar Bottom Footer */}
          <div className="p-3.5 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Private & In-Browser</span>
            </span>
            <span className="font-semibold text-slate-400">v2.4</span>
          </div>
        </aside>
      </div>,
      document.body
    )}

    {/* Modern Logout Confirmation Modal */}
    <LogoutConfirmModal
      isOpen={isLogoutConfirmOpen}
      user={user}
      onConfirm={handleConfirmLogout}
      onCancel={() => setIsLogoutConfirmOpen(false)}
    />
  </>
  );
};
