// Lanternfall: secret exits. Two levels in each world (but the last) hide a second door (?),
// and so does one tower in every four worlds (in its climb or along its battlements, never
// in the boss's arena); leaving by it fires you out of a secret cannon to a faraway world: two worlds on
// (or the last one). lv.secretTo is the index of that world's first level, lv.secretWorld the
// world's index. Load after worlds.js, so the worlds and level indexes are final.
//
// The door is at the end of a secret section (see coins.js): a portal somewhere out of the
// way leads down into a run of hard jumps under the level, and the door's at the end of that.
// Failing that, the door goes in the most out-of-the-way spot you can reach, unseen until you
// come near.
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

  // Hide a secret door in level lv (left of column xMax and, for a tower, at least minUp rows
  // above the start): a portal, as far from the start and the door as can be, down into a
  // secret section with the door at its end (see coins.js). True if it found room for one.
  function portalRoom(lv, xMax = Infinity, minUp = -Infinity) {
    const g = LF.normalize(lv.map), G = g.map(r => r.split('')), w = g[0].length, h = g.length;
    const a0 = LF.analyze(lv), seen = a0.seen, P = find(G, 'P'), D = find(G, 'D') || lastDoor(G), marks = landmarks(G);
    if (!a0.ok || !P || !D) return false;
    const spots = [];
    for (let y = 2; y < h - 1; y++) for (let x = 2; x < w - 2; x++)
      if (seen[y * w + x] && G[y][x] === '.' && x + 5 < xMax && P.y - y >= minUp && !nearAny(marks, x, y)) spots.push({ x, y, score: Math.hypot(x - P.x, y - P.y) + Math.hypot(x - D.x, y - D.y) + ((x * 7 + y * 13) % 11) });
    spots.sort((a, b) => b.score - a.score);
    for (const o of spots.slice(0, 30)) {
      const t = g.map(r => r.split('')), y0 = LF.sections.addBand(t);
      const kinds = LF.sections.KINDS;
      if (!LF.sections.hideOpen(t, [o.x, o.y], '?', o.x * 31 + o.y, y0, 0, kinds[(o.x * 7 + o.y) % kinds.length])) continue;
      const tryLv = { ...lv, map: t.map(r => r.join('')) }, a = LF.analyze(tryLv);
      const door = t.findIndex(r => r.includes('?')), dx = t[door].indexOf('?');
      if (!a.ok || a.litOk !== a0.litOk || !a.seen[door * w + dx]) continue;
      lv.map = tryLv.map;
      return true;
    }
    return false;
  }
  // No rock to hide in: the most out-of-the-way spot you can reach (it stays unseen until
  // you're within 3 tiles of it).
  function farSpot(lv) {
    const g = LF.normalize(lv.map).map(row => row.split('')), h = g.length, w = g[0].length;
    const seen = LF.analyze(lv).seen, P = find(g, 'P'), D = find(g, 'D') || lastDoor(g);
    if (!P || !D) return false;
    let best = null;
    for (let y = 2; y < h - 1; y++) for (let x = 2; x < w - 2; x++) {
      if (!seen[y * w + x] || g[y][x] !== '.' || g[y - 1][x] !== '.' || !floor(g[y + 1][x])) continue;
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
    const regular = L.map((lv, i) => i).filter(i => L[i].world === k && !L[i].boss && !L[i].secretTo);
    // Aim for a third and two thirds of the way through the world, taking the nearest level
    // after that with rock to hide a room in (or, failing that, the aimed-for level itself).
    for (const at of [Math.floor(regular.length / 3), Math.floor(regular.length * 2 / 3)]) {
      let placed = false;
      for (let n = at; n < regular.length && !placed; n++) {
        const lv = L[regular[n]];
        if (lv.secretTo == null && portalRoom(lv)) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; placed = true; }
      }
      if (!placed && L[regular[at]].secretTo == null && farSpot(L[regular[at]])) { L[regular[at]].secretTo = WORLDS[to].first; L[regular[at]].secretWorld = to; }
    }
    // And one tower in every four worlds (the second world of each four, from its middle
    // tower on), if two worlds on is still somewhere new.
    if (to > k && k % 4 === 1) {
      const towers = L.filter(l => l.world === k && l.boss && !l.finalFight);
      for (const lv of [...towers.slice(towers.length >> 1), ...towers.slice(0, towers.length >> 1)]) {
        // In a tower: up the shaft, off a ledge, never down by the start or along the floor.
        if (portalRoom(lv, lv.arenaX - 2, 8)) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; break; }
      }
    }
  });
})();
