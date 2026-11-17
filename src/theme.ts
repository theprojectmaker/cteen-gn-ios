// Colors from the CTeen logo (cyan + orange) on warm neutrals; type is Bricolage for headlines.
// The palette is picked once at startup from Settings > Appearance (light, dark, or the phone's
// setting); changing it restarts the app so every screen redraws with the new colors.
import { Appearance } from 'react-native';
import { readPrefs } from './prefs';
import { DEFAULT_PREFS } from './prefsDefaults';

// CTeen's two colors: cyan (the logo) and orange. Warm off-white base, deep navy ink.
const LIGHT = {
  bg: '#F7F4EF',
  card: '#FFFFFF',
  ink: '#0F1D2B',
  sub: '#5A6470',
  faint: '#98A0A8',
  line: '#ECE6DE',
  blue: '#0BAFE6', // CTeen cyan: primary buttons, links, tab bar
  blueDeep: '#07729F',
  bluePale: '#E2F6FD',
  logoBlue: '#2BC6F6',
  tan: '#FF7A2F',
  tanPale: '#FFF0E4',
  orange: '#FF7A2F', // CTeen orange: the things you act on (streak, Snap, Up next, you)
  orangeDeep: '#B04A0C',
  orangePale: '#FFF0E4',
  green: '#157A4C',
  greenPale: '#E5F4EC',
  white: '#FFFFFF',
  inverse: '#0F1D2B', // dark chip / badge background in light mode
  onInverse: '#FFFFFF',
  night: '#0F1D2B', // always dark (text on white buttons over photos)
};

const DARK: typeof LIGHT = {
  bg: '#0B1520',
  card: '#142231',
  ink: '#EEF2F6',
  sub: '#9CA9B6',
  faint: '#6A7887',
  line: '#223345',
  blue: '#35C3F2',
  blueDeep: '#8ADDF8',
  bluePale: '#0F3347',
  logoBlue: '#2BC6F6',
  tan: '#FF9550',
  tanPale: '#3A2414',
  orange: '#FF9550',
  orangeDeep: '#FFC199',
  orangePale: '#3A2414',
  green: '#5FD39B',
  greenPale: '#13301F',
  white: '#FFFFFF',
  inverse: '#EEF2F6',
  onInverse: '#0B1520',
  night: '#0F1D2B',
};

export const PREFS = (() => { try { return { ...DEFAULT_PREFS, ...(readPrefs() || {}) }; } catch { return DEFAULT_PREFS; } })();
export const IS_DARK = PREFS.theme === 'dark' || (PREFS.theme === 'system' && Appearance.getColorScheme() === 'dark');
export const C = IS_DARK ? DARK : LIGHT;

export const R = { card: 22, tile: 16, pill: 999 };

// Bricolage Grotesque for headlines (loaded in app/_layout.tsx), Apple's system font for everything else.
export const F = { display: 'BricolageGrotesque_800ExtraBold', bold: 'BricolageGrotesque_700Bold' } as const;

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: IS_DARK ? 0.35 : 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export const T = {
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: C.sub, textTransform: 'uppercase' },
  h1: { fontSize: 31, lineHeight: 35, fontFamily: F.display, color: C.ink, letterSpacing: -0.8 },
  h2: { fontSize: 20, fontFamily: F.display, color: C.ink, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '800', color: C.ink },
  body: { fontSize: 15, lineHeight: 22, color: C.ink },
  small: { fontSize: 13, lineHeight: 18, color: C.sub },
} as const;

// Cover / accent colors leaders can pick for events and challenges.
const HUES_LIGHT = {
  blue: { solid: '#0BAFE6', deep: '#07729F', pale: '#E2F6FD' },
  orange: { solid: '#FF7A2F', deep: '#B04A0C', pale: '#FFF0E4' },
  purple: { solid: '#7C5CFC', deep: '#4A32B8', pale: '#EFEBFF' },
  green: { solid: '#1FA971', deep: '#136B48', pale: '#E3F6EE' },
  pink: { solid: '#F0569A', deep: '#A52560', pale: '#FDE9F2' },
  yellow: { solid: '#F5B81F', deep: '#8A6405', pale: '#FEF6DC' },
};
const HUES_DARK: typeof HUES_LIGHT = {
  blue: { solid: '#35C3F2', deep: '#8ADDF8', pale: '#0F3347' },
  orange: { solid: '#FF9550', deep: '#FFC199', pale: '#3A2414' },
  purple: { solid: '#7C5CFC', deep: '#BFB0FF', pale: '#26204A' },
  green: { solid: '#1FA971', deep: '#86DDB3', pale: '#103225' },
  pink: { solid: '#F0569A', deep: '#F7A8CA', pale: '#3B1528' },
  yellow: { solid: '#F5B81F', deep: '#F4D687', pale: '#382C0B' },
};
export const HUES = IS_DARK ? HUES_DARK : HUES_LIGHT;
