import { collection, deleteField, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, isFirestoreOfflineError, OperationType } from './firestoreService';

export interface SiteViewRecord {
  viewId: string;
  userId?: string;
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

const LOCAL_VIEWS_KEY = 'pixiforge_site_views_cache';
const VERIFIED_DEVICE_LOC_KEY = 'pixiforge_verified_device_loc';
let hasTrackedCurrentLoad = false;
let currentLoadView: SiteViewRecord | null = null;
let hasCreatedFirestoreDoc = false;
let lastSyncedSignature = '';

function readVerifiedDeviceLocation(): {
  country: string;
  state: string;
  dist: string;
  taluka: string;
} | null {
  try {
    const raw = localStorage.getItem(VERIFIED_DEVICE_LOC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.country && parsed?.state && parsed?.dist && parsed?.taluka) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveVerifiedDeviceLocation(loc: {
  country: string;
  state: string;
  dist: string;
  taluka: string;
}): void {
  try {
    localStorage.setItem(VERIFIED_DEVICE_LOC_KEY, JSON.stringify(loc));
  } catch {
    // ignore
  }
}

function cleanUnit(val: unknown): string {
  const s = String(val || '')
    .replace(/\s+(District|Dist\.?|Taluka|Taluk|Tehsil|Tahsil|Sub-district|Subdistrict|Division)$/i, '')
    .trim();
  if (!s || s.toLowerCase() === 'unknown') return '';
  return s.slice(0, 80);
}

function isBrokenUnknownView(v: Partial<SiteViewRecord> | null | undefined): boolean {
  if (!v) return true;
  return (
    (v.state === 'Unknown' || !v.state) &&
    (v.dist === 'Unknown' || !v.dist) &&
    (v.taluka === 'Unknown' || !v.taluka)
  );
}

function readLocalViews(): SiteViewRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_VIEWS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => v && typeof v.viewId === 'string' && !isBrokenUnknownView(v));
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function upsertLocalView(view: SiteViewRecord): void {
  if (isBrokenUnknownView(view)) return;
  try {
    const existing = readLocalViews();
    const idx = existing.findIndex((v) => v.viewId === view.viewId);
    let next: SiteViewRecord[];
    if (idx !== -1) {
      next = [...existing];
      next[idx] = view;
    } else {
      next = [view, ...existing].slice(0, 1000);
    }
    localStorage.setItem(LOCAL_VIEWS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export interface GeoResult {
  coords: { lat: number; lon: number; accuracy?: number } | null;
  errorCode?: 'unsupported' | 'permission_denied' | 'policy_blocked' | 'unavailable' | 'timeout';
  errorMessage?: string;
}

export function getBrowserCoordinatesDetailed(
  timeoutMs = 8000,
  enableHighAccuracy = true
): Promise<GeoResult> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ coords: null, errorCode: 'unsupported' });
  }
  return new Promise((resolve) => {
    let settled = false;
    let watchId: number | null = null;
    let bestReading: { lat: number; lon: number; accuracy: number } | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          // ignore
        }
        watchId = null;
      }
    };

    const finish = (result: GeoResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(result);
    };

    const timer = setTimeout(() => {
      if (bestReading) {
        finish({ coords: bestReading });
      } else {
        finish({ coords: null, errorCode: 'timeout' });
      }
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 999999;
          const candidate = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: acc,
          };
          if (!bestReading || candidate.accuracy < bestReading.accuracy) {
            bestReading = candidate;
          }
          // Stop immediately once we get a genuine GPS / accurate Wi-Fi fix (<= 1.2 km radius)
          if (acc <= 1200) {
            finish({ coords: bestReading });
          }
        },
        (err) => {
          if (bestReading) {
            finish({ coords: bestReading });
            return;
          }
          const msg = String(err?.message || '').toLowerCase();
          let errorCode: GeoResult['errorCode'] = 'unavailable';
          if (msg.includes('permissions policy') || msg.includes('feature policy')) {
            errorCode = 'policy_blocked';
          } else if (err?.code === 1) {
            errorCode = 'permission_denied';
          } else if (err?.code === 3) {
            errorCode = 'timeout';
          }
          finish({ coords: null, errorCode, errorMessage: err?.message });
        },
        {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: 0,
        }
      );
    } catch (e: any) {
      finish({ coords: null, errorCode: 'unavailable', errorMessage: e?.message });
    }
  });
}

