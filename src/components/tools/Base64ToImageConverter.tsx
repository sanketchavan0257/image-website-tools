import React, { useState, useEffect, useRef } from 'react';
import { useImageStore } from '../../store/useImageStore';
import {
  decodeBase64ToImage,
  extractBase64Items,
  SAMPLE_BASE64_IMAGE,
  DecodedBase64Result,
} from '../../services/base64Decoder';
import { downloadFile } from '../../services/zipExport';
import { formatBytes } from '../../config/plans';
import JSZip from 'jszip';
import {
  Download,
  Copy,
  Check,
  Clipboard,
  FileCode,
  Sparkles,
  Trash2,
  Upload,
  ArrowRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  Archive,
} from 'lucide-react';

interface Base64ToImageConverterProps {
  onImagesReady?: () => void;
  isInsideEditor?: boolean;
}

export const Base64ToImageConverter: React.FC<Base64ToImageConverterProps> = ({
  onImagesReady,
  isInsideEditor = false,
}) => {
  const { addBase64Images, setToastMessage } = useImageStore();
  const [inputText, setInputText] = useState<string>('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decodedResults, setDecodedResults] = useState<DecodedBase64Result[]>([]);
  const [targetFormat, setTargetFormat] = useState<'original' | 'png' | 'jpeg' | 'webp'>('original');
  const [quality, setQuality] = useState<number>(0.92);
  const [isZipping, setIsZipping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-decode on paste or input change with debounce
  useEffect(() => {
    if (!inputText.trim()) {
      setDecodedResults([]);
      setErrorMessage(null);
      return;
    }

    const timer = setTimeout(() => {
      handleDecode(inputText);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputText]);

  const handleDecode = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setIsDecoding(true);
    setErrorMessage(null);

    try {
      const items = extractBase64Items(trimmed);
      if (items.length === 0) {
        setErrorMessage('No Base64 image data found in input.');
        setDecodedResults([]);
        setIsDecoding(false);
        return;
      }

      const results: DecodedBase64Result[] = [];
      let failCount = 0;

      for (let i = 0; i < items.length; i++) {
        try {
          const res = await decodeBase64ToImage(items[i].base64, items[i].name, i + 1);
          results.push(res);
        } catch (err) {
          failCount++;
        }
      }

      if (results.length === 0) {
        setErrorMessage(
          'Could not decode image from the provided Base64 string. Please verify the string is a valid image data URI or raw Base64 data.'
        );
        setDecodedResults([]);
      } else {
        setDecodedResults(results);
        if (failCount > 0) {
          setErrorMessage(
            `Decoded ${results.length} image(s). ${failCount} item(s) could not be parsed.`
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error parsing Base64 content.');
      setDecodedResults([]);
    } finally {
      setIsDecoding(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setToastMessage('Clipboard is empty.');
        return;
      }
      setInputText(text);
      setToastMessage('Pasted from clipboard!');
    } catch {
      setToastMessage('Clipboard access denied. Please press Ctrl+V / Cmd+V in the box.');
    }
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_BASE64_IMAGE);
    setToastMessage('Loaded sample Base64 graphic!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setInputText(content);
      setToastMessage(`Loaded file: ${file.name}`);
    };
    reader.onerror = () => {
      setToastMessage('Failed to read file contents.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export single decoded item in chosen format
  const handleDownloadSingle = async (item: DecodedBase64Result) => {
    try {
      if (targetFormat === 'original') {
        downloadFile(item.blob, item.name);
        setToastMessage(`Downloaded ${item.name}`);
        return;
      }

      // Convert to specified format via canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = item.width;
        canvas.height = item.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          downloadFile(item.blob, item.name);
          return;
        }

        if (targetFormat === 'jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);

        const mime = `image/${targetFormat}`;
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const baseName = item.name.replace(/\.[a-zA-Z0-9]+$/i, '');
              const ext = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
              downloadFile(blob, `${baseName}.${ext}`);
              setToastMessage(`Downloaded ${baseName}.${ext}`);
            } else {
              downloadFile(item.blob, item.name);
            }
          },
          mime,
          quality
        );
      };
      img.src = item.dataUrl;
    } catch (e) {
      downloadFile(item.blob, item.name);
    }
  };

  // Download all decoded as ZIP
  const handleDownloadAllZip = async () => {
    if (decodedResults.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const item of decodedResults) {
        zip.file(item.name, item.blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, 'decoded_base64_images.zip');
      setToastMessage('Downloaded all decoded images in ZIP!');
    } catch (e) {
      console.error('Failed to create zip:', e);
      setToastMessage('Failed to create ZIP package.');
    } finally {
      setIsZipping(false);
    }
  };

  // Send decoded images to full App editor
  const handleOpenInEditor = async () => {
    if (decodedResults.length === 0) return;
    const itemsToAdd = decodedResults.map((res) => ({
      base64: res.dataUrl,
      name: res.name,
    }));

    const res = await addBase64Images(itemsToAdd, { replace: !isInsideEditor });
    if (res.added > 0) {
      setToastMessage(`Added ${res.added} decoded images to Editor!`);
      if (onImagesReady) {
        onImagesReady();
      }
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Input Box Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Paste or Upload Base64 Code
              </h3>
              <p className="text-xs text-slate-500">
                Supports Data URIs (`data:image/png;base64,...`) and raw Base64 strings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Try with a sample image"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Sample</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Load from .txt or .json file"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>File (.txt/.json)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,.b64,text/plain,application/json"
              className="hidden"
              onChange={handleFileUpload}
            />

            {inputText && (
              <button
                type="button"
                onClick={() => {
                  setInputText('');
                  setDecodedResults([]);
                  setErrorMessage(null);
                }}
                className="px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Clear input"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Text Area */}
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your Base64 image code here... (e.g. data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA... or raw Base64 string)"
            rows={isInsideEditor ? 4 : 6}
            className="w-full p-4 rounded-2xl bg-slate-50/70 border border-slate-200 font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all leading-relaxed resize-y"
          />

          {isDecoding && (
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs text-xs text-blue-600 font-medium">
              <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Decoding...</span>
            </div>
          )}
        </div>

        {/* Format Selector Bar */}
        <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-700">Save As:</span>
            <div className="inline-flex rounded-xl bg-slate-200/70 p-0.5">
              {(
                [
                  { id: 'original', label: 'Auto (Original)' },
                  { id: 'png', label: 'PNG' },
                  { id: 'jpeg', label: 'JPG' },
                  { id: 'webp', label: 'WebP' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setTargetFormat(fmt.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    targetFormat === fmt.id
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {(targetFormat === 'jpeg' || targetFormat === 'webp') && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Quality:</span>
              <input
                type="range"
                min="0.4"
                max="1.0"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-20 accent-blue-600 cursor-pointer"
              />
              <span className="font-mono font-bold text-slate-700">
                {Math.round(quality * 100)}%
              </span>
            </div>
          )}

          {decodedResults.length > 0 && (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {decodedResults.length} {decodedResults.length === 1 ? 'image' : 'images'} ready
              </span>
            </span>
          )}
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}
      </div>

      {/* Decoded Results Grid */}
      {decodedResults.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Decoded Images</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  {decodedResults.length}
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                Preview your reconstructed image and download directly or open in editor
              </p>
            </div>

            <div className="flex items-center gap-2">
              {decodedResults.length > 1 && (
                <button
                  type="button"
                  disabled={isZipping}
                  onClick={handleDownloadAllZip}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isZipping ? 'Zipping...' : 'Download All (ZIP)'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleOpenInEditor}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <span>Open in Image Editor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {decodedResults.map((item, idx) => (
              <div
                key={item.id}
                className="group relative bg-slate-50/60 rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-md transition-all flex flex-col"
              >
                {/* Checkerboard Image Container */}
                <div className="relative aspect-video w-full bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] flex items-center justify-center p-3 border-b border-slate-100">
                  <img
                    src={item.dataUrl}
                    alt={item.name}
                    className="max-h-full max-w-full object-contain rounded-md shadow-xs group-hover:scale-102 transition-transform"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-bold text-slate-700 uppercase tracking-wider border border-slate-200 shadow-2xs">
                    {targetFormat === 'original' ? item.extension : targetFormat}
                  </span>
                </div>

                {/* Info & Action Bar */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h5
                      className="font-bold text-xs text-slate-900 truncate"
                      title={item.name}
                    >
                      {idx + 1}. {item.name}
                    </h5>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>{item.width} × {item.height} px</span>
                      <span>•</span>
                      <span>{formatBytes(item.sizeBytes)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
