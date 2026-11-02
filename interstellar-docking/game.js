/* Endurance Docking — a two-player, top-down docking game.
 * Pilot: W A S D (screen-oriented thrusters). Co-pilot: ← / → arrow keys (spin).
 * Art style: "Saturday Cartoon" (see design_artifacts/).
 */
(() => {
'use strict';

// ---------- constants ----------
const TAU = Math.PI * 2;
const W = 1280, H = 800;            // play area in logical units
const ZONE_W = 150;                  // safe zone on the right
const SS = 1.4;                      // station drawing scale (mockup geometry -> world)
const R0 = 72, MOD_T = 30, MOD_R = 18, HUB = 15;
const R = R0 * SS;                   // ring radius in world units
const MISSING = [4, 5], SPOKES = [0, 3, 6, 9];
const DMG = 4.5 * TAU / 12;          // middle of the missing modules (station local angle)
const SHIP_S = 1.35;                 // ranger path scale inside the station-scaled frame
const M_PER_UNIT = 0.5;              // readouts: 1 world unit = 0.5 m
const INK = '#1a1030';

// sepX: sideways gap between Ranger and station at the start (0 = station anywhere in the middle)
// stY: station start height. curve: how hard the station's drift path bends (rad/s of heading swing)
const DIFF = {
  easy:   { spin: 0.35, drift: 5,  randomDir: false, sepX: 0,   stY: 270, curve: 0 },
  normal: { spin: 0.75, drift: 11, randomDir: false, sepX: 440, stY: 210, curve: 0 },
  hard:   { spin: 1.05, drift: 15, randomDir: true,  sepX: 620, stY: 170, curve: 0.16 },
};
const INTRO_BOOM = 2.3;   // seconds into the opening scene when Mann's hatch blows
const THRUST = 70;        // units/s^2
const TORQUE = 0.9;       // rad/s^2
const DOCKED_THRUST = 0.45, DOCKED_TORQUE = 0.35;   // the joined ships are heavier
const TOL = { pos: 20, posOut: 30, vel: 12, velOut: 18, ang: 0.14, angOut: 0.22, spin: 0.12, spinOut: 0.2 };
const HOLD_TIME = 10;
const WIN_SPIN = 0.06;

// ---------- canvas ----------
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let dpr = 1, scale = 1, VW = W, VH = H, ox = 0, oy = 0;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = window.innerWidth, ch = window.innerHeight;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  scale = Math.min(cw / W, ch / H);
  VW = cw / scale; VH = ch / scale;
  ox = (VW - W) / 2; oy = (VH - H) / 2;
}
window.addEventListener('resize', resize);
resize();

// ---------- helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function star4(c, x, y, r) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const q = i % 2 ? r * .35 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fill(); }
function angleErr(shipA, stA) { const d = shipA - stA; const q = Math.PI / 2; return d - q * Math.round(d / q); }
function arrowDir(vx, vy) {
  if (Math.hypot(vx, vy) < 0.5) return '·';
  const arr = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return arr[(Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) + 8) % 8];
}

const RP = [[0, -22], [4, -17], [7, -6], [16, 7], [17, 13], [8, 15], [6, 18]];
function rangerPath(c, s = 1) {
  c.beginPath(); c.moveTo(RP[0][0] * s, RP[0][1] * s);
  for (let i = 1; i < RP.length; i++) c.lineTo(RP[i][0] * s, RP[i][1] * s);
  for (let i = RP.length - 1; i > 0; i--) c.lineTo(-RP[i][0] * s, RP[i][1] * s);
  c.closePath();
}
function windows(c, s = 1) { c.beginPath(); c.moveTo(-3 * s, -15 * s); c.lineTo(3 * s, -15 * s); c.lineTo(4 * s, -11 * s); c.lineTo(-4 * s, -11 * s); c.closePath(); }
function connectorIsBroken(i) { return MISSING.includes(i) || MISSING.includes((i + 1) % 12); }

// ---------- input ----------
const keys = new Set();
const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight'];
const CCW = 'ArrowLeft', CW = 'ArrowRight';
window.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) { keys.add(e.code); e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === 'KeyH') toggle('data');
  else if (e.code === 'KeyG') toggle('hints');
  else if (e.code === 'KeyT') toggle('talk');
  else if (e.code === 'KeyM') toggle('music');
  else if (e.code === 'Escape' && !settingsEl.hidden) closeSettings();
  else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  else if (e.code === 'KeyR' && S.phase !== 'title') newGame(S.diff, false);
  else if (e.code === 'Enter') {
    if (S.phase === 'title') startGame();
    else if (S.phase === 'won') newGame(S.diff, false);
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (S.phase !== 'title' && S.phase !== 'won') setPause(true); });
const down = k => keys.has(k);

// ---------- settings / UI ----------
const opts = { data: true, hints: true, talk: true, music: true };
try { const saved = JSON.parse(localStorage.getItem('endurance-docking-opts') || 'null'); if (saved) Object.assign(opts, saved); } catch (e) { /* storage unavailable */ }
const btn = { data: document.getElementById('btnData'), hints: document.getElementById('btnHints'), talk: document.getElementById('btnTalk'), music: document.getElementById('btnSound'), pause: document.getElementById('btnPause') };
function syncButtons() {
  for (const k of ['data', 'hints', 'talk']) btn[k].setAttribute('aria-pressed', String(opts[k]));
  btn.pause.setAttribute('aria-pressed', String(paused));
  btn.music.setAttribute('aria-pressed', String(opts.music));
  btn.music.classList.toggle('off', !opts.music);
  btn.music.title = !track ? 'Sound (M). No music track yet: pause and open Settings to pick one.' : opts.music ? 'Sound on (M)' : 'Sound off (M)';
  btn.music.setAttribute('aria-label', opts.music ? 'Sound on' : 'Sound off');
  pauseEl.hidden = !paused || !S || S.phase === 'title' || S.phase === 'won';
  if (pauseEl.hidden) { settingsEl.hidden = true; pausePanel.hidden = false; }
  syncMusic();
}
function toggle(k) { opts[k] = !opts[k]; try { localStorage.setItem('endurance-docking-opts', JSON.stringify(opts)); } catch (e) { /* ignore */ } syncButtons(); }
btn.data.onclick = () => toggle('data');
btn.hints.onclick = () => toggle('hints');
btn.talk.onclick = () => toggle('talk');
btn.music.onclick = () => toggle('music');
btn.pause.onclick = () => togglePause();
let paused = false;
function setPause(p) { paused = p; syncButtons(); }

// ---------- pause menu & settings ----------
const pauseEl = document.getElementById('pauseMenu'), settingsEl = document.getElementById('settings');
const trackName = document.getElementById('trackName'), trackFile = document.getElementById('trackFile');
const btnClearTrack = document.getElementById('btnClearTrack');
document.getElementById('btnResume').onclick = () => setPause(false);
document.getElementById('btnRestart').onclick = () => newGame(S.diff, false);
const pausePanel = document.getElementById('pausePanel');
document.getElementById('btnSettings').onclick = () => { settingsEl.hidden = false; pausePanel.hidden = true; document.getElementById('btnPickTrack').focus(); };
document.getElementById('btnCloseSettings').onclick = () => closeSettings();
document.getElementById('btnPickTrack').onclick = () => trackFile.click();
function closeSettings() { settingsEl.hidden = true; pausePanel.hidden = false; document.getElementById('btnSettings').focus(); }
trackFile.onchange = () => {
  const f = trackFile.files && trackFile.files[0];
  trackFile.value = '';
  if (!f) return;
  setTrack({ name: f.name, blob: f });
  saveTrack({ name: f.name, blob: f });
};
btnClearTrack.onclick = () => { setTrack(null); saveTrack(null); };

