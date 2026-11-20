// Lanternfall: rides, a gimmick in every world. In a ride you step onto a long car at the
// start and it carries you the whole level along its track (def.ride: see engine.js), fast
// (like a coaster), the track hardly ever straight, the car bending over every hill and dip,
// and at the end of the track it flies off and falls: jump for the door's ledge. Stay on it,
// a lava floor below. On the way:
// - walls across the track with a slot for the car: jump them (in the air you keep going
//   with the car, so jump in good time);
// - spiked tunnels: keep your head down;
// - dunks: the track dives down into the lava floor and the car's under for half a second:
//   jump just before it dives and land on the car as it climbs back out (lava bubbles leap out
//   of some);
// - shot gates: a door right across the track: shoot it open (three hits) before you get there
//   (there are two ammo crates just before each);
// - fire bars and pendulums swinging over the track;
// - fliers, lots: at head height, overhead and up high.
// Lanterns you light as you pass under them (and come back to, the car waiting), three star
// coins and a yellow apple over the track to jump for. Each world has its own
// (LF.WORLD_RIDES, slotted in before its castle by bosses.js); the Ferry Line's
// (LF.RIDE_LEVELS) close the Canal District's Pear Cliffs. Built the same every time, from
// each level's seed. Load after levels-19.js, before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const H = 18, F = 12;     // (the car starts on row F, level with the start ledge)
  const SPEED = 360;        // (pixels a second: four times the old ferries)
  const W_LEN = 800;        // (tiles: about a minute's ride at that speed)
  const RW = 14;            // (the car's length in tiles: a long coaster car, room to move about on)
  const GAP_END = 4;        // (tiles from the track's end to the door's ledge: the car falls, you jump)
  const LAVA_TOP = 13;      // (a lava floor under every ride, from this row down: the track runs above it, and dunks into it)
  const LOW = LAVA_TOP - 1; // (the lowest the track runs, just over the lava)

  function ride(name, seed, { chapter, since, foes = 'F', lava = false, dark = .55, w = W_LEN }) {
    const R = LF.rng(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
    // The track: a little flat to board on, then up and down all the way (a short flat now and
    // then), between row 6 and LOW (just over the lava floor), with dunks down into the lava.
    const path = [[5, F], [14, F]], dips = [];
    let x = 14, y = F;
    while (x < w - 40) {
      if (x > 40 && R() < .1 && (!dips.length || x - dips[dips.length - 1].x1 > 45)) {
        // A dunk: down to just over the lava (if it isn't there already), then into it, three rows
        // down, under for two tiles, and up again (the car's under about half a second).
        if (y < LOW) { x += (LOW - y) * 2; y = LOW; path.push([x, y]); }
        path.push([x + 2, y + 3], [x + 4, y + 3], [x + 6, y]); dips.push({ x0: x, x1: x + 6, y }); x += 6;
        continue;
      }
      if (R() < .1) { x += ri(3, 6); path.push([x, y]); continue; }
      let dy = R() < .5 ? -ri(1, 3) : ri(1, 3);
      dy = Math.max(6 - y, Math.min(LOW - y, dy)); if (!dy) dy = y > 9 ? -1 : 1;
      x += Math.abs(dy) * ri(2, 3); y += dy; path.push([x, y]);
    }
    // (Up off the lava for the end, so the door's ledge is clear of it.)
    if (y > 9) { x += (y - 9) * 2; y = 9; path.push([x, y]); }
    const endRow = y;
    path.push([w - 6 - GAP_END, y]);
    // The track's height at column c (fractional), and the highest and lowest it is across it.
    const yAt = c => {
      for (let k = 0; k < path.length - 1; k++) {
        const [x0, y0] = path[k], [x1, y1] = path[k + 1];
        if (c >= x0 && c <= x1) return y0 + (y1 - y0) * (c - x0) / Math.max(1e-6, x1 - x0);
      }
      return path[path.length - 1][1];
    };
    // (Rows above this one are over the car at column c: a wall from the row above it down
    // meets the car, with no gap to squeeze through, wherever the track's going.)
    const top = c => Math.ceil(Math.min(yAt(c), yAt(c + 1)) - 1e-6);
    const under = c => Math.floor(Math.max(yAt(c), yAt(c + 1)) + .4) + 1; // (rows from this down are under it)
    const map = B(w, H, ({ r, s, lava: fillLava }) => {
      fillLava(LAVA_TOP);
      r(0, F, 4, H - 1); s(2, F - 1, 'P');
      // (The door on a ledge of its own past the end of the track, two below it, open below.)
      r(w - 6, endRow + 2, w - 1, endRow + 3); s(w - 3, endRow + 1, 'D');
      const busy = new Set();
      const free = (a, b) => { for (let c = a; c <= b; c++) if (busy.has(c)) return false; return true; };
      const take = (a, b) => { for (let c = a; c <= b; c++) busy.add(c); };
      // (Where no flier goes: just before a wall, round a dunk, in a tunnel, right at a trap.)
      const nofoe = new Set(), keepClear = (a, b) => { for (let c = a; c <= b; c++) nofoe.add(c); };
      take(0, 16); take(w - 8 - RW, w - 1);
      // (Nothing under the track where a wall or tunnel crosses it: miss your jump and you fall,
      // never caught in the slot the car goes through.)
      const below = () => {};
      // The dunks: the lava, now and then a lava bubble; nothing else near (jump the dunk, and
      // land on the car as it comes out).
      for (const d of dips) {
        r(d.x0, d.y + 1, d.x1, H - 1, '!');
        if (R() < .35) s(d.x0 + 1, d.y + 2, '*');
        take(d.x0 - 12, d.x1 + 8); keepClear(d.x0 - 12, d.x1 + 8);
      }
      // Along the track, first the hazards, every 18 to 30 tiles, each kind in turn (shuffled,
      // so every ride has all of them, in its own order): walls, tunnels, shot gates, fire bars,
      // pendulums. Then fliers in the spaces between.
      const KINDS = ['wall', 'tunnel', 'shot', 'firebar', 'pendulum', 'wall', 'tunnel', 'shot'];
      for (let k = KINDS.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [KINDS[k], KINDS[j]] = [KINDS[j], KINDS[k]]; }
      let turn = 0;
      for (let c = 24; c < w - 30; c += ri(18, 30)) {
        const kind = KINDS[turn % KINDS.length], t = top(c);
        // (A wall only where the track isn't climbing up to it, or you'd take off too low to clear
        // it; two high only where it's level or going down.)
        const climb = yAt(c - 6) - yAt(c + 1);
        if (kind === 'wall' && climb <= .5 && free(c - 10, c + 4)) {
          const tall = climb <= 0 && R() < .35 ? 2 : 1; r(c, t - tall, c, t - 1); below(c); take(c - 10, c + 4); keepClear(c - 10, c + 2);
        } else if (kind === 'tunnel' && free(c - 8, c + 20)) {
          const len = ri(8, 12);
          for (let q = c; q < c + len; q++) { const tq = top(q); r(q, 0, q, tq - 4); s(q, tq - 3, '^'); below(q); }
          take(c - 8, c + len + 8); keepClear(c - 6, c + len + 1); c += len;
        } else if (kind === 'shot' && free(c - 28, c + 6)) {
          // A shot gate: a door across the track (three hits), reaching up past wherever the track runs in the twenty tiles before it, so a
          // straight shot from anywhere on the way hits it; ammo two seconds before it and nothing
          // in the way between, so your shots go to the door.
          // (And down past the lowest it runs there too: the car goes through the door's lower
          // blocks, but your shots from down there hit them.)
          let hi = t, lo = t - 1; for (let q = c - 20; q <= c; q++) { hi = Math.min(hi, top(q)); lo = Math.max(lo, top(q)); }
          r(c, 0, c, hi - 6); r(c, hi - 5, c, lo, 'v'); below(c);
          s(c - 22, top(c - 22) - 1, 'Q'); s(c - 15, top(c - 15) - 1, 'Q'); take(c - 28, c + 6); keepClear(c - 24, c + 2);
        } else if (kind === 'firebar' && free(c - 6, c + 6)) {
          s(c, t - 3, 'f'); take(c - 6, c + 6); keepClear(c - 3, c + 3);   // (its arm reaches down to the car)
        } else if (kind === 'pendulum' && free(c - 6, c + 6)) {
          r(c, 0, c, t - 5); s(c, t - 4, 'E'); take(c - 6, c + 6); keepClear(c - 4, c + 4);   // (its ball swings through head height)
        } else continue;
        turn++;
      }
      for (let c = 20; c < w - 30; c += ri(6, 10)) {
        let ok = true; for (let q = c - 1; q <= c + 1; q++) if (nofoe.has(q)) ok = false;
        if (!ok) continue;
        const t = top(c);
        s(c, t - (R() < .4 ? 1 : 2), pick(foes));
        if (R() < .25) s(c + 1, t - 5, pick(foes));
        keepClear(c - 1, c + 1); take(c - 1, c + 1);
      }
      // Things to have: three lanterns (lit as you pass under), three star coins and a yellow
      // apple up over the track (jump for them), apples, ammo and a green apple at hand height.
      const spot = (frac, up) => {
        for (let d = 0; d < 60; d++) for (const sg of [1, -1]) {
          const c = Math.round(w * frac) + sg * d;
          if (c > 16 && c < w - 14 && free(c - 1, c + 1)) { take(c - 1, c + 1); return [c, top(c) - up]; }
        }
        return null;
      };
      const put = (frac, up, ch) => { const at = spot(frac, up); if (at) s(at[0], at[1], ch); };
      for (const fr of [.25, .5, .75]) put(fr, 1, 'L');
      for (const fr of [.18, .55, .9]) put(fr, 3, '¢');
      put(.4, 3, 'ý'); put(.62, 1, 'ǵ');
      for (const fr of [.07, .15, .23, .31, .39, .47, .55, .63, .71, .79, .87, .95]) put(fr, 1, 'a');
      for (const fr of [.06, .2, .37, .52, .66, .8, .93]) put(fr, 1, 'q');
    });
    return { chapter, name, since, dark, map, ride: { path, speed: SPEED, w: RW }, keepLength: true, noCrowd: true };
  }

  // The Ferry Line: the Canal District's, after the Pear Cliffs.
  const FERRY = { chapter: 'The Ferry Line', since: 22, foes: 'FFFZ' };
  LF.RIDE_LEVELS = [
    ride('All Aboard', 2201, FERRY),
    ride('Ferry Hill', 2202, FERRY),
    ride('Low Bridge', 2203, FERRY),
    ride('Ember Ferry', 2204, { ...FERRY, lava: true }),
  ];
  // Every other world's: two each, in a chapter of its own, before its castle.
  LF.WORLD_RIDES = [
    { castle: 'Candle Keep', chapter: 'The Rooftop Rails', names: ['Rooftop Rush', 'Chimney Rails'], foes: 'F' },
    { castle: 'Sunken Keep', chapter: 'The Tide Rafts', names: ['Tide Rider', 'Gull Run'], foes: 'FFFZ' },
    { castle: 'Clockwork Castle', chapter: 'The Gear Rails', names: ['Cog Coaster', 'Spring Line'], foes: 'FFFZ' },
    { castle: 'Storm Castle', chapter: 'The Cloud Ferry', names: ['Cloud Skimmer', 'Gale Rails'], foes: 'FFFZ' },
    { castle: 'Pumpkin Castle', chapter: 'The Cart Track', names: ['Market Cart', 'Melon Run'], foes: 'FFFZ' },
    { castle: 'Smog Castle', chapter: 'The Ash Coaster', names: ['Ash Coaster', 'Cinder Dip'], foes: 'FFFZ', lava: true },
    { castle: 'Crystal Castle', chapter: 'The Mine Carts', names: ['Mine Cart Dash', 'Glass Rails'], foes: 'FFFZ' },
    { castle: 'Castle of the Last Dark', chapter: 'The Bone Coaster', names: ['Bone Coaster', 'Last Ride'], foes: 'FFFZ', lava: true, dark: .7 },
  ].map((wr, k) => ({ ...wr, levels: wr.names.map((n, j) => ride(n, 2300 + k * 10 + j, { chapter: wr.chapter, since: 23, foes: wr.foes, lava: wr.lava, dark: wr.dark })) }));
})();
