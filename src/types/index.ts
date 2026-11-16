export type PlanType = 'free' | 'pro' | 'max' | 'ultra';
export type BillingCycle = 'monthly' | '3months' | '6months' | 'yearly';

export interface PlanConfig {
  name: string;
  maxFilesPerBatch: number;
  maxFileSizeMB: number;
  hasAds: boolean;
  bulkTargetFileSize: boolean;
  customWatermark: boolean;
  unlimitedPdfPages: boolean;
  canDownloadZip: boolean;
  canDownloadSeparately: boolean;
}

export interface ToolDefinition {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  category: 'resize-optimize' | 'convert' | 'transform' | 'filters' | 'combine-split' | 'info-privacy' | 'branding';
  description: string;
  metaTitle: string;
  metaDescription: string;
  iconName: string;
  phase: number;
  howToSteps: string[];
  faqs: { question: string; answer: string }[];
  supportedFormats?: string[];
}

export interface ImageFileItem {
  id: string;
  file: File;
  name: string;
  size: number; // in bytes
  type: string; // mime
  url: string; // blob object URL
  width: number;
  height: number;
  aspectRatio: number;
  rotation: number; // 0, 90, 180, 270
  flipH?: boolean;
  flipV?: boolean;
  cropData?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cropPreviewUrl?: string;
  customOptions?: Record<string, any>;
}

export interface ProcessedResultItem {
  id: string;
  originalName: string;
  newName: string;
  blob: Blob;
  url: string;
  originalSize: number;
  processedSize: number;
  originalDimensions: { width: number; height: number };
  processedDimensions: { width: number; height: number };
  format: string;
}
export interface PickedColorInfo {
  hex: string;
  rgb: string;
  hsl: string;
  cmyk: string;
  rgbValues?: { r: number; g: number; b: number; a?: number };
  x?: number;
  y?: number;
  timestamp?: number;
}

export interface ResizeSettingsState {
  mode: 'size' | 'percentage' | 'social';
  fitMode: 'fit' | 'exact' | 'fill';
  width: number | '';
  height: number | '';
  unit: 'px' | 'cm' | 'mm' | 'inch';
  dpi: number;
  lockAspectRatio: boolean;
  percentage: number;
  socialPreset: string;
  targetFormat: 'original' | 'image/jpeg' | 'image/png' | 'image/webp';
  quality: number; // 0.1 to 1.0
  targetFileSizeKB: number | ''; // optional target file size
}

export interface CompressorSettingsState {
  mode: 'preset' | 'target-size' | 'custom-quality';
  preset: 'recommended' | 'aggressive' | 'light';
  targetFormat: 'original' | 'image/jpeg' | 'image/webp' | 'image/png';
  quality: number; // 0.1 to 1.0
  targetFileSizeKB: number | '';
}

export interface ConvertSettingsState {
  targetFormat: 'image/jpeg' | 'image/png' | 'image/webp';
  pngBackground: string; // background fill for transparent PNG to JPG
  quality: number;
}

export interface CropSettingsState {
  aspectRatio: number | null; // null for free, 1 for 1:1, etc.
  ratioName: string;
}

export interface TransformSettingsState {
  rotationAngle: number; // 0, 90, 180, 270
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface FilterSettingsState {
  grayscale: boolean;
  brightness: number; // -100 to 100 (0 default)
  contrast: number; // -100 to 100 (0 default)
  saturation: number; // -100 to 100 (0 default)
  blur: number; // 0 to 50 px
  pixelate: number; // 1 to 50 px (1 = no pixelation)
}

export interface PdfSettingsState {
  mode: 'combined' | 'separate';
  orientation: 'auto' | 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter' | 'fit';
  margin: number; // in mm (0 to 30)
  imageFit: 'contain' | 'fill';
}

export interface StyleSettingsState {
  // Round Image Maker
  roundMode: 'circle' | 'radius';
  cornerRadius: number; // 0 to 50%
  roundBackground: 'transparent' | string;
  roundBorderWidth: number; // in px
  roundBorderColor: string;

  // Border Maker
  borderWidth: number;
  borderRadius: number; // in px or percentage
  borderColor: string;
  borderPosition: 'inset' | 'expand';
  borderStyle: 'solid' | 'dashed' | 'double';
  borderFillType: 'solid' | 'gradient';
  gradientColor1: string;
  gradientColor2: string;
  gradientAngle: number; // 0 to 360 degrees
  isPolaroid: boolean;

  // Watermark
  watermarkText: string;
  watermarkOpacity: number;
  watermarkColor: string;
  watermarkPos: string;
  watermarkFontSize?: number;
  watermarkDate?: string;
}


