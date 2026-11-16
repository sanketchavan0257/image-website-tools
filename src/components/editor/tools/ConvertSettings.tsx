import React from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { Palette, Sparkles, Check, ShieldCheck } from 'lucide-react';

interface ConvertSettingsProps {
  toolId: string;
}

export const ConvertSettings: React.FC<ConvertSettingsProps> = ({ toolId }) => {
  const { convertSettings, updateConvertSettings } = useImageStore();
  const { targetFormat, pngBackground, quality } = convertSettings;

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* Specific to PNG to JPG: Background color for transparency */}
      {toolId === 'png-to-jpg' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>Transparency Fill Color</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            JPG does not support transparent pixels. Choose a background fill color:
          </p>

          <div className="flex items-center gap-2">
            {[
              { label: 'White', color: '#ffffff' },
              { label: 'Black', color: '#000000' },
              { label: 'Gray', color: '#e2e8f0' },
            ].map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() =>
                  updateConvertSettings({ pngBackground: preset.color })
                }
                className={`flex-1 py-1.5 px-2 rounded-lg border font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                  pngBackground === preset.color
                    ? 'border-blue-600 bg-white text-blue-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-slate-300"
                  style={{ backgroundColor: preset.color }}
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500">Custom color:</span>
            <input
              type="color"
              value={pngBackground}
              onChange={(e) =>
                updateConvertSettings({ pngBackground: e.target.value })
              }
              className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 bg-white"
            />
            <span className="font-mono text-slate-600 text-[11px] uppercase">
              {pngBackground}
            </span>
          </div>
        </div>
      )}

      {/* Specific to WebP Converter: target format selection */}
      {toolId === 'webp-converter' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
            Convert To
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'WebP', mime: 'image/webp' },
              { label: 'JPG', mime: 'image/jpeg' },
              { label: 'PNG', mime: 'image/png' },
            ].map((f) => (
              <button
                key={f.mime}
                type="button"
                onClick={() =>
                  updateConvertSettings({ targetFormat: f.mime as any })
                }
                className={`py-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                  targetFormat === f.mime
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quality Slider (for JPG and WebP) */}
      {(toolId === 'png-to-jpg' ||
        (toolId === 'webp-converter' && targetFormat !== 'image/png')) && (
        <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-700">Encoding Quality</label>
            <span className="font-mono text-blue-600 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={quality}
            onChange={(e) =>
              updateConvertSettings({ quality: parseFloat(e.target.value) })
            }
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>High Compression</span>
            <span>Lossless / Pristine</span>
          </div>
        </div>
      )}

      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
        <span>Lossless local encoding: processed instantly in your browser memory.</span>
      </div>
    </div>
  );
};
