import { PickedColorInfo } from '../types';

export function rgbaToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (c: number) => clamp(c).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b };
  }
  return null;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return {
    h: (h + 360) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function rgbToCmyk(r: number, g: number, b: number): { c: number; m: number; y: number; k: number } {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = Math.round(((1 - rNorm - k) / (1 - k)) * 100);
  const m = Math.round(((1 - gNorm - k) / (1 - k)) * 100);
  const y = Math.round(((1 - bNorm - k) / (1 - k)) * 100);

  return {
    c: Math.max(0, Math.min(100, c)),
    m: Math.max(0, Math.min(100, m)),
    y: Math.max(0, Math.min(100, y)),
    k: Math.max(0, Math.min(100, Math.round(k * 100))),
  };
}

export function createPickedColor(
  r: number,
  g: number,
  b: number,
  a: number = 1,
  x?: number,
  y?: number
): PickedColorInfo {
  const hslObj = rgbToHsl(r, g, b);
  const cmykObj = rgbToCmyk(r, g, b);

  return {
    hex: rgbaToHex(r, g, b),
    rgb: a < 1 ? `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})` : `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${hslObj.h}, ${hslObj.s}%, ${hslObj.l}%)`,
    cmyk: `cmyk(${cmykObj.c}%, ${cmykObj.m}%, ${cmykObj.y}%, ${cmykObj.k}%)`,
    rgbValues: { r, g, b, a },
    x,
    y,
    timestamp: Date.now(),
  };
}

export function createPickedColorFromHex(hex: string, x?: number, y?: number): PickedColorInfo {
  const rgb = hexToRgb(hex) || { r: 59, g: 130, b: 246 };
  return createPickedColor(rgb.r, rgb.g, rgb.b, 1, x, y);
}

/**
 * Extract distinct vibrant / dominant colors from an HTMLImageElement
 */
export function extractDominantColorsFromImage(img: HTMLImageElement, count = 10): PickedColorInfo[] {
  try {
    const canvas = document.createElement('canvas');
    const sampleSize = 100;
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
    
    // Group similar colors using color bucket quantizer
    const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();
    const step = 4 * 2; // sample every 2nd pixel

    for (let i = 0; i < data.length; i += step) {
      const a = data[i + 3];
      if (a < 128) continue; // skip transparent pixels

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Quantize to 16 steps per channel (reduces variations)
      const qR = Math.round(r / 20) * 20;
      const qG = Math.round(g / 20) * 20;
      const qB = Math.round(b / 20) * 20;
      const key = `${qR}-${qG}-${qB}`;

      const existing = colorMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        colorMap.set(key, { r, g, b, count: 1 });
      }
    }

    const sorted = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, count * 2);

    const results: PickedColorInfo[] = [];
    const hexes = new Set<string>();

    for (const item of sorted) {
      const hex = rgbaToHex(item.r, item.g, item.b);
      if (!hexes.has(hex)) {
        hexes.add(hex);
        results.push(createPickedColor(item.r, item.g, item.b));
        if (results.length >= count) break;
      }
    }

    return results;
  } catch {
    return [];
  }
}
