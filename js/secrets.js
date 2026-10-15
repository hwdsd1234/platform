// Lanternfall: secret exits. Two levels in each world (but the last) hide a second door (?),
// and so does one tower in every four worlds (in its climb or along its battlements, never
// in the boss's arena); leaving by it fires you out of a secret cannon to a faraway world: two worlds on
// (or the last one). lv.secretTo is the index of that world's first level, lv.secretWorld the
// world's index. Load after worlds.js, so the worlds and level indexes are final.
//
// The door is locked in a lever vault (see coins.js): a little stone room sealed by a rune
// seal, opened by solving the row of levers in front of it. The room is carved into solid
// rock beside a spot you can reach if there is some, or else built as a small 3x3 block of
// stone on a ledge (as long as the level can still be finished with it there). Failing both,
// the door goes in the most out-of-the-way spot you can reach, unseen until you come near.
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

  // Lock a secret door in a lever vault (see coins.js) in level lv, left of column xMax (and,
  // for a tower, at least minUp rows above the start): as far from the start and the door as
  // it can be. True if it found room for one.
  function vaultRoom(lv, xMax = Infinity, minUp = -Infinity) {
    const g = LF.normalize(lv.map), G = g.map(r => r.split('')), w = g[0].length;
    const a0 = LF.analyze(lv), seen = a0.seen, P = find(G, 'P'), D = find(G, 'D') || lastDoor(G), marks = landmarks(G);
    if (!P || !D) return false;
    const spots = LF.vaults.spots(g, (x, y) => seen[y * w + x], (x, y) => x + 5 < xMax && P.y - y >= minUp && !nearAny(marks, x, y))
      .map(q => ({ ...q, score: Math.hypot(q.x - P.x, q.y - P.y) + Math.hypot(q.x - D.x, q.y - D.y) + ((q.x * 7 + q.y * 13) % 11) + (q.rock ? 6 : 0) }))
      .sort((a, b) => b.score - a.score);
    for (const q of spots.slice(0, 40)) {
      const t = g.map(r => r.split(''));
      LF.vaults.build(t, q, '?', q.x * 31 + q.y);
      const tryLv = { ...lv, map: t.map(r => r.join('')) };
      // (A block built on a ledge mustn't get in the way of finishing the level.)
      if (!q.rock) { const a = LF.analyze(tryLv); if (!a.ok || a.litOk !== a0.litOk || !a.seen[q.prize[1] * w + q.prize[0]]) continue; }
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
        if (lv.secretTo == null && vaultRoom(lv)) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; placed = true; }
      }
      if (!placed && L[regular[at]].secretTo == null && farSpot(L[regular[at]])) { L[regular[at]].secretTo = WORLDS[to].first; L[regular[at]].secretWorld = to; }
    }
    // And one tower in every four worlds (the second world of each four, from its middle
    // tower on), if two worlds on is still somewhere new.
    if (to > k && k % 4 === 1) {
      const towers = L.filter(l => l.world === k && l.boss && !l.finalFight);
      for (const lv of [...towers.slice(towers.length >> 1), ...towers.slice(0, towers.length >> 1)]) {
        // In a tower: up the shaft, off a ledge, never down by the start or along the floor.
        if (vaultRoom(lv, lv.arenaX - 2, 8)) { lv.secretTo = WORLDS[to].first; lv.secretWorld = to; break; }
      }
    }
  });
})();
