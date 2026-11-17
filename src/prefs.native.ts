// Device settings read synchronously at startup (so colors are right on the first frame).
// Phone version: a small JSON file read with expo-file-system's sync API.
// (Not expo-sqlite: it compiles its own copy of SQLite into the app, which clashes with the one
// expo-updates uses at launch and crashed the app on opening in build 0121b70.)
import { DEFAULT_PREFS, type Prefs } from './prefs';

export { DEFAULT_PREFS };
export type { Prefs, ThemeMode } from './prefs';

type FileLike = { exists: boolean; textSync(): string; write(s: string): void; create(): void };
function prefsFile(): FileLike | null {
  try {
    const { File, Paths } = require('expo-file-system');
    return new File(Paths.document, 'cteengn-prefs.json');
  } catch {
    return null;
  }
}

export function readPrefs(): Prefs {
  try {
    const f = prefsFile();
    if (!f || !f.exists) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(f.textSync()) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(p: Prefs) {
  try {
    const f = prefsFile();
    if (!f) return;
    if (!f.exists) f.create();
    f.write(JSON.stringify(p));
  } catch {}
}
