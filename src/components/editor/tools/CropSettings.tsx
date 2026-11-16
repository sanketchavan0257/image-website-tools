import React, { useState } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { ImageFileItem } from '../../../types';
import {
  Scissors,
  Sparkles,
  Check,
  Info,
  RotateCcw,
  Layers,
  ArrowRight,
  Maximize2,
} from 'lucide-react';

const CROP_RATIOS = [
  { name: 'Freeform', ratio: null, desc: 'Custom arbitrary bounds' },
  { name: '1:1 Square', ratio: 1, desc: 'Instagram Post, DP, Profile' },
  { name: '16:9 Landscape', ratio: 16 / 9, desc: 'YouTube thumbnail, Video' },
  { name: '9:16 Vertical', ratio: 9 / 16, desc: 'Stories, Reels, TikTok' },
  { name: '4:3 Standard Photo', ratio: 4 / 3, desc: 'Standard digital camera' },
  { name: '3:2 Classic DSLR', ratio: 3 / 2, desc: '35mm Film, DSLR' },
  { name: '2:3 Portrait', ratio: 2 / 3, desc: 'Vertical photo print' },
  { name: '3.5:4.5 Passport / ID', ratio: 3.5 / 4.5, desc: 'PAN, Aadhaar, Passport' },
];

interface CropSettingsProps {
  onOpenCrop?: (item: ImageFileItem) => void;
}

export const CropSettings: React.FC<CropSettingsProps> = ({ onOpenCrop }) => {
  const {
    images,
    cropSettings,
    updateCropSettings,
    applyCenterCropToAll,
    resetAllCrops,
    setToastMessage,
  } = useImageStore();

  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const croppedCount = images.filter((img) => Boolean(img.cropData)).length;

  const handleApplyToAll = async (ratio: number | null, ratioName: string) => {
    setIsApplyingAll(true);
    try {
      await applyCenterCropToAll(ratio);
      setToastMessage(
        ratio !== null
          ? `All photos cropped to ${ratioName}`
          : 'All crops have been reset'
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsApplyingAll(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* Primary Action: Open Visual Cropper */}
      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Visual Cropper</h4>
              <p className="text-[11px] text-slate-500">
                {croppedCount} of {images.length} photo(s) cropped
              </p>
            </div>
          </div>
        </div>

        {images.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenCrop?.(images[0])}
            className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Scissors className="w-4 h-4" />
            <span>Open Interactive Cropper</span>
          </button>
        )}
      </div>

      {/* Aspect Ratio Presets */}
      <div>
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
          Aspect Ratio Presets
        </label>
        <div className="space-y-1.5">
          {CROP_RATIOS.map((item) => {
            const isSelected = cropSettings.ratioName === item.name;
            return (
              <div
                key={item.name}
                className={`p-2.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-medium'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      updateCropSettings({
                        aspectRatio: item.ratio,
                        ratioName: item.name,
                      })
                    }
                    className="flex-1 text-left cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-xs">{item.name}</div>
                      <div className="text-[10px] text-slate-500">{item.desc}</div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />
                    )}
                  </button>
                </div>

                {/* Batch apply to all button when selected */}
                {isSelected && item.ratio !== null && (
                  <button
                    type="button"
                    disabled={isApplyingAll}
                    onClick={() => handleApplyToAll(item.ratio, item.name)}
                    className="mt-2 w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      {isApplyingAll
                        ? 'Cropping All...'
                        : `Apply ${item.name} to All Photos`}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset Action */}
      {croppedCount > 0 && (
        <button
          type="button"
          onClick={() => {
            resetAllCrops();
            setToastMessage('All crops reset to original photo dimensions');
          }}
          className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset All Crops to Original</span>
        </button>
      )}

      {/* Guide Info Box */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5 text-slate-600">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
          <Info className="w-3.5 h-3.5 text-blue-600" />
          <span>Precision Cropping</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Drag handles to crop freely or pick an aspect ratio preset. Use{' '}
          <strong className="text-slate-700">"Apply to All Photos"</strong> to instantly batch-crop every photo with identical proportions.
        </p>
      </div>
    </div>
  );
};
