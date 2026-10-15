// Lanternfall: star coins. Every story level, tower and castle hides three (¢), placed when
// you play it (the same every time). They're secret, and meant to be hard to find: the level
// is split into thirds along its length, and in each the coin goes in the most out-of-the-way
// place there (the highest above the way most people go, or in a tall level the furthest to
// the side), away from the start, doors, lanterns and the secret exit, and not in a boss's
// arena:
// - best, in a pocket in the rock behind a false wall (l) that looks just like stone: either
//   a tunnel three tiles into the wall beside a ledge (walk into the wall), or a little room
//   up in a low ceiling (jump up through it, then step aside). The pocket is walled in on
//   every other side, so it opens no new way through the level, and LF.analyze must reach
//   the coin.
// - with no rock there, in a little block of stone built on a ledge, behind a false wall in
//   the same way (as long as the level can still be finished just as before).
// - failing both, the most out-of-the-way spot you can reach, out in the open.
// Either way it can't be seen until you find it (see engine.js): you have to be inside its
// pocket, or within 3 tiles of it in the open. A level the checker can't follow (the Pear
// Cliffs' glides) takes open spots standing on something. Load after lengthen.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const AWAY = 4;   // tiles to keep clear of the start, doors, lanterns and the secret exit
  const floor = c => '#=CiTH<>O123d'.includes(c);
  LF.addCoins = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), h = map.length, w = map[0].length;
    const marks = [];
    map.forEach((r, y) => [...r].forEach((c, x) => { if ('PDLjnĵň?l'.includes(c)) marks.push([x, y]); }));
    const a = LF.analyze({ ...def, map });
    const reach = (x, y) => (a.ok ? a.seen[y * w + x] : y + 1 < h && floor(map[y + 1][x]));
    const clear = (x, y) => !marks.some(([mx, my]) => Math.abs(mx - x) <= AWAY && Math.abs(my - y) <= AWAY) && !(def.arenaX && x >= def.arenaX - 2);
    const tall = h > w * 1.2;
    // How out of the way a spot is: in a wide level, how far it is above the lowest place you
    // can stand in its column (where the way through mostly runs); in a tall one, how far it is
    // from the middle of what you can reach on its row. (Plus a little jitter, so it isn't
    // always the very top.)
    const low = Array(w).fill(-1), mid = Array(h).fill(null);
    for (let x = 0; x < w; x++) for (let y = h - 2; y >= 0; y--) if (reach(x, y) && floor(map[y + 1][x])) { low[x] = y; break; }
    for (let y = 0; y < h; y++) { const xs = []; for (let x = 0; x < w; x++) if (reach(x, y)) xs.push(x); if (xs.length) mid[y] = xs[xs.length >> 1]; }
    const away = (x, y) => (tall ? Math.abs(x - (mid[y] ?? x)) : low[x] >= 0 ? low[x] - y : 0) + ((x * 7 + y * 13) % 5) * .3;
    const rock = (x, y) => y >= 0 && y < h && x >= 1 && x < w - 1 && map[y][x] === '#';
    // The pockets: each is the cells to carve (false walls), the coin's cell, and the cells
    // that must be rock all round them.
    const pockets = [];
    for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (map[y][x] !== '.' || map[y - 1][x] !== '.' || !floor(map[y + 1][x]) || !reach(x, y) || !clear(x, y)) continue;
      for (const d of [-1, 1]) {
        // A tunnel into the wall beside you: two tiles tall, three deep, the coin at the end.
        const carve = [], ring = [];
        for (let k = 1; k <= 3; k++) { carve.push([x + k * d, y], [x + k * d, y - 1]); ring.push([x + k * d, y - 2], [x + k * d, y + 1]); }
        ring.push([x + 4 * d, y], [x + 4 * d, y - 1], [x + 4 * d, y - 2], [x + 4 * d, y + 1]);
        pockets.push({ x, y, carve, ring, coin: [x + 3 * d, y], score: away(x, y) + 1 });
        // A room up in a low ceiling: jump up through it, the coin on a ledge to the side.
        const up = [[x, y - 2], [x, y - 3], [x, y - 4], [x + d, y - 4], [x + d, y - 3]], ur = [];
        for (const c of [x - d, x, x + d, x + 2 * d]) ur.push([c, y - 5]);
        ur.push([x - d, y - 2], [x - d, y - 3], [x - d, y - 4], [x + d, y - 2], [x + 2 * d, y - 2], [x + 2 * d, y - 3], [x + 2 * d, y - 4]);
        pockets.push({ x, y, carve: up, ring: ur, coin: [x + d, y - 3], score: away(x, y) + 4, up: true });
      }
    }
    // The blocks: 3 wide and 3 tall, standing on the ledge beside a spot you can reach, with
    // open air all round (so it walls nothing off).
    const blocks = [];
    for (let y = 4; y < h - 1; y++) for (let x = 2; x < w - 2; x++) {
      if (map[y][x] !== '.' || map[y - 1][x] !== '.' || !floor(map[y + 1][x]) || !reach(x, y) || !clear(x, y)) continue;
      for (const d of [-1, 1]) {
        let room = true;
        for (let k = 1; k <= 4 && room; k++) {
          const cx = x + k * d;
          if (cx < 1 || cx > w - 2 || (k <= 3 && !floor(map[y + 1][cx]))) { room = false; break; }
          for (let r = y - 3; r <= y; r++) if (map[r][cx] !== '.') { room = false; break; }
        }
        if (!room) continue;
        const cells = [];
        for (let k = 1; k <= 3; k++) for (let r = y - 2; r <= y; r++) cells.push([x + k * d, r]);
        blocks.push({ x, y, cells, carve: [[x + d, y], [x + d, y - 1], [x + 2 * d, y - 1]], coin: [x + 2 * d, y], score: away(x, y) });
      }
    }
    const fits = q => q.carve.every(([cx, cy]) => rock(cx, cy)) && q.ring.every(([cx, cy]) => rock(cx, cy) || q.carve.some(([ax, ay]) => ax === cx && ay === cy));
    const open = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++)
      if ((map[y][x] === '.' || map[y][x] === '~') && clear(x, y) && (a.ok ? a.seen[y * w + x] : y + 1 < h && floor(map[y + 1][x]))) open.push({ x, y, score: away(x, y) });
    if (!pockets.length && open.length < 3) { cache.set(def.name, def); return def; }
    const along = tall ? (x, y) => h - 1 - y : x => x, span = tall ? h : w;
    let rows = map.map(r => r.split(''));
    const used = [];
    for (let k = 0; k < 3; k++) {
      const a0 = span * k / 3, a1 = span * (k + 1) / 3, inBand = (x, y) => along(x, y) >= a0 && along(x, y) < a1;
      const apart = (x, y) => used.every(([ux, uy]) => Math.abs(ux - x) + Math.abs(uy - y) > 8);
      let done = false;
      for (const q of pockets.filter(q => inBand(q.x, q.y) && apart(q.x, q.y) && fits(q)).sort((p, q) => q.score - p.score).slice(0, 8)) {
        // (Not where an earlier coin's pocket has gone: two would make a way through.)
        if ([...q.carve, ...q.ring].some(([cx, cy]) => rows[cy][cx] === 'l' || rows[cy][cx] === '¢')) continue;
        const t = rows.map(r => r.slice());
        for (const [cx, cy] of q.carve) t[cy][cx] = 'l';
        t[q.coin[1]][q.coin[0]] = '¢';
        // (The checker must reach the coin.)
        if (a.ok) { const b = LF.analyze({ ...def, map: t.map(r => r.join('')) }); if (!b.ok || !b.seen[q.coin[1] * w + q.coin[0]]) continue; }
        else if (q.up) continue;
        rows = t; used.push(q.coin); done = true; break;
      }
      if (done) continue;
      // No rock: build a little block of stone on a ledge, the coin inside behind a false
      // wall (as long as the level can still be finished just the same).
      if (a.ok) for (const q of blocks.filter(q => inBand(q.x, q.y) && apart(q.x, q.y)).sort((p, q) => q.score - p.score).slice(0, 8)) {
        if (q.cells.some(([cx, cy]) => rows[cy][cx] !== '.')) continue;
        const t = rows.map(r => r.slice());
        for (const [cx, cy] of q.cells) t[cy][cx] = '#';
        for (const [cx, cy] of q.carve) t[cy][cx] = 'l';
        t[q.coin[1]][q.coin[0]] = '¢';
        const b = LF.analyze({ ...def, map: t.map(r => r.join('')) });
        if (!b.ok || b.litOk !== a.litOk || !b.seen[q.coin[1] * w + q.coin[0]]) continue;
        rows = t; used.push(q.coin); done = true; break;
      }
      if (done) continue;
      const o = open.filter(p => inBand(p.x, p.y) && apart(p.x, p.y) && rows[p.y][p.x] !== 'l').sort((p, q) => q.score - p.score)[0];
      if (o) { rows[o.y][o.x] = '¢'; used.push([o.x, o.y]); }
    }
    const out = { ...def, map: rows.map(r => r.join('')) };
    cache.set(def.name, out);
    return out;
  };
})();
