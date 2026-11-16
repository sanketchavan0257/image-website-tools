import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useImageStore } from '../../store/useImageStore';
import {
  Pipette,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Copy,
  Check,
  Crosshair,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  createPickedColor,
  createPickedColorFromHex,
  extractDominantColorsFromImage,
} from '../../services/colorUtils';
import { PickedColorInfo } from '../../types';

export const ImageColorPickerWorkspace: React.FC = () => {
  const {
    images,
    selectedImageId,
    setSelectedImageId,
    pickedColor,
    setPickedColor,
    addColorToHistory,
  } = useImageStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active image
  const activeIndex = images.findIndex((img) => img.id === selectedImageId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeImage = images[currentIndex] || images[0];

  // Zoom and Pan state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [hoverColor, setHoverColor] = useState<PickedColorInfo | null>(null);
  const [cursorPos, setCursorPos] = useState<{ clientX: number; clientY: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pickAnimationPos, setPickAnimationPos] = useState<{ x: number; y: number } | null>(null);

  // Check if native EyeDropper API is supported in this browser
  const isEyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;

  // Offscreen canvas for accurate pixel extraction
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize and load image onto canvas
  useEffect(() => {
    if (!activeImage) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // 1. Setup offscreen canvas at full original resolution
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.naturalWidth || activeImage.width || 800;
      offCanvas.height = img.naturalHeight || activeImage.height || 600;
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
        offscreenCanvasRef.current = offCanvas;
        offscreenCtxRef.current = offCtx;

        // Auto extract dominant palette if no color is picked yet
        if (!pickedColor) {
          const dominant = extractDominantColorsFromImage(img, 6);
          if (dominant.length > 0) {
            setPickedColor(dominant[0]);
          }
        }
      }

      // 2. Setup display canvas
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = offCanvas.width;
      canvas.height = offCanvas.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };

    img.src = activeImage.cropPreviewUrl || activeImage.url;
  }, [activeImage]);

  // Handle Zoom In / Out / Reset
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  // Convert client cursor position to image pixel coordinates
  const getPixelCoordinates = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      if (clientX < 0 || clientY < 0 || clientX > rect.width || clientY > rect.height) {
        return null;
      }

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = Math.floor(clientX * scaleX);
      const y = Math.floor(clientY * scaleY);

      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        return null;
      }

      return { x, y, clientX: e.clientX, clientY: e.clientY };
    },
    []
  );

  // Update Loupe Magnifier canvas
  const updateLoupe = useCallback(
    (pixelX: number, pixelY: number) => {
      const offCtx = offscreenCtxRef.current;
      const loupeCanvas = loupeCanvasRef.current;
      if (!offCtx || !loupeCanvas) return;

      const loupeCtx = loupeCanvas.getContext('2d');
      if (!loupeCtx) return;

      const sampleRadius = 5; // 11x11 sample box
      const sampleSize = sampleRadius * 2 + 1;
      loupeCtx.imageSmoothingEnabled = false;

      // Clear loupe
      loupeCtx.clearRect(0, 0, loupeCanvas.width, loupeCanvas.height);

      // Draw magnified pixels
      loupeCtx.drawImage(
        offscreenCanvasRef.current!,
        pixelX - sampleRadius,
        pixelY - sampleRadius,
        sampleSize,
        sampleSize,
        0,
        0,
        loupeCanvas.width,
        loupeCanvas.height
      );

      // Draw pixel grid lines
      const step = loupeCanvas.width / sampleSize;
      loupeCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      loupeCtx.lineWidth = 1;
      for (let i = 0; i <= sampleSize; i++) {
        loupeCtx.beginPath();
        loupeCtx.moveTo(i * step, 0);
        loupeCtx.lineTo(i * step, loupeCanvas.height);
        loupeCtx.stroke();

        loupeCtx.beginPath();
        loupeCtx.moveTo(0, i * step);
        loupeCtx.lineTo(loupeCanvas.width, i * step);
        loupeCtx.stroke();
      }

      // Draw Center Reticle / Target Box
      const centerBoxX = sampleRadius * step;
      const centerBoxY = sampleRadius * step;
      loupeCtx.strokeStyle = '#ef4444'; // Red outer indicator
      loupeCtx.lineWidth = 2;
      loupeCtx.strokeRect(centerBoxX, centerBoxY, step, step);

      loupeCtx.strokeStyle = '#ffffff'; // White inner border
      loupeCtx.lineWidth = 1;
      loupeCtx.strokeRect(centerBoxX + 1, centerBoxY + 1, step - 2, step - 2);
    },
    []
  );

  // Mouse Move over Canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoordinates(e);
    if (!coords) {
      setIsHovering(false);
      return;
    }

    const { x, y, clientX, clientY } = coords;
    const offCtx = offscreenCtxRef.current;
    if (!offCtx) return;

    try {
      const pixel = offCtx.getImageData(x, y, 1, 1).data;
      const color = createPickedColor(pixel[0], pixel[1], pixel[2], pixel[3] / 255, x, y);
      setHoverColor(color);
      setIsHovering(true);
      setCursorPos({ clientX, clientY });
      updateLoupe(x, y);
    } catch {
      // Ignore reading errors if outside bounds
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // Click on Canvas to Pick Color
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getPixelCoordinates(e);
    if (!coords) return;

    const { x, y } = coords;
    const offCtx = offscreenCtxRef.current;
    if (!offCtx) return;

    const pixel = offCtx.getImageData(x, y, 1, 1).data;
    const color = createPickedColor(pixel[0], pixel[1], pixel[2], pixel[3] / 255, x, y);
    
    setPickedColor(color);
    addColorToHistory(color);

    // Trigger visual pick ripple
    setPickAnimationPos({ x: coords.clientX, y: coords.clientY });
    setTimeout(() => setPickAnimationPos(null), 600);
  };

  // Screen Eyedropper API
  const handleOpenEyeDropper = async () => {
    if (!isEyeDropperSupported) return;
    try {
      // @ts-ignore
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      if (result && result.sRGBHex) {
        const color = createPickedColorFromHex(result.sRGBHex);
        setPickedColor(color);
        addColorToHistory(color);
      }
    } catch (err) {
      // User cancelled picker
    }
  };

  // Copy Color Code
  const copyColor = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Loupe positioning relative to container
  const getLoupeStyle = () => {
    if (!cursorPos || !containerRef.current) return { display: 'none' };
    const containerRect = containerRef.current.getBoundingClientRect();
    const relX = cursorPos.clientX - containerRect.left;
    const relY = cursorPos.clientY - containerRect.top;

    // Default: position loupe 30px to top-right of cursor
    let loupeLeft = relX + 24;
    let loupeTop = relY - 140;

    // Avoid overflowing right container edge
    if (loupeLeft + 140 > containerRect.width) {
      loupeLeft = relX - 160;
    }

    // Avoid overflowing top container edge
    if (loupeTop < 10) {
      loupeTop = relY + 30;
    }

    return {
      left: `${loupeLeft}px`,
      top: `${loupeTop}px`,
    };
  };

  const displayColor = isHovering && hoverColor ? hoverColor : pickedColor;

  return (
    <div className="space-y-4">
      {/* Multi-Image Switcher Banner (if images.length > 1) */}
      {images.length > 1 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 text-xs overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-800">Switch Photo to Sample:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {images.map((img, idx) => {
              const isSelected = img.id === activeImage.id;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImageId(img.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-xs shrink-0 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-bold ring-2 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <img
                    src={img.cropPreviewUrl || img.url}
                    alt=""
                    className="w-5 h-5 rounded object-cover border border-slate-200"
                  />
                  <span className="truncate max-w-[100px]">{img.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Interactive Canvas Card */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col select-none"
      >
        {/* Workspace Top Bar: Tools, Zoom controls, and Screen EyeDropper */}
        <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <div className="p-1.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Pipette className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 block">Interactive Pixel Eyedropper</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Hover to magnify 11× pixels, click to capture exact color
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Screen Eyedropper API Button */}
            {isEyeDropperSupported && (
              <button
                type="button"
                onClick={handleOpenEyeDropper}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200/80 flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                title="Pick any color from your screen using native Eyedropper"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sample Screen Color</span>
              </button>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 0.5}
                className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] font-bold text-slate-700 min-w-[42px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border-l border-slate-200 ml-0.5"
                title="Reset zoom to 100%"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Viewport Area with Checkerboard Background */}
        <div className="relative min-h-[460px] max-h-[640px] overflow-auto bg-slate-100 flex items-center justify-center p-4">
          <div
            className="checkerboard-bg shadow-lg rounded-xl overflow-hidden transition-transform duration-75 relative"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleCanvasClick}
              className="block max-w-full h-auto cursor-crosshair"
              style={{
                imageRendering: zoomLevel > 1 ? 'pixelated' : 'auto',
              }}
            />
          </div>

          {/* Floating Zoom Magnifier Loupe */}
          {isHovering && hoverColor && (
            <div
              className="absolute pointer-events-none z-30 flex flex-col items-center drop-shadow-xl animate-in fade-in zoom-in-95 duration-100"
              style={getLoupeStyle()}
            >
              {/* Loupe Circle Frame */}
              <div
                className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-2xl relative bg-slate-900"
                style={{
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0,0,0,0.1)',
                }}
              >
                <canvas
                  ref={loupeCanvasRef}
                  width={112}
                  height={112}
                  className="w-full h-full block"
                />

                {/* Corner Color Preview Badge inside Loupe */}
                <div
                  className="absolute bottom-1 right-1 w-6 h-6 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: hoverColor.hex }}
                />
              </div>

              {/* Readout tag under loupe */}
              <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-mono font-bold flex items-center gap-1.5 border border-white/20 shadow-md">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block border border-white/50"
                  style={{ backgroundColor: hoverColor.hex }}
                />
                <span>{hoverColor.hex}</span>
                {hoverColor.x !== undefined && hoverColor.y !== undefined && (
                  <span className="text-slate-400 text-[10px] font-sans font-normal">
                    ({hoverColor.x}, {hoverColor.y})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Pick Animation Ripple */}
          {pickAnimationPos && (
            <div
              className="fixed pointer-events-none z-50 w-10 h-10 -ml-5 -mt-5 rounded-full border-4 border-blue-500 animate-ping opacity-75"
              style={{ left: pickAnimationPos.x, top: pickAnimationPos.y }}
            />
          )}
        </div>

        {/* Quick Readout & Copy Banner at Bottom */}
        <div className="p-4 bg-white border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          {displayColor ? (
            <div className="flex flex-wrap items-center gap-3">
              {/* Swatch Pill */}
              <div
                className="w-12 h-12 rounded-2xl shadow-inner border-2 border-slate-200/80 shrink-0 relative flex items-center justify-center"
                style={{ backgroundColor: displayColor.hex }}
              >
                <Crosshair className="w-4 h-4 text-white drop-shadow-md opacity-80" />
              </div>

              {/* Codes row */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {isHovering ? 'Hovering Color' : 'Selected Pixel Color'}
                  </span>
                  {displayColor.x !== undefined && displayColor.y !== undefined && (
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-mono">
                      X: {displayColor.x}px, Y: {displayColor.y}px
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* HEX button */}
                  <button
                    type="button"
                    onClick={() => copyColor(displayColor.hex, 'hex')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                  >
                    <span>{displayColor.hex}</span>
                    {copiedKey === 'hex' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>

                  {/* RGB button */}
                  <button
                    type="button"
                    onClick={() => copyColor(displayColor.rgb, 'rgb')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 font-mono text-xs text-slate-700 transition-colors cursor-pointer"
                  >
                    <span>{displayColor.rgb}</span>
                    {copiedKey === 'rgb' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>

                  {/* HSL button */}
                  <button
                    type="button"
                    onClick={() => copyColor(displayColor.hsl, 'hsl')}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 font-mono text-xs text-slate-700 transition-colors cursor-pointer"
                  >
                    <span>{displayColor.hsl}</span>
                    {copiedKey === 'hsl' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 flex items-center gap-2">
              <Pipette className="w-4 h-4 text-blue-600" />
              <span>Hover over photo and click any pixel to sample its color code.</span>
            </div>
          )}

          {/* Quick instructions badge */}
          <div className="text-[11px] text-slate-400 hidden lg:block text-right">
            Click photo to store in Color History list
          </div>
        </div>
      </div>
    </div>
  );
};
