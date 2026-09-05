/* ═══════════════════════════════════════════════════════════════════════
   stats.js — the primitives this series needs and lab.js does not have.

   lab.js is the options engine, inherited whole: Black–Scholes, Fig/axes/line,
   sliders, the teaching layer, LAB.boot. This adds the statistics on top —
   distributions, samplers, summary statistics, the odds conversions, and the
   two chart types a probability page lives on (histograms and bars).

   Two rules that matter here more than they did there:

   1. **Every figure that draws random data must be reproducible.** A page that
      shows a different histogram on every load cannot have a number in its
      prose. Use rng(seed) for anything the text describes, and Math.random
      only for things the reader re-rolls themselves.

   2. **Nothing here rounds silently.** Odds conversions especially: a bookmaker's
      overround is a small number extracted from large ones, and rounding the
      implied probabilities before summing them destroys it.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── reproducible randomness ─────────────────────────────────────────────
   A 32-bit xorshift. Fast, adequate for teaching figures, and identical on
   every machine — which is the entire point. rng(7) always gives the same
   sequence, so a number written into the prose stays true. */
function rng(seed) {
  let s = (seed | 0) || 2463534242;
  const next = () => {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    return ((s >>> 0) / 4294967296);
  };
  next.uniform = (a, b) => a + (b - a) * next();
  next.int = n => Math.floor(next() * n);
  /* Box–Muller, with the spare kept so pairs cost one pass */
  let spare = null;
  next.normal = (mu, sd) => {
    mu = mu === undefined ? 0 : mu; sd = sd === undefined ? 1 : sd;
    if (spare !== null) { const z = spare; spare = null; return mu + sd * z; }
    let u = 0, v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return mu + sd * m * Math.cos(2 * Math.PI * v);
  };
  next.bernoulli = p => (next() < p ? 1 : 0);
  next.binomial = (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (next() < p) k++; return k; };
  next.pick = arr => arr[Math.floor(next() * arr.length)];
  next.shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  return next;
}

/* ── summary statistics ──────────────────────────────────────────────────
   Variance uses the two-pass form. The one-pass shortcut loses precision
   exactly where a volatility calculation needs it — on a long series of
   numbers whose mean is far from zero. */
const mean = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; };
function variance(a, sample) {
  const n = a.length, m = mean(a);
  let s = 0;
  for (let i = 0; i < n; i++) { const d = a[i] - m; s += d * d; }
  return s / (sample === false ? n : n - 1);
}
const sd = (a, sample) => Math.sqrt(variance(a, sample));
function quantile(a, q) {
  const s = Array.prototype.slice.call(a).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}
const median = a => quantile(a, 0.5);
function corr(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx, b = y[i] - my;
    sxy += a * b; sxx += a * a; syy += b * b;
  }
  return sxy / Math.sqrt(sxx * syy);
}
const cov = (x, y) => {
  const mx = mean(x), my = mean(y);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (x.length - 1);
};
/* least squares, returned as the line a reader would draw */
function fitLine(x, y) {
  const b = cov(x, y) / variance(x);
  const a = mean(y) - b * mean(x);
  return { slope: b, intercept: a, r: corr(x, y), r2: Math.pow(corr(x, y), 2) };
}
function skewness(a) {
  const m = mean(a), s = sd(a, false), n = a.length;
  let t = 0; for (let i = 0; i < n; i++) t += Math.pow((a[i] - m) / s, 3);
  return t / n;
}
/* excess kurtosis — 0 for a normal, which is the comparison anyone wants */
function kurtosis(a) {
  const m = mean(a), s = sd(a, false), n = a.length;
  let t = 0; for (let i = 0; i < n; i++) t += Math.pow((a[i] - m) / s, 4);
  return t / n - 3;
}

/* ── distributions ───────────────────────────────────────────────────────
   Log-gamma via Lanczos, so factorials of 300 do not overflow and the
   binomial still works at n = 1000. */
