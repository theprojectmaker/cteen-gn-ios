// Device settings read synchronously at startup (so colors are right on the first frame).
// Phone version: a tiny SQLite key-value store that can be read synchronously.
import Storage from 'expo-sqlite/kv-store';
import { DEFAULT_PREFS, type Prefs } from './prefs';

export { DEFAULT_PREFS };
export type { Prefs, ThemeMode } from './prefs';
const KEY = 'cteengn.prefs';

export function readPrefs(): Prefs {
  try {
    const raw = Storage.getItemSync(KEY);
    return { ...DEFAULT_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: Prefs) {
  try {
    Storage.setItemSync(KEY, JSON.stringify(p));
  } catch {}
}
