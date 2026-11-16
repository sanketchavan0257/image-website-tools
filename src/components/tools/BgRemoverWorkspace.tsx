import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useImageStore } from '../../store/useImageStore';
import { downloadFile } from '../../services/zipExport';
import {
  removeBackgroundCanvas,
  composeOutputBackground,
  STUDIO_GRADIENTS,
  STUDIO_SOLID_COLORS,
  BgRemovalOptions,
} from '../../services/bgRemovalEngine';
import {
  Sparkles,
  Download,
  RotateCcw,
  Sliders,
  Eye,
  Eraser,
  Paintbrush,
  Pipette,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  Split,
  Columns,
  Image as ImageIcon,
  Palette,
  ShieldCheck,
  Undo2,
} from 'lucide-react';

export const BgRemoverWorkspace: React.FC = () => {
  const { images, selectedImageId, setSelectedImageId } = useImageStore();

  const activeImage =
    images.find((img) => img.id === selectedImageId) || images[0] || null;

  // Background Removal Tuning States
  const [tolerance, setTolerance] = useState<number>(28);
  const [feather, setFeather] = useState<number>(2);
  const [activeTool, setActiveTool] = useState<'auto' | 'eyedropper' | 'eraser' | 'restore'>('auto');
  const [brushSize, setBrushSize] = useState<number>(25);

  // Background Fill Type
  const [outputBackground, setOutputBackground] = useState<'transparent' | 'color' | 'gradient' | 'blur'>('transparent');
  const [selectedSolidColor, setSelectedSolidColor] = useState<string>('#ffffff');
  const [selectedGradientIdx, setSelectedGradientIdx] = useState<number>(0);
  const [blurAmount, setBlurAmount] = useState<number>(12);

  // View Mode: 'split' (interactive slider), 'side_by_side', 'cutout_only'
  const [viewMode, setViewMode] = useState<'split' | 'side_by_side' | 'cutout_only'>('split');
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 to 100
  const isDraggingSlider = useRef(false);

  // Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Canvases
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sampled color
  const [sampledColor, setSampledColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBrushPainting, setIsBrushPainting] = useState(false);

  // Load active image into original canvas
  useEffect(() => {
    if (!activeImage) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origCanvas = document.createElement('canvas');
      origCanvas.width = img.naturalWidth || img.width;
      origCanvas.height = img.naturalHeight || img.height;
      const ctx = origCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        originalCanvasRef.current = origCanvas;
        runRemoval();
      }
    };
    img.src = activeImage.url;
  }, [activeImage?.id, activeImage?.url]);

  // Run Background Removal
  const runRemoval = useCallback(() => {
    const orig = originalCanvasRef.current;
    if (!orig) return;

    setIsProcessing(true);

    // Let the UI breathe
    setTimeout(() => {
      const options: BgRemovalOptions = {
        tolerance,
        feather,
        targetColor: sampledColor,
        outputBackground,
        backgroundColor: selectedSolidColor,
        gradientIndex: selectedGradientIdx,
        blurAmount,
      };

      const cutout = removeBackgroundCanvas(orig, options);
      cutoutCanvasRef.current = cutout;

      const finalCanvas = composeOutputBackground(cutout, orig, options);
      renderToDisplay(finalCanvas, orig);

      setIsProcessing(false);
    }, 20);
  }, [
    tolerance,
    feather,
    sampledColor,
    outputBackground,
    selectedSolidColor,
    selectedGradientIdx,
    blurAmount,
  ]);

  // Re-run whenever settings change
  useEffect(() => {
    if (originalCanvasRef.current) {
      runRemoval();
    }
  }, [runRemoval]);

  // Render on main display canvas
  const renderToDisplay = (resultCanvas: HTMLCanvasElement, origCanvas: HTMLCanvasElement) => {
    const displayCanvas = previewCanvasRef.current;
    if (!displayCanvas) return;

    displayCanvas.width = origCanvas.width;
    displayCanvas.height = origCanvas.height;
    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

    if (viewMode === 'cutout_only') {
      ctx.drawImage(resultCanvas, 0, 0);
    } else if (viewMode === 'split') {
      const splitX = Math.round((sliderPos / 100) * displayCanvas.width);

      // Draw original on left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, displayCanvas.height);
      ctx.clip();
      ctx.drawImage(origCanvas, 0, 0);
      ctx.restore();

      // Draw cutout on right
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, displayCanvas.width - splitX, displayCanvas.height);
      ctx.clip();
      ctx.drawImage(resultCanvas, 0, 0);
      ctx.restore();

      // Divider line
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, displayCanvas.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.stroke();
    }
  };

  // Eyedropper / Brush click & drag on preview canvas
  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    const orig = originalCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    if (!canvas || !orig || !cutout) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    if (activeTool === 'eyedropper') {
      const origCtx = orig.getContext('2d');
      if (origCtx) {
        const pixel = origCtx.getImageData(x, y, 1, 1).data;
        setSampledColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
      }
      return;
    }

    if (activeTool === 'eraser' || activeTool === 'restore') {
      const cutoutCtx = cutout.getContext('2d');
      const origCtx = orig.getContext('2d');
      if (!cutoutCtx || !origCtx) return;

      const radius = brushSize * scaleX;

      if (activeTool === 'eraser') {
        // Erase: destination-out transparency
        cutoutCtx.save();
        cutoutCtx.globalCompositeOperation = 'destination-out';
        cutoutCtx.beginPath();
        cutoutCtx.arc(x, y, radius, 0, Math.PI * 2);
        cutoutCtx.fill();
        cutoutCtx.restore();
      } else {
        // Restore: source-over from original image
        cutoutCtx.save();
        cutoutCtx.beginPath();
        cutoutCtx.arc(x, y, radius, 0, Math.PI * 2);
        cutoutCtx.clip();
        cutoutCtx.drawImage(orig, 0, 0);
        cutoutCtx.restore();
      }

      const options: BgRemovalOptions = {
        tolerance,
        feather,
        outputBackground,
        backgroundColor: selectedSolidColor,
        gradientIndex: selectedGradientIdx,
        blurAmount,
      };
      const finalCanvas = composeOutputBackground(cutout, orig, options);
      renderToDisplay(finalCanvas, orig);
    }
  };

  // Slider Mouse Move / Touch
  const handleSliderMove = (clientX: number) => {
    const container = previewCanvasRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    setSliderPos(pct);
    if (cutoutCanvasRef.current && originalCanvasRef.current) {
      const options: BgRemovalOptions = {
        tolerance,
        feather,
        outputBackground,
        backgroundColor: selectedSolidColor,
        gradientIndex: selectedGradientIdx,
        blurAmount,
      };
      const finalCanvas = composeOutputBackground(cutoutCanvasRef.current, originalCanvasRef.current, options);
      renderToDisplay(finalCanvas, originalCanvasRef.current);
    }
  };

  // Download Output Cutout
  const handleDownload = (format: 'png' | 'jpg') => {
    const orig = originalCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    if (!orig || !cutout) return;

    const options: BgRemovalOptions = {
      tolerance,
      feather,
      outputBackground: format === 'jpg' && outputBackground === 'transparent' ? 'color' : outputBackground,
      backgroundColor: selectedSolidColor,
      gradientIndex: selectedGradientIdx,
      blurAmount,
    };

    const finalCanvas = composeOutputBackground(cutout, orig, options);
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    finalCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const baseName = activeImage?.name.replace(/\.[^/.]+$/, '') || 'image';
        downloadFile(blob, `${baseName}-no-bg.${ext}`);
      },
      mimeType,
      0.95
    );
  };

  // Reset to auto defaults
  const handleReset = () => {
    setTolerance(28);
    setFeather(2);
    setSampledColor(null);
    setActiveTool('auto');
    setOutputBackground('transparent');
    setSliderPos(50);
  };

  if (!activeImage) {
    return (
      <div className="p-12 text-center text-slate-500">
        No image loaded. Please upload an image to remove background.
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* LEFT: SETTINGS & TUNING CONTROLS */}
      <div className="w-full lg:w-96 shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Background Remover</h3>
                <span className="text-[11px] text-slate-500">100% In-Browser Edge AI</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Reset Settings"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Tool Mode Buttons */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              Removal Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTool('auto');
                  setSampledColor(null);
                }}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTool === 'auto'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Auto Cutout</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('eyedropper')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTool === 'eyedropper'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Pipette className="w-4 h-4 text-amber-600" />
                <span>Eye-dropper</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('eraser')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTool === 'eraser'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Eraser className="w-4 h-4 text-rose-600" />
                <span>Magic Eraser</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('restore')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTool === 'restore'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-xs ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Paintbrush className="w-4 h-4 text-emerald-600" />
                <span>Restore Brush</span>
              </button>
            </div>
          </div>

          {/* Active Tool Helper Note */}
          {activeTool === 'eyedropper' && (
            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <Pipette className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Click anywhere on the image background to pick and remove that exact color.</span>
            </div>
          )}

          {(activeTool === 'eraser' || activeTool === 'restore') && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Brush Size</span>
                <span className="font-mono text-slate-500">{brushSize}px</span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400 block">
                {activeTool === 'eraser'
                  ? 'Drag over leftover background to erase it.'
                  : 'Drag over subject to restore accidental cutouts.'}
              </span>
            </div>
          )}

          {/* Sliders: Tolerance & Feather */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Color Tolerance</span>
                <span className="font-mono text-blue-600 font-bold">{tolerance}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="85"
                value={tolerance}
                onChange={(e) => setTolerance(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Higher = removes more background shades. Lower = protects fine edges.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                <span>Edge Softness (Feather)</span>
                <span className="font-mono text-blue-600 font-bold">{feather}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                value={feather}
                onChange={(e) => setFeather(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Smooths harsh outline jaggedness around hair and cloth borders.
              </span>
            </div>
          </div>

          {/* Background Replacement Options */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              New Background
            </label>

            {/* Background Type Pills */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl mb-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setOutputBackground('transparent')}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  outputBackground === 'transparent'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOutputBackground('color')}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  outputBackground === 'color'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Color
              </button>
              <button
                type="button"
                onClick={() => setOutputBackground('gradient')}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  outputBackground === 'gradient'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gradient
              </button>
              <button
                type="button"
                onClick={() => setOutputBackground('blur')}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer text-center ${
                  outputBackground === 'blur'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bokeh
              </button>
            </div>

            {/* Solid Colors */}
            {outputBackground === 'color' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {STUDIO_SOLID_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSelectedSolidColor(c.hex)}
                      className={`w-7 h-7 rounded-xl border transition-transform cursor-pointer ${
                        selectedSolidColor === c.hex ? 'scale-110 ring-2 ring-blue-500' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                  {/* Custom color input */}
                  <input
                    type="color"
                    value={selectedSolidColor}
                    onChange={(e) => setSelectedSolidColor(e.target.value)}
                    className="w-7 h-7 rounded-xl border border-slate-300 cursor-pointer overflow-hidden p-0"
                    title="Custom Color"
                  />
                </div>
              </div>
            )}

            {/* Gradients */}
            {outputBackground === 'gradient' && (
              <div className="grid grid-cols-3 gap-2">
                {STUDIO_GRADIENTS.map((g, idx) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => setSelectedGradientIdx(idx)}
                    className={`h-9 rounded-xl border transition-all cursor-pointer ${
                      selectedGradientIdx === idx ? 'ring-2 ring-blue-500 scale-105' : 'hover:scale-102'
                    }`}
                    style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                    title={g.name}
                  />
                ))}
              </div>
            )}

            {/* Blur Slider */}
            {outputBackground === 'blur' && (
              <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">DSLR Bokeh Blur</span>
                  <span className="font-mono text-slate-500">{blurAmount}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="30"
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Download Buttons */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => handleDownload('png')}
            className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Transparent PNG</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownload('jpg')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Save as High-Res JPG</span>
          </button>
        </div>
      </div>

      {/* RIGHT: INTERACTIVE PREVIEW & SLIDER CANVAS */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
        {/* Top View Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* View Mode Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setViewMode('split');
                if (cutoutCanvasRef.current && originalCanvasRef.current) {
                  renderToDisplay(cutoutCanvasRef.current, originalCanvasRef.current);
                }
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Before / After Split</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('cutout_only');
                if (cutoutCanvasRef.current && originalCanvasRef.current) {
                  renderToDisplay(cutoutCanvasRef.current, originalCanvasRef.current);
                }
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'cutout_only' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Result Cutout</span>
            </button>
          </div>

          {/* Multiple Image switcher */}
          {images.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImageId(img.id)}
                  className={`w-8 h-8 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    img.id === activeImage.id ? 'border-blue-600 scale-105' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-slate-500 w-12 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas Display Viewport (Checkerboard Transparent Pattern) */}
        <div
          className="relative flex-1 min-h-[380px] sm:min-h-[500px] flex items-center justify-center overflow-hidden my-4 rounded-2xl select-none"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
          onMouseMove={(e) => {
            if (isDraggingSlider.current) {
              handleSliderMove(e.clientX);
            }
          }}
          onMouseUp={() => {
            isDraggingSlider.current = false;
          }}
          onTouchMove={(e) => {
            if (isDraggingSlider.current && e.touches[0]) {
              handleSliderMove(e.touches[0].clientX);
            }
          }}
          onTouchEnd={() => {
            isDraggingSlider.current = false;
          }}
        >
          {isProcessing && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center z-30">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-xs font-bold text-slate-700">Removing Background...</span>
            </div>
          )}

          {/* Interactive Canvas */}
          <div
            className="relative transition-transform duration-75 max-w-full max-h-full flex items-center justify-center"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <canvas
              ref={previewCanvasRef}
              className={`max-w-full max-h-[500px] object-contain rounded-xl shadow-lg ${
                activeTool === 'eyedropper'
                  ? 'cursor-crosshair'
                  : activeTool === 'eraser' || activeTool === 'restore'
                  ? 'cursor-cell'
                  : 'cursor-default'
              }`}
              onMouseDown={(e) => {
                if (activeTool === 'eyedropper' || activeTool === 'eraser' || activeTool === 'restore') {
                  handleCanvasInteraction(e);
                  setIsBrushPainting(true);
                }
              }}
              onMouseMove={(e) => {
                if (isBrushPainting && (activeTool === 'eraser' || activeTool === 'restore')) {
                  handleCanvasInteraction(e);
                }
              }}
              onMouseUp={() => setIsBrushPainting(false)}
            />

            {/* Split Slider Handle (Draggable) */}
            {viewMode === 'split' && (
              <div
                className="absolute top-0 bottom-0 z-20 flex items-center justify-center cursor-ew-resize group"
                style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  isDraggingSlider.current = true;
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  isDraggingSlider.current = true;
                }}
              >
                <div className="w-8 h-8 rounded-full bg-white shadow-lg border-2 border-blue-600 flex items-center justify-center text-blue-600 text-xs font-bold group-hover:scale-110 transition-transform">
                  ↔
                </div>
              </div>
            )}
          </div>

          {/* View Badges */}
          {viewMode === 'split' && (
            <>
              <span className="absolute top-4 left-4 z-10 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-slate-900/80 text-white backdrop-blur-xs">
                Before (Original)
              </span>
              <span className="absolute top-4 right-4 z-10 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-600/90 text-white backdrop-blur-xs">
                After (Cutout)
              </span>
            </>
          )}
        </div>

        {/* Bottom Status & Security Assurance */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% In-Browser Edge Processing • Private & Safe</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Original Dimensions: {activeImage.width} × {activeImage.height} px
          </span>
        </div>
      </div>
    </div>
  );
};
