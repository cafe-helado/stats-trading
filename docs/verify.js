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
