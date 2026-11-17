// Sunrise and sunset for Great Neck, NY, worked out on the phone for any day (no network).
// Tefillin can be wrapped from sunrise until sunset; the server uses the same math.
// NOAA sunrise equation, good to about a minute.
const LAT = 40.8007;
const LON = -73.7285;
const rad = Math.PI / 180;

export function sunTimes(ymd: string): { rise: number; set: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  const jd = Date.UTC(y, m - 1, d) / 86400000 + 2440587.5;
  const n = Math.ceil(jd - 2451545 + 0.0008);
  const js = n - LON / 360;
  const M = (357.5291 + 0.98560028 * js) % 360;
  const Cc = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + Cc + 180 + 102.9372) % 360;
  const transit = 2451545 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(dec)) / (Math.cos(LAT * rad) * Math.cos(dec))) / rad;
  const ms = (j: number) => Math.round((j - 2440587.5) * 86400000);
  return { rise: ms(transit - w / 360), set: ms(transit + w / 360) };
}

export const nyDate = (t = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(t);
export const nyTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
export const isSaturday = (t = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(t) === 'Sat';

export type WrapWindow = { rise: number; set: number; state: 'before' | 'open' | 'after' | 'shabbat'; friday?: boolean };
export const isFriday = (t = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(t) === 'Fri';
// TEST: photo slots open for testing until this moment, then back to normal by itself. Remove later.
export const TEST_OPEN_UNTIL = Date.parse('2026-11-17T05:28:00Z');

export function wrapWindow(now = Date.now()): WrapWindow {
  const t = sunTimes(nyDate(new Date(now)));
  if (now < TEST_OPEN_UNTIL) return { rise: Math.min(t.rise, now), set: TEST_OPEN_UNTIL, state: 'open' };
  if (isSaturday(new Date(now))) return { ...t, state: 'shabbat' };
  // Fridays: wrap before candle lighting (18 min before sunset), when Shabbat begins
  const friday = isFriday(new Date(now));
  const set = friday ? t.set - 18 * 60000 : t.set;
  return { rise: t.rise, set, friday, state: now < t.rise ? 'before' : now > set ? 'after' : 'open' };
}

// "2h 14m" / "38m"
export function untilText(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