// ---------- music (toggle: M) ----------
// The chosen MP3 is copied into the browser's IndexedDB, so it's still there next time the game opens.
const music = document.getElementById('music');
music.volume = 0.6;
let track = null, trackUrl = null;
function setTrack(t) {
  if (trackUrl) URL.revokeObjectURL(trackUrl);
  track = t; trackUrl = t ? URL.createObjectURL(t.blob) : null;
  music.pause();
  if (trackUrl) { music.src = trackUrl; music.load(); } else music.removeAttribute('src');
  trackName.textContent = t ? t.name : 'None chosen';
  btnClearTrack.hidden = !t;
  syncButtons();
}
function syncMusic() {
  if (!track || !S) return;
  const want = opts.music && !paused && S.phase !== 'title';
  if (want && music.paused) music.play().catch(() => { /* blocked until a key/click */ });
  else if (!want && !music.paused) music.pause();
}
function openDB() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open('endurance-docking', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('music');
    r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
  });
}
async function saveTrack(t) {
  try {
    const db = await openDB(), tx = db.transaction('music', 'readwrite');
    if (t) tx.objectStore('music').put(t, 'track'); else tx.objectStore('music').delete('track');
  } catch (e) { /* storage unavailable: the track still plays this session */ }
}
async function loadTrack() {
  try {
    const db = await openDB();
    const t = await new Promise((ok, fail) => { const r = db.transaction('music').objectStore('music').get('track'); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
    if (t && t.blob && !track) setTrack(t);
  } catch (e) { /* storage unavailable */ }
}
function togglePause() { if (S.phase === 'title' || S.phase === 'won') return; setPause(!paused); }

let chosenDiff = 'easy';
document.querySelectorAll('.diff button').forEach(b => b.onclick = () => {
  chosenDiff = b.dataset.diff;
  document.querySelectorAll('.diff button').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
});
const startEl = document.getElementById('start'), winEl = document.getElementById('win');
document.getElementById('btnStart').onclick = () => startGame();
document.getElementById('btnAgain').onclick = () => newGame(S.diff, false);
function startGame() { newGame(chosenDiff, false); }

// ---------- crew talk (speech bubbles) ----------
// Lines in quotes are from the docking scene in the film; the rest are game prompts.
const LINES = {
  mann: [['BRAND', "Dr. Mann, it's not safe—"]],
  moving: [
    ['BRAND', 'Cooper, what are you doing?'],
    ['COOPER', 'Docking.'],
  ],
  intro: [
    ['COOPER', 'Case, get ready to match our spin with the retro thrusters.'],
    ['CASE', "It's not possible."],
    ['COOPER', "No. It's necessary."],
  ],
  spinPhase: [['TARS', 'Cooper, this is no time for caution!']],
  fastSpin: [['COOPER', 'If I black out, take the stick.']],
  hold: [['COOPER', 'Come on, TARS!']],
  lostHold: [['TARS', 'Lost the clamps. Line it up again!']],
  docked: [['CASE', 'Clamps locked! Now slow us down.']],
  despun: [['TARS', 'Spin stopped. Push us to safety.']],
  won: [['COOPER', 'Nice flying, co-pilot!']],
};
function say(key) { const seq = LINES[key]; if (!seq) return; S.talk.queue.push(...seq.map(([who, text]) => ({ who, text }))); }
function sayOnce(key) { if (S.said.has(key)) return; S.said.add(key); say(key); }

// ---------- particles ----------
class Particles {
  constructor(max = 500) { this.p = []; this.max = max; }
  add(o) { this.p.push(Object.assign({ age: 0, rot: Math.random() * TAU, vr: rand(-3, 3), seed: Math.random() }, o)); if (this.p.length > this.max) this.p.shift(); }
  step(dt) {
    for (const q of this.p) { q.age += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; if (q.drag) { q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * dt; } if (q.g) q.vy += q.g * dt; }
    this.p = this.p.filter(q => q.age < q.life);
  }
}
function dmgPoint(st) { const t = DMG + st.a; return { x: st.x + Math.cos(t) * R, y: st.y + Math.sin(t) * R, t }; }
function vent(st, rate, dt, spread = 30) {
  const n = rate * dt; let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  while (k-- > 0) {
    const d = dmgPoint(st); const tan = st.w * R; const out = 14 + Math.random() * spread;
    const kind = Math.random() < .65 ? 'smoke' : 'frag';
    S.parts.add({ x: d.x + rand(-8, 8), y: d.y + rand(-8, 8), vx: st.vx + Math.cos(d.t) * out - Math.sin(d.t) * tan * .7, vy: st.vy + Math.sin(d.t) * out + Math.cos(d.t) * tan * .7,
      life: kind === 'smoke' ? rand(2.4, 4) : rand(2, 5), kind, size: rand(4, 7), drag: kind === 'smoke' ? .4 : 0 });
  }
}
function burst(st, count) {
  const d = dmgPoint(st);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * TAU, sp = rand(30, 150), kind = i % 3 === 0 ? 'frag' : 'smoke';
    S.parts.add({ x: d.x, y: d.y, vx: st.vx + Math.cos(ang) * sp - Math.sin(d.t) * st.w * R * .6, vy: st.vy + Math.sin(ang) * sp + Math.cos(d.t) * st.w * R * .6,
      life: kind === 'smoke' ? rand(2, 3.5) : rand(3, 6), kind, size: rand(4, 9), drag: kind === 'smoke' ? .7 : .02 });
  }
  S.flash = 1;
}

// ---------- game state ----------
let S;
function newGame(diff, title) {
  const d = DIFF[diff];
  const playW = W - ZONE_W;
  const dir = d.randomDir && Math.random() < .5 ? -1 : 1;
  // start positions: Easy puts the station anywhere in the middle; harder levels put it off to one side, away from the Ranger
  const side = Math.random() < .5 ? -1 : 1;
  const stX = d.sepX ? playW / 2 + side * d.sepX / 2 + rand(-30, 30) : playW * (0.125 + 0.75 * Math.random());
  const shX = d.sepX ? playW / 2 - side * d.sepX / 2 : playW / 2;
  S = {
    diff, phase: title ? 'title' : 'intro', time: 0,
    st: { x: stX, y: d.stY, vx: 0, vy: 0, a: Math.random() * TAU, w: 0 },
    // what the explosion leaves the station doing
    kick: { vx: rand(-1.5, 1.5), vy: -d.drift, w: d.spin * dir },
    intact: true, boomAt: 0, spinUp: 0,
    curve: d.curve, curveT: Math.random() * TAU, curveDir: Math.random() < .5 ? -1 : 1,
    mann: { off: 120 },
    ship: { x: shX, y: H - 110, vx: 0, vy: 0, a: 0, w: 0 },
    cam: 0, trail: [], trailT: 0,
    posM: false, spinM: false, hold: 0, dockRel: 0, bestHold: 0,
    flash: 0, nextBurst: rand(6, 10),
    parts: new Particles(), confetti: new Particles(400),
    talk: { queue: [], cur: null, t: 0 }, said: new Set(),
    wonAt: 0, lostHolds: 0, panelA: 1,
  };
  setPause(false);
  startEl.hidden = !title;
  winEl.hidden = true;
  if (!title) { say('mann'); syncMusic(); }
}

function explode() {
  const st = S.st;
  S.intact = false; S.boomAt = S.time; S.phase = 'approach';
  st.vx = S.kick.vx; st.vy = S.kick.vy;
  burst(st, 90);
  S.flash = 1.4;
  S.nextBurst = rand(6, 10);
  // Brand gets cut off
  S.talk.queue = []; S.talk.cur = null;
}

// ---------- update ----------
function update(dt) {
  const st = S.st, sh = S.ship;
  S.time += dt;
  const playing = S.phase === 'approach' || S.phase === 'docked';

  // opening scene: Mann's lander creeps in to dock, then the hatch blows
  if (S.phase === 'intro') {
    S.mann.off = Math.max(28, 120 - S.time * 42);
    if (S.time >= INTRO_BOOM) explode();
  }
  // after the blast the station's spin winds up over a couple of seconds
  if (!S.intact && S.spinUp < 1) {
    S.spinUp = Math.min(1, (S.time - S.boomAt) / 2);
    st.w = S.kick.w * (1 - Math.pow(1 - S.spinUp, 2));
  }
  // Hard: the station's drift path bends back and forth
  if (S.phase === 'approach' && S.curve) {
    S.curveT += dt;
    const turn = S.curve * S.curveDir * Math.cos(S.curveT * 0.3) * dt;
    const c = Math.cos(turn), s = Math.sin(turn);
    const vx = st.vx * c - st.vy * s, vy = st.vx * s + st.vy * c;
    st.vx = vx; st.vy = vy;
  }

  if (S.phase !== 'docked' && S.phase !== 'won') {
    // free flight
    if (playing) {
      if (down('KeyW')) sh.vy -= THRUST * dt;
      if (down('KeyS')) sh.vy += THRUST * dt;
      if (down('KeyA')) sh.vx -= THRUST * dt;
      if (down('KeyD')) sh.vx += THRUST * dt;
      if (down(CW)) sh.w += TORQUE * dt;
      if (down(CCW)) sh.w -= TORQUE * dt;
      if (!S.said.has('moving') && GAME_KEYS.some(down)) { sayOnce('moving'); sayOnce('intro'); }
    }
    sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.a += sh.w * dt;
    st.x += st.vx * dt; st.y += st.vy * dt; st.a += st.w * dt;

    if (S.phase === 'approach') {
      const dist = Math.hypot(sh.x - st.x, sh.y - st.y);
      const dv = Math.hypot(sh.vx - st.vx, sh.vy - st.vy);
      const e = angleErr(sh.a, st.a), dw = sh.w - st.w;
      const posM = dist < (S.posM ? TOL.posOut : TOL.pos) && dv < (S.posM ? TOL.velOut : TOL.vel);
      const spinM = Math.abs(e) < (S.spinM ? TOL.angOut : TOL.ang) && Math.abs(dw) < (S.spinM ? TOL.spinOut : TOL.spin);
      if (posM && !S.posM) sayOnce('spinPhase');
      S.posM = posM; S.spinM = spinM;
      if (Math.abs(sh.w) > 1.6) sayOnce('fastSpin');

      if (posM && spinM) {
        if (S.hold === 0) say('hold');
        S.hold += dt;
        // docking clamps gently pull the ship into line while you hold
        const k = Math.min(1, 1.6 * dt);
        sh.x += (st.x - sh.x) * k; sh.y += (st.y - sh.y) * k;
        sh.vx += (st.vx - sh.vx) * k; sh.vy += (st.vy - sh.vy) * k;
        sh.a -= e * k; sh.w += (st.w - sh.w) * k;
        S.bestHold = Math.max(S.bestHold, S.hold);
        if (S.hold >= HOLD_TIME) dock();
      } else if (S.hold > 0) {
        if (S.hold > 1.5) { S.lostHolds++; say('lostHold'); }
        S.hold = 0;
      }

      // trail
      S.trailT -= dt;
      if (S.trailT <= 0) { S.trailT = .12; S.trail.push({ x: sh.x, y: sh.y }); if (S.trail.length > 260) S.trail.shift(); }
    }
  } else {
    // docked: the station and Ranger move as one heavier body
    if (S.phase === 'docked') {
      if (down('KeyW')) st.vy -= THRUST * DOCKED_THRUST * dt;
      if (down('KeyS')) st.vy += THRUST * DOCKED_THRUST * dt;
      if (down('KeyA')) st.vx -= THRUST * DOCKED_THRUST * dt;
      if (down('KeyD')) st.vx += THRUST * DOCKED_THRUST * dt;
      if (down(CW)) st.w += TORQUE * DOCKED_TORQUE * dt;
      if (down(CCW)) st.w -= TORQUE * DOCKED_TORQUE * dt;
    }
    st.x += st.vx * dt; st.y += st.vy * dt; st.a += st.w * dt;
    sh.x = st.x; sh.y = st.y; sh.vx = st.vx; sh.vy = st.vy; sh.w = st.w; sh.a = st.a + S.dockRel;
    if (S.phase === 'docked') {
      if (Math.abs(st.w) < WIN_SPIN) sayOnce('despun');
      if (st.x > W - ZONE_W + 30 && Math.abs(st.w) < WIN_SPIN) win();
    }
  }

  // explosions & venting (fades over time)
  if (S.phase !== 'won' && !S.intact) {
    S.nextBurst -= dt;
    if (S.nextBurst <= 0 && S.phase !== 'docked') { burst(st, 30); S.nextBurst = rand(8, 13); }
    vent(st, Math.max(1.2, 6 - (S.time - S.boomAt) * .08), dt);
  }
  S.parts.step(dt);
  S.flash = Math.max(0, S.flash - dt * 1.6);

  // confetti
  if (S.phase === 'won' && S.time - S.wonAt < 6) {
    const n = 40 * dt;
    for (let i = 0, m = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); i < m; i++)
      S.confetti.add({ x: Math.random() * VW, y: -10, vx: rand(-20, 20), vy: rand(60, 120), life: 10, g: 10, vr: rand(-8, 8) });
  }
  S.confetti.step(dt);

  // camera: keep the station clear of the top HUD, and the ship on screen when possible
  const TOP = 250;
  let tgt = Math.min(0, st.y - TOP);
  const needShip = sh.y - (H - 60);
  if (needShip > tgt) tgt = Math.min(needShip, st.y - TOP);
  S.cam += (tgt - S.cam) * Math.min(1, 2.5 * dt);

  // talk queue
  const T = S.talk;
  if (T.cur) { T.t -= dt; if (T.t <= 0) T.cur = null; }
  if (!T.cur && T.queue.length) { T.cur = T.queue.shift(); T.t = 1.6 + T.cur.text.length * 0.045; }
}

