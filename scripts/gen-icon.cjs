// Draws the app icon: the CTeen logo over a Great Neck harbor at sunset
// (Long Island Sound, the Stepping Stones Lighthouse off Kings Point, a sailboat).
// Pure Node, no image libraries. Writes assets/icon.png (1024x1024, opaque).
// Run: node scripts/gen-icon.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.cjs');

const S = 1024;
const SS = 3; // supersamples per axis, for smooth edges
const OUT = path.join(__dirname, '..', 'assets', 'icon.png');
const logo = decode(fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.png')));

// ---------- helpers (all coordinates are 0..1 of the icon) ----------
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = clamp(x, x0 + r, x1 - r), cy = clamp(y, y0 + r, y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inTri = (x, y, ax, ay, bx, by, cx, cy) => {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

const HORIZON = 0.665;
const SKY_TOP = hex('#2BC6F6'); // CTeen logo blue
const SKY_MID = hex('#8FD9F2');
const SKY_LOW = hex('#FFD9A8'); // warm sunset near the water
const SUN = hex('#FFE9A6');
const SHORE = hex('#3E86B8');
const WATER_TOP = hex('#1DA6E0');
const WATER_DEEP = hex('#0B5C9A');
const BRICK = hex('#C8492F');
const BRICK_DARK = hex('#9E3522');
const TRIM = hex('#FFFFFF');
const ROOF = hex('#3B4652');
const ROCK = hex('#5C6B78');
const ROCK_LIGHT = hex('#7F8E9A');
const LIGHT = hex('#FFF4C2');
const HULL = hex('#13202C');
const SAIL = hex('#FFFFFF');
const SAIL2 = hex('#E8B478'); // CTeen tan
const CLOUD = hex('#FFFFFF');

// Logo placement: centered, a bit above the middle, with a white frame and soft shadow.
const LH = 0.585, LW = LH * (logo.w / logo.h);
const LX0 = 0.5 - LW / 2, LY0 = 0.175, LX1 = LX0 + LW, LY1 = LY0 + LH;
const LR = LW * (20 / 299); // the logo's own corner radius
const FRAME = 0.016;

function logoColor(x, y) {
  const u = ((x - LX0) / LW) * logo.w - 0.5, v = ((y - LY0) / LH) * logo.h - 0.5;
  const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
  const at = (xx, yy, c) => logo.data[(clamp(yy, 0, logo.h - 1) * logo.w + clamp(xx, 0, logo.w - 1)) * 4 + c];
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) out[c] = at(x0, y0, c) * (1 - fx) * (1 - fy) + at(x0 + 1, y0, c) * fx * (1 - fy) + at(x0, y0 + 1, c) * (1 - fx) * fy + at(x0 + 1, y0 + 1, c) * fx * fy;
  return out;
}

const clouds = [
  [0.13, 0.17, 0.065], [0.2, 0.15, 0.08], [0.27, 0.175, 0.06],
  [0.76, 0.11, 0.05], [0.83, 0.095, 0.065], [0.89, 0.115, 0.048],
];

function scene(x, y) {
  let c;
  // Sky
  if (y < HORIZON) {
    const t = y / HORIZON;
    c = t < 0.55 ? mix(SKY_TOP, SKY_MID, t / 0.55) : mix(SKY_MID, SKY_LOW, (t - 0.55) / 0.45);
    // Sun glow behind the logo
    const d = Math.hypot(x - 0.5, (y - 0.6) * 1.05);
    c = mix(c, SUN, 0.55 * (1 - smooth(0.0, 0.42, d)));
    if (d < 0.2) c = mix(c, SUN, 0.9);
    // Clouds (soft rounded puffs)
    for (const [cx, cy, r] of clouds) {
      const k = (1 - smooth(r * 0.82, r, Math.hypot((x - cx) * 0.85, y - cy))) * (1 - smooth(cy + r * 0.25, cy + r * 0.5, y));
      if (k > 0) c = mix(c, CLOUD, 0.92 * k);
    }
    // Distant Long Island shoreline
    const shoreTop = HORIZON - 0.022 - 0.012 * Math.sin(x * 9.0) - 0.008 * Math.sin(x * 23 + 1);
    if (y > shoreTop) c = mix(c, SHORE, 0.85);
  } else {
    // Water
    const t = (y - HORIZON) / (1 - HORIZON);
    c = mix(WATER_TOP, WATER_DEEP, Math.pow(t, 0.8));
    // Sun reflection: broken light streaks under the sun
    const spread = 0.05 + t * 0.22;
    const dx = Math.abs(x - 0.5);
    const band = Math.sin(y * 210) * 0.5 + 0.5;
    if (dx < spread && band > 0.55) c = mix(c, SUN, 0.55 * (1 - dx / spread));
    // Gentle wave lines
    const w = Math.sin(x * 40 + y * 120) * Math.sin(y * 90);
    if (w > 0.93) c = mix(c, [255, 255, 255], 0.25);
  }

  // Stepping Stones Lighthouse on its rock island (right side)
  const bx0 = 0.735, bx1 = 0.895, by0 = 0.575, by1 = 0.655;
  if (Math.hypot((x - 0.815) / 0.11, (y - 0.668) / 0.03) < 1) c = mix(ROCK, ROCK_LIGHT, clamp((0.668 - y) / 0.03));
  if (x > bx0 && x < bx1 && y > by0 && y < by1) {
    c = BRICK;
    if ((Math.floor(y * 220) % 2 === 0) && Math.abs(Math.sin(x * 300)) > 0.96) c = BRICK_DARK; // brick lines
    if ((x > 0.755 && x < 0.775 && y > 0.6 && y < 0.63) || (x > 0.855 && x < 0.875 && y > 0.6 && y < 0.63)) c = TRIM; // windows
    if (x > 0.805 && x < 0.825 && y > 0.615) c = BRICK_DARK; // door
  }
  if (inTri(x, y, bx0 - 0.012, by0, bx1 + 0.012, by0, 0.815, by0 - 0.035)) c = ROOF; // house roof
  if (x > 0.795 && x < 0.835 && y > 0.48 && y < 0.565) c = x < 0.815 ? BRICK : BRICK_DARK; // tower
  if (x > 0.79 && x < 0.84 && y > 0.474 && y < 0.484) c = TRIM; // gallery rail
  if (x > 0.8 && x < 0.83 && y > 0.448 && y < 0.474) c = LIGHT; // lantern
  if (inTri(x, y, 0.795, 0.449, 0.835, 0.449, 0.815, 0.425)) c = ROOF; // lantern cap
  // lamp glow
  const g = Math.hypot(x - 0.815, y - 0.461);
  if (g < 0.06 && !(x > 0.795 && x < 0.835 && y > 0.425 && y < 0.565)) c = mix(c, LIGHT, 0.45 * (1 - g / 0.06));

  // Sailboat (left side), two-tone sails in CTeen blue/tan spirit
  const sx = 0.17, sy = 0.735;
  if (inTri(x, y, sx - 0.075, sy, sx + 0.085, sy, sx + 0.06, sy + 0.028) || inTri(x, y, sx - 0.075, sy, sx + 0.06, sy + 0.028, sx - 0.055, sy + 0.028)) c = HULL;
  if (x > sx + 0.003 && x < sx + 0.011 && y > sy - 0.2 && y < sy) c = HULL; // mast
  if (inTri(x, y, sx + 0.015, sy - 0.195, sx + 0.015, sy - 0.012, sx + 0.1, sy - 0.012)) c = SAIL;
  if (inTri(x, y, sx - 0.001, sy - 0.17, sx - 0.001, sy - 0.012, sx - 0.07, sy - 0.012)) c = SAIL2;
  // boat reflection
  if (y > sy + 0.03 && y < sy + 0.06 && Math.abs(x - sx) < 0.06 && Math.sin(y * 260) > 0.3) c = mix(c, HULL, 0.25);

  // Logo shadow
  const sh = 0.03;
  if (inRoundRect(x, y, LX0 - FRAME, LY0 - FRAME + 0.018, LX1 + FRAME, LY1 + FRAME + 0.018, LR + FRAME + sh * 0.2)) c = mix(c, [10, 40, 70], 0.28);
  // White frame
  if (inRoundRect(x, y, LX0 - FRAME, LY0 - FRAME, LX1 + FRAME, LY1 + FRAME, LR + FRAME)) c = TRIM;
  // Logo
  if (inRoundRect(x, y, LX0, LY0, LX1, LY1, LR)) c = logoColor(x, y);
  return c;
}

const out = Buffer.alloc(S * S * 4);
for (let py = 0; py < S; py++) {
  for (let px = 0; px < S; px++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const c = scene((px + (i + 0.5) / SS) / S, (py + (j + 0.5) / SS) / S);
      r += c[0]; g += c[1]; b += c[2];
    }
    const o = (py * S + px) * 4, n = SS * SS;
    out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(b / n); out[o + 3] = 255;
  }
}
fs.writeFileSync(OUT, encode(S, S, out));

// Small preview at home-screen size, to check it still reads when tiny.
const P = 180, prev = Buffer.alloc(P * P * 4);
for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
  const sx0 = Math.floor((x * S) / P), sy0 = Math.floor((y * S) / P), step = Math.floor(S / P);
  const acc = [0, 0, 0]; let n = 0;
  for (let j = 0; j < step; j++) for (let i = 0; i < step; i++) { const o = ((sy0 + j) * S + sx0 + i) * 4; acc[0] += out[o]; acc[1] += out[o + 1]; acc[2] += out[o + 2]; n++; }
  const o = (y * P + x) * 4; prev[o] = acc[0] / n; prev[o + 1] = acc[1] / n; prev[o + 2] = acc[2] / n; prev[o + 3] = 255;
}
const previewPath = process.argv[2];
if (previewPath) fs.writeFileSync(previewPath, encode(P, P, prev));
console.log('icon.png written');
