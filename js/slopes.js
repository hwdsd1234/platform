// Lanternfall: sloped ground. Where the ground of a story level steps up by a single block
// (stone you can walk along, then a block's step up to more of it, open air over both), the
// step becomes a slope (/ up to the right, \ up to the left; see engine.js): you walk up it,
// and a Shellback's shell lying on one slides off down it, faster and faster. A run of steps
// becomes a long ramp. And story levels get hills on their long flat stretches (see below). Built when you play a level, the same every time. Load after
// lengthen.js, before coins.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const HILL_EVERY = 50, MAX_HILLS = 4;
  LF.addSlopes = def => {
    if (!def || !Array.isArray(def.map)) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), rows = map.map(r => r.split('')), h = rows.length, w = rows[0].length;
    // (Every step is judged on the level as it was, so a staircase becomes a whole ramp.)
    const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? map[y][x] : '#');
    let n = 0;
    for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      // The step's corner: open here and over it, stone under it.
      if (at(x, y) !== '.' || at(x, y - 1) !== '.' || at(x, y + 1) !== '#') continue;
      for (const [d, c] of [[1, '/'], [-1, '\\']]) {
        // Up to stone on one side (open over it), open on the other (down to more ground, or
        // the step below, itself a slope).
        if (at(x + d, y) === '#' && at(x + d, y - 1) === '.' && at(x - d, y) === '.' && (at(x - d, y + 1) === '#' || at(x - d, y + 1) === '.' && at(x - d, y + 2) === '#')) { rows[y][x] = c; n++; break; }
      }
    }
    // Hills: on long flat stretches of ground (with room over them), in story levels, about one
    // every HILL_EVERY columns: ramps up, a top, ramps down, two or three blocks high, and a
    // Shellback on top of most of them (its shell rolls down either side). Each is kept only
    // if the level can still be finished just as before (LF.analyze).
    if (!def.boss && !def.arenaX && !def.sky && !def.pear) {
      const a0 = LF.analyze({ ...def, map: rows.map(r => r.join('')) });
      const marks = [];
      rows.forEach((r, y) => r.forEach((c, x) => { if ('PDLjnĵň?'.includes(c)) marks.push([x, y]); }));
      const nearMark = (x0, x1, y0, y1) => marks.some(([mx, my]) => mx >= x0 - 3 && mx <= x1 + 3 && my >= y0 - 3 && my <= y1 + 2);
      let hills = 0, lastX = -99;
      const cur = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? rows[y][x] : '#');
      for (let y = 6; y < h - 1 && hills < MAX_HILLS; y++) for (let x = 2; x < w - 2 && hills < MAX_HILLS; x++) {
        const H = 2 + ((x * 7 + y * 3) % 2), L = 2 * H + 4 + ((x + y) % 4);
        if (x - lastX < HILL_EVERY || x + L >= w - 2) continue;
        let flat = true;
        for (let k = 0; k < L && flat; k++) {
          if (cur(x + k, y + 1) !== '#') flat = false;
          for (let r = y - H - 2; r <= y && flat; r++) if (cur(x + k, r) !== '.') flat = false;
        }
        if (!flat || nearMark(x, x + L - 1, y - H - 2, y)) continue;
        const t = rows.map(r => r.slice());
        for (let i = 0; i < H; i++) {
          const yy = y - i, xa = x + i, xb = x + L - 1 - i;
          t[yy][xa] = '/'; t[yy][xb] = '\\';
          for (let xx = xa + 1; xx < xb; xx++) t[yy][xx] = '#';
        }
        if (hills % 3 !== 2 && a0.ok) t[y - H][x + (L >> 1)] = 'ĸ';
        const b = LF.analyze({ ...def, map: t.map(r => r.join('')) });
        if (a0.ok && (!b.ok || b.litOk !== a0.litOk)) continue;
        rows.splice(0, rows.length, ...t); n += 2 * H; hills++; lastX = x;
      }
    }
    const out = n ? { ...def, map: rows.map(r => r.join('')), slopes: n } : def;
    cache.set(def.name, out);
    return out;
  };
})();
