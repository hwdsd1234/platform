// Lanternfall: fruit for the story levels, and the Orchard chapter.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const L = LF.LEVELS;

  // Sprinkle fruit on free standing spots, spread along each level's route.
  const FREE = new Set(['.', '#', '=', '~']);
  L.forEach((lv, i) => {
    const g = lv.map.map(r => r.split(''));
    const h = g.length, w = g[0].length;
    const T = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '#' : g[y][x];
    const tall = h > w;
    const spots = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (T(x, y) !== '.' || T(x, y - 1) !== '.' || !(T(x, y + 1) === '#' || T(x, y + 1) === '=')) continue;
      let clear = true;
      for (let dy = -2; dy <= 2 && clear; dy++) for (let dx = -2; dx <= 2 && clear; dx++) if (!FREE.has(T(x + dx, y + dy))) clear = false;
      if (clear) spots.push({ x, y, k: tall ? -y * 4 + x * .1 : x - y * .1 });
    }
    spots.sort((a, b) => a.k - b.k);
    const want = w * h > 1500 ? 3 : 2;
    for (let n = 0; n < want && spots.length; n++) {
      const s = spots[Math.min(spots.length - 1, Math.round((n + .5) / want * spots.length))];
      g[s.y][s.x] = 'aob'[(i + n) % 3];
    }
    lv.map = g.map(r => r.join(''));
  });

  // Newer enemies join the story levels: rams from level 4, spiders from 6, sparks from 11.
  const OPEN = new Set(['.', '#', '=']);
  L.forEach((lv, i) => {
    if (i < 3) return;
    const g = lv.map.map(r => r.split(''));
    const h = g.length, w = g[0].length;
    const T = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? '#' : g[y][x];
    const floor = c => c === '#' || c === '=';
    let start = { x: 0, y: 0 };
    g.forEach((r, y) => r.forEach((c, x) => { if (c === 'P') start = { x, y }; }));
    const quiet = (x, y, rx, ry) => {
      for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) if (!OPEN.has(T(x + dx, y + dy))) return false;
      return Math.abs(x - start.x) + Math.abs(y - start.y) > 7;
    };
    // Standable run of at least n tiles centred on x, with only air above.
    const run = (x, y, n) => {
      for (let dx = -(n >> 1); dx <= n >> 1; dx++) if (T(x + dx, y) !== '.' || T(x + dx, y - 1) !== '.' || T(x + dx, y + 1) !== '#') return false;
      return true;
    };
    const pickSpot = test => {
      const c = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (test(x, y)) c.push({ x, y });
      return c.length ? c[(i * 7 + c.length * 3) % c.length] : null;
    };
    const put = (spot, ch) => { if (spot) g[spot.y][spot.x] = ch; };
    put(pickSpot((x, y) => run(x, y, 5) && quiet(x, y, 2, 1)), 'R');
    if (i >= 5) put(pickSpot((x, y) => T(x, y) === '.' && T(x, y - 1) === '#' && quiet(x, y, 1, 1) &&
      [2, 3, 4, 5].some(d => floor(T(x, y + d)) && [...Array(d - 1)].every((_, k) => T(x, y + 1 + k) === '.'))), 'X');
    if (i >= 10) put(pickSpot((x, y) => T(x, y) === '.' && run(x, y + 3, 5) && quiet(x, y, 2, 2)), 'Z');
    lv.map = g.map(r => r.join(''));
  });

  // ---- Chapter V: The Orchard ----
  L.push({
    chapter: 'The Orchard', name: 'Orchard Walls', dark: .5,
    signs: [
      { x: 1.2, y: 16.4, t: 'apple = heal' },
      { x: 15.1, y: 16, t: 'slide ↓' },
      { x: 20.5, y: 20.4, t: 'wall jump ↑' },
      { x: 21.5, y: 5.4, t: 'banana = double jump' },
      { x: 30.5, y: 15.4, t: 'orange = jump boost' },
    ],
    map: B(40, 26, ({ r, s, walls }) => {
      walls();
      r(1, 22, 17, 24); s(2, 21, 'P'); s(6, 21, 'a'); s(10, 21, 'B');
      r(13, 4, 14, 19);
      r(18, 4, 19, 24);
      s(16, 21, 'L');
      r(22, 7, 25, 7, '='); s(23, 6, 'b'); s(25, 6, 'L');
      r(20, 22, 38, 24); r(25, 21, 32, 21, '^');
      s(34, 21, 'o'); s(37, 21, 'L');
      r(33, 18, 36, 18); s(34, 17, 'D');
    }),
  });

  L.push({
    chapter: 'The Orchard', name: 'Banana Grove', dark: .58,
    signs: [{ x: 1, y: 11.4, t: 'fruit grows back' }],
    map: B(72, 16, ({ r, s, water }) => {
      r(0, 13, 8, 15); s(2, 12, 'P'); s(6, 12, 'b'); r(12, 12, 13, 12, 'C');
      r(17, 11, 22, 15); s(19, 10, 'L'); s(21, 7, 'F');
      r(24, 5, 25, 10); r(29, 3, 30, 9);
      r(23, 13, 34, 15); r(34, 11, 34, 12); s(28, 12, 'o');
      s(27, 2, 'L');
      r(36, 9, 40, 9, '='); s(38, 8, 'a');
      r(44, 11, 50, 15); s(47, 10, 'K');
      r(54, 7, 56, 7, 'C'); s(55, 6, 'L');
      r(52, 13, 58, 15); r(58, 11, 58, 12); s(57, 12, 'b');
      r(62, 10, 71, 15); s(65, 9, 'S'); s(69, 9, 'D');
      water(15);
    }),
  });

  L.push({
    chapter: 'The Orchard', name: 'Root Cellar', dark: .64,
    signs: [
      { x: 1, y: 6.6, t: 'spiders drop when you pass under' },
      { x: 21.5, y: 6.6, t: 'rams charge — stomp or dodge' },
      { x: 41.5, y: 6.6, t: 'sparks circle — wait for a gap' },
    ],
    map: B(60, 16, ({ r, s, water }) => {
      r(0, 0, 59, 4);
      r(0, 13, 16, 15); s(2, 12, 'P'); s(8, 5, 'X'); s(13, 5, 'X'); s(11, 12, 'L');
      r(21, 13, 36, 15); s(23, 12, 'a'); s(33, 12, 'R'); s(29, 12, 'L');
      r(26, 9, 29, 9, '=');
      s(38, 10, 'Z');
      r(41, 13, 59, 15); s(46, 10, 'Z'); s(50, 12, 'L'); s(54, 5, 'X'); s(57, 12, 'D');
      water(13);
    }),
  });
})();
