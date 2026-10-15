// Lanternfall: star coins. Every story level, tower and castle hides three (¢), placed when
// you play it (the same every time): the level is split into thirds, start to end, and in
// each the coin goes high up (as near the highest spot you can reach there, by LF.analyze, as
// it can be while keeping to the middle of its third), away from the
// start, doors and lanterns, and not in a boss's arena. A level the checker can't follow (the
// Pear Cliffs' glides) takes any open spot standing on something instead. Load after
// lengthen.js.
(() => {
  const LF = window.LF;
  const cache = new Map();
  const AWAY = 4;   // tiles to keep clear of the start, doors and lanterns
  LF.addCoins = def => {
    if (!def || !Array.isArray(def.map) || def.timeLimit) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const map = LF.normalize(def.map), h = map.length, w = map[0].length;
    const marks = [];
    map.forEach((r, y) => [...r].forEach((c, x) => { if ('PDLjnĵň'.includes(c)) marks.push([x, y]); }));
    const a = LF.analyze({ ...def, map });
    const stand = (x, y) => y + 1 < h && '#=CiTH<>O123d'.includes(map[y + 1][x]);
    const ok = (x, y) => (map[y][x] === '.' || map[y][x] === '~') && !marks.some(([mx, my]) => Math.abs(mx - x) <= AWAY && Math.abs(my - y) <= AWAY) && !(def.arenaX && x >= def.arenaX);
    const spots = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!ok(x, y)) continue;
      if (a.ok ? a.seen[y * w + x] : stand(x, y)) spots.push([x, y]);
    }
    if (spots.length < 3) { cache.set(def.name, def); return def; }
    const xs = spots.map(s => s[0]), lo = Math.min(...xs), hi = Math.max(...xs) + 1;
    const rows = map.map(r => r.split(''));
    for (let k = 0; k < 3; k++) {
      const a0 = lo + (hi - lo) * k / 3, a1 = lo + (hi - lo) * (k + 1) / 3;
      const band = spots.filter(([x]) => x >= a0 && x < a1);
      if (!band.length) continue;
      // (Among the spots within two rows of the band's highest, the one nearest its middle, so
      // the three stay well apart.)
      const mid = (a0 + a1) / 2, top = Math.min(...band.map(p => p[1]));
      const [x, y] = band.filter(p => p[1] <= top + 2).sort((p, q) => Math.abs(p[0] - mid) - Math.abs(q[0] - mid))[0];
      rows[y][x] = '¢';
    }
    const out = { ...def, map: rows.map(r => r.join('')) };
    cache.set(def.name, out);
    return out;
  };
})();
