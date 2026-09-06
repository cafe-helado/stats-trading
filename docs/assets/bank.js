/* ═══════════════════════════════════════════════════════════════════════
   bank.js — every question the series can ask, in one place.

   The per-module drills each generate their own questions and stay
   self-contained; this is the bank the practice page draws from so it can
   INTERLEAVE — hand you a question without telling you which module it came
   from, which is the thing a per-page drill structurally cannot do.

   Each entry is:
     { id, mod, topic, tier, gen(R) -> { q, a, unit, tol, w } }

   `R` is a function returning [0,1). Live it is Math.random; under verify.js
   it is a seeded generator, so every question is reproducible and the whole
   bank can be exercised deterministically.

   `a` is the numeric answer, `tol` the accepted band, `q` the prompt and `w`
   the working shown afterwards. Tier 1 applies one idea; tier 2 needs two
   steps or a decision about which idea applies.

   This file assumes lab.js and stats.js are already loaded — it uses ncdf,
   qnorm, choose, dbinom and pbinom from them.
   ═══════════════════════════════════════════════════════════════════════ */
"use strict";

const pick = (R, a) => a[Math.floor(R() * a.length)];
const lfact_ = n => lgamma(n + 1);
const perm_ = (n, r) => Math.round(Math.exp(lfact_(n) - lfact_(n - r)));
const rel = (a, p, floor) => Math.max(floor === undefined ? 0.01 : floor, Math.abs(a) * p);

/* the handful of constants the bank quotes, kept in one place so a typo
   here cannot disagree with the page that taught them */
const K = {
  root2pi: Math.sqrt(2 / Math.PI),      /* 0.797885 */
  rootpi2: Math.sqrt(Math.PI / 2),      /* 1.253314 */
  z75: 0.6744897501960817,
  iqrSigma: 2 * 0.6744897501960817,     /* 1.348980 */
  power80: Math.pow(1.959963985 + 0.841621234, 2)   /* 7.849 */
};

