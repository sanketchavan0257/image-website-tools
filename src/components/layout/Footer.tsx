import React from 'react';
import { TOOL_CATEGORIES, TOOLS } from '../../config/tools';
import { Layers, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand & Privacy */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <span>PixiForge</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              31 powerful browser-based image tools. Resizing, compressing, cropping, background removing, and converting done 100% client-side with zero server uploads.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-xs pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero server image storage. 100% private.</span>
            </div>
          </div>

          {/* Tools Categories Links */}
          <div className="space-y-2">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Resize & Optimize
            </h5>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onNavigate('/bg-remover')}
                  className="hover:text-white transition-colors cursor-pointer text-left text-blue-400 font-medium"
                >
                  Background Remover ★
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/image-resizer')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Image Resizer
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/image-compressor')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Image Compressor
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/image-cropper')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Image Cropper
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Converters
            </h5>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onNavigate('/jpg-to-png')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  JPG to PNG
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/png-to-jpg')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  PNG to JPG
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/webp-converter')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  WebP Converter
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Quick Links
            </h5>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => onNavigate('/')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  All 30 Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/pricing')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Free vs Pro Plans
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/billing')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Billing & Invoices
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('/help')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Help & Support
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} PixiForge. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Processed 100% locally in your browser with HTML5 Canvas & Web Workers.
          </p>
        </div>
      </div>
    </footer>
  );
};
