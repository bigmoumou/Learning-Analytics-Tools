/* 第 5、8 段的並排比較（window.CMP）。report.md 的數字和新圖的數字都來自 source/run/averages.py（補充 1 的 grades.csv）。
   CMP.html(右邊的小字) → 說明板的 HTML；CMP.render(t, { on, a, fresh: [A, B, C], circles: [三個琥珀圈出現的秒數] | null, check: 打勾的秒數 | null }) */
(function () {
  const K = window.K, C = K.clamp, E = K.ease;
  const CMP = (window.CMP = {});
  const REPORT = [74.0, 74.7, 67.0];            // 缺考不算進平均（report.md，下午兩點）
  const CLS = ["A 班", "B 班", "C 班"];
  const FILE = '<svg viewBox="0 0 24 24"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/></svg>';
  const IMG = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 16v-4M12 16V8M17 16v-6"/></svg>';
  const X = (i) => 120 + i * 200, H = 300;          // 長條的位置（卡片裡）、滿分 100 的高度
  CMP.html = (sub) => `<div id="cmp">
      <div class="card" id="cmpL"><div class="hd">${FILE}report.md<small>下午兩點寫的</small></div>
        <div class="md"><span class="c">## 各班平均</span>\n${CLS.map((c, i) => `${c}    <span class="v">${REPORT[i].toFixed(1)}</span>`).join("\n")}</div></div>
      <div class="card" id="cmpR"><div class="hd">${IMG}class_avg.png<small id="cmpSub">${sub}</small></div>
        <div class="chart"><div class="ax"></div>${CLS.map((c, i) => `<div class="bar" id="cb${i}" style="left:${X(i) - 60 + 25}px"></div><div class="val" id="cv${i}"></div><div class="lb" style="left:${X(i) - 85 + 25}px">${c}</div>` +
          `<svg class="ring" id="cr${i}" width="150" height="62"><rect x="2" y="2" width="146" height="58" rx="29"/></svg><div class="ok" id="ck${i}">✓</div>`).join("")}</div></div>
    </div>`;
  CMP.render = (t, o) => {
    const el = document.getElementById("cmp");
    K.vis(el, o.on);
    if (o.on <= 0.001) return;
    if (o.sub) document.getElementById("cmpSub").textContent = o.sub;
    document.getElementById("cmpL").style.transform = `translateY(${((1 - K.easeOut((t - o.a) / 0.6)) * 20).toFixed(1)}px)`;
    document.getElementById("cmpR").style.transform = `translateY(${((1 - K.easeOut((t - o.a - 0.3) / 0.6)) * 20).toFixed(1)}px)`;
    o.fresh.forEach((v, i) => {
      const g = K.spring(t - (o.a + 0.6 + i * 0.25), 15, 0.8), h = H * v / 100 * Math.max(0, g);
      const b = document.getElementById("cb" + i); b.style.height = h.toFixed(1) + "px";
      const val = document.getElementById("cv" + i); val.textContent = v.toFixed(1);
      val.style.left = (X(i) - 85 + 25) + "px"; val.style.bottom = (84 + h + 10).toFixed(1) + "px"; val.style.opacity = C((t - (o.a + 0.9 + i * 0.25)) / 0.3);
      // 琥珀圈：沿著外框畫出來
      const r = document.getElementById("cr" + i), rc = r.querySelector("rect"), per = 2 * (146 + 58) - (4 - Math.PI) * 29 * 2;
      const u = o.circles ? E((t - o.circles[i]) / 0.45) : 0;
      r.style.left = (X(i) - 75 + 25) + "px"; r.style.bottom = (84 + H * v / 100 + 4).toFixed(1) + "px";
      rc.style.strokeDasharray = per.toFixed(1); rc.style.strokeDashoffset = (per * (1 - u)).toFixed(1); r.style.opacity = u > 0 ? 1 : 0;
      // 打勾：數字對上了
      const ck = document.getElementById("ck" + i), c = o.check != null ? C((t - (o.check + i * 0.3)) / 0.3) : 0;
      ck.style.left = (X(i) + 25 + 72) + "px"; ck.style.bottom = (84 + H * v / 100 + 14).toFixed(1) + "px"; ck.style.opacity = c;
      ck.style.transform = `scale(${(0.6 + 0.4 * K.spring((o.check != null ? t - (o.check + i * 0.3) : 0), 18, 0.55)).toFixed(3)})`;
    });
  };
})();
