import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImageFileItem } from '../../types';
import {
  X,
  Check,
  Scissors,
  Maximize2,
  AlignCenter,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface CropModalProps {
  item: ImageFileItem | null;
  onClose: () => void;
  onApplyCrop: (
    itemId: string,
    cropData: { x: number; y: number; width: number; height: number },
    previewUrl?: string
  ) => void;
  initialAspectRatio?: number | null;
}

type DragMode = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

const ASPECT_RATIOS = [
  { label: 'Free', val: null },
  { label: '1:1 Square', val: 1 },
  { label: '16:9 YouTube', val: 16 / 9 },
  { label: '9:16 Reel / Story', val: 9 / 16 },
  { label: '4:3 Standard', val: 4 / 3 },
  { label: '3:2 Classic', val: 3 / 2 },
  { label: '2:3 Portrait', val: 2 / 3 },
  { label: '3.5:4.5 Passport/PAN', val: 3.5 / 4.5 },
];

export const CropModal: React.FC<CropModalProps> = ({
  item,
  onClose,
  onApplyCrop,
  initialAspectRatio = null,
}) => {
  if (!item) return null;

  const [aspectRatio, setAspectRatio] = useState<number | null>(initialAspectRatio);
  // Display dimensions of the image inside the modal
  const [displaySize, setDisplaySize] = useState({ width: 600, height: 400 });
  // Crop box in display pixels (relative to displaySize)
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 400, height: 300 });

  const [isDragging, setIsDragging] = useState(false);
  const dragModeRef = useRef<DragMode | null>(null);
  const dragStartRef = useRef({
    clientX: 0,
    clientY: 0,
    boxX: 0,
    boxY: 0,
    boxW: 0,
    boxH: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize display size & crop box when item changes
  useEffect(() => {
    if (!item) return;

    const imgW = item.width || 800;
    const imgH = item.height || 600;

    // Available viewport sizing
    const maxW = Math.min(window.innerWidth - 48, 760);
    const maxH = Math.min(window.innerHeight - 260, 480);

    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    const dispW = Math.max(120, Math.round(imgW * scale));
    const dispH = Math.max(90, Math.round(imgH * scale));

    setDisplaySize({ width: dispW, height: dispH });

    if (item.cropData) {
      // Map existing cropData (real pixels) to display pixels
      const scaleX = dispW / imgW;
      const scaleY = dispH / imgH;
      const bx = Math.max(0, Math.min(dispW - 20, item.cropData.x * scaleX));
      const by = Math.max(0, Math.min(dispH - 20, item.cropData.y * scaleY));
      const bw = Math.max(20, Math.min(dispW - bx, item.cropData.width * scaleX));
      const bh = Math.max(20, Math.min(dispH - by, item.cropData.height * scaleY));
      setCropBox({ x: bx, y: by, width: bw, height: bh });
    } else {
      // Default to comfortable centered 85% crop
      const bw = Math.round(dispW * 0.85);
      const bh = Math.round(dispH * 0.85);
      const bx = Math.round((dispW - bw) / 2);
      const by = Math.round((dispH - bh) / 2);
      setCropBox({ x: bx, y: by, width: bw, height: bh });
    }
  }, [item]);

  // Handle start dragging (mouse or touch)
  const startDrag = (
    clientX: number,
    clientY: number,
    mode: DragMode
  ) => {
    setIsDragging(true);
    dragModeRef.current = mode;
    dragStartRef.current = {
      clientX,
      clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.width,
      boxH: cropBox.height,
    };
  };

  const handlePointerDown = (
    e: React.MouseEvent | React.TouchEvent,
    mode: DragMode
  ) => {
    e.preventDefault();
    e.stopPropagation();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    startDrag(clientX, clientY, mode);
  };

  // Drag movement listener
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      const mode = dragModeRef.current;
      if (!isDragging || !mode) return;

      const { width: maxW, height: maxH } = displaySize;
      const deltaX = clientX - dragStartRef.current.clientX;
      const deltaY = clientY - dragStartRef.current.clientY;
      const { boxX, boxY, boxW, boxH } = dragStartRef.current;

      const MIN_SIZE = 30;

      if (mode === 'move') {
        const newX = Math.max(0, Math.min(maxW - boxW, boxX + deltaX));
        const newY = Math.max(0, Math.min(maxH - boxH, boxY + deltaY));
        setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
        return;
      }

      let newX = boxX;
      let newY = boxY;
      let newW = boxW;
      let newH = boxH;

      // Handle horizontal edge/corners
      if (mode === 'e' || mode === 'se' || mode === 'ne') {
        newW = Math.max(MIN_SIZE, Math.min(maxW - boxX, boxW + deltaX));
      } else if (mode === 'w' || mode === 'sw' || mode === 'nw') {
        const potentialX = Math.max(0, Math.min(boxX + boxW - MIN_SIZE, boxX + deltaX));
        newW = boxW - (potentialX - boxX);
        newX = potentialX;
      }

      // Handle vertical edge/corners
      if (mode === 's' || mode === 'se' || mode === 'sw') {
        newH = Math.max(MIN_SIZE, Math.min(maxH - boxY, boxH + deltaY));
      } else if (mode === 'n' || mode === 'ne' || mode === 'nw') {
        const potentialY = Math.max(0, Math.min(boxY + boxH - MIN_SIZE, boxY + deltaY));
        newH = boxH - (potentialY - boxY);
        newY = potentialY;
      }

      // Constrain Aspect Ratio if locked
      if (aspectRatio !== null && aspectRatio > 0) {
        if (mode === 'e' || mode === 'w') {
          // Adjust height centered or from top
          newH = newW / aspectRatio;
          if (newY + newH > maxH) {
            newH = maxH - newY;
            newW = newH * aspectRatio;
          }
        } else if (mode === 'n' || mode === 's') {
          // Adjust width
          newW = newH * aspectRatio;
          if (newX + newW > maxW) {
            newW = maxW - newX;
            newH = newW / aspectRatio;
          }
        } else {
          // Corner resizing: lock height to width * ratio
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newH = newW / aspectRatio;
            if (newY + newH > maxH) {
              newH = maxH - newY;
              newW = newH * aspectRatio;
            }
          } else {
            newW = newH * aspectRatio;
            if (newX + newW > maxW) {
              newW = maxW - newX;
              newH = newW / aspectRatio;
            }
          }
        }
      }

      // Final boundary clamp
      newX = Math.max(0, Math.min(maxW - MIN_SIZE, newX));
      newY = Math.max(0, Math.min(maxH - MIN_SIZE, newY));
      newW = Math.max(MIN_SIZE, Math.min(maxW - newX, newW));
      newH = Math.max(MIN_SIZE, Math.min(maxH - newY, newH));

      setCropBox({ x: newX, y: newY, width: newW, height: newH });
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const stopDrag = () => {
      setIsDragging(false);
      dragModeRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', stopDrag);
      window.addEventListener('touchcancel', stopDrag);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stopDrag);
      window.removeEventListener('touchcancel', stopDrag);
    };
  }, [isDragging, displaySize, aspectRatio]);

  // Set Aspect Ratio preset
  const handleSelectRatio = (ratio: number | null) => {
    setAspectRatio(ratio);
    if (ratio === null) return;

    const { width: maxW, height: maxH } = displaySize;
    let targetW = maxW * 0.85;
    let targetH = targetW / ratio;

    if (targetH > maxH * 0.85) {
      targetH = maxH * 0.85;
      targetW = targetH * ratio;
    }

    const x = Math.max(0, Math.round((maxW - targetW) / 2));
    const y = Math.max(0, Math.round((maxH - targetH) / 2));
    setCropBox({
      x,
      y,
      width: Math.round(targetW),
      height: Math.round(targetH),
    });
  };

  // Center crop action
  const handleCenterCrop = () => {
    const { width: maxW, height: maxH } = displaySize;
    const x = Math.max(0, Math.round((maxW - cropBox.width) / 2));
    const y = Math.max(0, Math.round((maxH - cropBox.height) / 2));
    setCropBox((prev) => ({ ...prev, x, y }));
  };

  // Maximize crop action
  const handleMaximize = () => {
    const { width: maxW, height: maxH } = displaySize;
    if (aspectRatio !== null && aspectRatio > 0) {
      handleSelectRatio(aspectRatio);
    } else {
      setCropBox({ x: 0, y: 0, width: maxW, height: maxH });
    }
  };

  // Reset crop action
  const handleReset = () => {
    const { width: maxW, height: maxH } = displaySize;
    const bw = Math.round(maxW * 0.85);
    const bh = Math.round(maxH * 0.85);
    setAspectRatio(null);
    setCropBox({
      x: Math.round((maxW - bw) / 2),
      y: Math.round((maxH - bh) / 2),
      width: bw,
      height: bh,
    });
  };

  // Apply crop: calculate real image pixels and create instant preview
  const handleApply = async () => {
    const imgW = item.width || 800;
    const imgH = item.height || 600;

    const scaleX = imgW / displaySize.width;
    const scaleY = imgH / displaySize.height;

    const realX = Math.max(0, Math.round(cropBox.x * scaleX));
    const realY = Math.max(0, Math.round(cropBox.y * scaleY));
    const realW = Math.max(1, Math.min(imgW - realX, Math.round(cropBox.width * scaleX)));
    const realH = Math.max(1, Math.min(imgH - realY, Math.round(cropBox.height * scaleY)));

    const finalCrop = {
      x: realX,
      y: realY,
      width: realW,
      height: realH,
    };

    // Render high quality thumbnail preview
    let previewUrl: string | undefined;
    try {
      const canvas = document.createElement('canvas');
      const previewW = Math.min(480, realW);
      const previewH = Math.max(1, Math.round((previewW / realW) * realH));
      canvas.width = previewW;
      canvas.height = previewH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        await new Promise<void>((res) => {
          tempImg.onload = () => res();
          tempImg.onerror = () => res();
          tempImg.src = item.url;
        });
        ctx.drawImage(
          tempImg,
          realX,
          realY,
          realW,
          realH,
          0,
          0,
          previewW,
          previewH
        );
        previewUrl = canvas.toDataURL('image/jpeg', 0.88);
      }
    } catch (e) {
      console.error('Failed generating crop preview thumbnail:', e);
    }

    onApplyCrop(item.id, finalCrop, previewUrl);
    onClose();
  };

  // Compute live real pixel dimensions for the badge
  const realCropW = Math.round((cropBox.width / displaySize.width) * (item.width || 800));
  const realCropH = Math.round((cropBox.height / displaySize.height) * (item.height || 600));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col max-h-[94vh] overflow-hidden text-white select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Crop Photo</span>
                <span className="text-[10px] font-semibold text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full">
                  Interactive
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md">
                {item.name} &bull; Original: {item.width} × {item.height}px
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Toolbar */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 overflow-x-auto text-xs no-scrollbar">
          <span className="text-slate-400 text-[11px] font-semibold mr-1 shrink-0">
            Aspect Ratio:
          </span>
          {ASPECT_RATIOS.map((itemRatio) => (
            <button
              key={itemRatio.label}
              onClick={() => handleSelectRatio(itemRatio.val)}
              className={`px-3 py-1 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer ${
                aspectRatio === itemRatio.val
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {itemRatio.label}
            </button>
          ))}
        </div>

        {/* Interactive Workspace */}
        <div
          ref={containerRef}
          className="relative flex-1 p-4 sm:p-6 flex items-center justify-center overflow-hidden bg-slate-950 min-h-[300px]"
        >
          {/* Sized exactly to displayed image (zero mismatch) */}
          <div
            className="relative select-none rounded shadow-2xl overflow-hidden"
            style={{
              width: `${displaySize.width}px`,
              height: `${displaySize.height}px`,
            }}
          >
            {/* Background Image */}
            <img
              src={item.url}
              alt="Crop target"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              draggable={false}
            />

            {/* Darkened overlay outside the crop box */}
            <div
              className="absolute border-2 border-blue-400 cursor-move transition-shadow"
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
              }}
              onMouseDown={(e) => handlePointerDown(e, 'move')}
              onTouchStart={(e) => handlePointerDown(e, 'move')}
            >
              {/* 3x3 Rule of Thirds Grid */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-50">
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-r border-b border-white/60" />
                <div className="border-b border-white/60" />
                <div className="border-r border-white/60" />
                <div className="border-r border-white/60" />
                <div />
              </div>

              {/* Dimensions badge inside crop frame */}
              <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white px-2 py-0.5 rounded pointer-events-none shadow">
                {realCropW} × {realCropH} px
              </div>

              {/* 4 Corner Handles */}
              {/* Top-Left (NW) */}
              <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                onMouseDown={(e) => handlePointerDown(e, 'nw')}
                onTouchStart={(e) => handlePointerDown(e, 'nw')}
              />
              {/* Top-Right (NE) */}
              <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                onMouseDown={(e) => handlePointerDown(e, 'ne')}
                onTouchStart={(e) => handlePointerDown(e, 'ne')}
              />
              {/* Bottom-Right (SE) */}
              <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                onMouseDown={(e) => handlePointerDown(e, 'se')}
                onTouchStart={(e) => handlePointerDown(e, 'se')}
              />
              {/* Bottom-Left (SW) */}
              <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                onMouseDown={(e) => handlePointerDown(e, 'sw')}
                onTouchStart={(e) => handlePointerDown(e, 'sw')}
              />

              {/* 4 Edge Handles */}
              {/* Top (N) */}
              <div
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize shadow-md"
                onMouseDown={(e) => handlePointerDown(e, 'n')}
                onTouchStart={(e) => handlePointerDown(e, 'n')}
              />
              {/* Bottom (S) */}
              <div
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-7 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize shadow-md"
                onMouseDown={(e) => handlePointerDown(e, 's')}
                onTouchStart={(e) => handlePointerDown(e, 's')}
              />
              {/* Left (W) */}
              <div
                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-7 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize shadow-md"
                onMouseDown={(e) => handlePointerDown(e, 'w')}
                onTouchStart={(e) => handlePointerDown(e, 'w')}
              />
              {/* Right (E) */}
              <div
                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-7 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize shadow-md"
                onMouseDown={(e) => handlePointerDown(e, 'e')}
                onTouchStart={(e) => handlePointerDown(e, 'e')}
              />
            </div>
          </div>
        </div>

        {/* Footer with Controls and Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-900">
          {/* Quick crop tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCenterCrop}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Center the crop box"
            >
              <AlignCenter className="w-3.5 h-3.5 text-blue-400" />
              <span>Center</span>
            </button>
            <button
              onClick={handleMaximize}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Expand to full photo"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Full Photo</span>
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Reset crop selection"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
