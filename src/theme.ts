// THE FLYER LOOK. One theme, dark only: deep navy, heavy slanted condensed capitals, cyan for
// "do this", orange for "now". Every color, font, type size, corner, shadow and gap lives here.
// (This look has no light mode: the saved Appearance choice is ignored and its control is gone.)
import { Platform, type TextStyle } from 'react-native';
import { readPrefs } from './prefs';
import { DEFAULT_PREFS } from './prefsDefaults';

export const PREFS = (() => { try { return { ...DEFAULT_PREFS, ...(readPrefs() || {}) }; } catch { return DEFAULT_PREFS; } })();
export const IS_DARK = true;

// ───────── colors ─────────
// Only two accents exist: cyan = the action, orange = what is happening now. No third accent.
// Text on color: on cyan use onBlue, on orange use onOrange, on paper use night. Never C.white.
const PALETTE = {
  // surfaces
  bg: '#0B1220', // the page
  bgGlow: '#16274A', // the glow at the top right of the page (see Backdrop in look.tsx)
  card: '#111B30', // contained surfaces only: inputs, sheets, leader-panel tiles, photo placeholders
  raised: '#17233D', // a surface on top of card, pressed rows
  band: 'rgba(255,255,255,0.045)', // full-width bands (scoreboard, Shabbat). See Band in look.tsx
  bandTop: 'rgba(255,255,255,0.06)', // a band is drawn as a soft fade from bandTop ...
  bandBottom: 'rgba(255,255,255,0.025)', // ... to bandBottom (averages to `band`)
  // text
  ink: '#F3F6FA', // main text
  sub: '#93A1B5', // secondary text
  faint: '#6F7F96', // tertiary text, the quiet half of a number ("/30")
  mute: '#7888A0', // the Hebrew date beside the date line
  // lines
  line: 'rgba(255,255,255,0.09)', // hairlines between rows
  lineStrong: 'rgba(255,255,255,0.14)', // input outlines, ghost buttons, the rule inside a band
  bandLine: 'rgba(255,255,255,0.1)', // the hairline along the top and bottom of a band (the mockup's value)
  tick: 'rgba(255,255,255,0.12)', // progress bars not reached yet
  track: 'rgba(255,255,255,0.16)', // the track of a switch that is off
  // cyan: do this
  blue: '#1FC3F0', // primary buttons, links, active tab, progress
  onBlue: '#07111F', // text on a cyan fill
  blueDeep: '#7FDDF7', // small cyan text that needs more contrast
  bluePale: 'rgba(31,195,240,0.14)', // cyan tint fill
  // orange: now
  orange: '#FF7A2F', // the brush tag, today, Snap, the streak
  orangeText: '#FF8D42', // orange text on the dark background
  onOrange: '#0B1220', // text on an orange fill
  orangePale: 'rgba(255,122,47,0.17)', // orange tint fill (the streak chip)
  // the white chip
  paper: '#F3F6FA', // RSVP chip, selected choice chips (text on it: night)
  // rare
  green: '#5FD39B', // a confirmed check on a photo
  greenPale: 'rgba(95,211,155,0.14)',
  red: '#FF5A6B', // errors, delete, the LIVE dot
  redPale: 'rgba(255,90,107,0.16)',
  white: '#FFFFFF', // pure white (the switch knob, the avatar initial). Not for text on cyan or orange
  night: '#0B1220', // always dark
  black: '#000000', // pure black: only the text on Apple's white sign-in button
  inverse: '#F3F6FA', // selected chips
  onInverse: '#0B1220',
  // the frame: the two floating bars and the things on them
  glass: 'rgba(255,255,255,0.075)', // header bar, glass circles
  glassLine: 'rgba(255,255,255,0.12)',
  glassSolid: 'rgba(24,33,54,0.96)', // the same surfaces where the phone cannot blur what is behind
  tabBar: 'rgba(18,27,46,0.8)', // tab bar (browser imitation)
  tabBarLine: 'rgba(255,255,255,0.11)',
  tabIcon: '#9BACC3', // tab icons and labels that are not selected
  lens: 'rgba(255,255,255,0.075)', // the lens behind the selected tab
  avatar: '#1C2A45', // the profile circle
  printEdge: 'rgba(255,255,255,0.1)', // the 1 pt outline of a poster print
  shade: 'rgba(3,7,14,0.7)', // behind a pop-up or sheet
  onPhoto: 'rgba(11,18,32,0.72)', // a small dark tag on top of a photograph
  // old names, kept so screens nobody has redesigned yet still compile and re-skin
  tan: '#FF7A2F',
  tanPale: 'rgba(255,122,47,0.17)',
  orangeDeep: '#FF8D42',
  logoBlue: '#1FC3F0',
};
export const C: Record<keyof typeof PALETTE, string> = PALETTE;

// ───────── spacing ─────────
export const SP = {
  gutter: 18, // left and right page margin
  section: 26, // space above a section
  row: 12, // top and bottom padding of a list row
  gap: 14, // between the parts of a row (date, text, chip)
} as const;

// ───────── corners ─────────
// Rectangles everywhere. Only the two floating bars are capsules.
export const R = {
  print: 5, // posters shown as prints, small thumbnails
  photo: 6, // photographs, poster stages
  chip: 8, // chips
  btnSm: 9, // medium buttons, square icon buttons
  input: 10, // inputs and card blocks
  btn: 11, // large buttons
  sheet: 16, // top corners of a sheet
  header: 27, // the floating header bar
  tabBar: 32, // the floating tab bar
  // old names: `pill` is no longer a pill (this look has no pill buttons)
  card: 10,
  tile: 6,
  pill: 9,
} as const;

