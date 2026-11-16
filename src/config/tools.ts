import { ToolDefinition } from '../types';

export const TOOLS: ToolDefinition[] = [
  // --- Flagship AI / Edge Tools ---
  {
    id: 'bg-remover',
    slug: 'bg-remover',
    name: 'Background Remover',
    shortName: 'Remove BG',
    category: 'resize-optimize',
    description: 'Instantly remove background from photos with smart edge detection, color sampling, and magic eraser. 100% in-browser.',
    metaTitle: 'Free Background Remover Online - Remove Photo BG 100% In-Browser',
    metaDescription: 'Instantly remove background from photos and images. Transparent PNG cutout, custom color replacement, magic brush touch-up. 100% free and in-browser.',
    iconName: 'Sparkles',
    phase: 1,
    howToSteps: [
      'Upload your photo or image (JPG, PNG, or WebP).',
      'The smart auto-cutout instantly identifies and removes the background.',
      'Use the Before/After split slider to inspect the cutout precision.',
      'Fine-tune with the Eye-dropper, Tolerance slider, or Magic Eraser brush if needed.',
      'Choose a new background (Transparent, Studio Color, Gradient, or Bokeh Blur) and download!'
    ],
    faqs: [
      {
        question: 'How does in-browser background removal work?',
        answer: 'Our smart edge-detection algorithm analyzes border pixels and performs flood-fill segmentation directly inside your browser. No files are uploaded to any server.'
      },
      {
        question: 'Can I download transparent PNGs?',
        answer: 'Yes! Download high-resolution transparent PNG cutouts ready for e-commerce, logos, portraits, or design projects.'
      },
      {
        question: 'Can I replace the background with solid colors or blur?',
        answer: 'Yes, select from Amazon/Shopify standard white, studio black, passport blue, modern gradients, or DSLR bokeh blur.'
      }
    ]
  },
  // --- Resize & Optimize (4) ---
  {
    id: 'image-resizer',
    slug: 'image-resizer',
    name: 'Image Resizer',
    shortName: 'Resize',
    category: 'resize-optimize',
    description: 'Resize multiple images by exact pixels, percentage, or social media presets with aspect ratio lock.',
    metaTitle: 'Free Image Resizer Online - Resize JPG, PNG, WebP Images in Bulk',
    metaDescription: 'Resize multiple images proportionally by pixels, percentage, or social media presets. 100% free, fast, and processed right inside your browser.',
    iconName: 'Maximize2',
    phase: 1,
    howToSteps: [
      'Select or drag-and-drop your images (up to 5 images for free, or 100+ for Pro).',
      'Choose whether to resize By Size (pixels/cm/mm/inches), As Percentage, or Social Media presets.',
      'Adjust optional export settings like target file size (KB/MB) and output format.',
      'Click "Export & Download" to get your images individually or packed in a single ZIP file.'
    ],
    faqs: [
      {
        question: 'Does resizing reduce image quality?',
        answer: 'Resizing down to smaller dimensions preserves clarity while significantly reducing file size. Resizing up might introduce slight blur, but our high-performance canvas engine uses bicubic smoothing to keep it crisp.'
      },
      {
        question: 'Are my images uploaded to any server?',
        answer: 'No! All processing runs 100% locally on your computer or phone using HTML5 Canvas and Web Workers. Your private photos never leave your device.'
      },
      {
        question: 'How does aspect ratio locking work for multiple images of different sizes?',
        answer: 'When "Lock Aspect Ratio" is enabled, our system scales each image proportionally to fit within your specified maximum width and height bounds without any distortion.'
      },
      {
        question: 'Can I resize by physical print units like cm, mm, or inches?',
        answer: 'Yes! Select cm, mm, or inch from the unit selector and specify your desired DPI (72 for screen, 300 for high-quality printing).'
      }
    ]
  },
  {
    id: 'image-compressor',
    slug: 'image-compressor',
    name: 'Image Compressor',
    shortName: 'Compress',
    category: 'resize-optimize',
    description: 'Compress JPG, PNG, and WebP images to the exact target KB/MB or with automatic intelligent quality.',
    metaTitle: 'Free Image Compressor - Reduce Image File Size Online',
    metaDescription: 'Compress images without visible quality loss. Target specific KB/MB sizes using intelligent binary search compression right in your browser.',
    iconName: 'Minimize2',
    phase: 1,
    howToSteps: [
      'Upload your JPG, PNG, or WebP images.',
      'Select a compression level: Recommended (optimal balance), Aggressive, or set an exact Target File Size in KB.',
      'Review the real-time estimated file sizes.',
      'Click "Export & Download" to download immediately or save as a ZIP.'
    ],
    faqs: [
      {
        question: 'How does Target File Size compression work?',
        answer: 'We utilize an in-browser binary search algorithm that tests compression parameters iteratively to match your target KB/MB threshold as closely as possible without exceeding it.'
      },
      {
        question: 'Can transparent PNGs be compressed?',
        answer: 'Yes! PNGs can be compressed directly or converted to WebP for even greater compression while retaining crispness.'
      },
      {
        question: 'Is there a limit on how many images I can compress at once?',
        answer: 'Free users can compress up to 5 images per batch (10 MB each). Pro users can process up to 100 images up to 100 MB each.'
      }
    ]
  },
  {
    id: 'image-cropper',
    slug: 'image-cropper',
    name: 'Image Cropper',
    shortName: 'Crop',
    category: 'resize-optimize',
    description: 'Crop images with preset aspect ratios (1:1, 16:9, 4:3, 9:16) or freeform bounding boxes.',
    metaTitle: 'Free Image Cropper Online - Crop JPG & PNG with Exact Ratios',
    metaDescription: 'Crop photos easily with preset aspect ratios for Instagram, YouTube, profile pictures, or free crop. Fast, private, browser-based.',
    iconName: 'Crop',
    phase: 1,
    howToSteps: [
      'Select or drop your photos into the cropper.',
      'Choose an aspect ratio preset (1:1 Square, 16:9 Landscape, 9:16 Story, 4:3) or click Freeform.',
      'Drag and position the crop handles on individual images or apply batch presets.',
      'Click Export to download your cropped photos.'
    ],
    faqs: [
      {
        question: 'Can I crop multiple images at the same time?',
        answer: 'Yes, you can apply a universal aspect ratio preset to your entire batch, or click the Crop button on each individual card for fine-grained manual adjustments.'
      },
      {
        question: 'Will cropping reduce photo resolution?',
        answer: 'Cropping only trims outer areas without degrading pixels inside the selected frame, preserving full original sensor sharpness.'
      }
    ]
  },
  {
    id: 'image-size-checker',
    slug: 'image-size-checker',
    name: 'Image Size Checker',
    shortName: 'Size Checker',
    category: 'resize-optimize',
    description: 'Check exact byte weight, file size in KB/MB, and compression possibilities.',
    metaTitle: 'Online Image Size Checker - Inspect File Weight and Dimensions',
    metaDescription: 'Quickly inspect your images file size, byte count, and check if it meets website upload thresholds.',
    iconName: 'FileText',
    phase: 3,
    howToSteps: ['Upload images to see detailed file sizes and breakdown.'],
    faqs: [{ question: 'What is this tool for?', answer: 'Check exact file sizes before uploading to portal requirements.' }]
  },

  // --- Convert (7) ---
  {
    id: 'jpg-to-png',
    slug: 'jpg-to-png',
    name: 'JPG to PNG Converter',
    shortName: 'JPG to PNG',
    category: 'convert',
    description: 'Convert JPG/JPEG images to lossless PNG format with zero compression artifacts.',
    metaTitle: 'Free JPG to PNG Converter - Convert JPG to Lossless PNG Online',
    metaDescription: 'Convert JPG files to PNG format in bulk. 100% private in-browser conversion, no server uploads, high quality.',
    iconName: 'FileCode',
    phase: 1,
    howToSteps: [
      'Upload your JPG or JPEG images.',
      'Select PNG conversion parameters.',
      'Click Export & Download to get lossless PNG files instantly.'
    ],
    faqs: [
      {
        question: 'Why convert JPG to PNG?',
        answer: 'PNG uses lossless compression, meaning no further image data is lost when editing or saving repeatedly. It also prevents compression block artifacts.'
      },
      {
        question: 'Is it completely free?',
        answer: 'Yes! Convert up to 5 JPGs per batch for free without watermarks or registration.'
      }
    ]
  },
  {
    id: 'png-to-jpg',
    slug: 'png-to-jpg',
    name: 'PNG to JPG Converter',
    shortName: 'PNG to JPG',
    category: 'convert',
    description: 'Convert PNG images to lightweight JPG format with custom background color for transparency.',
    metaTitle: 'Free PNG to JPG Converter - Convert PNG to JPG with Custom Background',
    metaDescription: 'Convert transparent or opaque PNGs to JPG with custom background colors (white, black, or custom hex) and quality control.',
    iconName: 'Image',
    phase: 1,
    howToSteps: [
      'Upload your PNG images.',
      'Select your desired background color for transparent pixels (white is default).',
      'Adjust JPG quality slider (80%-95% recommended).',
      'Click Export to download your converted JPG files.'
    ],
    faqs: [
      {
        question: 'What happens to transparent backgrounds in PNG?',
        answer: 'JPG does not support transparency. Our converter allows you to pick any solid background color (pure white, black, or custom brand color) to replace transparent areas cleanly.'
      },
      {
        question: 'How much smaller will the JPG file be?',
        answer: 'Typically, converting PNG to JPG reduces file size by 50% to 80%, making it ideal for web publishing and email.'
      }
    ]
  },
  {
    id: 'webp-converter',
    slug: 'webp-converter',
    name: 'WebP Converter',
    shortName: 'WebP Convert',
    category: 'convert',
    description: 'Convert images to modern Google WebP format or convert WebP back to JPG/PNG.',
    metaTitle: 'Free WebP Converter Online - Convert to and from WebP',
    metaDescription: 'Convert JPG and PNG to modern WebP for smaller web payloads and faster website loading, or convert WebP to JPG/PNG.',
    iconName: 'Zap',
    phase: 1,
    howToSteps: [
      'Select your JPG, PNG, or WebP files.',
      'Choose output format: WebP (modern web standard), JPG, or PNG.',
      'Fine-tune quality slider and target size if needed.',
      'Click Export to download your optimized files.'
    ],
    faqs: [
      {
        question: 'Why use WebP format?',
        answer: 'WebP provides superior lossless and lossy compression for web images. WebP images are usually 25% to 34% smaller than comparable JPEGs at equivalent visual quality.'
      },
      {
        question: 'Do all modern browsers support WebP?',
        answer: 'Yes! All major modern web browsers (Chrome, Safari, Firefox, Edge, iOS Safari, Android) support WebP natively.'
      }
    ]
  },
  {
    id: 'image-to-base64',
    slug: 'image-to-base64',
    name: 'Image to Base64',
    shortName: 'To Base64',
    category: 'convert',
    description: 'Convert any image to a Base64 data URI string for embedding directly into HTML or CSS.',
    metaTitle: 'Free Image to Base64 Converter Online',
    metaDescription: 'Convert JPG, PNG, WebP images to Base64 strings or HTML img tags instantly.',
    iconName: 'Binary',
    phase: 3,
    howToSteps: ['Upload an image and copy the generated base64 code.'],
    faqs: [{ question: 'What is Base64?', answer: 'Base64 encodes binary image data into text format.' }]
  },
  {
    id: 'base64-to-image',
    slug: 'base64-to-image',
    name: 'Base64 to Image',
    shortName: 'Base64 to Img',
    category: 'convert',
    description: 'Decode Base64 strings into downloadable JPG or PNG images.',
    metaTitle: 'Base64 to Image Decoder Online',
    metaDescription: 'Paste Base64 data string and instantly view and download the reconstructed image.',
    iconName: 'FileCode2',
    phase: 3,
    howToSteps: ['Paste Base64 string and download image.'],
    faqs: [{ question: 'How to decode?', answer: 'Simply paste the data URL or raw base64 string.' }]
  },
  {
    id: 'image-to-pdf',
    slug: 'image-to-pdf',
    name: 'Image to PDF Converter',
    shortName: 'Image to PDF',
    category: 'convert',
    description: 'Convert multiple images into a clean, paginated PDF document.',
    metaTitle: 'Convert Image to PDF Online - Merge Photos into PDF',
    metaDescription: 'Combine JPG and PNG images into a single professional PDF document right in your browser.',
    iconName: 'FileSpreadsheet',
    phase: 4,
    howToSteps: ['Select images and download a consolidated PDF document.'],
    faqs: [{ question: 'Can I reorder images?', answer: 'Yes, arrange photos before generating the PDF.' }]
  },
  {
    id: 'pdf-to-image',
    slug: 'pdf-to-image',
    name: 'PDF to Image Converter',
    shortName: 'PDF to Image',
    category: 'convert',
    description: 'Extract pages from PDF files and save them as high-resolution JPG or PNG images.',
    metaTitle: 'Convert PDF to JPG/PNG Online',
    metaDescription: 'Render PDF document pages into high resolution JPG or PNG graphics in browser.',
    iconName: 'FileText',
    phase: 4,
    howToSteps: ['Upload PDF and extract each page as an image.'],
    faqs: [{ question: 'Is page limit enforced?', answer: 'Free users can extract up to 5 pages; Pro is unlimited.' }]
  },

  // --- Transform (4) ---
  {
    id: 'image-rotator',
    slug: 'image-rotator',
    name: 'Image Rotator',
    shortName: 'Rotate',
    category: 'transform',
    description: 'Rotate images clockwise or counter-clockwise by 90, 180, or 270 degrees in bulk.',
    metaTitle: 'Free Image Rotator Online - Rotate Photos 90, 180, 270 Degrees',
    metaDescription: 'Quickly rotate photos and fix orientation issues without re-encoding quality degradation.',
    iconName: 'RotateCw',
    phase: 2,
    howToSteps: ['Upload images and choose rotation angles.'],
    faqs: [{ question: 'Can I rotate individual images?', answer: 'Yes, per-image and batch rotation are supported.' }]
  },
  {
    id: 'image-flipper',
    slug: 'image-flipper',
    name: 'Image Flipper',
    shortName: 'Flip',
    category: 'transform',
    description: 'Flip images horizontally (mirror) or vertically with one click.',
    metaTitle: 'Free Image Flipper - Mirror Image Horizontally & Vertically',
    metaDescription: 'Mirror and flip your images horizontally or vertically in bulk.',
    iconName: 'FlipHorizontal',
    phase: 2,
    howToSteps: ['Upload images, select horizontal or vertical flip, and export.'],
    faqs: [{ question: 'Does flipping alter quality?', answer: 'No, flipping preserves pixel fidelity completely.' }]
  },
  {
    id: 'round-image-maker',
    slug: 'round-image-maker',
    name: 'Round Image Maker',
    shortName: 'Round Image',
    category: 'transform',
    description: 'Create circular or rounded corner images with smooth anti-aliased transparency.',
    metaTitle: 'Round Image Maker - Circular Avatar Creator Online',
    metaDescription: 'Make circular images or adjust border-radius for avatars and profile pictures.',
    iconName: 'Circle',
    phase: 4,
    howToSteps: ['Upload image, select round or corner radius, and download as PNG.'],
    faqs: [{ question: 'Does it support transparency?', answer: 'Yes, exported PNGs have transparent corners.' }]
  },
  {
    id: 'image-border-maker',
    slug: 'image-border-maker',
    name: 'Image Border Maker',
    shortName: 'Add Border',
    category: 'transform',
    description: 'Add stylish solid, gradient, or polaroid borders with custom padding and colors.',
    metaTitle: 'Add Border to Image Online - Custom Frames & Colors',
    metaDescription: 'Frame your images with customized border widths, colors, and margins.',
    iconName: 'Square',
    phase: 4,
    howToSteps: ['Upload image, choose border width and color, export.'],
    faqs: [{ question: 'Can I pick any color?', answer: 'Yes, use the interactive hex color picker.' }]
  },

  // --- Filters (6) ---
  {
    id: 'grayscale-converter',
    slug: 'grayscale-converter',
    name: 'Grayscale Converter',
    shortName: 'Grayscale',
    category: 'filters',
    description: 'Convert color photos to classic black and white grayscale.',
    metaTitle: 'Convert Image to Black and White (Grayscale) Online',
    metaDescription: 'Turn colorful images into black & white with luminance preservation.',
    iconName: 'Eye',
    phase: 2,
    howToSteps: ['Upload images and apply instant black & white conversion.'],
    faqs: [{ question: 'How is grayscale calculated?', answer: 'Using standard ITU-R BT.601 luminance weighting.' }]
  },
  {
    id: 'blur-image',
    slug: 'blur-image',
    name: 'Blur Image',
    shortName: 'Blur',
    category: 'filters',
    description: 'Apply gaussian blur to photos or soften backgrounds with adjustable radius.',
    metaTitle: 'Blur Image Online - Smooth Gaussian Blur Tool',
    metaDescription: 'Blur entire photos or soften visual elements with customizable blur intensity.',
    iconName: 'Droplet',
    phase: 2,
    howToSteps: ['Upload images, adjust blur radius slider, and export.'],
    faqs: [{ question: 'What is the blur range?', answer: 'Adjustable from subtle 1px to heavy 50px blur.' }]
  },
  {
    id: 'pixelate-image',
    slug: 'pixelate-image',
    name: 'Pixelate Image',
    shortName: 'Pixelate',
    category: 'filters',
    description: 'Censor sensitive information or create retro 8-bit pixel art aesthetics.',
    metaTitle: 'Pixelate Image Online - Retro Pixel Art & Censor Tool',
    metaDescription: 'Turn images into retro pixel art or censor sensitive areas easily.',
    iconName: 'Grid',
    phase: 2,
    howToSteps: ['Upload photo, set pixel block size, and download.'],
    faqs: [{ question: 'How does pixelation work?', answer: 'Downsampled and scaled without smoothing for crisp retro blocks.' }]
  },
  {
    id: 'image-brightness',
    slug: 'image-brightness',
    name: 'Image Brightness',
    shortName: 'Brightness',
    category: 'filters',
    description: 'Brighten dark photos or dim overexposed images with precision sliders.',
    metaTitle: 'Adjust Image Brightness Online - Brighten Photos',
    metaDescription: 'Fine-tune exposure and brightness of your photographs.',
    iconName: 'Sun',
    phase: 2,
    howToSteps: ['Adjust brightness slider from -100% to +100%.'],
    faqs: [{ question: 'Can I undo adjustments?', answer: 'Yes, reset to 0% at any time.' }]
  },
  {
    id: 'image-contrast',
    slug: 'image-contrast',
    name: 'Image Contrast',
    shortName: 'Contrast',
    category: 'filters',
    description: 'Boost visual punch or soften high-contrast shadows.',
    metaTitle: 'Adjust Image Contrast Online',
    metaDescription: 'Improve photo dynamic range and tonal separation easily.',
    iconName: 'Sliders',
    phase: 2,
    howToSteps: ['Upload images, tweak contrast slider, export.'],
    faqs: [{ question: 'What does contrast do?', answer: 'Widens difference between dark shadows and bright highlights.' }]
  },
  {
    id: 'image-saturation',
    slug: 'image-saturation',
    name: 'Image Saturation',
    shortName: 'Saturation',
    category: 'filters',
    description: 'Enhance vibrant colors or create muted pastel tones.',
    metaTitle: 'Adjust Image Saturation Online - Enhance Photo Vibrancy',
    metaDescription: 'Make colors pop or reduce saturation for artistic effects.',
    iconName: 'Palette',
    phase: 2,
    howToSteps: ['Upload images, slide saturation, and export.'],
    faqs: [{ question: 'Can I make it black & white?', answer: 'Setting saturation to 0% produces grayscale.' }]
  },

  // --- Combine/Split (3) ---
  {
    id: 'image-merger',
    slug: 'image-merger',
    name: 'Image Merger',
    shortName: 'Merge Images',
    category: 'combine-split',
    description: 'Combine multiple images horizontally or vertically into a single seamless graphic.',
    metaTitle: 'Merge Images Online - Join Photos Side by Side or Vertically',
    metaDescription: 'Stitch pictures together side by side (horizontal) or top to bottom (vertical).',
    iconName: 'Layers',
    phase: 5,
    howToSteps: ['Upload images, choose orientation (horizontal/vertical), and download.'],
    faqs: [{ question: 'What happens if heights or widths differ?', answer: 'Automatic proportional scaling aligns all edges neatly.' }]
  },
  {
    id: 'image-splitter',
    slug: 'image-splitter',
    name: 'Image Splitter',
    shortName: 'Split Image',
    category: 'combine-split',
    description: 'Split an image into equal grid tiles (e.g. 3x3 for Instagram grid or carousel posts).',
    metaTitle: 'Split Image into Grid Online - Instagram Grid Maker',
    metaDescription: 'Cut images into rows and columns for Instagram carousel grids.',
    iconName: 'Scissors',
    phase: 5,
    howToSteps: ['Select rows and columns count, preview slices, and download as ZIP.'],
    faqs: [{ question: 'Are files numbered sequentially?', answer: 'Yes, slice-1, slice-2, etc. for easy posting.' }]
  },
  {
    id: 'image-collage-maker',
    slug: 'image-collage-maker',
    name: 'Image Collage Maker',
    shortName: 'Collage',
    category: 'combine-split',
    description: 'Arrange multiple photos into creative collage layouts with borders and gaps.',
    metaTitle: 'Free Image Collage Maker Online',
    metaDescription: 'Create photo collages with various templates, custom borders, and spacings.',
    iconName: 'LayoutGrid',
    phase: 5,
    howToSteps: ['Pick a template layout, drop images into cells, export.'],
    faqs: [{ question: 'Can I swap photos in cells?', answer: 'Yes, drag or select cell images.' }]
  },

  // --- Info/Privacy (5) ---
  {
    id: 'image-color-picker',
    slug: 'image-color-picker',
    name: 'Image Color Picker',
    shortName: 'Color Picker',
    category: 'info-privacy',
    description: 'Pick colors from any pixel with a loupe magnifier; get HEX, RGB, and HSL codes.',
    metaTitle: 'Image Color Picker - Extract Hex & RGB Colors from Photos',
    metaDescription: 'Inspect and extract color palettes from any image with a precision magnifying loupe.',
    iconName: 'Pipette',
    phase: 3,
    howToSteps: ['Hover over the image and click any pixel to copy its Hex color.'],
    faqs: [{ question: 'Does it generate a palette?', answer: 'Yes, automatic dominant color extraction is included.' }]
  },
  {
    id: 'image-resolution-checker',
    slug: 'image-resolution-checker',
    name: 'Image Resolution Checker',
    shortName: 'Resolution',
    category: 'info-privacy',
    description: 'Inspect exact pixel dimensions, megapixel count, DPI, and print suitability.',
    metaTitle: 'Check Image Resolution & Megapixels Online',
    metaDescription: 'Inspect exact width, height, megapixels, and print size compatibility.',
    iconName: 'Tv',
    phase: 3,
    howToSteps: ['Upload your image to inspect full technical resolution specs.'],
    faqs: [{ question: 'How is megapixel calculated?', answer: '(Width x Height) / 1,000,000.' }]
  },
  {
    id: 'image-aspect-ratio-calculator',
    slug: 'image-aspect-ratio-calculator',
    name: 'Image Aspect Ratio Calculator',
    shortName: 'Aspect Ratio',
    category: 'info-privacy',
    description: 'Calculate simplified aspect ratios (16:9, 4:3, 1:1) and compute missing dimensions.',
    metaTitle: 'Image Aspect Ratio Calculator - Simplify & Calculate Dimensions',
    metaDescription: 'Find image aspect ratios using greatest common divisor math and compute custom widths/heights.',
    iconName: 'Scale',
    phase: 3,
    howToSteps: ['Upload image to inspect ratio or type custom numbers.'],
    faqs: [{ question: 'Can I calculate target dimensions?', answer: 'Yes, enter target width to compute proportional height.' }]
  },
  {
    id: 'image-metadata-viewer',
    slug: 'image-metadata-viewer',
    name: 'Image Metadata Viewer',
    shortName: 'EXIF Viewer',
    category: 'info-privacy',
    description: 'View EXIF metadata: camera model, ISO, shutter speed, lens, GPS coordinates, date taken.',
    metaTitle: 'View Image EXIF Metadata Online - Camera & GPS Data',
    metaDescription: 'Inspect detailed EXIF tags, camera settings, shutter speed, and GPS location in photos.',
    iconName: 'Info',
    phase: 3,
    howToSteps: ['Upload photo to view hidden camera tags and metadata.'],
    faqs: [{ question: 'Are my EXIF tags sent to any server?', answer: 'No, read 100% on-device.' }]
  },
  {
    id: 'image-metadata-remover',
    slug: 'image-metadata-remover',
    name: 'Image Metadata Remover',
    shortName: 'Strip EXIF',
    category: 'info-privacy',
    description: 'Strip all EXIF tags, GPS location data, and camera serials for privacy before sharing.',
    metaTitle: 'Strip EXIF & Remove Image Metadata Online - Protect Privacy',
    metaDescription: 'Scrub camera serials, location tracking, and personal metadata from photos.',
    iconName: 'ShieldAlert',
    phase: 3,
    howToSteps: ['Upload photos, scrub EXIF data, and download clean images.'],
    faqs: [{ question: 'Does stripping EXIF alter visual quality?', answer: 'No, the visual pixel buffer remains intact.' }]
  },

  // --- Branding (1) ---
  {
    id: 'image-watermark',
    slug: 'image-watermark',
    name: 'Image Watermark',
    shortName: 'Watermark',
    category: 'branding',
    description: 'Add custom text or logo image watermarks with adjustable opacity, size, and 9-point grid alignment.',
    metaTitle: 'Add Watermark to Images Online - Text & Logo Protection',
    metaDescription: 'Batch watermark your photos with custom text or logo stamps to protect copyright.',
    iconName: 'Stamp',
    phase: 4,
    howToSteps: ['Upload photos, type watermark text or upload logo, adjust opacity, export.'],
    faqs: [{ question: 'Can I tile the watermark across the entire photo?', answer: 'Yes, single position and repeat tiled patterns are supported.' }]
  }
];

