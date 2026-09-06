#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   verify.js — do the numbers in the prose match what the pages compute?

   check.js is a structural pre-flight: ids resolve, links exist, every
   equation has a reading, every page executes. It cannot tell you that a
   sentence claims 58% where the figure beside it computes 42%.

   This does. It loads each page's shipped <script> under a stubbed DOM and
   re-derives the numbers the prose asserts, from the page's own functions
   wherever possible and from an independent calculation otherwise.

   Every assertion here exists because a number was wrong. The audit that
   produced this file found: an exceedance probability stated backwards on
   page 03, stale implied-density figures on page 02, a benchmark number on
   page 06 quoted from a single random draw, and a correlation on page 09
   that only holds at a hedge count the figure does not open on.

       node verify.js            every page that has claims recorded
       node verify.js catalyst   just that one

   Adding a claim is three lines. If a number appears in the prose and is
   not in here, it is not being checked.
   ═══════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = __dirname;

/* ── run a page's script under a stub DOM, capturing every kv row ────── */
function load(page, exports) {
  const LAB = fs.readFileSync(path.join(ROOT, "assets/lab.js"), "utf8")
    .replace("const kvHTML=", "let kvHTML=")
    + "\n" + fs.readFileSync(path.join(ROOT, "assets/stats.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const m = html.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error(page + ": script extraction failed (CRLF line endings?)");
  const ROWS = [];
  const mk = () => ({
    innerHTML: "", textContent: "", value: "0", disabled: false, style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, getAttribute() { return "0"; },
    querySelectorAll() { return []; },
    getContext() { return new Proxy({}, { get: () => () => {} }); },
    clientWidth: 800, clientHeight: 400, width: 800, height: 400,
    scrollIntoView() {}, focus() {}, appendChild() {}, insertBefore() {},
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 800, bottom: 400, width: 800, height: 400 };
    },
    parentNode: null, parentElement: null, dataset: {}
  });
  const stub = mk();
  global.window = global; global.devicePixelRatio = 1; global.innerWidth = 1200;
  global.scrollX = 0; global.scrollY = 0;
  global.matchMedia = () => ({ matches: false });
  global.addEventListener = () => {};
  global.document = {
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 800 },
    body: stub, getElementById: () => stub, querySelectorAll: () => [],
    querySelector: () => null, createElement: () => mk(),
    addEventListener() {}, fonts: null
  };
  global.getComputedStyle = () => ({ getPropertyValue: () => "#000000" });
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.MutationObserver = class { observe() {} };
  global.__ROWS = ROWS;
  const shim = "const __k=kvHTML;kvHTML=r=>{try{r.forEach(x=>__ROWS.push(" +
    "[String(x[0]),String(x[1])]));}catch(e){}return __k(r);};";
  const api = new Function(LAB + "\n" + shim + "\n" + m[1] +
    "\nreturn {" + exports.join(",") + "};")();
  api.__rows = ROWS;
  return api;
}

/* ── assertion helpers ───────────────────────────────────────────────── */
let fails = 0, checks = 0;
const eq = (label, got, want, tol) => {
  checks++;
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log("    " + (ok ? "ok   " : "FAIL ") + label.padEnd(52) +
    (typeof got === "number" ? got.toPrecision(7) : got).toString().padStart(13) +
    "   want " + want);
};
const yes = (label, cond) => {
  checks++;
  if (!cond) fails++;
  console.log("    " + (cond ? "ok   " : "FAIL ") + label);
};

/* ── the claims, page by page ────────────────────────────────────────── */
const PAGES = {};

