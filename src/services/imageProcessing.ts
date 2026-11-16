import {
  ImageFileItem,
  ProcessedResultItem,
  ResizeSettingsState,
  CompressorSettingsState,
  ConvertSettingsState,
  TransformSettingsState,
  FilterSettingsState,
  StyleSettingsState,
} from '../types';

/**
 * Unit conversion helper for printing units (cm, mm, inch) to pixels based on DPI
 */
export function convertUnitToPx(
  val: number,
  unit: 'px' | 'cm' | 'mm' | 'inch',
  dpi: number
): number {
  if (unit === 'px') return Math.round(val);
  if (unit === 'inch') return Math.round(val * dpi);
  if (unit === 'cm') return Math.round((val / 2.54) * dpi);
  if (unit === 'mm') return Math.round((val / 25.4) * dpi);
  return Math.round(val);
}

/**
 * Loads an Image element safely from an object URL
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry once without crossOrigin
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = (e) => reject(new Error('Failed to load image element'));
      fallbackImg.src = src;
    };
    img.src = src;
  });
}

/**
 * Calculate target dimensions based on ResizeSettings
 */
export function calculateTargetDimensions(
  item: ImageFileItem,
  settings: ResizeSettingsState
): { width: number; height: number } {
  const origW = item.width || 800;
  const origH = item.height || 600;
  const aspect = origW / (origH || 1);

  if (settings.mode === 'percentage') {
    const pct = Math.max(5, settings.percentage || 100) / 100;
    const w = Math.max(1, Math.round(origW * pct));
    const h = Math.max(1, Math.round(origH * pct));
    return { width: w, height: h };
  }

  if (settings.mode === 'social' && settings.socialPreset) {
    const parts = settings.socialPreset.split('x').map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      return { width: parts[0], height: parts[1] };
    }
  }

  // mode === 'size'
  const unit = settings.unit || 'px';
  const dpi = settings.dpi || 72;

  let targetW =
    settings.width !== '' && !isNaN(Number(settings.width))
      ? convertUnitToPx(Number(settings.width), unit, dpi)
      : origW;
  let targetH =
    settings.height !== '' && !isNaN(Number(settings.height))
      ? convertUnitToPx(Number(settings.height), unit, dpi)
      : origH;

  targetW = Math.max(1, targetW);
  targetH = Math.max(1, targetH);

  if (settings.lockAspectRatio) {
    if (settings.fitMode === 'exact') {
      // Force exact dimensions (stretch)
      return { width: targetW, height: targetH };
    }

    // Default: Proportional fit within max bounds
    if (settings.width !== '' && settings.height === '') {
      targetH = Math.max(1, Math.round(targetW / aspect));
    } else if (settings.height !== '' && settings.width === '') {
      targetW = Math.max(1, Math.round(targetH * aspect));
    } else if (settings.width !== '' && settings.height !== '') {
      const scale = Math.min(targetW / origW, targetH / origH);
      targetW = Math.max(1, Math.round(origW * scale));
      targetH = Math.max(1, Math.round(origH * scale));
    }
  }

  return { width: Math.max(1, targetW), height: Math.max(1, targetH) };
}

/**
 * Process a single image through HTML5 Canvas
 */
