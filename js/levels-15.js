// Lanternfall: the Shell Hills, a chapter of Shellbacks (ĸ) and slopes. Hills and ridges,
// dips and long ramps, and Shellbacks everywhere: stomp one into its shell, kick the shell
// and send it rolling, down slopes (faster and faster), up them and flying off the top,
// knocking out whatever's in its way (thornbacks you couldn't stomp, rows of beetles) and
// coming back at you off the walls. Like the Pear Cliffs, these levels aren't in LF.LEVELS
// when the boss fights are laid in; bosses.js slots them in at the end of Old Town, before
// its castle. Load after levels-14.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const H = 16, F = 12;   // (the ground: rows F to the bottom; you stand on row F - 1)
  const shell = (name, w, sign, draw) => ({ chapter: 'The Shell Hills', name, since: 15, dark: .5, signs: [{ x: 1, y: 8.4, t: sign }], map: B(w, H, a => draw({ ...a, hill: hill(a), dip: dip(a) })) });
  // A hill on the ground at column x: h blocks high, len wide at the foot, slopes up both sides.
  const hill = ({ r, s }) => (x, h, len) => {
    for (let i = 0; i < h; i++) { const y = F - 1 - i; s(x + i, y, '/'); r(x + i + 1, y, x + len - 2 - i, y); s(x + len - 1 - i, y, '\\'); }
  };
  // A dip in the ground at column x: d blocks deep, len wide at the top, slopes down both sides.
  const dip = ({ r, s }) => (x, d, len) => {
    r(x, F, x + len - 1, F + d - 1, '.');
    for (let i = 0; i < d; i++) { const y = F + i; s(x + i, y, '\\'); s(x + len - 1 - i, y, '/'); r(x, y + 1, x + i, F + d - 1); r(x + len - 1 - i, y + 1, x + len - 1, F + d - 1); }
  };

  LF.SHELL_LEVELS = [
    shell('Shell Hill', 120, 'SHELLBACK: stomp it, then touch its shell to kick it', ({ r, s, hill }) => {
      r(0, F, 119, H - 1); s(2, F - 1, 'P'); s(6, F - 1, 'a');
      s(16, F - 1, 'ĸ');
      hill(24, 2, 12); s(30, F - 3, 'ĸ');
      s(48, F - 1, 'L');
      for (const x of [58, 61, 64]) s(x, F - 1, 'B');
      hill(72, 3, 14); s(79, F - 4, 'ĸ');
      r(92, F, 95, H - 1, '.');
      // A switch to bump with your head: the red gate goes, and a blue bridge comes over the pit.
      s(98, F - 4, '§'); r(101, F - 5, 101, F - 1, 'Ʀ'); r(102, F, 108, H - 1, '.'); r(102, F, 108, F, 'ɓ');
      s(111, F - 1, 'ĸ'); s(116, F - 1, 'D');
    }),
    shell('Rolling Ridge', 130, 'a shell speeds up downhill, and flies off the top of a hill', ({ r, s, hill }) => {
      r(0, F, 129, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      hill(14, 2, 8); hill(21, 3, 10); hill(30, 2, 8); s(25, F - 4, 'ĸ'); s(33, F - 3, 'ĸ');
      for (const x of [42, 46]) s(x, F - 1, 'K');
      hill(52, 3, 12); s(58, F - 4, 'L');
      hill(70, 2, 8); hill(77, 3, 10); hill(86, 2, 8); s(81, F - 4, 'ĸ'); s(73, F - 3, 'ĸ');
      for (const x of [98, 101, 104]) s(x, F - 1, 'B');
      s(110, F - 1, 'ĸ'); s(124, F - 1, 'D');
    }),
    shell('Shell Alley', 120, 'spiky thornbacks block the alley: send a shell down it', ({ r, s, hill }) => {
      r(0, F, 119, H - 1); r(0, 0, 119, 0); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      // The alley: a low roof, too low to jump the thornbacks.
      r(22, 1, 70, F - 4); s(14, F - 1, 'ĸ');
      for (const x of [30, 36, 42, 48, 54]) s(x, F - 1, 'K');
      s(64, F - 1, 'L');
      r(71, F - 4, 71, F - 3, '.');
      hill(80, 2, 10); s(85, F - 3, 'ĸ');
      for (const x of [94, 98]) s(x, F - 1, 'K');
      s(104, F - 1, 'ĸ'); s(115, F - 1, 'D');
    }),
    shell('Ramp Jump', 130, 'ramps to the pits: shells fly off them', ({ r, s }) => {
      r(0, F, 129, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      // Ramps up to the edge of each pit, the far side lower.
      const ramp = (x, h) => { for (let i = 0; i < h; i++) { s(x + i, F - 1 - i, '/'); r(x + i + 1, F - 1 - i, x + h + 2, F - 1 - i); } };
      ramp(12, 2); r(18, F, 21, H - 1, '.'); s(10, F - 1, 'ĸ');
      ramp(30, 2); r(36, F, 39, H - 1, '.'); s(26, F - 1, 'ĸ'); s(44, F - 1, 'B'); s(47, F - 1, 'B');
      s(54, F - 1, 'L');
      ramp(62, 3); r(69, F, 72, H - 1, '.'); s(58, F - 1, 'ĸ');
      for (const x of [77, 80, 83]) s(x, F - 1, 'K');
      ramp(92, 2); r(98, F, 101, H - 1, '.'); s(88, F - 1, 'ĸ');
      s(108, F - 1, 'ĸ'); s(124, F - 1, 'D');
    }),
    shell('The Shell Pit', 120, 'shells roll to the bottom of the pit: cross it with care', ({ r, s, dip }) => {
      r(0, F, 119, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      s(12, F - 1, 'ĸ');
      // (The lantern's up over the pit, on planks: a jump from the edge, then another.)
      dip(18, 3, 26); for (const x of [26, 31, 36]) s(x, F + 2, 'ĸ'); s(31, 5, 'L'); r(28, 6, 34, 6, '=');
      r(19, 9, 22, 9, '='); r(24, 7, 26, 7, '='); r(36, 7, 38, 7, '='); r(40, 9, 43, 9, '=');
      s(52, F - 1, 'ĸ');
      dip(60, 2, 20); for (const x of [67, 72]) s(x, F + 1, 'ĸ'); s(70, F + 1, 'B');
      for (const x of [88, 92]) s(x, F - 1, 'K');
      s(98, F - 1, 'ĸ'); s(114, F - 1, 'D');
    }),
  ];
})();
