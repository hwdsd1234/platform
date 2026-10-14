// Lanternfall: the Pear Cliffs, a chapter of gliding. A pear (p) lets you glide: hold jump
// while falling to float down slowly, and jump once more in mid-air for a little lift. Every
// level here is cliffs and pillars over a drop with gaps too wide to jump, so you glide
// across; there's a pear at the start and another along the way (for after a fall). Like the
// Melon Patch, these aren't in LF.LEVELS when the boss fights are laid in; bosses.js slots
// them in at the end of the Canal District, before its castle. Load after levels-13.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  // (A ceiling over every level, so there's no going over the top of the walls.)
  const pear = (name, w, sign, draw) => ({ chapter: 'The Pear Cliffs', name, pear: true, since: 11, dark: .45, signs: [{ x: 1, y: 2.4, t: sign }], map: B(w, 18, a => { a.r(0, 0, w - 1, 0); draw(a); }) });
  // A cliff or pillar: solid from row `top` to the bottom of the level, x0..x1.
  const cliff = r => (x0, x1, top) => r(x0, top, x1, 17);
  // A lantern you can't glide past: a wall hangs from the top of the level down to two rows
  // above the end of its cliff, and the lantern hangs in the gap you have to go through.
  // (A pear sits right beside it, for when you come back there after a fall.)
  const gateLamp = (r, s) => (x, top) => { r(x + 1, 0, x + 2, top - 3); s(x + 1, top - 1, 'L'); s(x, top - 1, 'p'); };

  LF.PEAR_LEVELS = [
    pear('Pear Drop', 88, '🍐 PEAR: hold jump while falling to glide', ({ r, s }) => {
      const c = cliff(r);
      c(0, 8, 6); s(2, 5, 'P'); s(5, 5, 'p');
      c(19, 25, 9);
      c(36, 42, 11); gateLamp(r, s)(41, 11);
      c(53, 58, 12); s(55, 11, 'p');
      c(69, 87, 13); s(84, 12, 'D');
    }),
    pear('Spin Hops', 92, 'jump again in mid-air for a little lift', ({ r, s }) => {
      const c = cliff(r);
      c(0, 6, 10); s(2, 9, 'P'); s(4, 9, 'p');
      c(18, 22, 10);
      c(35, 39, 10); gateLamp(r, s)(38, 10);
      c(52, 56, 10); s(54, 9, 'p');
      c(69, 91, 10); s(88, 9, 'D');
    }),
    pear('Canyon Wasps', 92, 'wasps hang in the canyon: glide round them', ({ r, s }) => {
      const c = cliff(r);
      c(0, 7, 4); s(2, 3, 'P'); s(5, 3, 'p');
      c(20, 24, 8); s(14, 6, 'W');
      c(36, 40, 11); gateLamp(r, s)(39, 11); s(30, 7, 'W');
      c(52, 56, 9); s(54, 8, 'p');
      c(68, 91, 11); s(62, 6, 'W'); s(88, 10, 'D');
    }),
    pear('Fire Gaps', 96, 'fire bars turn in the gaps: time your glide', ({ r, s }) => {
      const c = cliff(r);
      c(0, 7, 5); s(2, 4, 'P'); s(5, 4, 'p');
      s(15, 6, 'f');
      c(24, 28, 9);
      s(35, 9, 'f');
      c(43, 47, 12); gateLamp(r, s)(46, 12);
      c(59, 63, 12); s(61, 11, 'p'); s(53, 9, 'W');
      s(70, 10, 'f');
      c(77, 95, 13); s(92, 12, 'D');
    }),
    pear('The Long Glide', 100, 'one long glide down to the lantern… then glide on, and on', ({ r, s }) => {
      const c = cliff(r);
      c(0, 6, 2); s(2, 1, 'P'); s(4, 1, 'p');
      c(30, 38, 14); gateLamp(r, s)(37, 14);
      c(53, 57, 15); s(55, 14, 'p');
      c(71, 99, 16); s(96, 15, 'D');
    }),
  ];
})();
