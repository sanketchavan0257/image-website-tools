import React, { useState, useEffect } from 'react';
import { ToolDefinition, ImageFileItem, ProcessedResultItem } from '../types';
import { useImageStore } from '../store/useImageStore';
import { getPlanLimits, formatBytes } from '../config/plans';
import { processSingleImage } from '../services/imageProcessing';
import { AdSlot } from '../components/common/AdSlot';
import { UploadBox } from '../components/upload/UploadBox';
import { ImageCard } from '../components/editor/ImageCard';
import { CropModal } from '../components/common/CropModal';
import { InfoModal } from '../components/common/InfoModal';
import { ExportModal } from '../components/editor/ExportModal';
import { ResizeSettings } from '../components/editor/tools/ResizeSettings';
import { CompressorSettings } from '../components/editor/tools/CompressorSettings';
import { CropSettings } from '../components/editor/tools/CropSettings';
import { ConvertSettings } from '../components/editor/tools/ConvertSettings';
import { TransformSettings } from '../components/editor/tools/TransformSettings';
import { FilterSettings } from '../components/editor/tools/FilterSettings';
import { Base64Settings } from '../components/editor/tools/Base64Settings';
import { InfoToolsSettings } from '../components/editor/tools/InfoToolsSettings';
import { PdfSettings } from '../components/editor/tools/PdfSettings';
import { StyleToolsSettings } from '../components/editor/tools/StyleToolsSettings';
import { CombineSplitSettings } from '../components/editor/tools/CombineSplitSettings';
import { ImageColorPickerWorkspace } from '../components/tools/ImageColorPickerWorkspace';
import { ImageMetadataViewerWorkspace } from '../components/tools/ImageMetadataViewerWorkspace';
import { ImageMetadataRemoverWorkspace } from '../components/tools/ImageMetadataRemoverWorkspace';
import { BgRemoverWorkspace } from '../components/tools/BgRemoverWorkspace';
import { downloadFile } from '../services/zipExport';
import {
  ShieldCheck,
  Trash2,
  Download,
  Plus,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  LayoutGrid,
  Table,
  CheckCircle2,
  XCircle,
  HardDrive,
  Binary,
  FileSpreadsheet,
  FolderArchive,
  Copy,
  Pipette,
} from 'lucide-react';

interface ToolEditorViewProps {
  tool: ToolDefinition;
  onNavigate: (path: string) => void;
}

