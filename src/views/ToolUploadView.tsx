import React, { useEffect } from 'react';
import { ToolDefinition } from '../types';
import { UploadBox } from '../components/upload/UploadBox';
import { Base64ToImageConverter } from '../components/tools/Base64ToImageConverter';
import { AdSlot } from '../components/common/AdSlot';
import { prewarmBgRemovalAI } from '../services/bgRemovalEngine';
import {
  Sparkles,
  ShieldCheck,
  Zap,
  HelpCircle,
  ListOrdered,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

interface ToolUploadViewProps {
  tool: ToolDefinition;
  onImagesReady: () => void;
  onNavigate: (path: string) => void;
}

export const ToolUploadView: React.FC<ToolUploadViewProps> = ({
  tool,
  onImagesReady,
  onNavigate,
}) => {
  // Update document title and description dynamically for SEO
  useEffect(() => {
    document.title = `${tool.metaTitle} | PixiForge`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', tool.metaDescription);
    }
    if (tool.id === 'bg-remover') {
      prewarmBgRemovalAI();
    }
  }, [tool]);

  return (
    <div className="w-full">
      {/* 3-Column Layout: Left AdSlot, Center Content, Right AdSlot */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6 justify-center">
        {/* Left Side AdSlot (Free users on desktop only) */}
        <AdSlot position="left" />

        {/* Center Main Content Area */}
        <div className="flex-1 max-w-4xl min-w-0 space-y-12">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-slate-500">
            <button
              onClick={() => onNavigate('/')}
              className="hover:text-blue-600 transition-colors cursor-pointer"
            >
              Home
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-800 capitalize">
              {tool.category.replace('-', ' & ')}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-900 font-bold">{tool.name}</span>
          </nav>

          {/* Tool Hero Header */}
          <header className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">
              {tool.name}
            </h1>
            <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {tool.description}
            </p>
          </header>

          {/* Upload / Input Box Component */}
          <section aria-label="Tool Main Input Zone">
            {tool.id === 'base64-to-image' ? (
              <Base64ToImageConverter onImagesReady={onImagesReady} />
            ) : (
              <UploadBox onImagesReady={onImagesReady} />
            )}
          </section>

          {/* Quick Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Instant In-Browser</span>
                <span className="text-slate-500">Zero network waiting times</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">100% Privacy</span>
                <span className="text-slate-500">Your photos never touch a server</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Bulk Batch Mode</span>
                <span className="text-slate-500">ZIP & individual downloads</span>
              </div>
            </div>
          </div>

          {/* SEO Section: How to use */}
          {tool.howToSteps && tool.howToSteps.length > 0 && (
            <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  How to Use {tool.name}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tool.howToSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-start gap-3.5 text-xs text-slate-700"
                  >
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SEO Section: FAQs (300+ words of content) */}
          {tool.faqs && tool.faqs.length > 0 && (
            <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-4">
                {tool.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-50/60 border border-slate-100 space-y-2 text-xs"
                  >
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{faq.question}</span>
                    </h3>
                    <p className="text-slate-600 leading-relaxed pl-6">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Side AdSlot (Free users on desktop only) */}
        <AdSlot position="right" />
      </div>
    </div>
  );
};
