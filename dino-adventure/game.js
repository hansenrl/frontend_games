/* The Runaway Egg: pages, choices, saving, sound and the animated picture. */
(function () {
  'use strict';
  const S0 = window.STORY, ART = window.ART, PICS = window.SCENE_ART;
  const { W, H } = ART;
  const $ = (id) => document.getElementById(id);
  const canvas = $('art'), stageEl = $('stage'), wordsEl = $('words'), choicesEl = $('choices');
  const pouchEl = $('pouch'), backBtn = $('backBtn'), readBtn = $('readBtn'), soundBtn = $('soundBtn');
  const titleEl = $('pageTitle'), popEl = $('pop');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- saving ---------- */
  const KEY = 'runaway-egg-save', ENDKEY = 'runaway-egg-endings', MUTEKEY = 'runaway-egg-muted';
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const clear = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

  /* ---------- sound (made with Web Audio, no files) ---------- */
  const Sound = (() => {
    let ac = null, master = null, muted = load(MUTEKEY, false);
    function ctx() {
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination); } catch (e) { return null; }
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(f, dur, o = {}) {
      if (muted) return; const a = ctx(); if (!a) return;
      const t = a.currentTime + (o.delay || 0), osc = a.createOscillator(), g = a.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      if (o.vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.03; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur); }
      let out = osc;
      if (o.lp) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; osc.connect(fl); out = fl; }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.att || 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      out.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + 0.05);
    }
    function noise(dur, o = {}) {
      if (muted) return; const a = ctx(); if (!a) return;
      const t = a.currentTime + (o.delay || 0), len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(); src.buffer = buf;
      const fl = a.createBiquadFilter(); fl.type = o.type || 'lowpass'; fl.frequency.setValueAtTime(o.f || 800, t); if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      const g = a.createGain(); g.gain.setValueAtTime(o.vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(fl); fl.connect(g); g.connect(master); src.start(t);
    }
    const fx = {
      toot() { tone(196, 0.9, { type: 'sawtooth', lp: 900, vib: 6, vol: 0.28, att: 0.06 }); tone(294, 0.9, { type: 'sawtooth', lp: 700, vib: 6, vol: 0.12, att: 0.08 }); },
      tap() { for (let i = 0; i < 3; i++) tone(950, 0.06, { type: 'triangle', delay: i * 0.17, vol: 0.25 }); },
      roar() { noise(1.3, { f: 700, to: 150, vol: 0.5 }); tone(90, 1.2, { type: 'sawtooth', to: 60, lp: 400, vol: 0.25, att: 0.1 }); },
      crash() { noise(0.6, { type: 'highpass', f: 600, vol: 0.4 }); tone(80, 0.4, { to: 40, vol: 0.4 }); },
      splash() { noise(0.7, { type: 'bandpass', f: 1600, to: 500, vol: 0.4 }); },
      hum() { [523, 587, 659, 587, 523].forEach((f, i) => tone(f, 0.38, { delay: i * 0.3, vol: 0.2, att: 0.05 })); },
      cheer() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', delay: i * 0.1, vol: 0.22 })); },
      pop() { tone(500, 0.15, { to: 1100, vol: 0.2 }); },
      page() { noise(0.18, { type: 'highpass', f: 2500, vol: 0.08 }); },
      crack() { noise(0.08, { type: 'highpass', f: 1800, vol: 0.35 }); noise(0.08, { type: 'highpass', f: 1500, vol: 0.35, delay: 0.3 }); },
      achoo() { noise(0.5, { type: 'bandpass', f: 1200, to: 3000, vol: 0.45, delay: 0.05 }); },
    };
    return {
      play(name) { if (fx[name]) fx[name](); },
      get muted() { return muted; },
      toggle() { muted = !muted; store(MUTEKEY, muted); return muted; },
      wake() { ctx(); },
    };
  })();

  /* ---------- reading out loud ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\*/g, '').replace(/T\. rex/g, 'T rex'));
      u.rate = 0.85; u.pitch = 1.05; u.lang = 'en-US';
      speechSynthesis.speak(u);
    } catch (e) { /* no voice */ }
  }
  if (!('speechSynthesis' in window)) readBtn.hidden = true;

  /* ---------- the picture ---------- */
  const view = { art: 'title', cache: {}, k: 1, start: performance.now(), reactStart: 0, hopStart: -10, phase: 'read', choice: null };
  const buf = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.min(1800, Math.round(r.width * d)));
    if (canvas.width !== w) {
      canvas.width = w; canvas.height = Math.round((w * H) / W);
      buf.width = canvas.width; buf.height = canvas.height;
      view.k = canvas.width / W; view.cache = {};
    }
  }
  function layer(name, fn) {
    const key = view.art + ':' + name;
    if (view.cache[key] !== undefined) return view.cache[key];
    if (!fn) return (view.cache[key] = null);
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.setTransform(view.k, 0, 0, view.k, 0, 0);
    try { fn(new ART.Painter(x, view.k, buf), state); } catch (e) { console.error(e); }
    return (view.cache[key] = c);
  }
  function draw(now) {
    const pic = PICS[view.art] || PICS.title, k = view.k;
    const t = reduce ? 3 : (now - view.start) / 1000;
    const reactT = reduce ? 3 : (now - view.reactStart) / 1000;
    const ht = (now - view.hopStart) / 1000;
    const A = { phase: view.phase, choice: view.choice, reactT, hop: !reduce && ht < 0.45 ? -Math.sin((ht / 0.45) * Math.PI) * 22 : 0 };
    const [dx, dy] = !reduce && pic.shake ? pic.shake(t, state) : [0, 0];
    const bg = layer('bg', pic.bg), front = layer('front', pic.front);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bg) ctx.drawImage(bg, dx * k, dy * k);
    ctx.setTransform(k, 0, 0, k, dx * k, dy * k);
    const P = new ART.Painter(ctx, k, buf);
    try { pic.fg(P, t, state, A); } catch (e) { console.error(e); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (front) ctx.drawImage(front, dx * k, dy * k);
    ctx.setTransform(k, 0, 0, k, 0, 0); P.finish();
  }
  function loop(now) { sizeCanvas(); draw(now); requestAnimationFrame(loop); }
  new ResizeObserver(() => { sizeCanvas(); }).observe(canvas);

  /* ---------- story state ---------- */
  let state = S0.newState();
  let history = [];          // snapshots of earlier pages, for the back button
  let pageStart = null;      // snapshot of this page before a choice
  let mode = 'title';        // title | page | end

  const snap = (s) => JSON.stringify(s);
  function save() { store(KEY, { state: JSON.parse(pageStart), history }); }

  /* ---------- words ---------- */
  function lineHTML(line) {
    const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\*([^*]+)\*/g, (m, w) => `<button type="button" class="big" data-say="${w}">${w}</button>`)
      .replace(/\bPip\b/g, '<span class="pip">Pip</span>');
  }
  function showWords(lines, cls = '') {
    wordsEl.className = 'words ' + cls;
    wordsEl.innerHTML = lines.map((l) => `<p>${lineHTML(l)}</p>`).join('');
  }
  wordsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.big'); if (b) { e.stopPropagation(); speak(b.dataset.say); }
  });
  readBtn.addEventListener('click', () => speak([...wordsEl.querySelectorAll('p')].map((p) => p.textContent).join(' ')));

  function button(icon, text, onClick, cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice ' + cls;
    b.innerHTML = `<span class="icon" aria-hidden="true">${icon}</span><span class="say">${lineHTML(text)}</span>`;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderPouch(fresh) {
    pouchEl.innerHTML = '';
    for (const id of state.items) {
      const it = S0.ITEMS[id]; if (!it) continue;
      const d = document.createElement('div'); d.className = 'item' + (id === fresh ? ' new' : ''); d.title = it.name; d.textContent = it.icon;
      pouchEl.appendChild(d);
    }
  }
  function turnPage() {
    for (const el of [stageEl, wordsEl, choicesEl]) { el.classList.remove('turn'); void el.offsetWidth; el.classList.add('turn'); }
    Sound.play('page');
  }
  function setArt(name) { if (view.art !== name) { view.art = name; view.cache = {}; } view.start = performance.now(); }

  /* ---------- pages ---------- */
  function showPage() {
    mode = 'page';
    const sc = S0.SCENES[state.scene];
    view.phase = 'read'; view.choice = null;
    setArt(sc.art);
    titleEl.textContent = sc.title;
    showWords(S0.textFor(state));
    choicesEl.innerHTML = '';
    if (sc.end) {
      choicesEl.appendChild(button('📖', 'The End', showEndCard, 'next'));
    } else if (!sc.choices) {
      choicesEl.appendChild(button('▶', 'Next page', () => goNext(null), 'next'));
    } else {
      for (const c of S0.choicesFor(state)) {
        const b = button(c.icon, S0.labelFor(c, state), () => pick(c), c.secret ? 'secret' : '');
        if (c.secret) b.insertAdjacentHTML('beforeend', '<span class="tag">⭐ Secret!</span>');
        choicesEl.appendChild(b);
      }
    }
    backBtn.hidden = !history.length;
    renderPouch();
    turnPage();
    if (state.scene === 'a3_hatch') setTimeout(() => Sound.play('crack'), 400);
    if (state.scene === 'end_achoo') setTimeout(() => Sound.play('achoo'), 1250);
    if (sc.end) Sound.play('cheer');
    save();
  }

  function pick(c) {
    Sound.wake();
    const hadItems = new Set(state.items);
    S0.applyChoice(state, c);
    const react = S0.reactFor(c, state);
    if (c.sound) Sound.play(c.sound);
    view.hopStart = performance.now();
    if (!react) { goNext(c); return; }
    view.phase = 'react'; view.choice = c; view.reactStart = performance.now();
    showWords(react, 'react');
    const chips = [];
    if (c.star) { const st = S0.STARS[c.star]; chips.push(`<span class="chip">${st.icon} ${st.name}!</span>`); }
    const fresh = state.items.find((i) => !hadItems.has(i));
    if (fresh) { chips.push(`<span class="chip">${S0.ITEMS[fresh].icon} Got: ${S0.ITEMS[fresh].name}</span>`); setTimeout(() => Sound.play('pop'), 300); }
    if (chips.length) wordsEl.insertAdjacentHTML('beforeend', `<div class="chips">${chips.join('')}</div>`);
    renderPouch(fresh);
    choicesEl.innerHTML = '';
    const next = button('▶', 'Next page', () => goNext(c), 'next');
    choicesEl.appendChild(next);
    backBtn.hidden = false;
    for (const el of [wordsEl, choicesEl]) { el.classList.remove('turn'); void el.offsetWidth; el.classList.add('turn'); }
    next.focus({ preventScroll: true });
  }

  function goNext(c) {
    const id = S0.nextFor(c, state);
    history.push(pageStart);
    S0.goTo(state, id);
    pageStart = snap(state);
    showPage();
  }

  backBtn.addEventListener('click', () => {
    if (mode === 'end') { state = JSON.parse(pageStart); showPage(); return; }
    if (view.phase === 'react') { state = JSON.parse(pageStart); showPage(); return; }
    if (!history.length) return;
    pageStart = history.pop(); state = JSON.parse(pageStart); showPage();
  });

  /* ---------- title and end ---------- */
  function stickersHTML(justFound) {
    const found = load(ENDKEY, []);
    return '<div class="stickers">' + S0.ENDINGS.map((e) => {
      const got = found.includes(e.id);
      return `<div class="sticker ${got ? 'got' : 'missing'}"><div class="disc">${got ? e.icon : '?'}</div>${got ? e.title : '???'}</div>`;
    }).join('') + '</div>' + `<div class="sub">Endings found: ${found.length} of ${S0.ENDINGS.length}</div>`;
  }

  function showTitle() {
    mode = 'title';
    setArt('title'); view.phase = 'read'; view.choice = null;
    titleEl.textContent = '';
    pouchEl.innerHTML = '';
    backBtn.hidden = true;
    wordsEl.className = 'words card';
    wordsEl.innerHTML = `<h1 class="card-title">The Runaway Egg</h1>
      <div class="sub">A dinosaur story. <b>You</b> choose what happens!</div>
      <div class="sub" style="font-size:.8em">Pip is a <button type="button" class="big" data-say="Parasaurolophus">Parasaurolophus</button>. Tap Pip to hear a TOOT!</div>
      ${stickersHTML()}`;
    choicesEl.innerHTML = '';
    const saved = load(KEY, null);
    const row = document.createElement('div'); row.className = 'row';
    if (saved && saved.state && S0.SCENES[saved.state.scene] && saved.state.scene !== S0.START) {
      row.appendChild(button('📖', 'Keep reading', () => { state = saved.state; history = saved.history || []; pageStart = snap(state); Sound.wake(); showPage(); }));
      row.appendChild(button('🥚', 'Start again', startNew));
    } else {
      row.appendChild(button('🥚', 'Start the story', startNew));
    }
    choicesEl.appendChild(row);
    turnPage();
  }
  function startNew() {
    Sound.wake();
    state = S0.newState(); history = []; pageStart = snap(state);
    showPage();
  }
  function showEndCard() {
    mode = 'end';
    const sc = S0.SCENES[state.scene], end = S0.ENDINGS.find((e) => e.id === state.scene);
    const found = load(ENDKEY, []), isNew = !found.includes(end.id);
    if (isNew) { found.push(end.id); store(ENDKEY, found); }
    clear(KEY);
    const top = S0.STARS[S0.topStar(state)];
    titleEl.textContent = sc.title;
    wordsEl.className = 'words card';
    wordsEl.innerHTML = `<h1 class="card-title">The End</h1>
      <div class="sub">${end.icon} <b>${end.title}</b>${isNew ? ' (a new ending!)' : ''}</div>
      <div class="badge">${top.icon} ${top.badge}</div>
      ${stickersHTML()}
      ${found.length < S0.ENDINGS.length ? '<div class="sub" style="font-size:.85em">Read again and pick different things to find more endings!</div>' : '<div class="sub">You found every ending. Wow!</div>'}`;
    choicesEl.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row';
    row.appendChild(button('🥚', 'Read it again', startNew));
    row.appendChild(button('🏠', 'Back to the start', showTitle));
    choicesEl.appendChild(row);
    backBtn.hidden = false;
    Sound.play('cheer');
    for (const el of [wordsEl, choicesEl]) { el.classList.remove('turn'); void el.offsetWidth; el.classList.add('turn'); }
  }

  /* ---------- tap the picture: Pip toots ---------- */
  stageEl.addEventListener('click', () => {
    Sound.wake(); Sound.play('toot');
    view.hopStart = performance.now();
    popEl.classList.remove('show'); void popEl.offsetWidth; popEl.classList.add('show');
  });

  soundBtn.addEventListener('click', () => { const m = Sound.toggle(); soundBtn.textContent = m ? '🔇' : '🔊'; soundBtn.classList.toggle('off', m); });
  if (Sound.muted) { soundBtn.textContent = '🔇'; soundBtn.classList.add('off'); }

  // ?page=a3_rex&buddy=tops jumps straight to a page (handy for testing)
  const q = new URLSearchParams(location.search);
  if (q.get('page') && S0.SCENES[q.get('page')]) {
    state = S0.newState(); state.scene = q.get('page'); state.buddy = q.get('buddy') || 'tops';
    if (q.get('name')) state.name = q.get('name');
    (q.get('friends') || '').split(',').filter(Boolean).forEach((f) => state.friends.push(f));
    (q.get('items') || '').split(',').filter(Boolean).forEach((f) => state.items.push(f));
    (q.get('flags') || '').split(',').filter(Boolean).forEach((f) => { state.flags[f] = true; });
    if (q.get('warm')) state.warm = +q.get('warm');
    pageStart = snap(state); showPage();
  } else showTitle();

  sizeCanvas();
  requestAnimationFrame(loop);
})();
