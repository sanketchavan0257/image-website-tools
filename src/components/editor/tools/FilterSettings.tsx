import React from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { Sun, Sliders, Palette, Droplet, Grid, Eye } from 'lucide-react';

interface FilterSettingsProps {
  toolId: string;
}

export const FilterSettings: React.FC<FilterSettingsProps> = ({ toolId }) => {
  const { filterSettings, updateFilterSettings } = useImageStore();
  const { grayscale, brightness, contrast, saturation, blur, pixelate } =
    filterSettings;

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* Grayscale Tool */}
      {toolId === 'grayscale-converter' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Eye className="w-4 h-4 text-blue-600" />
            <span>Black & White Grayscale Mode</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            All colors will be transformed into true black & white shades using standard ITU-R BT.601 luminance weighting.
          </p>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-emerald-700 font-semibold text-[11px] flex items-center gap-1.5">
            <span>✓ Active: Grayscale will be applied to all images</span>
          </div>
        </div>
      )}

      {/* Brightness Tool */}
      {toolId === 'image-brightness' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Exposure / Brightness</span>
            </label>
            <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {brightness > 0 ? `+${brightness}%` : `${brightness}%`}
            </span>
          </div>
          <input
            type="range"
            min="-80"
            max="80"
            step="5"
            value={brightness}
            onChange={(e) =>
              updateFilterSettings({ brightness: parseInt(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Darker (-80%)</span>
            <span>Brighter (+80%)</span>
          </div>
        </div>
      )}

      {/* Contrast Tool */}
      {toolId === 'image-contrast' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>Tonal Contrast</span>
            </label>
            <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {contrast > 0 ? `+${contrast}%` : `${contrast}%`}
            </span>
          </div>
          <input
            type="range"
            min="-80"
            max="100"
            step="5"
            value={contrast}
            onChange={(e) =>
              updateFilterSettings({ contrast: parseInt(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Soft contrast (-80%)</span>
            <span>Vivid contrast (+100%)</span>
          </div>
        </div>
      )}

      {/* Saturation Tool */}
      {toolId === 'image-saturation' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-violet-600" />
              <span>Color Saturation</span>
            </label>
            <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {saturation > 0 ? `+${saturation}%` : `${saturation}%`}
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="150"
            step="5"
            value={saturation}
            onChange={(e) =>
              updateFilterSettings({ saturation: parseInt(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Muted / B&W (-100%)</span>
            <span>Vibrant (+150%)</span>
          </div>
        </div>
      )}

      {/* Blur Tool */}
      {toolId === 'blur-image' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Droplet className="w-4 h-4 text-cyan-600" />
              <span>Gaussian Blur Radius</span>
            </label>
            <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {blur || 6} px
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="1"
            value={blur || 6}
            onChange={(e) =>
              updateFilterSettings({ blur: parseInt(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Subtle (1px)</span>
            <span>Heavy (30px)</span>
          </div>
        </div>
      )}

      {/* Pixelate Tool */}
      {toolId === 'pixelate-image' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Grid className="w-4 h-4 text-emerald-600" />
              <span>Pixel Block Size</span>
            </label>
            <span className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200">
              {pixelate || 12} px
            </span>
          </div>
          <input
            type="range"
            min="4"
            max="40"
            step="2"
            value={pixelate || 12}
            onChange={(e) =>
              updateFilterSettings({ pixelate: parseInt(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Fine 8-bit (4px)</span>
            <span>Censored blocks (40px)</span>
          </div>
        </div>
      )}
    </div>
  );
};
