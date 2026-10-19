// Lanternfall: a crowd in every level. Every level you play (story levels, towers, castles,
// the Star Road; not a boss's arena, nor a fruit grove) has at least CROWD of each of these:
// 5 bats (F), 5 beetles (B) and 10 Shellbacks (ĸ), the most fun of all (30 on the way up a
// tower or castle, before its boss): any it's short of are
// added when you play it (the same every time), spread out along the way. Walkers go on
// ground you can reach, bats in open air a little over it; none near the start (where you
// come in), a door, a lantern or the secret exit, near lava, or on top of another enemy.
// Load after slopes.js, before coins.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const CROWD = { F: 5, B: 5, 'ĸ': 10 };
  const ground = c => '#=i<>C'.includes(c) || !!(LF.SLOPES && LF.SLOPES[c]);
  LF.addCrowd = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const rows = LF.normalize(def.map).map(r => r.split('')), h = rows.length, w = rows[0].length;
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? rows[y][x] : '#');
    const a = LF.analyze({ ...def, map: rows.map(r => r.join('')) });
    const reach = (x, y) => (a.ok ? a.seen[y * w + x] : ground(at(x, y + 1)));
    const marks = [], foes = [];
    rows.forEach((r, y) => r.forEach((c, x) => {
      if ('PDLjnĵň?'.includes(c)) marks.push([x, y, c === 'P' ? 10 : 4]);
      else if (LF.ENEMIES[c]) foes.push([x, y]);
    }));
    // (Moving lava's reach is kept clear; still lava, by `near` tiles: three, or one at a pinch.)
    const lava = (x, y, near = 3) => (def.flows || []).some(f => x >= f.x0 - 2 && x <= f.x1 + 2 && y >= Math.min(f.hi ?? f.lo, f.lo - (f.amp || 0)) - (near === 3 ? 4 : 0)) ||
      rows.slice(Math.max(0, y - 1), y + 2).some(r => r.slice(Math.max(0, x - near), x + near + 1).includes('!'));
    // (Enemies kept gap tiles apart: three at first, closer if there isn't room enough.)
    const free = (x, y, gap = 3) => !marks.some(([mx, my, d]) => Math.abs(mx - x) <= d && Math.abs(my - y) <= d) && !foes.some(([fx, fy]) => Math.abs(fx - x) < gap && Math.abs(fy - y) < gap) &&
      !(def.arenaX && x >= def.arenaX - 4) && !lava(x, y, gap === 3 ? 3 : 1);
    // (Open air, or water: an underwater castle gets its crowd too.)
    const open = c => c === '.' || c === '~';
    const walkSpots = [], airSpots = [];
    for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!open(at(x, y)) || !free(x, y, 1)) continue;
      if (open(at(x, y - 1)) && ground(at(x, y + 1)) && reach(x, y)) walkSpots.push([x, y]);
      // A bat: open air three wide, two to four tiles over ground you can reach.
      else if ([-1, 1].every(d => open(at(x + d, y))) && [2, 3, 4].some(k => ground(at(x, y + k)) && reach(x, y + k - 1) && [...Array(k - 1)].every((_, j) => open(at(x, y + j + 1))))) airSpots.push([x, y]);
    }
    // (In a tower or castle, only those on the way to the boss's arena count.)
    const count = c => rows.reduce((n, r) => n + r.filter((ch, x) => ch === c && !(def.arenaX && x >= def.arenaX)).length, 0);
    let added = 0;
    for (const [c, base] of Object.entries(CROWD)) {
      const want = c === 'ĸ' && def.arenaX ? 30 : base;
      const spots = c === 'F' ? airSpots : walkSpots;
      for (let need = want - count(c), tries = 0; need > 0 && tries < 8; tries++) {
        // (Spread out: every so many spots along the list, left to right, skipping taken ones.)
        const gap = Math.max(1, 3 - (tries >> 1));
        const left = spots.filter(([x, y]) => free(x, y, gap) && open(rows[y][x])).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        if (!left.length) continue;
        const step = left.length / need;
        for (let k = 0; k < need && k * step < left.length; k++) {
          const [x, y] = left[Math.floor((k + .5) * step)];
          if (!free(x, y, gap) || !open(rows[y][x])) continue;
          rows[y][x] = c; foes.push([x, y]); added++;
        }
        need = want - count(c);
      }
    }
    const out = added ? { ...def, map: rows.map(r => r.join('')), crowd: added } : def;
    cache.set(def.name, out);
    return out;
  };
})();
