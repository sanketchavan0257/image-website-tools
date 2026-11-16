import ExifReader from 'exifreader';
import { formatBytes } from '../config/plans';
import { gcd, analyzeAspectRatio } from './aspectRatioUtils';

export interface CameraSpecs {
  make?: string;
  model?: string;
  lensModel?: string;
  software?: string;
  bodySerialNumber?: string;
}

export interface ExposureSpecs {
  exposureTime?: string;
  fNumber?: string;
  iso?: string;
  focalLength?: string;
  focalLength35mm?: string;
  exposureProgram?: string;
  exposureBias?: string;
  meteringMode?: string;
  flash?: string;
  whiteBalance?: string;
  orientation?: string;
}

export interface GpsSpecs {
  hasGps: boolean;
  latitude?: number;
  longitude?: number;
  altitude?: string;
  formattedCoordinates?: string;
  googleMapsUrl?: string;
}

export interface FileSpecs {
  fileName: string;
  fileSize: number;
  formattedSize: string;
  fileType: string;
  width: number;
  height: number;
  megapixels: string;
  aspectRatio: string;
  colorSpace?: string;
  dpi?: string;
  bitDepth?: string;
  dateCreated?: string;
  dateModified?: string;
}

export interface RawMetadataTag {
  id: string;
  name: string;
  category: string;
  value: string;
}

export interface FullImageMetadata {
  file: FileSpecs;
  camera: CameraSpecs;
  exposure: ExposureSpecs;
  gps: GpsSpecs;
  rawTags: RawMetadataTag[];
  hasExifData: boolean;
}

function parseGpsCoordinate(coordTag: any, refTag: any): number | undefined {
  if (!coordTag) return undefined;
  
  if (typeof coordTag.description === 'number') {
    let val = coordTag.description;
    const ref = refTag?.value?.[0] || refTag?.description;
    if (ref === 'S' || ref === 'W') val = -val;
    return Number(val.toFixed(6));
  }

  if (Array.isArray(coordTag.value) && coordTag.value.length >= 3) {
    const d = Number(coordTag.value[0]);
    const m = Number(coordTag.value[1]);
    const s = Number(coordTag.value[2]);
    if (!isNaN(d) && !isNaN(m) && !isNaN(s)) {
      let decimal = d + m / 60 + s / 3600;
      const ref = refTag?.value?.[0] || refTag?.description;
      if (ref === 'S' || ref === 'W') {
        decimal = -decimal;
      }
      return Number(decimal.toFixed(6));
    }
  }

  const str = String(coordTag.description || coordTag.value || '');
  const parsed = parseFloat(str);
  if (!isNaN(parsed)) {
    let val = parsed;
    const ref = refTag?.value?.[0] || refTag?.description;
    if (ref === 'S' || ref === 'W') val = -val;
    return Number(val.toFixed(6));
  }

  return undefined;
}

