import React, { useState } from 'react';
import { useImageStore } from '../../../store/useImageStore';
import { downloadFile, createZipBlob } from '../../../services/zipExport';
import { loadImageElement, canvasToBlob } from '../../../services/imageProcessing';
import {
  Layers,
  Grid,
  Columns,
  Rows,
  Download,
  Check,
  Sparkles,
  Maximize2,
  Palette,
} from 'lucide-react';

interface CombineSplitSettingsProps {
  toolId: string;
}

export const CombineSplitSettings: React.FC<CombineSplitSettingsProps> = ({ toolId }) => {
  const { images } = useImageStore();

  // Merger state
  const [mergeDirection, setMergeDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [mergeGap, setMergeGap] = useState<number>(10);
  const [mergeBgColor, setMergeBgColor] = useState<string>('#ffffff');
  const [isMerging, setIsMerging] = useState(false);

  // Splitter state
  const [splitRows, setSplitRows] = useState<number>(2);
  const [splitCols, setSplitCols] = useState<number>(2);
  const [isSplitting, setIsSplitting] = useState(false);

  // Collage state
  const [collageLayout, setCollageLayout] = useState<'2-horizontal' | '2-vertical' | '3-left-lead' | '4-grid'>('4-grid');
  const [collageGap, setCollageGap] = useState<number>(12);
  const [collageBg, setCollageBg] = useState<string>('#ffffff');
  const [isGeneratingCollage, setIsGeneratingCollage] = useState(false);

  // 1. Handle Merge Images
  const handleMergeImages = async () => {
    if (images.length < 2) {
      alert('Please have at least 2 images loaded to merge them together.');
      return;
    }
    setIsMerging(true);

    try {
      const loadedImgs = await Promise.all(images.map((item) => loadImageElement(item.url)));

      let totalW = 0;
      let totalH = 0;

      if (mergeDirection === 'horizontal') {
        const maxH = Math.max(...loadedImgs.map((img) => img.naturalHeight || img.height));
        // Normalize each image to match maxH proportionally
        const scaledWidths = loadedImgs.map((img) => {
          const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
          return Math.round(maxH * aspect);
        });
        totalW = scaledWidths.reduce((sum, w) => sum + w, 0) + mergeGap * (loadedImgs.length - 1);
        totalH = maxH;

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = mergeBgColor;
        ctx.fillRect(0, 0, totalW, totalH);

        let currentX = 0;
        loadedImgs.forEach((img, idx) => {
          const w = scaledWidths[idx];
          ctx.drawImage(img, currentX, 0, w, totalH);
          currentX += w + mergeGap;
        });

        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        downloadFile(blob, 'merged_image_horizontal.jpg');
      } else {
        // Vertical merge
        const maxW = Math.max(...loadedImgs.map((img) => img.naturalWidth || img.width));
        const scaledHeights = loadedImgs.map((img) => {
          const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
          return Math.round(maxW / aspect);
        });
        totalW = maxW;
        totalH = scaledHeights.reduce((sum, h) => sum + h, 0) + mergeGap * (loadedImgs.length - 1);

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = mergeBgColor;
        ctx.fillRect(0, 0, totalW, totalH);

        let currentY = 0;
        loadedImgs.forEach((img, idx) => {
          const h = scaledHeights[idx];
          ctx.drawImage(img, 0, currentY, totalW, h);
          currentY += h + mergeGap;
        });

        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        downloadFile(blob, 'merged_image_vertical.jpg');
      }
    } catch (err) {
      console.error('Failed to merge images:', err);
    } finally {
      setIsMerging(false);
    }
  };

  // 2. Handle Split Image into Grid tiles
  const handleSplitImage = async () => {
    const activeImage = images[0];
    if (!activeImage) return;
    setIsSplitting(true);

    try {
      const img = await loadImageElement(activeImage.url);
      const fullW = img.naturalWidth || img.width;
      const fullH = img.naturalHeight || img.height;

      const tileW = Math.floor(fullW / splitCols);
      const tileH = Math.floor(fullH / splitRows);

      const splitResults: { name: string; blob: Blob }[] = [];

      for (let r = 0; r < splitRows; r++) {
        for (let c = 0; c < splitCols; c++) {
          const canvas = document.createElement('canvas');
          canvas.width = tileW;
          canvas.height = tileH;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
          const tileBlob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
          splitResults.push({
            name: `tile_row${r + 1}_col${c + 1}.jpg`,
            blob: tileBlob,
          });
        }
      }

      // Download as ZIP archive of tiles
      const zipBlob = await createZipBlob(
        splitResults.map((t) => ({ blob: t.blob, name: t.name }))
      );
      downloadFile(zipBlob, `${activeImage.name.replace(/\.[^/.]+$/, '')}_split_${splitRows}x${splitCols}.zip`);
    } catch (err) {
      console.error('Split failed:', err);
    } finally {
      setIsSplitting(false);
    }
  };

  // 3. Handle Collage Generation
  const handleGenerateCollage = async () => {
    if (images.length < 2) {
      alert('Please upload at least 2 images to create a collage.');
      return;
    }
    setIsGeneratingCollage(true);

    try {
      const loadedImgs = await Promise.all(
        images.slice(0, 4).map((item) => loadImageElement(item.url))
      );

      const targetSize = 1600;
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background
      ctx.fillStyle = collageBg;
      ctx.fillRect(0, 0, targetSize, targetSize);

      const gap = collageGap;
      const count = loadedImgs.length;

      if (count === 2 || collageLayout === '2-horizontal') {
        const slotW = (targetSize - gap * 3) / 2;
        const slotH = targetSize - gap * 2;
        loadedImgs.slice(0, 2).forEach((img, i) => {
          const x = gap + i * (slotW + gap);
          ctx.drawImage(img, 0, 0, img.width, img.height, x, gap, slotW, slotH);
        });
      } else if (collageLayout === '2-vertical') {
        const slotW = targetSize - gap * 2;
        const slotH = (targetSize - gap * 3) / 2;
        loadedImgs.slice(0, 2).forEach((img, i) => {
          const y = gap + i * (slotH + gap);
          ctx.drawImage(img, 0, 0, img.width, img.height, gap, y, slotW, slotH);
        });
      } else {
        // 4-grid layout
        const slotW = (targetSize - gap * 3) / 2;
        const slotH = (targetSize - gap * 3) / 2;

        const positions = [
          { x: gap, y: gap },
          { x: gap * 2 + slotW, y: gap },
          { x: gap, y: gap * 2 + slotH },
          { x: gap * 2 + slotW, y: gap * 2 + slotH },
        ];

        loadedImgs.slice(0, 4).forEach((img, i) => {
          const pos = positions[i];
          ctx.drawImage(img, 0, 0, img.width, img.height, pos.x, pos.y, slotW, slotH);
        });
      }

      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      downloadFile(blob, 'photo_collage.jpg');
    } catch (err) {
      console.error('Collage creation failed:', err);
    } finally {
      setIsGeneratingCollage(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-800 text-xs">
      {/* 1. Image Merger */}
      {toolId === 'image-merger' && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Merge Orientation</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMergeDirection('horizontal')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border font-bold cursor-pointer transition-all ${
                mergeDirection === 'horizontal'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Columns className="w-4 h-4" />
              <span>Side-by-Side</span>
            </button>
            <button
              type="button"
              onClick={() => setMergeDirection('vertical')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border font-bold cursor-pointer transition-all ${
                mergeDirection === 'vertical'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Rows className="w-4 h-4" />
              <span>Stacked Vertical</span>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-slate-700 font-bold mb-1.5">
              <span>Spacing Gap:</span>
              <span className="text-blue-600">{mergeGap} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={mergeGap}
              onChange={(e) => setMergeGap(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Background Fill</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={mergeBgColor}
                onChange={(e) => setMergeBgColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300"
              />
              <span className="font-mono text-xs text-slate-600 uppercase">{mergeBgColor}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isMerging || images.length < 2}
            onClick={handleMergeImages}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            {isMerging ? (
              <span>Merging...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Merge & Download Image</span>
              </>
            )}
          </button>
          {images.length < 2 && (
            <p className="text-[11px] text-amber-600 italic">
              Upload at least 2 images to combine them together.
            </p>
          )}
        </div>
      )}

      {/* 2. Image Splitter */}
      {toolId === 'image-splitter' && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Grid className="w-4 h-4 text-blue-600" />
            <span>Split Configuration</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Rows</label>
              <input
                type="number"
                min="1"
                max="6"
                value={splitRows}
                onChange={(e) => setSplitRows(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-bold mb-1">Columns</label>
              <input
                type="number"
                min="1"
                max="6"
                value={splitCols}
                onChange={(e) => setSplitCols(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 font-bold"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
              Popular Presets
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSplitRows(1);
                  setSplitCols(3);
                }}
                className="py-1.5 px-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:border-blue-400 cursor-pointer text-center"
              >
                1x3 Instagram
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitRows(2);
                  setSplitCols(2);
                }}
                className="py-1.5 px-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:border-blue-400 cursor-pointer text-center"
              >
                2x2 Grid
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitRows(3);
                  setSplitCols(3);
                }}
                className="py-1.5 px-2 bg-white border border-slate-200 rounded-lg font-medium text-slate-700 hover:border-blue-400 cursor-pointer text-center"
              >
                3x3 Grid
              </button>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-800">
            Will generate <strong>{splitRows * splitCols} equal tiles</strong> packed into a single ZIP file.
          </div>

          <button
            type="button"
            disabled={isSplitting || images.length === 0}
            onClick={handleSplitImage}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            {isSplitting ? (
              <span>Splitting & Archiving...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Split & Download ZIP</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 3. Image Collage Maker */}
      {toolId === 'image-collage-maker' && (
        <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Collage Layout</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCollageLayout('4-grid')}
              className={`py-2 px-3 rounded-xl border font-bold cursor-pointer transition-all ${
                collageLayout === '4-grid'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              2x2 Grid (4 Photos)
            </button>
            <button
              type="button"
              onClick={() => setCollageLayout('2-horizontal')}
              className={`py-2 px-3 rounded-xl border font-bold cursor-pointer transition-all ${
                collageLayout === '2-horizontal'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              Side-by-Side (2 Photos)
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-slate-700 font-bold mb-1.5">
              <span>Collage Border Gap:</span>
              <span className="text-blue-600">{collageGap} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={collageGap}
              onChange={(e) => setCollageGap(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Background Frame Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={collageBg}
                onChange={(e) => setCollageBg(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300"
              />
              <span className="font-mono text-xs text-slate-600 uppercase">{collageBg}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isGeneratingCollage || images.length < 2}
            onClick={handleGenerateCollage}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
          >
            {isGeneratingCollage ? (
              <span>Generating Collage...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generate & Download Collage</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
