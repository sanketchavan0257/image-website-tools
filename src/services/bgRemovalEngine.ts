/**
 * High-performance Client-Side Background Removal Engine
 * Features:
 * - Edge-connected BFS flood-fill background detection (preserves internal matching colors)
 * - Color tolerance & distance calculation
 * - Alpha edge feathering & defringing
 * - Eye-dropper background sampling
 * - Background replacement (Transparent, Solid Colors, Gradients, Background Blur)
 */

export interface BgRemovalOptions {
  tolerance: number; // 5 to 100
  feather: number; // 0 to 10 px
  targetColor?: { r: number; g: number; b: number } | null; // specific sampled color, or auto-detect
  outputBackground: 'transparent' | 'color' | 'gradient' | 'blur';
  backgroundColor?: string;
  gradientIndex?: number;
  blurAmount?: number;
}

export const STUDIO_GRADIENTS = [
  { name: 'Sunset Glow', from: '#ff512f', to: '#dd2476' },
  { name: 'Cool Studio', from: '#2193b0', to: '#6dd5ed' },
  { name: 'Midnight Pro', from: '#232526', to: '#414345' },
  { name: 'Soft Pastel', from: '#e0c3fc', to: '#8ec5fc' },
  { name: 'Emerald Clean', from: '#0ba360', to: '#3cba92' },
  { name: 'Warm Portrait', from: '#fbc2eb', to: '#a6c1ee' },
];

export const STUDIO_SOLID_COLORS = [
  { name: 'Pure White (E-Commerce)', hex: '#ffffff' },
  { name: 'Studio Black', hex: '#000000' },
  { name: 'Neutral Grey', hex: '#f1f5f9' },
  { name: 'Passport Blue', hex: '#2563eb' },
  { name: 'Soft Cream', hex: '#fef3c7' },
  { name: 'Cyber Green', hex: '#10b981' },
];

/**
 * Calculates Euclidean color distance in RGB space
 */
function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Automatically estimates the dominant background color from perimeter border pixels
 */
export function detectDominantBorderColor(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { r: number; g: number; b: number } {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  // Sample top and bottom borders
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 50))) {
    // Top border
    const topIdx = (0 * width + x) * 4;
    sumR += data[topIdx];
    sumG += data[topIdx + 1];
    sumB += data[topIdx + 2];
    count++;

    // Bottom border
    const botIdx = ((height - 1) * width + x) * 4;
    sumR += data[botIdx];
    sumG += data[botIdx + 1];
    sumB += data[botIdx + 2];
    count++;
  }

  // Sample left and right borders
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 50))) {
    // Left border
    const leftIdx = (y * width + 0) * 4;
    sumR += data[leftIdx];
    sumG += data[leftIdx + 1];
    sumB += data[leftIdx + 2];
    count++;

    // Right border
    const rightIdx = (y * width + (width - 1)) * 4;
    sumR += data[rightIdx];
    sumG += data[rightIdx + 1];
    sumB += data[rightIdx + 2];
    count++;
  }

  if (count === 0) return { r: 255, g: 255, b: 255 };

  return {
    r: Math.round(sumR / count),
    g: Math.round(sumG / count),
    b: Math.round(sumB / count),
  };
}

/**
 * Removes background using connected border flood-fill & color tolerance
 * Preserves interior subject pixels and applies edge feathering
 */
export function removeBackgroundCanvas(
  sourceCanvas: HTMLCanvasElement,
  options: BgRemovalOptions
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Create working canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Determine target background color
  const targetBg = options.targetColor || detectDominantBorderColor(data, width, height);

  // Maximum distance based on tolerance (0 to 100 scale -> max RGB dist ~441)
  const maxDistance = (options.tolerance / 100) * 441;
  const featherRange = Math.max(1, (options.feather / 10) * 40);

  // Visited / isBackground bitmap for flood fill
  const isBg = new Uint8Array(width * height);
  const queue: number[] = [];

  // Seed boundary border pixels into BFS queue
  const pushPixel = (x: number, y: number) => {
    const idx = y * width + x;
    if (isBg[idx] === 0) {
      const pIdx = idx * 4;
      const dist = colorDistance(
        data[pIdx],
        data[pIdx + 1],
        data[pIdx + 2],
        targetBg.r,
        targetBg.g,
        targetBg.b
      );
      if (dist <= maxDistance + featherRange) {
        isBg[idx] = 1;
        queue.push(idx);
      }
    }
  };

  // Seed all 4 edges
  for (let x = 0; x < width; x++) {
    pushPixel(x, 0);
    pushPixel(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushPixel(0, y);
    pushPixel(width - 1, y);
  }

  // BFS Flood Fill from edges
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // 4-neighbor flood
    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (isBg[nIdx] === 0) {
          const npIdx = nIdx * 4;
          const dist = colorDistance(
            data[npIdx],
            data[npIdx + 1],
            data[npIdx + 2],
            targetBg.r,
            targetBg.g,
            targetBg.b
          );

          if (dist <= maxDistance + featherRange) {
            isBg[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }
  }

  // Apply transparency and soft feathered edge transition
  for (let i = 0; i < width * height; i++) {
    if (isBg[i] === 1) {
      const pIdx = i * 4;
      const dist = colorDistance(
        data[pIdx],
        data[pIdx + 1],
        data[pIdx + 2],
        targetBg.r,
        targetBg.g,
        targetBg.b
      );

      if (dist <= maxDistance) {
        // Completely transparent
        data[pIdx + 3] = 0;
      } else {
        // Feather transition
        const alphaRatio = (dist - maxDistance) / featherRange;
        data[pIdx + 3] = Math.round(Math.min(255, Math.max(0, 255 * alphaRatio)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Composes cutout over chosen background (transparent, color, gradient, blur)
 */
export function composeOutputBackground(
  cutoutCanvas: HTMLCanvasElement,
  originalCanvas: HTMLCanvasElement,
  options: BgRemovalOptions
): HTMLCanvasElement {
  const width = cutoutCanvas.width;
  const height = cutoutCanvas.height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return cutoutCanvas;

  if (options.outputBackground === 'transparent') {
    // Just draw cutout with transparency
    ctx.drawImage(cutoutCanvas, 0, 0);
    return outCanvas;
  }

  if (options.outputBackground === 'color') {
    // Solid background color
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(cutoutCanvas, 0, 0);
    return outCanvas;
  }

  if (options.outputBackground === 'gradient') {
    // Studio gradient
    const gradDef = STUDIO_GRADIENTS[options.gradientIndex || 0] || STUDIO_GRADIENTS[0];
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, gradDef.from);
    grad.addColorStop(1, gradDef.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(cutoutCanvas, 0, 0);
    return outCanvas;
  }

  if (options.outputBackground === 'blur') {
    // Blurred original background + sharp cutout on top
    ctx.filter = `blur(${options.blurAmount || 12}px)`;
    ctx.drawImage(originalCanvas, -20, -20, width + 40, height + 40);
    ctx.filter = 'none';
    ctx.drawImage(cutoutCanvas, 0, 0);
    return outCanvas;
  }

  ctx.drawImage(cutoutCanvas, 0, 0);
  return outCanvas;
}
