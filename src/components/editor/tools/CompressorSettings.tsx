import React, { useState } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { Zap, Target, Sliders, ShieldCheck } from 'lucide-react';

export const CompressorSettings: React.FC = () => {
  const { compressorSettings, updateCompressorSettings } = useImageStore();
  const [unit, setUnit] = useState<'KB' | 'MB'>('KB');

  const { mode, preset, targetFormat, quality, targetFileSizeKB } =
    compressorSettings;

  return (
    <div className="space-y-5 text-slate-800">
      {/* Compression Mode Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
          Compression Mode
        </label>
        <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => updateCompressorSettings({ mode: 'preset' })}
            className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
              mode === 'preset'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Preset</span>
          </button>

          <button
            type="button"
            onClick={() => updateCompressorSettings({ mode: 'target-size' })}
            className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
              mode === 'target-size'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Target Size</span>
          </button>

          <button
            type="button"
            onClick={() => updateCompressorSettings({ mode: 'custom-quality' })}
            className={`py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer ${
              mode === 'custom-quality'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Custom</span>
          </button>
        </div>
      </div>

      {/* Preset Mode Details */}
      {mode === 'preset' && (
        <div className="space-y-2.5">
          {[
            {
              id: 'recommended',
              title: 'Recommended Compression',
              desc: 'Optimal balance. ~75% quality with virtually zero visible artifacts.',
              badge: 'Best Balance',
            },
            {
              id: 'aggressive',
              title: 'Aggressive Compression',
              desc: 'Maximum file size reduction (~50% quality). Great for mobile web.',
              badge: 'Smallest Size',
            },
            {
              id: 'light',
              title: 'Light Compression',
              desc: 'Gentle reduction (~88% quality). Keeps maximum photographic depth.',
              badge: 'Highest Quality',
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                updateCompressorSettings({ preset: item.id as any })
              }
              className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                preset === item.id
                  ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-bold text-slate-900">
                  {item.title}
                </h4>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {item.desc}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Target Size Mode Details */}
      {mode === 'target-size' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-700">Exact Target Size</label>
            <div className="flex gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setUnit('KB')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  unit === 'KB' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-200 text-slate-700'
                }`}
              >
                KB
              </button>
              <button
                type="button"
                onClick={() => setUnit('MB')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  unit === 'MB' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-200 text-slate-700'
                }`}
              >
                MB
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={
                targetFileSizeKB === ''
                  ? ''
                  : unit === 'MB'
                  ? targetFileSizeKB / 1024
                  : targetFileSizeKB
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  updateCompressorSettings({ targetFileSizeKB: '' });
                } else {
                  const num = parseFloat(val);
                  updateCompressorSettings({
                    targetFileSizeKB: unit === 'MB' ? num * 1024 : num,
                  });
                }
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3.5 top-2.5 text-slate-400 font-mono font-bold">
              {unit}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-normal">
            Binary search tests multiple compression factors to match your limit without exceeding it.
          </p>
        </div>
      )}

      {/* Custom Quality Slider */}
      {mode === 'custom-quality' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700">Quality Level</label>
            <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={quality}
            onChange={(e) =>
              updateCompressorSettings({ quality: parseFloat(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>Low (Smallest size)</span>
            <span>High (Best visual)</span>
          </div>
        </div>
      )}

      {/* Output Format */}
      <div className="space-y-1.5 text-xs">
        <label className="font-bold text-slate-600 uppercase tracking-wider block">
          Output Format
        </label>
        <select
          value={targetFormat}
          onChange={(e) =>
            updateCompressorSettings({ targetFormat: e.target.value as any })
          }
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer"
        >
          <option value="image/jpeg">JPG / JPEG (Universal photo - Recommended)</option>
          <option value="original">Keep Original Format</option>
          <option value="image/webp">WebP (Modern web format)</option>
        </select>
        {targetFormat === 'image/webp' && (
          <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200/60">
            Note: Windows Explorer registers .webp files with Chrome/Edge icon. Choose <strong>JPG</strong> above to open directly in standard photo viewer.
          </p>
        )}
      </div>

      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>100% browser-based compression with zero quality degradation on transfers.</span>
      </div>
    </div>
  );
};
