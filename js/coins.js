// Lanternfall: star coins, and the secret sections they're hidden at the end of. Every story
// level, tower and castle has three (¢), placed when you play it (the same every time).
// They're meant to be hard to get: the level is split into thirds along its length, and in
// each, in the most out-of-the-way place there (the highest above the way most people go, or in
// a tall level the furthest to the side), away from the start, doors, lanterns and the secret
// exit, and not in a boss's arena, stands a portal down into a secret section: a run of hard
// jumps under the level with the coin at the end, and a portal back. Where no section fits,
// the coin sits out in the open in that out-of-the-way spot. The secret exits (secrets.js)
// are hidden at the end of secret sections the same way, with LF.sections. Load after
// lengthen.js, before secrets.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const AWAY = 4;   // tiles to keep clear of the start, doors, lanterns and other portals
  const floor = c => '#=CiTH<>O123d'.includes(c);

  // The secret sections: a run of hard jumps, built into a band of rock added under the level
  // (BAND rows, only under columns that were solid at the bottom: a pit stays a pit). A portal
  // up in the level leads down into one; it starts on a ledge, then it's jump after jump
  // between pillars one tile wide, as far apart as you can jump (up two, across four; level,
  // across five; down, across five or six), over a floor of spikes, with bats in the way; at
  // the end, on a ledge, the prize, and (for a coin) a portal back out to beside the first.
  const BAND = 11;
  // The kinds of secret section, each a different way to get through (a level's three coins
  // each get a different one, and which three changes from level to level):
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
  // (end: where the prize goes; the portal back is two on).
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
      const dx = hop(4, [[-2, 4], [-1, 4], [0, 5], [1, 5], [2, 6]]);
      col(x, y + 1);
      if (k % 3 === 1) g[Math.max(2, y - 3)][x - (dx >> 1)] = 'F';
    } else if (kind === 'crumbles') for (let k = 0; k < n; k++) {
      hop(4, [[-1, 3], [0, 4], [1, 4]], 7);
      g[y + 1][x] = 'C';
    } else if (kind === 'ice') for (let k = 0; k < n; k++) {
      hop(4, [[-1, 4], [0, 5], [1, 5]]);
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
    // The end: a ledge four wide (after springs, down beyond the last wall).
    if (kind === 'springs') { x += 3; y = 8; }
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
  // Build a course into the band (starting at row y0) where there's room, as wide as can be
  // up to 8 jumps (at least 4); null if there's no room. Returns where its start and end are.
  function section(rows, y0, seed, kind) {
    const w = rows[0].length;
    const solidCol = x => { for (let r = y0; r < y0 + BAND; r++) if (rows[r][x] !== '#') return false; return true; };
    for (let n = 8; n >= 4; n--) {
      const c = course(n, seed, kind), cw = c.g[0].length;
      for (let x0 = 4; x0 + cw + 3 < w; x0++) {
        let ok = true;
        // (With rock a few tiles thick either side, between it and any other.)
        for (let x = x0 - 4; x <= x0 + cw + 3 && ok; x++) if (x < 0 || x >= w || !solidCol(x)) ok = false;
        if (!ok) continue;
        c.g.forEach((row, r) => row.forEach((ch, x) => { rows[y0 + r][x0 + x] = ch; }));
        return { start: [x0 + c.start[0], y0 + c.start[1]], end: [x0 + c.end[0], y0 + c.end[1]] };
      }
    }
    return null;
  }
  // Hide prize ('¢' or '?') at the end of a secret section: a portal (pair letter k) standing
  // at spot [x, y] (somewhere out of the way) leads down into a course in the band from row
  // y0, the prize at its end; for a coin, a portal back (letter k + 1) lets you out two tiles
  // to the first portal's side. False if there's no room (rows are then left as they were).
  function hideOpen(rows, [x, y], prize, seed, y0, k, kind) {
    const t = rows.map(r => r.slice()), D = LF.PORTALS.doors, Lnd = LF.PORTALS.lands;
    const air = (cx, cy) => t[cy]?.[cx] === '.', ground = (cx, cy) => floor(t[cy + 1]?.[cx] || '.');
    const side = [1, -1].find(d => [0, 1, 2].every(j => air(x + j * d, y) && air(x + j * d, y - 1)) && ground(x, y) && ground(x + 2 * d, y));
    if (!side) return false;
    const sec = section(t, y0, seed, kind);
    if (!sec) return false;
    t[y][x] = D[k];
    t[sec.start[1]][sec.start[0]] = Lnd[k];
    t[sec.end[1]][sec.end[0]] = prize;
    if (prize !== '?') { t[sec.end[1]][sec.end[0] + 2] = D[k + 1]; t[y][x + 2 * side] = Lnd[k + 1]; }
    rows.splice(0, rows.length, ...t);
    return true;
  }

  LF.sections = { addBand, hideOpen, course, KINDS, BAND, MARKS: 'PDLjnĵň?ⓐⓑⓒⓓⓔⓕⓖⒶⒷⒸⒹⒺⒻⒼ' };

  // Can the checker b reach the coin just added to t (one that isn't in rows)?
  function coinSeen(t, rows, b, w) {
    for (let y = 0; y < t.length; y++) for (let x = 0; x < w; x++) if (t[y][x] === '¢' && rows[y]?.[x] !== '¢') return !!b.seen[y * w + x];
    return false;
  }
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  LF.addCoins = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), h = map.length, w = map[0].length;
    const marks = [];
    map.forEach((r, y) => [...r].forEach((c, x) => { if (LF.sections.MARKS.includes(c)) marks.push([x, y]); }));
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
    const open = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++)
      if ((map[y][x] === '.' || map[y][x] === '~') && clear(x, y) && reach(x, y)) open.push({ x, y, score: away(x, y) });
    if (open.length < 3) { cache.set(def.name, def); return def; }
    const along = tall ? (x, y) => h - 1 - y : x => x, span = tall ? h : w;
    let rows = map.map(r => r.split(''));
    // Each coin's section is a different kind, and which three changes from level to level.
    const kinds = KINDS.slice().sort((p, q) => hash(def.name + p) - hash(def.name + q));
    // (The secret sections go in bands of rock under the level, a new band whenever there's
    // no room left in the last.)
    const bands = [];
    const used = [], slots = [];
    for (let k = 0; k < 3; k++) {
      const a0 = span * k / 3, a1 = span * (k + 1) / 3, inBand = (x, y) => along(x, y) >= a0 && along(x, y) < a1;
      const apart = (x, y) => used.every(([ux, uy]) => Math.abs(ux - x) > 8 || Math.abs(uy - y) > 6);
      let done = false;
      // A portal, out of the way, down into a secret section (portal letters 1+2k down, 2+2k
      // back: 0 is the secret exit's, see secrets.js).
      if (a.ok) for (const o of open.filter(p => inBand(p.x, p.y) && apart(p.x, p.y)).sort((p, q) => q.score - p.score).slice(0, 12)) {
        let t = null, nb = null;
        for (const y0 of bands) { const c = rows.map(r => r.slice()); if (hideOpen(c, [o.x, o.y], '¢', hash(def.name) + k, y0, 1 + 2 * k, kinds[k])) { t = c; break; } }
        if (!t) { const c = rows.map(r => r.slice()); nb = addBand(c); if (hideOpen(c, [o.x, o.y], '¢', hash(def.name) + k, nb, 1 + 2 * k, kinds[k])) t = c; }
        if (!t) continue;
        const b = LF.analyze({ ...def, map: t.map(r => r.join('')) });
        if (!b.ok || b.litOk !== a.litOk || !coinSeen(t, rows, b, w)) continue;
        rows = t; used.push([o.x, o.y]); done = true; if (nb != null) bands.push(nb); break;
      }
      if (!done) {
        const o = open.filter(p => inBand(p.x, p.y) && apart(p.x, p.y) && rows[p.y][p.x] === map[p.y][p.x]).sort((p, q) => q.score - p.score)[0];
        if (o) { rows[o.y][o.x] = '¢'; used.push([o.x, o.y]); }
      }
      // (Where this third's coin went, so it's coin k wherever it is: see engine.js.)
      for (let y = 0; y < rows.length; y++) for (let x = 0; x < w; x++) if (rows[y][x] === '¢' && !slots.some(([sx, sy]) => sx === x && sy === y)) slots.push([x, y]);
    }
    const out = { ...def, map: rows.map(r => r.join('')), coinSlots: slots };
    cache.set(def.name, out);
    return out;
  };
})();