function dock() {
  const st = S.st, sh = S.ship;
  S.dockRel = (Math.PI / 2) * Math.round((sh.a - st.a) / (Math.PI / 2));
  // momentum: the light Ranger barely changes the big station's motion
  st.vx = (st.vx * 6 + sh.vx) / 7; st.vy = (st.vy * 6 + sh.vy) / 7; st.w = (st.w * 6 + sh.w) / 7;
  S.phase = 'docked'; S.hold = HOLD_TIME; S.trail = [];
  S.talk.queue = []; S.talk.cur = null;
  say('docked');
}
function win() {
  S.phase = 'won'; S.wonAt = S.time;
  S.talk.queue = []; S.talk.cur = null; say('won');
  const secs = Math.round(S.time);
  const stars = 1 + (secs < 150 ? 1 : 0) + (S.lostHolds === 0 ? 1 : 0);
  document.getElementById('winText').textContent = `You docked with Endurance and brought it to safety in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}.`;
  document.getElementById('winStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars) + (S.lostHolds === 0 ? '  Perfect hold!' : '');
  setTimeout(() => { if (S.phase === 'won') winEl.hidden = false; }, 2200);
}

// ---------- drawing: background ----------
const STARS = (() => { const r = rng(31); return Array.from({ length: 160 }, () => ({ x: r() * 2000, y: r() * 1400, s: r(), tw: r() * TAU })); })();
function drawBackground(c) {
  const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#2a1c5e'); g.addColorStop(1, '#123068');
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  for (const s of STARS) {
    const x = s.x % (VW + 20), y = ((s.y - S.cam * .25) % 1400 + 1400) % 1400;
    if (y > VH) continue;
    c.globalAlpha = .5 + .5 * Math.sin(S.time * 2 + s.tw);
    c.fillStyle = s.s > .88 ? '#ffe58a' : '#c9c2ff';
    if (s.s > .88) star4(c, x, y, 3 + s.s * 3); else { circ(c, x, y, .8 + s.s * 1.6); c.fill(); }
  }
  c.globalAlpha = 1;
}
function drawPlanet(c) {
  // icy planet far below (parallax)
  const px = ox + 300, py = oy + 1650 - S.cam * .35, pr = 1000;
  if (py - pr > VH + 40) return;
  let g = c.createRadialGradient(px, py, pr - 6, px, py, pr + 34);
  g.addColorStop(0, 'rgba(170,225,255,.55)'); g.addColorStop(1, 'rgba(170,225,255,0)');
  c.fillStyle = g; circ(c, px, py, pr + 34); c.fill();
  g = c.createRadialGradient(px + 200, py - 900, 50, px, py, pr);
  g.addColorStop(0, '#f2fbff'); g.addColorStop(.7, '#d4ecf7'); g.addColorStop(1, '#a9cfe4');
  c.fillStyle = g; circ(c, px, py, pr); c.fill();
  c.save(); circ(c, px, py, pr); c.clip();
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) { c.lineWidth = 14 - i; c.beginPath(); c.ellipse(px + 60, py + 20, pr - 50 - i * 34, pr - 90 - i * 36, -.22, 3.7 + i * .04, 5.5 - i * .05); c.stroke(); }
  c.fillStyle = '#b9dcef';
  for (const [dx, dy, r] of [[-120, -930, 26], [160, -955, 16], [420, -880, 34], [-380, -890, 20], [620, -760, 22]]) { circ(c, px + dx, py + dy, r); c.fill(); }
  // shadow crescent on the far side
  c.fillStyle = 'rgba(70,110,170,.28)'; circ(c, px - 70, py + 70, pr); c.fill();
  c.restore(); c.lineCap = 'butt';
  c.lineWidth = 6; c.strokeStyle = INK; circ(c, px, py, pr); c.stroke();
}
function drawSafeZone(c) {
  const zx = ox + W - ZONE_W;
  c.fillStyle = 'rgba(92,255,157,.12)'; c.fillRect(zx, 0, VW - zx, VH);
  c.strokeStyle = 'rgba(92,255,157,.6)'; c.lineWidth = 3; c.setLineDash([12, 12]); c.lineDashOffset = -S.time * 20;
  line(c, zx, 0, zx, VH); c.setLineDash([]);
  c.save(); c.translate(zx + ZONE_W / 2, VH / 2); c.rotate(-Math.PI / 2);
  c.font = '800 26px "Baloo 2", sans-serif'; c.fillStyle = 'rgba(92,255,157,.85)'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('SAFE ZONE', 0, 0); c.restore();
  c.fillStyle = 'rgba(92,255,157,.35)';
  for (let i = 0; i < 3; i++) { const y = VH / 2 + 130 + i * 0; const x = zx + 30 + ((S.time * 30 + i * 30) % 90); c.beginPath(); c.moveTo(x, y - 10); c.lineTo(x + 10, y); c.lineTo(x, y + 10); c.lineWidth = 4; c.strokeStyle = 'rgba(92,255,157,.5)'; c.stroke(); }
}

