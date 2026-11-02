/* Choo-Choo Junction — rendering, animation and controls. */
(function () {
  'use strict';

  const TE = window.TrainEngine;
  const LEVELS = window.TRAIN_LEVELS;
  const { DX, DY, opp, PIECES } = TE;

  // ------------------------------------------------------------ constants
  const SHADOW = 'rgba(90, 60, 30, 0.22)';
  const COL = {
    grass: '#9fd36b',
    grassDark: '#86bf55',
    water: '#63c6ee',
    waterDeep: '#4bb2df',
    ballast: '#e6d3a8',
    tie: '#b67a47',
    tieDark: '#8a5530',
    rail: '#6c6280',
    railHi: '#c3bbd6',
    card: '#fff7e3',
    wood: '#d39255',
    woodDark: '#a8683a',
    mountain: '#a596d0',
    mountainDark: '#8676b8',
    snow: '#ffffff',
    stone: '#b9b2c2',
    engine: '#ef5350',
    engineDark: '#c62828',
    cars: ['#ffca28', '#42a5f5', '#ab47bc'],
  };
  const CAR_SPACING = 0.7;
  const N_CARS = 3; // engine + 2 carriages
  const START_S = 2.25;
  const MAX_SPEED = 2.6;
  const FONT = 'Fredoka, "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
  const ANIMALS = ['bunny', 'bear', 'duck', 'cat'];

  // ------------------------------------------------------------ DOM
  const $ = (id) => document.getElementById(id);
  const canvas = $('board');
  const stage = $('stage');
  const hintEl = $('hint');
  const goBtn = $('goBtn');
  const rotateBtn = $('rotateBtn');
  const clearBtn = $('clearBtn');
  const piecesEl = $('pieces');
  const titleEl = $('levelTitle');
  const soundBtn = $('soundBtn');
  const overlay = $('overlay');

  let g = canvas.getContext('2d'); // current drawing context (swapped for layers/icons)
  const mainCtx = g;

  // ------------------------------------------------------------ state
  const state = {
    levelIndex: 0,
    level: null,
    board: null,
    placements: [],
    selected: 0,
    mode: 'edit', // edit | run | crash | missed | win
    trip: null,
    idleTrip: null,
    s: START_S,
    v: 0,
    time: 0,
    modeTime: 0,
    eventIdx: 0,
    passengers: [],
    debris: [],
    particles: [],
    bursts: [],
    marker: null,
    shake: 0,
    trainPop: 1,
    chugAcc: 0,
    smokeAcc: 0,
    crashReason: null,
    hopSheep: null,
    decor: null,
    hintTimer: 0,
  };

  const view = { W: 0, H: 0, dpr: 1, T: 40, ox: 0, oy: 0 };
  let groundLayer = null;
  let tallLayer = null;

  // ------------------------------------------------------------ progress
  const progress = loadProgress();
  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem('tj-progress') || '{}');
      return { solved: new Set(p.solved || []) };
    } catch (e) {
      return { solved: new Set() };
    }
  }
  function saveProgress() {
    try {
      localStorage.setItem('tj-progress', JSON.stringify({ solved: [...progress.solved] }));
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------ helpers
  function hash(x, y, k) {
    let h = (x * 374761393 + y * 668265263 + (k || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 10000) / 10000;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dirAngle = (d) => Math.atan2(DY[d], DX[d]);
  const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  function rr(x, y, w, h, r) {
    const rs = Array.isArray(r) ? r : [r, r, r, r];
    const [tl, tr, br, bl] = rs.map((v) => Math.min(v, w / 2, h / 2));
    g.moveTo(x + tl, y);
    g.lineTo(x + w - tr, y);
    if (tr) g.arcTo(x + w, y, x + w, y + tr, tr); else g.lineTo(x + w, y);
    g.lineTo(x + w, y + h - br);
    if (br) g.arcTo(x + w, y + h, x + w - br, y + h, br); else g.lineTo(x + w, y + h);
    g.lineTo(x + bl, y + h);
    if (bl) g.arcTo(x, y + h, x, y + h - bl, bl); else g.lineTo(x, y + h);
    g.lineTo(x, y + tl);
    if (tl) g.arcTo(x, y, x + tl, y, tl); else g.lineTo(x, y);
    g.closePath();
  }
  function circle(x, y, r) {
    g.moveTo(x + r, y);
    g.arc(x, y, r, 0, Math.PI * 2);
  }
  function ellipse(x, y, rx, ry, rot) {
    g.moveTo(x + rx * Math.cos(rot || 0), y + rx * Math.sin(rot || 0));
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  }
  function poly(pts) {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }

  // A paper cut-out: drop shadow, white border, then the fill.
  function paper(build, fill, o = {}) {
    const outline = o.outline === undefined ? '#fff' : o.outline;
    const ow = o.ow === undefined ? 0.06 : o.ow;
    const sh = o.sh === undefined ? 0.045 : o.sh;
    if (sh) {
      g.save();
      g.translate(sh * 0.45, sh);
      g.beginPath(); build();
      g.fillStyle = o.shadowColor || SHADOW;
      g.fill();
      if (outline) { g.lineWidth = ow; g.strokeStyle = o.shadowColor || SHADOW; g.lineJoin = 'round'; g.stroke(); }
      g.restore();
    }
    g.beginPath(); build();
    if (outline) {
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.lineWidth = ow;
      g.strokeStyle = outline;
      g.stroke();
    }
    g.fillStyle = fill;
    g.fill();
  }
  function fillPath(build, fill) {
    g.beginPath(); build();
    g.fillStyle = fill; g.fill();
  }
  function strokePath(build, color, w) {
    g.beginPath(); build();
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    g.stroke();
  }

  function text(str, x, y, size, o = {}) {
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    const k = size / 100;
    g.scale(k, k);
    g.font = `${o.weight || 700} 100px ${FONT}`;
    g.textAlign = o.align || 'center';
    g.textBaseline = 'middle';
    if (o.stroke) {
      g.lineJoin = 'round';
      g.lineWidth = (o.sw || 0.1) / k;
      g.strokeStyle = o.stroke;
      g.strokeText(str, 0, 0);
    }
    g.fillStyle = o.fill || '#fff';
    g.fillText(str, 0, 0);
    g.restore();
  }

  function star(cx, cy, r1, r2, n, rot) {
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = rot + (i * Math.PI) / n - Math.PI / 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
  }
  function heart(cx, cy, s) {
    g.moveTo(cx, cy + s * 0.35);
    g.bezierCurveTo(cx - s * 0.9, cy - s * 0.25, cx - s * 0.35, cy - s * 0.85, cx, cy - s * 0.35);
    g.bezierCurveTo(cx + s * 0.35, cy - s * 0.85, cx + s * 0.9, cy - s * 0.25, cx, cy + s * 0.35);
    g.closePath();
  }

  // ------------------------------------------------------------ track drawing
  function segPath(seg, off) {
    if (seg.kind === 'line') {
      const dx = (seg.x1 - seg.x0) / seg.len, dy = (seg.y1 - seg.y0) / seg.len;
      const nx = -dy * off, ny = dx * off;
      g.moveTo(seg.x0 + nx, seg.y0 + ny);
      g.lineTo(seg.x1 + nx, seg.y1 + ny);
    } else {
      const R = seg.r + off;
      g.moveTo(seg.cx + R * Math.cos(seg.a0), seg.cy + R * Math.sin(seg.a0));
      g.arc(seg.cx, seg.cy, R, seg.a0, seg.a0 + seg.da, seg.da < 0);
    }
  }

  function cellSegs(x, y, conns) {
    if (conns === 'cross') {
      return [TE.lineSeg(...TE.edgePt(x, y, 0), ...TE.edgePt(x, y, 2)), TE.lineSeg(...TE.edgePt(x, y, 3), ...TE.edgePt(x, y, 1))];
    }
    const [a, b] = conns;
    if (a === opp(b)) return [TE.lineSeg(...TE.edgePt(x, y, a), ...TE.edgePt(x, y, b))];
    return [TE.arcSeg(x, y, a, b)];
  }

  function drawTracks(segs, o = {}) {
    if (!segs.length) return;
    const ballast = o.ballast === undefined ? COL.ballast : o.ballast;
    g.lineCap = 'butt';
    if (ballast) {
      g.save();
      g.translate(0.02, 0.045);
      strokePathButt(() => segs.forEach((s) => segPath(s, 0)), SHADOW, 0.56);
      g.restore();
      strokePathButt(() => segs.forEach((s) => segPath(s, 0)), '#fff', 0.56);
      strokePathButt(() => segs.forEach((s) => segPath(s, 0)), ballast, 0.44);
    }
    // sleepers
    for (const seg of segs) {
      const n = Math.max(1, Math.round(seg.len / 0.25));
      for (let k = 0; k < n; k++) {
        const p = TE.evalSeg(seg, ((k + 0.5) * seg.len) / n);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.ang);
        g.fillStyle = COL.tieDark;
        g.fillRect(-0.05, -0.215, 0.1, 0.45);
        g.fillStyle = COL.tie;
        g.fillRect(-0.04, -0.21, 0.08, 0.42);
        g.restore();
      }
    }
    // rails
    for (const off of [-0.12, 0.12]) {
      strokePathButt(() => segs.forEach((s) => segPath(s, off)), COL.rail, 0.06);
      strokePathButt(() => segs.forEach((s) => segPath(s, off - 0.012)), COL.railHi, 0.018);
    }
  }
  function strokePathButt(build, color, w) {
    g.beginPath(); build();
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'butt'; g.lineJoin = 'round';
    g.stroke();
  }

  // ------------------------------------------------------------ scenery
  function drawTree(cx, cy, v) {
    if (v < 0.5) {
      // round lollipop tree
      paper(() => rr(cx - 0.06, cy - 0.05, 0.12, 0.38, 0.03), '#9a6a4a', { sh: 0.04 });
      paper(() => {
        circle(cx, cy - 0.18, 0.26);
        circle(cx - 0.17, cy - 0.02, 0.18);
        circle(cx + 0.17, cy - 0.04, 0.19);
      }, v < 0.25 ? '#4caf50' : '#66bb6a');
      fillPath(() => circle(cx - 0.08, cy - 0.27, 0.08), 'rgba(255,255,255,0.28)');
      if (v < 0.15) {
        for (let i = 0; i < 3; i++) fillPath(() => circle(cx - 0.1 + i * 0.11, cy - 0.12 + (i % 2) * 0.1, 0.035), '#ff7043');
      }
    } else {
      // pine tree
      paper(() => rr(cx - 0.05, cy + 0.12, 0.1, 0.22, 0.02), '#8d5f45', { sh: 0.04 });
      paper(() => {
        poly([[cx, cy - 0.48], [cx + 0.22, cy - 0.12], [cx - 0.22, cy - 0.12]]);
        poly([[cx, cy - 0.3], [cx + 0.3, cy + 0.16], [cx - 0.3, cy + 0.16]]);
      }, v < 0.75 ? '#2e9e5b' : '#3fae6a');
      fillPath(() => poly([[cx, cy - 0.44], [cx - 0.08, cy - 0.2], [cx - 0.02, cy - 0.2]]), 'rgba(255,255,255,0.25)');
    }
  }
  function drawRock(cx, cy, v) {
    paper(() => poly([
      [cx - 0.32, cy + 0.22], [cx - 0.26, cy - 0.06], [cx - 0.06, cy - 0.22],
      [cx + 0.18, cy - 0.16], [cx + 0.32, cy + 0.04], [cx + 0.28, cy + 0.24],
    ]), v < 0.5 ? '#a9a2b4' : '#b8b0a6');
    fillPath(() => poly([[cx - 0.2, cy - 0.04], [cx - 0.05, cy - 0.16], [cx + 0.05, cy - 0.04]]), 'rgba(255,255,255,0.35)');
    if (v > 0.3) {
      paper(() => ellipse(cx + 0.22, cy + 0.2, 0.12, 0.08), '#9c95a6', { sh: 0.02, ow: 0.04 });
    }
  }
  function drawHouse(cx, cy, v) {
    const wall = ['#ffe0b2', '#fff3c4', '#e1f5fe'][Math.floor(v * 3)];
    const roof = ['#ef5350', '#5c6bc0', '#26a69a'][Math.floor(v * 3)];
    paper(() => rr(cx - 0.3, cy - 0.12, 0.6, 0.42, 0.03), wall);
    paper(() => poly([[cx - 0.4, cy - 0.08], [cx, cy - 0.44], [cx + 0.4, cy - 0.08]]), roof);
    fillPath(() => rr(cx - 0.08, cy + 0.06, 0.14, 0.24, [0.07, 0.07, 0, 0]), '#8d6e63');
    paper(() => rr(cx + 0.1, cy - 0.02, 0.13, 0.12, 0.02), '#81d4fa', { sh: 0, ow: 0.03 });
    fillPath(() => rr(cx + 0.13, cy - 0.42, 0.07, 0.14, 0.01), '#a1887f');
  }
  function drawMountain(x, y, v) {
    const cx = x + 0.5;
    const peak = y - 0.32 - v * 0.12;
    const base = y + 1.0;
    paper(() => poly([[x - 0.12, base], [cx + (v - 0.5) * 0.15, peak], [x + 1.12, base]]), COL.mountain, { ow: 0.06 });
    const px = cx + (v - 0.5) * 0.15;
    fillPath(() => poly([[px, peak], [x + 1.12, base], [px + 0.12, base]]), COL.mountainDark);
    const sy = peak + 0.38;
    paper(() => poly([
      [px, peak], [px + 0.2, sy], [px + 0.09, sy - 0.05], [px, sy + 0.04], [px - 0.1, sy - 0.05], [px - 0.2, sy],
    ]), COL.snow, { sh: 0, ow: 0.03, outline: '#eceaf5' });
  }
  function drawFlowers(x, y) {
    const n = 3 + Math.floor(hash(x, y, 7) * 3);
    const colors = ['#ff8a80', '#ffd54f', '#f48fb1', '#b39ddb', '#ffffff'];
    for (let i = 0; i < n; i++) {
      const fx = x + 0.15 + hash(x, y, i * 3) * 0.7;
      const fy = y + 0.15 + hash(x, y, i * 3 + 1) * 0.7;
      const c = colors[Math.floor(hash(x, y, i * 3 + 2) * colors.length)];
      g.fillStyle = '#5a9e3a';
      g.fillRect(fx - 0.006, fy, 0.012, 0.08);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        fillPath(() => circle(fx + Math.cos(a) * 0.04, fy + Math.sin(a) * 0.04, 0.035), c);
      }
      fillPath(() => circle(fx, fy, 0.025), '#ffb300');
    }
  }
  function drawTufts(x, y) {
    if (hash(x, y, 11) > 0.55) return;
    const n = 1 + Math.floor(hash(x, y, 12) * 2);
    g.strokeStyle = COL.grassDark;
    g.lineWidth = 0.025;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const tx = x + 0.2 + hash(x, y, 13 + i) * 0.6;
      const ty = y + 0.25 + hash(x, y, 17 + i) * 0.6;
      g.beginPath();
      g.moveTo(tx - 0.05, ty - 0.06); g.lineTo(tx - 0.02, ty);
      g.moveTo(tx, ty - 0.08); g.lineTo(tx, ty);
      g.moveTo(tx + 0.05, ty - 0.06); g.lineTo(tx + 0.02, ty);
      g.stroke();
    }
  }
  function drawSheep(cx, cy, t, hop) {
    const bob = Math.sin(t * 2 + cx * 3) * 0.015;
    const jump = hop ? Math.max(0, Math.sin(hop * Math.PI)) * 0.45 : 0;
    cy += bob - jump;
    if (jump) fillPath(() => ellipse(cx, cy + jump + 0.22, 0.22, 0.06), SHADOW);
    g.fillStyle = '#4a3f4f';
    for (const lx of [-0.12, -0.04, 0.06, 0.14]) g.fillRect(cx + lx - 0.02, cy + 0.08, 0.04, 0.14);
    paper(() => {
      circle(cx - 0.12, cy, 0.12);
      circle(cx, cy - 0.06, 0.14);
      circle(cx + 0.12, cy, 0.12);
      circle(cx, cy + 0.06, 0.12);
    }, '#ffffff', { outline: '#e2dbe6', ow: 0.04 });
    paper(() => ellipse(cx - 0.2, cy - 0.02, 0.08, 0.1), '#4a3f4f', { sh: 0, ow: 0.03 });
    fillPath(() => circle(cx - 0.22, cy - 0.04, 0.018), '#fff');
    fillPath(() => ellipse(cx - 0.25, cy - 0.08, 0.05, 0.025, -0.4), '#4a3f4f');
  }

  // ------------------------------------------------------------ animals (friends)
  function drawAnimalHead(kind, cx, cy, s, mood) {
    const k = s;
    if (kind === 'bunny') {
      paper(() => { ellipse(cx - 0.05 * k, cy - 0.17 * k, 0.035 * k, 0.1 * k, -0.15); ellipse(cx + 0.05 * k, cy - 0.17 * k, 0.035 * k, 0.1 * k, 0.15); }, '#fff', { outline: '#e8dfe8', ow: 0.025 * k, sh: 0 });
      fillPath(() => { ellipse(cx - 0.05 * k, cy - 0.17 * k, 0.015 * k, 0.07 * k, -0.15); ellipse(cx + 0.05 * k, cy - 0.17 * k, 0.015 * k, 0.07 * k, 0.15); }, '#f8bbd0');
      paper(() => circle(cx, cy, 0.1 * k), '#fff', { outline: '#e8dfe8', ow: 0.025 * k, sh: 0.02 * k });
    } else if (kind === 'bear') {
      paper(() => { circle(cx - 0.075 * k, cy - 0.075 * k, 0.04 * k); circle(cx + 0.075 * k, cy - 0.075 * k, 0.04 * k); circle(cx, cy, 0.1 * k); }, '#a1694a', { ow: 0.025 * k, sh: 0.02 * k });
      fillPath(() => ellipse(cx, cy + 0.035 * k, 0.045 * k, 0.035 * k), '#e6c3a4');
    } else if (kind === 'duck') {
      paper(() => circle(cx, cy, 0.1 * k), '#ffd54f', { ow: 0.025 * k, sh: 0.02 * k });
      fillPath(() => ellipse(cx, cy + 0.04 * k, 0.05 * k, 0.025 * k), '#ff9800');
    } else {
      paper(() => {
        poly([[cx - 0.1 * k, cy - 0.02 * k], [cx - 0.08 * k, cy - 0.14 * k], [cx - 0.02 * k, cy - 0.08 * k]]);
        poly([[cx + 0.1 * k, cy - 0.02 * k], [cx + 0.08 * k, cy - 0.14 * k], [cx + 0.02 * k, cy - 0.08 * k]]);
        circle(cx, cy, 0.1 * k);
      }, '#ffab61', { ow: 0.025 * k, sh: 0.02 * k });
    }
    // face
    const ey = cy - 0.015 * k;
    if (mood === 'dizzy') {
      g.strokeStyle = '#3b2f3f'; g.lineWidth = 0.014 * k;
      for (const ex of [-0.035, 0.035]) {
        g.beginPath();
        g.moveTo(cx + (ex - 0.015) * k, ey - 0.015 * k); g.lineTo(cx + (ex + 0.015) * k, ey + 0.015 * k);
        g.moveTo(cx + (ex + 0.015) * k, ey - 0.015 * k); g.lineTo(cx + (ex - 0.015) * k, ey + 0.015 * k);
        g.stroke();
      }
    } else {
      fillPath(() => { circle(cx - 0.035 * k, ey, 0.014 * k); circle(cx + 0.035 * k, ey, 0.014 * k); }, '#3b2f3f');
    }
    fillPath(() => { circle(cx - 0.06 * k, cy + 0.02 * k, 0.016 * k); circle(cx + 0.06 * k, cy + 0.02 * k, 0.016 * k); }, 'rgba(255,120,140,0.55)');
    if (kind !== 'duck') {
      g.strokeStyle = '#3b2f3f'; g.lineWidth = 0.012 * k;
      g.beginPath();
      if (mood === 'sad') g.arc(cx, cy + 0.06 * k, 0.02 * k, Math.PI * 1.15, Math.PI * 1.85);
      else g.arc(cx, cy + 0.02 * k, 0.022 * k, 0.2, Math.PI - 0.2);
      g.stroke();
    }
  }
  function drawFriend(kind, cx, cy, t, wave, mood) {
    const bob = Math.abs(Math.sin(t * (wave ? 9 : 3))) * (wave ? 0.12 : 0.03);
    fillPath(() => ellipse(cx, cy + 0.17, 0.11, 0.035), SHADOW);
    const body = { bunny: '#fff', bear: '#a1694a', duck: '#ffd54f', cat: '#ffab61' }[kind];
    paper(() => ellipse(cx, cy + 0.06 - bob, 0.08, 0.1), body, { ow: 0.03, sh: 0.02, outline: kind === 'bunny' ? '#e8dfe8' : '#fff' });
    if (wave) {
      const a = Math.sin(t * 12) * 0.5;
      strokePath(() => { g.moveTo(cx + 0.06, cy + 0.02 - bob); g.lineTo(cx + 0.06 + Math.cos(-1.2 + a) * 0.12, cy + 0.02 - bob + Math.sin(-1.2 + a) * 0.12); }, body, 0.05);
    }
    drawAnimalHead(kind, cx, cy - 0.1 - bob, 1.1, mood);
  }

  // ------------------------------------------------------------ station & start
  function drawStationBuilding(x, y, side, t, celebrating) {
    // x,y is the tile the building stands on.
    const cx = x + 0.5, cy = y + 0.55;
    paper(() => rr(cx - 0.42, cy - 0.2, 0.84, 0.5, 0.04), '#fff3e0');
    paper(() => poly([[cx - 0.5, cy - 0.16], [cx - 0.36, cy - 0.46], [cx + 0.36, cy - 0.46], [cx + 0.5, cy - 0.16]]), '#42a5f5');
    // scalloped awning
    for (let i = 0; i < 5; i++) {
      fillPath(() => g.arc(cx - 0.4 + i * 0.2, cy - 0.16, 0.1, 0, Math.PI), i % 2 ? '#fff' : '#ef5350');
    }
    fillPath(() => rr(cx - 0.09, cy + 0.02, 0.18, 0.28, [0.09, 0.09, 0, 0]), '#8d6e63');
    paper(() => rr(cx - 0.34, cy + 0.0, 0.16, 0.13, 0.02), '#81d4fa', { sh: 0, ow: 0.025 });
    paper(() => rr(cx + 0.18, cy + 0.0, 0.16, 0.13, 0.02), '#81d4fa', { sh: 0, ow: 0.025 });
    // clock
    paper(() => circle(cx, cy - 0.33, 0.09), '#fffde7', { sh: 0, ow: 0.03 });
    g.strokeStyle = '#5d4037'; g.lineWidth = 0.015;
    g.beginPath(); g.moveTo(cx, cy - 0.33); g.lineTo(cx, cy - 0.39); g.moveTo(cx, cy - 0.33); g.lineTo(cx + 0.04, cy - 0.33); g.stroke();
    // flag
    const fx = cx + 0.36, fy = cy - 0.46;
    g.fillStyle = '#6d4c41';
    g.fillRect(fx - 0.012, fy - 0.42, 0.024, 0.42);
    const wav = Math.sin(t * (celebrating ? 14 : 4)) * 0.04;
    paper(() => {
      g.moveTo(fx, fy - 0.42);
      g.quadraticCurveTo(fx + 0.14, fy - 0.42 + wav, fx + 0.28, fy - 0.36);
      g.lineTo(fx, fy - 0.26);
      g.closePath();
    }, '#ffca28', { sh: 0.02, ow: 0.03 });
    text('★', fx + 0.1, fy - 0.35, 0.09, { fill: '#ef5350' });
  }
  function drawStartSign(x, y) {
    const cx = x + 0.5, cy = y + 0.6;
    g.fillStyle = '#8d6e63';
    g.fillRect(cx - 0.02, cy - 0.2, 0.04, 0.38);
    paper(() => rr(cx - 0.3, cy - 0.36, 0.6, 0.22, 0.05), '#66bb6a');
    text('START', cx, cy - 0.245, 0.14, { fill: '#fff' });
  }

  // Pick a free neighbouring tile for a building (station) or sign (start).
  function freeNeighbour(board, x, y, prefs, taken) {
    for (const d of prefs) {
      const nx = x + DX[d], ny = y + DY[d];
      const c = TE.cellAt(board, nx, ny);
      if (c && !c.kind && (c.terrain === '.' || c.terrain === 'f') && !taken.has(`${nx},${ny}`)) return { x: nx, y: ny, d };
    }
    return null;
  }

  // ------------------------------------------------------------ pieces
  function slotRotDefault(id, slot) {
    const def = PIECES[id];
    if (!def.directional) return 0;
    for (const d of [1, 2, 3, 0]) {
      if (TE.connectsToward(state.board, slot.x - DX[d], slot.y - DY[d], d)) return d;
    }
    return 1;
  }

  // Ground part of a placed piece (on the card).
  function drawPieceGround(piece, x, y, board) {
    const conns = TE.pieceConns(piece.id, piece.rot);
    if (conns) {
      drawTracks(cellSegs(x, y, conns));
      return;
    }
    const d = piece.rot;
    if (piece.id === 'tunnel') {
      const reach = board ? TE.pieceReach(board, { x, y }, piece) : 0;
      drawTracks([TE.lineSeg(...TE.edgePt(x, y, opp(d)), ...TE.edgePt(x + DX[d] * reach, y + DY[d] * reach, d))]);
      return;
    }
    if (piece.id === 'jump') {
      drawTracks([TE.lineSeg(...TE.edgePt(x, y, opp(d)), x + 0.5, y + 0.5)]);
      g.save();
      g.translate(x + 0.5, y + 0.5);
      g.rotate(dirAngle(d));
      paper(() => poly([[-0.2, -0.3], [0.48, -0.36], [0.48, 0.36], [-0.2, 0.3]]), '#ffca28', { ow: 0.05 });
      for (let i = 0; i < 3; i++) {
        const sx = -0.1 + i * 0.2;
        fillPath(() => poly([[sx, -0.3], [sx + 0.1, -0.31], [sx + 0.1, 0.31], [sx, 0.3]]), '#ef5350');
      }
      // arrow
      fillPath(() => poly([[0.05, -0.14], [0.3, 0], [0.05, 0.14]]), '#fff');
      g.restore();
      return;
    }
    // bridges: just a little bit of track leading on
    drawTracks([TE.lineSeg(...TE.edgePt(x, y, opp(d)), ...TE.edgePt(x, y, opp(d)).map((v, i) => v + [DX[d], DY[d]][i] * 0.35))]);
  }

  function drawBridge(x, y, d, span, alpha) {
    const [x0, y0] = TE.edgePt(x, y, opp(d));
    const L = span + 1;
    g.save();
    if (alpha !== undefined) g.globalAlpha = alpha;
    // ground shadow
    g.save();
    g.translate(x0 + 0.04, y0 + 0.1);
    g.rotate(dirAngle(d));
    fillPath(() => rr(0.15, -0.28, L - 0.3, 0.56, 0.08), 'rgba(40,60,90,0.25)');
    g.restore();

    g.translate(x0, y0 - 0.1);
    g.rotate(dirAngle(d));
    // pillars at tile boundaries
    for (let k = 1; k <= span; k++) {
      for (const side of [-0.24, 0.24]) {
        paper(() => rr(k - 0.06, side - 0.06, 0.12, 0.12, 0.03), '#9e8f86', { sh: 0.1, ow: 0.03 });
      }
    }
    // ramps + deck
    paper(() => {
      g.moveTo(0, -0.24);
      g.lineTo(0.3, -0.3);
      g.lineTo(L - 0.3, -0.3);
      g.lineTo(L, -0.24);
      g.lineTo(L, 0.24);
      g.lineTo(L - 0.3, 0.3);
      g.lineTo(0.3, 0.3);
      g.lineTo(0, 0.24);
      g.closePath();
    }, COL.wood, { ow: 0.06, sh: 0.03 });
    g.strokeStyle = COL.woodDark;
    g.lineWidth = 0.018;
    g.beginPath();
    for (let px = 0.12; px < L - 0.05; px += 0.14) { g.moveTo(px, -0.28); g.lineTo(px, 0.28); }
    g.stroke();
    // rails
    for (const off of [-0.12, 0.12]) {
      strokePathButt(() => { g.moveTo(0, off); g.lineTo(L, off); }, COL.rail, 0.055);
    }
    // railings
    for (const side of [-0.32, 0.32]) {
      paper(() => rr(0.28, side - 0.035, L - 0.56, 0.07, 0.03), '#ef5350', { sh: 0, ow: 0.035 });
      for (let px = 0.35; px < L - 0.3; px += 0.3) fillPath(() => circle(px, side, 0.04), '#fff');
    }
    g.restore();
  }

  function drawPortal(ex, ey, faceDir) {
    // A tunnel mouth at edge point ex,ey; the mountain lies in direction faceDir.
    g.save();
    g.translate(ex, ey);
    g.rotate(dirAngle(faceDir));
    paper(() => rr(-0.1, -0.38, 0.26, 0.76, 0.12), COL.stone, { ow: 0.05 });
    fillPath(() => rr(-0.02, -0.26, 0.2, 0.52, [0.1, 0, 0, 0.1]), '#3a2f4a');
    g.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 4; i++) {
      g.beginPath(); circle(-0.05, -0.28 + i * 0.19, 0.035); g.fill();
    }
    g.restore();
  }

  // Over-the-top part of a placed piece (bridges, tunnel mouths, jump preview).
  function drawPieceOver(piece, x, y, board, showPreview) {
    const d = piece.rot;
    if (piece.id === 'bridge1' || piece.id === 'bridge2') {
      drawBridge(x, y, d, PIECES[piece.id].span);
    } else if (piece.id === 'tunnel') {
      const reach = TE.pieceReach(board, { x, y }, piece);
      if (reach > 0) {
        drawPortal(...TE.edgePt(x, y, d), d);
        const lx = x + DX[d] * reach, ly = y + DY[d] * reach;
        drawPortal(...TE.edgePt(lx, ly, d), opp(d));
      } else {
        drawPortal(...TE.edgePt(x, y, d), d);
      }
    } else if (piece.id === 'jump' && showPreview) {
      const span = PIECES.jump.span + 1;
      const x0 = x + 0.5, y0 = y + 0.5;
      g.save();
      g.setLineDash([0.08, 0.1]);
      g.lineDashOffset = -state.time * 0.4;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 0.06;
      g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const u = i / 30;
        const px = x0 + DX[d] * span * u;
        const py = y0 + DY[d] * span * u - 0.22 * span * Math.sin(Math.PI * u);
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.stroke();
      g.restore();
      const lx = x0 + DX[d] * span, ly = y0 + DY[d] * span;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 0.05;
      g.beginPath(); circle(lx, ly, 0.2); g.stroke();
      g.beginPath(); circle(lx, ly, 0.08); g.stroke();
    }
  }

  // ------------------------------------------------------------ layers
  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    return c;
  }
  function worldTransform(ctx, sx, sy) {
    const { dpr, T, ox, oy } = view;
    ctx.setTransform(dpr * T, 0, 0, dpr * T, dpr * (ox + (sx || 0) * T), dpr * (oy + (sy || 0) * T));
  }

  let paperPattern = null;
  function getPaperPattern(ctx) {
    if (paperPattern) return paperPattern;
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    const pc = c.getContext('2d');
    const img = pc.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 22;
    }
    pc.putImageData(img, 0, 0);
    pc.strokeStyle = 'rgba(255,255,255,0.12)';
    pc.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      pc.beginPath();
      const x = Math.random() * 160, y = Math.random() * 160, a = Math.random() * Math.PI;
      pc.moveTo(x, y); pc.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
      pc.stroke();
    }
    paperPattern = ctx.createPattern(c, 'repeat');
    return paperPattern;
  }

  function isWater(board, x, y) {
    const c = TE.cellAt(board, x, y);
    return !!c && !c.kind && c.terrain === '~';
  }

  function buildLayers() {
    const board = state.board;
    groundLayer = makeLayer();
    tallLayer = makeLayer();

    // ---- ground
    g = groundLayer.getContext('2d');
    worldTransform(g);
    const m = 0.28;
    paper(() => rr(-m, -m, board.w + m * 2, board.h + m * 2, 0.3), COL.grass, { ow: 0.12, sh: 0.1 });
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        if ((x + y) % 2 === 0) { g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, y, 1, 1); }
      }
    }
    // water as one paper cut-out
    const waterTiles = [];
    for (let y = 0; y < board.h; y++) for (let x = 0; x < board.w; x++) if (isWater(board, x, y)) waterTiles.push([x, y]);
    if (waterTiles.length) {
      const R = 0.3;
      const build = () => {
        for (const [x, y] of waterTiles) {
          const n = isWater(board, x, y - 1), s = isWater(board, x, y + 1), w = isWater(board, x - 1, y), e = isWater(board, x + 1, y);
          rr(x, y, 1, 1, [!n && !w ? R : 0, !n && !e ? R : 0, !s && !e ? R : 0, !s && !w ? R : 0]);
        }
      };
      paper(build, COL.water, { ow: 0.08, sh: 0.0 });
      // deeper water in the middle
      g.save();
      g.beginPath(); build(); g.clip();
      g.fillStyle = COL.waterDeep;
      for (const [x, y] of waterTiles) {
        g.beginPath();
        ellipse(x + 0.5, y + 0.5, 0.3 + hash(x, y, 5) * 0.12, 0.22 + hash(x, y, 6) * 0.1);
        g.fill();
      }
      g.restore();
    }
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const c = board.cells[y][x];
        if (c.kind) continue;
        if (c.terrain === 'f' && !state.decor.taken.has(`${x},${y}`)) drawFlowers(x, y);
        else if (c.terrain === '.') drawTufts(x, y);
      }
    }
    // fixed track
    const segs = [];
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const c = board.cells[y][x];
        if (c.kind === 'track') segs.push(...cellSegs(x, y, c.conns));
      }
    }
    const st = board.station;
    const sdirs = st.dirs.length ? st.dirs : [1, 3];
    for (const d of sdirs) segs.push(TE.lineSeg(...TE.edgePt(st.x, st.y, d), st.x + 0.5, st.y + 0.5));
    // station platform
    const b = state.decor.building;
    if (b) {
      const px = st.x + 0.5 + DX[b.d] * 0.38, py = st.y + 0.5 + DY[b.d] * 0.38;
      const horiz = DY[b.d] !== 0;
      paper(() => rr(px - (horiz ? 0.5 : 0.12), py - (horiz ? 0.12 : 0.5), horiz ? 1 : 0.24, horiz ? 0.24 : 1, 0.04), '#cfc6d8', { ow: 0.04, sh: 0.03 });
    }
    drawTracks(segs);
    // buffer stop at the station if it's a dead end
    if (sdirs.length === 1) {
      const d = sdirs[0];
      g.save();
      g.translate(st.x + 0.5, st.y + 0.5);
      g.rotate(dirAngle(opp(d)));
      paper(() => rr(0.1, -0.24, 0.12, 0.48, 0.04), '#ef5350', { ow: 0.04 });
      g.restore();
    }
    // paper texture
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = getPaperPattern(g);
    g.globalCompositeOperation = 'source-atop';
    g.fillRect(0, 0, groundLayer.width, groundLayer.height);
    g.globalCompositeOperation = 'source-over';

    // ---- tall scenery
    g = tallLayer.getContext('2d');
    worldTransform(g);
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const c = board.cells[y][x];
        if (c.kind) continue;
        const v = hash(x, y, 1);
        if (c.terrain === 'M') drawMountain(x, y, v);
      }
      for (let x = 0; x < board.w; x++) {
        const c = board.cells[y][x];
        if (c.kind) continue;
        const v = hash(x, y, 1);
        if (c.terrain === 'T') drawTree(x + 0.5, y + 0.55, v);
        else if (c.terrain === 'R') drawRock(x + 0.5, y + 0.55, v);
        else if (c.terrain === 'h') drawHouse(x + 0.5, y + 0.55, v);
      }
    }
    if (state.decor.sign) drawStartSign(state.decor.sign.x, state.decor.sign.y);
    g = mainCtx;
  }

  // ------------------------------------------------------------ train
  function carPose(i, trip, s) {
    const p = trip.pointAt(Math.max(0.05, s - i * CAR_SPACING));
    return p;
  }

  function engineFace(cx, cy, mood) {
    paper(() => circle(cx, cy, 0.13), '#ffe9c7', { ow: 0.035, sh: 0.02 });
    const ey = cy - 0.025;
    if (mood === 'dizzy') {
      g.strokeStyle = '#3b2f3f'; g.lineWidth = 0.02;
      for (const ex of [-0.045, 0.045]) {
        g.beginPath();
        g.moveTo(cx + ex - 0.02, ey - 0.02); g.lineTo(cx + ex + 0.02, ey + 0.02);
        g.moveTo(cx + ex + 0.02, ey - 0.02); g.lineTo(cx + ex - 0.02, ey + 0.02);
        g.stroke();
      }
      paper(() => ellipse(cx, cy + 0.055, 0.03, 0.035), '#6d2f3a', { sh: 0, outline: null });
    } else {
      fillPath(() => { circle(cx - 0.045, ey, 0.02); circle(cx + 0.045, ey, 0.02); }, '#3b2f3f');
      fillPath(() => { circle(cx - 0.04, ey - 0.007, 0.007); circle(cx + 0.05, ey - 0.007, 0.007); }, '#fff');
      fillPath(() => { circle(cx - 0.085, cy + 0.03, 0.022); circle(cx + 0.085, cy + 0.03, 0.022); }, 'rgba(255,110,130,0.55)');
      g.strokeStyle = '#3b2f3f'; g.lineWidth = 0.016; g.lineCap = 'round';
      g.beginPath();
      if (mood === 'happy') {
        fillPath(() => { g.moveTo(cx - 0.05, cy + 0.03); g.arc(cx, cy + 0.03, 0.05, 0, Math.PI); g.closePath(); }, '#6d2f3a');
      } else {
        g.arc(cx, cy + 0.025, 0.04, 0.25, Math.PI - 0.25);
        g.stroke();
      }
    }
  }

  function drawCar(i, pose, o = {}) {
    const elev = pose.elev || 0;
    const scale = (o.scale === undefined ? 1 : o.scale) * (1 + elev * 0.5);
    if (scale <= 0.01) return;
    const alpha = o.alpha === undefined ? 1 : o.alpha;
    g.save();
    g.globalAlpha = alpha;
    if (elev > 0.01) {
      const sr = 1 - Math.min(0.5, elev * 0.6);
      fillPath(() => ellipse(pose.x, pose.y + 0.04, 0.32 * sr, 0.24 * sr, pose.ang), 'rgba(40,40,60,0.25)');
    }
    const cx = pose.x, cy = pose.y - elev;
    g.translate(cx, cy);
    g.scale(scale, scale);
    g.save();
    g.rotate(pose.ang + (o.spin || 0));
    // wheels
    g.fillStyle = '#3b3346';
    for (const wx of [-0.17, 0.17]) for (const wy of [-0.24, 0.24]) {
      g.beginPath(); rr(wx - 0.07, wy - 0.035, 0.14, 0.07, 0.03); g.fill();
    }
    if (i === 0) {
      paper(() => rr(-0.32, -0.21, 0.64, 0.42, 0.12), COL.engine, { ow: 0.06, sh: 0.05 });
      fillPath(() => rr(-0.32, -0.21, 0.24, 0.42, [0.12, 0, 0, 0.12]), COL.engineDark);
      paper(() => rr(-0.29, -0.17, 0.18, 0.34, 0.05), '#ffca28', { ow: 0.03, sh: 0 });
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(-0.02, -0.2, 0.035, 0.4);
      g.fillRect(0.1, -0.2, 0.035, 0.4);
      paper(() => circle(0.0, 0, 0.085), '#3b3346', { ow: 0.03, sh: 0.02 });
      fillPath(() => circle(0.0, 0, 0.045), '#1f1a26');
    } else {
      const color = COL.cars[(i - 1) % COL.cars.length];
      paper(() => rr(-0.3, -0.2, 0.6, 0.4, 0.08), color, { ow: 0.06, sh: 0.05 });
      fillPath(() => rr(-0.24, -0.14, 0.48, 0.28, 0.05), 'rgba(0,0,0,0.12)');
    }
    g.restore();
    if (i === 0) {
      // the face always stays upright so it's easy to see
      const fx = Math.cos(pose.ang + (o.spin || 0)) * 0.22, fy = Math.sin(pose.ang + (o.spin || 0)) * 0.22;
      engineFace(fx, fy - 0.02, o.mood);
    } else {
      // passengers / cargo
      const riders = state.passengers.filter((p, k) => (k % (N_CARS - 1)) === i - 1);
      if (riders.length) {
        riders.forEach((r, k) => {
          const off = (k - (riders.length - 1) / 2) * 0.2;
          const px = Math.cos(pose.ang + (o.spin || 0)) * off, py = Math.sin(pose.ang + (o.spin || 0)) * off;
          drawAnimalHead(r, px, py - 0.03, 1, o.mood === 'dizzy' ? 'dizzy' : null);
        });
      } else if (i === 2) {
        const balls = ['#ff7043', '#66bb6a', '#ffee58'];
        balls.forEach((c, k) => {
          const off = (k - 1) * 0.14;
          paper(() => circle(Math.cos(pose.ang) * off, Math.sin(pose.ang) * off, 0.065), c, { ow: 0.025, sh: 0.015 });
        });
      }
    }
    g.restore();
  }

  function isHidden(pose) {
    if (pose.lift !== 'tunnel') return false;
    return TE.isMountain(state.board, Math.floor(pose.x), Math.floor(pose.y));
  }

  function trainPoses() {
    const trip = state.mode === 'edit' ? state.idleTrip : state.trip;
    const s = state.mode === 'edit' ? START_S : state.s;
    const poses = [];
    for (let i = 0; i < N_CARS; i++) poses.push(carPose(i, trip, s));
    return poses;
  }

  function drawCoupler(a, b) {
    if (!a || !b) return;
    if (Math.abs((a.elev || 0) - (b.elev || 0)) > 0.3) return;
    strokePath(() => { g.moveTo(a.x, a.y - (a.elev || 0)); g.lineTo(b.x, b.y - (b.elev || 0)); }, '#3b3346', 0.06);
  }

  function drawTrain(elevated) {
    if (state.debris.length) {
      if (elevated) return;
      for (let i = state.debris.length - 1; i >= 0; i--) {
        const d = state.debris[i];
        if (d.gone) continue;
        const sink = d.sink || 0;
        drawCar(d.i, { x: d.x, y: d.y, ang: d.ang, elev: d.z }, {
          scale: 1 - sink * 0.9, alpha: 1 - sink * 0.7, mood: 'dizzy',
        });
      }
      return;
    }
    const poses = trainPoses();
    const mood = state.mode === 'win' ? 'happy' : (state.crashReason ? 'dizzy' : null);
    const scale = state.trainPop;
    for (let i = N_CARS - 1; i >= 0; i--) {
      const p = poses[i];
      const up = (p.elev || 0) > 0.01;
      if (up !== elevated || isHidden(p)) continue;
      if (i > 0 && !isHidden(poses[i - 1]) && ((poses[i - 1].elev || 0) > 0.01) === elevated) drawCoupler(poses[i - 1], p);
      drawCar(i, p, { mood, scale });
    }
  }

  // ------------------------------------------------------------ effects
  function addParticle(p) { state.particles.push(Object.assign({ age: 0, vx: 0, vy: 0, vr: 0, rot: 0 }, p)); }

  function puff(x, y, n, color, spread) {
    for (let k = 0; k < n; k++) {
      addParticle({
        type: 'smoke', x: x + rand(-0.1, 0.1), y: y + rand(-0.1, 0.1),
        vx: rand(-1, 1) * (spread || 0.4), vy: rand(-1, 0.3) * (spread || 0.4) - 0.2,
        r: rand(0.08, 0.16), grow: 0.5, life: rand(0.6, 1.1), color: color || '#fff',
      });
    }
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.g) p.vy += p.g * dt;
      if (p.drag) { p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt); }
      if (p.grow) p.r += p.grow * dt * 0.3;
    }
    state.particles = state.particles.filter((p) => p.age < p.life);
  }

  function drawParticles() {
    for (const p of state.particles) {
      const t = p.age / p.life;
      g.save();
      g.globalAlpha = p.fade === false ? 1 : 1 - t * t;
      if (p.type === 'smoke') {
        paper(() => circle(p.x, p.y, p.r), p.color, { sh: 0, ow: 0.02, outline: 'rgba(200,190,210,0.6)' });
      } else if (p.type === 'confetti') {
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.cos(p.age * p.flip));
        g.fillStyle = p.color;
        g.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      } else if (p.type === 'drop') {
        fillPath(() => circle(p.x, p.y, p.r), p.color);
      } else if (p.type === 'star') {
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        paper(() => star(0, 0, p.r, p.r * 0.45, 5, 0), p.color, { sh: 0, ow: 0.03 });
      } else if (p.type === 'heart') {
        paper(() => heart(p.x, p.y, p.r), p.color, { sh: 0, ow: 0.03 });
      } else if (p.type === 'leaf') {
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        fillPath(() => ellipse(0, 0, p.r, p.r * 0.5), p.color);
      } else if (p.type === 'ring') {
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = 0.05;
        g.beginPath(); ellipse(p.x, p.y, p.r + t * 0.6, (p.r + t * 0.6) * 0.6); g.stroke();
      } else if (p.type === 'text') {
        text(p.text, p.x, p.y, p.r, { fill: p.color, stroke: '#fff', sw: 0.06 });
      }
      g.restore();
    }
  }

  function addBurst(textStr, x, y, color, edge) {
    const bx = clamp(x, 1.1, state.board.w - 1.1);
    const by = clamp(y - 0.6, 0.9, state.board.h - 0.6);
    state.bursts.push({ text: textStr, x: bx, y: by, color, edge: edge || '#d84315', age: 0, rot: rand(-0.18, 0.18) });
  }
  function drawBursts() {
    for (const b of state.bursts) {
      const t = Math.min(1, b.age / 0.35);
      const s = 0.85 * easeOutBack(t) * (1 + Math.sin(b.age * 6) * 0.03);
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.rot);
      g.scale(s, s);
      paper(() => star(0, 0, 1.0, 0.72, 12, b.age * 0.3), b.edge, { ow: 0.1, sh: 0.08 });
      paper(() => star(0, 0, 0.82, 0.6, 12, b.age * 0.3), b.color, { outline: null, sh: 0 });
      text(b.text, 0, 0.02, b.text.length > 6 ? 0.3 : 0.38, { fill: '#fff', stroke: b.edge, sw: 0.1, weight: 700 });
      g.restore();
    }
  }

  function drawMarker() {
    const m = state.marker;
    if (!m) return;
    const cx = clamp(m.x + 0.5, 0.3, state.board.w - 0.3);
    const cy = clamp(m.y + 0.5, 0.3, state.board.h - 0.3);
    const pulse = 1 + Math.sin(state.time * 4) * 0.06;
    g.save();
    g.translate(cx, cy);
    g.scale(pulse, pulse);
    g.rotate(0.15);
    paper(() => circle(0, 0, 0.26), '#ef5350', { ow: 0.06 });
    strokePath(() => { g.moveTo(-0.1, -0.1); g.lineTo(0.1, 0.1); g.moveTo(0.1, -0.1); g.lineTo(-0.1, 0.1); }, '#fff', 0.06);
    g.restore();
  }

  // ------------------------------------------------------------ slots & friends
  function drawSlots() {
    const board = state.board;
    const editing = state.mode === 'edit';
    board.slots.forEach((slot, i) => {
      const piece = state.placements[i];
      const sel = editing && state.selected === i;
      const { x, y } = slot;
      if (!piece) {
        const pulse = sel ? 0.5 + 0.5 * Math.sin(state.time * 5) : 0;
        if (sel) {
          g.save();
          g.globalAlpha = 0.5 + pulse * 0.5;
          strokePath(() => rr(x + 0.02, y + 0.02, 0.96, 0.96, 0.18), '#ffeb3b', 0.12);
          g.restore();
        }
        fillPath(() => rr(x + 0.08, y + 0.08, 0.84, 0.84, 0.14), 'rgba(255,255,255,0.35)');
        g.save();
        g.setLineDash([0.1, 0.08]);
        g.lineDashOffset = -state.time * 0.3;
        strokePath(() => rr(x + 0.08, y + 0.08, 0.84, 0.84, 0.14), '#fff', 0.05);
        g.restore();
        const bounce = Math.abs(Math.sin(state.time * 3 + i)) * 0.06;
        text('?', x + 0.5, y + 0.52 - bounce, 0.55, { fill: sel ? '#ff9800' : '#fff', stroke: sel ? '#fff' : 'rgba(80,120,60,0.6)', sw: 0.08 });
      } else {
        if (sel) {
          const pulse = 0.5 + 0.5 * Math.sin(state.time * 5);
          g.save();
          g.globalAlpha = 0.55 + pulse * 0.45;
          strokePath(() => rr(x - 0.02, y - 0.02, 1.04, 1.04, 0.2), '#ffeb3b', 0.12);
          g.restore();
        }
        paper(() => rr(x + 0.04, y + 0.04, 0.92, 0.92, 0.14), COL.card, { ow: 0.05, sh: 0.05 });
        drawPieceGround(piece, x, y, board);
      }
    });
  }
  function drawSlotsOver() {
    const showPreview = state.mode === 'edit';
    state.board.slots.forEach((slot, i) => {
      const piece = state.placements[i];
      if (piece) drawPieceOver(piece, slot.x, slot.y, state.board, showPreview);
    });
    // little "turn me" badge on the selected filled slot
    if (state.mode === 'edit') {
      const slot = state.board.slots[state.selected];
      const piece = slot && state.placements[state.selected];
      if (piece && PIECES[piece.id].rotations > 1) {
        const bx = slot.x + 0.86, by = slot.y + 0.14;
        paper(() => circle(bx, by, 0.15), '#ff9800', { ow: 0.04, sh: 0.03 });
        text('↻', bx, by + 0.01, 0.22, { fill: '#fff' });
      }
    }
  }

  function friendSpot(pk) {
    const c = state.board.cells[pk.y][pk.x];
    const conns = c.conns === 'cross' ? [0, 1, 2, 3] : c.conns;
    // stand on a side the track doesn't use, otherwise in a corner
    for (const d of [2, 1, 3, 0]) {
      if (!conns.includes(d)) return { x: pk.x + 0.5 + DX[d] * 0.33, y: pk.y + 0.5 + DY[d] * 0.33 };
    }
    return { x: pk.x + 0.82, y: pk.y + 0.82 };
  }
  function drawFriends() {
    const picked = new Set();
    if (state.mode !== 'edit' && state.trip) {
      for (let k = 0; k < state.eventIdx; k++) picked.add(state.trip.events[k].pickup);
    }
    const missing = state.mode === 'missed' && state.trip && state.trip.end ? new Set(state.trip.end.missing) : null;
    state.board.pickups.forEach((pk, i) => {
      if (picked.has(i)) return;
      const spot = friendSpot(pk);
      const wave = missing ? missing.has(i) : false;
      drawFriend(ANIMALS[i % ANIMALS.length], spot.x, spot.y, state.time + i, wave, wave ? 'sad' : null);
      if (wave) {
        const bx = spot.x + 0.35, by = spot.y - 0.62;
        paper(() => rr(bx - 0.5, by - 0.17, 1.0, 0.34, 0.15), '#fff', { outline: '#ffb74d', ow: 0.04 });
        text('Wait for me!', bx, by + 0.01, 0.15, { fill: '#e65100' });
      }
    });
  }

  function drawSheepAll(onlyHopping) {
    const board = state.board;
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const c = board.cells[y][x];
        if (c.kind || c.terrain !== 's') continue;
        const hopping = !!state.hopSheep && state.hopSheep.x === x && state.hopSheep.y === y;
        if (hopping !== !!onlyHopping) continue;
        let hop = 0, dx = 0;
        if (hopping) {
          const t = state.hopSheep.t;
          hop = (t % 0.5) / 0.5;
          if (t > 1.5) hop = 0;
          dx = Math.min(1, t / 1.5) * 0.25 * state.hopSheep.dir;
        }
        drawSheep(x + 0.5 + dx, y + 0.55, state.time, hop);
      }
    }
  }

  function drawWaterSparkles() {
    const board = state.board;
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 0.035;
    g.lineCap = 'round';
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        if (!isWater(board, x, y)) continue;
        for (let k = 0; k < 2; k++) {
          const ph = hash(x, y, 30 + k) * Math.PI * 2;
          const wx = x + 0.25 + hash(x, y, 40 + k) * 0.5 + Math.sin(state.time * 0.8 + ph) * 0.06;
          const wy = y + 0.25 + hash(x, y, 50 + k) * 0.5;
          g.beginPath();
          g.moveTo(wx - 0.12, wy);
          g.quadraticCurveTo(wx - 0.06, wy - 0.06, wx, wy);
          g.quadraticCurveTo(wx + 0.06, wy + 0.06, wx + 0.12, wy);
          g.stroke();
        }
      }
    }
  }

  // ------------------------------------------------------------ render
  function render() {
    g = mainCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!state.board || !groundLayer) return;
    const shx = state.shake ? rand(-1, 1) * state.shake : 0;
    const shy = state.shake ? rand(-1, 1) * state.shake : 0;
    const px = shx * view.T * view.dpr, py = shy * view.T * view.dpr;

    g.drawImage(groundLayer, px, py);
    worldTransform(g, shx, shy);
    drawWaterSparkles();
    drawSlots();
    drawMarker();
    drawFriends();
    drawTrain(false);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(tallLayer, px, py);
    worldTransform(g, shx, shy);
    drawSheepAll();
    const b = state.decor.building;
    if (b) drawStationBuilding(b.x, b.y, b.d, state.time, state.mode === 'win');
    drawSlotsOver();
    drawSheepAll(true);
    drawTrain(true);
    drawParticles();
    drawBursts();
  }

  // ------------------------------------------------------------ game flow
  function loadLevel(i) {
    state.levelIndex = clamp(i, 0, LEVELS.length - 1);
    state.level = LEVELS[state.levelIndex];
    state.board = TE.parseLevel(state.level);
    state.placements = new Array(state.board.slots.length).fill(null);
    state.selected = 0;
    state.idleTrip = new TE.Trip(state.board, []);
    state.marker = null;
    const taken = new Set();
    const st = state.board.station;
    const sdirs = st.dirs.length ? st.dirs : [1, 3];
    const vertical = sdirs.every((d) => d === 0 || d === 2);
    const prefs = vertical ? [3, 1, 0, 2] : [0, 2, 3, 1];
    const building = freeNeighbour(state.board, st.x, st.y, prefs.filter((d) => !sdirs.includes(d)), taken);
    if (building) taken.add(`${building.x},${building.y}`);
    const sp = state.board.start;
    const sign = freeNeighbour(state.board, sp.x, sp.y, [0, 2, 3, 1], taken);
    if (sign) taken.add(`${sign.x},${sign.y}`);
    state.decor = { building, sign, taken };
    resetTrain(false);
    titleEl.innerHTML = `<span class="lvl">Level ${state.levelIndex + 1}</span> ${escapeHtml(state.level.name)}`;
    buildTray();
    resize();
    showHint(state.level.hint, 0);
    hideOverlay();
    updateButtons();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function resetTrain(pop) {
    state.mode = 'edit';
    state.trip = null;
    state.s = START_S;
    state.v = 0;
    state.debris = [];
    state.bursts = [];
    state.passengers = [];
    state.eventIdx = 0;
    state.crashReason = null;
    state.hopSheep = null;
    state.shake = 0;
    state.modeTime = 0;
    state.trainPop = pop ? 0 : 1;
    if (pop) {
      const poses = trainPoses();
      for (const p of poses) puff(p.x, p.y, 4, '#fff', 0.6);
      Sound.poof();
    }
    updateButtons();
  }

  function go() {
    if (state.mode === 'run') {
      resetTrain(true);
      return;
    }
    if (state.mode !== 'edit') return;
    Sound.unlock();
    state.trip = new TE.Trip(state.board, state.placements.slice());
    state.mode = 'run';
    state.modeTime = 0;
    state.s = START_S;
    state.v = 0.3;
    state.eventIdx = 0;
    state.passengers = [];
    state.marker = null;
    state.trainPop = 1;
    hideHint();
    Sound.whistle();
    updateButtons();
  }

  function setMode(m) {
    state.mode = m;
    state.modeTime = 0;
    updateButtons();
  }

  function update(dt) {
    state.time += dt;
    state.modeTime += dt;
    state.shake = Math.max(0, state.shake - dt * 1.2);
    if (state.trainPop < 1) state.trainPop = Math.min(1, state.trainPop + dt * 3);
    if (state.hopSheep) state.hopSheep.t += dt;
    for (const b of state.bursts) b.age += dt;
    if (state.hintTimer > 0) {
      state.hintTimer -= dt;
      if (state.hintTimer <= 0) hideHint();
    }

    if (state.mode === 'run') updateRun(dt);
    else if (state.mode === 'crash') {
      updateDebris(dt);
      if (state.modeTime > 2.8) {
        resetTrain(true);
        showHint(tryAgainText(), 3);
      }
    } else if (state.mode === 'missed') {
      if (state.modeTime > 2.6) {
        resetTrain(true);
        showHint('Go back and pick up everyone!', 3);
      }
    } else if (state.mode === 'win') {
      if (Math.random() < dt * 20 && state.modeTime < 2) confetti(3);
      if (state.modeTime > 1.6 && !overlayShown) showWin();
    }
    updateParticles(dt);
  }

  function updateRun(dt) {
    const trip = state.trip;
    trip.extendTo(state.s + 2);
    let target = MAX_SPEED;
    if (trip.end && (trip.end.type === 'win' || trip.end.type === 'missed')) {
      const left = trip.end.at - state.s;
      target = Math.min(MAX_SPEED, Math.sqrt(2 * 3 * Math.max(0, left)) + 0.25);
    }
    if (state.v < target) state.v = Math.min(target, state.v + 2.2 * dt);
    else state.v = target;
    const ds = state.v * dt;
    state.s += ds;
    // chug + smoke
    state.chugAcc += ds;
    if (state.chugAcc > 0.45) {
      state.chugAcc = 0;
      Sound.chug();
    }
    state.smokeAcc += dt;
    const head = trip.pointAt(state.s);
    if (state.smokeAcc > 0.12 && head && !isHidden(head)) {
      state.smokeAcc = 0;
      addParticle({
        type: 'smoke', x: head.x, y: head.y - (head.elev || 0) - 0.1,
        vx: rand(-0.15, 0.15), vy: -0.45, r: 0.07, grow: 0.9, life: 1.0, color: '#fff',
      });
    }
    // pickups
    while (state.eventIdx < trip.events.length && trip.events[state.eventIdx].at <= state.s) {
      const ev = trip.events[state.eventIdx++];
      state.passengers.push(ANIMALS[ev.pickup % ANIMALS.length]);
      const spot = friendSpot(state.board.pickups[ev.pickup]);
      for (let k = 0; k < 5; k++) {
        addParticle({ type: 'heart', x: spot.x, y: spot.y - 0.2, vx: rand(-0.5, 0.5), vy: rand(-1.2, -0.6), r: 0.1, life: 1, color: '#ff6f91' });
      }
      Sound.pickup();
    }
    if (trip.end && state.s >= trip.end.at) {
      state.s = trip.end.at;
      endTrip(trip.end);
    }
  }

  function tryAgainText() {
    const msgs = ['Oops! Try a different piece!', 'Uh-oh! Let’s try again!', 'Whoopsie! Try another way!', 'Almost! Try again!'];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  function endTrip(end) {
    if (end.type === 'win') return startWin();
    if (end.type === 'missed') {
      setMode('missed');
      Sound.missed();
      return;
    }
    startCrash(end);
  }

  function startCrash(end) {
    const reason = end.reason;
    state.crashReason = reason;
    const poses = trainPoses();
    const head = poses[0];
    const gentle = reason === 'bonk' || reason === 'baa' || reason === 'dizzy';
    const wet = reason === 'splash';
    state.debris = poses.map((p, i) => {
      const fwd = gentle ? -0.4 : wet ? 0.7 * (1 - i * 0.3) : 2.2 * (1 - i * 0.18);
      const side = gentle ? 0 : wet ? 0.3 : 1.2;
      return {
        i, x: p.x, y: p.y, z: p.elev || 0, ang: p.ang,
        vx: Math.cos(p.ang) * fwd + rand(-side, side),
        vy: Math.sin(p.ang) * fwd + rand(-side, side),
        vz: gentle ? rand(0.8, 1.4) : wet ? rand(0.6, 1.2) : rand(2, 3.5),
        va: gentle ? rand(-1, 1) : wet ? rand(-2, 2) : rand(-9, 9),
        sink: 0,
      };
    });
    state.marker = { x: end.x, y: end.y };
    setMode('crash');
    const hx = head.x, hy = head.y;
    if (reason === 'splash') {
      addBurst('SPLASH!', hx, hy, '#4fc3f7', '#0277bd');
      for (let k = 0; k < 26; k++) {
        addParticle({ type: 'drop', x: hx, y: hy, vx: rand(-1.6, 1.6), vy: rand(-3.2, -1), g: 6, r: rand(0.03, 0.07), life: rand(0.7, 1.2), color: k % 3 ? '#b3e5fc' : '#fff' });
      }
      for (let k = 0; k < 3; k++) addParticle({ type: 'ring', x: hx, y: hy, r: 0.1 + k * 0.15, life: 1.4 + k * 0.3 });
      Sound.splash();
      state.shake = 0.12;
    } else if (reason === 'bonk') {
      addBurst('BONK!', hx, hy, '#ffd54f', '#e65100');
      for (let k = 0; k < 8; k++) {
        addParticle({ type: 'leaf', x: hx + rand(-0.3, 0.3), y: hy - 0.5, vx: rand(-0.6, 0.6), vy: rand(-0.4, 0.4), g: 0.8, r: 0.07, vr: rand(-4, 4), life: 1.8, color: k % 2 ? '#66bb6a' : '#43a047' });
      }
      dizzyStars(hx, hy);
      Sound.bonk();
      state.shake = 0.2;
    } else if (reason === 'baa') {
      addBurst('BAAA!', hx, hy, '#f8bbd0', '#ad1457');
      const dir = Math.abs(Math.cos(head.ang)) > 0.5 ? 0 : 1;
      state.hopSheep = { x: end.x, y: end.y, t: 0, dir: dir ? 1 : (Math.random() < 0.5 ? -1 : 1) };
      for (let k = 0; k < 4; k++) addParticle({ type: 'text', text: '♪', x: end.x + 0.5 + rand(-0.3, 0.3), y: end.y + 0.2, vx: rand(-0.3, 0.3), vy: -0.6, r: 0.25, life: 1.5, color: '#ec407a' });
      dizzyStars(hx, hy);
      Sound.baa();
      state.shake = 0.1;
    } else if (reason === 'dizzy') {
      addBurst('DIZZY!', hx, hy, '#ce93d8', '#6a1b9a');
      dizzyStars(hx, hy);
      Sound.dizzy();
    } else {
      addBurst(reason === 'edge' ? 'KER-PLUNK!' : 'CRASH!', hx, hy, '#ffca28', '#d84315');
      for (let k = 0; k < 10; k++) puff(hx, hy, 1, '#e8d9b8', 1.2);
      for (let k = 0; k < 8; k++) {
        addParticle({ type: 'star', x: hx, y: hy, vx: rand(-2, 2), vy: rand(-2.5, 0.5), g: 3, r: rand(0.07, 0.12), vr: rand(-6, 6), life: 1.2, color: k % 2 ? '#ffeb3b' : '#ff7043' });
      }
      Sound.crash();
      state.shake = 0.3;
    }
  }

  function dizzyStars(x, y) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      addParticle({ type: 'star', x: x + Math.cos(a) * 0.3, y: y - 0.35 + Math.sin(a) * 0.12, vx: -Math.sin(a) * 0.8, vy: Math.cos(a) * 0.3, r: 0.08, vr: 3, life: 2.2, color: '#ffeb3b', fade: false });
    }
  }

  function updateDebris(dt) {
    for (const d of state.debris) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.ang += d.va * dt;
      d.vz -= 9 * dt;
      d.z += d.vz * dt;
      if (d.z <= 0) {
        d.z = 0;
        if (d.vz < -1) {
          d.vz = -d.vz * 0.35;
          if (!isWater(state.board, Math.floor(d.x), Math.floor(d.y))) puff(d.x, d.y, 2, '#e8d9b8', 0.4);
        } else d.vz = 0;
        const f = Math.exp(-4 * dt);
        d.vx *= f; d.vy *= f; d.va *= f;
      }
      if (d.z === 0 && isWater(state.board, Math.floor(d.x), Math.floor(d.y))) {
        if (d.sink === 0) {
          for (let k = 0; k < 6; k++) addParticle({ type: 'drop', x: d.x, y: d.y, vx: rand(-1, 1), vy: rand(-2, -0.8), g: 6, r: 0.04, life: 0.8, color: '#e1f5fe' });
          addParticle({ type: 'ring', x: d.x, y: d.y, r: 0.15, life: 1.2 });
        }
        d.sink = Math.min(1, d.sink + dt * 0.8);
        d.vx *= 0.9; d.vy *= 0.9;
      }
    }
  }

  function confetti(n) {
    const colors = ['#ef5350', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc', '#ff7043'];
    for (let k = 0; k < n; k++) {
      addParticle({
        type: 'confetti', x: rand(0, state.board.w), y: -0.5, vx: rand(-0.5, 0.5), vy: rand(0.8, 2),
        r: rand(0.05, 0.09), vr: rand(-5, 5), flip: rand(4, 9), life: 3.5, color: colors[k % colors.length], fade: false,
      });
    }
  }

  function startWin() {
    setMode('win');
    const st = state.board.station;
    // put the burst away from the station so the happy train stays visible
    const bx = st.x < state.board.w / 2 ? st.x + 2.6 : st.x - 1.6;
    const by = st.y < state.board.h / 2 ? st.y + 2.4 : st.y - 1.0;
    addBurst('HOORAY!', bx, by, '#aed581', '#2e7d32');
    for (let k = 0; k < 14; k++) {
      addParticle({ type: 'star', x: st.x + 0.5, y: st.y + 0.5, vx: rand(-2.5, 2.5), vy: rand(-3, -0.5), g: 3, r: rand(0.08, 0.13), vr: rand(-6, 6), life: 1.6, color: k % 2 ? '#ffeb3b' : '#ffffff' });
    }
    confetti(40);
    Sound.win();
    progress.solved.add(state.levelIndex);
    saveProgress();
  }

  // ------------------------------------------------------------ editing
  function selectSlot(i) {
    state.selected = i;
    Sound.select();
    updateButtons();
  }
  function placePiece(id) {
    if (state.mode !== 'edit') return;
    if (!state.board.slots.length) return;
    let i = state.selected;
    if (i === null || i === undefined || i >= state.board.slots.length) i = state.selected = 0;
    const cur = state.placements[i];
    if (cur && cur.id === id) {
      rotateSelected();
      return;
    }
    state.placements[i] = { id, rot: slotRotDefault(id, state.board.slots[i]) };
    const s = state.board.slots[i];
    puff(s.x + 0.5, s.y + 0.5, 3, '#fff', 0.5);
    Sound.place();
    hideHint();
    updateButtons();
  }
  function rotateSelected() {
    if (state.mode !== 'edit') return;
    const p = state.placements[state.selected];
    if (!p) {
      showHint('Pick a track piece first!', 2);
      return;
    }
    const n = PIECES[p.id].rotations;
    if (n <= 1) { Sound.select(); return; }
    p.rot = (p.rot + 1) % n;
    Sound.rotate();
    updateButtons();
  }
  function clearSelected() {
    if (state.mode !== 'edit') return;
    if (state.placements[state.selected]) {
      state.placements[state.selected] = null;
      Sound.clear();
      updateButtons();
    }
  }

  // ------------------------------------------------------------ input
  canvas.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    if (state.mode === 'crash' || state.mode === 'missed') {
      // tap to skip ahead
      if (state.modeTime > 0.8) state.modeTime = 99;
      return;
    }
    if (state.mode !== 'edit') return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const tx = Math.floor((px - view.ox) / view.T), ty = Math.floor((py - view.oy) / view.T);
    const c = TE.cellAt(state.board, tx, ty);
    if (c && c.kind === 'slot') {
      if (state.selected === c.slot && state.placements[c.slot]) rotateSelected();
      else selectSlot(c.slot);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (overlayShown) {
      if (e.key === 'Enter' && overlayPrimary) overlayPrimary();
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); }
    else if (e.key === 'r' || e.key === 'R') rotateSelected();
    else if (e.key === 'Backspace' || e.key === 'Delete') clearSelected();
    else if (e.key === 'Tab') {
      e.preventDefault();
      const n = state.board.slots.length;
      if (n) selectSlot((state.selected + (e.shiftKey ? n - 1 : 1)) % n);
    } else if (/^[1-9]$/.test(e.key)) {
      const id = state.level.pieces[Number(e.key) - 1];
      if (id) placePiece(id);
    }
  });

  goBtn.addEventListener('click', () => go());
  rotateBtn.addEventListener('click', () => rotateSelected());
  clearBtn.addEventListener('click', () => clearSelected());
  soundBtn.addEventListener('click', () => {
    Sound.setMuted(!Sound.muted);
    updateSoundBtn();
    if (!Sound.muted) Sound.select();
  });
  $('levelsBtn').addEventListener('click', () => showLevels());

  function updateSoundBtn() {
    soundBtn.textContent = Sound.muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-label', Sound.muted ? 'Sound off' : 'Sound on');
  }

  // ------------------------------------------------------------ tray
  function buildTray() {
    piecesEl.innerHTML = '';
    state.level.pieces.forEach((id, k) => {
      const btn = document.createElement('button');
      btn.className = 'piece';
      btn.dataset.id = id;
      btn.title = `${PIECES[id].name} (${k + 1})`;
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      drawIcon(c, id);
      const label = document.createElement('span');
      label.textContent = PIECES[id].name;
      btn.append(c, label);
      btn.addEventListener('click', () => { Sound.unlock(); placePiece(id); });
      piecesEl.appendChild(btn);
    });
  }

  function drawIcon(c, id) {
    const prev = g;
    g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const S = c.width;
    if (id === 'bridge1' || id === 'bridge2' || id === 'jump') {
      const span = PIECES[id].span;
      const L = span + 1;
      const k = S / (L + 0.4);
      g.setTransform(k, 0, 0, k, 0.2 * k, (S - k) / 2 + (id === 'jump' ? 0.25 * k : 0));
      // little world strip
      for (let i = 1; i <= span; i++) {
        if (id === 'jump') {
          paper(() => circle(i + 0.5, 0.55, 0.32), '#66bb6a', { ow: 0.06, sh: 0.04 });
        } else {
          paper(() => rr(i + 0.02, 0.1, 0.96, 0.8, 0.12), COL.water, { ow: 0.06, sh: 0 });
        }
      }
      if (id === 'jump') {
        drawPieceGround({ id: 'jump', rot: 1 }, 0, 0, null);
        g.save();
        g.setLineDash([0.12, 0.12]);
        g.strokeStyle = '#ff7043';
        g.lineWidth = 0.08;
        g.lineCap = 'round';
        g.beginPath();
        for (let i = 0; i <= 20; i++) {
          const u = i / 20;
          const px = 0.5 + L * u, py = 0.5 - 0.22 * L * Math.sin(Math.PI * u);
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.stroke();
        g.restore();
      } else {
        drawBridge(0, 0.1, 1, span);
      }
    } else if (id === 'tunnel') {
      const k = S / 1.6;
      g.setTransform(k, 0, 0, k, 0.05 * k, 0.4 * k);
      drawTracks([TE.lineSeg(0, 0.5, 1.2, 0.5)]);
      drawMountain(0.55, -0.15, 0.5);
      drawPortal(0.62, 0.5, 1);
    } else {
      const k = S / 1.3;
      g.setTransform(k, 0, 0, k, 0.15 * k, 0.15 * k);
      paper(() => rr(0.02, 0.02, 0.96, 0.96, 0.14), COL.card, { ow: 0.05, sh: 0.04 });
      const conns = TE.pieceConns(id, id === 'straight' ? 1 : id === 'curve' ? 2 : 0);
      drawTracks(cellSegs(0, 0, conns));
    }
    g = prev;
  }

  function updateButtons() {
    const editing = state.mode === 'edit';
    const running = state.mode === 'run';
    goBtn.textContent = running ? 'STOP' : 'GO!';
    goBtn.classList.toggle('stop', running);
    goBtn.disabled = !(editing || running);
    const cur = state.placements[state.selected];
    rotateBtn.disabled = !editing || !cur || PIECES[cur.id].rotations <= 1;
    clearBtn.disabled = !editing || !cur;
    for (const btn of piecesEl.children) {
      btn.disabled = !editing;
      btn.classList.toggle('active', !!cur && cur.id === btn.dataset.id);
    }
  }

  // ------------------------------------------------------------ hint bubble
  function showHint(msg, secs) {
    if (!msg) return hideHint();
    hintEl.textContent = msg;
    hintEl.classList.add('show');
    state.hintTimer = secs || 0;
  }
  function hideHint() {
    hintEl.classList.remove('show');
    state.hintTimer = 0;
  }

  // ------------------------------------------------------------ overlays
  let overlayShown = false;
  let overlayPrimary = null;
  function showOverlay(html, primary) {
    overlay.innerHTML = `<div class="panel">${html}</div>`;
    overlay.hidden = false;
    overlayShown = true;
    overlayPrimary = primary || null;
    requestAnimationFrame(() => overlay.classList.add('show'));
  }
  function hideOverlay() {
    overlay.classList.remove('show');
    overlay.hidden = true;
    overlayShown = false;
    overlayPrimary = null;
  }

  function showWin() {
    const last = state.levelIndex === LEVELS.length - 1;
    const next = () => loadLevel(state.levelIndex + 1);
    showOverlay(`
      <div class="big-emoji">🎉</div>
      <h2>${last ? 'You finished every level!' : 'Hooray! You did it!'}</h2>
      <p>${last ? 'What a super train driver!' : 'The train made it to the station.'}</p>
      <div class="row">
        <button class="btn" data-act="replay">↺ Again</button>
        <button class="btn" data-act="levels">☰ Levels</button>
        ${last ? '' : '<button class="btn go" data-act="next">Next ▶</button>'}
      </div>`, last ? () => showLevels() : next);
    overlay.querySelector('[data-act="replay"]').onclick = () => { hideOverlay(); resetTrain(true); };
    overlay.querySelector('[data-act="levels"]').onclick = () => showLevels();
    const nb = overlay.querySelector('[data-act="next"]');
    if (nb) nb.onclick = next;
  }

  function showLevels() {
    if (state.mode === 'run') resetTrain(false);
    const firstOpen = LEVELS.findIndex((_, i) => !progress.solved.has(i));
    const cards = LEVELS.map((lv, i) => `
      <button class="level-card ${progress.solved.has(i) ? 'done' : ''} ${i === state.levelIndex ? 'current' : ''}" data-level="${i}">
        <span class="num">${i + 1}</span>
        <span class="name">${escapeHtml(lv.name)}</span>
        ${progress.solved.has(i) ? '<span class="tick">★</span>' : ''}
      </button>`).join('');
    showOverlay(`
      <h1 class="logo">Choo-Choo<br>Junction</h1>
      <p>Put the right pieces on the <b>?</b> spots, then press <b>GO!</b></p>
      <div class="levels">${cards}</div>
      <div class="row"><button class="btn" data-act="close">Close</button>
      <button class="btn go" data-act="play">Play ▶</button></div>`, () => loadLevel(firstOpen < 0 ? state.levelIndex : firstOpen));
    overlay.querySelectorAll('[data-level]').forEach((b) => {
      b.onclick = () => { Sound.unlock(); loadLevel(Number(b.dataset.level)); };
    });
    overlay.querySelector('[data-act="close"]').onclick = () => hideOverlay();
    overlay.querySelector('[data-act="play"]').onclick = () => { Sound.unlock(); loadLevel(firstOpen < 0 ? state.levelIndex : firstOpen); };
  }

  // ------------------------------------------------------------ layout
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = stage.clientWidth, H = stage.clientHeight;
    view.dpr = dpr;
    view.W = W; view.H = H;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    if (!state.board) return;
    const { w, h } = state.board;
    const T = Math.max(12, Math.min(W / (w + 0.8), H / (h + 1.0), 120));
    view.T = T;
    view.ox = (W - w * T) / 2;
    view.oy = (H - h * T) / 2 + 0.15 * T;
    buildLayers();
  }
  window.addEventListener('resize', () => resize());
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(stage);

  // ------------------------------------------------------------ main loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ boot
  updateSoundBtn();
  const firstOpen = LEVELS.findIndex((_, i) => !progress.solved.has(i));
  const params = new URLSearchParams(location.search);
  const startLevel = params.has('level') ? Number(params.get('level')) - 1 : (firstOpen < 0 ? 0 : firstOpen);
  loadLevel(startLevel);
  if (!params.has('level')) showLevels();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildLayers(); buildTray(); updateButtons(); });
  requestAnimationFrame(frame);

  // handy for testing from the console
  window.__train = { state, loadLevel, go, placePiece, selectSlot, rotateSelected };
})();
