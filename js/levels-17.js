// Lanternfall: the Shell Skies, a chapter of the Sky Roads built on the shell jump, the most
// advanced trick there is. The gaps between the islands are too wide to jump (6 tiles; a
// running jump goes 5). Each island has a ramp two rows high up to its far edge, and the next
// one a lip one row high at its near edge (a little ramp facing back over the gap) and a wall a
// few tiles in. Stomp the Shellback, pick up its shell (hold S and run into it), and throw it
// (S) from the foot of the ramp: it flies off the top, well over the gap, hits the wall on the
// other side, comes back, and hops off the lip back towards you, only a little way up. Follow it
// up the ramp to the edge, and jump as it comes: land on it in the air, and a stomp in mid-air
// bounces you high enough to cross. (Get it wrong and the shell's in the void, or in you.) The level checker can't do
// shell jumps, so these levels were checked with the real physics instead (every gap the same
// shape). bosses.js slots them in after the rest of the Sky Roads. Load after levels-16.js and
// before bosses.js.
(() => {
  const LF = window.LF;
  const B = LF.build;
  const Y = 14, GAP = 6;
  const sky = (name, w, sign, draw) => ({ chapter: 'The Shell Skies', name, sky: true, since: 17, dark: .3, signs: [{ x: 1, y: 8.4, t: sign }], map: B(w, 20, a => { a.r(0, 0, w - 1, 0); draw({ ...a, chain: chain(a) }); }) });
  // A chain of n islands from column 0, each len long, GAP apart: the first with the start, the
  // last with the door; every one but the first with a lip and a wall, every one but the last
  // with a ramp to its edge and a Shellback. Returns where each island starts.
  const chain = ({ r, s }) => (n, len) => {
    const at = [];
    for (let k = 0, x = 0; k < n; k++, x += len + GAP) {
      at.push(x);
      const x1 = x + len - 1;
      r(x, Y, x1, Y); r(x + 1, Y + 1, x1 - 1, Y + 1);
      // (A lip one row high at the near edge, the wall eight in; a ramp two rows high up to the
      // far edge: the taller the slope, the higher a shell flies off it, so it flies well over
      // the gap going out, and only a little way up coming back, low enough to land on.)
      if (k > 0) { s(x, Y - 1, '#'); s(x + 1, Y - 1, '\\'); r(x + 8, Y - 3, x + 8, Y - 1); }
      if (k < n - 1) { s(x1 - 3, Y - 1, '/'); r(x1 - 2, Y - 1, x1, Y - 1); s(x1 - 2, Y - 2, '/'); r(x1 - 1, Y - 2, x1, Y - 2); s(x + 12, Y - 1, 'ĸ'); }
    }
    s(1, Y - 1, 'P');
    s(at[n - 1] + len - 4, Y - 1, 'D');
    return at;
  };

  LF.SHELL_SKY_LEVELS = [
    sky('Shell Jump', 4 * 22 + 3 * GAP, 'SHELL JUMP: throw a shell off the ramp; as it flies back off the far lip, jump from the edge and land on it', ({ s, chain }) => {
      const at = chain(4, 22); s(at[2] + 14, Y - 1, 'L');
    }),
    sky('Shell Relay', 5 * 22 + 4 * GAP, 'one shell jump after another', ({ s, chain }) => {
      const at = chain(5, 22); s(at[2] + 14, Y - 1, 'L');
    }),
    sky('Bat Gaps', 4 * 22 + 3 * GAP, 'bats about: watch your jump', ({ s, chain }) => {
      const at = chain(4, 22); s(at[2] + 14, Y - 1, 'L');
      for (const x of [at[1] + 16, at[2] + 16]) s(x, Y - 6, 'F');
    }),
    sky('The Long Way', 6 * 22 + 5 * GAP, 'six islands, five shell jumps', ({ s, chain }) => {
      const at = chain(6, 22); s(at[3] + 14, Y - 1, 'L');
    }),
  ];
})();
