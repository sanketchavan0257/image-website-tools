import React from 'react';
import { ImageFileItem } from '../../types';
import { formatBytes } from '../../config/plans';
import { X, Info, Image, HardDrive, Maximize, RotateCw } from 'lucide-react';

interface InfoModalProps {
  item: ImageFileItem | null;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900 text-sm">Image Information</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <img
              src={item.url}
              alt={item.name}
              className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate" title={item.name}>
                {item.name}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{item.type || 'image/jpeg'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Dimensions</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {item.width} × {item.height} px
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {((item.width * item.height) / 1000000).toFixed(2)} Megapixels
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[11px]">File Size</span>
              <span className="font-bold text-blue-700 text-sm mt-0.5 block">
                {formatBytes(item.size)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {item.size.toLocaleString()} Bytes
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Aspect Ratio</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {item.aspectRatio.toFixed(2)} : 1
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-[11px]">MIME Format</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block truncate">
                {item.type || 'image/jpeg'}
              </span>
            </div>
          </div>

          {/* Portal Limits Compatibility */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
              Upload Portal Limits
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div
                className={`p-2 rounded-xl border flex items-center justify-between ${
                  item.size <= 50 * 1024
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50/80 border-rose-200 text-rose-800'
                }`}
              >
                <span className="font-medium">Govt Form (50KB)</span>
                <span className="font-bold text-[10px]">
                  {item.size <= 50 * 1024 ? '✓ OK' : '✕ Exceeds'}
                </span>
              </div>

              <div
                className={`p-2 rounded-xl border flex items-center justify-between ${
                  item.size <= 100 * 1024
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50/80 border-rose-200 text-rose-800'
                }`}
              >
                <span className="font-medium">Passport (100KB)</span>
                <span className="font-bold text-[10px]">
                  {item.size <= 100 * 1024 ? '✓ OK' : '✕ Exceeds'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-blue-50/60 p-3 rounded-xl border border-blue-100/60 leading-relaxed">
            🛡️ <strong>100% Client-Side Privacy:</strong> This image was inspected in your browser's memory without being transferred over the network.
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
