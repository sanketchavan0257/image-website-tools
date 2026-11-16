import { jsPDF } from 'jspdf';
import { ImageFileItem, PdfSettingsState } from '../types';
import { loadImageElement } from './imageProcessing';
import { createZipBlob, downloadFile } from './zipExport';

/**
 * Gets a clean filename ending with .pdf based on the image's original name
 */
export function getPdfFilename(item: ImageFileItem): string {
  const name = item.name?.trim() || 'document';
  const dotIdx = name.lastIndexOf('.');
  const baseName = dotIdx !== -1 ? name.substring(0, dotIdx) : name;
  return `${baseName || 'converted_image'}.pdf`;
}

/**
 * Renders an ImageFileItem to an offscreen HTMLCanvasElement,
 * correctly applying any manual crop data, rotations (0, 90, 180, 270), and flips.
 */
export async function renderImageItemToCanvas(item: ImageFileItem): Promise<HTMLCanvasElement> {
  const img = await loadImageElement(item.cropPreviewUrl || item.url);

  const naturalW = img.naturalWidth || item.width || 800;
  const naturalH = img.naturalHeight || item.height || 600;

  const srcX = item.cropData ? Math.max(0, item.cropData.x) : 0;
  const srcY = item.cropData ? Math.max(0, item.cropData.y) : 0;
  const srcW = item.cropData ? Math.min(naturalW - srcX, item.cropData.width) : naturalW;
  const srcH = item.cropData ? Math.min(naturalH - srcY, item.cropData.height) : naturalH;

  const rotation = ((item.rotation || 0) % 360 + 360) % 360;
  const isSwapped = rotation === 90 || rotation === 270;
  const canvasW = isSwapped ? srcH : srcW;
  const canvasH = isSwapped ? srcW : srcH;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(canvasW));
  canvas.height = Math.max(1, Math.round(canvasH));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // White background for documents
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  if (item.flipH) ctx.scale(-1, 1);
  if (item.flipV) ctx.scale(1, -1);

  ctx.drawImage(
    img,
    srcX,
    srcY,
    srcW,
    srcH,
    -srcW / 2,
    -srcH / 2,
    srcW,
    srcH
  );
  ctx.restore();

  return canvas;
}

/**
 * Adds an image canvas as a PDF page into an existing jsPDF document
 */
