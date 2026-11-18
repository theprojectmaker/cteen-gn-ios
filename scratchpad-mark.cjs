const sharp = require('sharp');
(async () => {
  const { data, info } = await sharp('assets/icon.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const bg = [data[0], data[1], data[2]];
  const near = (i) => Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) < 90;
  const seen = new Uint8Array(W * H); const q = [];
  const push = (x, y) => { const p = y * W + x; if (!seen[p] && near(p * C)) { seen[p] = 1; q.push(p); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (q.length) { const p = q.pop(); const x = p % W, y = (p / W) | 0; if (x) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y) push(x, y - 1); if (y < H - 1) push(x, y + 1); }
  let cleared = 0;
  for (let p = 0; p < W * H; p++) if (seen[p]) { data[p * C + 3] = 0; cleared++; }
  await sharp(data, { raw: { width: W, height: H, channels: C } }).trim().resize(640, null, { fit: 'inside' }).png({ compressionLevel: 9 }).toFile('assets/mark.png');
  console.log('cleared', cleared, 'of', W * H);
})();
