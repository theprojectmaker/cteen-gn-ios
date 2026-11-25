// The Flyer look's brush stroke: a rough painted shape drawn as ONE plain SVG path, so it works in
// react-native-svg on iPhone and in the browser (no SVG filters). Same seed, same stroke.

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n: number) => Math.round(n * 10) / 10;

// A painted stroke that fills a w x h box. The solid body covers the left side; the right end
// frays into dry-brush tails, with a few loose streaks. Put the text from x = 13 to x = w - 40.
export function brushPath(w: number, h: number, seed = 7): string {
  const r = rng(seed);
  const j = (a: number) => (r() - 0.5) * 2 * a;
  const body = w - Math.min(34, Math.max(18, w * 0.13)); // the tails live to the right of this
  const n = Math.max(5, Math.round(body / 22));
  const top: number[][] = [];
  const bot: number[][] = [];
  for (let i = 0; i <= n; i++) top.push([(body * i) / n, h * 0.09 + j(h * 0.05) + Math.sin(i * 1.1 + seed) * h * 0.025]);
  for (let i = n; i >= 0; i--) bot.push([(body * i) / n, h * 0.9 + j(h * 0.055) + Math.sin(i * 0.8 + seed * 2) * h * 0.03]);
  // a run of points joined with soft curves through the midpoints
  const smooth = (pts: number[][]) => {
    let d = '';
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
    }
    const last = pts[pts.length - 1];
    return d + `L${f(last[0])} ${f(last[1])}`;
  };
  let d = `M${f(top[0][0] + 3)} ${f(top[0][1] + 2)}` + smooth(top);
  // right end: four tails of different lengths, with gaps cut back into the body
  const tails = 4;
  const y0 = top[top.length - 1][1];
  const y1 = bot[0][1];
  const band = (y1 - y0) / tails;
  for (let k = 0; k < tails; k++) {
    const a = y0 + band * k;
    const b = a + band * (0.56 + r() * 0.2);
    const len = (w - body) * (0.45 + r() * 0.55);
    d += `L${f(body + len)} ${f(a + band * 0.1 + j(1))}L${f(body + len + 2 + r() * 3)} ${f((a + b) / 2)}L${f(body + len - 1)} ${f(b)}`;
    if (k < tails - 1) d += `L${f(body - 2 - r() * 7)} ${f(b + (band - (b - a)) * 0.5)}`;
  }
  d += `L${f(bot[0][0])} ${f(bot[0][1])}` + smooth(bot);
  // left end: a slightly ragged start
  const lx = bot[bot.length - 1][0];
  const ly = bot[bot.length - 1][1];
  d += `L${f(lx - 1 + j(1))} ${f(ly - h * 0.2)}L${f(lx - 3.5 + j(1))} ${f(h * 0.52 + j(2))}L${f(lx - 1 + j(1))} ${f(h * 0.3)}Z`;
  // loose dry streaks past the tails, and one under the body
  for (let k = 0; k < 3; k++) {
    const y = h * (0.18 + 0.26 * k) + j(2);
    const x = body + (w - body) * (0.55 + r() * 0.3);
    const len = 5 + r() * 9;
    const th = 1.2 + r() * 1.2;
    d += `M${f(x)} ${f(y)}l${f(len)} ${f(-0.6)}l${f(1.5)} ${f(th)}l${f(-len - 1)} ${f(0.5)}Z`;
  }
  const sx = w * (0.08 + r() * 0.1);
  d += `M${f(sx)} ${f(h * 0.985)}l${f(w * 0.16)} ${f(-1)}l${f(2)} ${f(1.8)}l${f(-w * 0.15)} ${f(0.8)}Z`;
  return d;
}
