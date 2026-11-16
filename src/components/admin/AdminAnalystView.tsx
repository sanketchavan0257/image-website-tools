import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Eye,
  MapPin,
  Calendar,
  Clock,
  RefreshCw,
  Search,
  Globe,
  LocateFixed,
  Trash2,
  Info,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  fetchAllWebsiteViews,
  verifyCurrentDeviceLocation,
  verifyLocationByPincode,
  clearAllLocationLogs,
  SiteViewRecord,
} from '../../services/analyticsService';
import { getConfiguredAdminEmail } from '../../store/useAuthStore';

type TimeRange = '1m' | '3m' | '6m' | '9m' | '1y';

const LOCATIONS_PER_PAGE = 6;

const TIME_RANGES: { id: TimeRange; label: string; months: number }[] = [
  { id: '1m', label: '1 Month', months: 1 },
  { id: '3m', label: '3 Months', months: 3 },
  { id: '6m', label: '6 Months', months: 6 },
  { id: '9m', label: '9 Months', months: 9 },
  { id: '1y', label: 'Year', months: 12 },
];

interface GraphBucket {
  key: string;
  label: string;
  fullLabel: string;
  count: number;
  showAxisLabel: boolean;
}

function getCutoffDate(range: TimeRange, now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (range === '1m') {
    d.setDate(d.getDate() - 29);
  } else if (range === '3m') {
    d.setDate(d.getDate() - 83); // 12 weeks
  } else if (range === '6m') {
    d.setMonth(d.getMonth() - 5, 1);
  } else if (range === '9m') {
    d.setMonth(d.getMonth() - 8, 1);
  } else {
    d.setMonth(d.getMonth() - 11, 1);
  }
  return d;
}

function buildGraphBuckets(views: SiteViewRecord[], range: TimeRange, now: Date): GraphBucket[] {
  if (range === '1m') {
    const days: GraphBucket[] = [];
    const map = new Map<string, number>();

    for (let i = 29; i >= 0; i--) {
      const dt = new Date(now);
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - i);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate()
      ).padStart(2, '0')}`;
      map.set(key, 0);
      const shortDate = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      days.push({
        key,
        label: shortDate,
        fullLabel: dt.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        count: 0,
        showAxisLabel: i === 29 || i === 22 || i === 15 || i === 8 || i === 0,
      });
    }

    for (const v of views) {
      const vd = new Date(v.visitedAt);
      if (Number.isNaN(vd.getTime())) continue;
      const key = `${vd.getFullYear()}-${String(vd.getMonth() + 1).padStart(2, '0')}-${String(
        vd.getDate()
      ).padStart(2, '0')}`;
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    }

    return days.map((b) => ({ ...b, count: map.get(b.key) || 0 }));
  }

  if (range === '3m') {
    const weeks: { start: Date; end: Date; bucket: GraphBucket }[] = [];
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    for (let w = 11; w >= 0; w--) {
      const wEnd = new Date(endToday);
      wEnd.setDate(wEnd.getDate() - w * 7);
      const wStart = new Date(wEnd);
      wStart.setDate(wStart.getDate() - 6);
      wStart.setHours(0, 0, 0, 0);

      const startLabel = wStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const endLabel = wEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      weeks.push({
        start: wStart,
        end: wEnd,
        bucket: {
          key: `w_${w}`,
          label: startLabel,
          fullLabel: `${startLabel} – ${endLabel}`,
          count: 0,
          showAxisLabel: w === 11 || w === 8 || w === 5 || w === 2 || w === 0,
        },
      });
    }

    for (const v of views) {
      const t = new Date(v.visitedAt).getTime();
      if (Number.isNaN(t)) continue;
      for (const item of weeks) {
        if (t >= item.start.getTime() && t <= item.end.getTime()) {
          item.bucket.count += 1;
          break;
        }
      }
    }

    return weeks.map((w) => w.bucket);
  }

  // Monthly bars for 6m, 9m, 1y
  const monthCount = range === '6m' ? 6 : range === '9m' ? 9 : 12;
  const months: GraphBucket[] = [];
  const monthMap = new Map<string, number>();

  for (let m = monthCount - 1; m >= 0; m--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, 0);
    months.push({
      key,
      label: dt.toLocaleDateString('en-IN', { month: 'short' }),
      fullLabel: dt.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      count: 0,
      showAxisLabel: true,
    });
  }

  for (const v of views) {
    const vd = new Date(v.visitedAt);
    if (Number.isNaN(vd.getTime())) continue;
    const key = `${vd.getFullYear()}-${String(vd.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
  }

  return months.map((b) => ({ ...b, count: monthMap.get(b.key) || 0 }));
}

