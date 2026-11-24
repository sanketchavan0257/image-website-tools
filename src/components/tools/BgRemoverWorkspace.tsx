import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useImageStore } from '../../store/useImageStore';
import { downloadFile } from '../../services/zipExport';
import {
  generateAISubjectMask,
  applyAlphaMaskToCanvas,
  removeBackgroundCanvas,
  removeConnectedColorAtPoint,
  composeOutputBackground,
  prewarmBgRemovalAI,
  STUDIO_GRADIENTS,
  STUDIO_SOLID_COLORS,
  BgRemovalOptions,
} from '../../services/bgRemovalEngine';
import {
  Sparkles,
  Download,
  RotateCcw,
  Eye,
  Eraser,
  Paintbrush,
  Pipette,
  ZoomIn,
  ZoomOut,
  Split,
  ShieldCheck,
  Undo2,
  AlertCircle,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';

export const BgRemoverWorkspace: React.FC = () => {
  const { images, selectedImageId, setSelectedImageId } = useImageStore();

  const activeImage =
    images.find((img) => img.id === selectedImageId) || images[0] || null;

  // Segmentation Engine Mode: 'ai' (default: real subject AI for people/friends/objects) or 'color_flood' (solid backdrop)
  const [cutoutEngine, setCutoutEngine] = useState<'ai' | 'color_flood'>('ai');

  // Tuning States
  const [edgeRefine, setEdgeRefine] = useState<number>(0); // -30 to +40
  const [tolerance, setTolerance] = useState<number>(28); // 5 to 85 (used for Pocket Eraser & Solid BG Mode)
  const [feather, setFeather] = useState<number>(0); // 0 to 8 px
  const [activeTool, setActiveTool] = useState<'auto' | 'eyedropper' | 'eraser' | 'restore'>('auto');
  const [brushSize, setBrushSize] = useState<number>(25);

  // Background Fill Type
  const [outputBackground, setOutputBackground] = useState<'transparent' | 'color' | 'gradient' | 'blur'>('transparent');
  const [selectedSolidColor, setSelectedSolidColor] = useState<string>('#ffffff');
  const [selectedGradientIdx, setSelectedGradientIdx] = useState<number>(0);
  const [blurAmount, setBlurAmount] = useState<number>(12);

  // View Mode: direct 'cutout_only' (like remove.bg) or optional 'split' comparison
  const [viewMode, setViewMode] = useState<'split' | 'cutout_only'>('cutout_only');
  const [sliderPos, setSliderPos] = useState<number>(50);
  const isDraggingSlider = useRef(false);

  // Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Canvases & AI Mask Cache
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiMaskCacheRef = useRef<Map<string, Uint8ClampedArray>>(new Map());
  const undoStackRef = useRef<ImageData[]>([]);
  const activeLoadTokenRef = useRef<number>(0);

  // Status States
  const [canUndo, setCanUndo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('Removing Background...');
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [isBrushPainting, setIsBrushPainting] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const lastBrushPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    prewarmBgRemovalAI();
  }, []);

  const getCurrentOptions = useCallback(
    (overrideBg?: BgRemovalOptions['outputBackground']): BgRemovalOptions => ({
      tolerance,
      feather,
      edgeRefine,
      outputBackground: overrideBg || outputBackground,
      backgroundColor: selectedSolidColor,
      gradientIndex: selectedGradientIdx,
      blurAmount,
    }),
    [tolerance, feather, edgeRefine, outputBackground, selectedSolidColor, selectedGradientIdx, blurAmount]
  );

  // Render composed result onto preview canvas
  const renderToDisplay = useCallback(
    (cutoutCanvas: HTMLCanvasElement, origCanvas: HTMLCanvasElement) => {
      const displayCanvas = previewCanvasRef.current;
      if (!displayCanvas) return;

      const composed = composeOutputBackground(cutoutCanvas, origCanvas, getCurrentOptions());

      if (displayCanvas.width !== origCanvas.width || displayCanvas.height !== origCanvas.height) {
        displayCanvas.width = origCanvas.width;
        displayCanvas.height = origCanvas.height;
      }
      const ctx = displayCanvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);

      if (viewMode === 'cutout_only') {
        ctx.drawImage(composed, 0, 0);
      } else {
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
        ctx.drawImage(composed, 0, 0);
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
    },
    [getCurrentOptions, viewMode, sliderPos]
  );

  const renderToDisplayRef = useRef(renderToDisplay);
  useEffect(() => {
    renderToDisplayRef.current = renderToDisplay;
  }, [renderToDisplay]);

  const pushUndoSnapshot = useCallback(() => {
    const cutout = cutoutCanvasRef.current;
    if (!cutout) return;
    const ctx = cutout.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, cutout.width, cutout.height);
    undoStackRef.current = [...undoStackRef.current.slice(-14), snap];
    setCanUndo(true);
  }, []);

  const handleUndo = () => {
    const cutout = cutoutCanvasRef.current;
    const orig = originalCanvasRef.current;
    if (!cutout || !orig || undoStackRef.current.length === 0) return;
    const lastSnap = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);
    const ctx = cutout.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.putImageData(lastSnap, 0, 0);
      renderToDisplay(cutout, orig);
    }
  };

  // Render original image immediately onto preview canvas before AI starts
  const drawImmediateOriginalPreview = useCallback((origCanvas: HTMLCanvasElement) => {
    const displayCanvas = previewCanvasRef.current;
    if (!displayCanvas) return;
    if (displayCanvas.width !== origCanvas.width || displayCanvas.height !== origCanvas.height) {
      displayCanvas.width = origCanvas.width;
      displayCanvas.height = origCanvas.height;
    }
    const ctx = displayCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
      ctx.drawImage(origCanvas, 0, 0);
    }
  }, []);

  // Run AI or Color-Flood Background Removal for active image
  const executeSegmentation = useCallback(
    async (forceRecomputeAI = false) => {
      const orig = originalCanvasRef.current;
      if (!orig || !activeImage) return;

      const token = ++activeLoadTokenRef.current;
      setAiWarning(null);
      undoStackRef.current = [];
      setCanUndo(false);

      if (cutoutEngine === 'ai') {
        const cachedMask = !forceRecomputeAI ? aiMaskCacheRef.current.get(activeImage.id) : undefined;
        if (cachedMask) {
          const cutout = applyAlphaMaskToCanvas(orig, cachedMask, { edgeRefine, feather });
          cutoutCanvasRef.current = cutout;
          renderToDisplay(cutout, orig);
          setIsProcessing(false);
          setProgressPct(null);
          return;
        }

        setIsProcessing(true);
        setProgressText('Detecting Subjects & Removing Background...');
        setProgressPct(12);

        try {
          // Yield 1 frame so React paints the visible photo + non-blocking indicator first
          await new Promise<void>((r) => window.requestAnimationFrame(() => r()));
          if (activeLoadTokenRef.current !== token) return;

          const mask = await generateAISubjectMask(orig, (stageLabel, pct) => {
            if (activeLoadTokenRef.current !== token) return;
            setProgressText(stageLabel);
            setProgressPct(pct);
          });

          if (activeLoadTokenRef.current !== token) return;

          aiMaskCacheRef.current.set(activeImage.id, mask);
          const cutout = applyAlphaMaskToCanvas(orig, mask, { edgeRefine, feather });
          cutoutCanvasRef.current = cutout;
          renderToDisplayRef.current(cutout, orig);
        } catch (err) {
          if (activeLoadTokenRef.current !== token) return;
          console.warn('[BgRemoverWorkspace] AI fallback triggered:', err);
          setAiWarning(
            'AI मॉडेल लोड होऊ शकले नाही. तात्पुरते Color Cutout वापरले आहे — पुन्हा Auto View दाबून प्रयत्न करा.'
          );
          const fallbackCutout = removeBackgroundCanvas(orig, getCurrentOptions());
          cutoutCanvasRef.current = fallbackCutout;
          renderToDisplayRef.current(fallbackCutout, orig);
        } finally {
          if (activeLoadTokenRef.current === token) {
            setIsProcessing(false);
            setProgressPct(null);
          }
        }
      } else {
        setIsProcessing(true);
        setProgressText('Removing Solid Background...');
        setProgressPct(null);
        window.setTimeout(() => {
          if (activeLoadTokenRef.current !== token) return;
          const cutout = removeBackgroundCanvas(orig, getCurrentOptions());
          cutoutCanvasRef.current = cutout;
          renderToDisplay(cutout, orig);
          setIsProcessing(false);
        }, 15);
      }
    },
    [activeImage?.id, cutoutEngine, renderToDisplay, edgeRefine, feather, getCurrentOptions]
  );

  // Load active image into originalCanvas and immediately display photo before running AI segmentation
  useEffect(() => {
    if (!activeImage) return;

    const token = ++activeLoadTokenRef.current;
    setAiWarning(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (activeLoadTokenRef.current !== token) return;
      const origCanvas = document.createElement('canvas');
      origCanvas.width = img.naturalWidth || img.width;
      origCanvas.height = img.naturalHeight || img.height;
      const ctx = origCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        originalCanvasRef.current = origCanvas;
        // Initialize cutout with original image and render immediately so image opens at 0ms!
        const initialCutout = document.createElement('canvas');
        initialCutout.width = origCanvas.width;
        initialCutout.height = origCanvas.height;
        const cCtx = initialCutout.getContext('2d', { willReadFrequently: true });
        cCtx?.drawImage(origCanvas, 0, 0);
        cutoutCanvasRef.current = initialCutout;
        drawImmediateOriginalPreview(origCanvas);

        executeSegmentation(false);
      }
    };
    img.onerror = () => {
      if (activeLoadTokenRef.current !== token) return;
      setIsProcessing(false);
      setProgressPct(null);
      setAiWarning('फोटो लोड करता आला नाही. कृपया पुन्हा अपलोड करा.');
    };
    img.src = activeImage.url;
  }, [activeImage?.id, activeImage?.url, cutoutEngine, drawImmediateOriginalPreview]);

  // Fast instant AI edge refinement when edgeRefine or feather changes (never resets on pocket tolerance slider)
  useEffect(() => {
    const orig = originalCanvasRef.current;
    if (!orig || !activeImage || isProcessing || cutoutEngine !== 'ai') return;

    const cachedMask = aiMaskCacheRef.current.get(activeImage.id);
    if (cachedMask) {
      const cutout = applyAlphaMaskToCanvas(orig, cachedMask, { edgeRefine, feather });
      cutoutCanvasRef.current = cutout;
      undoStackRef.current = [];
      setCanUndo(false);
      renderToDisplay(cutout, orig);
    }
  }, [edgeRefine, feather, cutoutEngine]);

  // Fast color-flood update when tolerance or feather changes in Solid Color BG mode
  useEffect(() => {
    const orig = originalCanvasRef.current;
    if (!orig || !activeImage || isProcessing || cutoutEngine !== 'color_flood') return;

    const cutout = removeBackgroundCanvas(orig, getCurrentOptions());
    cutoutCanvasRef.current = cutout;
    renderToDisplay(cutout, orig);
  }, [tolerance, feather, cutoutEngine]);

  // Instant re-render when background replacement or split slider/viewMode changes (preserves brush edits!)
  useEffect(() => {
    const orig = originalCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    if (orig && cutout) {
      renderToDisplay(cutout, orig);
    }
  }, [outputBackground, selectedSolidColor, selectedGradientIdx, blurAmount, viewMode, sliderPos, renderToDisplay]);

  // Paint brush stroke smoothly between two points
  const applyBrushAt = (
    cutout: HTMLCanvasElement,
    orig: HTMLCanvasElement,
    x: number,
    y: number,
    prevPoint: { x: number; y: number } | null,
    scaleX: number
  ) => {
    const cutoutCtx = cutout.getContext('2d', { willReadFrequently: true });
    if (!cutoutCtx) return;

    const radius = Math.max(2, brushSize * scaleX);
    const startX = prevPoint ? prevPoint.x : x;
    const startY = prevPoint ? prevPoint.y : y;
    const dist = Math.hypot(x - startX, y - startY);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.3)));

    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 1 : s / steps;
      const px = Math.round(startX + (x - startX) * t);
      const py = Math.round(startY + (y - startY) * t);

      if (activeTool === 'eraser') {
        cutoutCtx.save();
        cutoutCtx.globalCompositeOperation = 'destination-out';
        cutoutCtx.beginPath();
        cutoutCtx.arc(px, py, radius, 0, Math.PI * 2);
        cutoutCtx.fill();
        cutoutCtx.restore();
      } else if (activeTool === 'restore') {
        cutoutCtx.save();
        cutoutCtx.beginPath();
        cutoutCtx.arc(px, py, radius, 0, Math.PI * 2);
        cutoutCtx.clip();
        cutoutCtx.drawImage(orig, 0, 0);
        cutoutCtx.restore();
      }
    }
  };

  // Pointer Down / Move for Pocket Eraser & Brushes (works on both mouse and touch)
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(canvas.width - 1, Math.round((clientX - rect.left) * scaleX))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.round((clientY - rect.top) * scaleY))),
      scaleX,
    };
  };

  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const orig = originalCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    if (!orig || !cutout) return;
    if (activeTool === 'auto') return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (activeTool === 'eyedropper') {
      pushUndoSnapshot();
      removeConnectedColorAtPoint(cutout, coords.x, coords.y, tolerance, feather);
      renderToDisplay(cutout, orig);
      return;
    }

    if (activeTool === 'eraser' || activeTool === 'restore') {
      e.currentTarget.setPointerCapture(e.pointerId);
      pushUndoSnapshot();
      setIsBrushPainting(true);
      lastBrushPointRef.current = { x: coords.x, y: coords.y };
      applyBrushAt(cutout, orig, coords.x, coords.y, null, coords.scaleX);
      renderToDisplay(cutout, orig);
    }
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isBrushPainting || (activeTool !== 'eraser' && activeTool !== 'restore')) return;
    const orig = originalCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    if (!orig || !cutout) return;

    const coords = getCanvasCoords(e.clientX, e.clientY);
    if (!coords) return;

    applyBrushAt(cutout, orig, coords.x, coords.y, lastBrushPointRef.current, coords.scaleX);
    lastBrushPointRef.current = { x: coords.x, y: coords.y };
    renderToDisplay(cutout, orig);
  };

  const handlePointerUpCanvas = () => {
    setIsBrushPainting(false);
    lastBrushPointRef.current = null;
  };

  // Slider Mouse Move / Touch
  const handleSliderMove = (clientX: number) => {
    const container = previewCanvasRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));
    setSliderPos(pct);
  };

  // Download Output Cutout
  const handleDownload = (format: 'png' | 'jpg') => {
    const orig = originalCanvasRef.current;
    const cutout = cutoutCanvasRef.current;
    if (!orig || !cutout) return;

    const finalOptions = getCurrentOptions(
      format === 'jpg' && outputBackground === 'transparent' ? 'color' : outputBackground
    );

    const finalCanvas = composeOutputBackground(cutout, orig, finalOptions);
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    finalCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const baseName = activeImage?.name.replace(/\.[^/.]+$/, '') || 'image';
        downloadFile(blob, `${baseName}-no-bg.${ext}`);
      },
      mimeType,
      format === 'png' ? 1.0 : 0.98
    );
  };

  // Reset to clean AI Auto defaults
  const handleReset = () => {
    setCutoutEngine('ai');
    setEdgeRefine(0);
    setTolerance(28);
    setFeather(0);
    setActiveTool('auto');
    setViewMode('cutout_only');
    setOutputBackground('transparent');
    setSliderPos(50);
    setZoomLevel(1);
    undoStackRef.current = [];
    setCanUndo(false);

    const orig = originalCanvasRef.current;
    if (orig && activeImage) {
      const cachedMask = aiMaskCacheRef.current.get(activeImage.id);
      if (cachedMask) {
        const cutout = applyAlphaMaskToCanvas(orig, cachedMask, { edgeRefine: 0, feather: 0 });
        cutoutCanvasRef.current = cutout;
        renderToDisplay(cutout, orig);
      } else {
        executeSegmentation(false);
      }
    }
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
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Background Remover</h3>
                <span className="text-[11px] text-slate-500">Smart AI HD Subject Cutout</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canUndo && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="px-2 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Undo last brush / pocket edit"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Reset Settings"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {aiWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{aiWarning}</span>
            </div>
          )}

          {/* Direct AI Cutout Status */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-900">Auto HD Cutout</div>
                <div className="text-[11px] text-slate-500 truncate">
                  Direct full subject extraction
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => executeSegmentation(true)}
              disabled={isProcessing}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-50"
            >
              Re-cut
            </button>
          </div>

          {/* Background Replacement Options */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              New Background
            </label>

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

          {/* Collapsible Manual Touch-Up & Fine Tuning */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedTools((prev) => !prev)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Manual Touch-Up &amp; Fine Tuning</span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  showAdvancedTools ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showAdvancedTools && (
              <div className="p-3.5 space-y-4 bg-white border-t border-slate-200">
                {/* Engine Mode */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Cutout Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setCutoutEngine('ai')}
                      className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                        cutoutEngine === 'ai'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      AI Full Subject
                    </button>
                    <button
                      type="button"
                      onClick={() => setCutoutEngine('color_flood')}
                      className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                        cutoutEngine === 'color_flood'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Solid Color BG
                    </button>
                  </div>
                </div>

                {/* Touch-up Tools */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                    Interactive Canvas Tools
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setActiveTool('auto')}
                      className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'auto'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Auto View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('eyedropper')}
                      className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'eyedropper'
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Pipette className="w-3.5 h-3.5" />
                      <span>Pocket Eraser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('eraser')}
                      className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'eraser'
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>Magic Eraser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool('restore')}
                      className={`py-2 px-2.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer ${
                        activeTool === 'restore'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      <span>Restore Brush</span>
                    </button>
                  </div>
                </div>

                {/* Brush Size when brush tool active */}
                {(activeTool === 'eraser' || activeTool === 'restore') && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Brush Size</span>
                      <span className="font-mono text-slate-500">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="80"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                )}

                {/* Edge Cleanliness & Softness */}
                {cutoutEngine === 'ai' ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Edge Tightness</span>
                      <span className="font-mono text-slate-500">{edgeRefine}</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="40"
                      value={edgeRefine}
                      onChange={(e) => setEdgeRefine(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Color Tolerance</span>
                      <span className="font-mono text-slate-500">{tolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="85"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                )}

                {activeTool === 'eyedropper' && cutoutEngine === 'ai' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Pocket Tolerance</span>
                      <span className="font-mono text-slate-500">{tolerance}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="85"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Edge Softness</span>
                    <span className="font-mono text-slate-500">{feather}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    value={feather}
                    onChange={(e) => setFeather(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Download Buttons */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleDownload('png')}
            className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Transparent PNG</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleDownload('jpg')}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Save as High-Res JPG</span>
          </button>
        </div>
      </div>

      {/* RIGHT: INTERACTIVE PREVIEW & SLIDER CANVAS */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
        {/* Top View Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('cutout_only')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'cutout_only' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Result Cutout</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Before / After Split</span>
            </button>
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {images.map((img) => (
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

        {/* Canvas Display Viewport */}
        <div
          className="relative flex-1 min-h-[380px] sm:min-h-[500px] flex items-center justify-center overflow-hidden my-4 rounded-2xl select-none"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
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
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm border border-blue-200 shadow-lg rounded-xl px-4 py-2.5 flex items-center gap-3 max-w-[90%]">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">{progressText}</div>
                {progressPct !== null && (
                  <div className="w-40 h-1 bg-slate-200 rounded-sm overflow-hidden mt-1">
                    <div
                      className="h-full bg-blue-600 transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interactive Canvas */}
          <div
            className="relative transition-transform duration-75 max-w-full max-h-full flex items-center justify-center"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <canvas
              ref={previewCanvasRef}
              className={`max-w-full max-h-[500px] object-contain rounded-xl touch-none ${
                outputBackground === 'transparent' ? '' : 'shadow-lg'
              } ${
                activeTool === 'eyedropper'
                  ? 'cursor-crosshair'
                  : activeTool === 'eraser' || activeTool === 'restore'
                  ? 'cursor-cell'
                  : 'cursor-default'
              }`}
              onPointerDown={handlePointerDownCanvas}
              onPointerMove={handlePointerMoveCanvas}
              onPointerUp={handlePointerUpCanvas}
              onPointerCancel={handlePointerUpCanvas}
            />

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
            <span>Subject Protection Active • Main Image 100% Untouched (Only BG Removed)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Original Dimensions: {activeImage.width} × {activeImage.height} px
          </span>
        </div>
      </div>
    </div>
  );
};