// ---------- drawing: world objects ----------
function drawParticles(c, kind) {
  for (const q of S.parts.p) {
    if (q.kind !== kind) continue;
    const k = 1 - q.age / q.life;
    c.lineWidth = 2.5; c.strokeStyle = INK;
    if (kind === 'smoke') { c.fillStyle = '#e9e4ff'; circ(c, q.x, q.y, (q.size * .7 + q.age * 3.5) * Math.min(1, k * 2)); c.fill(); c.stroke(); }
    else { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.globalAlpha = Math.min(1, k * 3); c.fillStyle = '#ff8a3d'; c.fillRect(-q.size / 2, -q.size / 2, q.size, q.size); c.strokeRect(-q.size / 2, -q.size / 2, q.size, q.size); c.restore(); c.globalAlpha = 1; }
  }
}
function drawStation(c, st, intact) {
  const missing = intact ? [] : MISSING;
  c.save(); c.translate(st.x, st.y); c.rotate(st.a); c.scale(SS, SS); c.lineJoin = 'round';
  c.lineWidth = 9; c.strokeStyle = INK;
  for (const i of SPOKES) { const th = i * TAU / 12; line(c, 0, 0, Math.cos(th) * (R0 - MOD_R / 2), Math.sin(th) * (R0 - MOD_R / 2)); }
  c.lineWidth = 4.5; c.strokeStyle = '#b9b2e8';
  for (const i of SPOKES) { const th = i * TAU / 12; line(c, 0, 0, Math.cos(th) * (R0 - MOD_R / 2), Math.sin(th) * (R0 - MOD_R / 2)); }
  for (let i = 0; i < 12; i++) {
    if (!intact && connectorIsBroken(i)) continue;
    c.save(); c.rotate((i + .5) * TAU / 12); c.translate(R0, 0);
    c.fillStyle = '#b9b2e8'; c.lineWidth = 3; c.strokeStyle = INK; rr(c, -4, -6, 8, 12, 2); c.fill(); c.stroke(); c.restore();
  }
  for (let i = 0; i < 12; i++) {
    if (missing.includes(i)) continue;
    c.save(); c.rotate(i * TAU / 12); c.translate(R0, 0);
    c.lineWidth = 3.5; c.strokeStyle = INK; c.fillStyle = '#f4f1ff'; rr(c, -MOD_R / 2 - 1, -MOD_T / 2, MOD_R + 2, MOD_T, 5); c.fill(); c.stroke();
    c.fillStyle = '#ff8a3d'; c.fillRect(-MOD_R / 2 + 2, -3, MOD_R - 3, 6);
    c.fillStyle = '#4fd8ff'; circ(c, 3, -9, 2.4); c.fill(); circ(c, 3, 9, 2.4); c.fill();
    c.restore();
  }
  if (!intact) for (const s of [-1, 1]) {
    c.save(); c.rotate(DMG + s * TAU / 12 * 1.02); c.translate(R0, 0);
    c.fillStyle = '#ff8a3d'; c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-6, 0); c.lineTo(-3, -s * 6); c.lineTo(0, -s * 2); c.lineTo(3, -s * 7); c.lineTo(6, 0); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }
  c.fillStyle = '#ffd34d'; c.lineWidth = 4; c.strokeStyle = INK; circ(c, 0, 0, HUB + 3); c.fill(); c.stroke();
  c.lineWidth = 2; circ(c, 0, 0, 8); c.stroke();
  c.restore();
}
function drawMann(c, st) {
  // Mann's lander, nose-in toward the damaged module's port
  const t = DMG + st.a, d = R + S.mann.off;
  c.save(); c.translate(st.x + Math.cos(t) * d, st.y + Math.sin(t) * d); c.rotate(t - Math.PI / 2); c.scale(SS * .8, SS * .8);
  c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = INK;
  rangerPath(c, 1.1); c.fillStyle = '#c9c2e0'; c.fill(); c.stroke();
  windows(c, 1.1); c.fillStyle = '#4fd8ff'; c.fill(); c.lineWidth = 2; c.stroke();
  c.restore();
}
function drawFlash(c, st) {
  if (S.flash <= 0.02) return;
  const d = dmgPoint(st), f = S.flash;
  for (const [k, col] of [[1, '#ff8a3d'], [.7, '#ffd34d'], [.4, '#ffffff']]) {
    c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 4;
    circ(c, d.x, d.y, (20 + f * 60) * k); c.fill(); if (k === 1) c.stroke();
  }
}
function drawShip(c, sh, thrusting) {
  c.save(); c.translate(sh.x, sh.y);
  // screen-oriented thruster flames (drawn before rotating)
  if (thrusting) {
    const flames = [];
    if (down('KeyW')) flames.push([0, 1]); if (down('KeyS')) flames.push([0, -1]);
    if (down('KeyA')) flames.push([1, 0]); if (down('KeyD')) flames.push([-1, 0]);
    for (const [fx, fy] of flames) {
      const len = 26 + Math.sin(S.time * 40) * 4, base = 30;
      c.save(); c.rotate(Math.atan2(fy, fx));
      c.fillStyle = '#ff8a3d'; c.strokeStyle = INK; c.lineWidth = 3;
      c.beginPath(); c.moveTo(base, -9); c.quadraticCurveTo(base + len, 0, base, 9); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffd34d'; c.beginPath(); c.moveTo(base + 2, -4); c.quadraticCurveTo(base + len * .6, 0, base + 2, 4); c.closePath(); c.fill();
      c.restore();
    }
  }
  c.rotate(sh.a); c.scale(SS, SS); c.lineJoin = 'round';
  // spin puffs at the wing tips
  if (thrusting && (down(CCW) || down(CW))) {
    const dir = down(CW) ? -1 : 1;
    c.fillStyle = '#ffffff'; c.strokeStyle = INK; c.lineWidth = 2;
    for (const s of [-1, 1]) { const r = 4 + Math.sin(S.time * 30 + s) * 1.2; circ(c, s * 23, 16 + dir * s * 6, r); c.fill(); c.stroke(); }
  }
  c.lineWidth = 3.5; c.strokeStyle = INK; rangerPath(c, SHIP_S); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
  c.fillStyle = '#2c2350'; c.beginPath(); c.moveTo(0, -29.7); c.lineTo(5.4, -23); c.lineTo(-5.4, -23); c.closePath(); c.fill();
  windows(c, SHIP_S); c.fillStyle = '#4fd8ff'; c.fill(); c.lineWidth = 2; c.stroke();
  c.fillStyle = '#ff8a3d'; c.fillRect(-14, 10, 8, 4); c.fillRect(6, 10, 8, 4);
  c.restore();
}
function drawGhost(c) {
  const st = S.st, sh = S.ship;
  const e = angleErr(sh.a, st.a);
  c.save(); c.translate(st.x, st.y); c.rotate(sh.a - e); c.scale(SS, SS);
  c.setLineDash([6, 6]); c.lineWidth = 3; c.strokeStyle = S.spinM ? '#5cff9d' : 'rgba(255,255,255,.9)';
  rangerPath(c, SHIP_S); c.stroke(); c.setLineDash([]);
  c.restore();
}
function drawTrail(c) {
  const n = S.trail.length;
  for (let i = 0; i < n; i += 1) {
    const p = S.trail[i];
    c.globalAlpha = .15 + .6 * (i / n);
    c.fillStyle = '#cfe8ff'; circ(c, p.x, p.y, 2.2); c.fill();
  }
  c.globalAlpha = 1;
}
function drawHoldRing(c) {
  if (S.hold <= 0 || S.phase !== 'approach') return;
  const st = S.st, p = Math.min(1, S.hold / HOLD_TIME), rad = R + 40;
  c.lineCap = 'round'; c.lineWidth = 16;
  c.strokeStyle = 'rgba(92,255,157,.2)'; circ(c, st.x, st.y, rad); c.stroke();
  c.strokeStyle = '#5cff9d'; c.beginPath(); c.arc(st.x, st.y, rad, -Math.PI / 2, -Math.PI / 2 + TAU * p); c.stroke();
  c.lineCap = 'butt';
}