const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < 8; i++) x += LANCZOS[i] / (z + i + 1);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
const choose = (n, k) => (k < 0 || k > n) ? 0 : Math.round(Math.exp(lchoose(n, k)));

const dbinom = (k, n, p) => (k < 0 || k > n) ? 0
  : Math.exp(lchoose(n, k) + (p > 0 ? k * Math.log(p) : (k ? -Infinity : 0))
    + (p < 1 ? (n - k) * Math.log(1 - p) : ((n - k) ? -Infinity : 0)));
function pbinom(k, n, p) { let s = 0; for (let i = 0; i <= k; i++) s += dbinom(i, n, p); return s; }
const dpois = (k, l) => Math.exp(-l + k * Math.log(l) - lgamma(k + 1));
function ppois(k, l) { let s = 0; for (let i = 0; i <= k; i++) s += dpois(i, l); return s; }
const dnorm = (x, mu, s) => npdf(((x - (mu || 0)) / (s === undefined ? 1 : s))) / (s === undefined ? 1 : s);
const pnorm = (x, mu, s) => ncdf((x - (mu || 0)) / (s === undefined ? 1 : s));
/* the standard normal quantile — Acklam's rational approximation, good to
   about 1.15e-9, which is far past anything a figure can show */
function qnorm(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00];
  const pl = 0.02425, ph = 1 - pl;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > ph) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
/* Student's t — the fat-tailed comparison the whole series leans on */
const dt = (x, v) => Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2)) /
  Math.sqrt(v * Math.PI) * Math.pow(1 + x * x / v, -(v + 1) / 2);
const dlnorm = (x, mu, s) => x <= 0 ? 0 : dnorm(Math.log(x), mu, s) / x;
const dexp = (x, l) => x < 0 ? 0 : l * Math.exp(-l * x);
const dbeta = (x, a, b) => (x <= 0 || x >= 1) ? 0
  : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)
    + lgamma(a + b) - lgamma(a) - lgamma(b));

/* ── odds ────────────────────────────────────────────────────────────────
   Three notations for one number, and the conversions people get wrong.
   Decimal odds include the stake; fractional and American do not, which is
   the whole source of the confusion. */
const decToProb = d => 1 / d;
const probToDec = p => 1 / p;
const fracToProb = (num, den) => den / (num + den);
const probToFrac = p => ({ num: (1 - p), den: p, text: fmtFrac((1 - p) / p) });
const usToProb = a => a > 0 ? 100 / (a + 100) : (-a) / ((-a) + 100);
const probToUS = p => p >= 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p);
const decToUS = d => probToUS(decToProb(d));
const usToDec = a => probToDec(usToProb(a));
/* the bookmaker's margin: implied probabilities sum to more than one, and the
   excess is the take. Never round the parts before adding them. */
const overround = probs => probs.reduce((a, b) => a + b, 0) - 1;
/* strip the margin proportionally — the simplest of several conventions, and
   the one that is wrong in a specific direction the page shows */
const devig = probs => { const t = probs.reduce((a, b) => a + b, 0); return probs.map(p => p / t); };
function fmtFrac(x) {
  /* nearest tidy fraction, the way a board would print it */
  const cands = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 20, 25, 33, 40, 50, 66, 100];
  let best = null, err = Infinity;
  for (const den of cands) {
    const num = Math.round(x * den);
    if (num < 1) continue;
    const e = Math.abs(num / den - x);
    if (e < err - 1e-12) { err = e; best = num + "/" + den; }
  }
  return best || "1/1";
}

