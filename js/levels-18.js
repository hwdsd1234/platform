// Lanternfall: the Bat Bridges, a chapter of stomp chains. Between the islands there's only the
// void, and across it a line of soot bats a row below the islands, each kept in its own tile
// (turn markers, |, either side). Run off the edge onto the first, and keep going: every stomp
// bounces you on to the next (hold jump for the bigger bounce, or you'll fall short). Touch
// nothing else, and don't stop. The level checker can't do bouncing off enemies, so these levels were checked with the
// real physics instead. bosses.js slots them in at the end of the Smokelands, before Smog
// Castle. Load after levels-17.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const lvl = (name, w, sign, draw) => ({ chapter: 'The Bat Bridges', name, sky: true, batChain: true, since: 18, dark: .35, signs: [{ x: 1, y: 8.4, t: sign }], map: B(w, 20, a => { a.r(0, 0, w - 1, 0); draw({ ...a, isle: isle(a), bats: bats(a) }); }) });
  // A floating island: a slab w wide at row y, tapering underneath.
  const isle = ({ r }) => (x, y, w) => { r(x, y, x + w - 1, y); if (w > 2) r(x + 1, y + 1, x + w - 2, y + 1); };
  // A chain of n bats from column x, gap apart, each at row y + rise * k, kept in its own tile
  // by turn markers either side (so it only bobs and wobbles). Returns the last one's column.
  // (A held-jump bounce carries you about four and a half tiles, so they're four and a half
  // apart on average: four, five, four, five.)
  // (move: every second bat drifts back and forth across three tiles instead, its markers
  // two out, so you time your bounce onto it.)
  const bats = ({ s }) => (x, y, n, gap = 4.5, rise = 0, move = false) => {
    // (A chain that rises or falls does it a row every second bat, gently.)
    for (let k = 0; k < n; k++) { const bx = x + Math.floor(k * gap), by = y + rise * Math.floor(k / 2), m = move && k % 2 ? 2 : 1; s(bx, by, 'F'); s(bx - m, by, '|'); s(bx + m, by, '|'); }
    return x + Math.floor((n - 1) * gap);
  };

  // A level: islands (w wide, top on row y) with a chain of bats between each and the next
  // (n bats, the chain one row below the island before it, rising rise every second bat), the first island
  // with the start, the last with the door; each chain starts two tiles out from an island's
  // edge, and the next island begins three past its last bat. Returns where each island is.
  const course = ({ s, isle, bats }) => (parts, endW) => {
    const at = [];
    let x = 0;
    parts.forEach(({ w, y, n, rise = 0, move }, k) => {
      isle(x, y, w); at.push({ x, y, w });
      if (k === 0) s(x + 2, y - 1, 'P');
      // (The next island's top a row over the last bat.)
      // (A chain with drifting bats is closer together, so a bat at the far end of its drift is
      // still in reach.)
      const last = bats(x + w + 1, y + 1, n, move ? 3.5 : 4.5, rise, move), ny = y + rise * Math.floor((n - 1) / 2);
      x = last + 3;
      if (k === parts.length - 1) { isle(x, ny, endW); at.push({ x, y: ny, w: endW }); s(x + endW - 5, ny - 1, 'D'); }
      else parts[k + 1].y = ny;
    });
    return at;
  };

  // A tower of bats: up a shaft over the void, bounce by bounce, each bat three rows above the
  // last and two tiles over (an updraft, def.batLift, lifts a held bounce about five and a half
  // rows, clear over the next bat before you come down on it), zigzagging
  // between the walls; a ledge to rest on (with a lantern) every so often, and the door on
  // a ledge at the top. In the upper half, every third bat drifts.
  const tower = (H, legs) => B(18, H, ({ r, s }) => {
    r(0, 0, 17, 0); r(0, 0, 0, H - 1); r(17, 0, 17, H - 1);
    let y = H - 6;
    r(1, y, 5, y); s(2, y - 1, 'P');
    // (The first bat of each stretch is level with the ledge you leave, three tiles out: hop off onto it.)
    let bx = 8, by = y, dir = 1;
    legs.forEach((n, leg) => {
      for (let k = 0; k < n; k++) {
        const m = leg >= legs.length / 2 && k % 3 === 2 ? 2 : 1;
        s(bx, by, 'F'); s(bx - m, by, '|'); s(bx + m, by, '|');
        // (A star coin in each stretch, halfway up, right on the way: between this bat and the
        // next, a row over the next, where the bounce up to it carries you anyway.)
        if (k === n >> 1) s(bx + dir, by - 4, '¢');
        if (k < n - 1) { if (bx + 2 * dir > 13 || bx + 2 * dir < 4) dir = -dir; bx += 2 * dir; by -= 3; }
      }
      // (The ledge: three rows over the last bat, starting two tiles on the side it was heading.)
      const lx = bx + 2 * dir, ly = by - 3, [x0, x1] = dir > 0 ? [Math.min(lx, 13), 16] : [1, Math.max(lx, 4)];
      r(x0, ly, x1, ly);
      if (leg === legs.length - 1) s(dir > 0 ? x1 - 1 : x0 + 1, ly - 1, 'D');
      else {
        s(dir > 0 ? x1 - 1 : x0 + 1, ly - 1, 'L');
        // (Off the ledge the other way, onto the next bat, level with it and two tiles back past
        // the last bat, clear of the way up to the ledge.)
        dir = -dir; bx = (dir > 0 ? x1 : x0) + 4 * dir; by = ly;
      }
    });
  });

  LF.BAT_LEVELS = [
    lvl('Bat Bridge', 130, 'STOMP CHAIN: run off the edge onto the bats, and hold jump to bounce on along them', a => {
      const at = course(a)([{ w: 10, y: 14, n: 4 }, { w: 9, n: 5 }, { w: 10, n: 6 }], 18); a.s(at[1].x + 4, at[1].y - 1, 'L');
    }),
    lvl('Rising Flock', 130, 'the bats lead upward', a => {
      const at = course(a)([{ w: 10, y: 16, n: 4, rise: -1 }, { w: 9, n: 4, rise: -1 }, { w: 10, n: 5 }], 18); a.s(at[2].x + 4, at[2].y - 1, 'L');
    }),
    lvl('Long Flock', 160, 'longer chains: keep bouncing', a => {
      const at = course(a)([{ w: 10, y: 14, n: 6 }, { w: 8, n: 8 }, { w: 8, n: 7 }], 18); a.s(at[1].x + 3, at[1].y - 1, 'L');
    }),
    lvl('Bats and Shells', 150, 'a Shellback on each island: mind it as you land', a => {
      const at = course(a)([{ w: 10, y: 14, n: 5 }, { w: 12, n: 5 }, { w: 12, n: 6 }], 20);
      a.s(at[2].x + 4, at[2].y - 1, 'L'); for (const k of [1, 2, 3]) a.s(at[k].x + at[k].w - 3, at[k].y - 1, 'ĸ');
    }),
    // Moving bats: every second bat in each chain drifts to and fro.
    { ...lvl('Drifting Flock', 140, 'every second bat drifts to and fro: time each bounce', a => {
      const at = course(a)([{ w: 10, y: 14, n: 4, move: true }, { w: 9, n: 5, move: true }, { w: 10, n: 6, move: true }], 18); a.s(at[1].x + 4, at[1].y - 1, 'L');
    }), since: 20 },
    // A vertical climb, bat by bat.
    { chapter: 'The Bat Bridges', name: 'Bat Tower', sky: true, batChain: true, batLift: 1.35, keepLength: true, noCrowd: true, since: 20, dark: .4,
      signs: [{ x: 1, y: 76.4, t: 'BAT TOWER: an updraft lifts every bounce: hold jump and bounce up bat to bat to the top' }],
      map: tower(84, [8, 7, 8]) },
  ];
})();
