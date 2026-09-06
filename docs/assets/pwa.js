/* Register the service worker, and say something honest about it.

   Two visible behaviors, both small:

   · The first time the series is opened online, a quiet line appears once the
     whole thing is cached, so the reader knows it will work on the train.
   · When a new version has been deployed and is waiting, a line offers to
     take it. Nothing reloads under the reader's feet mid-page.

   Nothing here runs unless the page is served over http(s) — opening a file
   from disk skips it entirely, which is what the inlined dist/ copies do. */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;

  var BASE = new URL(".", document.currentScript
    ? new URL(document.currentScript.src, location.href)
    : location.href);
  /* assets/pwa.js sits one level under the site root */
  var ROOT = new URL("..", BASE);
  var accepted = false;   /* did the reader ask for the waiting version? */

  function toast(text, action, onAction) {
    var el = document.createElement("div");
    el.className = "pwatoast";
    el.setAttribute("role", "status");
    el.innerHTML = "<span>" + text + "</span>";
    if (action) {
      var b = document.createElement("button");
      b.textContent = action;
      b.addEventListener("click", function () { onAction(); el.remove(); });
      el.appendChild(b);
    }
    var x = document.createElement("button");
    x.className = "x";
    x.setAttribute("aria-label", "Dismiss");
    x.textContent = "×";
    x.addEventListener("click", function () { el.remove(); });
    el.appendChild(x);
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("in"); });
    return el;
  }

  /* Ask the worker whether the whole series is really cached, and let it fill
     any gaps a bad connection left. Never promise offline on a partial cache —
     a page that is missing is worse than no promise at all. */
  function askOfflineStatus(sw, then) {
    if (!sw) return;
    var ch = new MessageChannel();
    var settled = false;
    ch.port1.onmessage = function (ev) {
      if (settled) return;
      settled = true;
      then(ev.data);
    };
    try { sw.postMessage("offline-status", [ch.port2]); }
    catch (e) { /* nothing to do */ }
    setTimeout(function () { if (!settled) { settled = true; then(null); } }, 20000);
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker.register(new URL("sw.js", ROOT).href, { scope: ROOT.href })
      .then(function (reg) {
        /* first install — tell the reader once, ever, and only if it is true */
        if (!navigator.serviceWorker.controller) {
          var done = false;
          reg.addEventListener("updatefound", function () {
            var sw = reg.installing;
            if (!sw) return;
            sw.addEventListener("statechange", function () {
              if (sw.state === "activated" && !done) {
                done = true;
                askOfflineStatus(reg.active || sw, function (info) {
                  if (!info || !info.complete) return;
                  try {
                    if (!localStorage.getItem("ov-offline-told")) {
                      localStorage.setItem("ov-offline-told", "1");
                      toast("All " + info.pages + " pages are saved. " +
                            "The series works offline from here.");
                    }
                  } catch (e) { /* private mode; not worth a fuss */ }
                });
              }
            });
          });
          return;
        }
        /* on any later visit, heal gaps quietly */
        askOfflineStatus(reg.active, function () {});
        /* a newer version is waiting */
        function offer(sw) {
          toast("A newer version of the series is ready.", "Load it", function () {
            accepted = true;
            sw.postMessage("skip-waiting");
          });
        }
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener("updatefound", function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", function () {
            if (sw.state === "installed" && navigator.serviceWorker.controller) offer(sw);
          });
        });
      })
      .catch(function (e) { console.warn("[pwa] registration failed:", e.message); });

    /* controllerchange also fires on the very first install, when the fresh
       worker calls clients.claim(). Reloading there would bounce the page out
       from under a first-time reader for no reason, so only reload when the
       change is one they asked for. */
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!accepted || reloading) return;
      reloading = true;
      location.reload();
    });
  });
})();
