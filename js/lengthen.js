// Lanternfall: story levels four times as long. Each level (not the towers and castles,
// which are built long in bosses.js) is followed by more sections, joined by section
// doors (its door becomes a ĵ, each next section starts at an ň; the last keeps the door),
// as many as it takes to make it at least four times as long:
// - most levels: sections from the level generator, the same shape and size as the level
//   and as hard as its world;
// - Sky Roads levels: the level again, mirrored, then as it was, and so on (no floors to
//   add there).
// Every lengthened level is checked with LF.analyze; a section that won't fit is swapped
// for a mirrored copy of the level. Built when you play a level (it takes a moment), the
// same every time. Load after gen.js and worlds.js.
(() => {
  const LF = window.LF;
  const GAP = 2, LONGER = 4.5;   // (a little over 4, as sections swapped in after a check can be smaller)
  const cache = new Map();
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  // Mirror a map left to right (belts, turn blocks and wheels turn the other way).
  const FLIP = { '<': '>', '>': '<', ':': ';', ';': ':', x: ',', ',': 'x' };
  const mirror = rows => rows.map(r => [...r].reverse().map(c => FLIP[c] || c).join(''));
  // Sections side by side, standing on a common bottom, with solid rock between and above.
  function join(sections) {
    const H = Math.max(...sections.map(s => s.length));
    const out = Array.from({ length: H }, () => '');
    sections.forEach((s, k) => {
      const w = s[0].length, pad = H - s.length;
      for (let y = 0; y < H; y++) out[y] += (k ? '#'.repeat(GAP) : '') + (y < pad ? '#'.repeat(w) : s[y - pad]);
    });
    return out;
  }
  // A level's rows as the start of a section (its start an ň) and/or not the end (its door a ĵ).
  const asSection = (rows, first, last) => rows.map(r => {
    let s = r;
    if (!first) s = s.replace(/P/g, 'ň');
    if (!last) s = s.replace(/D/g, 'ĵ');
    return s;
  });
  function generated(def, k, world) {
    const rows = LF.normalize(def.map), h = rows.length, w = rows[0].length;
    const up = h > w * 1.2;
    const near = (v, sizes) => Object.entries(sizes).sort((a, b) => Math.abs(a[1] - v) - Math.abs(b[1] - v))[0][0];
    const opts = up ? { shape: 'up', size: near(h, { s: 34, m: 56, l: 84 }) } : { shape: 'right', size: near(w, { s: 48, m: 84, l: 130 }) };
    const g = LF.generate({ ...opts, seed: hash(def.name) + k * 1013, difficulty: Math.min(5, 1 + Math.floor((world || 0) / 2)) });
    return LF.normalize(g.map);
  }
  LF.lengthen = def => {
    if (!def || def.boss || def.arenaX || !Array.isArray(def.map) || !def.map.some(r => r.includes('D'))) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const base = LF.normalize(def.map), mirrored = mirror(base);
    const pick = k => (def.sky ? (k % 2 ? mirrored : base) : generated(def, k, def.world));
    // (Sections till it's at least LONGER times the level, counting the open tiles.)
    const room = rows => rows.reduce((n, r) => n + r.replace(/#/g, '').length, 0);
    const parts = [base];
    for (let k = 1, total = room(base); (total < room(base) * LONGER || parts.length < 4) && k < 12; k++) { const p = pick(k); parts.push(p); total += room(p); }
    // (A level the checker already finds fault with is lengthened all the same.)
    const strict = LF.analyze(def).ok;
    let out = null;
    for (let tries = 0; tries < 6 && !out; tries++) {
      const map = join(parts.map((p, k) => asSection(p, k === 0, k === parts.length - 1)));
      const cand = { ...def, map, lengthened: true };
      if (!strict || LF.analyze(cand).ok) out = cand;
      // (A section that won't do: swap the last generated one for the level mirrored.)
      else parts[parts.findLastIndex(p => p !== base && p !== mirrored)] = mirrored;
    }
    // (Still short of four times, after a swap? Add the level again, as it was or mirrored.)
    for (let k = 0; out && room(out.map) < room(base) * 4 && k < 6; k++) {
      parts.push(k % 2 ? base : mirrored);
      const cand = { ...def, map: join(parts.map((p, n) => asSection(p, n === 0, n === parts.length - 1))), lengthened: true };
      if (!strict || LF.analyze(cand).ok) out = cand; else parts.pop();
    }
    out ||= def;
    cache.set(def.name, out);
    return out;
  };
})();
