import { create } from 'zustand';
import {
  ImageFileItem,
  ResizeSettingsState,
  CompressorSettingsState,
  ConvertSettingsState,
  CropSettingsState,
  TransformSettingsState,
  FilterSettingsState,
  PdfSettingsState,
  StyleSettingsState,
  PickedColorInfo,
  PlanType,
} from '../types';
import { getPlanLimits, MAX_FILE_SIZE_BYTES_FREE, MAX_FILE_SIZE_BYTES_PRO } from '../config/plans';
import { decodeBase64ToImage, decodedResultToImageFileItem } from '../services/base64Decoder';
import { isPdfFile, extractPagesFromPdf } from '../services/pdfRenderer';

interface ImageStoreState {
  images: ImageFileItem[];
  selectedImageId: string | null;
  activeToolId: string;
  isPro: boolean;
  activePlan: PlanType;
  isPreparing: boolean;
  preparingProgress: number;
  planModalOpen: boolean;
  planModalMessage: string;
  toastMessage: string | null;

  // Picked Color State for Image Color Picker
  pickedColor: PickedColorInfo | null;
  colorHistory: PickedColorInfo[];

  // Tool Specific Settings
  resizeSettings: ResizeSettingsState;
  compressorSettings: CompressorSettingsState;
  convertSettings: ConvertSettingsState;
  cropSettings: CropSettingsState;
  transformSettings: TransformSettingsState;
  filterSettings: FilterSettingsState;
  pdfSettings: PdfSettingsState;
  styleSettings: StyleSettingsState;

  // Actions
  setActiveToolId: (id: string) => void;
  setSelectedImageId: (id: string | null) => void;
  togglePro: () => void;
  setPro: (pro: boolean) => void;
  setPlan: (plan: PlanType) => void;
  setPlanModalOpen: (open: boolean, message?: string) => void;
  setToastMessage: (msg: string | null) => void;

  // Color Picker Actions
  setPickedColor: (color: PickedColorInfo | null) => void;
  addColorToHistory: (color: PickedColorInfo) => void;
  clearColorHistory: () => void;

  // Image Management
  addFiles: (
    files: File[] | FileList,
    options?: { replace?: boolean }
  ) => Promise<{ added: number; limitHit: boolean; sizeExceeded: boolean }>;
  addBase64Images: (
    items: Array<{ base64: string; name?: string }>,
    options?: { replace?: boolean }
  ) => Promise<{ added: number; limitHit: boolean; errorCount: number }>;
  removeImage: (id: string) => void;
  clearImages: () => void;
  rotateImage: (id: string, degrees?: number) => void;
  rotateAllImages: (degrees?: number) => void;
  flipImage: (id: string, dir: 'h' | 'v') => void;
  flipAllImages: (dir: 'h' | 'v') => void;
  resetTransformations: () => void;
  setCropData: (
    id: string,
    cropData: { x: number; y: number; width: number; height: number } | undefined,
    cropPreviewUrl?: string
  ) => void;
  resetCrop: (id: string) => void;
  resetAllCrops: () => void;
  applyCenterCropToAll: (aspectRatio: number | null) => Promise<void>;

  // Setting Updaters
  updateResizeSettings: (partial: Partial<ResizeSettingsState>) => void;
  updateCompressorSettings: (partial: Partial<CompressorSettingsState>) => void;
  updateConvertSettings: (partial: Partial<ConvertSettingsState>) => void;
  updateCropSettings: (partial: Partial<CropSettingsState>) => void;
  updateTransformSettings: (partial: Partial<TransformSettingsState>) => void;
  updateFilterSettings: (partial: Partial<FilterSettingsState>) => void;
  updatePdfSettings: (partial: Partial<PdfSettingsState>) => void;
  updateStyleSettings: (partial: Partial<StyleSettingsState>) => void;
}

const DEFAULT_RESIZE_SETTINGS: ResizeSettingsState = {
  mode: 'size',
  fitMode: 'fit',
  width: '',
  height: '',
  unit: 'px',
  dpi: 72,
  lockAspectRatio: true,
  percentage: 50,
  socialPreset: '',
  targetFormat: 'original',
  quality: 0.9,
  targetFileSizeKB: '',
};

