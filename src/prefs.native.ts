// Device settings read synchronously at startup (so colors are right on the first frame).
// Phone version: a tiny SQLite key-value store that can be read synchronously.
import { DEFAULT_PREFS, type Prefs } from './prefs';

export { DEFAULT_PREFS };
export type { Prefs, ThemeMode } from './prefs';
const KEY = 'cteengn.prefs';
// Loaded lazily inside try so a problem with the native store can never stop the app from opening.
function store(): { getItemSync(k: string): string | null; setItemSync(k: string, v: string): void } | null {
  try { return require('expo-sqlite/kv-store').default; } catch { return null; }
}

export function readPrefs(): Prefs {
  try {
    const raw = store()?.getItemSync(KEY);
    return { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: Prefs) {
  try {
    store()?.setItemSync(KEY, JSON.stringify(p));
  } catch {}
}
