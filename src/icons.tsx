import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { C } from './theme';

// Stroke-icon set (24px grid). No emoji anywhere in the app: every symbol comes from here.
const PATHS: Record<string, React.ReactNode> = {
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  compass: <><Circle cx="12" cy="12" r="9" /><Path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  chat: <Path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5A8.5 8.5 0 1 1 21 11.5z" />,
  users: <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><Path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" /><Path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  heart: <Path d="M12 20.5s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 6.1-8 11-8 11z" />,
  calendar: <><Rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><Path d="M8 3v4M16 3v4M3.5 10h17" /></>,
  ticket: <><Path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><Path d="M14 6v12" strokeDasharray="2 2.5" /></>,
  right: <Path d="m9 5 7 7-7 7" />,
  arrow: <Path d="M5 12h14M13 6l6 6-6 6" />,
  external: <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  x: <Path d="M6 6l12 12M18 6 6 18" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  tick: <Path d="m5 12.5 4.5 4.5L19 7.5" />,
  check: <><Circle cx="12" cy="12" r="9" /><Path d="m8 12.3 2.8 2.7L16 9.5" /></>,
  phone: <Path d="M5 3.500h3.500l1.700 4.500-2.200 1.500a12 12 0 0 0 6 6l1.500-2.200 4.500 1.700v3.500a2 2 0 0 1-2 2A16 16 0 0 1 3 5.500a2 2 0 0 1 2-2z" />,
  pin: <><Path d="M12 21.500s7-6.200 7-11.500a7 7 0 0 0-14 0c0 5.300 7 11.500 7 11.500z" /><Circle cx="12" cy="10" r="2.500" /></>,
  camera: <><Rect x="3.500" y="3.500" width="17" height="17" rx="5" /><Circle cx="12" cy="12" r="4" /><Circle cx="17" cy="7" r="0.600" /></>,
  globe: <><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18M12 3c3 3.200 3 14.800 0 18M12 3c-3 3.200-3 14.800 0 18" /></>,
  flame: <Path d="M12 3c1 3.500 5 5.500 5 10.500a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500.500 1.500 1.300 2.200 2 2.500C10.500 8.500 11 5.500 12 3z" />,
  cap: <><Path d="m2.500 9.500 9.500-5 9.500 5-9.500 5z" /><Path d="M6.500 12v4.500c1.500 1.500 3.500 2 5.500 2s4-.500 5.500-2V12M21.500 9.500V15" /></>,
  sun: <><Circle cx="12" cy="12" r="4" /><Path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300 7 7M17 17l1.700 1.700M5.300 18.700 7 17M17 7l1.700-1.700" /></>,
  gift: <><Rect x="3.500" y="9" width="17" height="11.500" rx="1.500" /><Path d="M2.500 9h19M12 9v11.500M12 9c-1.500-4-6-4-5.500-1.500C7 9 12 9 12 9zM12 9c1.500-4 6-4 5.500-1.500C17 9 12 9 12 9z" /></>,
  pinned: <Path d="M9 3.500h6l-1 6 3.500 3.500h-11L10 9.500zM12 13v7.500" />,
  star: <Path d="m12 3 2.700 5.600 6.100.800-4.500 4.300 1.100 6.100L12 16.900l-5.400 2.900 1.100-6.100-4.500-4.300 6.100-.800z" />,
  trophy: <><Path d="M7 4h10v5a5 5 0 0 1-10 0z" /><Path d="M7 5.500H4a3 3 0 0 0 3 4M17 5.500h3a3 3 0 0 1-3 4M12 14v3.500M8.500 20.500h7M9.500 17.500h5" /></>,
  book: <><Path d="M12 6.500C10.500 5 8 4.500 4 4.500v13c4 0 6.500.500 8 2 1.500-1.500 4-2 8-2v-13c-4 0-6.500.500-8 2z" /><Path d="M12 6.500v13" /></>,
  ball: <><Circle cx="12" cy="12" r="9" /><Path d="M3 12h18M12 3v18M5.600 5.600c3 2.800 3 10 0 12.800M18.400 5.600c-3 2.800-3 10 0 12.800" /></>,
  music: <><Path d="M9 18V5.500l11-2V16" /><Circle cx="6.500" cy="18" r="2.500" /><Circle cx="17.500" cy="16" r="2.500" /></>,
  food: <><Path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M16.500 21V3c-2 1-3.500 3.500-3.500 7 0 2 1 3 3.500 3" /></>,
  bell: <><Path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15z" /><Path d="M10 21a2.200 2.200 0 0 0 4 0" /></>,
  megaphone: <><Path d="M4 9.500v5l3 .500 2 4.500h2.500L10 15.300l9 3.200v-13L7 9.500z" /></>,
  lock: <><Rect x="5" y="10.500" width="14" height="10" rx="2.500" /><Path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" /></>,
  clock: <><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5.500l3.500 2" /></>,
  edit: <Path d="M4 20h4L19.500 8.500a2.100 2.100 0 0 0-3-3L5 17zM14.500 7.500l3 3" />,
  question: <><Circle cx="12" cy="12" r="9" /><Path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.300-1 .900-1 1.700M12 16.800v.100" /></>,
  tefillin: <><Rect x="7" y="2.5" width="10" height="10" rx="1.8" /><Path d="M9.4 5.5v3c0 1 .6 1.6 1.6 1.6h2c1 0 1.6-.6 1.6-1.6V5.5M12 5.5v4.6" /><Rect x="4.5" y="12.5" width="15" height="2.6" rx="1" /><Path d="M19.5 13.8c2.3.2 2.6 3 .6 4.3-2.3 1.5-7.5 1.4-11.3 2.2-2 .4-3 1.3-3.3 2.2" /></>,
  send: <Path d="M20.500 3.500 3 11l6.500 2.500L12 20zM9.500 13.500l5-5" />,
  // solid shapes (drawn filled, no outline): the streak flame in the header
  fire: <Path d="M13 2.2c.5 2.7-.5 4.5-2 6.2C9.3 10.2 7 12 7 15.2a5 5 0 0 0 10 0c0-1.9-.8-3.3-1.7-4.6-.3 1-.9 1.7-1.7 2.1.4-3.5-.1-7.2-.6-10.5z" />,
};
const SOLID: Record<string, boolean> = { fire: true };

export const EVENT_ICONS = ['tefillin', 'star', 'flame', 'ticket', 'users', 'heart', 'trophy', 'food', 'ball', 'music', 'book', 'cap', 'sun', 'gift', 'globe', 'calendar', 'pin'] as const;

// The Tefillin Challenge always wears the tefillin icon, whatever was picked for it.
export const challengeIcon = (ch: { id: string; icon?: string }) => (ch.id === 'tefillin' ? 'tefillin' : ch.icon || 'trophy');

export function Icon({ name, size = 22, color = C.ink, fill, stroke = 1.9 }: { name: string; size?: number; color?: string; fill?: string; stroke?: number }) {
  const solid = !!SOLID[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? (solid ? color : 'none')} stroke={color} strokeWidth={solid ? 0 : stroke} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name] ?? PATHS.star}
    </Svg>
  );
}
