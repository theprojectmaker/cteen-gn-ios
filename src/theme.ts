// Colors and type lifted from the CTeen portal (myportal.cteen.com) and the CTeen logo.
// The palette is picked once at startup from Settings > Appearance (light, dark, or the phone's
// setting); changing it restarts the app so every screen redraws with the new colors.
import { Appearance } from 'react-native';
import { readPrefs } from './prefs';
import { DEFAULT_PREFS } from './prefsDefaults';

const LIGHT = {
  bg: '#F3F6F9',
  card: '#FFFFFF',
  ink: '#13202C',
  sub: '#5B6875',
  faint: '#8A96A3',
  line: '#E3E9EF',
  blue: '#159FDC',
  blueDeep: '#0C5E9E',
  bluePale: '#E7F5FC',
  logoBlue: '#2BC6F6',
  tan: '#E8B478',
  tanPale: '#FBF1E4',
  green: '#1A6B45',
  greenPale: '#E8F1EC',
  white: '#FFFFFF',
  inverse: '#13202C', // dark chip / badge background in light mode
  onInverse: '#FFFFFF',
  night: '#13202C', // always dark (text on white buttons over photos)
};

const DARK: typeof LIGHT = {
  bg: '#0B121B',
  card: '#151F2B',
  ink: '#EDF2F7',
  sub: '#9AA8B6',
  faint: '#6B7A89',
  line: '#243243',
  blue: '#2BB2EE',
  blueDeep: '#7FD0F5',
  bluePale: '#123049',
  logoBlue: '#2BC6F6',
  tan: '#E8B478',
  tanPale: '#33261A',
  green: '#5FD39B',
  greenPale: '#13301F',
  white: '#FFFFFF',
  inverse: '#EDF2F7',
  onInverse: '#0B121B',
  night: '#13202C',
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
  blue: { solid: '#159FDC', deep: '#0C5E9E', pale: '#E7F5FC' },
  orange: { solid: '#F2913D', deep: '#9A5A16', pale: '#FDF0E3' },
  purple: { solid: '#7C5CFC', deep: '#4A32B8', pale: '#EFEBFF' },
  green: { solid: '#1FA971', deep: '#136B48', pale: '#E3F6EE' },
  pink: { solid: '#F0569A', deep: '#A52560', pale: '#FDE9F2' },
  yellow: { solid: '#F5B81F', deep: '#8A6405', pale: '#FEF6DC' },
};
const HUES_DARK: typeof HUES_LIGHT = {
  blue: { solid: '#159FDC', deep: '#8AD4F6', pale: '#10324A' },
  orange: { solid: '#F2913D', deep: '#F7BC86', pale: '#3A2612' },
  purple: { solid: '#7C5CFC', deep: '#BFB0FF', pale: '#26204A' },
  green: { solid: '#1FA971', deep: '#86DDB3', pale: '#103225' },
  pink: { solid: '#F0569A', deep: '#F7A8CA', pale: '#3B1528' },
  yellow: { solid: '#F5B81F', deep: '#F4D687', pale: '#382C0B' },
};
export const HUES = IS_DARK ? HUES_DARK : HUES_LIGHT;
