import React, { useState } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import {
  Sliders,
  Percent,
  Share2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Settings2,
} from 'lucide-react';

const SOCIAL_PRESETS = [
  { name: 'Instagram Square Post', size: '1080x1080', category: 'Instagram' },
  { name: 'Instagram Story / Reel', size: '1080x1920', category: 'Instagram' },
  { name: 'WhatsApp DP (Profile)', size: '500x500', category: 'WhatsApp' },
  { name: 'YouTube Thumbnail', size: '1280x720', category: 'YouTube' },
  { name: 'Facebook Cover', size: '820x312', category: 'Facebook' },
  { name: 'LinkedIn Banner', size: '1584x396', category: 'LinkedIn' },
  { name: 'Twitter/X Header', size: '1500x500', category: 'Twitter' },
  { name: 'Passport Photo (2×2")', size: '600x600', category: 'Document' },
  { name: 'Aadhaar/PAN (3.5×4.5cm)', size: '413x531', category: 'Document' },
];

export const ResizeSettings: React.FC = () => {
  const { resizeSettings, updateResizeSettings, images } = useImageStore();
  const [exportSettingsOpen, setExportSettingsOpen] = useState(false);
  const [targetSizeUnit, setTargetSizeUnit] = useState<'KB' | 'MB'>('KB');

  const {
    mode,
    width,
    height,
    unit,
    dpi,
    lockAspectRatio,
    percentage,
    socialPreset,
    targetFormat,
    quality,
    targetFileSizeKB,
  } = resizeSettings;

  // Handle Dimension changes
  const handleWidthChange = (val: string) => {
    const num = val === '' ? '' : Math.max(1, parseInt(val) || 1);
    if (lockAspectRatio && typeof num === 'number' && images.length > 0) {
      const avgAspect =
        images.reduce((acc, img) => acc + img.aspectRatio, 0) / images.length;
      updateResizeSettings({
        width: num,
        height: Math.max(1, Math.round(num / avgAspect)),
      });
    } else {
      updateResizeSettings({ width: num });
    }
  };

  const handleHeightChange = (val: string) => {
    const num = val === '' ? '' : Math.max(1, parseInt(val) || 1);
    if (lockAspectRatio && typeof num === 'number' && images.length > 0) {
      const avgAspect =
        images.reduce((acc, img) => acc + img.aspectRatio, 0) / images.length;
      updateResizeSettings({
        height: num,
        width: Math.max(1, Math.round(num * avgAspect)),
      });
    } else {
      updateResizeSettings({ height: num });
    }
  };

  const handlePresetSelect = (presetSize: string) => {
    const parts = presetSize.split('x').map(Number);
    updateResizeSettings({
      socialPreset: presetSize,
      width: parts[0],
      height: parts[1],
    });
  };

  return (
    <div className="space-y-5 text-slate-800">
      {/* 3 Main Mode Tabs */}
      <div className="grid grid-cols-3 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
        <button
          onClick={() => updateResizeSettings({ mode: 'size' })}
          className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'size'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>By Size</span>
        </button>

        <button
          onClick={() => updateResizeSettings({ mode: 'percentage' })}
          className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'percentage'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>Percentage</span>
        </button>

        <button
          onClick={() => updateResizeSettings({ mode: 'social' })}
          className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'social'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Presets</span>
        </button>
      </div>

      {/* Tab 1: By Size */}
      {mode === 'size' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Width
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="Auto"
                  value={width}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                  {unit}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Height
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  placeholder="Auto"
                  value={height}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                  {unit}
                </span>
              </div>
            </div>
          </div>

          {/* Unit & DPI Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) =>
                  updateResizeSettings({ unit: e.target.value as any })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="px">Pixels (px)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="mm">Millimeters (mm)</option>
                <option value="inch">Inches (in)</option>
              </select>
            </div>

            {unit !== 'px' && (
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  DPI (Print Quality)
                </label>
                <select
                  value={dpi}
                  onChange={(e) =>
                    updateResizeSettings({ dpi: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value={72}>72 DPI (Screen)</option>
                  <option value={96}>96 DPI (Web Standard)</option>
                  <option value={150}>150 DPI (Draft Print)</option>
                  <option value={300}>300 DPI (High Res Print)</option>
                </select>
              </div>
            )}
          </div>

          {/* Lock Aspect Ratio & Scaling Mode */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={lockAspectRatio}
                onChange={(e) =>
                  updateResizeSettings({ lockAspectRatio: e.target.checked })
                }
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              {lockAspectRatio ? (
                <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <Unlock className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="font-semibold">Lock Aspect Ratio</span>
              <span className="text-[11px] text-slate-400 ml-auto">(Proportional)</span>
            </label>

            {lockAspectRatio && (
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
                <span className="text-slate-400 font-medium">Resize Mode:</span>
                <button
                  type="button"
                  onClick={() => updateResizeSettings({ fitMode: 'fit' })}
                  className={`px-2 py-1 rounded-md cursor-pointer ${
                    resizeSettings.fitMode === 'fit'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Fit Bounds
                </button>
                <button
                  type="button"
                  onClick={() => updateResizeSettings({ fitMode: 'exact' })}
                  className={`px-2 py-1 rounded-md cursor-pointer ${
                    resizeSettings.fitMode === 'exact'
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 hover:bg-slate-200'
                  }`}
                >
                  Exact (Stretch)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: As Percentage */}
      {mode === 'percentage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <label className="font-bold text-slate-600 uppercase tracking-wider">
              Scale Percentage
            </label>
            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {percentage}%
            </span>
          </div>

          <input
            type="range"
            min="10"
            max="200"
            step="5"
            value={percentage}
            onChange={(e) =>
              updateResizeSettings({ percentage: Number(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="grid grid-cols-4 gap-1.5 text-xs">
            {[25, 50, 75, 120].map((pct) => (
              <button
                key={pct}
                onClick={() => updateResizeSettings({ percentage: pct })}
                className={`py-1.5 rounded-lg font-medium border text-center transition-colors cursor-pointer ${
                  percentage === pct
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Social Media & Official Presets */}
      {mode === 'social' && (
        <div className="space-y-3">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Select Preset
          </label>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {SOCIAL_PRESETS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => handlePresetSelect(item.size)}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                  socialPreset === item.size
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <span className="text-[10px] text-slate-400">{item.category}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {item.size}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Export Settings */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
        <button
          type="button"
          onClick={() => setExportSettingsOpen(!exportSettingsOpen)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/60 transition-colors cursor-pointer select-none"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-600" />
            <span>Export & Quality Settings</span>
          </span>
          {exportSettingsOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {exportSettingsOpen && (
          <div className="p-4 border-t border-slate-200 space-y-4 bg-white text-xs">
            {/* Save Image As */}
            <div>
              <label className="font-bold text-slate-600 block mb-1">
                Save Image As
              </label>
              <select
                value={targetFormat}
                onChange={(e) =>
                  updateResizeSettings({ targetFormat: e.target.value as any })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="original">Original Format</option>
                <option value="image/jpeg">JPG / JPEG (Best for photos)</option>
                <option value="image/png">PNG (Lossless & transparent)</option>
                <option value="image/webp">WebP (Modern lightweight)</option>
              </select>
            </div>

            {/* Target File Size (KB/MB) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-600">
                  Target File Size (Optional)
                </label>
                <div className="flex gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTargetSizeUnit('KB')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      targetSizeUnit === 'KB'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    KB
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetSizeUnit('MB')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      targetSizeUnit === 'MB'
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-600'
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
                  placeholder="e.g. 100"
                  value={
                    targetFileSizeKB === ''
                      ? ''
                      : targetSizeUnit === 'MB'
                      ? targetFileSizeKB / 1024
                      : targetFileSizeKB
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      updateResizeSettings({ targetFileSizeKB: '' });
                    } else {
                      const num = parseFloat(raw);
                      updateResizeSettings({
                        targetFileSizeKB: targetSizeUnit === 'MB' ? num * 1024 : num,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-mono">
                  {targetSizeUnit}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Automatically calculates compression quality via binary search for JPG & WebP.
              </p>
            </div>

            {/* Quality Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-bold text-slate-600">Image Quality</label>
                <span className="font-mono text-blue-600 font-bold">
                  {Math.round(quality * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                onChange={(e) =>
                  updateResizeSettings({ quality: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