const BANK = [

  /* ── 01 · Counting ─────────────────────────────────────────────────── */
  { id: "c-perm", mod: 1, topic: "Permutations", tier: 1, unit: "",
    gen: R => { const n = pick(R, [5, 6, 8, 10, 12]), r = pick(R, [2, 3, 4]);
      const a = perm_(n, r);
      return { a: a, tol: 0.5,
        q: "How many <b>ordered</b> ways to pick <b>" + r + "</b> things from <b>" + n + "</b>?",
        w: "P(" + n + "," + r + ") = " + n + "×" + (n - 1) + (r > 2 ? "×" + (n - 2) : "") +
          (r > 3 ? "×" + (n - 3) : "") + " = <b>" + a.toLocaleString() + "</b>." }; } },

  { id: "c-comb", mod: 1, topic: "Combinations", tier: 1, unit: "",
    gen: R => { const n = pick(R, [5, 6, 8, 10, 12, 13]), r = pick(R, [2, 3, 4, 5]);
      const rr = Math.min(r, n), a = choose(n, rr);
      return { a: a, tol: 0.5,
        q: "How many <b>unordered</b> ways to pick <b>" + rr + "</b> from <b>" + n + "</b>?",
        w: "P(" + n + "," + rr + ") ÷ " + rr + "! = " + perm_(n, rr).toLocaleString() + " ÷ " +
          Math.round(Math.exp(lfact_(rr))) + " = <b>" + a.toLocaleString() + "</b>." }; } },

  { id: "c-rep", mod: 1, topic: "With repetition", tier: 1, unit: "",
    gen: R => { const n = pick(R, [3, 4, 5]), d = pick(R, [6, 10, 26]);
      const a = Math.pow(d, n);
      return { a: a, tol: 0.5,
        q: "A code of <b>" + n + "</b> symbols from an alphabet of <b>" + d +
          "</b>, repeats allowed. How many codes?",
        w: d + "<sup>" + n + "</sup> = <b>" + a.toLocaleString() +
          "</b>; forbidding repeats would give " + perm_(d, n).toLocaleString() + "." }; } },

  { id: "c-birth", mod: 1, topic: "Birthday problem", tier: 2, unit: "%",
    gen: R => { const n = pick(R, [10, 15, 20, 23, 30, 40]);
      let p = 1; for (let i = 0; i < n; i++) p *= (365 - i) / 365;
      const a = (1 - p) * 100;
      return { a: a, tol: rel(a, 0.01, 0.05),
        q: "<b>" + n + "</b> people in a room. Chance at least two share a birthday?",
        w: "1 − (365/365)(364/365)… = <b>" + a.toFixed(3) + "%</b>, with " +
          (n * (n - 1) / 2) + " pairs in play. It crosses one half at 23." }; } },

  { id: "c-pascal", mod: 1, topic: "Pascal rows", tier: 2, unit: "",
    gen: R => { const n = pick(R, [6, 8, 10, 12]); const a = Math.pow(2, n);
      return { a: a, tol: 0.5,
        q: "What do the binomial coefficients C(<b>" + n + "</b>, k) sum to over every k?",
        w: "2<sup>" + n + "</sup> = <b>" + a.toLocaleString() +
          "</b> — every subset counted once, which is why binomial probabilities add to one." }; } },

  /* ── 02 · The rules ────────────────────────────────────────────────── */
  { id: "r-atleast", mod: 2, topic: "At least one", tier: 1, unit: "%",
    gen: R => { const n = pick(R, [2, 3, 4, 5, 6]);
      const a = (1 - Math.pow(5 / 6, n)) * 100;
      return { a: a, tol: rel(a, 0.01, 0.05),
        q: "<b>" + n + "</b> rolls of a die. Chance of at least one six?",
        w: "1 − (5/6)<sup>" + n + "</sup> = <b>" + a.toFixed(3) +
          "%</b>. Counting the misses turns a union into a product." }; } },

  { id: "r-or", mod: 2, topic: "P(A or B)", tier: 1, unit: "%",
    gen: R => { const pa = pick(R, [0.3, 0.4, 0.5, 0.6]), pb = pick(R, [0.2, 0.3, 0.4]);
      const pab = Math.min(pick(R, [0, 0.1, 0.15]), pa, pb);
      const a = (pa + pb - pab) * 100;
      return { a: a, tol: 0.05,
        q: "P(A) = <b>" + (pa * 100).toFixed(0) + "%</b>, P(B) = <b>" + (pb * 100).toFixed(0) +
          "%</b>, P(A and B) = <b>" + (pab * 100).toFixed(0) + "%</b>. Find P(A or B).",
        w: (pa * 100).toFixed(0) + " + " + (pb * 100).toFixed(0) + " − " + (pab * 100).toFixed(0) +
          " = <b>" + a.toFixed(1) + "%</b> — subtract what was counted twice." }; } },

  { id: "r-norepl", mod: 2, topic: "Without replacement", tier: 2, unit: "%",
    gen: R => { const good = pick(R, [4, 13, 26]), k = pick(R, [2, 3]);
      let p = 1; for (let i = 0; i < k; i++) p *= (good - i) / (52 - i);
      const a = p * 100;
      return { a: a, tol: rel(a, 0.01, 0.005),
        q: "A deck holds <b>" + good + "</b> favorable cards. Drawing <b>" + k +
          "</b> without replacement, chance all are favorable?",
        w: "(" + good + "/52)" + (k > 1 ? "×(" + (good - 1) + "/51)" : "") +
          (k > 2 ? "×(" + (good - 2) + "/50)" : "") + " = <b>" + a.toFixed(4) +
          "%</b>, against " + (Math.pow(good / 52, k) * 100).toFixed(4) + "% with replacement." }; } },

  { id: "r-monty", mod: 2, topic: "Monty Hall", tier: 2, unit: "%",
    gen: R => { const d = pick(R, [3, 4, 5, 10]); const a = (d - 1) / d * 100;
      return { a: a, tol: 0.05,
        q: "<b>" + d + "</b> doors, one prize. You pick one, the host opens all but one of the " +
          "rest showing losers. Chance of winning by switching?",
        w: "You win by switching exactly when the first pick was wrong: " + (d - 1) + "/" + d +
          " = <b>" + a.toFixed(2) + "%</b>, against " + (100 / d).toFixed(2) + "% for staying." }; } },

  { id: "r-half", mod: 2, topic: "Attempts to pass a half", tier: 2, unit: "tries",
    gen: R => { const p = pick(R, [0.01, 0.02, 0.05, 0.1]);
      const a = Math.ceil(Math.log(0.5) / Math.log(1 - p));
      return { a: a, tol: 0.5,
        q: "An event has probability <b>" + (p * 100).toFixed(0) +
          "%</b> per attempt. How many attempts before at least one is more likely than not?",
        w: "ln(0.5)/ln(1−" + p + "), rounded up = <b>" + a + "</b> attempts." }; } },

  /* ── 03 · Odds ─────────────────────────────────────────────────────── */
  { id: "o-us", mod: 3, topic: "American odds", tier: 1, unit: "%",
    gen: R => { const u = pick(R, [-110, -150, -200, -300, 110, 150, 200, 400]);
      const a = (u < 0 ? -u / (-u + 100) : 100 / (u + 100)) * 100;
      return { a: a, tol: 0.05,
        q: "What probability does <b>" + (u > 0 ? "+" : "") + u + "</b> imply?",
        w: (u < 0 ? "−u/(−u+100) = " + (-u) + "/" + (-u + 100) : "100/(u+100) = 100/" + (u + 100)) +
          " = <b>" + a.toFixed(3) + "%</b>." }; } },

  { id: "o-dec", mod: 3, topic: "Decimal odds", tier: 1, unit: "%",
    gen: R => { const d = pick(R, [1.5, 1.91, 2.0, 2.5, 3.4, 5.0]);
      const a = 100 / d;
      return { a: a, tol: 0.05,
        q: "Decimal odds of <b>" + d.toFixed(2) + "</b>. What probability is implied?",
        w: "1/" + d.toFixed(2) + " = <b>" + a.toFixed(3) +
          "%</b>. Decimal odds include the stake, which is the usual trip-up." }; } },

  { id: "o-hold", mod: 3, topic: "Overround and hold", tier: 2, unit: "%",
    gen: R => { const u = pick(R, [-105, -110, -115, -120, -130]);
      const p = -u / (-u + 100), sum = 2 * p;
      const a = (sum - 1) / sum * 100;
      return { a: a, tol: 0.05,
        q: "Both sides of a market are priced at <b>" + u +
          "</b>. What fraction of everything staked does a balanced book keep?",
        w: "Each side implies " + (p * 100).toFixed(3) + "%, summing to " +
          (sum * 100).toFixed(3) + "%. Hold = overround ÷ (1 + overround) = <b>" +
          a.toFixed(3) + "%</b> — smaller than the overround." }; } },

  /* ── 04 · Describing ───────────────────────────────────────────────── */
  { id: "d-median", mod: 4, topic: "Mean and median", tier: 1, unit: "",
    gen: R => { const n = pick(R, [5, 7, 9]), v = [];
      for (let i = 0; i < n; i++) v.push(Math.round(10 + R() * 80));
      v.sort((x, y) => x - y);
      const wantMean = R() < 0.5;
      const a = wantMean ? v.reduce((x, y) => x + y, 0) / n : v[(n - 1) / 2];
      return { a: a, tol: 0.02,
        q: "Find the <b>" + (wantMean ? "mean" : "median") + "</b> of <b>" + v.join(", ") + "</b>.",
        w: wantMean ? "Sum " + v.reduce((x, y) => x + y, 0) + " ÷ " + n + " = <b>" +
          a.toFixed(3) + "</b>." : "Sorted already, " + n + " values, middle one is <b>" +
          a.toFixed(1) + "</b>." }; } },

  { id: "d-z", mod: 4, topic: "z-scores", tier: 1, unit: "σ",
    gen: R => { const mu = pick(R, [50, 100, 500]), sig = pick(R, [5, 10, 20, 100]);
      const x = mu + pick(R, [-2, -1, 1, 1.5, 2]) * sig;
      const a = (x - mu) / sig;
      return { a: a, tol: 0.02,
        q: "A value of <b>" + x + "</b> where the mean is <b>" + mu + "</b> and σ is <b>" +
          sig + "</b>. What is its z-score?",
        w: "(" + x + " − " + mu + ") ÷ " + sig + " = <b>" + a.toFixed(2) + "σ</b>." }; } },

  { id: "d-pct", mod: 4, topic: "z to percentile", tier: 2, unit: "%",
    gen: R => { const z = pick(R, [-2, -1, -0.5, 0.5, 1, 1.5, 2, 2.5]);
      const a = ncdf(z) * 100;
      return { a: a, tol: 0.1,
        q: "Under a normal, what percentile is <b>z = " + z + "</b>?",
        w: "Φ(" + z + ") = <b>" + a.toFixed(2) +
          "%</b>. Note z = 2 is the 97.72nd, not the 95th — that 95 is the mass within ±2σ." }; } },

  { id: "d-iqr", mod: 4, topic: "IQR from sigma", tier: 2, unit: "",
    gen: R => { const sig = pick(R, [1, 2, 5, 10, 20]);
      const a = sig * K.iqrSigma;
      return { a: a, tol: 0.02,
        q: "A normal distribution has σ = <b>" + sig + "</b>. What is its interquartile range?",
        w: sig + " × 1.349 = <b>" + a.toFixed(3) +
          "</b>. The constant holds for a normal and nothing else." }; } },

  { id: "d-emp", mod: 4, topic: "The empirical rule", tier: 1, unit: "%",
    gen: R => { const k = pick(R, [1, 2, 3]);
      const a = (2 * ncdf(k) - 1) * 100;
      return { a: a, tol: 0.06,
        q: "What fraction of a normal lies within <b>" + k + "</b> standard deviation" +
          (k > 1 ? "s" : "") + " of the mean?",
        w: "<b>" + a.toFixed(2) + "%</b> — the rounded 68-95-99.7 is really 68.27, 95.45, 99.73." }; } },

  /* ── 05 · Expectation ──────────────────────────────────────────────── */
  { id: "e-ev", mod: 5, topic: "Expected value", tier: 1, unit: "",
    gen: R => { const p = pick(R, [0.3, 0.4, 0.5, 0.6]), win = pick(R, [1, 2, 3, 5]);
      const a = p * win - (1 - p);
      return { a: a, tol: 0.005,
        q: "A bet wins <b>" + win + "</b> with probability <b>" + (p * 100).toFixed(0) +
          "%</b> and loses <b>1</b> otherwise. What is the expected value?",
        w: p.toFixed(2) + "×" + win + " − " + (1 - p).toFixed(2) + " = <b>" + a.toFixed(3) +
          "</b> per unit staked." }; } },

  { id: "e-kelly", mod: 5, topic: "Kelly stake", tier: 2, unit: "%",
    gen: R => { const p = pick(R, [0.55, 0.58, 0.60, 0.65, 0.70]);
      const a = (2 * p - 1) * 100;
      return { a: a, tol: 0.05,
        q: "An even-money bet you win <b>" + (p * 100).toFixed(0) +
          "%</b> of the time. What is the Kelly stake?",
        w: "With b = 1 it collapses to the edge itself, 2p − 1 = <b>" + a.toFixed(1) +
          "%</b> of bankroll." }; } },

  { id: "e-frac", mod: 5, topic: "Fractional Kelly", tier: 2, unit: "%",
    gen: R => { const k = pick(R, [0.25, 0.5, 0.75, 1.0]);
      const a = (2 * k - k * k) * 100;
      return { a: a, tol: 0.05,
        q: "You bet <b>" + k.toFixed(2) + "×</b> full Kelly. What share of the maximum growth " +
          "do you keep?",
        w: "2k − k² = <b>" + a.toFixed(1) + "%</b>, while the chance of ever halving falls to " +
          (Math.pow(0.5, 2 / k - 1) * 100).toFixed(2) + "%." }; } },

  /* ── 06 · Shape ────────────────────────────────────────────────────── */
  { id: "s-sum", mod: 6, topic: "Adding variances", tier: 1, unit: "",
    gen: R => { const s = pick(R, [1, 2, 5, 10]), n = pick(R, [4, 9, 16, 25]);
      const a = s * Math.sqrt(n);
      return { a: a, tol: 0.02,
        q: "You add <b>" + n + "</b> independent draws each with σ = <b>" + s +
          "</b>. What is the standard deviation of the sum?",
        w: "Variances add, so σ√n = " + s + "×√" + n + " = <b>" + a.toFixed(3) +
          "</b>. The sum grows like √n, not n." }; } },

  { id: "s-mean", mod: 6, topic: "Spread of an average", tier: 2, unit: "",
    gen: R => { const s = pick(R, [1, 2, 5, 10]), n = pick(R, [4, 9, 16, 25, 100]);
      const a = s / Math.sqrt(n);
      return { a: a, tol: 0.005,
        q: "You <b>average</b> " + n + " independent draws each with σ = <b>" + s +
          "</b>. What is the standard deviation of that average?",
        w: "σ/√n = " + s + "/√" + n + " = <b>" + a.toFixed(4) +
          "</b>. Summing multiplies by √n; averaging divides by it." }; } },

  { id: "s-sqrtT", mod: 6, topic: "Volatility and √T", tier: 1, unit: "%",
    gen: R => { const v = pick(R, [0.16, 0.20, 0.30, 0.40]), d = pick(R, [1, 5, 21, 63]);
      const a = v * Math.sqrt(d / 252) * 100;
      return { a: a, tol: rel(a, 0.01, 0.005),
        q: "An annual volatility of <b>" + (v * 100).toFixed(0) + "%</b>. What is the <b>" +
          d + "</b>-day move, in percent?",
        w: (v * 100).toFixed(0) + "% × √(" + d + "/252) = <b>" + a.toFixed(3) + "%</b>." }; } },

  /* ── 07 · Distributions ────────────────────────────────────────────── */
  { id: "x-binom", mod: 7, topic: "Binomial", tier: 1, unit: "%",
    gen: R => { const n = pick(R, [5, 8, 10]), p = pick(R, [0.3, 0.5]);
      const k = Math.max(1, Math.round(n * p));
      const a = dbinom(k, n, p) * 100;
      return { a: a, tol: rel(a, 0.01, 0.02),
        q: "<b>" + n + "</b> trials at <b>" + (p * 100).toFixed(0) +
          "%</b> each. Chance of exactly <b>" + k + "</b> successes?",
        w: "C(" + n + "," + k + ")p^k(1−p)^(n−k) = " + choose(n, k) + " × … = <b>" +
          a.toFixed(3) + "%</b>." }; } },

  { id: "x-pois", mod: 7, topic: "Poisson", tier: 2, unit: "%",
    gen: R => { const l = pick(R, [0.5, 1, 2, 3]), k = pick(R, [0, 1, 2]);
      const a = Math.exp(-l + k * Math.log(l) - lgamma(k + 1)) * 100;
      return { a: a, tol: rel(a, 0.01, 0.02),
        q: "Events arrive at an average rate of <b>" + l +
          "</b> per period. Chance of exactly <b>" + k + "</b> in one period?",
        w: "e^(−λ)λ^k/k! with λ = " + l + " gives <b>" + a.toFixed(3) + "%</b>." }; } },

  { id: "x-pnone", mod: 7, topic: "Poisson, none at all", tier: 2, unit: "%",
    gen: R => { const l = pick(R, [0.25, 0.5, 1, 2, 4]);
      const a = Math.exp(-l) * 100;
      return { a: a, tol: rel(a, 0.01, 0.02),
        q: "An average of <b>" + l + "</b> events per period. Chance of <b>none</b>?",
        w: "e^(−" + l + ") = <b>" + a.toFixed(3) +
          "%</b> — the cleanest case, since the k! and λ^k both vanish." }; } },

  /* ── 08 · Samples ──────────────────────────────────────────────────── */
  { id: "p-se", mod: 8, topic: "Standard error", tier: 1, unit: "",
    gen: R => { const s = pick(R, [1, 2, 5, 10, 20]), n = pick(R, [25, 100, 400, 900]);
      const a = s / Math.sqrt(n);
      return { a: a, tol: 0.005,
        q: "A sample of <b>" + n + "</b> from a population with σ = <b>" + s +
          "</b>. What is the standard error of the mean?",
        w: "σ/√n = " + s + "/" + Math.sqrt(n) + " = <b>" + a.toFixed(4) +
          "</b>. Four times the data halves it." }; } },

  { id: "p-sevol", mod: 8, topic: "Error on a volatility", tier: 2, unit: "pts",
    gen: R => { const v = pick(R, [0.15, 0.20, 0.30]), n = pick(R, [20, 60, 252]);
      const a = v / Math.sqrt(2 * n) * 100;
      return { a: a, tol: rel(a, 0.01, 0.005),
        q: "A <b>" + (v * 100).toFixed(0) + "</b> volatility estimated from <b>" + n +
          "</b> days. What is its standard error, in volatility points?",
        w: "σ/√(2n) = " + (v * 100).toFixed(0) + "/√" + (2 * n) + " = <b>" + a.toFixed(3) +
          " points</b>. Volatility is far easier to measure than drift." }; } },

  { id: "p-n", mod: 8, topic: "Data needed", tier: 2, unit: "",
    gen: R => { const factor = pick(R, [2, 3, 4, 5]);
      const a = factor * factor;
      return { a: a, tol: 0.5,
        q: "To cut a standard error by a factor of <b>" + factor +
          "</b>, how many times more data do you need?",
        w: "Error falls as 1/√n, so shrinking it " + factor + "-fold needs " + factor +
          "² = <b>" + a + "×</b> the data." }; } },

  /* ── 09 · Testing ──────────────────────────────────────────────────── */
  { id: "t-zp", mod: 9, topic: "z to a p-value", tier: 1, unit: "",
    gen: R => { const z = pick(R, [1.0, 1.5, 1.96, 2.0, 2.5, 3.0]);
      const a = 2 * (1 - ncdf(z));
      return { a: a, tol: rel(a, 0.02, 0.0005),
        q: "A statistic of <b>z = " + z.toFixed(2) + "</b>. What is the two-sided p-value?",
        w: "2(1 − Φ(" + z.toFixed(2) + ")) = <b>" + a.toFixed(5) +
          "</b>. At z = 1.96 this is 0.05, which is where the convention comes from." }; } },

  { id: "t-crit", mod: 9, topic: "Critical z", tier: 1, unit: "",
    gen: R => { const al = pick(R, [0.10, 0.05, 0.02, 0.01]);
      const a = -qnorm(al / 2);
      return { a: a, tol: 0.005,
        q: "Testing two-sided at <b>α = " + al.toFixed(2) + "</b>. What critical z must be beaten?",
        w: "The " + (al / 2 * 100).toFixed(1) + "% point of a normal: <b>" + a.toFixed(4) +
          "</b>. Memorize 1.960 at 5% and 2.576 at 1%." }; } },

  { id: "t-family", mod: 9, topic: "Family-wise error", tier: 2, unit: "%",
    gen: R => { const m = pick(R, [5, 10, 20, 50, 100]), al = pick(R, [0.05, 0.01]);
      const a = (1 - Math.pow(1 - al, m)) * 100;
      return { a: a, tol: rel(a, 0.02, 0.05),
        q: "<b>" + m + "</b> independent tests at <b>α = " + al +
          "</b> with nothing real in any of them. Chance at least one looks significant?",
        w: "1 − (1−" + al + ")<sup>" + m + "</sup> = <b>" + a.toFixed(2) + "%</b>, with " +
          (m * al).toFixed(2) + " false positives expected." }; } },

  { id: "t-bonf", mod: 9, topic: "Bonferroni", tier: 2, unit: "",
    gen: R => { const m = pick(R, [4, 5, 10, 20, 25, 50]), al = pick(R, [0.05, 0.10]);
      const a = al / m;
      return { a: a, tol: rel(a, 0.02, 1e-5),
        q: "Correcting <b>α = " + al + "</b> for <b>" + m + "</b> tests. What is the new threshold?",
        w: al + "/" + m + " = <b>" + a.toFixed(5) + "</b>, moving the critical z to " +
          (-qnorm(a / 2)).toFixed(3) + "." }; } },

  { id: "t-years", mod: 9, topic: "Years to 80% power", tier: 2, unit: "years",
    gen: R => { const sr = pick(R, [0.5, 0.75, 1.0, 1.5, 2.0]);
      const a = K.power80 / (sr * sr);
      return { a: a, tol: rel(a, 0.02, 0.02),
        q: "A strategy with an annual Sharpe of <b>" + sr.toFixed(2) +
          "</b>. How long before a test has an 80% chance of detecting it?",
        w: "(1.960 + 0.842)²/SR² = 7.849/" + (sr * sr).toFixed(4) + " = <b>" + a.toFixed(2) +
          " years</b> — about double the " + (4 / (sr * sr)).toFixed(2) + " to cross t = 2 once." }; } },

  /* ── 10 · Bayes ────────────────────────────────────────────────────── */
  { id: "b-post", mod: 10, topic: "Posterior", tier: 2, unit: "%",
    gen: R => { const inv = pick(R, [100, 200, 500, 1000]);
      const pr = 1 / inv, sens = 0.99, spec = 0.99;
      const a = pr * sens / (pr * sens + (1 - pr) * (1 - spec)) * 100;
      return { a: a, tol: rel(a, 0.02, 0.05),
        q: "A condition affects <b>1 in " + inv + "</b>. A test is <b>99%</b> sensitive and " +
          "<b>99%</b> specific and comes back positive. Chance it is real?",
        w: "Of 100,000 people: " + Math.round(100000 * pr * sens) + " true positives against " +
          Math.round(100000 * (1 - pr) * 0.01) + " false ones, giving <b>" + a.toFixed(2) + "%</b>." }; } },

  { id: "b-lr", mod: 10, topic: "Likelihood ratio", tier: 1, unit: "",
    gen: R => { const sens = pick(R, [0.90, 0.95, 0.99]), spec = pick(R, [0.90, 0.95, 0.99]);
      const a = sens / (1 - spec);
      return { a: a, tol: rel(a, 0.02, 0.05),
        q: "A test is <b>" + (sens * 100).toFixed(0) + "%</b> sensitive and <b>" +
          (spec * 100).toFixed(0) + "%</b> specific. What is the likelihood ratio of a positive?",
        w: "sensitivity ÷ (1 − specificity) = " + sens.toFixed(2) + "/" + (1 - spec).toFixed(2) +
          " = <b>" + a.toFixed(1) + "</b>. Multiply prior ODDS by that." }; } },

  { id: "b-odds", mod: 10, topic: "The odds form", tier: 2, unit: "%",
    gen: R => { const p = pick(R, [0.01, 0.02, 0.05, 0.10]), lr = pick(R, [5, 10, 20, 99]);
      const o = p / (1 - p) * lr;
      const a = o / (1 + o) * 100;
      return { a: a, tol: rel(a, 0.02, 0.05),
        q: "Prior <b>" + (p * 100).toFixed(0) + "%</b>, likelihood ratio <b>" + lr +
          "</b>. What is the posterior?",
        w: "Prior odds " + (p / (1 - p)).toFixed(4) + " × " + lr + " = " + o.toFixed(4) +
          ", converting back to <b>" + a.toFixed(2) + "%</b>." }; } },

  /* ── 11 · Correlation ──────────────────────────────────────────────── */
  { id: "k-port", mod: 11, topic: "Portfolio volatility", tier: 2, unit: "%",
    gen: R => { const rho = pick(R, [0, 0.3, 0.6, 0.9, 1.0]), s = pick(R, [0.20, 0.30]);
      const a = Math.sqrt(0.25 * s * s + 0.25 * s * s + 2 * 0.25 * rho * s * s) * 100;
      return { a: a, tol: rel(a, 0.01, 0.02),
        q: "Two assets each at <b>" + (s * 100).toFixed(0) + "%</b> volatility, correlation <b>" +
          rho.toFixed(1) + "</b>, held fifty-fifty. What is the portfolio volatility?",
        w: "√(¼σ² + ¼σ² + 2·¼·ρσ²) = <b>" + a.toFixed(3) + "%</b>, against " +
          (s * 100).toFixed(0) + "% for either alone." }; } },

  { id: "k-beta", mod: 11, topic: "Beta from correlation", tier: 1, unit: "",
    gen: R => { const rho = pick(R, [0.3, 0.5, 0.7]), sy = pick(R, [0.2, 0.4]), sx = pick(R, [0.1, 0.2]);
      const a = rho * sy / sx;
      return { a: a, tol: rel(a, 0.01, 0.005),
        q: "Correlation <b>" + rho.toFixed(1) + "</b>, with σ(Y) = <b>" + (sy * 100).toFixed(0) +
          "%</b> and σ(X) = <b>" + (sx * 100).toFixed(0) + "%</b>. What is the beta of Y on X?",
        w: "ρ·σY/σX = " + rho.toFixed(1) + "×" + (sy / sx).toFixed(2) + " = <b>" + a.toFixed(3) +
          "</b>. The reverse regression has a different slope." }; } },

  { id: "k-resid", mod: 11, topic: "What a correlation leaves", tier: 2, unit: "%",
    gen: R => { const rho = pick(R, [0.3, 0.5, 0.7, 0.9]);
      const a = Math.sqrt(1 - rho * rho) * 100;
      return { a: a, tol: 0.05,
        q: "A correlation of <b>" + rho.toFixed(1) +
          "</b>. What percentage of the original volatility survives a perfect hedge?",
        w: "√(1 − ρ²) = <b>" + a.toFixed(2) + "%</b>. A 0.7 correlation still leaves " +
          "71% of the volatility and half the variance." }; } },

  /* ── 12 · Tails ────────────────────────────────────────────────────── */
  { id: "v-var", mod: 12, topic: "VaR in sigmas", tier: 1, unit: "σ",
    gen: R => { const p = pick(R, [0.05, 0.025, 0.01, 0.005]);
      const a = -qnorm(p);
      return { a: a, tol: 0.02,
        q: "Under a normal, where does the <b>" + ((1 - p) * 100).toFixed(1) + "%</b> VaR sit?",
        w: "The " + (p * 100).toFixed(1) + "% quantile: <b>" + a.toFixed(3) +
          "σ</b>. Memorize 1.645 at 95% and 2.326 at 99%." }; } },

  { id: "v-es", mod: 12, topic: "Expected shortfall", tier: 2, unit: "σ",
    gen: R => { const p = pick(R, [0.05, 0.025, 0.01, 0.005]);
      const a = npdf(qnorm(p)) / p;
      return { a: a, tol: 0.02,
        q: "Under a normal, what is the <b>" + ((1 - p) * 100).toFixed(1) +
          "%</b> expected shortfall?",
        w: "φ(z)/p = <b>" + a.toFixed(3) + "σ</b>, always further out than the VaR of " +
          (-qnorm(p)).toFixed(3) + "σ." }; } },

  { id: "v-dollar", mod: 12, topic: "VaR in dollars", tier: 2, unit: "$",
    gen: R => { const N = pick(R, [5, 10, 20, 50]), v = pick(R, [0.8, 1.0, 1.26, 1.5]);
      const p = pick(R, [0.05, 0.01]);
      const a = N * 1e6 * v / 100 * -qnorm(p);
      return { a: a, tol: rel(a, 0.01, 500),
        q: "A <b>$" + N + "m</b> book at <b>" + v.toFixed(2) + "%</b> daily volatility. What is " +
          "the <b>" + ((1 - p) * 100).toFixed(0) + "%</b> one-day VaR?",
        w: "$" + N + "m × " + v.toFixed(2) + "% × " + (-qnorm(p)).toFixed(3) + " = <b>$" +
          Math.round(a).toLocaleString() + "</b>." }; } },

  /* ── 13 · Application ──────────────────────────────────────────────── */
  { id: "a-breakeven", mod: 13, topic: "Break-even win rate", tier: 1, unit: "%",
    gen: R => { const u = pick(R, [-110, -120, -150, -200, 110, 150, 200]);
      const a = (u < 0 ? -u / (-u + 100) : 100 / (u + 100)) * 100;
      return { a: a, tol: 0.05,
        q: "Betting at <b>" + (u > 0 ? "+" : "") + u +
          "</b>. What win rate do you need just to break even?",
        w: "It is the implied probability itself: <b>" + a.toFixed(3) +
          "%</b>. At −110 you must be right 2.38 points more often than a coin." }; } },

  { id: "a-t2", mod: 13, topic: "Years to prove an edge", tier: 2, unit: "years",
    gen: R => { const sr = pick(R, [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]);
      const a = 4 / (sr * sr);
      return { a: a, tol: 0.02,
        q: "An annual Sharpe of <b>" + sr.toFixed(2) +
          "</b>. How many years before the record is two standard errors from zero?",
        w: "4 ÷ Sharpe² = <b>" + a.toFixed(2) +
          " years</b>. Trade frequency does not enter it at all." }; } },

  { id: "a-ruin", mod: 13, topic: "Risk of ruin", tier: 2, unit: "%",
    gen: R => { const k = pick(R, [0.25, 0.5, 0.75, 1.0]), lvl = pick(R, [0.5, 0.25]);
      const a = Math.pow(lvl, 2 / k - 1) * 100;
      return { a: a, tol: rel(a, 0.02, 0.02),
        q: "Betting <b>" + k.toFixed(2) + "×</b> full Kelly. What is the chance of <em>ever</em> " +
          "falling to <b>" + (lvl * 100).toFixed(0) + "%</b> of the starting bankroll?",
        w: "a^(2/k − 1) = " + lvl + "^" + (2 / k - 1).toFixed(2) + " = <b>" + a.toFixed(2) +
          "%</b>. At full Kelly the chance of ever halving is exactly one half." }; } }
];

/* module names, for the mastery grid */
const MODNAME = {
  1: "Counting", 2: "Rules", 3: "Odds", 4: "Describing", 5: "Expectation",
  6: "Shape", 7: "Distributions", 8: "Samples", 9: "Testing", 10: "Bayes",
  11: "Correlation", 12: "Tails", 13: "Application"
};
const MODFILE = {
  1: "count.html", 2: "rules.html", 3: "odds.html", 4: "describe.html",
  5: "ev.html", 6: "shape.html", 7: "dist.html", 8: "sample.html",
  9: "test.html", 10: "bayes.html", 11: "corr.html", 12: "tails.html",
  13: "bet.html"
};
const bankById = id => { for (let i = 0; i < BANK.length; i++) if (BANK[i].id === id) return BANK[i]; return null; };