export async function getBrowserCoordinates(
  timeoutMs = 8000,
  enableHighAccuracy = true
): Promise<{ lat: number; lon: number; accuracy?: number } | null> {
  const res = await getBrowserCoordinatesDetailed(timeoutMs, enableHighAccuracy);
  if (res.coords) return res.coords;
  if (
    enableHighAccuracy &&
    res.errorCode !== 'permission_denied' &&
    res.errorCode !== 'policy_blocked' &&
    res.errorCode !== 'unsupported'
  ) {
    const fallback = await getBrowserCoordinatesDetailed(5000, false);
    return fallback.coords;
  }
  return null;
}

/**
 * Browser-side reverse geocoding via BigDataCloud (browser-only free endpoint) + Photon fallback.
 * Returns only administrative levels: Country, State, District, Taluka.
 */
async function reverseGeocodeInBrowser(
  lat: number,
  lon: number
): Promise<{ country?: string; state?: string; dist?: string; taluka?: string }> {
  let country = '';
  let state = '';
  let dist = '';
  let taluka = '';

  // 1. BigDataCloud browser client reverse geocode (extracts adminLevel 2/4/5/6)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        lat.toFixed(3)
      )}&longitude=${encodeURIComponent(lon.toFixed(3))}&localityLanguage=en`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (bdcRes.ok) {
      const data = (await bdcRes.json()) as any;
      country = cleanUnit(data.countryName);
      state = cleanUnit(data.principalSubdivision);
      const admins: Array<{ name?: string; adminLevel?: number; description?: string }> =
        Array.isArray(data?.localityInfo?.administrative) ? data.localityInfo.administrative : [];

      const lvl5 = admins.find((a) => a.adminLevel === 5);
      const lvl6 = admins.find((a) => a.adminLevel === 6);
      const lvl7 = admins.find((a) => a.adminLevel === 7);

      dist = cleanUnit(lvl5?.name || data.city || data.locality);
      taluka = cleanUnit(lvl6?.name || lvl7?.name || data.locality || data.city || dist);
    }
  } catch {
    // Try Photon next
  }

  // 2. Photon fallback in browser if BigDataCloud missed district or taluka
  if (!country || !state || !dist || !taluka) {
    try {
      const phRes = await fetch(
        `https://photon.komoot.io/reverse?lat=${encodeURIComponent(
          lat.toFixed(3)
        )}&lon=${encodeURIComponent(lon.toFixed(3))}&lang=en`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (phRes.ok) {
        const ph = (await phRes.json()) as any;
        const props = ph?.features?.[0]?.properties || {};
        country = country || cleanUnit(props.country);
        state = state || cleanUnit(props.state);
        dist = dist || cleanUnit(props.county || props.city || props.district);
        taluka = taluka || cleanUnit(props.county || props.city || props.district || props.name);
      }
    } catch {
      // Ignore
    }
  }

  return {
    country: country || undefined,
    state: state || undefined,
    dist: dist || undefined,
    taluka: taluka || undefined,
  };
}

export async function syncCurrentViewToFirestore(userId: string): Promise<void> {
  if (!userId || !currentLoadView || !auth.currentUser || auth.currentUser.uid !== userId) {
    return;
  }
  if (isBrokenUnknownView(currentLoadView)) {
    return;
  }

  const currentSource: 'gps' | 'ip' | 'pincode' =
    currentLoadView.locationSource === 'pincode'
      ? 'pincode'
      : currentLoadView.locationSource === 'gps'
      ? 'gps'
      : 'ip';
  const acc =
    typeof currentLoadView.accuracyMeters === 'number' && Number.isFinite(currentLoadView.accuracyMeters)
      ? Math.round(currentLoadView.accuracyMeters)
      : undefined;
  const isCleared = Boolean(currentLoadView.locationCleared);
  const sig = `${currentLoadView.viewId}|${currentSource}|${currentLoadView.dist}|${currentLoadView.taluka}|${acc ?? ''}|${isCleared}`;

  if (sig === lastSyncedSignature) {
    return;
  }

  const viewId = currentLoadView.viewId;
  const path = `site_views/${viewId}`;
  const docRef = doc(db, 'site_views', viewId);
  const wasCreated = hasCreatedFirestoreDoc;
  hasCreatedFirestoreDoc = true;
  lastSyncedSignature = sig;

  try {
    if (!wasCreated) {
      await setDoc(docRef, {
        viewId,
        userId,
        country: currentLoadView.country.slice(0, 80),
        state: currentLoadView.state.slice(0, 80),
        dist: currentLoadView.dist.slice(0, 80),
        taluka: currentLoadView.taluka.slice(0, 80),
        pagePath: currentLoadView.pagePath.slice(0, 200),
        visitedAt: currentLoadView.visitedAt,
        locationSource: currentSource,
        locationCleared: isCleared,
        ...(acc !== undefined ? { accuracyMeters: acc } : {}),
      });
    } else {
      await updateDoc(docRef, {
        country: currentLoadView.country.slice(0, 80),
        state: currentLoadView.state.slice(0, 80),
        dist: currentLoadView.dist.slice(0, 80),
        taluka: currentLoadView.taluka.slice(0, 80),
        locationSource: currentSource,
        locationCleared: isCleared,
        accuracyMeters: acc !== undefined ? acc : deleteField(),
      });
    }
  } catch (err) {
    if (!isFirestoreOfflineError(err)) {
      handleFirestoreError(
        err,
        wasCreated ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  }
}

async function resolveWithServer(params: {
  viewId: string;
  pagePath: string;
  timeZone: string;
  coords: { lat: number; lon: number; accuracy?: number } | null;
  ipGeo?: { country?: string; state?: string; city?: string; lat?: number; lon?: number };
}): Promise<SiteViewRecord> {
  const isGps = Boolean(params.coords);
  const accuracyMeters =
    isGps && typeof params.coords?.accuracy === 'number' && Number.isFinite(params.coords.accuracy)
      ? Math.round(params.coords.accuracy)
      : undefined;

  let clientAdmin: { country?: string; state?: string; dist?: string; taluka?: string } = {};
  if (isGps && params.coords) {
    clientAdmin = await reverseGeocodeInBrowser(params.coords.lat, params.coords.lon);
  } else if (params.ipGeo?.lat !== undefined && params.ipGeo?.lon !== undefined) {
    clientAdmin = await reverseGeocodeInBrowser(params.ipGeo.lat, params.ipGeo.lon);
  }

  let resolvedView: SiteViewRecord = {
    viewId: params.viewId,
    country:
      clientAdmin.country ||
      params.ipGeo?.country ||
      (params.timeZone.includes('Kolkata') ? 'India' : 'Unknown'),
    state: clientAdmin.state || params.ipGeo?.state || 'Unknown',
    dist:
      clientAdmin.dist ||
      params.ipGeo?.city ||
      clientAdmin.state ||
      params.ipGeo?.state ||
      'Unknown',
    taluka:
      clientAdmin.taluka ||
      params.ipGeo?.city ||
      clientAdmin.dist ||
      'Unknown',
    pagePath: params.pagePath,
    visitedAt: currentLoadView?.visitedAt || new Date().toISOString(),
    locationSource: isGps ? 'gps' : 'ip',
    ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
  };

  try {
    const res = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        isGps && params.coords
          ? {
              viewId: params.viewId,
              pagePath: params.pagePath,
              timeZone: params.timeZone,
              lat: params.coords.lat,
              lon: params.coords.lon,
              locationSource: 'gps',
              accuracyMeters,
              country: clientAdmin.country,
              state: clientAdmin.state,
              dist: clientAdmin.dist,
              taluka: clientAdmin.taluka,
            }
          : {
              viewId: params.viewId,
              pagePath: params.pagePath,
              timeZone: params.timeZone,
              locationSource: 'ip',
              country: clientAdmin.country || params.ipGeo?.country,
              state: clientAdmin.state || params.ipGeo?.state,
              dist: clientAdmin.dist,
              taluka: clientAdmin.taluka,
              city: params.ipGeo?.city,
              lat: params.ipGeo?.lat,
              lon: params.ipGeo?.lon,
            }
      ),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.view && !isBrokenUnknownView(data.view)) {
        const srv = data.view as SiteViewRecord;
        resolvedView = {
          ...srv,
          country: srv.country !== 'Unknown' ? srv.country : resolvedView.country,
          state: srv.state !== 'Unknown' ? srv.state : resolvedView.state,
          dist: srv.dist !== 'Unknown' ? srv.dist : resolvedView.dist,
          taluka: srv.taluka !== 'Unknown' ? srv.taluka : resolvedView.taluka,
          ...(accuracyMeters !== undefined && srv.accuracyMeters === undefined ? { accuracyMeters } : {}),
        };
      }
    }
  } catch {
    // Keep resolvedView from browser reverse geocode / IP fallback
  }

  return resolvedView;
}

async function fetchClientIpFallback(): Promise<{
  country?: string;
  state?: string;
  city?: string;
  lat?: number;
  lon?: number;
}> {
  // 1. ipwho.is
  try {
    const r = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const j = (await r.json()) as any;
      if (j?.success !== false && j?.country) {
        return {
          country: cleanUnit(j.country) || undefined,
          state: cleanUnit(j.region) || undefined,
          city: cleanUnit(j.city) || undefined,
          lat: typeof j.latitude === 'number' ? j.latitude : undefined,
          lon: typeof j.longitude === 'number' ? j.longitude : undefined,
        };
      }
    }
  } catch {
    // try next
  }

  // 2. geojs.io
  try {
    const r = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const j = (await r.json()) as any;
      if (j?.country) {
        const latNum = Number(j.latitude);
        const lonNum = Number(j.longitude);
        return {
          country: cleanUnit(j.country) || undefined,
          state: cleanUnit(j.region) || undefined,
          city: cleanUnit(j.city) || undefined,
          lat: Number.isFinite(latNum) ? latNum : undefined,
          lon: Number.isFinite(lonNum) ? lonNum : undefined,
        };
      }
    }
  } catch {
    // try next
  }

  // 3. ipinfo.io
  try {
    const r = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const j = (await r.json()) as any;
      if (j?.country || j?.city) {
        const [latStr, lonStr] = String(j.loc || '').split(',');
        const latNum = Number(latStr);
        const lonNum = Number(lonStr);
        return {
          country: cleanUnit(j.country === 'IN' ? 'India' : j.country) || undefined,
          state: cleanUnit(j.region) || undefined,
          city: cleanUnit(j.city) || undefined,
          lat: Number.isFinite(latNum) ? latNum : undefined,
          lon: Number.isFinite(lonNum) ? lonNum : undefined,
        };
      }
    }
  } catch {
    // try next
  }

  // 4. freeipapi.com
  try {
    const r = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const j = (await r.json()) as any;
      if (j?.countryName) {
        return {
          country: cleanUnit(j.countryName) || undefined,
          state: cleanUnit(j.regionName) || undefined,
          city: cleanUnit(j.cityName) || undefined,
          lat: typeof j.latitude === 'number' ? j.latitude : undefined,
          lon: typeof j.longitude === 'number' ? j.longitude : undefined,
        };
      }
    }
  } catch {
    // ignore
  }

  return {};
}

/**
 * Tracks a single website load once (preventing React StrictMode duplicate counts).
 * Prefers exact device geolocation (browser GPS/Wi-Fi) to resolve Country, State, District, Taluka,
 * falling back to multi-provider IP lookup if blocked, and upgrading the same visit if permission is granted moments later.
 */
export async function trackWebsiteVisit(pagePath: string): Promise<void> {
  if (hasTrackedCurrentLoad) return;
  hasTrackedCurrentLoad = true;

  const viewId = `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanPath = (pagePath || '/').split('?')[0].slice(0, 200) || '/';
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '';

  const fullGeoPromise = getBrowserCoordinates(9000, true);

  // Give browser high-accuracy geolocation up to 3s before falling back to IP
  const quickCoords = await Promise.race([
    fullGeoPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);

  const verifiedDevice = readVerifiedDeviceLocation();

  if (quickCoords) {
    const isCoarseLaptopReading =
      typeof quickCoords.accuracy === 'number' && quickCoords.accuracy > 5000;

    if (isCoarseLaptopReading && verifiedDevice) {
      const pinRes = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          viewId,
          pagePath: cleanPath,
          locationSource: 'pincode',
          ...verifiedDevice,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const pinView: SiteViewRecord = pinRes?.view || {
        viewId,
        ...verifiedDevice,
        pagePath: cleanPath,
        visitedAt: new Date().toISOString(),
        locationSource: 'pincode',
      };
      currentLoadView = pinView;
      upsertLocalView(pinView);
      if (auth.currentUser?.uid) {
        await syncCurrentViewToFirestore(auth.currentUser.uid);
      }
      return;
    }

    const gpsView = await resolveWithServer({
      viewId,
      pagePath: cleanPath,
      timeZone,
      coords: quickCoords,
    });
    currentLoadView = gpsView;
    upsertLocalView(gpsView);
    if (auth.currentUser?.uid) {
      await syncCurrentViewToFirestore(auth.currentUser.uid);
    }
    return;
  }

  // If browser geolocation was blocked/timed out and this laptop already verified its Pincode, use it instead of ISP IP
  if (verifiedDevice) {
    const pinRes = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        viewId,
        pagePath: cleanPath,
        locationSource: 'pincode',
        ...verifiedDevice,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const pinView: SiteViewRecord = pinRes?.view || {
      viewId,
      ...verifiedDevice,
      pagePath: cleanPath,
      visitedAt: new Date().toISOString(),
      locationSource: 'pincode',
    };
    currentLoadView = pinView;
    upsertLocalView(pinView);
    if (auth.currentUser?.uid) {
      await syncCurrentViewToFirestore(auth.currentUser.uid);
    }
    return;
  }

  // Fallback to multi-provider IP first while continuing to wait for user's location prompt response
  const ipGeo = await fetchClientIpFallback();
  const ipView = await resolveWithServer({
    viewId,
    pagePath: cleanPath,
    timeZone,
    coords: null,
    ipGeo,
  });

  if (!currentLoadView || (currentLoadView.locationSource !== 'gps' && currentLoadView.locationSource !== 'pincode')) {
    currentLoadView = ipView;
    upsertLocalView(ipView);
    if (auth.currentUser?.uid) {
      await syncCurrentViewToFirestore(auth.currentUser.uid);
    }
  }

  // If the user clicks "Allow" on the location prompt after 3s, immediately upgrade the visit record
  const delayedCoords = await fullGeoPromise;
  if (delayedCoords) {
    const isCoarseLaptopReading =
      typeof delayedCoords.accuracy === 'number' && delayedCoords.accuracy > 5000;
    if (isCoarseLaptopReading && verifiedDevice) {
      return;
    }
    const upgradedView = await resolveWithServer({
      viewId,
      pagePath: cleanPath,
      timeZone,
      coords: delayedCoords,
    });
    currentLoadView = upgradedView;
    upsertLocalView(upgradedView);
    if (auth.currentUser?.uid) {
      await syncCurrentViewToFirestore(auth.currentUser.uid);
    }
  }
}