export async function processSingleImage(
  item: ImageFileItem,
  toolId: string,
  options: {
    resizeSettings?: ResizeSettingsState;
    compressorSettings?: CompressorSettingsState;
    convertSettings?: ConvertSettingsState;
    transformSettings?: TransformSettingsState;
    filterSettings?: FilterSettingsState;
    styleSettings?: StyleSettingsState;
  }
): Promise<ProcessedResultItem> {
  const img = await loadImageElement(item.url);

  let outputMime = item.type || 'image/jpeg';
  let quality = 0.9;
  let targetFileSizeKB: number | '' = '';
  let bgColor = '#ffffff';

  // Determine target dimensions
  let targetDims = { width: item.width, height: item.height };

  // 1. Tool-specific configurations
  if (toolId === 'image-resizer' && options.resizeSettings) {
    targetDims = calculateTargetDimensions(item, options.resizeSettings);
    if (options.resizeSettings.targetFormat !== 'original') {
      outputMime = options.resizeSettings.targetFormat;
    }
    quality = options.resizeSettings.quality || 0.9;
    targetFileSizeKB = options.resizeSettings.targetFileSizeKB;
  } else if (toolId === 'image-compressor' && options.compressorSettings) {
    const cs = options.compressorSettings;

    if (cs.targetFormat === 'image/webp') {
      outputMime = 'image/webp';
    } else if (cs.targetFormat === 'image/png') {
      outputMime = 'image/png';
    } else if (cs.targetFormat === 'original') {
      outputMime = item.type || 'image/jpeg';
    } else {
      // Default to universally compatible JPG photo format
      outputMime = 'image/jpeg';
    }

    if (cs.mode === 'preset') {
      quality =
        cs.preset === 'aggressive' ? 0.45 : cs.preset === 'recommended' ? 0.72 : 0.88;
    } else if (cs.mode === 'custom-quality') {
      quality = Math.max(0.05, Math.min(1, cs.quality));
    } else if (cs.mode === 'target-size') {
      targetFileSizeKB = cs.targetFileSizeKB;
    }
  } else if (toolId === 'jpg-to-png') {
    outputMime = 'image/png';
  } else if (toolId === 'png-to-jpg') {
    outputMime = 'image/jpeg';
    bgColor = options.convertSettings?.pngBackground || '#ffffff';
    quality = options.convertSettings?.quality || 0.92;
  } else if (toolId === 'webp-converter') {
    outputMime = options.convertSettings?.targetFormat || 'image/webp';
    quality = options.convertSettings?.quality || 0.88;
  } else if (toolId === 'image-cropper') {
    outputMime = item.type || 'image/jpeg';
    quality = 0.95;
  } else if (toolId === 'pdf-to-image') {
    outputMime = options.convertSettings?.targetFormat || 'image/jpeg';
    quality = 0.92;
  } else if (toolId === 'round-image-maker') {
    outputMime = 'image/png';
    quality = 0.95;
  } else if (toolId === 'image-border-maker') {
    if (options.styleSettings?.borderRadius && options.styleSettings.borderRadius > 0) {
      outputMime = 'image/png';
    } else {
      outputMime = item.type || 'image/jpeg';
    }
    quality = 0.95;
  } else if (toolId === 'image-metadata-remover') {
    outputMime = item.type || 'image/jpeg';
    quality = 0.98;
  }

  // 2. Setup Source Coordinates & Crop
  let srcX = 0;
  let srcY = 0;
  let srcW = img.naturalWidth || img.width;
  let srcH = img.naturalHeight || img.height;

  if (item.cropData) {
    srcX = Math.max(0, item.cropData.x);
    srcY = Math.max(0, item.cropData.y);
    srcW = Math.min(img.naturalWidth - srcX, item.cropData.width);
    srcH = Math.min(img.naturalHeight - srcY, item.cropData.height);
    if (toolId !== 'image-resizer') {
      targetDims = { width: Math.round(srcW), height: Math.round(srcH) };
    }
  }

  // 3. Transformations: Rotation & Flips (Single source of truth from item state)
  const rotation = (item.rotation || 0) % 360;
  const flipH = Boolean(item.flipH);
  const flipV = Boolean(item.flipV);

  // Swap canvas dimensions for 90 or 270 degree rotation
  const isSwapped = rotation === 90 || rotation === 270;
  const canvasW = isSwapped ? targetDims.height : targetDims.width;
  const canvasH = isSwapped ? targetDims.width : targetDims.height;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, canvasW);
  canvas.height = Math.max(1, canvasH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is not available');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background if converting transparent to JPG
  if (outputMime === 'image/jpeg') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 4. Apply Filters (Grayscale, Brightness, Contrast, Saturation, Blur)
  applyCanvasFilters(ctx, toolId, options.filterSettings);

  // 5. Draw Image with Transformations
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  if (flipH || flipV) {
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  }

  const drawW = isSwapped ? canvas.height : canvas.width;
  const drawH = isSwapped ? canvas.width : canvas.height;
  ctx.drawImage(img, srcX, srcY, srcW, srcH, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Reset filter on context
  ctx.filter = 'none';

  // 6. Handle Pixelate Tool
  if (toolId === 'pixelate-image' || (options.filterSettings?.pixelate && options.filterSettings.pixelate > 1)) {
    const blockSize = options.filterSettings?.pixelate || 12;
    applyPixelate(canvas, ctx, blockSize);
  }

  // 6b. Handle Round Image Maker (Circle Avatar & Rounded Corners)
  if (toolId === 'round-image-maker') {
    const style = options.styleSettings;
    const mode = style?.roundMode || 'circle';
    const bg = style?.roundBackground || 'transparent';
    const bw = style?.roundBorderWidth || 0;
    const bc = style?.roundBorderColor || '#ffffff';

    if (mode === 'circle') {
      // 1:1 Circular Avatar
      const size = Math.min(canvas.width, canvas.height);
      const roundCanvas = document.createElement('canvas');
      roundCanvas.width = size;
      roundCanvas.height = size;
      const rCtx = roundCanvas.getContext('2d');
      if (rCtx) {
        rCtx.imageSmoothingEnabled = true;
        rCtx.imageSmoothingQuality = 'high';

        // Optional custom solid background behind the circle
        if (bg && bg !== 'transparent') {
          rCtx.fillStyle = bg;
          rCtx.fillRect(0, 0, size, size);
        }

        // Circular clipping mask
        rCtx.save();
        rCtx.beginPath();
        const radius = size / 2;
        rCtx.arc(radius, radius, radius, 0, Math.PI * 2);
        rCtx.closePath();
        rCtx.clip();

        // Draw the image centered
        const srcXOffset = (canvas.width - size) / 2;
        const srcYOffset = (canvas.height - size) / 2;
        rCtx.drawImage(
          canvas,
          srcXOffset,
          srcYOffset,
          size,
          size,
          0,
          0,
          size,
          size
        );
        rCtx.restore();

        // Optional avatar border
        if (bw > 0) {
          rCtx.save();
          rCtx.beginPath();
          rCtx.arc(radius, radius, Math.max(1, radius - bw / 2), 0, Math.PI * 2);
          rCtx.lineWidth = bw;
          rCtx.strokeStyle = bc;
          rCtx.stroke();
          rCtx.restore();
        }

        // Write back to main canvas
        canvas.width = size;
        canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(roundCanvas, 0, 0);
      }
    } else {
      // Rounded Corners (preserves aspect ratio)
      const w = canvas.width;
      const h = canvas.height;
      const pct = Math.min(50, Math.max(1, style?.cornerRadius ?? 25));
      const radiusPx = (Math.min(w, h) * pct) / 100;

      const roundCanvas = document.createElement('canvas');
      roundCanvas.width = w;
      roundCanvas.height = h;
      const rCtx = roundCanvas.getContext('2d');
      if (rCtx) {
        rCtx.imageSmoothingEnabled = true;
        rCtx.imageSmoothingQuality = 'high';

        // Optional custom background
        if (bg && bg !== 'transparent') {
          rCtx.fillStyle = bg;
          rCtx.fillRect(0, 0, w, h);
        }

        // Rounded rect clipping mask
        rCtx.save();
        rCtx.beginPath();
        if (typeof rCtx.roundRect === 'function') {
          rCtx.roundRect(0, 0, w, h, radiusPx);
        } else {
          // Standard quadratic bezier rounded rectangle
          rCtx.moveTo(radiusPx, 0);
          rCtx.lineTo(w - radiusPx, 0);
          rCtx.quadraticCurveTo(w, 0, w, radiusPx);
          rCtx.lineTo(w, h - radiusPx);
          rCtx.quadraticCurveTo(w, h, w - radiusPx, h);
          rCtx.lineTo(radiusPx, h);
          rCtx.quadraticCurveTo(0, h, 0, h - radiusPx);
          rCtx.lineTo(0, radiusPx);
          rCtx.quadraticCurveTo(0, 0, radiusPx, 0);
        }
        rCtx.closePath();
        rCtx.clip();

        // Draw image
        rCtx.drawImage(canvas, 0, 0);
        rCtx.restore();

        // Optional border
        if (bw > 0) {
          rCtx.save();
          rCtx.beginPath();
          const inset = bw / 2;
          const innerW = w - bw;
          const innerH = h - bw;
          const innerR = Math.max(0, radiusPx - inset);
          if (typeof rCtx.roundRect === 'function') {
            rCtx.roundRect(inset, inset, innerW, innerH, innerR);
          } else {
            rCtx.moveTo(inset + innerR, inset);
            rCtx.lineTo(inset + innerW - innerR, inset);
            rCtx.quadraticCurveTo(inset + innerW, inset, inset + innerW, inset + innerR);
            rCtx.lineTo(inset + innerW, inset + innerH - innerR);
            rCtx.quadraticCurveTo(inset + innerW, inset + innerH, inset + innerW - innerR, inset + innerH);
            rCtx.lineTo(inset + innerR, inset + innerH);
            rCtx.quadraticCurveTo(inset, inset + innerH, inset, inset + innerH - innerR);
            rCtx.lineTo(inset, inset + innerR);
            rCtx.quadraticCurveTo(inset, inset, inset + innerR, inset);
          }
          rCtx.closePath();
          rCtx.lineWidth = bw;
          rCtx.strokeStyle = bc;
          rCtx.stroke();
          rCtx.restore();
        }

        // Write back to main canvas
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(roundCanvas, 0, 0);
      }
    }
    outputMime = 'image/png';
  }

  // 6c. Handle Border Maker (Supports Border Width, Border Radius, Color, Linear Gradient, and Style)
  if (toolId === 'image-border-maker') {
    const bw = options.styleSettings?.borderWidth ?? 16;
    const br = options.styleSettings?.borderRadius ?? 0;
    const isGrad = options.styleSettings?.borderFillType === 'gradient';
    const c1 = options.styleSettings?.gradientColor1 || '#ec4899';
    const c2 = options.styleSettings?.gradientColor2 || '#3b82f6';
    const angle = options.styleSettings?.gradientAngle ?? 135;
    const bc = options.styleSettings?.borderColor ?? '#ffffff';
    const bStyle = options.styleSettings?.borderStyle ?? 'solid';

    const w = canvas.width;
    const h = canvas.height;

    // Helper to generate strokeStyle (Solid color or Linear Gradient)
    const createStrokeStyle = (targetCtx: CanvasRenderingContext2D): string | CanvasGradient => {
      if (!isGrad) return bc;
      const sinA = Math.sin((angle * Math.PI) / 180);
      const cosA = Math.cos((angle * Math.PI) / 180);
      const cx = w / 2;
      const cy = h / 2;
      const x0 = cx - sinA * cx;
      const y0 = cy + cosA * cy;
      const x1 = cx + sinA * cx;
      const y1 = cy - cosA * cy;
      const grad = targetCtx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      return grad;
    };

    // Helper to draw clean rounded rectangles
    const drawRoundedRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
      const r = Math.max(0, Math.min(radius, width / 2, height / 2));
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(x, y, width, height, r);
      } else {
        c.moveTo(x + r, y);
        c.lineTo(x + width - r, y);
        c.quadraticCurveTo(x + width, y, x + width, y + r);
        c.lineTo(x + width, y + height - r);
        c.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        c.lineTo(x + r, y + height);
        c.quadraticCurveTo(x, y + height, x, y + height - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
      }
      c.closePath();
    };

    if (br > 0) {
      // Rounded Corners with Border
      const maxR = Math.min(w, h) / 2;
      const radiusPx = Math.min(maxR, br);

      const bCanvas = document.createElement('canvas');
      bCanvas.width = w;
      bCanvas.height = h;
      const bCtx = bCanvas.getContext('2d');
      if (bCtx) {
        bCtx.imageSmoothingEnabled = true;
        bCtx.imageSmoothingQuality = 'high';

        // 1. Clip image into rounded rectangle
        bCtx.save();
        drawRoundedRect(bCtx, 0, 0, w, h, radiusPx);
        bCtx.clip();
        bCtx.drawImage(canvas, 0, 0);
        bCtx.restore();

        // 2. Draw rounded border stroke (Solid, Dashed, Double)
        if (bw > 0) {
          bCtx.save();
          bCtx.strokeStyle = createStrokeStyle(bCtx);

          if (bStyle === 'double') {
            // True Double Border: Outer line + empty gap + Inner line
            const subBw = Math.max(1, Math.round(bw / 3));
            bCtx.lineWidth = subBw;
            // Outer stroke
            const inset1 = subBw / 2;
            drawRoundedRect(bCtx, inset1, inset1, Math.max(1, w - subBw), Math.max(1, h - subBw), Math.max(0, radiusPx - inset1));
            bCtx.stroke();

            // Inner stroke
            const inset2 = Math.max(subBw, bw - subBw / 2);
            drawRoundedRect(bCtx, inset2, inset2, Math.max(1, w - inset2 * 2), Math.max(1, h - inset2 * 2), Math.max(0, radiusPx - inset2));
            bCtx.stroke();
          } else {
            // Solid or Dashed
            if (bStyle === 'dashed') {
              const dash = Math.max(14, Math.round(bw * 2.2));
              const gap = Math.max(8, Math.round(bw * 1.2));
              bCtx.setLineDash([dash, gap]);
            }
            bCtx.lineWidth = bw;
            const inset = bw / 2;
            drawRoundedRect(bCtx, inset, inset, Math.max(1, w - bw), Math.max(1, h - bw), Math.max(0, radiusPx - inset));
            bCtx.stroke();
          }
          bCtx.restore();
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bCanvas, 0, 0);
      }
      outputMime = 'image/png';
    } else {
      // Standard Rectangular Border (Solid, Dashed, Double)
      if (bw > 0) {
        ctx.save();
        ctx.strokeStyle = createStrokeStyle(ctx);

        if (bStyle === 'double') {
          // True Double Border: Outer line + empty gap + Inner line
          const subBw = Math.max(1, Math.round(bw / 3));
          ctx.lineWidth = subBw;
          // Outer stroke
          const inset1 = subBw / 2;
          ctx.strokeRect(inset1, inset1, Math.max(1, w - subBw), Math.max(1, h - subBw));
          // Inner stroke
          const inset2 = Math.max(subBw, bw - subBw / 2);
          ctx.strokeRect(inset2, inset2, Math.max(1, w - inset2 * 2), Math.max(1, h - inset2 * 2));
        } else {
          // Solid or Dashed
          if (bStyle === 'dashed') {
            const dash = Math.max(14, Math.round(bw * 2.2));
            const gap = Math.max(8, Math.round(bw * 1.2));
            ctx.setLineDash([dash, gap]);
          }
          ctx.lineWidth = bw;
          const inset = bw / 2;
          ctx.strokeRect(inset, inset, Math.max(1, w - bw), Math.max(1, h - bw));
        }
        ctx.restore();
      }
    }
  }

  // 6d. Handle Watermark
  if (toolId === 'image-watermark') {
    ctx.save();
    const text = options.styleSettings?.watermarkText || 'Watermark';
    const rawDate = options.styleSettings?.watermarkDate?.trim() || '';
    const hasDate = rawDate.length > 0;
    const opacity = (options.styleSettings?.watermarkOpacity ?? 60) / 100;
    const color = options.styleSettings?.watermarkColor || '#ffffff';
    const pos = options.styleSettings?.watermarkPos || 'bottom-right';

    // Scale font size based on image width relative to 1000px standard, honoring user setting
    const userFontSize = options.styleSettings?.watermarkFontSize || 32;
    const scaleFactor = Math.max(0.5, canvas.width / 1000);
    const mainFontSize = Math.max(12, Math.round(userFontSize * scaleFactor));
    const dateFontSize = Math.max(10, Math.round(mainFontSize * 0.65));
    const lineSpacing = Math.max(4, Math.round(mainFontSize * 0.25));

    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = Math.max(4, Math.round(mainFontSize * 0.2));

    // Measure main text
    ctx.font = `bold ${mainFontSize}px system-ui, -apple-system, sans-serif`;
    const mainMetrics = ctx.measureText(text);
    const mainWidth = mainMetrics.width;

    // Measure date text if present
    let dateWidth = 0;
    if (hasDate) {
      ctx.font = `500 ${dateFontSize}px system-ui, -apple-system, sans-serif`;
      const dateMetrics = ctx.measureText(rawDate);
      dateWidth = dateMetrics.width;
    }

    const blockWidth = Math.max(mainWidth, dateWidth);
    const totalBlockHeight = hasDate
      ? mainFontSize + lineSpacing + dateFontSize
      : mainFontSize;

    const pad = Math.max(16, Math.round(canvas.width * 0.025));

    // Horizontal position (3 columns: Left, Center, Right)
    let blockX = pad;
    if (pos.includes('right')) {
      blockX = canvas.width - blockWidth - pad;
    } else if (pos.includes('center')) {
      blockX = (canvas.width - blockWidth) / 2;
    }

    // Vertical position (7 rows: R1=Top, R2=1/6, R3=2/6, R4=3/6 Center, R5=4/6, R6=5/6, R7=Bottom)
    let blockY = pad;
    const availableHeight = Math.max(0, canvas.height - totalBlockHeight - 2 * pad);

    if (pos.startsWith('top') || pos.startsWith('row1') || pos.startsWith('r1')) {
      blockY = pad;
    } else if (pos.startsWith('row2') || pos.startsWith('r2') || pos.startsWith('upper')) {
      blockY = Math.round(pad + availableHeight * (1 / 6));
    } else if (pos.startsWith('row3') || pos.startsWith('r3')) {
      blockY = Math.round(pad + availableHeight * (2 / 6));
    } else if (pos.startsWith('row4') || pos.startsWith('r4') || pos === 'center' || pos.startsWith('center')) {
      blockY = Math.round(pad + availableHeight * (3 / 6));
    } else if (pos.startsWith('row5') || pos.startsWith('r5')) {
      blockY = Math.round(pad + availableHeight * (4 / 6));
    } else if (pos.startsWith('row6') || pos.startsWith('r6') || pos.startsWith('lower')) {
      blockY = Math.round(pad + availableHeight * (5 / 6));
    } else if (pos.startsWith('bottom') || pos.startsWith('row7') || pos.startsWith('r7')) {
      blockY = canvas.height - totalBlockHeight - pad;
    } else {
      blockY = canvas.height - totalBlockHeight - pad;
    }

    // Align lines within the block
    let mainX = blockX;
    let dateX = blockX;

    if (pos.includes('right')) {
      mainX = blockX + (blockWidth - mainWidth);
      if (hasDate) dateX = blockX + (blockWidth - dateWidth);
    } else if (pos.includes('center')) {
      mainX = blockX + (blockWidth - mainWidth) / 2;
      if (hasDate) dateX = blockX + (blockWidth - dateWidth) / 2;
    }

    // Render main watermark text
    ctx.font = `bold ${mainFontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(text, mainX, blockY + mainFontSize);

    // Render date watermark text DIRECTLY BELOW watermark text (if date exists)
    if (hasDate) {
      ctx.font = `500 ${dateFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(rawDate, dateX, blockY + mainFontSize + lineSpacing + dateFontSize);
    }

    ctx.restore();
  }

  // 7. Binary Search for Target File Size (if requested)
  let finalBlob: Blob;
  if (
    targetFileSizeKB &&
    typeof targetFileSizeKB === 'number' &&
    targetFileSizeKB > 0 &&
    (outputMime === 'image/jpeg' || outputMime === 'image/webp')
  ) {
    finalBlob = await intelligentTargetSizeCompression(
      canvas,
      outputMime,
      targetFileSizeKB * 1024
    );
  } else {
    finalBlob = await canvasToBlob(canvas, outputMime, quality);
  }

  // Determine correct file extension - strictly image extensions (.jpg, .png, .webp)
  let extension = 'jpg';
  if (outputMime === 'image/png') {
    extension = 'png';
  } else if (outputMime === 'image/webp') {
    extension = 'webp';
  } else {
    extension = 'jpg';
  }

  // Clean base name: strip ALL extensions (.html, .jpg, .png, etc.) so it NEVER produces an .html file
  let baseName = item.name.replace(/\.[a-zA-Z0-9]+$/i, '').trim();
  baseName = baseName.replace(/\.html?$/i, '').replace(/[/\\?%*:|"<>]/g, '_').trim();
  let suffix = 'processed';
  if (toolId === 'image-to-base64') {
    const dataUri = canvas.toDataURL(item.type || 'image/png');
    finalBlob = new Blob([dataUri], { type: 'text/plain' });
    extension = 'txt';
    suffix = 'base64';
  } else if (toolId === 'image-cropper') suffix = 'cropped';
  else if (toolId === 'image-resizer') suffix = 'resized';
  else if (toolId === 'image-compressor') suffix = 'compressed';
  else if (toolId === 'base64-to-image') suffix = 'decoded';
  else if (toolId.includes('rotat') || toolId.includes('flip')) suffix = 'transformed';
  else if (toolId === 'round-image-maker') suffix = 'round';
  else if (toolId === 'image-border-maker') suffix = 'bordered';
  else if (toolId === 'image-watermark') suffix = 'watermarked';
  else if (toolId === 'image-metadata-remover') suffix = 'cleaned';
  else if (toolId.includes('png') || toolId.includes('jpg') || toolId.includes('webp')) suffix = 'converted';

  const newName = `${baseName}_${suffix}.${extension}`;
  const resultUrl = URL.createObjectURL(finalBlob);

  return {
    id: item.id,
    originalName: item.name,
    newName,
    blob: finalBlob,
    url: resultUrl,
    originalSize: item.size,
    processedSize: finalBlob.size,
    originalDimensions: { width: item.width, height: item.height },
    processedDimensions: { width: canvas.width, height: canvas.height },
    format: extension.toUpperCase(),
  };
}

/**
 * Apply canvas filter strings with fallback
 */
function applyCanvasFilters(
  ctx: CanvasRenderingContext2D,
  toolId: string,
  filterSettings?: FilterSettingsState
) {
  const filters: string[] = [];

  if (toolId === 'grayscale-converter' || filterSettings?.grayscale) {
    filters.push('grayscale(100%)');
  }

  if (toolId === 'blur-image' || (filterSettings?.blur && filterSettings.blur > 0)) {
    const blurRadius = filterSettings?.blur || 6;
    filters.push(`blur(${blurRadius}px)`);
  }

  if (toolId === 'image-brightness' || filterSettings?.brightness) {
    const b = (filterSettings?.brightness || 30) + 100;
    filters.push(`brightness(${Math.max(0, b)}%)`);
  }

  if (toolId === 'image-contrast' || filterSettings?.contrast) {
    const c = (filterSettings?.contrast || 30) + 100;
    filters.push(`contrast(${Math.max(0, c)}%)`);
  }

  if (toolId === 'image-saturation' || filterSettings?.saturation) {
    const s = (filterSettings?.saturation || 40) + 100;
    filters.push(`saturate(${Math.max(0, s)}%)`);
  }

  if (filters.length > 0) {
    try {
      ctx.filter = filters.join(' ');
    } catch {
      // Fallback if filter property is unsupported
    }
  }
}

/**
 * Pixelate effect: downsample and redraw with smoothing disabled
 */
function applyPixelate(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  blockSize: number
) {
  const w = canvas.width;
  const h = canvas.height;
  const scaledW = Math.max(1, Math.round(w / blockSize));
  const scaledH = Math.max(1, Math.round(h / blockSize));

  const offscreen = document.createElement('canvas');
  offscreen.width = scaledW;
  offscreen.height = scaledH;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) return;

  offCtx.drawImage(canvas, 0, 0, scaledW, scaledH);

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(offscreen, 0, 0, scaledW, scaledH, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
}

/**
 * Canvas to Blob Promise helper with error resilience
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Safe clamp for quality
    const q = Math.max(0.01, Math.min(1, quality));
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback: convert via dataURL
            try {
              const dataUrl = canvas.toDataURL(mime, q);
              const byteString = atob(dataUrl.split(',')[1]);
              const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              resolve(new Blob([ia], { type: mimeString }));
            } catch (fallbackErr) {
              reject(new Error('Failed to generate image blob'));
            }
          }
        },
        mime,
        q
      );
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Intelligent Target Size Compression (Binary Search + Proportional Downscale if needed)
 */
async function intelligentTargetSizeCompression(
  canvas: HTMLCanvasElement,
  mime: string,
  targetBytes: number
): Promise<Blob> {
  let low = 0.05;
  let high = 0.96;
  let bestBlob: Blob | null = null;
  const maxIterations = 8;

  // 1. Binary search on quality
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const blob = await canvasToBlob(canvas, mime, mid);
    bestBlob = blob;

    // Within 8% tolerance of target size
    if (Math.abs(blob.size - targetBytes) < targetBytes * 0.08) {
      return blob;
    }

    if (blob.size > targetBytes) {
      high = mid;
    } else {
      low = mid;
    }
  }

  // 2. If at lowest quality it's still bigger than targetBytes (e.g. 50 KB requested on huge 4K image),
  // downscale canvas dimensions proportionally until it fits!
  if (bestBlob && bestBlob.size > targetBytes) {
    const scaleRatio = Math.sqrt(targetBytes / bestBlob.size) * 0.95;
    const newW = Math.max(100, Math.round(canvas.width * scaleRatio));
    const newH = Math.max(100, Math.round(canvas.height * scaleRatio));

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = newW;
    scaledCanvas.height = newH;
    const sCtx = scaledCanvas.getContext('2d');
    if (sCtx) {
      sCtx.imageSmoothingEnabled = true;
      sCtx.imageSmoothingQuality = 'high';
      sCtx.drawImage(canvas, 0, 0, newW, newH);
      return await canvasToBlob(scaledCanvas, mime, 0.75);
    }
  }

  return bestBlob || (await canvasToBlob(canvas, mime, 0.7));
}