// ---------- flight data (toggle: H) ----------
function arrow(c, x1, y1, x2, y2, col, w = 3) {
  const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 4) return;
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; line(c, x1, y1, x2, y2);
  c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - Math.cos(a - .45) * 10, y2 - Math.sin(a - .45) * 10); c.lineTo(x2 - Math.cos(a + .45) * 10, y2 - Math.sin(a + .45) * 10); c.closePath(); c.fill();
}
function monoLabel(c, txt, x, y, col = '#cfe8ff', align = 'left') {
  c.font = '500 13px "IBM Plex Mono", monospace'; c.textAlign = align; c.textBaseline = 'middle';
  const w = c.measureText(txt).width; const bx = align === 'left' ? x - 4 : align === 'right' ? x - w - 4 : x - w / 2 - 4;
  c.fillStyle = 'rgba(12,39,70,.85)'; c.fillRect(bx, y - 10, w + 8, 20);
  c.fillStyle = col; c.fillText(txt, x, y + 1);
}
function drawWorldData(c) {
  const st = S.st, sh = S.ship;
  const degS = st.w * 180 / Math.PI;
  // station spin arc + label
  const rad = R + 22, a0 = st.a;
  c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.lineCap = 'round';
  const sweep = clamp(st.w, -1.2, 1.2) * 1.2;
  c.beginPath(); c.arc(st.x, st.y, rad, a0, a0 + sweep, sweep < 0); c.stroke(); c.lineCap = 'butt';
  if (Math.abs(sweep) > .05) { const ea = a0 + sweep, tx = -Math.sin(ea) * Math.sign(sweep), ty = Math.cos(ea) * Math.sign(sweep); const x = st.x + Math.cos(ea) * rad, y = st.y + Math.sin(ea) * rad; c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(x + tx * 10, y + ty * 10); c.lineTo(x - Math.cos(ea) * 7, y - Math.sin(ea) * 7); c.lineTo(x + Math.cos(ea) * 7, y + Math.sin(ea) * 7); c.closePath(); c.fill(); }
  monoLabel(c, `ω ${Math.abs(degS).toFixed(0)}°/s ${degS >= 0 ? 'CW' : 'CCW'}`, st.x + R + 34, st.y - R - 10, '#ffd166');
  // drift arrow
  arrow(c, st.x, st.y, st.x + st.vx * 5, st.y + st.vy * 5, '#7be0a1', 3);
  if (S.phase === 'approach') {
    // line ship -> hub with distance
    const dist = Math.hypot(sh.x - st.x, sh.y - st.y);
    if (dist > 30) {
      c.setLineDash([5, 6]); c.strokeStyle = 'rgba(207,232,255,.6)'; c.lineWidth = 2; line(c, sh.x, sh.y, st.x, st.y); c.setLineDash([]);
      monoLabel(c, `${(dist * M_PER_UNIT).toFixed(0)} m`, (sh.x + st.x) / 2, (sh.y + st.y) / 2, '#cfe8ff', 'center');
    }
    // relative velocity arrow on the ship
    const rvx = sh.vx - st.vx, rvy = sh.vy - st.vy;
    arrow(c, sh.x, sh.y, sh.x + rvx * 1.4, sh.y + rvy * 1.4, '#ff9ec4', 3);
  }
}
function meter(c, x, y, w, label, valTxt, frac, ok, twoSided) {
  c.font = '500 12px "IBM Plex Mono", monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillStyle = '#5f9fd6'; c.fillText(label, x, y);
  c.textAlign = 'right'; c.fillStyle = ok ? '#7be0a1' : '#ffd166'; c.fillText(valTxt, x + w, y); c.textAlign = 'left';
  const my = y + 14;
  c.strokeStyle = '#5f9fd6'; c.lineWidth = 1.5; line(c, x, my, x + w, my);
  for (let k = 0; k <= 10; k++) line(c, x + k * w / 10, my - 3, x + k * w / 10, my + 3);
  c.fillStyle = 'rgba(123,224,161,.45)';
  if (twoSided) c.fillRect(x + w / 2 - w * .06, my - 6, w * .12, 12); else c.fillRect(x, my - 6, w * .12, 12);
  const mx = twoSided ? x + w / 2 + clamp(frac, -1, 1) * w / 2 : x + clamp(frac, 0, 1) * w;
  c.fillStyle = ok ? '#7be0a1' : '#ffd166';
  c.beginPath(); c.moveTo(mx, my - 2); c.lineTo(mx - 6, my - 11); c.lineTo(mx + 6, my - 11); c.closePath(); c.fill();
}
function drawDataPanel(c) {
  const st = S.st, sh = S.ship;
  const pw = Math.min(640, VW - 380), ph = 132;
  if (pw < 300) return;
  const px = (VW - pw) / 2, py = VH - ph - 14;
  // fade the panel out when the Ranger (or the docked pair) is underneath it
  const m = 50, sx = sh.x + ox, sy = sh.y - S.cam + oy;
  const under = sx > px - m && sx < px + pw + m && sy > py - m && sy < py + ph + m;
  S.panelA += ((under ? 0.18 : 1) - S.panelA) * Math.min(1, frameDt * 8);
  c.save(); c.globalAlpha = S.panelA;
  c.fillStyle = 'rgba(12,39,70,.9)'; c.fillRect(px, py, pw, ph);
  c.strokeStyle = '#5f9fd6'; c.lineWidth = 1.5; c.strokeRect(px + .5, py + .5, pw, ph);
  const degS = st.w * 180 / Math.PI, rpm = st.w * 60 / TAU, drift = Math.hypot(st.vx, st.vy) * M_PER_UNIT;
  const lx = px + 14, colW = 220;
  c.font = '500 12px "IBM Plex Mono", monospace'; c.textBaseline = 'middle'; c.textAlign = 'left';
  const row = (y, k, v, col = '#cfe8ff') => { c.fillStyle = '#5f9fd6'; c.fillText(k, lx, y); c.fillStyle = col; c.fillText(v, lx + 78, y); };
  c.fillStyle = '#cfe8ff'; c.font = '700 13px "IBM Plex Mono", monospace'; c.fillText(S.phase === 'approach' ? 'ENDURANCE' : 'ENDURANCE + RANGER', lx, py + 16);
  c.font = '500 12px "IBM Plex Mono", monospace';
  row(py + 36, 'SPIN', `${Math.abs(degS).toFixed(0)}°/s ${degS >= 0 ? 'CW' : 'CCW'}`, '#ffd166');
  row(py + 54, 'RPM', `${Math.abs(rpm).toFixed(1)}`, '#ffd166');
  row(py + 72, 'DRIFT', `${drift.toFixed(1)} m/s ${arrowDir(st.vx, st.vy)}`, '#7be0a1');
  if (S.phase === 'approach') {
    c.fillStyle = '#cfe8ff'; c.font = '700 13px "IBM Plex Mono", monospace'; c.fillText('RANGER', lx, py + 94); c.font = '500 12px "IBM Plex Mono", monospace';
    const sdeg = sh.w * 180 / Math.PI;
    row(py + 112, 'SPIN', `${Math.abs(sdeg).toFixed(0)}°/s ${sdeg >= 0 ? 'CW' : 'CCW'} · ${(Math.hypot(sh.vx, sh.vy) * M_PER_UNIT).toFixed(1)} m/s`);
  } else {
    const zd = Math.max(0, (W - ZONE_W + 30) - st.x) * M_PER_UNIT;
    row(py + 94, 'SAFE ZONE', zd > 0 ? `${zd.toFixed(0)} m →` : 'inside', zd > 0 ? '#cfe8ff' : '#7be0a1');
  }
  // meters
  const mx = px + colW + 20, mw = pw - colW - 36;
  c.strokeStyle = 'rgba(95,159,214,.4)'; line(c, mx - 12, py + 10, mx - 12, py + ph - 10);
  if (S.phase === 'approach') {
    const dist = Math.hypot(sh.x - st.x, sh.y - st.y), dv = Math.hypot(sh.vx - st.vx, sh.vy - st.vy);
    const e = angleErr(sh.a, st.a), dw = sh.w - st.w;
    meter(c, mx, py + 14, mw, 'DISTANCE', `${(dist * M_PER_UNIT).toFixed(1)} m`, dist / 170, dist < TOL.pos, false);
    meter(c, mx, py + 44, mw, 'Δ SPEED', `${(dv * M_PER_UNIT).toFixed(1)} m/s`, dv / 100, dv < TOL.vel, false);
    meter(c, mx, py + 74, mw, 'Δ ANGLE', `${(e * 180 / Math.PI).toFixed(0)}°`, e / (Math.PI / 4), Math.abs(e) < TOL.ang, true);
    meter(c, mx, py + 104, mw, 'Δ SPIN', `${dw >= 0 ? '+' : '−'}${Math.abs(dw * 180 / Math.PI).toFixed(0)}°/s`, dw / 1, Math.abs(dw) < TOL.spin, true);
  } else {
    meter(c, mx, py + 14, mw, 'SPIN LEFT', `${Math.abs(degS).toFixed(1)}°/s`, Math.abs(st.w) / Math.max(.3, DIFF[S.diff].spin), Math.abs(st.w) < WIN_SPIN, false);
    meter(c, mx, py + 44, mw, 'SPEED', `${drift.toFixed(1)} m/s`, drift / 40, true, false);
  }
  c.restore();
}

