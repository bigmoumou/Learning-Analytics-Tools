/* boot.js [PORTABLE] — query flags, startup order, language lock (DESIGN §0.5, §3.2). The ONLY caller of LAB.boot.run. */
(function (LAB) {
  'use strict';

  var params = null;
  try { params = new URLSearchParams(window.location.search); } catch (e) { params = { get: function () { return null; } }; }
  function flag(n) { return params.get(n); }

  // ?now=2026-10-04T10:12:00 — clock OFFSET (keeps ticking)
  if (flag('now')) LAB.clock.setOffsetFromISO(flag('now'));
  // ?perf=low|high
  if (flag('perf') === 'low' || flag('perf') === 'high') LAB.perf.forced = flag('perf');
  // ?welcome=0 — no sheets at all; ?intro=0 — no mission sheets and no completion sheets (the first sheet still shows)
  if (flag('welcome') === '0') LAB.missions.skipWelcome = true;
  if (flag('intro') === '0') LAB.missions.skipIntro = true;
  // ?mission=<id> (one shot)
  var missionFlag = flag('mission');
  if (missionFlag) LAB.missions.pendingStart = missionFlag;
  // ?reset=1 is a leftover of the saved-progress days: every visit already starts fresh, so it only has to be stripped from the URL
  var resetFlag = flag('reset') === '1';
  // ?debug=1
  if (flag('debug') === '1') {
    var baseline = null;
    LAB.debug = {
      logBus: true,
      listeners: function () { return LAB.bus.listeners(); },
      snapshotBaseline: function () { baseline = LAB.bus.listeners(); },
      baseline: function () { return baseline; },
      afterWindowClose: function () {
        if (LAB.wm.all().length || !baseline) return;
        var now = LAB.bus.listeners(), leaks = [];
        Object.keys(now).forEach(function (k) { if (now[k] > (baseline[k] || 0)) leaks.push(k + ' (' + (now[k] - (baseline[k] || 0)) + ' extra)'); });
        console.assert(!leaks.length, '[debug] window-scoped bus listeners survived after all windows closed: ' + leaks.join(', '));
      }
    };
  }

  function start() {
    // i18n.js (loaded only because the course checks demand it) may have changed <html lang>; the lab is zh-Hant only
    document.documentElement.lang = 'zh-Hant';
    LAB.boot.run();
    document.documentElement.lang = 'zh-Hant';
    // strip the one-shot parameters so a reload does not repeat them
    if (resetFlag || missionFlag) {
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete('reset');
        u.searchParams.delete('mission');
        window.history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash);
      } catch (e3) { /* ignore */ }
    }
  }

  // Back / Forward can restore the whole page, with its in-memory state, from the browser's back/forward cache. Every visit must be new.
  window.addEventListener('pageshow', function (e) { if (e && e.persisted) window.location.reload(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window.LAB);
