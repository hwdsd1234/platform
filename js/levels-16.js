// Lanternfall: the Shell Slopes, a second chapter of Shellbacks (ĸ), all about carrying shells
// and throwing them on slopes. Hold S and run into a shell lying still to carry it; press S to
// throw it. Thrown down a slope it goes faster and faster; up one, it flies off the top. And
// the thornbacks (K) waiting at the bottoms and over the tops can't be stomped: a shell is the
// way. Like the Shell Hills, these aren't in LF.LEVELS when the boss fights are laid in;
// bosses.js slots them in at the end of the Waterfront, before Sunken Keep. Load after
// levels-15.js and before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const H = 18, F = 14;   // (the ground: rows F to the bottom; you stand on row F - 1)
  const lvl = (name, w, sign, draw) => ({ chapter: 'The Shell Slopes', name, since: 16, dark: .52, signs: [{ x: 1, y: 10.4, t: sign }], map: B(w, H, a => draw({ ...a, ...shapes(a) })) });
  const shapes = ({ r, s }) => ({
    // A hill on the ground at column x: h high, len wide at the foot, slopes up both sides.
    hill: (x, h, len) => { for (let i = 0; i < h; i++) { const y = F - 1 - i; s(x + i, y, '/'); r(x + i + 1, y, x + len - 2 - i, y); s(x + len - 1 - i, y, '\\'); } },
    // A dip: d deep, len wide at the top, slopes down both sides.
    dip: (x, d, len) => {
      r(x, F, x + len - 1, F + d - 1, '.');
      for (let i = 0; i < d; i++) { const y = F + i; s(x + i, y, '\\'); s(x + len - 1 - i, y, '/'); r(x, y + 1, x + i, F + d - 1); r(x + len - 1 - i, y + 1, x + len - 1, F + d - 1); }
    },
    // A ledge h high from column x0 to x1, a ramp down its right side (or up its left: dir).
    ledge: (x0, x1, h, down = 1) => {
      r(x0, F - h, x1, F - 1);
      for (let i = 0; i < h; i++) {
        if (down > 0) { s(x1 + 1 + i, F - h + i, '\\'); r(x1 + 1 + i, F - h + i + 1, x1 + 1 + i, F - 1); }
        else { s(x0 - 1 - i, F - h + i, '/'); r(x0 - 1 - i, F - h + i + 1, x0 - 1 - i, F - 1); }
      }
    },
  });

  LF.SHELL_LEVELS_2 = [
    lvl('Carry Hill', 120, 'CARRY: hold S and run into a shell; press S to throw it', ({ r, s, hill }) => {
      r(0, F, 119, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      s(12, F - 1, 'ĸ');
      hill(20, 3, 14); for (const x of [38, 41, 44]) s(x, F - 1, 'K');
      s(52, F - 1, 'L');
      s(58, F - 1, 'ĸ');
      hill(64, 4, 16); for (const x of [84, 87, 90, 93]) s(x, F - 1, 'K');
      s(100, F - 1, 'ĸ'); s(114, F - 1, 'D');
    }),
    lvl('Downhill Bowling', 130, 'throw a shell down the slope: it goes faster and faster', ({ r, s, ledge }) => {
      r(0, F, 129, H - 1); s(2, F - 5, 'P');
      ledge(0, 16, 4); s(6, F - 5, 'a'); s(10, F - 5, 'ĸ');
      for (const x of [26, 28, 30, 32, 34]) s(x, F - 1, 'B');
      s(40, F - 1, 'L');
      ledge(50, 64, 4, -1); r(50, F - 4, 64, F - 1); s(58, F - 5, 'ĸ');
      ledge(65, 66, 4); for (const x of [76, 79, 82, 85]) s(x, F - 1, 'K');
      s(96, F - 1, 'ĸ'); s(124, F - 1, 'D');
    }),
    lvl('Twin Peaks', 130, 'a shell thrown up a hill flies off the top', ({ r, s, hill }) => {
      r(0, F, 129, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      s(12, F - 1, 'ĸ');
      hill(18, 3, 10); r(28, F, 31, H - 1, '.'); hill(32, 3, 10);
      for (const x of [46, 49]) s(x, F - 1, 'K');
      s(56, F - 1, 'L');
      s(62, F - 1, 'ĸ');
      hill(68, 4, 12); r(80, F, 83, H - 1, '.'); hill(84, 4, 12);
      for (const x of [100, 103, 106]) s(x, F - 1, 'K');
      s(112, F - 1, 'ĸ'); s(124, F - 1, 'D');
    }),
    lvl('Shell Valley', 120, 'jump off the steep backs of slopes to climb out', ({ r, s, dip }) => {
      r(0, F, 119, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      dip(14, 3, 34); for (const x of [22, 27, 32, 37]) s(x, F + 2, 'ĸ'); s(30, F + 2, 'L');
      // (Floating slopes over the valley: a way across, and walls to jump off.)
      s(24, F - 2, '/'); s(25, F - 3, '/'); r(26, F - 3, 28, F - 3, '='); s(36, F - 3, '\\'); s(37, F - 2, '\\');
      s(56, F - 1, 'ĸ');
      dip(62, 2, 24); for (const x of [69, 74, 79]) s(x, F + 1, 'ĸ'); s(75, F + 1, 'K');
      for (const x of [94, 97]) s(x, F - 1, 'K');
      s(104, F - 1, 'ĸ'); s(114, F - 1, 'D');
    }),
    lvl('Slope Gauntlet', 150, 'a golem takes three shells', ({ r, s, hill, dip, ledge }) => {
      r(0, F, 149, H - 1); s(2, F - 1, 'P'); s(5, F - 1, 'a');
      s(10, F - 1, 'ĸ');
      hill(16, 3, 12); for (const x of [32, 35]) s(x, F - 1, 'K');
      dip(40, 2, 18); s(48, F + 1, 'ĸ'); s(52, F + 1, 'B');
      s(62, F - 1, 'L');
      ledge(66, 80, 3, -1); s(72, F - 4, 'ĸ'); s(76, F - 4, 'ĸ');
      ledge(81, 82, 3); s(92, F - 1, 'I');
      s(100, F - 1, 'ĸ');
      hill(106, 4, 14); r(120, F, 123, H - 1, '.');
      for (const x of [128, 131]) s(x, F - 1, 'K');
      s(138, F - 1, 'ĸ'); s(144, F - 1, 'D');
    }),
  ];
})();
