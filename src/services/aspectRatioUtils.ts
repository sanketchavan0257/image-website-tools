export interface StandardAspectRatio {
  label: string;
  name: string;
  ratioX: number;
  ratioY: number;
  value: number;
  category: 'Social Media' | 'Photography' | 'Video & Screen' | 'Print & Paper';
  description: string;
}

export const COMMON_STANDARD_RATIOS: StandardAspectRatio[] = [
  {
    label: '1:1',
    name: 'Square',
    ratioX: 1,
    ratioY: 1,
    value: 1,
    category: 'Social Media',
    description: 'Instagram Feed, Profile Avatars, Product Photos',
  },
  {
    label: '4:5',
    name: 'Portrait (Vertical)',
    ratioX: 4,
    ratioY: 5,
    value: 4 / 5, // 0.80
    category: 'Social Media',
    description: 'Instagram Feed Posts (4:5 optimal vertical format)',
  },
  {
    label: '9:16',
    name: 'Full Vertical',
    ratioX: 9,
    ratioY: 16,
    value: 9 / 16, // 0.5625
    category: 'Social Media',
    description: 'Instagram Stories, Reels, TikTok, YouTube Shorts',
  },
  {
    label: '16:9',
    name: 'Widescreen Landscape',
    ratioX: 16,
    ratioY: 9,
    value: 16 / 9, // 1.7778
    category: 'Video & Screen',
    description: 'YouTube Videos, HDTV, Computer Monitors, Presentations',
  },
  {
    label: '4:3',
    name: 'Standard Landscape',
    ratioX: 4,
    ratioY: 3,
    value: 4 / 3, // 1.3333
    category: 'Photography',
    description: 'Classic Television, iPad Screens, Compact Cameras',
  },
  {
    label: '3:4',
    name: 'Standard Portrait',
    ratioX: 3,
    ratioY: 4,
    value: 3 / 4, // 0.75
    category: 'Photography',
    description: 'iPad Vertical, Smartphone Photography, Portrait Prints',
  },
  {
    label: '3:2',
    name: '35mm Film / DSLR Landscape',
    ratioX: 3,
    ratioY: 2,
    value: 3 / 2, // 1.5
    category: 'Photography',
    description: 'Classic 35mm Film, DSLR Cameras, 4×6" Photo Prints',
  },
  {
    label: '2:3',
    name: 'DSLR Portrait',
    ratioX: 2,
    ratioY: 3,
    value: 2 / 3, // 0.6667
    category: 'Photography',
    description: 'Vertical DSLR Photos, 6×4" Framed Prints',
  },
  {
    label: '5:4',
    name: 'Large Format Print',
    ratioX: 5,
    ratioY: 4,
    value: 5 / 4, // 1.25
    category: 'Print & Paper',
    description: '8×10" and 16×20" Photo Frames & Art Prints',
  },
  {
    label: '21:9',
    name: 'Ultrawide Cinema',
    ratioX: 21,
    ratioY: 9,
    value: 21 / 9, // 2.3333
    category: 'Video & Screen',
    description: 'Ultrawide Curved Gaming Monitors, Anamorphic Cinema',
  },
  {
    label: '1.91:1',
    name: 'Landscape Banner',
    ratioX: 1.91,
    ratioY: 1,
    value: 1.91,
    category: 'Social Media',
    description: 'Facebook Shared Link Previews, Twitter/X Landscape Cards',
  },
  {
    label: '2:1',
    name: 'Univisium',
    ratioX: 2,
    ratioY: 1,
    value: 2,
    category: 'Social Media',
    description: 'Twitter Header Banners, Streaming Modern Format',
  },
];

// Greatest Common Divisor
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export interface StandardRatioMatch extends StandardAspectRatio {
  differencePercent: number;
  matchPercent: number;
  isExact: boolean;
}

export interface AspectRatioAnalysis {
  width: number;
  height: number;
  decimal: number;
  exactX: number;
  exactY: number;
  simplifiedX: number;
  simplifiedY: number;
  orientation: 'Portrait (Vertical)' | 'Landscape (Horizontal)' | 'Square (1:1)';
  isPureStandard: boolean;
  bestStandard: StandardRatioMatch;
  closeStandards: StandardRatioMatch[];
}

/**
 * Detailed aspect ratio analysis for any width & height
 */
export function analyzeAspectRatio(rawW: number, rawH: number): AspectRatioAnalysis {
  const width = Math.max(1, Math.round(rawW));
  const height = Math.max(1, Math.round(rawH));

  const decimal = width / height;

  // Exact mathematical ratio using GCD
  const div = gcd(width, height);
  const exactX = width / div;
  const exactY = height / div;

  // Orientation
  let orientation: 'Portrait (Vertical)' | 'Landscape (Horizontal)' | 'Square (1:1)';
  if (Math.abs(width - height) <= 2) {
    orientation = 'Square (1:1)';
  } else if (width > height) {
    orientation = 'Landscape (Horizontal)';
  } else {
    orientation = 'Portrait (Vertical)';
  }

  // Find closest standard matches
  const matches: StandardRatioMatch[] = COMMON_STANDARD_RATIOS.map((std) => {
    const diff = Math.abs(decimal - std.value);
    const diffPercent = (diff / std.value) * 100;
    const matchPercent = Math.max(0, 100 - diffPercent);
    const isExact = (exactX === std.ratioX && exactY === std.ratioY) || diffPercent < 0.05;

    return {
      ...std,
      differencePercent: diffPercent,
      matchPercent: Number(matchPercent.toFixed(1)),
      isExact,
    };
  }).sort((a, b) => a.differencePercent - b.differencePercent);

  const bestStandard = matches[0];
  const closeStandards = matches.filter((m) => m.differencePercent <= 4);

  // Simplified approximation for clean display
  let simplifiedX = exactX;
  let simplifiedY = exactY;

  // If exact ratio numbers are huge (e.g. > 30, like 495:619) but close to standard (< 3% diff), use the best standard ratio
  if ((exactX > 30 || exactY > 30) && bestStandard.differencePercent < 3) {
    simplifiedX = bestStandard.ratioX;
    simplifiedY = bestStandard.ratioY;
  }

  return {
    width,
    height,
    decimal,
    exactX,
    exactY,
    simplifiedX,
    simplifiedY,
    orientation,
    isPureStandard: bestStandard.differencePercent < 0.2,
    bestStandard,
    closeStandards,
  };
}
