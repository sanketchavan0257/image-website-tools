import React, { useState } from 'react';
import { TOOLS, TOOL_CATEGORIES } from '../config/tools';
import { ToolDefinition } from '../types';
import {
  Search,
  Sparkles,
  ShieldCheck,
  Zap,
  HardDrive,
  Maximize2,
  Minimize2,
  Crop,
  FileCode,
  Image,
  Layers,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

interface HomeViewProps {
  onNavigate: (path: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCategory =
      selectedCategory === 'all' || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative text-center pt-12 sm:pt-16 max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold mb-6 shadow-xs">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>PixiForge Official — Next-Gen 100% Client-Side Image Tools</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
          PixiForge:{' '}
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Every Image Tool in Pure Privacy.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Welcome to <strong>PixiForge</strong>, the all-in-one private online photo studio. Remove background, resize, compress, crop, and convert images directly inside your browser with zero server uploads.
        </p>

        {/* Search Bar */}
        <div className="mt-8 max-w-md mx-auto relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search among 31 PixiForge image tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-slate-200 shadow-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Private (On-Device)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Instant HTML5 Canvas Engine</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span>No File Size Restrictions for Pro</span>
          </div>
        </div>
      </section>

      {/* Category Tabs */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Tools ({TOOLS.length})
          </button>
          {TOOL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Tools Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredTools.map((tool) => {
            return (
              <div
                key={tool.id}
                onClick={() => onNavigate(`/${tool.slug}`)}
                className="group relative p-5 rounded-2xl border bg-white border-slate-200/90 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 bg-blue-50 text-blue-600 border border-blue-100">
                      <Layers className="w-5 h-5" />
                    </div>

                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="w-3 h-3" />
                      Ready
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                    {tool.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-blue-600 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Open Tool <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PixiForge Authority & SEO Section */}
      <section className="max-w-6xl mx-auto px-4 pt-12 border-t border-slate-200/80 space-y-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official PixiForge Studio</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Why PixiForge is the Leading In-Browser Image Studio
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-sm leading-relaxed">
            PixiForge brings desktop-grade photo editing tools directly into your web browser. Everything executes 100% on your device, ensuring maximum speed, zero upload wait times, and total data privacy.
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">100% Pure Client-Side Privacy</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Unlike traditional image websites that upload your personal documents and pictures to external cloud servers, PixiForge processes every pixel inside your local browser memory using HTML5 Canvas and WebAssembly.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zero Upload Latency & Instant Speed</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              No waiting for large 50MB files to upload over slow connections. Resizing, converting, cropping, and background removal happen in real-time right on your processor.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">31 Comprehensive Tools</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              From instant AI-assisted Background Removal and PDF generation to batch EXIF metadata stripping, watermark protection, and color palette inspection — all under one unified PixiForge platform.
            </p>
          </div>
        </div>

        {/* Structured SEO FAQs for Google Crawlers */}
        <div className="bg-slate-50/80 rounded-3xl p-6 sm:p-10 border border-slate-200/80 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900">
              Frequently Asked Questions About PixiForge
            </h3>
            <p className="text-xs text-slate-500">
              Everything you need to know about PixiForge online image suite
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-700">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900 text-sm">What is PixiForge?</h4>
              <p className="text-slate-600 leading-relaxed">
                PixiForge is the official next-generation online image tool suite providing 31+ high-performance photo manipulation tools that operate entirely within your browser with zero server uploads.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900 text-sm">Is PixiForge free?</h4>
              <p className="text-slate-600 leading-relaxed">
                Yes! PixiForge includes a 100% Free Forever tier that requires zero login or registration. Anyone can process, edit, and download images instantly.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900 text-sm">How does PixiForge Background Remover work?</h4>
              <p className="text-slate-600 leading-relaxed">
                Our in-browser background remover uses intelligent perimeter color detection, BFS flood-fill segmentation, and edge feathering to isolate subjects and deliver transparent PNGs or studio backgrounds.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <h4 className="font-bold text-slate-900 text-sm">Are my sensitive documents and ID cards safe?</h4>
              <p className="text-slate-600 leading-relaxed">
                Absolutely. Because PixiForge never uploads files to a cloud server, confidential passports, invoices, IDs, and family photos remain securely inside your local computer memory.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