export async function parseImageMetadata(
  file: File,
  dimensions?: { width: number; height: number }
): Promise<FullImageMetadata> {
  const width = dimensions?.width || 0;
  const height = dimensions?.height || 0;
  const analysis = width > 0 && height > 0 ? analyzeAspectRatio(width, height) : null;
  const megapixels = width > 0 && height > 0 ? ((width * height) / 1000000).toFixed(2) + ' MP' : 'Unknown';

  const fileSpecs: FileSpecs = {
    fileName: file.name,
    fileSize: file.size,
    formattedSize: formatBytes(file.size),
    fileType: file.type || 'image/jpeg',
    width,
    height,
    megapixels,
    aspectRatio: analysis
      ? analysis.bestStandard.isExact
        ? analysis.bestStandard.label
        : `~${analysis.bestStandard.label} (${analysis.decimal.toFixed(2)}:1)`
      : 'Unknown',
    dateModified: file.lastModified ? new Date(file.lastModified).toLocaleString() : undefined,
  };

  const cameraSpecs: CameraSpecs = {};
  const exposureSpecs: ExposureSpecs = {};
  const gpsSpecs: GpsSpecs = { hasGps: false };
  const rawTags: RawMetadataTag[] = [];
  let hasExifData = false;

  try {
    const buffer = await file.arrayBuffer();
    // Load metadata tags via ExifReader
    const tags = ExifReader.load(buffer, { expanded: true });

    const exif = (tags as any)?.exif || {};
    const gps = (tags as any)?.gps || {};
    const fileTags = (tags as any)?.file || {};
    const imageTags = (tags as any)?.image || {};
    const iptc = (tags as any)?.iptc || {};

    const allGrouped = { ...imageTags, ...exif, ...gps, ...fileTags, ...iptc };

    // Check if meaningful camera EXIF exists
    if (
      allGrouped['Make'] ||
      allGrouped['Model'] ||
      allGrouped['DateTimeOriginal'] ||
      allGrouped['ExposureTime'] ||
      allGrouped['FNumber'] ||
      allGrouped['ISOSpeedRatings']
    ) {
      hasExifData = true;
    }

    // Camera specs
    cameraSpecs.make = allGrouped['Make']?.description;
    cameraSpecs.model = allGrouped['Model']?.description;
    cameraSpecs.lensModel = allGrouped['LensModel']?.description || allGrouped['Lens']?.description;
    cameraSpecs.software = allGrouped['Software']?.description;
    cameraSpecs.bodySerialNumber = allGrouped['BodySerialNumber']?.description || allGrouped['SerialNumber']?.description;

    // Exposure specs
    exposureSpecs.exposureTime = allGrouped['ExposureTime']?.description;
    exposureSpecs.fNumber = allGrouped['FNumber']?.description;
    exposureSpecs.iso = allGrouped['ISOSpeedRatings']?.description || allGrouped['PhotographicSensitivity']?.description;
    exposureSpecs.focalLength = allGrouped['FocalLength']?.description;
    exposureSpecs.focalLength35mm = allGrouped['FocalLengthIn35mmFilm']?.description ? `${allGrouped['FocalLengthIn35mmFilm']?.description} mm` : undefined;
    exposureSpecs.exposureProgram = allGrouped['ExposureProgram']?.description;
    exposureSpecs.exposureBias = allGrouped['ExposureBiasValue']?.description;
    exposureSpecs.meteringMode = allGrouped['MeteringMode']?.description;
    exposureSpecs.flash = allGrouped['Flash']?.description;
    exposureSpecs.whiteBalance = allGrouped['WhiteBalance']?.description;
    exposureSpecs.orientation = allGrouped['Orientation']?.description;

    // Dates
    fileSpecs.dateCreated = allGrouped['DateTimeOriginal']?.description || allGrouped['DateTimeDigitized']?.description || allGrouped['DateTime']?.description;

    // Color space & resolution
    fileSpecs.colorSpace = allGrouped['ColorSpace']?.description;
    const xRes = allGrouped['XResolution']?.description;
    const yRes = allGrouped['YResolution']?.description;
    if (xRes) {
      fileSpecs.dpi = `${xRes} DPI`;
    }
    fileSpecs.bitDepth = allGrouped['BitsPerSample']?.description || '8-bit';

    // GPS coordinates
    const latTag = gps['Latitude'] || allGrouped['GPSLatitude'];
    const latRef = gps['LatitudeRef'] || allGrouped['GPSLatitudeRef'];
    const lonTag = gps['Longitude'] || allGrouped['GPSLongitude'];
    const lonRef = gps['LongitudeRef'] || allGrouped['GPSLongitudeRef'];
    const altTag = gps['Altitude'] || allGrouped['GPSAltitude'];

    const latVal = parseGpsCoordinate(latTag, latRef);
    const lonVal = parseGpsCoordinate(lonTag, lonRef);

    if (latVal !== undefined && lonVal !== undefined && !isNaN(latVal) && !isNaN(lonVal)) {
      gpsSpecs.hasGps = true;
      gpsSpecs.latitude = latVal;
      gpsSpecs.longitude = lonVal;
      gpsSpecs.altitude = altTag?.description ? `${altTag.description} m` : undefined;
      const latCard = latVal >= 0 ? `${latVal.toFixed(5)}° N` : `${Math.abs(latVal).toFixed(5)}° S`;
      const lonCard = lonVal >= 0 ? `${lonVal.toFixed(5)}° E` : `${Math.abs(lonVal).toFixed(5)}° W`;
      gpsSpecs.formattedCoordinates = `${latCard}, ${lonCard}`;
      gpsSpecs.googleMapsUrl = `https://www.google.com/maps?q=${latVal},${lonVal}`;
      hasExifData = true;
    }

    // Populate all raw tags for full technical inspection
    for (const [key, tagObj] of Object.entries(allGrouped as Record<string, any>)) {
      if (!tagObj || key === 'MakerNote' || key === 'UserComment' && String(tagObj.description).length > 200) continue;
      const val = tagObj.description || String(tagObj.value || '');
      if (val && val !== 'undefined') {
        let category = 'EXIF';
        if (key.startsWith('GPS')) category = 'GPS';
        else if (['Make', 'Model', 'LensModel', 'Software'].includes(key)) category = 'Camera';
        else if (['ExposureTime', 'FNumber', 'ISOSpeedRatings', 'FocalLength', 'Flash', 'MeteringMode', 'WhiteBalance'].includes(key)) category = 'Exposure';
        else if (['ImageWidth', 'ImageHeight', 'BitsPerSample', 'ColorSpace', 'XResolution', 'YResolution'].includes(key)) category = 'Image';

        rawTags.push({
          id: key,
          name: key.replace(/([A-Z])/g, ' $1').trim(),
          category,
          value: String(val),
        });
      }
    }
  } catch (err) {
    console.warn('Could not parse EXIF metadata:', err);
  }

  return {
    file: fileSpecs,
    camera: cameraSpecs,
    exposure: exposureSpecs,
    gps: gpsSpecs,
    rawTags: rawTags.sort((a, b) => a.name.localeCompare(b.name)),
    hasExifData,
  };
}
