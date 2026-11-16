import { PlanConfig, PlanType } from '../types';

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    maxFilesPerBatch: 5,
    maxFileSizeMB: 10,
    hasAds: true,
    bulkTargetFileSize: false,
    customWatermark: false,
    unlimitedPdfPages: false,
    canDownloadZip: true,
    canDownloadSeparately: true,
  },
  pro: {
    name: 'Pro',
    maxFilesPerBatch: 100,
    maxFileSizeMB: 100,
    hasAds: false,
    bulkTargetFileSize: true,
    customWatermark: true,
    unlimitedPdfPages: true,
    canDownloadZip: true,
    canDownloadSeparately: true,
  },
  max: {
    name: 'Max',
    maxFilesPerBatch: 300,
    maxFileSizeMB: 250,
    hasAds: false,
    bulkTargetFileSize: true,
    customWatermark: true,
    unlimitedPdfPages: true,
    canDownloadZip: true,
    canDownloadSeparately: true,
  },
  ultra: {
    name: 'Ultra',
    maxFilesPerBatch: 1000,
    maxFileSizeMB: 1000,
    hasAds: false,
    bulkTargetFileSize: true,
    customWatermark: true,
    unlimitedPdfPages: true,
    canDownloadZip: true,
    canDownloadSeparately: true,
  },
};

export const MAX_FILE_SIZE_BYTES_FREE = PLANS.free.maxFileSizeMB * 1024 * 1024;
export const MAX_FILE_SIZE_BYTES_PRO = PLANS.pro.maxFileSizeMB * 1024 * 1024;

export function getPlanLimits(planOrIsPro: PlanType | boolean): PlanConfig {
  if (typeof planOrIsPro === 'boolean') {
    return planOrIsPro ? PLANS.pro : PLANS.free;
  }
  return PLANS[planOrIsPro] || PLANS.free;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
