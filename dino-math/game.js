/*
 * Dino Defenders: a pop-up book math game.
 *
 * Screens: the world map (all six worlds), a world page (its levels), and play.
 * Everything is drawn on one canvas at 960 x 600 and scaled to fit.
 * Grown-up settings are an HTML panel on top (index.html).
 */
(() => {
  'use strict';
  const P = window.DinoProblems, A = window.DinoAudio, sfx = A.sfx;
  const W = 960, H = 600, TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('game'), c = cv.getContext('2d'), stage = document.getElementById('stage'), live = document.getElementById('live');
  const INK = '#4a3b52', PAGE = '#fdf8ee', RED = '#ef5350', GREEN = '#62a84a', GOLD = '#f5a623', SOFT = 'rgba(74,59,82,.6)', PAPER = '#fffaf0';
  const F = (w, s) => `${w} ${Math.round(s)}px Fredoka, "Baloo 2", system-ui, sans-serif`;
  const LEVEL_LEN = 10;

  /* ---------- small helpers ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (x) => { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  const easeIO = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const back = (x) => { x = clamp(x, 0, 1); const s = 1.7; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  function rr(x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function ell(x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); }
  function starPath(x, y, R, r, n = 5) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); }
  function shadow(blur, dy, col = 'rgba(60,30,10,.3)') { c.shadowColor = col; c.shadowBlur = blur * K; c.shadowOffsetY = dy * K; c.shadowOffsetX = dy * 0.3 * K; }
  function noShadow() { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
  function text(s, x, y, font, col, align = 'left', base = 'middle') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
  function wrap(s, maxW, font) {
    c.font = font; const words = s.split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  function announce(s) { live.textContent = ''; setTimeout(() => { live.textContent = s; }, 30); }

  /* ---------- saved progress and settings ---------- */
  const KEY = 'dino-defenders-v1';
  const DEFAULTS = { grade: 0, answer: 'type', pace: 'calm', pictures: 'miss', voice: 'off' };
  const store = { progress: {}, jar: 0, settings: Object.assign({}, DEFAULTS), rex: P.WORLDS.map(() => 0) };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      store.progress = s.progress || {}; store.jar = s.jar | 0;
      if (s.settings) Object.assign(store.settings, s.settings);
      if (Array.isArray(s.rex)) store.rex = store.rex.map((v, i) => s.rex[i] | 0);
    }
  } catch (e) { /* storage unavailable: play without saving */ }
  store.settings.grade = clamp(store.settings.grade | 0, 0, P.WORLDS.length - 1);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }
  const starsOf = (id) => (store.progress[id] || {}).stars || 0;
  const prog = (id) => store.progress[id] || (store.progress[id] = { stars: 0, plays: 0, d: 0 });
  const setting = () => store.settings;
  const grade = () => store.settings.grade;
  const stagesDone = (g) => P.WORLDS[g].levels.filter((l) => starsOf(l.id) > 0).length;
  const gradeDone = (g) => stagesDone(g) === P.WORLDS[g].levels.length;
  const gradeLabel = (g) => (P.WORLDS[g].short === 'K' ? 'Kindergarten' : 'Grade ' + P.WORLDS[g].short);

  /* ---------- canvas size ---------- */
  let K = 1;
  function fit() {
    const sw = stage.clientWidth, sh = stage.clientHeight, s = Math.min(sw / W, sh / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.max(1, Math.round(cw * dpr)); cv.height = Math.max(1, Math.round(ch * dpr)); K = cv.width / W;
  }

  /* ---------- screens and the pop-up transition ---------- */
  let now = 0;
  const S = { screen: 'map', openAt: 0, closingAt: null, next: null, walk: null, pending: null, banner: null, play: null };
  function go(fn) { if (S.closingAt !== null) return; S.closingAt = now; S.next = fn; sfx.flip(); A.hush(); }
  function rise(i = 0) {
    const open = reduce ? 1 : back((now - S.openAt - 0.04 - i * 0.06) / 0.42);
    const close = S.closingAt !== null ? 1 - ease((now - S.closingAt) / 0.36) : 1;
    return Math.max(0, Math.min(open, close));
  }
  const busy = () => S.closingAt !== null || S.walk !== null;

  /* ---------- tap targets, rebuilt every frame ---------- */
  let hits = [];
  function hit(x, y, w, h, fn) { hits.push({ x, y, w, h, fn }); }
  function hitCircle(x, y, r, fn) { hits.push({ x, y, r, fn }); }
  function findHit(px, py) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (h.r !== undefined ? Math.hypot(px - h.x, py - h.y) <= h.r : px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return h;
    }
    return null;
  }

  /* ---------- book, table, tabs ---------- */
  function offscreen() { const o = document.createElement('canvas'); o.width = W * 2; o.height = H * 2; const x = o.getContext('2d'); x.scale(2, 2); return [o, x]; }
  const TABLE = (() => {
    const [o, x] = offscreen(); x.fillStyle = '#c98b58'; x.fillRect(0, 0, W, H);
    let s = 7; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 60; i++) { const y = r() * H; x.strokeStyle = `rgba(90,50,20,${0.06 + r() * 0.1})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(320, y + (r() - 0.5) * 18, 640, y + (r() - 0.5) * 18, W, y + (r() - 0.5) * 10); x.stroke(); }
    return o;
  })();
  const THEMES = [
    { sky: '#fde9c9', hill: '#cfe7ad', hill2: '#b5d98c' },
    { sky: '#e4f3d6', hill: '#a9d58a', hill2: '#86c06a' },
    { sky: '#f2e6d2', hill: '#d4c09e', hill2: '#bfa47c' },
    { sky: '#e2e9f6', hill: '#bac7e0', hill2: '#9fb0d3' },
    { sky: '#dcf0f3', hill: '#a6d6dc', hill2: '#86c4cc' },
    { sky: '#fbe1d5', hill: '#e2b49c', hill2: '#cf9577' },
  ];
  function pagesPath(x) {
    x.beginPath();
    x.moveTo(24, 52); x.quadraticCurveTo(252, 32, 480, 56); x.lineTo(480, 584); x.quadraticCurveTo(252, 568, 24, 584); x.closePath();
    x.moveTo(480, 56); x.quadraticCurveTo(708, 32, 936, 52); x.lineTo(936, 584); x.quadraticCurveTo(708, 568, 480, 584); x.closePath();
  }
  const pageCache = {};
  function pages(theme) {
    const key = theme === null ? 'plain' : theme;
    if (pageCache[key]) return pageCache[key];
    const [o, x] = offscreen();
    x.save(); x.shadowColor = 'rgba(60,30,10,.4)'; x.shadowBlur = 20; x.shadowOffsetY = 8; pagesPath(x); x.fillStyle = PAGE; x.fill(); x.restore();
    for (let j = 1; j < 4; j++) { x.strokeStyle = 'rgba(120,80,40,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(28, 584 + j * 2.4); x.quadraticCurveTo(252, 568 + j * 2.4, 478, 584 + j * 2.4); x.moveTo(482, 584 + j * 2.4); x.quadraticCurveTo(708, 568 + j * 2.4, 932, 584 + j * 2.4); x.stroke(); }
    x.save(); pagesPath(x); x.clip();
    if (theme !== null) {
      const t = THEMES[theme];
      let g = x.createLinearGradient(0, 40, 0, 260); g.addColorStop(0, t.sky); g.addColorStop(1, 'rgba(253,248,238,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 260);
      x.globalAlpha = 0.55; x.fillStyle = t.hill; x.beginPath(); x.moveTo(0, H); x.lineTo(0, 528); for (let X = 0; X <= W; X += 120) x.quadraticCurveTo(X + 60, 500 + (X / 120 % 2) * 14, X + 120, 528); x.lineTo(W, H); x.fill();
      x.globalAlpha = 0.75; x.fillStyle = t.hill2; x.beginPath(); x.moveTo(0, H); x.lineTo(0, 556); for (let X = -60; X <= W; X += 160) x.quadraticCurveTo(X + 80, 536, X + 160, 556); x.lineTo(W, H); x.fill();
      x.globalAlpha = 1;
    }
    let s = 3; const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 1800; i++) { x.fillStyle = r() < 0.5 ? 'rgba(160,120,70,.06)' : 'rgba(255,255,255,.5)'; x.fillRect(r() * W, r() * H, 1 + r(), 1 + r()); }
    const g = x.createLinearGradient(420, 0, 540, 0); g.addColorStop(0, 'rgba(120,80,40,0)'); g.addColorStop(0.5, 'rgba(120,80,40,.24)'); g.addColorStop(1, 'rgba(120,80,40,0)'); x.fillStyle = g; x.fillRect(420, 30, 120, 560);
    x.restore();
    return (pageCache[key] = o);
  }
  function tab(x, w, label, fill, fn, icon) {
    rr(x, 12, w, 48, 9); c.fillStyle = fill; c.fill();
    if (icon) icon(x + 18, 32);
    text(label, x + (icon ? 32 : w / 2), 32, F(600, 15), '#fff', icon ? 'left' : 'center');
    hit(x, 12, w, 34, fn);
  }
  function speakerIcon(x, y, on, col = '#fff') {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 7, y - 3); c.lineTo(x - 3, y - 3); c.lineTo(x + 2, y - 8); c.lineTo(x + 2, y + 8); c.lineTo(x - 3, y + 3); c.lineTo(x - 7, y + 3); c.closePath(); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round';
    if (on) { c.beginPath(); c.arc(x + 3, y, 5, -0.8, 0.8); c.stroke(); c.beginPath(); c.arc(x + 3, y, 9, -0.8, 0.8); c.stroke(); }
    else { c.beginPath(); c.moveTo(x + 6, y - 4); c.lineTo(x + 12, y + 4); c.moveTo(x + 12, y - 4); c.lineTo(x + 6, y + 4); c.stroke(); }
  }
  function drawBook(theme, tabs) {
    c.drawImage(TABLE, 0, 0, W, H);
    for (const t of tabs) tab(...t);
    c.drawImage(pages(theme), 0, 0, W, H);
  }
  function soundTab(x) { return [x, 64, '', '#8a7aa0', () => { A.setMuted(!A.muted); if (!A.muted) sfx.tap(); }, (ix, iy) => speakerIcon(ix + 12, iy - 6, !A.muted)]; }
  function grownTab() { return [826, 112, 'Grown-ups', RED, () => openSettings()]; }
  function gradeTab() { return [680, 128, gradeLabel(grade()), GREEN, () => openSettings()]; }

  /* ---------- pop-ups ---------- */
  // Something standing up off the page: its shadow falls back on the page, and it unfolds as rise goes 0 -> 1.
  function popup(x, y, r, fn, s = 1) {
    if (r <= 0.01) return;
    c.save(); c.translate(x, y); c.transform(1, 0, -0.55 * r, 0.3 * r, 0, 0); c.scale(s, s); fn('rgba(70,45,25,.16)'); c.restore();
    c.save(); c.translate(x, y); c.scale(s, s * r); fn(null); c.restore();
    c.strokeStyle = 'rgba(74,59,82,.3)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 24 * s, y + 0.5); c.lineTo(x + 24 * s, y + 0.5); c.stroke();
  }
  // A card that folds up from its bottom edge.
  function popCard(x, y, w, h, r, fill, inner, radius = 14) {
    if (r <= 0.01) return false;
    c.save(); c.translate(0, y + h); c.scale(1, r); c.translate(0, -(y + h));
    shadow(10, 5); rr(x, y, w, h, radius); c.fillStyle = fill; c.fill(); noShadow();
    c.strokeStyle = 'rgba(74,59,82,.12)'; c.lineWidth = 1; c.stroke();
    if (inner) inner();
    c.restore(); return r > 0.6;
  }
  function button(x, y, w, h, label, fill, fn, size = 20, fg = '#fff') {
    shadow(0, 4, 'rgba(60,30,10,.28)'); rr(x, y, w, h, h / 2); c.fillStyle = fill; c.fill(); noShadow();
    text(label, x + w / 2, y + h / 2 + 1, F(700, size), fg, 'center'); hit(x, y, w, h, fn);
  }

  /* ---------- Rex, the paper T-rex ---------- */
  function rexParts(w) {
    return [
      ['spike', () => { c.beginPath(); c.moveTo(-25, -45); c.lineTo(-27, -60); c.lineTo(-13, -55); c.closePath(); c.moveTo(-11, -56); c.lineTo(-7, -70); c.lineTo(1, -58); c.closePath(); c.moveTo(9, -73); c.lineTo(5, -85); c.lineTo(17, -79); c.closePath(); }],
      ['body', () => { c.beginPath(); c.moveTo(-18, -46); c.quadraticCurveTo(-44, -38, -68, -16 + w * 7); c.quadraticCurveTo(-42, -18, -16, -16); c.closePath(); }],
      ['body', () => rr(-20, -22, 17, 22, 7)], ['body', () => ell(0, -34, 28, 24)], ['body', () => ell(15, -50, 13, 15)],
      ['body', () => ell(26, -64, 21, 17, -0.08)], ['body', () => ell(42, -58, 16, 12)], ['body', () => rr(4, -22, 16, 22, 7)],
      ['belly', () => ell(9, -30, 14, 15)], ['arm', () => ell(26, -36, 8, 4.5, 0.6)],
    ];
  }
  const REX = { body: '#b07cd6', belly: '#ffd6e8', spike: '#ff8fb1', arm: '#9561bf' };
  function drawRex(x, y, s, o = {}) {
    c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [role, build] of rexParts(o.w || 0)) { build(); c.fillStyle = o.sil || REX[role]; c.fill(); }
    if (!o.sil) {
      c.fillStyle = 'rgba(149,97,191,.5)'; for (const q of [[-13, -42, 3.4], [-3, -49, 2.8], [-21, -33, 2.8]]) { ell(q[0], q[1], q[2], q[2]); c.fill(); }
      ell(40, -58, 4.5, 3); c.fillStyle = 'rgba(255,100,150,.45)'; c.fill();
      if (o.blink) { c.strokeStyle = INK; c.lineWidth = 2.6; c.beginPath(); c.moveTo(24, -68); c.quadraticCurveTo(29, -65, 34, -68); c.stroke(); }
      else { ell(29, -68, 6, 6.4); c.fillStyle = '#fff'; c.fill(); ell(o.look ? 32 : 31, o.look ? -66 : -67.5, 3.1, 3.4); c.fillStyle = INK; c.fill(); ell(32.2, -69.4, 1.1, 1.1); c.fillStyle = '#fff'; c.fill(); }
      ell(52, -62, 1.6, 1.4); c.fillStyle = INK; c.fill();
      c.strokeStyle = INK; c.lineWidth = 2.3;
      if (o.roar) { ell(50, -52, 8, 5.6); c.fillStyle = '#5a1530'; c.fill(); c.stroke(); ell(50, -50, 4, 2); c.fillStyle = '#ff7aa2'; c.fill(); }
      else if (o.sad) { c.beginPath(); c.moveTo(39, -50); c.quadraticCurveTo(47, -54, 55, -51); c.stroke(); }
      else { c.beginPath(); c.moveTo(37, -51); c.quadraticCurveTo(47, -46, 56, -53); c.stroke(); }
    }
    c.restore();
  }

  /* ---------- landmarks for the map stops, drawn at 1x around (0,0) ---------- */
  const f = (sil, col) => { c.fillStyle = sil || col; c.fill(); };
  const LANDMARK = [
    (s) => { ell(0, -8, 22, 9); f(s, '#a86b3c'); for (const [dx, col] of [[-10, '#fff6e0'], [0, '#d9f0ff'], [10, '#ffe1ec']]) { ell(dx, -17, 7, 9); f(s, col); } ell(0, -5, 22, 5); f(s, '#b97a46'); },
    (s) => { for (const [dx, h, col] of [[-12, 40, '#3f8f3f'], [10, 48, '#56a84a']]) { c.beginPath(); c.rect(dx - 2, -h, 4, h); f(s, '#7a5232'); for (let j = 0; j < 5; j++) { const yy = -h + 6 + j * 7, w = 12 - j * 1.2; ell(dx - w * 0.7, yy, w * 0.7, 3, -0.4); f(s, col); ell(dx + w * 0.7, yy, w * 0.7, 3, 0.4); f(s, col); } } },
    (s) => { c.beginPath(); c.rect(12, -30, 2, 30); f(s, '#7a5232'); rr(2, -40, 26, 13, 3); f(s, '#ffca28'); c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-24, -10, -14, -12); c.quadraticCurveTo(-6, -12, -4, -4); c.lineTo(-4, 0); c.closePath(); f(s, '#efe2c8'); },
    (s) => { c.beginPath(); c.moveTo(-28, 0); c.lineTo(-8, -46); c.lineTo(10, 0); c.closePath(); f(s, '#8e9fc2'); c.beginPath(); c.moveTo(-4, 0); c.lineTo(14, -36); c.lineTo(30, 0); c.closePath(); f(s, '#a7b5d6'); c.beginPath(); c.moveTo(-14, -32); c.lineTo(-8, -46); c.lineTo(-2, -32); c.lineTo(-6, -35); c.lineTo(-9, -30); c.closePath(); f(s, '#ffffff'); },
    (s) => { c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(-4, -30, 10, -42); c.lineTo(16, -38); c.quadraticCurveTo(6, -26, 8, 0); c.closePath(); f(s, '#5fa8a0'); ell(16, -42, 8, 5); f(s, '#5fa8a0'); if (!s) { ell(18, -43, 1.4, 1.4); c.fillStyle = INK; c.fill(); } },
    (s) => { c.beginPath(); c.moveTo(-28, 0); c.lineTo(-7, -40); c.lineTo(7, -40); c.lineTo(28, 0); c.closePath(); f(s, '#a57a5a'); c.beginPath(); c.moveTo(-7, -40); c.lineTo(7, -40); c.lineTo(4, -32); c.lineTo(0, -36); c.lineTo(-4, -30); c.closePath(); f(s, '#ff7043'); },
    (s) => { c.beginPath(); c.moveTo(-3, 0); c.quadraticCurveTo(-7, -26, 1, -50); c.lineTo(6, -50); c.quadraticCurveTo(0, -26, 4, 0); c.closePath(); f(s, '#8a5a36'); for (const a of [-2.7, -2.1, -1.4, -0.7, -0.1]) { c.save(); c.translate(4, -50); c.rotate(a); ell(15, 0, 16, 5); f(s, '#3f9b5a'); c.restore(); } },
    (s) => { c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-28, -26, -6, -30); c.quadraticCurveTo(20, -34, 26, -10); c.quadraticCurveTo(28, 0, 24, 0); c.closePath(); f(s, '#b9b0a6'); if (!s) { ell(-8, -20, 8, 4, -0.3); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(); for (const [dx, col] of [[-19, '#ff8fb1'], [19, '#ffd54f']]) { ell(dx, -3, 4, 4); c.fillStyle = col; c.fill(); } } },
  ];
  // flat things printed on the page under some landmarks
  function landmarkFloor(type, x, y, s) {
    if (type === 2) { ell(x - 4 * s, y + 2 * s, 26 * s, 9 * s); c.fillStyle = '#3b2f45'; c.fill(); for (let j = 0; j < 3; j++) { const a = (now * 0.7 + j / 3) % 1; c.globalAlpha = 1 - a; ell(x + (-14 + j * 10) * s, y - a * 6 * s, (2 + a * 3) * s, (2 + a * 3) * s); c.strokeStyle = '#6a5a80'; c.lineWidth = 1.2; c.stroke(); } c.globalAlpha = 1; }
    if (type === 4) { ell(x + 2 * s, y + 3 * s, 32 * s, 10 * s); c.fillStyle = '#8bc6e0'; c.fill(); }
    if (type === 5) { for (let j = 0; j < 3; j++) { const a = (now * 0.35 + j / 3) % 1; c.globalAlpha = (1 - a) * 0.8; ell(x + (2 + a * 10) * s, y - (44 + a * 30) * s, (4 + a * 6) * s, (4 + a * 6) * s); c.fillStyle = '#d9d3dc'; c.fill(); } c.globalAlpha = 1; }
  }
  const stageLandmark = (g, i) => (g * 3 + i) % LANDMARK.length;

  /* ================= MAP: the stages of the chosen grade ================= */
  function stopsFor(g) { const n = P.WORLDS[g].levels.length; return Array.from({ length: n }, (_, i) => [Math.round(100 + 770 * i / (n - 1)), i % 2 ? 300 : 478]); }
  function segPoint(pts, j, u) { // a smooth (Catmull-Rom) curve between pts[j] and pts[j+1]
    const p0 = pts[Math.max(0, j - 1)], p1 = pts[j], p2 = pts[j + 1], p3 = pts[Math.min(pts.length - 1, j + 2)], v = 1 - u;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    const b = (a, q1, q2, d) => v * v * v * a + 3 * v * v * u * q1 + 3 * v * u * u * q2 + u * u * u * d;
    return [b(p1[0], c1[0], c2[0], p2[0]), b(p1[1], c1[1], c2[1], p2[1])];
  }
  function startWalk(to, done) {
    const g = grade(), from = clamp(store.rex[g], 0, P.WORLDS[g].levels.length - 1);
    if (from === to) { done(); return; }
    S.walk = { g, from, to, start: now, per: 0.5, done }; sfx.pop();
  }
  function walkPos(pts) {
    const w = S.walk; if (!w) return pts[clamp(store.rex[grade()], 0, pts.length - 1)];
    const n = Math.abs(w.to - w.from), t = (now - w.start) / w.per;
    if (t >= n) { const d = w.done; S.walk = null; store.rex[w.g] = w.to; save(); d(); return pts[w.to]; }
    const k = Math.floor(t), u = easeIO(t - k), dir = Math.sign(w.to - w.from), j = dir > 0 ? w.from + k : w.from - k - 1;
    const p = segPoint(pts, j, dir > 0 ? u : 1 - u);
    return [p[0], p[1] - Math.abs(Math.sin(u * Math.PI * 3)) * 10];
  }
  function playLevel(g, li) { if (S.closingAt !== null) return; go(() => { S.screen = 'play'; startLevel(g, li); }); }
  function tapStage(i) { if (busy()) return; sfx.tap(); startWalk(i, () => playLevel(grade(), i)); }
  function drawMap() {
    const g = grade(), w = P.WORLDS[g], L = w.levels, pts = stopsFor(g), here = clamp(store.rex[g], 0, L.length - 1);
    drawBook(g, [[40, 92, 'Shelf', '#8a7aa0', () => { location.href = '../'; }], soundTab(600), gradeTab(), grownTab()]);
    const r0 = rise(0);
    text(w.name, 56, 100, F(700, 38), INK);
    text(`${gradeLabel(g)} · ${stagesDone(g)} of ${L.length} stages explored`, 58, 134, F(500, 19), SOFT);
    drawJar(878, 118, rise(1));
    // the path: where Rex has walked is red, the rest is pencil grey
    c.lineCap = 'round'; c.lineWidth = 6; c.setLineDash([3, 14]);
    for (let j = 0; j < pts.length - 1; j++) {
      c.strokeStyle = j < here ? RED : 'rgba(74,59,82,.28)';
      c.beginPath(); c.moveTo(pts[j][0], pts[j][1]); for (let s = 1; s <= 20; s++) { const q = segPoint(pts, j, s / 20); c.lineTo(q[0], q[1]); } c.stroke();
    }
    c.setLineDash([]);
    L.forEach((l, i) => {
      const [x, y] = pts[i], r = rise(i * 0.5 + 1), type = stageLandmark(g, i);
      if (r > 0.02) landmarkFloor(type, x, y, 1.7);
      popup(x, y, r, (sil) => LANDMARK[type](sil), 1.7);
    });
    L.forEach((l, i) => {
      const [x, y] = pts[i], a = Math.min(clamp((now - S.openAt - 0.45 - i * 0.06) / 0.3, 0, 1), r0);
      if (a <= 0) return;
      c.save(); c.globalAlpha = a;
      c.font = F(600, 15); const lw = Math.max(c.measureText(l.name).width, 96) + 26, lx = clamp(x - lw / 2, 32, 928 - lw), ly = y + 12;
      shadow(4, 2, 'rgba(60,30,10,.18)'); rr(lx, ly, lw, 50, 10); c.fillStyle = i === here && !S.walk ? '#ffe08a' : '#fff'; c.fill(); noShadow();
      text(l.name, lx + lw / 2, ly + 16, F(600, 15), INK, 'center');
      for (let q = 0; q < 3; q++) { starPath(lx + lw / 2 - 20 + q * 20, ly + 36, 8, 3.6); c.fillStyle = q < starsOf(l.id) ? GOLD : 'rgba(74,59,82,.16)'; c.fill(); }
      c.restore();
      hit(lx, ly, lw, 50, () => tapStage(i));
      hit(x - 52, y - 90, 104, 96, () => tapStage(i));
    });
    // Rex
    const [rx, ry] = walkPos(pts);
    if (r0 > 0.05) { ell(rx, ry - 2, 20, 5); c.fillStyle = 'rgba(70,45,25,.2)'; c.fill(); drawRex(rx - 4, ry - 6, 0.62 * r0, { w: Math.sin(now * 5), blink: (now % 3.4) < 0.12 }); }
    // "Next stage" from the end of a level: walk on, then play
    if (S.pending && !S.walk && S.closingAt === null && now - S.openAt > 0.7) { const pd = S.pending; S.pending = null; startWalk(pd.to, () => { if (pd.play) playLevel(g, pd.to); }); }
    // the whole grade explored
    if (S.banner) {
      if (S.banner.t === null) S.banner.t = now;
      const t = now - S.banner.t, k = Math.min(back(t / 0.4), t > 5 ? 1 - ease((t - 5) / 0.4) : 1);
      if (k > 0.01) popCard(262, 156, 436, 112, k, '#ffe08a', () => {
        text(S.banner.title, 480, 192, F(700, 27), INK, 'center');
        text(S.banner.sub, 480, 232, F(500, 18), INK, 'center');
      });
      if (t > 5.4) S.banner = null;
    }
  }
  function drawJar(x, y, r) {
    if (r <= 0.01) return;
    c.save(); c.translate(x, y); c.scale(r, r);
    shadow(4, 2, 'rgba(60,30,10,.2)');
    c.beginPath(); c.moveTo(-20, -34); c.lineTo(20, -34); c.lineTo(18, -26); c.quadraticCurveTo(30, -22, 28, -6); c.lineTo(26, 22); c.quadraticCurveTo(26, 30, 16, 30); c.lineTo(-16, 30); c.quadraticCurveTo(-26, 30, -26, 22); c.lineTo(-28, -6); c.quadraticCurveTo(-30, -22, -18, -26); c.closePath();
    c.fillStyle = 'rgba(220,240,250,.85)'; c.fill(); noShadow(); c.strokeStyle = 'rgba(74,59,82,.35)'; c.lineWidth = 2; c.stroke();
    rr(-22, -40, 44, 9, 3); c.fillStyle = '#c98b58'; c.fill();
    const shown = Math.min(12, Math.ceil(store.jar / 5));
    for (let i = 0; i < shown; i++) { starPath(-14 + (i % 3) * 14, 22 - Math.floor(i / 3) * 12, 6.5, 3); c.fillStyle = GOLD; c.fill(); }
    c.restore();
    text(String(store.jar), x, y + 46 * r, F(700, 17), INK, 'center');
  }

  /* ================= PLAY ================= */
  // Sneaky pterodactyls want the eggs in Rex's nest. Each one carries an answer.
  // Pick (or type) the right answer and Rex roars it away.
  const OOPS = ['Oops! Give it another try!', 'Oops! Try again, you can do it!', 'So close! Give it another try!'];
  const PRAISE = ['Shoo! Away it flies!', 'Yes! Great job!', 'You got it!', 'Roar-some!', 'Super! The eggs are safe!'];
  const voiceOn = () => setting().voice === 'on';
  function startLevel(g, li) {
    const L = P.WORLDS[g].levels[li];
    S.play = { g, li, L, idx: 0, d: prog(L.id).d || 0, streak: 0, firsts: 0, recent: [], phase: 'ask', prob: null, end: null, visAt: null };
    newProblem();
    S.play.bubble = { text: S.play.mode === 'type' ? 'Pterodactyls want our eggs! Type the answer and Rex will roar them away.' : 'Pterodactyls want our eggs! Tap the one with the right answer and Rex will roar it away.', kind: 'intro', t: now + 0.5 };
  }
  const modeFor = (pl) => (setting().answer === 'type' && !pl.prob.pickOnly ? 'type' : 'pick');
  const timedOn = () => setting().pace === 'timed';
  function newProblem() {
    const pl = S.play; let p, n = 0;
    do { p = pl.L.gen(pl.d, Math.random); n++; } while (n < 15 && pl.recent.includes(JSON.stringify(p.q)));
    pl.recent.push(JSON.stringify(p.q)); if (pl.recent.length > 6) pl.recent.shift();
    Object.assign(pl, { prob: p, phase: 'ask', misses: 0, helped: false, entry: ['', ''], field: 0, off: new Set(), wob: {}, away: {}, shake: -9, t0: now, tRight: null, bubble: null, focus: 0, swoop: 0, swoopBack: null, visAt: null, target: 0, starred: false });
    pl.mode = modeFor(pl);
    if (voiceOn()) setTimeout(() => { if (S.play === pl && pl.prob === p) A.say(p.say); }, 350);
    announce(p.say);
  }
  function feedback(textS, kind) {
    const pl = S.play; pl.bubble = { text: textS, kind, t: now };
    if (voiceOn()) A.say(textS);
    announce(textS);
  }
  function right(idx) {
    const pl = S.play; pl.phase = 'right'; pl.tRight = now; pl.target = idx;
    const first = pl.misses === 0;
    if (first) { pl.firsts++; pl.streak++; if (pl.streak >= 5) { pl.d = Math.min(2, pl.d + 1); pl.streak = 0; } } else pl.streak = 0;
    store.jar++; save(); sfx.roar(); setTimeout(() => sfx.yay(), 250);
    feedback(pickOne(PRAISE), 'yay');
  }
  function wrong(idx) {
    const pl = S.play; pl.misses++; sfx.oops();
    if (idx !== null) { pl.off.add(idx); pl.wob[idx] = now; pl.away[idx] = now + 0.5; } else { pl.shake = now; pl.entry = ['', '']; pl.field = 0; }
    if (pl.misses >= 2) {
      if (!pl.helped) pl.d = Math.max(0, pl.d - 1);
      pl.helped = true; pl.streak = 0;
      pl.prob.choices.forEach((ch, j) => { if (!ch.ok && !pl.off.has(j)) { pl.off.add(j); pl.away[j] = now + 0.2; } });
      feedback(/^Let's/.test(pl.prob.hint) ? pl.prob.hint : "Let's do it together. " + pl.prob.hint, 'help');
    } else feedback(pickOne(OOPS), 'oops');
    const ok = pl.prob.choices.findIndex((ch, j) => !pl.off.has(j)); if (ok >= 0) pl.focus = ok;
  }
  function choose(i) {
    const pl = S.play; if (!pl || pl.phase !== 'ask' || pl.off.has(i) || busy()) return;
    if (pl.prob.choices[i].ok) right(i); else wrong(i);
  }
  function submitTyped() {
    const pl = S.play; if (!pl || pl.phase !== 'ask') return;
    const need = P.fieldCount(pl.prob);
    if (!pl.entry[0] || (need === 2 && !pl.entry[1])) { pl.shake = now; if (need === 2 && pl.entry[0]) pl.field = 1; sfx.tap(); return; }
    if (P.typedOk(pl.prob, pl.entry)) right(pl.prob.choices.findIndex((ch) => ch.ok)); else wrong(null);
  }
  function typeKey(k) {
    const pl = S.play; if (!pl || pl.phase !== 'ask' || pl.mode !== 'type') return;
    const two = P.fieldCount(pl.prob) === 2;
    if (k === 'go') { submitTyped(); return; }
    sfx.key();
    if (k === 'next') { if (two) pl.field = 1 - pl.field; return; }
    if (k === 'del') { if (pl.entry[pl.field]) pl.entry[pl.field] = pl.entry[pl.field].slice(0, -1); else if (pl.field === 1) pl.field = 0; return; }
    let v = pl.entry[pl.field];
    if (k === '.' && (!pl.prob.decimal || v.includes('.'))) return;
    if (v.length >= 8) return;
    if (v === '0' && k !== '.') v = '';
    pl.entry[pl.field] = v + k;
  }
  function finishLevel() {
    const pl = S.play, pr = prog(pl.L.id), before = pr.stars, wasDone = gradeDone(pl.g);
    const stars = 1 + (pl.firsts >= 7 ? 1 : 0) + (pl.firsts >= 9 ? 1 : 0);
    pr.stars = Math.max(pr.stars, stars); pr.plays++; pr.d = pl.d; store.rex[pl.g] = pl.li; save();
    const gradeNow = !wasDone && gradeDone(pl.g);
    if (gradeNow) S.banner = { title: `${P.WORLDS[pl.g].name} is all explored!`, sub: pl.g < P.WORLDS.length - 1 ? 'A grown-up can pick the next grade in Grown-ups.' : 'Every stage of every grade. Hooray!', t: null };
    pl.phase = 'done'; pl.end = { stars, newBest: stars > before, gradeNow, t: now };
    sfx.fanfare(); A.hush();
    if (voiceOn()) setTimeout(() => A.say(gradeNow ? `You explored all of ${P.WORLDS[pl.g].name}!` : 'Stage done! Hooray!'), 300);
    announce(`Stage done. ${stars} star${stars > 1 ? 's' : ''}.`);
  }
  function toMap(pending) { go(() => { S.screen = 'map'; S.pending = pending || null; }); }

  // the answer slot inside the problem card
  function slotFor(pl) {
    const p = pl.prob, solved = pl.phase !== 'ask', okLabel = p.choices.find((ch) => ch.ok).label;
    const typing = pl.mode === 'type';
    const ghost = (i) => (pl.helped && typing ? P.answerFields(p)[i] : '');
    const blink = Math.floor(now * 2.2) % 2 === 0;
    const shakeX = () => (now - pl.shake < 0.45 ? Math.sin((now - pl.shake) * 50) * 6 * (1 - (now - pl.shake) / 0.45) : 0);
    function box(x, y, w, h, s, i, size) {
      const active = typing && !solved && pl.field === i && P.fieldCount(p) === 2;
      rr(x, y, w, h, Math.min(12, h / 4)); c.fillStyle = solved ? '#e3f4da' : '#fff'; c.fill();
      c.strokeStyle = solved ? GREEN : active ? GOLD : 'rgba(74,59,82,.35)'; c.lineWidth = active ? 3 : 2; c.setLineDash(typing || solved ? [] : [6, 5]); c.stroke(); c.setLineDash([]);
      if (!s && solved && typing) s = P.answerFields(p)[i];
      if (s) text(s, x + w / 2, y + h / 2 + 2, F(700, size), solved ? '#2e7d32' : INK, 'center');
      else if (ghost(i)) text(ghost(i), x + w / 2, y + h / 2 + 2, F(700, size), 'rgba(74,59,82,.28)', 'center');
      else if (!typing && !solved) text('?', x + w / 2, y + h / 2 + 2, F(700, size), RED, 'center');
      if (typing && !solved && (pl.field === i || P.fieldCount(p) === 1) && blink) { c.font = F(700, size); const tw = s ? c.measureText(s).width : 0; c.fillStyle = INK; c.fillRect(x + w / 2 + tw / 2 + 2, y + h * 0.2, 3, h * 0.6); }
      if (typing && !solved && P.fieldCount(p) === 2) hit(x, y, w, h, () => { pl.field = i; });
    }
    const tw = (s, size) => { c.font = F(700, size); return c.measureText(s).width; };
    return {
      w(size) {
        if (!typing || p.pickOnly) return Math.max(size * 1.1, (solved ? measureTokens(okLabel, size * 0.9) : 0) + size * 0.5);
        if (p.ans.k === 'frac') { const fs = size * 0.62; return Math.max(fs * 1.6, Math.max(tw(pl.entry[0] || ghost(0), fs), tw(pl.entry[1] || ghost(1), fs)) + fs * 0.8); }
        if (p.ans.k === 'rem') { const fs = size * 0.8; return Math.max(fs * 1.3, tw(pl.entry[0] || ghost(0), fs) + fs * 0.6) + tw(' R ', fs) + Math.max(fs * 1.1, tw(pl.entry[1] || ghost(1), fs) + fs * 0.6); }
        return Math.max(size * 1.5, tw(pl.entry[0] || ghost(0), size) + size * 0.6);
      },
      fw(size) { const fs = size * 0.6; return Math.max(fs * 1.7, tw(pl.entry[0] || ghost(0), fs) + fs * 0.7); },
      draw(x, y, size, w) {
        const sx = shakeX(); x += sx;
        if (!typing || p.pickOnly) {
          const h = size * 1.18; box(x + 2, y - h / 2, w - 4, h, '', 0, size);
          if (solved) { const ls = size * 0.9; drawTokens(okLabel, x + w / 2 - measureTokens(okLabel, ls) / 2, y, ls, '#2e7d32'); }
          return;
        }
        if (p.ans.k === 'frac') {
          const fs = size * 0.62, bh = fs * 1.15;
          box(x + 2, y - bh - 4, w - 4, bh, pl.entry[0], 0, fs); box(x + 2, y + 4, w - 4, bh, pl.entry[1], 1, fs);
          c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 6, y); c.lineTo(x + w - 6, y); c.stroke(); return;
        }
        if (p.ans.k === 'rem') {
          const fs = size * 0.8, h = fs * 1.25, w0 = Math.max(fs * 1.3, tw(pl.entry[0] || ghost(0), fs) + fs * 0.6), wr = tw(' R ', fs), w1 = w - w0 - wr;
          box(x, y - h / 2, w0, h, pl.entry[0], 0, fs); text('R', x + w0 + wr / 2, y + 2, F(700, fs), INK, 'center'); box(x + w0 + wr, y - h / 2, w1, h, pl.entry[1], 1, fs); return;
        }
        const h = size * 1.2; box(x + 2, y - h / 2, w - 4, h, pl.entry[0], 0, size);
      },
      drawFrac(cx, cy, fs) { const w = this.fw(fs / 0.6), h = fs * 1.2; box(cx - w / 2 + shakeX(), cy - h / 2, w, h, pl.entry[0], 0, fs); },
    };
  }

  /* ---------- tokens: numbers, symbols, stacked fractions and the answer slot ---------- */
  const tokText = (t) => (typeof t === 'number' ? P.fmt(t) : t);
  function tokW(t, size, slot) {
    if (t === '?') return slot ? slot.w(size) : size * 0.8;
    if (t && typeof t === 'object') { c.font = F(700, size * 0.6); const nw = t.n === '?' ? (slot ? slot.fw(size) : size * 0.6) : c.measureText(String(t.n)).width; return Math.max(nw, c.measureText(String(t.d)).width) + size * 0.4; }
    c.font = F(700, size); return c.measureText(tokText(t)).width;
  }
  function measureTokens(tokens, size, slot) { let w = 0; for (const t of tokens) w += tokW(t, size, slot); return w; }
  function drawTokens(tokens, x, y, size, col, slot) {
    let cx = x;
    for (const t of tokens) {
      const w = tokW(t, size, slot);
      if (t === '?') { if (slot) slot.draw(cx, y, size, w); else text('?', cx + w / 2, y, F(700, size), col, 'center'); }
      else if (t && typeof t === 'object') {
        const fs = size * 0.6, mx = cx + w / 2;
        if (t.n === '?' && slot) slot.drawFrac(mx, y - fs * 0.72, fs); else text(String(t.n), mx, y - fs * 0.62, F(700, fs), col, 'center');
        text(String(t.d), mx, y + fs * 0.72, F(700, fs), col, 'center');
        c.strokeStyle = col; c.lineWidth = Math.max(2, size * 0.06); c.lineCap = 'round'; c.beginPath(); c.moveTo(cx + size * 0.12, y + 1); c.lineTo(cx + w - size * 0.12, y + 1); c.stroke();
      } else text(tokText(t), cx, y + size * 0.04, F(700, size), col);
      cx += w;
    }
    return cx - x;
  }
  function fitSize(tokens, maxW, size, slot) { let s = size; while (s > 16 && measureTokens(tokens, s, slot) > maxW) s -= 2; return s; }

  /* ---------- picture help ---------- */
  const OR = '#ff9a52', BL = '#5aa9e6';
  function dot(x, y, r, col, crossed) { ell(x, y, r, r); c.fillStyle = col; c.fill(); if (crossed) { c.strokeStyle = INK; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); } }
  function egg(x, y, s, col, label) { ell(x, y, 11 * s, 14 * s); c.fillStyle = col; c.fill(); c.strokeStyle = 'rgba(74,59,82,.25)'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = 'rgba(160,120,180,.35)'; ell(x - 3 * s, y - 4 * s, 2 * s, 2 * s); c.fill(); if (label) text(String(label), x, y + 1, F(700, 13 * s), INK, 'center'); }
  const EGGC = ['#fff1d6', '#dff0ff', '#ffe1ec', '#e5f7d4'];
  function frame10(x, y, cell, filled, col, labelFrom) { // a ten-frame
    for (let i = 0; i < 10; i++) { const cx = x + (i % 5) * cell, cy = y + Math.floor(i / 5) * cell; c.strokeStyle = 'rgba(74,59,82,.35)'; c.lineWidth = 1.5; c.strokeRect(cx, cy, cell, cell); if (i < filled) { dot(cx + cell / 2, cy + cell / 2, cell * 0.34, typeof col === 'function' ? col(i) : col); if (labelFrom) text(String(labelFrom + i), cx + cell / 2, cy + cell / 2 + 1, F(700, cell * 0.32), '#fff', 'center'); } }
  }
  function drawVisual(v, x, y, w, h, help) {
    const cx = x + w / 2, cy = y + h / 2;
    switch (v.t) {
      case 'count': {
        const n = v.n, per = n <= 5 ? 5 : n <= 10 ? 5 : 10, rows = Math.ceil(n / per), s = n > 10 ? 1.05 : 1.35, gx = 31 * s, gy = 36 * s, x0 = cx - (Math.min(n, per) - 1) * gx / 2, y0 = cy - (rows - 1) * gy / 2;
        ell(cx, cy + rows * gy / 2 + 4, Math.min(n, per) * gx / 2 + 26, 16); c.fillStyle = '#c08350'; c.fill();
        for (let i = 0; i < n; i++) egg(x0 + (i % per) * gx, y0 + Math.floor(i / per) * gy, s, EGGC[i % 4], help ? i + 1 : 0);
        break;
      }
      case 'compare': {
        for (const [k, n] of [[0, v.a], [1, v.b]]) {
          const bx = x + w * (k ? 0.75 : 0.25), rows = Math.ceil(n / 5), y0 = cy - (rows - 1) * 15 - 6;
          ell(bx, cy + 40, 76, 14); c.fillStyle = '#c08350'; c.fill();
          for (let i = 0; i < n; i++) egg(bx - (Math.min(n, 5) - 1) * 13 + (i % 5) * 26, y0 + Math.floor(i / 5) * 30, 0.95, EGGC[(i + k) % 4], help ? i + 1 : 0);
        }
        break;
      }
      case 'dots': {
        const total = v.op === '+' ? v.a + v.b : v.a, cell = total > 10 ? 30 : 34, frames = Math.ceil(total / 10) || 1, fw = cell * 5, gap = 20, x0 = cx - (frames * fw + (frames - 1) * gap) / 2, y0 = cy - cell;
        for (let fI = 0; fI < frames; fI++) {
          const base = fI * 10, inFrame = Math.min(10, total - base);
          frame10(x0 + fI * (fw + gap), y0, cell, inFrame, (i) => (v.op === '+' ? (base + i < v.a ? OR : BL) : OR), help ? base + 1 : 0);
          if (v.op === '-') for (let i = 0; i < inFrame; i++) if (base + i >= v.a - v.b) { const ccx = x0 + fI * (fw + gap) + (i % 5) * cell + cell / 2, ccy = y0 + Math.floor(i / 5) * cell + cell / 2; dot(ccx, ccy, cell * 0.34, 'rgba(255,154,82,.35)', true); }
        }
        break;
      }
      case 'split': frame10(cx - 85, cy - 34, 34, v.n, (i) => (i < v.a ? OR : BL)); break;
      case 'tenframe': frame10(cx - 85, cy - 34, 34, v.filled, OR, help ? 1 : 0); if (help) for (let i = v.filled; i < 10; i++) text(String(i - v.filled + 1), cx - 85 + (i % 5) * 34 + 17, cy - 34 + Math.floor(i / 5) * 34 + 18, F(700, 13), BL, 'center'); break;
      case 'teen': frame10(cx - 185, cy - 34, 34, 10, OR); frame10(cx + 15, cy - 34, 34, v.n - 10, BL, help ? 1 : 0); text('10', cx - 100, cy + 52, F(700, 16), SOFT, 'center'); text(String(v.n - 10), cx + 100, cy + 52, F(700, 16), SOFT, 'center'); break;
      case 'blocks': {
        const parts = v.nums.length, slotW = w / parts;
        v.nums.forEach((n, k) => {
          const hundreds = Math.floor(n / 100), tens = Math.floor(n / 10) % 10, ones = n % 10, bx0 = x + slotW * k + 14;
          let bx = bx0;
          for (let i = 0; i < hundreds; i++) { c.fillStyle = '#9b6bd6'; c.fillRect(bx, cy - 50, 46, 46); bx += 50; }
          for (let i = 0; i < tens; i++) { c.fillStyle = OR; c.fillRect(bx, cy - 56, 9, 90); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; for (let j = 1; j < 10; j++) { c.beginPath(); c.moveTo(bx, cy - 56 + j * 9); c.lineTo(bx + 9, cy - 56 + j * 9); c.stroke(); } bx += 12; }
          bx += 6; for (let i = 0; i < ones; i++) { c.fillStyle = BL; c.fillRect(bx + (i % 3) * 12, cy + 25 - Math.floor(i / 3) * 12, 9, 9); }
          text(P.fmt(n), x + slotW * k + slotW / 2, y + h - 10, F(700, 18), INK, 'center');
          if (help) text(`${tens} tens, ${ones} ones`, x + slotW * k + slotW / 2, y + 12, F(600, 13), SOFT, 'center');
          if (k < parts - 1 && v.op) text(v.op === 'cmp' ? '?' : v.op === '-' ? '−' : v.op, x + slotW * (k + 1), cy, F(700, 28), SOFT, 'center');
        });
        break;
      }
      case 'column': {
        const fa = P.plain(v.a), fb = P.plain(v.b), dA = (fa.split('.')[1] || '').length, dB = (fb.split('.')[1] || '').length, dmax = Math.max(dA, dB);
        const pad = (s, d) => (d < dmax ? s + (d === 0 ? ' ' : '') + ' '.repeat(dmax - d) : s);
        const rows = [pad(fa, dA), pad(fb, dB)], len = Math.max(rows[0].length, rows[1].length), cw = Math.min(30, (w - 80) / (len + 1)), size = cw * 1.25;
        const right = cx + (len * cw) / 2 + 10;
        for (let i = 0; i < len; i++) if (i % 2 === 0) { c.fillStyle = 'rgba(90,169,230,.08)'; c.fillRect(right - (i + 1) * cw, y + 8, cw, h - 24); }
        rows.forEach((s, ri) => { for (let i = 0; i < s.length; i++) { const ch = s[s.length - 1 - i]; if (ch !== ' ') text(ch, right - i * cw - cw / 2, y + 36 + ri * (size + 6), F(700, size), INK, 'center'); } });
        text(v.op === '-' ? '−' : v.op, right - (len + 1) * cw, y + 42 + size + 6, F(700, size), INK, 'center');
        c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(right - (len + 1.4) * cw, y + 40 + 2 * size + 12); c.lineTo(right + 4, y + 40 + 2 * size + 12); c.stroke();
        text('?', right - cw / 2, y + 40 + 2 * size + 34, F(700, size * 0.8), RED, 'center');
        break;
      }
      case 'array': {
        const s = Math.min(1, (h - 16) / (v.rows * 30), (w - 70) / (v.cols * 26)), gx = 26 * s, gy = 30 * s, x0 = cx - (v.cols - 1) * gx / 2 - 18, y0 = cy - (v.rows - 1) * gy / 2;
        for (let r = 0; r < v.rows; r++) {
          for (let k = 0; k < v.cols; k++) egg(x0 + k * gx, y0 + r * gy, s, EGGC[r % 4], 0);
          if (help) text(String((r + 1) * v.cols), x0 + v.cols * gx + 14, y0 + r * gy, F(700, 15), RED, 'left');
        }
        break;
      }
      case 'pie': {
        const R = 64, x0 = cx, y0 = cy;
        for (let i = 0; i < v.d; i++) {
          const a0 = -Math.PI / 2 + i * TAU / v.d, a1 = a0 + TAU / v.d;
          c.beginPath(); c.moveTo(x0, y0); c.arc(x0, y0, R, a0, a1); c.closePath();
          const col = i < v.parts[0] ? OR : i < v.parts[0] + v.parts[1] ? (v.minus ? 'rgba(90,169,230,.25)' : BL) : '#f4ead8';
          c.fillStyle = col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
          if (v.minus && i >= v.parts[0] && i < v.parts[0] + v.parts[1]) { const am = (a0 + a1) / 2; dot(x0 + Math.cos(am) * R * 0.62, y0 + Math.sin(am) * R * 0.62, 4, BL, true); }
        }
        if (help) { text(`${v.parts[0]}/${v.d}`, x0 - R - 34, y0, F(700, 18), OR, 'center'); text(`${v.parts[1]}/${v.d}`, x0 + R + 34, y0, F(700, 18), BL, 'center'); }
        break;
      }
      case 'bars': {
        const n = v.fr.length, bh = Math.min(28, (h - 12) / n - 8), bw = w - 110, x0 = x + 70;
        v.fr.forEach(([a, d], k) => {
          const by = y + (h - n * (bh + 8)) / 2 + k * (bh + 8);
          for (let i = 0; i < d; i++) { const px = x0 + i * bw / d; c.fillStyle = i < a ? (k % 2 ? BL : OR) : '#f4ead8'; c.fillRect(px, by, bw / d, bh); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(px, by, bw / d, bh); }
          if (a === d && n > 2 && v.fr.every((q) => q[0] === q[1])) text('1', x0 - 22, by + bh / 2, F(700, 16), INK, 'center');
          else drawTokens([{ n: a, d }], x0 - 40, by + bh / 2, Math.min(34, bh * 1.2), INK);
        });
        break;
      }
      case 'hgrid': case 'hgrid2': {
        const list = v.t === 'hgrid' ? [v.n] : [v.a, v.b], cell = Math.min(14, (h - 20) / 10), gw = cell * 10, gap = 40, x0 = cx - (list.length * gw + (list.length - 1) * gap) / 2;
        list.forEach((n, k) => { const gx = x0 + k * (gw + gap), gy = cy - gw / 2; for (let i = 0; i < 100; i++) { c.fillStyle = i < n ? (k ? BL : OR) : '#f4ead8'; c.fillRect(gx + (i % 10) * cell, gy + Math.floor(i / 10) * cell, cell - 1.5, cell - 1.5); } if (help) text(`${n} hundredths`, gx + gw / 2, gy + gw + 12, F(600, 13), SOFT, 'center'); });
        break;
      }
      case 'line': {
        const x0 = x + 30, x1 = x + w - 30, ly = cy + 10, step = (v.hi - v.lo) / 10, X = (n) => x0 + (n - v.lo) / (v.hi - v.lo) * (x1 - x0);
        c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 - 10, ly); c.lineTo(x1 + 10, ly); c.stroke();
        for (let i = 0; i <= 10; i++) { const n = v.lo + i * step, tx = X(n), big = i === 0 || i === 10 || (v.round && i === 5); c.lineWidth = big ? 3 : 1.5; c.beginPath(); c.moveTo(tx, ly - (big ? 12 : 7)); c.lineTo(tx, ly + (big ? 12 : 7)); c.stroke(); if (big || !v.round) text(P.fmt(n), tx, ly + 26, F(big ? 700 : 500, big ? 16 : 13), INK, 'center'); }
        for (const m of v.marks || []) { dot(X(m), ly, 9, OR); text(String(m), X(m), ly - 26, F(700, 18), OR, 'center'); }
        if (v.n !== undefined) { const nx = X(v.n); c.fillStyle = RED; c.beginPath(); c.moveTo(nx, ly - 4); c.lineTo(nx - 9, ly - 22); c.lineTo(nx + 9, ly - 22); c.closePath(); c.fill(); text(P.fmt(v.n), nx, ly - 38, F(700, 18), RED, 'center'); if (help) { const tgt = v.n - v.lo >= (v.hi - v.lo) / 2 ? v.hi : v.lo; c.strokeStyle = RED; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(nx, ly - 12); c.quadraticCurveTo((nx + X(tgt)) / 2, ly - 50, X(tgt), ly - 12); c.stroke(); c.setLineDash([]); } }
        break;
      }
      case 'coins': {
        const R = { q: 34, d: 25, n: 29, p: 26 }, LAB = { q: '25¢', d: '10¢', n: '5¢', p: '1¢' }, COL = { q: '#d9d9d9', d: '#e6e6e6', n: '#c9c9c9', p: '#d58b5a' };
        const rowW = v.list.reduce((s, k) => s + R[k] * 2 + 10, 0); let px = rowW < w - 20 ? cx - rowW / 2 : x + 16, py = rowW < w - 20 ? cy : y + 46, run = 0;
        for (const k of v.list) { const r0 = R[k]; if (px + r0 * 2 > x + w - 10) { px = x + 16; py += 76; } ell(px + r0, py, r0, r0); c.fillStyle = COL[k]; c.fill(); c.strokeStyle = 'rgba(74,59,82,.35)'; c.lineWidth = 2; c.stroke(); text(LAB[k], px + r0, py + 1, F(700, r0 * 0.62), INK, 'center'); run += { q: 25, d: 10, n: 5, p: 1 }[k]; if (help) text(String(run), px + r0, py - r0 - 9, F(700, 12), RED, 'center'); px += r0 * 2 + 10; }
        break;
      }
      case 'grid': {
        const cell = Math.min(24, (h - 20) / v.h, (w - 40) / v.w), x0 = cx - v.w * cell / 2, y0 = cy - v.h * cell / 2;
        for (let r = 0; r < v.h; r++) for (let k = 0; k < v.w; k++) { c.fillStyle = (r + k) % 2 ? '#cfe7ad' : '#b5d98c'; c.fillRect(x0 + k * cell, y0 + r * cell, cell - 1.5, cell - 1.5); }
        text(`${v.w} wide`, cx, y0 - 10, F(600, 13), SOFT, 'center'); c.save(); c.translate(x0 - 12, cy); c.rotate(-Math.PI / 2); text(`${v.h} long`, 0, 0, F(600, 13), SOFT, 'center'); c.restore();
        if (help) for (let r = 0; r < v.h; r++) text(String((r + 1) * v.w), x0 + v.w * cell + 8, y0 + r * cell + cell / 2, F(700, 12), RED, 'left');
        break;
      }
      case 'pairs': {
        const cols = Math.ceil(v.n / 2), gx = Math.min(30, (w - 30) / cols), x0 = cx - (cols - 1) * gx / 2;
        for (let i = 0; i < v.n; i++) { const k = Math.floor(i / 2), lone = v.n % 2 && i === v.n - 1; dot(x0 + k * gx, cy - 16 + (i % 2) * 32, 11, lone ? RED : i % 2 ? BL : OR); }
        if (help) text(v.n % 2 ? 'one left over' : 'every dot has a buddy', cx, y + h - 12, F(600, 14), SOFT, 'center');
        break;
      }
      case 'partial': {
        const split = (n) => String(n).split('').map((d, i, arr) => Number(d) * 10 ** (arr.length - 1 - i)).filter((q) => q);
        const A1 = split(v.a), B1 = split(v.b), gw = (w - 60) / A1.length, gh = Math.min(48, (h - 40) / B1.length), x0 = x + 50, y0 = y + 30;
        A1.forEach((a, i) => text(P.fmt(a), x0 + i * gw + gw / 2, y0 - 12, F(700, 14), OR, 'center'));
        B1.forEach((b, j) => { text(P.fmt(b), x0 - 8, y0 + j * gh + gh / 2, F(700, 14), BL, 'right'); A1.forEach((a, i) => { c.fillStyle = (i + j) % 2 ? '#fde7d4' : '#e1f0fb'; c.fillRect(x0 + i * gw, y0 + j * gh, gw - 3, gh - 3); text(help ? P.fmt(a * b) : `${P.fmt(a)} × ${P.fmt(b)}`, x0 + i * gw + gw / 2, y0 + j * gh + gh / 2, F(700, help ? 15 : 12), INK, 'center'); }); });
        break;
      }
      default: break;
    }
  }

  /* ---------- pterodactyls ---------- */
  const PT_COLS = [['#e07a5f', '#f6c3a8', '#b35a44'], ['#4fa39a', '#ade0d8', '#347a72'], ['#8e7cc3', '#d3c9f3', '#6a58a2']];
  const NEST = [262, 580];
  function homeXs(n, pl) { if (pl.mode === 'type') return [760]; return n === 2 ? [650, 830] : [600, 728, 856]; }
  const homeY = (pl) => (pl.mode === 'type' ? 250 : 284);
  // 0 = hovering at home, 1 = right over the nest (timed mode only)
  function swoopK(pl) {
    if (!timedOn()) return 0;
    if (pl.swoopBack !== null) { const k = (now - pl.swoopBack) / 0.8; if (k >= 1) { pl.swoopBack = null; pl.swoop = 0; return 0; } return 1 - easeIO(k); }
    return easeIO(pl.swoop);
  }
  // A paper pterodactyl facing left (at the nest), wings out, holding a sign in its feet.
  function drawPtero(x, y, s, o) {
    const up = Math.sin(o.flap), [col, light, dark] = o.col;
    c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(s, s); if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    if (o.label) {
      c.strokeStyle = 'rgba(74,59,82,.55)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-7, 27); c.lineTo(-34, 46); c.moveTo(7, 27); c.lineTo(34, 46); c.stroke();
      shadow(6, 3); rr(-52, 44, 104, 64, 12); c.fillStyle = o.grey ? '#ece6dc' : PAPER; c.fill(); noShadow();
      c.strokeStyle = o.focus ? GOLD : 'rgba(74,59,82,.2)'; c.lineWidth = o.focus ? 4 : 1.5; if (o.focus) c.setLineDash([7, 5]); c.stroke(); c.setLineDash([]);
      const size = fitSize(o.label, 88, 40), lw = measureTokens(o.label, size); drawTokens(o.label, -lw / 2, 77, size, o.grey ? 'rgba(74,59,82,.35)' : INK);
    }
    for (const sd of [-1, 1]) {
      const tipY = -30 - up * 34;
      c.beginPath(); c.moveTo(sd * 8, -9); c.quadraticCurveTo(sd * 40, -30 - up * 26, sd * 80, tipY); c.lineTo(sd * 60, -8 - up * 14); c.quadraticCurveTo(sd * 46, 6 - up * 6, sd * 30, 2); c.quadraticCurveTo(sd * 20, 11, sd * 8, 9); c.closePath();
      shadow(5, 3); c.fillStyle = col; c.fill(); noShadow();
      c.strokeStyle = dark; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(sd * 8, -9); c.quadraticCurveTo(sd * 40, -30 - up * 26, sd * 80, tipY); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(sd * 30, -19 - up * 16); c.lineTo(sd * 36, 2); c.moveTo(sd * 52, -22 - up * 23); c.lineTo(sd * 50, -4 - up * 10); c.stroke();
    }
    c.strokeStyle = dark; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-5, 14); c.lineTo(-7, 27); c.moveTo(5, 14); c.lineTo(7, 27); c.stroke();
    ell(0, 0, 13, 20); c.fillStyle = col; c.fill(); ell(0, 5, 8, 13); c.fillStyle = light; c.fill();
    c.beginPath(); c.moveTo(0, -30); c.lineTo(26, -47); c.lineTo(6, -23); c.closePath(); c.fillStyle = dark; c.fill();
    ell(-4, -27, 12, 9.5); c.fillStyle = col; c.fill();
    const open = o.scared ? 7 : 0;
    c.beginPath(); c.moveTo(-12, -31); c.lineTo(-50, -25 - open * 0.4); c.lineTo(-12, -24); c.closePath(); c.fillStyle = '#f2c14e'; c.fill();
    if (open) { c.beginPath(); c.moveTo(-12, -24); c.lineTo(-40, -15 + open); c.lineTo(-12, -20); c.closePath(); c.fill(); }
    const er = o.scared ? 4.8 : 3.6; ell(-6, -29, er, er); c.fillStyle = '#fff'; c.fill(); ell(o.scared ? -6 : -7.5, -29, 1.9, 1.9); c.fillStyle = INK; c.fill();
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); if (o.scared) { c.moveTo(-11, -38); c.lineTo(-1, -37); } else { c.moveTo(-12, -34); c.lineTo(0, -37.5); } c.stroke();
    if (o.scared) { ell(11, -38, 2.4, 3.6); c.fillStyle = '#7fc8f0'; c.fill(); }
    c.restore();
  }

  /* ---------- keypad (type mode) ---------- */
  function drawKeypad(pl, r) {
    const p = pl.prob, two = P.fieldCount(p) === 2, extra = p.decimal ? '.' : two ? (p.ans.k === 'frac' ? 'next' : 'R') : null;
    const x0 = 548, kw = 62, kh = 50, g = 10, rows = [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '0']];
    const want = pl.helped ? (() => { const a = P.answerFields(p)[pl.field], have = pl.entry[pl.field]; return a.startsWith(have) ? a[have.length] : null; })() : null;
    popCard(x0 - 14, 384, 5 * kw + 4 * g + 28, 3 * kh + 2 * g + 26, r, 'rgba(255,250,240,.9)', () => {
      rows.forEach((row, ri) => row.forEach((k, i) => {
        const x = x0 + i * (kw + g), y = 396 + ri * (kh + g), glow = want === k;
        shadow(0, 4, 'rgba(60,30,10,.22)'); rr(x, y, kw, kh, 14); c.fillStyle = glow ? '#ffe08a' : ['#ffd9d6', '#ffe9c7', '#fff4bf', '#ddf3cf', '#d6ecfb'][i]; c.fill(); noShadow();
        text(k, x + kw / 2, y + kh / 2 + 2, F(700, 28), INK, 'center'); hit(x, y, kw, kh, () => typeKey(k));
      }));
      const y = 396 + 2 * (kh + g);
      const delW = extra ? kw * 2 + g : kw * 2 + g * 1.5, goX = x0 + 3 * (kw + g);
      shadow(0, 4, 'rgba(60,30,10,.22)'); rr(x0, y, delW, kh, 14); c.fillStyle = '#efe4d2'; c.fill(); noShadow();
      c.strokeStyle = INK; c.lineWidth = 2.6; c.lineJoin = 'round'; const mx = x0 + delW / 2; c.beginPath(); c.moveTo(mx - 20, y + kh / 2); c.lineTo(mx - 10, y + 15); c.lineTo(mx + 18, y + 15); c.lineTo(mx + 18, y + kh - 15); c.lineTo(mx - 10, y + kh - 15); c.closePath(); c.stroke();
      hit(x0, y, delW, kh, () => typeKey('del'));
      if (extra) {
        const ex = x0 + 2 * (kw + g), glow = (extra === '.' && want === '.') || (extra !== '.' && pl.helped && pl.field === 0 && pl.entry[0] === P.answerFields(p)[0]);
        shadow(0, 4, 'rgba(60,30,10,.22)'); rr(ex, y, kw, kh, 14); c.fillStyle = glow ? '#ffe08a' : '#e9e0f5'; c.fill(); noShadow();
        if (extra === 'next') { c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex + kw / 2, y + 12); c.lineTo(ex + kw / 2, y + kh - 12); c.moveTo(ex + kw / 2 - 8, y + kh - 20); c.lineTo(ex + kw / 2, y + kh - 12); c.lineTo(ex + kw / 2 + 8, y + kh - 20); c.stroke(); }
        else text(extra, ex + kw / 2, y + kh / 2 + (extra === '.' ? -4 : 2), F(700, extra === '.' ? 40 : 26), INK, 'center');
        hit(ex, y, kw, kh, () => typeKey(extra === '.' ? '.' : 'next'));
      }
      shadow(0, 4, 'rgba(60,30,10,.28)'); rr(goX, y, kw * 2 + g, kh, 14); c.fillStyle = GREEN; c.fill(); noShadow();
      text('Go!', goX + kw + g / 2, y + kh / 2 + 2, F(700, 26), '#fff', 'center'); hit(goX, y, kw * 2 + g, kh, () => typeKey('go'));
    });
  }

  /* ---------- the play screen ---------- */
  let lastT = 0;
  const REX_X = 100, REX_Y = 566, REX_S = 1.4;
  function drawPlay(dt) {
    const pl = S.play, p = pl.prob, w = P.WORLDS[pl.g];
    drawBook(pl.g, [[40, 104, '◀ Map', '#8a7aa0', () => toMap()], soundTab(600), grownTab()]);
    // header
    text(`${w.name} · ${pl.L.name}`, 58, 86, F(700, 20), INK);
    for (let i = 0; i < LEVEL_LEN; i++) { const x = 66 + i * 19, y = 118, done = i < pl.idx || (i === pl.idx && pl.phase !== 'ask'); if (done) { starPath(x, y, 9, 4); c.fillStyle = GOLD; c.fill(); } else { ell(x, y, 6, 6); c.fillStyle = i === pl.idx ? 'rgba(239,83,80,.3)' : 'rgba(74,59,82,.14)'; c.fill(); } }
    drawJar(882, 118, rise(1));
    const timed = timedOn();
    if (timed) { rr(266, 106, 70, 24, 12); c.fillStyle = 'rgba(74,59,82,.12)'; c.fill(); text('Timed', 301, 119, F(600, 13), INK, 'center'); }

    // timed: the pterodactyls swoop toward the nest. If they get there, Rex chases them back up. Nothing is lost.
    if (timed && pl.phase === 'ask' && pl.swoopBack === null && S.closingAt === null && now - pl.t0 > 0.6) {
      pl.swoop += dt / (24 - Math.min(pl.streak, 8) * 1.6);
      if (pl.swoop >= 1) { pl.swoop = 1; pl.swoopBack = now; sfx.whoosh(); pl.bubble = { text: 'Shoo! Rex chased them back up. Take your time.', kind: 'oops', t: now }; }
    }
    const tR = pl.tRight !== null ? now - pl.tRight : -1;

    // the nest Rex is guarding
    popup(NEST[0], NEST[1], rise(1), (sil) => { ell(0, -8, 30, 10); f(sil, '#a86b3c'); for (const [dx, col] of [[-12, '#fff6e0'], [0, '#d9f0ff'], [12, '#ffe1ec']]) { ell(dx, -19, 8, 10); f(sil, col); } ell(0, -5, 30, 6); f(sil, '#b97a46'); }, 1.5);

    // Rex
    const roar = (pl.phase === 'right' && tR < 0.7) || (pl.swoopBack !== null && now - pl.swoopBack < 0.6);
    const sad = pl.bubble && pl.bubble.kind === 'oops' && pl.swoopBack === null && now - pl.bubble.t < 1.2;
    const hop = pl.phase === 'right' && tR > 0.5 && tR < 1.1 ? Math.sin((tR - 0.5) / 0.6 * Math.PI) * 16 : 0;
    popup(REX_X, REX_Y - hop, rise(1), (sil) => drawRex(0, 0, REX_S, { sil, w: Math.sin(now * 3), roar, sad, blink: (now % 3.3) < 0.12, look: pl.helped }), 1);

    // picture help
    const pics = setting().pictures, show = p.visual && (p.showVisual || pics === 'always' || (pics === 'miss' && pl.misses >= 1) || (pl.helped && pics !== 'off'));
    if (show && pl.visAt === null) pl.visAt = now;
    if (show) popCard(52, 246, 404, 180, Math.min(reduce ? 1 : back((now - pl.visAt) / 0.42), rise(2)), PAPER, () => drawVisual(p.visual, 62, 254, 384, 164, pl.helped), 16);

    // problem card
    const slot = slotFor(pl);
    popCard(262, 102, 436, 136, rise(1), PAPER, () => {
      if (p.prompt) { const pl0 = wrap(p.prompt, 360, F(600, 18)); pl0.slice(0, 2).forEach((ln, i) => text(ln, 282, 124 + i * 20 - (pl0.length > 1 ? 4 : 0), F(600, 18), SOFT)); }
      const top = p.prompt ? (wrap(p.prompt, 360, F(600, 18)).length > 1 ? 196 : 186) : 172;
      const size = fitSize(p.q, 396, p.prompt ? 46 : 54, slot), qw = measureTokens(p.q, size, slot);
      drawTokens(p.q, 480 - qw / 2, top, size, INK, slot);
      ell(672, 128, 17, 17); c.fillStyle = RED; c.fill(); speakerIcon(670, 128, true); hitCircle(672, 128, 20, () => { A.say(p.say); });
    }, 18);

    if (pl.mode === 'type') drawKeypad(pl, rise(3));

    // the pterodactyls
    const xs = homeXs(p.choices.length, pl), hy = homeY(pl), sk = swoopK(pl), pr = rise(2), s = pl.mode === 'type' ? 0.95 : 0.8;
    const birds = pl.mode === 'type' ? [{ label: ['?'], i: 0 }] : p.choices.map((ch, i) => ({ label: ch.label, i }));
    let targetPos = null;
    birds.forEach(({ label, i }) => {
      let x = xs[i] + Math.sin(now * 1.1 + i * 2) * 7, y = hy + Math.sin(now * 2 + i) * 7;
      x = lerp(x, 312 + i * 64, sk); y = lerp(y, 432, sk);
      y = lerp(-90, y, pr);
      const isTarget = pl.mode === 'type' || i === pl.target, off = pl.off.has(i);
      let rot = 0, alpha = 1, scared = false;
      if (pl.phase !== 'ask') {
        if (isTarget) { if (!targetPos) targetPos = [x, y]; const tf = tR - 0.22; if (tf > 0) { x += tf * 260 + tf * tf * 520; y -= tf * 400; rot = -0.5 * Math.min(1, tf * 2); } scared = tR > 0.12; }
        else { const tf = tR - 0.45; if (tf > 0) { x += tf * 300; y -= tf * 320; alpha = Math.max(0, 1 - tf * 1.3); } }
      }
      if (off && pl.away[i] !== undefined) { const tf = now - pl.away[i]; if (tf > 0) { x += tf * 300; y -= tf * 360; rot = -0.3; alpha = Math.min(alpha, Math.max(0, 1 - tf * 1.6)); } }
      if (alpha <= 0.01 || x > 1060 || y < -160) return;
      let wx = 0; if (pl.wob[i] !== undefined && now - pl.wob[i] < 0.5) wx = Math.sin((now - pl.wob[i]) * 40) * 10 * (1 - (now - pl.wob[i]) / 0.5);
      if (pl.phase === 'ask' && !off && sk < 0.05) { c.strokeStyle = 'rgba(74,59,82,.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, 56); c.lineTo(x + wx, y - 28 * s); c.stroke(); }
      drawPtero(x + wx, y, s, { flap: now * (scared ? 16 : 7) + i * 1.7, col: PT_COLS[i % 3], label, rot, alpha, scared, grey: off, focus: pl.phase === 'ask' && pl.focus === i && kbUsed && !off });
      if (scared && tR < 1.3) text('Eek!', x + 30, y - 60 * s, F(700, 22), RED, 'center');
      if (!off && pl.phase === 'ask' && pl.mode === 'pick') { hitCircle(x, y - 6 * s, 50 * s, () => choose(i)); hit(x - 54 * s, y + 42 * s, 108 * s, 68 * s, () => choose(i)); }
    });

    // Rex's roar, then a star flies to the jar
    if (pl.phase !== 'ask' && pl.tRight !== null) {
      const mx = REX_X + 52 * REX_S, my = REX_Y - 52 * REX_S - hop;
      if (tR < 0.8) {
        c.save(); c.strokeStyle = RED; c.lineCap = 'round'; c.lineWidth = 5;
        for (let k = 0; k < 3; k++) { const r = 22 + ((tR * 280 + k * 34) % 110); c.globalAlpha = Math.max(0, 1 - r / 135) * (1 - tR / 0.8); c.beginPath(); c.arc(mx + 4, my, r, -0.6, 0.6); c.stroke(); }
        c.restore();
        const s2 = back(tR / 0.25) * (tR > 0.6 ? 1 - (tR - 0.6) / 0.2 : 1); c.save(); c.translate(mx + 36, my - 52); c.rotate(-0.12); c.scale(Math.max(0.01, s2), Math.max(0.01, s2)); text('ROAR!', 0, 0, F(700, 30), RED, 'center'); c.restore();
      }
      const from = targetPos || [xs[0], hy];
      if (tR > 0.35 && tR < 1.4) {
        const k2 = ease((tR - 0.35) / 0.8), sx = lerp(from[0], 882, k2), sy = lerp(from[1], 118, k2) - Math.sin(k2 * Math.PI) * 70;
        if (k2 < 1) { starPath(sx, sy, 22 - k2 * 10, 10 - k2 * 5); c.fillStyle = GOLD; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); }
        else if (!pl.starred) { pl.starred = true; sfx.star(); }
      }
      if (tR > 1.9 && pl.phase === 'right') { pl.idx++; if (pl.idx >= LEVEL_LEN) finishLevel(); else newProblem(); }
    }

    // Rex's speech bubble
    if (pl.bubble && pl.phase !== 'done') {
      const b = pl.bubble, age = now - b.t, life = b.kind === 'help' ? 999 : b.kind === 'yay' ? 1.9 : b.kind === 'intro' ? 4.5 : 3.2;
      if (age > 0 && age < life) {
        const s3 = back(age / 0.28), fs = b.text.length > 150 ? 15 : 17, lines = wrap(b.text, 236, F(600, fs)), bh = lines.length * (fs + 4) + 22, bx = 192, bb = 532, by = bb - bh;
        c.save(); c.translate(bx, bb); c.scale(s3, s3); c.translate(-bx, -bb);
        shadow(6, 3, 'rgba(60,30,10,.22)'); rr(bx, by, 264, bh, 16); c.moveTo(bx + 8, by + bh - 24); c.lineTo(bx - 14, by + bh + 4); c.lineTo(bx + 26, by + bh - 1);
        c.fillStyle = b.kind === 'yay' ? '#e3f4da' : b.kind === 'help' || b.kind === 'intro' ? '#fff3c4' : '#fff'; c.fill(); noShadow();
        lines.forEach((ln, i) => text(ln, bx + 14, by + 14 + i * (fs + 4) + fs / 2, F(600, fs), b.kind === 'oops' ? '#d84340' : b.kind === 'yay' ? '#2e7d32' : INK));
        c.restore();
      }
    }

    // stage done
    if (pl.phase === 'done') {
      const e = pl.end, k = back((now - e.t) / 0.45);
      c.fillStyle = `rgba(60,35,20,${0.25 * clamp((now - e.t) / 0.3, 0, 1)})`; c.fillRect(0, 0, W, H);
      popCard(270, 112, 420, 368, Math.min(k, rise(0)), '#fffaf0', () => {
        text(e.gradeNow ? 'All explored!' : 'Stage done!', 480, 160, F(700, 38), RED, 'center');
        text(pl.L.name + ' · the eggs are safe', 480, 198, F(600, 18), SOFT, 'center');
        for (let q = 0; q < 3; q++) { const sk2 = back((now - e.t - 0.4 - q * 0.25) / 0.35), sx = 400 + q * 80; if (sk2 > 0) { starPath(sx, 262, 30 * sk2, 13 * sk2); c.fillStyle = q < e.stars ? GOLD : 'rgba(74,59,82,.14)'; c.fill(); } }
        text(`You put ${LEVEL_LEN} stars in the jar!`, 480, 320, F(600, 19), INK, 'center');
        text(`${pl.firsts} right on the first try`, 480, 348, F(500, 16), SOFT, 'center');
        const hasNext = pl.li + 1 < w.levels.length;
        button(296, 384, 116, 50, 'Again', '#8a7aa0', () => go(() => startLevel(pl.g, pl.li)), 19);
        if (hasNext) button(424, 384, 240, 50, 'Next stage ▶', GREEN, () => toMap({ to: pl.li + 1, play: true }), 19);
        else button(424, 384, 240, 50, 'Back to the map', GREEN, () => toMap(), 19);
        text(e.newBest ? 'New best!' : ' ', 480, 452, F(600, 15), GREEN, 'center');
      }, 22);
    }
  }

  /* ---------- main loop ---------- */
  function frame(ts) {
    const t = ts / 1000, dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t; now += dt;
    if (S.closingAt !== null && now - S.closingAt > 0.42) { const fnext = S.next; S.next = null; S.closingAt = null; fnext(); S.openAt = now; }
    hits = [];
    c.setTransform(K, 0, 0, K, 0, 0); c.clearRect(0, 0, W, H);
    try {
      if (S.screen === 'map') drawMap(); else if (S.screen === 'play' && S.play) drawPlay(dt);
    } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */
  let kbUsed = false;
  function toLogical(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  cv.addEventListener('pointerdown', (e) => {
    A.unlock(); cv.focus({ preventScroll: true }); kbUsed = false;
    if (S.closingAt !== null) return;
    const [x, y] = toLogical(e), h = findHit(x, y);
    if (h) { e.preventDefault(); h.fn(); }
  });
  cv.addEventListener('pointermove', (e) => { const [x, y] = toLogical(e); cv.style.cursor = findHit(x, y) ? 'pointer' : 'default'; });
  addEventListener('keydown', (e) => {
    if (!panel.hidden) { if (e.key === 'Escape') closeSettings(); return; }
    A.unlock();
    if (S.screen === 'play' && S.play && S.closingAt === null) {
      const pl = S.play;
      if (pl.phase === 'done') return;
      if (pl.phase !== 'ask') return;
      if (pl.mode === 'type') {
        if (/^[0-9]$/.test(e.key)) typeKey(e.key);
        else if (e.key === '.' || e.key === ',') typeKey('.');
        else if (e.key === 'Backspace' || e.key === 'Delete') typeKey('del');
        else if (e.key === 'Enter' || e.key === '=') typeKey('go');
        else if (['/', 'Tab', 'r', 'R', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) { if (P.fieldCount(pl.prob) === 2) typeKey('next'); else if (e.key !== 'Tab') return; }
        else return;
        e.preventDefault(); return;
      }
      const n = pl.prob.choices.length, step = (d) => { kbUsed = true; for (let k = 1; k <= n; k++) { const j = (pl.focus + d * k + n * 3) % n; if (!pl.off.has(j)) { pl.focus = j; sfx.tap(); return; } } };
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
      else if (e.key === 'Enter' || e.key === ' ') { if (!kbUsed) { kbUsed = true; } else choose(pl.focus); }
      else return;
      e.preventDefault();
    }
  });

  /* ---------- grown-up settings panel ---------- */
  const panel = document.getElementById('settings'), form = document.getElementById('set-form'), gradeSeg = document.getElementById('set-grade'), paceNote = document.getElementById('pace-note');
  let lastFocus = null, gradeAtOpen = 0;
  P.WORLDS.forEach((w, i) => {
    const id = 'sg-' + i;
    gradeSeg.insertAdjacentHTML('beforeend', `<input type="radio" name="grade" id="${id}" value="${i}"><label for="${id}" title="${w.name}">${w.short === 'K' ? 'K' : 'Grade ' + w.short}</label>`);
  });
  function fill() {
    const s = setting();
    form.grade.value = String(s.grade); form.answer.value = s.answer; form.pace.value = s.pace; form.pictures.value = s.pictures; form.voice.value = s.voice; form.sound.value = A.muted ? 'off' : 'on';
    paceNote.textContent = s.pace === 'timed' ? 'The pterodactyls swoop toward the nest, faster as the streak grows. If one gets there, Rex just chases it back up.' : 'No clock. The pterodactyls hover and wait for as long as it takes.';
    document.getElementById('reset-confirm').hidden = true; document.getElementById('reset').hidden = false;
  }
  function openSettings() {
    if (busy()) return;
    fill(); gradeAtOpen = grade(); lastFocus = document.activeElement; panel.hidden = false; A.hush();
    const first = form.querySelector('input[name="grade"]:checked'); if (first) first.focus();
  }
  function closeSettings() {
    panel.hidden = true;
    if (S.play) { const m = modeFor(S.play); if (m !== S.play.mode) { S.play.mode = m; S.play.entry = ['', '']; S.play.field = 0; } }
    if (grade() !== gradeAtOpen && S.screen === 'map') go(() => { S.screen = 'map'; });
    (lastFocus && lastFocus.focus ? lastFocus : cv).focus();
  }
  form.addEventListener('change', (e) => {
    const n = e.target.name;
    if (n === 'sound') { A.setMuted(e.target.value === 'off'); if (!A.muted) sfx.tap(); return; }
    if (n === 'grade') { setting().grade = Number(e.target.value); save(); fill(); return; }
    if (['answer', 'pace', 'pictures', 'voice'].includes(n)) { setting()[n] = e.target.value; save(); fill(); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); closeSettings(); });
  document.getElementById('set-close').addEventListener('click', closeSettings);
  panel.addEventListener('pointerdown', (e) => { if (e.target === panel) closeSettings(); });
  document.getElementById('reset').addEventListener('click', () => { document.getElementById('reset').hidden = true; document.getElementById('reset-confirm').hidden = false; document.getElementById('reset-no').focus(); });
  document.getElementById('reset-no').addEventListener('click', () => { document.getElementById('reset').hidden = false; document.getElementById('reset-confirm').hidden = true; });
  document.getElementById('reset-yes').addEventListener('click', () => {
    store.progress = {}; store.jar = 0; store.rex = P.WORLDS.map(() => 0); S.banner = null; S.pending = null; save(); closeSettings();
    go(() => { S.screen = 'map'; });
  });

  /* ---------- start ---------- */
  // ?grade=2 shows grade 2's map, ?play=2.3 opens grade 2's third stage (handy for testing).
  const qs = new URLSearchParams(location.search);
  if (qs.has('grade')) { const a = Number(qs.get('grade')); if (P.WORLDS[a]) { setting().grade = a; save(); } }
  if (qs.has('play')) { const [a, b] = qs.get('play').split('.').map(Number); if (P.WORLDS[a] && P.WORLDS[a].levels[b - 1]) { setting().grade = a; S.screen = 'play'; startLevel(a, b - 1); } }
  if (qs.has('debug')) window.__dino = { S, store, choose, typeKey, P };
  addEventListener('resize', fit);
  fit();
  const ready = document.fonts ? Promise.race([document.fonts.load(F(700, 20)), new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
  ready.catch(() => {}).then(() => { requestAnimationFrame((ts) => { lastT = ts / 1000; S.openAt = 0; requestAnimationFrame(frame); }); });
})();