// ---------- hints (toggle: G): ghost, trail, arrows ----------
function keycap(c, x, y, ch, lit) {
  c.lineWidth = 3; c.strokeStyle = INK; c.fillStyle = lit ? '#ffd34d' : '#ffffff';
  rr(c, x, y, 30, 30, 7); c.fill(); c.stroke();
  c.fillStyle = INK; c.font = '800 17px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, x + 15, y + 16);
}
function outlinedText(c, txt, x, y, col, size = 20, align = 'center') {
  c.font = `800 ${size}px "Baloo 2", sans-serif`; c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = 6; c.strokeStyle = INK; c.strokeText(txt, x, y); c.fillStyle = col; c.fillText(txt, x, y);
}
function drawSpinHint(c, x, y, cw, label) {
  // cw = +1 means "spin clockwise more" (press →)
  const pulse = .55 + .45 * Math.sin(S.time * 6);
  const col = `rgba(255,211,77,${pulse})`, r = 62;
  const a0 = -Math.PI / 2 - cw * .9, a1 = -Math.PI / 2 + cw * .9;
  c.strokeStyle = col; c.lineWidth = 7; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, a0, a1, cw < 0); c.stroke(); c.lineCap = 'butt';
  const tx = -Math.sin(a1) * cw, ty = Math.cos(a1) * cw, hx = x + Math.cos(a1) * r, hy = y + Math.sin(a1) * r;
  c.fillStyle = col; c.beginPath(); c.moveTo(hx + tx * 14, hy + ty * 14); c.lineTo(hx - Math.cos(a1) * 10, hy - Math.sin(a1) * 10); c.lineTo(hx + Math.cos(a1) * 10, hy + Math.sin(a1) * 10); c.closePath(); c.fill();
  keycap(c, x - 15, y - r - 50, cw > 0 ? '→' : '←', down(cw > 0 ? CW : CCW));
  outlinedText(c, label, x, y - r - 64, '#ffd34d', 17);
}
function drawThrustHint(c, sh, need) {
  // need = desired change in velocity (world units/s)
  const mag = Math.hypot(need.x, need.y);
  if (mag < 6) return;
  const pulse = .55 + .45 * Math.sin(S.time * 6);
  const ux = need.x / mag, uy = need.y / mag, start = 46, len = 36 + Math.min(40, mag * .4);
  const x1 = sh.x + ux * start, y1 = sh.y + uy * start, x2 = sh.x + ux * (start + len), y2 = sh.y + uy * (start + len);
  c.lineCap = 'round';
  arrow(c, x1, y1, x2, y2, `rgba(26,16,48,${.6 * pulse})`, 12);
  arrow(c, x1, y1, x2, y2, `rgba(79,216,255,${pulse})`, 7);
  c.lineCap = 'butt';
  // which keys
  const ks = [];
  if (Math.abs(need.y) > 4) ks.push(need.y < 0 ? 'W' : 'S');
  if (Math.abs(need.x) > 4) ks.push(need.x < 0 ? 'A' : 'D');
  let kx = x2 + ux * 22 - ks.length * 17, ky = y2 + uy * 22 - 15;
  for (const k of ks) { keycap(c, kx, ky, k, down('Key' + k)); kx += 34; }
}
function thrustNeed() {
  const st = S.st, sh = S.ship;
  const dx = st.x - sh.x, dy = st.y - sh.y, dist = Math.hypot(dx, dy);
  // aim for a closing speed that gets slower as you get close
  const want = Math.min(55, dist * .35);
  const dvx = (dist > 1 ? dx / dist * want : 0) + st.vx - sh.vx;
  const dvy = (dist > 1 ? dy / dist * want : 0) + st.vy - sh.vy;
  return { x: dvx, y: dvy };
}

