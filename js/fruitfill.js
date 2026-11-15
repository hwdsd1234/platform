// Lanternfall: a yellow apple in every level. Runs after everything else that builds or
// changes the levels' maps (so after secrets.js). Each level gets one on an open spot standing
// on stone about seven-tenths of the way along; a tower or castle (or a level with no such
// spot) has one of its fruit swapped for it (an apple if there is one, never the green
// apple). The level as it's played (lengthened, or made into a Star Road level) is checked
// again: if its yellow apple is gone or out of reach, it goes on a spot you can reach.
(() => {
  const LF = window.LF, Y = 'ý';
  const isFruit = c => !!LF.FRUITS[c];
  const has = d => d.map.some(r => r.includes(Y));
  // Open spots standing on stone (and, given `seen`, ones you can reach), along the level.
  const standSpots = (rows, seen) => {
    const w = rows[0].length, out = [];
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (y && rows[y + 1] && c === '.' && '#=i'.includes(rows[y + 1][x]) && rows[y - 1][x] === '.' && (!seen || seen[y * w + x])) out.push([x, y]);
    }));
    return out.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  };
  const fruitSpots = (rows, seen) => {
    const w = rows[0].length, out = [];
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (isFruit(c) && c !== 'ǵ' && c !== Y && (!seen || seen[y * w + x])) out.push([x, y, c]); }));
    return out;
  };
  const put = (rows, [x, y]) => { rows[y] = rows[y].slice(0, x) + Y + rows[y].slice(x + 1); };
  function place(rows, seen, boss) {
    const spots = boss ? [] : standSpots(rows, seen);
    if (spots.length) return put(rows, spots[Math.floor(spots.length * .7)]), true;
    const fruit = fruitSpots(rows, seen);
    const at = fruit.find(f => f[2] === 'a') || fruit[Math.floor(fruit.length / 2)];
    if (at) return put(rows, at), true;
    return false;
  }
  for (const d of LF.LEVELS) {
    if (!Array.isArray(d.map) || has(d)) continue;
    const rows = LF.normalize(d.map);
    if (place(rows, null, d.boss)) d.map = rows;
  }
  // As played: there, and within reach (by LF.analyze), or moved to where it is.
  const done = new WeakMap();
  function ensure(d) {
    if (!d || !Array.isArray(d.map) || d.boss || d.ride) return d;   // (a ride places its own)
    if (done.has(d)) return done.get(d);
    let out = d;
    try {
      const rows = LF.normalize(d.map), w = rows[0].length;
      const seen = LF.analyze({ ...d, map: rows }).seen;
      const reach = (x, y) => seen && [[0, 0], [-1, 0], [1, 0], [0, -1]].some(([dx, dy]) => seen[(y + dy) * w + x + dx]);
      let ok = false;
      rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === Y && reach(x, y)) ok = true; }));
      if (!ok && seen) {
        const clean = rows.map(r => r.split(Y).join('.'));
        if (place(clean, seen, false)) out = { ...d, map: clean };
      }
    } catch (e) { out = d; }
    done.set(d, out);
    return out;
  }
  const lengthen = LF.lengthen, starLevel = LF.starLevel;
  if (lengthen) LF.lengthen = lv => ensure(lengthen(lv));
  if (starLevel) LF.starLevel = def => (def.starOf == null ? starLevel(def) : ensure(starLevel(def)));
})();
