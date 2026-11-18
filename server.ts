import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

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
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
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

  // Server-side OTP email delivery via Brevo using env variables
  app.post('/api/email/send-otp', async (req, res) => {
    try {
      const { toEmail, otpCode, purpose } = req.body || {};
      const cleanTo = String(toEmail || '').trim();
      const cleanOtp = String(otpCode || '').trim();
      if (!cleanTo || !cleanOtp) {
        return res.status(400).json({ success: false, error: 'Recipient email and OTP code are required.' });
      }

      const brevoApiKey = (process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || '').trim();
      const { ADMIN_EMAIL, SUPPORT_EMAIL } = getPublicRuntimeEnv();
      const senderEmail = (
        process.env.SENDER_EMAIL ||
        process.env.VITE_SENDER_EMAIL ||
        SUPPORT_EMAIL ||
        ADMIN_EMAIL
      ).trim();

      if (!brevoApiKey || !senderEmail) {
        return res.status(503).json({
          success: false,
          error: 'Email service is not configured. Set BREVO_API_KEY and ADMIN_EMAIL/SUPPORT_EMAIL in environment variables.',
        });
      }

      const subject =
        purpose === 'forgot'
          ? `PixiForge - Password Reset OTP: ${cleanOtp}`
          : `PixiForge - Your 6-Digit Email Verification Code: ${cleanOtp}`;

      const htmlContent = `
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
                    ? 'We received a request to reset your PixiForge password. Please enter the 6-digit verification code below:'
                    : 'Thank you for signing up with PixiForge. Please verify your email address by entering the 6-digit OTP code below:'
                }
              </p>
              <div style="background:#f8fafc;border:2px dashed #3b82f6;border-radius:16px;padding:24px;text-align:center;margin:0 0 24px 0;">
                <div style="font-size:11px;text-transform:uppercase;font-weight:800;color:#2563eb;letter-spacing:1px;margin-bottom:8px;">Your One-Time Password (OTP)</div>
                <div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e3a8a;">${escapeServerHtml(cleanOtp)}</div>
                <div style="font-size:12px;font-weight:600;color:#64748b;margin-top:8px;">⏱️ Valid for 5 minutes</div>
              </div>
              <p style="font-size:12px;color:#94a3b8;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:20px;margin:0;">
                ⚠️ Never share this code with anyone. If you did not make this request, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'PixiForge Verification', email: senderEmail },
          to: [{ email: cleanTo }],
          subject,
          htmlContent,
        }),
      });

      const data = (await brevoRes.json().catch(() => ({}))) as any;
      if (brevoRes.ok) {
        return res.json({ success: true, messageId: data.messageId });
      }
      return res.status(brevoRes.status).json({
        success: false,
        error: data.message || `Email gateway error (Status ${brevoRes.status})`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to dispatch OTP email',
      });
    }
  });

  // Server-side Help complaint email delivery via Brevo to configured SUPPORT_EMAIL / ADMIN_EMAIL
  app.post('/api/email/send-complaint', async (req, res) => {
    try {
      const { ticketId, name, email, phone, category, subject, message, userPlan } = req.body || {};
      const brevoApiKey = (process.env.BREVO_API_KEY || process.env.VITE_BREVO_API_KEY || '').trim();
      const { ADMIN_EMAIL, SUPPORT_EMAIL } = getPublicRuntimeEnv();
      const targetEmail = (SUPPORT_EMAIL || ADMIN_EMAIL).trim();
      const senderEmail = (
        process.env.SENDER_EMAIL ||
        process.env.VITE_SENDER_EMAIL ||
        targetEmail
      ).trim();

      if (!targetEmail) {
        return res.status(503).json({
          success: false,
          error: 'Support email is not configured in environment variables (SUPPORT_EMAIL / ADMIN_EMAIL).',
        });
      }

      if (!brevoApiKey) {
        return res.status(503).json({
          success: false,
          error: `Email gateway API key is not configured. Use "Send via Gmail" below to email ${targetEmail} directly.`,
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

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'PixiForge Support Desk', email: senderEmail },
          to: [{ email: targetEmail, name: 'PixiForge Support' }],
          replyTo: { email: String(email || '').trim(), name: String(name || '').trim() },
          subject: emailSubject,
          htmlContent,
        }),
      });

      const data = (await brevoRes.json().catch(() => ({}))) as any;
      if (brevoRes.ok) {
        return res.json({ success: true, messageId: data.messageId });
      }
      return res.status(brevoRes.status).json({
        success: false,
        error: data.message || `Email gateway error (Status ${brevoRes.status})`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to connect to email gateway',
      });
    }
  });

  // Server-side Razorpay Pro-Rata Refund endpoint
  app.post('/api/refund', async (req, res) => {
    try {
      const {
        paymentId,
        refundAmountINR,
        plan,
        billingCycle,
        userId,
        userEmail,
        daysUsed,
        totalDays,
      } = req.body || {};

      const numericRefund = Number(refundAmountINR);
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
        const amountPaise = Math.round(numericRefund * 100);

        const rzpResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${authHeader}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: amountPaise,
              speed: 'optimum',
              notes: {
                reason: 'Pro-rata membership cancellation',
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

        return res.json({
          success: true,
          mode: 'razorpay_api',
          refundId: rzpData.id || `rfnd_${Date.now()}`,
          status: rzpData.status || 'processed',
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

  // Cache created Razorpay Plan IDs per key/tier/cycle/amount to avoid duplicate plan creation on every checkout
  const cachedRazorpayPlans = new Map<string, string>();

  // Server-side Razorpay Standard One-Time Order creation endpoint (No AutoPay / No Mandate fees)
  app.post('/api/order/create', async (req, res) => {
    try {
      const { plan, billingCycle, amountINR, userId, userEmail, userName } = req.body || {};
      const numericAmount = Number(amountINR);
      if (!plan || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan or order amount.',
        });
      }

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      if (!hasValidLiveCreds) {
        return res.json({
          success: true,
          mode: 'client_direct_checkout',
          orderId: null,
          keyId: keyId || undefined,
        });
      }

      const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const amountPaise = Math.round(numericAmount * 100);
      const receipt = `pf_${String(plan).slice(0, 6)}_${Date.now()}`.slice(0, 40);

      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          payment_capture: 1,
          notes: {
            plan: String(plan),
            billingCycle: String(billingCycle || 'monthly'),
            autoPay: 'disabled',
            userId: String(userId || ''),
            userEmail: String(userEmail || ''),
            userName: String(userName || ''),
          },
        }),
      });

      const orderData = (await orderRes.json().catch(() => ({}))) as any;
      if (!orderRes.ok || !orderData?.id) {
        return res.json({
          success: true,
          mode: 'client_direct_checkout',
          orderId: null,
          keyId,
          warning: orderData?.error?.description || 'Razorpay Order creation skipped; using direct checkout.',
        });
      }

      return res.json({
        success: true,
        mode: 'razorpay_order',
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
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

      if (!hasValidSecret || !razorpay_signature) {
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

  // Server-side Razorpay AutoPay Subscription creation endpoint (UPI AutoPay / Card e-Mandate)
  app.post('/api/subscription/create', async (req, res) => {
    try {
      const { plan, billingCycle, amountINR, userId, userEmail, userName } = req.body || {};
      const numericAmount = Number(amountINR);
      if (!plan || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid plan or subscription amount.',
        });
      }

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      const hasValidLiveCreds =
        Boolean(keyId) &&
        Boolean(keySecret) &&
        keyId !== 'rzp_test_1DP5mmOlF5G5ag';

      // Guard: Razorpay Subscriptions / AutoPay Mandate on very low amounts (< ₹5, e.g. ₹1)
      // triggers auth-token reversals and gateway/mandate + GST charges directly from merchant balance.
      if (numericAmount < 5) {
        return res.json({
          success: true,
          mode: 'low_amount_one_time_guard',
          subscriptionId: null,
          keyId: hasValidLiveCreds ? keyId : undefined,
          warning:
            '₹5 पेक्षा कमी रकमेवर (उदा. ₹1) Razorpay AutoPay Mandate शुल्क मर्चंट खात्यातून कट होते, त्यामुळे One-Time Payment वापरले जात आहे.',
        });
      }

      if (!hasValidLiveCreds) {
        // Fallback when server secret is not yet added: client proceeds with Checkout + AutoPay preference saved
        return res.json({
          success: true,
          mode: 'checkout_with_autopay_preference',
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
      const amountPaise = Math.round(numericAmount * 100);
      const planCacheKey = `${keyId}_${String(plan)}_${cycleKey}_${amountPaise}`;

      // Step 1: Reuse cached Razorpay Plan ID or create once for this tier + cycle + amount
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
              name: `PixiForge ${String(plan).toUpperCase()} (${cycleKey})`,
              amount: amountPaise,
              currency: 'INR',
              description: `PixiForge ${String(plan).toUpperCase()} AutoPay Membership`,
            },
            notes: {
              plan: String(plan),
              billingCycle: cycleKey,
            },
          }),
        });

        const planData = (await planRes.json().catch(() => ({}))) as any;
        if (!planRes.ok || !planData?.id) {
          return res.json({
            success: true,
            mode: 'checkout_with_autopay_preference',
            subscriptionId: null,
            keyId,
            warning: planData?.error?.description || 'Razorpay Plan creation skipped; using standard checkout.',
          });
        }
        razorpayPlanId = planData.id;
        cachedRazorpayPlans.set(planCacheKey, razorpayPlanId);
      }

      // Step 2: Create Razorpay Subscription to launch UPI AutoPay / Card Recurring Mandate
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
          subscriptionId: null,
          keyId,
          warning: subData?.error?.description || 'Razorpay Subscription creation skipped.',
        });
      }

      return res.json({
        success: true,
        mode: 'razorpay_subscription',
        subscriptionId: subData.id,
        planId: razorpayPlanId,
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
  });
}

startServer();
