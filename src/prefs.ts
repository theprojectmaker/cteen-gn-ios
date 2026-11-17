// Device settings read synchronously at startup (so colors are right on the first frame).
// Web version: browser storage. The phone version is prefs.native.ts.
export type ThemeMode = 'system' | 'light' | 'dark';
export type Prefs = { theme: ThemeMode; haptics: boolean; reduceMotion: boolean; intro: boolean };
export const DEFAULT_PREFS: Prefs = { theme: 'system', haptics: true, reduceMotion: false, intro: true };
const KEY = 'cteengn.prefs';

export function readPrefs(): Prefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}
