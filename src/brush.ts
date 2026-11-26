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

/** How much of the right end of a stroke `w` wide is dry streaks only: keep words to the left of it. */
export const brushTail = (w: number) => Math.min(24, Math.max(15, w * 0.1));

// A painted stroke that fills a w x h box, shaped like the one on the mockup: a thick bar, a touch
// fatter in the middle, whose top and bottom edges are slow waves and whose two ends are torn by
// the bristles. The left end is blunt, with a notch or two; the right end runs out into four dry
// streaks (the last brushTail(w) points), with a couple of loose ones beside them and one under
// the bar.
export function brushPath(w: number, h: number, seed = 7): string {
  const r = rng(seed);
  const j = (a: number) => (r() - 0.5) * 2 * a;
  const tail = brushTail(w);
  const left = Math.min(5, w * 0.04); // the bar starts here; its bristles reach back toward 0
  const right = w - tail; // the solid bar ends here
  const top = h * 0.125;
  const bottom = h * 0.915;
  const bow = h * 0.04;
  const n = Math.max(4, Math.round((right - left) / 26));
  const along = (i: number) => left + ((right - left) * i) / n;

  // a run of points joined with soft curves through their midpoints
  const smooth = (pts: number[][]) => {
    let d = '';
    for (let i = 1; i < pts.length - 1; i++) {
      d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`;
    }
    const last = pts[pts.length - 1];
    return d + `L${f(last[0])} ${f(last[1])}`;
  };
  // uneven steps from a to b (each `lo` to `hi` long), like the gaps between bristles
  const steps = (a: number, b: number, lo: number, hi: number) => {
    const out = [a];
    const dir = b > a ? 1 : -1;
    for (;;) {
      const next = out[out.length - 1] + dir * (lo + r() * (hi - lo));
      if ((b - next) * dir < lo * 0.7) break;
      out.push(next);
    }
    out.push(b);
    return out;
  };

  // top edge, left to right
  const topEdge: number[][] = [];
  for (let i = 0; i <= n; i++) topEdge.push([along(i), top - bow * Math.sin((Math.PI * i) / n) + j(h * 0.02)]);
  topEdge[0][1] += h * 0.045; // the brush comes down a little narrower where it first touches
  let d = `M${f(topEdge[0][0])} ${f(topEdge[0][1])}` + smooth(topEdge);

  // right end, top to bottom: an uneven torn edge, with four bristle marks drawn out into streaks
  const y0 = topEdge[n][1];
  const y1 = bottom + j(h * 0.015);
  const ys = steps(y0, y1, 2.8, 5);
  const picks = [0.16 + r() * 0.07, 0.38 + r() * 0.07, 0.6 + r() * 0.07, 0.82 + r() * 0.06].map((t) => y0 + (y1 - y0) * t);
  const streaks = new Set(picks.map((y) => { let best = 0; for (let k = 0; k < ys.length - 1; k++) if (Math.abs((ys[k] + ys[k + 1]) / 2 - y) < Math.abs((ys[best] + ys[best + 1]) / 2 - y)) best = k; return best; }));
  for (let k = 0; k < ys.length - 1; k++) {
    const a = ys[k], b = ys[k + 1];
    const bulge = 2.4 * Math.sin((Math.PI * ((a + b) / 2 - y0)) / (y1 - y0));
    const edge = right + bulge;
    if (streaks.has(k)) {
      const tip = right + tail * (0.62 + r() * 0.38);
      const cut = edge - 1 - r() * 2.5; // the gap above a streak reaches a little way back into the bar
      d += `L${f(cut)} ${f(a)}L${f(tip - 5 - r() * 4)} ${f(a + (b - a) * 0.12 + j(0.3))}L${f(tip)} ${f(a + (b - a) * (0.42 + r() * 0.2))}L${f(tip - 6 - r() * 5)} ${f(b - (b - a) * 0.08)}L${f(edge - 0.5 - r() * 2)} ${f(b)}`;
    } else {
      d += `L${f(edge - r() * 1.6)} ${f(a + (b - a) * 0.1)}L${f(edge + 0.4 + r() * 1.8)} ${f(a + (b - a) * (0.4 + r() * 0.3))}`;
    }
  }

  // bottom edge, right to left
  const botEdge: number[][] = [];
  for (let i = n; i >= 0; i--) botEdge.push([along(i), bottom + bow * 0.7 * Math.sin((Math.PI * i) / n) + j(h * 0.02)]);
  botEdge[0][1] = y1;
  d += `L${f(botEdge[0][0])} ${f(botEdge[0][1])}` + smooth(botEdge);

  // left end, bottom to top: blunt and a little round, roughened, with two notches cut into it
  const ly1 = botEdge[n][1];
  const ly0 = topEdge[0][1];
  const lys = steps(ly1, ly0, 2.6, 5.6);
  const notches = new Set([Math.max(1, Math.round((lys.length - 2) * (0.24 + r() * 0.12))), Math.round((lys.length - 2) * (0.6 + r() * 0.14))]);
  for (let k = 0; k < lys.length - 1; k++) {
    const a = lys[k], b = lys[k + 1];
    const bulge = (left - 0.8) * Math.sin((Math.PI * (ly1 - (a + b) / 2)) / (ly1 - ly0));
    const edge = Math.max(0.2, left - bulge);
    if (notches.has(k)) {
      const depth = 3 + r() * 4;
      d += `L${f(edge + r() * 0.8)} ${f(a - (a - b) * 0.2)}L${f(edge + depth)} ${f(a - (a - b) * (0.45 + r() * 0.15))}L${f(edge + 0.3 + r() * 0.8)} ${f(a - (a - b) * 0.8)}`;
    } else {
      d += `L${f(edge + r() * 1.5)} ${f(a - (a - b) * 0.15)}L${f(Math.max(0, edge - 0.3 - r() * 1.3))} ${f(a - (a - b) * (0.45 + r() * 0.3))}`;
    }
  }
  d += 'Z';

  // loose dry streaks: two beside the streaks at the right end, one under the bar
  for (let k = 0; k < 2; k++) {
    const y = y0 + (y1 - y0) * (0.28 + 0.42 * k + j(0.04));
    const x = right + tail * (0.4 + r() * 0.3);
    const len = 5 + r() * (tail * 0.35);
    const th = 1 + r() * 0.9;
    d += `M${f(x)} ${f(y)}l${f(len)} ${f(-0.5)}l${f(1.6)} ${f(th * 0.6)}l${f(-len - 1.2)} ${f(th * 0.7)}Z`;
  }
  const sx = w * (0.1 + r() * 0.14);
  const sl = Math.min(42, w * (0.13 + r() * 0.06));
  d += `M${f(sx)} ${f(h * 0.968)}l${f(sl)} ${f(-1.1)}l${f(1.8)} ${f(1.5)}l${f(-sl * 0.94)} ${f(1)}Z`;
  return d;
}
