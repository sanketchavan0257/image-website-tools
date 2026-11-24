export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  locale: string;
  decimals: 0 | 2 | 3;
  rateFromUSD: number;
  minAutoPayAmount: number;
}

/**
 * Currencies supported by Razorpay International Payments & Orders/Refunds.
 * Minor units obey Razorpay API rules:
 * - decimals: 2 -> amount * 100 (e.g. USD cents, INR paise, GBP pence, CAD cents, EUR cents)
 * - decimals: 0 -> amount * 1 (e.g. JPY yen, KRW won, VND dong)
 * - decimals: 3 -> Math.round(amount * 100) * 10 (trailing digit MUST be 0 per Razorpay BHD/KWD/OMR spec)
 */
export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', decimals: 2, rateFromUSD: 84, minAutoPayAmount: 5 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', decimals: 2, rateFromUSD: 1, minAutoPayAmount: 0.5 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', decimals: 2, rateFromUSD: 0.79, minAutoPayAmount: 0.5 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', decimals: 2, rateFromUSD: 1.38, minAutoPayAmount: 0.5 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', decimals: 2, rateFromUSD: 0.92, minAutoPayAmount: 0.5 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', decimals: 2, rateFromUSD: 1.52, minAutoPayAmount: 0.5 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', decimals: 2, rateFromUSD: 1.34, minAutoPayAmount: 0.5 },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', locale: 'en-AE', decimals: 2, rateFromUSD: 3.67, minAutoPayAmount: 2 },
  SAR: { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', locale: 'en-SA', decimals: 2, rateFromUSD: 3.75, minAutoPayAmount: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimals: 0, rateFromUSD: 152, minAutoPayAmount: 50 },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR', decimals: 0, rateFromUSD: 1380, minAutoPayAmount: 500 },
  CHF: { code: 'CHF', symbol: 'CHF ', name: 'Swiss Franc', locale: 'de-CH', decimals: 2, rateFromUSD: 0.88, minAutoPayAmount: 0.5 },
  SEK: { code: 'SEK', symbol: 'kr ', name: 'Swedish Krona', locale: 'sv-SE', decimals: 2, rateFromUSD: 10.6, minAutoPayAmount: 5 },
  NOK: { code: 'NOK', symbol: 'kr ', name: 'Norwegian Krone', locale: 'nb-NO', decimals: 2, rateFromUSD: 10.8, minAutoPayAmount: 5 },
  DKK: { code: 'DKK', symbol: 'kr ', name: 'Danish Krone', locale: 'da-DK', decimals: 2, rateFromUSD: 6.85, minAutoPayAmount: 3 },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ', decimals: 2, rateFromUSD: 1.66, minAutoPayAmount: 0.5 },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'en-HK', decimals: 2, rateFromUSD: 7.8, minAutoPayAmount: 4 },
  TWD: { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', locale: 'zh-TW', decimals: 2, rateFromUSD: 32.2, minAutoPayAmount: 15 },
  MYR: { code: 'MYR', symbol: 'RM ', name: 'Malaysian Ringgit', locale: 'ms-MY', decimals: 2, rateFromUSD: 4.45, minAutoPayAmount: 2 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH', decimals: 2, rateFromUSD: 34.5, minAutoPayAmount: 15 },
  IDR: { code: 'IDR', symbol: 'Rp ', name: 'Indonesian Rupiah', locale: 'id-ID', decimals: 0, rateFromUSD: 15800, minAutoPayAmount: 5000 },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH', decimals: 2, rateFromUSD: 58, minAutoPayAmount: 25 },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN', decimals: 0, rateFromUSD: 25400, minAutoPayAmount: 10000 },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', decimals: 2, rateFromUSD: 5.7, minAutoPayAmount: 2 },
  MXN: { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX', decimals: 2, rateFromUSD: 20, minAutoPayAmount: 10 },
  ZAR: { code: 'ZAR', symbol: 'R ', name: 'South African Rand', locale: 'en-ZA', decimals: 2, rateFromUSD: 18, minAutoPayAmount: 10 },
  PLN: { code: 'PLN', symbol: 'zł ', name: 'Polish Zloty', locale: 'pl-PL', decimals: 2, rateFromUSD: 4.0, minAutoPayAmount: 2 },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR', decimals: 2, rateFromUSD: 34.5, minAutoPayAmount: 15 },
  ILS: { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', locale: 'he-IL', decimals: 2, rateFromUSD: 3.7, minAutoPayAmount: 2 },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', locale: 'ar-EG', decimals: 2, rateFromUSD: 49, minAutoPayAmount: 20 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG', decimals: 2, rateFromUSD: 1650, minAutoPayAmount: 500 },
  KES: { code: 'KES', symbol: 'KSh ', name: 'Kenyan Shilling', locale: 'en-KE', decimals: 2, rateFromUSD: 129, minAutoPayAmount: 50 },
  PKR: { code: 'PKR', symbol: 'Rs ', name: 'Pakistani Rupee', locale: 'en-PK', decimals: 2, rateFromUSD: 278, minAutoPayAmount: 100 },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD', decimals: 2, rateFromUSD: 119, minAutoPayAmount: 50 },
  LKR: { code: 'LKR', symbol: 'Rs ', name: 'Sri Lankan Rupee', locale: 'en-LK', decimals: 2, rateFromUSD: 293, minAutoPayAmount: 100 },
  NPR: { code: 'NPR', symbol: 'रू ', name: 'Nepalese Rupee', locale: 'ne-NP', decimals: 2, rateFromUSD: 135, minAutoPayAmount: 50 },
  QAR: { code: 'QAR', symbol: 'QR ', name: 'Qatari Riyal', locale: 'en-QA', decimals: 2, rateFromUSD: 3.64, minAutoPayAmount: 2 },
  KWD: { code: 'KWD', symbol: 'KD ', name: 'Kuwaiti Dinar', locale: 'en-KW', decimals: 3, rateFromUSD: 0.31, minAutoPayAmount: 0.2 },
  BHD: { code: 'BHD', symbol: 'BD ', name: 'Bahraini Dinar', locale: 'en-BH', decimals: 3, rateFromUSD: 0.38, minAutoPayAmount: 0.2 },
  OMR: { code: 'OMR', symbol: 'OMR ', name: 'Omani Rial', locale: 'en-OM', decimals: 3, rateFromUSD: 0.38, minAutoPayAmount: 0.2 },
  CZK: { code: 'CZK', symbol: 'Kč ', name: 'Czech Koruna', locale: 'cs-CZ', decimals: 2, rateFromUSD: 23.5, minAutoPayAmount: 10 },
  HUF: { code: 'HUF', symbol: 'Ft ', name: 'Hungarian Forint', locale: 'hu-HU', decimals: 2, rateFromUSD: 375, minAutoPayAmount: 150 },
  RON: { code: 'RON', symbol: 'lei ', name: 'Romanian Leu', locale: 'ro-RO', decimals: 2, rateFromUSD: 4.6, minAutoPayAmount: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', decimals: 2, rateFromUSD: 7.15, minAutoPayAmount: 3 },
};

/**
 * ISO 3166-1 alpha-2 country code -> Currency code.
 * Covers all sovereign nations & major territories; unlisted regions cleanly default to USD.
 */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // South Asia
  IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', BT: 'INR',
  // North America
  US: 'USD', CA: 'CAD', MX: 'MXN', PR: 'USD', VI: 'USD', GU: 'USD',
  // UK & Europe (Eurozone -> EUR)
  GB: 'GBP', UK: 'GBP', GG: 'GBP', JE: 'GBP', IM: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR',
  SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR',
  CY: 'EUR', HR: 'EUR', MC: 'EUR', SM: 'EUR', VA: 'EUR', AD: 'EUR',
  CH: 'CHF', LI: 'CHF',
  SE: 'SEK', NO: 'NOK', DK: 'DKK',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  TR: 'TRY',
  // Oceania
  AU: 'AUD', NZ: 'NZD',
  // Middle East
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', IL: 'ILS', EG: 'EGP',
  // East & Southeast Asia
  JP: 'JPY', KR: 'KRW', SG: 'SGD', HK: 'HKD', TW: 'TWD', MY: 'MYR',
  TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND', CN: 'CNY',
  // South America & Africa
  BR: 'BRL', ZA: 'ZAR', NG: 'NGN', KE: 'KES',
};

export const COUNTRY_LABELS: Record<string, { name: string; flag: string }> = {
  IN: { name: 'India', flag: '🇮🇳' },
  US: { name: 'United States', flag: '🇺🇸' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  FR: { name: 'France', flag: '🇫🇷' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  IE: { name: 'Ireland', flag: '🇮🇪' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
  AE: { name: 'United Arab Emirates', flag: '🇦🇪' },
  SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  KR: { name: 'South Korea', flag: '🇰🇷' },
  NZ: { name: 'New Zealand', flag: '🇳🇿' },
  CH: { name: 'Switzerland', flag: '🇨🇭' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  DK: { name: 'Denmark', flag: '🇩🇰' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  MX: { name: 'Mexico', flag: '🇲🇽' },
  ZA: { name: 'South Africa', flag: '🇿🇦' },
  MY: { name: 'Malaysia', flag: '🇲🇾' },
  TH: { name: 'Thailand', flag: '🇹🇭' },
  ID: { name: 'Indonesia', flag: '🇮🇩' },
  PH: { name: 'Philippines', flag: '🇵🇭' },
  VN: { name: 'Vietnam', flag: '🇻🇳' },
  HK: { name: 'Hong Kong', flag: '🇭🇰' },
  TW: { name: 'Taiwan', flag: '🇹🇼' },
  PL: { name: 'Poland', flag: '🇵🇱' },
  TR: { name: 'Turkey', flag: '🇹🇷' },
  IL: { name: 'Israel', flag: '🇮🇱' },
  QA: { name: 'Qatar', flag: '🇶🇦' },
  KW: { name: 'Kuwait', flag: '🇰🇼' },
  BH: { name: 'Bahrain', flag: '🇧🇭' },
  OM: { name: 'Oman', flag: '🇴🇲' },
  NG: { name: 'Nigeria', flag: '🇳🇬' },
  KE: { name: 'Kenya', flag: '🇰🇪' },
  EG: { name: 'Egypt', flag: '🇪🇬' },
  PK: { name: 'Pakistan', flag: '🇵🇰' },
  BD: { name: 'Bangladesh', flag: '🇧🇩' },
  LK: { name: 'Sri Lanka', flag: '🇱🇰' },
  NP: { name: 'Nepal', flag: '🇳🇵' },
};

const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  india: 'IN',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  'u.s.a.': 'US',
  us: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  canada: 'CA',
  australia: 'AU',
  germany: 'DE',
  deutschland: 'DE',
  france: 'FR',
  italy: 'IT',
  spain: 'ES',
  netherlands: 'NL',
  belgium: 'BE',
  austria: 'AT',
  portugal: 'PT',
  ireland: 'IE',
  finland: 'FI',
  greece: 'GR',
  switzerland: 'CH',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  poland: 'PL',
  czechia: 'CZ',
  'czech republic': 'CZ',
  hungary: 'HU',
  romania: 'RO',
  turkey: 'TR',
  turkiye: 'TR',
  singapore: 'SG',
  'united arab emirates': 'AE',
  uae: 'AE',
  'saudi arabia': 'SA',
  qatar: 'QA',
  kuwait: 'KW',
  bahrain: 'BH',
  oman: 'OM',
  israel: 'IL',
  egypt: 'EG',
  japan: 'JP',
  'south korea': 'KR',
  'republic of korea': 'KR',
  korea: 'KR',
  china: 'CN',
  'hong kong': 'HK',
  taiwan: 'TW',
  malaysia: 'MY',
  thailand: 'TH',
  indonesia: 'ID',
  philippines: 'PH',
  vietnam: 'VN',
  'viet nam': 'VN',
  'new zealand': 'NZ',
  brazil: 'BR',
  mexico: 'MX',
  'south africa': 'ZA',
  nigeria: 'NG',
  kenya: 'KE',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  nepal: 'NP',
};

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'America/Detroit': 'US',
  'America/Indiana/Indianapolis': 'US',
  'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Montreal': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/St_Johns': 'CA',
  'America/Regina': 'CA',
  'Europe/London': 'GB',
  'Europe/Belfast': 'GB',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Adelaide': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Darwin': 'AU',
  'Pacific/Auckland': 'NZ',
  'Europe/Berlin': 'DE',
  'Europe/Munich': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Dublin': 'IE',
  'Europe/Lisbon': 'PT',
  'Europe/Athens': 'GR',
  'Europe/Helsinki': 'FI',
  'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO',
  'Europe/Istanbul': 'TR',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Bahrain': 'BH',
  'Asia/Muscat': 'OM',
  'Asia/Jerusalem': 'IL',
  'Asia/Tel_Aviv': 'IL',
  'Africa/Cairo': 'EG',
  'Asia/Singapore': 'SG',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Shanghai': 'CN',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Colombo': 'LK',
  'Asia/Kathmandu': 'NP',
  'Asia/Katmandu': 'NP',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'America/Monterrey': 'MX',
  'America/Cancun': 'MX',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
};

export function normalizeCurrencyCode(code?: string | null): string {
  const clean = String(code || '').trim().toUpperCase();
  if (clean && SUPPORTED_CURRENCIES[clean]) {
    return clean;
  }
  return 'USD';
}

export function getCurrencyConfig(code?: string | null): CurrencyInfo {
  const clean = String(code || '').trim().toUpperCase();
  return SUPPORTED_CURRENCIES[clean] || SUPPORTED_CURRENCIES.USD;
}

export function resolveCountryCodeFromInput(input?: string | null): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (/^[A-Za-z]{2}$/.test(raw)) {
    return raw.toUpperCase();
  }
  const byName = COUNTRY_NAME_TO_ISO[raw.toLowerCase()];
  if (byName) return byName;
  return '';
}

export function getCurrencyForCountry(countryCodeOrName?: string | null): string {
  const iso = resolveCountryCodeFromInput(countryCodeOrName);
  if (!iso) return 'USD';
  return COUNTRY_TO_CURRENCY[iso] || 'USD';
}

export function resolveCountryFromTimeZone(tz?: string | null): string {
  const clean = String(tz || '').trim();
  if (!clean) return '';
  if (TIMEZONE_TO_COUNTRY[clean]) return TIMEZONE_TO_COUNTRY[clean];
  if (clean.startsWith('Australia/')) return 'AU';
  if (clean.startsWith('Asia/Kolkata') || clean.startsWith('Asia/Calcutta')) return 'IN';
  if (clean.startsWith('America/')) {
    if (
      clean.includes('Toronto') ||
      clean.includes('Vancouver') ||
      clean.includes('Winnipeg') ||
      clean.includes('Edmonton') ||
      clean.includes('Halifax') ||
      clean.includes('Montreal') ||
      clean.includes('Regina') ||
      clean.includes('Whitehorse')
    ) {
      return 'CA';
    }
    if (clean.includes('Mexico') || clean.includes('Tijuana') || clean.includes('Monterrey')) {
      return 'MX';
    }
    if (clean.includes('Sao_Paulo') || clean.includes('Manaus') || clean.includes('Recife')) {
      return 'BR';
    }
  }
  return '';
}

/**
 * Converts a display currency amount into Razorpay integer minor units.
 */
export function toRazorpayMinorUnits(amount: number, currencyCode?: string | null): number {
  const cfg = getCurrencyConfig(currencyCode);
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (cfg.decimals === 0) {
    return Math.round(safeAmount);
  }
  if (cfg.decimals === 3) {
    // Razorpay 3-decimal rule: trailing digit must be 0
    return Math.round(safeAmount * 100) * 10;
  }
  return Math.round(safeAmount * 100);
}

/**
 * Converts Razorpay integer minor units back to standard display units.
 */
export function fromRazorpayMinorUnits(minorUnits: number, currencyCode?: string | null): number {
  const cfg = getCurrencyConfig(currencyCode);
  const safeMinor = Math.max(0, Number(minorUnits) || 0);
  if (cfg.decimals === 0) return Math.round(safeMinor);
  if (cfg.decimals === 3) return Number((safeMinor / 1000).toFixed(2));
  return Number((safeMinor / 100).toFixed(2));
}

/**
 * Rounds currency calculations cleanly for both decimal currencies (USD/GBP/CAD) and zero-decimal currencies (JPY).
 */
export function roundCurrencyAmount(amount: number, currencyCode?: string | null): number {
  const cfg = getCurrencyConfig(currencyCode);
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (cfg.decimals === 0) {
    return Math.round(safeAmount);
  }
  return Math.round((safeAmount + Number.EPSILON) * 100) / 100;
}

/**
 * Formats a monetary value consistently across membership cards, checkout, billing, and receipts.
 */
export function formatCurrency(
  amount: number,
  currencyCode?: string | null,
  options?: { forceDecimals?: boolean; includeCode?: boolean }
): string {
  const cfg = getCurrencyConfig(currencyCode || 'INR');
  const rounded = roundCurrencyAmount(amount, cfg.code);
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.001;
  const maxFrac = cfg.decimals === 0 ? 0 : 2;
  const minFrac = cfg.decimals === 0 ? 0 : options?.forceDecimals ? 2 : isWhole ? 0 : 2;

  const formatLocale = cfg.code === 'INR' ? 'en-IN' : 'en-US';

  try {
    const formatted = new Intl.NumberFormat(formatLocale, {
      style: 'currency',
      currency: cfg.code,
      minimumFractionDigits: minFrac,
      maximumFractionDigits: maxFrac,
    }).format(rounded);
    return options?.includeCode ? `${formatted} ${cfg.code}` : formatted;
  } catch {
    const numStr = rounded.toFixed(minFrac);
    return options?.includeCode ? `${cfg.symbol}${numStr} ${cfg.code}` : `${cfg.symbol}${numStr}`;
  }
}

/**
 * Converts a USD plan price (e.g. $4.99, $9.99, $19.99) to a localized currency cleanly.
 */
export function convertUSDToCurrency(usdAmount: number, currencyCode: string): number {
  const cfg = getCurrencyConfig(currencyCode);
  if (cfg.code === 'USD') return roundCurrencyAmount(usdAmount, 'USD');
  const raw = usdAmount * cfg.rateFromUSD;
  if (cfg.decimals === 0) {
    // Round zero-decimal prices to clean nearest 10 (JPY/KRW/IDR/VND)
    if (raw >= 5000) return Math.round(raw / 1000) * 1000;
    if (raw >= 500) return Math.round(raw / 50) * 50;
    return Math.round(raw / 10) * 10;
  }
  // Format popular 2-decimal SaaS pricing to clean .99 or round units cleanly when larger
  if (raw < 100) {
    return Math.max(0.99, Math.round(raw * 2) / 2 - 0.01);
  }
  return Math.round(raw);
}

export interface DetectedLocaleCurrency {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  symbol: string;
  source: 'manual' | 'server_ip' | 'timezone' | 'locale' | 'default';
}

export const SESSION_KEY_MANUAL_CURRENCY = 'pixiforge_manual_currency';
export const SESSION_KEY_DETECTED_GEO = 'pixiforge_detected_geo_currency';

export function detectInstantCurrencyAndCountry(): DetectedLocaleCurrency {
  if (typeof window !== 'undefined') {
    // 1. User manual choice (if explicitly picked from selector)
    try {
      const manual = sessionStorage.getItem(SESSION_KEY_MANUAL_CURRENCY);
      if (manual) {
        const parsed = JSON.parse(manual) as DetectedLocaleCurrency;
        if (parsed?.currencyCode && SUPPORTED_CURRENCIES[parsed.currencyCode]) {
          return parsed;
        }
      }
      const cachedGeo = sessionStorage.getItem(SESSION_KEY_DETECTED_GEO);
      if (cachedGeo) {
        const parsed = JSON.parse(cachedGeo) as DetectedLocaleCurrency;
        if (parsed?.currencyCode && SUPPORTED_CURRENCIES[parsed.currencyCode]) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage failures
    }

    // 2. Instant browser timezone lookup (reliable even if browser language is en-US)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzCountry = resolveCountryFromTimeZone(tz);
      if (tzCountry) {
        const curCode = getCurrencyForCountry(tzCountry);
        const cfg = getCurrencyConfig(curCode);
        const label = COUNTRY_LABELS[tzCountry];
        return {
          countryCode: tzCountry,
          countryName: label?.name || tzCountry,
          currencyCode: cfg.code,
          symbol: cfg.symbol,
          source: 'timezone',
        };
      }
    } catch {
      // ignore
    }

    // 3. Browser navigator.languages region subtag (e.g. en-GB, en-CA, fr-FR)
    try {
      const langs = [...(navigator.languages || []), navigator.language].filter(Boolean);
      for (const lang of langs) {
        const parts = String(lang).split(/[-_]/);
        if (parts.length >= 2) {
          const region = parts[parts.length - 1].toUpperCase();
          if (/^[A-Z]{2}$/.test(region) && COUNTRY_TO_CURRENCY[region]) {
            const curCode = getCurrencyForCountry(region);
            const cfg = getCurrencyConfig(curCode);
            const label = COUNTRY_LABELS[region];
            return {
              countryCode: region,
              countryName: label?.name || region,
              currencyCode: cfg.code,
              symbol: cfg.symbol,
              source: 'locale',
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback to USD for global visitors if browser exposes nothing
  return {
    countryCode: 'US',
    countryName: 'United States',
    currencyCode: 'USD',
    symbol: '$',
    source: 'default',
  };
}

let inFlightGeoPromise: Promise<DetectedLocaleCurrency | null> | null = null;

export async function fetchServerAutoCurrency(): Promise<DetectedLocaleCurrency | null> {
  if (typeof window === 'undefined') return null;
  try {
    if (sessionStorage.getItem(SESSION_KEY_MANUAL_CURRENCY)) {
      return null; // Respect user's explicit override
    }
    const cached = sessionStorage.getItem(SESSION_KEY_DETECTED_GEO);
    if (cached) {
      return JSON.parse(cached) as DetectedLocaleCurrency;
    }
  } catch {
    // ignore
  }

  if (!inFlightGeoPromise) {
    inFlightGeoPromise = (async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const res = await fetch(`/api/geo/currency?tz=${encodeURIComponent(tz)}`);
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        if (data?.success && data?.currency && SUPPORTED_CURRENCIES[data.currency]) {
          const cfg = getCurrencyConfig(data.currency);
          const result: DetectedLocaleCurrency = {
            countryCode: data.countryCode || 'US',
            countryName: data.countryName || data.countryCode || 'International',
            currencyCode: cfg.code,
            symbol: cfg.symbol,
            source: data.source || 'server_ip',
          };
          try {
            sessionStorage.setItem(SESSION_KEY_DETECTED_GEO, JSON.stringify(result));
          } catch {
            // ignore
          }
          return result;
        }
      } catch {
        // Fallback smoothly to synchronous timezone detection
      }
      return null;
    })();
  }

  return inFlightGeoPromise;
}

export const POPULAR_CURRENCY_OPTIONS: Array<{
  countryCode: string;
  currencyCode: string;
  label: string;
}> = [
  { countryCode: 'IN', currencyCode: 'INR', label: '🇮🇳 India (INR ₹)' },
  { countryCode: 'US', currencyCode: 'USD', label: '🇺🇸 United States (USD $)' },
  { countryCode: 'GB', currencyCode: 'GBP', label: '🇬🇧 United Kingdom (GBP £)' },
  { countryCode: 'CA', currencyCode: 'CAD', label: '🇨🇦 Canada (CAD CA$)' },
  { countryCode: 'DE', currencyCode: 'EUR', label: '🇪🇺 Europe (EUR €)' },
  { countryCode: 'AU', currencyCode: 'AUD', label: '🇦🇺 Australia (AUD A$)' },
  { countryCode: 'AE', currencyCode: 'AED', label: '🇦🇪 UAE (AED)' },
  { countryCode: 'SG', currencyCode: 'SGD', label: '🇸🇬 Singapore (SGD S$)' },
  { countryCode: 'JP', currencyCode: 'JPY', label: '🇯🇵 Japan (JPY ¥)' },
  { countryCode: 'SA', currencyCode: 'SAR', label: '🇸🇦 Saudi Arabia (SAR)' },
  { countryCode: 'CH', currencyCode: 'CHF', label: '🇨🇭 Switzerland (CHF)' },
  { countryCode: 'NZ', currencyCode: 'NZD', label: '🇳🇿 New Zealand (NZD NZ$)' },
  { countryCode: 'MY', currencyCode: 'MYR', label: '🇲🇾 Malaysia (MYR RM)' },
  { countryCode: 'KR', currencyCode: 'KRW', label: '🇰🇷 South Korea (KRW ₩)' },
  { countryCode: 'BR', currencyCode: 'BRL', label: '🇧🇷 Brazil (BRL R$)' },
  { countryCode: 'MX', currencyCode: 'MXN', label: '🇲🇽 Mexico (MXN MX$)' },
  { countryCode: 'ZA', currencyCode: 'ZAR', label: '🇿🇦 South Africa (ZAR R)' },
  { countryCode: 'NG', currencyCode: 'NGN', label: '🇳🇬 Nigeria (NGN ₦)' },
  { countryCode: 'PK', currencyCode: 'PKR', label: '🇵🇰 Pakistan (PKR Rs)' },
  { countryCode: 'BD', currencyCode: 'BDT', label: '🇧🇩 Bangladesh (BDT ৳)' },
];