const DEFAULT_COMPRESSOR_SETTINGS: CompressorSettingsState = {
  mode: 'preset',
  preset: 'recommended',
  targetFormat: 'image/jpeg',
  quality: 0.75,
  targetFileSizeKB: '',
};

const DEFAULT_CONVERT_SETTINGS: ConvertSettingsState = {
  targetFormat: 'image/png',
  pngBackground: '#ffffff',
  quality: 0.92,
};

const DEFAULT_CROP_SETTINGS: CropSettingsState = {
  aspectRatio: null,
  ratioName: 'Free',
};

const DEFAULT_TRANSFORM_SETTINGS: TransformSettingsState = {
  rotationAngle: 0,
  flipHorizontal: false,
  flipVertical: false,
};

const DEFAULT_FILTER_SETTINGS: FilterSettingsState = {
  grayscale: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  pixelate: 1,
};

const DEFAULT_PDF_SETTINGS: PdfSettingsState = {
  mode: 'combined',
  orientation: 'auto',
  pageSize: 'a4',
  margin: 10,
  imageFit: 'contain',
};

const DEFAULT_STYLE_SETTINGS: StyleSettingsState = {
  roundMode: 'circle',
  cornerRadius: 25,
  roundBackground: 'transparent',
  roundBorderWidth: 0,
  roundBorderColor: '#ffffff',

  borderWidth: 16,
  borderRadius: 0,
  borderColor: '#ffffff',
  borderPosition: 'inset',
  borderStyle: 'solid',
  borderFillType: 'solid',
  gradientColor1: '#ec4899',
  gradientColor2: '#3b82f6',
  gradientAngle: 135,
  isPolaroid: false,

  watermarkText: 'PixiForge Watermark',
  watermarkOpacity: 60,
  watermarkColor: '#ffffff',
  watermarkPos: 'bottom-right',
  watermarkFontSize: 32,
  watermarkDate: '',
};

