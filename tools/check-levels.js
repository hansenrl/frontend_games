#!/usr/bin/env node
/*
 * Checks that every Choo-Choo Junction level can be solved, and reports how
 * many different ways there are to solve it.
 *
 *   node tools/check-levels.js
 *
 * It follows the train from the start. Each time the train reaches an empty
 * "?" spot it tries every piece (and every way of turning it) from the tray.
 */
'use strict';
const path = require('path');
const E = require(path.join(__dirname, '..', 'train-junction', 'engine.js'));
const LEVELS = require(path.join(__dirname, '..', 'train-junction', 'levels.js'));

const fmt = (p) => `${p.id}@${'NESW'[p.rot] || p.rot}`;

function solve(level) {
  const board = E.parseLevel(level);
  const options = E.pieceOptions(level.pieces);
  const solutions = [];
  const outcomes = {};
  let explored = 0;

  function explore(placements) {
    explored++;
    const end = E.simulate(board, placements);
    const cell = E.cellAt(board, end.x, end.y);
    if (end.type === 'crash' && end.reason === 'gap' && cell && cell.kind === 'slot' && !placements[cell.slot]) {
      for (const opt of options) {
        const next = placements.slice();
        next[cell.slot] = opt;
        explore(next);
      }
      return;
    }
    const key = end.type === 'crash' ? end.reason : end.type;
    outcomes[key] = (outcomes[key] || 0) + 1;
    if (end.type === 'win') solutions.push(placements.slice());
  }
  explore(new Array(board.slots.length).fill(null));
  return { board, solutions, outcomes, explored };
}

let failed = false;
LEVELS.forEach((level, i) => {
  let res;
  try {
    res = solve(level);
  } catch (err) {
    console.log(`✗ ${i + 1}. ${level.name}: ${err.message}`);
    failed = true;
    return;
  }
  const { board, solutions, outcomes } = res;
  const widths = level.map.map((r) => Array.from(r).length);
  if (new Set(widths).size !== 1) {
    console.log(`✗ ${i + 1}. ${level.name}: rows have different widths ${widths.join(',')}`);
    failed = true;
  }
  const mark = solutions.length ? '✓' : '✗';
  if (!solutions.length) failed = true;
  const outs = Object.entries(outcomes).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${mark} ${i + 1}. ${level.name} — ${board.w}x${board.h}, ${board.slots.length} spot(s), ${solutions.length} solution(s)  [${outs}]`);
  for (const sol of solutions.slice(0, 4)) {
    console.log('     ' + sol.map((p, j) => `#${j + 1}=${p ? fmt(p) : 'any'}`).join('  '));
  }
});

if (failed) {
  console.error('\nSome levels have problems.');
  process.exit(1);
}
