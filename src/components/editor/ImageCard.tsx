import React, { useState } from 'react';
import { ImageFileItem, ResizeSettingsState } from '../../types';
import { calculateTargetDimensions } from '../../services/imageProcessing';
import { formatBytes } from '../../config/plans';
import { useImageStore } from '../../store/useImageStore';
import { analyzeAspectRatio } from '../../services/aspectRatioUtils';
import {
  Crop,
  RotateCw,
  Info,
  Trash2,
  Download,
  FlipHorizontal,
  FlipVertical,
  Sparkles,
} from 'lucide-react';

interface ImageCardProps {
  item: ImageFileItem;
  toolId: string;
  resizeSettings: ResizeSettingsState;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onOpenCrop: (item: ImageFileItem) => void;
  onOpenInfo: (item: ImageFileItem) => void;
  onRotate: (id: string) => void;
  onFlip?: (id: string, dir: 'h' | 'v') => void;
  onRemove: (id: string) => void;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  item,
  toolId,
  resizeSettings,
  isSelected = false,
  onSelect,
  onOpenCrop,
  onOpenInfo,
  onRotate,
  onFlip,
  onRemove,
}) => {


  const { pdfSettings, styleSettings } = useImageStore();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const isFlipper = toolId === 'image-flipper' || toolId === 'flip';
  const isRoundTool = toolId === 'round-image-maker';
  const isBorderTool = toolId === 'image-border-maker';
  const isCircle = isRoundTool && styleSettings.roundMode === 'circle';
  const isRadius = isRoundTool && styleSettings.roundMode === 'radius';
  const bStyle = styleSettings.borderStyle || 'solid';
  const isGradientBorder =
    isBorderTool && (styleSettings.borderWidth ?? 0) > 0 && styleSettings.borderFillType === 'gradient';
  const isSolidBorder =
    isBorderTool && (styleSettings.borderWidth ?? 0) > 0 && styleSettings.borderFillType !== 'gradient';
  const borderPreviewW =
    bStyle === 'double'
      ? Math.max(6, Math.min(22, Math.round((styleSettings.borderWidth ?? 16) * 0.45)))
      : bStyle === 'dashed'
      ? Math.max(3, Math.min(18, Math.round((styleSettings.borderWidth ?? 16) * 0.35)))
      : Math.max(2, Math.min(16, Math.round((styleSettings.borderWidth ?? 16) * 0.35)));
  const borderPreviewR =
    isBorderTool && (styleSettings.borderRadius ?? 0) > 0
      ? Math.min(50, Math.round((styleSettings.borderRadius ?? 0) * 0.4))
      : 0;

  // Watermark positioning calculations for live card preview
  const getWatermarkPosStyles = (pos: string) => {
    let horizontalClass = 'left-3 text-left items-start';
    if (pos.includes('right')) {
      horizontalClass = 'right-3 text-right items-end';
    } else if (pos.includes('center')) {
      horizontalClass = 'left-1/2 -translate-x-1/2 text-center items-center';
    }

    let verticalClass = 'top-3';
    if (pos.startsWith('top') || pos.startsWith('row1') || pos.startsWith('r1')) {
      verticalClass = 'top-3';
    } else if (pos.startsWith('row2') || pos.startsWith('r2') || pos.startsWith('upper')) {
      verticalClass = 'top-[16.7%] -translate-y-1/2';
    } else if (pos.startsWith('row3') || pos.startsWith('r3')) {
      verticalClass = 'top-[33.3%] -translate-y-1/2';
    } else if (pos.startsWith('row4') || pos.startsWith('r4') || pos === 'center' || pos.startsWith('center')) {
      verticalClass = 'top-1/2 -translate-y-1/2';
    } else if (pos.startsWith('row5') || pos.startsWith('r5')) {
      verticalClass = 'top-[66.7%] -translate-y-1/2';
    } else if (pos.startsWith('row6') || pos.startsWith('r6') || pos.startsWith('lower')) {
      verticalClass = 'top-[83.3%] -translate-y-1/2';
    } else if (pos.startsWith('bottom') || pos.startsWith('row7') || pos.startsWith('r7')) {
      verticalClass = 'bottom-3';
    }

    return `${horizontalClass} ${verticalClass}`;
  };

  // Compute projected new dimensions
  let newDims = { width: item.width, height: item.height };
  if (toolId === 'image-resizer') {
    newDims = calculateTargetDimensions(item, resizeSettings);
  } else if (item.cropData) {
    newDims = {
      width: Math.round(item.cropData.width),
      height: Math.round(item.cropData.height),
    };
  } else if (isCircle) {
    const minDim = Math.min(item.width, item.height);
    newDims = { width: minDim, height: minDim };
  }

  const isDimensionsChanged =
    newDims.width !== item.width || newDims.height !== item.height;

  const handleDownloadSinglePdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloadingPdf(true);
    try {
      const { generateSinglePdf, getPdfFilename } = await import('../../services/pdfConverter');
      const { downloadFile } = await import('../../services/zipExport');
      const blob = await generateSinglePdf(item, pdfSettings);
      downloadFile(blob, getPdfFilename(item));
    } catch (err) {
      console.error('Failed downloading individual PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div
      onClick={() => onSelect?.(item.id)}
      className={`group relative flex flex-col bg-white rounded-2xl border transition-all overflow-hidden cursor-pointer ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md'
          : 'border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300'
      }`}
    >
      {/* Top Image Preview */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 flex items-center justify-center overflow-hidden">
        {/* Subtle checkered pattern for transparency check */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          }}
        />

        {/* Custom solid background if selected in round tool */}
        {isRoundTool && styleSettings.roundBackground !== 'transparent' && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: styleSettings.roundBackground }}
          />
        )}

        {isCircle ? (
          /* Full Circle 1:1 Avatar Preview */
          <div
            className="relative flex items-center justify-center overflow-hidden transition-all duration-200 shadow-sm"
            style={{
              width: '74%',
              aspectRatio: '1 / 1',
              borderRadius: '9999px',
              border:
                styleSettings.roundBorderWidth > 0
                  ? `${Math.max(1, Math.min(8, styleSettings.roundBorderWidth))}px solid ${
                      styleSettings.roundBorderColor || '#ffffff'
                    }`
                  : undefined,
            }}
          >
            <img
              src={item.cropPreviewUrl || item.url}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-200"
              style={{
                transform: `rotate(${item.rotation || 0}deg) scale(${item.flipH ? -1 : 1}, ${
                  item.flipV ? -1 : 1
                })`,
              }}
            />
          </div>
        ) : isGradientBorder ? (
          /* Linear Gradient Border Preview (solid, dashed, double) */
          <div
            className="relative inline-flex items-center justify-center transition-all duration-200 shadow-sm max-h-[86%] max-w-[86%]"
            style={{
              padding: `${borderPreviewW}px`,
              background:
                bStyle === 'solid'
                  ? `linear-gradient(${styleSettings.gradientAngle ?? 135}deg, ${
                      styleSettings.gradientColor1 || '#ec4899'
                    }, ${styleSettings.gradientColor2 || '#3b82f6'})`
                  : undefined,
              borderRadius: borderPreviewR > 0 ? `${borderPreviewR}px` : '0px',
            }}
          >
            <img
              src={item.cropPreviewUrl || item.url}
              alt={item.name}
              className="relative max-h-full max-w-full object-contain block transition-transform duration-200"
              style={{
                borderRadius:
                  borderPreviewR > 0
                    ? `${Math.max(0, borderPreviewR - borderPreviewW)}px`
                    : '0px',
                transform: `rotate(${item.rotation || 0}deg) scale(${item.flipH ? -1 : 1}, ${
                  item.flipV ? -1 : 1
                })`,
              }}
            />
            {bStyle !== 'solid' && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: borderPreviewR > 0 ? `${borderPreviewR}px` : '0px',
                  border: `${borderPreviewW}px ${bStyle} transparent`,
                  background: `linear-gradient(${styleSettings.gradientAngle ?? 135}deg, ${
                    styleSettings.gradientColor1 || '#ec4899'
                  }, ${styleSettings.gradientColor2 || '#3b82f6'}) border-box`,
                  WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />
            )}
          </div>
        ) : isSolidBorder ? (
          /* Solid Color Border Preview (solid, dashed, double) */
          <div
            className="relative inline-flex items-center justify-center transition-all duration-200 shadow-sm max-h-[86%] max-w-[86%]"
            style={{
              border: `${borderPreviewW}px ${bStyle} ${styleSettings.borderColor || '#ffffff'}`,
              borderRadius: borderPreviewR > 0 ? `${borderPreviewR}px` : '0px',
            }}
          >
            <img
              src={item.cropPreviewUrl || item.url}
              alt={item.name}
              className="relative max-h-full max-w-full object-contain block transition-all duration-200"
              style={{
                borderRadius:
                  borderPreviewR > 0
                    ? `${Math.max(0, borderPreviewR - borderPreviewW)}px`
                    : '0px',
                transform: `rotate(${item.rotation || 0}deg) scale(${item.flipH ? -1 : 1}, ${
                  item.flipV ? -1 : 1
                })`,
              }}
            />
          </div>
        ) : (
          /* Standard / Rounded Corner Preview */
          <img
            src={item.cropPreviewUrl || item.url}
            alt={item.name}
            className="relative max-h-full max-w-full object-contain transition-all duration-200"
            style={{
              borderRadius: isRadius ? `${styleSettings.cornerRadius}%` : undefined,
              border:
                isRadius && styleSettings.roundBorderWidth > 0
                  ? `${Math.max(1, Math.min(8, styleSettings.roundBorderWidth))}px solid ${
                      styleSettings.roundBorderColor || '#ffffff'
                    }`
                  : undefined,
              transform: `rotate(${item.rotation || 0}deg) scale(${item.flipH ? -1 : 1}, ${
                item.flipV ? -1 : 1
              })`,
            }}
          />
        )}

        {/* Live Watermark Overlay (12-Point Grid, Text Size, and Date directly below text) */}
        {toolId === 'image-watermark' && (
          <div
            className={`absolute pointer-events-none z-10 flex flex-col max-w-[85%] ${getWatermarkPosStyles(
              styleSettings.watermarkPos || 'bottom-right'
            )}`}
            style={{
              opacity: (styleSettings.watermarkOpacity ?? 60) / 100,
              color: styleSettings.watermarkColor || '#ffffff',
              textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.95)',
            }}
          >
            <span
              className="font-bold leading-tight select-none truncate"
              style={{
                fontSize: `${Math.max(11, Math.min(22, Math.round((styleSettings.watermarkFontSize || 32) * 0.42)))}px`,
              }}
            >
              {styleSettings.watermarkText || 'Watermark'}
            </span>
            {styleSettings.watermarkDate?.trim() && (
              <span
                className="font-medium leading-tight select-none mt-0.5 opacity-90 truncate"
                style={{
                  fontSize: `${Math.max(9, Math.min(15, Math.round((styleSettings.watermarkFontSize || 32) * 0.28)))}px`,
                }}
              >
                {styleSettings.watermarkDate.trim()}
              </span>
            )}
          </div>
        )}

        {/* Top-Left Badges: Original Size + Active Transformations (Constrained so it never covers delete button) */}
        <div className="absolute top-2.5 left-2.5 max-w-[calc(100%-3.5rem)] flex items-center gap-1.5 flex-wrap z-10 pointer-events-none">
          <div className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-900/75 text-white backdrop-blur-xs shadow-xs pointer-events-auto">
            {formatBytes(item.size)}
          </div>
          {isCircle && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs pointer-events-auto">
              Circle 1:1
            </span>
          )}
          {isRadius && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs pointer-events-auto">
              Radius {styleSettings.cornerRadius}%
            </span>
          )}
          {isBorderTool && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs capitalize pointer-events-auto">
              {bStyle} Border {styleSettings.borderWidth}px
            </span>
          )}
          {isBorderTool && styleSettings.borderRadius > 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shadow-xs pointer-events-auto">
              Radius {styleSettings.borderRadius}px
            </span>
          )}
          {isBorderTool && styleSettings.borderFillType === 'gradient' && (
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs flex items-center gap-1 pointer-events-auto"
              style={{
                background: `linear-gradient(${styleSettings.gradientAngle ?? 135}deg, ${
                  styleSettings.gradientColor1 || '#ec4899'
                }, ${styleSettings.gradientColor2 || '#3b82f6'})`,
              }}
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>Gradient {styleSettings.gradientAngle ?? 135}°</span>
            </span>
          )}
          {toolId === 'image-watermark' && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs pointer-events-auto flex items-center gap-1">
              <span>Stamp {styleSettings.watermarkFontSize || 32}px</span>
              {styleSettings.watermarkDate?.trim() && <span className="opacity-80">+ Date</span>}
            </span>
          )}
          {item.flipH && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white shadow-xs pointer-events-auto">
              Flip H
            </span>
          )}
          {item.flipV && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white shadow-xs pointer-events-auto">
              Flip V
            </span>
          )}
          {item.rotation !== 0 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-600 text-white shadow-xs pointer-events-auto">
              {item.rotation}°
            </span>
          )}
        </div>

        {/* Top-Right Quick Remove Button (Always on top with z-30 and larger clickable target) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove(item.id);
          }}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl bg-slate-900/80 hover:bg-rose-600 text-white transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95 flex items-center justify-center backdrop-blur-md z-30"
          title="Remove this image"
          aria-label="Remove image"
        >
          <Trash2 className="w-4 h-4 text-white" />
        </button>

        {/* Crop Active Indicator */}
        {item.cropData && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1">
            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-[10px] font-semibold text-white shadow">
              Cropped ({Math.round(item.cropData.width)} × {Math.round(item.cropData.height)})
            </span>
          </div>
        )}
      </div>

      {/* Card Info & Actions */}
      <div className="p-3.5 flex flex-col flex-1 justify-between bg-white">
        <div>
          {/* File Name */}
          <h4
            className="text-xs font-semibold text-slate-800 truncate mb-1.5"
            title={item.name}
          >
            {item.name}
          </h4>

          {/* Original -> New Dimensions Badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {item.width} × {item.height}
            </span>
            {toolId === 'image-aspect-ratio-calculator' && (
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                Ratio: {analyzeAspectRatio(item.width, item.height).bestStandard.label} ({analyzeAspectRatio(item.width, item.height).bestStandard.name.split(' ')[0]})
              </span>
            )}
            {isDimensionsChanged && (
              <>
                <span className="text-[10px] text-slate-400 font-bold">→</span>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  {newDims.width} × {newDims.height}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Specific 1-Click Separate PDF Download button for image-to-pdf tool */}
        {toolId === 'image-to-pdf' && (
          <button
            type="button"
            disabled={isDownloadingPdf}
            onClick={handleDownloadSinglePdf}
            className="w-full mt-2.5 py-1.5 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title={`Download ${item.name} as a separate 1-page PDF file`}
          >
            {isDownloadingPdf ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Creating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download 1-Page PDF</span>
              </>
            )}
          </button>
        )}

        {/* Action Row: Context-Aware buttons */}
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          {isFlipper ? (
            /* Image Flipper dedicated action buttons */
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFlip?.(item.id, 'h');
                }}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                  item.flipH
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
                }`}
                title="Toggle horizontal mirror"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span>Flip H</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFlip?.(item.id, 'v');
                }}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                  item.flipV
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
                }`}
                title="Toggle vertical mirror"
              >
                <FlipVertical className="w-3.5 h-3.5" />
                <span>Flip V</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(item.id);
                  onOpenInfo(item);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="View dimensions and details"
              >
                <Info className="w-3.5 h-3.5 text-slate-600" />
                <span>Info</span>
              </button>
            </div>
          ) : (
            /* Standard 3-Button Action Row: Crop, Rotate, Info */
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCrop(item);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="Crop this photo"
              >
                <Crop className="w-3.5 h-3.5 text-slate-600" />
                <span>Crop</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRotate(item.id);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="Rotate 90 degrees clockwise"
              >
                <RotateCw className="w-3.5 h-3.5 text-slate-600" />
                <span>Rotate</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(item.id);
                  onOpenInfo(item);
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                title="View dimensions and details"
              >
                <Info className="w-3.5 h-3.5 text-slate-600" />
                <span>Info</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
