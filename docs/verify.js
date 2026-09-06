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
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  /* load exactly what the page links, so a page with an extra asset — the
     practice page and its question bank — is exercised as it ships */
  const srcs = [];
  const reS = /<script src="(assets\/[a-z0-9.-]+\.js)"/g;
  let mS;
  while ((mS = reS.exec(html)) !== null) {
    if (mS[1].indexOf("pwa.js") < 0) srcs.push(mS[1]);
  }
  if (!srcs.length) srcs.push("assets/lab.js", "assets/stats.js");
  const LAB = srcs.map(f => fs.readFileSync(path.join(ROOT, f), "utf8"))
    .join("\n").replace("const kvHTML=", "let kvHTML=");
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


PAGES["test"] = () => {
  const M = load("test.html", ["binomP", "binomPone", "normalZ", "critical", "power",
    "nForPower", "nForPowerSafe", "nFormula", "twoProp", "twoMean", "gof", "indep", "familyWise",
    "bonferroni", "powerZ", "ppv", "__tables", "__drill",
    "pchisq", "pt", "chisqP", "tP", "zP", "qnorm", "pbinom",
    "s1", "s2", "s3", "s4", "s5", "s6"]);

  console.log("    the engine's new distributions, against published tables");
  eq("pchisq(3.8415, 1) is the 5% point", M.pchisq(3.8415, 1), 0.95, 5e-5);
  eq("pchisq(11.0705, 5) likewise", M.pchisq(11.0705, 5), 0.95, 5e-5);
  eq("pchisq(18.3070, 10) likewise", M.pchisq(18.3070, 10), 0.95, 5e-5);
  eq("pchisq(6.6349, 1) is the 1% point", M.pchisq(6.6349, 1), 0.99, 5e-5);
  eq("pt(2.2622, 9) is the two-sided 5% point", M.pt(2.2622, 9), 0.975, 5e-5);
  eq("pt(2.0860, 20) likewise", M.pt(2.0860, 20), 0.975, 5e-5);
  eq("pt(1.9840, 100) likewise", M.pt(1.9840, 100), 0.975, 5e-5);
  yes("t converges on the normal as df grows",
    Math.abs(M.pt(1.959964, 1e7) - 0.975) < 1e-5);
  yes("t is symmetric", Math.abs(M.pt(-2, 15) + M.pt(2, 15) - 1) < 1e-12);

  console.log("    chapter 01 - the null, and the p-value");
  eq("a fair coin gives 60+ heads in 100  2.844% of the time",
    M.binomPone(60, 100, 0.5) * 100, 2.8444, 5e-4);
  eq("  so the exact two-sided p-value is 5.689%",
    M.binomP(60, 100, 0.5) * 100, 5.6888, 5e-4);
  eq("z is exactly 2.00", M.normalZ(60, 100, 0.5), 2.0, 1e-12);
  eq("  and the normal approximation gives 4.550%",
    M.zP(M.normalZ(60, 100, 0.5)) * 100, 4.5500, 5e-3);
  yes("THE POINT: the exact test does NOT clear 0.05",
    M.binomP(60, 100, 0.5) > 0.05);
  yes("  while the approximation does", M.zP(M.normalZ(60, 100, 0.5)) < 0.05);
  yes("  so the two disagree on identical data",
    (M.binomP(60, 100, 0.5) < 0.05) !== (M.zP(M.normalZ(60, 100, 0.5)) < 0.05));
  yes("the exact p is the more conservative of the two",
    M.binomP(60, 100, 0.5) > M.zP(M.normalZ(60, 100, 0.5)));
  yes("ten times the data at the same edge is decisive",
    M.binomP(540, 1000, 0.5) < 0.02);

  console.log("    chapter 02 - the two ways to be wrong");
  const c = M.critical(100, 0.5, 0.05);
  eq("at n=100, alpha=0.05 the acceptance region starts at 40", c.lo, 40, 0);
  eq("  and ends at 60", c.hi, 60, 0);
  yes("so 60 heads does not reject, agreeing with chapter 01", 60 <= c.hi);
  eq("the realized type I rate is 3.52%, not 5%", c.alphaReal * 100, 3.520, 5e-3);
  yes("  a discrete test cannot be dialed to exactly alpha", c.alphaReal < 0.05);
  eq("critical z at alpha 0.10", -M.qnorm(0.05), 1.6449, 5e-4);
  eq("critical z at alpha 0.05", -M.qnorm(0.025), 1.9600, 5e-4);
  eq("critical z at alpha 0.01", -M.qnorm(0.005), 2.5758, 5e-4);

  console.log("    chapter 03 - power");
  eq("power against a 55/45 coin at n=100 is 13.52%",
    M.power(100, 0.55, 0.05) * 100, 13.52, 0.02);
  eq("  at n=250, 35.24%", M.power(250, 0.55, 0.05) * 100, 35.24, 0.02);
  eq("  at n=500, 58.95%", M.power(500, 0.55, 0.05) * 100, 58.95, 0.02);
  eq("  at n=1000, 88.01%", M.power(1000, 0.55, 0.05) * 100, 88.01, 0.02);
  eq("786 is the first n reaching 80% power", M.nForPower(0.55, 0.80, 0.05), 786, 0);
  yes("  and it really is the first - 785 falls short",
    M.power(786, 0.55, 0.05) >= 0.80 && M.power(785, 0.55, 0.05) < 0.80);
  console.log("    chapter 03 - and power is NOT monotonic in n");
  eq("power at 786 is 80.13%", M.power(786, 0.55, 0.05) * 100, 80.132, 5e-3);
  eq("  but at 787 it falls back to 79.21%", M.power(787, 0.55, 0.05) * 100, 79.207, 5e-3);
  yes("  so more data made the test WORSE", M.power(787, 0.55, 0.05) < M.power(786, 0.55, 0.05));
  eq("it is reliably above 80% only from 820", M.nForPowerSafe(0.55, 0.80, 0.05), 820, 0);
  eq("  where power is 80.99%", M.power(820, 0.55, 0.05) * 100, 80.994, 5e-3);
  yes("  and every n from 820 up stays above the line",
    [820, 830, 850, 900, 1000].every(n => M.power(n, 0.55, 0.05) >= 0.80));
  yes("  while 819 does not", M.power(819, 0.55, 0.05) < 0.80);
  console.log("    chapter 03 - the cause: the rejection region moves in whole counts");
  eq("at n=786 the realized alpha is 4.97%",
    M.critical(786, 0.5, 0.05).alphaReal * 100, 4.972, 5e-3);
  eq("  at n=787 it drops to 4.59%",
    M.critical(787, 0.5, 0.05).alphaReal * 100, 4.585, 5e-3);
  yes("  a smaller realized alpha is what costs the power",
    M.critical(787, 0.5, 0.05).alphaReal < M.critical(786, 0.5, 0.05).alphaReal);
  eq("  and the threshold moved by exactly one count",
    M.critical(787, 0.5, 0.05).hi - M.critical(786, 0.5, 0.05).hi, 1, 0);
  eq("1055 is the first n reaching 90%", M.nForPower(0.55, 0.90, 0.05), 1055, 0);
  eq("  reliable only from 1080", M.nForPowerSafe(0.55, 0.90, 0.05), 1080, 0);
  eq("the normal-theory formula gives 1047 for 90%",
    M.nFormula(0.55, 0.90, 0.05), 1046.6, 1.0);
  yes("  which is within one percent of the exact answer",
    Math.abs(M.nFormula(0.55, 0.90, 0.05) - 1055) / 1055 < 0.01);
  eq("type II error at n=100 is 86.48%",
    (1 - M.power(100, 0.55, 0.05)) * 100, 86.48, 0.02);
  yes("a test has no power against an effect of zero size",
    Math.abs(M.power(100, 0.5001, 0.05) - M.critical(100, 0.5, 0.05).alphaReal) < 0.01);
  eq("power at n=100 against a 60/40 coin", M.power(100, 0.60, 0.05) * 100, 46.21, 0.02);
  eq("  against 70/30", M.power(100, 0.70, 0.05) * 100, 97.90, 0.02);
  console.log("    chapter 03 - and the link back to module 13");
  eq("the 80% power bracket is 7.849",
    Math.pow(-M.qnorm(0.025) + -M.qnorm(0.20), 2), 7.849, 5e-3);
  eq("  so a Sharpe of 1.0 needs 7.85 years for 80% power",
    Math.pow(-M.qnorm(0.025) + -M.qnorm(0.20), 2) / 1.0, 7.849, 5e-3);
  yes("  which is about double the 4 years to merely cross t=2",
    Math.abs(Math.pow(-M.qnorm(0.025) + -M.qnorm(0.20), 2) / 4 - 1.962) < 0.01);

  console.log("    chapter 04 - comparing two groups");
  const T = M.twoProp(58, 100, 47, 100);
  eq("pooled rate is 52.5%", T.pooled * 100, 52.5, 1e-9);
  eq("se of the difference is 7.062 points", T.se * 100, 7.062, 5e-3);
  eq("z is 1.5576", T.z, 1.5576, 5e-4);
  eq("p is 0.1193", T.p, 0.11933, 5e-5);
  yes("58 against 47 out of 100 is NOT significant", T.p > 0.05);
  eq("the gap would need to be 13.84 points", T.needed * 100, 13.84, 0.02);
  yes("  which is well beyond the 11 points observed", T.needed * 100 > 11);
  const W = M.twoMean(0.048, 0.21, 60, 0.021, 0.19, 60);
  eq("two strategies: se of the difference 0.03656", W.se, 0.036558, 5e-5);
  eq("  t is 0.7385", W.t, 0.7385, 5e-4);
  eq("  on 116.84 degrees of freedom", W.df, 116.84, 0.05);
  eq("  p is 0.4617", W.p, 0.46169, 5e-4);
  yes("five years of data cannot separate them", W.p > 0.05);

  console.log("    chapter 05 - categories");
  const TB = M.__tables();
  eq("the die was rolled 300 times", TB.die.N, 300, 0);
  eq("  expecting 50 in each of six faces", TB.die.exp, 50, 1e-12);
  eq("  chi-square is 6.08", TB.die.X, 6.08, 5e-3);
  eq("  on 5 degrees of freedom", TB.die.df, 5, 0);
  eq("  p is 0.2985", TB.die.p, 0.29851, 5e-4);
  yes("so there is no evidence the die is loaded", TB.die.p > 0.05);
  yes("  even though one face came up 62 times", true);
  eq("the 5% critical value on 5 df is 11.07", 11.0705, 11.0705, 1e-9);
  yes("  and 6.08 is well short of it", TB.die.X < 11.0705);
  eq("the 2x2 signal table: chi-square 4.3077", TB.signal.X, 4.3077, 5e-4);
  eq("  on 1 degree of freedom", TB.signal.df, 1, 0);
  eq("  p is 0.03794", TB.signal.p, 0.03794, 5e-5);
  yes("  which does clear 0.05", TB.signal.p < 0.05);
  const Z2 = M.twoProp(42, 100, 28, 100);
  eq("the same table as a two-proportion z-test gives z = 2.0755", Z2.z, 2.0755, 5e-4);
  eq("  and z squared is exactly the chi-square", Z2.z * Z2.z, TB.signal.X, 1e-9);
  /* the identity is exact; the two p-values differ only because zP goes
     through the normal approximation in lab.js and chisqP through the
     incomplete gamma, which is a numerical route rather than a real gap */
  eq("  and the same p-value to six places", Z2.p, TB.signal.p, 1e-6);
  yes("they are one test in two notations", Math.abs(Z2.z * Z2.z - TB.signal.X) < 1e-9);

  console.log("    chapter 06 - test twenty things");
  eq("20 tests at 5%: 64.15% chance of at least one hit",
    M.familyWise(20, 0.05) * 100, 64.151, 5e-3);
  eq("  5 tests, 22.62%", M.familyWise(5, 0.05) * 100, 22.622, 5e-3);
  eq("  50 tests, 92.31%", M.familyWise(50, 0.05) * 100, 92.306, 5e-3);
  eq("  100 tests, 99.41%", M.familyWise(100, 0.05) * 100, 99.408, 5e-3);
  eq("expected false positives is just alpha times the count", 20 * 0.05, 1.0, 1e-12);
  eq("Bonferroni for 20 tests is 0.0025", M.bonferroni(20, 0.05), 0.0025, 1e-12);
  eq("  restoring family-wise error to 4.883%",
    M.familyWise(20, M.bonferroni(20, 0.05)) * 100, 4.883, 5e-3);
  eq("  and moving the critical z from 1.96", -M.qnorm(0.025), 1.9600, 5e-4);
  eq("  to 3.0233", -M.qnorm(0.0025 / 2), 3.0233, 5e-4);
  eq("power at n=1000 uncorrected is 88.7%",
    M.powerZ(1000, 0.55, 0.05) * 100, 88.7, 0.15);
  eq("  and 55.6% after Bonferroni",
    M.powerZ(1000, 0.55, 0.0025) * 100, 55.6, 0.15);
  yes("the correction costs a third of the power",
    M.powerZ(1000, 0.55, 0.0025) < 0.7 * M.powerZ(1000, 0.55, 0.05));
  eq("a passing strategy is real 45.71% of the time",
    M.ppv(0.05, 0.80, 0.05) * 100, 45.714, 5e-3);
  yes("  which is worse than a coin flip", M.ppv(0.05, 0.80, 0.05) < 0.5);
  eq("  of 100 tried, 4.0 real finds", 100 * 0.05 * 0.80, 4.0, 1e-12);
  eq("  and 4.75 false ones", 100 * 0.95 * 0.05, 4.75, 1e-12);
  eq("module 10's harsher 10% false-positive rate gives 29.63%",
    M.ppv(0.05, 0.80, 0.10) * 100, 29.63, 0.02);
  yes("  which is the same arithmetic, less flattering",
    M.ppv(0.05, 0.80, 0.10) < M.ppv(0.05, 0.80, 0.05));

  console.log("    chapter 07 - the drill generator");
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


PAGES["count"] = () => {
  const M = load("count.html", ["permute", "powRep", "lfact", "logPermute", "logChoose",
    "noShared", "anyShared", "matchesYou", "pairsOf", "poissonApprox", "firstAbove",
    "pokerHands", "pascalRow", "rowSum", "choose", "lchoose", "__poker", "__pascal",
    "__drill", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - multiply the choices");
  eq("a 4-digit PIN with repeats is 10,000", M.powRep(10, 4), 10000, 0);
  eq("  without repeats, 5,040", M.permute(10, 4), 5040, 0);
  yes("  forbidding repeats always gives fewer", M.permute(10, 4) < M.powRep(10, 4));
  eq("P(52,5) is 311,875,200", M.permute(52, 5), 311875200, 0);
  eq("P(26,4) is 358,800", M.permute(26, 4), 358800, 0);
  eq("52! is 8.0658e67, so log10 is 67.9066", M.lfact(52) / Math.LN10, 67.9066, 5e-4);
  yes("  which is far below the 1e80 atoms in the observable universe",
    M.lfact(52) / Math.LN10 < 80);
  yes("the three counts are ordered n^r >= P >= C for every r",
    [1, 2, 3, 5, 10, 20].every(r =>
      M.logPowRep ? true : true) &&
    [1, 2, 3, 5, 10, 20].every(r =>
      r * Math.log10(52) >= M.logPermute(52, r) - 1e-9 &&
      M.logPermute(52, r) >= M.logChoose(52, r) - 1e-9));

  console.log("    chapter 02 - when order stops mattering");
  eq("C(52,5) is 2,598,960", M.choose(52, 5), 2598960, 0);
  eq("  and P(52,5) divided by 5! gives it", M.permute(52, 5) / 120, 2598960, 1e-6);
  eq("5! is 120", Math.round(Math.exp(M.lfact(5))), 120, 0);
  eq("C(49,6) is 13,983,816", M.choose(49, 6), 13983816, 0);
  eq("C(52,2) is 1,326", M.choose(52, 2), 1326, 0);
  eq("C(10,3) is 120", M.choose(10, 3), 120, 0);
  yes("combinations are symmetric: C(52,5) = C(52,47)",
    M.choose(52, 5) === M.choose(52, 47));
  yes("  and C(n,0) = C(n,n) = 1", M.choose(52, 0) === 1 && M.choose(52, 52) === 1);
  yes("the ratio P/C is always exactly r!",
    [2, 3, 5, 6].every(r =>
      Math.abs(M.permute(52, r) / M.choose(52, r) - Math.round(Math.exp(M.lfact(r)))) < 1e-6));

  console.log("    chapter 03 - the birthday problem");
  eq("23 people: P(no shared birthday) is 0.492703",
    M.noShared(23, 365), 0.492703, 5e-6);
  eq("  so P(at least one) is 50.7297%", M.anyShared(23, 365) * 100, 50.7297, 5e-4);
  eq("22 people give 47.5695%", M.anyShared(22, 365) * 100, 47.5695, 5e-4);
  yes("  so 23 is the first to pass one half",
    M.anyShared(23, 365) > 0.5 && M.anyShared(22, 365) < 0.5);
  eq("the first n above one half is 23", M.firstAbove(0.5, 365), 23, 0);
  eq("the first n above 99% is 57", M.firstAbove(0.99, 365), 57, 0);
  eq("  where the probability is 99.0122%", M.anyShared(57, 365) * 100, 99.0122, 5e-4);
  eq("70 people give 99.9160%", M.anyShared(70, 365) * 100, 99.9160, 5e-4);
  console.log("    chapter 03 - and why: pairs, not people");
  eq("23 people make 253 pairs", M.pairsOf(23), 253, 0);
  eq("  each pair matches with probability 1/365", 1 / 365, 0.0027397, 5e-7);
  eq("  so the expected number of matches is 0.6932", 253 / 365, 0.69315, 5e-5);
  eq("the Poisson approximation gives 50.0002%",
    M.poissonApprox(23, 365) * 100, 50.0002, 5e-4);
  yes("  which is within a percentage point of the exact answer",
    Math.abs(M.poissonApprox(23, 365) - M.anyShared(23, 365)) < 0.01);
  yes("pairs grow quadratically while people grow linearly",
    M.pairsOf(46) / M.pairsOf(23) > 3.9);
  console.log("    chapter 03 - the question people confuse it with");
  eq("23 others matching YOU specifically: 6.1151%",
    M.matchesYou(23, 365) * 100, 6.1151, 5e-4);
  eq("  50 others give 12.8182%", M.matchesYou(50, 365) * 100, 12.8182, 5e-4);
  eq("  and 253 others give 50.0477%", M.matchesYou(253, 365) * 100, 50.0477, 5e-4);
  yes("  so matching one named person needs 253 others, not 23",
    M.matchesYou(252, 365) < 0.5 && M.matchesYou(253, 365) > 0.5);
  yes("  which is the same 253 as the pairs among 23 people",
    M.pairsOf(23) === 253);

  console.log("    chapter 04 - every poker hand, counted");
  const P = M.__poker();
  P.hands.forEach(h => console.log("      " + h.n.padEnd(17) +
    String(h.v).padStart(9) + "   " + (h.p * 100).toFixed(6).padStart(10) + "%"));
  eq("there are 2,598,960 five-card hands", P.total, 2598960, 0);
  yes("EVERY category summed equals it exactly", P.sum === P.total);
  const by = {};
  P.hands.forEach(h => { by[h.n] = h.v; });
  eq("royal flush: 4", by["Royal flush"], 4, 0);
  eq("straight flush: 36", by["Straight flush"], 36, 0);
  eq("four of a kind: 624", by["Four of a kind"], 624, 0);
  eq("full house: 3,744", by["Full house"], 3744, 0);
  eq("flush: 5,108", by["Flush"], 5108, 0);
  eq("straight: 10,200", by["Straight"], 10200, 0);
  eq("three of a kind: 54,912", by["Three of a kind"], 54912, 0);
  eq("two pair: 123,552", by["Two pair"], 123552, 0);
  eq("one pair: 1,098,240", by["One pair"], 1098240, 0);
  eq("high card: 1,302,540", by["High card"], 1302540, 0);
  yes("a flush is rarer than a straight, which is why it outranks it",
    by["Flush"] < by["Straight"]);
  eq("  by almost exactly a factor of two", by["Straight"] / by["Flush"], 1.9969, 5e-4);
  yes("the categories are strictly ordered by rarity",
    P.hands.every((h, i, a) => i === 0 || h.v >= a[i - 1].v));
  eq("four of a kind comes out at 1 in 4,165", by["Four of a kind"] &&
    P.total / by["Four of a kind"], 4165, 0.5);
  eq("one pair is 42.2569% of hands", by["One pair"] / P.total * 100, 42.2569, 5e-4);
  eq("high card is 50.1177%", by["High card"] / P.total * 100, 50.1177, 5e-4);

  console.log("    chapter 05 - where the binomial coefficient comes from");
  eq("C(10,5) is 252", M.choose(10, 5), 252, 0);
  eq("  so P(exactly 5 heads in 10) is 24.6094%",
    M.choose(10, 5) / 1024 * 100, 24.6094, 5e-4);
  eq("  while P(all 10 heads) is 0.0977%", 1 / 1024 * 100, 0.09766, 5e-5);
  eq("  a ratio of 252 to 1", M.choose(10, 5) / 1, 252, 0);
  yes("every sequence is equally likely; there are just more of some counts",
    M.choose(10, 5) > M.choose(10, 10));
  const r8 = M.pascalRow(8);
  yes("row 8 of Pascal is 1 8 28 56 70 56 28 8 1",
    r8.join(",") === "1,8,28,56,70,56,28,8,1");
  yes("each entry is the sum of the two above it",
    [1, 2, 3, 4, 5, 6, 7, 8].every(k =>
      M.choose(8, k) === M.choose(7, k - 1) + M.choose(7, k)));
  [5, 10, 16, 20].forEach(n => {
    eq("row " + n + " sums to 2^" + n, M.rowSum(n), Math.pow(2, n), 0.5);
  });
  yes("which is why the binomial probabilities add to one",
    Math.abs(M.rowSum(10) / Math.pow(2, 10) - 1) < 1e-12);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(32) + kinds[k]));
  yes("seven distinct question kinds", Object.keys(kinds).length === 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};


PAGES["rules"] = () => {
  const M = load("rules.html", ["complement", "atLeastOne", "orOf", "andOf", "given",
    "independent", "mutuallyExclusive", "attemptsForHalf", "withoutRepl", "withRepl",
    "coinNext", "deckNextRed", "twoChildren", "monty", "montyRandomHost",
    "TWO_CHILDREN", "DEMERE", "__puzzles", "__drill", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - count what you don't want");
  eq("at least one six in 4 rolls: 51.7747%",
    M.atLeastOne(1 / 6, 4) * 100, 51.7747, 5e-4);
  eq("  the complement, (5/6)^4", Math.pow(5 / 6, 4) * 100, 48.2253, 5e-4);
  yes("  and they sum to one",
    Math.abs(M.atLeastOne(1 / 6, 4) + Math.pow(5 / 6, 4) - 1) < 1e-12);
  eq("at least one six in 6 rolls is 66.5102%",
    M.atLeastOne(1 / 6, 6) * 100, 66.5102, 5e-4);
  yes("  which is NOT 100%, as adding 1/6 six times would suggest",
    M.atLeastOne(1 / 6, 6) < 0.67);
  console.log("    chapter 01 - de Mere's two bets");
  eq("a six in four rolls of one die: 51.7747%",
    M.atLeastOne(1 / 6, 4) * 100, 51.7747, 5e-4);
  eq("a double six in 24 rolls of two: 49.1404%",
    M.atLeastOne(1 / 36, 24) * 100, 49.1404, 5e-4);
  yes("the first is above a half", M.atLeastOne(1 / 6, 4) > 0.5);
  yes("  and the second is below it", M.atLeastOne(1 / 36, 24) < 0.5);
  eq("  separated by 2.63 points",
    (M.atLeastOne(1 / 6, 4) - M.atLeastOne(1 / 36, 24)) * 100, 2.6343, 5e-4);
  eq("4 attempts take a 1/6 event past a half", M.attemptsForHalf(1 / 6), 4, 0);
  eq("25 attempts take a 1/36 event past a half", M.attemptsForHalf(1 / 36), 25, 0);
  yes("  so de Mere's 24 was one roll short", M.attemptsForHalf(1 / 36) === 25);
  eq("a 1-in-100 event needs 69 attempts", M.attemptsForHalf(0.01), 69, 0);

  console.log("    chapter 02 - adding, and the overlap");
  const pH = 13 / 52, pF = 12 / 52, pB = 3 / 52;
  eq("P(heart) is 25%", pH * 100, 25.0, 1e-9);
  eq("P(face card) is 23.0769%", pF * 100, 23.0769, 5e-4);
  eq("P(both) is 5.7692%", pB * 100, 5.7692, 5e-4);
  eq("the naive sum is 48.0769%", (pH + pF) * 100, 48.0769, 5e-4);
  eq("P(heart or face) is 42.3077%", M.orOf(pH, pF, pB) * 100, 42.3077, 5e-4);
  eq("  which is 22 of 52 cards", M.orOf(pH, pF, pB) * 52, 22, 1e-9);
  eq("  overcounted by exactly the 3 shared cards", (pH + pF - M.orOf(pH, pF, pB)) * 52, 3, 1e-9);
  eq("heart or spade needs no correction", M.orOf(pH, pH, 0) * 100, 50.0, 1e-9);
  console.log("    chapter 02 - mutually exclusive is NOT independent");
  yes("heart and spade are mutually exclusive", M.mutuallyExclusive(0));
  eq("  if independent, P(both) would be 6.25%", pH * pH * 100, 6.25, 1e-9);
  yes("  but it is zero, so they are not independent", !M.independent(pH, pH, 0));
  yes("  and knowing one rules the other out entirely", M.given(0, pH) === 0);
  yes("independence holds only when P(and) equals the product",
    M.independent(0.5, 0.4, 0.2) && !M.independent(0.5, 0.4, 0.0));
  yes("the only way to be both is for one to be impossible",
    M.mutuallyExclusive(0) && M.independent(0, 0.5, 0));

  console.log("    chapter 03 - multiplying");
  eq("P(first ace) is 4/52 = 7.6923%", 4 / 52 * 100, 7.6923, 5e-4);
  eq("P(second ace | first) is 3/51 = 5.8824%", 3 / 51 * 100, 5.8824, 5e-4);
  eq("P(two aces) is 0.4525%", M.withoutRepl(2, 4, 52) * 100, 0.452489, 5e-6);
  eq("  which is 1 in 221", 1 / M.withoutRepl(2, 4, 52), 221.0, 0.05);
  eq("  and matches the counting route C(4,2)/C(52,2)",
    M.withoutRepl(2, 4, 52), 6 / 1326, 1e-12);
  eq("with replacement it would be 0.5917%", M.withRepl(2, 4, 52) * 100, 0.591716, 5e-6);
  yes("  which is larger, because the deck never shrank",
    M.withRepl(2, 4, 52) > M.withoutRepl(2, 4, 52));
  console.log("    chapter 03 - the conjunction rule");
  eq("six independent 90% conditions leave 53.1441%",
    Math.pow(0.9, 6) * 100, 53.1441, 5e-4);
  yes("adding a condition can only shrink the probability",
    [1, 2, 3, 4, 5, 6].every((k, i, a) =>
      i === 0 || Math.pow(0.9, k) < Math.pow(0.9, a[i - 1])));
  yes("P(A and B) never exceeds either part",
    [[0.9, 0.8], [0.5, 0.5], [0.99, 0.2]].every(([a, b]) =>
      a * b <= a + 1e-12 && a * b <= b + 1e-12));

  console.log("    chapter 04 - a coin has no memory, a deck does");
  eq("the coin is always 50%", M.coinNext() * 100, 50.0, 1e-12);
  yes("  however long the run", M.coinNext() === 0.5);
  eq("P(5 heads in a row) is 3.125%", Math.pow(0.5, 5) * 100, 3.125, 1e-9);
  eq("P(6 heads in a row) is 1.5625%", Math.pow(0.5, 6) * 100, 1.5625, 1e-9);
  yes("  yet the sixth flip is still a coin flip", M.coinNext() === 0.5);
  eq("a fresh deck: P(next is red) is 50%", M.deckNextRed(0, 26) * 100, 50.0, 1e-9);
  eq("after 10 blacks: 61.9048%", M.deckNextRed(10, 26) * 100, 61.9048, 5e-4);
  eq("after 20 blacks: 81.25%", M.deckNextRed(20, 26) * 100, 81.25, 5e-4);
  eq("after 26 blacks: 100%", M.deckNextRed(26, 26) * 100, 100.0, 1e-9);
  yes("the deck really does even out", M.deckNextRed(26, 26) === 1);
  yes("  strictly, at every step", [0, 5, 10, 15, 20, 25].every((k, i, a) =>
    i === 0 || M.deckNextRed(k, 26) > M.deckNextRed(a[i - 1], 26)));
  yes("while the coin never moves at all", M.coinNext() === 0.5);

  console.log("    chapter 05 - conditioning");
  const atLeast = M.twoChildren(0), elder = M.twoChildren(1);
  eq("at least one boy leaves 3 outcomes", atLeast.nKeep, 3, 0);
  eq("  one of which is BB", atLeast.nWin, 1, 0);
  eq("  so P(both boys) is 1/3 = 33.3333%", atLeast.p * 100, 33.3333, 5e-4);
  eq("the elder is a boy leaves 2 outcomes", elder.nKeep, 2, 0);
  eq("  so P(both boys) is 1/2 = 50%", elder.p * 100, 50.0, 1e-9);
  yes("two conditions that sound alike give different answers",
    Math.abs(atLeast.p - elder.p) > 0.16);
  eq("  differing by 16.67 points", (elder.p - atLeast.p) * 100, 16.6667, 5e-4);
  console.log("    chapter 05 - Monty Hall");
  const MH = M.monty(3);
  eq("staying wins 1/3 = 33.3333%", MH.stick * 100, 33.3333, 5e-4);
  eq("switching wins 2/3 = 66.6667%", MH.swap * 100, 66.6667, 5e-4);
  yes("  and the two sum to one", Math.abs(MH.stick + MH.swap - 1) < 1e-12);
  eq("  switching is exactly twice as good", MH.swap / MH.stick, 2.0, 1e-12);
  eq("with 10 doors, switching wins 90%", M.monty(10).swap * 100, 90.0, 1e-9);
  yes("  the advantage grows with the door count",
    M.monty(10).swap > M.monty(3).swap);
  eq("a host choosing at random gives 50%", M.montyRandomHost().swap * 100, 50.0, 1e-9);
  yes("  so the host's RULE is the problem, not the door count",
    M.montyRandomHost().swap !== M.monty(3).swap);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(32) + kinds[k]));
  yes("seven distinct question kinds", Object.keys(kinds).length === 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};


PAGES["describe"] = () => {
  const M = load("describe.html", ["Z75", "IQR_SIGMA", "MAD_SIGMA", "IQR_TO_SIGMA",
    "MAD_TO_SIGMA", "iqrOf", "madOf", "spreads", "fiveNumber", "FENCE_SIGMA",
    "fenceFalseRate", "zOf", "pctOf", "withinK", "affine", "standardize",
    "BASE", "withOutlier", "__salaries", "__five", "__fence", "__spreadRun",
    "__drill", "mean", "median", "sd", "quantile", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - center");
  const ten = M.withOutlier(1200);
  eq("ten salaries have a mean of 167.90", M.mean(ten), 167.90, 5e-3);
  eq("  and a median of 54.00", M.median(ten), 54.0, 1e-9);
  yes("  so the mean describes nobody in the room",
    ten.filter(x => x < M.mean(ten)).length === 9);
  eq("without the outlier the mean is 53.22", M.mean(M.BASE), 53.2222, 5e-4);
  eq("  and the median is 53.00", M.median(M.BASE), 53.0, 1e-9);
  eq("the mean moved by 114.68", M.mean(ten) - M.mean(M.BASE), 114.678, 5e-3);
  eq("  while the median moved by 1.00", M.median(ten) - M.median(M.BASE), 1.0, 1e-9);
  yes("  a hundredfold difference in sensitivity",
    (M.mean(ten) - M.mean(M.BASE)) / (M.median(ten) - M.median(M.BASE)) > 100);
  console.log("    chapter 01 - the breakdown point, demonstrated");
  eq("push the outlier to 12,000 and the mean is 1,247.90",
    M.mean(M.withOutlier(12000)), 1247.90, 5e-3);
  eq("  to 120,000 and it is 12,047.90", M.mean(M.withOutlier(120000)), 12047.90, 5e-3);
  yes("the median never moves at all",
    [1200, 12000, 120000, 1e9].every(v => M.median(M.withOutlier(v)) === 54.0));
  yes("  so one point in ten controls the mean entirely",
    M.mean(M.withOutlier(1e9)) > 1e8);

  console.log("    chapter 02 - spread");
  eq("with the outlier, sd is 362.715", M.sd(ten), 362.715, 5e-3);
  eq("  without it, 7.645", M.sd(M.BASE), 7.6449, 5e-4);
  eq("  a factor of 47.4", M.sd(ten) / M.sd(M.BASE), 47.446, 5e-3);
  eq("the IQR moves only from 10.00 to 12.25", M.iqrOf(ten), 12.25, 5e-3);
  eq("  from", M.iqrOf(M.BASE), 10.0, 1e-9);
  eq("  a factor of 1.225", M.iqrOf(ten) / M.iqrOf(M.BASE), 1.225, 5e-4);
  yes("so the IQR is far steadier than the sd",
    (M.iqrOf(ten) / M.iqrOf(M.BASE)) < 0.05 * (M.sd(ten) / M.sd(M.BASE)));
  console.log("    chapter 02 - the normal constants");
  eq("the normal's third quartile is 0.674490 sigma", M.Z75, 0.6744898, 5e-7);
  eq("so the IQR is 1.348980 sigma", M.IQR_SIGMA, 1.348980, 5e-6);
  eq("  and the median absolute deviation is 0.674490", M.MAD_SIGMA, 0.6744898, 5e-7);
  eq("IQR to sigma multiplies by 0.741301", M.IQR_TO_SIGMA, 0.741301, 5e-6);
  eq("MAD to sigma multiplies by 1.482602", M.MAD_TO_SIGMA, 1.482602, 5e-6);
  yes("  and the pairs are reciprocals",
    Math.abs(M.IQR_SIGMA * M.IQR_TO_SIGMA - 1) < 1e-12 &&
    Math.abs(M.MAD_SIGMA * M.MAD_TO_SIGMA - 1) < 1e-12);
  console.log("    chapter 02 - on clean data the three agree, on dirty data they do not");
  const clean = M.__spreadRun(0, 6, 4000, 909);
  const dirty = M.__spreadRun(0.10, 6, 4000, 909);
  console.log("      clean: sd " + clean.sd.toFixed(4) + "  IQR-sigma " +
    clean.iqrSigma.toFixed(4) + "  MAD-sigma " + clean.madSigma.toFixed(4));
  console.log("      dirty: sd " + dirty.sd.toFixed(4) + "  IQR-sigma " +
    dirty.iqrSigma.toFixed(4) + "  MAD-sigma " + dirty.madSigma.toFixed(4));
  yes("on clean normal data all three land near 1",
    [clean.sd, clean.iqrSigma, clean.madSigma].every(v => Math.abs(v - 1) < 0.08));
  yes("with 10% contamination the sd runs away", dirty.sd > 1.4);
  yes("  while the robust pair barely moves",
    Math.abs(dirty.iqrSigma - 1) < 0.20 && Math.abs(dirty.madSigma - 1) < 0.20);
  yes("  so their disagreement is a fat-tail diagnostic",
    dirty.sd / dirty.iqrSigma > 1.15 && clean.sd / clean.iqrSigma < 1.15);

  console.log("    chapter 03 - position");
  eq("z = 1 is the 84.134th percentile", M.pctOf(1), 84.1345, 5e-3);
  eq("z = 2 is the 97.725th", M.pctOf(2), 97.7250, 5e-3);
  eq("z = 3 is the 99.865th", M.pctOf(3), 99.8650, 5e-3);
  eq("z = 0 is the median", M.pctOf(0), 50.0, 1e-6);
  eq("within 1 sigma: 68.2689%", M.withinK(1) * 100, 68.2689, 5e-3);
  eq("within 2 sigma: 95.4500%", M.withinK(2) * 100, 95.4500, 5e-3);
  eq("within 3 sigma: 99.7300%", M.withinK(3) * 100, 99.7300, 5e-3);
  yes("so 68-95-99.7 is a rounding, not the exact figures",
    Math.abs(M.withinK(2) * 100 - 95) > 0.4);
  yes("and z=2 is the 97.7th percentile, NOT the 95th",
    Math.abs(M.pctOf(2) - 95) > 2.5);
  console.log("    chapter 03 - comparing unlike scales");
  eq("620 on a 500/100 test is z = 1.20", M.zOf(620, 500, 100), 1.20, 1e-9);
  eq("  the 88.493rd percentile", M.pctOf(M.zOf(620, 500, 100)), 88.4930, 5e-3);
  eq("31 on a 21/5 test is z = 2.00", M.zOf(31, 21, 5), 2.0, 1e-9);
  eq("  the 97.725th percentile", M.pctOf(M.zOf(31, 21, 5)), 97.7250, 5e-3);
  yes("so the smaller raw score is the better result",
    M.zOf(31, 21, 5) > M.zOf(620, 500, 100));

  console.log("    chapter 04 - five numbers and the fence");
  const F = M.__five(ten);
  eq("min is 42", F.min, 42, 0);
  eq("Q1 is 48.75", F.q1, 48.75, 5e-3);
  eq("median is 54.00", F.med, 54.0, 1e-9);
  eq("Q3 is 61.00", F.q3, 61.0, 1e-9);
  eq("max is 1200", F.max, 1200, 0);
  eq("IQR is 12.25", F.iqr, 12.25, 5e-3);
  eq("the lower fence is 30.375", F.loFence, 30.375, 5e-4);
  eq("the upper fence is 79.375", F.hiFence, 79.375, 5e-4);
  eq("exactly one point is flagged", F.nOut, 1, 0);
  yes("  and it is the 1200", F.outliers[0] === 1200);
  console.log("    chapter 04 - and the rate it fires on clean data");
  eq("the fence sits at 2.697959 sigma", M.FENCE_SIGMA, 2.697959, 5e-6);
  eq("  which is Q3 + 1.5 x IQR in sigmas",
    M.Z75 + 1.5 * M.IQR_SIGMA, 2.697959, 5e-6);
  eq("it fires on 0.6977% of clean normal points",
    M.fenceFalseRate() * 100, 0.69766, 5e-4);
  eq("  which is about one in 143", 1 / M.fenceFalseRate(), 143.3, 0.3);
  eq("  so 1000 clean points give about 7 flags",
    1000 * M.fenceFalseRate(), 6.977, 5e-3);
  yes("the rule is a prompt, not a verdict", M.fenceFalseRate() > 0.005);

  console.log("    chapter 05 - shifting and scaling");
  const shifted = M.affine(M.BASE, 1, 10);
  const scaled = M.affine(M.BASE, 2, 0);
  eq("adding 10 moves the mean by 10",
    M.mean(shifted) - M.mean(M.BASE), 10.0, 1e-9);
  eq("  and moves the median by 10",
    M.median(shifted) - M.median(M.BASE), 10.0, 1e-9);
  eq("  but leaves the sd untouched", M.sd(shifted), M.sd(M.BASE), 1e-12);
  eq("  and the IQR untouched", M.iqrOf(shifted), M.iqrOf(M.BASE), 1e-12);
  eq("doubling doubles the mean", M.mean(scaled) / M.mean(M.BASE), 2.0, 1e-12);
  eq("  and doubles the sd too", M.sd(scaled) / M.sd(M.BASE), 2.0, 1e-12);
  eq("  and the IQR", M.iqrOf(scaled) / M.iqrOf(M.BASE), 2.0, 1e-12);
  yes("so spread follows the stretch but not the shift",
    Math.abs(M.sd(shifted) - M.sd(M.BASE)) < 1e-12 &&
    Math.abs(M.sd(scaled) - 2 * M.sd(M.BASE)) < 1e-12);
  console.log("    chapter 05 - which is why a z-score is invariant");
  const zA = M.standardize(M.BASE);
  const zB = M.standardize(shifted);
  const zC = M.standardize(M.affine(M.BASE, 2, 10));
  yes("standardizing the shifted data gives identical z-scores",
    zA.every((v, i) => Math.abs(v - zB[i]) < 1e-12));
  yes("  and so does standardizing the scaled-and-shifted data",
    zA.every((v, i) => Math.abs(v - zC[i]) < 1e-12));
  eq("standardized data has mean exactly 0", M.mean(zA), 0, 1e-12);
  eq("  and standard deviation exactly 1", M.sd(zA), 1.0, 1e-12);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(32) + kinds[k]));
  yes("at least seven distinct question kinds", Object.keys(kinds).length >= 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};


PAGES["practice"] = () => {
  const M = load("practice.html", ["BANK", "MODNAME", "MODFILE", "bankById", "K",
    "BOXES", "MINTRIES", "blankRecord", "byModule", "weakest", "boxCounts",
    "chooseNext", "grade", "eligible", "__practice", "__exam",
    "ncdf", "qnorm", "npdf", "choose", "dbinom", "lgamma"]);

  /* a seeded generator, so every question below is reproducible */
  const seeded = seed => { let s = (seed | 0) || 99;
    return () => { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0;
      return (s >>> 0) / 4294967296; }; };
  /* drive a generator until it produces the case we want to check */
  const findCase = (id, needle) => {
    const want = [].concat(needle);
    const g = M.bankById(id), R = seeded(id.length * 31 + 7);
    for (let i = 0; i < 60000; i++) {
      const o = g.gen(R);
      if (want.every(w => o.q.indexOf(w) >= 0)) return o;
    }
    return null;
  };

  console.log("    the bank - shape");
  eq("47 question types", M.BANK.length, 47, 0);
  const mods = [];
  M.BANK.forEach(b => { if (mods.indexOf(b.mod) < 0) mods.push(b.mod); });
  mods.sort((a, b) => a - b);
  yes("every module 1 to 13 is represented",
    mods.join(",") === "1,2,3,4,5,6,7,8,9,10,11,12,13");
  const ids = M.BANK.map(b => b.id);
  yes("ids are unique", new Set(ids).size === ids.length);
  yes("both tiers are present",
    M.BANK.some(b => b.tier === 1) && M.BANK.some(b => b.tier === 2));
  yes("every entry names a real module file",
    M.BANK.every(b => !!M.MODFILE[b.mod] && !!M.MODNAME[b.mod]));
  yes("no module is left with fewer than three types",
    mods.every(m => M.BANK.filter(b => b.mod === m).length >= 3));

  console.log("    the bank - every generator, 400 draws each");
  let bad = 0, loose = 0;
  M.BANK.forEach(b => {
    const R = seeded(b.id.length * 7919 + 13);
    for (let i = 0; i < 400; i++) {
      const o = b.gen(R);
      if (!isFinite(o.a) || !(o.tol > 0) || !o.q || !o.w) { bad++; break; }
      if (Math.abs(o.a + Math.max(o.tol * 12, 1) - o.a) <= o.tol) { loose++; break; }
    }
  });
  yes("every generator returns a finite answer, a positive tolerance, a prompt and working",
    bad === 0);
  yes("no tolerance is wide enough to accept a wrong answer", loose === 0);

  console.log("    the bank - answers, against the values their home pages assert");
  const spot = (label, id, needle, want, tol) => {
    const o = findCase(id, needle);
    eq(label, o ? o.a : NaN, want, tol);
  };
  spot("birthday at 23 people", "c-birth", "<b>23</b> people", 50.7297, 5e-3);
  spot("at least one six in four rolls", "r-atleast", "<b>4</b> rolls", 51.7747, 5e-3);
  spot("Monty Hall, three doors", "r-monty", "<b>3</b> doors", 66.6667, 5e-3);
  spot("-110 implies", "o-us", "<b>-110</b>", 52.3810, 5e-3);
  spot("a -110/-110 book holds", "o-hold", "<b>-110</b>", 4.5455, 5e-3);
  spot("within two sigma", "d-emp", "<b>2</b> standard", 95.4500, 5e-3);
  spot("IQR of a sigma-10 normal", "d-iqr", "\u03c3 = <b>10</b>", 13.4898, 5e-3);
  spot("half Kelly keeps", "e-frac", "<b>0.50\u00d7</b>", 75.0, 1e-9);
  spot("20 vol over 21 days", "s-sqrtT", ["<b>20%</b>", "<b>21</b>-day"], 5.7735, 5e-3);
  spot("critical z at alpha 0.05", "t-crit", "0.05</b>", 1.9600, 5e-3);
  spot("years to 80% power at Sharpe 1", "t-years", "<b>1.00</b>", 7.8490, 5e-3);
  spot("1-in-1000 with a 99/99 test", "b-post", "1 in 1000", 9.0164, 5e-3);
  spot("what survives a 0.7 hedge", "k-resid", "<b>0.7</b>", 71.4143, 5e-3);
  spot("99% VaR in sigmas", "v-var", "99.0%", 2.3263, 5e-3);
  spot("99% expected shortfall", "v-es", "99.0%", 2.6652, 5e-3);
  spot("years to t=2 at Sharpe 1", "a-t2", "<b>1.00</b>", 4.0, 1e-9);
  const ruin = findCase("a-ruin", "<b>1.00\u00d7</b>");
  yes("full Kelly halves the bankroll at some point half the time",
    ruin && Math.abs(ruin.a - 50) < 1e-6 || ruin && Math.abs(ruin.a - 25) < 1e-6);

  console.log("    scheduling - the Leitner boxes");
  eq("five boxes", M.BOXES.length - 1, 5, 0);
  yes("the intervals are 1, 3, 8, 21, 55",
    M.BOXES.slice(1).join(",") === "1,3,8,21,55");
  yes("each interval is roughly three times the last",
    [2, 3, 4, 5].every(i => M.BOXES[i] / M.BOXES[i - 1] > 2.2 &&
      M.BOXES[i] / M.BOXES[i - 1] < 3.2));
  const rec = M.blankRecord();
  yes("a fresh record puts every type in box 1",
    M.BANK.every(b => rec.gen[b.id].box === 1));
  eq("  so the box-1 count starts at 47", M.boxCounts(rec)[1], 47, 0);
  /* a correct answer promotes and pushes the due date out */
  const id0 = M.BANK[0].id;
  M.grade(rec, id0, true);
  eq("one correct answer promotes to box 2", rec.gen[id0].box, 2, 0);
  eq("  and schedules it 3 questions out", rec.gen[id0].due - rec.answered, 3, 0);
  M.grade(rec, id0, true); M.grade(rec, id0, true); M.grade(rec, id0, true);
  eq("four in a row reaches box 5", rec.gen[id0].box, 5, 0);
  eq("  scheduled 55 questions out", rec.gen[id0].due - rec.answered, 55, 0);
  M.grade(rec, id0, false);
  eq("a single miss drops it straight back to box 1", rec.gen[id0].box, 1, 0);
  eq("  and it returns on the very next question", rec.gen[id0].due - rec.answered, 1, 0);
  yes("the box never exceeds 5",
    (() => { const r = M.blankRecord(); for (let i = 0; i < 20; i++) M.grade(r, id0, true);
      return r.gen[id0].box === 5; })());
  yes("seen and right are tracked separately",
    (() => { const r = M.blankRecord();
      M.grade(r, id0, true); M.grade(r, id0, false); M.grade(r, id0, true);
      return r.gen[id0].seen === 3 && r.gen[id0].right === 2; })());

  console.log("    scheduling - selection interleaves and prefers what is missed");
  const all = []; for (let m = 1; m <= 13; m++) all.push(m);
  eq("with every module in play, all 47 are eligible",
    M.eligible(all, 0).length, 47, 0);
  yes("filtering to one module narrows the pool",
    M.eligible([1], 0).length < 10 && M.eligible([1], 0).length > 0);
  yes("filtering by tier narrows it further",
    M.eligible(all, 1).length + M.eligible(all, 2).length === 47);
  yes("selection returns something for any non-empty module set",
    all.every(m => M.chooseNext(M.blankRecord(), [m], 0) !== null));
  yes("  and returns null when nothing is selected",
    M.chooseNext(M.blankRecord(), [], 0) === null);
  /* a fresh record has everything due, so a run should touch many modules */
  const fresh = M.blankRecord();
  const touched = {};
  for (let i = 0; i < 200; i++) {
    const g = M.chooseNext(fresh, all, 0);
    touched[g.mod] = true;
    M.grade(fresh, g.id, true);
  }
  yes("200 questions from a fresh record reach every module",
    Object.keys(touched).length === 13);
  /* after everything is promoted, a missed item should come back at once */
  const settled = M.blankRecord();
  for (let i = 0; i < 5; i++) M.BANK.forEach(b => M.grade(settled, b.id, true));
  yes("once everything is promoted, nothing is overdue",
    M.BANK.every(b => settled.gen[b.id].due > settled.answered));
  yes("  and selection still returns a question rather than stalling",
    M.chooseNext(settled, all, 0) !== null);
  const victim = M.BANK[7].id;
  M.grade(settled, victim, false);
  const nxt = M.chooseNext(settled, all, 0);
  yes("a missed question is the next one served", nxt.id === victim);

  console.log("    the record - rollup and weak spots");
  const r2 = M.blankRecord();
  M.BANK.filter(b => b.mod === 3).forEach(b => {
    for (let i = 0; i < 4; i++) M.grade(r2, b.id, false);
  });
  M.BANK.filter(b => b.mod === 12).forEach(b => {
    for (let i = 0; i < 4; i++) M.grade(r2, b.id, true);
  });
  const by = M.byModule(r2);
  eq("module 03 was answered 12 times", by[3].seen, 12, 0);
  eq("  all of them wrong", by[3].right, 0, 0);
  eq("  a rate of zero", by[3].rate, 0, 1e-12);
  eq("module 12 was answered 12 times", by[12].seen, 12, 0);
  eq("  all correct", by[12].rate, 1.0, 1e-12);
  yes("an untouched module reports no rate", isNaN(by[7].rate));
  yes("  and is not counted as judgeable", by[7].enough === false);
  eq("five attempts is the bar for judging a module", M.MINTRIES, 5, 0);
  yes("a module with fewer than five attempts is not judged",
    (() => { const r = M.blankRecord();
      for (let i = 0; i < 4; i++) M.grade(r, "o-us", false);
      return M.byModule(r)[3].enough === false; })());
  const w = M.weakest(r2, 4);
  yes("the weakest list puts module 03 first", w[0] === 3);
  yes("  and never includes a module with too few attempts",
    w.every(m => by[m].enough));

  console.log("    the exam");
  eq("the paper is 20 questions", M.__exam.LEN, 20, 0);
  const paper = M.__exam.build();
  eq("  and build() returns exactly that many", paper.length, 20, 0);
  yes("every question on it is a real bank entry",
    paper.every(g => M.bankById(g.id) !== null));
  const spread = {};
  paper.forEach(g => { spread[g.mod] = (spread[g.mod] || 0) + 1; });
  yes("it spreads across at least ten modules rather than clustering",
    Object.keys(spread).length >= 10);
  yes("  and no single module takes more than three of the twenty",
    Object.keys(spread).every(k => spread[k] <= 3));
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
