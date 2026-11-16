import * as pdfjsLib from 'pdfjs-dist';
import { ImageFileItem } from '../types';

// Set up pdfjs worker using standard Vite asset URL with fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Extracts each page from a PDF file into genuine high-resolution ImageFileItems
 */
export async function extractPagesFromPdf(
  file: File,
  options?: {
    dpi?: number;
    maxPages?: number;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<ImageFileItem[]> {
  const dpi = options?.dpi || 150;
  // Standard PDF resolution is 72 DPI
  const scale = dpi / 72;
  const maxPages = options?.maxPages || 50;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@' + pdfjsLib.version + '/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;
  const pagesToExtract = Math.min(totalPages, maxPages);
  const items: ImageFileItem[] = [];

  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) continue;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render PDF page into canvas
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
    }).promise;

    // Convert canvas to real JPEG Blob & Data URL
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || new Blob()),
        'image/jpeg',
        0.92
      );
    });

    const pageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const pageFileName = `${baseName}_page_${pageNum}.jpg`;
    const pageFile = new File([blob], pageFileName, { type: 'image/jpeg' });

    items.push({
      id: `pdf_page_${Math.random().toString(36).substring(2, 9)}_${pageNum}_${Date.now()}`,
      file: pageFile,
      name: pageFileName,
      size: blob.size,
      type: 'image/jpeg',
      url: pageDataUrl,
      width: canvas.width,
      height: canvas.height,
      aspectRatio: canvas.width / canvas.height,
      rotation: 0,
      flipH: false,
      flipV: false,
      customOptions: {
        isPdfPage: true,
        pageIndex: pageNum,
        totalPages,
        originalPdfName: file.name,
      },
    });

    if (options?.onProgress) {
      options.onProgress(pageNum, pagesToExtract);
    }
  }

  return items;
}
