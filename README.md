# Chance, visually

Probability and statistics built from simulation rather than asserted, for
people who price risk. Thirteen modules and a practice floor, each one earning its ideas on the way to
something a trading desk actually does — ending with the arithmetic pointed at
bookmaking, bet sizing, poker, blackjack and options trading.

**Live:** https://cafe-helado.github.io/stats-trading/

The site is `docs/` — static HTML, no framework, no build step, no
dependencies. GitHub Pages serves it from that folder. It is also a PWA: add it
to a phone's home screen and the whole series works with no network.

## The two toolchain commands

    cd docs
    node check.js      structural: ids, links, equations, and every page executes
    node verify.js     numeric: does the prose agree with what the pages compute

Run both before every commit. `verify.js` is the one that matters most — it
loads each page's shipped script under a stubbed DOM and re-derives the numbers
the prose asserts. A page can pass `check.js` while claiming 58% where its own
figure computes 42%; that has happened, on the companion series, twice.

## Adding a module

1. Write `<name>_body.html` and `<name>_js.js`.
2. `python mkpage.py <name>_body.html <name>_js.js <name>.html "Title" "Description"`
3. `node check.js <name>.html` until it passes.
4. Add the module's numbers to `verify.js` and run `node verify.js <name>`.
5. Add the entry to `index.html` and mark it live in `ROADMAP.md`.
6. **Add the filename to `PRECACHE` in `sw.js` and bump `CACHE`.**
7. Delete the `_body`/`_js` fragments — the assembled page is the source of truth.

## The rest of the repo

The Jupyter notebooks and `app.py` at the root are the earlier version of this
project. `CONTEXT.md` holds personal curriculum notes and is deliberately
gitignored — it stays on disk and out of the published repo.

## Practice (page 14)

The thirteen modules each end in a drill, and those drills share a structural
limit: they sit under the chapter that taught the method, so they never make
you choose it. Page 14 is the drill floor that does.

`assets/bank.js` holds all 47 question generators, keyed by module and tier.
Each returns `{q, a, unit, tol, w}` from a random source, so the numbers are
regenerated every time and there is nothing to memorize. The page draws from
every module at once, schedules with Leitner boxes at 1/3/8/21/55 questions,
keeps a per-module record in localStorage, and offers a twenty-question exam
marked only at the end.

Adding a question is one object in `BANK`. `verify.js` exercises every
generator 400 times for finiteness and a usable tolerance, and spot-checks
sixteen of them against the values their home pages assert — so a formula
transcribed wrongly into the bank fails the pre-flight rather than teaching
someone the wrong thing.

The per-module drills deliberately still generate their own questions. Sharing
one bank across fourteen pages would have made every page depend on it, and
the point of a page being self-contained is that it keeps working when
something else changes.

## The syllabus, and what was deliberately left out

The series was mapped against a full statistics and probability syllabus. Four
missing units earned their own modules — counting, the probability rules,
descriptive statistics and hypothesis testing. The rest were folded in as
chapters: two-sample tests and chi-square sit inside module 09, and inference
for regression stays in module 11, which already does correlation intervals.

Stem-and-leaf plots, dot plots, two-way tables as their own unit, ANOVA, and
observational-versus-experimental study design were skipped on purpose. They
are school-curriculum filler for a reader who prices risk, and adding them
would have cost pages without adding capability.

## Two traps, both already paid for

**`line()` takes arrays, not a function.** Its signature is
`line(o, xs, ys, col, w, dash)`. Passing a function where `xs` goes is a
*silent* no-op — `xs.length` is `undefined`, the loop never runs, and the curve
simply does not appear. Nothing catches it on its own: `check.js` executes the
page happily, `verify.js` only re-derives numbers, and the figure still draws
its axes so it looks finished. It cost three curves on module 08 and two on
module 09, found only by sampling canvas pixels for the color that should have
been there. `check.js` now refuses a `line()` whose third argument is a color
or whose second is a function. Use the local `curve(o, f, col, w)` helper on
pages that plot a sampled function.

**A figure can open in a state that hides its own point.** Module 09's fifth
figure plots the growth you expected against the growth you will get; with the
two edges equal at load, the second curve sat exactly on top of the first and
the legend promised a line that was not visible. It now opens with the true
edge at half the assumed one, which is the chapter's actual claim — 2x true
Kelly, zero growth — and the overlay is dashed so coincident curves still read.

## Companion

[Options, visually](https://cafe-helado.github.io/options-visually/) is the same
approach applied to options theory. This series is its ground floor.
