// Lanternfall: the Shell Skies, a chapter of the Sky Roads built on shell jumps. The gaps
// between the islands are too wide to jump (about 7 tiles; a running jump goes 5): on each
// island a Shellback waits. Stomp it, pick up its shell (hold S and run into it), take a running
// jump off the edge and press S in mid-air: you throw the shell down under you and spring off
// it, half again as far. Stomp a Shellback in mid-air and you bounce high, too. A Shellback
// that falls off the islands walks back on where it started (def.shellsReturn), so there's
// always another shell. (The level checker can't do shell jumps: like the Pear Cliffs' glides,
// these levels are checked with the real physics instead.) bosses.js slots them in after the
// rest of the Sky Roads. Load after levels-16.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const sky = (name, w, sign, draw) => ({ chapter: 'The Shell Skies', name, sky: true, shellsReturn: true, since: 17, dark: .3, signs: [{ x: 1, y: 9.4, t: sign }], map: B(w, 20, a => { a.r(0, 0, w - 1, 0); draw({ ...a, isle: isle(a) }); }) });
  // A floating island: a slab w wide at row y, tapering underneath.
  const isle = ({ r }) => (x, y, w) => { r(x, y, x + w - 1, y); if (w > 2) r(x + 1, y + 1, x + w - 2, y + 1); };

  LF.SHELL_SKY_LEVELS = [
    sky('Shell Jump', 80, 'SHELL JUMP: carry a shell, jump, press S in mid-air', ({ s, isle }) => {
      isle(0, 14, 10); s(1, 13, 'P'); s(9, 13, 'ĸ');
      isle(17, 14, 8); s(21, 13, 'ĸ');
      isle(32, 14, 9); s(35, 13, 'L'); s(39, 13, 'ĸ');
      isle(48, 13, 8); s(52, 12, 'ĸ');
      isle(63, 13, 14); s(73, 12, 'D');
    }),
    sky('Shell Stairs', 84, 'shell jumps take you up as well as across', ({ s, isle }) => {
      isle(0, 16, 10); s(1, 15, 'P'); s(9, 15, 'ĸ');
      isle(16, 14, 8); s(20, 13, 'ĸ');
      isle(30, 12, 8); s(34, 11, 'ĸ');
      isle(44, 10, 9); s(47, 9, 'L'); s(51, 9, 'ĸ');
      isle(59, 9, 8); s(63, 8, 'ĸ');
      isle(73, 8, 10); s(80, 7, 'D');
    }),
    sky('Bat Gaps', 90, 'bats over the gaps: stomp a Shellback in mid-air for a big bounce', ({ s, isle }) => {
      isle(0, 14, 10); s(1, 13, 'P'); s(9, 13, 'ĸ');
      isle(17, 14, 8); s(21, 13, 'ĸ'); s(13, 9, 'F');
      isle(32, 13, 9); s(36, 12, 'L'); s(39, 12, 'ĸ'); s(28, 8, 'F');
      isle(48, 14, 8); s(52, 13, 'ĸ'); s(44, 9, 'F');
      isle(63, 13, 8); s(67, 12, 'ĸ'); s(59, 8, 'F');
      isle(78, 13, 11); s(85, 12, 'D');
    }),
    sky('The Long Way', 104, 'the last gaps are the widest', ({ s, isle }) => {
      isle(0, 14, 9); s(1, 13, 'P'); s(8, 13, 'ĸ');
      isle(16, 14, 7); s(19, 13, 'ĸ');
      isle(30, 13, 8); s(33, 12, 'ĸ');
      isle(45, 13, 9); s(48, 12, 'L'); s(52, 12, 'ĸ');
      isle(61, 14, 7); s(64, 13, 'ĸ');
      isle(76, 13, 7); s(79, 12, 'ĸ');
      isle(91, 13, 12); s(99, 12, 'D');
    }),
  ];
})();
