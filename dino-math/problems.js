/*
 * Dino Defenders: worlds, levels and problem generators.
 *
 * Each level has a generator gen(d, r) that returns one problem.
 *   d = difficulty inside the level: 0, 1 or 2 (the game moves it up and down)
 *   r = random function returning [0, 1)
 *
 * A problem looks like:
 *   { q: tokens, prompt, say, ans, choices, pickOnly, decimal, visual, showVisual, hint }
 * q tokens are strings, numbers, fractions {n, d} and the answer slot '?'.
 * A fraction token can hold the slot as its top: {n: '?', d: 100}.
 *
 * Works in the browser (window.DinoProblems) and in Node (module.exports),
 * so tools/check-problems.js can test every generator.
 */
(function (root) {
  'use strict';

  /* ---------- helpers ---------- */
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => a / gcd(a, b) * b;
  const fix = (x, dp = 6) => Math.round(x * 10 ** dp) / 10 ** dp;
  const MINUS = '−', TIMES = '×', DIV = '÷';
  function commas(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmt(n) {
    if (typeof n !== 'number') return String(n);
    n = fix(n);
    const s = String(n);
    if (Math.abs(n) < 1000) return s;
    const [i, f] = s.split('.');
    return commas(i) + (f ? '.' + f : '');
  }
  const plain = (n) => String(fix(n));
  function seq(a, b) { const out = []; for (let i = a; i <= b; i++) out.push(i); return out.join(', '); }
  function countUp(n) { return n <= 10 ? seq(1, n) : '1, 2, 3, and on up to ' + n; }
  const isPrime = (n) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  const factors = (n) => { const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; };
  const dp = (x) => { const s = String(fix(x)); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

  const NUM = (v) => ({ k: 'num', v: fix(v) });
  const FRAC = (n, d, exact = false) => ({ k: 'frac', n, d, exact });
  const REM = (q, r) => ({ k: 'rem', q, r });
  const CH = (v) => ({ k: 'choice', v: String(v) });

  /* ---------- speech ---------- */
  const ORD = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 5: ['fifth', 'fifths'], 6: ['sixth', 'sixths'], 7: ['seventh', 'sevenths'], 8: ['eighth', 'eighths'], 9: ['ninth', 'ninths'], 10: ['tenth', 'tenths'], 12: ['twelfth', 'twelfths'], 100: ['hundredth', 'hundredths'] };
  function fracSay(n, d) {
    const o = ORD[d] || [d + 'th', d + 'ths'];
    if (n === '?') return 'how many ' + o[1];
    return n + ' ' + (n === 1 ? o[0] : o[1]);
  }
  function sayTokens(q) {
    return q.map((t) => {
      if (t && typeof t === 'object') return ' ' + fracSay(t.n, t.d) + ' ';
      if (t === '?') return ' what ';
      if (typeof t === 'number') return ' ' + fmt(t) + ' ';
      return t.replace(/\+/g, ' plus ').replace(/−/g, ' minus ').replace(/×/g, ' times ').replace(/÷/g, ' divided by ')
        .replace(/=/g, ' equals ').replace(/¢/g, ' cents ').replace(/→/g, ' rounds to ').replace(/[()[\]]/g, ' ');
    }).join('').replace(/\s+/g, ' ').trim();
  }

  /* ---------- answer choices ---------- */
  function numChoices(r, ans, cands, min = 0) {
    const out = [fix(ans)];
    const pool = cands.concat([ans + 1, ans - 1, ans + 2, ans + 10, ans - 10, ans + 3]).map((x) => fix(x));
    for (const c of pool) {
      if (out.length >= 3) break;
      if (c >= min && Number.isFinite(c) && !out.some((s) => Math.abs(s - c) < 1e-9)) out.push(c);
    }
    let k = 4; while (out.length < 3) { const c = fix(ans + k++); if (!out.includes(c)) out.push(c); }
    return shuffle(r, out).map((v) => ({ label: [v], ok: Math.abs(v - ans) < 1e-9 }));
  }
  function fracChoices(r, n, d, cands) {
    const out = [[n, d]];
    const pool = cands.concat([[n + 1, d], [n, d + 1], [Math.max(1, n - 1), d], [n + 2, d]]);
    for (const [a, b] of pool) {
      if (out.length >= 3) break;
      if (b <= 0 || a < 0 || !Number.isInteger(a) || !Number.isInteger(b)) continue;
      if (a * d === n * b) continue; // same value as the answer
      if (out.some(([x, y]) => x * b === a * y)) continue;
      out.push([a, b]);
    }
    return shuffle(r, out).map(([a, b]) => ({ label: [{ n: a, d: b }], ok: a === n && b === d }));
  }
  function remChoices(r, q, rm, b, cands) {
    const out = [[q, rm]];
    const pool = cands.concat([[q + 1, rm], [q - 1, rm], [q, (rm + 1) % b || 1], [q + 10, rm]]);
    for (const [a, c] of pool) {
      if (out.length >= 3) break;
      if (a < 0 || c < 0 || c >= b) continue;
      if (out.some(([x, y]) => x === a && y === c)) continue;
      out.push([a, c]);
    }
    return shuffle(r, out).map(([a, c]) => ({ label: [a, ' R ', c], ok: a === q && c === rm }));
  }
  const choiceList = (labels, correct) => labels.map((l) => ({ label: [l.label !== undefined ? l.label : l], ok: String(l.v !== undefined ? l.v : l) === String(correct), v: String(l.v !== undefined ? l.v : l) }));

  function prob(o) {
    const p = Object.assign({ prompt: '', visual: null, hint: '', pickOnly: false, decimal: false, showVisual: false }, o);
    if (!p.say) p.say = ((p.prompt ? p.prompt + ' ' : '') + sayTokens(p.q)).trim();
    if (p.ans.k === 'num' && !Number.isInteger(p.ans.v)) p.decimal = true;
    if (p.ans.k === 'choice') p.pickOnly = true;
    return p;
  }

  /* ---------- hint helpers ---------- */
  const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];
  function digits(n) { return String(n).split('').reverse().map(Number); }
  function addHint(a, b) {
    const da = digits(a), db = digits(b), parts = []; let carry = 0;
    for (let i = 0; i < Math.max(da.length, db.length); i++) {
      const x = da[i] || 0, y = db[i] || 0, s = x + y + carry;
      parts.push(`${PLACES[i]}: ${x} + ${y}${carry ? ' + 1' : ''} = ${s}${s >= 10 ? ', carry 1' : ''}`);
      carry = s >= 10 ? 1 : 0;
    }
    return 'Start with the ones. ' + parts.join('. ') + '. So it is ' + fmt(a + b) + '.';
  }
  function subHint(a, b) {
    const da = digits(a), db = digits(b), parts = []; let borrow = 0;
    for (let i = 0; i < da.length; i++) {
      let x = da[i] - borrow; const y = db[i] || 0; borrow = 0;
      if (x < y) { parts.push(`${PLACES[i]}: ${x} is less than ${y}, so trade a ten: ${x + 10} ${MINUS} ${y} = ${x + 10 - y}`); borrow = 1; }
      else if (y || i === 0) parts.push(`${PLACES[i]}: ${x} ${MINUS} ${y} = ${x - y}`);
    }
    return 'Start with the ones. ' + parts.join('. ') + '. So it is ' + fmt(a - b) + '.';
  }
  const noCarryAdd = (a, b) => { const da = digits(a), db = digits(b); let s = ''; for (let i = 0; i < Math.max(da.length, db.length); i++) s = (((da[i] || 0) + (db[i] || 0)) % 10) + s; return Number(s); };
  const noBorrowSub = (a, b) => { const da = digits(a), db = digits(b); let s = ''; for (let i = 0; i < da.length; i++) s = Math.abs(da[i] - (db[i] || 0)) + s; return Number(s); };
  function makeTenHint(a, b) { const need = 10 - a, rest = b - need; return `${a} + ${need} makes 10. Then ${rest} more makes ${10 + rest}.`; }
  function skip(b, n) { const s = []; for (let i = 1; i <= n; i++) s.push(b * i); return s.join(', '); }

  /* ================= KINDERGARTEN ================= */
  const K = [
    { id: 'k-count', name: 'Count the eggs', std: 'K.CC.5', gen(d, r) {
      const n = d === 0 ? ri(r, 2, 5) : d === 1 ? ri(r, 4, 10) : ri(r, 8, 20);
      return prob({ prompt: 'How many eggs?', q: ['?'], ans: NUM(n), choices: numChoices(r, n, [n - 1, n + 1, n + 2], 1), visual: { t: 'count', n }, showVisual: true,
        say: 'How many eggs are there?', hint: `Let's count them together. Touch each egg once: ${countUp(n)}. There are ${n}!` });
    } },
    { id: 'k-more', name: 'More or fewer', std: 'K.CC.6–7', gen(d, r) {
      const top = d === 0 ? 5 : 10, a = ri(r, 1, top); let b; do b = ri(r, 1, top); while (b === a);
      const fewer = d > 0 && r() < 0.5, v = fewer ? Math.min(a, b) : Math.max(a, b);
      const prompt = d < 2 ? (fewer ? 'Which nest has fewer eggs?' : 'Which nest has more eggs?') : (fewer ? 'Which number is smaller?' : 'Which number is bigger?');
      return prob({ prompt, q: [a, '  or  ', b], ans: CH(v), choices: choiceList([a, b], v), visual: d < 2 ? { t: 'compare', a, b } : { t: 'line', lo: 0, hi: 10, marks: [a, b] }, showVisual: d < 2,
        hint: d < 2 ? `Count each nest. One has ${Math.min(a, b)} and one has ${Math.max(a, b)}. ${v} is ${fewer ? 'fewer' : 'more'}.` : `When we count, ${Math.min(a, b)} comes before ${Math.max(a, b)}. So ${v} is ${fewer ? 'smaller' : 'bigger'}.` });
    } },
    { id: 'k-add', name: 'Add with pictures', std: 'K.OA.2', gen(d, r) {
      if (d < 2) {
        const s = ri(r, 2, d === 0 ? 5 : 10), a = ri(r, 1, s - 1), b = s - a;
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(s), choices: numChoices(r, s, [s + 1, s - 1, a]), visual: { t: 'dots', a, b, op: '+' }, showVisual: true,
          hint: `Start at ${a}, then count on ${b} more: ${seq(a + 1, s)}. That's ${s}!` });
      }
      const a = ri(r, 3, 10), b = ri(r, 1, a - 1);
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(a - b), choices: numChoices(r, a - b, [a - b + 1, a - b - 1, a + b]), visual: { t: 'dots', a, b, op: '-' }, showVisual: true,
        hint: `Start with ${a}. Take away ${b}. Count the ones that are left: ${a - b}.` });
    } },
    { id: 'k-apart', name: 'Break a number apart', std: 'K.OA.3', gen(d, r) {
      const n = d === 0 ? ri(r, 3, 5) : ri(r, 5, 10), a = ri(r, 1, n - 1);
      return prob({ q: [n, ' = ', a, ' + ', '?'], ans: NUM(n - a), choices: numChoices(r, n - a, [n - a + 1, n - a - 1, n], 0), visual: { t: 'split', n, a }, showVisual: d === 0,
        hint: `There are ${n} dots. ${a} are orange. Count the blue ones: ${n - a}.` });
    } },
    { id: 'k-ten', name: 'Make 10', std: 'K.OA.4', gen(d, r) {
      const a = d === 0 ? ri(r, 5, 9) : ri(r, 1, 9), rev = d === 2 && r() < 0.5;
      return prob({ q: rev ? ['?', ' + ', a, ' = ', 10] : [a, ' + ', '?', ' = ', 10], ans: NUM(10 - a), choices: numChoices(r, 10 - a, [11 - a, 9 - a, a]), visual: { t: 'tenframe', filled: a }, showVisual: d === 0,
        hint: `The ten-frame has ${a}. Count the empty boxes. ${10 - a} more makes 10.` });
    } },
    { id: 'k-teen', name: 'Teen numbers', std: 'K.NBT.1', gen(d, r) {
      const n = ri(r, 11, 19), k = n - 10;
      if (d < 2) return prob({ q: [n, ' = ', 10, ' + ', '?'], ans: NUM(k), choices: numChoices(r, k, [k + 1, k - 1, n]), visual: { t: 'teen', n }, showVisual: d === 0, hint: `${n} is one full ten-frame, that's 10, and ${k} more.` });
      return prob({ q: [10, ' + ', k, ' = ', '?'], ans: NUM(n), choices: numChoices(r, n, [n + 1, n - 1, 10 + k + 10]), visual: { t: 'teen', n }, hint: `One full ten-frame is 10. ${k} more makes ${n}.` });
    } },
    { id: 'k-facts', name: 'Quick facts to 5', std: 'K.OA.5', gen(d, r) {
      if (d === 0 || r() < 0.5) { const s = ri(r, 2, 5), a = ri(r, 0, s); const b = s - a;
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(s), choices: numChoices(r, s, [s + 1, s - 1]), visual: { t: 'dots', a, b, op: '+' }, hint: `${a} and ${b} more. Count them all: ${s}.` }); }
      const a = ri(r, 1, 5), b = ri(r, 0, a);
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(a - b), choices: numChoices(r, a - b, [a - b + 1, a - b - 1, a]), visual: { t: 'dots', a, b, op: '-' }, hint: `Start with ${a} and take away ${b}. ${a - b} are left.` });
    } },
  ];

  /* ================= GRADE 1 ================= */
  const G1 = [
    { id: 'g1-add', name: 'Add within 20', std: '1.OA.6', gen(d, r) {
      let a, b;
      if (d === 0) { const s = ri(r, 3, 10); a = ri(r, 1, s - 1); b = s - a; }
      else if (d === 1) { a = ri(r, 10, 18); b = ri(r, 1, 9 - (a - 10)); }
      else { a = ri(r, 5, 9); b = ri(r, 11 - a, 9); }
      const s = a + b;
      return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(s), choices: numChoices(r, s, [s + 1, s - 1, s + 10]), visual: { t: 'dots', a, b, op: '+' },
        hint: d === 2 ? makeTenHint(a, b) : `Start at ${a} and count on ${b}: ${seq(a + 1, s)}.` });
    } },
    { id: 'g1-sub', name: 'Subtract within 20', std: '1.OA.6', gen(d, r) {
      let a, b;
      if (d === 0) { a = ri(r, 3, 10); b = ri(r, 1, a - 1); }
      else if (d === 1) { a = ri(r, 11, 19); b = ri(r, 1, a - 10); }
      else { a = ri(r, 11, 18); b = ri(r, a - 9, 9); }
      const v = a - b;
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [v + 1, v - 1, a + b]), visual: { t: 'dots', a, b, op: '-' },
        hint: d === 2 ? `${a} ${MINUS} ${a - 10} = 10. Then take away ${b - (a - 10)} more: ${v}.` : `Start at ${a} and count back ${b}. You land on ${v}.` });
    } },
    { id: 'g1-missing', name: 'Missing number', std: '1.OA.8', gen(d, r) {
      const c = ri(r, 4, d === 0 ? 10 : 20), a = ri(r, 1, c - 1), b = c - a, form = d === 0 ? 0 : d === 1 ? ri(r, 0, 1) : ri(r, 0, 3);
      if (form === 0) return prob({ q: [a, ' + ', '?', ' = ', c], ans: NUM(b), choices: numChoices(r, b, [b + 1, b - 1, c]), visual: { t: 'dots', a, b, op: '+' }, hint: `Count up from ${a} to ${c}. That's ${b} more.` });
      if (form === 1) return prob({ q: ['?', ' + ', b, ' = ', c], ans: NUM(a), choices: numChoices(r, a, [a + 1, a - 1, c]), visual: { t: 'dots', a, b, op: '+' }, hint: `What and ${b} make ${c}? Count back ${b} from ${c}: ${a}.` });
      if (form === 2) return prob({ q: [c, ' ' + MINUS + ' ', '?', ' = ', a], ans: NUM(b), choices: numChoices(r, b, [b + 1, b - 1, c]), visual: { t: 'dots', a: c, b, op: '-' }, hint: `${c} take away what leaves ${a}? Count up from ${a} to ${c}: ${b}.` });
      return prob({ q: ['?', ' ' + MINUS + ' ', b, ' = ', a], ans: NUM(c), choices: numChoices(r, c, [c + 1, c - 1, a]), visual: { t: 'dots', a: c, b, op: '-' }, hint: `If ${b} are taken away and ${a} are left, there were ${a} + ${b} = ${c}.` });
    } },
    { id: 'g1-tf', name: 'True or false', std: '1.OA.7', gen(d, r) {
      const truth = r() < 0.5; let q, L, R;
      if (d === 0) { const a = ri(r, 1, 6), b = ri(r, 1, 6); L = a + b; R = truth ? L : L + pick(r, [-1, 1]); q = [a, ' + ', b, ' = ', R]; }
      else if (d === 1) { const a = ri(r, 1, 9), b = ri(r, 1, 9); L = a + b; R = truth ? L : L + pick(r, [-1, 1]); const c = ri(r, Math.max(1, R - 9), Math.min(9, R - 1)); q = [a, ' + ', b, ' = ', c, ' + ', R - c]; }
      else { const a = ri(r, 8, 18), b = ri(r, 1, 7); L = a - b; R = truth ? L : L + pick(r, [-1, 1]); const c = ri(r, R + 1, R + 6); q = [a, ' ' + MINUS + ' ', b, ' = ', c, ' ' + MINUS + ' ', c - R]; }
      const v = L === R ? 'True' : 'False';
      return prob({ prompt: 'True or false?', q, ans: CH(v), choices: choiceList(['True', 'False'], v), hint: `Work out each side. The left side is ${L}. The right side is ${R}. ${L === R ? 'They match, so it is true!' : 'They are different, so it is false.'}` });
    } },
    { id: 'g1-compare', name: 'Compare numbers', std: '1.NBT.3', gen(d, r) {
      let a, b;
      if (d === 0) { do { a = ri(r, 10, 99); b = ri(r, 10, 99); } while (Math.floor(a / 10) === Math.floor(b / 10)); }
      else if (d === 1) { const t = ri(r, 1, 9); a = t * 10 + ri(r, 0, 9); do b = t * 10 + ri(r, 0, 9); while (b === a); }
      else { a = ri(r, 10, 99); b = r() < 0.25 ? a : ri(r, 10, 99); }
      const v = a < b ? '<' : a > b ? '>' : '=';
      const ta = Math.floor(a / 10), tb = Math.floor(b / 10);
      return prob({ prompt: 'Pick <, = or >', q: [a, ' ', '?', ' ', b], ans: CH(v), choices: choiceList(['<', '=', '>'], v),
        say: `Is ${a} less than, equal to, or greater than ${b}?`, visual: { t: 'blocks', nums: [a, b], op: 'cmp' },
        hint: ta !== tb ? `Look at the tens first. ${a} has ${ta} tens and ${b} has ${tb} tens. So ${a} ${v === '<' ? 'is less than' : 'is greater than'} ${b}.` : `Same tens, so look at the ones: ${a % 10} and ${b % 10}. ${v === '=' ? 'They are equal!' : `${a} ${v === '<' ? 'is less than' : 'is greater than'} ${b}.`} The open mouth eats the bigger number.` });
    } },
    { id: 'g1-add100', name: 'Add within 100', std: '1.NBT.4', gen(d, r) {
      let a, b;
      if (d === 0) { a = ri(r, 11, 69); b = ri(r, 1, 9 - Math.floor(a / 10)) * 10; }
      else if (d === 1) { do a = ri(r, 11, 88); while (a % 10 > 8); b = ri(r, 1, 9 - a % 10); }
      else { do a = ri(r, 11, 89); while (a % 10 === 0); b = ri(r, 10 - a % 10, 9); }
      const s = a + b;
      return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(s), choices: numChoices(r, s, [s - 10, s + 10, s + 1]), visual: { t: 'blocks', nums: [a, b], op: '+' }, hint: addHint(a, b) });
    } },
    { id: 'g1-tens', name: 'Ten more, ten less', std: '1.NBT.5', gen(d, r) {
      const less = d === 2 && r() < 0.5, n = less ? ri(r, 20, 99) : ri(r, 10, 89), v = less ? n - 10 : n + 10;
      return prob({ q: [10, less ? ' less than ' : ' more than ', n, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [less ? n - 1 : n + 1, less ? n + 10 : n - 10, v + 1]), visual: { t: 'blocks', nums: [n], op: '' },
        hint: `Only the tens change. ${Math.floor(n / 10)} tens becomes ${Math.floor(v / 10)} tens. So it's ${v}.` });
    } },
  ];

  /* ================= GRADE 2 ================= */
  const G2 = [
    { id: 'g2-facts', name: 'Facts to 20', std: '2.OA.2', gen(d, r) {
      if (r() < 0.55) { const a = ri(r, d === 0 ? 2 : 4, 9), b = ri(r, Math.max(2, (d === 0 ? 2 : 11) - a), 9), s = a + b;
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(s), choices: numChoices(r, s, [s + 1, s - 1, s + 10]), visual: { t: 'dots', a, b, op: '+' }, hint: s > 10 && a < 10 ? makeTenHint(a, b) : `${a} + ${b} = ${s}.` }); }
      const a = ri(r, d === 0 ? 5 : 11, d === 0 ? 10 : 18), b = ri(r, Math.max(1, a - 9), Math.min(9, a - 1)), v = a - b;
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [v + 1, v - 1, v + 10]), visual: { t: 'dots', a, b, op: '-' },
        hint: a > 10 && b > a - 10 ? `${a} ${MINUS} ${a - 10} = 10. Then take away ${b - (a - 10)} more: ${v}.` : `Count back ${b} from ${a}: ${v}.` });
    } },
    { id: 'g2-100', name: 'Add and subtract to 100', std: '2.NBT.5', gen(d, r) {
      if (d === 0) { const at = ri(r, 1, 7), bt = ri(r, 1, 8 - at), ao = ri(r, 0, 8), bo = ri(r, 0, 9 - ao), a = at * 10 + ao, b = bt * 10 + bo;
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(a + b), choices: numChoices(r, a + b, [a + b + 10, a + b - 1, a + b - 10]), visual: { t: 'blocks', nums: [a, b], op: '+' }, hint: addHint(a, b) }); }
      if (d === 1) { let a, b; do { a = ri(r, 11, 79); b = ri(r, 11, 89 - a); } while ((a % 10) + (b % 10) < 10 || a + b > 99);
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(a + b), choices: numChoices(r, a + b, [a + b - 10, noCarryAdd(a, b), a + b + 1]), visual: { t: 'blocks', nums: [a, b], op: '+' }, hint: addHint(a, b) }); }
      let a, b; do { a = ri(r, 30, 99); b = ri(r, 11, a - 1); } while (b % 10 <= a % 10);
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(a - b), choices: numChoices(r, a - b, [noBorrowSub(a, b), a - b + 10, a - b - 1]), visual: { t: 'blocks', nums: [a, b], op: '-' }, hint: subHint(a, b) });
    } },
    { id: 'g2-1000', name: 'Add and subtract to 1000', std: '2.NBT.7', gen(d, r) {
      if (d === 0) { const a = ri(r, 100, 799), b = ri(r, 1, 9 - Math.floor(a / 100)) * 100;
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(a + b), choices: numChoices(r, a + b, [a + b - 100, a + b + 10, a + b + 100]), visual: { t: 'column', a, b, op: '+' }, hint: `Only the hundreds change: ${Math.floor(a / 100)} + ${b / 100} = ${Math.floor((a + b) / 100)} hundreds. So it's ${a + b}.` }); }
      if (d === 1) { let a, b; do { a = ri(r, 101, 699); b = ri(r, 101, 899 - a); } while ((a % 10) + (b % 10) < 10 || a + b > 999);
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(a + b), choices: numChoices(r, a + b, [noCarryAdd(a, b), a + b + 10, a + b - 1]), visual: { t: 'column', a, b, op: '+' }, hint: addHint(a, b) }); }
      let a, b; do { a = ri(r, 300, 999); b = ri(r, 101, a - 50); } while (b % 10 <= a % 10);
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(a - b), choices: numChoices(r, a - b, [noBorrowSub(a, b), a - b + 10, a - b - 1]), visual: { t: 'column', a, b, op: '-' }, hint: subHint(a, b) });
    } },
    { id: 'g2-mental', name: '10 or 100 more or less', std: '2.NBT.8', gen(d, r) {
      const n = ri(r, 210, 889), ops = d === 0 ? [[10, 1], [100, 1]] : [[10, 1], [10, -1], [100, 1], [100, -1]], [m, s] = pick(r, ops), v = n + m * s;
      return prob({ q: [m, s > 0 ? ' more than ' : ' less than ', n, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [n + (m === 10 ? 100 : 10) * s, n + s, v + 1]), visual: { t: 'column', a: n, b: m, op: s > 0 ? '+' : '-' },
        hint: `Only the ${m === 10 ? 'tens' : 'hundreds'} digit changes, by 1. So ${n} becomes ${v}.` });
    } },
    { id: 'g2-oddeven', name: 'Odd or even', std: '2.OA.3', gen(d, r) {
      const n = ri(r, 1, d === 0 ? 10 : 20), v = n % 2 ? 'odd' : 'even';
      return prob({ prompt: 'Odd or even?', q: [n], ans: CH(v), choices: choiceList([{ label: 'odd', v: 'odd' }, { label: 'even', v: 'even' }], v), visual: { t: 'pairs', n }, showVisual: d === 0,
        hint: `Put ${n} dots into pairs. ${n % 2 ? 'One is left over, so it is odd.' : 'Every dot has a buddy, so it is even.'}` });
    } },
    { id: 'g2-rows', name: 'Rows of eggs', std: '2.OA.4', gen(d, r) {
      const rows = ri(r, 2, d === 0 ? 3 : 5), cols = ri(r, 2, d === 0 ? 4 : 5), q = [];
      for (let i = 0; i < rows; i++) { if (i) q.push(' + '); q.push(cols); } q.push(' = ', '?');
      return prob({ prompt: `${rows} rows of ${cols} eggs`, q, ans: NUM(rows * cols), choices: numChoices(r, rows * cols, [rows * cols + cols, rows * cols - 1, rows + cols]), visual: { t: 'array', rows, cols }, showVisual: true,
        hint: `Count by ${cols}s, one row at a time: ${skip(cols, rows)}.` });
    } },
    { id: 'g2-coins', name: 'Coins', std: '2.MD.8', gen(d, r) {
      let c; do { c = { q: d === 2 ? ri(r, 0, 2) : 0, d: ri(r, 0, 4), n: d >= 1 ? ri(r, 0, 2) : 0, p: ri(r, 0, d === 0 ? 9 : 6) }; }
      while ((c.q > 0) + (c.d > 0) + (c.n > 0) + (c.p > 0) < 2 || 25 * c.q + 10 * c.d + 5 * c.n + c.p > 99);
      const v = 25 * c.q + 10 * c.d + 5 * c.n + c.p, list = [], run = []; let tot = 0;
      for (const [k, val] of [['q', 25], ['d', 10], ['n', 5], ['p', 1]]) for (let i = 0; i < c[k]; i++) { list.push(k); tot += val; run.push(tot); }
      return prob({ prompt: 'How many cents?', q: ['?', '¢'], ans: NUM(v), choices: numChoices(r, v, [list.length, v + 5, v - 1], 1), visual: { t: 'coins', list }, showVisual: true,
        say: 'How many cents are these coins worth?', hint: `Start with the biggest coins and count on: ${run.join(', ')} cents.` });
    } },
  ];

  /* ================= GRADE 3 ================= */
  const G3 = [
    { id: 'g3-times', name: 'Times tables', std: '3.OA.7', gen(d, r) {
      const a = d === 0 ? pick(r, [0, 1, 2, 5, 10]) : d === 1 ? pick(r, [3, 4]) : ri(r, 6, 9), b = d === 2 ? ri(r, 2, 9) : ri(r, d === 0 ? 0 : 1, 10), v = a * b;
      const [x, y] = r() < 0.5 ? [a, b] : [b, a];
      return prob({ q: [x, ' ' + TIMES + ' ', y, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [a * (b + 1), a * Math.max(0, b - 1), a + b]), visual: v > 0 && v <= 81 ? { t: 'array', rows: Math.min(x, y), cols: Math.max(x, y) } : null,
        hint: v === 0 ? 'Anything times 0 is 0.' : `${Math.min(x, y)} groups of ${Math.max(x, y)}. Count by ${Math.max(x, y)}s: ${skip(Math.max(x, y), Math.min(x, y))}.` });
    } },
    { id: 'g3-divide', name: 'Division facts', std: '3.OA.7', gen(d, r) {
      const a = d === 0 ? pick(r, [2, 5, 10]) : d === 1 ? pick(r, [3, 4]) : ri(r, 6, 9), b = ri(r, 1, d === 2 ? 9 : 10), c = a * b;
      return prob({ q: [c, ' ' + DIV + ' ', a, ' = ', '?'], ans: NUM(b), choices: numChoices(r, b, [b + 1, b - 1, a], 1), visual: c <= 81 ? { t: 'array', rows: b, cols: a } : null,
        hint: `Think: ${a} ${TIMES} what = ${c}? ${a} ${TIMES} ${b} = ${c}, so the answer is ${b}.` });
    } },
    { id: 'g3-missing', name: 'Missing factor', std: '3.OA.4', gen(d, r) {
      const a = ri(r, 2, d === 0 ? 5 : 9), b = ri(r, 2, d === 0 ? 5 : 9), c = a * b, form = d === 2 ? ri(r, 0, 2) : ri(r, 0, 1);
      if (form === 0) return prob({ q: [a, ' ' + TIMES + ' ', '?', ' = ', c], ans: NUM(b), choices: numChoices(r, b, [b + 1, b - 1, c - a], 1), visual: { t: 'array', rows: a, cols: b }, hint: `Count by ${a}s until you reach ${c}: ${skip(a, b)}. That's ${b} jumps.` });
      if (form === 1) return prob({ q: ['?', ' ' + TIMES + ' ', b, ' = ', c], ans: NUM(a), choices: numChoices(r, a, [a + 1, a - 1, c - b], 1), visual: { t: 'array', rows: a, cols: b }, hint: `Count by ${b}s until you reach ${c}: ${skip(b, a)}. That's ${a} jumps.` });
      return prob({ q: [c, ' ' + DIV + ' ', '?', ' = ', b], ans: NUM(a), choices: numChoices(r, a, [a + 1, a - 1, b], 1), visual: { t: 'array', rows: a, cols: b }, hint: `${c} shared into groups of ${b}... ${b} ${TIMES} ${a} = ${c}, so it's ${a}.` });
    } },
    { id: 'g3-tens', name: 'Times tens', std: '3.NBT.3', gen(d, r) {
      const a = ri(r, 2, 9), m = ri(r, 1, d === 0 ? 5 : 9) * 10, v = a * m;
      return prob({ q: r() < 0.5 ? [a, ' ' + TIMES + ' ', m, ' = ', '?'] : [m, ' ' + TIMES + ' ', a, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [v / 10, v * 10, v + 10]),
        hint: `${a} ${TIMES} ${m / 10} = ${a * m / 10}. ${m} is ${m / 10} tens, so the answer is ${a * m / 10} tens: ${v}.` });
    } },
    { id: 'g3-round', name: 'Rounding', std: '3.NBT.1', gen(d, r) {
      const place = d === 2 ? 100 : 10; let n;
      do n = d === 0 ? ri(r, 11, 99) : ri(r, 101, 999); while (n % place === 0);
      const lo = Math.floor(n / place) * place, hi = lo + place, v = n - lo >= place / 2 ? hi : lo;
      const cands = [v === lo ? hi : lo, place === 100 ? Math.round(n / 10) * 10 : v + (v === hi ? 10 : -10)];
      return prob({ prompt: `Round ${fmt(n)} to the nearest ${place === 10 ? 'ten' : 'hundred'}.`, q: [n, '  →  ', '?'], ans: NUM(v), choices: numChoices(r, v, cands), visual: { t: 'line', lo, hi, n, round: true }, showVisual: d === 0,
        say: `Round ${n} to the nearest ${place === 10 ? 'ten' : 'hundred'}.`, hint: `${n} is between ${lo} and ${hi}. ${n - lo === place / 2 ? `It's exactly in the middle, and 5 rounds up, so it's ${hi}.` : `It is closer to ${v}.`}` });
    } },
    { id: 'g3-1000', name: 'Add and subtract to 1000', std: '3.NBT.2', gen(d, r) {
      if (d < 2 && r() < 0.6) { let a, b; do { a = ri(r, 120, 799); b = ri(r, 105, 999 - a); } while ((a % 10) + (b % 10) < 10 || (d === 1 && (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) < 9));
        return prob({ q: [a, ' + ', b, ' = ', '?'], ans: NUM(a + b), choices: numChoices(r, a + b, [noCarryAdd(a, b), a + b + 10, a + b - 100]), visual: { t: 'column', a, b, op: '+' }, hint: addHint(a, b) }); }
      let a, b; do { a = ri(r, 300, 999); b = ri(r, 105, a - 20); } while (b % 10 <= a % 10 || (d === 2 && (Math.floor(b / 10) % 10) < (Math.floor(a / 10) % 10)));
      return prob({ q: [a, ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(a - b), choices: numChoices(r, a - b, [noBorrowSub(a, b), a - b + 10, a - b + 100]), visual: { t: 'column', a, b, op: '-' }, hint: subHint(a, b) });
    } },
    { id: 'g3-frac', name: 'Fractions', std: '3.NF.1–3', gen(d, r) {
      if (d === 0) { const a = ri(r, 2, 8); let b; do b = ri(r, 2, 8); while (b === a); const big = Math.min(a, b);
        return prob({ prompt: 'Which is bigger?', q: [{ n: 1, d: a }, '  or  ', { n: 1, d: b }], ans: CH('1/' + big), choices: [a, b].map((x) => ({ label: [{ n: 1, d: x }], ok: x === big, v: '1/' + x })), visual: { t: 'bars', fr: [[1, a], [1, b]] }, showVisual: true,
          hint: `Cutting a bar into more pieces makes each piece smaller. 1/${big} has bigger pieces than 1/${Math.max(a, b)}.` }); }
      if (d === 1) { const den = ri(r, 3, 8), a = ri(r, 1, den - 1); let b; do b = ri(r, 1, den - 1); while (b === a); const big = Math.max(a, b);
        return prob({ prompt: 'Which is bigger?', q: [{ n: a, d: den }, '  or  ', { n: b, d: den }], ans: CH(big + '/' + den), choices: [a, b].map((x) => ({ label: [{ n: x, d: den }], ok: x === big, v: x + '/' + den })), visual: { t: 'bars', fr: [[a, den], [b, den]] },
          hint: `Both are cut into ${den} pieces. ${big} pieces is more than ${Math.min(a, b)} pieces.` }); }
      const b = pick(r, [2, 3, 4]), a = ri(r, 1, b - 1), k = ri(r, 2, b === 4 ? 2 : 4);
      return prob({ q: [{ n: a, d: b }, ' = ', { n: '?', d: b * k }], ans: NUM(a * k), choices: numChoices(r, a * k, [a * k + 1, a + k, b * k - a * k], 1), visual: { t: 'bars', fr: [[a, b], [a * k, b * k]] },
        hint: `Cut every ${ORD[b] ? ORD[b][0] : 'piece'} into ${k} smaller pieces. ${a} piece${a > 1 ? 's' : ''} become${a > 1 ? '' : 's'} ${a} ${TIMES} ${k} = ${a * k} pieces.` });
    } },
    { id: 'g3-area', name: 'Area', std: '3.MD.7', gen(d, r) {
      const w = ri(r, 2, d === 0 ? 5 : d === 1 ? 7 : 9), h = ri(r, 2, d === 0 ? 5 : d === 1 ? 7 : 9);
      return prob({ prompt: `A nest ${w} squares wide and ${h} squares long. How many squares?`, q: [w, ' ' + TIMES + ' ', h, ' = ', '?'], ans: NUM(w * h), choices: numChoices(r, w * h, [w * h + w, 2 * (w + h), w * h - h]), visual: { t: 'grid', w, h }, showVisual: d < 2,
        hint: `${h} rows of ${w} squares. ${h} ${TIMES} ${w} = ${w * h}.` });
    } },
  ];

  /* ================= GRADE 4 ================= */
  const G4 = [
    { id: 'g4-big', name: 'Big adding and subtracting', std: '4.NBT.4', gen(d, r) {
      let a, b, op;
      if (d === 0) { a = ri(r, 1000, 8999); b = ri(r, 100, 999); op = '+'; }
      else if (d === 1) { a = ri(r, 2000, 9999); b = ri(r, 1000, a - 100); op = '-'; }
      else { a = ri(r, 10000, 89999); b = ri(r, 1000, 9999); op = r() < 0.5 ? '+' : '-'; }
      const v = op === '+' ? a + b : a - b, err = op === '+' ? noCarryAdd(a, b) : noBorrowSub(a, b);
      return prob({ q: [a, op === '+' ? ' + ' : ' ' + MINUS + ' ', b, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [err, v + 100, v - 10]), visual: { t: 'column', a, b, op }, hint: op === '+' ? addHint(a, b) : subHint(a, b) });
    } },
    { id: 'g4-mult', name: 'Multiply', std: '4.NBT.5', gen(d, r) {
      const a = d === 0 ? ri(r, 12, 99) : d === 1 ? ri(r, 102, 4999) : ri(r, 11, 99), b = d === 2 ? ri(r, 11, 99) : ri(r, 2, 9), v = a * b;
      const parts = partial(a, b);
      return prob({ q: [a, ' ' + TIMES + ' ', b, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [v + (d === 2 ? 10 * a : 10), a * (b + 1), v - a]), visual: { t: 'partial', a, b },
        hint: `Break it into easy parts: ${parts.map((p) => `${fmt(p[0])} ${TIMES} ${fmt(p[1])} = ${fmt(p[0] * p[1])}`).join(', ')}. Add them up: ${fmt(v)}.` });
    } },
    { id: 'g4-div', name: 'Divide with remainders', std: '4.NBT.6', gen(d, r) {
      const b = ri(r, 2, 9);
      if (d === 0) { const q = ri(r, 10, 30), a = b * q; return prob({ q: [a, ' ' + DIV + ' ', b, ' = ', '?'], ans: NUM(q), choices: numChoices(r, q, [q + 1, q - 1, q + 10], 1), hint: `${b} ${TIMES} ${q} = ${a}. So ${a} ${DIV} ${b} = ${q}.` }); }
      const q = d === 1 ? ri(r, 10, 99) : ri(r, 120, 999), rm = ri(r, 1, b - 1), a = b * q + rm;
      return prob({ prompt: 'Find the answer and the remainder (R).', q: [a, ' ' + DIV + ' ', b, ' = ', '?'], ans: REM(q, rm), choices: remChoices(r, q, rm, b, [[q, (rm + 1) % b || 1], [q + 1, rm]]),
        say: `${a} divided by ${b}. What is the answer and the remainder?`, hint: `${b} ${TIMES} ${q} = ${fmt(b * q)}. ${fmt(a)} ${MINUS} ${fmt(b * q)} = ${rm} left over. So it's ${q} R ${rm}.` });
    } },
    { id: 'g4-factors', name: 'Factors and primes', std: '4.OA.4', gen(d, r) {
      const form = ri(r, 0, 2);
      if (form === 0) { const n = ri(r, 2, d === 0 ? 20 : d === 1 ? 50 : 100), v = isPrime(n) ? 'Yes' : 'No', f = factors(n);
        return prob({ prompt: 'Is this number prime?', q: [n], ans: CH(v), choices: choiceList(['Yes', 'No'], v), hint: `${n}'s factors are ${f.join(', ')}. ${v === 'Yes' ? 'Only 1 and itself, so it is prime!' : 'It has more than two factors, so it is not prime.'}` }); }
      if (form === 1) { const k = ri(r, 2, 9), n = r() < 0.5 ? k * ri(r, 2, 12) : ri(r, 12, d === 0 ? 50 : 100), v = n % k === 0 ? 'Yes' : 'No';
        return prob({ prompt: `Is ${k} a factor of ${n}?`, q: [k, '  and  ', n], ans: CH(v), choices: choiceList(['Yes', 'No'], v), say: `Is ${k} a factor of ${n}?`,
          hint: v === 'Yes' ? `${k} ${TIMES} ${n / k} = ${n}, so yes!` : `${n} ${DIV} ${k} has a remainder of ${n % k}, so no.` }); }
      const k = ri(r, 3, 9), m = k * ri(r, 2, 9), opts = shuffle(r, [m, m + 1, m - 1]);
      return prob({ prompt: `Which is a multiple of ${k}?`, q: opts.map((x, i) => (i ? [', ', x] : [x])).flat(), ans: CH(m), choices: choiceList(opts, m), say: `Which is a multiple of ${k}? ${opts.join(', ')}.`,
        hint: `Count by ${k}s: ${skip(k, m / k)}. ${m} is on the list.` });
    } },
    { id: 'g4-equiv', name: 'Equivalent fractions', std: '4.NF.1–2', gen(d, r) {
      if (d === 0) { const b = pick(r, [2, 3, 4, 5, 6]), a = ri(r, 1, b - 1), k = ri(r, 2, 4);
        return prob({ q: [{ n: a, d: b }, ' = ', { n: '?', d: b * k }], ans: NUM(a * k), choices: numChoices(r, a * k, [a + k, a * k + 1, b * k - a * k], 1), visual: { t: 'bars', fr: [[a, b], [a * k, b * k]] },
          hint: `The bottom was multiplied by ${k}, so multiply the top by ${k} too: ${a} ${TIMES} ${k} = ${a * k}.` }); }
      let a, b, c, e;
      if (d === 1) { b = pick(r, [2, 3, 4, 5]); const k = ri(r, 2, 3); e = b * k; a = ri(r, 1, b - 1); c = ri(r, 1, e - 1); }
      else { b = ri(r, 3, 9); e = ri(r, 3, 9); a = ri(r, 1, b - 1); c = ri(r, 1, e - 1); if (r() < 0.2) { const k = ri(r, 2, 3); e = b * k; c = a * k; } }
      const L = a * e, R = c * b, v = L < R ? '<' : L > R ? '>' : '=', m = lcm(b, e);
      return prob({ prompt: 'Pick <, = or >', q: [{ n: a, d: b }, ' ', '?', ' ', { n: c, d: e }], ans: CH(v), choices: choiceList(['<', '=', '>'], v), visual: { t: 'bars', fr: [[a, b], [c, e]] },
        say: `Is ${fracSay(a, b)} less than, equal to, or greater than ${fracSay(c, e)}?`, hint: `Make the bottoms the same: ${a}/${b} = ${a * m / b}/${m} and ${c}/${e} = ${c * m / e}/${m}. Now compare the tops: ${a * m / b} and ${c * m / e}.` });
    } },
    { id: 'g4-fracadd', name: 'Add and subtract fractions', std: '4.NF.3–4', gen(d, r) {
      const den = pick(r, [4, 5, 6, 8, 10, 12]);
      if (d === 0) { const a = ri(r, 1, den - 2), b = ri(r, 1, den - 1 - a);
        return prob({ q: [{ n: a, d: den }, ' + ', { n: b, d: den }, ' = ', '?'], ans: FRAC(a + b, den), choices: fracChoices(r, a + b, den, [[a + b, den * 2], [Math.abs(a - b), den]]), visual: { t: 'pie', d: den, parts: [a, b] },
          hint: `The pieces are the same size, so just add the tops: ${a} + ${b} = ${a + b}. It's ${a + b}/${den}.` }); }
      if (d === 1) { const a = ri(r, 2, den - 1), b = ri(r, 1, a - 1);
        return prob({ q: [{ n: a, d: den }, ' ' + MINUS + ' ', { n: b, d: den }, ' = ', '?'], ans: FRAC(a - b, den), choices: fracChoices(r, a - b, den, [[a + b, den], [a - b, 0]]), visual: { t: 'pie', d: den, parts: [a - b, b], minus: true },
          hint: `Same size pieces, so subtract the tops: ${a} ${MINUS} ${b} = ${a - b}. It's ${a - b}/${den}.` }); }
      const k = ri(r, 2, 5), dd = pick(r, [3, 4, 5, 6, 8]), a = ri(r, 1, dd - 1);
      return prob({ q: [k, ' ' + TIMES + ' ', { n: a, d: dd }, ' = ', '?'], ans: FRAC(k * a, dd), choices: fracChoices(r, k * a, dd, [[a, k * dd], [k + a, dd]]), visual: { t: 'bars', fr: Array.from({ length: k }, () => [a, dd]) },
        hint: `${k} groups of ${a}/${dd}. Add ${a}/${dd} ${k} times: ${k} ${TIMES} ${a} = ${k * a}, so ${k * a}/${dd}.` });
    } },
    { id: 'g4-dec', name: 'Tenths and hundredths', std: '4.NF.6–7', gen(d, r) {
      if (d === 0) { const n = ri(r, 1, 9);
        return prob({ q: [{ n, d: 10 }, ' = ', '?'], ans: NUM(n / 10), choices: numChoices(r, n / 10, [n / 100, n, (n + 1) / 10]), visual: { t: 'hgrid', n: n * 10 }, decimal: true, hint: `${n} tenths is written 0.${n}.` }); }
      if (d === 1) { const n = ri(r, 11, 99);
        if (r() < 0.5) return prob({ q: [n / 100, ' = ', { n: '?', d: 100 }], ans: NUM(n), choices: numChoices(r, n, [n * 10, Math.floor(n / 10), n + 1], 1), visual: { t: 'hgrid', n }, hint: `0.${n} means ${n} hundredths. So it's ${n}/100.` });
        return prob({ q: [{ n, d: 100 }, ' = ', '?'], ans: NUM(n / 100), choices: numChoices(r, n / 100, [n / 10, n / 1000, (n + 1) / 100]), visual: { t: 'hgrid', n }, decimal: true, hint: `${n} hundredths is written 0.${String(n).padStart(2, '0')}.` }); }
      let x, y; do { x = ri(r, 1, 9) / 10; y = ri(r, 11, 99) / 100; } while (Math.abs(x - y) < 1e-9);
      const pair = shuffle(r, [x, y]), big = Math.max(x, y);
      return prob({ prompt: 'Which is bigger?', q: [pair[0], '  or  ', pair[1]], ans: CH(plain(big)), choices: pair.map((v) => ({ label: [v], ok: v === big, v: plain(v) })), visual: { t: 'hgrid2', a: Math.round(pair[0] * 100), b: Math.round(pair[1] * 100) },
        hint: `Write them both in hundredths: ${plain(x)} = ${Math.round(x * 100)} hundredths, and ${plain(y)} = ${Math.round(y * 100)} hundredths. So ${plain(big)} is bigger.` });
    } },
  ];

  /* ================= GRADE 5 ================= */
  function partial(a, b) {
    const split = (n) => digits(n).map((x, i) => x * 10 ** i).filter((x) => x).reverse();
    const out = []; for (const x of split(a)) for (const y of split(b)) out.push([x, y]); return out;
  }
  const G5 = [
    { id: 'g5-mult', name: 'Multi-digit multiply', std: '5.NBT.5', gen(d, r) {
      const a = d === 0 ? ri(r, 12, 99) : ri(r, 102, 999), b = d === 2 ? ri(r, 102, 999) : ri(r, 12, 99), v = a * b;
      return prob({ q: [a, ' ' + TIMES + ' ', b, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [v + 10 * a, v - b, a * (b + 1)]), visual: d === 0 ? { t: 'partial', a, b } : { t: 'column', a, b, op: '×' },
        hint: d === 0 ? `Break it into parts: ${partial(a, b).map((p) => `${p[0]} ${TIMES} ${p[1]} = ${p[0] * p[1]}`).join(', ')}. Add them: ${v}.` : `Multiply ${fmt(a)} by each digit of ${fmt(b)}: the ones, then the tens${d === 2 ? ', then the hundreds' : ''}. Add the rows to get ${fmt(v)}.` });
    } },
    { id: 'g5-div', name: 'Divide by two digits', std: '5.NBT.6', gen(d, r) {
      const b = ri(r, 11, d === 2 ? 25 : 99), q = d === 0 ? ri(r, 2, 20) : d === 1 ? ri(r, 10, Math.min(99, Math.floor(9999 / b))) : ri(r, 100, Math.floor(9999 / b)), a = b * q;
      return prob({ q: [a, ' ' + DIV + ' ', b, ' = ', '?'], ans: NUM(q), choices: numChoices(r, q, [q + 1, q - 1, q * 10], 1),
        hint: `Estimate first: about how many ${b}s fit in ${fmt(a)}? Check it: ${b} ${TIMES} ${q} = ${fmt(a)}. So it's ${q}.` });
    } },
    { id: 'g5-dec', name: 'Decimals', std: '5.NBT.7', gen(d, r) {
      if (d < 2) {
        const sa = d === 0 ? 10 : pick(r, [10, 100]), sb = d === 0 ? 10 : 100, A = ri(r, 11, 99), B = ri(r, 11, sb === 100 ? 999 : 99);
        const x = A / sa, y = B / sb, add = r() < 0.6 || x <= y, v = fix(add ? x + y : x - y);
        const err = fix(add ? (A + B) / Math.max(sa, sb) : Math.abs(A - B) / Math.max(sa, sb)); // lining up the digits instead of the points
        return prob({ q: [x, add ? ' + ' : ' ' + MINUS + ' ', y, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [err, fix(v + 0.1), fix(v + 1)]), visual: { t: 'column', a: x, b: y, op: add ? '+' : '-' }, decimal: true,
          hint: `Line up the decimal points, then add or subtract like whole numbers. ${plain(x)} ${add ? '+' : MINUS} ${plain(y)} = ${plain(v)}.` });
      }
      if (r() < 0.6) { const x = ri(r, 2, 99) / pick(r, [10, 100]), k = ri(r, 2, 9), v = fix(x * k);
        return prob({ q: [x, ' ' + TIMES + ' ', k, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [fix(v * 10), fix(v / 10), fix(v + x)]), decimal: true,
          hint: `Work out ${Math.round(x * 10 ** dp(x))} ${TIMES} ${k} = ${Math.round(x * 10 ** dp(x)) * k}, then put back ${dp(x)} decimal place${dp(x) > 1 ? 's' : ''}: ${plain(v)}.` }); }
      const k = ri(r, 2, 9), m = ri(r, 2, 30), x = fix(k * m / 10), v = fix(m / 10);
      return prob({ q: [x, ' ' + DIV + ' ', k, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [m, fix(m / 100), fix(v + 0.1)]), decimal: true,
        hint: `Think of ${plain(x)} as ${k * m} tenths. ${k * m} ${DIV} ${k} = ${m} tenths, which is ${plain(v)}.` });
    } },
    { id: 'g5-pow', name: 'Powers of ten', std: '5.NBT.2', gen(d, r) {
      const p = pick(r, [10, 100, 1000]), zeros = String(p).length - 1;
      const x = d === 0 ? ri(r, 2, 99) : fix(ri(r, 11, 999) / pick(r, [10, 100])), mul = d < 2 || r() < 0.4, v = fix(mul ? x * p : x / p);
      return prob({ q: [x, mul ? ' ' + TIMES + ' ' : ' ' + DIV + ' ', p, ' = ', '?'], ans: NUM(v), choices: numChoices(r, v, [fix(mul ? v / 10 : v * 10), fix(mul ? v * 10 : v / 10), fix(mul ? x + p : x)]), decimal: true,
        hint: `${mul ? 'Multiplying' : 'Dividing'} by ${fmt(p)} moves every digit ${zeros} place${zeros > 1 ? 's' : ''} to the ${mul ? 'left (bigger)' : 'right (smaller)'}. ${plain(x)} becomes ${plain(v)}.` });
    } },
    { id: 'g5-unlike', name: 'Unlike denominators', std: '5.NF.1', gen(d, r) {
      let a, b, c, e;
      if (d === 0) { b = pick(r, [2, 3, 4, 5]); e = b * ri(r, 2, 3); }
      else { [b, e] = pick(r, [[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [2, 7], [3, 8], [4, 6], [6, 8]]); }
      if (r() < 0.5) [b, e] = [e, b];
      const sub = d === 2, L = lcm(b, e);
      for (;;) { a = ri(r, 1, b - 1); c = ri(r, 1, e - 1); const s = sub ? a * e - c * b : a * e + c * b; if (sub ? s > 0 : s <= b * e) break; if (sub) [a, b, c, e] = [c, e, a, b]; }
      const A = a * L / b, C = c * L / e, top = sub ? A - C : A + C;
      return prob({ q: [{ n: a, d: b }, sub ? ' ' + MINUS + ' ' : ' + ', { n: c, d: e }, ' = ', '?'], ans: FRAC(top, L), choices: fracChoices(r, top, L, [[sub ? Math.abs(a - c) : a + c, sub ? Math.abs(b - e) || 1 : b + e], [sub ? Math.abs(a - c) : a + c, L]]),
        visual: { t: 'bars', fr: [[a, b], [c, e], [A, L], [C, L]] }, hint: `Use ${L}ths for both. ${a}/${b} = ${A}/${L} and ${c}/${e} = ${C}/${L}. ${sub ? 'Subtract' : 'Add'} the tops: ${top}/${L}.` });
    } },
    { id: 'g5-fracmul', name: 'Multiply and divide fractions', std: '5.NF.4, 5.NF.7', gen(d, r) {
      if (d === 0) { const b = ri(r, 2, 6), e = ri(r, 2, 6), a = ri(r, 1, b - 1), c = ri(r, 1, e - 1);
        return prob({ q: [{ n: a, d: b }, ' ' + TIMES + ' ', { n: c, d: e }, ' = ', '?'], ans: FRAC(a * c, b * e), choices: fracChoices(r, a * c, b * e, [[a + c, b + e], [a * c, b + e]]),
          hint: `Multiply the tops: ${a} ${TIMES} ${c} = ${a * c}. Multiply the bottoms: ${b} ${TIMES} ${e} = ${b * e}. So it's ${a * c}/${b * e}.` }); }
      if (d === 1) { const a = ri(r, 2, 6), k = ri(r, 2, 5);
        return prob({ q: [{ n: 1, d: a }, ' ' + DIV + ' ', k, ' = ', '?'], ans: FRAC(1, a * k), choices: fracChoices(r, 1, a * k, [[k, a], [1, a + k]]), visual: { t: 'bars', fr: [[1, a], [1, a * k]] },
          hint: `Share 1/${a} into ${k} equal parts. Each part is 1/${a * k} of the whole.` }); }
      const a = ri(r, 2, 8), k = ri(r, 2, 9);
      return prob({ q: [k, ' ' + DIV + ' ', { n: 1, d: a }, ' = ', '?'], ans: NUM(k * a), choices: numChoices(r, k * a, [k + a, k, k * a + a], 1), visual: { t: 'bars', fr: Array.from({ length: Math.min(k, 6) }, () => [a, a]) },
        hint: `How many ${ORD[a] ? ORD[a][1] : '1/' + a + 's'} fit in ${k} wholes? Each whole has ${a}, so ${k} ${TIMES} ${a} = ${k * a}.` });
    } },
    { id: 'g5-paren', name: 'Parentheses first', std: '5.OA.1', gen(d, r) {
      let q, v, wrong, inner;
      if (d === 0) { const a = ri(r, 2, 9), b = ri(r, 1, 9), c = ri(r, 2, 6); q = ['(', a, ' + ', b, ')', ' ' + TIMES + ' ', c, ' = ', '?']; inner = `${a} + ${b} = ${a + b}`; v = (a + b) * c; wrong = a + b * c; }
      else if (d === 1) { if (r() < 0.5) { const b = ri(r, 2, 6), c = ri(r, 2, 6), a = ri(r, b * c + 1, b * c + 20); q = [a, ' ' + MINUS + ' ', '(', b, ' ' + TIMES + ' ', c, ')', ' = ', '?']; inner = `${b} ${TIMES} ${c} = ${b * c}`; v = a - b * c; wrong = (a - b) * c; }
        else { const a = ri(r, 2, 8), c = ri(r, 1, 6), b = ri(r, c + 1, c + 8); q = [a, ' ' + TIMES + ' ', '(', b, ' ' + MINUS + ' ', c, ')', ' = ', '?']; inner = `${b} ${MINUS} ${c} = ${b - c}`; v = a * (b - c); wrong = a * b - c; } }
      else { const a = ri(r, 2, 5), b = ri(r, 1, 9), c = ri(r, 2, 4), e = ri(r, 2, 5); q = [a, ' ' + TIMES + ' ', '[', b, ' + ', '(', c, ' ' + TIMES + ' ', e, ')', ']', ' = ', '?']; inner = `${c} ${TIMES} ${e} = ${c * e}, then ${b} + ${c * e} = ${b + c * e}`; v = a * (b + c * e); wrong = (a * b + c) * e; }
      return prob({ q, ans: NUM(v), choices: numChoices(r, v, [wrong, v + 1, v - 2]), hint: `Do the inside part first: ${inner}. Then finish: ${v}.` });
    } },
  ];

  const WORLDS = [
    { id: 'k', short: 'K', grade: 'Kindergarten', name: 'Hatchling Hill', goal: 'Add and subtract within 5', levels: K },
    { id: 'g1', short: '1', grade: 'Grade 1', name: 'Fern Forest', goal: 'Add and subtract within 10', levels: G1 },
    { id: 'g2', short: '2', grade: 'Grade 2', name: 'Tar Pit Trail', goal: 'Facts to 20, and adding to 100', levels: G2 },
    { id: 'g3', short: '3', grade: 'Grade 3', name: 'Pterodactyl Peaks', goal: 'Times tables to 10 × 10', levels: G3 },
    { id: 'g4', short: '4', grade: 'Grade 4', name: 'Long-Neck Lake', goal: 'Big adding and subtracting', levels: G4 },
    { id: 'g5', short: '5', grade: 'Grade 5', name: 'Volcano Ridge', goal: 'Multi-digit multiplying', levels: G5 },
  ];

  /* ---------- typed answers ---------- */
  function answerFields(p) {
    const a = p.ans;
    if (a.k === 'num') return [plain(a.v)];
    if (a.k === 'frac') return [String(a.n), String(a.d)];
    if (a.k === 'rem') return [String(a.q), String(a.r)];
    return [a.v];
  }
  function fieldCount(p) { return p.ans.k === 'frac' || p.ans.k === 'rem' ? 2 : 1; }
  const toNum = (s) => { s = String(s || '').replace(/,/g, '').trim(); if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN; return parseFloat(s); };
  function typedOk(p, f) {
    const a = p.ans;
    if (a.k === 'num') { const v = toNum(f[0]); return Number.isFinite(v) && Math.abs(v - a.v) < 1e-9; }
    if (a.k === 'frac') { const n = toNum(f[0]), d = toNum(f[1]); if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0) return false; return a.exact ? n === a.n && d === a.d : n * a.d === a.n * d; }
    if (a.k === 'rem') return toNum(f[0]) === a.q && toNum(f[1]) === a.r;
    return false;
  }
  // a choice label written as typed fields (used by the checker)
  function labelFields(label) {
    const t = label.filter((x) => typeof x !== 'string' || x.trim());
    if (t.length === 1 && typeof t[0] === 'number') return [plain(t[0])];
    if (t.length === 1 && typeof t[0] === 'object') return [String(t[0].n), String(t[0].d)];
    if (t.length === 3 && t[1].trim() === 'R') return [String(t[0]), String(t[2])];
    return [String(t[0])];
  }

  const api = { WORLDS, fmt, plain, fracSay, sayTokens, answerFields, fieldCount, typedOk, labelFields, rng(seed) { let s = Math.floor(seed) % 2147483647; if (s <= 0) s += 2147483646; return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DinoProblems = api;
})(typeof window !== 'undefined' ? window : globalThis);