export const useImageStore = create<ImageStoreState>((set, get) => ({
  images: [],
  selectedImageId: null,
  activeToolId: 'image-resizer',
  isPro: false,
  activePlan: 'free',
  isPreparing: false,
  preparingProgress: 0,
  planModalOpen: false,
  planModalMessage: '',
  toastMessage: null,

  pickedColor: null,
  colorHistory: [],

  resizeSettings: { ...DEFAULT_RESIZE_SETTINGS },
  compressorSettings: { ...DEFAULT_COMPRESSOR_SETTINGS },
  convertSettings: { ...DEFAULT_CONVERT_SETTINGS },
  cropSettings: { ...DEFAULT_CROP_SETTINGS },
  transformSettings: { ...DEFAULT_TRANSFORM_SETTINGS },
  filterSettings: { ...DEFAULT_FILTER_SETTINGS },
  pdfSettings: { ...DEFAULT_PDF_SETTINGS },
  styleSettings: { ...DEFAULT_STYLE_SETTINGS },

  setActiveToolId: (id: string) => set({ activeToolId: id }),
  setSelectedImageId: (id: string | null) => set({ selectedImageId: id }),
  togglePro: () =>
    set((state) => {
      const nextPlan = state.activePlan === 'free' ? 'pro' : 'free';
      return { activePlan: nextPlan, isPro: nextPlan !== 'free' };
    }),
  setPro: (pro: boolean) =>
    set({
      isPro: pro,
      activePlan: pro ? 'pro' : 'free',
    }),
  setPlan: (plan: PlanType) =>
    set({
      activePlan: plan,
      isPro: plan !== 'free',
    }),
  setPlanModalOpen: (open: boolean, message = '') =>
    set({ planModalOpen: open, planModalMessage: message }),
  setToastMessage: (msg: string | null) => set({ toastMessage: msg }),

  setPickedColor: (color) => set({ pickedColor: color }),
  addColorToHistory: (color) =>
    set((state) => {
      const filtered = state.colorHistory.filter(
        (c) => c.hex.toLowerCase() !== color.hex.toLowerCase()
      );
      return {
        pickedColor: color,
        colorHistory: [color, ...filtered].slice(0, 30),
      };
    }),
  clearColorHistory: () => set({ colorHistory: [] }),

  addFiles: async (
    rawFiles: File[] | FileList,
    options?: { replace?: boolean }
  ) => {
    const isReplace = options?.replace ?? false;

    // Robust file validation: accept image and PDF files
    const fileArray = Array.from(rawFiles).filter((f) => {
      const isMimeImage = f.type && (f.type.startsWith('image/') || f.type === 'application/pdf');
      const isExtImage = /\.(jpe?g|png|webp|bmp|gif|tiff?|svg|avif|ico|pdf)$/i.test(f.name);
      return isMimeImage || isExtImage;
    });

    if (fileArray.length === 0) {
      get().setToastMessage('Please select valid image files (JPG, PNG, WebP, etc.).');
      return { added: 0, limitHit: false, sizeExceeded: false };
    }

    const { activePlan, isPro, images } = get();
    const limits = getPlanLimits(activePlan || (isPro ? 'pro' : 'free'));
    const maxFileSize = limits.maxFileSizeMB * 1024 * 1024;

    let sizeExceeded = false;
    let limitHit = false;

    // Filter by individual size limit
    const validSizeFiles: File[] = [];
    for (const file of fileArray) {
      if (file.size > maxFileSize) {
        sizeExceeded = true;
      } else {
        validSizeFiles.push(file);
      }
    }

    // Check batch quantity limit: if replace is true, start fresh from 0
    const currentCount = isReplace ? 0 : images.length;
    const availableSlots = Math.max(0, limits.maxFilesPerBatch - currentCount);

    if (validSizeFiles.length > availableSlots) {
      limitHit = true;
    }

    const filesToProcess = validSizeFiles.slice(0, availableSlots);

    if (filesToProcess.length === 0) {
      if (limitHit) {
        get().setPlanModalOpen(
          true,
          `${limits.name} plan allows up to ${limits.maxFilesPerBatch} images at a time. Upgrade to Pro, Max, or Ultra for higher batch limits.`
        );
      } else if (sizeExceeded) {
        get().setToastMessage(
          `Files exceeded maximum size limit of ${limits.maxFileSizeMB} MB.`
        );
      }
      return { added: 0, limitHit, sizeExceeded };
    }

    // If replacing, clean up previous object URLs and reset transforms
    if (isReplace) {
      if (images.length > 0) {
        images.forEach((img) => {
          if (img.url && !img.url.startsWith('data:')) {
            try {
              URL.revokeObjectURL(img.url);
            } catch {}
          }
        });
      }
      set({
        transformSettings: { ...DEFAULT_TRANSFORM_SETTINGS },
      });
    }

    // Trigger preparation progress screen
    set({ isPreparing: true, preparingProgress: 15 });

    const newItems: ImageFileItem[] = [];
    const totalFiles = filesToProcess.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesToProcess[i];
      try {
        if (isPdfFile(file)) {
          const maxAllowedPages = isPro
            ? 100
            : Math.max(1, limits.maxFilesPerBatch - (isReplace ? newItems.length : images.length + newItems.length));

          const pdfPages = await extractPagesFromPdf(file, {
            dpi: 150,
            maxPages: maxAllowedPages,
            onProgress: (curr, total) => {
              const progress = 15 + Math.floor(((i + curr / total) / totalFiles) * 80);
              set({ preparingProgress: Math.min(95, progress) });
            },
          });

          if (pdfPages.length > 0) {
            newItems.push(...pdfPages);
          } else {
            // Fallback if no pages could be parsed
            const fallbackItem = await readFileMetadata(file);
            newItems.push(fallbackItem);
          }
        } else {
          const item = await readFileMetadata(file);
          newItems.push(item);
        }
        const progress = 15 + Math.floor(((i + 1) / totalFiles) * 80);
        set({ preparingProgress: progress });
      } catch (err) {
        console.error('Failed reading file:', file.name, err);
      }
    }

    set({ preparingProgress: 100 });

    // Smooth transition
    await new Promise((r) => setTimeout(r, 180));

    // Combine or replace
    const combinedImages = isReplace ? newItems : [...get().images, ...newItems];

    // Default dimensions from first image if starting fresh
    if (combinedImages.length > 0 && (isReplace || get().resizeSettings.width === '')) {
      const first = combinedImages[0];
      set((s) => ({
        resizeSettings: {
          ...s.resizeSettings,
          width: first.width,
          height: first.height,
        },
      }));
    }

    // If no selected image or replacing, select the first image
    const currentSelected = get().selectedImageId;
    const nextSelectedId =
      isReplace || !currentSelected || !combinedImages.some((img) => img.id === currentSelected)
        ? combinedImages[0]?.id || null
        : currentSelected;

    set({
      images: combinedImages,
      selectedImageId: nextSelectedId,
      isPreparing: false,
      preparingProgress: 0,
    });

    if (limitHit) {
      get().setPlanModalOpen(
        true,
        `Free plan allows only ${limits.maxFilesPerBatch} images at a time. Upgrade to Pro for up to 100 images.`
      );
    } else if (sizeExceeded) {
      get().setToastMessage(
        `Some files exceeded ${limits.maxFileSizeMB} MB and were skipped.`
      );
    }

    return { added: newItems.length, limitHit, sizeExceeded };
  },

  addBase64Images: async (
    items: Array<{ base64: string; name?: string }>,
    options?: { replace?: boolean }
  ) => {
    const isReplace = options?.replace ?? false;
    if (!items || items.length === 0) {
      return { added: 0, limitHit: false, errorCount: 0 };
    }

    const { activePlan, isPro, images } = get();
    const limits = getPlanLimits(activePlan || (isPro ? 'pro' : 'free'));
    const currentCount = isReplace ? 0 : images.length;
    const availableSlots = Math.max(0, limits.maxFilesPerBatch - currentCount);
    const limitHit = items.length > availableSlots;
    const toProcess = items.slice(0, availableSlots);

    if (toProcess.length === 0) {
      if (limitHit) {
        get().setPlanModalOpen(
          true,
          `${limits.name} plan allows up to ${limits.maxFilesPerBatch} images at a time. Upgrade to Pro, Max, or Ultra for higher batch limits.`
        );
      }
      return { added: 0, limitHit, errorCount: 0 };
    }

    set({ isPreparing: true, preparingProgress: 20 });

    const newItems: ImageFileItem[] = [];
    let errorCount = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      try {
        const decoded = await decodeBase64ToImage(
          item.base64,
          item.name || `image_${currentCount + i + 1}`,
          currentCount + i + 1
        );
        newItems.push(decodedResultToImageFileItem(decoded));
      } catch (err) {
        console.error('Failed to decode Base64 item:', err);
        errorCount++;
      }
      const progress = 20 + Math.floor(((i + 1) / toProcess.length) * 75);
      set({ preparingProgress: progress });
    }

    set({ preparingProgress: 100 });
    await new Promise((r) => setTimeout(r, 150));

    const combinedImages = isReplace ? newItems : [...get().images, ...newItems];

    if (combinedImages.length > 0 && (isReplace || get().resizeSettings.width === '')) {
      const first = combinedImages[0];
      set((s) => ({
        resizeSettings: {
          ...s.resizeSettings,
          width: first.width,
          height: first.height,
        },
      }));
    }

    const currentSelected = get().selectedImageId;
    const nextSelectedId =
      isReplace || !currentSelected || !combinedImages.some((img) => img.id === currentSelected)
        ? combinedImages[0]?.id || null
        : currentSelected;

    set({
      images: combinedImages,
      selectedImageId: nextSelectedId,
      isPreparing: false,
      preparingProgress: 0,
    });

    if (limitHit) {
      get().setPlanModalOpen(
        true,
        `Free plan allows up to ${limits.maxFilesPerBatch} images at a time. Upgrade to Pro for up to 100.`
      );
    }

    return { added: newItems.length, limitHit, errorCount };
  },

  removeImage: (id: string) => {
    const { images, selectedImageId } = get();
    const target = images.find((img) => img.id === id);
    if (target?.url && !target.url.startsWith('data:')) {
      try {
        URL.revokeObjectURL(target.url);
      } catch {}
    }
    const remaining = images.filter((img) => img.id !== id);
    let nextSelected = selectedImageId;
    if (selectedImageId === id) {
      nextSelected = remaining.length > 0 ? remaining[0].id : null;
    }
    set({
      images: remaining,
      selectedImageId: nextSelected,
    });
    get().setToastMessage('Image removed');
  },

  clearImages: () => {
    const { images } = get();
    images.forEach((img) => {
      if (img.url && !img.url.startsWith('data:')) {
        try {
          URL.revokeObjectURL(img.url);
        } catch {}
      }
    });
    set({
      images: [],
      selectedImageId: null,
      resizeSettings: { ...DEFAULT_RESIZE_SETTINGS },
      transformSettings: { ...DEFAULT_TRANSFORM_SETTINGS },
      filterSettings: { ...DEFAULT_FILTER_SETTINGS },
      cropSettings: { ...DEFAULT_CROP_SETTINGS },
      styleSettings: { ...DEFAULT_STYLE_SETTINGS },
    });
  },

  rotateImage: (id: string, degrees = 90) => {
    set((state) => ({
      images: state.images.map((img) => {
        if (img.id !== id) return img;
        const newRotation = ((img.rotation || 0) + degrees) % 360;
        return {
          ...img,
          rotation: newRotation,
        };
      }),
    }));
  },

  rotateAllImages: (degrees = 90) => {
    set((state) => ({
      images: state.images.map((img) => ({
        ...img,
        rotation: ((img.rotation || 0) + degrees) % 360,
      })),
      transformSettings: {
        ...state.transformSettings,
        rotationAngle: ((state.transformSettings.rotationAngle || 0) + degrees) % 360,
      },
    }));
  },

  flipImage: (id: string, dir: 'h' | 'v') => {
    set((state) => {
      const updated = state.images.map((img) => {
        if (img.id !== id) return img;
        return dir === 'h'
          ? { ...img, flipH: !img.flipH }
          : { ...img, flipV: !img.flipV };
      });
      const allFlipH = updated.length > 0 && updated.every((img) => Boolean(img.flipH));
      const allFlipV = updated.length > 0 && updated.every((img) => Boolean(img.flipV));
      return {
        images: updated,
        transformSettings: {
          ...state.transformSettings,
          flipHorizontal: allFlipH,
          flipVertical: allFlipV,
        },
      };
    });
  },

  flipAllImages: (dir: 'h' | 'v') => {
    set((state) => {
      // Toggle the direction for all images
      const currentActive =
        dir === 'h'
          ? state.transformSettings.flipHorizontal
          : state.transformSettings.flipVertical;
      const targetVal = !currentActive;

      const updated = state.images.map((img) => ({
        ...img,
        ...(dir === 'h' ? { flipH: targetVal } : { flipV: targetVal }),
      }));

      return {
        images: updated,
        transformSettings: {
          ...state.transformSettings,
          ...(dir === 'h' ? { flipHorizontal: targetVal } : { flipVertical: targetVal }),
        },
      };
    });
  },

  resetTransformations: () => {
    set((state) => ({
      images: state.images.map((img) => ({
        ...img,
        rotation: 0,
        flipH: false,
        flipV: false,
      })),
      transformSettings: {
        rotationAngle: 0,
        flipHorizontal: false,
        flipVertical: false,
      },
    }));
  },

  setCropData: (id, cropData, cropPreviewUrl) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, cropData, cropPreviewUrl: cropPreviewUrl || img.cropPreviewUrl } : img
      ),
    }));
  },

  resetCrop: (id) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, cropData: undefined, cropPreviewUrl: undefined } : img
      ),
    }));
  },

  resetAllCrops: () => {
    set((state) => ({
      images: state.images.map((img) => ({
        ...img,
        cropData: undefined,
        cropPreviewUrl: undefined,
      })),
    }));
  },

  applyCenterCropToAll: async (aspectRatio) => {
    const { images } = get();
    if (images.length === 0) return;

    if (aspectRatio === null) {
      get().resetAllCrops();
      return;
    }

    const updatedImages = await Promise.all(
      images.map(async (img) => {
        const origW = img.width || 800;
        const origH = img.height || 600;

        let cropW = origW;
        let cropH = cropW / aspectRatio;
        if (cropH > origH) {
          cropH = origH;
          cropW = cropH * aspectRatio;
        }

        const cropX = Math.max(0, Math.round((origW - cropW) / 2));
        const cropY = Math.max(0, Math.round((origH - cropH) / 2));
        const finalW = Math.max(1, Math.min(origW - cropX, Math.round(cropW)));
        const finalH = Math.max(1, Math.min(origH - cropY, Math.round(cropH)));

        const cropData = {
          x: cropX,
          y: cropY,
          width: finalW,
          height: finalH,
        };

        // Render preview thumbnail
        let cropPreviewUrl: string | undefined;
        try {
          const canvas = document.createElement('canvas');
          const thumbW = Math.min(480, finalW);
          const thumbH = Math.max(1, Math.round(thumbW / aspectRatio));
          canvas.width = thumbW;
          canvas.height = thumbH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            await new Promise<void>((res) => {
              tempImg.onload = () => res();
              tempImg.onerror = () => res();
              tempImg.src = img.url;
            });
            ctx.drawImage(
              tempImg,
              cropX,
              cropY,
              finalW,
              finalH,
              0,
              0,
              thumbW,
              thumbH
            );
            cropPreviewUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch (e) {
          console.error('Failed generating crop preview for item', img.name, e);
        }

        return {
          ...img,
          cropData,
          cropPreviewUrl: cropPreviewUrl || img.cropPreviewUrl,
        };
      })
    );

    set({ images: updatedImages });
  },

  updateResizeSettings: (partial) =>
    set((state) => ({
      resizeSettings: { ...state.resizeSettings, ...partial },
    })),

  updateCompressorSettings: (partial) =>
    set((state) => ({
      compressorSettings: { ...state.compressorSettings, ...partial },
    })),

  updateConvertSettings: (partial) =>
    set((state) => ({
      convertSettings: { ...state.convertSettings, ...partial },
    })),

  updateCropSettings: (partial) =>
    set((state) => ({
      cropSettings: { ...state.cropSettings, ...partial },
    })),

  updateTransformSettings: (partial) =>
    set((state) => ({
      transformSettings: { ...state.transformSettings, ...partial },
    })),

  updateFilterSettings: (partial) =>
    set((state) => ({
      filterSettings: { ...state.filterSettings, ...partial },
    })),

  updatePdfSettings: (partial) =>
    set((state) => ({
      pdfSettings: { ...state.pdfSettings, ...partial },
    })),

  updateStyleSettings: (partial) =>
    set((state) => ({
      styleSettings: { ...state.styleSettings, ...partial },
    })),
}));

