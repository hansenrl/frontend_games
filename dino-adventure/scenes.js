/*
 * The picture for every page of The Runaway Egg, in the papercraft style.
 *
 * Each entry (keyed by the page's `art` name in story.js) has:
 *   bg(P, S)          drawn once and cached: sky, hills, things that never move
 *   fg(P, t, S, A)    drawn every frame: characters and anything that moves
 *   front(P, S)       optional, cached, drawn over the characters (foreground ferns)
 *   shake(t, S)       optional, returns [dx, dy] to shake the whole picture
 *
 * S is the story state (buddy, friends, items, flags...).
 * A is what is happening on the page: A.phase is 'read' or 'react', A.choice is the
 * choice just picked, A.reactT is seconds since it was picked, A.hop lifts Pip.
 */
(function (root) {
  'use strict';
  const {
    W, H, TAU, clamp, lerp, ease, hash, blob, ell, poly, rr, tube, lp, F, E, Ln, place,
    pip, eggShape, shellBottom, shellTop, rex, babyRex, tops, zippy, raptor, longneck, shelly, stego, croc,
    hill, tree, palm, fern, cloud, rock, bush, mush, volcano, heart, note, star, bone, footprint, zzz,
  } = root.ART;

  /* ---------- palettes ---------- */
  const SKY_DAY = [[0, '#93d3ef'], [0.65, '#d4f0ec'], [1, '#f4ecd0']];
  const SKY_SUNSET = [[0, '#f59a78'], [0.55, '#fcd2a0'], [1, '#fde9c9']];
  const SKY_DAWN = [[0, '#f6b8a0'], [0.55, '#fde0c0'], [1, '#f4ecd0']];
  const SKY_NIGHT = [[0, '#1d2556'], [0.6, '#3c3f86'], [1, '#8a6fa8']];
  const SKY_SMOKE = [[0, '#e9a36a'], [0.6, '#f3cf98'], [1, '#f6e3c0']];
  const SKY_DUSK = [[0, '#7b6bb8'], [0.5, '#e99aa0'], [1, '#fbd7a8']];
  const TREE = { trunk: '#a8744a', leaf: '#6fbf4f', leaf2: '#5aa83f', hi: '#a3de7e' };
  const DARK_TREE = { trunk: '#7a5236', leaf: '#3f8a45', leaf2: '#2f7038', hi: '#5fae5a' };
  const PALM = { trunk: '#b98a5a', leaf: '#4f9e3c', leaf2: '#6cb84f' };
  const PIP_BODY = '#7cc35a';
  const PIP_ARM = [[32, -82], [47, -72], [53, -60], [44, -58], [29, -72]];
  const has = (S, i) => S.items.includes(i);
  const fr = (S, f) => S.friends.includes(f);
  const picked = (A, fn) => A.phase === 'react' && A.choice && fn(A.choice);

  /* ---------- shared pieces ---------- */
  // Pip, optionally hugging the egg (arm drawn over the egg)
  function drawPip(P, t, S, A, x, y, s, o = {}) {
    let parts;
    if (o.hold) {
      parts = pip(t, { ...o, noArm: true });
      parts.push(...place(eggShape(t, { moss: has(S, 'moss'), crack: o.crack }), { x: 54, y: -34, s: 0.8, r: o.wob || 0, px: 0, py: -20 }));
      parts.push(F(blob(PIP_ARM), PIP_BODY));
    } else parts = pip(t, o);
    P.obj(place(parts, { x, y: y + (o.noHop ? 0 : A.hop || 0), s, flip: o.flip, r: o.r || 0, px: 0, py: -60 }));
  }
  function drawBuddy(P, t, S, x, y, s, o = {}) {
    if (!S.buddy) return;
    const yy = y + (o.hop || 0);
    if (S.buddy === 'tops') P.obj(place(tops(t, o), { x, y: yy, s, flip: o.flip }));
    else if (S.buddy === 'shelly') P.obj(place(shelly(t, o), { x, y: yy, s: s * 1.1, flip: o.flip }));
    else if (o.fly) P.obj(place(zippy(t, o), { x, y: yy - 150 * s + Math.sin(t * 1.6) * 8, s: s * 1.1, flip: o.flip }));
    else P.obj(place(zippy(t, { perched: true, ...o }), { x, y: yy, s: s * 1.3, flip: o.flip }));
  }
  function sunStick(P, t, x = 112, y = 96, c1 = '#ffd54a', c2 = '#ffb63b') {
    const rays = [];
    for (let i = 0; i < 10; i++) {
      const a = t * 0.35 + (i * TAU) / 10;
      rays.push(F(poly([[Math.cos(a - 0.17) * 34, Math.sin(a - 0.17) * 34], [Math.cos(a) * 58, Math.sin(a) * 58], [Math.cos(a + 0.17) * 34, Math.sin(a + 0.17) * 34]]), c2));
    }
    P.obj(place([Ln(lp([[0, -200], [0, -34]]), '#8a6a4a', 2), ...rays, F(ell(0, 0, 36, 36), c1), E(-12, -4, 4.5, 0), E(12, -4, 4.5, 0),
      Ln(lp([[-10, 10], [0, 16], [10, 10]]), '#b8651f', 2.4), F(ell(-20, 8, 5, 3), '#ff9a6a', 'flat'), F(ell(20, 8, 5, 3), '#ff9a6a', 'flat')], { x, y }));
  }
  function clouds(P, t, list = [[310, 76, 0.95, 0], [548, 54, 0.75, 1.4]], c = '#ffffff') {
    for (const [x, y, s, ph] of list) P.obj(place([Ln(lp([[0, -130], [0, -22]]), '#8a6a4a', 1.5), ...cloud(0, 0, 1, c)], { x, y, s, r: Math.sin(t * 0.9 + ph) * 0.06, px: 0, py: -130 }));
  }
  function smoke(P, t, x = 600, y = 146, c = '#e2daea', n = 4, s = 1) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.2 + i / n) % 1;
      P.obj([F(ell(x + (Math.sin(ph * 5 + i) * 10 + ph * 36) * s, y - ph * 120 * s, (9 + ph * 22) * s, (8 + ph * 18) * s), c)], { blur: 3, sx: 1, sy: 2, alpha: Math.min(1, (1 - ph) * 1.6) });
    }
  }
  function valleyBg(P, o = {}) {
    P.sky(o.sky || SKY_DAY);
    if (o.sun) P.obj([F(ell(o.sun[0], o.sun[1], o.sun[2], o.sun[2]), o.sun[3])], { blur: 8 });
    if (o.volcano !== false) P.obj(volcano(o.vx ?? 600, o.vy ?? 320, o.vs ?? 1), { blur: 3, sx: 2, sy: 3 });
    P.obj(hill(268, 40, 0.3, o.h1 || '#b4dc86'), { blur: 4 });
    if (o.trees !== false) { P.obj(tree(110, 302, 0.62, TREE)); P.obj(tree(705, 296, 0.5, TREE)); }
    P.obj(hill(318, 30, 2.1, o.h2 || '#8cc85e'), { blur: 4 });
    if (o.palm !== false) P.obj(palm(520, 326, 0.55, PALM, 4));
    P.obj([F(blob([[-60, 372], [200, 360], [420, 368], [640, 356], [860, 366], [880, 540], [-80, 540]]), o.g || '#79b851')], { blur: 5 });
  }
  function frontFerns(P, flowers = true, left = true) {
    if (left) P.obj(fern(36, 456, 1.15, '#4f9e3c', '#6cb84f'));
    P.obj(fern(772, 458, 1.05, '#4f9e3c', '#6cb84f'));
    if (flowers) [[150, 440, '#ff8fb1'], [600, 446, '#ffd54a'], [690, 436, '#ff8fb1']].forEach(([x, y, c]) => P.obj([Ln(lp([[x, y + 30], [x, y]]), '#4f8a3a', 3), F(ell(x - 7, y, 6, 6), c), F(ell(x + 7, y, 6, 6), c), F(ell(x, y - 7, 6, 6), c), F(ell(x, y + 7, 6, 6), c), F(ell(x, y, 4, 4), '#fff2a8', 'flat')], { bw: 5, blur: 3 }));
  }
  function mountainBg(P, sky = SKY_SMOKE) {
    P.sky(sky);
    P.obj([F(blob([[-40, 260], [80, 200], [180, 220], [300, 170], [420, 210], [540, 160], [680, 200], [840, 180], [860, 330], [-60, 330]]), '#c9926a')], { blur: 4 });
    P.obj(cloud(160, 120, 1.2, '#efe2d6'), { alpha: 0.9 }); P.obj(cloud(520, 90, 1, '#efe2d6'), { alpha: 0.9 });
    P.obj([F(blob([[-60, 340], [200, 320], [420, 336], [640, 318], [860, 330], [880, 540], [-80, 540]]), '#c4935e')], { blur: 5 });
    P.obj([F(blob([[-60, 400], [220, 392], [460, 404], [700, 390], [860, 398], [880, 540], [-80, 540]]), '#b07f4f')], { blur: 5 });
    P.obj(rock(760, 410, 0.8, '#9a8574')); P.obj(rock(60, 404, 0.6, '#9a8574'));
    for (const [x, y] of [[150, 432], [520, 440]]) P.obj(footprint(x, y, 0.8, '#946a40'), { border: false, sc: 'rgba(80,50,20,.35)', sx: -1, sy: -2, blur: 2 });
  }
  const confettiCols = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc', '#ff8a65'];
  function confetti(P, t, n = 36) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const sp = 40 + hash(i) * 50, x = (hash(i + 3) * 860 + Math.sin(t * 1.5 + i) * 20) % 860 - 30;
      const y = ((hash(i + 7) * 500 + t * sp) % 520) - 40;
      parts.push(...place([F(rr(-6, -3.5, 12, 7, 1.5), confettiCols[i % confettiCols.length])], { x, y, r: t * (1 + hash(i + 1) * 3) + i }));
    }
    P.obj(parts, { border: false, blur: 1, sx: 1, sy: 2 });
  }
  function floaters(P, t, x, y, make, n = 3, spd = 0.3) {
    for (let i = 0; i < n; i++) {
      const ph = (t * spd + i / n) % 1;
      P.obj(make(x + Math.sin(ph * 6 + i) * 14 + ph * 20, y - ph * 110, 0.5 + ph * 0.5, i), { alpha: Math.min(1, (1 - ph) * 2) });
    }
  }
  const noteCols = ['#ef5350', '#42a5f5', '#ab47bc', '#ffca28'];

  /* ---------- pages ---------- */
  const SCENES = {
  title: {
    bg(P) { valleyBg(P); },
    fg(P, t, S, A) {
      sunStick(P, t); clouds(P, t); smoke(P, t);
      drawPip(P, t, S, A, 390, 404, 1, { hold: true, lx: 1, ly: 0.2, wob: Math.sin(t * 8) * 0.08 * Math.max(0, Math.sin(t * 1.1)) });
    },
    front(P) { frontFerns(P); },
  },

  egg: {
    shake: (t) => (t < 0.8 || t % 7 < 0.5 ? [Math.sin(t * 70) * 2.2, Math.cos(t * 93) * 1.4] : [0, 0]),
    bg(P) {
      valleyBg(P);
      P.obj([F(blob([[830, 336], [720, 346], [600, 370], [470, 394], [330, 404], [200, 406], [200, 420], [330, 420], [480, 410], [610, 386], [730, 362], [840, 352]]), '#e8cb92')], { border: false, shadow: false });
    },
    fg(P, t, S, A) {
      sunStick(P, t); clouds(P, t); smoke(P, t);
      const ta = ease(t / 2.2), ex = lerp(780, 470, ta), ey = lerp(350, 396, ta), roll = -(780 - ex) / 27;
      const wob = t > 2.2 ? Math.sin(t * 10) * 0.12 * Math.max(0, Math.sin((t - 2.2) * 1.3)) : 0;
      const held = picked(A, (c) => c.act === 'hug');
      if (!held) P.obj(place(eggShape(t), { x: ex, y: ey, s: 1.05, r: roll + wob, px: 0, py: -30 }));
      const jy = t > 2.15 && t < 2.6 ? -Math.sin(((t - 2.15) / 0.45) * Math.PI) * 24 : 0;
      const lookUp = picked(A, (c) => c.set === 'sawPrint');
      drawPip(P, t, S, A, 330, 400 + jy, 0.95, { hold: held, lx: lookUp ? 1 : 1, ly: lookUp ? -0.8 : 0.25, look: 0.45, open: t > 2.1 && t < 3.4 ? 1 : undefined, mouth: picked(A, (c) => c.act === 'honk') ? 1 : 0 });
      const pop = ease((t - 2.25) / 0.3);
      if (pop > 0 && A.phase === 'read') P.obj(place([F(rr(-9, -62, 18, 42, 8), '#ef5350'), F(ell(0, -8, 9, 9), '#ef5350')], { x: 424, y: 206, s: pop * 1.1, r: Math.sin(t * 3) * 0.1, px: 0, py: -30 }));
      if (held) floaters(P, A.reactT, 400, 260, (x, y, s) => heart(x, y, s * 1.2), 3, 0.4);
    },
    front(P) { frontFerns(P); },
  },

  grandpa: {
    bg(P) { valleyBg(P, { vx: 700, vy: 312, vs: 0.5, palm: false }); P.obj(palm(40, 330, 0.6, PALM, 3)); },
    fg(P, t, S, A) {
      sunStick(P, t, 112, 80); clouds(P, t, [[330, 70, 0.85, 0], [480, 40, 0.65, 1.2]]);
      P.obj(place(longneck(t), { x: 610, y: 426, s: 0.92, flip: true }));
      const hopFor = (b) => (S.buddy === b ? A.hop : 0);
      P.obj(place(tops(t), { x: 84, y: 436 + hopFor('tops'), s: 0.62 }));
      P.obj(place(shelly(t, { lx: -1 }), { x: 415, y: 442 + hopFor('shelly'), s: 0.78, flip: true }));
      P.obj(place(zippy(t), { x: 140 + Math.sin(t * 0.8) * 24, y: 140 + Math.sin(t * 1.6) * 8 + hopFor('zippy'), s: 0.82 }));
      drawPip(P, t, S, A, 205, 420, 0.72, { hold: true, lx: 0.6, ly: -0.8, look: 0.5, noHop: true });
    },
    front(P) { frontFerns(P, false, false); },
  },

  fork: {
    bg(P) {
      P.sky(SKY_DAY);
      P.obj(hill(262, 40, 1.2, '#b4dc86'), { blur: 4 });
      P.obj([F(blob([[-60, 296], [120, 290], [300, 298], [380, 312], [300, 330], [100, 330], [-60, 326]]), '#5fb6e8')], { blur: 3 });
      P.obj(tree(560, 320, 0.7, DARK_TREE)); P.obj(tree(700, 322, 0.85, DARK_TREE)); P.obj(tree(640, 330, 0.6, DARK_TREE)); P.obj(tree(790, 330, 0.7, DARK_TREE));
      P.obj([F(blob([[-60, 344], [200, 338], [420, 348], [640, 340], [860, 346], [880, 540], [-80, 540]]), '#79b851')], { blur: 5 });
      P.obj([F(tube([[400, 480], [400, 410], [330, 372], [200, 352], [80, 344]], 90, 26), '#e8cb92')], { border: false, shadow: false });
      P.obj([F(tube([[400, 420], [470, 378], [600, 356], [720, 348]], 70, 24), '#e8cb92')], { border: false, shadow: false });
      P.obj(place([
        F(rr(-6, -120, 12, 122, 4), '#a8744a'),
        F(poly([[-74, -112], [-6, -112], [-6, -82], [-74, -82], [-92, -97]]), '#5fb6e8'),
        Ln(lp([[-70, -101], [-60, -105], [-50, -101], [-40, -105], [-30, -101]]), '#ffffff', 2.4), Ln(lp([[-70, -92], [-60, -96], [-50, -92], [-40, -96], [-30, -92]]), '#ffffff', 2.4),
        F(poly([[6, -72], [74, -72], [92, -57], [74, -42], [6, -42]]), '#5aa83f'),
        F(poly([[40, -68], [52, -50], [28, -50]]), '#2f7038'), F(rr(37, -50, 6, 6, 1), '#7a5236'),
        F(poly([[-18, -150], [0, -168], [18, -150], [12, -150], [12, -124], [-12, -124], [-12, -150]]), '#ffca28'),
        F(poly([[0, -158], [3, -150], [11, -150], [5, -145], [7, -137], [0, -142], [-7, -137], [-5, -145], [-11, -150], [-3, -150]]), '#ffffff'),
      ], { x: 400, y: 396 }));
    },
    fg(P, t, S, A) {
      sunStick(P, t, 112, 70); clouds(P, t, [[250, 60, 0.8, 0], [560, 50, 0.7, 1.4]]);
      drawPip(P, t, S, A, 255, 428, 0.72, { hold: true, lx: 1, ly: -0.4, look: 0.45 });
      drawBuddy(P, t, S, 560, 436, 0.68, { flip: true, lx: 1 });
    },
    front(P) { P.obj(fern(36, 470, 1.0, '#4f9e3c', '#6cb84f')); P.obj(fern(780, 470, 0.9, '#4f9e3c', '#6cb84f')); },
  },

  river: {
    bg(P) {
      P.sky(SKY_DAY);
      P.obj(cloud(170, 86, 1.1, '#ffffff'), { blur: 6 });
      P.obj([F(blob([[-40, 250], [60, 182], [150, 172], [220, 200], [300, 232], [420, 238], [520, 190], [600, 152], [700, 160], [780, 210], [860, 250], [860, 330], [-60, 330]]), '#a8c4e6')], { blur: 4 });
      P.obj([F(blob([[-40, 284], [200, 264], [420, 274], [620, 258], [860, 270], [860, 330], [-40, 330]]), '#8cc85e')], { blur: 4 });
      P.obj(tree(80, 280, 0.5, TREE));
      P.obj(palm(470, 274, 0.7, PALM, 6)); P.obj(palm(570, 266, 0.85, PALM, -4)); P.obj(palm(730, 270, 0.75, PALM, 3));
      P.obj([F(blob([[-40, 292], [300, 288], [600, 286], [860, 292], [860, 376], [600, 380], [300, 376], [-40, 372]]), '#5fb6e8')], { blur: 4 });
      P.obj([F(blob([[-60, 344], [120, 340], [250, 354], [380, 388], [460, 420], [500, 480], [-60, 480]]), '#f0d593')], { blur: 4 });
      P.obj([F(blob([[-60, 366], [110, 360], [230, 372], [350, 402], [420, 432], [440, 480], [-60, 480]]), '#86c25a')], { blur: 4 });
      P.obj(rock(44, 432, 0.7, '#a3abc2'));
    },
    fg(P, t, S, A) {
      clouds(P, t, [[560, 60, 0.8, 1]]);
      const friendly = fr(S, 'crocs'), awake = friendly || S.flags.hopped;
      for (const [y, dir] of [[300, 1], [312, -1]]) for (let j = 0; j < 6; j++) { const x = ((j * 150 + t * 36 * dir) % 900 + 900) % 900 - 50; P.obj([Ln(lp([[x, y], [x + 46, y]]), '#e2f5ff', 3)], { border: false, shadow: false }); }
      [440, 612, 780].forEach((x, i) => {
        const b = Math.sin(t * 1.6 + i * 1.1) * 2.5, open = awake || ((t + i * 1.9) % 5.4) < 1.2 ? 1 : 0;
        P.obj(place(croc(t, { open, smile: friendly }), { x: x + Math.sin(t * 0.5 + i) * 3, y: 330 + b, s: 1.15 }));
      });
      P.obj([F(blob([[360, 340], [600, 337], [860, 342], [860, 368], [600, 372], [360, 368]]), '#5fb6e8')], { border: false, shadow: false });
      for (let j = 0; j < 7; j++) { const x = ((j * 130 - t * 28) % 900 + 900) % 900 - 40; P.obj([Ln(lp([[x, 350 + (j % 2) * 10], [x + 34, 350 + (j % 2) * 10]]), '#e2f5ff', 3)], { border: false, shadow: false }); }
      drawPip(P, t, S, A, 150, 396, 0.78, { hold: true, lx: 1, ly: 0.15, look: 0.45 });
      drawBuddy(P, t, S, 286, 420, 0.8, { lx: 1, ly: 0.1 });
    },
    front(P) {
      for (const [x, y, s] of [[22, 470, 1], [340, 470, 0.8]]) P.obj(place([F(poly([[-14, 0], [-4, -46], [4, 0]]), '#5bbf4e'), F(poly([[0, 0], [14, -38], [16, 0]]), '#4fae47'), F(poly([[-26, 0], [-22, -30], [-10, 0]]), '#4fae47')], { x, y, s }));
      P.obj(place([Ln(lp([[0, 0], [2, -70]]), '#3f8a3a', 3), F(rr(-4, -92, 8, 24, 4), '#8a5a32'), Ln(lp([[16, 0], [20, -54]]), '#3f8a3a', 3), F(rr(14, -74, 8, 22, 4), '#8a5a32')], { x: 380, y: 430 }));
    },
  },

  stego: {
    bg(P) {
      P.sky(SKY_DAY);
      P.obj(hill(250, 36, 0.8, '#b4dc86'), { blur: 4 });
      P.obj([F(blob([[-60, 286], [300, 280], [600, 290], [860, 284], [860, 312], [600, 318], [300, 312], [-60, 316]]), '#5fb6e8')], { blur: 3 });
      P.obj(tree(90, 318, 0.6, TREE)); P.obj(palm(640, 322, 0.6, PALM, -3));
      P.obj([F(blob([[-60, 340], [200, 332], [420, 344], [640, 334], [860, 342], [880, 540], [-80, 540]]), '#86c25a')], { blur: 5 });
      P.obj(bush(740, 380, 1.1, '#5aa83f', '#4f9e3c'));
    },
    fg(P, t, S, A) {
      sunStick(P, t, 112, 70); clouds(P, t, [[330, 64, 0.85, 0.5]]);
      const happy = fr(S, 'stego'), left = A.phase === 'react' && !happy;
      if (happy) {
        const k = ease(A.reactT / 1.2);
        P.obj(place(stego(t, { lx: -1 }), { x: lerp(860, 640, k), y: 418, s: 1.5, flip: true }));
        floaters(P, A.reactT, 560, 330, (x, y, s) => heart(x, y, s * 1.2), 3, 0.35);
      }
      P.obj(place(stego(t, { cry: !happy && !left, lx: -1 }), { x: left ? lerp(510, 860, ease(A.reactT / 2.5)) : 510, y: 414 + (happy ? -Math.abs(Math.sin(t * 5)) * 10 : 0), s: 0.95, flip: !left }));
      drawPip(P, t, S, A, 290, 414, 0.78, { hold: true, lx: 1, ly: 0.2, look: 0.45, mouth: picked(A, (c) => c.act === 'honk') ? 1 : 0 });
      drawBuddy(P, t, S, 130, 430, 0.66, { lx: 1 });
    },
    front(P) { frontFerns(P, false, false); },
  },

  forest: {
    bg(P) {
      P.sky([[0, '#2f5a3a'], [0.6, '#4f7f45'], [1, '#86a65a']]);
      P.obj([F(tube([[270, 360], [266, 150], [272, -20]], 26, 22), '#4a5a3a')], { blur: 4 });
      P.obj([F(tube([[540, 360], [546, 150], [538, -20]], 22, 18), '#4a5a3a')], { blur: 4 });
      P.obj([F(tube([[86, 480], [94, 220], [82, -30]], 96, 74), '#8a5c3c'), Ln(lp([[70, 320], [78, 250], [72, 190]]), '#5a3a24', 3), Ln(lp([[104, 140], [98, 80]]), '#5a3a24', 3)]);
      P.obj([F(tube([[724, 480], [714, 220], [726, -30]], 104, 82), '#8a5c3c'), Ln(lp([[740, 300], [732, 230]]), '#5a3a24', 3), Ln(lp([[708, 160], [714, 90]]), '#5a3a24', 3)]);
      P.obj([F(ell(80, 10, 140, 60), '#2f7038'), F(ell(300, -10, 150, 50), '#3a8040'), F(ell(520, 0, 150, 56), '#2f7038'), F(ell(740, 14, 140, 60), '#3a8040')]);
      P.obj([F(blob([[-60, 362], [400, 352], [860, 364], [860, 480], [-60, 480]]), '#7a5a3a')]);
      P.obj([F(blob([[-60, 372], [200, 366], [420, 376], [640, 366], [860, 374], [860, 392], [-60, 392]]), '#5d8a3a')], { border: false });
      P.obj([F(tube([[440, 334], [650, 326]], 42, 38), '#9a6a44'), F(ell(650, 326, 15, 20), '#d9ab7a')]);
      P.obj(mush(200, 380, 1)); P.obj(mush(612, 386, 0.8)); P.obj(mush(250, 390, 0.6));
    },
    fg(P, t, S, A) {
      for (let i = 0; i < 5; i++) P.glow(160 + i * 130, 120 + Math.sin(t + i) * 20, 70, '#fff3c0', 0.12);
      const friends = fr(S, 'raptors'), honked = picked(A, (c) => c.act === 'honk');
      const pk = (s) => (friends ? 0 : (Math.sin(t * 1.3 + s) * 0.5 + 0.5) * 26);
      const fall = honked ? ease(A.reactT / 0.5) * -1.3 : 0;
      const rap = (seed, x, y, s, flip) => P.obj(place(raptor(t, { seed, ly: 0.3, happy: friends, tilt: fall * 0.4 }), { x, y, s, flip, r: fall, px: 0, py: -40 }));
      rap(2, 592, 312, 0.72, true);
      rap(0, 146 + (friends ? 40 : 0), 392 + pk(0) - (friends ? 30 : 0), 0.9, false);
      if (!friends) P.obj(bush(140, 420, 1.25, '#4f8f3a', '#3f7a32'));
      rap(4, 694 - (friends ? 30 : 0), 396 + pk(2) - (friends ? 30 : 0), 0.92, true);
      if (!friends) P.obj(bush(690, 428, 1.35, '#4f8f3a', '#3f7a32'));
      const lk = Math.sin(t * 0.8) > 0 ? 1 : -1;
      drawPip(P, t, S, A, 384, 414, 0.86, { hold: true, lx: friends ? 1 : lk, ly: 0.1, look: 0.5, mouth: honked ? 1 : 0 });
      drawBuddy(P, t, S, 262, 432, 0.62, { lx: -1 });
      if (has(S, 'feather')) P.obj(place([F(blob([[0, 0], [8, -22], [6, -44], [0, -50], [-6, -40], [-6, -20]]), '#4fa3e8'), Ln(lp([[0, 0], [0, -46]]), '#2f6fb0', 1.6)], { x: 460, y: 340 - Math.sin(A.reactT * 2) * 6, r: 0.4 + Math.sin(t * 2) * 0.1 }));
    },
    front(P, S) {
      P.obj(place([F(ell(0, 0, 60, 22, -0.5), '#3d7a34'), F(ell(70, 10, 50, 18, 0.3), '#4a8a3c')], { x: -10, y: 452 }));
      P.obj(place([F(ell(0, 0, 60, 22, 0.5), '#3d7a34'), F(ell(-60, 12, 46, 16, -0.3), '#4a8a3c')], { x: 810, y: 456 }));
    },
  },

  cave: {
    bg(P) {
      P.sky([[0, '#211a33'], [1, '#3e3052']]);
      P.obj([F(blob([[-40, 120], [200, 160], [420, 130], [620, 170], [860, 120], [860, 400], [-40, 400]]), '#2e2443')], { shadow: false, border: false });
      P.glow(712, 300, 170, '#fff2c0', 0.45);
      P.obj([F(blob([[650, 400], [640, 300], [680, 230], [740, 220], [790, 260], [800, 400]]), '#fbeec0')], { border: false, shadow: false });
      for (let i = 0; i < 11; i++) { const x = 20 + i * 76 + hash(i) * 20, h = 50 + hash(i + 4) * 70; P.obj([F(poly([[x - 26, -10], [x + 26, -10], [x + 4, h], [x - 2, h]]), i % 2 ? '#4c3d63' : '#56456e')], { bw: 4, blur: 4 }); }
      P.obj([F(blob([[-60, 380], [200, 370], [420, 384], [620, 372], [860, 382], [880, 540], [-80, 540]]), '#55456b')], { blur: 5 });
      P.obj(rock(560, 392, 0.8, '#6b5a82')); P.obj(rock(70, 400, 1, '#6b5a82'));
    },
    fg(P, t, S, A) {
      for (let i = 0; i < 40; i++) { const a = 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.8 + i * 1.3)); P.glow(hash(i) * 800, 16 + hash(i + 30) * 120, 10, '#9ff2d0', a); P.glow(hash(i) * 800, 16 + hash(i + 30) * 120, 2.5, '#eafff6', a); }
      if (fr(S, 'glow')) for (let i = 0; i < 12; i++) { const k = ease(A.reactT / 1.5 - i * 0.06), x = 330 + i * 30, y = 400 - Math.sin(i * 0.6) * 8; if (k > 0) P.glow(x, y, 16 * k, '#9ff2d0', 0.9); }
      if (picked(A, (c) => c.act === 'honk')) for (let i = 0; i < 3; i++) { const ph = (A.reactT * 0.8 + i / 3) % 1; P.obj([Ln(lp([[380 + ph * 300, 270], [400 + ph * 300, 300], [380 + ph * 300, 330]]), '#cfe8ff', 3)], { alpha: 1 - ph, border: false, shadow: false }); }
      drawPip(P, t, S, A, 300, 412, 0.78, { hold: true, lx: 0.5, ly: -0.8, look: 0.5, mouth: picked(A, (c) => c.act === 'honk') ? 1 : 0 });
      drawBuddy(P, t, S, 160, 424, 0.66, { lx: 1, ly: -0.6 });
    },
  },

  thorns: {
    bg(P) {
      P.sky(SKY_DAY);
      P.obj(hill(268, 40, 0.3, '#b4dc86'), { blur: 4 });
      P.obj(tree(90, 310, 0.6, TREE));
      P.obj([F(blob([[-60, 372], [200, 360], [420, 368], [640, 356], [860, 366], [880, 540], [-80, 540]]), '#79b851')], { blur: 5 });
      const wall = [];
      for (let i = 0; i < 9; i++) { const x = 440 + (i % 5) * 90 + (i > 4 ? 45 : 0), y = i > 4 ? 250 : 330; wall.push(F(ell(x, y, 70, 80), i % 2 ? '#6b4f7a' : '#5e4470')); }
      P.obj(wall, { blur: 6 });
      const thorns = [];
      for (let i = 0; i < 40; i++) { const x = 400 + hash(i) * 420, y = 180 + hash(i + 9) * 220, a = hash(i + 2) * TAU; thorns.push(...place([F(poly([[-6, 0], [0, -16], [6, 0]]), '#3f2c4a')], { x, y, r: a })); }
      for (let i = 0; i < 9; i++) { const x = 430 + hash(i + 50) * 380, y = 200 + hash(i + 60) * 180; thorns.push(F(ell(x, y, 6, 6), '#ff8fb1'), F(ell(x, y, 2.5, 2.5), '#fff2a8', 'flat')); }
      P.obj(thorns, { bw: 3, blur: 2 });
    },
    fg(P, t, S, A) {
      sunStick(P, t, 112, 70); clouds(P, t, [[300, 60, 0.85, 0]]);
      const smash = S.flags.smashed, gap = S.flags.gap;
      if (smash || gap) {
        const k = ease(A.phase === 'react' ? (A.reactT - 0.6) / 0.4 : 1);
        if (k > 0) P.obj([F(ell(560, 360, (smash ? 90 : 55) * k, (smash ? 70 : 50) * k), '#2e2238')], { border: false, shadow: false });
      }
      let tx = 330;
      if (smash && A.phase === 'react') { const k = A.reactT; tx = k < 0.7 ? lerp(330, 470, ease(k / 0.7)) : lerp(470, 400, ease((k - 0.7) / 0.6)); }
      if (smash && A.phase === 'react' && A.reactT > 0.5 && A.reactT < 2) for (let i = 0; i < 6; i++) { const a = hash(i) * TAU, d = (A.reactT - 0.5) * 160; P.obj(place([F(poly([[-6, 0], [0, -14], [6, 0]]), '#3f2c4a')], { x: 560 + Math.cos(a) * d, y: 360 + Math.sin(a) * d * 0.6 + (A.reactT - 0.5) ** 2 * 80, r: A.reactT * 8 + i })); }
      drawBuddy(P, t, S, tx, 420, 0.85, { lx: 1, tilt: smash && A.phase === 'react' && A.reactT < 0.8 ? 0.25 : 0 });
      drawPip(P, t, S, A, 150, 414, 0.74, { hold: true, lx: 1, ly: 0.1, look: 0.45 });
    },
    front(P) { P.obj(fern(30, 470, 1, '#4f9e3c', '#6cb84f')); },
  },

  sky: {
    bg(P) {
      P.sky([[0, '#6fc0ee'], [0.5, '#bfe6fb'], [1, '#e9f7ff']]);
      P.obj([F(blob([[-60, 300], [200, 290], [420, 300], [640, 286], [860, 296], [880, 540], [-80, 540]]), '#a6d67e')], { blur: 6 });
      P.obj(volcano(690, 300, 0.55), { blur: 3 });
      P.obj([F(tube([[-40, 340], [120, 330], [250, 360], [400, 340], [560, 370], [700, 350], [860, 370]], 26, 22), '#5fb6e8')], { blur: 3 });
      for (let i = 0; i < 9; i++) P.obj(tree(430 + (i % 5) * 50 + (i > 4 ? 25 : 0), 400 + (i > 4 ? 22 : 0), 0.28, DARK_TREE), { blur: 2, sx: 1, sy: 2 });
      P.obj(tree(90, 410, 0.3, TREE), { blur: 2 }); P.obj(tree(150, 420, 0.25, TREE), { blur: 2 });
      P.obj([F(ell(560, 440, 40, 10), '#79d0cf')], { blur: 2 });
    },
    fg(P, t, S, A) {
      for (const [x, y, s, sp] of [[100, 120, 0.9, 14], [520, 90, 0.7, 10], [300, 250, 0.6, 18]]) P.obj(cloud(((x + t * sp) % 960) - 80, y, s, '#ffffff'));
      const loop = S.flags.loop && A.phase === 'react' ? clamp(A.reactT / 1.2, 0, 1) * TAU : 0;
      const zx = 400 + Math.sin(t * 0.7) * 30, zy = 170 + Math.sin(t * 1.3) * 10;
      P.obj(place(zippy(t, { lx: 1, ly: 0.4 }), { x: zx + Math.sin(loop) * 60, y: zy - (1 - Math.cos(loop)) * 60, s: 1.6, r: loop }));
      drawPip(P, t, S, A, 200, 418, 0.32, { hold: true, lx: 1, ly: -1, look: 0.5 });
    },
  },

  tunnel: {
    bg(P) {
      P.sky([[0, '#5e3f2b'], [1, '#7a553a']]);
      P.obj([F(blob([[120, 470], [110, 260], [200, 130], [400, 90], [600, 130], [690, 260], [680, 470]]), '#9a7350')], { blur: 8 });
      P.glow(400, 300, 120, '#fff3c4', 0.5);
      P.obj([F(ell(400, 320, 46, 60), '#fff3c4')], { border: false, shadow: false });
      P.obj([F(blob([[-60, 390], [200, 380], [420, 392], [620, 382], [860, 390], [880, 540], [-80, 540]]), '#b08a62')], { blur: 5 });
      for (const [x, y, s, r] of [[60, 120, 1, 0.4], [150, 260, 0.8, -0.3], [700, 100, 0.9, -0.5], [740, 250, 1, 0.2], [620, 180, 0.7, 1.1], [220, 170, 0.7, 1.3], [40, 330, 0.8, -0.1]]) P.obj(bone(x, y, s, r), { bw: 4, blur: 3 });
      P.obj(place([F(blob([[-60, -10], [-40, -50], [20, -60], [70, -40], [80, -10], [40, 10], [-40, 10]]), '#f3e6c8'), F(ell(-10, -30, 12, 10), '#6b4a33', 'flat'), F(ell(55, -24, 5, 4), '#6b4a33', 'flat'),
        ...[0, 1, 2, 3, 4].map((i) => F(poly([[-30 + i * 18, 8], [-22 + i * 18, 8], [-26 + i * 18, 22]]), '#f3e6c8'))], { x: 660, y: 330, s: 0.9, flip: true }), { bw: 4 });
      P.obj(place([F(ell(0, 0, 26, 26), '#e8d2a8'), Ln(lp([[0, 0], [8, -4], [8, 8], [-8, 10], [-14, -6], [2, -18], [20, -8]]), '#a8865a', 2.5)], { x: 110, y: 200, s: 1 }), { bw: 4 });
    },
    fg(P, t, S, A) {
      for (const [x, y] of [[200, 392], [560, 396], [640, 388]]) { P.glow(x, y - 18, 30, '#9fd8ff', 0.4 + 0.2 * Math.sin(t * 2 + x)); P.obj(place([F(rr(-3, -14, 6, 14, 2), '#e8f4ff'), F(blob([[-12, -12], [-8, -22], [0, -26], [8, -22], [12, -12]]), '#7ec8f0')], { x, y })); }
      if (picked(A, (c) => c.act === 'honk')) for (let i = 0; i < 4; i++) { const ph = (A.reactT * 0.7 + i / 4) % 1; P.obj([Ln(lp([[330 + ph * 120, 230 - ph * 40], [350 + ph * 140, 300], [330 + ph * 120, 370 + ph * 40]]), '#fff3c4', 3)], { alpha: 1 - ph, border: false, shadow: false }); }
      drawBuddy(P, t, S, 520, 424, 0.86, { flip: true, lx: 1 });
      drawPip(P, t, S, A, 290, 414, 0.76, { hold: true, lx: 1, ly: -0.3, look: 0.45, mouth: picked(A, (c) => c.act === 'honk') ? 1 : 0 });
    },
  },

  springs: {
    bg(P) {
      P.sky([[0, '#a8daf0'], [0.6, '#e2f2e8'], [1, '#f3ead2']]);
      P.obj(volcano(640, 330, 1.2), { blur: 3 });
      P.obj(hill(300, 30, 1.6, '#c9d99a'), { blur: 4 });
      P.obj([F(blob([[-60, 340], [200, 330], [420, 342], [640, 334], [860, 340], [880, 540], [-80, 540]]), '#d6c495')], { blur: 5 });
      for (const [x, y, rx, ry] of [[250, 406, 130, 30], [600, 376, 96, 20], [110, 352, 60, 12]]) {
        P.obj([F(ell(x, y, rx + 12, ry + 8), '#a89a7a'), F(ell(x, y + 2, rx, ry), '#79d0cf'), F(ell(x - rx * 0.3, y - ry * 0.2, rx * 0.35, ry * 0.25), '#b9ecea', 'flat')], { blur: 3 });
      }
      P.obj(rock(430, 420, 0.7, '#b3a07c')); P.obj(rock(760, 412, 0.9, '#b3a07c'));
    },
    fg(P, t, S, A) {
      smoke(P, t, 640, 128, '#e9e1ee', 3, 1.2);
      for (const [x, y, n] of [[250, 400, 5], [600, 370, 4], [110, 348, 2]]) for (let i = 0; i < n; i++) {
        const ph = (t * 0.3 + i / n) % 1, px = x - 80 + (i / Math.max(1, n - 1)) * 160 * (n > 2 ? 1 : 0.5) + Math.sin(ph * 6 + i) * 8;
        P.obj([F(ell(px, y - 10 - ph * 110, 10 + ph * 22, 8 + ph * 16), '#ffffff')], { alpha: (1 - ph) * 0.75, blur: 2, sx: 0, sy: 1, bw: 2 });
      }
      for (let i = 0; i < 4; i++) { const ph = (t * 0.9 + i * 0.27) % 1; P.obj([F(ell(200 + i * 34, 408 - ph * 8, 3 + ph * 3, 3 + ph * 3), '#e6fbfa')], { alpha: 1 - ph, blur: 1, sx: 0, sy: 1, bw: 2 }); }
      const steam = picked(A, (c) => c.warm === 2);
      if (steam) P.glow(392, 330, 50, '#fff4c8', 0.6);
      drawPip(P, t, S, A, 340, 390, 0.8, { hold: true, lx: 0.5, ly: 0.8, look: 0.5, wob: steam ? Math.sin(t * 6) * 0.06 : 0 });
      drawBuddy(P, t, S, 640, 428, 0.72, { flip: true, lx: 1 });
    },
  },

  camp: {
    bg(P) {
      P.sky(SKY_NIGHT);
      P.glow(650, 92, 120, '#fff2c8', 0.35);
      P.obj([F(ell(650, 92, 38, 38), '#f8eccb'), F(ell(638, 84, 7, 6), '#e3d3ac', 'flat'), F(ell(662, 104, 5, 4), '#e3d3ac', 'flat')], { blur: 6 });
      P.obj(hill(262, 40, 1, '#3a3c7c'), { blur: 4 });
      P.obj(fern(110, 334, 1.6, '#2c4a5a', '#335566')); P.obj(fern(730, 326, 1.3, '#2c4a5a', '#335566'));
      P.obj(hill(305, 30, 2.4, '#2f3a6c'), { blur: 4 });
      P.obj([F(blob([[-60, 352], [300, 342], [600, 354], [860, 346], [860, 480], [-60, 480]]), '#3f5f5c')], { blur: 5 });
      P.obj([F(ell(400, 398, 64, 20), '#6f9455')]);
    },
    fg(P, t, S, A) {
      const st = []; for (let i = 0; i < 26; i++) { const s = 0.18 + 0.08 * Math.sin(t * 2 + i * 1.7); st.push(...star(hash(i) * 800, 20 + hash(i + 50) * 200, s, '#fff4c8', t * 0.2 + i)); }
      P.obj(st, { bw: 3, blur: 2, sx: 1, sy: 1 });
      const tuck = picked(A, (c) => c.warm === 1), song = !!S.flags.song;
      const w = tuck || song ? 0 : Math.sin(t * 12) * 0.15 * Math.max(0, Math.sin(t * 1.2));
      P.obj(place(eggShape(t, { crack: 0.45, moss: has(S, 'moss') }), { x: 400, y: 404, s: 1.1, r: w, px: 0, py: 0 }));
      P.obj([F(blob([[336, 400], [400, 420], [464, 400], [458, 414], [400, 428], [342, 414]]), '#87a866')]);
      if (tuck) P.obj([F(blob([[374, 380], [400, 366], [426, 380], [430, 398], [370, 398]]), has(S, 'moss') ? '#6fae55' : '#5a9a48')], { alpha: ease(A.reactT / 0.6) });
      drawPip(P, t, S, A, 262, 410, 0.82, { lx: 1, ly: 0.35, look: 0.4, mouth: song && A.phase === 'react' ? 0.5 + 0.5 * Math.sin(t * 6) : 0 });
      const woke = !!S.flags.woke;
      drawBuddy(P, t, S, 600, 420, 0.72, { flip: true, open: woke ? undefined : 0, lx: 1 });
      if (!woke) P.many(zzz(t, 630, 300));
      if (song && A.phase === 'react') floaters(P, A.reactT, 330, 300, (x, y, s, i) => note(x, y, s, noteCols[i % 4], Math.sin(y) * 0.2), 3, 0.35);
      for (let i = 0; i < 9; i++) { const x = 120 + hash(i) * 560 + Math.sin(t * 0.7 + i) * 42, y = 230 + hash(i + 20) * 130 + Math.sin(t * 1.1 + i * 2) * 20, a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.4 + i * 1.7)); P.glow(x, y, 16, '#ffe27a', a); P.glow(x, y, 3.5, '#fffbe0', a); }
    },
    front(P) { P.obj(fern(30, 476, 1.4, '#243b44', '#2a4650')); P.obj(fern(790, 480, 1.2, '#243b44', '#2a4650')); },
  },

  prints: {
    shake: (t) => (t % 4.5 < 0.35 ? [Math.sin(t * 70) * 2, Math.cos(t * 90) * 1.2] : [0, 0]),
    bg(P) {
      P.sky(SKY_DAWN);
      P.obj([F(ell(170, 250, 60, 60), '#ffd27a')], { blur: 8 });
      P.obj(volcano(640, 330, 1.25), { blur: 3 });
      P.obj(hill(300, 30, 0.6, '#b9d68a'), { blur: 4 });
      P.obj([F(blob([[-60, 340], [200, 332], [420, 342], [640, 334], [860, 340], [880, 540], [-80, 540]]), '#9cc768')], { blur: 5 });
      P.obj([F(tube([[300, 480], [380, 400], [480, 360], [560, 336], [610, 318]], 120, 30), '#e3c58c')], { border: false, shadow: false });
      for (const [x, y, s] of [[300, 440, 1.25], [420, 392, 1], [500, 358, 0.75], [566, 336, 0.55], [610, 320, 0.4]]) P.obj(footprint(x, y, s, '#a8834e'), { border: false, sc: 'rgba(80,50,20,.4)', sx: -1, sy: -2, blur: 2 });
      P.obj(rock(110, 360, 1.3, '#a99a86'));
    },
    fg(P, t, S, A) {
      smoke(P, t, 640, 122, '#e9dcea', 4, 1.25);
      const climbed = picked(A, (c) => c.say === 'Climb the big rock.');
      if (climbed) drawPip(P, t, S, A, 108, 312, 0.6, { hold: true, lx: 1, ly: -0.2, look: 0.5 });
      else drawPip(P, t, S, A, 200, 418, 0.72, { hold: true, lx: 1, ly: 0.4, look: 0.5, mouth: picked(A, (c) => c.act === 'honk') ? 1 : 0 });
      drawBuddy(P, t, S, 80, 432, 0.6, { lx: 1 });
    },
    front(P) { P.obj(fern(770, 470, 1, '#4f9e3c', '#6cb84f')); },
  },

  rex: {
    shake: (t) => (t < 1.2 && t % 0.6 < 0.25 ? [Math.sin(t * 70) * 3, Math.cos(t * 90) * 2] : [0, 0]),
    bg(P) { mountainBg(P); },
    fg(P, t, S, A) {
      smoke(P, t, 720, 200, '#efe2d6', 4, 1.4);
      const hid = !!S.flags.hid, song = picked(A, (c) => c.act === 'sing');
      const surprise = A.phase === 'react';
      P.obj(place(rex(t, { tilt: surprise ? 0.05 : 0.14, lean: surprise ? 0 : 8, ly: 0.6, look: 0.45, open: song ? 0 : undefined }), { x: 652, y: 452, s: 1.08, flip: true }));
      if (picked(A, (c) => c.take === 'feather')) P.obj(place([F(blob([[0, 0], [8, -22], [6, -44], [0, -50], [-6, -40], [-6, -20]]), '#4fa3e8'), Ln(lp([[0, 0], [0, -46]]), '#2f6fb0', 1.6)], { x: 440, y: 300, r: 0.6 }));
      if (song) floaters(P, A.reactT, 380, 330, (x, y, s, i) => note(x, y, s, noteCols[i % 4]), 3, 0.35);
      const up = picked(A, (c) => c.say === 'Hold up the egg.');
      if (hid) drawPip(P, t, S, A, 300, 432, 0.55, { hold: true, lx: 1, ly: -0.6, look: 0.5 });
      else drawPip(P, t, S, A, 370, 432 - (up ? 18 : 0), 0.55, { hold: true, lx: 1, ly: -0.8, look: 0.5, wob: up ? Math.sin(t * 8) * 0.1 : 0 });
      P.obj(rock(296, 446, 1.15, '#9a8574'));
      drawBuddy(P, t, S, 160, 440, 0.5, { lx: 1, ly: -0.5 });
    },
  },

  mama: {
    shake: (t) => (t % 2.6 > 1.2 && t % 2.6 < 1.45 ? [Math.sin(t * 70) * 3, Math.cos(t * 90) * 2] : [0, 0]),
    bg(P) { mountainBg(P); },
    fg(P, t, S, A) {
      smoke(P, t, 720, 200, '#efe2d6', 4, 1.4);
      const ph = t % 2.6, step = ph > 0.9 && ph < 1.3 ? -Math.sin(((ph - 0.9) / 0.4) * Math.PI) * 26 : 0;
      P.obj(place(rex(t, { tilt: 0.1, lean: 4, open: 0, stepNear: step }), { x: 652, y: 452, s: 1.08, flip: true }));
      floaters(P, t, 480, 200, (x, y, s) => heart(x, y, s * 1.4), 3, 0.3);
      drawPip(P, t, S, A, 370, 432, 0.55, { hold: true, lx: 1, ly: -0.8, look: 0.5 });
      drawBuddy(P, t, S, 200, 440, 0.5, { lx: 1, ly: -0.5 });
    },
  },

  hatch: {
    bg(P) { mountainBg(P, SKY_DUSK); },
    fg(P, t, S, A) {
      P.obj(place(rex(t, { tilt: 0.12, lean: 6, open: t > 2.4 ? 0 : undefined, ly: 0.6 }), { x: 700, y: 452, s: 0.95, flip: true }));
      const T0 = 1.8;
      if (t < T0) {
        const k = t / T0, w = Math.sin(t * (10 + k * 14)) * 0.1 * k;
        P.obj(place(eggShape(t, { crack: 0.2 + 0.8 * k, moss: has(S, 'moss') }), { x: 430, y: 436, s: 1.6, r: w, px: 0, py: 0 }));
      } else {
        const k = ease((t - T0) / 0.5), cold = S.warm <= 0;
        P.obj(place(babyRex(t, { hat: t > 2.4, lx: -1, mouth: (t % 3 < 0.8 && t > 2.6) || picked(A, (c) => c.act === 'honk') ? 1 : 0, open: cold && t % 2 < 0.5 ? 0 : undefined }), { x: 426, y: 450 - k * 12, s: 0.95, flip: true }));
        P.obj(place(shellBottom(), { x: 430, y: 438, s: 1.6 }));
        if (t < 2.4) { const f = (t - T0) / 0.6; P.obj(place(shellTop(), { x: 430 - f * 20, y: 360 - Math.sin(f * Math.PI) * 60, s: 1.4, r: f * 6 })); }
        if (t > T0 && t < T0 + 0.8) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, d = (t - T0) * 120; P.obj(place(star(0, 0, 0.35, '#ffd54a'), { x: 430 + Math.cos(a) * d, y: 360 + Math.sin(a) * d * 0.7 }), { alpha: 1 - (t - T0) / 0.8 }); }
      }
      if (picked(A, (c) => c.star === 'kind')) floaters(P, A.reactT, 360, 300, (x, y, s) => heart(x, y, s * 1.3), 3, 0.4);
      drawPip(P, t, S, A, 236, 430, 0.72, { lx: 1, ly: 0.3, look: 0.5, mouth: picked(A, (c) => c.act === 'honk') ? 1 : 0 });
      drawBuddy(P, t, S, 100, 440, 0.58, { lx: 1 });
    },
  },

  name: {
    bg(P) { mountainBg(P, SKY_DUSK); },
    fg(P, t, S, A) {
      P.obj(place(rex(t, { tilt: 0.12, lean: 6, open: 0 }), { x: 700, y: 452, s: 0.95, flip: true }));
      P.obj(place(shellBottom(), { x: 520, y: 446, s: 1.1, r: 0.5 }));
      const named = !!S.name;
      P.obj(place(babyRex(t, { hat: true, lx: -1, mouth: named && t % 1.4 < 0.5 ? 1 : 0 }), { x: 420, y: 440 + (named ? -Math.abs(Math.sin(t * 5)) * 18 : 0), s: 1, flip: true }));
      drawPip(P, t, S, A, 236, 430, 0.75, { lx: 1, ly: 0.2, look: 0.45 });
      drawBuddy(P, t, S, 100, 440, 0.58, { lx: 1 });
      if (named) confetti(P, A.reactT, 30);
    },
  },

  /* ---------- endings ---------- */
  end_home: {
    bg(P) { valleyBg(P, { sky: SKY_SUNSET, sun: [160, 262, 70, '#ffb35c'], h1: '#c9d98a', h2: '#a5c867', g: '#8dbb5a', palm: false, vx: 720, vy: 310, vs: 0.45 }); },
    fg(P, t, S, A) {
      clouds(P, t, [[330, 60, 0.8, 0], [560, 46, 0.6, 1]], '#ffe8d8');
      const x = 360 + ((t * 18) % 140), bob = -Math.abs(Math.sin(t * 3)) * 5;
      P.obj(place(babyRex(t, { hat: true }), { x: x - 210, y: 440 - Math.abs(Math.sin(t * 5)) * 10, s: 0.8 }));
      P.obj(place(rex(t, { speed: 1.5, stepNear: Math.min(0, Math.sin(t * 3)) * 14, stepFar: Math.min(0, -Math.sin(t * 3)) * 14, open: 0 }), { x, y: 452 + bob, s: 0.95 }));
      if (S.buddy === 'zippy') P.obj(place(zippy(t), { x: x + 60 + Math.sin(t) * 20, y: 110, s: 0.7 }));
      else if (S.buddy) drawBuddy(P, t, S, x - 30, 452 + bob - 196 * 0.95 + 8, 0.36, {});
      drawPip(P, t, S, A, x + 116, 452 + bob - 270 * 0.95, 0.36, { lx: 1, mouth: 0.4 + 0.3 * Math.sin(t * 4), noHop: true });
    },
    front(P) { frontFerns(P); },
  },

  end_bff: {
    bg(P) { valleyBg(P); },
    fg(P, t, S, A) {
      sunStick(P, t); clouds(P, t); smoke(P, t);
      const p = (t * 0.55) % 1, tri = p < 0.5 ? p * 2 : 2 - p * 2, bx = lerp(340, 480, ease(tri)), by = 330 - Math.sin(((p % 0.5) / 0.5) * Math.PI) * 110;
      drawPip(P, t, S, A, 280, 410 - Math.max(0, Math.sin(t * 3.4)) * 16, 0.8, { lx: 1, ly: -0.5, look: 0.45, mouth: 0.6, noHop: true });
      P.obj(place(babyRex(t, { hat: true, lx: -1, mouth: 1 }), { x: 530, y: 416 - Math.max(0, -Math.sin(t * 3.4)) * 16, s: 1.05, flip: true }));
      P.obj(place([F(ell(0, 0, 18, 18), '#ef5350'), F(blob([[-17, -4], [0, -8], [17, -4], [17, 4], [0, 0], [-17, 4]]), '#ffffff', 'flat')], { x: bx, y: by, r: t * 4 }));
      drawBuddy(P, t, S, 110, 428, 0.64, { lx: 1 });
      floaters(P, t, 400, 250, (x, y, s) => heart(x, y, s * 1.2), 3, 0.25);
    },
    front(P) { frontFerns(P); },
  },

  end_parade: {
    bg(P) { valleyBg(P, { palm: false }); },
    fg(P, t, S, A) {
      sunStick(P, t, 112, 70);
      const flags = [Ln(lp([[-20, 40], [200, 80], [420, 60], [620, 84], [820, 44]]), '#8a6a4a', 2)];
      for (let i = 0; i < 16; i++) { const x = -10 + i * 54, y = 40 + Math.sin((i / 15) * Math.PI * 3) * 18 + 22; flags.push(F(poly([[x - 12, y], [x + 12, y], [x, y + 26]]), confettiCols[i % confettiCols.length])); }
      P.obj(flags, { bw: 4 });
      if (fr(S, 'glow')) for (let i = 0; i < 16; i++) { const x = -10 + i * 54 + 27, y = 64 + Math.sin(((i + 0.5) / 15) * Math.PI * 3) * 18; const a = 0.5 + 0.5 * Math.sin(t * 3 + i); P.glow(x, y, 22, '#9ff2d0', a); P.glow(x, y, 4, '#eafff6', a); }
      P.obj(place(longneck(t, { open: 0 }), { x: 700, y: 430, s: 0.62, flip: true }));
      const cheer = (i) => -Math.max(0, Math.sin(t * 4 + i)) * 14;
      if (fr(S, 'crocs')) { P.obj([F(ell(110, 420, 110, 26), '#5fb6e8')]); P.obj(place(croc(t, { open: 1, smile: true }), { x: 70, y: 420 + cheer(0) * 0.3, s: 0.6 })); P.obj(place(croc(t, { open: 1, smile: true }), { x: 160, y: 426 + cheer(1) * 0.3, s: 0.5 })); }
      if (fr(S, 'stego')) { P.obj(place(stego(t), { x: 250, y: 410, s: 1.15 })); P.obj(place(stego(t), { x: 300, y: 432 + cheer(2), s: 0.7 })); }
      if (fr(S, 'raptors')) { P.obj(place(raptor(t, { happy: true, lx: -1 }), { x: 560, y: 410 + cheer(3), s: 0.6, flip: true })); P.obj(place(raptor(t, { happy: true, seed: 2 }), { x: 640, y: 428 + cheer(4), s: 0.62, flip: true })); P.obj(place(raptor(t, { happy: true, seed: 4 }), { x: 500, y: 440 + cheer(5), s: 0.55, flip: true })); }
      drawBuddy(P, t, S, 470, 436, 0.62, { hop: cheer(6), flip: true, lx: 1 });
      drawPip(P, t, S, A, 390, 426 + cheer(7), 0.78, { lx: 1, ly: -0.2, mouth: 0.6, noHop: true });
      confetti(P, t, 40);
    },
    front(P) { frontFerns(P); },
  },

  end_song: {
    bg(P) { mountainBg(P, SKY_DUSK); },
    fg(P, t, S, A) {
      const sing = (o) => 0.5 + 0.5 * Math.sin(t * 5 + o);
      P.obj(place(rex(t, { jaw: 0.1 + 0.12 * sing(0), tilt: -0.08, open: 0 }), { x: 660, y: 452, s: 1, flip: true }));
      P.obj(place(babyRex(t, { hat: true, mouth: sing(1), lx: -1, open: 0 }), { x: 470, y: 436, s: 0.95, flip: true }));
      drawPip(P, t, S, A, 290, 430, 0.8, { lx: 1, ly: -0.4, mouth: sing(2), open: 0, noHop: true });
      drawBuddy(P, t, S, 130, 440, 0.6, { lx: 1, open: 0 });
      floaters(P, t, 340, 300, (x, y, s, i) => note(x, y, s, noteCols[i % 4], Math.sin(y * 0.05) * 0.3), 3, 0.32);
      floaters(P, t + 1, 440, 340, (x, y, s, i) => note(x, y, s * 0.8, noteCols[(i + 1) % 4]), 2, 0.4);
      floaters(P, t + 2, 520, 180, (x, y, s, i) => note(x, y, s * 1.4, noteCols[(i + 2) % 4]), 3, 0.28);
    },
  },

  end_achoo: {
    bg(P) { mountainBg(P); },
    fg(P, t, S, A) {
      const c = t % 3.6, pre = ease(c / 1.2), boom = c > 1.2 && c < 2.6, blow = c > 1.2 ? ease((c - 1.2) / 0.35) * (1 - ease((c - 2.4) / 0.9)) : 0;
      P.obj(place(rex(t, { tilt: -0.05, open: boom ? 0 : undefined, jaw: boom ? 0.15 : 0 }), { x: 690, y: 452, s: 0.95, flip: true }));
      P.obj(place(babyRex(t, { hat: !boom, tilt: c < 1.2 ? -0.3 * pre : 0.15, mouth: c < 1.2 ? pre * 0.6 : 1, open: c < 1.2 ? 1 - pre * 0.7 : 0, lx: -1 }), { x: 480, y: 438, s: 1, flip: true }));
      if (boom) {
        const k = ease((c - 1.2) / 0.3);
        const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, d = (i % 2 ? 26 : 50) * k; pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
        P.obj([F(poly(pts.map(([x, y]) => [x + 410, y + 368])), '#ffffff')], { alpha: 1 - ease((c - 1.8) / 0.8) });
        for (let i = 0; i < 5; i++) { const d = (c - 1.2) * 200; P.obj(place([F(ell(0, 0, 10, 5), '#6cb84f')], { x: 400 - d - i * 18, y: 360 + Math.sin(i * 2 + c * 6) * 30 - i * 6, r: c * 5 + i })); }
        P.obj(place(shellTop(), { x: 470 + (c - 1.2) * 60, y: 340 - Math.sin(Math.min(1, (c - 1.2) / 1.2) * Math.PI) * 80, s: 0.85, r: (c - 1.2) * 8 }));
      }
      drawPip(P, t, S, A, 290 - blow * 70, 430, 0.8, { lx: 1, mouth: blow > 0.2 ? 1 : 0, open: blow > 0.2 ? 0 : undefined, r: -blow * 0.5, noHop: true });
      drawBuddy(P, t, S, 120, 440, 0.6, { lx: 1, open: boom ? 0 : undefined });
    },
  },
  };

  root.SCENE_ART = SCENES;
})(this);