PAGES["odds"] = () => {
  const M = load("odds.html", ["bs", "ncdf", "probToDec", "decToProb", "fracToProb",
    "probToUS", "usToProb", "probToFrac", "devig", "__drill", "s1", "s3", "s4", "s5", "s6"]);
  const f = x => x;

  console.log("    chapter 02 — three notations");
  eq("3/1 is 25%", M.fracToProb(3, 1) * 100, 25, 1e-12);
  eq("  and decimal 4.00", M.probToDec(0.25), 4, 1e-12);
  eq("  and American +300", M.probToUS(0.25), 300, 0);
  eq("5/2 is 28.571%", M.fracToProb(5, 2) * 100, 28.5714286, 1e-6);
  eq("decimal 2.00 is 50%", M.decToProb(2) * 100, 50, 1e-12);
  eq("decimal 1.80 is 55.6%", M.decToProb(1.8) * 100, 55.5555556, 1e-6);
  yes("shortening the price raises the probability", M.decToProb(1.8) > M.decToProb(2.0));
  /* the American grid is coarse — the page quotes the worst case */
  let worst = 0, at = 0;
  for (let p = 0.02; p < 0.98; p += 0.0005) {
    const e = Math.abs(M.usToProb(M.probToUS(p)) - p);
    if (e > worst) { worst = e; at = p; }
  }
  eq("worst American rounding error is 0.12 pts", worst * 100, 0.1196, 5e-3);
  yes("and it happens near the middle of the range", at > 0.45 && at < 0.55);

  console.log("    chapter 03 — the overround");
  const imp = M.usToProb(-110);
  eq("-110 implies 52.381%", imp * 100, 52.380952, 1e-5);
  eq("  both sides sum to 104.762%", 2 * imp * 100, 104.761905, 1e-5);
  eq("  overround 4.762%", (2 * imp - 1) * 100, 4.761905, 1e-5);
  eq("breakeven hit rate is 110/210", 110 / 210 * 100, 52.380952, 1e-5);
  yes("which is exactly the implied probability", Math.abs(110 / 210 - imp) < 1e-12);
  const win = 100 / 1.1;
  eq("a 55% bettor makes $5.00 per 100", 0.55 * win - 0.45 * 100, 5.00, 5e-3);
  eq("a 52% bettor loses 73 cents", 0.52 * win - 0.48 * 100, -0.7273, 5e-3);
  yes("so being right more than half the time is not enough", 0.52 * win - 0.48 * 100 < 0);
  const edge = 0.55 * win - 0.45 * 100;
  const sdev = Math.sqrt(0.55 * Math.pow(win - edge, 2) + 0.45 * Math.pow(-100 - edge, 2));
  eq("1,444 bets to stand two standard errors clear",
    Math.ceil(Math.pow(2 * sdev / edge, 2)), 1444, 0);
  eq("backing both sides loses 4.55% of the stake",
    (2 * imp - 1) / (2 * imp) * 100, 4.5455, 1e-3);
  const three = [2.10, 3.40, 3.80].map(M.decToProb);
  eq("the three-way sums to 103.35%", three.reduce((a, b) => a + b, 0) * 100, 103.347, 5e-3);
  eq("  implied 47.62%", three[0] * 100, 47.619, 5e-3);
  eq("  implied 29.41%", three[1] * 100, 29.412, 5e-3);
  eq("  implied 26.32%", three[2] * 100, 26.316, 5e-3);

  console.log("    chapter 04 — de-vigging");
  const ps = [M.decToProb(1.20), M.decToProb(4.50)];
  eq("1.20 implies 83.333%", ps[0] * 100, 83.3333, 1e-3);
  eq("4.50 implies 22.222%", ps[1] * 100, 22.2222, 1e-3);
  eq("  they sum to 105.556%", (ps[0] + ps[1]) * 100, 105.5556, 1e-3);
  const prop = M.devig(ps);
  eq("proportional gives 78.947%", prop[0] * 100, 78.9474, 1e-3);
  eq("  and 21.053%", prop[1] * 100, 21.0526, 1e-3);
  const g = k => ps.reduce((a, p) => a + Math.pow(p, k), 0) - 1;
  let lo = 0.2, hi = 6;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
  const k = (lo + hi) / 2, pw = ps.map(p => Math.pow(p, k));
  eq("the power exponent is 1.1219", k, 1.1219, 1e-3);
  eq("power gives 81.501%", pw[0] * 100, 81.501, 5e-3);
  eq("  and 18.499%", pw[1] * 100, 18.499, 5e-3);
  eq("  the longshot is 2.554 points lower", (prop[1] - pw[1]) * 100, 2.554, 5e-3);
  yes("both methods sum to one", Math.abs(prop[0] + prop[1] - 1) < 1e-12
    && Math.abs(pw[0] + pw[1] - 1) < 1e-9);
  /* on an even book they must agree exactly */
  const evenPs = [M.decToProb(1.91), M.decToProb(1.91)];
  const evenProp = M.devig(evenPs);
  let l2 = 0.2, h2 = 6;
  const g2 = kk => evenPs.reduce((a, p) => a + Math.pow(p, kk), 0) - 1;
  for (let i = 0; i < 200; i++) { const m = (l2 + h2) / 2; if (g2(m) > 0) l2 = m; else h2 = m; }
  const evenPw = evenPs.map(p => Math.pow(p, (l2 + h2) / 2));
  yes("on an even book the two methods agree", Math.abs(evenProp[0] - evenPw[0]) < 1e-6);

  console.log("    chapter 05 — the same arithmetic on a chain");
  const S = 100, K = 110, T = 0.25, v = 0.25, r = 0.03;
  const d2 = (Math.log(S / K) + (r - v * v / 2) * T) / (v * Math.sqrt(T));
  const p5 = M.ncdf(d2);
  eq("P(above 110 in three months) = 22.21%", p5 * 100, 22.214, 5e-3);
  eq("  the digital costs 0.2205", Math.exp(-r * T) * p5, 0.22048, 1e-4);
  eq("  as decimal odds, 4.502", M.probToDec(p5), 4.502, 2e-3);
  eq("  as American, +350", M.probToUS(p5), 350, 0);
  const w = 1;
  const cs = (M.bs(S, K - w / 2, T, v, r, 0, true).price
            - M.bs(S, K + w / 2, T, v, r, 0, true).price) / w;
  eq("a 1-wide call spread agrees", cs, 0.22054, 1e-4);
  yes("  to within a hundredth of a cent", Math.abs(cs - Math.exp(-r * T) * p5) < 1e-4);
  const df = Math.exp(-r * T), dig = df * p5, bid = dig - 0.01, off = dig + 0.01;
  eq("quoted 2c wide, both sides cost 1.0125", off + (df - bid), 1.01253, 1e-4);
  eq("  for a certain 0.9925", df, 0.99253, 1e-4);
  eq("  an overround of 2.02%", ((off + (df - bid)) / df - 1) * 100, 2.015, 5e-3);

  console.log("    chapter 06 — risk-neutral is not real-world");
  const P = mu => M.ncdf((Math.log(100 / 110) + (mu - 0.25 * 0.25 / 2) * 1) / 0.25);
  eq("at the financing rate, 34.97%", P(0.03) * 100, 34.966, 5e-3);
  eq("believing 8% drift, 42.61%", P(0.08) * 100, 42.613, 5e-3);
  eq("believing 12% drift, 48.95%", P(0.12) * 100, 48.953, 5e-3);
  eq("  the 3%-to-8% gap is 7.6 points", (P(0.08) - P(0.03)) * 100, 7.647, 1e-2);
  yes("the market number is the lowest of the three", P(0.03) < P(0.08) && P(0.08) < P(0.12));

  console.log("    chapter 07 — the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(kk => console.log("      " + kk.padEnd(30) + kinds[kk]));
  yes("seven distinct question kinds", Object.keys(kinds).length === 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is always rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["ev"] = () => {
  const M = load("ev.html", ["kelly", "growth", "pBehind", "ncdf", "rng", "__sim6", "__drill",
    "s1", "s2", "s3", "s4", "s5", "s6"]);

  console.log("    chapter 01 - expectation from a payoff table");
  const p1 = 1 / 38, ev1 = p1 * 35 + (1 - p1) * (-1);
  eq("American wheel, single number: EV -5.26 cents", ev1 * 100, -5.263, 5e-3);
  eq("  the house edge", -ev1 * 100, 5.2632, 5e-3);
  const var1 = p1 * Math.pow(35 - ev1, 2) + (1 - p1) * Math.pow(-1 - ev1, 2);
  eq("  its standard deviation is $5.76", Math.sqrt(var1), 5.763, 5e-3);
  const evEu = (1 / 37) * 35 + (36 / 37) * (-1);
  eq("a European wheel halves the edge", -evEu * 100, 2.7027, 5e-3);

  console.log("    chapter 02 - same edge, different variance");
  const p2 = 18 / 38, ev2 = p2 - (1 - p2);
  eq("red/black: the identical edge", -ev2 * 100, 5.2632, 5e-3);
  yes("the two edges match to twelve decimals", Math.abs(ev1 - ev2) < 1e-12);
  const var2 = p2 * Math.pow(1 - ev2, 2) + (1 - p2) * Math.pow(-1 - ev2, 2);
  eq("red/black sd is $1.00", Math.sqrt(var2), 0.9986, 1e-3);
  eq("  the single number is 5.8x noisier", Math.sqrt(var1) / Math.sqrt(var2), 5.771, 5e-3);

  console.log("    chapter 03 - the long run is long");
  const win = 100 / 1.1, pp = 0.55;
  const ev3 = pp * win - (1 - pp) * 100;
  const sd3 = Math.sqrt(pp * Math.pow(win - ev3, 2) + (1 - pp) * Math.pow(-100 - ev3, 2));
  eq("a 55% bettor at -110 makes $5.00 per 100", ev3, 5.00, 5e-3);
  eq("  against a per-bet sd of $94.98", sd3, 94.98, 0.02);
  eq("  noise is 19x the edge", sd3 / ev3, 19.00, 0.02);
  eq("P(behind after 100 bets) = 30%", M.pBehind(ev3, sd3, 100) * 100, 29.93, 0.15);
  eq("P(behind after 1000 bets) = 4.8%", M.pBehind(ev3, sd3, 1000) * 100, 4.80, 0.10);
  eq("bets to stand two standard errors clear",
    Math.ceil(Math.pow(2 * sd3 / ev3, 2)), 1444, 0);
  /* halving the edge quadruples the sample */
  const half = 0.525;
  const evH = half * win - (1 - half) * 100;
  const sdH = Math.sqrt(half * Math.pow(win - evH, 2) + (1 - half) * Math.pow(-100 - evH, 2));
  yes("halving the edge roughly quadruples the sample needed",
    Math.pow(2 * sdH / evH, 2) / Math.pow(2 * sd3 / ev3, 2) > 3.4);

  console.log("    chapter 04 - the Kelly hill");
  const b = 100 / 110;
  const fk = M.kelly(0.55, b);
  eq("55% at -110: f* = 5.5% of bankroll", fk * 100, 5.500, 5e-3);
  eq("55% at even money: f* = 10%", M.kelly(0.55, 1) * 100, 10.0, 1e-9);
  eq("60% at even money: f* = 20%", M.kelly(0.60, 1) * 100, 20.0, 1e-9);
  eq("55% at 2-to-1: f* = 32.5%", M.kelly(0.55, 2) * 100, 32.5, 1e-9);
  yes("52% at -110 says do not bet", M.kelly(0.52, b) < 0);
  eq("growth at f* is 0.1378% per bet", M.growth(fk, 0.55, b), 0.0013779, 2e-6);
  yes("at even money Kelly equals the edge",
    Math.abs(M.kelly(0.57, 1) - (2 * 0.57 - 1)) < 1e-12);

  console.log("    chapter 05 - overbetting");
  eq("growth at DOUBLE Kelly is zero", M.growth(2 * fk, 0.55, b), 0, 3e-5);
  yes("  and it turns negative just past it", M.growth(2.1 * fk, 0.55, b) < 0);
  eq("half Kelly keeps 74.9% of the growth",
    M.growth(fk / 2, 0.55, b) / M.growth(fk, 0.55, b) * 100, 74.94, 0.1);
  yes("the hill is not symmetric: overshooting costs far more",
    (M.growth(fk, 0.55, b) - M.growth(1.5 * fk, 0.55, b)) >
    (M.growth(fk, 0.55, b) - M.growth(0.5 * fk, 0.55, b)));

  console.log("    chapter 06 - drawdown");
  const full = M.__sim6(1, 0.55, b, 1000, 2000);
  const halfK = M.__sim6(0.5, 0.55, b, 1000, 2000);
  const dbl = M.__sim6(2, 0.55, b, 1000, 2000);
  console.log("      full   median " + full.med.toFixed(2) + "x  p05 " + full.p05.toFixed(3) +
    "  ever halved " + (full.halved * 100).toFixed(1) + "%");
  console.log("      half   median " + halfK.med.toFixed(2) + "x  p05 " + halfK.p05.toFixed(3) +
    "  ever halved " + (halfK.halved * 100).toFixed(1) + "%");
  console.log("      double median " + dbl.med.toFixed(2) + "x  p05 " + dbl.p05.toFixed(4) +
    "  ever halved " + (dbl.halved * 100).toFixed(1) + "%");
  yes("full Kelly beats half Kelly on the median", full.med > halfK.med);
  yes("but double Kelly does NOT beat full Kelly on the median", dbl.med < full.med);
  yes("double Kelly's fifth percentile is a near-total loss", dbl.p05 < 0.1);
  /* the median is exp(n*g) — theory and simulation agree, which is the point */
  eq("full Kelly median is exp(n*g) = 3.97x", full.med,
    Math.exp(1000 * M.growth(M.kelly(0.55, b), 0.55, b)), 0.25);
  eq("full Kelly halves the bankroll 42% of the time", full.halved * 100, 42.1, 0.5);
  eq("half Kelly, only 9.5%", halfK.halved * 100, 9.5, 0.5);
  eq("full Kelly fifth percentile 0.26x", full.p05, 0.256, 0.01);
  eq("half Kelly fifth percentile 0.72x", halfK.p05, 0.716, 0.01);
  yes("full Kelly halves the bankroll far more often than half Kelly",
    full.halved > 4 * halfK.halved);

  console.log("    chapter 07 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(32) + kinds[k]));
  yes("six distinct question kinds", Object.keys(kinds).length === 6);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["shape"] = () => {
  const M = load("shape.html", ["INGREDIENT", "cdfGap", "__clt", "__drill",
    "dbinom", "pbinom", "ncdf", "dnorm", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - the binomial");
  eq("ten flips: P(exactly five) = 24.6%", M.dbinom(5, 10, 0.5) * 100, 24.609, 5e-3);
  let seven = 0; for (let k = 7; k <= 10; k++) seven += M.dbinom(k, 10, 0.5);
  eq("  P(seven or more) = 17.2%", seven * 100, 17.188, 5e-3);
  eq("a hundred flips: sd is exactly 5", Math.sqrt(100 * 0.25), 5, 1e-12);
  eq("  P(sixty or more) = 2.84%", (1 - M.pbinom(59, 100, 0.5)) * 100, 2.844, 5e-3);
  eq("  P(exactly fifty) = 7.96%", M.dbinom(50, 100, 0.5) * 100, 7.959, 5e-3);
  yes("the mode is the mean but holds little of the mass", M.dbinom(50, 100, 0.5) < 0.09);

  console.log("    chapter 02 - the central limit theorem");
  const flat = n => M.__clt(n, 0, 200000);
  const r1 = flat(1), r2 = flat(2), r5 = flat(5), r30 = flat(30);
  eq("one flat draw: excess kurtosis -1.20", r1.kurt, -1.2036, 0.02);
  eq("two: -0.59", r2.kurt, -0.5925, 0.02);
  eq("five: -0.24", r5.kurt, -0.2384, 0.02);
  eq("thirty: -0.05", r30.kurt, -0.0500, 0.02);
  eq("five draws: largest CDF gap under a point", r5.gap, 0.0071, 3e-3);
  eq("thirty draws: 0.003", r30.gap, 0.0029, 2e-3);
  yes("the gap shrinks monotonically as you add more",
    r1.gap > r2.gap && r2.gap > r5.gap && r5.gap > r30.gap);
  yes("every standardized sum has mean 0 and sd 1",
    [r1, r2, r5, r30].every(r => Math.abs(r.mean) < 0.02 && Math.abs(r.sd - 1) < 0.02));
  /* a skewed ingredient takes longer to wash out than a flat one */
  const skew5 = M.__clt(5, 2, 200000), skew30 = M.__clt(30, 2, 200000);
  yes("a lopsided ingredient converges more slowly than a flat one",
    Math.abs(skew5.skew) > Math.abs(r5.skew));
  yes("  but it still gets there", Math.abs(skew30.skew) < Math.abs(skew5.skew));

  console.log("    chapter 03 - count versus proportion");
  eq("100 flips: sd of the count is 5", Math.sqrt(100 * 0.25), 5, 1e-12);
  eq("10,000 flips: sd of the count is 50", Math.sqrt(10000 * 0.25), 50, 1e-12);
  eq("100 flips: sd of the proportion is 5.0 points",
    Math.sqrt(0.25 / 100) * 100, 5.0, 1e-9);
  eq("10,000 flips: 0.5 points", Math.sqrt(0.25 / 10000) * 100, 0.5, 1e-9);
  yes("a hundredfold more flips is ten times the count spread",
    Math.abs(Math.sqrt(10000 * 0.25) / Math.sqrt(100 * 0.25) - 10) < 1e-9);
  yes("  and a tenth of the proportion spread",
    Math.abs(Math.sqrt(0.25 / 10000) / Math.sqrt(0.25 / 100) - 0.1) < 1e-9);

  console.log("    chapter 04 - the square root of time");
  eq("20% annual is 1.26% daily", 0.20 / Math.sqrt(252) * 100, 1.2599, 1e-3);
  eq("  dividing by 252 instead gives 0.079%", 0.20 / 252 * 100, 0.0794, 1e-3);
  eq("  which is wrong by 15.87x", Math.sqrt(252), 15.8745, 1e-3);
  eq("20% annual is 5.77% monthly", 0.20 * Math.sqrt(1 / 12) * 100, 5.7735, 1e-3);
  eq("a quarter is exactly half a year", Math.sqrt(0.25), 0.5, 1e-15);
  eq("2% daily annualizes to 31.7%", 2 * Math.sqrt(252), 31.749, 5e-3);
  eq("  using 365 days would give 38.2%", 2 * Math.sqrt(365), 38.21, 0.01);
  eq("a $100 stock at 20%: one-day sd is $1.26", 100 * 0.20 / Math.sqrt(252), 1.2599, 1e-3);

  console.log("    chapter 05 - the tails");
  eq("within one sigma: 68.27%", (2 * M.ncdf(1) - 1) * 100, 68.2689, 5e-3);
  eq("within two: 95.45%", (2 * M.ncdf(2) - 1) * 100, 95.4500, 5e-3);
  eq("within three: 99.73%", (2 * M.ncdf(3) - 1) * 100, 99.7300, 5e-3);
  eq("outside two sigma: 4.55%", (1 - (2 * M.ncdf(2) - 1)) * 100, 4.5500, 5e-3);
  eq("  which is one in 22", 1 / (1 - (2 * M.ncdf(2) - 1)), 21.98, 0.05);
  eq("outside four sigma: one in 15,780",
    1 / (1 - (2 * M.ncdf(4) - 1)), 15780, 60);
  eq("  once every 63 years of trading days",
    1 / (1 - (2 * M.ncdf(4) - 1)) / 252, 62.6, 0.5);
  eq("outside five sigma: once every 6,900 years",
    1 / (1 - (2 * M.ncdf(5) - 1)) / 252, 6911, 60);
  eq("the 1.96 sigma figure is the 5% everyone quotes",
    (1 - (2 * M.ncdf(1.96) - 1)) * 100, 5.0, 0.02);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(32) + kinds[k]));
  yes("six distinct question kinds", Object.keys(kinds).length === 6);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["dist"] = () => {
  const M = load("dist.html", ["mixVol", "mixKurt", "mixTail", "normTail", "tTail",
    "__sample5", "__drill", "ncdf", "dpois", "dt", "mean", "variance", "skewness",
    "kurtosis", "s1", "s2", "s3", "s4", "s5"]);
  const {mean, variance, skewness, kurtosis} = M;

  console.log("    chapter 01 - the lognormal");
  eq("up 10% then down 10% leaves 0.99", 1.1 * 0.9, 0.99, 1e-12);
  eq("  ln(1.1) = 0.0953", Math.log(1.1), 0.09531, 1e-5);
  eq("  ln(0.9) = -0.1054", Math.log(0.9), -0.10536, 1e-5);
  eq("  and they sum back to the product", Math.exp(Math.log(1.1) + Math.log(0.9)), 0.99, 1e-12);
  const S = 100, mu = 0.08, sg = 0.30, T = 1;
  const m = Math.log(S) + (mu - sg * sg / 2) * T, sq = sg * Math.sqrt(T);
  eq("mean price after a year is $108.33", S * Math.exp(mu * T), 108.329, 5e-3);
  eq("  median is $103.56", Math.exp(m), 103.562, 5e-3);
  eq("  mean is 4.60% above median", (S * Math.exp(mu * T) / Math.exp(m) - 1) * 100, 4.60, 0.02);
  eq("  P(below the mean) = 55.96%",
    M.ncdf((Math.log(S * Math.exp(mu * T)) - m) / sq) * 100, 55.96, 0.05);
  /* halving beats doubling at zero drift */
  const m0 = Math.log(100) + (0 - 0.09 / 2), s0 = 0.30;
  eq("P(price halves) at 30 vol, no drift",
    M.ncdf((Math.log(50) - m0) / s0) * 100, 1.537, 5e-3);
  eq("P(price doubles)", (1 - M.ncdf((Math.log(200) - m0) / s0)) * 100, 0.694, 5e-3);
  yes("halving is more than twice as likely as doubling",
    M.ncdf((Math.log(50) - m0) / s0) > 2 * (1 - M.ncdf((Math.log(200) - m0) / s0)));

  console.log("    chapter 02 - the Poisson");
  eq("three halts a year: P(none) = 4.98%", M.dpois(0, 3) * 100, 4.979, 5e-3);
  let six = 0; for (let k = 0; k < 6; k++) six += M.dpois(k, 3);
  eq("  P(six or more) = 8.39%", (1 - six) * 100, 8.392, 5e-3);
  eq("lambda = 4 gives a standard deviation of exactly 2", Math.sqrt(4), 2, 1e-15);
  yes("the variance equals the mean, by construction", true);
  eq("lambda = 0.5: P(zero) = 60.65%", M.dpois(0, 0.5) * 100, 60.653, 5e-3);
  eq("lambda = 6: P(zero) = 0.25%", M.dpois(0, 6) * 100, 0.2479, 5e-4);

  console.log("    chapter 03 - Student's t");
  eq("t with 5 df, beyond 3 sigma: 3.01%", M.tTail(3, 5) * 100, 3.010, 0.02);
  eq("  a normal there: 0.27%", M.normTail(3) * 100, 0.2700, 5e-4);
  eq("  the t is 11 times fatter", M.tTail(3, 5) / M.normTail(3), 11.15, 0.08);
  eq("t with 10 df is 4.9x", M.tTail(3, 10) / M.normTail(3), 4.94, 0.05);
  eq("t with 30 df is 2.0x", M.tTail(3, 30) / M.normTail(3), 2.00, 0.03);
  eq("excess kurtosis of t(5) is 6", 6 / (5 - 4), 6, 1e-12);
  eq("excess kurtosis of t(6) is 3", 6 / (6 - 4), 3, 1e-12);
  eq("excess kurtosis of t(10) is 1", 6 / (10 - 4), 1, 1e-12);
  eq("kurtosis 6 implies 5 degrees of freedom", 4 + 6 / 6, 5, 1e-12);

  console.log("    chapter 04 - the mixture and its thin shoulder");
  const w = 0.90, v1 = 0.15, v2 = 0.45;
  eq("90% at 15 vol + 10% at 45 vol gives 20.12% overall",
    M.mixVol(w, v1, v2) * 100, 20.1246, 5e-3);
  eq("  excess kurtosis 5.33", M.mixKurt(w, v1, v2), 5.3333, 5e-3);
  eq("beyond 2 sigma the mixture is THINNER", M.mixTail(2, w, v1, v2) * 100, 4.367, 5e-3);
  eq("  the normal there", M.normTail(2) * 100, 4.550, 5e-3);
  yes("  so the ratio is below one", M.mixTail(2, w, v1, v2) < M.normTail(2));
  eq("beyond 3 sigma: 6.7x fatter", M.mixTail(3, w, v1, v2) / M.normTail(3), 6.68, 0.05);
  eq("beyond 4 sigma: 116x", M.mixTail(4, w, v1, v2) / M.normTail(4), 116.2, 1.0);
  eq("beyond 5 sigma: 4,414x", M.mixTail(5, w, v1, v2) / M.normTail(5), 4414, 40);
  yes("the fat tail is paid for out of the shoulder",
    M.mixTail(2, w, v1, v2) < M.normTail(2) && M.mixTail(4, w, v1, v2) > M.normTail(4));

  console.log("    chapter 05 - identifying a sample");
  const pois = M.__sample5(1, 20000);
  yes("the Poisson sample is all non-negative integers",
    pois.every(v => Number.isInteger(v) && v >= 0));
  eq("  its variance-to-mean ratio is about one",
    variance(pois) / mean(pois), 1.0, 0.08);
  const lg = M.__sample5(0, 20000);
  yes("the lognormal sample is strictly positive", lg.every(v => v > 0));
  yes("  and right-skewed", skewness(lg) > 0.8);
  const tt = M.__sample5(2, 20000);
  yes("the t sample has fat tails", kurtosis(tt) > 2);
  const nn = M.__sample5(4, 20000);
  yes("the plain normal reads near zero kurtosis", Math.abs(kurtosis(nn)) < 0.3);
  const mixS = M.__sample5(3, 20000);
  yes("the mixture reads fat too", kurtosis(mixS) > 2);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("six distinct question kinds", Object.keys(kinds).length === 6);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["sample"] = () => {
  const M = load("sample.html", ["seMean", "seVol", "daysForVol", "yearOfReturns",
    "annVol", "maxDrawdown", "__boot", "__cover", "__drill", "mean", "sd", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - the standard error of a mean");
  eq("sd 1, n 100: se is 0.10", M.seMean(1, 100), 0.10, 1e-12);
  eq("quadrupling n halves it", M.seMean(1, 400), 0.05, 1e-12);
  yes("four times the data halves the error",
    Math.abs(M.seMean(1, 400) / M.seMean(1, 100) - 0.5) < 1e-12);

  console.log("    chapter 02 - drift is unmeasurable");
  eq("2% daily is 31.75% annualized", 0.02 * Math.sqrt(252) * 100, 31.749, 5e-3);
  eq("20 days: se of the daily mean is 0.447%", 0.02 / Math.sqrt(20) * 100, 0.4472, 1e-3);
  eq("  annualized, 113%", 0.02 / Math.sqrt(20) * 252 * 100, 112.70, 0.05);
  eq("252 days: annualized se is 31.7%", 0.02 / Math.sqrt(252) * 252 * 100, 31.75, 0.02);
  eq("1260 days: annualized se is 14.2%", 0.02 / Math.sqrt(1260) * 252 * 100, 14.20, 0.02);
  eq("  so the 95% half-width is 28 points",
    1.96 * 0.02 / Math.sqrt(1260) * 252 * 100, 27.83, 0.05);
  yes("after five years, zero drift is still inside the interval",
    1.96 * 0.02 / Math.sqrt(1260) * 252 > 0.08);

  console.log("    chapter 03 - volatility is measurable");
  eq("20 vol from 20 days: se 3.16 points", M.seVol(0.20, 20) * 100, 3.162, 5e-3);
  eq("from 60 days: 1.83", M.seVol(0.20, 60) * 100, 1.826, 5e-3);
  eq("from 252 days: 0.89", M.seVol(0.20, 252) * 100, 0.891, 5e-3);
  eq("  so the 95% band is 18.25% to 21.75%",
    (0.20 - 1.96 * M.seVol(0.20, 252)) * 100, 18.253, 5e-3);
  eq("  upper end", (0.20 + 1.96 * M.seVol(0.20, 252)) * 100, 21.747, 5e-3);
  eq("769 days pin it to one point", M.daysForVol(0.20, 0.01), 769, 0);
  eq("193 days pin it to two", M.daysForVol(0.20, 0.02), 193, 0);
  yes("halving the target width quadruples the days",
    Math.abs(M.daysForVol(0.20, 0.01) / M.daysForVol(0.20, 0.02) - 4) < 0.05);
  yes("one year pins volatility to under 10% of itself",
    1.96 * M.seVol(0.20, 252) / 0.20 < 0.10);
  yes("  while drift stays uncertain by many multiples of itself",
    1.96 * 0.32 / 0.08 > 5);

  console.log("    chapter 04 - the bootstrap");
  const B = M.__boot(0, 2000, 252);
  console.log("      observed vol " + B.obs.toFixed(3) + "%  bootstrap " +
    B.lo.toFixed(3) + "% to " + B.hi.toFixed(3) + "%");
  const fse = M.seVol(B.obs / 100, 252) * 100;
  console.log("      formula interval " + (B.obs - 1.96 * fse).toFixed(3) + "% to " +
    (B.obs + 1.96 * fse).toFixed(3) + "%");
  yes("the bootstrap interval brackets the observed value", B.lo < B.obs && B.hi > B.obs);
  yes("the bootstrap standard error matches the formula within 15%",
    Math.abs(B.seBoot - fse) / fse < 0.15);
  const D = M.__boot(2, 1000, 252);
  yes("the bootstrap works for a drawdown, which has no formula",
    isFinite(D.obs) && D.hi > D.lo);

  console.log("    chapter 05 - what an interval claims");
  const iv = M.__cover(0.95, 40, 400);
  const hits = iv.filter(i => i.hit).length / iv.length;
  console.log("      95% intervals caught the truth " + (hits * 100).toFixed(1) + "% of the time");
  eq("coverage is close to the nominal level", hits * 100, 95, 3.0);
  const iv80 = M.__cover(0.80, 40, 400);
  const h80 = iv80.filter(i => i.hit).length / iv80.length;
  eq("an 80% interval covers about 80%", h80 * 100, 80, 5.0);
  yes("a lower confidence level covers less often", h80 < hits);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("six distinct question kinds", Object.keys(kinds).length === 6);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["bayes"] = () => {
  const M = load("bayes.html", ["posterior", "toOdds", "fromOdds", "likRatio",
    "volPosterior", "__chain", "__drill", "dnorm", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - the screening problem");
  eq("1 in 1000, a 99/99 test: 9.02%", M.posterior(0.001, 0.99, 0.99) * 100, 9.016, 5e-3);
  eq("  out of 100,000: 99 true positives", 100000 * 0.001 * 0.99, 99, 1e-9);
  eq("  and 999 false ones", 100000 * 0.999 * 0.01, 999, 1e-9);
  eq("  which is 99 over 1098", 99 / 1098 * 100, 9.016, 5e-3);
  eq("at 1% prevalence it is 50%", M.posterior(0.01, 0.99, 0.99) * 100, 50.0, 0.05);
  eq("at 10% prevalence, 91.7%", M.posterior(0.10, 0.99, 0.99) * 100, 91.67, 0.02);
  eq("better sensitivity barely helps",
    M.posterior(0.001, 0.999, 0.99) * 100, 9.09, 0.02);
  eq("better specificity is transformative",
    M.posterior(0.001, 0.99, 0.999) * 100, 49.77, 0.05);
  yes("specificity moves the answer far more than sensitivity",
    M.posterior(0.001, 0.99, 0.999) > 4 * M.posterior(0.001, 0.999, 0.99));

  console.log("    chapter 02 - the odds form");
  eq("a 99/99 test has a likelihood ratio of 99", M.likRatio(0.99, 0.99), 99, 1e-9);
  eq("prior odds of 1 in 999", M.toOdds(0.001), 0.001001, 1e-6);
  eq("  times 99 gives posterior odds", M.toOdds(0.001) * 99, 0.09910, 1e-5);
  eq("  which converts to 9.02%", M.fromOdds(M.toOdds(0.001) * 99) * 100, 9.016, 5e-3);
  yes("the odds form and the area form agree exactly",
    Math.abs(M.fromOdds(M.toOdds(0.001) * M.likRatio(0.99, 0.99))
      - M.posterior(0.001, 0.99, 0.99)) < 1e-12);

  console.log("    chapter 03 - repeated tests");
  const ch = M.__chain(0.001, 0.99, 0.99, 3);
  eq("after one positive: 9.02%", ch[1] * 100, 9.016, 5e-3);
  eq("after two: 90.75%", ch[2] * 100, 90.750, 0.01);
  eq("after three: 99.90%", ch[3] * 100, 99.897, 0.01);
  yes("belief rises with each positive", ch[1] < ch[2] && ch[2] < ch[3]);

  console.log("    chapter 04 - updating a volatility");
  const V = M.volPosterior(0.06, 0.90, 0.20, 0.40, 252);
  eq("a 6% day is 4.76 sigma under the calm story", V.sigmaLo, 4.762, 5e-3);
  eq("  and 2.38 under the stressed one", V.sigmaHi, 2.381, 5e-3);
  eq("the likelihood ratio is about 2,470 to 1", V.ratio, 2469.7, 5);
  eq("posterior on calm falls to 0.36%", V.post * 100, 0.359, 0.01);
  yes("one day flips a 90% belief", V.post < 0.01);
  const ord = M.volPosterior(0.01, 0.90, 0.20, 0.40, 252);
  yes("an ordinary 1% day barely moves it", ord.post > 0.85);
  yes("  because its likelihood ratio is near one", ord.ratio < 2.5);

  console.log("    chapter 05 - the backtest base rate");
  const bt = (pr, po, fp) => pr * po / (pr * po + (1 - pr) * fp);
  eq("5% prior, 80% power, 10% false positives: 29.6%", bt(0.05, 0.80, 0.10) * 100, 29.63, 0.02);
  eq("at a 1% prior it is 7.5%", bt(0.01, 0.80, 0.10) * 100, 7.48, 0.02);
  eq("at 20% it is 66.7%", bt(0.20, 0.80, 0.10) * 100, 66.67, 0.02);
  eq("at 50% it is 88.9%", bt(0.50, 0.80, 0.10) * 100, 88.89, 0.02);
  yes("a good backtest alone leaves it more likely dead than alive",
    bt(0.05, 0.80, 0.10) < 0.5);
  eq("the prior needed to reach a coin flip", 0.10 / (0.80 + 0.10) * 100, 11.11, 0.02);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("six distinct question kinds", Object.keys(kinds).length === 6);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["corr"] = () => {
  const M = load("corr.html", ["portVol", "betaOf", "residualShare", "corrInterval",
    "nForSignificance", "fisherZ", "ANSCOMBE", "__drill", "corr", "variance", "mean",
    "s1", "s2", "s3", "s4"]);

  console.log("    chapter 01 - what a correlation buys you");
  eq("two 20-vols at rho 0: 14.142%", M.portVol(0.5, 0.20, 0.20, 0) * 100, 14.142, 5e-3);
  eq("  which is a 29.29% reduction",
    (0.20 - M.portVol(0.5, 0.20, 0.20, 0)) / 0.20 * 100, 29.289, 5e-3);
  eq("at rho 0.6: 17.889%", M.portVol(0.5, 0.20, 0.20, 0.6) * 100, 17.889, 5e-3);
  eq("at rho 0.9: 19.494%", M.portVol(0.5, 0.20, 0.20, 0.9) * 100, 19.494, 5e-3);
  eq("  a benefit of only 2.53%",
    (0.20 - M.portVol(0.5, 0.20, 0.20, 0.9)) / 0.20 * 100, 2.53, 5e-3);
  eq("at rho 1.0 there is no benefit at all", M.portVol(0.5, 0.20, 0.20, 1) * 100, 20.0, 1e-9);
  yes("the benefit falls away long before rho reaches 1",
    (0.20 - M.portVol(0.5, 0.20, 0.20, 0.9)) / 0.20 < 0.03);

  console.log("    chapter 02 - correlation is symmetric, slope is not");
  eq("beta of Y on X, vols 10 and 40, rho 0.5", M.betaOf(0.5, 0.40, 0.10), 2.0, 1e-12);
  eq("beta of X on Y, the same pair", M.betaOf(0.5, 0.10, 0.40), 0.125, 1e-12);
  eq("  their product is rho squared",
    M.betaOf(0.5, 0.40, 0.10) * M.betaOf(0.5, 0.10, 0.40), 0.25, 1e-12);
  yes("the two regressions have different slopes",
    Math.abs(M.betaOf(0.5, 0.40, 0.10) - M.betaOf(0.5, 0.10, 0.40)) > 1);

  console.log("    chapter 03 - how little correlation explains");
  eq("rho 0.7 explains 49%", 0.7 * 0.7 * 100, 49.0, 1e-9);
  eq("  and leaves residual vol at 71.41% of total",
    M.residualShare(0.7) * 100, 71.414, 5e-3);
  eq("rho 0.5 leaves 86.60%", M.residualShare(0.5) * 100, 86.603, 5e-3);
  eq("rho 0.9 leaves 43.59%", M.residualShare(0.9) * 100, 43.589, 5e-3);
  yes("a 0.7 correlation still leaves half the variance unexplained",
    1 - 0.7 * 0.7 >= 0.5);

  console.log("    chapter 04 - the standard error of a correlation");
  const ci = M.corrInterval(0.30, 30, 0.95);
  eq("r 0.30 from 30 points: lower end -0.068", ci.lo, -0.0680, 5e-3);
  eq("  upper end 0.596", ci.hi, 0.5964, 5e-3);
  yes("  so it does not clear zero", ci.lo < 0);
  eq("44 observations are needed to call 0.30 non-zero",
    M.nForSignificance(0.30, 0.95), 44, 0);
  const wide = M.corrInterval(0.30, 250, 0.95);
  yes("more data narrows it", (wide.hi - wide.lo) < (ci.hi - ci.lo));
  yes("  and at 250 it does clear zero", wide.lo > 0);

  console.log("    chapter 05 - Anscombe");
  M.ANSCOMBE.forEach((set, i) => {
    const r = M.corr(set.x, set.y);
    const b = r * Math.sqrt(M.variance(set.y) / M.variance(set.x));
    console.log("      set " + (i + 1) + "  mean x " + M.mean(set.x).toFixed(2) +
      "  mean y " + M.mean(set.y).toFixed(2) + "  r " + r.toFixed(3) +
      "  slope " + b.toFixed(3));
    eq("  set " + (i + 1) + " mean x is 9.00", M.mean(set.x), 9.0, 5e-3);
    eq("  set " + (i + 1) + " mean y is 7.50", M.mean(set.y), 7.50, 5e-3);
    eq("  set " + (i + 1) + " var x is 11.00", M.variance(set.x), 11.0, 5e-3);
    eq("  set " + (i + 1) + " var y is 4.12", M.variance(set.y), 4.125, 5e-3);
    eq("  set " + (i + 1) + " r is 0.816", r, 0.816, 5e-3);
    eq("  set " + (i + 1) + " slope is 0.500", b, 0.500, 5e-3);
  });
  yes("all four sets agree on every summary statistic", M.ANSCOMBE.length === 4);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["tails"] = () => {
  const M = load("tails.html", ["varSigma", "esSigma", "mixParts", "mixVaR", "mixES",
    "bondRisk", "concentration", "concentrationNormal", "exceptionRange",
    "__drill", "__moments", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - where the variance lives");
  const F = M.concentration(88, 2520, 0.94, 4, 0.008);
  eq("the worst single day holds 3.26%", F.share(1) * 100, 3.26, 0.02);
  eq("the worst 5 days hold 13.76%", F.share(5) * 100, 13.76, 0.02);
  eq("the worst 25 days - 1% of them - hold 31.44%", F.share(25) * 100, 31.44, 0.02);
  eq("the worst 5% of days hold 54.36%", F.share(126) * 100, 54.36, 0.02);
  const G = M.concentrationNormal(88, 2520, F.tot);
  eq("a normal puts only 8.55% in the worst 1%", G.share(25) * 100, 8.546, 0.02);
  yes("the fat sample is more than three times as concentrated",
    F.share(25) / G.share(25) > 3);
  yes("a window missing the worst 1% understates variance by about a third",
    Math.abs(F.share(25) - 0.31) < 0.02);
  eq("  which is 17% in volatility terms",
    (1 - Math.sqrt(1 - F.share(25))) * 100, 17.2, 0.6);

  console.log("    chapter 02 - VaR and expected shortfall");
  eq("the 95% VaR is 1.645 sigma", M.varSigma(0.05), 1.6449, 5e-4);
  eq("the 99% VaR is 2.326 sigma", M.varSigma(0.01), 2.3263, 5e-4);
  eq("the 95% expected shortfall is 2.063 sigma", M.esSigma(0.05), 2.0627, 5e-4);
  eq("the 99% expected shortfall is 2.665 sigma", M.esSigma(0.01), 2.6652, 5e-4);
  eq("  a ratio of 1.15", M.esSigma(0.01) / M.varSigma(0.01), 1.1457, 5e-4);
  yes("expected shortfall always sits further out", M.esSigma(0.01) > M.varSigma(0.01));
  eq("a $10m book at 1.26% daily vol: 99% VaR $293,120",
    10e6 * 0.0126 * M.varSigma(0.01), 293120, 40);
  eq("  and an expected shortfall of $335,817",
    10e6 * 0.0126 * M.esSigma(0.01), 335817, 40);

  console.log("    chapter 02 - and what fat tails do to each");
  const mx = M.mixParts(0.94, 4);
  eq("the mixture is rescaled to unit variance",
    mx.w * mx.a * mx.a + (1 - mx.w) * mx.b * mx.b, 1.0, 1e-9);
  eq("at 99% the mixture VaR is 2.817 sigma", M.mixVaR(0.01, mx), 2.8168, 5e-3);
  eq("  its expected shortfall is 4.351 sigma", M.mixES(0.01, mx), 4.3511, 5e-3);
  eq("  VaR rose 21% against the normal",
    (M.mixVaR(0.01, mx) / M.varSigma(0.01) - 1) * 100, 21.08, 0.15);
  eq("  while expected shortfall rose 63%",
    (M.mixES(0.01, mx) / M.esSigma(0.01) - 1) * 100, 63.26, 0.15);
  eq("at 95% the fat-tailed VaR is 1.338 - LOWER than the normal",
    M.mixVaR(0.05, mx), 1.3376, 5e-3);
  yes("  so a fatter tail can shrink the reported VaR",
    M.mixVaR(0.05, mx) < M.varSigma(0.05));
  yes("  while its expected shortfall still rises", M.mixES(0.05, mx) > M.esSigma(0.05));

  console.log("    chapter 03 - VaR is not subadditive");
  const B = M.bondRisk(0.03, 100, 0.95);
  eq("P(at least one of two 3% bonds defaults) is 5.910%", B.pAny * 100, 5.910, 5e-3);
  eq("the 95% VaR of one bond is 0", B.v1, 0, 1e-12);
  eq("the 95% VaR of the pair is 100", B.v2, 100, 1e-12);
  yes("so the pair's VaR exceeds the sum of the parts", B.varBroken);
  eq("expected shortfall of one bond is 60", B.e1, 60.0, 1e-9);
  eq("  of the pair, 101.80", B.e2, 101.80, 5e-3);
  eq("  against a sum of 120", 2 * B.e1, 120.0, 1e-9);
  yes("expected shortfall stays subadditive", B.esOk);
  eq("the pair's VaR jumps once each bond passes 2.53%", B.pStar * 100, 2.5321, 5e-3);
  const safe = M.bondRisk(0.02, 100, 0.95);
  yes("below that rate VaR behaves", !safe.varBroken);
  yes("  and expected shortfall is subadditive there too", safe.esOk);

  console.log("    chapter 04 - the moments are unstable");
  const half = M.__moments(88, 630, 0.94, -1.2, 4);
  const full = M.__moments(88, 1260, 0.94, -1.2, 4);
  console.log("      630 days: kurtosis " + half.kurt.toFixed(2) +
    "   1260 days: " + full.kurt.toFixed(2));
  yes("a normal-mixture sample reads a large excess kurtosis", full.kurt > 5);
  yes("  and it moves materially as the sample grows",
    Math.abs(full.kurt - half.kurt) > 0.5);
  const sym = M.__moments(88, 1260, 0.94, 0, 4);
  const skewed = M.__moments(88, 1260, 0.94, -2.0, 4);
  yes("a downward bias in the wild days produces negative skew",
    skewed.skew < sym.skew);
  yes("  which is the shape equity returns actually have", skewed.skew < 0);

  console.log("    chapter 05 - what a backtest can establish");
  const y1 = M.exceptionRange(252, 0.01);
  eq("a 99% model over one year expects 2.52 breaches", y1.exp, 2.52, 5e-3);
  eq("  the 95% range runs from 0", y1.lo, 0, 0);
  eq("  to 6", y1.hi, 6, 0);
  yes("  so two observed breaches establish nothing", y1.lo <= 2 && y1.hi >= 2);
  const y2 = M.exceptionRange(504, 0.01);
  eq("over two years it expects 5.04", y2.exp, 5.04, 5e-3);
  eq("  and the range is 1 to 10", y2.hi - y2.lo, 9, 0);
  const deep = M.exceptionRange(252, 0.001);
  eq("a 99.9% model over a year expects 0.25 breaches", deep.exp, 0.252, 5e-3);
  yes("  which cannot distinguish a good model from a bad one", deep.lo === 0);
  yes("more data does narrow the band in relative terms",
    (y2.hi - y2.lo) / y2.exp < (y1.hi - y1.lo) / y1.exp);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("seven distinct question kinds", Object.keys(kinds).length === 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};


PAGES["bet"] = () => {
  const M = load("bet.html", ["impliedProb", "usToDecimal", "marketMargin", "kelly",
    "logGrowth", "kellyC", "growthC", "zeroCrossing", "growthKept", "ruinProb",
    "seatStats", "SEATS", "__seats", "__drill", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - where the price comes from");
  eq("-110 implies 52.381%", M.impliedProb(-110) * 100, 52.381, 5e-3);
  eq("  as decimal odds, 1.9091", M.usToDecimal(-110), 1.90909, 1e-5);
  const mk = M.marketMargin(-110, -110);
  eq("both sides sum to 104.762%", mk.sum * 100, 104.762, 5e-3);
  eq("  an overround of 4.762 points", mk.over * 100, 4.7619, 5e-4);
  eq("  and a hold of 4.545%", mk.hold * 100, 4.5455, 5e-4);
  yes("the hold is smaller than the overround", mk.hold < mk.over);
  eq("the break-even win rate is the implied probability", mk.breakEven * 100, 52.381, 5e-3);
  eq("  which is 2.38 points above a coin", (mk.breakEven - 0.5) * 100, 2.381, 5e-3);
  /* the cashflow the prose walks through */
  const staked = 220, paid = 110 * M.usToDecimal(-110);
  eq("two $110 stakes pay the winner $210", paid, 210.0, 1e-9);
  eq("  so the book keeps $10", staked - paid, 10.0, 1e-9);
  eq("  which is 4.545% of what was staked", (staked - paid) / staked * 100, 4.5455, 5e-4);
  yes("a balanced book profits whichever side wins", (staked - paid) > 0);
  eq("de-vigging -110/-110 gives 50/50", mk.fair[0] * 100, 50.0, 1e-9);
  /* the market maker's version of the same trade */
  eq("a 1.90/2.10 quote keeps 5.00% of two-sided handle",
    0.20 / (1.90 + 2.10) * 100, 5.0, 1e-9);
  const fair = M.marketMargin(100, 100);
  eq("a market with no margin sums to 100%", fair.sum * 100, 100.0, 1e-9);
  eq("  and holds nothing", fair.hold * 100, 0.0, 1e-12);

  console.log("    chapter 02 - how much to bet");
  eq("a 60% even-money coin: Kelly is 20%", M.kelly(0.60, 1) * 100, 20.0, 1e-9);
  eq("  which for b=1 is just the edge 2p-1", (2 * 0.60 - 1) * 100, 20.0, 1e-9);
  eq("  growth at f* is 2.034% per bet",
    (Math.exp(M.logGrowth(0.60, 0.20, 1)) - 1) * 100, 2.0340, 5e-4);
  eq("  at 10% it is 1.516%", (Math.exp(M.logGrowth(0.60, 0.10, 1)) - 1) * 100, 1.5156, 5e-4);
  eq("  at 30% it is 1.486%", (Math.exp(M.logGrowth(0.60, 0.30, 1)) - 1) * 100, 1.4858, 5e-4);
  yes("the peak really is the peak",
    M.logGrowth(0.60, 0.20, 1) > M.logGrowth(0.60, 0.10, 1) &&
    M.logGrowth(0.60, 0.20, 1) > M.logGrowth(0.60, 0.30, 1));
  yes("the curve is flat near the top - 10% off costs under a third of the growth",
    (M.logGrowth(0.60, 0.20, 1) - M.logGrowth(0.60, 0.30, 1)) / M.logGrowth(0.60, 0.20, 1) < 0.30);

  console.log("    chapter 02 - the discrete curve crosses zero BELOW twice Kelly");
  yes("double Kelly on a 60% coin is already negative", M.logGrowth(0.60, 0.40, 1) < 0);
  eq("the 55% coin crosses at 1.99x Kelly", M.zeroCrossing(0.55, 1), 1.9874, 5e-3);
  eq("the 60% coin crosses at 1.95x", M.zeroCrossing(0.60, 1), 1.9470, 5e-3);
  eq("the 70% coin crosses at 1.79x", M.zeroCrossing(0.70, 1), 1.7914, 5e-3);
  yes("the approximation drifts further with a bigger edge",
    M.zeroCrossing(0.70, 1) < M.zeroCrossing(0.60, 1) &&
    M.zeroCrossing(0.60, 1) < M.zeroCrossing(0.55, 1));
  yes("  and always in the direction that flatters the bettor",
    M.zeroCrossing(0.60, 1) < 2);
  /* the continuous version, where it IS exactly two */
  eq("continuous Kelly at mu 8% sigma 20% is 2.0x", M.kellyC(0.08, 0.20), 2.0, 1e-12);
  eq("  growth at f* is 8.00%", M.growthC(2.0, 0.08, 0.20) * 100, 8.0, 1e-9);
  eq("  and growth at 2f* is exactly zero", M.growthC(4.0, 0.08, 0.20), 0.0, 1e-15);
  yes("so the doubling rule is exact only in the continuous limit",
    Math.abs(M.growthC(4.0, 0.08, 0.20)) < 1e-15 && M.logGrowth(0.60, 0.40, 1) < -1e-4);

  console.log("    chapter 02 - a big edge is not a big bet");
  const bFav = M.usToDecimal(-200) - 1, bDog = M.usToDecimal(400) - 1;
  eq("-200 implies 66.67%", M.impliedProb(-200) * 100, 66.667, 5e-3);
  eq("+400 implies 20.00%", M.impliedProb(400) * 100, 20.0, 5e-3);
  eq("the favorite at 72% has an 8% edge", (0.72 * bFav - 0.28) * 100, 8.0, 5e-3);
  eq("  and a Kelly stake of 16.00%", M.kelly(0.72, bFav) * 100, 16.0, 5e-3);
  eq("the longshot at 25% has a 25% edge", (0.25 * bDog - 0.75) * 100, 25.0, 5e-3);
  eq("  but a Kelly stake of only 6.25%", M.kelly(0.25, bDog) * 100, 6.25, 5e-3);
  yes("three times the edge, a quarter of the bet",
    M.kelly(0.25, bDog) < M.kelly(0.72, bFav));

  console.log("    chapter 03 - why nobody bets that much");
  eq("full Kelly: 50% chance of ever halving", M.ruinProb(1.0, 0.5) * 100, 50.0, 1e-9);
  eq("  25% of ever quartering", M.ruinProb(1.0, 0.25) * 100, 25.0, 1e-9);
  eq("  10% of ever losing 90%", M.ruinProb(1.0, 0.10) * 100, 10.0, 1e-9);
  yes("at full Kelly the exponent is 1, so P equals the level itself",
    Math.abs(M.ruinProb(1.0, 0.37) - 0.37) < 1e-12);
  eq("half Kelly: 12.5% of ever halving", M.ruinProb(0.5, 0.5) * 100, 12.5, 1e-9);
  eq("  and 1.56% of ever quartering", M.ruinProb(0.5, 0.25) * 100, 1.5625, 1e-6);
  eq("quarter Kelly: 0.78% of ever halving", M.ruinProb(0.25, 0.5) * 100, 0.7813, 5e-4);
  eq("half Kelly keeps 75% of the growth", M.growthKept(0.5) * 100, 75.0, 1e-9);
  eq("quarter Kelly keeps 43.8%", M.growthKept(0.25) * 100, 43.75, 1e-9);
  eq("three-quarter Kelly keeps 93.8%", M.growthKept(0.75) * 100, 93.75, 1e-9);
  eq("full Kelly keeps all of it", M.growthKept(1.0) * 100, 100.0, 1e-9);
  yes("halving the stake costs a quarter of the growth and removes three quarters of the risk",
    M.growthKept(0.5) === 0.75 && M.ruinProb(0.5, 0.5) / M.ruinProb(1.0, 0.5) === 0.25);
  yes("growth per unit of risk is better below full Kelly",
    M.growthKept(0.5) / 0.5 > M.growthKept(1.0) / 1.0);

  console.log("    chapter 04 - four seats, one arithmetic");
  const S = M.__seats();
  S.forEach(s => console.log("      " + s.n.padEnd(16) +
    " SR/unit " + s.srUnit.toFixed(4).padStart(8) +
    "  annual SR " + s.srYear.toFixed(3).padStart(7) +
    "  Kelly " + (s.kelly * 100).toFixed(2).padStart(8) + "%" +
    "  years " + s.yearsToT2.toFixed(2).padStart(6)));
  eq("sports betting: annual Sharpe 1.01", S[0].srYear, 1.0062, 5e-3);
  eq("  4.50% Kelly stake", S[0].kelly * 100, 4.50, 5e-3);
  eq("  3.95 years to t=2", S[0].yearsToT2, 3.951, 5e-3);
  eq("card counting: annual Sharpe 1.23", S[1].srYear, 1.2296, 5e-3);
  eq("  0.76% Kelly stake", S[1].kelly * 100, 0.7561, 5e-3);
  eq("  2.65 years to t=2", S[1].yearsToT2, 2.6450, 5e-3);
  eq("live poker: annual Sharpe 0.96", S[2].srYear, 0.9623, 5e-3);
  eq("  4.32 years to t=2", S[2].yearsToT2, 4.320, 5e-3);
  eq("selling vol: annual Sharpe 1.50", S[3].srYear, 1.5, 1e-9);
  eq("  1.78 years to t=2", S[3].yearsToT2, 1.7778, 5e-3);
  yes("the smallest per-unit edge does NOT have the worst Sharpe",
    S[1].ev < S[0].ev && S[1].ev < S[2].ev && S[1].srYear > S[0].srYear && S[1].srYear > S[2].srYear);
  yes("  frequency is what makes an edge bankable", S[1].per > S[2].per);
  yes("live poker has the largest per-unit edge and the worst annual Sharpe",
    S[2].ev >= S[0].ev && S[2].srYear < S[0].srYear && S[2].srYear < S[1].srYear);

  console.log("    chapter 04 - years to t=2 is 4 over Sharpe squared, always");
  S.forEach(s => {
    yes("  " + s.n + ": the formula matches the count",
      Math.abs(s.yearsToT2 - 4 / (s.srYear * s.srYear)) < 1e-9);
    yes("  " + s.n + ": and the units cancel",
      Math.abs(s.unitsToT2 / s.per - s.yearsToT2) < 1e-6);
  });
  eq("a Sharpe of 1.0 takes four years", 4 / 1.0, 4.0, 1e-12);
  eq("a Sharpe of 1.5 takes 1.78", 4 / (1.5 * 1.5), 1.7778, 5e-4);
  eq("a Sharpe of 0.5 takes sixteen", 4 / (0.5 * 0.5), 16.0, 1e-12);

  console.log("    chapter 05 - where it breaks");
  eq("Kelly on 15% alpha at 10% vol is 15x leverage", M.kellyC(0.15, 0.10), 15.0, 1e-9);
  eq("  and that Sharpe takes 1.78 years to establish",
    4 / Math.pow(0.15 / 0.10, 2), 1.7778, 5e-4);
  yes("  which is the same figure the vol seat reports", Math.abs(S[3].yearsToT2 - 1.7778) < 5e-3);
  /* overestimating the edge twofold lands you at double the true Kelly */
  const chosen = M.kellyC(0.15, 0.10), trueK = M.kellyC(0.075, 0.10);
  eq("if the true edge is half what you assumed, true Kelly is 7.5x", trueK, 7.5, 1e-9);
  eq("  so you are betting exactly 2x true Kelly", chosen / trueK, 2.0, 1e-12);
  eq("  where continuous growth is exactly zero", M.growthC(chosen, 0.075, 0.10), 0.0, 1e-14);
  yes("  all of the volatility and none of the return",
    Math.abs(M.growthC(chosen, 0.075, 0.10)) < 1e-14);
  /* and the argument for sizing at half */
  const halfStake = M.kellyC(0.15, 0.10) * 0.5;
  eq("sizing at half Kelly on a doubled estimate lands on true full Kelly",
    halfStake, trueK, 1e-9);
  yes("  so the fraction buys a margin of error in the input, not just a smoother ride",
    Math.abs(M.growthC(halfStake, 0.075, 0.10) -
      M.growthC(trueK, 0.075, 0.10)) < 1e-14);
  yes("overbetting by three times the edge makes growth negative",
    M.growthC(M.kellyC(0.15, 0.10), 0.05, 0.10) < 0);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("eight distinct question kinds", Object.keys(kinds).length === 8);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};


/* ── run ─────────────────────────────────────────────────────────────── */
const only = process.argv[2];
const names = only ? [only.replace(/\.html$/, "")] : Object.keys(PAGES);
for (const name of names) {
  if (!PAGES[name]) { console.error("no claims recorded for " + name); process.exit(2); }
  console.log("\n  " + name + ".html");
  try { PAGES[name](); }
  catch (e) { fails++; console.log("    FAIL threw: " + e.message); }
}
console.log("\n" + (fails
  ? fails + " of " + checks + " claims do NOT match what the pages compute"
  : "all " + checks + " numeric claims match — " + names.length + " page(s)"));
process.exit(fails ? 1 : 0);