/**
 * Resolves exact Country, State, District & Taluka from a 6-digit Pincode (ideal for laptops without GPS)
 * and remembers it for future visits on this same non-GPS browser.
 */
export async function verifyLocationByPincode(rawPincode: string): Promise<{
  ok: boolean;
  view?: SiteViewRecord;
  error?: string;
}> {
  const code = rawPincode.trim().replace(/\s+/g, '');
  if (!/^[1-9]\d{5}$/.test(code)) {
    return { ok: false, error: 'Please enter a valid 6-digit Indian Pincode (e.g. 416602).' };
  }

  const viewId =
    currentLoadView?.viewId || `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanPath =
    currentLoadView?.pagePath || (window.location.pathname || '/').split('?')[0].slice(0, 200) || '/';

  try {
    const res = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        viewId,
        pagePath: cleanPath,
        locationSource: 'pincode',
        postalCode: code,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !data?.view) {
      return {
        ok: false,
        error: data?.error || 'Could not resolve District & Taluka for this Pincode.',
      };
    }

    const view: SiteViewRecord = {
      ...(data.view as SiteViewRecord),
      locationCleared: false,
    };
    saveVerifiedDeviceLocation({
      country: view.country,
      state: view.state,
      dist: view.dist,
      taluka: view.taluka,
    });

    currentLoadView = view;
    upsertLocalView(view);
    if (auth.currentUser?.uid) {
      await syncCurrentViewToFirestore(auth.currentUser.uid);
    }

    return { ok: true, view };
  } catch {
    return {
      ok: false,
      error: 'Failed to look up Pincode. Please check your internet connection.',
    };
  }
}

/**
 * Triggered explicitly by user click in Admin Analyst view to verify exact District & Taluka
 * using browser Wi-Fi/GPS location (never stores coordinates or street address).
 */
export async function verifyCurrentDeviceLocation(): Promise<{
  ok: boolean;
  view?: SiteViewRecord;
  accuracyMeters?: number;
  error?: string;
}> {
  // Always request high-accuracy GPS/Wi-Fi first (maximumAge: 0) so we don't get a coarse 50km cell-tower estimate
  let geo = await getBrowserCoordinatesDetailed(8500, true);
  if (!geo.coords && geo.errorCode !== 'permission_denied' && geo.errorCode !== 'policy_blocked') {
    geo = await getBrowserCoordinatesDetailed(6000, false);
  }

  if (!geo.coords) {
    let errorMsg =
      'Location permission was denied or unavailable. Enter your 6-digit Pincode (e.g. 416602) to verify your laptop location.';
    if (geo.errorCode === 'policy_blocked') {
      errorMsg =
        'This embedded preview iframe blocks browser GPS permission. Enter your 6-digit Pincode (e.g. 416602) or open the app URL in a new tab.';
    } else if (geo.errorCode === 'permission_denied') {
      errorMsg =
        'Browser location permission is blocked. Allow Location in the address bar OR verify using your 6-digit Pincode (e.g. 416602).';
    }
    return {
      ok: false,
      error: errorMsg,
    };
  }

  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      : '';
  const viewId =
    currentLoadView?.viewId || `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cleanPath =
    currentLoadView?.pagePath || (window.location.pathname || '/').split('?')[0].slice(0, 200) || '/';

  const upgradedView: SiteViewRecord = {
    ...(await resolveWithServer({
      viewId,
      pagePath: cleanPath,
      timeZone,
      coords: geo.coords,
    })),
    locationCleared: false,
  };

  currentLoadView = upgradedView;
  upsertLocalView(upgradedView);
  if (auth.currentUser?.uid) {
    await syncCurrentViewToFirestore(auth.currentUser.uid);
  }

  return {
    ok: true,
    view: upgradedView,
    accuracyMeters:
      typeof geo.coords.accuracy === 'number' ? Math.round(geo.coords.accuracy) : undefined,
  };
}

