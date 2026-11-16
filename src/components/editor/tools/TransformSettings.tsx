import React from 'react';
import { useImageStore } from '../../../store/useImageStore';
import {
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Check,
  RefreshCw,
} from 'lucide-react';

interface TransformSettingsProps {
  toolId: string;
}

export const TransformSettings: React.FC<TransformSettingsProps> = ({ toolId }) => {
  const {
    transformSettings,
    images,
    rotateAllImages,
    flipAllImages,
    resetTransformations,
  } = useImageStore();

  const { rotationAngle, flipHorizontal, flipVertical } = transformSettings;

  const isRotator = toolId === 'image-rotator' || toolId === 'rotate';
  const isFlipper = toolId === 'image-flipper' || toolId === 'flip';

  // Check if any image currently has a flip or rotation applied
  const anyFlippedH = images.some((img) => img.flipH);
  const anyFlippedV = images.some((img) => img.flipV);
  const anyRotated = images.some((img) => img.rotation !== 0);
  const hasActiveTransform = anyFlippedH || anyFlippedV || anyRotated;

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* Rotator Controls */}
      {isRotator && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Rotation Angle
            </label>
            {hasActiveTransform && (
              <button
                type="button"
                onClick={resetTransformations}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset (0°)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '90° Right', delta: 90 },
              { label: '180° Half', delta: 180 },
              { label: '270° Left', delta: 270 },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => rotateAllImages(item.delta)}
                className="py-3 px-2 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/70 font-semibold text-slate-700 flex flex-col items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCw className="w-4 h-4 text-blue-600" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Click to rotate all {images.length} images clockwise. You can also rotate individual images using the card button.
          </p>
        </div>
      )}

      {/* Flipper Controls */}
      {isFlipper && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Flip Direction
            </label>
            {hasActiveTransform && (
              <button
                type="button"
                onClick={resetTransformations}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                title="Reset all flips to original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Flips</span>
              </button>
            )}
          </div>

          {/* Primary Flip Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => flipAllImages('h')}
              className={`p-3.5 rounded-2xl border font-bold flex flex-col items-center gap-2 transition-all cursor-pointer active:scale-95 text-center ${
                flipHorizontal
                  ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-colors ${
                  flipHorizontal ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <FlipHorizontal className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs">Flip Horizontal</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                    flipHorizontal
                      ? 'bg-blue-200/80 text-blue-900'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {flipHorizontal ? 'Mirror Active' : 'Off'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => flipAllImages('v')}
              className={`p-3.5 rounded-2xl border font-bold flex flex-col items-center gap-2 transition-all cursor-pointer active:scale-95 text-center ${
                flipVertical
                  ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
              }`}
            >
              <div
                className={`p-2 rounded-xl transition-colors ${
                  flipVertical ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <FlipVertical className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs">Flip Vertical</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                    flipVertical
                      ? 'bg-blue-200/80 text-blue-900'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {flipVertical ? 'Mirror Active' : 'Off'}
                </span>
              </div>
            </button>
          </div>

          {/* Quick Shortcuts: Both / Reset */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const shouldActivate = !flipHorizontal || !flipVertical;
                useImageStore.setState((state) => ({
                  images: state.images.map((img) => ({
                    ...img,
                    flipH: shouldActivate,
                    flipV: shouldActivate,
                  })),
                  transformSettings: {
                    ...state.transformSettings,
                    flipHorizontal: shouldActivate,
                    flipVertical: shouldActivate,
                  },
                }));
              }}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Flip Both (180°)</span>
            </button>

            <button
              type="button"
              onClick={resetTransformations}
              disabled={!hasActiveTransform}
              className="py-2 px-3 rounded-xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50 text-[11px] font-semibold text-slate-700 hover:text-rose-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Original</span>
            </button>
          </div>

          {/* Helpful description & guidance */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Mirror & Invert Orientation</p>
            <p className="text-slate-500 leading-relaxed">
              <strong>Flip Horizontal</strong> mirrors left-to-right. <strong>Flip Vertical</strong> inverts upside-down. You can also flip individual photos right on each card.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
