// Colors and type lifted from the CTeen portal (myportal.cteen.com) and the CTeen logo.
export const C = {
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
};

export const R = { card: 18, tile: 14, pill: 999 };

export const shadow = {
  shadowColor: '#13202C',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

export const T = {
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: C.sub, textTransform: 'uppercase' },
  h1: { fontSize: 30, lineHeight: 34, fontWeight: '900', color: C.ink, letterSpacing: -0.6 },
  h2: { fontSize: 19, fontWeight: '900', color: C.ink, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '800', color: C.ink },
  body: { fontSize: 15, lineHeight: 22, color: C.ink },
  small: { fontSize: 13, lineHeight: 18, color: C.sub },
} as const;

// Cover / accent colors leaders can pick for events and challenges.
export const HUES = {
  blue: { solid: '#159FDC', deep: '#0C5E9E', pale: '#E7F5FC' },
  orange: { solid: '#F2913D', deep: '#9A5A16', pale: '#FDF0E3' },
  purple: { solid: '#7C5CFC', deep: '#4A32B8', pale: '#EFEBFF' },
  green: { solid: '#1FA971', deep: '#136B48', pale: '#E3F6EE' },
  pink: { solid: '#F0569A', deep: '#A52560', pale: '#FDE9F2' },
  yellow: { solid: '#F5B81F', deep: '#8A6405', pale: '#FEF6DC' },
} as const;