/**
 * Fetches all website visit records for the Admin Analyst dashboard
 * by merging Firestore /site_views, backend /api/analytics/views, and local cache.
 */
export async function fetchAllWebsiteViews(adminEmail?: string): Promise<SiteViewRecord[]> {
  const mergedMap = new Map<string, SiteViewRecord>();

  const addRecord = (rec: SiteViewRecord) => {
    if (!rec?.viewId || !rec?.visitedAt || isBrokenUnknownView(rec)) return;
    const prev = mergedMap.get(rec.viewId);
    if (!prev) {
      mergedMap.set(rec.viewId, rec);
      return;
    }
    if (rec.locationCleared && !prev.locationCleared) {
      mergedMap.set(rec.viewId, rec);
      return;
    }
    if (!rec.locationCleared && prev.locationCleared) {
      return;
    }
    const rank = (r: SiteViewRecord) =>
      r.locationSource === 'pincode'
        ? 3
        : r.locationSource === 'gps' && (r.accuracyMeters === undefined || r.accuracyMeters <= 5000)
        ? 3
        : r.locationSource === 'gps'
        ? 2
        : 1;
    if (rank(rec) > rank(prev) || (prev.country === 'Unknown' && rec.country !== 'Unknown')) {
      mergedMap.set(rec.viewId, rec);
    }
  };

  // 1. Local cache
  for (const lv of readLocalViews()) {
    addRecord(lv);
  }

  // 2. Backend analytics store (captures guest & signed-in visits)
  if (adminEmail) {
    try {
      const res = await fetch('/api/analytics/views', {
        headers: { 'x-admin-email': adminEmail },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.views)) {
          for (const sv of data.views as SiteViewRecord[]) {
            addRecord(sv);
          }
        }
      }
    } catch {
      // Ignore transient API error
    }
  }

  // 3. Cloud Firestore /site_views (Admin only per firestore.rules)
  if (auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, 'site_views'));
      snap.forEach((docSnap) => {
        const d = docSnap.data() as SiteViewRecord;
        addRecord({ ...d, viewId: d.viewId || docSnap.id });
      });
    } catch (err) {
      if (!isFirestoreOfflineError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'site_views');
      }
    }
  }

  return Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime()
  );
}