// ───────── fonts ─────────
// Barlow Condensed (loaded in app/_layout.tsx) for titles, numbers, labels and buttons, always in
// capitals. Anything a person reads as a sentence is Apple's system font (no fontFamily at all).
// Each weight and each italic is its own family: NEVER add fontWeight or fontStyle next to one.
export const F = {
  display: 'BarlowCondensed_800ExtraBold_Italic', // headlines, section titles, button labels
  num: 'BarlowCondensed_900Black_Italic', // big numerals: scoreboard, dates, clocks
  bold: 'BarlowCondensed_700Bold', // upright: row titles and labels
  boldItalic: 'BarlowCondensed_700Bold_Italic', // the quiet half of a number pair ("/30")
  heavy: 'BarlowCondensed_800ExtraBold', // upright extra bold (rare)
  semi: 'BarlowCondensed_600SemiBold', // upright semi bold (rare)
} as const;

// Slanted text gets its last letter clipped on iPhone without a little room on the right, and
// its tops clipped when the line is tighter than about 0.92 x the size. These keep both safe.
const slantPad = (size: number) => Math.ceil(size * 0.12);
const tight = (size: number) => Math.ceil(size * 0.93);

// 800 Italic capitals at any size: "800 Italic 26" in the spec is display(26).
export const display = (size: number, color: string = C.ink): TextStyle => ({
  fontFamily: F.display, fontSize: size, color, textTransform: 'uppercase', paddingRight: slantPad(size),
  lineHeight: size >= 30 ? tight(size) : Math.round(size * 1.05),
  letterSpacing: size >= 44 ? 0.2 : size >= 30 ? 0.4 : size >= 24 ? 0.6 : 0.8,
});
// 900 Italic numerals at any size: the scoreboard number is numeral(54, C.blue).
export const numeral = (size: number, color: string = C.ink): TextStyle => ({
  fontFamily: F.num, fontSize: size, lineHeight: tight(size), color, fontVariant: ['tabular-nums'], paddingRight: slantPad(size),
});
// 700 upright capitals at any size: "700 upright 16" is upright(16).
export const upright = (size: number, color: string = C.ink): TextStyle => ({
  fontFamily: F.bold, fontSize: size, lineHeight: Math.round(size * 1.08), letterSpacing: size <= 13 ? 2 : 0.5, color, textTransform: 'uppercase',
});

// ───────── type scale ─────────
export const T = {
  hero: { fontFamily: F.display, fontSize: 51, lineHeight: 47, letterSpacing: 0.2, color: C.ink, textTransform: 'uppercase', paddingRight: 6 }, // the one headline of a screen (heroType() in look.tsx steps it down for long titles)
  h1: { fontFamily: F.display, fontSize: 40, lineHeight: 38, letterSpacing: 0.4, color: C.ink, textTransform: 'uppercase', paddingRight: 5 }, // page title
  h2: { fontFamily: F.display, fontSize: 23, lineHeight: 24, letterSpacing: 0.8, color: C.ink, textTransform: 'uppercase', paddingRight: 3 }, // section title
  h3: { fontFamily: F.bold, fontSize: 20, lineHeight: 21, letterSpacing: 0.5, color: C.ink, textTransform: 'uppercase' }, // row title
  eyebrow: { fontFamily: F.bold, fontSize: 12, lineHeight: 14, letterSpacing: 2, color: C.sub, textTransform: 'uppercase' }, // label (use the Label piece)
  body: { fontSize: 15, lineHeight: 22, color: C.ink }, // sentences: Apple's system font, as typed
  small: { fontSize: 13.5, lineHeight: 18, color: C.sub }, // meta lines
  strong: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: C.ink }, // a name or a value in the system font (settings rows, facts, places)
} as const;

// ───────── shadows ─────────
// Only posters and the two floating bars cast one. Nothing else.
// (A browser's blur is about twice an iPhone's shadow radius, so the number is halved on the phone.)
const blur = (px: number) => (Platform.OS === 'web' ? px : px / 2);
export const SH = {
  print: { shadowColor: '#000000', shadowOpacity: 0.6, shadowRadius: blur(34), shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  printSmall: { shadowColor: '#000000', shadowOpacity: 0.5, shadowRadius: blur(16), shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  bar: { shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: blur(24), shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const;
// Old name: cards no longer cast a shadow.
export const shadow = {} as const;

// ───────── leader-picked accent colors ─────────
// Leaders pick one of six colors for an event or challenge. `pale` is the solid at 16%,
// `deep` is a light tint that reads on the dark background.
const hexAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const hue = (solid: string, deep: string) => ({ solid, deep, pale: hexAlpha(solid, 0.16) });
export const HUES = {
  blue: hue('#1FC3F0', '#7FDDF7'),
  orange: hue('#FF7A2F', '#FF8D42'),
  purple: hue('#7C5CFC', '#BFB0FF'),
  green: hue('#1FA971', '#86DDB3'),
  pink: hue('#F0569A', '#F7A8CA'),
  yellow: hue('#F5B81F', '#F4D687'),
};
