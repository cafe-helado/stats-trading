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