/**
 * Clears all stored visitor location logs while preserving Website Views & graph counts.
 */
export async function clearAllLocationLogs(adminEmail?: string): Promise<void> {
  try {
    const existing = readLocalViews();
    const clearedLocal = existing.map((v) => {
      const next: SiteViewRecord = {
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
    localStorage.setItem(LOCAL_VIEWS_KEY, JSON.stringify(clearedLocal));
  } catch {
    // ignore
  }

  if (currentLoadView) {
    currentLoadView = {
      ...currentLoadView,
      country: 'Cleared',
      state: 'Cleared',
      dist: 'Cleared',
      taluka: 'Cleared',
      locationCleared: true,
    };
    delete currentLoadView.accuracyMeters;
  }
  lastSyncedSignature = '';

  if (adminEmail) {
    try {
      await fetch('/api/analytics/views', {
        method: 'DELETE',
        headers: { 'x-admin-email': adminEmail },
      });
    } catch {
      // ignore
    }
  }

  if (auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, 'site_views'));
      const docsToClear = snap.docs.filter((docSnap) => {
        const d = docSnap.data() as Partial<SiteViewRecord>;
        return !d.locationCleared || d.country !== 'Cleared';
      });
      await Promise.all(
        docsToClear.map((docSnap) =>
          updateDoc(doc(db, 'site_views', docSnap.id), {
            country: 'Cleared',
            state: 'Cleared',
            dist: 'Cleared',
            taluka: 'Cleared',
            locationCleared: true,
            accuracyMeters: deleteField(),
          })
        )
      );
    } catch (err) {
      if (!isFirestoreOfflineError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, 'site_views');
      }
    }
  }
}

export const clearAllWebsiteViews = clearAllLocationLogs;
