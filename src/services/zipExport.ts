import JSZip from 'jszip';
import { ProcessedResultItem } from '../types';

export const DOWNLOAD_PREFERENCE_KEY = 'pixiforge_download_pref';

/**
 * Triggers a browser download for a single Blob or URL
 * Guarded against empty URLs to ensure it never downloads index.html by mistake!
 */
export function downloadFile(blobOrUrl: Blob | string | null | undefined, filename: string) {
  if (!blobOrUrl) {
    console.error('Cannot download: blobOrUrl is empty or invalid.');
    return;
  }

  // Normalize safe filename with explicit extension
  let safeName = filename?.trim() || 'image_optimized.jpg';
  if (!/\.(jpe?g|png|webp|gif|svg|zip|txt|json|pdf)$/i.test(safeName)) {
    safeName += '.jpg';
  }

  let url: string;
  let isCreatedUrl = false;

  if (typeof blobOrUrl === 'string') {
    if (!blobOrUrl || blobOrUrl.trim() === '') {
      console.error('Empty URL string passed to downloadFile');
      return;
    }
    url = blobOrUrl;
  } else {
    if (!(blobOrUrl instanceof Blob)) {
      console.error('Invalid object passed to downloadFile; expected Blob');
      return;
    }
    url = URL.createObjectURL(blobOrUrl);
    isCreatedUrl = true;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Retain object URL in memory for 60 seconds so rapid re-downloads never fail
  if (isCreatedUrl) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }, 60000);
  }
}

/**
 * Packs multiple processed images into a single ZIP archive using JSZip
 */
export async function downloadAsZip(
  items: ProcessedResultItem[],
  zipName = 'pixiforge_images.zip',
  onProgress?: (progress: number) => void
): Promise<void> {
  if (!items || items.length === 0) return;

  const zip = new JSZip();

  // Deduplicate filenames if needed
  const nameCounts: Record<string, number> = {};
  items.forEach((item) => {
    let filename = item.newName;
    if (!/\.(jpe?g|png|webp|gif|svg|txt|json|pdf)$/i.test(filename)) {
      filename += '.jpg';
    }

    if (nameCounts[filename]) {
      nameCounts[filename]++;
      const dotIdx = filename.lastIndexOf('.');
      const base = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;
      const ext = dotIdx !== -1 ? filename.substring(dotIdx) : '.jpg';
      filename = `${base}_${nameCounts[filename]}${ext}`;
    } else {
      nameCounts[filename] = 1;
    }

    zip.file(filename, item.blob);
  });

  const content = await createZipBlob(
    items.map((it) => ({ name: it.newName, blob: it.blob })),
    onProgress
  );

  downloadFile(content, zipName);
}

/**
 * Creates a ZIP Blob from an array of named blobs
 */
export async function createZipBlob(
  files: { name: string; blob: Blob }[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const nameCounts: Record<string, number> = {};

  files.forEach((file) => {
    let filename = file.name;
    if (!/\.(jpe?g|png|webp|gif|svg|zip|pdf|txt|json)$/i.test(filename)) {
      filename += '.jpg';
    }

    if (nameCounts[filename]) {
      nameCounts[filename]++;
      const dotIdx = filename.lastIndexOf('.');
      const base = dotIdx !== -1 ? filename.substring(0, dotIdx) : filename;
      const ext = dotIdx !== -1 ? filename.substring(dotIdx) : '.jpg';
      filename = `${base}_${nameCounts[filename]}${ext}`;
    } else {
      nameCounts[filename] = 1;
    }

    zip.file(filename, file.blob);
  });

  return await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(Math.round(metadata.percent));
    }
  });
}

/**
 * Downloads multiple files sequentially with ~320ms delay between them
 */
export async function downloadSeparately(
  items: ProcessedResultItem[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!items || items.length === 0) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    downloadFile(item.blob, item.newName);
    if (onProgress) {
      onProgress(i + 1, items.length);
    }
    // Delay between consecutive downloads to avoid browser block
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 320));
    }
  }
}

export function getLastDownloadPreference(): 'zip' | 'separate' {
  try {
    const pref = localStorage.getItem(DOWNLOAD_PREFERENCE_KEY);
    return pref === 'separate' ? 'separate' : 'zip';
  } catch {
    return 'zip';
  }
}

export function saveDownloadPreference(pref: 'zip' | 'separate') {
  try {
    localStorage.setItem(DOWNLOAD_PREFERENCE_KEY, pref);
  } catch {}
}