// ---------- HUD ----------
function chip(c, x, y, w, label, on) {
  c.lineWidth = 3.5; c.strokeStyle = INK; c.fillStyle = on ? '#5cff9d' : '#4a3f80';
  rr(c, x, y, w, 38, 19); c.fill(); c.stroke();
  c.fillStyle = on ? '#ffffff' : '#6d62a8'; circ(c, x + 20, y + 19, 11); c.fill(); c.lineWidth = 3; c.stroke();
  if (on) { c.strokeStyle = INK; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 14, y + 19); c.lineTo(x + 19, y + 24); c.lineTo(x + 27, y + 13); c.stroke(); c.lineCap = 'butt'; }
  c.font = '800 18px "Baloo 2", sans-serif'; c.fillStyle = on ? INK : '#cfc8ff'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(label, x + 38, y + 21);
}
function stageText() {
  const st = S.st;
  switch (S.phase) {
    case 'title': return '';
    case 'intro': return 'Dr. Mann is docking with Endurance…';
    case 'approach':
      if (S.posM && S.spinM) return 'Hold steady! Clamps locking…';
      if (!S.posM) return 'Pilot: fly onto the yellow hub and match its drift';
      return 'Co-pilot: spin to line up with the ghost ship';
    case 'docked':
      if (Math.abs(st.w) >= WIN_SPIN) return `Docked! Co-pilot: hold ${st.w > 0 ? '←' : '→'} to slow the spin`;
      return 'Pilot: push into the safe zone →';
    case 'won': return 'Mission complete!';
  }
  return '';
}
function drawPlayerBadges(c) {
  // P1
  const y = VH - 112, bh = 98;
  c.lineWidth = 3; c.strokeStyle = INK; c.fillStyle = 'rgba(79,216,255,.92)'; rr(c, 14, y, 132, bh, 16); c.fill(); c.stroke();
  outlinedText(c, 'PILOT', 80, y + 14, '#ffffff', 15);
  keycap(c, 65, y + 28, 'W', down('KeyW'));
  keycap(c, 31, y + 62, 'A', down('KeyA')); keycap(c, 65, y + 62, 'S', down('KeyS')); keycap(c, 99, y + 62, 'D', down('KeyD'));
  // P2
  const x2 = VW - 146;
  c.lineWidth = 3; c.strokeStyle = INK; c.fillStyle = 'rgba(255,138,61,.92)'; rr(c, x2, y, 132, bh, 16); c.fill(); c.stroke();
  outlinedText(c, 'CO-PILOT', x2 + 66, y + 14, '#ffffff', 15);
  keycap(c, x2 + 26, y + 36, '←', down(CCW)); keycap(c, x2 + 76, y + 36, '→', down(CW));
  outlinedText(c, '↺', x2 + 41, y + 82, '#ffffff', 18); outlinedText(c, '↻', x2 + 91, y + 82, '#ffffff', 18);
}
function drawBubble(c) {
  const T = S.talk; if (!T.cur || !opts.talk) return;
  const sh = S.ship;
  const sx = sh.x + ox, sy = sh.y - S.cam + oy;
  const maxW = 300;
  c.font = '20px Bangers, Impact, sans-serif';
  // wrap
  const words = T.cur.text.toUpperCase().split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur);
  const bw = Math.min(maxW, Math.max(...lines.map(l => c.measureText(l).width))) + 36, bh = lines.length * 24 + 34;
  // sit beside the ship, on the side away from the station (and clear of the ring when docked)
  const stx = S.st.x + ox, gap = Math.hypot(S.st.x - sh.x, S.st.y - sh.y) < R + 40 ? R + 40 : 60;
  const leftSide = stx > sx ? true : sx + gap + bw > VW - 160;
  let bx = leftSide ? sx - gap - bw : sx + gap, by = sy - bh / 2 - 30;
  if (bx < 14) bx = sx + gap;
  bx = clamp(bx, 14, VW - bw - 14); by = clamp(by, 110, VH - bh - 130);
  const pop = Math.min(1, (1.6 + T.cur.text.length * 0.045 - T.t) * 6);
  c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(pop, pop); c.translate(-bx - bw / 2, -by - bh / 2);
  c.lineWidth = 4; c.strokeStyle = INK; c.fillStyle = '#ffffff'; c.lineJoin = 'round';
  // tail toward ship
  // short tail from the bubble edge toward the ship
  const cx = bx + bw / 2, cy = by + bh / 2, dl = Math.hypot(sx - cx, sy - cy) || 1, ux = (sx - cx) / dl, uy = (sy - cy) / dl;
  const te = Math.min(Math.abs(ux) > 1e-3 ? (bw / 2 - 18) / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-3 ? (bh / 2 - 6) / Math.abs(uy) : 1e9);
  const ex = cx + ux * te, ey = cy + uy * te, tipX = cx + ux * (te + 34), tipY = cy + uy * (te + 34);
  c.beginPath(); c.moveTo(ex - uy * 14, ey + ux * 14); c.lineTo(tipX, tipY); c.lineTo(ex + uy * 14, ey - ux * 14); c.closePath(); c.fill(); c.stroke();
  rr(c, bx, by, bw, bh, 22); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(ex - uy * 11.5, ey + ux * 11.5); c.lineTo(ex + ux * 6, ey + uy * 6); c.lineTo(ex + uy * 11.5, ey - ux * 11.5); c.closePath(); c.fill();
  // speaker tag
  c.font = '16px Bangers, Impact, sans-serif'; const tw = c.measureText(T.cur.who).width + 18;
  c.fillStyle = { TARS: '#4fd8ff', CASE: '#ffd34d', BRAND: '#ff9ec4' }[T.cur.who] || '#ff8a3d';
  rr(c, bx + 14, by - 12, tw, 24, 8); c.fill(); c.lineWidth = 3; c.stroke();
  c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(T.cur.who, bx + 23, by + 1);
  c.font = '20px Bangers, Impact, sans-serif'; c.textAlign = 'center';
  lines.forEach((l, i) => c.fillText(l, bx + bw / 2, by + 26 + i * 24));
  c.restore();
}
function drawEdgeArrow(c, wx, wy, label) {
  const x = wx + ox, y = wy - S.cam + oy, m = 30;
  if (x > -10 && x < VW + 10 && y > -10 && y < VH + 10) return;
  const cx = clamp(x, m, VW - m), cy = clamp(y, m + 60, VH - m - 100);
  const a = Math.atan2(y - cy, x - cx);
  c.save(); c.translate(cx, cy); c.rotate(a);
  c.fillStyle = '#ffd34d'; c.strokeStyle = INK; c.lineWidth = 3;
  c.beginPath(); c.moveTo(18, 0); c.lineTo(-10, -14); c.lineTo(-4, 0); c.lineTo(-10, 14); c.closePath(); c.fill(); c.stroke();
  c.restore();
  outlinedText(c, label, cx - Math.cos(a) * 34, cy - Math.sin(a) * 26, '#ffffff', 14);
}
function drawHUD(c) {
  chip(c, 14, 14, 150, 'Position', S.posM || S.phase === 'docked' || S.phase === 'won');
  chip(c, 172, 14, 110, 'Spin', S.spinM || S.phase === 'docked' || S.phase === 'won');
  const txt = stageText();
  if (txt) {
    c.font = '800 19px "Baloo 2", sans-serif';
    const w = c.measureText(txt).width + 36, x = clamp(VW / 2 - w / 2, 296, VW - w - 14), y = 62;
    c.lineWidth = 3.5; c.strokeStyle = INK; c.fillStyle = S.phase === 'docked' ? '#ff8a3d' : '#f6f2ff';
    rr(c, x, y, w, 36, 18); c.fill(); c.stroke();
    c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(txt, x + 18, y + 20);
  }
  // hold countdown
  if (S.phase === 'approach' && S.hold > 0) {
    const st = S.st, n = Math.ceil(HOLD_TIME - S.hold);
    const x = st.x + ox, y = st.y - S.cam + oy + R + 96;
    outlinedText(c, String(n), x, y, '#ffffff', 64);
    outlinedText(c, 'Hold steady!', x, y + 44, '#ffd34d', 20);
  }
  if (S.phase === 'won' && S.time - S.wonAt < 2.2) {
    const s = 1 + .08 * Math.sin(S.time * 12);
    c.save(); c.translate(VW / 2, VH / 2 - 40); c.scale(s, s); outlinedText(c, 'SAFE!', 0, 0, '#5cff9d', 72); c.restore();
  }
  drawPlayerBadges(c);
  if (opts.data && S.phase !== 'intro') drawDataPanel(c);
  // (the pause menu itself is HTML: #pauseMenu)
}