export const AdminAnalystView: React.FC = () => {
  const [views, setViews] = useState<SiteViewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLoc, setIsDetectingLoc] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pincodeInput, setPincodeInput] = useState('');
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<TimeRange>('1y');
  const [locationQuery, setLocationQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredBucket, setHoveredBucket] = useState<GraphBucket | null>(null);

  const loadViews = useCallback(async () => {
    setIsLoading(true);
    try {
      const adminEmail = getConfiguredAdminEmail();
      const data = await fetchAllWebsiteViews(adminEmail);
      setViews(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDetectExactLocation = async () => {
    setIsDetectingLoc(true);
    setLocationNotice(null);
    try {
      const res = await verifyCurrentDeviceLocation();
      if (res.ok && res.view) {
        const acc = res.accuracyMeters;
        if (acc !== undefined && acc > 5000) {
          const km = Math.round(acc / 1000);
          setLocationNotice(
            `Detected: ${res.view.country}, ${res.view.state}, District: ${res.view.dist}, Taluka: ${res.view.taluka} (±${km} km coarse laptop/network estimate). Since laptops lack GPS, enter your 6-digit Pincode (e.g. 416602) to verify your exact District & Taluka.`
          );
        } else {
          const accText = acc !== undefined ? ` (±${acc} m)` : '';
          setLocationNotice(
            `Exact location verified${accText}: ${res.view.country}, ${res.view.state}, District: ${res.view.dist}, Taluka: ${res.view.taluka}`
          );
        }
        await loadViews();
      } else {
        setLocationNotice(res.error || 'Could not verify browser location.');
      }
    } finally {
      setIsDetectingLoc(false);
    }
  };

  const handleVerifyPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pincodeInput.trim()) return;
    setIsVerifyingPin(true);
    setLocationNotice(null);
    try {
      const res = await verifyLocationByPincode(pincodeInput);
      if (res.ok && res.view) {
        setLocationNotice(
          `Verified via Pincode: ${res.view.country}, ${res.view.state}, District: ${res.view.dist}, Taluka: ${res.view.taluka}`
        );
        setPincodeInput('');
        await loadViews();
      } else {
        setLocationNotice(res.error || 'Could not verify Pincode.');
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const confirmClearLogs = async () => {
    setIsClearingLogs(true);
    setLocationNotice(null);
    try {
      const adminEmail = getConfiguredAdminEmail();
      await clearAllLocationLogs(adminEmail);
      setViews((prev) =>
        prev.map((v) => {
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
        })
      );
      setCurrentPage(1);
      setShowClearConfirm(false);
      setLocationNotice(
        'All visitor location logs deleted. Website Views count and graph are preserved.'
      );
    } finally {
      setIsClearingLogs(false);
    }
  };

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRange, locationQuery]);

  useEffect(() => {
    if (!showClearConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isClearingLogs) {
        setShowClearConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showClearConfirm, isClearingLogs]);

  const now = useMemo(() => new Date(), [views, selectedRange]);
  const cutoffMs = useMemo(() => getCutoffDate(selectedRange, now).getTime(), [selectedRange, now]);

  const viewsInRange = useMemo(() => {
    return views.filter((v) => {
      const t = new Date(v.visitedAt).getTime();
      return !Number.isNaN(t) && t >= cutoffMs;
    });
  }, [views, cutoffMs]);

  const buckets = useMemo(
    () => buildGraphBuckets(viewsInRange, selectedRange, now),
    [viewsInRange, selectedRange, now]
  );

  const maxBucketCount = useMemo(() => {
    const highest = Math.max(0, ...buckets.map((b) => b.count));
    if (highest <= 4) return 4;
    if (highest <= 10) return Math.ceil(highest / 2) * 2;
    return Math.ceil(highest * 1.15);
  }, [buckets]);

  const locationLogs = useMemo(() => {
    return views.filter((v) => !v.locationCleared && v.country !== 'Cleared');
  }, [views]);

  const locationLogsInRange = useMemo(() => {
    return viewsInRange.filter((v) => !v.locationCleared && v.country !== 'Cleared');
  }, [viewsInRange]);

  const filteredLocations = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    if (!q) return locationLogsInRange;
    return locationLogsInRange.filter(
      (v) =>
        v.country.toLowerCase().includes(q) ||
        v.state.toLowerCase().includes(q) ||
        v.dist.toLowerCase().includes(q) ||
        v.taluka.toLowerCase().includes(q)
    );
  }, [locationLogsInRange, locationQuery]);

  const totalLocationPages = Math.max(
    1,
    Math.ceil(filteredLocations.length / LOCATIONS_PER_PAGE)
  );
  const safeCurrentPage = Math.min(currentPage, totalLocationPages);
  const pageStartIndex = (safeCurrentPage - 1) * LOCATIONS_PER_PAGE;
  const paginatedLocations = useMemo(
    () =>
      filteredLocations.slice(
        pageStartIndex,
        pageStartIndex + LOCATIONS_PER_PAGE
      ),
    [filteredLocations, pageStartIndex]
  );

  const activeRangeLabel =
    TIME_RANGES.find((r) => r.id === selectedRange)?.label || 'Year';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Website Views Bar Graph Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 sm:p-7 space-y-6">
        {/* Card Header: Top-Left Eye Icon + Views Count | Top-Right Timeframe Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Top-Left: Eye Icon & Website Views Count */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {viewsInRange.length.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-600">
                  Website Views ({activeRangeLabel})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All-time recorded views: <strong className="text-slate-700">{views.length.toLocaleString('en-IN')}</strong>
                {hoveredBucket ? (
                  <span className="ml-2 text-indigo-700 font-bold">
                    • {hoveredBucket.fullLabel}: {hoveredBucket.count} views
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {/* Top-Right Corner: 1 Month, 3 Months, 6 Months, 9 Months, Year Selector + Refresh */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div
              role="tablist"
              aria-label="Analytics timeframe"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200/80"
            >
              {TIME_RANGES.map((range) => {
                const isSelected = selectedRange === range.id;
                return (
                  <button
                    key={range.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedRange(range.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-200/70'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={isLoading}
              onClick={loadViews}
              title="Refresh Analytics"
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bar Graph Canvas */}
        <div className="pt-3">
          <div className="flex gap-3">
            {/* Y-Axis Scale Labels */}
            <div className="w-8 sm:w-10 h-56 flex flex-col justify-between items-end pr-1 text-[10px] font-bold text-slate-400 select-none">
              <span>{maxBucketCount}</span>
              <span>{Math.round(maxBucketCount / 2)}</span>
              <span>0</span>
            </div>

            {/* Bars Plot Area */}
            <div className="flex-1 min-w-0">
              <div className="relative h-56 border-b border-slate-200 flex items-end gap-1 sm:gap-2 px-1">
                {/* Horizontal Dashed Gridlines */}
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-200/80 pointer-events-none" />
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200/80 pointer-events-none" />

                {buckets.map((bucket) => {
                  const pct = maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0;
                  const showInlineCount = buckets.length <= 12 && bucket.count > 0;

                  return (
                    <div
                      key={bucket.key}
                      onMouseEnter={() => setHoveredBucket(bucket)}
                      onMouseLeave={() => setHoveredBucket(null)}
                      className="group relative flex-1 h-full flex flex-col justify-end items-center min-w-0"
                    >
                      {/* Hover Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold shadow-lg transition-opacity">
                        {bucket.fullLabel}: {bucket.count} {bucket.count === 1 ? 'view' : 'views'}
                      </div>

                      {showInlineCount && (
                        <span className="text-[10px] font-extrabold text-slate-700 mb-1 select-none">
                          {bucket.count}
                        </span>
                      )}

                      {bucket.count > 0 ? (
                        <div
                          style={{ height: `${Math.max(pct, 4)}%` }}
                          className="w-full max-w-[38px] rounded-t-lg bg-gradient-to-t from-blue-600 to-indigo-500 group-hover:from-blue-700 group-hover:to-indigo-600 transition-all duration-300 shadow-2xs"
                        />
                      ) : (
                        <div className="w-full max-w-[38px] h-[3px] rounded-t bg-slate-200/90 group-hover:bg-slate-300 transition-colors" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex items-center gap-1 sm:gap-2 px-1 pt-2.5">
                {buckets.map((bucket) => (
                  <div key={`${bucket.key}_lbl`} className="flex-1 min-w-0 text-center">
                    {bucket.showAxisLabel ? (
                      <span className="text-[10px] font-semibold text-slate-500 block truncate">
                        {bucket.label}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Below Graph: User Locations (Country, State, Dist, Taluka) + Visit Date & Time */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Visitor Locations & Timestamps
                </h2>
                <p className="text-xs text-slate-500">
                  Country, State, District & Taluka with exact date and time of each website visit
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={handleVerifyPincode} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Pincode (e.g. 416602)"
                  className="w-36 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <button
                  type="submit"
                  disabled={isVerifyingPin || pincodeInput.length !== 6}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isVerifyingPin ? 'Verifying...' : 'Verify Pincode'}
                </button>
              </form>

              <button
                type="button"
                disabled={isDetectingLoc}
                onClick={handleDetectExactLocation}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${isDetectingLoc ? 'animate-spin' : ''}`} />
                <span>{isDetectingLoc ? 'Detecting...' : 'Detect Exact Location'}</span>
              </button>

              {locationLogs.length > 0 && (
                <button
                  type="button"
                  disabled={isClearingLogs}
                  onClick={() => setShowClearConfirm(true)}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
                  title="Clear all visitor location logs (Website Views count & graph stay preserved)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isClearingLogs ? 'Clearing...' : 'Clear Logs'}</span>
                </button>
              )}

              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder="Filter country, state, dist, taluka..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
              </div>
            </div>
          </div>

          {(locationNotice ||
            locationLogsInRange.some(
              (v) =>
                (v.locationSource !== 'gps' && v.locationSource !== 'pincode') ||
                (v.locationSource === 'gps' && v.accuracyMeters !== undefined && v.accuracyMeters > 5000)
            )) && (
            <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {locationNotice ||
                  'Laptops/PCs do not have a GPS chip, so browser/ISP estimates often point to a nearby city hub (e.g. Ratnagiri). Enter your 6-digit Pincode (e.g. 416602) and click "Verify Pincode" to resolve your exact District & Taluka on this laptop.'}
              </p>
            </div>
          )}
        </div>

        {filteredLocations.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Globe className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              {viewsInRange.length > 0 && locationLogsInRange.length === 0 && !locationQuery.trim()
                ? 'Visitor location logs cleared'
                : 'No visits recorded in this period'}
            </p>
            <p className="text-xs text-slate-500">
              {viewsInRange.length > 0 && locationLogsInRange.length === 0 && !locationQuery.trim()
                ? 'All past location logs were deleted while Website Views remain preserved. New visits or verified locations will appear here.'
                : 'Website visits with Country, State, District, Taluka and timestamp appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Country</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4">District</th>
                  <th className="py-3.5 px-4">Taluka</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLocations.map((visit) => {
                  const dt = new Date(visit.visitedAt);
                  const dateStr = !Number.isNaN(dt.getTime())
                    ? dt.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—';
                  const timeStr = !Number.isNaN(dt.getTime())
                    ? dt.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      })
                    : '—';
                  const acc = visit.accuracyMeters;
                  const isPreciseGps =
                    visit.locationSource === 'pincode' ||
                    (visit.locationSource === 'gps' && (acc === undefined || acc <= 5000));
                  const badgeLabel =
                    visit.locationSource === 'pincode'
                      ? 'Verified Pincode'
                      : visit.locationSource === 'gps'
                      ? acc !== undefined
                        ? acc <= 5000
                          ? `Exact GPS (±${acc >= 1000 ? `${(acc / 1000).toFixed(1)} km` : `${acc} m`})`
                          : `Network Approx (±${Math.round(acc / 1000)} km)`
                        : 'Exact Device'
                      : 'ISP IP Approx';

                  return (
                    <tr key={visit.viewId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                        {visit.country}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {visit.state}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {visit.dist}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {visit.taluka}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isPreciseGps
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                          }`}
                        >
                          {badgeLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{dateStr}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{timeStr}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 6-per-page Pagination Bar */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-600">
                Showing{' '}
                <span className="font-extrabold text-slate-900">
                  {pageStartIndex + 1}–
                  {Math.min(pageStartIndex + LOCATIONS_PER_PAGE, filteredLocations.length)}
                </span>{' '}
                of{' '}
                <span className="font-extrabold text-slate-900">
                  {filteredLocations.length}
                </span>{' '}
                locations
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>

                <span className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-800 select-none">
                  Page {safeCurrentPage} of {totalLocationPages}
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalLocationPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalLocationPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modern Confirmation Modal for Clear Logs */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
          onClick={() => {
            if (!isClearingLogs) setShowClearConfirm(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-logs-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3
                    id="clear-logs-modal-title"
                    className="text-base font-black text-slate-900"
                  >
                    Clear Visitor Location Logs?
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {locationLogs.length} recorded{' '}
                    {locationLogs.length === 1 ? 'location' : 'locations'} will be removed
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isClearingLogs}
                onClick={() => setShowClearConfirm(false)}
                aria-label="Close confirmation dialog"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <p>
                Are you sure you want to delete all recorded Country, State, District & Taluka location logs?
              </p>
              <div className="px-3.5 py-2.5 rounded-2xl bg-blue-50/80 border border-blue-100 text-blue-900 font-semibold">
                Your Website Views ({views.length.toLocaleString('en-IN')}) and Bar Graph will remain completely safe and untouched.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isClearingLogs}
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearingLogs}
                onClick={confirmClearLogs}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm cursor-pointer transition-colors disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearingLogs ? 'Deleting...' : 'OK'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
