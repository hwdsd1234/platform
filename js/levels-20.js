// Lanternfall: the Ferry Line, a chapter of rides. In each level you step onto a raft at the
// start and it carries you the whole way, along its track (def.ride: see engine.js), to the
// door: stay on it. Walls stand across the track with a slot for the raft to slip through:
// jump the wall and come down on the raft on the far side (in the air you keep going with
// it). In the tunnels, spikes hang low: keep your head down. Bats, wasps, archers and
// lava bubbles along the way, and three star coins (¢) and a yellow apple (ý) floating
// over the track to jump for. Fall off and there's nothing below. bosses.js slots them in at the end of the Pear Cliffs,
// before the Canal District's castle. Load after levels-19.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const H = 18, F = 12;   // (the raft rides on row F to begin with: its top is the top of row F)
  // A level: the start ledge (the raft waits beside it), the track, the end ledge with the
  // door. `track` is the raft's way: [[x, row], …] for its left edge; draw(a, ry) builds the
  // rest, ry(x) the row the raft's top is on at column x.
  const ride = (name, w, track, draw, speed = 90) => {
    const path = [[5, F], ...track, [w - 9, track.length ? track[track.length - 1][1] : F]];
    const ry = x => {
      for (let k = 0; k < path.length - 1; k++) {
        const [x0, y0] = path[k], [x1, y1] = path[k + 1];
        if (x >= x0 && x <= x1 + 3) return Math.round(y0 + (y1 - y0) * Math.min(1, (x - x0) / Math.max(1, x1 - x0)));
      }
      return path[path.length - 1][1];
    };
    const endRow = path[path.length - 1][1];
    return {
      chapter: 'The Ferry Line', name, since: 22, dark: .6, ride: { path, speed }, keepLength: true,
      map: B(w, H, a => {
        const { r, s } = a;
        r(0, F, 4, H - 1); s(2, F - 1, 'P');
        r(w - 6, endRow, w - 1, H - 1); s(w - 3, endRow - 1, 'D');
        draw(a, ry);
      }),
    };
  };
  // A wall across the track at column x: stone below the raft's slot and `tall` blocks over
  // it (to jump), open above.
  const gate = ({ r }, ry, x, tall = 1) => { const y = ry(x); r(x, y - tall, x, y - 1); r(x, y + 1, x, H - 1); };
  // A tunnel from x0 to x1: stone above, spikes hanging two blocks over your head, and stone
  // under the slot. No jumping in here.
  const tunnel = ({ r }, ry, x0, x1) => { for (let x = x0; x <= x1; x++) { const y = ry(x); r(x, 0, x, y - 4); r(x, y - 3, x, y - 3, '^'); r(x, y + 1, x, H - 1); } };

  LF.RIDE_LEVELS = [
    // Flat out across the dark water, a wall now and then, and bats.
    ride('All Aboard', 110, [], (a, ry) => {
      const { s } = a;
      s(16, F - 2, 'a'); s(22, F - 1, 'L'); s(35, F - 3, '¢'); s(68, F - 3, 'ý'); s(80, F - 4, '¢'); s(100, F - 3, '¢');
      gate(a, ry, 30);
      s(40, F - 3, 'q'); s(46, F - 1, 'F');
      gate(a, ry, 56); s(64, F - 1, 'L');
      gate(a, ry, 74, 2); s(82, F - 3, 'a'); s(88, F - 1, 'F');
      gate(a, ry, 95);
    }),
    // Up the hill and down again: walls on the climbs' tops, archers on the cliffs.
    ride('Ferry Hill', 130, [[24, F], [36, F - 5], [62, F - 5], [74, F], [96, F], [104, F - 3]], (a, ry) => {
      const { r, s } = a;
      gate(a, ry, 18); s(28, F - 3, 'L'); s(22, F - 3, '¢');
      gate(a, ry, 44); s(47, F - 7, 'q');
      r(50, F - 8, 58, F - 8); s(55, F - 9, 'A'); s(53, F - 10, '¢'); s(66, F - 6, 'ý'); s(108, F - 7, '¢');
      gate(a, ry, 60, 2); s(70, F - 3, 'a');
      s(84, F - 1, 'L'); gate(a, ry, 90); s(100, F - 6, 'W');
      gate(a, ry, 116);
    }),
    // Into the tunnels: keep your head down in the spikes, jump the walls between them.
    ride('Low Bridge', 128, [], (a, ry) => {
      const { s } = a;
      gate(a, ry, 16); tunnel(a, ry, 22, 36); s(29, F - 1, 'L'); s(19, F - 4, '¢'); s(46, F - 3, 'ý'); s(73, F - 4, '¢'); s(107, F - 4, '¢');
      gate(a, ry, 42); s(48, F - 1, 'F');
      tunnel(a, ry, 54, 70); s(62, F - 2, 'a');
      gate(a, ry, 76, 2); s(84, F - 3, 'q'); s(88, F - 1, 'L');
      tunnel(a, ry, 92, 104); gate(a, ry, 110);
    }),
    // Over the lava, faster, with lava bubbles leaping up beside the track.
    ride('Ember Ferry', 140, [[30, F], [40, F - 3], [70, F - 3], [80, F]], (a, ry) => {
      const { r, s } = a;
      a.lava(H - 3);
      s(18, H - 3, '*'); gate(a, ry, 24); s(34, F - 4, 'L');
      gate(a, ry, 50); s(58, H - 3, '*'); s(62, F - 5, 'q');
      gate(a, ry, 66, 2); tunnel(a, ry, 86, 98); s(92, F - 1, 'a');
      s(104, H - 3, '*'); gate(a, ry, 108); s(114, F - 1, 'L'); s(118, F - 1, 'F');
      gate(a, ry, 126, 2); s(28, F - 3, '¢'); s(55, F - 7, '¢'); s(75, F - 6, 'ý'); s(121, F - 3, '¢');
    }, 110),
  ];
})();
