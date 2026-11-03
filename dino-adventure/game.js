/* The Runaway Egg: pages, choices, saving, read-aloud and the animated picture. */
(function () {
  'use strict';
  const S0 = window.STORY, ART = window.ART, PICS = window.SCENE_ART;
  const { W, H } = ART;
  const $ = (id) => document.getElementById(id);
  const canvas = $('art'), stageEl = $('stage'), wordsEl = $('words'), choicesEl = $('choices');
  const pouchEl = $('pouch'), backBtn = $('backBtn'), readBtn = $('readBtn');
  const titleEl = $('pageTitle'), popEl = $('pop');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- saving ---------- */
  const KEY = 'runaway-egg-save', ENDKEY = 'runaway-egg-endings';
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };
  const clear = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

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

  /* ---------- little drawn icons for Pip's pouch ---------- */
  const ITEM_SVG = {
    berries: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M15 3c4 0 7 2 8 6-4 0-7-2-8-6z" fill="#5aa83f"/><circle cx="10.5" cy="17" r="6.5" fill="#5b5fc7"/><circle cx="21.5" cy="16" r="6.5" fill="#6a6fd6"/><circle cx="16" cy="25" r="6" fill="#4d51b8"/><circle cx="8.5" cy="15" r="1.7" fill="#fff" opacity=".7"/><circle cx="19.5" cy="14" r="1.7" fill="#fff" opacity=".7"/></svg>',
    feather: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M24 3C14 6 8 14 8 24l2 5c3-10 8-17 14-26z" fill="#4fa3e8"/><path d="M10 28L22 6" stroke="#2f6fb0" stroke-width="1.6" stroke-linecap="round"/></svg>',
    moss: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 25c0-6 4-9 8-8 1-4 6-6 9-3 4-1 8 2 7 7 2 2 1 6-2 6H6c-2 0-2-1-2-2z" fill="#6fae55"/><circle cx="11" cy="21" r="1.8" fill="#a6d98a"/><circle cx="19" cy="18" r="1.8" fill="#a6d98a"/><circle cx="23" cy="24" r="1.6" fill="#a6d98a"/></svg>',
    song: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M12 6v14.6A4.5 4 0 1 0 14 24V11.5l10-2.4v8.1A4.5 4 0 1 0 26 21V3.5z" fill="#ab47bc"/></svg>',
  };

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

  // a small still picture of an ending, for the sticker book
  const thumbs = {};
  function thumb(endId) {
    if (thumbs[endId]) return thumbs[endId];
    const pic = PICS[S0.SCENES[endId].art], w = 240, h = 135, k = w / W;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const x = c.getContext('2d');
    const st = Object.assign(S0.newState(), { buddy: 'tops', name: 'Peanut', friends: ['crocs', 'stego', 'raptors', 'glow'], warm: 2 });
    try {
      x.setTransform(k, 0, 0, k, 0, 0);
      const P = new ART.Painter(x, k, b);
      if (pic.bg) pic.bg(P, st);
      pic.fg(P, 2.2, st, { phase: 'read', choice: null, reactT: 2, hop: 0 });
      if (pic.front) pic.front(P, st);
      P.finish();
    } catch (e) { console.error(e); }
    return (thumbs[endId] = c.toDataURL());
  }

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

  function button(text, onClick, cls = '') {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'choice ' + cls;
    b.innerHTML = `<span class="say">${lineHTML(text)}</span>`;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderPouch(fresh) {
    pouchEl.innerHTML = '';
    for (const id of state.items) {
      const it = S0.ITEMS[id]; if (!it) continue;
      const d = document.createElement('div'); d.className = 'item' + (id === fresh ? ' new' : ''); d.title = it.name;
      d.innerHTML = ITEM_SVG[id] || '';
      pouchEl.appendChild(d);
    }
  }
  function turnPage() {
    for (const el of [stageEl, wordsEl, choicesEl]) { el.classList.remove('turn'); void el.offsetWidth; el.classList.add('turn'); }
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
      choicesEl.appendChild(button('The End', showEndCard, 'next'));
    } else if (!sc.choices) {
      choicesEl.appendChild(button('Next page', () => goNext(null), 'next'));
    } else {
      for (const c of S0.choicesFor(state)) {
        const b = button(S0.labelFor(c, state), () => pick(c), c.secret ? 'secret' : '');
        if (c.secret) b.insertAdjacentHTML('beforeend', '<span class="tag">Secret!</span>');
        choicesEl.appendChild(b);
      }
    }
    backBtn.hidden = !history.length;
    renderPouch();
    turnPage();
    save();
  }

  function pick(c) {
    const hadItems = new Set(state.items);
    S0.applyChoice(state, c);
    const react = S0.reactFor(c, state);
    view.hopStart = performance.now();
    if (!react) { goNext(c); return; }
    view.phase = 'react'; view.choice = c; view.reactStart = performance.now();
    showWords(react, 'react');
    const chips = [];
    if (c.star) chips.push(`<span class="chip">${S0.STARS[c.star].name}!</span>`);
    const fresh = state.items.find((i) => !hadItems.has(i));
    if (fresh) chips.push(`<span class="chip"><span class="mini">${ITEM_SVG[fresh] || ''}</span>Got: ${S0.ITEMS[fresh].name}</span>`);
    if (chips.length) wordsEl.insertAdjacentHTML('beforeend', `<div class="chips">${chips.join('')}</div>`);
    renderPouch(fresh);
    choicesEl.innerHTML = '';
    const next = button('Next page', () => goNext(c), 'next');
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
    if (mode === 'end' || view.phase === 'react') { state = JSON.parse(pageStart); showPage(); return; }
    if (!history.length) return;
    pageStart = history.pop(); state = JSON.parse(pageStart); showPage();
  });

  /* ---------- title and end ---------- */
  function stickersHTML() {
    const found = load(ENDKEY, []);
    return '<div class="stickers">' + S0.ENDINGS.map((e) => {
      const got = found.includes(e.id);
      return `<div class="sticker ${got ? 'got' : 'missing'}"><div class="disc">${got ? `<img src="${thumb(e.id)}" alt="">` : '?'}</div>${got ? e.title : '???'}</div>`;
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
      <div class="sub" style="font-size:.8em">Pip is a <button type="button" class="big" data-say="Parasaurolophus">Parasaurolophus</button>. Tap the picture to make Pip honk!</div>
      ${stickersHTML()}`;
    choicesEl.innerHTML = '';
    const saved = load(KEY, null);
    const row = document.createElement('div'); row.className = 'row';
    if (saved && saved.state && S0.SCENES[saved.state.scene] && saved.state.scene !== S0.START) {
      row.appendChild(button('Keep reading', () => { state = saved.state; history = saved.history || []; pageStart = snap(state); showPage(); }));
      row.appendChild(button('Start again', startNew));
    } else {
      row.appendChild(button('Start the story', startNew));
    }
    choicesEl.appendChild(row);
    turnPage();
  }
  function startNew() {
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
      <div class="sub"><b>${end.title}</b>${isNew ? ' (a new ending!)' : ''}</div>
      <div class="badge">${top.badge}</div>
      ${stickersHTML()}
      ${found.length < S0.ENDINGS.length ? '<div class="sub" style="font-size:.85em">Read again and pick different things to find more endings!</div>' : '<div class="sub">You found every ending. Wow!</div>'}`;
    choicesEl.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row';
    row.appendChild(button('Read it again', startNew));
    row.appendChild(button('Back to the start', showTitle));
    choicesEl.appendChild(row);
    backBtn.hidden = false;
    for (const el of [wordsEl, choicesEl]) { el.classList.remove('turn'); void el.offsetWidth; el.classList.add('turn'); }
  }

  /* ---------- tap the picture: Pip honks ---------- */
  stageEl.addEventListener('click', () => {
    view.hopStart = performance.now();
    popEl.classList.remove('show'); void popEl.offsetWidth; popEl.classList.add('show');
  });

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
