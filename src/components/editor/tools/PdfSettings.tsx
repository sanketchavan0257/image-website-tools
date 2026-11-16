import React, { useState } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { downloadFile } from '../../../services/zipExport';
import {
  generateCombinedPdf,
  generateSinglePdf,
  downloadAllSeparatePdfsAsZip,
  downloadAllSeparatePdfsDirectly,
  getPdfFilename,
} from '../../../services/pdfConverter';
import {
  FileText,
  Download,
  Check,
  FileSpreadsheet,
  Layers,
  FolderArchive,
  Sparkles,
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PdfSettingsProps {
  toolId: string;
}

export const PdfSettings: React.FC<PdfSettingsProps> = ({ toolId }) => {
  const { images, pdfSettings, updatePdfSettings } = useImageStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number } | null>(null);
  const [downloadingSingleId, setDownloadingSingleId] = useState<string | null>(null);
  const [showIndividualList, setShowIndividualList] = useState(true);

  // PDF to Image state (for toolId === 'pdf-to-image')
  const [extractFormat, setExtractFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [extractDpi, setExtractDpi] = useState<number>(150);
  const [isExtracting, setIsExtracting] = useState(false);

  // Handler for Combined 1 PDF
  const handleGenerateCombinedPdf = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    setCurrentProgress({ current: 0, total: images.length });

    try {
      const pdfBlob = await generateCombinedPdf(images, pdfSettings, (curr, tot) => {
        setCurrentProgress({ current: curr, total: tot });
      });
      const filename = images.length === 1 ? getPdfFilename(images[0]) : `all_${images.length}_images_merged.pdf`;
      downloadFile(pdfBlob, filename);
    } catch (err) {
      console.error('Failed generating combined PDF:', err);
    } finally {
      setIsGenerating(false);
      setCurrentProgress(null);
    }
  };

  // Handler for All Separate PDFs as ZIP
  const handleDownloadAllAsZip = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    try {
      await downloadAllSeparatePdfsAsZip(images, pdfSettings);
    } catch (err) {
      console.error('Failed generating separate PDFs ZIP:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler for downloading each separate PDF sequentially
  const handleDownloadAllSeparately = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    setCurrentProgress({ current: 0, total: images.length });
    try {
      await downloadAllSeparatePdfsDirectly(images, pdfSettings, (curr, tot) => {
        setCurrentProgress({ current: curr, total: tot });
      });
    } catch (err) {
      console.error('Failed downloading separate PDFs:', err);
    } finally {
      setIsGenerating(false);
      setCurrentProgress(null);
    }
  };

  // Handler for downloading a single specific image's separate PDF
  const handleDownloadSinglePdf = async (item: typeof images[0]) => {
    setDownloadingSingleId(item.id);
    try {
      const blob = await generateSinglePdf(item, pdfSettings);
      downloadFile(blob, getPdfFilename(item));
    } catch (err) {
      console.error('Failed downloading single PDF:', err);
    } finally {
      setDownloadingSingleId(null);
    }
  };

  // Single page extraction handler
  const handleDownloadSingleExtractedPage = async (item: typeof images[0], idx: number) => {
    setDownloadingSingleId(item.id);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
        img.src = item.url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || item.width;
      canvas.height = img.naturalHeight || item.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (extractFormat === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const ext = extractFormat === 'image/png' ? 'png' : 'jpg';
        const blob = await new Promise<Blob>((res) => {
          canvas.toBlob((b) => res(b || new Blob()), extractFormat, 0.94);
        });

        const base = item.name.replace(/\.[a-zA-Z0-9]+$/i, '').trim() || `page_${idx + 1}`;
        const finalName = base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
        downloadFile(blob, finalName);
      }
    } catch (err) {
      console.error('Failed single page extraction:', err);
    } finally {
      setDownloadingSingleId(null);
    }
  };

  // Download all pages sequentially
  const handleDownloadAllExtractedSeparately = async () => {
    if (images.length === 0) return;
    setIsExtracting(true);
    setCurrentProgress({ current: 0, total: images.length });

    try {
      for (let i = 0; i < images.length; i++) {
        await handleDownloadSingleExtractedPage(images[i], i);
        setCurrentProgress({ current: i + 1, total: images.length });
        await new Promise((r) => setTimeout(r, 220));
      }
    } catch (err) {
      console.error('Failed downloading separate images:', err);
    } finally {
      setIsExtracting(false);
      setCurrentProgress(null);
    }
  };

  // PDF to Image extraction handler (Combined ZIP or Single direct file)
  const handleExtractPdfPages = async () => {
    if (images.length === 0) return;
    setIsExtracting(true);
    setCurrentProgress({ current: 0, total: images.length });

    try {
      const extractedFiles: { name: string; blob: Blob }[] = [];

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res) => {
          img.onload = res;
          img.onerror = res;
          img.src = item.url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || item.width;
        canvas.height = img.naturalHeight || item.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        if (extractFormat === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const ext = extractFormat === 'image/png' ? 'png' : 'jpg';
        const blob = await new Promise<Blob>((res) => {
          canvas.toBlob((b) => res(b || new Blob()), extractFormat, 0.94);
        });

        const base = item.name.replace(/\.[a-zA-Z0-9]+$/i, '').trim() || `page_${i + 1}`;
        const finalName = base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;

        extractedFiles.push({
          name: finalName,
          blob,
        });

        setCurrentProgress({ current: i + 1, total: images.length });
      }

      if (extractedFiles.length === 1) {
        downloadFile(extractedFiles[0].blob, extractedFiles[0].name);
      } else {
        const { createZipBlob } = await import('../../../services/zipExport');
        const zipBlob = await createZipBlob(extractedFiles);
        downloadFile(zipBlob, 'extracted_pdf_pages.zip');
      }
    } catch (err) {
      console.error('Failed extracting PDF pages:', err);
    } finally {
      setIsExtracting(false);
      setCurrentProgress(null);
    }
  };

  // VIEW FOR PDF TO IMAGE TOOL
  if (toolId === 'pdf-to-image') {
    return (
      <div className="space-y-4 text-slate-800 text-xs">
        {/* Settings Box */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>PDF to Image Settings</span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Output Image Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExtractFormat('image/jpeg')}
                className={`py-2 px-3 rounded-xl border font-semibold transition-all cursor-pointer ${
                  extractFormat === 'image/jpeg'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                JPG (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setExtractFormat('image/png')}
                className={`py-2 px-3 rounded-xl border font-semibold transition-all cursor-pointer ${
                  extractFormat === 'image/png'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Lossless PNG
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Page Quality
            </label>
            <select
              value={extractDpi}
              onChange={(e) => setExtractDpi(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="150">Standard Clear Quality (150 DPI)</option>
              <option value="300">Ultra High Definition (300 DPI)</option>
            </select>
          </div>
        </div>

        {/* Progress indicator if extracting */}
        {currentProgress && isExtracting && (
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center animate-fade-in">
            <p className="font-semibold text-blue-800 text-xs mb-1">
              Converting page {currentProgress.current} of {currentProgress.total}...
            </p>
            <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-200"
                style={{
                  width: `${Math.round((currentProgress.current / currentProgress.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Primary Download Button: ZIP for multiple or direct for single */}
        <button
          disabled={isExtracting || images.length === 0}
          type="button"
          onClick={handleExtractPdfPages}
          className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
        >
          {isExtracting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Extracting Pages...</span>
            </>
          ) : images.length === 1 ? (
            <>
              <Download className="w-4 h-4" />
              <span>Download Image ({extractFormat === 'image/png' ? 'PNG' : 'JPG'})</span>
            </>
          ) : (
            <>
              <FolderArchive className="w-4 h-4" />
              <span>Download All as ZIP ({images.length} {extractFormat === 'image/png' ? 'PNGs' : 'JPGs'})</span>
            </>
          )}
        </button>

        {/* Secondary Download Button for multi-page: 1-by-1 */}
        {images.length > 1 && (
          <button
            disabled={isExtracting || images.length === 0}
            type="button"
            onClick={handleDownloadAllExtractedSeparately}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200 text-xs"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-slate-600" />
            <span>Download 1-by-1 (Direct Files)</span>
          </button>
        )}

        {/* Collapsible Individual Pages List */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowIndividualList((prev) => !prev)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-800 text-xs">
                Individual Pages ({images.length})
              </span>
            </div>
            {showIndividualList ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showIndividualList && (
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto px-2 pb-2">
              {images.map((item, idx) => {
                const isDownloading = downloadingSingleId === item.id;
                const ext = extractFormat === 'image/png' ? 'png' : 'jpg';
                const base = item.name.replace(/\.[a-zA-Z0-9]+$/i, '').trim() || `page_${idx + 1}`;
                const outputName = `${base}.${ext}`;

                return (
                  <div
                    key={item.id}
                    className="p-2 flex items-center justify-between gap-2 hover:bg-white rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-800 truncate" title={outputName}>
                          {outputName}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {item.width} × {item.height} px
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDownloading || isExtracting}
                      onClick={() => handleDownloadSingleExtractedPage(item, idx)}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                      title={`Download ${outputName}`}
                    >
                      {isDownloading ? (
                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span>{ext.toUpperCase()}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // VIEW FOR IMAGE TO PDF TOOL
  return (
    <div className="space-y-4 text-slate-800 text-xs">
      {/* 1. PDF Conversion Mode Selector */}
      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span>PDF Output Mode</span>
          </label>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl">
          <button
            type="button"
            onClick={() => updatePdfSettings({ mode: 'combined' })}
            className={`p-2.5 rounded-lg text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
              pdfSettings.mode === 'combined'
                ? 'bg-white text-blue-700 shadow-xs font-bold border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 shrink-0 text-blue-600" />
              <span className="text-xs">Combined 1 PDF</span>
            </div>
            <span className="text-[10px] text-slate-500 font-normal">
              {images.length} {images.length === 1 ? 'page' : 'pages'} in 1 document
            </span>
          </button>

          <button
            type="button"
            onClick={() => updatePdfSettings({ mode: 'separate' })}
            className={`p-2.5 rounded-lg text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
              pdfSettings.mode === 'separate'
                ? 'bg-white text-blue-700 shadow-xs font-bold border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FolderArchive className="w-3.5 h-3.5 shrink-0 text-blue-600" />
              <span className="text-xs">Separate 1-by-1 PDFs</span>
            </div>
            <span className="text-[10px] text-slate-500 font-normal">
              {images.length} separate PDF {images.length === 1 ? 'file' : 'files'}
            </span>
          </button>
        </div>

        {/* Helpful Description for Selected Mode */}
        <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
          {pdfSettings.mode === 'combined' ? (
            <span>
              <strong>Combined Single PDF:</strong> All {images.length} {images.length === 1 ? 'image' : 'images'} will be merged into a single multi-page PDF document.
            </span>
          ) : (
            <span>
              <strong>Separate PDFs:</strong> Each image will be converted into its own individual 1-page PDF file. You can download all as a ZIP or 1-by-1.
            </span>
          )}
        </div>
      </div>

      {/* 2. PDF Document Page Settings */}
      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/90">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Page Setup</span>
          </span>
        </div>

        {/* Orientation */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            Page Orientation
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => updatePdfSettings({ orientation: 'auto' })}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-semibold ${
                pdfSettings.orientation === 'auto'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Automatically match each photo's orientation"
            >
              Auto (Detect)
            </button>
            <button
              type="button"
              onClick={() => updatePdfSettings({ orientation: 'portrait' })}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-semibold ${
                pdfSettings.orientation === 'portrait'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => updatePdfSettings({ orientation: 'landscape' })}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer text-xs font-semibold ${
                pdfSettings.orientation === 'landscape'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Landscape
            </button>
          </div>
        </div>

        {/* Page Size */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            Page Size
          </label>
          <select
            value={pdfSettings.pageSize}
            onChange={(e) => updatePdfSettings({ pageSize: e.target.value as any })}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="a4">A4 Standard (210 × 297 mm) - Best for Print</option>
            <option value="letter">US Letter (8.5 × 11 in)</option>
            <option value="fit">Fit to Image Size (Original Dimensions / No Margins)</option>
          </select>
        </div>

        {/* Margin Slider */}
        {pdfSettings.pageSize !== 'fit' && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Margins
              </label>
              <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">
                {pdfSettings.margin} mm
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              step="5"
              value={pdfSettings.margin}
              onChange={(e) => updatePdfSettings({ margin: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5 mt-0.5">
              <span>0mm (No Border)</span>
              <span>10mm (Standard)</span>
              <span>25mm (Wide)</span>
            </div>
          </div>
        )}

        {/* Image Fit */}
        <div>
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
            Image Fit
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updatePdfSettings({ imageFit: 'contain' })}
              className={`py-1.5 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                pdfSettings.imageFit === 'contain'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Contain (Keep Ratio)
            </button>
            <button
              type="button"
              onClick={() => updatePdfSettings({ imageFit: 'fill' })}
              className={`py-1.5 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                pdfSettings.imageFit === 'fill'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Fill (Stretch Page)
            </button>
          </div>
        </div>
      </div>

      {/* 3. Action Section Based On Active Mode */}
      {pdfSettings.mode === 'combined' ? (
        /* --- COMBINED PDF BUTTON --- */
        <div className="space-y-2">
          <button
            disabled={isGenerating || images.length === 0}
            type="button"
            onClick={handleGenerateCombinedPdf}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {currentProgress
                    ? `Merging Page ${currentProgress.current} of ${currentProgress.total}...`
                    : 'Generating PDF...'}
                </span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Combined PDF ({images.length} {images.length === 1 ? 'Page' : 'Pages'})</span>
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-slate-400">
            All {images.length} {images.length === 1 ? 'image' : 'images'} will be saved in 1 PDF document.
          </p>
        </div>
      ) : (
        /* --- SEPARATE PDFS BUTTONS & LIST --- */
        <div className="space-y-3">
          {/* Download All as ZIP (Primary) */}
          <button
            disabled={isGenerating || images.length === 0}
            type="button"
            onClick={handleDownloadAllAsZip}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating ZIP Archive...</span>
              </>
            ) : (
              <>
                <FolderArchive className="w-4 h-4" />
                <span>Download All as ZIP ({images.length} {images.length === 1 ? 'PDF' : 'PDFs'})</span>
              </>
            )}
          </button>

          {/* Download 1-by-1 sequentially (Secondary) */}
          <button
            disabled={isGenerating || images.length === 0}
            type="button"
            onClick={handleDownloadAllSeparately}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200 text-xs"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-slate-600" />
            <span>Download 1-by-1 (Direct Files)</span>
          </button>

          {/* Collapsible List of Individual Images with 1-click Download */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/90 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowIndividualList((prev) => !prev)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-bold text-slate-800 text-xs">
                  Individual PDF Downloads ({images.length})
                </span>
              </div>
              {showIndividualList ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {showIndividualList && (
              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto px-2 pb-2">
                {images.map((item, idx) => {
                  const isDownloading = downloadingSingleId === item.id;
                  const pdfName = getPdfFilename(item);

                  return (
                    <div
                      key={item.id}
                      className="p-2 flex items-center justify-between gap-2 hover:bg-white rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 truncate" title={pdfName}>
                            {pdfName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {item.width} × {item.height} px
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isDownloading || isGenerating}
                        onClick={() => handleDownloadSinglePdf(item)}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 font-semibold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title={`Download ${pdfName}`}
                      >
                        {isDownloading ? (
                          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>PDF</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
