// Builds assets/icon.png (1024x1024, opaque) from assets/logo.png — no image libs.
'use strict';
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.cjs');
const logo = decode(fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.png')));
const S = 1024, H = 800, W = Math.round((H * logo.w) / logo.h), ox = (S - W) >> 1, oy = (S - H) >> 1;
const out = Buffer.alloc(S * S * 4, 255);
const at = (x, y, c) => logo.data[(Math.min(logo.h - 1, Math.max(0, y)) * logo.w + Math.min(logo.w - 1, Math.max(0, x))) * 4 + c];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const sx = ((x + 0.5) * logo.w) / W - 0.5, sy = ((y + 0.5) * logo.h) / H - 0.5, x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
  const o = ((y + oy) * S + x + ox) * 4;
  for (let c = 0; c < 3; c++) out[o + c] = Math.round(at(x0, y0, c) * (1 - fx) * (1 - fy) + at(x0 + 1, y0, c) * fx * (1 - fy) + at(x0, y0 + 1, c) * (1 - fx) * fy + at(x0 + 1, y0 + 1, c) * fx * fy);
}
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), encode(S, S, out));
console.log('icon.png written');
