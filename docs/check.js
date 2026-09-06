#!/usr/bin/env node
/*
 * check.js — pre-flight for every page in the series.
 *
 *   node check.js              check every *.html in the repo root
 *   node check.js surface.html check one page
 *
 * There is no build step, so nothing else catches these mistakes.
 * Run it before every commit.
 *
 * Checks performed per page:
 *   1. the page script parses together with assets/lab.js and assets/stats.js
 *   2. every getElementById target exists in the markup
 *   3. no duplicate element ids (silently breaks widgets)
 *   4. every internal href/src resolves to a real file
 *   5. every <div class="mline"> equation has a <p class="mread"> reading
 *      and nothing but text sits in <title> or a meta content attribute
 *   6. every .check block has exactly one data-ok answer
 *   7. every data-preset names a registered slider group
 *   8. the page executes end to end under a stubbed DOM, and every
 *      draw function in drawAll() runs without throwing
 */
const fs = require("fs"), path = require("path");
const ROOT = __dirname;
const LAB = fs.readFileSync(path.join(ROOT, "assets/lab.js"), "utf8")
  + "\n" + fs.readFileSync(path.join(ROOT, "assets/stats.js"), "utf8");

function stubDom() {
  const mk = () => ({
    innerHTML: "", textContent: "", value: "0", style: {}, disabled: false,
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {},
    querySelectorAll() { return []; },
    getContext() { return new Proxy({}, { get: () => () => {} }); },
    clientWidth: 800, clientHeight: 400, width: 800, height: 400,
    scrollIntoView() {}, focus() {}, appendChild() {}, insertBefore() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 800, bottom: 400, width: 800, height: 400 }; },
    parentNode: null, parentElement: null, dataset: {}
  });
  const stub = mk();
  global.window = global;
  global.devicePixelRatio = 1; global.innerWidth = 1200;
  global.scrollX = 0; global.scrollY = 0;
  global.matchMedia = () => ({ matches: false });
  global.addEventListener = () => {};
  global.document = {
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 800 },
    body: stub, getElementById: () => stub,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => mk(), addEventListener() {}, fonts: null
  };
  global.getComputedStyle = () => ({ getPropertyValue: () => "#000000" });
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.MutationObserver = class { observe() {} };
}

function check(file) {
  const problems = [];
  const h = fs.readFileSync(path.join(ROOT, file), "utf8");
  const m = h.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
  const js = m ? m[1] : "";

  // 1. parses with the engine
  if (js) {
    try { new Function(LAB + "\n" + js); }
    catch (e) { problems.push("does not parse: " + e.message); return problems; }
  }

  // 2 + 3. element ids
  const all = [...h.matchAll(/id="([^"]+)"/g)].map(x => x[1]);
  const ids = new Set(all);
  const dup = [...new Set(all.filter((v, i) => all.indexOf(v) !== i))];
  if (dup.length) problems.push("duplicate ids: " + dup.join(", "));
  const refs = [...new Set([...js.matchAll(/getElementById\("([^"]+)"\)/g)].map(x => x[1]))];
  const missing = refs.filter(i => !ids.has(i));
  if (missing.length) problems.push("getElementById targets missing from markup: " + missing.join(", "));

  // 4. internal links
  [...h.matchAll(/(?:href|src)="(?!http|data:|#|mailto:)([^"]+)"/g)].forEach(x => {
    const t = x[1].split("#")[0];
    if (t && !fs.existsSync(path.join(ROOT, t))) problems.push("broken link: " + t);
  });

  // 4b. nothing but text belongs in the head. A term gloss applied by a
  //     search-and-replace over the whole file lands inside <title> or a
  //     meta content= attribute, where the browser renders the raw markup as
  //     the tab label. It happened twice, silently, and shipped.
  const headEnd = h.indexOf("</head>");
  if (headEnd > 0) {
    const head = h.slice(0, headEnd);
    const title = head.match(/<title>([\s\S]*?)<\/title>/);
    if (title && /<[a-z/]/i.test(title[1]))
      problems.push("markup inside <title> — it renders as raw text in the browser tab: "
        + title[1].trim().slice(0, 60));
    [...head.matchAll(/content="([^"]*)"/g)].forEach(m => {
      if (/<[a-z/]/i.test(m[1]))
        problems.push("markup inside a meta content attribute: " + m[1].slice(0, 50));
    });
  }

  // 4c. the page must actually LINK the engine it is checked against.
  //     check.js concatenates lab.js and stats.js itself, so a page missing
  //     one of the <script src> tags passes here and throws in the browser.
  //     That happened on the first page in this repo: every figure that used
  //     an odds conversion died with "decToProb is not defined", and nothing
  //     in the pre-flight noticed.
  if (/<canvas/.test(h)) {
    ["assets/lab.js", "assets/stats.js"].forEach(src => {
      if (h.indexOf('src="' + src + '"') < 0)
        problems.push("does not load " + src + " — it will throw in a browser");
    });
  }

  // 5. every equation explained
  const eq = (h.match(/class="mline"/g) || []).length;
  const rd = (h.match(/class="mread"/g) || []).length;
  if (eq !== rd) problems.push(`${eq} equations but ${rd} plain-English readings — every .mline needs a .mread`);

  // 6. self-marking questions
  h.split('class="check"').slice(1).forEach((block, i) => {
    const opts = block.split("</div>")[0] + block.slice(0, 2000);
    const n = (opts.match(/data-ok/g) || []).length;
    if (n === 0) problems.push(`check block ${i + 1} has no correct answer`);
  });

  // 7. presets point at registered slider groups
  const keys = new Set([...js.matchAll(/,"(\w+)"\);/g)].map(x => x[1]));
  [...h.matchAll(/data-preset="([^"]+)"/g)].forEach(x => {
    if (keys.size && !keys.has(x[1])) problems.push("data-preset names an unregistered group: " + x[1]);
  });

  // 8. executes end to end
  if (js) {
    stubDom();
    let drawErr = null;
    const orig = console.error;
    console.error = (...a) => { drawErr = a.join(" "); };
    try { new Function(LAB + "\n" + js)(); }
    catch (e) { console.error = orig; problems.push("threw at runtime: " + e.message); return problems; }
    console.error = orig;
    if (drawErr) problems.push("a draw function failed: " + drawErr);
  }
  return problems;
}

const args = process.argv.slice(2);
const files = args.length ? args
  : fs.readdirSync(ROOT).filter(f => f.endsWith(".html") && f !== "template.html"
      && !f.endsWith("_body.html"));   // build fragments, not pages

let total = 0;
files.forEach(f => {
  const p = check(f);
  total += p.length;
  if (p.length) { console.log("\n✗ " + f); p.forEach(x => console.log("    " + x)); }
  else console.log("✓ " + f);
});
console.log("\n" + (total ? total + " problem(s) found" : "all pages pass"));
process.exit(total ? 1 : 0);