/* ── charts the options engine did not need ──────────────────────────── */
/* scatter — spreading.html had a local copy; it belongs here */
function dots(o, xs, ys, col, r, alpha) {
  const g = o.g; g.save();
  g.fillStyle = col;
  if (alpha !== undefined) g.globalAlpha = alpha;
  for (let i = 0; i < xs.length; i++) {
    if (!isFinite(ys[i])) continue;
    g.beginPath(); g.arc(o.X(xs[i]), o.Y(ys[i]), r || 2, 0, 6.2832); g.fill();
  }
  g.restore();
}
/* bins a sample and returns counts, so the caller can label and colour them */
function binned(values, lo, hi, n) {
  const w = (hi - lo) / n, counts = new Float64Array(n);
  for (let i = 0; i < values.length; i++) {
    const k = Math.floor((values[i] - lo) / w);
    if (k >= 0 && k < n) counts[k]++;
  }
  return { counts, w, lo, hi, n, centres: Array.from(counts, (_, i) => lo + (i + 0.5) * w) };
}
/* a histogram, drawn from a binned() result. `norm` true scales to a density
   so it can be compared against a pdf on the same axes. */
function hist(o, b, col, opt) {
  opt = opt || {};
  const g = o.g, total = Array.prototype.reduce.call(b.counts, (a, c) => a + c, 0) || 1;
  const scale = opt.norm ? 1 / (total * b.w) : 1;
  g.save();
  g.fillStyle = col;
  g.globalAlpha = opt.alpha === undefined ? 0.78 : opt.alpha;
  for (let i = 0; i < b.n; i++) {
    if (!b.counts[i]) continue;
    const h = b.counts[i] * scale;
    const x0 = o.X(b.lo + i * b.w), x1 = o.X(b.lo + (i + 1) * b.w);
    const y = o.Y(h), base = o.Y(0);
    g.fillRect(x0, y, Math.max(x1 - x0 - (opt.gap === undefined ? 0.8 : opt.gap), 1), base - y);
  }
  g.restore();
}
/* discrete bars, for a binomial or a Poisson where the x values are integers */
function bars(o, xs, hs, col, opt) {
  opt = opt || {};
  const g = o.g;
  const w = opt.width !== undefined ? opt.width
    : (xs.length > 1 ? Math.abs(o.X(xs[1]) - o.X(xs[0])) * 0.74 : 10);
  g.save();
  g.fillStyle = col;
  g.globalAlpha = opt.alpha === undefined ? 0.85 : opt.alpha;
  const base = o.Y(0);
  for (let i = 0; i < xs.length; i++) {
    if (!isFinite(hs[i]) || hs[i] <= 0) continue;
    const y = o.Y(hs[i]);
    g.fillRect(o.X(xs[i]) - w / 2, y, Math.max(w, 1), base - y);
  }
  g.restore();
}
/* a horizontal reference line — the counterpart of vline, wanted constantly
   on a page about expected values */
function hline(o, y, col, label, dash) {
  if (y < o.y0 || y > o.y1) return;
  const g = o.g; g.save();
  g.strokeStyle = col; g.lineWidth = 1; g.setLineDash(dash || [4, 3]);
  const py = Math.round(o.Y(y)) + 0.5;
  g.beginPath(); g.moveTo(o.P.l, py); g.lineTo(o.P.l + o.pw, py); g.stroke();
  if (label) {
    g.setLineDash([]); g.fillStyle = col; g.textAlign = "left"; g.textBaseline = "bottom";
    g.font = "9.5px 'IBM Plex Mono', monospace";
    g.fillText(label, o.P.l + 4, py - 3);
  }
  g.restore();
}
/* shade the area under a curve between two x values — how a probability is
   shown on a density, and the series does it on nearly every page */
function shade(o, f, a, b, col, alpha) {
  const g = o.g; g.save();
  g.beginPath(); g.rect(o.P.l, o.P.t, o.pw, o.ph); g.clip();
  g.fillStyle = col; g.globalAlpha = alpha === undefined ? 0.18 : alpha;
  g.beginPath();
  const n = 220;
  g.moveTo(o.X(a), o.Y(0));
  for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; g.lineTo(o.X(x), o.Y(f(x))); }
  g.lineTo(o.X(b), o.Y(0));
  g.closePath(); g.fill();
  g.restore();
}
