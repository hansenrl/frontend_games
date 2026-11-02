/*
 * Choo-Choo Junction — game rules (no DOM).
 * Shared by the browser game and tools/check-levels.js.
 *
 * Coordinates are in "tile units": tile (x, y) spans x..x+1, y..y+1.
 * Directions: 0 = North (up), 1 = East, 2 = South, 3 = West.
 */
(function (root) {
  'use strict';

  const N = 0, E = 1, S = 2, W = 3;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const opp = (d) => (d + 2) % 4;

  // Fixed track pieces drawn in the level maps.
  const TRACK_CHARS = {
    '-': [E, W],
    '|': [N, S],
    '└': [N, E],
    '┌': [E, S],
    '┐': [S, W],
    '┘': [N, W],
    '+': 'cross',
  };
  const START_CHARS = { '^': N, '>': E, 'v': S, '<': W };
  // Scenery the train bonks into (and bridges can't pass over).
  const TALL = new Set(['T', 'R', 'h', 'M']);

  // Pieces the player can put on a "?" spot.
  const PIECES = {
    straight: { id: 'straight', name: 'Straight', rotations: 2 },
    curve: { id: 'curve', name: 'Curve', rotations: 4 },
    cross: { id: 'cross', name: 'Crossing', rotations: 1 },
    bridge1: { id: 'bridge1', name: 'Small Bridge', rotations: 4, directional: true, span: 1 },
    bridge2: { id: 'bridge2', name: 'Big Bridge', rotations: 4, directional: true, span: 2 },
    tunnel: { id: 'tunnel', name: 'Tunnel', rotations: 4, directional: true },
    jump: { id: 'jump', name: 'Jump Ramp', rotations: 4, directional: true, span: 3 },
  };
  const PIECE_ORDER = ['straight', 'curve', 'cross', 'bridge1', 'bridge2', 'tunnel', 'jump'];

  function pieceConns(id, rot) {
    if (id === 'straight') return rot % 2 === 0 ? [N, S] : [E, W];
    if (id === 'curve') return [[N, E], [E, S], [S, W], [W, N]][rot % 4];
    if (id === 'cross') return 'cross';
    return null; // directional piece
  }

  // ---------------------------------------------------------------- parsing
  function parseLevel(level) {
    const rows = level.map.map((r) => Array.from(r));
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const cells = [];
    const slots = [];
    let start = null;
    let station = null;
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x] || '.';
        const cell = { x, y, ch, terrain: '.', kind: null, conns: null };
        if (TRACK_CHARS[ch]) {
          cell.kind = 'track';
          cell.conns = TRACK_CHARS[ch];
        } else if (START_CHARS[ch] !== undefined) {
          const d = START_CHARS[ch];
          cell.kind = 'track';
          cell.conns = [opp(d), d];
          start = { x, y, dir: d };
        } else if (ch === '?') {
          cell.kind = 'slot';
          cell.slot = slots.length;
          slots.push({ x, y });
        } else if (ch === '@') {
          cell.kind = 'station';
          station = { x, y };
        } else {
          cell.terrain = ch;
        }
        row.push(cell);
      }
      cells.push(row);
    }
    if (!start) throw new Error(`Level "${level.name}" has no start`);
    if (!station) throw new Error(`Level "${level.name}" has no station`);
    const board = { w, h, cells, slots, start, station, pickups: [] };
    for (const [px, py] of level.pickups || []) {
      const c = cellAt(board, px, py);
      if (!c || c.kind !== 'track') throw new Error(`Level "${level.name}": pickup at ${px},${py} is not on fixed track`);
      c.pickup = board.pickups.length;
      board.pickups.push({ x: px, y: py });
    }
    station.dirs = [N, E, S, W].filter((d) => connectsToward(board, station.x + DX[d], station.y + DY[d], opp(d)));
    return board;
  }

  function inBounds(board, x, y) {
    return x >= 0 && y >= 0 && x < board.w && y < board.h;
  }
  function cellAt(board, x, y) {
    return inBounds(board, x, y) ? board.cells[y][x] : null;
  }
  // Does the cell at x,y have track that opens on side `side`? (slots count as maybe)
  function connectsToward(board, x, y, side) {
    const c = cellAt(board, x, y);
    if (!c) return false;
    if (c.kind === 'slot') return true;
    if (c.kind !== 'track') return false;
    return c.conns === 'cross' || c.conns.includes(side);
  }
  function isTall(board, x, y) {
    const c = cellAt(board, x, y);
    return !!c && !c.kind && TALL.has(c.terrain);
  }
  function isMountain(board, x, y) {
    const c = cellAt(board, x, y);
    return !!c && !c.kind && c.terrain === 'M';
  }

  // How far a directional piece reaches: tiles it covers after the slot itself.
  function pieceReach(board, slot, piece) {
    const def = PIECES[piece.id];
    if (!def.directional) return 0;
    if (piece.id === 'tunnel') {
      let n = 0;
      while (isMountain(board, slot.x + DX[piece.rot] * (n + 1), slot.y + DY[piece.rot] * (n + 1))) n++;
      return n;
    }
    return def.span;
  }

  // ------------------------------------------------------------- geometry
  function edgePt(x, y, side) {
    return [x + 0.5 + 0.5 * DX[side], y + 0.5 + 0.5 * DY[side]];
  }
  function lineSeg(x0, y0, x1, y1, lift) {
    return { kind: 'line', x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0), lift: lift || null };
  }
  function arcSeg(x, y, a, b) {
    const cx = x + 0.5 + 0.5 * (DX[a] + DX[b]);
    const cy = y + 0.5 + 0.5 * (DY[a] + DY[b]);
    const [sx, sy] = edgePt(x, y, a);
    const [ex, ey] = edgePt(x, y, b);
    const a0 = Math.atan2(sy - cy, sx - cx);
    let da = Math.atan2(ey - cy, ex - cx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    return { kind: 'arc', cx, cy, r: 0.5, a0, da, len: (Math.PI / 4), lift: null };
  }

  // Position on a segment, l = distance from its start.
  function evalSeg(seg, l) {
    const len = seg.len || 1e-6;
    const u = Math.max(0, Math.min(1, l / len));
    if (seg.kind === 'line') {
      const x = seg.x0 + (seg.x1 - seg.x0) * u;
      const y = seg.y0 + (seg.y1 - seg.y0) * u;
      const ang = Math.atan2(seg.y1 - seg.y0, seg.x1 - seg.x0);
      let elev = 0;
      if (seg.lift === 'bridge') elev = 0.16 * Math.min(1, l / 0.5, (len - l) / 0.5);
      else if (seg.lift === 'bridgeCut') elev = 0.16 * Math.min(1, l / 0.5);
      else if (seg.lift === 'jump') elev = 0.2 * len * Math.sin(Math.PI * u);
      return { x, y, ang, elev, lift: seg.lift };
    }
    const t = seg.a0 + seg.da * u;
    return {
      x: seg.cx + seg.r * Math.cos(t),
      y: seg.cy + seg.r * Math.sin(t),
      ang: t + Math.sign(seg.da) * Math.PI / 2,
      elev: 0,
      lift: null,
    };
  }

  // ------------------------------------------------------------- movement
  /*
   * The train is about to enter tile (cur.x, cur.y) travelling in cur.dir.
   * Returns { seg, cell, next } to keep going, or { seg, cell, end } when the
   * trip ends: end.type is 'win' or 'crash' (with end.reason).
   */
  function step(board, placements, cur) {
    const { x, y, dir: d } = cur;
    const a = opp(d);
    const [ex, ey] = edgePt(x, y, a);
    const runIn = (dist, reason, cx, cy, lift) => ({
      seg: lineSeg(ex, ey, ex + DX[d] * dist, ey + DY[d] * dist, lift),
      end: { type: 'crash', reason, x: cx === undefined ? x : cx, y: cy === undefined ? y : cy },
    });

    const c = cellAt(board, x, y);
    if (!c) return runIn(0.5, 'edge');
    if (c.kind === 'station') {
      return { seg: lineSeg(ex, ey, x + 0.5, y + 0.5), cell: c, end: { type: 'station', x, y } };
    }
    if (!c.kind) {
      const t = c.terrain;
      if (t === '~') return runIn(0.55, 'splash');
      if (t === 's') return runIn(0.18, 'baa');
      if (TALL.has(t)) return runIn(0.12, 'bonk');
      return runIn(0.45, 'derail');
    }

    let conns;
    let piece = null;
    if (c.kind === 'track') conns = c.conns;
    else {
      piece = placements[c.slot];
      if (!piece) return runIn(0.45, 'gap');
      conns = pieceConns(piece.id, piece.rot);
    }

    if (conns) {
      let b;
      if (conns === 'cross') b = d;
      else if (conns[0] === a) b = conns[1];
      else if (conns[1] === a) b = conns[0];
      else return runIn(0.4, 'derail');
      const seg = b === d ? lineSeg(ex, ey, ...edgePt(x, y, b)) : arcSeg(x, y, a, b);
      return { seg, cell: c, next: { x: x + DX[b], y: y + DY[b], dir: b } };
    }

    // Directional pieces (bridges, tunnel, jump) only work pointing the way the train goes.
    if (piece.rot !== d) return runIn(0.4, 'derail');
    const reach = pieceReach(board, c, piece);
    const far = (k) => [x + DX[d] * k, y + DY[d] * k];

    if (piece.id === 'bridge1' || piece.id === 'bridge2') {
      for (let k = 1; k <= reach; k++) {
        const [tx, ty] = far(k);
        if (!inBounds(board, tx, ty)) {
          const [bx, by] = edgePt(tx, ty, a);
          return { seg: lineSeg(ex, ey, bx + DX[d] * 0.4, by + DY[d] * 0.4, 'bridgeCut'), end: { type: 'crash', reason: 'edge', x: tx, y: ty } };
        }
        if (isTall(board, tx, ty)) {
          const [bx, by] = edgePt(tx, ty, a);
          return { seg: lineSeg(ex, ey, bx + DX[d] * 0.1, by + DY[d] * 0.1, 'bridgeCut'), end: { type: 'crash', reason: 'bonk', x: tx, y: ty } };
        }
      }
    }
    const [lx, ly] = far(reach);
    const lift = piece.id === 'jump' ? 'jump' : piece.id === 'tunnel' ? 'tunnel' : 'bridge';
    const seg = lineSeg(ex, ey, ...edgePt(lx, ly, d), lift);
    const [nx, ny] = far(reach + 1);
    return { seg, cell: c, next: { x: nx, y: ny, dir: d } };
  }

  /*
   * A Trip lazily walks the track and turns it into one long path the
   * train can follow. Used by the game for animation and by simulate().
   */
  class Trip {
    constructor(board, placements) {
      this.board = board;
      this.placements = placements;
      this.segs = []; // {seg, start}
      this.length = 0;
      this.cursor = { ...board.start };
      this.end = null; // {type, reason, x, y, at}
      this.events = []; // pickups: {at, pickup}
      this.picked = new Set();
      this.seen = new Map();
    }
    extendTo(dist) {
      while (!this.end && this.length < dist) this.advance();
    }
    advance() {
      if (this.end) return;
      const cur = this.cursor;
      const key = `${cur.x},${cur.y},${cur.dir}`;
      const count = (this.seen.get(key) || 0) + 1;
      this.seen.set(key, count);
      if (count > 2) {
        // Going round and round forever.
        this.end = { type: 'crash', reason: 'dizzy', x: cur.x, y: cur.y, at: this.length };
        return;
      }
      const r = step(this.board, this.placements, cur);
      const start = this.length;
      this.segs.push({ seg: r.seg, start });
      this.length += r.seg.len;
      if (r.cell && r.cell.pickup !== undefined && !this.picked.has(r.cell.pickup)) {
        this.picked.add(r.cell.pickup);
        this.events.push({ at: start + r.seg.len * 0.5, pickup: r.cell.pickup });
      }
      if (r.end) {
        const end = { ...r.end, at: this.length };
        if (end.type === 'station') {
          const missing = this.board.pickups.map((_, i) => i).filter((i) => !this.picked.has(i));
          if (missing.length) {
            end.type = 'missed';
            end.missing = missing;
          } else end.type = 'win';
        }
        this.end = end;
      } else {
        this.cursor = r.next;
      }
    }
    pointAt(s) {
      this.extendTo(s);
      const segs = this.segs;
      if (!segs.length) return null;
      let lo = 0, hi = segs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segs[mid].start <= s) lo = mid; else hi = mid - 1;
      }
      const { seg, start } = segs[lo];
      return evalSeg(seg, s - start);
    }
  }

  // Run the whole trip at once. Returns the end record.
  function simulate(board, placements) {
    const trip = new Trip(board, placements);
    let guard = 0;
    while (!trip.end && guard++ < 5000) trip.advance();
    return trip.end || { type: 'crash', reason: 'dizzy' };
  }

  // All the ways a piece can be put on a spot, for a given palette.
  function pieceOptions(palette) {
    const out = [];
    for (const id of palette) {
      for (let rot = 0; rot < PIECES[id].rotations; rot++) out.push({ id, rot });
    }
    return out;
  }

  const api = {
    N, E, S, W, DX, DY, opp, PIECES, PIECE_ORDER, TALL,
    parseLevel, cellAt, inBounds, connectsToward, pieceConns, pieceReach, isMountain,
    edgePt, lineSeg, arcSeg, evalSeg, step, Trip, simulate, pieceOptions,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrainEngine = api;
})(typeof self !== 'undefined' ? self : this);
