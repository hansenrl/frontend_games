#!/usr/bin/env node
/*
 * Checks The Runaway Egg story (dino-adventure/story.js).
 *
 *   node tools/check-story.js
 *
 * It plays every possible path through the story, trying every choice on every
 * page, and checks that:
 *   - every page a choice points to exists, and every page has art,
 *   - every path ends at an ending, and is 7-20 pages long,
 *   - every page, choice and ending can be reached,
 *   - no {placeholder} is left in the text,
 *   - lines stay short enough for an early reader.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require(path.join(__dirname, '..', 'dino-adventure', 'story.js'));

const MAX_WORDS = 12; // words per line
const MIN_PAGES = 7;
const MAX_PAGES = 20;

const errors = [];
const err = (m) => { if (!errors.includes(m)) errors.push(m); };

const artSrc = fs.readFileSync(path.join(__dirname, '..', 'dino-adventure', 'scenes.js'), 'utf8');
const artKeys = new Set([...artSrc.matchAll(/^ {2}(\w+): ?\{/gm)].map((m) => m[1]));

for (const [id, sc] of Object.entries(S.SCENES)) {
  if (!artKeys.has(sc.art)) err(`${id}: no art called "${sc.art}" in scenes.js`);
  if (!sc.end && !sc.choices && !sc.next) err(`${id}: no choices and no next page`);
}

const seenScenes = new Set();
const seenChoices = new Set();
const endings = {};
let paths = 0;
let shortest = Infinity;
let longest = 0;

function checkLines(where, lines) {
  for (const l of lines) {
    if (/[{}]/.test(l)) err(`${where}: placeholder left in "${l}"`);
    const words = l.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) err(`${where}: ${words} words is long for an early reader: "${l}"`);
  }
}

function walk(s, depth) {
  const id = s.scene;
  const sc = S.SCENES[id];
  if (!sc) { err(`page "${id}" does not exist`); return; }
  seenScenes.add(id);
  checkLines(id, S.textFor(s));
  if (depth > 40) { err(`${id}: story loops forever`); return; }

  if (sc.end) {
    paths++;
    endings[id] = (endings[id] || 0) + 1;
    shortest = Math.min(shortest, s.pages);
    longest = Math.max(longest, s.pages);
    if (s.pages < MIN_PAGES || s.pages > MAX_PAGES) err(`a path to ${id} is ${s.pages} pages long`);
    return;
  }

  const choices = S.choicesFor(s);
  if (sc.choices && !choices.length) err(`${id}: no choices available`);
  if (choices.length > 4) err(`${id}: ${choices.length} choices is too many`);
  const list = sc.choices ? choices : [null];
  for (const c of list) {
    const n = JSON.parse(JSON.stringify(s));
    if (c) {
      seenChoices.add(`${id}:${sc.choices.indexOf(c)}`);
      const label = S.labelFor(c, n);
      checkLines(`${id} choice`, [label]);
      S.applyChoice(n, c);
      const r = S.reactFor(c, n);
      if (r) checkLines(`${id} "${label}"`, r);
    }
    const next = S.nextFor(c, n);
    if (!next) { err(`${id}: a choice has no next page`); continue; }
    walk(S.goTo(n, next), depth + 1);
  }
}

walk(S.newState(), 0);

for (const id of Object.keys(S.SCENES)) if (!seenScenes.has(id)) err(`page "${id}" can never be reached`);
for (const [id, sc] of Object.entries(S.SCENES)) {
  (sc.choices || []).forEach((c, i) => {
    if (!seenChoices.has(`${id}:${i}`)) err(`${id}: choice "${typeof c.say === 'string' ? c.say : i}" never shows up`);
  });
}
for (const e of S.ENDINGS) if (!endings[e.id]) err(`ending ${e.id} can never be reached`);

console.log(`The Runaway Egg: ${paths} different ways through, ${shortest}-${longest} pages each.`);
for (const e of S.ENDINGS) console.log(`  ${e.title.padEnd(16)} ${String(endings[e.id] || 0).padStart(6)} paths`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('All good.');