function addCanvasToPdfDocument(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  options: PdfSettingsState,
  isFirstPage: boolean
) {
  // Determine page orientation
  let pageOrient: 'portrait' | 'landscape' = 'portrait';
  if (options.orientation === 'auto') {
    pageOrient = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  } else {
    pageOrient = options.orientation;
  }

  // Handle fit-to-image mode
  if (options.pageSize === 'fit') {
    const dpi = 96;
    const mmW = Math.max(30, Math.min(600, (canvas.width / dpi) * 25.4));
    const mmH = Math.max(30, Math.min(600, (canvas.height / dpi) * 25.4));

    if (isFirstPage) {
      // Configure first page
      // Note: jsPDF constructor sets first page format, so we use internal methods or add page
    } else {
      pdf.addPage([mmW, mmH], pageOrient);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
    return;
  }

  // Standard Page (A4 or Letter)
  const format = options.pageSize;
  if (!isFirstPage) {
    pdf.addPage(format, pageOrient);
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = Math.max(0, options.margin || 0);

  const availW = Math.max(10, pageWidth - margin * 2);
  const availH = Math.max(10, pageHeight - margin * 2);

  let drawW = availW;
  let drawH = availH;
  let posX = margin;
  let posY = margin;

  if (options.imageFit === 'fill') {
    drawW = availW;
    drawH = availH;
  } else {
    // contain (preserve aspect ratio)
    const imgAspect = canvas.width / (canvas.height || 1);
    drawW = availW;
    drawH = drawW / imgAspect;

    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * imgAspect;
    }

    posX = margin + (availW - drawW) / 2;
    posY = margin + (availH - drawH) / 2;
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(dataUrl, 'JPEG', posX, posY, drawW, drawH, undefined, 'FAST');
}

/**
 * Generates a single 1-page PDF for a specific image item
 */
export async function generateSinglePdf(
  item: ImageFileItem,
  options: PdfSettingsState
): Promise<Blob> {
  const canvas = await renderImageItemToCanvas(item);

  let firstOrient: 'portrait' | 'landscape' = 'portrait';
  if (options.orientation === 'auto') {
    firstOrient = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  } else {
    firstOrient = options.orientation;
  }

  let pdf: jsPDF;
  if (options.pageSize === 'fit') {
    const dpi = 96;
    const mmW = Math.max(30, Math.min(600, (canvas.width / dpi) * 25.4));
    const mmH = Math.max(30, Math.min(600, (canvas.height / dpi) * 25.4));
    pdf = new jsPDF({
      orientation: firstOrient,
      unit: 'mm',
      format: [mmW, mmH],
    });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
  } else {
    pdf = new jsPDF({
      orientation: firstOrient,
      unit: 'mm',
      format: options.pageSize,
    });
    addCanvasToPdfDocument(pdf, canvas, options, true);
  }

  return pdf.output('blob');
}

/**
 * Combines all images into 1 multi-page PDF document
 */
export async function generateCombinedPdf(
  images: ImageFileItem[],
  options: PdfSettingsState,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  if (images.length === 0) {
    throw new Error('No images provided for PDF generation');
  }

  // Pre-render first image to determine initial document format
  const firstCanvas = await renderImageItemToCanvas(images[0]);
  let firstOrient: 'portrait' | 'landscape' = 'portrait';
  if (options.orientation === 'auto') {
    firstOrient = firstCanvas.width >= firstCanvas.height ? 'landscape' : 'portrait';
  } else {
    firstOrient = options.orientation;
  }

  let pdf: jsPDF;
  if (options.pageSize === 'fit') {
    const dpi = 96;
    const mmW = Math.max(30, Math.min(600, (firstCanvas.width / dpi) * 25.4));
    const mmH = Math.max(30, Math.min(600, (firstCanvas.height / dpi) * 25.4));
    pdf = new jsPDF({
      orientation: firstOrient,
      unit: 'mm',
      format: [mmW, mmH],
    });
    const dataUrl = firstCanvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, mmW, mmH, undefined, 'FAST');
  } else {
    pdf = new jsPDF({
      orientation: firstOrient,
      unit: 'mm',
      format: options.pageSize,
    });
    addCanvasToPdfDocument(pdf, firstCanvas, options, true);
  }

  onProgress?.(1, images.length);

  // Add subsequent images as additional pages
  for (let i = 1; i < images.length; i++) {
    const canvas = await renderImageItemToCanvas(images[i]);
    addCanvasToPdfDocument(pdf, canvas, options, false);
    onProgress?.(i + 1, images.length);
  }

  return pdf.output('blob');
}

/**
 * Converts each image into its own separate 1-page PDF
 * Returns an array of `{ name, blob }`
 */
export async function generateAllSeparatePdfs(
  images: ImageFileItem[],
  options: PdfSettingsState,
  onProgress?: (current: number, total: number) => void
): Promise<Array<{ name: string; blob: Blob }>> {
  const results: Array<{ name: string; blob: Blob }> = [];
  const nameCounts: Record<string, number> = {};

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const blob = await generateSinglePdf(item, options);
    let filename = getPdfFilename(item);

    // Prevent duplicate filenames
    if (nameCounts[filename]) {
      nameCounts[filename]++;
      const dotIdx = filename.lastIndexOf('.');
      const base = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;
      filename = `${base}_${nameCounts[filename]}.pdf`;
    } else {
      nameCounts[filename] = 1;
    }

    results.push({ name: filename, blob });
    onProgress?.(i + 1, images.length);
  }

  return results;
}

/**
 * Generates separate PDFs for all images and downloads them bundled in a ZIP archive
 */
export async function downloadAllSeparatePdfsAsZip(
  images: ImageFileItem[],
  options: PdfSettingsState,
  onProgress?: (percent: number) => void
): Promise<void> {
  const separateFiles = await generateAllSeparatePdfs(images, options);
  const zipBlob = await createZipBlob(separateFiles, onProgress);
  downloadFile(zipBlob, `separate_pdfs_${images.length}_files.zip`);
}

/**
 * Downloads each separate PDF one after another directly
 */
export async function downloadAllSeparatePdfsDirectly(
  images: ImageFileItem[],
  options: PdfSettingsState,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const separateFiles = await generateAllSeparatePdfs(images, options, onProgress);
  for (let i = 0; i < separateFiles.length; i++) {
    downloadFile(separateFiles[i].blob, separateFiles[i].name);
    if (i < separateFiles.length - 1) {
      await new Promise((r) => setTimeout(r, 320));
    }
  }
}
