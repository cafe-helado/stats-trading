# Chance, visually

Probability and statistics built from simulation rather than asserted, for
people who price risk. Eight modules, each one earning its ideas on the way to
something a trading desk actually does.

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

## Companion

[Options, visually](https://cafe-helado.github.io/options-visually/) is the same
approach applied to options theory. This series is its ground floor.
