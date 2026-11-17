// Icon maker for CTeen GN. Serves index.html (which draws the icon on a canvas)
// and saves what it draws to assets/icon.png.
// Run: node scripts/icon/serve.cjs   then open http://localhost:8177 and press Save.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('../png.cjs');

const PORT = Number(process.argv[2]) || 8177;
const here = __dirname;
const assets = path.join(here, '..', '..', 'assets');
const files = {
  '/': [path.join(here, 'index.html'), 'text/html; charset=utf-8'],
  '/logo.png': [path.join(assets, 'logo.png'), 'image/png'],
};

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 8e6) req.destroy();
      else chunks.push(c);
    });
    req.on('end', () => {
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(Buffer.concat(chunks).toString());
      if (!m) {
        res.writeHead(400).end('bad image');
        return;
      }
      const img = decode(Buffer.from(m[1], 'base64'));
      const png = encode(img.w, img.h, img.data, { rgb: true }); // no alpha channel
      fs.writeFileSync(path.join(assets, 'icon.png'), png);
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`saved ${png.length} bytes`);
    });
    return;
  }
  const f = files[req.url.split('?')[0]];
  if (!f) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': f[1], 'Cache-Control': 'no-store' });
  fs.createReadStream(f[0]).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Icon maker on http://localhost:${PORT}`));
