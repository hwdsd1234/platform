// Lanternfall: star coins. Every story level, tower and castle has three (¢), placed when
// you play it (the same every time), in the hardest places to get to: the level is split into
// thirds along its length (in a tower or castle, the way up to the boss's arena), and in each
// the coin goes where it's most out of the way (the highest above the way most people go, or
// in a tall level the furthest to the side) and loneliest (a little ledge with little else
// round it), floating two tiles up so you jump for it; away from the start, doors, lanterns
// and the secret exit, out of moving lava's reach and away from lava. Nothing marks them.
//
// The secret exits (secrets.js) are hidden at the end of secret sections with LF.sections:
// a hole in the floor somewhere out of the way leads down a shaft into a run of hard jumps
// in a band of rock under the level. Load after lengthen.js, before secrets.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const AWAY = 4;   // tiles to keep clear of the start, doors, lanterns and other holes
  const floor = c => '#=CiTH<>O123d'.includes(c);

  // The secret sections: a run of hard jumps, built into a band of rock added under the level
  // (BAND rows, only under columns that were solid at the bottom: a pit stays a pit). A hole
  // in the level's floor leads down into one (see dig); it starts on a ledge, then it's jump after jump
  // between pillars one tile wide, as far apart as you can jump (up two, across four; level,
  // across five; down, across five or six), over a floor of spikes, with bats in the way; at
  // the end, on a ledge, the prize.
  const BAND = 11;
  // The kinds of secret section, each a different way to get through:
  // - pillars: one tile wide, as far apart as you can jump (up two, across four; level, across
  //   five; down, across five or six), over spikes, with bats in the way;
  // - crumbles: single crumbling blocks hanging over spikes (keep moving);
  // - ice: two-tile icy pillars, slippery landings, far apart;
  // - blinks: single blocks that blink on and off in turn over spikes (time it);
  // - belts: two-tile pillars topped with conveyor belts running back the way you came;
  // - springs: walls too tall to jump, a spring on a spiked floor before each;
  // - lifts: long spiked pits crossed on lifts that run back and forth, bats overhead.
  const KINDS = ['pillars', 'crumbles', 'ice', 'blinks', 'belts', 'springs', 'lifts'];
  // A course of kind with n obstacles, as rows of characters BAND tall (row 0 the rock above
  // it, rows 1-8 open, row 9 the spiked floor); returns { g, start: [x, y], end: [x, y] }
  // (end: where the prize goes).
  function course(n, seed, kind = 'pillars') {
    let r = seed >>> 0;
    const rnd = k => { r = (Math.imul(r ^ r >>> 15, 2246822507) + 1013904223) >>> 0; return r % k; };
    const g = Array.from({ length: BAND }, (_, row) => Array.from({ length: 200 }, (_, x) => (row >= 1 && row <= 8 && x > 0 ? '.' : row === 9 && x > 0 ? '^' : '#')));
    const col = (x, top, c = '#') => { for (let row = top; row <= 9; row++) g[row][x] = row === top ? c : '#'; };
    // (A lift needs open air either side of it, so its ledges stand up off the floor.)
    const y1 = kind === 'lifts' ? 6 : 8;
    for (let x = 1; x <= 3; x++) col(x, y1 + 1);
    let x = 3, y = y1;
    // (Up and down between rows lo and hi; ups and downs as far as kind allows: [dy, dx].)
    const hop = (lo, reach, hi = 8) => {
      const opts = reach.filter(([dy]) => y + dy >= lo && y + dy <= hi);
      const [dy, dx] = opts[rnd(opts.length)];
      x += dx; y += dy;
      return dx;
    };
    if (kind === 'pillars') for (let k = 0; k < n; k++) {
      const dx = hop(4, [[-2, 4], [-1, 4], [0, 5], [1, 4], [2, 4]]);
      col(x, y + 1);
      if (k % 3 === 1) g[Math.max(2, y - 3)][x - (dx >> 1)] = 'F';
    } else if (kind === 'crumbles') for (let k = 0; k < n; k++) {
      hop(4, [[-1, 3], [0, 4], [1, 3]], 7);
      g[y + 1][x] = 'C';
    } else if (kind === 'ice') for (let k = 0; k < n; k++) {
      hop(4, [[-1, 4], [0, 5], [1, 4]]);
      col(x, y + 1, 'i'); col(x + 1, y + 1, 'i'); x++;
    } else if (kind === 'blinks') for (let k = 0; k < n; k++) {
      hop(4, [[-1, 3], [0, 3], [1, 3]], 7);
      g[y + 1][x] = k % 2 ? 'H' : 'T';
    } else if (kind === 'belts') for (let k = 0; k < n; k++) {
      hop(4, [[-1, 4], [0, 4], [1, 4]]);
      col(x, y + 1, '<'); col(x + 1, y + 1, '<'); x++;
    } else if (kind === 'springs') for (let k = 0; k < Math.max(2, n >> 1); k++) {
      // Off the ledge onto a spring two along, up over a wall (its top on row 4), and down
      // the far side onto the next.
      x += 3; g[9][x] = 'O'; y = 8;
      x += 3; col(x, 4); col(x + 1, 4); x++; y = 3;
      if (k % 2) g[2][x - 3] = 'F';
    } else for (let k = 0; k < Math.max(2, n >> 2); k++) {
      // lifts: a ledge, then a pit 9 wide with a lift that runs from side to side.
      x += 1; g[y + 1][x] = 'M';
      x += 9; col(x, y + 1); col(x + 1, y + 1); col(x + 2, y + 1); x += 2;
      g[Math.max(2, y - 3)][x - 6] = 'F';
    }
    // The end: a ledge four wide (after springs, past one more spring, for the way back).
    if (kind === 'springs') { x += 3; g[9][x] = 'O'; x += 2; y = 8; }
    for (let k = 1; k <= 4; k++) col(x + k, y + 1);
    const w = x + 6;
    return { g: g.map(row => row.slice(0, w).map((c, cx) => (cx === w - 1 ? '#' : c))), start: [2, y1], end: [x + 2, y] };
  }
  // Add a band of rock under rows (arrays of characters) for secret sections; returns the
  // first band row.
  function addBand(rows) {
    const h = rows.length, bottom = rows[h - 1];
    for (let k = 0; k < BAND; k++) rows.push(bottom.map(c => (c === '.' ? '.' : '#')));
    return h;
  }
  // Dig a secret section down from spot [x, y] (somewhere out of the way, standing on rock):
  // a hole three wide in the floor there, a shaft down through solid rock to the band from row
  // y0 with ledges on alternate sides every three rows (to climb back out by), and at its foot
  // a course of kind running off to one side (whichever it fits), prize ('¢' or '?') at the
  // end. (Nothing marks the hole: it's for you to find.) Every
  // course can be crossed both ways (its jumps are the same out and back), so you can come
  // back with the coin. Changes rows and returns true, or false if there's no room.
  // (dry: only say whether it would fit, changing nothing.)
  function dig(rows, [x, y], prize, seed, y0, kind, levelH = y0, dry = false) {
    const w = rows[0].length, sx = x - 1;
    if (sx < 2 || sx + 4 >= w || y < 3) return false;
    // (Open air over the hole, and ground beside it on at least one side to climb out onto;
    // below, the shaft cuts through whatever's there (rock, or open air: LF.analyze then makes
    // sure nothing's spoilt), but never through water, lava or anything built there.)
    for (let c = sx; c <= sx + 2; c++) if (rows[y][c] !== '.' || rows[y - 1][c] !== '.') return false;
    if (![sx - 1, sx + 3].some(c => rows[y][c] === '.' && rows[y - 1][c] === '.' && floor(rows[y + 1][c]))) return false;
    for (let c = sx; c <= sx + 2; c++) for (let r = y + 1; r < y0; r++) if (rows[r][c] !== '#' && (rows[r][c] !== '.' || r >= levelH)) return false;
    const solidCol = c => { if (c < 0 || c >= w) return false; for (let r = y0; r < y0 + BAND; r++) if (rows[r][c] !== '#') return false; return true; };
    for (let n = 8; n >= 4; n--) for (const flip of [false, true]) {
      const c = course(n, seed, kind), cw = c.g[0].length;
      // (Mirrored, the course runs off to the left, its belts still running back the way you came.)
      const g = flip ? c.g.map(row => row.slice().reverse().map(ch => (ch === '<' ? '>' : ch === '>' ? '<' : ch))) : c.g;
      const at = j => (flip ? cw - 1 - j : j), x0 = flip ? sx - (cw - 4) : sx - 1;
      let ok = true;
      for (let cx = x0 - 1; cx <= x0 + cw && ok; cx++) if (!solidCol(cx)) ok = false;
      if (!ok) continue;
      if (dry) return true;
      g.forEach((row, r) => row.forEach((ch, j) => { rows[y0 + r][x0 + j] = ch; }));
      for (let r = y + 1; r <= y0; r++) for (let cx = sx; cx <= sx + 2; cx++) rows[r][cx] = '.';
      let side = 0;
      for (let r = y0 + 6; r >= y + 2; r -= 3, side ^= 1) rows[r][side ? sx + 2 : sx] = '#';
      rows[y0 + c.end[1]][x0 + at(c.end[0])] = prize;
      return true;
    }
    return false;
  }

  LF.sections = { addBand, dig, course, KINDS, BAND, MARKS: 'PDLjnĵň?' };

  LF.addCoins = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), h = map.length, w = map[0].length;
    const marks = [];
    map.forEach((r, y) => [...r].forEach((c, x) => { if (LF.sections.MARKS.includes(c)) marks.push([x, y]); }));
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
