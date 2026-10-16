// Lanternfall: the Star Road, the special world after the Last Dark. It has a level for each
// world, opened by holding every star coin in that world (ui.js). Each is a level from that
// world (the one in the middle of it), just as long as it is when you play it there (see
// lengthen.js), made far harder:
// - no big ammo crates (the fruit stays);
// - tough enemies all along the way (and quicker than anywhere else), fliers in the air;
// - spikes on the floor wherever the way through still holds (each batch checked with
//   LF.analyze, and taken back if it doesn't);
// - darker.
// Built when you play it (it takes a moment), the same every time. Load after worlds.js,
// lengthen.js and coins.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const FOES = ['K', 'R', 'S', 'A', 'J', 'G', 'I', 'Z'], FLIERS = ['W', 'F', 'Z'];
  const near = (marks, x, y, d) => marks.some(([mx, my]) => Math.abs(mx - x) <= d && Math.abs(my - y) <= d);
  // The level a Star Road level is made from: the one in the middle of its world.
  LF.starSource = def => {
    const w = LF.WORLDS[def.starOf], L = LF.LEVELS;
    const pool = []; for (let i = w.first; i <= w.last; i++) if (!L[i].boss && L[i].starOf == null) pool.push(L[i]);
    return pool[Math.floor(pool.length / 2)];
  };
  LF.starLevel = def => {
    if (def.starOf == null) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const src = LF.starSource(def), base = LF.lengthen(src);
    let rows = LF.normalize(base.map).map(r => [...r].map(c => (c === 'Q' || c === '$' ? '.' : c)));
    const h = rows.length, wd = rows[0].length, R = LF.rng(4040 + def.starOf * 97);
    const marks = []; rows.forEach((r, y) => r.forEach((c, x) => { if ('PDLjn'.includes(c)) marks.push([x, y]); }));
    const ok = rs => LF.analyze({ ...base, map: rs.map(r => r.join('')) }).ok;
    const strict = ok(rows);
    const seen = LF.analyze({ ...base, map: rows.map(r => r.join('')) }).seen;
    const stands = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < wd - 1; x++) if (seen[y * wd + x] && rows[y][x] === '.' && rows[y + 1][x] === '#' && !near(marks, x, y, 4)) stands.push([x, y]);
    // Enemies along the way, one every few columns, and fliers above.
    const foes = [];
    let lastX = -99;
    for (const [x, y] of stands.sort((a, b) => a[0] - b[0])) {
      if (x - lastX < 4) continue;
      rows[y][x] = FOES[Math.floor(R() * FOES.length)]; foes.push([x, y]); lastX = x;
      if (R() < .35 && y > 3 && rows[y - 3][x] === '.') rows[y - 3][x] = FLIERS[Math.floor(R() * FLIERS.length)];
    }
    // Spikes on the floor, in batches, keeping only what leaves the way through.
    const spikeSpots = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < wd - 1; x++) if (rows[y][x] === '#' && rows[y - 1][x] === '.' && seen[(y - 1) * wd + x] && !near(marks, x, y - 1, 3) && !near(foes, x, y - 1, 1)) spikeSpots.push([x, y]);
    for (let i = spikeSpots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [spikeSpots[i], spikeSpots[j]] = [spikeSpots[j], spikeSpots[i]]; }
    const want = Math.floor(spikeSpots.length * .45);
    for (let k = 0, placed = 0; k < spikeSpots.length && placed < want; k += 8) {
      const batch = spikeSpots.slice(k, k + 8).filter(([x, y]) => rows[y][x] === '#' && rows[y][x - 1] !== '^' && rows[y][x + 1] !== '^');
      for (const [x, y] of batch) rows[y][x] = '^';
      if (!strict || ok(rows)) placed += batch.length;
      else for (const [x, y] of batch) rows[y][x] = '#';
    }
    const tuning = Object.fromEntries([...FOES, ...FLIERS].map(t => [t, { speed: 1.6 }]));
    const out = { ...def, map: rows.map(r => r.join('')), tuning, dark: .92, lengthened: true, starFrom: src.name };
    cache.set(def.name, out);
    return out;
  };
})();
