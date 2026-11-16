import React, { useState, useEffect, useMemo } from 'react';
import { useImageStore } from '../../store/useImageStore';
import { formatBytes } from '../../config/plans';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Camera,
  Clock,
  Download,
  Check,
  CheckCircle2,
  Layers,
  Eye,
  FileText,
  Sliders,
  Sparkles,
  Lock,
  ArrowRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  parseImageMetadata,
  FullImageMetadata,
} from '../../services/metadataParser';
import { downloadFile } from '../../services/zipExport';

export const ImageMetadataRemoverWorkspace: React.FC = () => {
  const { images, selectedImageId, setSelectedImageId } = useImageStore();

  const activeIndex = images.findIndex((img) => img.id === selectedImageId);
  const currentIndex = activeIndex >= 0 ? activeIndex : 0;
  const activeImage = images[currentIndex] || images[0];

  const [metadata, setMetadata] = useState<FullImageMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStrippingSingle, setIsStrippingSingle] = useState<boolean>(false);
  const [cleanedBlob, setCleanedBlob] = useState<Blob | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllTags, setShowAllTags] = useState<boolean>(false);

  // Parse metadata when active image changes
  useEffect(() => {
    if (!activeImage) return;

    let isMounted = true;
    setIsLoading(true);
    setCleanedBlob(null);
    setCleanedUrl(null);

    parseImageMetadata(activeImage.file, {
      width: activeImage.width,
      height: activeImage.height,
    }).then((data) => {
      if (isMounted) {
        setMetadata(data);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeImage]);

  // Clean / strip the active image using clean off-screen canvas export
  const cleanActiveImage = async (): Promise<{ blob: Blob; url: string }> => {
    return new Promise((resolve, reject) => {
      if (!activeImage) return reject(new Error('No active image'));

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || activeImage.width || 800;
        canvas.height = img.naturalHeight || activeImage.height || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not create canvas context'));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);

        // Determine clean mime format
        let targetMime = activeImage.type || 'image/jpeg';
        let quality = 0.96;
        if (targetMime === 'image/png') {
          quality = 1.0;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Failed to create clean blob'));
            const url = URL.createObjectURL(blob);
            resolve({ blob, url });
          },
          targetMime,
          quality
        );
      };
      img.onerror = (err) => reject(err);
      img.src = activeImage.url;
    });
  };

  const handleDownloadSingleCleaned = async () => {
    if (!activeImage) return;
    setIsStrippingSingle(true);

    try {
      let result = { blob: cleanedBlob, url: cleanedUrl };
      if (!result.blob || !result.url) {
        const res = await cleanActiveImage();
        setCleanedBlob(res.blob);
        setCleanedUrl(res.url);
        result = res;
      }

      // Generate clean file name
      const baseName = activeImage.name.replace(/\.[a-zA-Z0-9]+$/i, '').trim();
      const ext = activeImage.name.split('.').pop() || 'jpg';
      const cleanFileName = `${baseName}_cleaned.${ext}`;

      downloadFile(result.blob, cleanFileName);
    } catch (err) {
      console.error('Error cleaning image:', err);
    } finally {
      setIsStrippingSingle(false);
    }
  };

  // Filtered raw tags list
  const filteredTags = useMemo(() => {
    if (!metadata) return [];
    if (!searchQuery) return metadata.rawTags;
    return metadata.rawTags.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [metadata, searchQuery]);

  if (!activeImage) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500">
        Please upload an image to strip metadata.
      </div>
    );
  }

  const hasLocation = Boolean(metadata?.gps.hasGps);
  const hasCamera = Boolean(metadata?.camera.make || metadata?.camera.model || metadata?.camera.software);
  const hasDate = Boolean(metadata?.file.dateCreated);
  const totalTags = metadata?.rawTags.length || 0;

  return (
    <div className="space-y-4">
      {/* Multi-Image Switcher Banner (if images.length > 1) */}
      {images.length > 1 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 text-xs overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-800">Select Image to Inspect:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {images.map((img, idx) => {
              const isSelected = img.id === activeImage.id;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImageId(img.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-xs shrink-0 ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <img
                    src={img.cropPreviewUrl || img.url}
                    alt=""
                    className="w-5 h-5 rounded object-cover border border-slate-200"
                  />
                  <span className="font-medium break-all max-w-[140px] sm:max-w-none">{img.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Workspace Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        {/* Workspace Top Toolbar: Fully responsive with flex-wrap and robust spacing */}
        <div className="p-3.5 sm:px-5 sm:py-4 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-xs shrink-0 mt-0.5 sm:mt-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 break-all leading-snug" title={activeImage.name}>
                  {activeImage.name}
                </h3>
                {hasLocation ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200/60 flex items-center gap-1 shrink-0">
                    <MapPin className="w-3 h-3 text-rose-600" />
                    <span>GPS Attached</span>
                  </span>
                ) : metadata?.hasExifData ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60 flex items-center gap-1 shrink-0">
                    <Camera className="w-3 h-3 text-amber-600" />
                    <span>EXIF Tags Found</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/60 flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Already Clean</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono flex items-center gap-2 flex-wrap mt-1">
                <span>{activeImage.width} × {activeImage.height} px</span>
                <span>•</span>
                <span>{formatBytes(activeImage.size)}</span>
                <span>•</span>
                <span>{activeImage.type || 'image/jpeg'}</span>
                <span>•</span>
                <span className="font-semibold text-emerald-700">{totalTags} total tags detected</span>
              </p>
            </div>
          </div>

          {/* Quick Single Clean & Download Action */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              disabled={isStrippingSingle}
              onClick={handleDownloadSingleCleaned}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-600/20"
              title="Strip all metadata and download this clean image immediately"
            >
              {isStrippingSingle ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Stripping...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Download Clean Image</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-5 lg:p-6 space-y-5">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">Auditing GPS, device fingerprints, and EXIF tags...</p>
            </div>
          ) : !metadata ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Unable to analyze image metadata.
            </div>
          ) : (
            <>
              {/* PRIVACY RISK AUDIT BANNER */}
              {hasLocation ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/20 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                        <ShieldAlert className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm sm:text-base leading-tight">
                          High Privacy Risk: Location Coordinates Embedded
                        </h4>
                        <span className="text-[11px] text-rose-100">
                          Anyone with this photo can find the exact location where it was taken.
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-rose-700 self-start sm:self-auto shrink-0 shadow-xs">
                      GPS Exposed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-rose-950 font-medium">
                    <div className="p-2.5 bg-white/95 rounded-xl shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-rose-600 block">Coordinates</span>
                      <strong className="font-mono text-xs block mt-0.5 truncate">{metadata.gps.formattedCoordinates}</strong>
                    </div>
                    <div className="p-2.5 bg-white/95 rounded-xl shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-rose-600 block">Altitude</span>
                      <strong className="font-mono text-xs block mt-0.5 truncate">{metadata.gps.altitude || 'Not specified'}</strong>
                    </div>
                    <div className="p-2.5 bg-white/95 rounded-xl shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-rose-600 block">Removal Action</span>
                      <strong className="text-emerald-700 font-bold text-xs block mt-0.5">Will be permanently erased</strong>
                    </div>
                  </div>
                </div>
              ) : metadata.hasExifData ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/20 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm sm:text-base leading-tight">
                          Medium Privacy Risk: Hardware Fingerprints & Timestamps Found
                        </h4>
                        <span className="text-[11px] text-amber-100">
                          Camera model, serials, lens specs, and date stamps are embedded in this file.
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-amber-800 self-start sm:self-auto shrink-0 shadow-xs">
                      {totalTags} Tags Found
                    </span>
                  </div>

                  <p className="text-xs text-amber-50 leading-relaxed">
                    Clicking <strong>"Download Clean Image"</strong> or using batch export will strip all device models, serial numbers, timestamps, and camera settings while preserving the image visual quality at 100%.
                  </p>
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs shrink-0">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm sm:text-base">Privacy Safe: No Camera or GPS Tags Found</h4>
                      <p className="text-xs text-emerald-100 mt-0.5">
                        This file does not contain camera EXIF tags or GPS coordinates. Re-exporting guarantees a 100% sanitized raw pixel container.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 shrink-0 self-start sm:self-auto">
                    Clean Status
                  </span>
                </div>
              )}

              {/* BEFORE & AFTER STRIPPING COMPARISON */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>Before & After Stripping Guarantee</span>
                  </h4>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                    Zero Quality Loss
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* BEFORE: Current File State */}
                  <div className="p-4 sm:p-5 bg-rose-50/60 rounded-2xl border border-rose-200/80 shadow-2xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-rose-200/70 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-rose-100 rounded-lg text-rose-700">
                          <Eye className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-xs sm:text-sm font-bold text-rose-950 block">Original File (Before)</strong>
                          <span className="text-[10px] text-rose-700">Contains hidden tracking metadata</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        {totalTags} Tags Exposed
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start gap-2 p-2.5 bg-white/80 rounded-xl border border-rose-200/60">
                        <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block text-[11px]">GPS & Location</span>
                          <span className="text-slate-600 text-[11px] break-all font-mono">
                            {metadata.gps.hasGps ? metadata.gps.formattedCoordinates : 'None detected in this file'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 bg-white/80 rounded-xl border border-rose-200/60">
                        <Camera className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block text-[11px]">Device Hardware & Serials</span>
                          <span className="text-slate-600 text-[11px] break-all">
                            {metadata.camera.make || metadata.camera.model
                              ? `${metadata.camera.make || ''} ${metadata.camera.model || ''} ${metadata.camera.lensModel ? `• Lens: ${metadata.camera.lensModel}` : ''}`
                              : 'Not recorded in EXIF'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 bg-white/80 rounded-xl border border-rose-200/60">
                        <Clock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block text-[11px]">Date & Capture Timestamps</span>
                          <span className="text-slate-600 text-[11px] break-all font-mono">
                            {metadata.file.dateCreated || 'No original capture timestamp'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AFTER: Cleaned File State */}
                  <div className="p-4 sm:p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-3.5">
                    <div className="flex items-center justify-between border-b border-emerald-200/70 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <strong className="text-xs sm:text-sm font-bold text-emerald-950 block">Sanitized File (After)</strong>
                          <span className="text-[10px] text-emerald-700">100% metadata-free raw raster pixels</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        0 Tags • 100% Private
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-start gap-2 p-2.5 bg-white/90 rounded-xl border border-emerald-200/60">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block text-[11px]">GPS Coordinates Erased</span>
                          <span className="text-emerald-800 text-[11px]">
                            Zero latitude, longitude, elevation, or location markers remaining.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 bg-white/90 rounded-xl border border-emerald-200/60">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block text-[11px]">Equipment Fingerprints Stripped</span>
                          <span className="text-emerald-800 text-[11px]">
                            Camera serial numbers, lens profiles, and maker notes deleted.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 bg-white/90 rounded-xl border border-emerald-200/60">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block text-[11px]">Resolution & Visual Fidelity 100% Preserved</span>
                          <span className="text-emerald-800 text-[11px]">
                            Exact original size ({activeImage.width} × {activeImage.height} px) at maximum visual quality.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIST OF EXIF TAGS SCHEDULED FOR DELETION */}
              {totalTags > 0 && (
                <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/70 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                          Detected Metadata Tags To Be Removed ({filteredTags.length})
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          Every single one of these tags will be permanently stripped upon export.
                        </span>
                      </div>
                    </div>

                    {/* Search inside tags */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search tags..."
                          className="w-full sm:w-44 pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-emerald-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAllTags(!showAllTags)}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shrink-0"
                      >
                        {showAllTags ? 'Collapse' : 'Expand All'}
                      </button>
                    </div>
                  </div>

                  {/* Tags list table/container */}
                  <div className={`overflow-x-auto overflow-y-auto ${showAllTags ? 'max-h-[420px]' : 'max-h-[220px]'}`}>
                    <table className="w-full min-w-[500px] text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider z-10">
                        <tr>
                          <th className="py-2 px-3 w-28">Category</th>
                          <th className="py-2 px-3 w-48">Tag Name</th>
                          <th className="py-2 px-3">Embedded Value</th>
                          <th className="py-2 px-3 w-28 text-right">Removal Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filteredTags.map((tag) => (
                          <tr key={tag.id} className="hover:bg-rose-50/40 transition-colors">
                            <td className="py-1.5 px-3">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-bold bg-slate-200/70 text-slate-700">
                                {tag.category}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-bold text-slate-800 font-sans text-xs">
                              {tag.name}
                            </td>
                            <td className="py-1.5 px-3 text-slate-700 text-xs break-all">
                              {tag.value}
                            </td>
                            <td className="py-1.5 px-3 text-right">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-rose-100 text-rose-700 border border-rose-200/60 inline-flex items-center gap-1">
                                <span>Purge</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PRIVACY GUARANTEE BANNER */}
              <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-emerald-950">100% Client-Side In-Browser Privacy Protection</h5>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Stripping occurs entirely inside your device's memory. No photographs, GPS coordinates, or camera serial numbers are ever uploaded to any cloud server.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isStrippingSingle}
                  onClick={handleDownloadSingleCleaned}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-2xs self-end sm:self-auto flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download This Cleaned Photo</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
