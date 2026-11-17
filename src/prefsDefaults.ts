// Shared by prefs.ts (web) and prefs.native.ts (phone). Keep this in its own file:
// on the phone, "./prefs" means prefs.native.ts itself, so prefs.native.ts must never import
// from "./prefs" (that self-import made DEFAULT_PREFS undefined and crashed builds 7 to 10 on launch).
export type ThemeMode = 'system' | 'light' | 'dark';
export type Prefs = { theme: ThemeMode; haptics: boolean; reduceMotion: boolean; intro: boolean };
export const DEFAULT_PREFS: Prefs = { theme: 'system', haptics: true, reduceMotion: false, intro: true };
