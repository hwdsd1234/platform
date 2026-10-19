// Lanternfall: the Shell Skies, a chapter of the Sky Roads built on the shell jump, the most
// advanced trick there is. The gaps between the islands are too wide to jump (7 or 8 tiles; a
// running jump goes 5). Each island has a short wall near its start and a ramp up to its far
// edge, and a Shellback. Stomp it, pick up its shell (hold S and run into it), and go to the
// top of the ramp. Face back and throw the shell (S) at the wall: it shoots off, bounces back,
// comes up the ramp and flies off the top. Jump as it comes, holding on, and land on it in the
// air: a stomp in mid-air bounces you high, far enough to cross. (Get it wrong and it's you the
// shell runs into.) A Shellback that falls off the islands walks back on where it started
// (def.shellsReturn), so there's always another go. The level checker can't do shell jumps,
// so these levels were checked with the real physics instead. bosses.js slots them in after
// the rest of the Sky Roads. Load after levels-16.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const sky = (name, w, sign, draw) => ({ chapter: 'The Shell Skies', name, sky: true, shellsReturn: true, since: 17, dark: .3, signs: [{ x: 1, y: 8.4, t: sign }], map: B(w, 20, a => { a.r(0, 0, w - 1, 0); draw({ ...a, island: island(a) }); }) });
  // An island at column x, its top on row y, len long: room to land, then a wall two high to
  // throw shells at, a long run with a Shellback on it, and a ramp up to the far edge (unless
  // it's the last). Returns the column just past its far edge.
  const island = ({ r, s }) => (x, y, len, { ramp = true, foe = true } = {}) => {
    const x1 = x + len - 1;
    r(x, y, x1, y); r(x + 1, y + 1, x1 - 1, y + 1);
    if (ramp) { s(x + 4, y - 1, '#'); s(x + 4, y - 2, '#'); s(x1 - 2, y - 1, '/'); r(x1 - 1, y - 1, x1, y - 1); }
    if (foe) s(x + 10, y - 1, 'ĸ');
    return x1 + 1;
  };

  LF.SHELL_SKY_LEVELS = [
    sky('Shell Jump', 112, 'SHELL JUMP: from the ramp top, throw a shell back at the wall, then stomp it in the air', ({ s, island }) => {
      let x = island(0, 14, 24); s(1, 13, 'P');
      x = island(x + 7, 14, 24);
      x = island(x + 7, 14, 24); s(x - 20, 13, 'L');
      island(x + 7, 14, 16, { ramp: false, foe: false }); s(x + 18, 13, 'D');
    }),
    sky('Shell Stairs', 120, 'the shell jump takes you up as well as across', ({ s, island }) => {
      let x = island(0, 16, 24); s(1, 15, 'P');
      x = island(x + 7, 15, 24);
      x = island(x + 7, 14, 24); s(x - 20, 13, 'L');
      island(x + 7, 13, 16, { ramp: false, foe: false }); s(x + 18, 12, 'D');
    }),
    sky('Bat Gaps', 120, 'bats over the gaps: watch your jump', ({ s, island }) => {
      let x = island(0, 14, 24); s(1, 13, 'P');
      s(x + 3, 8, 'F'); x = island(x + 7, 14, 24);
      s(x + 3, 8, 'F'); x = island(x + 7, 14, 24); s(x - 20, 13, 'L');
      island(x + 7, 14, 16, { ramp: false, foe: false }); s(x + 18, 13, 'D');
    }),
    sky('The Long Way', 150, 'the last gaps are the widest', ({ s, island }) => {
      let x = island(0, 14, 24); s(1, 13, 'P');
      x = island(x + 7, 14, 24);
      x = island(x + 7, 14, 24); s(x - 20, 13, 'L');
      x = island(x + 8, 14, 24);
      island(x + 8, 14, 16, { ramp: false, foe: false }); s(x + 19, 13, 'D');
    }),
  ];
})();
