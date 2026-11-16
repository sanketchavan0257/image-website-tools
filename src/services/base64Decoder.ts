import { ImageFileItem } from '../types';

export interface DecodedBase64Result {
  id: string;
  name: string;
  dataUrl: string;
  rawBase64: string;
  mime: string;
  extension: 'png' | 'jpg' | 'webp' | 'gif' | 'svg' | 'bmp';
  width: number;
  height: number;
  sizeBytes: number;
  blob: Blob;
  file: File;
}

/**
 * Detect image MIME type from Base64 string signature or data URI
 */
export function detectMimeType(input: string): { mime: string; ext: 'png' | 'jpg' | 'webp' | 'gif' | 'svg' | 'bmp' } {
  const trimmed = input.trim();

  // 1. Data URI prefix check
  const dataUriMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9-+.]+);base64,/i);
  if (dataUriMatch) {
    const declaredMime = dataUriMatch[1].toLowerCase();
    if (declaredMime.includes('jpeg') || declaredMime.includes('jpg')) return { mime: 'image/jpeg', ext: 'jpg' };
    if (declaredMime.includes('webp')) return { mime: 'image/webp', ext: 'webp' };
    if (declaredMime.includes('gif')) return { mime: 'image/gif', ext: 'gif' };
    if (declaredMime.includes('svg')) return { mime: 'image/svg+xml', ext: 'svg' };
    if (declaredMime.includes('bmp')) return { mime: 'image/bmp', ext: 'bmp' };
    return { mime: 'image/png', ext: 'png' };
  }

  // 2. Magic bytes in raw Base64
  const rawClean = trimmed.replace(/^data:[^;]+;base64,/i, '').trim();
  if (rawClean.startsWith('iVBORw0KGgo')) return { mime: 'image/png', ext: 'png' };
  if (rawClean.startsWith('/9j/')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (rawClean.startsWith('UklGR')) return { mime: 'image/webp', ext: 'webp' };
  if (rawClean.startsWith('R0lGOD')) return { mime: 'image/gif', ext: 'gif' };
  if (rawClean.startsWith('PHN2Zy') || rawClean.startsWith('PD94b')) return { mime: 'image/svg+xml', ext: 'svg' };
  if (rawClean.startsWith('Qk')) return { mime: 'image/bmp', ext: 'bmp' };

  // Default fallback
  return { mime: 'image/png', ext: 'png' };
}

/**
 * Clean & sanitize a single Base64 string
 */
export function sanitizeBase64(input: string): { dataUrl: string; rawBase64: string; mime: string; ext: 'png' | 'jpg' | 'webp' | 'gif' | 'svg' | 'bmp' } | null {
  if (!input) return null;
  let text = input.trim();

  // Strip wrapping quotes
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // Strip Markdown / HTML img wrapper if user pasted <img src="..."> or ![]()
  const htmlMatch = text.match(/src=["'](data:image\/[^"']+)["']/i);
  if (htmlMatch) {
    text = htmlMatch[1];
  } else {
    const cssMatch = text.match(/url\(["']?(data:image\/[^"')]+)["']?\)/i);
    if (cssMatch) {
      text = cssMatch[1];
    }
  }

  const { mime, ext } = detectMimeType(text);
  let rawBase64 = text;

  if (text.startsWith('data:')) {
    const commaIdx = text.indexOf(',');
    if (commaIdx !== -1) {
      rawBase64 = text.substring(commaIdx + 1);
    }
  }

  // Strip whitespace / newlines from the raw base64 portion
  rawBase64 = rawBase64.replace(/\s+/g, '');

  if (!rawBase64 || rawBase64.length < 8) {
    return null;
  }

  // Verify atob decoding
  try {
    const sample = rawBase64.substring(0, Math.min(100, rawBase64.length));
    atob(sample);
  } catch {
    return null;
  }

  const dataUrl = `data:${mime};base64,${rawBase64}`;
  return { dataUrl, rawBase64, mime, ext };
}

/**
 * Decode Base64 string to a binary Blob
 */
