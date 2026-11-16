// Lanternfall: rides, a gimmick in every world. In a ride you step onto a raft at the start
// and it carries you the whole level along its track (def.ride: see engine.js), fast (like a
// coaster), its long car bending over the hills and down the dips, and at the end of the track
// it flies off and falls: jump for the door's ledge. Stay on it, there's nothing below (or
// lava). Walls stand across the track with a slot for the raft to slip through: jump them
// (in the air you keep going with the raft, so jump in good time); in the tunnels spikes hang
// low: keep your head down. Fliers along the way, lanterns you light as you pass under them
// (and come back to, the raft waiting), three star coins and a yellow apple over the track to
// jump for. Each world has its own (LF.WORLD_RIDES, slotted in before its castle by
// bosses.js); the Ferry Line's (LF.RIDE_LEVELS) close the Canal District's Pear Cliffs. Built
// the same every time, from each level's seed. Load after levels-19.js, before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const H = 18, F = 12;     // (the raft starts on row F, level with the start ledge)
  const SPEED = 360;        // (pixels a second: four times the old ferries)
  const W_LEN = 800;        // (tiles: about a minute's ride at that speed)
  const RW = 7;             // (the car's length in tiles: a long coaster car, room to move about on)
  const GAP_END = 4;        // (tiles from the track's end to the door's ledge: the car falls, you jump)

  function ride(name, seed, { chapter, since, foes = 'F', lava = false, dark = .55, w = W_LEN }) {
    const R = LF.rng(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
    // The track: flats, rises and drops (gentle enough to ride), between rows 6 and H - 5.
    const path = [[5, F]], flats = [];
    let x = 5, y = F;
    while (x < w - 40) {
      if (R() < .55 || x < 20) {
        const len = ri(16, 34);
        flats.push({ x0: x, x1: x + len, y }); x += len; path.push([x, y]);
      } else {
        let dy = R() < .5 ? -ri(2, 4) : ri(2, 4);
        dy = Math.max(6 - y, Math.min(H - 5 - y, dy)); if (!dy) dy = y > 9 ? -2 : 2;
        x += Math.abs(dy) * ri(2, 3); y += dy; path.push([x, y]);
      }
    }
    flats.push({ x0: x, x1: w - 6 - GAP_END, y }); path.push([w - 6 - GAP_END, y]);
    const ry = c => {
      for (let k = 0; k < path.length - 1; k++) {
        const [x0, y0] = path[k], [x1, y1] = path[k + 1];
        if (c >= x0 && c <= x1) return Math.round(y0 + (y1 - y0) * (c - x0) / Math.max(1, x1 - x0));
      }
      return path[path.length - 1][1];
    };
    const endRow = y;
    const map = B(w, H, ({ r, s, lava: fillLava }) => {
      if (lava) fillLava(H - 2);
      r(0, F, 4, H - 1); s(2, F - 1, 'P');
      // (The door on a ledge of its own past the end of the track, two below it, open below.)
      r(w - 6, endRow + 2, w - 1, endRow + 3); s(w - 3, endRow + 1, 'D');
      const busy = new Set();
      const free = (a, b) => { for (let c = a; c <= b; c++) if (busy.has(c)) return false; return true; };
      const take = (a, b) => { for (let c = a; c <= b; c++) busy.add(c); };
      take(0, 12); take(w - 8 - RW, w - 1);
      // Along each flat: walls (one or two high), tunnels, fliers, spaced out.
      for (const f of flats) {
        for (let c = f.x0 + 6; c < f.x1 - 6; c += ri(7, 11)) {
          const roll = R();
          // (A wall keeps the ten tiles before it clear of fliers: its jump shouldn't take you into one.)
          if (roll < .3 && free(c - 10, c + 4)) { const tall = R() < .35 ? 2 : 1; r(c, f.y - tall, c, f.y - 1); r(c, f.y + 1, c, H - 1); take(c - 10, c + 4); }
          else if (roll < .42 && c + 12 < f.x1 && free(c - 3, c + 15)) {
            const len = ri(8, 12);
            for (let t = c; t < c + len; t++) { r(t, 0, t, f.y - 4); s(t, f.y - 3, '^'); r(t, f.y + 1, t, H - 1); }
            take(c - 3, c + len + 3); c += len;
          } else if (roll < .9 && free(c - 2, c + 2)) { s(c, f.y - (R() < .5 ? 1 : 2), pick(foes)); take(c - 2, c + 2); }
        }
      }
      // Fliers over the hills and dips too.
      for (let k = 1; k < path.length - 1; k++) {
        const [x0, y0] = path[k - 1], [x1, y1] = path[k];
        if (y0 === y1) continue;
        const c = Math.round((x0 + x1) / 2);
        if (R() < .7 && free(c - 2, c + 2)) { s(c, ry(c) - 2, pick(foes)); take(c - 2, c + 2); }
      }
      // Things to have: three lanterns (lit as you pass under), three star coins and a yellow
      // apple up over the track (jump for them), apples, ammo and a green apple at hand height.
      const spot = (frac, up) => {
        for (let d = 0; d < 60; d++) for (const sg of [1, -1]) {
          const c = Math.round(w * frac) + sg * d;
          if (c > 14 && c < w - 14 && free(c - 1, c + 1)) { take(c - 1, c + 1); return [c, ry(c) - up]; }
        }
        return null;
      };
      const put = (frac, up, ch) => { const at = spot(frac, up); if (at) s(at[0], at[1], ch); };
      for (const fr of [.25, .5, .75]) put(fr, 1, 'L');
      for (const fr of [.18, .55, .9]) put(fr, 3, '¢');
      put(.4, 3, 'ý'); put(.62, 1, 'ǵ');
      for (const fr of [.12, .33, .7, .85]) put(fr, 1, 'a');
      for (const fr of [.06, .2, .37, .52, .66, .8, .93]) put(fr, 1, 'q');
    });
    return { chapter, name, since, dark, map, ride: { path, speed: SPEED, w: RW }, keepLength: true, noCrowd: true };
  }

  // The Ferry Line: the Canal District's, after the Pear Cliffs.
  const FERRY = { chapter: 'The Ferry Line', since: 22, foes: 'FFFW' };
  LF.RIDE_LEVELS = [
    ride('All Aboard', 2201, FERRY),
    ride('Ferry Hill', 2202, FERRY),
    ride('Low Bridge', 2203, FERRY),
    ride('Ember Ferry', 2204, { ...FERRY, lava: true }),
  ];
  // Every other world's: two each, in a chapter of its own, before its castle.
  LF.WORLD_RIDES = [
    { castle: 'Candle Keep', chapter: 'The Rooftop Rails', names: ['Rooftop Rush', 'Chimney Rails'], foes: 'F' },
    { castle: 'Sunken Keep', chapter: 'The Tide Rafts', names: ['Tide Rider', 'Gull Run'], foes: 'FFFW' },
    { castle: 'Clockwork Castle', chapter: 'The Gear Rails', names: ['Cog Coaster', 'Spring Line'], foes: 'FFFZ' },
    { castle: 'Storm Castle', chapter: 'The Cloud Ferry', names: ['Cloud Skimmer', 'Gale Rails'], foes: 'FFFW' },
    { castle: 'Pumpkin Castle', chapter: 'The Cart Track', names: ['Market Cart', 'Melon Run'], foes: 'FFFW' },
    { castle: 'Smog Castle', chapter: 'The Ash Coaster', names: ['Ash Coaster', 'Cinder Dip'], foes: 'FFFZ', lava: true },
    { castle: 'Crystal Castle', chapter: 'The Mine Carts', names: ['Mine Cart Dash', 'Glass Rails'], foes: 'FFFZ' },
    { castle: 'Castle of the Last Dark', chapter: 'The Bone Coaster', names: ['Bone Coaster', 'Last Ride'], foes: 'FFWZ', lava: true, dark: .7 },
  ].map((wr, k) => ({ ...wr, levels: wr.names.map((n, j) => ride(n, 2300 + k * 10 + j, { chapter: wr.chapter, since: 23, foes: wr.foes, lava: wr.lava, dark: wr.dark })) }));
})();
