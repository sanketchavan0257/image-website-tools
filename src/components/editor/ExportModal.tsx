import React, { useState, useEffect } from 'react';
import { ProcessedResultItem } from '../../types';
import { formatBytes } from '../../config/plans';
import {
  downloadFile,
  downloadAsZip,
  downloadSeparately,
  getLastDownloadPreference,
  saveDownloadPreference,
} from '../../services/zipExport';
import {
  X,
  Download,
  Archive,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileDown,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface ExportModalProps {
  results: ProcessedResultItem[];
  onClose: () => void;
  onStartNew?: () => void;
  isProcessing: boolean;
  processProgress: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  results,
  onClose,
  onStartNew,
  isProcessing,
  processProgress,
}) => {
  const [downloadPref, setDownloadPref] = useState<'zip' | 'separate'>('zip');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [downloadCompleted, setDownloadCompleted] = useState(results.length === 1);

  useEffect(() => {
    setDownloadPref(getLastDownloadPreference());
    if (results.length === 1) {
      setDownloadCompleted(true);
    }
  }, [results.length]);

  const totalOriginalSize = results.reduce((acc, r) => acc + r.originalSize, 0);
  const totalProcessedSize = results.reduce((acc, r) => acc + r.processedSize, 0);
  const totalDifference = totalOriginalSize - totalProcessedSize;
  const totalPercentageSaved =
    totalOriginalSize > 0
      ? Math.round((totalDifference / totalOriginalSize) * 100)
      : 0;

  const handleSelectPreference = (pref: 'zip' | 'separate') => {
    setDownloadPref(pref);
    saveDownloadPreference(pref);
  };

  const handleExecuteDownload = async () => {
    if (results.length === 0) return;
    setIsDownloading(true);

    try {
      if (results.length === 1) {
        // Single image downloads directly
        downloadFile(results[0].blob, results[0].newName);
        setDownloadCompleted(true);
      } else {
        if (downloadPref === 'zip') {
          await downloadAsZip(results, 'pixiforge_images.zip');
          setDownloadCompleted(true);
        } else {
          setDownloadProgress({ current: 0, total: results.length });
          await downloadSeparately(results, (cur, total) => {
            setDownloadProgress({ current: cur, total });
          });
          setDownloadCompleted(true);
        }
      }
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Images Ready for Download</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {results.length} {results.length === 1 ? 'image' : 'images'} successfully processed
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Box */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/80 rounded-2xl p-4.5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total File Size
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base text-slate-500 line-through">
                  {formatBytes(totalOriginalSize)}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="text-xl font-bold text-slate-900">
                  {formatBytes(totalProcessedSize)}
                </span>
              </div>
            </div>

            {totalPercentageSaved > 0 ? (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm">
                Saved {totalPercentageSaved}% ({formatBytes(totalDifference)})
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm">
                Optimized
              </div>
            )}
          </div>

          {/* Multiple Images Download Mode Selection */}
          {results.length > 1 && (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2 uppercase tracking-wider">
                Choose Download Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectPreference('zip')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    downloadPref === 'zip'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      downloadPref === 'zip'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Archive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Download as ZIP</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Single .zip archive with all {results.length} files. Recommended.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreference('separate')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    downloadPref === 'separate'
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl ${
                      downloadPref === 'separate'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">Download Separately</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sequential downloads (~300ms delay per file).
                    </p>
                  </div>
                </button>
              </div>

              {downloadPref === 'separate' && (
                <div className="mt-2.5 flex items-start gap-2 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 text-[11px] text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Browser Hint:</strong> If your browser prompts you, please click
                    "Allow" to accept multiple file downloads.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* List of Processed Files */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Individual Files ({results.length})
            </h4>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {results.map((r) => {
                const itemSavings =
                  r.originalSize > 0
                    ? Math.round(((r.originalSize - r.processedSize) / r.originalSize) * 100)
                    : 0;

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <img
                        src={r.url}
                        alt={r.newName}
                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate" title={r.newName}>
                          {r.newName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>{formatBytes(r.processedSize)}</span>
                          <span>•</span>
                          <span>
                            {r.processedDimensions.width} × {r.processedDimensions.height} px
                          </span>
                          {itemSavings > 0 && (
                            <span className="text-emerald-600 font-semibold">
                              (-{itemSavings}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => downloadFile(r.blob, r.newName)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer shrink-0"
                      title="Download this file only"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Back to Editor
            </button>
            {onStartNew && (
              <button
                onClick={onStartNew}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer border border-blue-200"
              >
                + Process New Images
              </button>
            )}
          </div>

          <button
            disabled={isDownloading}
            onClick={handleExecuteDownload}
            className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
              downloadCompleted
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
            }`}
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {downloadPref === 'separate' && downloadProgress.total > 0
                    ? `Downloading ${downloadProgress.current}/${downloadProgress.total}...`
                    : 'Packing files...'}
                </span>
              </>
            ) : downloadCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Downloaded Successfully! Download Again</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {results.length === 1
                    ? 'Download Image'
                    : downloadPref === 'zip'
                    ? 'Download All (ZIP)'
                    : 'Download All (Separately)'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
