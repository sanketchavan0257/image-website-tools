import React, { useState, useEffect } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { downloadFile } from '../../../services/zipExport';
import { formatBytes } from '../../../config/plans';
import { Base64ToImageConverter } from '../../tools/Base64ToImageConverter';
import JSZip from 'jszip';
import {
  Copy,
  Check,
  Download,
  Binary,
  Code,
  FileImage,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Archive,
  Braces,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface Base64SettingsProps {
  toolId: string;
}

export const Base64Settings: React.FC<Base64SettingsProps> = ({ toolId }) => {
  const { images, selectedImageId, setSelectedImageId, setToastMessage } =
    useImageStore();
  const [base64Map, setBase64Map] = useState<Record<string, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'single' | 'all'>('single');
  const [isZipping, setIsZipping] = useState(false);

  // Active image selection logic
  const activeIndex = images.findIndex((img) => img.id === selectedImageId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeImage = images[currentIndex] || images[0];

  // Set initial selectedImageId if not set
  useEffect(() => {
    if (!selectedImageId && images.length > 0) {
      setSelectedImageId(images[0].id);
    }
  }, [selectedImageId, images, setSelectedImageId]);

  // Convert all images to Base64 asynchronously and cache them
  useEffect(() => {
    if (toolId !== 'image-to-base64' || images.length === 0) return;

    images.forEach((item) => {
      // If already cached, don't re-read unless crop updated
      if (base64Map[item.id]) return;

      setLoadingMap((prev) => ({ ...prev, [item.id]: true }));

      // If cropped, use canvas or cropPreviewUrl
      if (item.cropPreviewUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || item.width;
          canvas.height = img.naturalHeight || item.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL(item.type || 'image/png');
            setBase64Map((prev) => ({ ...prev, [item.id]: dataUrl }));
          }
          setLoadingMap((prev) => ({ ...prev, [item.id]: false }));
        };
        img.onerror = () => {
          // Fallback to file reader
          readFileDirectly(item);
        };
        img.src = item.cropPreviewUrl;
      } else {
        readFileDirectly(item);
      }
    });

    function readFileDirectly(item: (typeof images)[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || '';
        setBase64Map((prev) => ({ ...prev, [item.id]: result }));
        setLoadingMap((prev) => ({ ...prev, [item.id]: false }));
      };
      reader.onerror = () => {
        setLoadingMap((prev) => ({ ...prev, [item.id]: false }));
      };
      reader.readAsDataURL(item.file);
    }
  }, [images, toolId, base64Map]);

  const activeBase64 = activeImage ? base64Map[activeImage.id] || '' : '';
  const isLoadingActive = activeImage ? Boolean(loadingMap[activeImage.id]) : false;

  const copyToClipboard = (text: string, key: string, label?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (label && setToastMessage) {
      setToastMessage(`Copied: ${label}`);
    }
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

  // Extract raw Base64 without data URI header
  const getRawBase64 = (dataUri: string) => {
    const commaIndex = dataUri.indexOf(',');
    return commaIndex !== -1 ? dataUri.substring(commaIndex + 1) : dataUri;
  };

  // Download active image Base64 as .txt file
  const handleDownloadSingleTxt = () => {
    if (!activeImage || !activeBase64) return;
    const baseName = activeImage.name.replace(/\.[a-zA-Z0-9]+$/i, '');
    const filename = `${baseName}_base64.txt`;
    const blob = new Blob([activeBase64], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, filename);
  };

  // Copy all Base64 as JSON
  const handleCopyAllAsJson = () => {
    const jsonOutput = images.map((img) => ({
      name: img.name,
      type: img.type || 'image/jpeg',
      originalSize: img.size,
      width: img.width,
      height: img.height,
      dataUri: base64Map[img.id] || '',
    }));
    copyToClipboard(
      JSON.stringify(jsonOutput, null, 2),
      'all-json',
      `All ${images.length} Base64 images as JSON`
    );
  };

  // Copy all Base64 as plain Data URIs (newline-separated)
  const handleCopyAllDataUrls = () => {
    const allUrls = images
      .map((img) => `/* ${img.name} */\n${base64Map[img.id] || ''}`)
      .join('\n\n');
    copyToClipboard(
      allUrls,
      'all-urls',
      `All ${images.length} Base64 Data URLs`
    );
  };

  // Download all Base64 as JSON file
  const handleDownloadAllJson = () => {
    const jsonOutput = images.map((img) => ({
      name: img.name,
      type: img.type || 'image/jpeg',
      originalSize: img.size,
      width: img.width,
      height: img.height,
      dataUri: base64Map[img.id] || '',
    }));
    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    downloadFile(blob, 'pixiforge_all_base64.json');
  };

  // Download all Base64 as ZIP of .txt files
  const handleDownloadAllZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      images.forEach((img) => {
        const baseName = img.name.replace(/\.[a-zA-Z0-9]+$/i, '');
        const content = base64Map[img.id] || '';
        zip.file(`${baseName}_base64.txt`, content);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, 'pixiforge_base64_batch.zip');
    } catch (e) {
      console.error('Failed to create Base64 zip:', e);
    } finally {
      setIsZipping(false);
    }
  };

  if (toolId === 'image-to-base64' && images.length === 0) {
    return (
      <div className="p-4 text-xs text-slate-500">
        Please upload images to generate Base64 strings.
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-800 text-xs">
      {/* Tool: Image to Base64 */}
      {toolId === 'image-to-base64' && (
        <div className="space-y-4">
          {/* Multi-Image Navigation Selector Header (When images.length > 1) */}
          {images.length > 1 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Image <strong className="text-blue-700 font-bold">#{currentIndex + 1}</strong> of {images.length}
                  </span>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="p-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Previous Image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="p-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Next Image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick thumbnail pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, idx) => {
                  const isSelected = img.id === activeImage?.id;
                  const isReady = Boolean(base64Map[img.id]);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => {
                        setSelectedImageId(img.id);
                        setViewTab('single');
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
                      <span className="max-w-[70px] truncate">
                        {idx + 1}. {img.name}
                      </span>
                      <span
                        className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                          isSelected
                            ? 'bg-blue-700/80 text-blue-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isReady ? formatBytes(img.size) : '...'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* View Switcher: Single Image vs All Images */}
              <div className="flex p-0.5 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewTab('single')}
                  className={`flex-1 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                    viewTab === 'single'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Selected Image (#{currentIndex + 1})
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('all')}
                  className={`flex-1 py-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer ${
                    viewTab === 'all'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Images ({images.length})
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Selected Image Details */}
          {viewTab === 'single' && (
            <div className="space-y-4">
              {/* Header info */}
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-[200px]" title={activeImage?.name}>
                  <Binary className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">{activeImage?.name}</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                  {isLoadingActive
                    ? 'Encoding...'
                    : activeBase64
                    ? `~${Math.round(activeBase64.length / 1024)} KB encoded`
                    : 'Loading...'}
                </span>
              </div>

              {/* Textarea with code preview */}
              <div className="relative">
                <textarea
                  readOnly
                  value={
                    isLoadingActive
                      ? 'Encoding image to Base64...'
                      : activeBase64 || 'Preparing Base64 string...'
                  }
                  rows={6}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-600 focus:outline-none resize-none"
                />
                {isLoadingActive && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                      <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Encoding image...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Image Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!activeBase64 || isLoadingActive}
                  onClick={() =>
                    copyToClipboard(
                      activeBase64,
                      'raw-uri',
                      `Base64 Data URL for "${activeImage?.name}"`
                    )
                  }
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedKey === 'raw-uri' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  <span>
                    {copiedKey === 'raw-uri'
                      ? '✓ Copied Data URL!'
                      : 'Copy Base64 Data URL'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!activeBase64 || isLoadingActive}
                    onClick={() =>
                      copyToClipboard(
                        `<img src="${activeBase64}" alt="${activeImage?.name || 'Image'}" />`,
                        'html',
                        `HTML <img> tag for "${activeImage?.name}"`
                      )
                    }
                    className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer text-[11px]"
                    title="Copy HTML <img> tag with embedded data URI"
                  >
                    {copiedKey === 'html' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Code className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{copiedKey === 'html' ? 'Copied HTML!' : 'Copy <img>'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!activeBase64 || isLoadingActive}
                    onClick={() =>
                      copyToClipboard(
                        `background-image: url("${activeBase64}");`,
                        'css',
                        `CSS background for "${activeImage?.name}"`
                      )
                    }
                    className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer text-[11px]"
                    title="Copy CSS background-image declaration"
                  >
                    {copiedKey === 'css' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <FileImage className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{copiedKey === 'css' ? 'Copied CSS!' : 'Copy CSS'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!activeBase64 || isLoadingActive}
                    onClick={() =>
                      copyToClipboard(
                        getRawBase64(activeBase64),
                        'raw-only',
                        `Raw Base64 string for "${activeImage?.name}"`
                      )
                    }
                    className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer text-[11px]"
                    title="Copy pure Base64 without data:image prefix"
                  >
                    {copiedKey === 'raw-only' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Binary className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>
                      {copiedKey === 'raw-only' ? 'Copied Raw!' : 'Raw Base64'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={!activeBase64 || isLoadingActive}
                    onClick={handleDownloadSingleTxt}
                    className="py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer text-[11px]"
                    title="Download this image's Base64 code as a .txt file"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: All Images Batch Operations */}
          {viewTab === 'all' && images.length > 1 && (
            <div className="space-y-3.5">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                  <span>Batch Base64 Summary</span>
                  <span>{images.length} Images</span>
                </div>
                <p className="text-[11px] text-blue-700">
                  Copy all encoded images at once or download as a JSON file or ZIP package.
                </p>
              </div>

              {/* Batch Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCopyAllAsJson}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedKey === 'all-json' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Braces className="w-4 h-4" />
                  )}
                  <span>
                    {copiedKey === 'all-json'
                      ? '✓ Copied All JSON!'
                      : `Copy All ${images.length} Images as JSON`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllDataUrls}
                  className="w-full py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {copiedKey === 'all-urls' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                  <span>
                    {copiedKey === 'all-urls'
                      ? '✓ Copied All URLs!'
                      : 'Copy All Data URLs (List)'}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAllJson}
                    className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer text-[11px]"
                    title="Download JSON containing all images"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download JSON</span>
                  </button>

                  <button
                    type="button"
                    disabled={isZipping}
                    onClick={handleDownloadAllZip}
                    className="py-2 px-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors cursor-pointer text-[11px]"
                    title="Download ZIP with individual .txt files for all images"
                  >
                    {isZipping ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Archive className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{isZipping ? 'Zipping...' : 'Download ZIP'}</span>
                  </button>
                </div>
              </div>

              {/* File-by-file quick copy list */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="font-semibold text-slate-700 block text-[11px]">
                  Individual Images Quick Copy:
                </span>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {images.map((img, idx) => {
                    const b64 = base64Map[img.id] || '';
                    const isSelected = img.id === activeImage?.id;
                    const isCopied = copiedKey === `item-${img.id}`;
                    return (
                      <div
                        key={img.id}
                        onClick={() => setSelectedImageId(img.id)}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={img.cropPreviewUrl || img.url}
                            alt=""
                            className="w-7 h-7 object-cover rounded-md shrink-0 bg-slate-100"
                          />
                          <div className="min-w-0">
                            <h5
                              className="text-[11px] font-semibold text-slate-800 truncate"
                              title={img.name}
                            >
                              {idx + 1}. {img.name}
                            </h5>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {formatBytes(img.size)}
                              {b64 ? ` (~${Math.round(b64.length / 1024)} KB)` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={!b64}
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(
                                b64,
                                `item-${img.id}`,
                                `Base64 for "${img.name}"`
                              );
                            }}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                            }`}
                            title={`Copy Base64 Data URL for ${img.name}`}
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span className="text-[10px]">
                              {isCopied ? 'Copied' : 'Copy'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tool: Base64 to Image */}
      {toolId === 'base64-to-image' && (
        <div className="space-y-4">
          <Base64ToImageConverter isInsideEditor={true} />
        </div>
      )}
    </div>
  );
};