export const TOOL_CATEGORIES = [
  { id: 'resize-optimize', name: 'Resize & Optimize', count: 5 },
  { id: 'convert', name: 'Convert', count: 7 },
  { id: 'transform', name: 'Transform', count: 4 },
  { id: 'filters', name: 'Filters', count: 6 },
  { id: 'combine-split', name: 'Combine & Split', count: 3 },
  { id: 'info-privacy', name: 'Info & Privacy', count: 5 },
  { id: 'branding', name: 'Branding', count: 1 }
] as const;

const SLUG_ALIASES: Record<string, string> = {
  'bg-remover': 'bg-remover',
  'background-remover': 'bg-remover',
  'remove-bg': 'bg-remover',
  'removebg': 'bg-remover',
  'bg-remove': 'bg-remover',
  bgremover: 'bg-remover',
  resize: 'image-resizer',
  'image-resize': 'image-resizer',
  compress: 'image-compressor',
  'image-compress': 'image-compressor',
  crop: 'image-cropper',
  'image-crop': 'image-cropper',
  rotate: 'image-rotator',
  'image-rotate': 'image-rotator',
  flip: 'image-flipper',
  'image-flip': 'image-flipper',
  grayscale: 'grayscale-converter',
  blur: 'blur-image',
  pixelate: 'pixelate-image',
  brightness: 'image-brightness',
  contrast: 'image-contrast',
  saturation: 'image-saturation',
  webp: 'webp-converter',
  png2jpg: 'png-to-jpg',
  jpg2png: 'jpg-to-png',
};

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  const cleanSlug = slug.replace(/^\//, '').replace(/\/editor$/, '').toLowerCase();
  const resolvedSlug = SLUG_ALIASES[cleanSlug] || cleanSlug;
  return TOOLS.find((t) => t.slug === resolvedSlug || t.id === resolvedSlug);
}

