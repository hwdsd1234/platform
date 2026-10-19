// Lanternfall: star coins. Every story level, tower and castle has three (¢), placed when
// you play it (the same every time), in the hardest places to get to: the level is split into
// thirds along its length (in a tower or castle, the way up to the boss's arena), and in each
// the coin goes where it's most out of the way (the highest above the way most people go, or
// in a tall level the furthest to the side) and loneliest (a little ledge with little else
// round it), floating two tiles up so you jump for it; away from the start, doors, lanterns
// and the secret exit, out of moving lava's reach and away from lava. Nothing marks them.
// Load after lengthen.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const AWAY = 4;   // tiles to keep clear of the start, doors, lanterns and the secret exit
  const floor = c => '#=CiTH<>O123d'.includes(c);

  const MARKS = 'PDLjnĵň?';

  LF.addCoins = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), h = map.length, w = map[0].length;
    const marks = [];
    map.forEach((r, y) => [...r].forEach((c, x) => { if (MARKS.includes(c)) marks.push([x, y]); }));
    const a = LF.analyze({ ...def, map });
    const reach = (x, y) => (a.ok ? a.seen[y * w + x] : y + 1 < h && floor(map[y + 1][x]));
    // (Nowhere moving lava can reach either: its columns, from as high as it ever comes,
    // less a few rows, down.)
    // Nor right by still lava (four tiles either way, two up or down): no hopping past lava to
    // get in, or to get back out.
    const lava = (x, y) => (def.flows || []).some(f => x >= f.x0 - 2 && x <= f.x1 + 2 && y >= Math.min(f.hi ?? f.lo, f.lo - (f.amp || 0)) - 4) ||
      map.slice(Math.max(0, y - 2), y + 3).some(r => r.slice(Math.max(0, x - 4), x + 5).includes('!'));
    const clear = (x, y) => !marks.some(([mx, my]) => Math.abs(mx - x) <= AWAY && Math.abs(my - y) <= AWAY) && !(def.arenaX && x >= def.arenaX - 6) && !lava(x, y);
    const tall = h > w * 1.2;
    // How out of the way a spot is: in a wide level, how far it is above the lowest place you
    // can stand in its column (where the way through mostly runs); in a tall one, how far it is
    // from the middle of what you can reach on its row. (Plus a little jitter.)
    const low = Array(w).fill(-1), mid = Array(h).fill(null);
    for (let x = 0; x < w; x++) for (let y = h - 2; y >= 0; y--) if (reach(x, y) && floor(map[y + 1][x])) { low[x] = y; break; }
    for (let y = 0; y < h; y++) { const xs = []; for (let x = 0; x < w; x++) if (reach(x, y)) xs.push(x); if (xs.length) mid[y] = xs[xs.length >> 1]; }
    const away = (x, y) => (tall ? Math.abs(x - (mid[y] ?? x)) : low[x] >= 0 ? low[x] - y : 0) + ((x * 7 + y * 13) % 5) * .3;
    // How hard a spot is to get to: how out of the way it is, and how lonely (a little ledge
    // with little else you can stand on round it). The coin floats two tiles over the ledge
    // (when there's room), so you jump for it there.
    const ok = (x, y) => x >= 0 && x < w && y >= 0 && y < h && reach(x, y);
    const lonely = (x, y) => { let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (ok(x + dx, y + dy)) n++; return Math.max(0, 8 - n / 2); };
    const open = [];
    for (let y = 3; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const air = c => c === '.' || c === '~';
      if (!ok(x, y) || !floor(map[y + 1][x]) || !air(map[y][x])) continue;
      const cy = air(map[y - 1][x]) && air(map[y - 2][x]) ? y - 2 : y;
      if (clear(x, cy)) open.push({ x, y: cy, score: away(x, y) + lonely(x, y) });
    }
    if (open.length < 3) { cache.set(def.name, def); return def; }
    // (In a tower or castle the thirds are of the way up to the boss's arena, which gets none.)
    const along = tall ? (x, y) => h - 1 - y : x => x, span = tall ? h : def.arenaX ? def.arenaX - 6 : w;
    const rows = map.map(r => r.split('')), slots = [];
    const apart = (x, y) => slots.every(([sx, sy]) => Math.abs(sx - x) > 8 || Math.abs(sy - y) > 6);
    const best = list => list.filter(p => apart(p.x, p.y)).sort((p, q) => q.score - p.score)[0];
    // The hardest spot in each third (its coin is coin k: see engine.js); a third with
    // nowhere for its coin, the hardest spot left anywhere, so every level has its three.
    for (let k = 0; k < 3; k++) {
      const a0 = span * k / 3, a1 = span * (k + 1) / 3;
      const o = best(open.filter(p => along(p.x, p.y) >= a0 && along(p.x, p.y) < a1));
      if (o) { rows[o.y][o.x] = '¢'; slots.push([o.x, o.y]); }
    }
    while (slots.length < 3) {
      const o = best(open);
      if (!o) break;
      rows[o.y][o.x] = '¢'; slots.push([o.x, o.y]);
    }
    const out = { ...def, map: rows.map(r => r.join('')), coinSlots: slots };
    cache.set(def.name, out);
    return out;
  };
})();
