// Lanternfall: story levels made longer. Each level (not the towers and castles, which are
// built long in bosses.js) runs on into more sections, as many as it takes to make it at
// least twice as long, with no doors between them: each section is raised or lowered so its
// start is level with where the last one's door was, and an open corridor (with a floor
// under it) runs from there into it. Only the last section keeps its door, and only the first
// its start.
// - Most levels: sections from the level generator, the same shape and size as the level and
//   as hard as its world.
// - Sky Roads and Pear Cliffs levels: the level again (no floors to add there, and the gaps
//   are for gliding).
// It keeps one lantern, the one nearest its middle. Every join is checked with LF.analyze; a
// generated section that won't join gives way to the level itself again, and if that won't
// either it's left out (for a level the checker already finds fault with, it's kept all
// the same). Built when you play a level (it takes a moment), the same every
// time. Load after gen.js and worlds.js.
(() => {
  const LF = window.LF;
  const GAP = 2, LONGER = 2.25;   // (a little over 2)
  const cache = new Map();
  const hash = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const room = rows => rows.reduce((n, r) => n + r.replace(/#/g, '').length, 0);
  const find = (rows, c) => { for (let y = 0; y < rows.length; y++) { const x = rows[y].indexOf(c); if (x >= 0) return [x, y]; } return null; };
  const firm = c => '#CTHi<>=O123'.includes(c);
  // Join section q onto the level so far, g: line q's start up with g's door and carve the
  // corridor between them. Both are arrays of equal-length strings; returns the new array.
  function attach(g, q) {
    const [xd, yd0] = find(g, 'D'), [xp, yp] = find(q, 'P');
    const rows = g.map(r => r.split('')), w0 = rows[0].length, qw = q[0].length;
    let yd = yd0, dy = yd - yp;
    // (Room above for the corridor and for q, and below for q.)
    const top = Math.max(0, 3 - yd, -dy);
    for (let k = 0; k < top; k++) rows.unshift(Array(w0).fill('#'));
    yd += top; dy += top;
    while (rows.length < dy + q.length || rows.length < yd + 2) rows.push(Array(w0).fill('#'));
    const x0 = w0 + GAP;
    rows.forEach((r, y) => { const qy = y - dy; r.push(...Array(GAP).fill('#'), ...(qy >= 0 && qy < q.length ? q[qy].split('') : Array(qw).fill('#'))); });
    // The corridor: three rows of air from the door to q's start, a floor under it. (The old
    // door and q's start go: there's one door, at the end, and one start.)
    rows[yd][xd] = '.'; rows[yd][x0 + xp] = '.';
    for (let x = xd; x <= x0 + xp; x++) {
      for (let y = yd - 2; y <= yd; y++) if (!'LaobmspçƀD'.includes(rows[y][x])) rows[y][x] = '.';
      if (!firm(rows[yd + 1][x])) rows[yd + 1][x] = '#';
    }
    return rows.map(r => r.join(''));
  }
  function generated(def, k, world) {
    const rows = LF.normalize(def.map), h = rows.length, w = rows[0].length;
    const up = h > w * 1.2;
    const near = (v, sizes) => Object.entries(sizes).sort((a, b) => Math.abs(a[1] - v) - Math.abs(b[1] - v))[0][0];
    const opts = up ? { shape: 'up', size: near(h, { s: 34, m: 56, l: 84 }) } : { shape: 'right', size: near(w, { s: 48, m: 84, l: 130 }) };
    const g = LF.generate({ ...opts, seed: hash(def.name) + k * 1013, difficulty: Math.min(5, 1 + Math.floor((world || 0) / 2)) });
    // (In a pure-fruit level the extra sections grow its fruit; elsewhere, apples.)
    return LF.normalize(g.map).map(r => [...r].map(c => (LF.FRUITS[c] ? def.pureFruit || 'a' : c)).join(''));
  }
  LF.lengthen = def => {
    if (!def || def.boss || def.arenaX || !Array.isArray(def.map) || !find(def.map, 'D') || !find(def.map, 'P')) return def;
    if (cache.has(def.name)) return cache.get(def.name);
    const base = LF.normalize(def.map);
    const pick = k => (def.sky || def.pear ? base : generated(def, k, def.world));
    // (A level the checker already finds fault with is lengthened all the same.)
    const strict = LF.analyze(def).ok;
    let map = base;
    for (let k = 1; room(map) < room(base) * LONGER && k < 14; k++) {
      // (A generated section that won't join on at the end gives way to the level itself again;
      // failing that, the section goes in before the level, its corridor running into the
      // level's start.)
      let done = false;
      for (const q of [pick(k), base]) {
        if (done || !find(q, 'P') || !find(q, 'D')) continue;
        for (const next of [attach(map, q), attach(q, map)]) if (!done && (!strict || LF.analyze({ ...def, map: next }).ok)) { map = next; done = true; }
      }
    }
    let out = map === base ? def : { ...def, map, lengthened: true };
    // One lantern for the whole level, the one nearest its middle (its door opens once that's
    // lit); the rest go.
    if (out !== def) {
      const lamps = [];
      out.map.forEach((r, y) => { for (let x = r.indexOf('L'); x >= 0; x = r.indexOf('L', x + 1)) lamps.push([x, y]); });
      const mid = out.map[0].length / 2, keep = lamps.sort((a, b) => Math.abs(a[0] - mid) - Math.abs(b[0] - mid))[0];
      out = { ...out, map: out.map.map((r, y) => r.replace(/L/g, (m, x) => (keep && x === keep[0] && y === keep[1] ? 'L' : out.map[y - 1]?.[x] === '~' ? '~' : '.'))) };
    }
    cache.set(def.name, out);
    return out;
  };
})();
