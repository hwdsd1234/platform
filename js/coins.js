// Lanternfall: star coins, and the lever vaults they're locked in. Every story level, tower and
// castle has three (¢), placed when you play it (the same every time). They're meant to be
// hard to get: the level is split into thirds along its length, and in each the coin goes in
// the most out-of-the-way place there (the highest above the way most people go, or in a tall
// level the furthest to the side), away from the start, doors, lanterns and the secret exit,
// and not in a boss's arena, shut in a vault you open with a puzzle.
//
// A vault: a little stone room beside a ledge, two tiles tall, sealed by a rune seal (ŝ), with
// a row of four levers on the ledge in front of it. Press ↓ at a lever and it flips, and so do
// the ones either side of it; light all four and the seal breaks (see engine.js). Each vault's
// levers start in a muddle that takes at least two pulls to put right (with four levers in a
// row, every muddle has exactly one way out). The room is cut into solid rock where there's
// some, walled in on every other side so it opens no new way through; or else built as a 3x3
// block of stone on the ledge (as long as LF.analyze says the level can still be finished
// just as before). Failing both, the coin goes out in the open in the most out-of-the-way spot
// you can reach. The secret exits (secrets.js) are locked in vaults the same way, with
// LF.vaults. Load after lengthen.js, before secrets.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const AWAY = 4;   // tiles to keep clear of the start, doors, lanterns and other vaults
  const floor = c => '#=CiTH<>O123d'.includes(c);

  // Every place a vault could go in map (an array of strings), beside a spot to stand at
  // (x, y) that reach(x, y) says you can get to and ok(x, y) allows: { x, y, d, rock, cells,
  // seal, inside, prize, levers }, the room on side d (-1 left, 1 right) of the spot and the
  // levers running back from it the other way.
  function spots(map, reach, ok) {
    const h = map.length, w = map[0].length, out = [];
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? map[y][x] : '#');
    const stand = (x, y) => at(x, y) === '.' && at(x, y - 1) === '.' && floor(at(x, y + 1)) && reach(x, y) && ok(x, y);
    for (let y = 4; y < h - 1; y++) for (let x = 4; x < w - 4; x++) {
      if (!stand(x, y)) continue;
      for (const d of [-1, 1]) {
        const levers = [0, 1, 2, 3].map(k => [x - k * d, y]);
        if (!levers.every(([lx, ly]) => stand(lx, ly))) continue;
        const cols = [1, 2, 3].map(k => x + k * d);
        if (cols.some(c => c < 1 || c > w - 2)) continue;
        const seal = [[x + d, y], [x + d, y - 1]], inside = [[x + 2 * d, y], [x + 2 * d, y - 1]];
        // In the rock: the seal and the room cut from stone, with solid walls all round them
        // (a roof, a floor and a back wall).
        const solidAt = (c, r) => floor(at(c, r)) && at(c, r) !== '=';
        const rock = [...seal, ...inside].every(([c, r]) => at(c, r) === '#') && [x + d, x + 2 * d].every(c => solidAt(c, y - 2) && solidAt(c, y + 1)) && solidAt(x + 3 * d, y) && solidAt(x + 3 * d, y - 1);
        // On the ledge: open air 4 tall above floor, three tiles out (the checker makes sure
        // the block doesn't get in the way).
        const ledge = !rock && cols.every(c => floor(at(c, y + 1)) && [y - 3, y - 2, y - 1, y].every(r => at(c, r) === '.'));
        if (!rock && !ledge) continue;
        const cells = [];
        if (ledge) for (const c of cols) for (let r = y - 2; r <= y; r++) cells.push([c, r]);
        out.push({ x, y, d, rock, cells, seal, inside, prize: inside[0], levers });
      }
    }
    return out;
  }
  // Build vault q into rows (arrays of characters, changed in place) with prize ('¢' or '?')
  // inside, its levers muddled by seed.
  function build(rows, q, prize, seed) {
    for (const [x, y] of q.cells) rows[y][x] = '#';
    for (const [x, y] of q.inside) rows[y][x] = '.';
    for (const [x, y] of q.seal) rows[y][x] = 'ŝ';
    rows[q.prize[1]][q.prize[0]] = prize;
    // (The pulls that solve it: two or more of the four. Each lever starts unlit if an odd
    // number of those pulls would flip it.)
    const ways = [];
    for (let m = 1; m < 16; m++) if ((m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1) >= 2) ways.push(m);
    const m = ways[seed % ways.length], bit = k => (k >= 0 && k < 4 ? m >> k & 1 : 0);
    q.levers.forEach(([x, y], k) => { rows[y][x] = bit(k - 1) ^ bit(k) ^ bit(k + 1) ? 'Ł' : 'ł'; });
  }
  // Is vault q still free in rows (nothing else built there since the spots were found)?
  const free = (rows, q) => q.levers.every(([x, y]) => rows[y][x] === '.') && [...q.seal, ...q.inside].every(([x, y]) => rows[y][x] === (q.rock ? '#' : '.')) && q.cells.every(([x, y]) => rows[y][x] === '.');
  LF.vaults = { spots, build, free, MARKS: 'PDLjnĵň?ŝłŁ' };

  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  LF.addCoins = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), h = map.length, w = map[0].length;
    const marks = [];
    map.forEach((r, y) => [...r].forEach((c, x) => { if (LF.vaults.MARKS.includes(c)) marks.push([x, y]); }));
    const a = LF.analyze({ ...def, map });
    const reach = (x, y) => (a.ok ? a.seen[y * w + x] : y + 1 < h && floor(map[y + 1][x]));
    const clear = (x, y) => !marks.some(([mx, my]) => Math.abs(mx - x) <= AWAY && Math.abs(my - y) <= AWAY) && !(def.arenaX && x >= def.arenaX - 6);
    const tall = h > w * 1.2;
    // How out of the way a spot is: in a wide level, how far it is above the lowest place you
    // can stand in its column (where the way through mostly runs); in a tall one, how far it is
    // from the middle of what you can reach on its row. (Plus a little jitter.)
    const low = Array(w).fill(-1), mid = Array(h).fill(null);
    for (let x = 0; x < w; x++) for (let y = h - 2; y >= 0; y--) if (reach(x, y) && floor(map[y + 1][x])) { low[x] = y; break; }
    for (let y = 0; y < h; y++) { const xs = []; for (let x = 0; x < w; x++) if (reach(x, y)) xs.push(x); if (xs.length) mid[y] = xs[xs.length >> 1]; }
    const away = (x, y) => (tall ? Math.abs(x - (mid[y] ?? x)) : low[x] >= 0 ? low[x] - y : 0) + ((x * 7 + y * 13) % 5) * .3;
    const vaults = spots(map, reach, clear).map(q => ({ ...q, score: away(q.x, q.y) + (q.rock ? 1 : 0) }));
    const open = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++)
      if ((map[y][x] === '.' || map[y][x] === '~') && clear(x, y) && reach(x, y)) open.push({ x, y, score: away(x, y) });
    if (!vaults.length && open.length < 3) { cache.set(def.name, def); return def; }
    const along = tall ? (x, y) => h - 1 - y : x => x, span = tall ? h : w;
    let rows = map.map(r => r.split(''));
    const used = [];
    for (let k = 0; k < 3; k++) {
      const a0 = span * k / 3, a1 = span * (k + 1) / 3, inBand = (x, y) => along(x, y) >= a0 && along(x, y) < a1;
      const apart = (x, y) => used.every(([ux, uy]) => Math.abs(ux - x) > 8 || Math.abs(uy - y) > 6);
      let done = false;
      for (const q of vaults.filter(q => inBand(q.x, q.y) && apart(q.x, q.y)).sort((p, q) => q.score - p.score).slice(0, 8)) {
        if (!free(rows, q)) continue;
        const t = rows.map(r => r.slice());
        build(t, q, '¢', hash(def.name) + k);
        // (A block built on a ledge mustn't get in the way: the level must still be finished
        // just as before, and the coin reached.)
        if (!q.rock) {
          if (!a.ok) continue;
          const b = LF.analyze({ ...def, map: t.map(r => r.join('')) });
          if (!b.ok || b.litOk !== a.litOk || !b.seen[q.prize[1] * w + q.prize[0]]) continue;
        }
        rows = t; used.push([q.x, q.y]); done = true; break;
      }
      if (done) continue;
      const o = open.filter(p => inBand(p.x, p.y) && apart(p.x, p.y) && rows[p.y][p.x] === map[p.y][p.x]).sort((p, q) => q.score - p.score)[0];
      if (o) { rows[o.y][o.x] = '¢'; used.push([o.x, o.y]); }
    }
    const out = { ...def, map: rows.map(r => r.join('')) };
    cache.set(def.name, out);
    return out;
  };
})();