export const ToolEditorView: React.FC<ToolEditorViewProps> = ({
  tool,
  onNavigate,
}) => {
  const {
    images,
    selectedImageId,
    setSelectedImageId,
    isPro,
    removeImage,
    clearImages,
    rotateImage,
    flipImage,
    setCropData,
    resizeSettings,
    compressorSettings,
    convertSettings,
    transformSettings,
    filterSettings,
    cropSettings,
    pdfSettings,
    styleSettings,
    updatePdfSettings,
    setToastMessage,
    pickedColor,
    activePlan,
  } = useImageStore();

  const limits = getPlanLimits(activePlan || (isPro ? 'pro' : 'free'));

  // Modals and view format state
  const [sizeViewFormat, setSizeViewFormat] = useState<'grid' | 'table'>('grid');
  const [cropTargetItem, setCropTargetItem] = useState<ImageFileItem | null>(null);
  const [infoTargetItem, setInfoTargetItem] = useState<ImageFileItem | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processedResults, setProcessedResults] = useState<ProcessedResultItem[]>([]);

  // Guard: If opened with no images, redirect back to upload page
  useEffect(() => {
    if (images.length === 0) {
      setToastMessage('Please select images again');
      onNavigate(`/${tool.slug}`);
    } else if (tool.id === 'image-cropper') {
      const hasAnyCrop = images.some((img) => Boolean(img.cropData));
      if (!hasAnyCrop && !cropTargetItem) {
        setCropTargetItem(images[0]);
      }
    }
  }, [images.length, tool.slug, tool.id, onNavigate, setToastMessage]);

  if (images.length === 0) {
    return null;
  }

  // Handle Export / Process All
  const handleExportAll = async () => {
    // If tool is Image to PDF, generate PDF directly according to chosen mode
    if (tool.id === 'image-to-pdf') {
      setIsProcessing(true);
      setProcessProgress(0);
      try {
        if (pdfSettings.mode === 'combined') {
          const { generateCombinedPdf, getPdfFilename } = await import('../services/pdfConverter');
          const pdfBlob = await generateCombinedPdf(images, pdfSettings, (curr, tot) => {
            setProcessProgress(Math.round((curr / tot) * 100));
          });
          const filename =
            images.length === 1
              ? getPdfFilename(images[0])
              : `all_${images.length}_images_merged.pdf`;
          downloadFile(pdfBlob, filename);
          setToastMessage(`Downloaded ${images.length} pages in 1 combined PDF!`);
        } else {
          const { downloadAllSeparatePdfsAsZip } = await import('../services/pdfConverter');
          await downloadAllSeparatePdfsAsZip(images, pdfSettings, (pct) => {
            setProcessProgress(pct);
          });
          setToastMessage(`Downloaded ${images.length} separate PDFs as ZIP!`);
        }
      } catch (err) {
        console.error('Failed exporting PDF:', err);
        setToastMessage('Error generating PDF');
      } finally {
        setIsProcessing(false);
        setProcessProgress(0);
      }
      return;
    }

    setIsProcessing(true);
    setProcessProgress(0);

    const results: ProcessedResultItem[] = [];
    const total = images.length;

    for (let i = 0; i < total; i++) {
      const item = images[i];
      try {
        const res = await processSingleImage(item, tool.id, {
          resizeSettings,
          compressorSettings,
          convertSettings,
          transformSettings,
          filterSettings,
          styleSettings,
        });
        results.push(res);
      } catch (err) {
        console.error('Error processing item:', item.name, err);
      }
      setProcessProgress(Math.round(((i + 1) / total) * 100));
    }

    setProcessedResults(results);
    setIsProcessing(false);

    // If only 1 image: download directly, no choice (per requirements)
    if (results.length === 1) {
      downloadFile(results[0].blob, results[0].newName);
    }

    // Open result modal to review before/after sizes
    setExportModalOpen(true);
  };

  // Navigate back to the specific tool's upload/landing page
  const handleBackToTool = () => {
    clearImages();
    onNavigate(`/${tool.slug}`);
  };

  const isTransformTool =
    tool.id === 'image-rotator' ||
    tool.id === 'image-flipper' ||
    tool.id === 'rotate' ||
    tool.id === 'flip';

  const isFilterTool =
    tool.id === 'grayscale-converter' ||
    tool.id === 'image-brightness' ||
    tool.id === 'image-contrast' ||
    tool.id === 'image-saturation' ||
    tool.id === 'blur-image' ||
    tool.id === 'pixelate-image';

  return (
    <div className="w-full">
      {/* 3-Column Layout with side AdSlots */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-5 flex gap-6 justify-center">
        {/* Left Side AdSlot */}
        <AdSlot position="left" />

        {/* Main Workspace Area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Top Bar: Back Button, Breadcrumb, and Centered Action Buttons */}
          <nav
            aria-label="Editor Navigation"
            className="bg-white p-3 sm:px-5 sm:py-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4"
          >
            {/* Left: Mobile back/title & Desktop breadcrumbs */}
            <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1 justify-between sm:justify-start">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToTool}
                  className="md:hidden p-1.5 -ml-1 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                  title={`Back to ${tool.name}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                {/* Desktop breadcrumb */}
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <span className="capitalize text-slate-500 font-medium">
                    {tool.category.replace('-', ' & ')}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-slate-900 font-bold">{tool.name}</span>
                </div>

                {/* Mobile Tool Title */}
                <div className="flex md:hidden items-center gap-1.5 min-w-0">
                  <span className="text-slate-900 font-bold text-xs truncate max-w-[150px]">
                    {tool.name}
                  </span>
                </div>
              </div>

              {/* Mobile Photo Count Badge on top-right of mobile header */}
              <span className="sm:hidden text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200/60 shrink-0">
                {images.length} {images.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>

            {/* Center: Action Buttons (Add Images & Change Photos - ALWAYS CENTERED) */}
            <div className="flex items-center justify-center gap-2 text-xs w-full sm:w-auto mx-auto shrink-0 py-0.5">
              <UploadBox compact />
              <button
                type="button"
                onClick={handleBackToTool}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                title="Clear and pick fresh photos"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Change Photos</span>
              </button>
            </div>

            {/* Right: Count Badge on Desktop to keep perfect balance */}
            <div className="hidden sm:flex sm:flex-1 justify-end items-center text-xs">
              <span className="font-semibold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60 inline-flex items-center">
                <strong className="text-slate-900 font-bold mr-1">{images.length}</strong>{' '}
                {images.length === 1 ? 'image' : 'images'}
              </span>
            </div>
          </nav>

          {/* Main Workspace: Dedicated BgRemoverWorkspace for bg-remover, or standard Left Settings Panel + Right Images Grid */}
          {tool.id === 'bg-remover' ? (
            <BgRemoverWorkspace />
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 min-w-0">
            <aside
              className={`w-full ${
                tool.id === 'image-metadata-viewer' || tool.id === 'image-metadata-remover' ? 'lg:w-80' : 'lg:w-96'
              } shrink-0 bg-white rounded-3xl border border-slate-200/90 shadow-sm flex flex-col max-h-[calc(100vh-6rem)] lg:sticky lg:top-20 overflow-hidden`}
            >
              {/* Top Toolbar of Left Panel */}
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBackToTool}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                    title={`Back to ${tool.name}`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <span className="text-slate-200">|</span>
                  {/* "+" Add more images */}
                  <UploadBox compact />

                  {/* Delete all button */}
                  <button
                    onClick={clearImages}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove all images"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Max File Size Indicator */}
                <div className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60">
                  Max: <strong className="text-slate-700">{limits.maxFileSizeMB} MB</strong>
                </div>
              </div>

            {/* Middle: Tool Settings Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span>{tool.name} Settings</span>
                </h3>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  Applies to all ({images.length})
                </span>
              </div>

              {/* Tool specific settings controller */}
              {tool.id === 'image-resizer' && <ResizeSettings />}
              {tool.id === 'image-compressor' && <CompressorSettings />}
              {tool.id === 'image-cropper' && <CropSettings onOpenCrop={setCropTargetItem} />}
              {(tool.id === 'jpg-to-png' ||
                tool.id === 'png-to-jpg' ||
                tool.id === 'webp-converter') && (
                <ConvertSettings toolId={tool.id} />
              )}
              {isTransformTool && <TransformSettings toolId={tool.id} />}
              {isFilterTool && <FilterSettings toolId={tool.id} />}
              {(tool.id === 'round-image-maker' ||
                tool.id === 'image-border-maker' ||
                tool.id === 'image-watermark') && (
                <StyleToolsSettings toolId={tool.id} />
              )}
              {(tool.id === 'image-merger' ||
                tool.id === 'image-splitter' ||
                tool.id === 'image-collage-maker') && (
                <CombineSplitSettings toolId={tool.id} />
              )}
              {(tool.id === 'image-to-base64' || tool.id === 'base64-to-image') && (
                <Base64Settings toolId={tool.id} />
              )}
              {(tool.id === 'image-to-pdf' || tool.id === 'pdf-to-image') && (
                <PdfSettings toolId={tool.id} />
              )}
              {(tool.id === 'image-size-checker' ||
                tool.id === 'image-color-picker' ||
                tool.id === 'image-resolution-checker' ||
                tool.id === 'image-aspect-ratio-calculator' ||
                tool.id === 'image-metadata-viewer' ||
                tool.id === 'image-metadata-remover') && (
                <InfoToolsSettings toolId={tool.id} />
              )}
            </div>

            {/* Bottom Fixed Export / Action Button */}
            <div className="p-4 border-t border-slate-100 bg-white shadow-lg">
              {tool.id === 'image-color-picker' ? (
                <button
                  type="button"
                  onClick={() => {
                    const code = pickedColor?.hex || '#3B82F6';
                    navigator.clipboard.writeText(code);
                    setToastMessage(`Copied ${code} to clipboard!`);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy Active Color ({pickedColor?.hex || '#3B82F6'})</span>
                </button>
              ) : tool.id === 'image-metadata-viewer' ? (
                <button
                  type="button"
                  onClick={async () => {
                    const activeIdx = images.findIndex((img) => img.id === selectedImageId);
                    const activeImg = images[activeIdx >= 0 ? activeIdx : 0] || images[0];
                    if (!activeImg) return;
                    const { parseImageMetadata } = await import('../services/metadataParser');
                    const data = await parseImageMetadata(activeImg.file, {
                      width: activeImg.width,
                      height: activeImg.height,
                    });
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeImg.name.replace(/\.[^/.]+$/, '')}_metadata.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setToastMessage(`Exported metadata for ${activeImg.name}`);
                  }}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Metadata (.JSON)</span>
                </button>
              ) : tool.id === 'image-metadata-remover' ? (
                <button
                  disabled={isProcessing}
                  onClick={handleExportAll}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-75 text-white shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Stripping Metadata {processProgress}%...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        Clean & Download All ({images.length} {images.length === 1 ? 'Image' : 'Images'})
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  disabled={isProcessing}
                  onClick={handleExportAll}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-75 text-white shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Processing {processProgress}%...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>
                        {tool.id === 'image-to-pdf'
                          ? pdfSettings.mode === 'combined'
                            ? `Download Combined PDF (${images.length} ${images.length === 1 ? 'Page' : 'Pages'})`
                            : `Download All Separate PDFs (${images.length} Files ZIP)`
                          : tool.id === 'image-to-base64'
                          ? `Export ${images.length} Base64 (.txt)`
                          : `Export ${images.length} ${images.length === 1 ? 'Image' : 'Images'}`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </aside>

          {/* Right Area: Image Cards Grid / Batch Size Comparison Table */}
          <main className="flex-1 min-w-0 space-y-4">
            {/* Header info bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToTool}
                  className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-blue-600 transition-colors cursor-pointer px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-200"
                  title={`Back to ${tool.name} upload page`}
                >
                  <ArrowLeft className="w-4 h-4 text-slate-500" />
                  <span>Back to {tool.shortName || tool.name}</span>
                </button>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-slate-800">
                  {images.length} of {limits.maxFilesPerBatch} images loaded
                </span>
                {tool.id === 'image-size-checker' && (
                  <>
                    <span className="text-slate-300 hidden sm:inline">|</span>
                    <span className="text-blue-700 font-bold hidden sm:inline bg-blue-50 px-2 py-0.5 rounded-md">
                      Batch Weight: {formatBytes(images.reduce((acc, i) => acc + i.size, 0))}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* View switcher for Image Size Checker */}
                {tool.id === 'image-size-checker' && images.length > 1 && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setSizeViewFormat('grid')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                        sizeViewFormat === 'grid'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Grid Cards View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSizeViewFormat('table')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                        sizeViewFormat === 'table'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Comparison Table View"
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>Comparison Table</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={clearImages}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* If tool is Image Size Checker, show a summary ribbon */}
            {tool.id === 'image-size-checker' && (
              <div className="p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-xl">
                    <HardDrive className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold">Image Size & Storage Checker</h4>
                    <p className="text-[11px] text-blue-100">
                      Checking all {images.length} images simultaneously. Click any card to inspect or use the comparison table.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="bg-white/20 px-2.5 py-1 rounded-lg">
                    Total: <strong>{formatBytes(images.reduce((acc, i) => acc + i.size, 0))}</strong>
                  </span>
                  <span className="bg-white/20 px-2.5 py-1 rounded-lg hidden sm:inline">
                    Avg: <strong>{formatBytes(images.reduce((acc, i) => acc + i.size, 0) / images.length)}</strong>
                  </span>
                </div>
              </div>
            )}

            {/* If tool is Image to Base64, show a summary ribbon */}
            {tool.id === 'image-to-base64' && (
              <div className="p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-xl">
                    <Binary className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold">Image to Base64 Encoder</h4>
                    <p className="text-[11px] text-blue-100">
                      Encoding all {images.length} {images.length === 1 ? 'image' : 'images'}. Click any card or thumbnail to view, copy, or export its code.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="bg-white/20 px-2.5 py-1 rounded-lg">
                    {images.length} {images.length === 1 ? 'Image Ready' : 'Images Ready'}
                  </span>
                </div>
              </div>
            )}

            {/* If tool is Image to PDF, show a summary ribbon with instant conversion modes */}
            {tool.id === 'image-to-pdf' && (
              <div className="p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <FileSpreadsheet className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Image to PDF Converter</h4>
                    <p className="text-[11px] text-blue-100">
                      Merge all {images.length} images into 1 multi-page PDF or download separate 1-by-1 PDFs.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      updatePdfSettings({ mode: 'combined' });
                      if (pdfSettings.mode === 'combined') {
                        handleExportAll();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                      pdfSettings.mode === 'combined'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    title="Download all images merged into 1 combined PDF document"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Combined 1 PDF</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      updatePdfSettings({ mode: 'separate' });
                      if (pdfSettings.mode === 'separate') {
                        handleExportAll();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                      pdfSettings.mode === 'separate'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    title="Download separate individual 1-page PDFs bundled in a ZIP archive"
                  >
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Separate PDFs (ZIP)</span>
                  </button>
                </div>
              </div>
            )}

            {/* BATCH COMPARISON TABLE VIEW (When user switches to Table in image-size-checker) */}
            {tool.id === 'image-size-checker' && sizeViewFormat === 'table' ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3.5 w-12 text-center">#</th>
                        <th className="py-3 px-3.5">Image & Name</th>
                        <th className="py-3 px-3.5">Exact File Size</th>
                        <th className="py-3 px-3.5">Dimensions</th>
                        <th className="py-3 px-3.5">Govt (50KB)</th>
                        <th className="py-3 px-3.5">Passport (100KB)</th>
                        <th className="py-3 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {images.map((img, idx) => {
                        const isSelected = img.id === selectedImageId;
                        const isUnder50K = img.size <= 50 * 1024;
                        const isUnder100K = img.size <= 100 * 1024;

                        return (
                          <tr
                            key={img.id}
                            onClick={() => setSelectedImageId(img.id)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/70 font-medium'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-3.5 text-center text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={img.cropPreviewUrl || img.url}
                                  alt=""
                                  className="w-9 h-9 object-cover rounded-lg border border-slate-200"
                                />
                                <div className="min-w-0 max-w-[200px]">
                                  <span className="font-bold text-slate-800 block truncate" title={img.name}>
                                    {img.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    {img.type || 'image/jpeg'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3.5 font-mono">
                              <strong className="text-blue-700 block">{formatBytes(img.size)}</strong>
                              <span className="text-[10px] text-slate-400">
                                {img.size.toLocaleString()} B
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 font-mono">
                              <span>{img.width} × {img.height}</span>
                              <span className="text-[10px] text-slate-400 block">
                                {((img.width * img.height) / 1000000).toFixed(1)} MP
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isUnder50K
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isUnder50K ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {isUnder50K ? 'Allowed' : 'Exceeds'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isUnder100K
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isUnder100K ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {isUnder100K ? 'Allowed' : 'Exceeds'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedImageId(img.id);
                                  setInfoTargetItem(img);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                                title="View image details"
                              >
                                <Info className="w-3.5 h-3.5 text-slate-600" />
                                <span>Info</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : tool.id === 'image-color-picker' ? (
              /* Dedicated Interactive Pixel Color Picker Workspace */
              <ImageColorPickerWorkspace />
            ) : tool.id === 'image-metadata-viewer' ? (
              /* Dedicated Technical EXIF & Metadata Inspector Workspace */
              <ImageMetadataViewerWorkspace />
            ) : tool.id === 'image-metadata-remover' ? (
              /* Dedicated Privacy EXIF Stripper & Audit Workspace */
              <ImageMetadataRemoverWorkspace />
            ) : (
              /* Cards Grid View (Standard) */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {images.map((item) => (
                  <ImageCard
                    key={item.id}
                    item={item}
                    toolId={tool.id}
                    resizeSettings={resizeSettings}
                    isSelected={selectedImageId === item.id}
                    onSelect={(id) => setSelectedImageId(id)}
                    onOpenCrop={(target) => setCropTargetItem(target)}
                    onOpenInfo={(target) => setInfoTargetItem(target)}
                    onRotate={(id) => rotateImage(id, 90)}
                    onFlip={(id, dir) => flipImage(id, dir)}
                    onRemove={(id) => removeImage(id)}
                  />
                ))}
              </div>
            )}
          </main>
          </div>
          )}
        </div>

        {/* Right Side AdSlot */}
        <AdSlot position="right" />
      </div>

      {/* Modals */}
      <CropModal
        item={cropTargetItem}
        onClose={() => setCropTargetItem(null)}
        onApplyCrop={(id, cropData, previewUrl) => setCropData(id, cropData, previewUrl)}
        initialAspectRatio={cropSettings.aspectRatio}
      />

      <InfoModal
        item={infoTargetItem}
        onClose={() => setInfoTargetItem(null)}
      />

      {exportModalOpen && (
        <ExportModal
          results={processedResults}
          onClose={() => setExportModalOpen(false)}
          onStartNew={() => {
            clearImages();
            setExportModalOpen(false);
            onNavigate(`/${tool.slug}`);
          }}
          isProcessing={isProcessing}
          processProgress={processProgress}
        />
      )}
    </div>
  );
};