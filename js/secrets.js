// Lanternfall: secret exits. Two levels in each world (but the last) hide a second door (?),
// and so does one tower in every four worlds (in its climb or along its battlements, never
// in the boss's arena); leaving by it fires you out of a secret cannon to a faraway world: two worlds on
// (or the last one). lv.secretTo is the index of that world's first level, lv.secretWorld the
// world's index. Load after worlds.js, so the worlds and level indexes are final.
//
// The door's at the end of a trick built into the level (see trickRoom): one you need a fruit's
// power for, the fruit growing at its foot. Failing room for one, at the top of a climb (see challengeRoom): a stair of floating
// blocks, stone or crumbling or ice or blinking, somewhere out of the way, in plain sight;
// failing room for one, in the hardest spot to get to, out of the way and high up. (Leaving by it gets you only its cannon on the map: see ui.js.)
(() => {
  const LF = window.LF, L = LF.LEVELS, WORLDS = LF.WORLDS;
  const floor = c => c === '#' || c === '=';

  // Doors, passages, the start and lanterns: places everyone passes, so no secret goes
  // within NEAR tiles of one.
  const NEAR = 8;
  const landmarks = g => { const out = []; g.forEach((row, y) => row.forEach((c, x) => { if ('PDjnL'.includes(c)) out.push({ x, y, c }); })); return out; };
  // ...and never within FAR_START tiles of the start, where everyone pokes about first.
  const FAR_START = 16;
  const nearAny = (marks, x, y) => marks.some(m => Math.hypot(m.x - x, m.y - y) < (m.c === 'P' ? FAR_START : NEAR));

  // A climb up to a secret door: from a spot on the ground (somewhere out of the way, with clear
  // air above and to one side), a stair of single blocks floating up into the air, each three
  // across and two up from the last (as far as you can jump), STEPS of them, then a ledge
  // three wide with the door on it. The blocks are stone, or crumbling, or ice, or blinking, by
  // the level (kind). Kept only if the level can still be finished just as before and the
  // door can be reached. True if one fitted.
  const STEPS = 4, CLIMB_KINDS = ['#', 'C', 'i', 'T'];
  function challengeRoom(lv, kind, xMax = Infinity, minUp = -Infinity) {
    const g0 = LF.normalize(lv.map).map(row => row.split('')), h = g0.length, w = g0[0].length;
    const a0 = LF.analyze(lv), seen = a0.seen, P = find(g0, 'P'), D = find(g0, 'D') || lastDoor(g0), marks = landmarks(g0);
    if (!a0.ok || !P || !D) return false;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? g0[y][x] : '#');
    const lava = (x, y) => (lv.flows || lv.map.flows || []).some(f => x >= f.x0 - 3 && x <= f.x1 + 3 && y >= Math.min(f.hi ?? f.lo, f.lo - (f.amp || 0)) - 6) || g0.slice(Math.max(0, y - 2), y + 3).some(r => r.slice(Math.max(0, x - 4), x + 5).includes('!'));
    const spots = [];
    for (let y = 2 * STEPS + 5; y < h - 1; y++) for (let x = 2; x < w - 2; x++) {
      if (!seen[y * w + x] || at(x, y) !== '.' || !floor(at(x, y + 1)) || nearAny(marks, x, y) || lava(x, y) || P.y - y < minUp) continue;
      for (const d of [1, -1]) {
        // (The space it takes: clear air from the spot out to the ledge's far end, from just
        // over the ground up to two rows over the door.)
        const x1 = x + d * (3 * STEPS + 4), top = y - 2 * STEPS - 4;
        if (Math.max(x, x1) + 2 >= Math.min(w - 1, xMax) || Math.min(x, x1) < 1 || top < 1) continue;
        let clear = true;
        for (let yy = top; yy <= y - 1 && clear; yy++) for (let xx = Math.min(x, x1) - 1; xx <= Math.max(x, x1) + 1; xx++) if (at(xx, yy) !== '.') { clear = false; break; }
        if (!clear) continue;
        spots.push({ x, y, d, score: Math.hypot(x - P.x, y - P.y) + Math.hypot(x - D.x, y - D.y) + ((x * 7 + y * 13) % 11) });
      }
    }
    spots.sort((a, b) => b.score - a.score);
    for (const { x, y, d } of spots.slice(0, 30)) {
      const g = g0.map(row => row.slice());
      let bx = x, by = y + 1;
      for (let k = 0; k < STEPS; k++) {
        bx += d * (k ? 3 : 2); by -= 2;
        g[by][bx] = kind === 'T' ? (k % 2 ? 'H' : 'T') : kind;
      }
      // The ledge: three blocks of stone, the door on the middle one.
      const lx = bx + d * 3, ly = by - 2;
      for (const k of [-1, 0, 1]) g[ly][lx + k] = '#';
      g[ly - 1][lx] = '?';
      const tryLv = { ...lv, map: g.map(r => r.join('')) }, a = LF.analyze(tryLv);
      if (!a.ok || a.litOk !== a0.litOk || !a.seen[(ly - 1) * w + lx]) continue;
      lv.map = tryLv.map;
      return true;
    }
    return false;
  }

  // A trick to the secret door, built into some out-of-the-way open ground of the level: one
  // you need a fruit's power for, the fruit growing right at its foot, so you see what it
  // asks of you. (Each is measured against the player's jumps: out of reach without the power,
  // in reach with it.)
  //   grip (🍓 strawberry): a tall chimney of ice to wall-climb (ice walls won't hold you without
  //     its grip), the door on its top.
  //   glide (🍐 pear): steps up to a perch, then a gap far too long to jump; glide across.
  //   dbl (🍌 banana): a ledge five rows up, a double jump's height.
  //   boost (🍊 orange): a ledge four rows up, a boosted jump's height.
  //   fast (🍉 watermelon): steps to a run-up, then a gap only a running leap at speed clears.
  // Each builds into g (rows of tiles) from the spot (x, y: open ground) going d (±1), and
  // gives back the cells it needs clear (a box) and the door.
  const TRICKS = {
    grip: { fruit: 's', w: 9, h: 8, ground: [0, 2, 6], margin: 4, build(g, x, y, d) {
      // The chimney's walls (three tiles apart), six rows tall, of ice: too slippery to wall-jump
      // up without the strawberry's grip.
      const n = x + d * 2, f = x + d * 6;
      for (let yy = y - 6; yy <= y; yy++) { if (yy < y - 1) g[yy][n] = 'i'; if (yy > y - 6) g[yy][f] = 'i'; }
      for (const k of [0, 1, 2]) g[y - 6][f + d * k] = '#';
      g[y - 7][f + d] = '?'; return { x: f + d, y: y - 7 };
    } },
    glide: { fruit: 'p', w: 23, h: 9, ground: [0, 1, 2], build(g, x, y, d) {
      let bx = x, by = y + 1;
      for (let k = 0; k < 3; k++) { bx += d * (k ? 3 : 2); by -= 2; g[by][bx] = '#'; }
      for (const k of [1, 2, 3]) g[by][bx + d * k] = '#';   // the perch, six rows up
      const lx = bx + d * 14, ly = y - 4;   // the far ledge: ten tiles on from the perch, four rows up (out of a ground jump's reach)
      for (const k of [-1, 0, 1]) g[ly][lx + k] = '#';
      g[ly - 1][lx] = '?'; return { x: lx, y: ly - 1 };
    } },
    dbl: { fruit: 'b', w: 7, h: 8, ground: [0, 1, 2, 3, 4], build(g, x, y, d) {
      const lx = x + d * 4, ly = y - 5;
      for (const k of [-1, 0, 1]) g[ly][lx + k] = '#';
      g[ly - 1][lx] = '?'; return { x: lx, y: ly - 1 };
    } },
    boost: { fruit: 'o', w: 7, h: 7, ground: [0, 1, 2, 3, 4], build(g, x, y, d) {
      const lx = x + d * 4, ly = y - 4;
      for (const k of [-1, 0, 1]) g[ly][lx + k] = '#';
      g[ly - 1][lx] = '?'; return { x: lx, y: ly - 1 };
    } },
    fast: { fruit: 'm', w: 25, h: 8, ground: [0, 1, 2], build(g, x, y, d) {
      let bx = x, by = y + 1;
      for (let k = 0; k < 3; k++) { bx += d * (k ? 3 : 2); by -= 2; g[by][bx] = '#'; }
      for (const k of [1, 2, 3, 4]) g[by][bx + d * k] = '#';   // the run-up, six rows up
      const lx = bx + d * 13, ly = by;   // seven tiles of gap, the same height (a running jump, jumping late off the edge, clears about six; at a watermelon's speed, nearly eight)
      for (const k of [-1, 0, 1]) g[ly][lx + k] = '#';
      g[ly - 1][lx] = '?'; return { x: lx, y: ly - 1 };
    } },
  };
  const TRICK_ORDER = ['grip', 'glide', 'dbl', 'boost', 'fast'];
  LF.secretKit = { trickRoom: (...a) => trickRoom(...a), TRICK_ORDER };   // (for testing)
  function trickRoom(lv, name) {
    const t = TRICKS[name], g0 = LF.normalize(lv.map).map(row => row.split('')), h = g0.length, w = g0[0].length;
    const a0 = LF.analyze(lv), seen = a0.seen, P = find(g0, 'P'), D = find(g0, 'D') || lastDoor(g0), marks = landmarks(g0);
    if (!a0.ok || !P || !D) return false;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? g0[y][x] : '#');
    const lava = (x, y) => (lv.flows || lv.map.flows || []).some(f => x >= f.x0 - 3 && x <= f.x1 + 3 && y >= Math.min(f.hi ?? f.lo, f.lo - (f.amp || 0)) - 6) || g0.slice(Math.max(0, y - 2), y + 3).some(r => r.slice(Math.max(0, x - 4), x + 5).includes('!'));
    const spots = [];
    for (let y = t.h + 1; y < h - 1; y++) for (let x = 2; x < w - 2; x++) {
      if (!seen[y * w + x] || at(x, y) !== '.' || !floor(at(x, y + 1)) || nearAny(marks, x, y) || lava(x, y)) continue;
      for (const d of [1, -1]) {
        // (Clear air over the whole of it, a tile round, and solid ground under its width, so
        // the steps and ledges stand out over the level's floor.)
        const x1 = x + d * t.w;
        if (Math.min(x, x1) < 1 + (t.margin || 1) || Math.max(x, x1) > w - 2 - (t.margin || 1)) continue;
        // (Clear: nothing solid or harmful in the way, whatever else is about; ground under where
        // you start, take off from and land, and under the chimney's walls.)
        const free = c => !LF.isSolid(c) && !'!^~=CTHdð|MV?DjnPL'.includes(c);
        let clear = true;
        // (Some want a wider berth, so no wall nearby helps you up: t.margin.)
        const mg = t.margin || 1;
        for (let yy = y - t.h; yy <= y && clear; yy++) for (let xx = Math.min(x, x1) - mg; xx <= Math.max(x, x1) + mg; xx++) if (!free(at(xx, yy))) { clear = false; break; }
        for (const k of t.ground || [0]) if (clear && !floor(at(x + d * k, y + 1))) clear = false;
        if (clear) spots.push({ x, y, d, score: Math.hypot(x - P.x, y - P.y) + Math.hypot(x - D.x, y - D.y) + ((x * 7 + y * 13) % 11) });
      }
    }
    spots.sort((a, b) => b.score - a.score);
    for (const { x, y, d } of spots.slice(0, 30)) {
      const g = g0.map(row => row.slice());
      t.build(g, x, y, d);
      g[y][x] = t.fruit;   // the fruit it needs, at its foot
      const tryLv = { ...lv, map: g.map(r => r.join('')) }, a = LF.analyze(tryLv);
      if (!a.ok || a.litOk !== a0.litOk) continue;
      lv.map = tryLv.map; lv.secretTrick = name;
      return true;
    }
    return false;
  }

  // Hide a secret door in level lv (left of column xMax and, for a tower, at least minUp rows
  // above the start): in the hardest spot to get to, as far from the start and the door as it
  // can be and high up. Out of moving lava's reach and away from lava. True if it found a spot.
  function hardSpot(lv, xMax = Infinity, minUp = -Infinity) {
    const g = LF.normalize(lv.map).map(row => row.split('')), h = g.length, w = g[0].length;
    const seen = LF.analyze(lv).seen, P = find(g, 'P'), D = find(g, 'D') || lastDoor(g), marks = landmarks(g);
    if (!P || !D) return false;
    const lava = (x, y) => (lv.flows || lv.map.flows || []).some(f => x >= f.x0 - 2 && x <= f.x1 + 2 && y >= Math.min(f.hi ?? f.lo, f.lo - (f.amp || 0)) - 4) || g.slice(Math.max(0, y - 2), y + 3).some(r => r.slice(Math.max(0, x - 4), x + 5).includes('!'));
    let best = null;
    for (let y = 2; y < h - 1; y++) for (let x = 2; x < w - 2; x++) {
      if (!seen[y * w + x] || g[y][x] !== '.' || g[y - 1][x] !== '.' || !floor(g[y + 1][x])) continue;
      if (x + 3 >= xMax || P.y - y < minUp || nearAny(marks, x, y) || lava(x, y)) continue;
      if (![-1, 1].every(d => g[y][x + d] === '.' && g[y - 1][x + d] === '.')) continue;
      const fromDoor = Math.hypot(x - D.x, y - D.y), fromStart = Math.hypot(x - P.x, y - P.y);
      if (fromDoor < 10 || fromStart < 10) continue;
      const score = fromDoor + fromStart * .6 + (h - y) * 1.5;
      if (!best || score > best.score) best = { x, y, score };
    }
    if (!best) return false;
    g[best.y][best.x] = '?';
    lv.map = g.map(row => row.join(''));
    return true;
  }
  // A tower has no door: measure from its last passage door (the one into the boss's arena).
  function lastDoor(g) { let best = null; g.forEach((row, y) => row.forEach((c, x) => { if (c === 'j' && (!best || x > best.x)) best = { x, y }; })); return best; }
  function find(g, c) { for (let y = 0; y < g.length; y++) { const x = g[y].indexOf(c); if (x >= 0) return { x, y }; } return null; }

  // (Not in the last world, Night's End, or the Star Road after it, which is reached only
  // past the Last Dark; and no secret cannon goes further than Night's End.)
  const LAST = WORLDS.findIndex(w => w.name === 'The Star Road') - 1;
  WORLDS.forEach((world, k) => {
    if (k >= LAST) return;
    const to = Math.min(k + 2, LAST);
    const regular = L.map((lv, i) => i).filter(i => L[i].world === k && !L[i].boss && !L[i].ride && !L[i].secretTo);
    // Aim for a third and two thirds of the way through the world, taking the nearest level
    // after that with room for a climb to the door (or, failing that, the aimed-for level, the
    // door in its hardest spot).
    for (const at of [Math.floor(regular.length / 3), Math.floor(regular.length * 2 / 3)]) {
      let placed = false;
      // (The first in each world a wall-climb, the strawberry's, wherever there's room for one.)
      if (at === Math.floor(regular.length / 3))
        for (let n = at; n < regular.length && !placed; n++) {
          const lv = L[regular[n]];
          if (lv.secretTo == null && trickRoom(lv, 'grip')) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; placed = true; }
        }
      for (let n = at; n < regular.length && !placed; n++) {
        const lv = L[regular[n]];
        // (The tricks in turn, from this level's: the first that fits.)
        for (let q = 0; q < TRICK_ORDER.length && !placed; q++)
          if (lv.secretTo == null && trickRoom(lv, TRICK_ORDER[(k * 2 + n + q) % TRICK_ORDER.length])) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; placed = true; }
      }
      // (No room for a trick: a climb to the door, as before.)
      for (let n = at; n < regular.length && !placed; n++) {
        const lv = L[regular[n]];
        if (lv.secretTo == null && challengeRoom(lv, CLIMB_KINDS[(k + n) % CLIMB_KINDS.length])) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; placed = true; }
      }
      for (let n = at; n < regular.length && !placed; n++) {
        const lv = L[regular[n]];
        if (lv.secretTo == null && hardSpot(lv)) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; placed = true; }
      }
    }
    // And one tower in every four worlds (the second world of each four, from its middle
    // tower on), if two worlds on is still somewhere new.
    if (to > k && k % 4 === 1) {
      const towers = L.filter(l => l.world === k && l.boss && !l.finalFight);
      for (const lv of [...towers.slice(towers.length >> 1), ...towers.slice(0, towers.length >> 1)]) {
        // In a tower: up the shaft, off a ledge, never down by the start or along the floor.
        if (challengeRoom(lv, '#', lv.arenaX - 2, 8) || hardSpot(lv, lv.arenaX - 2, 8)) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; break; }
      }
    }
  });
})();