// ---------- frame ----------
function render() {
  const c = ctx;
  c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  c.lineCap = 'butt'; c.lineJoin = 'miter'; c.globalAlpha = 1;
  drawBackground(c);
  drawPlanet(c);
  drawSafeZone(c);

  const live = S.phase !== 'title';
  c.save(); c.translate(ox, oy - S.cam);
  if (live && opts.hints && S.phase === 'approach') drawTrail(c);
  drawParticles(c, 'smoke');
  drawHoldRing(c);
  drawStation(c, S.st, S.intact);
  if (S.intact) drawMann(c, S.st);
  drawParticles(c, 'frag');
  drawFlash(c, S.st);
  if (live && opts.hints && S.phase === 'approach') drawGhost(c);
  if (live) drawShip(c, S.ship, S.phase === 'approach' || S.phase === 'docked');
  if (live && opts.data && S.phase !== 'won' && S.phase !== 'intro') drawWorldData(c);
  if (live && opts.hints && !paused) {
    if (S.phase === 'approach') {
      if (!S.posM) drawThrustHint(c, S.ship, thrustNeed());
      else if (!S.spinM) {
        const dw = S.st.w - S.ship.w, e = angleErr(S.ship.a, S.st.a);
        // if spin rates match but angle is off, nudge toward the ghost
        const cw = Math.abs(dw) > TOL.spin * .6 ? Math.sign(dw) : -Math.sign(e);
        drawSpinHint(c, S.ship.x, S.ship.y, cw || 1, Math.abs(dw) > TOL.spin * .6 ? (Math.sign(dw) === Math.sign(S.st.w) ? 'Spin faster!' : 'Slow your spin!') : 'Line up!');
      }
    } else if (S.phase === 'docked') {
      if (Math.abs(S.st.w) >= WIN_SPIN) drawSpinHint(c, S.st.x, S.st.y, -Math.sign(S.st.w), 'Slow the spin!');
      else drawThrustHint(c, S.st, { x: Math.max(0, (W - ZONE_W + 60 - S.st.x)) * .4 + 10 - S.st.vx, y: -S.st.vy });
    }
  }
  c.restore();

  // confetti (screen space)
  const conf = ['#ff8a3d', '#ffd34d', '#5cff9d', '#4fd8ff', '#ffffff', '#ff6fa8'];
  for (const q of S.confetti.p) { c.save(); c.translate(q.x + Math.sin(q.age * 3 + q.seed * 9) * 8, q.y); c.rotate(q.rot); c.fillStyle = conf[Math.floor(q.seed * conf.length)]; c.fillRect(-6, -3, 12, 6 * Math.abs(Math.cos(q.age * 4 + q.seed * 7))); c.restore(); }

  if (live) {
    drawEdgeArrow(c, S.ship.x, S.ship.y, 'Ranger');
    drawEdgeArrow(c, S.st.x, S.st.y, 'Endurance');
    drawHUD(c);
    drawBubble(c);
  }
}

let last = performance.now(), frameDt = 0;
function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now; frameDt = dt;
  if (!paused) update(dt);
  render();
  requestAnimationFrame(loop);
}
newGame('normal', true);
syncButtons();
loadTrack();
requestAnimationFrame(loop);

// debug / testing hook
window.__dock = { get state() { return S; }, newGame, update, render };
})();
