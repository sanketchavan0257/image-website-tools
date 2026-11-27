import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import zlib from 'zlib';
import crypto from 'crypto';
import net from 'net';
import tls from 'tls';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
  COUNTRY_LABELS,
  getCurrencyConfig,
  getCurrencyForCountry,
  resolveCountryCodeFromInput,
  resolveCountryFromTimeZone,
  toRazorpayMinorUnits,
} from './src/config/currencies.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getPublicRuntimeEnv() {
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const supportEmail = (
    process.env.SUPPORT_EMAIL ||
    process.env.VITE_SUPPORT_EMAIL ||
    adminEmail ||
    ''
  )
    .trim()
    .toLowerCase();
  const supportPhone = (
    process.env.SUPPORT_PHONE ||
    process.env.VITE_SUPPORT_PHONE ||
    '+91 98765 43210'
  ).trim();
  const razorpayKeyId = (
    process.env.RAZORPAY_KEY_ID ||
    process.env.VITE_RAZORPAY_KEY_ID ||
    ''
  ).trim();
  return {
    ADMIN_EMAIL: adminEmail,
    SUPPORT_EMAIL: supportEmail,
    SUPPORT_PHONE: supportPhone,
    RAZORPAY_KEY_ID: razorpayKeyId,
  };
}

function escapeServerHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ServerSiteView {
  viewId: string;
  country: string;
  state: string;
  dist: string;
  taluka: string;
  pagePath: string;
  visitedAt: string;
  locationSource?: 'gps' | 'ip' | 'pincode';
  accuracyMeters?: number;
  locationCleared?: boolean;
}

const ANALYTICS_STORE_PATH = path.join(os.tmpdir(), 'pixiforge-analytics-views.json');
const geoAdminCache = new Map<
  string,
  { country: string; state: string; dist: string; taluka: string }
>();

function loadStoredViews(): ServerSiteView[] {
  try {
    if (fs.existsSync(ANALYTICS_STORE_PATH)) {
      const raw = fs.readFileSync(ANALYTICS_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (v) =>
            v &&
            typeof v.viewId === 'string' &&
            !(v.state === 'Unknown' && v.dist === 'Unknown' && v.taluka === 'Unknown')
        );
      }
    }
  } catch (err) {
    console.warn('[Analytics] Failed loading views store:', err);
  }
  return [];
}

function saveStoredViews(views: ServerSiteView[]) {
  try {
    fs.writeFileSync(ANALYTICS_STORE_PATH, JSON.stringify(views.slice(0, 5000)), 'utf8');
  } catch (err) {
    console.warn('[Analytics] Failed saving views store:', err);
  }
}

function cleanAdminUnit(val: unknown, fallback = 'Unknown'): string {
  const s = String(val || '')
    .replace(/\s+(District|Dist\.?|Taluka|Taluk|Tehsil|Tahsil|Sub-district|Subdistrict|Division)$/i, '')
    .trim();
  if (!s || s.toLowerCase() === 'unknown') return fallback;
  return s.slice(0, 80);
}

function extractClientIp(req: express.Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  const realIp = req.headers['x-real-ip'];
  const fwd = req.headers['x-forwarded-for'];
  const candidate =
    (Array.isArray(cfIp) ? cfIp[0] : cfIp) ||
    (Array.isArray(realIp) ? realIp[0] : realIp) ||
    (Array.isArray(fwd)
      ? fwd[0]
      : typeof fwd === 'string'
      ? fwd.split(',')[0]
      : req.socket.remoteAddress || '');
  return String(candidate || '')
    .replace(/^::ffff:/, '')
    .trim();
}

function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd')
  ) {
    return false;
  }
  return true;
}

