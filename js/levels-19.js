// Lanternfall: the Switch Works, a chapter of switch blocks. A switch block (§) flips when you
// bump it from below (or a kicked shell runs into it): the red blocks (Ʀ) go and the blue
// ones (ɓ) come, and back again on the next bump. Red is on to begin with. Walls that need
// opening, bridges that need building, stairs that need climbing, and blocks that go out
// from under you if you flip while standing on them. bosses.js slots them in at the end of
// the Powder Works, before Clockwork Castle. Load after levels-18.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const H = 16, F = 12;   // (the ground: rows F to the bottom; you stand on row F - 1)
  const lvl = (name, w, sign, draw, h = H) => ({ chapter: 'The Switch Works', name, since: 21, dark: .5, signs: [{ x: 1, y: h - 7.6, t: sign }], map: B(w, h, draw) });
  // A pit down into the void, x0 to x1, with a bridge of `c` across it at ground level.
  const pit = ({ r }) => (x0, x1, c) => { r(x0, F, x1, H - 1, '.'); if (c) r(x0, F, x1, F, c); };

  LF.SWITCH_LEVELS = [
    // A red wall to open, a blue bridge to build, and back again.
    lvl('Red Light, Blue Light', 92, 'SWITCH BLOCK: bump it from below: the red blocks go and the blue ones come', a => {
      const { r, s } = a, gap = pit(a);
      r(0, F, 91, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      s(11, F - 4, '§'); r(16, F - 5, 16, F - 1, 'Ʀ');
      gap(24, 30, 'ɓ'); s(38, F - 1, 'B');
      s(42, F - 1, 'L');
      s(47, F - 4, '§'); r(51, F - 5, 51, F - 1, 'ɓ');
      gap(56, 62, 'Ʀ');
      s(68, F - 4, '§'); r(72, F - 5, 72, F - 1, 'Ʀ');
      gap(76, 82, 'ɓ');
      s(88, F - 1, 'D');
    }),
    // Islands over the void, bridges between them red and blue in turn: flip on every island.
    lvl('Switchback Bridges', 112, 'flip the switch on each island for the next bridge', a => {
      const { r, s } = a, gap = pit(a);
      r(0, F, 111, H - 1); s(2, F - 1, 'P');
      const bridges = ['Ʀ', 'ɓ', 'Ʀ', 'ɓ', 'Ʀ', 'ɓ'];
      bridges.forEach((c, k) => {
        const x = 10 + k * 14;
        gap(x, x + 6, c);
        if (k < bridges.length - 1) { s(x + 10, F - 4, '§'); if (k === 2) s(x + 8, F - 1, 'L'); else if (k % 2) s(x + 12, F - 1, 'B'); }
      });
      s(106, F - 1, 'D');
    }),
    // A climb: stone ledges with a switch over each, and between them stairs of red or blue
    // that come and go as you flip.
    lvl('Switch Stairs', 56, 'climb: flip the switch over each ledge for the next stairs', a => {
      const { r, s } = a, h = 32, G = h - 4;
      r(0, 0, 55, 0); r(0, 0, 0, h - 1); r(55, 0, 55, h - 1); r(0, G, 55, h - 1);
      s(2, G - 1, 'P');
      // Ledges (stone) with a switch four rows over each, the stairs between them three over
      // and two up a step, red and blue in turn.
      const ledges = [[5, G - 2], [19, G - 10], [33, G - 18], [44, G - 24]];
      ledges.forEach(([x, y], k) => {
        r(x, y, x + 4, y);
        if (k < ledges.length - 1) {
          s(x + 2, y - 4, '§');
          const c = k % 2 ? 'Ʀ' : 'ɓ', [nx, ny] = ledges[k + 1];
          for (let sx = x + 6, sy = y - 2; sx < nx - 1 && sy > ny; sx += 3, sy -= 2) s(sx, sy, c), s(sx + 1, sy, c);
        }
      });
      s(21, G - 11, 'L');
      s(46, G - 25, 'D');
    }, 32),
    // The switch is at the end of a tunnel too low to jump in, full of spikes: send a shell
    // through to flip it, and the red gate opens.
    lvl('Shell Switch', 96, 'kick a Shellback’s shell down the spiked tunnel to hit the switch', a => {
      const { r, s } = a, gap = pit(a);
      r(0, 0, 95, 0); r(0, F, 95, H - 1); s(2, F - 1, 'P'); s(4, F - 1, 'a');
      s(10, F - 1, 'ĸ');
      // (The tunnel: a block of stone over a one-row passage, spikes down it, the switch at its end.)
      r(18, 2, 34, F - 2); r(21, F - 1, 31, F - 1, '^'); s(34, F - 1, '§');
      r(40, 1, 40, F - 1, 'Ʀ');
      s(46, F - 1, 'L');
      gap(54, 60, 'ɓ');
      s(70, F - 1, 'B'); s(76, F - 1, 'ĸ');
      s(90, F - 1, 'D');
    }),
    // Lava, stone pillars, and stepping blocks between them in red and blue: flip from a
    // pillar, never from a block (it goes out from under you).
    lvl('Over the Embers', 100, 'flip from the stone pillars: a block you’re standing on goes when you flip', a => {
      const { r, s } = a;
      r(0, F, 99, H - 1); s(2, F - 1, 'P');
      r(10, F, 89, F + 1, '!');
      const pillars = [26, 46, 66];
      for (const x of pillars) { r(x, F - 2, x + 2, F + 1); s(x + 1, F - 6, '§'); }
      s(47, F - 3, 'L');
      // (Stepping blocks, two wide, three apart: red from the start to the first pillar, then
      // blue, red, blue.)
      const runs = [[10, 25, 'Ʀ'], [29, 45, 'ɓ'], [49, 65, 'Ʀ'], [69, 89, 'ɓ']];
      runs.forEach(([x0, x1, c], k) => { for (let x = x0 + 1; x + 1 <= x1 - 1; x += 4) r(x, F - 1 - (k % 2), x + 1, F - 1 - (k % 2), c); });
      s(38, F, '*'); s(58, F, '*');
      s(95, F - 1, 'D');
    }),
  ];
})();
