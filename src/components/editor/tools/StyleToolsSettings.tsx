import React, { useState, useEffect } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import {
  Circle,
  Square,
  Stamp,
  Palette,
  Sparkles,
  ShieldCheck,
  Layers,
  RotateCcw,
  ArrowRightLeft,
  Calendar,
  Type,
  LayoutGrid,
  X,
} from 'lucide-react';

interface StyleToolsSettingsProps {
  toolId: string;
}

export const StyleToolsSettings: React.FC<StyleToolsSettingsProps> = ({ toolId }) => {
  const { styleSettings, updateStyleSettings, images } = useImageStore();
  const {
    roundMode,
    cornerRadius,
    roundBackground,
    roundBorderWidth,
    roundBorderColor,
    borderWidth,
    borderRadius,
    borderColor,
    borderPosition,
    borderStyle,
    borderFillType = 'solid',
    gradientColor1 = '#ec4899',
    gradientColor2 = '#3b82f6',
    gradientAngle = 135,
    isPolaroid,
    watermarkText,
    watermarkOpacity,
    watermarkColor,
    watermarkPos,
    watermarkFontSize = 32,
    watermarkDate = '',
  } = styleSettings;

  // Typeable Hex Color Inputs
  const [customColor1Input, setCustomColor1Input] = useState(gradientColor1);
  const [customColor2Input, setCustomColor2Input] = useState(gradientColor2);
  const [customSolidInput, setCustomSolidInput] = useState(borderColor);

  useEffect(() => {
    setCustomColor1Input(gradientColor1);
  }, [gradientColor1]);

  useEffect(() => {
    setCustomColor2Input(gradientColor2);
  }, [gradientColor2]);

  useEffect(() => {
    setCustomSolidInput(borderColor);
  }, [borderColor]);

  const handleColorChange = (
    rawVal: string,
    setInputState: React.Dispatch<React.SetStateAction<string>>,
    updateStoreKey: 'gradientColor1' | 'gradientColor2' | 'borderColor'
  ) => {
    setInputState(rawVal);
    let cleaned = rawVal.trim();
    if (cleaned.length > 0 && !cleaned.startsWith('#')) {
      cleaned = '#' + cleaned;
    }
    // Accept valid 3-char (#rgb) or 6-char (#rrggbb) hex codes
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cleaned)) {
      if (cleaned.length === 4) {
        const r = cleaned[1];
        const g = cleaned[2];
        const b = cleaned[3];
        cleaned = `#${r}${r}${g}${g}${b}${b}`;
      }
      updateStyleSettings({ [updateStoreKey]: cleaned.toLowerCase() });
    }
  };

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* ================= ROUND IMAGE MAKER ================= */}
      {toolId === 'round-image-maker' && (
        <div className="space-y-4">
          {/* Header Title */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Round Cut Mode
            </label>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Lossless PNG
            </span>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => updateStyleSettings({ roundMode: 'circle' })}
              className={`p-3 rounded-2xl border font-bold flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                roundMode === 'circle'
                  ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                  roundMode === 'circle'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-slate-100 text-slate-600'
                }`}
              >
                <Circle className="w-4 h-4 fill-current" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs">Full Circle Avatar</span>
                <span className="block text-[10px] font-normal text-slate-500">
                  1:1 Profile Picture
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateStyleSettings({ roundMode: 'radius' })}
              className={`p-3 rounded-2xl border font-bold flex flex-col items-center gap-2 transition-all cursor-pointer text-center ${
                roundMode === 'radius'
                  ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-colors ${
                  roundMode === 'radius'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-slate-100 text-slate-600'
                }`}
              >
                <Square className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="block text-xs">Rounded Corners</span>
                <span className="block text-[10px] font-normal text-slate-500">
                  Custom Radius
                </span>
              </div>
            </button>
          </div>

          {/* Corner Radius Controls (when in radius mode) */}
          {roundMode === 'radius' && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700">Corner Curvature</span>
                <span className="font-mono text-blue-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {cornerRadius}%
                </span>
              </div>

              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={cornerRadius}
                onChange={(e) =>
                  updateStyleSettings({ cornerRadius: Number(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />

              {/* Quick Presets for Radius */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                {[
                  { label: '8% Subtle', val: 8 },
                  { label: '20% Card', val: 20 },
                  { label: '35% Smooth', val: 35 },
                  { label: '50% Pill', val: 50 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => updateStyleSettings({ cornerRadius: preset.val })}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      cornerRadius === preset.val
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Border / Stroke Configuration */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700">Outer Border</span>
              <span className="font-mono text-blue-600 font-bold">
                {roundBorderWidth === 0 ? 'None' : `${roundBorderWidth} px`}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'None', val: 0 },
                { label: '3 px', val: 3 },
                { label: '6 px', val: 6 },
                { label: '12 px', val: 12 },
              ].map((b) => (
                <button
                  key={b.val}
                  type="button"
                  onClick={() => updateStyleSettings({ roundBorderWidth: b.val })}
                  className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    roundBorderWidth === b.val
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {roundBorderWidth > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-600">Border Color:</span>
                <div className="flex items-center gap-2">
                  {['#ffffff', '#000000', '#2563eb', '#10b981', '#f59e0b', '#ec4899'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateStyleSettings({ roundBorderColor: c })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        roundBorderColor.toLowerCase() === c.toLowerCase()
                          ? 'scale-110 ring-2 ring-blue-500'
                          : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    value={roundBorderColor}
                    onChange={(e) => updateStyleSettings({ roundBorderColor: e.target.value })}
                    className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer"
                    title="Custom color"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Background / Canvas Fill */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
            <span className="font-bold text-slate-700 block">Outer Background</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => updateStyleSettings({ roundBackground: 'transparent' })}
                className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  roundBackground === 'transparent'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Transparent</span>
              </button>

              <button
                type="button"
                onClick={() => updateStyleSettings({ roundBackground: '#ffffff' })}
                className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  roundBackground === '#ffffff'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Solid White</span>
              </button>

              <button
                type="button"
                onClick={() => updateStyleSettings({ roundBackground: '#0f172a' })}
                className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  roundBackground === '#0f172a'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Solid Dark</span>
              </button>
            </div>
          </div>

          {/* Clarity explanation */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
            <strong className="block mb-0.5">High Quality Output</strong>
            {roundMode === 'circle'
              ? 'Photos are cropped into centered 1:1 circle avatars with anti-aliased edges and exported as transparent PNGs.'
              : 'Corners are trimmed with high-precision anti-aliased curves and saved as PNG.'}
          </div>
        </div>
      )}

      {/* ================= IMAGE BORDER MAKER ================= */}
      {toolId === 'image-border-maker' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Border & Corner Styling
            </label>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {styleSettings.borderRadius > 0 ? 'Rounded PNG' : 'Framed'}
            </span>
          </div>

          {/* Border Thickness */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700">Border Thickness</span>
              <span className="font-mono text-blue-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {borderWidth} px
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="80"
              step="2"
              value={borderWidth}
              onChange={(e) => updateStyleSettings({ borderWidth: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            {/* Quick Thickness Presets */}
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[
                { label: '4 px', val: 4 },
                { label: '12 px', val: 12 },
                { label: '24 px', val: 24 },
                { label: '48 px', val: 48 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => updateStyleSettings({ borderWidth: p.val })}
                  className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    borderWidth === p.val
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Border Radius (NEW FEATURE) */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Border Radius (Corners)</span>
              </div>
              <span className="font-mono text-blue-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {styleSettings.borderRadius === 0 ? 'Square (0 px)' : `${styleSettings.borderRadius} px`}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="80"
              step="2"
              value={styleSettings.borderRadius ?? 0}
              onChange={(e) =>
                updateStyleSettings({ borderRadius: Number(e.target.value) })
              }
              className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            {/* Quick Radius Presets */}
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {[
                { label: '0px Square', val: 0 },
                { label: '12px Soft', val: 12 },
                { label: '24px Modern', val: 24 },
                { label: '40px Curved', val: 40 },
                { label: '65px Heavy', val: 65 },
              ].map((r) => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => updateStyleSettings({ borderRadius: r.val })}
                  className={`py-1.5 px-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                    styleSettings.borderRadius === r.val
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Border Fill: Solid vs Linear Gradient */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Border Color Type</span>
              <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateStyleSettings({ borderFillType: 'solid' })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    borderFillType === 'solid'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Solid Color
                </button>
                <button
                  type="button"
                  onClick={() => updateStyleSettings({ borderFillType: 'gradient' })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    borderFillType === 'gradient'
                      ? 'bg-gradient-to-r from-pink-500 to-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Linear Gradient</span>
                </button>
              </div>
            </div>

            {/* Solid Color Controls */}
            {borderFillType === 'solid' ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Pick Solid Color:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Code:</span>
                    <input
                      type="text"
                      value={customSolidInput}
                      onChange={(e) =>
                        handleColorChange(e.target.value, setCustomSolidInput, 'borderColor')
                      }
                      onBlur={() => setCustomSolidInput(borderColor)}
                      placeholder="#ffffff"
                      maxLength={7}
                      className="w-20 px-2 py-0.5 text-center font-mono text-[11px] font-bold text-slate-800 uppercase bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 shadow-2xs"
                      title="Type or paste Hex Color code (e.g. #2563eb)"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    '#ffffff',
                    '#0f172a',
                    '#2563eb',
                    '#f59e0b',
                    '#10b981',
                    '#f43f5e',
                    '#8b5cf6',
                    '#d97706',
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateStyleSettings({ borderColor: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                        borderColor.toLowerCase() === c.toLowerCase()
                          ? 'scale-115 ring-2 ring-blue-500 shadow-xs'
                          : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <input
                      type="color"
                      value={borderColor.startsWith('#') && borderColor.length === 7 ? borderColor : '#ffffff'}
                      onChange={(e) => updateStyleSettings({ borderColor: e.target.value })}
                      className="w-8 h-8 rounded-xl border border-slate-300 cursor-pointer shadow-2xs"
                      title="Custom solid color"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Linear Gradient Controls */
              <div className="space-y-3.5 pt-1">
                {/* 1-Click Curated Gradient Presets */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                    Curated Gradient Presets:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { name: 'Sunset', c1: '#f43f5e', c2: '#fb923c' },
                      { name: 'Neon', c1: '#06b6d4', c2: '#8b5cf6' },
                      { name: 'Insta', c1: '#833ab4', c2: '#fd1d1d' },
                      { name: 'Ocean', c1: '#0ea5e9', c2: '#10b981' },
                      { name: 'Gold', c1: '#f59e0b', c2: '#e11d48' },
                      { name: 'Violet', c1: '#a855f7', c2: '#ec4899' },
                      { name: 'Mint', c1: '#10b981', c2: '#06b6d4' },
                      { name: 'Fire', c1: '#ef4444', c2: '#eab308' },
                    ].map((grad) => (
                      <button
                        key={grad.name}
                        type="button"
                        onClick={() =>
                          updateStyleSettings({
                            gradientColor1: grad.c1,
                            gradientColor2: grad.c2,
                          })
                        }
                        className={`h-8 rounded-xl border p-1 transition-all flex items-center justify-center cursor-pointer shadow-2xs ${
                          gradientColor1.toLowerCase() === grad.c1.toLowerCase() &&
                          gradientColor2.toLowerCase() === grad.c2.toLowerCase()
                            ? 'ring-2 ring-blue-600 scale-102 border-transparent'
                            : 'border-slate-200 hover:scale-102'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${grad.c1}, ${grad.c2})`,
                        }}
                        title={`${grad.name} (${grad.c1} → ${grad.c2})`}
                      >
                        <span className="text-[10px] font-bold text-white drop-shadow-xs">
                          {grad.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color 1, Swap, Color 2 Pickers & Typeable Hex Inputs */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700">Gradient Colors & Positions:</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateStyleSettings({
                          gradientColor1: gradientColor2,
                          gradientColor2: gradientColor1,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition-colors cursor-pointer border border-blue-200"
                      title="Swap Color 1 and Color 2 positions"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      <span>Swap Positions</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Color 1 */}
                    <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1.5 shadow-2xs">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div
                          className="w-6 h-6 rounded-lg border border-slate-300 shadow-xs shrink-0"
                          style={{ backgroundColor: gradientColor1 }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase leading-tight">
                            Color 1 (Start)
                          </span>
                          <input
                            type="text"
                            value={customColor1Input}
                            onChange={(e) =>
                              handleColorChange(e.target.value, setCustomColor1Input, 'gradientColor1')
                            }
                            onBlur={() => setCustomColor1Input(gradientColor1)}
                            placeholder="#ec4899"
                            maxLength={7}
                            className="w-full px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800 uppercase bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors"
                            title="Type or paste Hex Color code (e.g. #ec4899)"
                          />
                        </div>
                      </div>
                      <input
                        type="color"
                        value={gradientColor1.startsWith('#') && gradientColor1.length === 7 ? gradientColor1 : '#ec4899'}
                        onChange={(e) => updateStyleSettings({ gradientColor1: e.target.value })}
                        className="w-6 h-6 rounded-lg border-0 cursor-pointer shrink-0"
                        title="Pick Start Color"
                      />
                    </div>

                    {/* Color 2 */}
                    <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1.5 shadow-2xs">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <div
                          className="w-6 h-6 rounded-lg border border-slate-300 shadow-xs shrink-0"
                          style={{ backgroundColor: gradientColor2 }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase leading-tight">
                            Color 2 (End)
                          </span>
                          <input
                            type="text"
                            value={customColor2Input}
                            onChange={(e) =>
                              handleColorChange(e.target.value, setCustomColor2Input, 'gradientColor2')
                            }
                            onBlur={() => setCustomColor2Input(gradientColor2)}
                            placeholder="#3b82f6"
                            maxLength={7}
                            className="w-full px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-800 uppercase bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors"
                            title="Type or paste Hex Color code (e.g. #3b82f6)"
                          />
                        </div>
                      </div>
                      <input
                        type="color"
                        value={gradientColor2.startsWith('#') && gradientColor2.length === 7 ? gradientColor2 : '#3b82f6'}
                        onChange={(e) => updateStyleSettings({ gradientColor2: e.target.value })}
                        className="w-6 h-6 rounded-lg border-0 cursor-pointer shrink-0"
                        title="Pick End Color"
                      />
                    </div>
                  </div>
                </div>

                {/* Gradient Direction & Angle ("Colors च्या जागा / दिशा") */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      Gradient Angle & Direction:
                    </span>
                    <span className="font-mono text-blue-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {gradientAngle}°
                    </span>
                  </div>

                  {/* 4 Direction Presets without arrows */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: 'Left-Right', angle: 90 },
                      { label: 'Top-Bottom', angle: 180 },
                      { label: 'Diagonal', angle: 135 },
                      { label: 'Corner', angle: 45 },
                    ].map((dir) => (
                      <button
                        key={dir.angle}
                        type="button"
                        onClick={() => updateStyleSettings({ gradientAngle: dir.angle })}
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                          gradientAngle === dir.angle
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {dir.label}
                      </button>
                    ))}
                  </div>

                  {/* Freeform Angle Slider (0° - 360°) */}
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="5"
                    value={gradientAngle}
                    onChange={(e) =>
                      updateStyleSettings({ gradientAngle: Number(e.target.value) })
                    }
                    className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Live Gradient Preview Strip */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Live Gradient Preview:</span>
                  <div
                    className="h-6 rounded-xl border border-slate-300 shadow-inner transition-all"
                    style={{
                      background: `linear-gradient(${gradientAngle}deg, ${gradientColor1}, ${gradientColor2})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Border Style (Solid, Dashed, Double) */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 block">Border Line Style</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-white border border-slate-200 text-blue-600">
                {styleSettings.borderStyle || 'solid'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'solid', label: 'Solid' },
                { id: 'dashed', label: 'Dashed' },
                { id: 'double', label: 'Double' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() =>
                    updateStyleSettings({
                      borderStyle: st.id as 'solid' | 'dashed' | 'double',
                    })
                  }
                  className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    (styleSettings.borderStyle || 'solid') === st.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="block leading-none">{st.label}</span>
                  <div
                    className={`w-10 h-0 transition-colors ${
                      st.id === 'double'
                        ? 'border-b-4 border-double'
                        : st.id === 'dashed'
                        ? 'border-b-2 border-dashed'
                        : 'border-b-2 border-solid'
                    } ${
                      (styleSettings.borderStyle || 'solid') === st.id
                        ? 'border-white'
                        : 'border-slate-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Helpful callout */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 leading-relaxed">
            <strong className="block mb-0.5">Border Radius Support</strong>
            {styleSettings.borderRadius > 0
              ? `Corners are rounded with ${styleSettings.borderRadius}px radius and exported as lossless transparent PNG.`
              : 'Corners are currently square. Adjust Border Radius above to soften the corners.'}
          </div>
        </div>
      )}

      {/* ================= IMAGE WATERMARK ================= */}
      {toolId === 'image-watermark' && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Stamp className="w-4 h-4 text-blue-600" />
            <span>Watermark Stamp</span>
          </div>

          {/* 1. Watermark Text */}
          <div>
            <label className="font-bold text-slate-700 text-xs block mb-1">
              Watermark Text
            </label>
            <div className="relative">
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => updateStyleSettings({ watermarkText: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                placeholder="e.g. © 2026 PixiForge"
              />
            </div>
          </div>

          {/* 2. Date Option (Rendered Below Watermark Text) */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Date Option</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    updateStyleSettings({ watermarkDate: todayStr });
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  + Today
                </button>
                {watermarkDate && (
                  <button
                    type="button"
                    onClick={() => updateStyleSettings({ watermarkDate: '' })}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove Date"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <input
              type="text"
              value={watermarkDate}
              onChange={(e) => updateStyleSettings({ watermarkDate: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              placeholder="e.g. 2026-11-06 (Leave blank for no date)"
            />

            <p className="text-[10px] text-slate-500 leading-tight">
              {watermarkDate?.trim()
                ? `✓ Date will be displayed directly below watermark: "${watermarkDate.trim()}"`
                : 'ℹ Date is empty: Only watermark text will be shown (no date).'}
            </p>
          </div>

          {/* 3. Text Size Control */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Type className="w-3.5 h-3.5 text-blue-600" />
                <span>Text Size</span>
              </div>
              <span className="font-mono text-blue-600 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {watermarkFontSize}px
              </span>
            </div>

            <input
              type="range"
              min="14"
              max="96"
              step="2"
              value={watermarkFontSize}
              onChange={(e) => updateStyleSettings({ watermarkFontSize: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />

            {/* Quick Size Presets */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[
                { label: 'Small', size: 20 },
                { label: 'Medium', size: 32 },
                { label: 'Large', size: 48 },
                { label: 'XL', size: 64 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updateStyleSettings({ watermarkFontSize: preset.size })}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                    watermarkFontSize === preset.size
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Opacity */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Opacity</span>
              <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                {watermarkOpacity}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={watermarkOpacity}
              onChange={(e) => updateStyleSettings({ watermarkOpacity: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          {/* 5. Text Color (Opacity chya khali) */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span>Text Color</span>
              </label>
              <span className="font-mono text-[11px] text-slate-500 font-semibold uppercase">
                {watermarkColor || '#ffffff'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={watermarkColor || '#ffffff'}
                onChange={(e) => updateStyleSettings({ watermarkColor: e.target.value })}
                className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 p-0.5 bg-white shrink-0"
              />
              <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                {['#ffffff', '#000000', '#facc15', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => updateStyleSettings({ watermarkColor: col })}
                    className={`w-7 h-7 rounded-lg border transition-all ${
                      (watermarkColor || '#ffffff').toLowerCase() === col
                        ? 'scale-110 ring-2 ring-blue-500 shadow-xs'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: col }}
                    title={col}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 6. Position (21-Point Grid: 3 Columns × 7 Rows) */}
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span>Position (21-Point Grid: 3 × 7)</span>
            </div>

            {/* Viewfinder-style 21-Point Grid (3 columns, 7 rows) */}
            <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-700">
              <div className="grid grid-cols-3 gap-1.5 w-full max-w-[260px] mx-auto">
                {[
                  // Row 1: Top
                  { id: 'top-left', label: 'Row 1 (Top) Left', tag: 'R1-L' },
                  { id: 'top-center', label: 'Row 1 (Top) Center', tag: 'R1-C' },
                  { id: 'top-right', label: 'Row 1 (Top) Right', tag: 'R1-R' },
                  // Row 2: Upper 1
                  { id: 'row2-left', label: 'Row 2 Upper Left', tag: 'R2-L', alias: 'upper-left' },
                  { id: 'row2-center', label: 'Row 2 Upper Center', tag: 'R2-C', alias: 'upper-center' },
                  { id: 'row2-right', label: 'Row 2 Upper Right', tag: 'R2-R', alias: 'upper-right' },
                  // Row 3: Upper 2
                  { id: 'row3-left', label: 'Row 3 Mid-Upper Left', tag: 'R3-L' },
                  { id: 'row3-center', label: 'Row 3 Mid-Upper Center', tag: 'R3-C' },
                  { id: 'row3-right', label: 'Row 3 Mid-Upper Right', tag: 'R3-R' },
                  // Row 4: Exact Center
                  { id: 'row4-left', label: 'Row 4 (Center) Left', tag: 'R4-L' },
                  { id: 'row4-center', label: 'Row 4 (Center) Middle', tag: 'R4-C', alias: 'center' },
                  { id: 'row4-right', label: 'Row 4 (Center) Right', tag: 'R4-R' },
                  // Row 5: Lower 1
                  { id: 'row5-left', label: 'Row 5 Mid-Lower Left', tag: 'R5-L' },
                  { id: 'row5-center', label: 'Row 5 Mid-Lower Center', tag: 'R5-C' },
                  { id: 'row5-right', label: 'Row 5 Mid-Lower Right', tag: 'R5-R' },
                  // Row 6: Lower 2
                  { id: 'row6-left', label: 'Row 6 Lower Left', tag: 'R6-L', alias: 'lower-left' },
                  { id: 'row6-center', label: 'Row 6 Lower Center', tag: 'R6-C', alias: 'lower-center' },
                  { id: 'row6-right', label: 'Row 6 Lower Right', tag: 'R6-R', alias: 'lower-right' },
                  // Row 7: Bottom
                  { id: 'bottom-left', label: 'Row 7 (Bottom) Left', tag: 'R7-L' },
                  { id: 'bottom-center', label: 'Row 7 (Bottom) Center', tag: 'R7-C' },
                  { id: 'bottom-right', label: 'Row 7 (Bottom) Right', tag: 'R7-R' },
                ].map((item) => {
                  const isActive =
                    watermarkPos === item.id ||
                    (item.alias && watermarkPos === item.alias);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateStyleSettings({ watermarkPos: item.id })}
                      className={`h-7.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all flex items-center justify-center ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400/50 scale-[1.03]'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={item.label}
                    >
                      <span className="leading-tight">{item.tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Position Indicator */}
            <div className="text-center text-[11px] text-slate-600 bg-slate-50 py-1.5 px-2 rounded-lg border border-slate-200/60 font-medium">
              Selected:{' '}
              <span className="font-bold text-blue-600 capitalize">
                {(() => {
                  const pos = watermarkPos || 'bottom-right';
                  const map: Record<string, string> = {
                    'top-left': 'Row 1 (Top) Left',
                    'top-center': 'Row 1 (Top) Center',
                    'top-right': 'Row 1 (Top) Right',
                    'row2-left': 'Row 2 Upper Left',
                    'row2-center': 'Row 2 Upper Center',
                    'row2-right': 'Row 2 Upper Right',
                    'upper-left': 'Row 2 Upper Left',
                    'upper-center': 'Row 2 Upper Center',
                    'upper-right': 'Row 2 Upper Right',
                    'row3-left': 'Row 3 Mid-Upper Left',
                    'row3-center': 'Row 3 Mid-Upper Center',
                    'row3-right': 'Row 3 Mid-Upper Right',
                    'row4-left': 'Row 4 Center Left',
                    'row4-center': 'Row 4 Center Middle',
                    'row4-right': 'Row 4 Center Right',
                    'center': 'Row 4 Center Middle',
                    'row5-left': 'Row 5 Mid-Lower Left',
                    'row5-center': 'Row 5 Mid-Lower Center',
                    'row5-right': 'Row 5 Mid-Lower Right',
                    'row6-left': 'Row 6 Lower Left',
                    'row6-center': 'Row 6 Lower Center',
                    'row6-right': 'Row 6 Lower Right',
                    'lower-left': 'Row 6 Lower Left',
                    'lower-center': 'Row 6 Lower Center',
                    'lower-right': 'Row 6 Lower Right',
                    'bottom-left': 'Row 7 (Bottom) Left',
                    'bottom-center': 'Row 7 (Bottom) Center',
                    'bottom-right': 'Row 7 (Bottom) Right',
                  };
                  return map[pos] || pos.replace('-', ' ');
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