export function base64ToBlob(rawBase64: string, mime: string): Blob {
  const binaryString = atob(rawBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Decode sanitized Base64 to full DecodedBase64Result with natural dimensions
 */
export function decodeBase64ToImage(
  input: string,
  suggestedName?: string,
  index = 1
): Promise<DecodedBase64Result> {
  return new Promise((resolve, reject) => {
    const sanitized = sanitizeBase64(input);
    if (!sanitized) {
      return reject(new Error('Invalid Base64 string format.'));
    }

    const { dataUrl, rawBase64, mime, ext } = sanitized;
    let blob: Blob;
    try {
      blob = base64ToBlob(rawBase64, mime);
    } catch {
      return reject(new Error('Failed to decode binary Base64 data.'));
    }

    const baseName = suggestedName
      ? suggestedName.replace(/\.[a-zA-Z0-9]+$/i, '')
      : `decoded_image_${index}`;
    const filename = `${baseName}.${ext}`;
    const file = new File([blob], filename, { type: mime });

    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 800;
      const height = img.naturalHeight || 600;
      const id = 'b64_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

      resolve({
        id,
        name: filename,
        dataUrl,
        rawBase64,
        mime,
        extension: ext,
        width,
        height,
        sizeBytes: blob.size,
        blob,
        file,
      });
    };

    img.onerror = () => {
      reject(new Error('Could not reconstruct image pixels from Base64 string.'));
    };

    img.src = dataUrl;
  });
}

/**
 * Parse input that might contain multiple Base64 strings:
 * - JSON array of strings or objects { dataUri, name }
 * - Comma / newline separated Base64 strings
 * - Single Base64 string
 */
export function extractBase64Items(text: string): Array<{ base64: string; name?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Try parsing JSON format
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const results: Array<{ base64: string; name?: string }> = [];
        parsed.forEach((item, idx) => {
          if (typeof item === 'string') {
            results.push({ base64: item, name: `image_${idx + 1}` });
          } else if (item && typeof item === 'object') {
            const b64 = item.dataUri || item.base64 || item.url || item.src || '';
            const name = item.name || `image_${idx + 1}`;
            if (b64) results.push({ base64: b64, name });
          }
        });
        if (results.length > 0) return results;
      } else if (parsed && typeof parsed === 'object') {
        const b64 = parsed.dataUri || parsed.base64 || parsed.url || parsed.src || '';
        if (b64) return [{ base64: b64, name: parsed.name || 'image_1' }];
      }
    } catch {
      // Not JSON, continue to other delimiters
    }
  }

  // 2. Check for multiple data URLs: split on "data:image/"
  if (trimmed.indexOf('data:image/') !== trimmed.lastIndexOf('data:image/')) {
    const parts = trimmed.split(/(?=data:image\/)/g);
    const validParts = parts
      .map((p, i) => ({ base64: p.trim(), name: `image_${i + 1}` }))
      .filter((p) => p.base64.length > 10);
    if (validParts.length > 1) return validParts;
  }

  // 3. Fallback: single item
  return [{ base64: trimmed, name: 'decoded_image' }];
}

/**
 * Convert a DecodedBase64Result to an ImageFileItem compatible with useImageStore
 */
export function decodedResultToImageFileItem(item: DecodedBase64Result): ImageFileItem {
  return {
    id: item.id,
    file: item.file,
    name: item.name,
    size: item.sizeBytes,
    type: item.mime,
    url: item.dataUrl,
    width: item.width,
    height: item.height,
    aspectRatio: item.width / (item.height || 1),
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}

/**
 * Sample pre-generated Base64 image (A beautiful high-res modern gradient graphic)
 * Allows users to test the decoder immediately with 1 click.
 */
export const SAMPLE_BASE64_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAyKADAAQAAAABAAAAyAAAAAA7mQ0YAAAFPUlEQVR4Ae3XQU4UYRiG4eqp0Wv41/tfcDcaN97Gf13gAiTI1Mh0z7vdPsmT9J5m0vfp9QeBBAgQOBR4O9T5TQIECBwEFCQCBAgcCShIBw0/ESBAQEEyQIDAkYCCdNDwEwECBBQkAwQIHAkoSAcNPxEgQEBBMkCAwJGAgnTQ8BMBAgQUJAMECBwJKEgHDT8RIEBAQTJAgMCRAATjHAAAAABJRU5ErkJggg==';
