/*
 * Papercraft drawing kit for The Runaway Egg.
 *
 * Everything is drawn in a fixed 800 x 450 space. Characters are built from simple
 * shapes in their own local space (facing right, feet at y = 0) and then placed.
 * The Painter draws each object as a paper cut-out: a white paper edge around the
 * whole shape and a soft drop shadow underneath.
 */
(function (root) {
  'use strict';
  const W = 800, H = 450, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hx = (c) => { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const toHex = (a) => '#' + a.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const lt = (c, t) => mix(c, '#ffffff', t);
  const rgba = (c, a) => { const v = hx(c); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };
  const blink = (t, seed = 0, per = 3.7) => { const ph = (((t + seed * 1.37) % per) + per) % per; return ph < 0.16 ? Math.abs(ph - 0.08) / 0.08 : 1; };

  /* ---------- shapes ---------- */
  const bbPts = (pts) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
  function blob(pts) {
    const p = new Path2D(), n = pts.length;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    p.closePath(); p._b = bbPts(pts); return p;
  }
  function ell(cx, cy, rx, ry, r = 0) { const p = new Path2D(); p.ellipse(cx, cy, rx, ry, r, 0, TAU); const m = Math.max(rx, ry); p._b = r ? [cx - m, cy - m, cx + m, cy + m] : [cx - rx, cy - ry, cx + rx, cy + ry]; return p; }
  function poly(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); p._b = bbPts(pts); return p; }
  function rr(x, y, w, h, r) { const p = new Path2D(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); p._b = [x, y, x + w, y + h]; return p; }
  function tube(pts, w0, w1) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = lerp(w0, w1, i / (n - 1)) / 2;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    return blob([...L, ...R.reverse()]);
  }
  function lp(pts) {
    const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]);
    p._b = bbPts(pts);
    if (pts.length === 2) { p.lineTo(pts[1][0], pts[1][1]); return p; }
    for (let i = 1; i < pts.length - 1; i++) {
      const last = i === pts.length - 2;
      p.quadraticCurveTo(pts[i][0], pts[i][1], last ? pts[i + 1][0] : (pts[i][0] + pts[i + 1][0]) / 2, last ? pts[i + 1][1] : (pts[i][1] + pts[i + 1][1]) / 2);
    }
    return p;
  }
  function pl(pts) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p._b = bbPts(pts); return p; }
  function M(o = {}) {
    let m = new DOMMatrix(); m = m.translate(o.x || 0, o.y || 0);
    const s = o.s ?? 1; m = m.scale(s * (o.flip ? -1 : 1), s * (o.sy ?? 1));
    if (o.r) m = m.translate(o.px || 0, o.py || 0).rotate((o.r * 180) / Math.PI).translate(-(o.px || 0), -(o.py || 0));
    return m;
  }
  const T = (x, y) => new DOMMatrix([1, 0, 0, 1, x, y]);
  function tp(path, m) {
    const q = new Path2D(); q.addPath(path, m);
    if (path._b) { const [a, b, c, d] = path._b; q._b = bbPts([[a, b], [c, b], [a, d], [c, d]].map(([x, y]) => { const r = m.transformPoint({ x, y }); return [r.x, r.y]; })); }
    return q;
  }
  const F = (p, c, k = 'fill') => ({ p, c, k });
  const E = (x, y, r, open = 1, lx = 1, ly = 0, look = 0.35) => ({ k: 'eye', x, y, r, open, lx, ly, look });
  const Ln = (p, c, w) => ({ k: 'line', p, c, w });
  function place(parts, o) {
    const m = M(o), s = Math.hypot(m.a, m.b);
    return parts.map((pt) => {
      const q = { ...pt };
      if (pt.p) q.p = tp(pt.p, m);
      if (pt.k === 'eye') {
        const A = m.transformPoint({ x: pt.x, y: pt.y }), B = m.transformPoint({ x: pt.x + pt.lx, y: pt.y + pt.ly });
        q.x = A.x; q.y = A.y; q.r = pt.r * s;
        const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1; q.lx = dx / l; q.ly = dy / l;
      }
      if (pt.w) q.w = pt.w * s;
      return q;
    });
  }
  const eyeAt = (m, x, y, r, open, lx, ly, look) => { const p = m.transformPoint({ x, y }); return E(p.x, p.y, r, open, lx, ly, look); };

  /* ---------- characters ---------- */
  function pip(t, o = {}) {
    const C = Object.assign({ body: '#7cc35a', belly: '#f4e38e', crest: '#ef7b5a', spot: '#5ea545', far: '#5c9a43', blush: '#f6a28c', line: '#3b2b3f' }, o.c || {});
    const br = Math.sin(t * 2.4) * 1.6, bob = Math.sin(t * 2.4 + 0.6) * 2.2, wag = Math.sin(t * 1.8) * 0.08;
    const open = o.open ?? blink(t, o.seed || 0);
    const hm = M({ y: bob, r: o.tilt || 0, px: 30, py: -100 }), Hd = (p) => tp(p, hm);
    const P = [
      F(ell(20, -30, 13, 22, 0.12), C.far), F(ell(28, -6, 16, 6.5), C.far),
      F(tp(blob([[-28, -92], [-72, -82], [-116, -60], [-142, -48], [-114, -44], [-66, -46], [-26, -50]]), M({ r: wag, px: -30, py: -66 })), C.body),
      F(ell(0, -68 - br * 0.4, 48, 40 + br * 0.6, -0.15), C.body),
      F(ell(16, -58, 26, 24, -0.3), C.belly),
      F(ell(-22, -94, 7, 4.5, -0.3), C.spot, 'flat'), F(ell(-2, -103, 6, 4), C.spot, 'flat'), F(ell(-40, -82, 5, 3.5, -0.4), C.spot, 'flat'),
      F(Hd(blob([[12, -90], [22, -122], [46, -134], [56, -110], [42, -78]])), C.body),
      F(Hd(blob([[34, -150], [8, -168], [-22, -182], [-31, -175], [-8, -158], [24, -136]])), C.crest),
      F(Hd(ell(48, -136, 28, 23, -0.1)), C.body),
      F(Hd(ell(74, -127, 19, 12, 0.15)), C.body),
      F(Hd(ell(60, -122, 6, 3.5)), C.blush, 'flat'),
      eyeAt(hm, 54, -142, 7.2, open, o.lx ?? 1, o.ly ?? 0, o.look ?? 0.35),
    ];
    if (o.mouth) P.push(F(Hd(ell(82, -119, 7, 4 + 4 * o.mouth, 0.2)), '#b8434a', 'flat'));
    else P.push(Ln(Hd(lp([[66, -121], [77, -114], [88, -122]])), C.line, 2.4));
    P.push(F(ell(-14, -44, 22, 28, 0.15), C.body), F(ell(-6, -6, 19, 7), C.body));
    if (!o.noArm) P.push(F(blob([[32, -82], [47, -72], [53, -60], [44, -58], [29, -72]]), C.body));
    return P;
  }
  function eggShape(t, o = {}) {
    const C = Object.assign({ shell: '#f7efd9', spot: '#c9a77a', crack: '#5a4636' }, o.c || {});
    const P = [F(ell(0, -30, 23, 30), C.shell)];
    [[-8, -40, 4, 3], [7, -22, 5, 3.5], [-10, -16, 3, 2.5], [10, -44, 3, 2], [1, -52, 2.5, 2], [-3, -28, 2.5, 2]].forEach(([x, y, a, b]) => P.push(F(ell(x, y, a, b, 0.4), C.spot, 'flat')));
    if (o.crack) {
      const z = [[-21, -36], [-13, -30], [-6, -38], [2, -31], [9, -39], [16, -32], [21, -36]];
      const n = Math.max(2, Math.round(z.length * o.crack));
      P.push(Ln(pl(z.slice(0, n)), C.crack, 2.2));
    }
    if (o.moss) P.push(F(blob([[-25, -14], [-14, -22], [0, -18], [14, -23], [25, -14], [22, 2], [-22, 2]]), '#6fae55'), F(ell(-10, -12, 3, 2), '#9bd27e', 'flat'), F(ell(9, -9, 3, 2), '#9bd27e', 'flat'));
    return P;
  }
  // bottom and top halves of a hatched shell
  function shellBottom() {
    const pts = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; pts.push([23 * Math.cos(a), -30 + 30 * Math.sin(a)]); }
    pts.push([-23, -30], [-15, -38], [-8, -30], [0, -39], [8, -30], [15, -38], [23, -30]);
    return [F(poly(pts), '#f7efd9'), F(ell(-8, -12, 4, 3, 0.4), '#c9a77a', 'flat'), F(ell(9, -18, 3, 2.5, 0.4), '#c9a77a', 'flat')];
  }
  function shellTop() {
    const pts = [[-21, 0], [-14, 8], [-7, 0], [0, 9], [7, 0], [14, 8], [21, 0]];
    for (let i = 1; i < 10; i++) { const a = (i / 10) * Math.PI; pts.push([21 * Math.cos(a), -22 * Math.sin(a)]); }
    return [F(poly(pts), '#f7efd9'), F(ell(-6, -12, 4, 3, 0.4), '#c9a77a', 'flat')];
  }
  function rex(t, o = {}) {
    const C = Object.assign({ body: '#4fa58c', belly: '#f2d39a', far: '#3f8c74', stripe: '#3a8069', tooth: '#fffaf0', line: '#2a1f22' }, o.c || {});
    const sp = o.speed ?? 1;
    const br = Math.sin(t * 1.3 * sp) * 2.4, bob = Math.sin(t * 1.3 * sp + 0.7) * 3.5, wag = Math.sin(t * 1.1 * sp) * 0.05;
    const hm = M({ y: bob + (o.lean || 0), r: o.tilt || 0, px: 90, py: -200 }), Hd = (p) => tp(p, hm);
    const P = [
      F(ell(28, -98, 30, 42, 0.1), C.far),
      F(tp(blob([[12, -72], [38, -72], [40, -14], [66, -8], [66, 0], [16, 0], [18, -24]]), T(0, o.stepFar || 0)), C.far),
      F(tp(blob([[-48, -176], [-150, -164], [-250, -128], [-292, -112], [-252, -106], [-150, -114], [-48, -120]]), M({ r: wag, px: -50, py: -145 })), C.body),
      F(ell(0, -150 - br * 0.4, 92, 62 + br * 0.5, -0.3), C.body),
      F(ell(34, -128, 52, 34, -0.55), C.belly),
      F(ell(-40, -196, 14, 6, -0.5), C.stripe, 'flat'), F(ell(-8, -207, 13, 6, -0.3), C.stripe, 'flat'), F(ell(-74, -178, 12, 5, -0.6), C.stripe, 'flat'),
      F(Hd(blob([[46, -186], [76, -236], [122, -236], [118, -178], [80, -138]])), C.body),
      F(Hd(tp(blob([[96, -224], [198, -232], [194, -212], [150, -202], [100, -206]]), M({ r: o.jaw || 0, px: 100, py: -218 }))), C.body),
    ];
    for (let x = 118; x <= 186; x += 15) P.push(F(Hd(poly([[x, -230], [x + 7, -230], [x + 3.5, -219]])), C.tooth, 'flat'));
    P.push(
      F(Hd(blob([[60, -262], [112, -282], [172, -276], [206, -256], [206, -234], [160, -226], [100, -222], [62, -234]])), C.body),
      F(Hd(blob([[112, -274], [150, -280], [155, -268], [116, -265]])), C.stripe, 'flat'),
      F(Hd(ell(196, -254, 3.5, 2.2)), C.line, 'flat'),
      F(Hd(ell(150, -240, 8, 4)), '#f39a8a', 'flat'),
      eyeAt(hm, 132, -259, 8.5, o.open ?? blink(t, 3, 4.6), o.lx ?? 1, o.ly ?? 0.3, o.look ?? 0.35),
      F(ell(-14, -100, 38, 52, 0.12), C.body),
      F(tp(blob([[-34, -70], [-4, -70], [0, -14], [30, -7], [30, 0], [-36, 0], [-30, -22]]), T(0, o.stepNear || 0)), C.body),
      F(blob([[88, -152], [110, -140], [118, -128], [108, -127], [84, -140]]), C.body),
    );
    return P;
  }
  function babyRex(t, o = {}) {
    const C = Object.assign({ body: '#7cc7a6', belly: '#f6dfae', far: '#5fae8d', stripe: '#5aa889', line: '#2a1f22' }, o.c || {});
    const bob = Math.sin(t * 3) * 1.5;
    const hm = M({ y: bob, r: o.tilt || 0, px: 18, py: -50 }), Hd = (p) => tp(p, hm);
    const P = [
      F(ell(10, -12, 8, 12), C.far), F(ell(15, -3, 10, 4), C.far),
      F(blob([[-14, -32], [-42, -26], [-58, -14], [-40, -12], [-12, -16]]), C.body),
      F(ell(0, -30, 26, 24), C.body),
      F(ell(7, -24, 15, 15), C.belly),
      F(blob([[18, -34], [29, -28], [27, -23], [16, -27]]), C.body),
    ];
    if (o.mouth) P.push(F(Hd(blob([[26, -54], [58, -52], [54, -40], [30, -44]])), C.body), F(Hd(ell(46, -52, 9, 3 + 4 * o.mouth)), '#b8434a', 'flat'));
    P.push(
      F(Hd(blob([[4, -70], [30, -82], [56, -72], [62, -58], [42, -50], [14, -48], [2, -56]])), C.body),
      F(Hd(ell(18, -76, 6, 3, -0.3)), C.stripe, 'flat'), F(Hd(ell(6, -66, 5, 3, -0.6)), C.stripe, 'flat'),
      F(Hd(ell(42, -56, 5, 3)), '#f39a8a', 'flat'),
      eyeAt(hm, 32, -66, 6.5, o.open ?? blink(t, 1.9, 3.1), o.lx ?? 1, o.ly ?? 0, o.look ?? 0.35),
    );
    if (!o.mouth) P.push(Ln(Hd(lp([[46, -53], [53, -50], [60, -55]])), C.line, 2));
    if (o.hat) P.push(...place(shellTop(), { x: hm.transformPoint({ x: 26, y: -78 }).x, y: hm.transformPoint({ x: 26, y: -78 }).y, s: 0.85, r: -0.2 }));
    P.push(F(ell(-8, -12, 10, 13), C.body), F(ell(-2, -3, 12, 4), C.body));
    return P;
  }
  function tops(t, o = {}) {
    const C = Object.assign({ body: '#6aa6d6', belly: '#bfe0f2', frill: '#f2b24b', fspot: '#e0883a', horn: '#fff2d6', far: '#4f87b8', beak: '#5b6d8a', line: '#2a2040' }, o.c || {});
    const br = Math.sin(t * 2) * 1.2, nod = Math.sin(t * 1.6) * 0.06 + (o.tilt || 0);
    const hm = M({ r: nod, px: 48, py: -58 }), Hd = (p) => tp(p, hm);
    return [
      F(ell(-30, -22, 11, 22), C.far), F(ell(34, -22, 11, 22), C.far),
      F(blob([[-48, -62], [-92, -40], [-100, -32], [-50, -34]]), C.body),
      F(ell(0, -55 - br * 0.3, 60, 38 + br * 0.4), C.body),
      F(ell(6, -34, 40, 13), C.belly),
      F(ell(-40, -20, 13, 22), C.body), F(ell(22, -20, 13, 22), C.body),
      F(Hd(ell(48, -84, 32, 38, -0.35)), C.frill),
      F(Hd(ell(36, -104, 5, 5)), C.fspot, 'flat'), F(Hd(ell(54, -112, 4.5, 4.5)), C.fspot, 'flat'), F(Hd(ell(28, -84, 4.5, 4.5)), C.fspot, 'flat'),
      F(Hd(poly([[56, -80], [86, -124], [74, -77]])), C.horn), F(Hd(poly([[66, -79], [102, -114], [82, -75]])), C.horn),
      F(Hd(ell(72, -58, 30, 25, 0.1)), C.body),
      F(Hd(poly([[94, -62], [112, -44], [90, -38]])), C.beak),
      F(Hd(poly([[88, -75], [99, -93], [98, -70]])), C.horn),
      eyeAt(hm, 76, -66, 6.2, o.open ?? blink(t, 1.4), o.lx ?? 1, o.ly ?? 0, o.look ?? 0.35),
      Ln(Hd(lp([[76, -47], [85, -43], [92, -47]])), C.line, 2.2),
    ];
  }
  function zippy(t, o = {}) {
    const C = Object.assign({ body: '#b58ad8', wing: '#9468c0', crest: '#f27d9b', beak: '#f6c55a', belly: '#e8d4f2' }, o.c || {});
    if (o.perched) {
      const b = Math.sin(t * 1.2) * 1.5; const hm = T(0, b); const Hd = (p) => tp(p, hm);
      return [
        F(ell(-6, -4, 4, 6), C.beak), F(ell(6, -4, 4, 6), C.beak),
        F(ell(-15, -26, 10, 24, 0.25), C.wing),
        F(ell(0, -28 + b * 0.3, 16, 24), C.body), F(ell(3, -22, 9, 15), C.belly),
        F(ell(14, -26, 9, 22, -0.2), C.wing),
        F(Hd(poly([[-4, -60], [-34, -74], [-1, -51]])), C.crest),
        F(Hd(ell(4, -56, 13, 11)), C.body),
        F(Hd(poly([[12, -60], [46, -53], [12, -50]])), C.beak),
        eyeAt(hm, 8, -58, 4, o.open ?? blink(t, 2.2), o.lx ?? 1, o.ly ?? 0, 0.3),
      ];
    }
    const f = Math.sin(t * 7);
    return [
      F(blob([[-6, -6], [-40, -22 - 26 * f], [-92, -14 - 40 * f], [-58, 4 - 12 * f], [-14, 10]]), C.wing),
      F(blob([[6, -6], [40, -22 - 26 * f], [92, -14 - 40 * f], [58, 4 - 12 * f], [14, 10]]), C.wing),
      F(ell(-5, 20, 3, 5), C.beak), F(ell(5, 20, 3, 5), C.beak),
      F(ell(0, 0, 13, 20), C.body), F(ell(2, 4, 7, 12), C.belly),
      F(poly([[4, -30], [-24, -46], [6, -22]]), C.crest),
      F(ell(12, -24, 13, 11), C.body),
      F(poly([[20, -28], [56, -21], [20, -18]]), C.beak),
      E(16, -27, 4, o.open ?? blink(t, 2.2), o.lx ?? 1, o.ly ?? 0),
    ];
  }
  function raptor(t, o = {}) {
    const C = Object.assign({ body: '#8d6bb8', belly: '#efd6a6', feather: '#ea6a45', far: '#6f539a', line: '#2a1f30' }, o.c || {});
    const bob = Math.sin(t * 3 + (o.seed || 0)) * 2.5;
    const hm = M({ y: bob, r: o.tilt || 0, px: 30, py: -90 }), Hd = (p) => tp(p, hm);
    const P = [
      F(ell(8, -50, 12, 18), C.far), F(tube([[10, -38], [20, -20], [12, 0]], 8, 6), C.far),
      F(tube([[-24, -74], [-70, -82], [-120, -80], [-150, -86]], 22, 4), C.body),
      F(poly([[-138, -88], [-170, -98], [-150, -80]]), C.feather),
      F(ell(0, -70, 40, 24, -0.12), C.body), F(ell(10, -60, 24, 12, -0.2), C.belly),
      F(Hd(poly([[40, -130], [22, -152], [46, -126]])), C.feather), F(Hd(poly([[46, -134], [34, -158], [52, -130]])), C.feather),
      F(Hd(tube([[26, -80], [42, -104], [50, -122]], 18, 14)), C.body),
      F(Hd(blob([[38, -130], [64, -138], [94, -128], [94, -116], [60, -112], [40, -118]])), C.body),
      eyeAt(hm, 62, -127, 5.4, o.open ?? (o.happy ? 1 : Math.min(0.62, blink(t, o.seed || 0))), o.lx ?? 1, o.ly ?? 0.2, 0.4),
      Ln(Hd(lp(o.happy ? [[64, -119], [78, -110], [92, -118]] : [[66, -117], [80, -114], [92, -120]])), C.line, 2),
      F(tube([[30, -68], [44, -58], [52, -50]], 9, 6), C.body), F(poly([[30, -64], [38, -44], [47, -58]]), C.feather),
      F(ell(-6, -52, 14, 20), C.body), F(tube([[-4, -38], [8, -20], [0, 0]], 9, 7), C.body), F(ell(6, -2, 12, 4), C.body),
    ];
    return P;
  }
  function longneck(t, o = {}) {
    const C = Object.assign({ body: '#8fa9b8', belly: '#c9d8de', far: '#6f8a9a', spot: '#7690a0', line: '#2a2a3a' }, o.c || {});
    const bob = Math.sin(t * 1.2) * 5, br = Math.sin(t * 1.2 + 1) * 2;
    const hm = T(0, bob), Hd = (p) => tp(p, hm);
    return [
      F(ell(-60, -75, 20, 75), C.far), F(ell(70, -75, 20, 75), C.far),
      F(tube([[-100, -200], [-170, -180], [-230, -140], [-262, -108]], 46, 8), C.body),
      F(ell(0, -185 - br, 125, 75 + br, -0.08), C.body),
      F(ell(14, -142, 90, 28), C.belly),
      F(ell(-30, -226, 12, 7), C.spot, 'flat'), F(ell(10, -238, 10, 6), C.spot, 'flat'), F(ell(-66, -210, 9, 6), C.spot, 'flat'),
      F(tube([[80, -222], [120, -300], [168, -350], [228, -352], [272, -314], [292, -268 + bob * 0.6]], 52, 30), C.body),
      F(Hd(ell(300, -245, 32, 22, 0.5)), C.body), F(Hd(ell(316, -226, 18, 13, 0.5)), C.body),
      F(Hd(ell(286, -270, 10, 4, 0.5)), '#e9eef0', 'flat'),
      eyeAt(hm, 298, -254, 5.5, o.open ?? blink(t, 0.7, 4.2), -0.3, 1, 0.4),
      Ln(Hd(lp([[306, -218], [316, -214], [326, -220]])), C.line, 2.2),
      F(ell(-82, -70, 22, 74), C.body), F(ell(54, -68, 22, 72), C.body),
      F(ell(-82, -6, 26, 8), C.body), F(ell(54, -6, 26, 8), C.body),
    ];
  }
  function shelly(t, o = {}) {
    const C = Object.assign({ body: '#c99a5c', plate: '#a57a45', spike: '#f3e2c0', far: '#a8804a', line: '#2a2030' }, o.c || {});
    const br = Math.sin(t * 1.5) * 1;
    return [
      F(ell(-25, -14, 10, 15), C.far), F(ell(25, -14, 10, 15), C.far),
      F(tube([[-40, -30], [-75, -28], [-100, -26]], 16, 8), C.body), F(ell(-110, -26, 14, 10), C.plate),
      F(ell(0, -36 - br, 54, 31 + br), C.body),
      F(ell(-28, -52, 7, 7), C.plate, 'flat'), F(ell(-6, -60, 7, 7), C.plate, 'flat'), F(ell(16, -56, 7, 7), C.plate, 'flat'), F(ell(-16, -40, 6, 6), C.plate, 'flat'), F(ell(8, -42, 6, 6), C.plate, 'flat'),
      F(poly([[-44, -26], [-54, -40], [-36, -34]]), C.spike), F(poly([[-14, -10], [-18, -24], [-4, -16]]), C.spike), F(poly([[22, -10], [22, -24], [34, -14]]), C.spike),
      F(ell(54, -28, 17, 13), C.body),
      E(58, -32, 4.2, o.open ?? blink(t, 2.9), o.lx ?? 1, o.ly ?? 0, 0.35),
      Ln(lp([[60, -22], [66, -20], [70, -23]]), C.line, 2),
      F(ell(-30, -12, 11, 14), C.body), F(ell(28, -12, 11, 14), C.body),
    ];
  }
  function stego(t, o = {}) {
    const C = Object.assign({ body: '#f4a259', plate: '#e5604a', belly: '#fbd9a8', far: '#d9853f', line: '#3a2020' }, o.c || {});
    const br = Math.sin(t * 2) * 1;
    const P = [
      F(ell(-22, -16, 9, 16), C.far), F(ell(24, -16, 9, 16), C.far),
      F(tube([[-38, -40], [-72, -34], [-98, -28]], 18, 5), C.body),
      F(poly([[-88, -30], [-100, -46], [-94, -29]]), C.plate), F(poly([[-95, -28], [-112, -38], [-99, -25]]), C.plate),
    ];
    for (let i = 0; i < 5; i++) {
      const x = -34 + i * 17, top = -40 - 28 * Math.sqrt(1 - (x / 46) ** 2), h = i === 2 ? 22 : i === 1 || i === 3 ? 18 : 13;
      P.push(F(poly([[x - 9, top + 8], [x, top - h], [x + 9, top + 8]]), C.plate));
    }
    P.push(
      F(ell(0, -40 - br * 0.3, 46, 28 + br * 0.3), C.body),
      F(ell(6, -24, 30, 10), C.belly),
      F(tube([[34, -40], [50, -32]], 20, 16), C.body),
      F(ell(58, -28, 15, 11, 0.15), C.body),
      E(62, -32, 4.2, o.open ?? blink(t, 0.4), o.lx ?? 1, o.ly ?? 0, 0.35),
    );
    if (o.cry) {
      P.push(Ln(lp([[64, -20], [68, -23], [72, -20]]), C.line, 1.8));
      for (let i = 0; i < 2; i++) { const ph = (t * 1.2 + i * 0.5) % 1; P.push(F(blob([[64 + ph * 4, -30 + ph * 26], [67 + ph * 4, -24 + ph * 26], [64 + ph * 4, -21 + ph * 26], [61 + ph * 4, -24 + ph * 26]]), '#8fd3f4')); }
    } else P.push(Ln(lp([[63, -22], [68, -19], [72, -23]]), C.line, 1.8));
    P.push(F(ell(-26, -12, 10, 14), C.body), F(ell(22, -12, 10, 14), C.body));
    return P;
  }
  function croc(t, o = {}) {
    const C = Object.assign({ log: '#8c7a3a', bark: '#6b5a2a' }, o.c || {});
    const P = [F(blob([[-80, -8], [-60, -18], [0, -20], [60, -18], [92, -12], [102, -2], [92, 8], [0, 14], [-70, 12], [-88, 4]]), C.log)];
    for (let x = -60; x <= 40; x += 20) P.push(F(ell(x, -19, 6, 4), C.bark));
    P.push(
      Ln(lp([[-52, -4], [-12, -7], [20, -2]]), C.bark, 2.5), Ln(lp([[-30, 5], [12, 4]]), C.bark, 2), F(ell(-40, -7, 6, 4), C.bark, 'flat'),
      F(ell(58, -22, 9, 8), C.log), F(ell(76, -20, 8, 7), C.log),
      E(58, -24, 4.6, o.open ?? 0, 1, 0, 0.3), E(76, -22, 4.2, o.open ?? 0, 1, 0, 0.3), F(ell(97, -10, 2, 1.5), C.bark, 'flat'),
    );
    if (o.smile) P.push(Ln(lp([[60, 2], [80, 6], [98, 2]]), C.bark, 2.2));
    return P;
  }

  /* ---------- scenery ---------- */
  function hill(y, amp, seed, c) { const pts = []; for (let i = 0; i <= 8; i++) pts.push([-60 + i * 115, y - amp * (0.5 + 0.5 * Math.sin(i * 1.7 + seed))]); pts.push([900, 540], [-100, 540]); return [F(blob(pts), c)]; }
  function tree(x, y, s, C) { return place([F(tube([[0, 0], [3, -50], [-2, -100]], 18, 11), C.trunk), F(ell(-38, -100, 34, 28), C.leaf2), F(ell(40, -104, 36, 28), C.leaf2), F(ell(0, -128, 52, 42), C.leaf), F(ell(-14, -142, 18, 11), C.hi, 'flat')], { x, y, s }); }
  function palm(x, y, s, C, bend = 0) {
    const P = [F(tube([[0, 0], [6 + bend, -60], [10 + bend * 2, -120]], 16, 10), C.trunk)]; const tx = 10 + bend * 2, ty = -120;
    for (let i = 0; i < 7; i++) { const a = -3.3 + i * 0.58; P.push(F(ell(tx + Math.cos(a) * 36, ty + Math.sin(a) * 28, 40, 9, a), i % 2 ? C.leaf : C.leaf2)); }
    return place(P, { x, y, s });
  }
  function fern(x, y, s, c, c2) { const P = []; for (let i = 0; i < 7; i++) { const a = -1.25 + i * (2.5 / 6); P.push(F(tp(ell(0, -34, 7, 34), M({ r: a })), i % 2 ? c : c2)); } return place(P, { x, y, s }); }
  function cloud(x, y, s, c) { return place([F(ell(-34, 8, 28, 18), c), F(ell(34, 8, 30, 18), c), F(ell(0, 0, 42, 26), c), F(ell(10, -14, 24, 18), c)], { x, y, s }); }
  function rock(x, y, s, c) { return place([F(blob([[-40, 0], [-36, -24], [-10, -40], [22, -36], [42, -14], [40, 0]]), c), F(ell(-14, -26, 9, 4, -0.4), lt(c, 0.25), 'flat')], { x, y, s }); }
  function bush(x, y, s, c, c2) { return place([F(ell(-42, -20, 40, 30), c2), F(ell(34, -24, 42, 34), c2), F(ell(-6, -44, 42, 34), c), F(ell(-18, -56, 10, 6), lt(c, 0.3), 'flat'), F(ell(26, -40, 8, 5), lt(c, 0.3), 'flat')], { x, y, s }); }
  function mush(x, y, s) { return place([F(rr(-6, -24, 12, 24, 5), '#f2e6cf'), F(blob([[-24, -20], [-17, -38], [0, -45], [17, -38], [24, -20]]), '#e0533d'), F(ell(-8, -32, 3.5, 3), '#fff6e6', 'flat'), F(ell(7, -36, 3, 2.5), '#fff6e6', 'flat'), F(ell(12, -25, 2.5, 2), '#fff6e6', 'flat')], { x, y, s }); }
  function volcano(x, y, s, c = '#9b88bd', c2 = '#6c5890') { return place([F(blob([[-170, 0], [-70, -106], [-28, -164], [28, -166], [68, -108], [180, 0]]), c), F(ell(0, -163, 27, 7), c2, 'flat'), F(blob([[-10, -159], [7, -159], [13, -124], [-1, -104], [-8, -128]]), '#f08a4b', 'flat')], { x, y, s }); }
  function heart(x, y, s, c = '#ef5370', r = 0) { return place([F(blob([[0, 10], [-14, -2], [-14, -12], [-7, -16], [0, -10], [7, -16], [14, -12], [14, -2]]), c)], { x, y, s, r }); }
  function note(x, y, s, c, r = 0) { return place([F(ell(0, 0, 9, 7, -0.4), c), F(rr(5, -34, 4, 34, 2), c), F(poly([[7, -34], [22, -24], [9, -22]]), c)], { x, y, s, r }); }
  function star(x, y, s, c, r = 0) { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, d = i % 2 ? 9 : 20; pts.push([Math.cos(a) * d, Math.sin(a) * d]); } return place([F(poly(pts), c)], { x, y, s, r }); }
  function bone(x, y, s, r, c = '#f3e6c8') { return place([F(rr(-18, -4, 36, 8, 4), c), F(ell(-19, -5, 5.5, 5.5), c), F(ell(-19, 5, 5.5, 5.5), c), F(ell(19, -5, 5.5, 5.5), c), F(ell(19, 5, 5.5, 5.5), c)], { x, y, s, r }); }
  function footprint(x, y, s, c) { return place([F(ell(0, 0, 26, 18), c, 'flat'), F(ell(-24, -30, 8, 20, -0.5), c, 'flat'), F(ell(0, -38, 8, 22), c, 'flat'), F(ell(24, -30, 8, 20, 0.5), c, 'flat')], { x, y, s, sy: 0.45 }); }
  function zzz(t, x, y, c = '#f2eaff') { const out = []; for (let i = 0; i < 3; i++) { const ph = (t * 0.35 + i / 3) % 1, px = x + ph * 34, py = y - ph * 64, z = 7 + ph * 6; out.push({ parts: [Ln(pl([[px - z, py - z], [px + z, py - z], [px - z, py + z], [px + z, py + z]]), c, 2.6)], alpha: 1 - ph }); } return out; }

  /* ---------- textures ---------- */
  let NOISE = null;
  function noiseCanvas() {
    if (NOISE) return NOISE;
    const c = document.createElement('canvas'); c.width = c.height = 180;
    const x = c.getContext('2d'), d = x.createImageData(180, 180);
    for (let i = 0; i < d.data.length; i += 4) { const v = 150 + Math.floor(hash(i * 0.37) * 105); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    x.strokeStyle = 'rgba(120,100,80,.25)'; x.lineWidth = 0.6;
    for (let i = 0; i < 60; i++) { const a = hash(i + 3) * TAU, px = hash(i + 7) * 180, py = hash(i + 11) * 180; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9); x.stroke(); }
    return (NOISE = c);
  }

  /* ---------- painter ---------- */
  class Painter {
    constructor(ctx, k, buf) { this.c = ctx; this.k = k; this.buf = buf; this.noise = null; }
    clip(r, fn) { const c = this.c; c.save(); c.beginPath(); c.rect(r[0], r[1], r[2], r[3]); c.clip(); fn(); c.restore(); }
    sky(stops) { const c = this.c, g = c.createLinearGradient(0, 0, 0, H); stops.forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(-60, -60, W + 120, H + 120); }
    glow(x, y, r, col, a = 1) {
      const c = this.c; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(a, 0, 1);
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore();
    }
    // a paper cut-out: white edge, then the coloured parts, then a soft shadow under the lot
    obj(parts, o = {}) {
      const buf = this.buf, b = buf.getContext('2d');
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, buf.width, buf.height);
      const m = this.c.getTransform(); b.setTransform(m);
      if (o.border !== false) {
        b.save(); b.fillStyle = b.strokeStyle = o.edge || '#fffdf6'; b.lineWidth = o.bw ?? 7; b.lineJoin = 'round'; b.lineCap = 'round';
        for (const pt of parts) if (pt.p && pt.k !== 'line') { b.stroke(pt.p); b.fill(pt.p); }
        b.restore();
      }
      for (const pt of parts) this.part(b, pt);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const pt of parts) {
        let bb = pt.p && pt.p._b;
        if (pt.k === 'eye') bb = [pt.x - pt.r, pt.y - pt.r, pt.x + pt.r, pt.y + pt.r];
        if (!bb) continue;
        for (const [x, y] of [[bb[0], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]], [bb[2], bb[1]]]) { const q = m.transformPoint({ x, y }); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
      }
      const pad = 30 * this.k;
      x0 = clamp(Math.floor(x0 - pad), 0, buf.width); y0 = clamp(Math.floor(y0 - pad), 0, buf.height);
      x1 = clamp(Math.ceil(x1 + pad), 0, buf.width); y1 = clamp(Math.ceil(y1 + pad), 0, buf.height);
      if (x1 <= x0 || y1 <= y0) return;
      const c = this.c; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      if (o.alpha != null) c.globalAlpha = clamp(o.alpha, 0, 1);
      if (o.shadow !== false) {
        c.shadowColor = o.sc || 'rgba(80,50,20,.34)'; c.shadowBlur = (o.blur ?? 5) * this.k;
        c.shadowOffsetX = (o.sx ?? 3) * this.k; c.shadowOffsetY = (o.sy ?? 5) * this.k;
      }
      c.drawImage(buf, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      c.restore();
    }
    part(c, pt) {
      if (pt.k === 'eye') return this.eye(c, pt);
      if (pt.k === 'line') { c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = pt.c; c.lineWidth = pt.w; c.stroke(pt.p); c.restore(); return; }
      c.fillStyle = pt.c; c.fill(pt.p);
      if (pt.k !== 'flat') { c.strokeStyle = 'rgba(70,45,30,.16)'; c.lineWidth = 1; c.stroke(pt.p); }
    }
    eye(c, e) {
      const r = e.r; c.save(); c.translate(e.x, e.y);
      const ox = e.lx * r * e.look, oy = e.ly * r * e.look;
      if (e.open < 0.25) {
        c.strokeStyle = '#2a2030'; c.lineWidth = Math.max(1.6, r * 0.38); c.lineCap = 'round';
        c.beginPath(); c.arc(0, -r * 0.4, r * 0.78, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); c.restore(); return;
      }
      c.scale(1, e.open);
      const dot = (x, y, rx, ry, col) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = col; c.fill(); };
      dot(0, 0, r * 0.82, r * 1.06, '#ffffff'); c.strokeStyle = 'rgba(40,30,40,.5)'; c.lineWidth = 1; c.stroke();
      dot(ox * 0.8, oy * 0.8, r * 0.5, r * 0.64, '#2a2030');
      dot(ox * 0.8 - r * 0.17, oy * 0.8 - r * 0.26, r * 0.17, r * 0.21, '#ffffff');
      c.restore();
    }
    many(list) { for (const it of list) this.obj(it.parts, it); }
    finish() {
      const c = this.c; if (!this.noise) { this.noise = c.createPattern(noiseCanvas(), 'repeat'); }
      c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.12; c.fillStyle = this.noise; c.fillRect(0, 0, W, H); c.restore();
    }
  }

  root.ART = {
    W, H, TAU, clamp, lerp, ease, hash, mix, lt, rgba, blink,
    blob, ell, poly, rr, tube, lp, pl, M, T, tp, F, E, Ln, place,
    pip, eggShape, shellBottom, shellTop, rex, babyRex, tops, zippy, raptor, longneck, shelly, stego, croc,
    hill, tree, palm, fern, cloud, rock, bush, mush, volcano, heart, note, star, bone, footprint, zzz,
    Painter,
  };
})(this);
