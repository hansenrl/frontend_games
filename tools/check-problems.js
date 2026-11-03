#!/usr/bin/env node
/*
 * Checks every Dino Defenders problem generator.
 *
 *   node tools/check-problems.js
 *
 * For each level and each difficulty it makes a few hundred problems and checks that:
 *   - the answer is right (worked out again here, independently of the generator),
 *   - there is exactly one right choice, the choices are all different, none is negative,
 *   - typing the answer is accepted and typing a wrong choice is not,
 *   - the problem has speech and a hint for Rex.
 */
'use strict';
const path = require('path');
const P = require(path.join(__dirname, '..', 'dino-math', 'problems.js'));

const SAMPLES = 400;
const near = (a, b) => Math.abs(a - b) < 1e-9;

function toExpr(tokens, sub) {
  return tokens.map((t) => {
    if (t === '?') return '(' + sub + ')';
    if (typeof t === 'number') return '(' + t + ')';
    if (typeof t === 'object') return '((' + (t.n === '?' ? sub : t.n) + ')/(' + t.d + '))';
    return t.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\[/g, '(').replace(/\]/g, ')');
  }).join('');
}
const evalExpr = (s) => Function('"use strict";return (' + s + ')')();
const val = (t) => (typeof t === 'object' ? t.n / t.d : t);
const ansValue = (a) => (a.k === 'num' ? String(a.v) : a.k === 'frac' ? a.n + '/' + a.d : null);
const nums = (q) => q.filter((t) => typeof t === 'number' || typeof t === 'object');

// Work the answer out again for problems that aren't a plain "left = right" equation.
function independent(level, p) {
  const q = p.q, a = p.ans;
  switch (level.id) {
    case 'k-count': return a.v === p.visual.n;
    case 'k-more': { const [x, y] = nums(q); const want = /fewer|smaller/.test(p.prompt) ? Math.min(x, y) : Math.max(x, y); return a.v === String(want); }
    case 'g1-tf': { const i = q.indexOf(' = '); const L = evalExpr(toExpr(q.slice(0, i))), R = evalExpr(toExpr(q.slice(i + 1))); return a.v === (near(L, R) ? 'True' : 'False'); }
    case 'g1-compare': case 'g4-equiv': {
      if (a.k !== 'choice') return null;
      const [x, y] = nums(q).map(val); return a.v === (near(x, y) ? '=' : x < y ? '<' : '>');
    }
    case 'g2-oddeven': return a.v === (q[0] % 2 ? 'odd' : 'even');
    case 'g2-coins': return a.v === p.visual.list.reduce((s, c) => s + { q: 25, d: 10, n: 5, p: 1 }[c], 0);
    case 'g3-round': { const n = q[0], place = /hundred/.test(p.prompt) ? 100 : 10; return a.v === Math.floor(n / place + 0.5) * place; }
    case 'g1-tens': case 'g2-mental': { const [m, n] = nums(q); return a.v === (/more/.test(q[1]) ? n + m : n - m); }
    case 'g4-div': if (a.k === 'rem') { const [x, b] = nums(q); return a.q * b + a.r === x && a.r > 0 && a.r < b; } return null;
    case 'g4-factors': {
      if (/prime/.test(p.prompt)) { const n = q[0]; let pr = n >= 2; for (let i = 2; i * i <= n; i++) if (n % i === 0) pr = false; return a.v === (pr ? 'Yes' : 'No'); }
      if (/factor/.test(p.prompt)) { const [k, n] = nums(q); return a.v === (n % k === 0 ? 'Yes' : 'No'); }
      const k = Number(p.prompt.match(/of (\d+)/)[1]); const ok = nums(q).filter((x) => x % k === 0); return ok.length === 1 && a.v === String(ok[0]);
    }
    case 'g3-frac': case 'g4-dec':
      if (a.k === 'choice') { const vs = nums(q).map(val); const big = Math.max(...vs); const okLabel = p.choices.find((c) => c.ok).label[0]; return near(val(okLabel), big); }
      return null;
    default: return null;
  }
}

let failures = 0, total = 0;
const fail = (where, msg, p) => { failures++; if (failures <= 25) console.log(`  ✗ ${where}: ${msg}\n      ${JSON.stringify({ q: p.q, ans: p.ans, choices: p.choices.map((c) => [c.label, c.ok]) })}`); };

for (const world of P.WORLDS) {
  for (const level of world.levels) {
    let checked = 0;
    for (let d = 0; d <= 2; d++) {
      const r = P.rng(1000 + d * 7919 + level.id.length * 31);
      for (let i = 0; i < SAMPLES; i++) {
        const p = level.gen(d, r), where = `${level.id} d${d}`;
        total++;
        if (!Array.isArray(p.q) || !p.q.length) { fail(where, 'no question', p); continue; }
        if (!p.say || !p.hint) fail(where, 'missing speech or hint', p);
        // choices
        if (p.choices.length < 2 || p.choices.length > 3) fail(where, 'needs 2 or 3 choices', p);
        if (p.choices.filter((c) => c.ok).length !== 1) fail(where, 'needs exactly one right choice', p);
        const keys = p.choices.map((c) => JSON.stringify(c.label));
        if (new Set(keys).size !== keys.length) fail(where, 'two choices look the same', p);
        for (const c of p.choices) for (const t of c.label) { if (typeof t === 'number' && t < 0) fail(where, 'negative choice', p); if (typeof t === 'object' && (t.n < 0 || t.d <= 0)) fail(where, 'bad fraction choice', p); }
        // typing
        if (!p.pickOnly) {
          if (!P.typedOk(p, P.answerFields(p))) fail(where, 'typing the answer is not accepted', p);
          for (const c of p.choices) { const ok = P.typedOk(p, P.labelFields(c.label)); if (ok !== c.ok) fail(where, c.ok ? 'right choice is not accepted when typed' : 'a wrong choice is accepted when typed', p); }
        } else if (p.ans.k !== 'choice') fail(where, 'pick-only problem without a choice answer', p);
        else if (!p.choices.some((c) => c.ok && (c.v === p.ans.v || P.labelFields(c.label)[0] === p.ans.v))) fail(where, 'right choice does not match the answer', p);
        // the maths
        const ind = independent(level, p);
        if (ind === false) fail(where, 'answer is wrong', p);
        else if (ind === null) {
          const eq = p.q.indexOf(' = ');
          const sub = ansValue(p.ans);
          if (eq < 0 || sub === null) fail(where, 'no way to check this problem', p);
          else {
            const L = evalExpr(toExpr(p.q.slice(0, eq), sub)), R = evalExpr(toExpr(p.q.slice(eq + 1), sub));
            if (!Number.isFinite(L) || !near(L, R)) fail(where, `answer is wrong (${L} ≠ ${R})`, p);
          }
        }
        checked++;
      }
    }
    console.log(`  ${world.short.padEnd(2)} ${level.id.padEnd(12)} ${level.name.padEnd(30)} ${checked} problems`);
  }
}
console.log(failures ? `\n${failures} problem${failures > 1 ? 's' : ''} failed out of ${total}.` : `\nAll ${total} problems are correct.`);
process.exit(failures ? 1 : 0);
