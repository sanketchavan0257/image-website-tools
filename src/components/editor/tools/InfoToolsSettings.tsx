import React, { useState, useEffect } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { formatBytes } from '../../../config/plans';
import {
  FileText,
  Tv,
  Scale,
  Pipette,
  Info,
  ShieldCheck,
  Copy,
  Check,
  Eye,
  Sliders,
  Camera,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  HardDrive,
  BarChart2,
  CheckCircle2,
  XCircle,
  FileCheck,
  Sparkles,
  Trash2,
  Palette,
  Crosshair,
  Download,
} from 'lucide-react';
import {
  extractDominantColorsFromImage,
  createPickedColorFromHex,
} from '../../../services/colorUtils';
import { analyzeAspectRatio, COMMON_STANDARD_RATIOS } from '../../../services/aspectRatioUtils';
import { parseImageMetadata, FullImageMetadata } from '../../../services/metadataParser';
import { PickedColorInfo } from '../../../types';

interface InfoToolsSettingsProps {
  toolId: string;
}

export const InfoToolsSettings: React.FC<InfoToolsSettingsProps> = ({ toolId }) => {
  const {
    images,
    selectedImageId,
    setSelectedImageId,
    pickedColor,
    setPickedColor,
    colorHistory,
    addColorToHistory,
    clearColorHistory,
  } = useImageStore();
  const [selectedColor, setSelectedColor] = useState<string>('#3b82f6');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dominantColors, setDominantColors] = useState<string[]>([]);
  const [dominantColorObjects, setDominantColorObjects] = useState<PickedColorInfo[]>([]);
  const [customRatioW, setCustomRatioW] = useState<number | ''>(1920);
  const [computedRatioH, setComputedRatioH] = useState<number | ''>(1080);
  const [sizeViewMode, setSizeViewMode] = useState<'all' | 'single'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'largest' | 'smallest'>('default');
  const [sideMetadata, setSideMetadata] = useState<FullImageMetadata | null>(null);

  // Active image selection logic
  const activeIndex = images.findIndex((img) => img.id === selectedImageId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeImage = images[currentIndex] || images[0];

  // Load metadata for sidebar when activeImage changes
  useEffect(() => {
    if (toolId === 'image-metadata-viewer' && activeImage) {
      parseImageMetadata(activeImage.file, {
        width: activeImage.width,
        height: activeImage.height,
      }).then(setSideMetadata);
    }
  }, [toolId, activeImage]);

  // Whenever user selects an image from the cards or table, focus that image in the settings panel
  useEffect(() => {
    if (selectedImageId && toolId === 'image-size-checker') {
      setSizeViewMode('single');
    }
  }, [selectedImageId, toolId]);

  // Aspect Ratio Analysis with Standard Recognition
  const aspectAnalysis = activeImage
    ? analyzeAspectRatio(activeImage.width, activeImage.height)
    : null;

  const ratioX = aspectAnalysis ? aspectAnalysis.simplifiedX : 16;
  const ratioY = aspectAnalysis ? aspectAnalysis.simplifiedY : 9;

  // Extract dominant palette from active image
  useEffect(() => {
    if (!activeImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const extracted = extractDominantColorsFromImage(img, 12);
        setDominantColorObjects(extracted);
        const hexList = extracted.map((c) => c.hex);
        setDominantColors(hexList);
        if (!pickedColor && extracted.length > 0) {
          setPickedColor(extracted[0]);
          setSelectedColor(extracted[0].hex);
        }
      } catch {}
    };
    img.src = activeImage.cropPreviewUrl || activeImage.url;
  }, [activeImage]);

  // Sync selectedColor whenever pickedColor updates in store
  useEffect(() => {
    if (pickedColor) {
      setSelectedColor(pickedColor.hex);
    }
  }, [pickedColor]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePrevImage = () => {
    if (images.length <= 1) return;
    const prevIdx = (currentIndex - 1 + images.length) % images.length;
    setSelectedImageId(images[prevIdx].id);
  };

  const handleNextImage = () => {
    if (images.length <= 1) return;
    const nextIdx = (currentIndex + 1) % images.length;
    setSelectedImageId(images[nextIdx].id);
  };

  if (!activeImage || images.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500">
        Please upload images to inspect details.
      </div>
    );
  }

  // Batch calculations for Size Checker
  const totalSizeBytes = images.reduce((acc, img) => acc + img.size, 0);
  const avgSizeBytes = totalSizeBytes / images.length;
  const sortedImages = [...images].sort((a, b) => {
    if (sortBy === 'largest') return b.size - a.size;
    if (sortBy === 'smallest') return a.size - b.size;
    return 0;
  });
  const largestImg = [...images].sort((a, b) => b.size - a.size)[0];
  const smallestImg = [...images].sort((a, b) => a.size - b.size)[0];

  return (
    <div className="space-y-4 text-slate-800 text-xs">
      {/* Multi-Image Navigation Selector Header (Shown whenever images.length > 1) */}
      {images.length > 1 && (
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Active: <strong className="text-slate-900">#{currentIndex + 1}</strong> of {images.length}
              </span>
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevImage}
                className="p-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
                title="Previous Image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextImage}
                className="p-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
                title="Next Image"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick thumbnail pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {images.map((img, idx) => {
              const isSelected = img.id === activeImage.id;
              return (
                <button
                  key={img.id}
                  onClick={() => {
                    setSelectedImageId(img.id);
                    if (toolId === 'image-size-checker' && sizeViewMode === 'all') {
                      setSizeViewMode('single');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-medium border transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  title={`${img.name} (${formatBytes(img.size)})`}
                >
                  <img
                    src={img.cropPreviewUrl || img.url}
                    alt=""
                    className="w-4 h-4 object-cover rounded"
                  />
                  <span className="max-w-[70px] truncate">{idx + 1}. {img.name}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                      isSelected ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {formatBytes(img.size)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. IMAGE SIZE CHECKER */}
      {toolId === 'image-size-checker' && (
        <div className="space-y-3.5">
          {/* Mode Switcher for Size Checker */}
          {images.length > 1 && (
            <div className="flex p-0.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setSizeViewMode('all')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  sizeViewMode === 'all'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Images ({images.length})
              </button>
              <button
                type="button"
                onClick={() => setSizeViewMode('single')}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                  sizeViewMode === 'single'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inspect #{currentIndex + 1}
              </button>
            </div>
          )}

          {/* VIEW: ALL IMAGES BATCH SUMMARY & LIST */}
          {(sizeViewMode === 'all' || images.length === 1) && (
            <div className="space-y-3.5">
              {/* Batch Summary Box */}
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Total Batch Weight</span>
                  </span>
                  <span className="text-base font-black text-blue-800">
                    {formatBytes(totalSizeBytes)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-200/50">
                  <div className="bg-white/70 p-2 rounded-xl">
                    <span className="text-slate-500 block text-[10px]">Average Size</span>
                    <strong className="text-slate-800 font-semibold">{formatBytes(avgSizeBytes)}</strong>
                  </div>
                  <div className="bg-white/70 p-2 rounded-xl">
                    <span className="text-slate-500 block text-[10px]">Total Files</span>
                    <strong className="text-slate-800 font-semibold">{images.length} Image{images.length > 1 ? 's' : ''}</strong>
                  </div>
                </div>

                {images.length > 1 && (
                  <div className="text-[10px] text-slate-600 flex justify-between pt-0.5">
                    <span>
                      Largest: <strong className="text-slate-800">{formatBytes(largestImg.size)}</strong>
                    </span>
                    <span>
                      Smallest: <strong className="text-slate-800">{formatBytes(smallestImg.size)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Sort selector for multiple images */}
              {images.length > 1 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-slate-700">
                    File-by-File Breakdown:
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent font-medium text-slate-700 cursor-pointer focus:outline-none"
                    >
                      <option value="default">Default Order</option>
                      <option value="largest">Heaviest First</option>
                      <option value="smallest">Lightest First</option>
                    </select>
                  </div>
                </div>
              )}

              {/* List of all images with sizes and portal badges */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-0.5 scrollbar-thin">
                {sortedImages.map((img, idx) => {
                  const isSelected = img.id === activeImage.id;
                  const isUnder50K = img.size <= 50 * 1024;
                  const isUnder100K = img.size <= 100 * 1024;
                  const isUnder10M = img.size <= 10 * 1024 * 1024;

                  return (
                    <div
                      key={img.id}
                      onClick={() => {
                        setSelectedImageId(img.id);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-300'
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={img.cropPreviewUrl || img.url}
                            alt=""
                            className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-slate-800 truncate" title={img.name}>
                              {img.name}
                            </h5>
                            <span className="text-[10px] text-slate-500 block">
                              {img.width} × {img.height} px • {( (img.width * img.height) / 1000000 ).toFixed(1)} MP
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-blue-700 block">
                            {formatBytes(img.size)}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 block">
                            {img.size.toLocaleString()} B
                          </span>
                        </div>
                      </div>

                      {/* Compatibility chips */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-1 text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              isUnder50K
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            50KB: {isUnder50K ? 'OK' : 'Exceeds'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              isUnder100K
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            100KB: {isUnder100K ? 'OK' : 'Exceeds'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              isUnder10M
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            10MB: {isUnder10M ? 'OK' : 'Exceeds'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageId(img.id);
                            setSizeViewMode('single');
                          }}
                          className="text-blue-600 hover:text-blue-700 font-bold text-[10px] underline ml-auto"
                        >
                          Deep Check →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: SINGLE IMAGE DEEP DIVE */}
          {sizeViewMode === 'single' && (
            <div className="space-y-3.5">
              {/* Selected file header */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <img
                    src={activeImage.cropPreviewUrl || activeImage.url}
                    alt=""
                    className="w-10 h-10 object-cover rounded-xl border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                      Image #{currentIndex + 1} Selected
                    </span>
                    <h5 className="font-bold text-xs text-slate-900 truncate" title={activeImage.name}>
                      {activeImage.name}
                    </h5>
                  </div>
                </div>

                <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Exact File Weight</span>
                  <span className="text-lg font-black text-blue-700">
                    {formatBytes(activeImage.size)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono bg-white/80 p-2 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[9px]">Exact Bytes</span>
                    <strong>{activeImage.size.toLocaleString()} B</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px]">Kilobytes</span>
                    <strong>{(activeImage.size / 1024).toFixed(2)} KB</strong>
                  </div>
                </div>
              </div>

              {/* Upload Limit Compatibility for Active Image */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Government & Portal Limits
                </h4>
                <div className="space-y-1.5">
                  {[
                    { name: 'Govt Exam / Recruitment (50 KB)', max: 50 * 1024, label: '50 KB' },
                    { name: 'Passport / PAN / Visa Photo (100 KB)', max: 100 * 1024, label: '100 KB' },
                    { name: 'Discord Non-Nitro (10 MB)', max: 10 * 1024 * 1024, label: '10 MB' },
                    { name: 'Email Attachment Limit (25 MB)', max: 25 * 1024 * 1024, label: '25 MB' },
                  ].map((tier) => {
                    const isUnder = activeImage.size <= tier.max;
                    const diffBytes = Math.abs(activeImage.size - tier.max);
                    return (
                      <div
                        key={tier.name}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-medium text-slate-700 block truncate">{tier.name}</span>
                          <span className="text-[10px] text-slate-500">
                            {isUnder
                              ? `${formatBytes(diffBytes)} headroom remaining`
                              : `${formatBytes(diffBytes)} over allowable size`}
                          </span>
                        </div>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] shrink-0 flex items-center gap-1 ${
                            isUnder
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isUnder ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{isUnder ? 'Allowed' : 'Exceeds'}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Network Load Speed Impact */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <h5 className="font-bold text-slate-700 text-[11px]">Web Performance Rating</h5>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 flex-1 rounded-full ${
                      activeImage.size < 200 * 1024
                        ? 'bg-emerald-500'
                        : activeImage.size < 1024 * 1024
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span className="font-bold text-[11px] text-slate-800">
                    {activeImage.size < 200 * 1024
                      ? 'Fast (< 200 KB)'
                      : activeImage.size < 1024 * 1024
                      ? 'Medium (200 KB - 1 MB)'
                      : 'Heavy (> 1 MB)'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {activeImage.size > 200 * 1024
                    ? 'Recommended: Compress before uploading to websites or web stores to ensure lightning load speed.'
                    : 'Optimal for website performance and SEO.'}
                </p>
              </div>

              {/* Switch back to all images button */}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSizeViewMode('all')}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>View All {images.length} Images Summary</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. IMAGE RESOLUTION CHECKER */}
      {toolId === 'image-resolution-checker' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <span className="text-slate-400 text-[10px] block">Width</span>
              <span className="text-base font-bold text-slate-900 block mt-0.5">
                {activeImage.width} px
              </span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <span className="text-slate-400 text-[10px] block">Height</span>
              <span className="text-base font-bold text-slate-900 block mt-0.5">
                {activeImage.height} px
              </span>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Total Megapixels
            </span>
            <div className="text-xl font-black text-indigo-950">
              {((activeImage.width * activeImage.height) / 1000000).toFixed(2)} MP
            </div>
            <span className="text-[11px] text-indigo-600 block">
              {(activeImage.width * activeImage.height).toLocaleString()} total pixels
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Print Suitability (at 300 DPI)
            </h4>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span>Maximum sharp print size:</span>
                <strong className="text-slate-900">
                  {(activeImage.width / 300).toFixed(1)}" × {(activeImage.height / 300).toFixed(1)}"
                </strong>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>In centimeters:</span>
                <span>
                  {((activeImage.width / 300) * 2.54).toFixed(1)} cm ×{' '}
                  {((activeImage.height / 300) * 2.54).toFixed(1)} cm
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. IMAGE ASPECT RATIO CALCULATOR */}
      {toolId === 'image-aspect-ratio-calculator' && aspectAnalysis && (
        <div className="space-y-4">
          {/* Main Hero Aspect Ratio Display */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl text-center space-y-2 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
              Standard Aspect Ratio
            </span>
            <div className="text-4xl font-black text-blue-950 tracking-tight">
              {aspectAnalysis.bestStandard.label}
            </div>
            
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs">
                {aspectAnalysis.bestStandard.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                {aspectAnalysis.bestStandard.matchPercent}% Match
              </span>
            </div>

            <p className="text-[11px] text-blue-900/80 font-medium">
              {aspectAnalysis.bestStandard.description}
            </p>
          </div>

          {/* Technical Specs Breakdown */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Ratio Technical Breakdown
            </h5>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70">
                <span className="text-slate-500">Standard Ratio:</span>
                <span className="font-bold text-blue-700 font-mono text-sm">
                  {aspectAnalysis.bestStandard.label}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70">
                <span className="text-slate-500">Exact Pixel Ratio (GCD):</span>
                <span className="font-bold text-slate-800 font-mono">
                  {aspectAnalysis.exactX} : {aspectAnalysis.exactY}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70">
                <span className="text-slate-500">Decimal Value:</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {aspectAnalysis.decimal.toFixed(3)} : 1
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70">
                <span className="text-slate-500">Orientation:</span>
                <span className="font-semibold text-slate-800">
                  {aspectAnalysis.orientation}
                </span>
              </div>
            </div>

            {/* Explanation Note for coprime numbers like 495:619 */}
            {(aspectAnalysis.exactX > 30 || aspectAnalysis.exactY > 30) && (
              <div className="p-2.5 bg-blue-50/90 rounded-xl border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed">
                💡 <strong>Why {aspectAnalysis.exactX}:{aspectAnalysis.exactY}?</strong>
                <p className="mt-0.5 text-blue-800">
                  Because {aspectAnalysis.width} and {aspectAnalysis.height} have no common divisor (GCD: 1), their exact pixel ratio calculates to {aspectAnalysis.exactX}:{aspectAnalysis.exactY}. In digital design and social media, this matches the standard <strong>{aspectAnalysis.bestStandard.label} ({aspectAnalysis.bestStandard.name})</strong> format ({aspectAnalysis.bestStandard.matchPercent}% match).
                </p>
              </div>
            )}
          </div>

          {/* Standard Presets Comparison Table */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Common Standard Comparison
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: '4:5', name: 'Instagram Portrait', desc: 'Feed Posts' },
                { label: '1:1', name: 'Square', desc: 'Avatar / Profile' },
                { label: '9:16', name: 'Full Story / Reel', desc: 'Reels / Shorts' },
                { label: '16:9', name: 'Widescreen', desc: 'YouTube / HDTV' },
                { label: '4:3', name: 'Standard Photo', desc: 'Tablets / Prints' },
                { label: '3:2', name: 'Classic DSLR', desc: '4×6" Prints' },
              ].map((std) => {
                const isSelected = aspectAnalysis.bestStandard.label === std.label;
                return (
                  <div
                    key={std.label}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400/50'
                        : 'bg-slate-50 border-slate-200/80 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-xs text-slate-900">
                        {std.label}
                      </span>
                      {isSelected && (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {std.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proportional Dimensions Calculator */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <label className="font-bold text-slate-700 block text-xs">
              Calculate Missing Proportional Dimension
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Target Width</span>
                <input
                  type="number"
                  value={customRatioW}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setCustomRatioW(w);
                    if (w > 0) {
                      setComputedRatioH(Math.round(w / activeImage.aspectRatio));
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs font-semibold"
                  placeholder="Width"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1">Calculated Height</span>
                <input
                  type="number"
                  value={computedRatioH}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setComputedRatioH(h);
                    if (h > 0) {
                      setCustomRatioW(Math.round(h * activeImage.aspectRatio));
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs font-semibold"
                  placeholder="Height"
                />
              </div>
            </div>

            {/* Quick Test Res Width Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400">Quick Test:</span>
              {[1080, 1920, 1200, 800].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setCustomRatioW(w);
                    setComputedRatioH(Math.round(w / activeImage.aspectRatio));
                  }}
                  className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 font-mono text-[10px] cursor-pointer"
                >
                  {w}w
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. IMAGE COLOR PICKER */}
      {toolId === 'image-color-picker' && (
        <div className="space-y-4">
          {/* Active Color Preview & Coordinates Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Pipette className="w-4 h-4 text-blue-600" />
                <span>Active Color</span>
              </span>
              {pickedColor?.x !== undefined && pickedColor?.y !== undefined ? (
                <span className="bg-blue-100/70 text-blue-800 font-mono text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                  <Crosshair className="w-3 h-3 text-blue-600" />
                  <span>X: {pickedColor.x}px, Y: {pickedColor.y}px</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Custom / Palette</span>
              )}
            </div>

            {/* Large Color Banner & Typeable Hex Input */}
            <div className="flex items-center gap-3">
              <div className="relative group shrink-0">
                <div
                  className="w-14 h-14 rounded-2xl shadow-inner border-2 border-slate-300 relative overflow-hidden flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                  style={{ backgroundColor: selectedColor }}
                  title="Click to open color palette picker"
                >
                  <Crosshair className="w-5 h-5 text-white drop-shadow-md opacity-80" />
                  <input
                    type="color"
                    value={selectedColor.startsWith('#') && selectedColor.length === 7 ? selectedColor : '#3b82f6'}
                    onChange={(e) => {
                      const newColor = createPickedColorFromHex(e.target.value);
                      setSelectedColor(e.target.value);
                      setPickedColor(newColor);
                      addColorToHistory(newColor);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Change color"
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Hex Color Code
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={selectedColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedColor(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        const newColor = createPickedColorFromHex(val);
                        setPickedColor(newColor);
                        addColorToHistory(newColor);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white font-mono text-xs font-bold text-slate-900 focus:outline-blue-500 uppercase"
                    placeholder="#3B82F6"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedColor, 'hex-main')}
                    className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer shrink-0"
                    title="Copy HEX code"
                  >
                    {copiedKey === 'hex-main' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Screen Eyedropper API Shortcut (if supported) */}
            {typeof window !== 'undefined' && 'EyeDropper' in window && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    // @ts-ignore
                    const eyeDropper = new window.EyeDropper();
                    const result = await eyeDropper.open();
                    if (result && result.sRGBHex) {
                      const color = createPickedColorFromHex(result.sRGBHex);
                      setSelectedColor(color.hex);
                      setPickedColor(color);
                      addColorToHistory(color);
                    }
                  } catch {}
                }}
                className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sample Screen Color (Eyedropper)</span>
              </button>
            )}
          </div>

          {/* Color Values Table (HEX, RGB, HSL, CMYK) */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Color Formats & Values
            </h4>
            <div className="space-y-1.5">
              {/* HEX */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <span className="font-semibold text-slate-500 w-12">HEX</span>
                <span className="font-mono font-bold text-slate-900 truncate">
                  {pickedColor?.hex || selectedColor}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(pickedColor?.hex || selectedColor, 'row-hex')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {copiedKey === 'row-hex' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'row-hex' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* RGB */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <span className="font-semibold text-slate-500 w-12">RGB</span>
                <span className="font-mono font-bold text-slate-900 truncate">
                  {pickedColor ? pickedColor.rgb : 'rgb(59, 130, 246)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const val = pickedColor ? pickedColor.rgb : 'rgb(59, 130, 246)';
                    copyToClipboard(val, 'row-rgb');
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {copiedKey === 'row-rgb' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'row-rgb' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* HSL */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <span className="font-semibold text-slate-500 w-12">HSL</span>
                <span className="font-mono font-bold text-slate-900 truncate">
                  {pickedColor ? pickedColor.hsl : 'hsl(217, 91%, 60%)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const val = pickedColor ? pickedColor.hsl : 'hsl(217, 91%, 60%)';
                    copyToClipboard(val, 'row-hsl');
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {copiedKey === 'row-hsl' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'row-hsl' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* CMYK */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                <span className="font-semibold text-slate-500 w-12">CMYK</span>
                <span className="font-mono font-bold text-slate-900 truncate">
                  {pickedColor ? pickedColor.cmyk : 'cmyk(76%, 47%, 0%, 4%)'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const val = pickedColor ? pickedColor.cmyk : 'cmyk(76%, 47%, 0%, 4%)';
                    copyToClipboard(val, 'row-cmyk');
                  }}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {copiedKey === 'row-cmyk' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'row-cmyk' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Picked Colors History */}
          {colorHistory.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Recent Picked Colors ({colorHistory.length})
                </h4>
                <button
                  type="button"
                  onClick={clearColorHistory}
                  className="text-[10px] text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 max-h-28 overflow-y-auto">
                {colorHistory.map((item, idx) => (
                  <button
                    key={`${item.hex}-${idx}`}
                    type="button"
                    onClick={() => {
                      setPickedColor(item);
                      setSelectedColor(item.hex);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono transition-transform hover:scale-105 cursor-pointer ${
                      selectedColor.toLowerCase() === item.hex.toLowerCase()
                        ? 'border-blue-500 bg-blue-50 text-blue-900 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title={`HEX: ${item.hex}${item.x !== undefined ? ` at (${item.x}, ${item.y})` : ''}`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 inline-block"
                      style={{ backgroundColor: item.hex }}
                    />
                    <span>{item.hex}</span>
                  </button>
                ))}
              </div>

              {/* Copy all history as CSS variables */}
              <button
                type="button"
                onClick={() => {
                  const cssVars = colorHistory
                    .map((item, i) => `  --color-${i + 1}: ${item.hex}; /* ${item.rgb} */`)
                    .join('\n');
                  const cssSnippet = `:root {\n${cssVars}\n}`;
                  copyToClipboard(cssSnippet, 'copy-css');
                }}
                className="w-full py-1.5 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedKey === 'copy-css' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === 'copy-css' ? 'Copied CSS Variables!' : 'Copy History as CSS Variables'}</span>
              </button>
            </div>
          )}

          {/* Extracted Dominant Color Palette */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                <span>Extracted Dominant Palette</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  copyToClipboard(dominantColors.join(', '), 'copy-palette');
                }}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                {copiedKey === 'copy-palette' ? 'Copied!' : 'Copy All'}
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {(dominantColorObjects.length > 0 ? dominantColorObjects : dominantColors.map((hex) => createPickedColorFromHex(hex))).map((item) => {
                const isCurrent = selectedColor.toLowerCase() === item.hex.toLowerCase();
                return (
                  <button
                    key={item.hex}
                    type="button"
                    onClick={() => {
                      setPickedColor(item);
                      setSelectedColor(item.hex);
                      addColorToHistory(item);
                    }}
                    className={`group relative h-10 rounded-xl border shadow-xs flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${
                      isCurrent ? 'ring-2 ring-blue-500 border-white' : 'border-slate-200/80'
                    }`}
                    style={{ backgroundColor: item.hex }}
                    title={`${item.hex} - Click to select & copy`}
                  >
                    {isCurrent && (
                      <span className="p-0.5 bg-black/40 rounded-full">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              Hover over image on canvas to magnify pixels, or click any swatch above to inspect.
            </p>
          </div>
        </div>
      )}

      {/* 5. IMAGE METADATA VIEWER */}
      {toolId === 'image-metadata-viewer' && (
        <div className="space-y-4">
          {/* EXIF Detection Status Banner */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200/90 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                <span>EXIF Status</span>
              </span>
              {sideMetadata?.hasExifData ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{sideMetadata.rawTags.length} Tags Found</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  Basic File Info
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              {sideMetadata?.hasExifData
                ? `Camera make, lens, exposure, and hardware tags are embedded in this file.`
                : `No camera EXIF tags found. Created digitally, exported from web, or EXIF previously stripped.`}
            </p>
          </div>

          {/* Camera & Exposure Snapshot (if available) */}
          {sideMetadata?.camera.model && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Camera Snapshot
              </h5>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Camera:</span>
                  <strong className="text-slate-900 font-semibold truncate max-w-[160px]">
                    {sideMetadata.camera.make ? `${sideMetadata.camera.make} ` : ''}
                    {sideMetadata.camera.model}
                  </strong>
                </div>
                {sideMetadata.exposure.fNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Aperture:</span>
                    <span className="font-mono text-slate-800 font-bold">{sideMetadata.exposure.fNumber}</span>
                  </div>
                )}
                {sideMetadata.exposure.exposureTime && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Shutter:</span>
                    <span className="font-mono text-slate-800 font-bold">{sideMetadata.exposure.exposureTime}</span>
                  </div>
                )}
                {sideMetadata.exposure.iso && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">ISO:</span>
                    <span className="font-mono text-slate-800 font-bold">{sideMetadata.exposure.iso}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Technical Specs Box */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
            <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              File Architecture
            </h5>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-slate-500 font-medium">File Name:</span>
                <span className="font-mono text-slate-900 font-semibold text-xs break-all" title={activeImage.name}>
                  {activeImage.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File Size:</span>
                <span className="font-mono text-blue-700 font-bold">
                  {formatBytes(activeImage.size)} ({activeImage.size.toLocaleString()} B)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">MIME Type:</span>
                <span className="font-mono text-slate-800 font-semibold">{activeImage.type || 'image/jpeg'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dimensions:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {activeImage.width} × {activeImage.height} px
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Megapixels:</span>
                <span className="font-mono text-blue-700 font-semibold">
                  {((activeImage.width * activeImage.height) / 1000000).toFixed(2)} MP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Color Channel:</span>
                <span className="text-slate-800 font-semibold">sRGB (8-bit per channel)</span>
              </div>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>Read 100% locally in browser memory. No images or metadata are sent to any remote servers.</span>
          </div>
        </div>
      )}

      {/* 6. IMAGE METADATA REMOVER */}
      {toolId === 'image-metadata-remover' && (
        <div className="space-y-4">
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/90 text-emerald-950 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>EXIF Privacy Cleaner</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Active
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-800">
              Permanently purges all embedded tracking metadata across all <strong>{images.length} {images.length === 1 ? 'image' : 'images'}</strong> while preserving 100% original visual image quality.
            </p>
          </div>

          {/* Purge Checklist */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
            <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Guaranteed Metadata Purge List
            </h5>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>GPS Geolocation:</strong> Lat, Long & Altitude</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Camera Hardware:</strong> Make, Model & Serials</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Timestamps:</strong> Date Taken & Modified</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Creator / IPTC:</strong> Author & Copyright tags</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span><strong>Device Software:</strong> Edit history & apps</span>
              </div>
            </div>
          </div>

          {/* Technical Quality Specs */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Visual Quality:</span>
              <strong className="text-slate-800">100% Fidelity (Max Quality)</strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Output Suffix:</span>
              <strong className="font-mono text-emerald-700 font-bold">_cleaned</strong>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Resolution:</span>
              <strong className="text-slate-800">{activeImage.width} × {activeImage.height} px (Exact)</strong>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Zero cloud uploads. All pixel sanitization runs directly in local browser memory.</span>
          </div>
        </div>
      )}
    </div>
  );
};
