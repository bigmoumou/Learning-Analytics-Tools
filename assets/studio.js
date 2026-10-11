/* ==========================================================================
   首頁的攝影棚道具（home.js 的膠捲舞台用）
   - 道具是真的 3D 模型（程式產生的簡單幾何），用跟膠捲同一個相機和投影，畫在同一個 WebGL 畫布上。
   - 相機不會動，所以道具只在版面或主題改變時算一次，存成兩張貼圖：
       後層：膠捲後面、從膠捲下方縫隙看得到的地板道具（輕微柔焦＋霧）
       前層：膠捲前面、畫面兩側的攝影機和燈（離焦比較多，像從工作人員背後看過去）
     平常每一格只是把兩張貼圖貼上去，不會增加重畫的負擔。
   - 會動的部分（燈的光暈、錄影指示燈、霧、光裡的灰塵）是 CSS 圖層，位置由這裡算好，
     只用 transform／opacity，不會叫醒 WebGL 重畫；減少動態時全部靜止。
   用法（home.js）：
     const studio = window.Studio && window.Studio(gl, { floorY });
     layout 之後 studio.layout(proj, cam, cssW, cssH)；顏色改變時 studio.colors(fog, dark)；
     draw() 裡：地板之後 studio.drawBack(alpha)，膠捲之後 studio.drawFront(alpha)。
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- 小型矩陣工具（4×4，欄優先，跟 WebGL 一樣） ---------- */
  function mat() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function T(x, y, z) { const m = mat(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function S(x, y, z) { const m = mat(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function RX(a) { const m = mat(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function RY(a) { const m = mat(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function RZ(a) { const m = mat(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function chain() { let m = mat(); for (let i = 0; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }
  function apply(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }
  function applyN(m, n) {
    const v = [m[0] * n[0] + m[4] * n[1] + m[8] * n[2], m[1] * n[0] + m[5] * n[1] + m[9] * n[2], m[2] * n[0] + m[6] * n[1] + m[10] * n[2]];
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  /* ---------- 網格：每個頂點 位置(3) 法線(3) 顏色＋材質(4) ----------
     材質：0 霧面、1 金屬（有反光）、2 自發光（燈面、螢幕）、3 地上的影子（法線 xy 當作局部座標） */
  function Mesh() { this.v = []; this.s = []; }   // v：實體道具，s：地上的影子（另外畫）
  Mesh.prototype.tri = function (m, a, b, c, na, nb, nc, col) {
    const pa = apply(m, a), pb = apply(m, b), pc = apply(m, c);
    const out = col[3] === 3 ? this.s : this.v;
    const push = (p, n) => { out.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], col[3]); };
    push(pa, applyN(m, na)); push(pb, applyN(m, nb)); push(pc, applyN(m, nc));
  };
  Mesh.prototype.flat = function (m, a, b, c, col) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    this.tri(m, a, b, c, n, n, n, col);
  };
  Mesh.prototype.quad = function (m, a, b, c, d, col) { this.flat(m, a, b, c, col); this.flat(m, a, c, d, col); };
  // 方塊：中心在原點
  Mesh.prototype.box = function (m, w, h, d, col) {
    const x = w / 2, y = h / 2, z = d / 2;
    const P = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
    const F = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]];
    F.forEach((f) => this.quad(m, P[f[0]], P[f[1]], P[f[2]], P[f[3]], col));
  };
  // 圓柱（或圓錐台）：沿 +y，從 0 到 h
  Mesh.prototype.cyl = function (m, r0, r1, h, seg, col, caps) {
    const k = (r0 - r1) / h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const n0 = norm([c0, k, s0]), n1 = norm([c1, k, s1]);
      const A = [r0 * c0, 0, r0 * s0], B = [r0 * c1, 0, r0 * s1], C = [r1 * c1, h, r1 * s1], D = [r1 * c0, h, r1 * s0];
      this.tri(m, A, C, B, n0, n1, n1, col); this.tri(m, A, D, C, n0, n0, n1, col);
      if (caps) {
        this.tri(m, [0, h, 0], C, D, [0, 1, 0], [0, 1, 0], [0, 1, 0], caps === true ? col : caps);
        this.tri(m, [0, 0, 0], A, B, [0, -1, 0], [0, -1, 0], [0, -1, 0], col);
      }
    }
  };
  // 兩點之間的桿子
  Mesh.prototype.rod = function (m, p0, p1, r, col, seg) {
    const d = sub(p1, p0), len = Math.hypot(d[0], d[1], d[2]);
    const y = norm(d);
    const ref = Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const x = norm(cross(ref, y)), z = cross(x, y);
    const basis = [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, p0[0], p0[1], p0[2], 1];
    this.cyl(mul(m, basis), r, r, len, seg || 8, col, true);
  };
  // 球（壓扁就是沙包、鏡頭前緣）
  Mesh.prototype.sphere = function (m, r, seg, col) {
    const rows = Math.max(4, seg >> 1);
    for (let j = 0; j < rows; j++) {
      const t0 = (j / rows) * Math.PI, t1 = ((j + 1) / rows) * Math.PI;
      for (let i = 0; i < seg; i++) {
        const p0 = (i / seg) * Math.PI * 2, p1 = ((i + 1) / seg) * Math.PI * 2;
        const v = (t, p) => [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
        const a = v(t0, p0), b = v(t0, p1), c = v(t1, p1), d = v(t1, p0);
        const s = (q) => [q[0] * r, q[1] * r, q[2] * r];
        this.tri(m, s(a), s(c), s(b), a, c, b, col);
        this.tri(m, s(a), s(d), s(c), a, d, c, col);
      }
    }
  };
  // 甜甜圈（地上的電線圈），平放在 xz 平面
  Mesh.prototype.torus = function (m, R, r, seg, side, col) {
    for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) {
      const u0 = (i / seg) * Math.PI * 2, u1 = ((i + 1) / seg) * Math.PI * 2;
      const v0 = (j / side) * Math.PI * 2, v1 = ((j + 1) / side) * Math.PI * 2;
      const P = (u, v) => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
      const N = (u, v) => [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)];
      this.tri(m, P(u0, v0), P(u1, v1), P(u1, v0), N(u0, v0), N(u1, v1), N(u1, v0), col);
      this.tri(m, P(u0, v0), P(u0, v1), P(u1, v1), N(u0, v0), N(u0, v1), N(u1, v1), col);
    }
  };
  // 地上的影子：平放的方形，法線 xy 放局部座標，著色器做柔邊
  Mesh.prototype.shadow = function (m, rx, rz, strength) {
    const col = [strength, 0, 0, 3];
    const P = [[-rx, 0, -rz], [rx, 0, -rz], [rx, 0, rz], [-rx, 0, rz]];
    const U = [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]];
    this.tri(m, P[0], P[2], P[1], U[0], U[2], U[1], col);
    this.tri(m, P[0], P[3], P[2], U[0], U[3], U[2], col);
  };
  // 沿著地上的折線鋪一條電線（一段一段的細桿子）
  Mesh.prototype.cable = function (m, pts, r, col) {
    for (let i = 0; i + 1 < pts.length; i++) this.rod(m, pts[i], pts[i + 1], r, col, 6);
  };

  /* ---------- 顏色 ---------- */
  const C = {
    black:  [0.055, 0.052, 0.05, 0],
    fabric: [0.11, 0.105, 0.1, 0],
    steel:  [0.30, 0.30, 0.31, 1],
    chrome: [0.55, 0.55, 0.56, 1],
    dark:   [0.2, 0.196, 0.19, 1],
    rubber: [0.04, 0.04, 0.04, 0],
    wood:   [0.46, 0.33, 0.21, 0],
    woodD:  [0.30, 0.21, 0.13, 0],
    canvas: [0.24, 0.21, 0.15, 0],
    slate:  [0.06, 0.06, 0.065, 0],
    white:  [0.80, 0.79, 0.76, 0],
    tape:   [0.78, 0.60, 0.20, 0],
    glow:   [1.0, 0.86, 0.66, 2],      // 柔光罩
    lens:   [0.10, 0.12, 0.16, 1],
    screen: [0.20, 0.27, 0.33, 2],     // 攝影機上的小螢幕
    red:    [0.85, 0.12, 0.08, 2],
    chair:  [0.13, 0.12, 0.11, 0],    // 導演椅的黑帆布
    ink:    [0.62, 0.55, 0.42, 0],
  };

  /* ---------- 道具 ---------- */
  // 燈架：三腳＋中柱，回傳頂端的位置
  function lightStand(g, m, height, spread, col) {
    const hub = 0.62;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      const foot = [Math.cos(a) * spread, 0.02, Math.sin(a) * spread];
      g.rod(m, [0, hub, 0], foot, 0.022, col);
      g.rod(m, [0, hub * 0.45, 0], [foot[0] * 0.55, hub * 0.45 * 0.2, foot[2] * 0.55], 0.012, col); // 支撐桿
      g.box(chain(m, T(foot[0], 0.02, foot[2])), 0.07, 0.04, 0.07, C.rubber);
    }
    g.rod(m, [0, 0.4, 0], [0, height * 0.55, 0], 0.035, col, 10);
    g.rod(m, [0, height * 0.55, 0], [0, height, 0], 0.026, C.chrome, 10);
    g.cyl(chain(m, T(0, height * 0.55 - 0.05, 0)), 0.05, 0.05, 0.1, 10, C.dark, true); // 鎖扣
    g.shadow(m, spread * 1.25, spread * 1.25, 0.5);
    return [0, height, 0];
  }

  // 柔光箱：從燈頭往前張開的四角錐台，前面是發光的布
  function softbox(g, m, w, h, depth) {
    const bw = 0.16, bh = 0.16;
    const B = [[-bw, -bh, 0], [bw, -bh, 0], [bw, bh, 0], [-bw, bh, 0]];
    const F = [[-w / 2, -h / 2, depth], [w / 2, -h / 2, depth], [w / 2, h / 2, depth], [-w / 2, h / 2, depth]];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      g.quad(m, B[i], B[j], F[j], F[i], C.fabric);
    }
    g.quad(m, F[3], F[2], F[1], F[0], C.glow);           // 前面的柔光布
    g.quad(m, B[0], B[1], B[2], B[3], C.fabric);
    // 邊框（黑布收邊）
    const e = 0.035;
    g.box(chain(m, T(0, h / 2 - e / 2, depth)), w, e, 0.03, C.fabric);
    g.box(chain(m, T(0, -h / 2 + e / 2, depth)), w, e, 0.03, C.fabric);
    g.box(chain(m, T(w / 2 - e / 2, 0, depth)), e, h, 0.03, C.fabric);
    g.box(chain(m, T(-w / 2 + e / 2, 0, depth)), e, h, 0.03, C.fabric);
    g.cyl(chain(m, RX(-Math.PI / 2), T(0, -0.2, 0)), 0.12, 0.12, 0.2, 14, C.dark, true); // 燈頭
  }

  // 攝影機架在矮腳架上（低機位）。攝影機朝 +z（之後整組轉向膠捲）
  function cameraRig(g, m, headY) {
    const legs = [];
    const spread = 0.24 + headY * 0.42;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      const foot = [Math.cos(a) * spread, 0.0, Math.sin(a) * spread];
      const knee = [foot[0] * 0.55, headY * 0.45, foot[2] * 0.55];
      g.rod(m, [foot[0] * 0.08, headY - 0.05, foot[2] * 0.08], knee, 0.026, C.dark);
      g.rod(m, knee, foot, 0.018, C.steel);
      g.cyl(chain(m, T(knee[0], knee[1] - 0.035, knee[2])), 0.032, 0.032, 0.07, 8, C.black, true); // 鎖扣
      g.box(chain(m, T(foot[0], 0.015, foot[2])), 0.06, 0.03, 0.06, C.rubber);
      legs.push(foot);
    }
    for (let i = 0; i < 3; i++) g.rod(m, [legs[i][0] * 0.95, 0.04, legs[i][2] * 0.95], [0, 0.04, 0], 0.011, C.dark); // 地面撐腳
    g.shadow(m, spread * 1.35, spread * 1.35, 0.6);
    // 雲台和搖桿（往後伸出來）
    g.cyl(chain(m, T(0, headY - 0.05, 0)), 0.1, 0.085, 0.07, 14, C.dark, true);
    g.box(chain(m, T(0, headY + 0.06, 0)), 0.15, 0.11, 0.19, C.dark);
    g.rod(m, [0.06, headY + 0.06, -0.05], [0.2, headY - 0.02, -0.58], 0.015, C.steel);
    g.rod(m, [0.2, headY - 0.02, -0.58], [0.22, headY - 0.04, -0.7], 0.021, C.rubber);
    // 機身
    const by = headY + 0.25;
    g.box(chain(m, T(0, by, 0.04)), 0.2, 0.25, 0.42, C.dark);
    g.box(chain(m, T(0, by + 0.02, -0.2)), 0.18, 0.19, 0.1, C.black);          // 電池
    g.rod(m, [0, by + 0.17, -0.12], [0, by + 0.17, 0.2], 0.014, C.black);     // 提把
    g.rod(m, [0, by + 0.125, -0.12], [0, by + 0.17, -0.12], 0.012, C.black);
    g.rod(m, [0, by + 0.125, 0.2], [0, by + 0.17, 0.2], 0.012, C.black);
    // 鏡頭和遮光斗
    g.cyl(chain(m, T(0, by - 0.02, 0.25), RX(Math.PI / 2)), 0.085, 0.095, 0.3, 18, C.black, C.lens);
    g.cyl(chain(m, T(0, by - 0.02, 0.37), RX(Math.PI / 2)), 0.1, 0.1, 0.03, 18, C.steel);    // 對焦環
    // 側邊小螢幕（朝後，看的人看得到它亮著）
    const sm = chain(m, T(-0.17, by + 0.1, -0.1), RY(-0.6));
    g.box(sm, 0.02, 0.12, 0.17, C.black);
    g.quad(chain(sm, T(-0.012, 0, 0)), [0, -0.05, 0.075], [0, -0.05, -0.075], [0, 0.05, -0.075], [0, 0.05, 0.075], C.screen);
    return { tally: apply(m, [0.07, by + 0.135, 0.24]), screen: apply(sm, [-0.02, 0, 0]) };
  }

  // 聚光燈（Fresnel）：圓筒燈身、前面發光的鏡片、四片遮光板。朝 +z
  function fresnel(g, m) {
    g.cyl(chain(m, T(0, 0, -0.3), RX(Math.PI / 2)), 0.2, 0.22, 0.44, 20, C.dark, C.glow);
    g.cyl(chain(m, T(0, 0, -0.36), RX(Math.PI / 2)), 0.12, 0.2, 0.06, 20, C.black, true);   // 後蓋
    for (let i = 0; i < 4; i++) {                     // 遮光板：在燈口往外張開
      const door = chain(m, RZ((i * Math.PI) / 2), T(0, 0.23, 0.14), RX(-0.55));
      g.box(chain(door, T(0, 0, 0.12)), 0.42, 0.008, 0.24, C.black);
    }
    g.rod(m, [-0.25, 0, 0], [-0.25, -0.3, 0], 0.016, C.dark);       // U 形支架
    g.rod(m, [0.25, 0, 0], [0.25, -0.3, 0], 0.016, C.dark);
    g.rod(m, [-0.25, -0.3, 0], [0.25, -0.3, 0], 0.016, C.dark);
  }

  // 導演椅：木頭交叉腳、帆布椅面和椅背。坐的人朝 +z
  function directorChair(g, m) {
    const W = 0.27, seat = 0.6, arm = 0.84, top = 1.06;
    for (const sx of [-1, 1]) {
      const x = sx * W;
      g.rod(m, [x, 0.02, 0.22], [x, seat, -0.2], 0.02, C.wood);        // 側面交叉的兩支腳
      g.rod(m, [x, 0.02, -0.22], [x, seat, 0.2], 0.02, C.wood);
      g.rod(m, [x, seat, -0.2], [x, top, -0.23], 0.02, C.wood);        // 椅背的立柱
      g.rod(m, [x, seat, 0.2], [x, arm, 0.2], 0.018, C.wood);          // 扶手的前柱
      g.box(chain(m, T(x * 1.04, arm + 0.012, 0)), 0.07, 0.024, 0.5, C.wood);   // 扶手
      g.box(chain(m, T(x, 0.015, 0)), 0.05, 0.03, 0.5, C.woodD);       // 腳底的橫木
    }
    g.rod(m, [-W, 0.16, 0.13], [W, 0.16, 0.13], 0.014, C.wood);         // 腳踏
    g.rod(m, [-W, seat, 0.2], [W, seat, 0.2], 0.016, C.wood);
    g.rod(m, [-W, seat, -0.2], [W, seat, -0.2], 0.016, C.wood);
    g.box(chain(m, T(0, seat + 0.01, 0)), W * 2, 0.012, 0.38, C.chair); // 帆布椅面
    g.box(chain(m, T(0, top - 0.11, -0.225)), W * 2 + 0.02, 0.2, 0.012, C.chair);  // 帆布椅背
    g.box(chain(m, T(0, top - 0.11, -0.233)), W * 1.2, 0.022, 0.003, C.ink);       // 椅背上的一行字（遠看就是一條線）
    g.shadow(m, 0.5, 0.42, 0.6);
  }

  // 大聲公：前寬後窄的喇叭，加一支握把
  function megaphone(g, m) {
    g.cyl(chain(m, RX(Math.PI / 2)), 0.05, 0.13, 0.34, 16, C.white, C.black);
    g.cyl(chain(m, T(0, 0, -0.05), RX(Math.PI / 2)), 0.045, 0.05, 0.06, 12, C.black, true);
    g.rod(m, [0, -0.04, 0.08], [0, -0.13, 0.06], 0.014, C.black);
  }

  // 蘋果箱：木箱，側邊有提把孔
  function appleBox(g, m, w, h, d) {
    g.box(m, w, h, d, C.wood);
    const hole = (x, z, sx, sz) => g.box(chain(m, T(x, 0.02, z)), sx, h * 0.28, sz, C.woodD);
    hole(0, d / 2 + 0.002, w * 0.3, 0.004);
    hole(0, -d / 2 - 0.002, w * 0.3, 0.004);
  }

  // 打板：黑板身＋上面的拍桿（黑白相間）
  function clapper(g, m) {
    g.box(chain(m, T(0, 0.19, 0)), 0.44, 0.34, 0.025, C.slate);
    for (let i = 0; i < 4; i++) g.box(chain(m, T(0, 0.08 + i * 0.07, 0.014)), 0.38, 0.006, 0.002, C.white); // 板上的格線
    const stick = chain(m, T(-0.22, 0.38, 0), RZ(0.18));
    for (let i = 0; i < 6; i++) g.box(chain(stick, T(0.037 + i * 0.074, 0.03, 0)), 0.074, 0.06, 0.03, i % 2 ? C.white : C.slate);
  }

  // 沙包：兩個壓扁的球，中間一條提帶
  function sandbag(g, m) {
    g.sphere(chain(m, T(-0.15, 0.07, 0), S(0.2, 0.08, 0.13)), 1, 14, C.canvas);
    g.sphere(chain(m, T(0.15, 0.07, 0), S(0.2, 0.08, 0.13)), 1, 14, C.canvas);
    g.box(chain(m, T(0, 0.1, 0)), 0.08, 0.05, 0.2, C.black);
    g.shadow(m, 0.45, 0.25, 0.45);
  }

  /* ---------- 場景配置（座標和膠捲一樣：圓柱半徑 10、相機在 z = -2.5 看向 -z） ---------- */
  function buildScene(floorY) {
    const back = new Mesh(), front = new Mesh();
    const anchors = {};
    const F = (x, z, rot) => chain(T(x, floorY, z), RY(rot || 0));
    const aimY = (x, z, tx, tz) => Math.atan2(tx - x, tz - z); // 讓 +z 朝向 (tx, tz)

    // 後層・左後方：高燈架上的聚光燈，燈頭從膠捲上緣探出來，對著膠捲打
    {
      const x = -4.15, z = -13.2, h = 5.05;
      const m = F(x, z, aimY(x, z, 0, -9));
      lightStand(back, m, h, 0.85, C.dark);
      sandbag(back, chain(m, T(0.62, 0, 0.3), RY(0.7)));
      const head = chain(m, T(0, h + 0.32, 0), RX(0.22));
      back.rod(m, [0, h - 0.05, 0], [0, h + 0.02, 0], 0.03, C.dark);
      fresnel(back, head);
      anchors.lampL = apply(head, [0, 0, 0.16]);
    }
    // 後層・右後方：柔光箱
    {
      const x = 5.5, z = -13.4, h = 4.85;
      const m = F(x, z, aimY(x, z, -3.5, -8.5));
      lightStand(back, m, h, 0.85, C.dark);
      sandbag(back, chain(m, T(-0.6, 0, 0.35), RY(-0.5)));
      const head = chain(m, T(0, h + 0.12, 0), RX(0.28));
      softbox(back, head, 1.3, 0.95, 0.85);
      anchors.lampR = apply(head, [0, 0, 0.84]);
    }
    // 後層・膠捲正下方的地板（從縫裡看得到）：蘋果箱＋打板、沙包、電線圈
    {
      const m = F(-1.95, -12.0, 0.3);
      appleBox(back, chain(m, T(0, 0.17, 0)), 0.62, 0.34, 0.4);
      appleBox(back, chain(m, T(0.07, 0.34 + 0.085, 0.02), RY(-0.14)), 0.62, 0.17, 0.4);
      back.shadow(m, 0.6, 0.45, 0.55);
      clapper(back, chain(m, T(0.48, 0, 0.3), RY(-0.45), RX(-0.22)));
      sandbag(back, F(-0.95, -11.5, -0.35));
      back.torus(F(1.25, -11.4, 0), 0.3, 0.026, 26, 6, C.rubber);
      back.torus(F(1.27, -11.4, 0.5), 0.24, 0.024, 26, 6, C.rubber);
      back.shadow(F(1.25, -11.4, 0), 0.36, 0.36, 0.3);
      back.cable(F(0, 0, 0), [[1.5, 0.02, -11.3], [2.2, 0.02, -11.1], [3.3, 0.02, -11.5], [4.6, 0.02, -12.6], [5.6, 0.25, -13.5]], 0.013, C.rubber);
    }
    // 前層・右前方的地板：低機位的攝影機，對著正中間那一格
    {
      const x = 2.95, z = -9.8;
      const m = F(x, z, aimY(x, z, 0, -10.5));
      const rig = cameraRig(front, m, 0.62);
      anchors.tally = rig.tally; anchors.screen = rig.screen;
      front.cable(m, [[0.0, 0.3, -0.2], [0.05, 0.02, -0.3], [0.35, 0.02, -0.75], [0.9, 0.02, -0.95], [2.2, 0.02, -0.8]], 0.012, C.rubber);
    }
    // 前層・攝影機右後方：導演椅，地上放一支大聲公
    {
      const x = 4.35, z = -9.45;
      const m = F(x, z, aimY(x, z, 0, -10.5));
      directorChair(front, m);
      megaphone(front, chain(F(x - 0.5, z + 0.25, 0.9), T(0, 0.13, 0), RZ(-0.1)));
      front.shadow(F(x - 0.5, z + 0.25, 0.9), 0.22, 0.14, 0.45);
    }
    // 前層・中間地上：演員站位的膠帶「T」
    {
      const m = chain(T(0.12, floorY + 0.004, -9.35), RY(0.08));
      front.box(m, 0.42, 0.006, 0.05, C.tape);
      front.box(chain(m, T(0, 0, 0.13)), 0.05, 0.006, 0.24, C.tape);
    }
    const pack = (g) => ({ data: new Float32Array(g.v.concat(g.s)), solid: g.v.length / 10, shadow: g.s.length / 10 });
    return { back: pack(back), front: pack(front), anchors };
  }

  /* ---------- 著色器 ---------- */
  const PROP_VS = `#version 300 es
    in vec3 aPos; in vec3 aNor; in vec4 aCol;
    uniform mat4 uProj; uniform vec3 uCam;
    out vec3 vW; out vec3 vN; out vec4 vC;
    void main() { vW = aPos; vN = aNor; vC = aCol; gl_Position = uProj * vec4(aPos - uCam, 1.0); }`;
  const PROP_FS = `#version 300 es
    precision highp float;
    in vec3 vW; in vec3 vN; in vec4 vC; out vec4 o;
    uniform vec3 uCam, uHaze, uKey, uKeyCol, uFillCol, uRimCol;
    uniform float uAmb, uFloorY, uFogK, uGlow, uShadow;
    void main() {
      float mtl = vC.a;
      if (mtl > 2.5) {                                   // 影子：柔邊的橢圓
        float r = length(vN.xy);
        o = vec4(0.0, 0.0, 0.0, (1.0 - smoothstep(0.15, 1.0, r)) * vC.r * uShadow);
        return;
      }
      vec3 n = normalize(vN), v = normalize(uCam - vW);
      if (dot(n, v) < 0.0) n = -n;
      vec3 L = uKey - vW; float dist = length(L); L /= dist;
      float att = 1.0 / (1.0 + 0.012 * dist * dist);
      float cone = smoothstep(0.55, 0.95, dot(-L, normalize(vec3(0.0, -1.0, -0.15))));  // 頂燈是聚光燈：越靠中間越亮
      float key = max(dot(n, L), 0.0) * att * (0.4 + 0.6 * cone);
      float fill = max(dot(n, normalize(vec3(-0.3, 0.45, 1.0))), 0.0);      // 觀眾這一側很淡的補光（螢幕的反光）
      // 背光（膠捲和後面的燈打過來）：讓暗色道具的輪廓浮出來
      float rim = pow(1.0 - max(dot(n, v), 0.0), 2.6) * (0.35 + 0.65 * max(dot(n, normalize(vec3(0.0, 0.35, -1.0))), 0.0));
      vec3 c = vC.rgb * (uAmb + uKeyCol * key + uFillCol * fill) + uRimCol * rim * (0.4 + vC.r);
      if (mtl > 0.5 && mtl < 1.5) {
        vec3 h = normalize(L + v);
        c += uKeyCol * pow(max(dot(n, h), 0.0), 36.0) * 0.55 * att * (0.3 + 0.7 * cone);
        c += uRimCol * rim * 0.8;
      }
      if (mtl > 1.5) c = vC.rgb * uGlow;
      float d = length(vW - uCam);
      float fog = 1.0 - exp(-d * uFogK);
      float low = (1.0 - smoothstep(0.0, 1.3, vW.y - uFloorY)) * smoothstep(8.0, 14.0, d) * 0.35;  // 貼地的薄霧
      c = mix(c, uHaze, clamp(fog + low, 0.0, 0.92));
      o = vec4(c, 1.0);
    }`;
  const QUAD_VS = `#version 300 es
    in vec2 aP; out vec2 vUv;
    void main() { vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
  const BLUR_FS = `#version 300 es
    precision mediump float;
    in vec2 vUv; out vec4 o;
    uniform sampler2D uTex; uniform vec2 uStep; uniform float uSigma;
    void main() {
      vec4 s = vec4(0.0); float ws = 0.0;
      for (int i = -12; i <= 12; i++) {
        float x = float(i);
        float w = exp(-x * x / (2.0 * uSigma * uSigma));
        s += texture(uTex, vUv + uStep * x) * w; ws += w;
      }
      o = s / ws;
    }`;
  const COPY_FS = `#version 300 es
    precision mediump float;
    in vec2 vUv; out vec4 o;
    uniform sampler2D uTex; uniform float uAlpha;
    void main() { o = texture(uTex, vUv) * uAlpha; }`;

  window.Studio = function (gl, opts) {
    const floorY = opts.floorY;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function program(vs, fs) {
      const make = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let k = 0; k < n; k++) { const name = gl.getActiveUniform(p, k).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u };
    }
    const prop = program(PROP_VS, PROP_FS);
    const blur = program(QUAD_VS, BLUR_FS);
    const copy = program(QUAD_VS, COPY_FS);
    const scene = buildScene(floorY);

    function meshVao(pk) {
      const data = pk.data;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const stride = 40;
      const at = (name, size, off) => {
        const loc = gl.getAttribLocation(prop.p, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      };
      at("aPos", 3, 0); at("aNor", 3, 12); at("aCol", 4, 24);
      gl.bindVertexArray(null);
      return { vao, solid: pk.solid, shadow: pk.shadow };
    }
    const backMesh = meshVao(scene.back), frontMesh = meshVao(scene.front);

    const quad = gl.createVertexArray();
    gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const pr of [blur, copy]) {
      const loc = gl.getAttribLocation(pr.p, "aP");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);

    /* ---------- 離屏畫布 ---------- */
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
    function colorTex(w, h) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb, w, h };
    }
    let tg = null; // { w, h, ms, msColor, msDepth, back, front, tmp }
    function freeTargets() {
      if (!tg) return;
      [tg.back, tg.front, tg.tmp].forEach((x) => { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.fb); });
      gl.deleteFramebuffer(tg.ms); gl.deleteRenderbuffer(tg.msColor); gl.deleteRenderbuffer(tg.msDepth);
      tg = null;
    }
    function targets(w, h) {
      if (tg && tg.w === w && tg.h === h) return tg;
      freeTargets();
      const ms = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
      const msColor = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, msColor);
      if (samples) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
      else gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msColor);
      const msDepth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, msDepth);
      if (samples) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
      else gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msDepth);
      tg = { w, h, ms, msColor, msDepth, back: colorTex(w, h), front: colorTex(w, h), tmp: colorTex(w, h) };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return tg;
    }

    /* ---------- 狀態 ---------- */
    let proj = null, cam = null, cssW = 1, cssH = 1, pxW = 1, pxH = 1;
    let fog = [0, 0, 0], dark = true;
    let dirty = true;

    function look() {
      // 深色：暗棚，道具是被頂燈和背光勾出輪廓的深色剪影；淺色：白棚，道具是淡灰的剪影
      return dark
        ? { haze: [fog[0] + 0.035, fog[1] + 0.031, fog[2] + 0.027], keyCol: [1.7, 1.36, 0.95], fillCol: [0.2, 0.22, 0.26], rimCol: [0.5, 0.44, 0.36], amb: 0.12, fogK: 0.028, glow: 0.8, shadow: 1 }
        : { haze: fog.slice(), keyCol: [0.75, 0.73, 0.7], fillCol: [0.3, 0.3, 0.3], rimCol: [0.12, 0.12, 0.12], amb: 0.55, fogK: 0.11, glow: 0.6, shadow: 0.3 };
    }

    function renderLayer(mesh, target, sigma, glowK) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, tg.ms);
      gl.viewport(0, 0, tg.w, tg.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(prop.p);
      const u = prop.u, L = look();
      gl.uniformMatrix4fv(u.uProj, false, proj);
      gl.uniform3fv(u.uCam, cam);
      gl.uniform3fv(u.uHaze, L.haze);
      gl.uniform3fv(u.uKey, [0, 7.5, -8.5]);
      gl.uniform3fv(u.uKeyCol, L.keyCol);
      gl.uniform3fv(u.uFillCol, L.fillCol);
      gl.uniform3fv(u.uRimCol, L.rimCol);
      gl.uniform1f(u.uAmb, L.amb);
      gl.uniform1f(u.uFloorY, floorY);
      gl.uniform1f(u.uFogK, L.fogK);
      gl.uniform1f(u.uGlow, L.glow * glowK);
      gl.uniform1f(u.uShadow, L.shadow);
      gl.bindVertexArray(mesh.vao);
      // 先畫不透明的道具（有深度），影子最後疊上去：會被道具擋住，但不寫深度
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.solid);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (mesh.shadow) gl.drawArrays(gl.TRIANGLES, mesh.solid, mesh.shadow);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      // 多重取樣 → 一般貼圖
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tg.ms);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.fb);
      gl.blitFramebuffer(0, 0, tg.w, tg.h, 0, 0, tg.w, tg.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      // 柔焦：水平、垂直各一次
      if (sigma > 0.3) {
        gl.useProgram(blur.p);
        gl.bindVertexArray(quad);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(blur.u.uTex, 0);
        gl.uniform1f(blur.u.uSigma, Math.min(sigma, 6));
        const stepK = sigma > 6 ? sigma / 6 : 1;
        gl.bindFramebuffer(gl.FRAMEBUFFER, tg.tmp.fb);
        gl.bindTexture(gl.TEXTURE_2D, target.t);
        gl.uniform2f(blur.u.uStep, stepK / tg.w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb);
        gl.bindTexture(gl.TEXTURE_2D, tg.tmp.t);
        gl.uniform2f(blur.u.uStep, 0, stepK / tg.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindVertexArray(null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function render() {
      if (!proj) return;
      const scale = 0.5;                          // 道具本來就是柔焦的，半解析度就夠
      targets(Math.max(1, Math.round(pxW * scale)), Math.max(1, Math.round(pxH * scale)));
      const px = tg.h / 900;                      // 以 900 像素高的畫面為準，換算模糊的大小
      renderLayer(backMesh, tg.back, 1.8 * px, 0.62);   // 膠捲後面：比對焦的膠捲遠，柔一點；燈面不要搶眼
      renderLayer(frontMesh, tg.front, 0.9 * px, 1);    // 前面地上：跟膠捲差不多遠，只柔一點點
      dirty = false;
      placeFx();
    }

    function composite(target, alpha) {
      if (dirty) render();
      if (!tg || alpha <= 0.001) return;
      gl.viewport(0, 0, pxW, pxH);
      gl.useProgram(copy.p);
      gl.bindVertexArray(quad);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, target === "back" ? tg.back.t : tg.front.t);
      gl.uniform1i(copy.u.uTex, 0);
      gl.uniform1f(copy.u.uAlpha, alpha);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    /* ---------- 會動的 CSS 圖層 ---------- */
    const fx = document.createElement("div");
    fx.className = "studio-fx";
    fx.setAttribute("aria-hidden", "true");
    fx.innerHTML =
      '<span class="fx-haze fx-haze-a"></span><span class="fx-haze fx-haze-b"></span>' +
      '<span class="fx-screen"></span><span class="fx-tally"></span>' +
      '<span class="fx-dust">' + Array.from({ length: 12 }, () => "<i></i>").join("") + "</span>";
    // 膠捲後面那兩盞燈的光：放在畫布後面，只從膠捲旁邊透出來
    const glow = document.createElement("div");
    glow.className = "studio-fx studio-back";
    glow.setAttribute("aria-hidden", "true");
    glow.innerHTML = '<span class="fx-lamp fx-lamp-l"></span><span class="fx-lamp fx-lamp-r"></span>';
    const stage = document.querySelector(".stage");
    stage.parentNode.insertBefore(glow, stage);
    stage.parentNode.insertBefore(fx, stage.nextSibling);
    if (reduceMotion) { fx.classList.add("is-still"); glow.classList.add("is-still"); }
    // 灰塵：每顆的起點、速度不同（固定的亂數，每次載入一樣）
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    fx.querySelectorAll(".fx-dust i").forEach((el) => {
      el.style.setProperty("--x", (rnd() * 100).toFixed(1) + "%");
      el.style.setProperty("--y", (20 + rnd() * 70).toFixed(1) + "%");
      el.style.setProperty("--s", (1.2 + rnd() * 1.6).toFixed(2) + "px");
      el.style.setProperty("--d", (22 + rnd() * 26).toFixed(1) + "s");
      el.style.setProperty("--delay", (-rnd() * 40).toFixed(1) + "s");
      el.style.setProperty("--o", (0.25 + rnd() * 0.45).toFixed(2));
      el.style.setProperty("--dx", ((rnd() - 0.5) * 60).toFixed(0) + "px");
    });

    function project(p) {
      const x = p[0] - cam[0], y = p[1] - cam[1], z = p[2] - cam[2];
      const cx = proj[0] * x + proj[4] * y + proj[8] * z + proj[12];
      const cy = proj[1] * x + proj[5] * y + proj[9] * z + proj[13];
      const cw = proj[3] * x + proj[7] * y + proj[11] * z + proj[15];
      return [((cx / cw) * 0.5 + 0.5) * cssW, (1 - ((cy / cw) * 0.5 + 0.5)) * cssH, cw];
    }
    function placeFx() {
      const set = (el, name, p) => {
        const s = project(p);
        el.style.setProperty("--" + name + "-x", s[0].toFixed(1) + "px");
        el.style.setProperty("--" + name + "-y", s[1].toFixed(1) + "px");
      };
      set(fx, "tally", scene.anchors.tally);
      set(fx, "screen", scene.anchors.screen);
      set(glow, "lampl", scene.anchors.lampL);
      set(glow, "lampr", scene.anchors.lampR);
      const u = (cssH / 900).toFixed(3);                    // 光暈大小跟著畫面高度
      fx.style.setProperty("--u", u); glow.style.setProperty("--u", u);
    }

    return {
      layout(p, c, w, h, pw, ph) { proj = p; cam = c; cssW = w; cssH = h; pxW = pw; pxH = ph; dirty = true; },
      colors(f, isDark) {
        const changed = Math.abs(f[0] - fog[0]) + Math.abs(f[1] - fog[1]) + Math.abs(f[2] - fog[2]) > 0.004 || isDark !== dark;
        fog = f.slice(); dark = isDark;
        if (changed) dirty = true;
      },
      drawBack(alpha) { composite("back", alpha); },
      drawFront(alpha) { composite("front", alpha); },
      hide(v) { fx.classList.toggle("is-hidden", !!v); glow.classList.toggle("is-hidden", !!v); },
    };
  };
})();