async function lookupIpLocation(ip: string): Promise<{
  country: string;
  state: string;
  city: string;
  lat?: number;
  lon?: number;
}> {
  if (!isPublicIp(ip)) {
    return { country: '', state: '', city: '' };
  }

  // Provider 1: ipwho.is
  try {
    const ipRes = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (ipRes.ok) {
      const ipData = (await ipRes.json()) as any;
      if (ipData?.success !== false && ipData?.country) {
        return {
          country: cleanAdminUnit(ipData.country, ''),
          state: cleanAdminUnit(ipData.region, ''),
          city: cleanAdminUnit(ipData.city, ''),
          lat: typeof ipData.latitude === 'number' ? ipData.latitude : undefined,
          lon: typeof ipData.longitude === 'number' ? ipData.longitude : undefined,
        };
      }
    }
  } catch {
    // Try secondary provider
  }

  // Provider 2: geojs.io
  try {
    const geoRes = await fetch(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`, {
      signal: AbortSignal.timeout(3000),
    });
    if (geoRes.ok) {
      const geoData = (await geoRes.json()) as any;
      if (geoData?.country) {
        const latNum = Number(geoData.latitude);
        const lonNum = Number(geoData.longitude);
        return {
          country: cleanAdminUnit(geoData.country, ''),
          state: cleanAdminUnit(geoData.region, ''),
          city: cleanAdminUnit(geoData.city, ''),
          lat: Number.isFinite(latNum) ? latNum : undefined,
          lon: Number.isFinite(lonNum) ? lonNum : undefined,
        };
      }
    }
  } catch {
    // Try next provider
  }

  // Provider 3: ipinfo.io
  try {
    const infoRes = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, {
      signal: AbortSignal.timeout(3000),
    });
    if (infoRes.ok) {
      const infoData = (await infoRes.json()) as any;
      if (infoData?.country || infoData?.city) {
        const [latStr, lonStr] = String(infoData.loc || '').split(',');
        const latNum = Number(latStr);
        const lonNum = Number(lonStr);
        return {
          country: cleanAdminUnit(infoData.country === 'IN' ? 'India' : infoData.country, ''),
          state: cleanAdminUnit(infoData.region, ''),
          city: cleanAdminUnit(infoData.city, ''),
          lat: Number.isFinite(latNum) ? latNum : undefined,
          lon: Number.isFinite(lonNum) ? lonNum : undefined,
        };
      }
    }
  } catch {
    // Try next provider
  }

  // Provider 4: freeipapi.com
  try {
    const freeRes = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (freeRes.ok) {
      const freeData = (await freeRes.json()) as any;
      if (freeData?.countryName) {
        return {
          country: cleanAdminUnit(freeData.countryName, ''),
          state: cleanAdminUnit(freeData.regionName, ''),
          city: cleanAdminUnit(freeData.cityName, ''),
          lat: typeof freeData.latitude === 'number' ? freeData.latitude : undefined,
          lon: typeof freeData.longitude === 'number' ? freeData.longitude : undefined,
        };
      }
    }
  } catch {
    // Ignore transient IP lookup errors
  }

  return { country: '', state: '', city: '' };
}

async function resolvePostalCodeLocation(rawCode: string): Promise<{
  country: string;
  state: string;
  dist: string;
  taluka: string;
  locationSource: 'pincode';
} | null> {
  const code = String(rawCode || '').trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 16);
  if (!code) return null;

  // 1. India 6-digit Pincode via India Post API (provides exact Country, State, District, Block/Taluka)
  if (/^[1-9]\d{5}$/.test(code)) {
    try {
      const r = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(code)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const arr = (await r.json()) as any[];
        const entry = Array.isArray(arr) ? arr[0] : null;
        if (entry?.Status === 'Success' && Array.isArray(entry.PostOffice) && entry.PostOffice.length > 0) {
          const po =
            entry.PostOffice.find((p: any) => p?.Block && p.Block !== 'NA' && p?.District) ||
            entry.PostOffice[0];
          const country = cleanAdminUnit(po.Country, 'India');
          const state = cleanAdminUnit(po.State, 'Unknown');
          const dist = cleanAdminUnit(po.District || po.Division, state);
          const taluka = cleanAdminUnit(
            po.Block && po.Block !== 'NA' ? po.Block : po.Taluk || po.Name || dist,
            dist
          );
          if (state !== 'Unknown' && dist !== 'Unknown') {
            return { country, state, dist, taluka, locationSource: 'pincode' };
          }
        }
      }
    } catch {
      // Fallback to Nominatim postalcode search
    }
  }

  // 2. General Nominatim postal code search fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
      code
    )}&countrycodes=in&format=jsonv2&addressdetails=1&limit=1`;
    const r = await fetch(nomUrl, {
      headers: {
        'User-Agent': 'PixiForgeAnalytics/1.0 (https://pixiforge.app)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const list = (await r.json()) as any[];
      const addr = list?.[0]?.address;
      if (addr) {
        const country = cleanAdminUnit(addr.country, 'India');
        const state = cleanAdminUnit(addr.state || addr.region, 'Unknown');
        const dist = cleanAdminUnit(addr.state_district || addr.district || addr.city, state);
        const taluka = cleanAdminUnit(addr.county || addr.subdistrict || addr.town || dist, dist);
        if (state !== 'Unknown') {
          return { country, state, dist, taluka, locationSource: 'pincode' };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

async function resolveAdministrativeLocation(params: {
  ip: string;
  country?: string;
  state?: string;
  dist?: string;
  taluka?: string;
  city?: string;
  lat?: number;
  lon?: number;
  locationSource?: 'gps' | 'ip';
  timeZone?: string;
}): Promise<{ country: string; state: string; dist: string; taluka: string; locationSource: 'gps' | 'ip' }> {
  let lat = typeof params.lat === 'number' && Number.isFinite(params.lat) ? params.lat : undefined;
  let lon = typeof params.lon === 'number' && Number.isFinite(params.lon) ? params.lon : undefined;
  const hasDeviceCoords = params.locationSource === 'gps' && lat !== undefined && lon !== undefined;
  const effectiveSource: 'gps' | 'ip' = hasDeviceCoords ? 'gps' : 'ip';

  const backupCountry = cleanAdminUnit(params.country, '');
  const backupState = cleanAdminUnit(params.state, '');
  const backupDist = cleanAdminUnit(params.dist, '');
  const backupTaluka = cleanAdminUnit(params.taluka, '');
  const backupCity = cleanAdminUnit(params.city, '');

  let country = hasDeviceCoords ? '' : backupCountry;
  let state = hasDeviceCoords ? '' : backupState;
  let dist = hasDeviceCoords ? '' : backupDist;
  let taluka = hasDeviceCoords ? '' : backupTaluka;
  let city = hasDeviceCoords ? '' : backupCity;

  // 1. Server-side IP geolocation fallback when no client coords/country were supplied
  if (!hasDeviceCoords && (!country || lat === undefined || lon === undefined)) {
    const ipLoc = await lookupIpLocation(params.ip);
    country = country || ipLoc.country;
    state = state || ipLoc.state;
    city = city || ipLoc.city;
    if (lat === undefined && ipLoc.lat !== undefined) lat = ipLoc.lat;
    if (lon === undefined && ipLoc.lon !== undefined) lon = ipLoc.lon;
  }

  // 2. Reverse-geocode coordinates at zoom=14 so Indian state_district (District) and county/subdistrict (Taluka) resolve accurately.
  // NOTE: Coordinates and street-level details are NEVER stored; only Country, State, District, and Taluka are kept.
  if (lat !== undefined && lon !== undefined && (hasDeviceCoords || dist === '' || taluka === '')) {
    const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = geoAdminCache.get(cacheKey);
    if (cached && cached.country !== 'Unknown' && cached.state !== 'Unknown') {
      return {
        country: cached.country,
        state: cached.state,
        dist: cached.dist,
        taluka: cached.taluka,
        locationSource: effectiveSource,
      };
    }

    let resolvedCountry = '';
    let resolvedState = '';
    let resolvedDist = '';
    let resolvedTaluka = '';

    // 2a. Primary reverse geocode: Nominatim zoom=14
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat.toFixed(3)
      )}&lon=${encodeURIComponent(lon.toFixed(3))}&zoom=14&addressdetails=1`;
      const nomRes = await fetch(nomUrl, {
        headers: {
          'User-Agent': 'PixiForgeAnalytics/1.0 (https://pixiforge.app)',
          'Accept-Language': 'en',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as any;
        const addr = nomData?.address || {};
        resolvedCountry = cleanAdminUnit(addr.country, '');
        resolvedState = cleanAdminUnit(addr.state || addr.region, '');
        resolvedDist = cleanAdminUnit(
          addr.state_district || addr.district || addr.city || addr.county,
          ''
        );
        resolvedTaluka = cleanAdminUnit(
          addr.county ||
            addr.subdistrict ||
            addr.municipality ||
            addr.city_district ||
            addr.town ||
            addr.village ||
            addr.suburb ||
            addr.city,
          ''
        );
      }
    } catch {
      // Try Photon fallback
    }

    // 2b. Secondary reverse geocode: Photon (when Nominatim fails or misses any administrative unit)
    if (!resolvedCountry || !resolvedState || !resolvedDist || !resolvedTaluka) {
      try {
        const photonUrl = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(
          lat.toFixed(3)
        )}&lon=${encodeURIComponent(lon.toFixed(3))}&lang=en`;
        const photonRes = await fetch(photonUrl, {
          signal: AbortSignal.timeout(4500),
        });
        if (photonRes.ok) {
          const photonData = (await photonRes.json()) as any;
          const props = photonData?.features?.[0]?.properties || {};
          resolvedCountry = resolvedCountry || cleanAdminUnit(props.country, '');
          resolvedState = resolvedState || cleanAdminUnit(props.state, '');
          resolvedDist =
            resolvedDist || cleanAdminUnit(props.county || props.city || props.district, '');
          resolvedTaluka =
            resolvedTaluka ||
            cleanAdminUnit(props.county || props.city || props.district || props.name, '');
        }
      } catch {
        // Fall through to backups
      }
    }

    const finalGeoCountry = resolvedCountry || country || backupCountry;
    const finalGeoState = resolvedState || state || backupState;
    const finalGeoDist =
      resolvedDist || dist || backupDist || city || backupCity || finalGeoState;
    const finalGeoTaluka =
      resolvedTaluka || taluka || backupTaluka || city || backupCity || finalGeoDist;

    if (finalGeoCountry && finalGeoState) {
      const result = {
        country: finalGeoCountry,
        state: finalGeoState,
        dist: finalGeoDist || finalGeoState,
        taluka: finalGeoTaluka || finalGeoDist || finalGeoState,
      };
      geoAdminCache.set(cacheKey, result);
      return { ...result, locationSource: effectiveSource };
    }

    country = finalGeoCountry;
    state = finalGeoState;
    dist = finalGeoDist;
    taluka = finalGeoTaluka;
  }

  country = country || backupCountry;
  state = state || backupState;
  dist = dist || backupDist;
  taluka = taluka || backupTaluka;
  city = city || backupCity;

  if (!country && params.timeZone?.includes('Kolkata')) {
    country = 'India';
  }
  const finalCountry = country || 'Unknown';
  const finalState = state || 'Unknown';
  const finalDist = dist || city || (finalState !== 'Unknown' ? finalState : 'Unknown');
  const finalTaluka = taluka || city || finalDist;

  return {
    country: finalCountry,
    state: finalState,
    dist: finalDist,
    taluka: finalTaluka,
    locationSource: effectiveSource,
  };
}

async function startServer() {
  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Auto-detect visitor country and local Razorpay currency (Proxy headers -> IP geolocation -> Timezone -> Accept-Language)
  app.get('/api/geo/currency', async (req, res) => {
    try {
      const headerCandidates = [
        req.headers['cf-ipcountry'],
        req.headers['x-vercel-ip-country'],
        req.headers['x-appengine-country'],
        req.headers['cloudfront-viewer-country'],
        req.headers['x-country-code'],
      ];
      let countryCode = '';
      let source = 'default';

      for (const h of headerCandidates) {
        const val = Array.isArray(h) ? h[0] : h;
        const iso = resolveCountryCodeFromInput(val);
        if (iso && iso !== 'XX' && iso !== 'T1') {
          countryCode = iso;
          source = 'server_ip';
          break;
        }
      }

      if (!countryCode) {
        const ip = extractClientIp(req);
        if (isPublicIp(ip)) {
          const ipLoc = await lookupIpLocation(ip);
          const iso = resolveCountryCodeFromInput(ipLoc.country);
          if (iso) {
            countryCode = iso;
            source = 'server_ip';
          }
        }
      }

      if (!countryCode && req.query?.tz) {
        const tzCountry = resolveCountryFromTimeZone(String(req.query.tz));
        if (tzCountry) {
          countryCode = tzCountry;
          source = 'timezone';
        }
      }

      if (!countryCode) {
        const acceptLang = String(req.headers['accept-language'] || '');
        const match = acceptLang.match(/[a-z]{2}[-_]([A-Z]{2})/);
        if (match?.[1]) {
          countryCode = match[1].toUpperCase();
          source = 'locale';
        }
      }

      const finalCountry = countryCode || 'US';
      const currencyCode = getCurrencyForCountry(finalCountry);
      const currencyCfg = getCurrencyConfig(currencyCode);
      const label = COUNTRY_LABELS[finalCountry];

      return res.json({
        success: true,
        countryCode: finalCountry,
        countryName: label?.name || finalCountry,
        currency: currencyCfg.code,
        symbol: currencyCfg.symbol,
        source,
      });
    } catch {
      return res.json({
        success: true,
        countryCode: 'US',
        countryName: 'United States',
        currency: 'USD',
        symbol: '$',
        source: 'default',
      });
    }
  });

  // Track or upgrade website visit with structured administrative location (country, state, dist, taluka) + timestamp
  app.post('/api/analytics/track', async (req, res) => {
    try {
      const body = req.body || {};
      const rawViewId = String(body.viewId || `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 128);
      const pagePath = String(body.pagePath || '/').slice(0, 200) || '/';
      const ip = extractClientIp(req);
      const requestedSource: 'gps' | 'ip' | 'pincode' =
        body.locationSource === 'pincode'
          ? 'pincode'
          : body.locationSource === 'gps'
          ? 'gps'
          : 'ip';

      let loc: {
        country: string;
        state: string;
        dist: string;
        taluka: string;
        locationSource: 'gps' | 'ip' | 'pincode';
      };

      if (requestedSource === 'pincode' && typeof body.postalCode === 'string' && body.postalCode.trim()) {
        const pinLoc = await resolvePostalCodeLocation(body.postalCode);
        if (!pinLoc) {
          return res.status(404).json({
            success: false,
            error: 'Could not find District & Taluka for that Pincode. Please check the 6-digit Pincode.',
          });
        }
        loc = pinLoc;
      } else if (requestedSource === 'pincode' && body.country && body.state && body.dist && body.taluka) {
        loc = {
          country: cleanAdminUnit(body.country, 'India'),
          state: cleanAdminUnit(body.state, 'Unknown'),
          dist: cleanAdminUnit(body.dist, 'Unknown'),
          taluka: cleanAdminUnit(body.taluka, 'Unknown'),
          locationSource: 'pincode',
        };
      } else {
        loc = await resolveAdministrativeLocation({
          ip,
          country: body.country,
          state: body.state,
          dist: body.dist,
          taluka: body.taluka,
          city: body.city,
          lat: typeof body.lat === 'number' ? body.lat : undefined,
          lon: typeof body.lon === 'number' ? body.lon : undefined,
          locationSource: requestedSource === 'gps' ? 'gps' : 'ip',
          timeZone: typeof body.timeZone === 'string' ? body.timeZone : undefined,
        });
      }

      const rawAcc = Number(body.accuracyMeters);
      const accuracyMeters =
        Number.isFinite(rawAcc) && rawAcc >= 0 && rawAcc <= 20000000
          ? Math.round(rawAcc)
          : undefined;

      const views = loadStoredViews();
      const existingIdx = views.findIndex((v) => v.viewId === rawViewId);

      if (existingIdx !== -1) {
        const existingView = views[existingIdx];
        if (
          ((loc.locationSource === 'gps' || loc.locationSource === 'pincode') &&
            loc.country !== 'Unknown') ||
          (existingView.country === 'Unknown' && loc.country !== 'Unknown')
        ) {
          const updated: ServerSiteView = {
            ...existingView,
            country: loc.country,
            state: loc.state,
            dist: loc.dist,
            taluka: loc.taluka,
            locationSource: loc.locationSource,
            locationCleared: false,
            ...(accuracyMeters !== undefined
              ? { accuracyMeters }
              : loc.locationSource === 'pincode'
              ? { accuracyMeters: undefined }
              : {}),
          };
          if (loc.locationSource === 'pincode') {
            delete updated.accuracyMeters;
          }
          views[existingIdx] = updated;
          saveStoredViews(views);
          return res.json({ success: true, view: updated });
        }
        return res.json({ success: true, view: existingView });
      }

      const view: ServerSiteView = {
        viewId: rawViewId,
        country: loc.country,
        state: loc.state,
        dist: loc.dist,
        taluka: loc.taluka,
        pagePath,
        visitedAt: new Date().toISOString(),
        locationSource: loc.locationSource,
        ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
      };

      if (!(view.state === 'Unknown' && view.dist === 'Unknown' && view.taluka === 'Unknown')) {
        views.unshift(view);
        saveStoredViews(views);
      }

      return res.json({ success: true, view });
    } catch (err: any) {
      console.warn('[/api/analytics/track] Notice:', err?.message || err);
      return res.status(500).json({ success: false, error: 'Failed to record view' });
    }
  });

  // Fetch website analytics views (Admin only)
  app.get('/api/analytics/views', (req, res) => {
    const { ADMIN_EMAIL } = getPublicRuntimeEnv();
    const headerEmail = String(req.headers['x-admin-email'] || '')
      .trim()
      .toLowerCase();

    if (!ADMIN_EMAIL || headerEmail !== ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required.',
      });
    }

    const views = loadStoredViews();
    return res.json({ success: true, views });
  });

  // Clear recorded visitor location logs while preserving all website views (Admin only)
  app.delete('/api/analytics/views', (req, res) => {
    const { ADMIN_EMAIL } = getPublicRuntimeEnv();
    const headerEmail = String(req.headers['x-admin-email'] || '')
      .trim()
      .toLowerCase();

    if (!ADMIN_EMAIL || headerEmail !== ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Admin access required.',
      });
    }

    const clearedViews = loadStoredViews().map((v) => {
      const next: ServerSiteView = {
        ...v,
        country: 'Cleared',
        state: 'Cleared',
        dist: 'Cleared',
        taluka: 'Cleared',
        locationCleared: true,
      };
      delete next.accuracyMeters;
      return next;
    });
    saveStoredViews(clearedViews);
    return res.json({ success: true, clearedCount: clearedViews.length });
  });

  // Public runtime env script (works seamlessly with .env and Render Environment Variables without rebuilds)
  app.get('/api/config.js', (_req, res) => {
    const cfg = getPublicRuntimeEnv();
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.send(`window.__PIXIFORGE_ENV__ = ${JSON.stringify(cfg)};`);
  });

  app.get('/api/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json(getPublicRuntimeEnv());
  });

  const SERVER_OTP_SECRET =
    (process.env.OTP_SECRET || process.env.SESSION_SECRET || '').trim() ||
    crypto.randomBytes(32).toString('hex');
  const AUTH_ACCOUNTS_STORE_PATH = path.join(os.tmpdir(), 'pixiforge-auth-accounts.json');
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  interface ServerAuthAccount {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    salt: string;
    createdAt: string;
    updatedAt: string;
  }

  interface OtpChallengeRecord {
    otpHash: string;
    purpose: 'signup' | 'forgot';
    expiresAt: number;
    attempts: number;
    lastSentAt: number;
  }

  interface VerifiedTokenRecord {
    email: string;
    purpose: 'signup' | 'forgot';
    expiresAt: number;
  }

  const otpChallengeMap = new Map<string, OtpChallengeRecord>();
  const otpRequestWindowMap = new Map<string, number[]>();
  const verifiedTokenMap = new Map<string, VerifiedTokenRecord>();

  function loadServerAuthAccounts(): ServerAuthAccount[] {
    try {
      if (fs.existsSync(AUTH_ACCOUNTS_STORE_PATH)) {
        const raw = fs.readFileSync(AUTH_ACCOUNTS_STORE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((a) => a && typeof a.email === 'string' && typeof a.passwordHash === 'string');
        }
      }
    } catch (err) {
      console.warn('[Auth] Failed loading server auth accounts:', err);
    }
    return [];
  }

  function saveServerAuthAccounts(accounts: ServerAuthAccount[]) {
    try {
      fs.writeFileSync(AUTH_ACCOUNTS_STORE_PATH, JSON.stringify(accounts.slice(0, 10000)), 'utf8');
    } catch (err) {
      console.warn('[Auth] Failed saving server auth accounts:', err);
    }
  }

  function hashServerPassword(password: string, salt?: string): { hash: string; salt: string } {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, useSalt, 64).toString('hex');
    return { hash: derived, salt: useSalt };
  }

  function verifyServerPassword(password: string, storedHash: string, salt: string): boolean {
    try {
      const candidate = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(storedHash, 'hex');
      if (candidate.length !== expected.length) return false;
      return crypto.timingSafeEqual(candidate, expected);
    } catch {
      return false;
    }
  }

  function hashOtpChallenge(email: string, purpose: 'signup' | 'forgot', otpCode: string): string {
    return crypto
      .createHmac('sha256', SERVER_OTP_SECRET)
      .update(`${purpose}:${email}:${otpCode}`)
      .digest('hex');
  }

  function getFirebaseWebApiKey(): string {
    try {
      const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        return String(cfg.apiKey || '').trim();
      }
    } catch {
      // ignore
    }
    return '';
  }

  function buildOtpEmailHtml(cleanOtp: string, purpose: 'signup' | 'forgot', subject: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>${escapeServerHtml(subject)}</title></head>
        <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;color:#1e293b;">
          <div style="max-width:500px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 24px;text-align:center;color:#ffffff;">
              <h1 style="margin:0;font-size:24px;font-weight:800;">⚡ PixiForge</h1>
              <p style="margin:8px 0 0 0;font-size:13px;color:#e0e7ff;">Client-Side Image Suite &amp; Creative Studio</p>
            </div>
            <div style="padding:32px 28px;">
              <p style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 12px 0;">Hello,</p>
              <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px 0;">
                ${
                  purpose === 'forgot'
                    ? 'We received a request to reset your PixiForge account password. Enter the 6-digit OTP code below in the app to set a new password (no reset link is needed):'
                    : 'Thank you for creating a new account with PixiForge. Enter the 6-digit OTP code below to verify your email address:'
                }
              </p>
              <div style="background:#f8fafc;border:2px dashed #3b82f6;border-radius:16px;padding:24px;text-align:center;margin:0 0 24px 0;">
                <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#2563eb;letter-spacing:1px;margin-bottom:8px;">Your 6-Digit Verification OTP</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e3a8a;">${escapeServerHtml(cleanOtp)}</div>
                <div style="font-size:12px;font-weight:600;color:#64748b;margin-top:8px;">Valid for 10 minutes</div>
              </div>
              <p style="font-size:12px;color:#94a3b8;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:20px;margin:0;">
                Never share this OTP code with anyone. If you did not request this, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
  }

  async function dispatchTransactionalEmail(params: {
    toEmail: string;
    toName?: string;
    replyTo?: { email: string; name?: string };
    subject: string;
    htmlContent: string;
    senderName: string;
  }): Promise<{ ok: boolean; status: number; messageId?: string; provider?: string; error?: string }> {
    const { ADMIN_EMAIL, SUPPORT_EMAIL } = getPublicRuntimeEnv();
    const smtpUser = (
      process.env.SMTP_USER ||
      process.env.GMAIL_USER ||
      process.env.BREVO_SMTP_USER ||
      ''
    ).trim();
    const smtpPass = (
      process.env.SMTP_PASS ||
      process.env.GMAIL_APP_PASSWORD ||
      process.env.BREVO_SMTP_KEY ||
      ''
    ).trim();
    const explicitSmtpHost = (process.env.SMTP_HOST || '').trim();
    const smtpHost =
      explicitSmtpHost ||
      (smtpUser.toLowerCase().endsWith('@gmail.com') || process.env.GMAIL_APP_PASSWORD
        ? 'smtp.gmail.com'
        : process.env.BREVO_SMTP_KEY
        ? 'smtp-relay.brevo.com'
        : '');
    const smtpPort = Number(process.env.SMTP_PORT) || (smtpHost === 'smtp.gmail.com' ? 465 : 587);
    const smtpSecure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : smtpPort === 465;

    const brevoApiKey = (process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || '').trim();
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const configuredSender = (
      process.env.SENDER_EMAIL ||
      process.env.VITE_SENDER_EMAIL ||
      smtpUser ||
      SUPPORT_EMAIL ||
      ADMIN_EMAIL
    ).trim();

    const errors: string[] = [];

    const sendBuiltInSmtp = async (opts: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      fromAddress: string;
      fromName: string;
      toEmail: string;
      toName?: string;
      replyTo?: { email: string; name?: string };
      subject: string;
      htmlContent: string;
    }): Promise<{ messageId: string }> => {
      const stripCrlf = (v: string) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
      const wrapBase64 = (buf: Buffer) =>
        (buf.toString('base64').match(/.{1,76}/g) || ['']).join('\r\n');

      const readResponse = (sock: net.Socket | tls.TLSSocket): Promise<{ code: number; text: string }> =>
        new Promise((resolve, reject) => {
          let buffer = '';
          const cleanup = () => {
            sock.removeListener('data', onData);
            sock.removeListener('error', onErr);
            sock.removeListener('close', onClose);
            sock.removeListener('timeout', onTimeout);
          };
          const onErr = (e: Error) => {
            cleanup();
            reject(e);
          };
          const onClose = () => {
            cleanup();
            reject(new Error('SMTP connection closed unexpectedly'));
          };
          const onTimeout = () => {
            cleanup();
            reject(new Error('SMTP connection timed out'));
          };
          const onData = (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split(/\r?\n/);
            if (lines.length < 2) return;
            // Last line must be complete (trailing empty element after \n)
            if (lines[lines.length - 1] !== '') return;
            const completeLines = lines.slice(0, -1).filter(Boolean);
            if (completeLines.length === 0) return;
            const lastLine = completeLines[completeLines.length - 1];
            const m = lastLine.match(/^(\d{3})([ -])/);
            if (m && m[2] === ' ') {
              cleanup();
              resolve({ code: Number(m[1]), text: completeLines.join('\n') });
            }
          };
          sock.on('data', onData);
          sock.once('error', onErr);
          sock.once('close', onClose);
          sock.once('timeout', onTimeout);
        });

      const sendCmd = async (
        sock: net.Socket | tls.TLSSocket,
        cmd: string,
        expectedCodes: number[]
      ): Promise<string> => {
        sock.write(`${cmd}\r\n`);
        const res = await readResponse(sock);
        if (!expectedCodes.includes(res.code)) {
          throw new Error(`SMTP ${res.code}: ${res.text}`);
        }
        return res.text;
      };

      let sock: net.Socket | tls.TLSSocket = opts.secure
        ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
        : net.connect({ host: opts.host, port: opts.port });
      sock.setTimeout(12000);

      try {
        await new Promise<void>((resolve, reject) => {
          const eventName = opts.secure ? 'secureConnect' : 'connect';
          const onFail = (e: Error) => reject(e);
          sock.once('error', onFail);
          sock.once(eventName, () => {
            sock.removeListener('error', onFail);
            resolve();
          });
        });

        const greet = await readResponse(sock);
        if (greet.code !== 220) throw new Error(`SMTP greeting ${greet.code}: ${greet.text}`);

        let ehloText = await sendCmd(sock, 'EHLO pixiforge.in', [250]);

        if (!opts.secure && /STARTTLS/i.test(ehloText)) {
          await sendCmd(sock, 'STARTTLS', [220]);
          sock = await new Promise<tls.TLSSocket>((resolve, reject) => {
            const tlsSock = tls.connect({ socket: sock, servername: opts.host });
            tlsSock.setTimeout(12000);
            tlsSock.once('error', reject);
            tlsSock.once('secureConnect', () => {
              tlsSock.removeListener('error', reject);
              resolve(tlsSock);
            });
          });
          ehloText = await sendCmd(sock, 'EHLO pixiforge.in', [250]);
        }

        await sendCmd(sock, 'AUTH LOGIN', [334]);
        await sendCmd(sock, Buffer.from(opts.user, 'utf8').toString('base64'), [334]);
        await sendCmd(sock, Buffer.from(opts.pass, 'utf8').toString('base64'), [235]);

        await sendCmd(sock, `MAIL FROM:<${stripCrlf(opts.fromAddress)}>`, [250]);
        await sendCmd(sock, `RCPT TO:<${stripCrlf(opts.toEmail)}>`, [250, 251]);
        await sendCmd(sock, 'DATA', [354]);

        const msgId = `<${crypto.randomBytes(12).toString('hex')}@pixiforge.in>`;
        const encodedSubject = `=?UTF-8?B?${Buffer.from(stripCrlf(opts.subject), 'utf8').toString('base64')}?=`;
        const headers = [
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: ${msgId}`,
          `From: "${stripCrlf(opts.fromName).replace(/"/g, '')}" <${stripCrlf(opts.fromAddress)}>`,
          `To: ${
            opts.toName
              ? `"${stripCrlf(opts.toName).replace(/"/g, '')}" <${stripCrlf(opts.toEmail)}>`
              : stripCrlf(opts.toEmail)
          }`,
          ...(opts.replyTo?.email
            ? [
                `Reply-To: ${
                  opts.replyTo.name
                    ? `"${stripCrlf(opts.replyTo.name).replace(/"/g, '')}" <${stripCrlf(opts.replyTo.email)}>`
                    : stripCrlf(opts.replyTo.email)
                }`,
              ]
            : []),
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          'Content-Transfer-Encoding: base64',
        ];
        const mimeBody = `${headers.join('\r\n')}\r\n\r\n${wrapBase64(Buffer.from(opts.htmlContent, 'utf8'))}\r\n.`;
        await sendCmd(sock, mimeBody, [250]);
        await sendCmd(sock, 'QUIT', [221]).catch(() => '');
        return { messageId: msgId };
      } finally {
        sock.destroy();
      }
    };

    // 1. Try SMTP (Nodemailer if installed, otherwise built-in Node TLS/STARTTLS client)
    if (smtpHost && smtpUser && smtpPass) {
      try {
        const fromAddress = configuredSender || smtpUser;
        const nodemailerMod = await import('nodemailer').catch(() => null);
        if (nodemailerMod?.default) {
          const transporter = nodemailerMod.default.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 12000,
          });
          const info = await transporter.sendMail({
            from: `"${params.senderName}" <${fromAddress}>`,
            to: params.toName ? `"${params.toName}" <${params.toEmail}>` : params.toEmail,
            ...(params.replyTo?.email
              ? {
                  replyTo: params.replyTo.name
                    ? `"${params.replyTo.name}" <${params.replyTo.email}>`
                    : params.replyTo.email,
                }
              : {}),
            subject: params.subject,
            html: params.htmlContent,
          });
          return {
            ok: true,
            status: 200,
            messageId: info.messageId,
            provider: 'smtp',
          };
        }

        const builtInInfo = await sendBuiltInSmtp({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          user: smtpUser,
          pass: smtpPass,
          fromAddress,
          fromName: params.senderName,
          toEmail: params.toEmail,
          toName: params.toName,
          replyTo: params.replyTo,
          subject: params.subject,
          htmlContent: params.htmlContent,
        });
        return {
          ok: true,
          status: 200,
          messageId: builtInInfo.messageId,
          provider: 'smtp',
        };
      } catch (err: any) {
        errors.push(`SMTP: ${err?.message || 'Failed connecting to SMTP server'}`);
      }
    }

    // 2. Try Brevo REST API
    if (brevoApiKey && configuredSender) {
      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: params.senderName, email: configuredSender },
            to: [{ email: params.toEmail, ...(params.toName ? { name: params.toName } : {}) }],
            ...(params.replyTo?.email
              ? { replyTo: { email: params.replyTo.email, name: params.replyTo.name || params.replyTo.email } }
              : {}),
            subject: params.subject,
            htmlContent: params.htmlContent,
          }),
        });
        const data = (await brevoRes.json().catch(() => ({}))) as any;
        if (brevoRes.ok) {
          return {
            ok: true,
            status: 200,
            messageId: data.messageId,
            provider: 'brevo',
          };
        }
        const msg = String(data?.message || `Brevo status ${brevoRes.status}`);
        if (msg.includes('unrecognised IP') || msg.includes('authorised_ips')) {
          errors.push(
            'Brevo API blocked this server IP (Authorised IPs enabled in Brevo). Disable Authorised IPs in Brevo security settings or configure SMTP_USER + SMTP_PASS.'
          );
        } else {
          errors.push(`Brevo: ${msg}`);
        }
      } catch (err: any) {
        errors.push(`Brevo: ${err?.message || 'Network error'}`);
      }
    }

    // 3. Try Resend REST API
    if (resendApiKey) {
      try {
        const fromAddress = configuredSender || 'onboarding@resend.dev';
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${params.senderName} <${fromAddress}>`,
            to: [params.toEmail],
            ...(params.replyTo?.email ? { reply_to: params.replyTo.email } : {}),
            subject: params.subject,
            html: params.htmlContent,
          }),
        });
        const data = (await resendRes.json().catch(() => ({}))) as any;
        if (resendRes.ok) {
          return {
            ok: true,
            status: 200,
            messageId: data.id,
            provider: 'resend',
          };
        }
        errors.push(`Resend: ${data?.message || data?.error || `Status ${resendRes.status}`}`);
      } catch (err: any) {
        errors.push(`Resend: ${err?.message || 'Network error'}`);
      }
    }

    if (errors.length === 0) {
      return {
        ok: false,
        status: 400,
        error:
          'Email service is not configured on the server. Set SMTP_USER + SMTP_PASS (e.g. Gmail App Password) OR BREVO_API_KEY + SENDER_EMAIL in environment variables.',
      };
    }

    return {
      ok: false,
      status: 422,
      error: errors.join(' | '),
    };
  }

  // Server-generated OTP email delivery (New Account & Forgot Password - strictly 6-digit OTP, never a link)
  app.post('/api/auth/request-otp', async (req, res) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const purpose = req.body?.purpose === 'forgot' ? 'forgot' : req.body?.purpose === 'signup' ? 'signup' : null;

      if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 150) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
      }
      if (!purpose) {
        return res.status(400).json({ success: false, error: 'Invalid OTP purpose.' });
      }

      if (purpose === 'signup') {
        const accounts = loadServerAuthAccounts();
        if (accounts.some((a) => a.email === cleanEmail)) {
          return res.status(409).json({
            success: false,
            error: 'An account with this email already exists. Please Sign In or use Forgot Password.',
          });
        }
      }

      const key = `${purpose}:${cleanEmail}`;
      const now = Date.now();
      const existing = otpChallengeMap.get(key);
      if (existing && now - existing.lastSentAt < 30_000) {
        const waitSec = Math.ceil((30_000 - (now - existing.lastSentAt)) / 1000);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSec}s before requesting another OTP.`,
        });
      }

      const windowHistory = (otpRequestWindowMap.get(cleanEmail) || []).filter((ts) => now - ts < 15 * 60_000);
      if (windowHistory.length >= 8) {
        return res.status(429).json({
          success: false,
          error: 'Too many OTP requests. Please try again after 15 minutes.',
        });
      }

      const otpCode = String(crypto.randomInt(100000, 1000000));
      const subject =
        purpose === 'forgot'
          ? `PixiForge - Password Reset OTP: ${otpCode}`
          : `PixiForge - Your 6-Digit Email Verification Code: ${otpCode}`;
      const htmlContent = buildOtpEmailHtml(otpCode, purpose, subject);

      const delivery = await dispatchTransactionalEmail({
        toEmail: cleanEmail,
        subject,
        htmlContent,
        senderName: 'PixiForge Verification',
      });

      if (!delivery.ok) {
        return res.status(delivery.status).json({
          success: false,
          error: delivery.error || 'Failed to send OTP email.',
        });
      }

      otpChallengeMap.set(key, {
        otpHash: hashOtpChallenge(cleanEmail, purpose, otpCode),
        purpose,
        expiresAt: now + 10 * 60_000,
        attempts: 0,
        lastSentAt: now,
      });
      otpRequestWindowMap.set(cleanEmail, [...windowHistory, now]);

      return res.json({
        success: true,
        messageId: delivery.messageId,
        provider: delivery.provider,
        expiresInSeconds: 600,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to generate and send OTP email.',
      });
    }
  });

  // Verify 6-digit OTP code on server and issue short-lived verification token
  app.post('/api/auth/verify-otp', (req, res) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const cleanOtp = String(req.body?.otpCode || '').trim();
      const purpose = req.body?.purpose === 'forgot' ? 'forgot' : req.body?.purpose === 'signup' ? 'signup' : null;

      if (!EMAIL_REGEX.test(cleanEmail) || !/^\d{6}$/.test(cleanOtp) || !purpose) {
        return res.status(400).json({ success: false, error: 'Valid email and 6-digit OTP code are required.' });
      }

      const key = `${purpose}:${cleanEmail}`;
      const record = otpChallengeMap.get(key);
      if (!record) {
        return res.status(400).json({ success: false, error: 'OTP not found or already used. Please request a new OTP.' });
      }

      if (Date.now() > record.expiresAt) {
        otpChallengeMap.delete(key);
        return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new OTP.' });
      }

      if (record.attempts >= 5) {
        otpChallengeMap.delete(key);
        return res.status(429).json({ success: false, error: 'Too many invalid OTP attempts. Please request a new OTP.' });
      }

      const expectedBuf = Buffer.from(record.otpHash, 'hex');
      const actualBuf = Buffer.from(hashOtpChallenge(cleanEmail, purpose, cleanOtp), 'hex');
      const isMatch = expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

      if (!isMatch) {
        record.attempts += 1;
        otpChallengeMap.set(key, record);
        const remaining = Math.max(0, 5 - record.attempts);
        return res.status(400).json({
          success: false,
          error:
            remaining > 0
              ? `Invalid OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
              : 'Too many invalid attempts. Please request a new OTP.',
        });
      }

      otpChallengeMap.delete(key);
      const verificationToken = crypto.randomBytes(24).toString('hex');
      verifiedTokenMap.set(verificationToken, {
        email: cleanEmail,
        purpose,
        expiresAt: Date.now() + 10 * 60_000,
      });

      return res.json({ success: true, verificationToken });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'OTP verification failed.' });
    }
  });

  // Finalize Signup after OTP verification (stores scrypt-hashed credential on server)
  app.post('/api/auth/complete-signup', (req, res) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const cleanName = String(req.body?.name || '').trim().slice(0, 100);
      const cleanPassword = String(req.body?.password || '').trim();
      const verificationToken = String(req.body?.verificationToken || '').trim();
      const firebaseUid = String(req.body?.firebaseUid || '').trim();

      if (!EMAIL_REGEX.test(cleanEmail) || cleanPassword.length < 6 || !verificationToken) {
        return res.status(400).json({ success: false, error: 'Invalid signup payload.' });
      }

      const tokenRec = verifiedTokenMap.get(verificationToken);
      if (!tokenRec || tokenRec.email !== cleanEmail || tokenRec.purpose !== 'signup' || Date.now() > tokenRec.expiresAt) {
        return res.status(401).json({ success: false, error: 'OTP verification expired or invalid. Please verify OTP again.' });
      }
      verifiedTokenMap.delete(verificationToken);

      const { hash, salt } = hashServerPassword(cleanPassword);
      const now = new Date().toISOString();
      const accounts = loadServerAuthAccounts();
      const existingIdx = accounts.findIndex((a) => a.email === cleanEmail);
      const record: ServerAuthAccount = {
        id: firebaseUid || (existingIdx >= 0 ? accounts[existingIdx].id : `usr_${Date.now()}`),
        name: cleanName || (existingIdx >= 0 ? accounts[existingIdx].name : cleanEmail.split('@')[0]) || 'User',
        email: cleanEmail,
        passwordHash: hash,
        salt,
        createdAt: existingIdx >= 0 ? accounts[existingIdx].createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) {
        accounts[existingIdx] = record;
      } else {
        accounts.push(record);
      }
      saveServerAuthAccounts(accounts);

      return res.json({
        success: true,
        user: { id: record.id, name: record.name, email: record.email },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to save account.' });
    }
  });

  // Reset password using Forgot Password OTP verification token
  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const newPassword = String(req.body?.newPassword || '').trim();
      const verificationToken = String(req.body?.verificationToken || '').trim();

      if (!EMAIL_REGEX.test(cleanEmail) || newPassword.length < 6 || !verificationToken) {
        return res.status(400).json({ success: false, error: 'Valid email, 6+ character password, and OTP verification are required.' });
      }

      const tokenRec = verifiedTokenMap.get(verificationToken);
      if (!tokenRec || tokenRec.email !== cleanEmail || tokenRec.purpose !== 'forgot' || Date.now() > tokenRec.expiresAt) {
        return res.status(401).json({ success: false, error: 'OTP verification expired or invalid. Please verify OTP again.' });
      }
      verifiedTokenMap.delete(verificationToken);

      const { hash, salt } = hashServerPassword(newPassword);
      const now = new Date().toISOString();
      const accounts = loadServerAuthAccounts();
      const existingIdx = accounts.findIndex((a) => a.email === cleanEmail);
      const record: ServerAuthAccount = {
        id: existingIdx >= 0 ? accounts[existingIdx].id : `usr_${Date.now()}`,
        name: existingIdx >= 0 ? accounts[existingIdx].name : cleanEmail.split('@')[0] || 'User',
        email: cleanEmail,
        passwordHash: hash,
        salt,
        createdAt: existingIdx >= 0 ? accounts[existingIdx].createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) {
        accounts[existingIdx] = record;
      } else {
        accounts.push(record);
      }
      saveServerAuthAccounts(accounts);

      return res.json({
        success: true,
        user: { id: record.id, name: record.name, email: record.email },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to reset password.' });
    }
  });

  // Verify email + password against server scrypt hash (handles logins after OTP password reset across devices)
  app.post('/api/auth/login-verify', (req, res) => {
    try {
      const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
      const cleanPassword = String(req.body?.password || '').trim();
      if (!EMAIL_REGEX.test(cleanEmail) || !cleanPassword) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }

      const accounts = loadServerAuthAccounts();
      const account = accounts.find((a) => a.email === cleanEmail);
      if (!account || !verifyServerPassword(cleanPassword, account.passwordHash, account.salt)) {
        return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
      }

      return res.json({
        success: true,
        user: {
          id: account.id,
          name: account.name,
          email: account.email,
          createdAt: account.createdAt,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Login verification failed.' });
    }
  });

  // Sync Firebase-authenticated account hash to server after validating the caller's Firebase ID token
  app.post('/api/auth/sync-firebase-login', async (req, res) => {
    try {
      const idToken = String(req.body?.idToken || '').trim();
      const cleanPassword = String(req.body?.password || '').trim();
      const cleanName = String(req.body?.name || '').trim().slice(0, 100);
      const apiKey = getFirebaseWebApiKey();
      if (!idToken || !apiKey || cleanPassword.length < 6) {
        return res.status(400).json({ success: false });
      }

      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      if (!lookupRes.ok) {
        return res.status(401).json({ success: false });
      }
      const lookupData = (await lookupRes.json().catch(() => ({}))) as any;
      const fbUser = lookupData?.users?.[0];
      const cleanEmail = String(fbUser?.email || '').trim().toLowerCase();
      const firebaseUid = String(fbUser?.localId || '').trim();
      if (!cleanEmail || !firebaseUid) {
        return res.status(401).json({ success: false });
      }

      const { hash, salt } = hashServerPassword(cleanPassword);
      const now = new Date().toISOString();
      const accounts = loadServerAuthAccounts();
      const existingIdx = accounts.findIndex((a) => a.email === cleanEmail);
      const record: ServerAuthAccount = {
        id: firebaseUid,
        name: cleanName || (existingIdx >= 0 ? accounts[existingIdx].name : cleanEmail.split('@')[0]) || 'User',
        email: cleanEmail,
        passwordHash: hash,
        salt,
        createdAt: existingIdx >= 0 ? accounts[existingIdx].createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) {
        accounts[existingIdx] = record;
      } else {
        accounts.push(record);
      }
      saveServerAuthAccounts(accounts);
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ success: false });
    }
  });

  // Legacy direct OTP email endpoint backed by unified transactional dispatcher
  app.post('/api/email/send-otp', async (req, res) => {
    try {
      const { toEmail, otpCode, purpose } = req.body || {};
      const cleanTo = String(toEmail || '').trim();
      const cleanOtp = String(otpCode || '').trim();
      if (!cleanTo || !EMAIL_REGEX.test(cleanTo) || !/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ success: false, error: 'Valid recipient email and 6-digit OTP code are required.' });
      }

      const normalizedPurpose: 'signup' | 'forgot' = purpose === 'forgot' ? 'forgot' : 'signup';
      const subject =
        normalizedPurpose === 'forgot'
          ? `PixiForge - Password Reset OTP: ${cleanOtp}`
          : `PixiForge - Your 6-Digit Email Verification Code: ${cleanOtp}`;
      const htmlContent = buildOtpEmailHtml(cleanOtp, normalizedPurpose, subject);

      const delivery = await dispatchTransactionalEmail({
        toEmail: cleanTo,
        subject,
        htmlContent,
        senderName: 'PixiForge Verification',
      });

      if (delivery.ok) {
        return res.json({ success: true, messageId: delivery.messageId, provider: delivery.provider });
      }
      return res.status(delivery.status).json({
        success: false,
        error: delivery.error || 'Failed to dispatch OTP email',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to dispatch OTP email',
      });
    }
  });

  // Server-side Help complaint email delivery to configured SUPPORT_EMAIL / ADMIN_EMAIL
  app.post('/api/email/send-complaint', async (req, res) => {
    try {
      const { ticketId, name, email, phone, category, subject, message, userPlan } = req.body || {};
      const { ADMIN_EMAIL, SUPPORT_EMAIL } = getPublicRuntimeEnv();
      const targetEmail = (SUPPORT_EMAIL || ADMIN_EMAIL).trim();

      if (!targetEmail) {
        return res.status(400).json({
          success: false,
          error: 'Support email is not configured in environment variables (SUPPORT_EMAIL / ADMIN_EMAIL).',
        });
      }

      const safeTicket = escapeServerHtml(ticketId);
      const safeName = escapeServerHtml(String(name || '').trim());
      const safeEmail = escapeServerHtml(String(email || '').trim());
      const safePhone = escapeServerHtml(String(phone || '').trim() || 'Not provided');
      const safeCategory = escapeServerHtml(category);
      const safeSubject = escapeServerHtml(String(subject || '').trim());
      const safeMessage = escapeServerHtml(String(message || '').trim()).replace(/\n/g, '<br />');
      const safePlan = escapeServerHtml(String(userPlan || 'free').toUpperCase());

      const emailSubject = `[PixiForge Complaint #${ticketId}] ${category}: ${String(subject || '').trim()}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>${escapeServerHtml(emailSubject)}</title></head>
        <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f1f5f9;color:#0f172a;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:24px;color:#ffffff;">
              <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#c7d2fe;">New User Complaint</div>
              <h1 style="margin:6px 0 0 0;font-size:20px;font-weight:800;">Ticket #${safeTicket}</h1>
            </div>
            <div style="padding:24px;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px;">
                <tr><td style="padding:8px 0;color:#64748b;width:130px;font-weight:600;">Customer Name</td><td style="padding:8px 0;color:#0f172a;font-weight:700;">${safeName}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Customer Email</td><td style="padding:8px 0;color:#2563eb;font-weight:700;">${safeEmail}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Mobile Number</td><td style="padding:8px 0;color:#0f172a;font-weight:600;">${safePhone}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Current Plan</td><td style="padding:8px 0;color:#0f172a;font-weight:700;">${safePlan}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Category</td><td style="padding:8px 0;color:#b91c1c;font-weight:700;">${safeCategory}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;font-weight:600;">Subject</td><td style="padding:8px 0;color:#0f172a;font-weight:700;">${safeSubject}</td></tr>
              </table>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
                <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin-bottom:8px;">Complaint Details</div>
                <div style="font-size:14px;line-height:1.6;color:#1e293b;">${safeMessage}</div>
              </div>
            </div>
            <div style="background:#f8fafc;padding:14px 24px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;">
              Submitted on ${escapeServerHtml(new Date().toLocaleString('en-IN'))} • Reply directly to this email to respond to ${safeEmail}.
            </div>
          </div>
        </body>
        </html>
      `;

      const delivery = await dispatchTransactionalEmail({
        toEmail: targetEmail,
        toName: 'PixiForge Support',
        replyTo: { email: String(email || '').trim(), name: String(name || '').trim() },
        subject: emailSubject,
        htmlContent,
        senderName: 'PixiForge Support Desk',
      });

      if (delivery.ok) {
        return res.json({ success: true, messageId: delivery.messageId, provider: delivery.provider });
      }
      return res.status(delivery.status).json({
        success: false,
        error: delivery.error || `Use "Send via Gmail" below to email ${targetEmail} directly.`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to connect to email gateway',
      });
    }
  });

  // Server-side Razorpay Pro-Rata Refund endpoint (supports all international & INR currencies)
  // ---------------------------------------------------------------------------
  // Live refund status (Razorpay is the source of truth: pending / processed / failed)
  // ---------------------------------------------------------------------------
  app.get('/api/refund/status', async (req, res) => {
    try {
      const refundId = String(req.query.refundId || '').trim();
      // Real Razorpay refund ids look like rfnd_AbCdEf123456 (no extra underscores).
      if (!/^rfnd_[A-Za-z0-9]{10,24}$/.test(refundId)) {
        return res.json({ success: true, known: false, status: 'unknown' });
      }
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      if (!keyId || !keySecret) {
        return res.json({ success: true, known: false, status: 'unknown' });
      }
      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const rzpRes = await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`, {
        headers: { Authorization: `Basic ${authHeader}` },
      });
      if (!rzpRes.ok) {
        return res.json({ success: true, known: false, status: 'unknown' });
      }
      const r = (await rzpRes.json().catch(() => ({}))) as any;
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        known: true,
        status: String(r.status || 'pending'), // pending | processed | failed
        speedProcessed: r.speed_processed || undefined, // normal | instant
        speedRequested: r.speed_requested || undefined,
        createdAt: Number(r.created_at) > 0 ? new Date(Number(r.created_at) * 1000).toISOString() : undefined,
        arn: r.acquirer_data?.arn || undefined,
      });
    } catch (err) {
      console.error('[/api/refund/status] error:', err);
      return res.json({ success: true, known: false, status: 'unknown' });
    }
  });

  app.post('/api/refund', async (req, res) => {
    try {
      const {
        paymentId,
        refundAmount,
        refundAmountINR,
        currency,
        plan,
        billingCycle,
        userId,
        userEmail,
        daysUsed,
        totalDays,
      } = req.body || {};

      const numericRefund = Number(refundAmount ?? refundAmountINR);
      const requestedCurrency = currency ? getCurrencyConfig(String(currency)).code : '';
      let effectiveCurrency = requestedCurrency || 'INR';

      if (!Number.isFinite(numericRefund) || numericRefund < 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid refund amount.',
        });
      }

      if (numericRefund === 0) {
        return res.json({
          success: true,
          mode: 'no_refund_needed',
          refundId: `rfnd_zero_${Date.now()}`,
          status: 'processed',
          currency: effectiveCurrency,
          refundAmount: 0,
          refundAmountINR: 0,
        });
      }

      const hasValidPaymentIdFormat =
        typeof paymentId === 'string' &&
        /^pay_[a-zA-Z0-9]{10,24}$/.test(paymentId) &&
        !paymentId.startsWith('pay_usr_');

      if (!hasValidPaymentIdFormat) {
        return res.json({
          success: true,
          mode: 'no_refund_needed',
          refundId: `rfnd_nopay_${Date.now()}`,
          status: 'no_gateway_payment',
          currency: effectiveCurrency,
          refundAmount: 0,
          refundAmountINR: 0,
        });
      }

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      if (hasValidLiveCreds) {
        const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        // Verify original payment currency directly from Razorpay when not explicitly supplied
        if (!requestedCurrency) {
          try {
            const payRes = await fetch(
              `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
              {
                headers: { Authorization: `Basic ${authHeader}` },
              }
            );
            if (payRes.ok) {
              const payData = (await payRes.json().catch(() => ({}))) as any;
              if (payData?.currency) {
                effectiveCurrency = getCurrencyConfig(String(payData.currency)).code;
              }
            }
          } catch {
            // Keep fallback effectiveCurrency
          }
        }

        const amountMinor = toRazorpayMinorUnits(numericRefund, effectiveCurrency);

        const rzpResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amountMinor,
              speed: 'optimum',
              notes: {
                reason: 'Pro-rata membership cancellation',
                currency: effectiveCurrency,
                plan: String(plan || ''),
                billingCycle: String(billingCycle || ''),
                daysUsed: String(daysUsed ?? ''),
                totalDays: String(totalDays ?? ''),
                userId: String(userId || ''),
                userEmail: String(userEmail || ''),
              },
            }),
          }
        );

        const rzpData = (await rzpResponse.json().catch(() => ({}))) as any;

        if (!rzpResponse.ok) {
          const errDesc = String(rzpData?.error?.description || '');
          const errLower = errDesc.toLowerCase();

          if (errLower.includes('already') && errLower.includes('refund')) {
            return res.json({
              success: true,
              mode: 'razorpay_api',
              refundId: `rfnd_already_${Date.now()}`,
              status: 'already_refunded',
              currency: effectiveCurrency,
              refundAmount: numericRefund,
              refundAmountINR: numericRefund,
            });
          }

          if (
            errLower.includes('does not exist') ||
            errLower.includes('no such payment') ||
            errLower.includes('invalid id')
          ) {
            return res.json({
              success: true,
              mode: 'pending_gateway_secret',
              refundId: `rfnd_unmatched_${Date.now()}`,
              status: 'no_gateway_payment_found',
              currency: effectiveCurrency,
              refundAmount: 0,
              refundAmountINR: 0,
              warning: errDesc,
            });
          }

          return res.status(rzpResponse.status).json({
            success: false,
            mode: 'razorpay_error',
            error: errDesc || 'Razorpay refund API declined the request.',
          });
        }

        markServerPaymentRefunded(paymentId);

        return res.json({
          success: true,
          mode: 'razorpay_api',
          refundId: rzpData.id || `rfnd_${Date.now()}`,
          status: rzpData.status || 'processed',
          speed: rzpData.speed_processed || rzpData.speed_requested || undefined,
          currency: rzpData.currency || effectiveCurrency,
          refundAmount: numericRefund,
          refundAmountINR: numericRefund,
        });
      }

      // When RAZORPAY_KEY_SECRET is not configured yet on the server,
      // record the calculated refund request cleanly so merchant can settle or add secret.
      return res.json({
        success: true,
        mode: 'pending_gateway_secret',
        refundId: `rfnd_req_${Date.now()}`,
        status: 'pending_gateway_secret',
        currency: effectiveCurrency,
        refundAmount: numericRefund,
        refundAmountINR: numericRefund,
      });
    } catch (err: any) {
      console.error('[/api/refund] Unexpected error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Internal server error while processing refund.',
      });
    }
  });

  // Durable Server-Side Razorpay Payment & Webhook Ledger (survives low-RAM mobile browser refreshes & app kills)
  type ValidPlan = 'pro' | 'max' | 'ultra';
  type ValidCycle = 'monthly' | '3months' | '6months' | 'yearly';

  interface VerifiedPaymentEntry {
    paymentId: string;
    orderId?: string;
    subscriptionId?: string;
    plan: ValidPlan;
    billingCycle: ValidCycle;
    amount: number;
    currency: string;
    autoPay: boolean;
    autoPayStatus: 'active' | 'pending_mandate' | 'off';
    userId?: string;
    userEmail?: string;
    method?: string;
    status: 'captured' | 'authorized' | 'refunded';
    source: 'webhook' | 'verify' | 'reconcile' | 'callback';
    createdAt: string;
    updatedAt: string;
  }

  interface PendingCheckoutEntry {
    checkoutId: string;
    orderId?: string;
    subscriptionId?: string;
    plan: ValidPlan;
    billingCycle: ValidCycle;
    amount: number;
    currency: string;
    autoPay: boolean;
    userId?: string;
    userEmail?: string;
    createdAt: string;
  }

  const PAYMENTS_LEDGER_PATH = path.join(os.tmpdir(), 'pixiforge-payments-ledger.json');

  function normalizeValidPlan(raw: unknown): ValidPlan {
    const p = String(raw || '').trim().toLowerCase();
    if (p === 'max' || p === 'ultra' || p === 'pro') return p;
    return 'pro';
  }

  function normalizeValidCycle(raw: unknown): ValidCycle {
    const c = String(raw || '').trim().toLowerCase();
    if (c === '3months' || c === '6months' || c === 'yearly' || c === 'monthly') return c;
    return 'monthly';
  }

  function fromRazorpayMinorUnits(minorAmount: number, currencyCode: string): number {
    const cfg = getCurrencyConfig(currencyCode || 'INR');
    const numeric = Number(minorAmount) || 0;
    if (cfg.decimals === 0) return Math.round(numeric);
    if (cfg.decimals === 3) return Number((numeric / 1000).toFixed(3));
    return Number((numeric / 100).toFixed(2));
  }

  function loadPaymentLedger(): {
    verifiedPayments: VerifiedPaymentEntry[];
    pendingCheckouts: PendingCheckoutEntry[];
  } {
    try {
      if (fs.existsSync(PAYMENTS_LEDGER_PATH)) {
        const raw = fs.readFileSync(PAYMENTS_LEDGER_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          verifiedPayments: Array.isArray(parsed?.verifiedPayments) ? parsed.verifiedPayments : [],
          pendingCheckouts: Array.isArray(parsed?.pendingCheckouts) ? parsed.pendingCheckouts : [],
        };
      }
    } catch (err) {
      console.warn('[PaymentLedger] Load notice:', err);
    }
    return { verifiedPayments: [], pendingCheckouts: [] };
  }

  function savePaymentLedger(ledger: {
    verifiedPayments: VerifiedPaymentEntry[];
    pendingCheckouts: PendingCheckoutEntry[];
  }) {
    try {
      const trimmed = {
        verifiedPayments: ledger.verifiedPayments.slice(0, 5000),
        pendingCheckouts: ledger.pendingCheckouts.slice(0, 2000),
      };
      fs.writeFileSync(PAYMENTS_LEDGER_PATH, JSON.stringify(trimmed), 'utf8');
    } catch (err) {
      console.warn('[PaymentLedger] Save notice:', err);
    }
  }

  function findPendingCheckout(params: {
    orderId?: string;
    subscriptionId?: string;
    checkoutId?: string;
    userId?: string;
    userEmail?: string;
  }): PendingCheckoutEntry | undefined {
    const ledger = loadPaymentLedger();
    const cleanEmail = params.userEmail?.trim().toLowerCase();
    return ledger.pendingCheckouts.find(
      (c) =>
        (params.checkoutId && c.checkoutId === params.checkoutId) ||
        (params.orderId && c.orderId === params.orderId) ||
        (params.subscriptionId && c.subscriptionId === params.subscriptionId) ||
        (!params.orderId &&
          !params.subscriptionId &&
          ((params.userId && c.userId === params.userId) ||
            (cleanEmail && c.userEmail === cleanEmail)))
    );
  }

  function recordPendingCheckout(entry: Omit<PendingCheckoutEntry, 'createdAt'>): PendingCheckoutEntry {
    const ledger = loadPaymentLedger();
    const record: PendingCheckoutEntry = {
      ...entry,
      userEmail: entry.userEmail?.trim().toLowerCase() || undefined,
      createdAt: new Date().toISOString(),
    };
    ledger.pendingCheckouts = [
      record,
      ...ledger.pendingCheckouts.filter(
        (c) =>
          c.checkoutId !== record.checkoutId &&
          (!record.orderId || c.orderId !== record.orderId) &&
          (!record.subscriptionId || c.subscriptionId !== record.subscriptionId)
      ),
    ].slice(0, 2000);
    savePaymentLedger(ledger);
    return record;
  }

  function removeMatchingPendingCheckout(params: {
    orderId?: string;
    subscriptionId?: string;
    checkoutId?: string;
  }) {
    if (!params.orderId && !params.subscriptionId && !params.checkoutId) return;
    const ledger = loadPaymentLedger();
    ledger.pendingCheckouts = ledger.pendingCheckouts.filter(
      (c) =>
        !(
          (params.checkoutId && c.checkoutId === params.checkoutId) ||
          (params.orderId && c.orderId === params.orderId) ||
          (params.subscriptionId && c.subscriptionId === params.subscriptionId)
        )
    );
    savePaymentLedger(ledger);
  }

  function markServerPaymentRefunded(paymentId?: string, subscriptionId?: string) {
    if (!paymentId && !subscriptionId) return;
    const ledger = loadPaymentLedger();
    let changed = false;
    ledger.verifiedPayments = ledger.verifiedPayments.map((p) => {
      if (
        (paymentId && p.paymentId === paymentId) ||
        (subscriptionId && p.subscriptionId === subscriptionId)
      ) {
        changed = true;
        return { ...p, status: 'refunded', updatedAt: new Date().toISOString() };
      }
      return p;
    });
    if (changed) {
      savePaymentLedger(ledger);
    }
  }

  function upsertVerifiedPayment(
    entry: Omit<VerifiedPaymentEntry, 'createdAt' | 'updatedAt'> & { createdAt?: string }
  ): VerifiedPaymentEntry {
    const ledger = loadPaymentLedger();
    const now = new Date().toISOString();
    const cleanEmail = entry.userEmail?.trim().toLowerCase() || undefined;

    // Upgrade existing subscription placeholder (e.g. sub_...) when real pay_... arrives
    let existingIdx = ledger.verifiedPayments.findIndex((p) => p.paymentId === entry.paymentId);
    if (existingIdx === -1 && entry.subscriptionId && entry.paymentId.startsWith('pay_')) {
      existingIdx = ledger.verifiedPayments.findIndex(
        (p) => p.subscriptionId === entry.subscriptionId && p.paymentId === entry.subscriptionId
      );
    }

    const existing = existingIdx >= 0 ? ledger.verifiedPayments[existingIdx] : undefined;
    const finalStatus: VerifiedPaymentEntry['status'] =
      existing?.status === 'refunded' ? 'refunded' : entry.status;

    const merged: VerifiedPaymentEntry = {
      paymentId: entry.paymentId,
      orderId: entry.orderId || existing?.orderId,
      subscriptionId: entry.subscriptionId || existing?.subscriptionId,
      plan: entry.plan || existing?.plan || 'pro',
      billingCycle: entry.billingCycle || existing?.billingCycle || 'monthly',
      amount: Number(entry.amount) > 0 ? Number(entry.amount) : existing?.amount || 0,
      currency: getCurrencyConfig(entry.currency || existing?.currency || 'INR').code,
      autoPay: Boolean(entry.autoPay || entry.subscriptionId || existing?.autoPay),
      autoPayStatus:
        entry.autoPayStatus ||
        (entry.autoPay || entry.subscriptionId ? 'active' : existing?.autoPayStatus || 'off'),
      userId: entry.userId || existing?.userId,
      userEmail: cleanEmail || existing?.userEmail,
      method: entry.method || existing?.method,
      status: finalStatus,
      source: entry.source,
      createdAt: entry.createdAt || existing?.createdAt || now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      ledger.verifiedPayments[existingIdx] = merged;
    } else {
      ledger.verifiedPayments.unshift(merged);
    }
    ledger.pendingCheckouts = ledger.pendingCheckouts.filter(
      (c) =>
        !(
          (merged.orderId && c.orderId === merged.orderId) ||
          (merged.subscriptionId && c.subscriptionId === merged.subscriptionId)
        )
    );
    savePaymentLedger(ledger);
    return merged;
  }

  // Cache created Razorpay Plan IDs per key/tier/cycle/amount to avoid duplicate plan creation on every checkout
  const cachedRazorpayPlans = new Map<string, string>();

  // Server-side Razorpay Standard One-Time Order creation endpoint (Multi-currency)
  app.post('/api/order/create', async (req, res) => {
    try {
      const { plan, billingCycle, amount, amountINR, currency, userId, userEmail, userName } =
        req.body || {};
      const numericAmount = Number(amount ?? amountINR);
      const currencyCfg = getCurrencyConfig(currency ? String(currency) : 'INR');
      if (!plan || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan or order amount.',
        });
      }

      const checkoutId = `chk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      if (!hasValidLiveCreds) {
        recordPendingCheckout({
          checkoutId,
          plan: normalizeValidPlan(plan),
          billingCycle: normalizeValidCycle(billingCycle),
          amount: numericAmount,
          currency: currencyCfg.code,
          autoPay: false,
          userId: userId ? String(userId) : undefined,
          userEmail: userEmail ? String(userEmail) : undefined,
        });
        return res.json({
          success: true,
          mode: 'client_direct_checkout',
          checkoutId,
          orderId: null,
          currency: currencyCfg.code,
          keyId: keyId || undefined,
        });
      }

      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const amountMinor = toRazorpayMinorUnits(numericAmount, currencyCfg.code);
      const receipt = `pf_${String(plan).slice(0, 6)}_${Date.now()}`.slice(0, 40);

      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountMinor,
          currency: currencyCfg.code,
          receipt,
          payment_capture: 1,
          notes: {
            plan: String(plan),
            billingCycle: String(billingCycle || 'monthly'),
            currency: currencyCfg.code,
            autoPay: 'disabled',
            userId: String(userId || ''),
            userEmail: String(userEmail || ''),
            userName: String(userName || ''),
          },
        }),
      });

      const orderData = (await orderRes.json().catch(() => ({}))) as any;
      if (!orderRes.ok || !orderData?.id) {
        recordPendingCheckout({
          checkoutId,
          plan: normalizeValidPlan(plan),
          billingCycle: normalizeValidCycle(billingCycle),
          amount: numericAmount,
          currency: currencyCfg.code,
          autoPay: false,
          userId: userId ? String(userId) : undefined,
          userEmail: userEmail ? String(userEmail) : undefined,
        });
        return res.json({
          success: true,
          mode: 'client_direct_checkout',
          checkoutId,
          orderId: null,
          currency: currencyCfg.code,
          keyId,
          warning: orderData?.error?.description || 'Razorpay Order creation skipped; using direct checkout.',
        });
      }

      recordPendingCheckout({
        checkoutId,
        orderId: orderData.id,
        plan: normalizeValidPlan(plan),
        billingCycle: normalizeValidCycle(billingCycle),
        amount: numericAmount,
        currency: currencyCfg.code,
        autoPay: false,
        userId: userId ? String(userId) : undefined,
        userEmail: userEmail ? String(userEmail) : undefined,
      });

      return res.json({
        success: true,
        mode: 'razorpay_order',
        checkoutId,
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency || currencyCfg.code,
        keyId,
      });
    } catch (err: any) {
      console.error('[/api/order/create] Error:', err);
      return res.json({
        success: true,
        mode: 'client_direct_checkout',
        orderId: null,
      });
    }
  });

  // Server-side Razorpay HMAC-SHA256 Payment Signature Verification
  app.post('/api/payment/verify', async (req, res) => {
    try {
      const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_subscription_id,
        razorpay_signature,
        plan,
        billingCycle,
        amount,
        currency,
        autoPay,
        userId,
        userEmail,
      } = req.body || {};

      if (!razorpay_payment_id) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Missing payment ID.',
        });
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const hasValidSecret =
        Boolean(keySecret) &&
        Boolean(keyId) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      const pendingMeta = findPendingCheckout({
        orderId: razorpay_order_id ? String(razorpay_order_id) : undefined,
        subscriptionId: razorpay_subscription_id ? String(razorpay_subscription_id) : undefined,
        userId: userId ? String(userId) : undefined,
        userEmail: userEmail ? String(userEmail) : undefined,
      });

      const persistVerified = (source: VerifiedPaymentEntry['source']) => {
        upsertVerifiedPayment({
          paymentId: String(razorpay_payment_id),
          orderId: razorpay_order_id ? String(razorpay_order_id) : pendingMeta?.orderId,
          subscriptionId: razorpay_subscription_id
            ? String(razorpay_subscription_id)
            : pendingMeta?.subscriptionId,
          plan: normalizeValidPlan(plan || pendingMeta?.plan),
          billingCycle: normalizeValidCycle(billingCycle || pendingMeta?.billingCycle),
          amount: Number(amount) || pendingMeta?.amount || 0,
          currency: String(currency || pendingMeta?.currency || 'INR'),
          autoPay: Boolean(autoPay ?? pendingMeta?.autoPay ?? razorpay_subscription_id),
          autoPayStatus:
            Boolean(autoPay ?? pendingMeta?.autoPay ?? razorpay_subscription_id)
              ? razorpay_subscription_id || pendingMeta?.subscriptionId
                ? 'active'
                : 'pending_mandate'
              : 'off',
          userId: userId ? String(userId) : pendingMeta?.userId,
          userEmail: userEmail ? String(userEmail) : pendingMeta?.userEmail,
          status: 'captured',
          source,
        });
      };

      if (!hasValidSecret || !razorpay_signature) {
        persistVerified('verify');
        return res.json({
          success: true,
          verified: true,
          mode: 'client_unverified_no_secret',
        });
      }

      let payloadString = '';
      if (razorpay_subscription_id) {
        payloadString = `${razorpay_payment_id}|${razorpay_subscription_id}`;
      } else if (razorpay_order_id) {
        payloadString = `${razorpay_order_id}|${razorpay_payment_id}`;
      } else {
        persistVerified('verify');
        return res.json({
          success: true,
          verified: true,
          mode: 'no_order_or_sub_reference',
        });
      }

      const expectedSig = crypto
        .createHmac('sha256', keySecret)
        .update(payloadString)
        .digest('hex');

      const sigBuf = Buffer.from(String(razorpay_signature), 'utf8');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');
      const isValid =
        sigBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(sigBuf, expectedBuf);

      if (!isValid) {
        return res.status(400).json({
          success: false,
          verified: false,
          error: 'Payment signature verification failed. Please contact support if amount was debited.',
        });
      }

      persistVerified('verify');

      return res.json({
        success: true,
        verified: true,
        mode: 'razorpay_hmac_verified',
      });
    } catch (err: any) {
      console.error('[/api/payment/verify] Error:', err);
      return res.status(500).json({
        success: false,
        verified: false,
        error: err?.message || 'Failed to verify payment signature.',
      });
    }
  });

  // Server-side Razorpay AutoPay Subscription creation endpoint (Multi-currency)
  app.post('/api/subscription/create', async (req, res) => {
    try {
      const { plan, billingCycle, amount, amountINR, currency, userId, userEmail, userName } =
        req.body || {};
      const numericAmount = Number(amount ?? amountINR);
      const currencyCfg = getCurrencyConfig(currency ? String(currency) : 'INR');
      if (!plan || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan or subscription amount.',
        });
      }

      const checkoutId = `chk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      // Guard: Razorpay Subscriptions on very low amounts triggers auth reversals / mandate charges
      if (numericAmount < currencyCfg.minAutoPayAmount) {
        return res.json({
          success: true,
          mode: 'low_amount_one_time_guard',
          checkoutId,
          subscriptionId: null,
          keyId: hasValidLiveCreds ? keyId : undefined,
          warning: `AutoPay mandate requires at least ${currencyCfg.symbol}${currencyCfg.minAutoPayAmount}; proceeding with standard One-Time Payment.`,
        });
      }

      if (!hasValidLiveCreds) {
        recordPendingCheckout({
          checkoutId,
          plan: normalizeValidPlan(plan),
          billingCycle: normalizeValidCycle(billingCycle),
          amount: numericAmount,
          currency: currencyCfg.code,
          autoPay: true,
          userId: userId ? String(userId) : undefined,
          userEmail: userEmail ? String(userEmail) : undefined,
        });
        return res.json({
          success: true,
          mode: 'checkout_with_autopay_preference',
          checkoutId,
          subscriptionId: null,
        });
      }

      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const cycleMap: Record<string, { period: 'monthly' | 'yearly'; interval: number; totalCount: number }> = {
        monthly: { period: 'monthly', interval: 1, totalCount: 120 },
        '3months': { period: 'monthly', interval: 3, totalCount: 40 },
        '6months': { period: 'monthly', interval: 6, totalCount: 20 },
        yearly: { period: 'yearly', interval: 1, totalCount: 10 },
      };
      const cycleKey = String(billingCycle || 'monthly');
      const cycleCfg = cycleMap[cycleKey] || cycleMap.monthly;
      const amountMinor = toRazorpayMinorUnits(numericAmount, currencyCfg.code);
      const planCacheKey = `${keyId}_${String(plan)}_${cycleKey}_${currencyCfg.code}_${amountMinor}`;

      // Step 1: Reuse cached Razorpay Plan ID or create once for this tier + cycle + currency + amount
      let razorpayPlanId = cachedRazorpayPlans.get(planCacheKey) || '';
      if (!razorpayPlanId) {
        const planRes = await fetch('https://api.razorpay.com/v1/plans', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            period: cycleCfg.period,
            interval: cycleCfg.interval,
            item: {
              name: `PixiForge ${String(plan).toUpperCase()} (${cycleKey} • ${currencyCfg.code})`,
              amount: amountMinor,
              currency: currencyCfg.code,
              description: `PixiForge ${String(plan).toUpperCase()} AutoPay Membership (${currencyCfg.code})`,
            },
            notes: {
              plan: String(plan),
              billingCycle: cycleKey,
              currency: currencyCfg.code,
            },
          }),
        });

        const planData = (await planRes.json().catch(() => ({}))) as any;
        if (!planRes.ok || !planData?.id) {
          return res.json({
            success: true,
            mode: 'checkout_with_autopay_preference',
            checkoutId,
            subscriptionId: null,
            keyId,
            warning: planData?.error?.description || 'Razorpay Plan creation skipped; using standard checkout.',
          });
        }
        razorpayPlanId = planData.id;
        cachedRazorpayPlans.set(planCacheKey, razorpayPlanId);
      }

      // Step 2: Create Razorpay Subscription
      const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: razorpayPlanId,
          total_count: cycleCfg.totalCount,
          quantity: 1,
          customer_notify: 1,
          notes: {
            plan: String(plan),
            billingCycle: cycleKey,
            currency: currencyCfg.code,
            userId: String(userId || ''),
            userEmail: String(userEmail || ''),
            userName: String(userName || ''),
          },
        }),
      });

      const subData = (await subRes.json().catch(() => ({}))) as any;
      if (!subRes.ok || !subData?.id) {
        return res.json({
          success: true,
          mode: 'checkout_with_autopay_preference',
          checkoutId,
          subscriptionId: null,
          keyId,
          warning: subData?.error?.description || 'Razorpay Subscription creation skipped.',
        });
      }

      recordPendingCheckout({
        checkoutId,
        subscriptionId: subData.id,
        plan: normalizeValidPlan(plan),
        billingCycle: normalizeValidCycle(billingCycle),
        amount: numericAmount,
        currency: currencyCfg.code,
        autoPay: true,
        userId: userId ? String(userId) : undefined,
        userEmail: userEmail ? String(userEmail) : undefined,
      });

      return res.json({
        success: true,
        mode: 'razorpay_subscription',
        checkoutId,
        subscriptionId: subData.id,
        planId: razorpayPlanId,
        currency: currencyCfg.code,
        keyId,
      });
    } catch (err: any) {
      console.error('[/api/subscription/create] Error:', err);
      return res.json({
        success: true,
        mode: 'checkout_with_autopay_preference',
        subscriptionId: null,
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Server-side membership activation (Firebase Admin SDK).
  // Called from the Razorpay webhook so the plan is saved in Firestore the moment
  // the payment succeeds, even if the customer never reopens the website.
  // Needs env var FIREBASE_SERVICE_ACCOUNT (full service-account JSON, one line).
  // ---------------------------------------------------------------------------
  let adminDbPromise: Promise<any | null> | null = null;
  function getAdminDb(): Promise<any | null> {
    if (adminDbPromise) return adminDbPromise;
    adminDbPromise = (async () => {
      try {
        const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
        if (!raw) {
          console.warn('[Membership] FIREBASE_SERVICE_ACCOUNT not set; webhook cannot activate plans server-side.');
          return null;
        }
        const serviceAccount = JSON.parse(raw);
        if (typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        const cfg = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8')
        );
        const adminApp = await import('firebase-admin/app');
        const adminFs = await import('firebase-admin/firestore');
        const app =
          adminApp.getApps().length > 0
            ? adminApp.getApps()[0]
            : adminApp.initializeApp({
                credential: adminApp.cert(serviceAccount),
                projectId: cfg.projectId,
              });
        return cfg.firestoreDatabaseId
          ? adminFs.getFirestore(app, cfg.firestoreDatabaseId)
          : adminFs.getFirestore(app);
      } catch (err) {
        console.error('[Membership] Firebase Admin init failed:', err);
        return null;
      }
    })();
    return adminDbPromise;
  }

  // Razorpay gives payment time as unix seconds (created_at). Use it so membership starts when the customer PAID, not when they opened the site.
  function razorpayPaidAtIso(unixSeconds: unknown): string | undefined {
    const n = Number(unixSeconds);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    const ms = n * 1000;
    if (ms > Date.now() + 5 * 60 * 1000) return undefined;
    return new Date(ms).toISOString();
  }

  const CYCLE_MONTHS: Record<string, number> = { monthly: 1, '3months': 3, '6months': 6, yearly: 12 };

  async function activateMembershipInFirestore(p: {
    paymentId: string;
    subscriptionId?: string;
    plan: string;
    billingCycle: string;
    amount: number;
    currency: string;
    autoPay: boolean;
    autoPayStatus: string;
    userId?: string;
    userEmail?: string;
    paidAt?: string;
  }): Promise<boolean> {
    try {
      const db = await getAdminDb();
      if (!db) return false;

      // Find the user document: by userId first, else by email
      let userRef: any = null;
      if (p.userId && /^[a-zA-Z0-9_-]{1,128}$/.test(p.userId)) {
        const ref = db.collection('users').doc(p.userId);
        if ((await ref.get()).exists) userRef = ref;
      }
      if (!userRef && p.userEmail) {
        const q = await db.collection('users').where('email', '==', p.userEmail).limit(1).get();
        if (!q.empty) userRef = q.docs[0].ref;
      }
      if (!userRef) {
        console.warn(`[Membership] No Firestore user found for payment ${p.paymentId}`);
        return false;
      }

      await db.runTransaction(async (tx: any) => {
        const snap = await tx.get(userRef);
        const data = snap.data() || {};
        // Idempotent: Razorpay may send the same event several times
        const history: any[] = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
        if (data.lastPaymentId === p.paymentId || history.some((h) => h?.paymentId === p.paymentId)) {
          return;
        }
        const now = new Date();
        const paidDate = p.paidAt && !Number.isNaN(new Date(p.paidAt).getTime()) ? new Date(p.paidAt) : now;
        const expiry = new Date(paidDate);
        expiry.setMonth(expiry.getMonth() + (CYCLE_MONTHS[p.billingCycle] || 1));
        const nowIso = now.toISOString();
        const paidIso = paidDate.toISOString();
        const record: Record<string, any> = {
          paymentId: p.paymentId,
          plan: p.plan,
          billingCycle: p.billingCycle,
          amount: p.amount,
          currency: p.currency,
          date: paidIso,
          expiresAt: expiry.toISOString(),
          autoPay: p.autoPay,
        };
        if (p.subscriptionId) record.subscriptionId = p.subscriptionId;
        tx.update(userRef, {
          plan: p.plan,
          billingCycle: p.billingCycle,
          planExpiresAt: expiry.toISOString(),
          autoPayEnabled: p.autoPay,
          autoPayStatus: p.autoPayStatus,
          autoPayUpdatedAt: nowIso,
          ...(p.subscriptionId ? { subscriptionId: p.subscriptionId } : {}),
          lastPaymentId: p.paymentId,
          lastPaymentAmount: p.amount,
          lastPaymentCurrency: p.currency,
          lastPaymentDate: paidIso,
          paymentHistory: [record, ...history].slice(0, 20),
          updatedAt: nowIso,
        });
      });
      console.log(`[Membership] Activated ${p.plan}/${p.billingCycle} for payment ${p.paymentId}`);
      return true;
    } catch (err) {
      console.error('[Membership] Firestore activation failed:', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Admin panel: list ALL users from Firestore via the server (Firebase Admin SDK).
  // Works even if the browser's Firestore rules check fails. Only the admin can call it.
  // ---------------------------------------------------------------------------
  app.get('/api/admin/users', async (req, res) => {
    try {
      const authHeader = String(req.headers.authorization || '');
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!idToken) {
        return res.status(401).json({ error: 'Missing sign-in token.' });
      }
      const db = await getAdminDb();
      if (!db) {
        return res.status(503).json({ error: 'Firebase Admin is not configured on the server.' });
      }
      const adminAuth = await import('firebase-admin/auth');
      const decoded = await adminAuth.getAuth().verifyIdToken(idToken);

      const { ADMIN_EMAIL } = getPublicRuntimeEnv();
      const allowedEmail = (ADMIN_EMAIL || 'sanketchavan0257@gmail.com').trim().toLowerCase();
      const tokenEmail = String(decoded.email || '').trim().toLowerCase();
      let isAdmin = !!tokenEmail && tokenEmail === allowedEmail && decoded.email_verified === true;
      if (!isAdmin) {
        const adminDoc = await db.collection('admins').doc(decoded.uid).get();
        isAdmin = adminDoc.exists;
      }
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access only.' });
      }

      const snap = await db.collection('users').get();
      const users = snap.docs.map((d: any) => {
        const data = d.data() || {};
        return { ...data, userId: data.userId || d.id };
      });
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ users });
    } catch (err) {
      console.error('[Admin] /api/admin/users failed:', err);
      return res.status(500).json({ error: 'Could not load users.' });
    }
  });

  // Authoritative Razorpay Webhook Listener (handles GPay, PhonePe, Paytm, all UPI & Card events even when low-RAM phone kills browser tab)
  const handleRazorpayWebhook = async (req: any, res: express.Response) => {
    try {
      const signature = String(req.headers['x-razorpay-signature'] || '').trim();
      const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
      const rawBodyBuf: Buffer = Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : Buffer.from(JSON.stringify(req.body || {}), 'utf8');

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) && Boolean(keySecret) && keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      if (webhookSecret) {
        if (!signature) {
          return res.status(400).json({ success: false, error: 'Missing webhook signature.' });
        }
        const expected = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBodyBuf)
          .digest('hex');
        const sigBuf = Buffer.from(signature, 'utf8');
        const expBuf = Buffer.from(expected, 'utf8');
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
          return res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
        }
      } else if (!hasValidLiveCreds) {
        return res.status(400).json({
          success: false,
          error: 'Configure RAZORPAY_WEBHOOK_SECRET or RAZORPAY_KEY_SECRET to verify webhooks.',
        });
      }

      const body = req.body || {};
      const event = String(body.event || '').trim();
      const paymentEntity = body.payload?.payment?.entity;
      const orderEntity = body.payload?.order?.entity;
      const subEntity = body.payload?.subscription?.entity;
      const refundEntity = body.payload?.refund?.entity;

      if (event === 'refund.created' || event === 'refund.processed') {
        const refPayId = refundEntity?.payment_id || paymentEntity?.id;
        if (refPayId) {
          markServerPaymentRefunded(String(refPayId));
        }
        return res.json({ status: 'ok' });
      }

      if (event === 'subscription.cancelled' || event === 'subscription.halted') {
        if (subEntity?.id) {
          markServerPaymentRefunded(undefined, String(subEntity.id));
        }
        return res.json({ status: 'ok' });
      }

      const relevantPaymentEvents = new Set([
        'payment.captured',
        'payment.authorized',
        'order.paid',
        'subscription.authenticated',
        'subscription.activated',
        'subscription.charged',
      ]);

      if (!relevantPaymentEvents.has(event)) {
        return res.json({ status: 'ok', ignored: event || 'unknown' });
      }

      const paymentId = String(paymentEntity?.id || '');
      const orderId = String(paymentEntity?.order_id || orderEntity?.id || '') || undefined;
      const subscriptionId = String(subEntity?.id || paymentEntity?.subscription_id || '') || undefined;

      // When RAZORPAY_WEBHOOK_SECRET isn't configured, verify the event entity directly with Razorpay REST API
      let livePayment: any = paymentEntity || null;
      let liveSub: any = subEntity || null;
      if (!webhookSecret && hasValidLiveCreds) {
        const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        if (paymentId) {
          const pRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: `Basic ${authHeader}` },
          });
          if (!pRes.ok) {
            return res.status(400).json({ success: false, error: 'Unable to verify webhook payment via Razorpay API.' });
          }
          livePayment = await pRes.json().catch(() => null);
          if (!livePayment || !['captured', 'authorized'].includes(String(livePayment.status))) {
            return res.json({ status: 'ignored_unpaid' });
          }
        } else if (subscriptionId) {
          const sRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
            headers: { Authorization: `Basic ${authHeader}` },
          });
          if (!sRes.ok) {
            return res.status(400).json({ success: false, error: 'Unable to verify webhook subscription via Razorpay API.' });
          }
          liveSub = await sRes.json().catch(() => null);
          if (!liveSub || !['active', 'authenticated'].includes(String(liveSub.status))) {
            return res.json({ status: 'ignored_inactive_subscription' });
          }
        }
      }

      const mergedNotes = {
        ...(orderEntity?.notes || {}),
        ...(liveSub?.notes || {}),
        ...(livePayment?.notes || {}),
      };
      const pendingMeta = findPendingCheckout({
        orderId,
        subscriptionId,
        userId: mergedNotes.userId ? String(mergedNotes.userId) : undefined,
        userEmail: mergedNotes.userEmail ? String(mergedNotes.userEmail) : livePayment?.email,
      });

      const resolvedCurrency = getCurrencyConfig(
        String(livePayment?.currency || orderEntity?.currency || mergedNotes.currency || pendingMeta?.currency || 'INR')
      ).code;
      const minorAmount = Number(livePayment?.amount ?? orderEntity?.amount ?? 0);
      const resolvedAmount =
        minorAmount > 0
          ? fromRazorpayMinorUnits(minorAmount, resolvedCurrency)
          : pendingMeta?.amount || 0;

      const resolvedPlan = normalizeValidPlan(mergedNotes.plan || pendingMeta?.plan);
      const resolvedCycle = normalizeValidCycle(mergedNotes.billingCycle || pendingMeta?.billingCycle);
      const resolvedUserId = String(mergedNotes.userId || pendingMeta?.userId || '').trim() || undefined;
      const rawEmail = String(
        mergedNotes.userEmail || livePayment?.email || pendingMeta?.userEmail || ''
      )
        .trim()
        .toLowerCase();
      const resolvedUserEmail = rawEmail && rawEmail.includes('@') ? rawEmail : undefined;
      const isAutoPay =
        Boolean(subscriptionId) ||
        String(mergedNotes.autoPay || '').toLowerCase() === 'enabled' ||
        Boolean(pendingMeta?.autoPay);

      const effectivePaymentId = paymentId || subscriptionId;
      if (effectivePaymentId) {
        if (Number(livePayment?.amount_refunded || 0) > 0) {
          markServerPaymentRefunded(effectivePaymentId, subscriptionId);
          return res.json({ status: 'ok' });
        }

        upsertVerifiedPayment({
          paymentId: effectivePaymentId,
          orderId,
          subscriptionId,
          plan: resolvedPlan,
          billingCycle: resolvedCycle,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          autoPay: isAutoPay,
          autoPayStatus: isAutoPay ? 'active' : 'off',
          userId: resolvedUserId,
          userEmail: resolvedUserEmail,
          method: livePayment?.method ? String(livePayment.method) : undefined,
          status: livePayment?.status === 'authorized' ? 'authorized' : 'captured',
          source: 'webhook',
          createdAt: razorpayPaidAtIso(livePayment?.created_at),
        });

        // Save the membership in Firestore right now (no need for the customer to reopen the site)
        if (livePayment?.status !== 'authorized') {
          await activateMembershipInFirestore({
            paymentId: effectivePaymentId,
            subscriptionId,
            plan: resolvedPlan,
            billingCycle: resolvedCycle,
            amount: resolvedAmount,
            currency: resolvedCurrency,
            autoPay: isAutoPay,
            autoPayStatus: isAutoPay ? 'active' : 'off',
            userId: resolvedUserId,
            userEmail: resolvedUserEmail,
            paidAt: razorpayPaidAtIso(livePayment?.created_at),
          });
        }
      }

      return res.json({ status: 'ok' });
    } catch (err: any) {
      console.error('[/api/razorpay/webhook] Error:', err);
      return res.status(500).json({ status: 'error', error: err?.message || 'Webhook processing error' });
    }
  };

  app.post('/api/razorpay/webhook', handleRazorpayWebhook);
  app.post('/api/webhook/razorpay', handleRazorpayWebhook);

  // Razorpay Redirect Callback Handler (supports POST form callback_url & GET redirect from UPI/Bank/Subscription flows)
  const handleRazorpayCallback = async (req: express.Request, res: express.Response) => {
    try {
      const src = req.method === 'POST' ? req.body || {} : req.query || {};
      const paymentId = String(src.razorpay_payment_id || '').trim();
      const orderId = String(src.razorpay_order_id || '').trim() || undefined;
      const subscriptionId = String(src.razorpay_subscription_id || '').trim() || undefined;
      const signature = String(src.razorpay_signature || '').trim();
      const errDesc = String(src['error[description]'] || src.error_description || '').trim();

      if (!paymentId) {
        const failUrl = `/pricing?rzp_status=failed${errDesc ? `&rzp_error=${encodeURIComponent(errDesc)}` : ''}`;
        return res.redirect(302, failUrl);
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const hasValidSecret = Boolean(keySecret) && Boolean(keyId) && keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      if (hasValidSecret && signature) {
        const payloadString = subscriptionId
          ? `${paymentId}|${subscriptionId}`
          : orderId
          ? `${orderId}|${paymentId}`
          : '';
        if (payloadString) {
          const expectedSig = crypto.createHmac('sha256', keySecret).update(payloadString).digest('hex');
          const sigBuf = Buffer.from(signature, 'utf8');
          const expBuf = Buffer.from(expectedSig, 'utf8');
          if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return res.redirect(302, '/pricing?rzp_status=failed&rzp_error=Signature+verification+failed');
          }
        }
      }

      const pendingMeta = findPendingCheckout({ orderId, subscriptionId });
      upsertVerifiedPayment({
        paymentId,
        orderId: orderId || pendingMeta?.orderId,
        subscriptionId: subscriptionId || pendingMeta?.subscriptionId,
        plan: pendingMeta?.plan || 'pro',
        billingCycle: pendingMeta?.billingCycle || 'monthly',
        amount: pendingMeta?.amount || 0,
        currency: pendingMeta?.currency || 'INR',
        autoPay: Boolean(subscriptionId || pendingMeta?.autoPay),
        autoPayStatus: Boolean(subscriptionId || pendingMeta?.autoPay) ? 'active' : 'off',
        userId: pendingMeta?.userId,
        userEmail: pendingMeta?.userEmail,
        status: 'captured',
        source: 'callback',
      });

      const params = new URLSearchParams({
        rzp_status: 'success',
        rzp_payment_id: paymentId,
      });
      if (orderId) params.set('rzp_order_id', orderId);
      if (subscriptionId) params.set('rzp_subscription_id', subscriptionId);
      return res.redirect(302, `/pricing?${params.toString()}`);
    } catch (err: any) {
      console.error('[/api/razorpay/callback] Error:', err);
      return res.redirect(302, '/pricing?rzp_status=recover');
    }
  };

  app.post('/api/razorpay/callback', handleRazorpayCallback);
  app.get('/api/razorpay/callback', handleRazorpayCallback);

  // Authoritative Payment Recovery / Reconcile Endpoint (called after mobile browser reload, GPay switch-back, or checkout dismiss)
  app.post('/api/payment/reconcile', async (req, res) => {
    try {
      const {
        userId,
        userEmail,
        firebaseIdToken,
        pendingOrderId,
        pendingSubscriptionId,
        pendingCheckoutId,
        plan,
        billingCycle,
        amount,
        currency,
        autoPay,
        startedAt,
        knownPaymentIds,
      } = req.body || {};

      let cleanUserId = String(userId || '').trim();
      let cleanEmail = String(userEmail || '').trim().toLowerCase();

      // If caller supplies a Firebase ID token, prefer its server-verified UID/email
      const fbApiKey = getFirebaseWebApiKey();
      if (firebaseIdToken && fbApiKey) {
        try {
          const lookupRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbApiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: String(firebaseIdToken) }),
            }
          );
          if (lookupRes.ok) {
            const lookupData = (await lookupRes.json().catch(() => ({}))) as any;
            const fbUser = lookupData?.users?.[0];
            if (fbUser?.localId) cleanUserId = String(fbUser.localId).trim();
            if (fbUser?.email) cleanEmail = String(fbUser.email).trim().toLowerCase();
          }
        } catch {
          // Proceed with provided identifiers
        }
      }

      const knownSet = new Set<string>(
        Array.isArray(knownPaymentIds) ? knownPaymentIds.map((x: any) => String(x || '').trim()) : []
      );
      const orderIdStr = pendingOrderId ? String(pendingOrderId).trim() : '';
      const subIdStr = pendingSubscriptionId ? String(pendingSubscriptionId).trim() : '';

      if (!cleanUserId && !cleanEmail && !orderIdStr && !subIdStr) {
        return res.json({ found: false, pendingProcessing: false });
      }

      const ledger = loadPaymentLedger();
      const pendingMeta = findPendingCheckout({
        orderId: orderIdStr || undefined,
        subscriptionId: subIdStr || undefined,
        checkoutId: pendingCheckoutId ? String(pendingCheckoutId).trim() : undefined,
        userId: cleanUserId || undefined,
        userEmail: cleanEmail || undefined,
      });

      const matchesCaller = (candidateUserId?: string, candidateEmail?: string, candidateOrderId?: string, candidateSubId?: string) => {
        if (orderIdStr && candidateOrderId && candidateOrderId === orderIdStr) return true;
        if (subIdStr && candidateSubId && candidateSubId === subIdStr) return true;
        if (cleanUserId && candidateUserId && candidateUserId === cleanUserId) return true;
        if (cleanEmail && candidateEmail && candidateEmail.toLowerCase() === cleanEmail) return true;
        return false;
      };

      // 1. Check durable server webhook / callback / verified ledger first (instant!)
      const ledgerMatch = ledger.verifiedPayments.find((p) => {
        if (p.status === 'refunded') return false;
        if (knownSet.has(p.paymentId)) return false;
        return matchesCaller(p.userId, p.userEmail, p.orderId, p.subscriptionId);
      });

      if (ledgerMatch) {
        removeMatchingPendingCheckout({
          orderId: ledgerMatch.orderId || orderIdStr || undefined,
          subscriptionId: ledgerMatch.subscriptionId || subIdStr || undefined,
          checkoutId: pendingCheckoutId ? String(pendingCheckoutId) : undefined,
        });
        return res.json({
          found: true,
          source: ledgerMatch.source,
          payment: ledgerMatch,
        });
      }

      // 2. Directly query Razorpay REST API (works even before Webhook URL is configured or if webhook is 1-2s behind!)
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) && Boolean(keySecret) && keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      if (!hasValidLiveCreds) {
        return res.json({ found: false, pendingProcessing: false });
      }

      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      let pendingProcessing = false;

      // 2a. Check specific pending One-Time Order ID on Razorpay
      if (orderIdStr && orderIdStr.startsWith('order_')) {
        try {
          const orderPayRes = await fetch(
            `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderIdStr)}/payments`,
            { headers: { Authorization: `Basic ${authHeader}` } }
          );
          if (orderPayRes.ok) {
            const orderPayData = (await orderPayRes.json().catch(() => ({}))) as any;
            const items: any[] = Array.isArray(orderPayData?.items) ? orderPayData.items : [];
            const paidItem = items.find(
              (p) =>
                (p?.status === 'captured' || p?.status === 'authorized') &&
                Number(p?.amount_refunded || 0) === 0 &&
                !knownSet.has(String(p?.id || ''))
            );
            if (paidItem) {
              const notes = paidItem.notes || {};
              const resolvedCurrency = getCurrencyConfig(
                String(paidItem.currency || currency || pendingMeta?.currency || 'INR')
              ).code;
              const entry = upsertVerifiedPayment({
                paymentId: String(paidItem.id),
                orderId: orderIdStr,
                plan: normalizeValidPlan(notes.plan || plan || pendingMeta?.plan),
                billingCycle: normalizeValidCycle(notes.billingCycle || billingCycle || pendingMeta?.billingCycle),
                amount: fromRazorpayMinorUnits(Number(paidItem.amount || 0), resolvedCurrency) || Number(amount) || pendingMeta?.amount || 0,
                currency: resolvedCurrency,
                autoPay: false,
                autoPayStatus: 'off',
                userId: cleanUserId || notes.userId || pendingMeta?.userId,
                userEmail: cleanEmail || notes.userEmail || paidItem.email || pendingMeta?.userEmail,
                method: paidItem.method ? String(paidItem.method) : undefined,
                status: paidItem.status === 'authorized' ? 'authorized' : 'captured',
                source: 'reconcile',
                createdAt: razorpayPaidAtIso(paidItem.created_at),
              });
              return res.json({ found: true, source: 'razorpay_order_api', payment: entry });
            }
            if (items.some((p) => p?.status === 'created')) {
              pendingProcessing = true;
            }
          }
        } catch (err) {
          console.warn('[/api/payment/reconcile] Order lookup notice:', err);
        }
      }

      // 2b. Check specific pending Subscription ID on Razorpay (AutoPay)
      if (subIdStr && subIdStr.startsWith('sub_') && !subIdStr.startsWith('sub_pref_')) {
        try {
          const subRes = await fetch(
            `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subIdStr)}`,
            { headers: { Authorization: `Basic ${authHeader}` } }
          );
          if (subRes.ok) {
            const subData = (await subRes.json().catch(() => ({}))) as any;
            const subStatus = String(subData?.status || '');
            const paidCount = Number(subData?.paid_count || 0);
            if (subStatus === 'active' || subStatus === 'authenticated' || paidCount >= 1) {
              let invPaymentId = '';
              let invAmount = 0;
              let invCurrency = String(currency || pendingMeta?.currency || 'INR');
              let invMethod: string | undefined;
              try {
                const invRes = await fetch(
                  `https://api.razorpay.com/v1/invoices?subscription_id=${encodeURIComponent(subIdStr)}`,
                  { headers: { Authorization: `Basic ${authHeader}` } }
                );
                if (invRes.ok) {
                  const invData = (await invRes.json().catch(() => ({}))) as any;
                  const paidInv = (invData?.items || []).find(
                    (inv: any) => inv?.payment_id && inv?.status === 'paid'
                  );
                  if (paidInv?.payment_id) {
                    invPaymentId = String(paidInv.payment_id);
                    invCurrency = String(paidInv.currency || invCurrency);
                    invAmount = fromRazorpayMinorUnits(Number(paidInv.amount_paid || paidInv.amount || 0), invCurrency);
                  }
                }
              } catch {
                // fallback below
              }
              const finalPayId = invPaymentId || subIdStr;
              if (!knownSet.has(finalPayId)) {
                const notes = subData?.notes || {};
                const entry = upsertVerifiedPayment({
                  paymentId: finalPayId,
                  subscriptionId: subIdStr,
                  plan: normalizeValidPlan(notes.plan || plan || pendingMeta?.plan),
                  billingCycle: normalizeValidCycle(notes.billingCycle || billingCycle || pendingMeta?.billingCycle),
                  amount: invAmount || Number(amount) || pendingMeta?.amount || 0,
                  currency: getCurrencyConfig(invCurrency).code,
                  autoPay: true,
                  autoPayStatus: 'active',
                  userId: cleanUserId || notes.userId || pendingMeta?.userId,
                  userEmail: cleanEmail || notes.userEmail || pendingMeta?.userEmail,
                  method: invMethod,
                  status: 'captured',
                  source: 'reconcile',
                });
                return res.json({ found: true, source: 'razorpay_subscription_api', payment: entry });
              }
            }
          }
        } catch (err) {
          console.warn('[/api/payment/reconcile] Subscription lookup notice:', err);
        }
      }

      // 2c. Recent Payments scan fallback (catches GPay / UPI / Card payments even if localStorage lost orderId)
      if (cleanUserId || cleanEmail) {
        try {
          const minWindowSec = startedAt
            ? Math.floor((Number(startedAt) - 180_000) / 1000)
            : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
          const listRes = await fetch(
            `https://api.razorpay.com/v1/payments?count=25&from=${Math.max(0, minWindowSec)}`,
            { headers: { Authorization: `Basic ${authHeader}` } }
          );
          if (listRes.ok) {
            const listData = (await listRes.json().catch(() => ({}))) as any;
            const items: any[] = Array.isArray(listData?.items) ? listData.items : [];
            const matched = items.find((p) => {
              const pid = String(p?.id || '');
              if (!pid || knownSet.has(pid)) return false;
              if (Number(p?.amount_refunded || 0) > 0) return false;
              if (p?.status !== 'captured' && p?.status !== 'authorized') return false;
              const notes = p?.notes || {};
              const nUid = String(notes.userId || '').trim();
              const nEmail = String(notes.userEmail || p?.email || '').trim().toLowerCase();
              if (cleanUserId && nUid && nUid === cleanUserId) return true;
              if (cleanEmail && nEmail && nEmail === cleanEmail) return true;
              return false;
            });

            if (matched) {
              const notes = matched.notes || {};
              const resolvedCurrency = getCurrencyConfig(
                String(matched.currency || notes.currency || currency || pendingMeta?.currency || 'INR')
              ).code;
              const matchedSubId = matched.subscription_id ? String(matched.subscription_id) : subIdStr || undefined;
              const isAutoPay =
                Boolean(matchedSubId) ||
                String(notes.autoPay || '').toLowerCase() === 'enabled' ||
                Boolean(autoPay ?? pendingMeta?.autoPay);

              const entry = upsertVerifiedPayment({
                paymentId: String(matched.id),
                orderId: matched.order_id ? String(matched.order_id) : orderIdStr || undefined,
                subscriptionId: matchedSubId,
                plan: normalizeValidPlan(notes.plan || plan || pendingMeta?.plan),
                billingCycle: normalizeValidCycle(notes.billingCycle || billingCycle || pendingMeta?.billingCycle),
                amount: fromRazorpayMinorUnits(Number(matched.amount || 0), resolvedCurrency) || Number(amount) || pendingMeta?.amount || 0,
                currency: resolvedCurrency,
                autoPay: isAutoPay,
                autoPayStatus: isAutoPay ? 'active' : 'off',
                userId: cleanUserId || notes.userId || pendingMeta?.userId,
                userEmail: cleanEmail || notes.userEmail || matched.email || pendingMeta?.userEmail,
                method: matched.method ? String(matched.method) : undefined,
                status: matched.status === 'authorized' ? 'authorized' : 'captured',
                source: 'reconcile',
                createdAt: razorpayPaidAtIso(matched.created_at),
              });
              return res.json({ found: true, source: 'razorpay_recent_payments_api', payment: entry });
            }

            if (
              items.some((p) => {
                if (p?.status !== 'created') return false;
                const notes = p?.notes || {};
                const nUid = String(notes.userId || '').trim();
                const nEmail = String(notes.userEmail || p?.email || '').trim().toLowerCase();
                return (cleanUserId && nUid === cleanUserId) || (cleanEmail && nEmail === cleanEmail);
              })
            ) {
              pendingProcessing = true;
            }
          }
        } catch (err) {
          console.warn('[/api/payment/reconcile] Recent payments lookup notice:', err);
        }
      }

      return res.json({ found: false, pendingProcessing });
    } catch (err: any) {
      console.error('[/api/payment/reconcile] Error:', err);
      return res.json({ found: false, pendingProcessing: false });
    }
  });

  // Server-side Razorpay AutoPay Subscription cancellation endpoint
  app.post('/api/subscription/cancel', async (req, res) => {
    try {
      const { subscriptionId, cancelAtCycleEnd } = req.body || {};

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveSub =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag' &&
        typeof subscriptionId === 'string' &&
        subscriptionId.startsWith('sub_') &&
        !subscriptionId.startsWith('sub_pref_');

      if (hasValidLiveSub) {
        const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch(
          `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
            }),
          }
        );

        const rzpData = (await rzpRes.json().catch(() => ({}))) as any;
        if (!rzpRes.ok) {
          const errDesc = String(rzpData?.error?.description || '');
          const errLower = errDesc.toLowerCase();
          if (
            errLower.includes('already') ||
            errLower.includes('cancelled') ||
            errLower.includes('does not exist') ||
            errLower.includes('completed')
          ) {
            return res.json({
              success: true,
              mode: 'razorpay_api',
              status: 'cancelled',
            });
          }
          return res.status(rzpRes.status).json({
            success: false,
            mode: 'razorpay_error',
            error: errDesc || 'Failed to cancel Razorpay AutoPay subscription.',
          });
        }

        return res.json({
          success: true,
          mode: 'razorpay_api',
          status: rzpData?.status || 'cancelled',
        });
      }

      return res.json({
        success: true,
        mode: 'pending_gateway_secret',
        status: 'cancelled',
      });
    } catch (err: any) {
      console.error('[/api/subscription/cancel] Error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to cancel AutoPay subscription.',
      });
    }
  });

  // Check live Razorpay AutoPay Subscription status (verifies if auto-renewal succeeded)
  app.get('/api/subscription/status', async (req, res) => {
    try {
      const subscriptionId = String(req.query?.subscriptionId || '');
      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveSub =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag' &&
        subscriptionId.startsWith('sub_') &&
        !subscriptionId.startsWith('sub_pref_');

      if (!hasValidLiveSub) {
        return res.json({
          success: true,
          mode: 'local_only',
          status: 'unknown',
          isActive: false,
        });
      }

      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const rzpRes = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
        }
      );
      const rzpData = (await rzpRes.json().catch(() => ({}))) as any;
      if (!rzpRes.ok) {
        return res.json({
          success: false,
          mode: 'razorpay_error',
          status: 'unknown',
          isActive: false,
        });
      }

      const status = String(rzpData?.status || '');
      const currentEndMs = rzpData?.current_end ? Number(rzpData.current_end) * 1000 : null;
      const isRenewedAndActive =
        status === 'active' && currentEndMs !== null && currentEndMs > Date.now();

      return res.json({
        success: true,
        mode: 'razorpay_api',
        status,
        currentEndISO: currentEndMs ? new Date(currentEndMs).toISOString() : null,
        isActive: isRenewedAndActive,
      });
    } catch (err: any) {
      console.error('[/api/subscription/status] Error:', err);
      return res.json({
        success: false,
        mode: 'error',
        status: 'unknown',
        isActive: false,
      });
    }
  });

  // Fast Native C++ Background Removal (BRIA RMBG-1.4, pre-warmed once in server memory)
  let serverRmbgSessionPromise: Promise<any> | null = null;
  let serverRmbgReady = false;
  let serverRmbgQueue: Promise<unknown> = Promise.resolve();

  const RMBG_MODEL_URL =
    'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx';

  const resolveRmbgModelPath = (): string | null => {
    const candidates = [
      path.resolve(__dirname, 'public/mediapipe-models/rmbg-1.4.onnx'),
      path.resolve(__dirname, 'dist/mediapipe-models/rmbg-1.4.onnx'),
      '/tmp/pixiforge-models/rmbg-1.4.onnx',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p) && fs.statSync(p).size > 1_000_000) return p;
    }
    return null;
  };

  const ensureRmbgModelPath = async (): Promise<string> => {
    const existing = resolveRmbgModelPath();
    if (existing) return existing;

    const targetDirs = [
      path.resolve(__dirname, 'public/mediapipe-models'),
      '/tmp/pixiforge-models',
    ];
    let destPath = '/tmp/pixiforge-models/rmbg-1.4.onnx';
    for (const dir of targetDirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        destPath = path.join(dir, 'rmbg-1.4.onnx');
        break;
      } catch {
        // Fallback to /tmp if app folder is read-only
      }
    }

    const tmpPath = `${destPath}.${process.pid}.tmp`;
    const response = await fetch(RMBG_MODEL_URL);
    if (!response.ok) {
      throw new Error(`RMBG-1.4 ONNX model download failed with HTTP ${response.status}.`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 1_000_000) {
      throw new Error('Downloaded RMBG-1.4 ONNX file is invalid or incomplete.');
    }
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, destPath);
    return destPath;
  };

  const decodeImageBufferToRgb1024 = (imgBuf: Buffer): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-v',
        'error',
        '-i',
        'pipe:0',
        '-vf',
        'scale=1024:1024:flags=bilinear',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        'pipe:1',
      ]);
      const chunks: Buffer[] = [];
      let stderr = '';
      proc.stdout.on('data', (d: Buffer) => chunks.push(d));
      proc.stderr.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        const out = Buffer.concat(chunks);
        if (code === 0 && out.byteLength === 1024 * 1024 * 3) {
          resolve(out);
        } else {
          reject(new Error(`ffmpeg decode failed (code=${code}, bytes=${out.byteLength}): ${stderr}`));
        }
      });
      proc.stdin.on('error', () => {});
      proc.stdin.write(imgBuf);
      proc.stdin.end();
    });
  };

  const finalizeAlphaMask1024 = (rawOut: Float32Array): Buffer => {
    const W = 1024;
    const H = 1024;
    const TOTAL = W * H;

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < TOTAL; i++) {
      const v = rawOut[i];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const span = maxVal - minVal;
    const conf = new Float32Array(TOTAL);
    if (span > 1e-5) {
      const invSpan = 1 / span;
      for (let i = 0; i < TOTAL; i++) {
        const norm = (rawOut[i] - minVal) * invSpan;
        conf[i] = norm <= 0 ? 0 : norm >= 1 ? 1 : norm;
      }
    } else {
      for (let i = 0; i < TOTAL; i++) {
        const norm = rawOut[i];
        conf[i] = norm <= 0 ? 0 : norm >= 1 ? 1 : norm;
      }
    }

    const BG_CUT = 0.24;
    const FG_LOCK = 0.76;
    const cSpan = FG_LOCK - BG_CUT;
    const alpha = Buffer.allocUnsafe(TOTAL);

    for (let i = 0; i < TOTAL; i++) {
      const c = conf[i];
      if (c >= FG_LOCK) {
        alpha[i] = 255;
      } else if (c <= BG_CUT) {
        alpha[i] = 0;
      } else {
        const t = (c - BG_CUT) / cSpan;
        alpha[i] = Math.round(t * t * (3 - 2 * t) * 255);
      }
    }

    // Flood-fill exterior background from border so genuine enclosed gaps stay transparent
    const exteriorBg = new Uint8Array(TOTAL);
    const queue = new Int32Array(TOTAL);
    let head = 0;
    let tail = 0;
    const trySeed = (idx: number) => {
      if (exteriorBg[idx] === 0 && alpha[idx] < 128) {
        exteriorBg[idx] = 1;
        queue[tail++] = idx;
      }
    };
    for (let x = 0; x < W; x++) {
      trySeed(x);
      trySeed((H - 1) * W + x);
    }
    for (let y = 0; y < H; y++) {
      trySeed(y * W);
      trySeed(y * W + (W - 1));
    }
    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % W;
      const cy = (curr - cx) / W;
      if (cx > 0) trySeed(curr - 1);
      if (cx < W - 1) trySeed(curr + 1);
      if (cy > 0) trySeed(curr - W);
      if (cy < H - 1) trySeed(curr + W);
    }

    // Fill only tiny digital pinholes (<= 36px)
    const visited = new Uint8Array(TOTAL);
    const compQ = new Int32Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) {
      if (exteriorBg[i] === 0 && alpha[i] < 128 && visited[i] === 0) {
        let ch = 0;
        let ct = 0;
        let cSum = 0;
        visited[i] = 1;
        compQ[ct++] = i;
        while (ch < ct) {
          const curr = compQ[ch++];
          cSum += conf[curr];
          const cx = curr % W;
          const cy = (curr - cx) / W;
          const pushN = (n: number) => {
            if (exteriorBg[n] === 0 && alpha[n] < 128 && visited[n] === 0) {
              visited[n] = 1;
              compQ[ct++] = n;
            }
          };
          if (cx > 0) pushN(curr - 1);
          if (cx < W - 1) pushN(curr + 1);
          if (cy > 0) pushN(curr - W);
          if (cy < H - 1) pushN(curr + W);
        }
        if (ct <= 36 && cSum / ct >= 0.1) {
          for (let k = 0; k < ct; k++) alpha[compQ[k]] = 255;
        }
      }
    }

    // Remove tiny detached low-confidence floating specks
    const maxSpeckArea = Math.round(TOTAL * 0.002);
    visited.fill(0);
    for (let i = 0; i < TOTAL; i++) {
      if (alpha[i] > 0 && visited[i] === 0) {
        let ch = 0;
        let ct = 0;
        let peak = 0;
        visited[i] = 1;
        compQ[ct++] = i;
        while (ch < ct) {
          const curr = compQ[ch++];
          if (conf[curr] > peak) peak = conf[curr];
          const cx = curr % W;
          const cy = (curr - cx) / W;
          const pushFg = (n: number) => {
            if (alpha[n] > 0 && visited[n] === 0) {
              visited[n] = 1;
              compQ[ct++] = n;
            }
          };
          if (cx > 0) pushFg(curr - 1);
          if (cx < W - 1) pushFg(curr + 1);
          if (cy > 0) pushFg(curr - W);
          if (cy < H - 1) pushFg(curr + W);
        }
        if (ct <= maxSpeckArea && peak < 0.85) {
          for (let k = 0; k < ct; k++) alpha[compQ[k]] = 0;
        }
      }
    }

    return alpha;
  };

  const getServerRmbgSession = async () => {
    if (!serverRmbgSessionPromise) {
      serverRmbgSessionPromise = (async () => {
        const modelPath = await ensureRmbgModelPath();
        const ortMod = await import('onnxruntime-node');
        const ortNode = ortMod.default || ortMod;
        const cpuThreads = Math.max(2, os.cpus().length || 2);
        const sess = await ortNode.InferenceSession.create(modelPath, {
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
          intraOpNumThreads: cpuThreads,
          interOpNumThreads: 1,
          enableCpuMemArena: true,
          enableMemPattern: true,
        });
        serverRmbgReady = true;
        return { ortNode, sess };
      })().catch((err) => {
        serverRmbgSessionPromise = null;
        serverRmbgReady = false;
        throw err;
      });
    }
    return serverRmbgSessionPromise;
  };

  app.get('/api/remove-background/warm', (_req, res) => {
    void getServerRmbgSession().catch((err) => {
      console.warn('[/api/remove-background/warm] Prewarm failed:', err);
    });
    res.json({ ok: true, ready: serverRmbgReady });
  });

  app.post(
    '/api/remove-background',
    express.raw({
      type: ['image/jpeg', 'image/webp', 'image/png', 'application/octet-stream', 'application/x-gzip'],
      limit: '10mb',
    }),
    async (req, res) => {
      try {
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!rawBody.length) {
          return res.status(400).json({ error: 'Empty payload' });
        }

        const contentType = String(req.headers['content-type'] || '').toLowerCase();
        const isEncodedImage = contentType.startsWith('image/');
        const isGzip =
          req.headers['x-payload-encoding'] === 'gzip' ||
          contentType === 'application/x-gzip';

        let rgbBuf: Buffer;
        if (isEncodedImage) {
          try {
            rgbBuf = await decodeImageBufferToRgb1024(rawBody);
          } catch (err: any) {
            if (err?.code === 'ENOENT') {
              return res.status(501).json({ error: 'Image decoder unavailable', code: 'NO_DECODER' });
            }
            return res.status(400).json({ error: 'Invalid image payload' });
          }
        } else if (isGzip) {
          try {
            rgbBuf = zlib.gunzipSync(rawBody);
          } catch {
            return res.status(400).json({ error: 'Invalid compressed payload' });
          }
        } else {
          rgbBuf = rawBody;
        }

        const SIZE = 1024;
        const TOTAL = SIZE * SIZE;
        const EXPECTED_BYTES = TOTAL * 3;
        if (rgbBuf.byteLength !== EXPECTED_BYTES) {
          return res.status(400).json({
            error: `Expected ${EXPECTED_BYTES} RGB bytes, got ${rgbBuf.byteLength}`,
          });
        }

        const tensorData = new Float32Array(3 * TOTAL);
        const inv255 = 1 / 255;
        for (let i = 0; i < TOTAL; i++) {
          const p = i * 3;
          tensorData[i] = rgbBuf[p] * inv255 - 0.5;
          tensorData[TOTAL + i] = rgbBuf[p + 1] * inv255 - 0.5;
          tensorData[2 * TOTAL + i] = rgbBuf[p + 2] * inv255 - 0.5;
        }

        const wantFinalized = req.headers['x-accept-mask-finalized'] === '1';
        const wantGzipMask = req.headers['x-accept-mask-gzip'] === '1';

        const nextMaskPromise: Promise<Buffer> = serverRmbgQueue
          .catch(() => {})
          .then(async (): Promise<Buffer> => {
            const { ortNode, sess } = await getServerRmbgSession();
            const inputName = sess.inputNames[0] || 'input';
            const inputTensor = new ortNode.Tensor('float32', tensorData, [1, 3, SIZE, SIZE]);
            const outputs = await sess.run({ [inputName]: inputTensor });
            const rawOut = outputs[sess.outputNames[0]].data as Float32Array;

            if (wantFinalized) {
              return finalizeAlphaMask1024(rawOut);
            }

            let minVal = Infinity;
            let maxVal = -Infinity;
            for (let i = 0; i < TOTAL; i++) {
              const v = rawOut[i];
              if (v < minVal) minVal = v;
              if (v > maxVal) maxVal = v;
            }
            const span = maxVal - minVal;
            const outMask = Buffer.allocUnsafe(TOTAL);
            if (span > 1e-5) {
              for (let i = 0; i < TOTAL; i++) {
                const norm = Math.min(1, Math.max(0, (rawOut[i] - minVal) / span));
                outMask[i] = Math.round(norm * 255);
              }
            } else {
              for (let i = 0; i < TOTAL; i++) {
                const norm = Math.min(1, Math.max(0, rawOut[i]));
                outMask[i] = Math.round(norm * 255);
              }
            }
            return outMask;
          });
        serverRmbgQueue = nextMaskPromise;
        const maskBuffer = await nextMaskPromise;

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        if (wantFinalized) {
          res.setHeader('X-Mask-Finalized', '1');
        }
        if (wantGzipMask) {
          const gzMask = zlib.gzipSync(maskBuffer);
          res.setHeader('X-Mask-Encoding', 'gzip');
          return res.send(gzMask);
        }
        return res.send(maskBuffer);
      } catch (err: any) {
        console.error('[/api/remove-background] Inference failed:', err);
        return res.status(500).json({ error: err?.message || 'Background removal failed' });
      }
    }
  );

  const mediapipeWasmDir = fs.existsSync(path.resolve(__dirname, 'public/mediapipe-wasm'))
    ? path.resolve(__dirname, 'public/mediapipe-wasm')
    : path.resolve(__dirname, 'dist/mediapipe-wasm');
  if (fs.existsSync(mediapipeWasmDir)) {
    app.use(
      '/mediapipe-wasm',
      express.static(mediapipeWasmDir, {
        fallthrough: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          }
          res.setHeader('Cache-Control', 'public, max-age=86400');
        },
      }),
      (_req, res) => res.status(404).end()
    );
  }

  const mediapipeModelsDir = fs.existsSync(path.resolve(__dirname, 'public/mediapipe-models'))
    ? path.resolve(__dirname, 'public/mediapipe-models')
    : path.resolve(__dirname, 'dist/mediapipe-models');
  if (fs.existsSync(mediapipeModelsDir)) {
    app.use(
      '/mediapipe-models',
      express.static(mediapipeModelsDir, {
        fallthrough: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.tflite') || filePath.endsWith('.onnx')) {
            res.setHeader('Content-Type', 'application/octet-stream');
          }
          res.setHeader('Cache-Control', 'public, max-age=86400');
        },
      }),
      (_req, res) => res.status(404).end()
    );
  }

  const ortWasmDir = fs.existsSync(path.resolve(__dirname, 'public/ort-wasm'))
    ? path.resolve(__dirname, 'public/ort-wasm')
    : path.resolve(__dirname, 'dist/ort-wasm');
  if (fs.existsSync(ortWasmDir)) {
    app.use(
      '/ort-wasm',
      express.static(ortWasmDir, {
        fallthrough: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
          } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          }
          res.setHeader('Cache-Control', 'public, max-age=86400');
        },
      }),
      (_req, res) => res.status(404).end()
    );
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PixiForge server listening on http://0.0.0.0:${PORT}`);
    // Pre-warm native RMBG-1.4 AI session in background so first cutout is instant
    setTimeout(() => {
      void getServerRmbgSession().catch(() => {});
    }, 300);
  });
}

startServer();