// Helper to safely read File and extract resolution with FileReader fallback
function readFileMetadata(file: File): Promise<ImageFileItem> {
  return new Promise(async (resolve, reject) => {
    // If file is a PDF, render the real first page using pdfjs-dist
    if (isPdfFile(file)) {
      try {
        const pages = await extractPagesFromPdf(file, { maxPages: 1, dpi: 150 });
        if (pages.length > 0) {
          resolve(pages[0]);
          return;
        }
      } catch (err) {
        console.error('Failed rendering real PDF page:', err);
      }
    }

    const tryLoad = (src: string, isDataUrl: boolean) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;
        resolve({
          id: 'img_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
          file,
          name: file.name,
          size: file.size,
          type: file.type || 'image/jpeg',
          url: src,
          width,
          height,
          aspectRatio: width / (height || 1),
          rotation: 0,
          flipH: false,
          flipV: false,
        });
      };

      img.onerror = () => {
        if (!isDataUrl) {
          // Fallback to FileReader DataURL
          const reader = new FileReader();
          reader.onload = () => tryLoad(reader.result as string, true);
          reader.onerror = () => reject(new Error('Failed reading image data'));
          reader.readAsDataURL(file);
        } else {
          reject(new Error('Image decode error'));
        }
      };

      img.src = src;
    };

    try {
      const blobUrl = URL.createObjectURL(file);
      tryLoad(blobUrl, false);
    } catch {
      // Direct DataURL fallback
      const reader = new FileReader();
      reader.onload = () => tryLoad(reader.result as string, true);
      reader.onerror = () => reject(new Error('Failed reading image'));
      reader.readAsDataURL(file);
    }
  });
}
