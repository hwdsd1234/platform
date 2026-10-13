// Lanternfall: boss fights. One boss arena after every 10th regular story level, in the
// chapter of the level before it. Load after all the levels-*.js files.
(() => {
  const LF = window.LF;
  const B = LF.build;

  // The five bosses come round four times. Every fight has its own twist (bossMode, read by
  // the boss code in engine.js) and its own crowd, and across them every kind of enemy turns
  // up, both hordes included. Each round the boss is also a little faster. Each boss takes
  // its own number of hits (see BOSS_HITS in engine.js); the trickiest fights set fewer.
  // Every arena has a boss gate (g) from floor to ceiling in front of the door, which falls
  // with the boss. There are no lanterns: the door opens when the boss is down. Fruit
  // (apple shield, orange boost, banana double jump) helps instead, and grows back.
  const SPEED = [1, 1.1, 1.2, 1.3];

  // Make every platform an easy jump: where a plank or ledge sits a full jump (3 rows) or
  // more above the ground beside its end, put a short plank step 2 rows below it, beside
  // it (1 below for one exactly 3 up). A few passes chain steps up to the higher ones. Platforms over water or lava are
  // skipped (you swim there), as are tall climbs.
  const STAND = c => '#=iCTH<>O'.includes(c);
  function easeAccess(map) {
    for (let pass = 0; pass < 3; pass++) map = stepPass(map);
    return map;
  }
  function stepPass(map) {
    const g = map.map(row => row.split('')), h = g.length, w = g[0].length;
    const runs = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!STAND(g[y][x]) || STAND(g[y][x - 1]) || g[y - 1][x] !== '.') continue;
      let x1 = x;
      while (x1 + 1 < w - 1 && STAND(g[y][x1 + 1])) x1++;
      if (g[y + 1][x] === '.' || g[y + 1][x1] === '.') runs.push({ x0: x, x1, y });
    }
    for (const { x0, x1, y } of runs) for (const [sx0, sx1] of [[x0 - 2, x0 - 1], [x1 + 1, x1 + 2]]) {
      if (sx0 < 1 || sx1 > w - 2) continue;
      let fy = y + 1;
      while (fy < h && g[fy][sx0] === '.') fy++;
      if (fy >= h || !STAND(g[fy][sx0]) || !STAND(g[fy][sx1])) continue;
      const gap = fy - y;
      if (gap < 3 || gap > 6) continue;
      const sy = y + Math.min(2, gap - 2);   // 2 below it, or just 1 if it's only 3 up
      let room = true;
      for (let yy = sy - 2; yy <= sy; yy++) for (let xx = sx0; xx <= sx1; xx++) if (g[yy][xx] !== '.') room = false;
      if (room) for (let xx = sx0; xx <= sx1; xx++) g[sy][xx] = '=';
    }
    return g.map(row => row.join(''));
  }

  // Base arenas for each boss, reused with different dressing.
  const bellPit = extra => B(46, 16, ({ r, s, walls }) => {
    walls(); r(0, 0, 45, 0); r(1, 13, 44, 14);
    s(3, 12, 'P'); s(5, 12, 'Q'); s(7, 12, 'a');
    r(10, 10, 15, 10, '='); s(12, 9, 'q');
    r(20, 7, 25, 7, '='); s(22, 6, '$');
    r(30, 10, 35, 10, '=');
    r(38, 9, 43, 9, '='); s(40, 8, 'o');
    s(30, 12, '5'); r(42, 1, 42, 12, 'g'); s(43, 12, 'D');
    extra({ r, s });
  });
  const nest = extra => B(48, 20, ({ r, s, walls }) => {
    walls(); r(0, 0, 47, 0); r(1, 17, 46, 18);
    s(3, 16, 'P'); s(5, 16, 'Q'); s(42, 16, 'q');
    r(8, 14, 13, 14, '='); s(10, 13, 'b');
    r(34, 14, 39, 14, '='); s(36, 13, 'a');
    r(15, 11, 32, 11, '='); s(23, 10, 'Q'); s(28, 10, '$');
    s(24, 7, '6'); r(44, 1, 44, 16, 'g'); s(45, 16, 'D');
    extra({ r, s });
  });
  const deck = extra => B(50, 18, ({ r, s, walls }) => {
    walls(); r(0, 0, 49, 0); r(1, 15, 48, 16);
    s(2, 14, 'P'); s(4, 14, '$');
    r(10, 12, 14, 12); s(12, 11, 'o');
    r(35, 12, 39, 12); s(37, 11, 'b');
    r(20, 9, 29, 9, '='); s(24, 8, 'q'); s(27, 8, '$');
    r(17, 14, 17, 14); r(32, 14, 32, 14);
    s(30, 14, '7'); r(46, 1, 46, 14, 'g'); s(47, 14, 'D');
    extra({ r, s });
  });
  const yard = extra => B(50, 18, ({ r, s, walls }) => {
    walls(); r(0, 0, 49, 0); r(1, 15, 48, 16);
    s(2, 14, 'P'); s(4, 14, '$');
    r(8, 12, 13, 12, '='); s(10, 11, 'a');
    r(36, 12, 41, 12, '='); s(38, 11, 'o');
    r(15, 9, 34, 9, '='); s(24, 8, 'Q'); s(30, 8, '$');
    s(30, 14, '8'); r(46, 1, 46, 14, 'g'); s(47, 14, 'D');
    extra({ r, s });
  });
  const throne = extra => B(52, 18, ({ r, s, walls }) => {
    walls(); r(0, 0, 51, 0); r(1, 15, 50, 16);
    s(2, 14, 'P'); s(7, 14, '$');
    r(8, 12, 13, 12, '='); s(10, 11, 'b');
    r(15, 9, 36, 9, '='); s(25, 8, 'Q'); s(32, 8, '$');
    r(38, 12, 43, 12, '='); s(40, 11, 'a');
    s(36, 14, '9'); r(48, 1, 48, 14, 'g'); s(49, 14, 'D');
    extra({ r, s });
  });
  const none = () => {};

  const FIGHTS = [
    // ---- Round 1 ----
    { name: 'The Bell Pit', mode: 'beetles', dark: .6, sign: 'THE BELLWETHER · its slams shake beetles loose · stomp it while it’s dazed',
      map: () => bellPit(none) },
    { name: 'The Soot Nest', mode: 'bats', dark: .7, sign: 'THE SOOT QUEEN · she calls bats · stomp her when she lands',
      map: () => nest(none) },
    { name: 'Marksman’s Deck', mode: 'archers', dark: .66, sign: 'THE ASH MARKSMAN · he brought archers · blocks stop arrows',
      map: () => deck(({ s }) => { s(10, 11, 'A'); s(39, 11, 'A'); }) },
    { name: 'Colossus Yard', mode: 'guards', dark: .7, sign: 'THE IRON COLOSSUS · golems guard it · 3 stomps break a golem',
      map: () => yard(({ s }) => { s(14, 14, 'I'); s(40, 14, 'I'); }) },
    { name: 'The Powder Throne', mode: 'throne', dark: .72, sign: 'THE POWDER KING · dodge his bombs · his carts blow up everything near',
      map: () => throne(none) },
    // ---- Round 2 ----
    { name: 'Ram’s Run', mode: 'stampede', dark: .62, hordeStop: 42, sign: 'RUN → to the Bellwether',
      map: () => B(92, 16, ({ r, s, walls }) => {
        walls(); r(0, 0, 91, 0); r(1, 13, 90, 14);
        s(1, 12, '&'); s(4, 12, 'P'); s(7, 12, 'q');
        r(14, 13, 15, 13, '^'); r(17, 10, 22, 10, '='); s(19, 9, 'q'); s(20, 12, 'K');
        s(30, 12, 'R'); r(34, 13, 35, 13, '^'); s(38, 12, 'Q');
        r(42, 11, 42, 12);
        s(45, 12, 'o'); s(48, 12, '$');
        r(52, 10, 57, 10, '='); r(61, 7, 66, 7, '='); s(63, 6, '$'); r(72, 10, 77, 10, '='); s(75, 9, 'b');
        s(68, 12, '5'); r(89, 1, 89, 12, 'g'); s(90, 12, 'D');
      }) },
    { name: 'The Ember Roost', mode: 'rising', bossHits: 14, dark: .72, hordeStop: 19, sign: 'CLIMB ↑ · the Soot Queen waits at the top',
      map: () => B(28, 48, ({ r, s, walls }) => {
        walls(); r(0, 0, 27, 0); r(1, 45, 26, 46);
        s(0, 47, '%'); s(3, 44, 'P'); s(5, 44, 'q');
        const A = [4, 9], M = [11, 16], C = [18, 23];
        for (const [y, [x0, x1]] of [[42, C], [39, M], [36, A], [33, M], [30, C], [27, M], [24, A], [21, M]]) r(x0, y, x1, y);
        s(13, 40, 'X'); s(6, 37, 'X'); s(20, 31, 'X');
        s(6, 35, 'a'); s(21, 29, 'o'); s(13, 32, 'q'); s(7, 23, 'Q');
        r(1, 18, 10, 18); r(11, 18, 16, 18, '='); r(17, 18, 26, 18); s(13, 17, '$');
        r(3, 15, 8, 15, '='); s(5, 14, 'b'); r(19, 15, 24, 15, '='); s(22, 14, 'a');
        s(14, 7, '6'); r(25, 1, 25, 17, 'g'); s(26, 17, 'D');
      }) },
    { name: 'Hollow Range', mode: 'fade', bossHits: 12, dark: .85, sign: 'THE ASH MARKSMAN · he fades as he leaps · strike when he shows',
      map: () => deck(({ s }) => { s(8, 5, 'G'); s(42, 5, 'G'); s(22, 10, 'X'); s(27, 10, 'X'); }) },
    { name: 'The Iron Quarry', mode: 'quarry', dark: .7, sign: 'THE IRON COLOSSUS · its landings bring the roof down',
      map: () => yard(({ s }) => { s(12, 1, 'k'); s(38, 1, 'k'); s(20, 14, 'K'); s(34, 14, 'B'); }) },
    { name: 'The Fuse Hall', mode: 'fuse', dark: .72, sign: 'THE POWDER KING · his bombs leave fire',
      map: () => throne(({ s }) => { s(19, 12, 'f'); s(31, 12, 'f'); s(26, 4, 'Z'); s(14, 14, 'R'); }) },
    // ---- Round 3 ----
    { name: 'The Thunder Fold', mode: 'ice', dark: .62, sign: 'THE BELLWETHER · on the ice it charges twice',
      map: () => bellPit(({ r, s }) => { r(1, 13, 41, 13, 'i'); s(16, 5, 'W'); s(32, 5, 'W'); }) },
    { name: 'Queen’s Chimney', mode: 'blink', dark: .85, sign: 'THE SOOT QUEEN · the platforms blink · wraiths in the dark',
      map: () => nest(({ r, s }) => {
        r(8, 14, 13, 14, 'T'); r(34, 14, 39, 14, 'H'); r(15, 11, 23, 11, 'H'); r(24, 11, 32, 11, 'T');
        s(6, 6, 'G'); s(40, 6, 'G');
      }) },
    { name: 'The Archery Loft', mode: 'lifts', bossHits: 14, dark: .66, sign: 'THE ASH MARKSMAN · ride the lifts across his pool',
      map: () => B(56, 18, ({ r, s, walls }) => {
        walls(); r(0, 0, 55, 0); r(1, 15, 14, 16); r(41, 15, 54, 16); r(15, 15, 40, 16, '~');
        s(2, 14, 'P'); s(4, 14, '$'); s(8, 14, 'o'); s(11, 14, 'q');
        s(25, 16, 'Y'); s(33, 15, 'U');
        s(15, 12, '|'); s(16, 12, 'M'); s(40, 12, '|');
        s(17, 9, '|'); s(30, 9, 'M'); s(39, 9, '|');
        r(44, 12, 47, 12); s(45, 11, 'b'); s(51, 14, 'Q');
        s(48, 14, '7'); r(53, 1, 53, 14, 'g'); s(54, 14, 'D');
      }) },
    { name: 'The Anvil Floor', mode: 'anvil', dark: .72, sign: 'THE IRON COLOSSUS · it pounds as it walks · mind the lava',
      map: () => B(50, 18, ({ r, s, walls }) => {
        walls(); r(0, 0, 49, 0);
        r(1, 15, 14, 16); r(15, 15, 17, 16, '!'); r(18, 15, 31, 16); r(32, 15, 34, 16, '!'); r(35, 15, 48, 16);
        s(16, 15, '*'); s(33, 15, '*');
        s(2, 14, 'P'); s(4, 14, '$');
        r(8, 12, 13, 12, '='); s(10, 11, 'a'); s(12, 11, 'S');
        r(36, 12, 41, 12, '='); s(38, 11, 'o'); s(40, 11, 'S');
        r(15, 9, 34, 9, '='); s(24, 8, 'Q'); s(30, 8, '$');
        s(25, 14, '8'); r(46, 1, 46, 14, 'g'); s(47, 14, 'D');
      }) },
    { name: 'The Blasting Court', mode: 'cluster', dark: .72, sign: 'THE POWDER KING · his bombs split in three · the floor moves',
      map: () => throne(({ r, s }) => { r(6, 15, 30, 15, '>'); s(20, 5, 'W'); s(12, 11, 'A'); s(42, 11, 'A'); }) },
    // ---- Round 4 ----
    { name: 'The Last Charge', mode: 'fire', dark: .64, sign: 'THE BELLWETHER · its charge leaves fire',
      map: () => bellPit(({ s }) => { s(24, 6, 'S'); s(12, 6, 'Z'); s(34, 7, 'Z'); }) },
    { name: 'The Blackened Sky', mode: 'storm', dark: .75, sign: 'THE SOOT QUEEN · embers fall in threes · the bridges crumble',
      map: () => B(50, 20, ({ r, s, walls }) => {
        walls(); r(0, 0, 49, 0);
        r(1, 17, 12, 18); r(37, 17, 48, 18); r(13, 17, 36, 18, '!'); s(19, 17, '*'); s(30, 17, '*');
        r(14, 14, 18, 14, 'C'); r(22, 12, 27, 12, 'C'); r(31, 14, 35, 14, 'C');
        s(3, 16, 'P'); s(5, 16, 'Q'); s(10, 16, '$'); s(6, 16, 'b'); s(24, 11, 'a'); s(40, 16, 'o'); s(44, 16, 'q');
        s(8, 9, 'W'); s(42, 9, 'W');
        s(25, 7, '6'); r(46, 1, 46, 16, 'g'); s(47, 16, 'D');
      }) },
    { name: 'The Final Volley', mode: 'rain', dark: .68, sign: 'THE ASH MARKSMAN · arrows rain down · springs lift you high',
      map: () => B(50, 18, ({ r, s, walls }) => {
        walls(); r(0, 0, 49, 0); r(1, 15, 17, 16); r(32, 15, 48, 16); r(18, 15, 31, 16, '~');
        s(24, 16, 'N'); s(8, 14, 'J'); s(40, 14, 'J');
        s(6, 15, 'O'); s(43, 15, 'O');
        r(3, 8, 9, 8, '='); s(5, 7, 'b'); r(40, 8, 46, 8, '='); s(44, 7, 'a');
        s(2, 14, 'P'); s(3, 14, '$'); s(12, 14, 'Q'); s(33, 14, 'q');
        s(36, 14, '7'); r(47, 1, 47, 14, 'g'); s(48, 14, 'D');
      }) },
    { name: 'Colossus Reborn', mode: 'armor', dark: .72, sign: 'THE IRON COLOSSUS · at half health it hides behind golems · TNT helps',
      map: () => yard(({ s }) => { s(12, 11, '@'); s(37, 11, '@'); s(20, 8, '$'); }) },
    { name: 'The Last Keg', mode: 'waves', dark: .75, hordeStop: 6, sign: 'THE POWDER KING · he calls every creature in town',
      map: () => throne(({ s }) => { s(0, 14, '&'); s(20, 8, '$'); }) },
  ];

  // Where each arena's sign sits: just above head height on its starting floor.
  const signY = map => { const y = map.findIndex(row => row.includes('P')); return y - 1.6; };
  const arena = (k, round) => {
    const f = FIGHTS[k], map = easeAccess(f.map()), type = map.join('').match(/[5-9]/)[0];
    return {
      name: f.name, dark: f.dark, map, bossMode: f.mode,
      ...(f.bossHits ? { bossHits: f.bossHits } : {}),
      signs: [{ x: 2, y: signY(map), t: f.sign }],
      ...(f.hordeStop != null ? { hordeStop: f.hordeStop } : {}),
      ...(SPEED[round] > 1 ? { tuning: { [type]: { speed: SPEED[round] } } } : {}),
    };
  };

  // ---- Giant fights ----
  // A boss for every enemy and hazard that hasn't got one of its own, each level named
  // after it ("Wick-beetle Bossfight"), halfway between the
  // fights above (after levels 5, 15, 25 ...). The giant's spot is marked 0; def.giant says
  // which giant it is (see GIANTS in engine.js). No lanterns here either; fruit instead.
  // A walled arena with a ceiling and a floor: start on the left, boss gate and door on the right.
  const hall = (w, h, extra) => B(w, h, ({ r, s, walls }) => {
    walls(); r(0, 0, w - 1, 0); r(1, h - 3, w - 2, h - 2);
    s(2, h - 4, 'P'); s(4, h - 4, 'Q'); s(6, h - 4, '$');
    r(w - 4, 1, w - 4, h - 4, 'g'); s(w - 3, h - 4, 'D');
    extra({ r, s });
  });
  const GIANT_FIGHTS = [
    { giant: 'B', name: 'Wick-beetle Bossfight', dark: .55, sign: 'THE WICK MATRIARCH · she rears and slams · stomp her',
      map: () => hall(46, 16, ({ r, s }) => { r(10, 10, 15, 10, '='); s(12, 9, 'a'); r(20, 7, 25, 7, '='); s(22, 6, 'q'); r(30, 10, 35, 10, '='); s(32, 9, 'o'); s(28, 12, '0'); }) },
    { giant: 'J', name: 'Puddle Frog Bossfight', dark: .6, sign: 'THE BOG KING · jump his shockwaves · stomp him when he croaks',
      map: () => hall(48, 16, ({ r, s }) => { r(20, 13, 27, 13, '~'); r(9, 10, 14, 10, '='); s(11, 9, 'b'); r(33, 10, 38, 10, '='); s(35, 9, 'a'); r(21, 7, 26, 7, '='); s(23, 6, 'q'); s(32, 12, '0'); }) },
    { giant: 'W', name: 'Wasp Bossfight', dark: .6, sign: 'THE HIVE MOTHER · she dashes, then drops dazed',
      map: () => hall(48, 18, ({ r, s }) => { r(8, 12, 13, 12, '='); s(10, 11, 'o'); r(34, 12, 39, 12, '='); s(36, 11, 'a'); r(19, 9, 28, 9, '='); s(23, 8, 'Q'); s(24, 5, '0'); }) },
    { giant: 'X', name: 'Wick Spider Bossfight', dark: .66, sign: 'THE WIDOW · she drops from the ceiling · stomp her before she climbs',
      map: () => hall(46, 16, ({ r, s }) => { r(9, 10, 13, 10, '='); s(11, 9, 'b'); r(32, 10, 36, 10, '='); s(34, 9, 'a'); s(23, 12, 'q'); s(23, 1, '0'); }) },
    { giant: 'S', name: 'Ember Pot Bossfight', dark: .62, sign: 'THE GREAT KILN · stomp its lid while it cools',
      map: () => hall(46, 16, ({ r, s }) => { r(7, 10, 12, 10, '='); s(9, 9, 'a'); r(33, 10, 38, 10, '='); s(35, 9, 'o'); r(18, 6, 28, 6, '='); s(20, 5, 'q'); s(23, 12, '0'); }) },
    { giant: 'K', name: 'Thornback Bossfight', dark: .62, sign: 'THE THORN TYRANT · only stompable on its back · make it charge the wall',
      map: () => hall(48, 16, ({ r, s }) => { r(10, 10, 15, 10, '='); s(12, 9, 'a'); r(32, 10, 37, 10, '='); s(34, 9, 'b'); r(21, 7, 27, 7, '='); s(24, 6, 'q'); s(30, 12, '0'); }) },
    { giant: 'U', name: 'Glow Jelly Bossfight', dark: .7, sign: 'THE MOON JELLY · stomp it when it surfaces',
      map: () => B(48, 20, ({ r, s, walls }) => {
        walls(); r(0, 0, 47, 0); r(1, 15, 12, 18); r(35, 15, 46, 18); r(13, 15, 34, 18, '~');
        s(2, 14, 'P'); s(4, 14, 'Q'); s(6, 14, '$'); s(9, 14, 'a');
        r(16, 12, 21, 12, '='); s(18, 11, 'o'); r(26, 12, 31, 12, '='); s(28, 11, 'b');
        s(24, 17, '0'); r(44, 1, 44, 14, 'g'); s(45, 14, 'D');
      }) },
    { giant: 'Z', name: 'Spark Bossfight', dark: .7, sign: 'THE LIVING SPARK · it dashes, then drops dazed',
      map: () => hall(48, 18, ({ r, s }) => { r(8, 12, 13, 12, '='); s(10, 11, 'b'); r(34, 12, 39, 12, '='); s(36, 11, 'o'); r(19, 9, 28, 9, '='); s(23, 8, 'q'); s(24, 8, '0'); }) },
    { giant: 'E', name: 'Pendulum Bossfight', dark: .62, sign: 'THE GREAT PENDULUM · hide at the sides · strike when it stops',
      map: () => hall(46, 16, ({ r, s }) => { r(3, 9, 8, 9, '='); s(5, 8, 'a'); r(36, 9, 41, 9, '='); s(38, 8, 'o'); s(23, 1, '0'); }) },
    { giant: 'G', name: 'Wraith Bossfight', dark: .88, sign: 'THE PALE WRAITH · it vanishes · strike when it shrieks',
      map: () => hall(48, 18, ({ r, s }) => { r(8, 12, 13, 12, '='); s(10, 11, 'a'); r(34, 12, 39, 12, '='); s(36, 11, 'a'); r(19, 9, 28, 9, '='); s(23, 8, 'Q'); s(24, 7, '0'); }) },
    { giant: 'Y', name: 'Lantern Pike Bossfight', dark: .68, sign: 'THE LANTERN LEVIATHAN · stomp it when it lands',
      map: () => B(56, 20, ({ r, s, walls }) => {
        walls(); r(0, 0, 55, 0); r(1, 14, 10, 18); r(45, 14, 54, 18); r(11, 14, 44, 18, '~');
        s(2, 13, 'P'); s(4, 13, 'Q'); s(6, 13, '$'); s(8, 13, 'a');
        r(18, 11, 22, 11, '='); s(20, 10, 'o'); r(33, 11, 37, 11, '='); s(35, 10, 'b'); r(26, 8, 29, 8, '='); s(27, 7, 'q');
        s(28, 16, '0'); r(52, 1, 52, 13, 'g'); s(53, 13, 'D');
      }) },
    { giant: 'k', name: 'Crusher Bossfight', dark: .64, sign: 'THE GREAT CRUSHER · stomp it while it’s stuck',
      map: () => hall(46, 16, ({ r, s }) => { r(10, 12, 11, 12); r(34, 12, 35, 12); s(16, 12, 'a'); s(30, 12, 'o'); s(23, 12, 'q'); s(23, 1, '0'); }) },
    { giant: 'N', name: 'Leaping Gar Bossfight', dark: .66, sign: 'THE GAR LORD · it leaps between the lakes · stomp it on land',
      map: () => B(56, 18, ({ r, s, walls }) => {
        walls(); r(0, 0, 55, 0); r(1, 13, 54, 16); r(8, 13, 23, 16, '~'); r(32, 13, 47, 16, '~');
        s(2, 12, 'P'); s(4, 12, 'Q'); s(6, 12, '$');
        r(12, 9, 18, 9, '='); s(15, 8, 'a'); r(36, 9, 42, 9, '='); s(39, 8, 'o'); s(27, 12, 'b');
        s(15, 15, '0'); r(52, 1, 52, 12, 'g'); s(53, 12, 'D');
      }) },
    { giant: 'f', name: 'Fire Bar Bossfight', dark: .7, sign: 'THE FIRE WHEEL · stomp its core when the fire dies',
      map: () => hall(46, 18, ({ r, s }) => { r(8, 9, 13, 9, '='); s(10, 8, 'a'); r(33, 9, 38, 9, '='); s(35, 8, 'b'); s(16, 14, 'q'); s(23, 9, '0'); }) },
    { giant: '*', name: 'Lava Bubble Bossfight', dark: .66, sign: 'THE MAGMA HEART · it hides in the lava · stomp it when it crusts',
      map: () => B(52, 18, ({ r, s, walls }) => {
        walls(); r(0, 0, 51, 0); r(1, 13, 50, 16, '!');
        r(1, 12, 6, 12); s(2, 11, 'P'); s(4, 11, '$');
        r(10, 10, 15, 10); s(12, 9, 'a'); r(19, 8, 24, 8); s(21, 7, 'Q'); r(29, 10, 34, 10); s(31, 9, 'o'); r(39, 12, 49, 12); s(42, 11, 'b');
        s(25, 14, '0'); r(47, 1, 47, 11, 'g'); s(48, 11, 'D');
      }) },
    { giant: 'e', name: 'Spiked Pendulum Bossfight', dark: .66, sign: 'THE THORN PENDULUM · its chain cuts · strike when it stops',
      map: () => hall(46, 16, ({ r, s }) => { r(3, 9, 8, 9, '='); s(5, 8, 'b'); r(36, 9, 41, 9, '='); s(38, 8, 'a'); s(23, 1, '0'); }) },
    { giant: '&', name: 'Shadow Heart Bossfight', dark: .7, hordeStop: 112, hordeSpeed: .5, sign: 'THE SHADOW WALL · its heart hunts you alone · stomp it after it lunges',
      map: () => B(130, 16, ({ r, s, walls }) => {
        walls(); r(0, 0, 129, 0); r(1, 13, 128, 14);
        s(1, 12, '&'); s(3, 12, '0'); s(8, 12, 'P'); s(10, 12, 'Q'); s(12, 12, '$');
        for (let x = 20; x < 110; x += 15) { r(x, 10, x + 4, 10, '='); s(x + 2, 9, 'aobm'[(x / 15) % 4 | 0]); s(x + 9, 12, 'q'); }
        r(126, 1, 126, 12, 'g'); s(127, 12, 'D');
      }) },
    { giant: '%', name: 'Rising Heart Bossfight', dark: .74, hordeStop: 12, hordeSpeed: .55, sign: 'CLIMB ↑ · the dark’s heart hunts you · stomp it after it lunges',
      map: () => B(28, 70, ({ r, s, walls }) => {
        walls(); r(0, 0, 27, 0); r(1, 67, 26, 68);
        s(0, 69, '%'); s(14, 66, '0'); s(4, 66, 'P'); s(6, 66, 'Q'); s(8, 66, '$');
        const A = [4, 9], M = [11, 16], C = [18, 23], cycle = [C, M, A, M];
        for (let k = 0, y = 65; y >= 14; k++, y -= 3) {
          const [x0, x1] = cycle[k % 4]; r(x0, y, x1, y);
          if (k % 3 === 1) s(x0 + 2, y - 1, 'aob'[(k / 3 | 0) % 3]); else if (k % 3 === 2) s(x0 + 2, y - 1, 'q');
        }
        r(1, 11, 10, 11); r(11, 11, 16, 11, '='); r(17, 11, 24, 11); r(25, 11, 26, 11);
        r(25, 1, 25, 10, 'g'); s(26, 10, 'D');
      }) },
  ];
  const giantArena = k => {
    const f = GIANT_FIGHTS[k], map = easeAccess(f.map());
    return {
      name: f.name, dark: f.dark, map, giant: f.giant, giantFight: true,
      signs: [{ x: 2, y: signY(map), t: f.sign }],
      ...(f.hordeStop != null ? { hordeStop: f.hordeStop, tuning: { [f.giant]: { speed: f.hordeSpeed } } } : {}),
    };
  };

  // ---- Towers and the castle ----
  // Every boss fight is a tower in three parts, joined by passage doors (j, walked into,
  // lets out at the matching n): first a climb up the tower's shaft (a lantern part way up),
  // then a run along its battlements (another lantern), then the boss's arena. Beating the
  // boss ends the level (bossEnds), so the arena loses its door and boss gate. The castle,
  // the final boss's, is a long brutal climb instead: floor after floor of a switchback,
  // each crossed end to end past spikes, crumbling stretches and enemies, then a run along
  // the walls, with three lanterns in all. The parts sit side by side in one map, walled
  // apart with rock, bottom-aligned.
  const GAP = 10;
  const grid = (w, h, c = '.') => Array.from({ length: h }, () => Array(w).fill(c));
  const put = (g, x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < g[0].length) g[y][x] = c; };
  // The tower's shaft: zigzag ledges three rows apart, a lantern half way, the door at the top.
  function shaft(R) {
    const w = 22, h = 34, g = grid(w, h);
    put(g, 0, 0, w - 1, 0, '#'); put(g, 0, 0, 0, h - 1, '#'); put(g, w - 1, 0, w - 1, h - 1, '#'); put(g, 0, h - 2, w - 1, h - 1, '#');
    g[h - 3][3] = 'P'; g[h - 3][6] = 'q';
    const A = [3, 8], M = [9, 13], C = [14, 19], cycle = [C, M, A, M];
    let k = 0;
    for (let y = h - 5; y >= 7; y -= 3, k++) {
      const [x0, x1] = cycle[k % 4];
      put(g, x0, y, x1, y, R() < .25 ? '=' : '#');
      if (k === 3) g[y - 1][x0 + 2] = 'L';
      else if (R() < .35) g[y - 1][x0 + 1 + Math.floor(R() * (x1 - x0 - 1))] = R() < .5 ? 'q' : 'a';
      if (k > 1 && R() < .4) g[y - 2][Math.floor((x0 + x1) / 2)] = R() < .5 ? 'F' : 'Z';
    }
    // The top floor (a plank where the last ledge comes up through it) with the door.
    const [m0, m1] = cycle[(k - 1) % 4];
    put(g, 1, 5, w - 2, 5, '#'); put(g, m0, 5, m1, 5, '=');
    g[4][m0 > 10 ? 2 : w - 3] = 'j';
    return g;
  }
  // The battlements: a run with pits and a few guards, a lantern in the middle, the door at the end.
  function battlements(R) {
    const w = 46, h = 14, g = grid(w, h);
    put(g, 0, 0, w - 1, 0, '#'); put(g, 0, 0, 0, h - 1, '#'); put(g, w - 1, 0, w - 1, h - 1, '#'); put(g, 1, h - 3, w - 2, h - 2, '#'); put(g, 0, h - 1, w - 1, h - 1, '#');
    g[h - 4][2] = 'n'; g[h - 4][22] = 'L'; g[h - 4][w - 3] = 'j'; g[h - 4][7] = 'q';
    for (const px of [12, 30]) { const lava = R() < .5; put(g, px, h - 3, px + 2, h - 2, lava ? '!' : '#'); if (!lava) put(g, px, h - 3, px + 2, h - 3, '^'); put(g, px - 1, h - 6, px + 3, h - 6, '='); }
    g[h - 4][17] = 'B'; g[h - 4][37] = R() < .5 ? 'K' : 'R'; g[h - 7][26] = 'W';
    return g;
  }
  // Every tower climbs differently: CLIMBS holds a dozen shapes of shaft, and each tower
  // gets the next one along (towers 13-24 get them again, wider or taller, and mirrored,
  // and so on), so no two towers are alike. Likewise RUNS for the battlements. Every
  // climb starts at the bottom left (P), has a lantern part way up, and ends at the door
  // (j) on its top floor, row 5; every run starts at n on the left, has a lantern in the
  // middle and ends at j on the right.
  const frame = (w, h) => {
    const g = grid(w, h);
    put(g, 0, 0, w - 1, 0, '#'); put(g, 0, 0, 0, h - 1, '#'); put(g, w - 1, 0, w - 1, h - 1, '#'); put(g, 0, h - 2, w - 1, h - 1, '#');
    g[h - 3][2] = 'P';
    return g;
  };
  // The top floor (row 5), crossed by a plank over the last ledge so you jump up through
  // it, and the door at the end away from that.
  const topFloor = (g, x0, x1, door) => {
    const w = g[0].length;
    put(g, 1, 5, w - 2, 5, '#'); put(g, Math.max(1, x0), 5, Math.min(w - 2, x1), 5, '=');
    g[4][door ?? ((x0 + x1) / 2 > w / 2 ? 2 : w - 3)] = 'j';
  };
  const FLY = 'FZW';
  // Rows for ledges from `bottom` up to `top`, evenly spaced and never more than `gap` apart
  // (so the last one is always a jump below the top floor).
  const rowsUp = (bottom, top = 8, gap = 3) => {
    const n = Math.ceil((bottom - top) / gap) + 1;
    return Array.from({ length: n }, (_, k) => Math.round(bottom - k * (bottom - top) / (n - 1)));
  };
  // A shaft's width in three touching thirds: [left, middle, right] x ranges.
  const thirds = w => { const t = Math.floor((w - 4) / 3); return [[2, 1 + t], [2 + t, 1 + 2 * t], [2 + 2 * t, w - 3]]; };
  // Ledges three rows apart, taking their x ranges from `spans` in turn, lantern half way.
  function ledges(g, R, spans, tile = () => '#', foes = .35) {
    const h = g.length;
    let k = 0, last;
    const rows = rowsUp(h - 5);
    for (const y of rows) {
      const [x0, x1] = spans[k % spans.length];
      put(g, x0, y, x1, y, tile(k, R));
      if (k === Math.floor(rows.length / 2)) g[y - 1][x0 + 1] = 'L';
      else if (k > 1 && R() < foes) g[y - 2][Math.floor((x0 + x1) / 2)] = FLY[Math.floor(R() * 3)];
      last = [x0, x1]; k++;
    }
    topFloor(g, last[0], last[1]);
    return g;
  }
  const CLIMBS = [
    // Zigzag: ledges stepping across the shaft and back.
    (R, v) => { const w = 22 + v * 2, g = frame(w, 32 + v * 2), [A, M, C] = thirds(w); return ledges(g, R, [C, M, A, M], () => (R() < .25 ? '=' : '#')); },
    // Switchback stairs: plank steps two rows apart, up to one wall and back.
    (R, v) => {
      const w = 24 + v * 2, h = 30 + v * 3, g = frame(w, h);
      let x = 3, d = 1, y = 8 + 2 * Math.floor((h - 12) / 2), n = 0, last;
      const steps = [];
      while (y >= 8) { steps.push([x, y]); last = [x, x + 2]; if ((d > 0 && x + 4 + 2 > w - 3) || (d < 0 && x - 4 < 2)) d = -d; else x += 4 * d; y -= 2; n++; }
      steps.forEach(([sx, sy], k) => { put(g, sx, sy, sx + 2, sy, '='); if (k === Math.floor(steps.length / 2)) g[sy - 1][sx + 1] = 'L'; else if (k > 2 && k % 4 === 0) g[sy - 3][sx + 1] = 'F'; });
      topFloor(g, last[0], last[1]);
      return g;
    },
    // Twin chimneys: up the left one, through a window in the wall between, up the right.
    (R, v) => {
      const w = 23, h = 31 + v * 3, g = frame(w, h), mid = 11;   // (ledges exactly three rows apart)
      put(g, mid, 6, mid, h - 3, '#');
      const rows = rowsUp(h - 5);
      const half = Math.floor(rows.length / 2);
      let last;
      rows.forEach((y, k) => {
        const left = k <= half, side = k % 2;
        const span = left ? (side ? [6, 9] : [2, 5]) : (side ? [13, 16] : [17, 20]);
        put(g, span[0], y, span[1], y, '#'); last = span;
        if (k === half) { put(g, mid, y - 3, mid, y - 1, '.'); put(g, 12, y, 15, y, '#'); g[y - 1][span[0] + 1] = 'L'; }
        else if (k > 1 && R() < .3) g[y - 2][span[0] + 2] = 'Z';
      });
      g[h - 3][16] = 'B';
      topFloor(g, last[0], last[1]);
      return g;
    },
    // Scaffold: a lattice of short planks, every row offset from the last.
    (R, v) => {
      const w = 26 + v * 2, h = 30 + v * 3, g = frame(w, h);
      const rows = rowsUp(h - 5);
      let last;
      rows.forEach((y, k) => {
        const off = k % 2 ? 5 : 2;
        for (let x = off; x + 1 < w - 1; x += 7) put(g, x, y, x + 2, y, '=');
        last = [off, off + 2];
        if (k === Math.floor(rows.length / 2)) g[y - 1][off + 1] = 'L';
        else if (k > 1 && R() < .5) g[y - 2][off + 8] = FLY[Math.floor(R() * 3)];
      });
      topFloor(g, last[0], last[1]);
      return g;
    },
    // Lifts: ride up one lift to a ledge (the lantern), cross, and up the next.
    (R, v) => {
      const w = 20 + v * 2, h = 30 + v * 2, g = frame(w, h), midY = Math.floor(h / 2) + 1;
      const lift = (x, top, bot) => { g[bot][x] = 'V'; for (const c of [x, x + 1]) { g[top - 1][c] = '|'; g[bot + 1][c] = g[bot + 1][c] === '#' ? '#' : '|'; } };
      lift(4, midY, h - 4);
      put(g, 7, midY, w - 9, midY, '#'); g[midY - 1][8] = 'L'; g[midY - 1][w - 10] = 'B';
      lift(w - 7, 8, midY - 1);
      put(g, 7, midY + 4, 9, midY + 4, '=');
      topFloor(g, w - 7, w - 6);
      return g;
    },
    // Springs: ledge to ledge, each spring flinging you up past the next ledge, seven rows up.
    (R, v) => {
      const w = 22 + v * 2, h = 31 + (v % 2) * 7, g = frame(w, h);
      let sx = 4, y = h - 2, k = 0, last;
      g[h - 2][sx] = 'O';
      const levels = [];
      for (let ly = h - 9; ly >= 8; ly -= 7) levels.push(ly);   // (a spring flings you a good eight rows)
      levels.forEach((ly, n) => {
        // (Planks, so you can rise up through them on the bounce and come down on top.)
        const right = n % 2 === 0, x0 = right ? sx + 2 : sx - 5, x1 = x0 + 3;
        put(g, x0, ly, x1, ly, '=');
        const nx = right ? x1 : x0;
        if (n < levels.length - 1) g[ly][nx] = 'O';
        if (n === Math.floor(levels.length / 2)) g[ly - 1][right ? x0 + 1 : x1 - 1] = 'L';
        else if (n > 0) g[ly - 3][Math.floor((x0 + x1) / 2)] = 'Z';
        sx = nx; last = [x0, x1];
      });
      topFloor(g, last[0], last[1]);
      return g;
    },
    // Crumbling ledges: they fall away under you (and grow back).
    (R, v) => { const w = 22 + v * 2, g = frame(w, 32 + v * 2), [A, M, C] = thirds(w); return ledges(g, R, [A, M, C, M], k => (k % 2 ? 'C' : '#'), .2); },
    // Blinking ledges: every other one is on while the rest are off.
    (R, v) => { const w = 22 + v * 2, g = frame(w, 30 + v * 2), [A, M, C] = thirds(w); return ledges(g, R, [C, M, A, M], k => (k < 1 ? '#' : k % 2 ? 'T' : 'H'), .2); },
    // The cake: tiers of plank narrowing upwards, with guards and spikes on them.
    (R, v) => {
      const w = 28 + v * 2, h = 26 + v * 3, g = frame(w, h);
      const rows = rowsUp(h - 5);
      const c = Math.floor(w / 2), n = rows.length;
      let last;
      rows.forEach((y, k) => {
        const half = Math.max(2, Math.round((w / 2 - 3) * (1 - k / n)));
        put(g, c - half, y, c + half, y, '=');
        last = [c - half, c + half];
        if (k === Math.floor(n / 2)) g[y - 1][c] = 'L';
        else if (k % 2 === 1 && half > 4) g[y - 1][c - half + 1] = 'B';
      });
      topFloor(g, last[0], last[1]);
      return g;
    },
    // The chimney: tall and tight, ledges off one wall then the other.
    (R, v) => { const w = 11, g = frame(w, 36 + v * 4); return ledges(g, R, [[6, 9], [1, 4]], () => '#', .25); },
    // The S-bend: up the lower shaft on the left, along a corridor, up the upper on the right.
    (R, v) => {
      const w = 30, h = 34 + v * 2, g = frame(w, h), cy = 18;
      put(g, 13, cy + 1, w - 2, h - 3, '#'); put(g, 1, 1, 16, cy - 4, '#');
      let k = 0;
      for (const y of rowsUp(h - 5, cy + 3)) { put(g, k % 2 ? 7 : 2, y, k % 2 ? 11 : 6, y, '#'); k++; }
      put(g, 9, cy + 1, 12, cy + 1, '#');
      g[cy][15] = 'L'; g[cy][22] = 'B';
      let last;
      k = 0;
      for (const y of rowsUp(cy - 2)) { const sp = k % 2 ? [17, 21] : [23, 27]; put(g, sp[0], y, sp[1], y, '#'); last = sp; k++; }
      if (!last) last = [23, 27];
      topFloor(g, last[0], last[1], last[0] > 20 ? 18 : w - 3);
      return g;
    },
    // Belts: floor after floor, each with a hole at the end, its conveyor running away from it.
    (R, v) => {
      const w = 24 + v * 2, h = 30 + v * 4, g = frame(w, h);
      let below = h - 2, f = 0, holeAt;
      for (let y = h - 6; y >= 8; y -= 4, f++) {
        const right = f % 2 === 0, hx = right ? w - 4 : 2;
        put(g, 1, y, w - 2, y, right ? '<' : '>'); put(g, hx, y, hx + 1, y, '.');
        g[below - 1][hx] = '#';
        if (f === 2) g[y - 1][right ? 4 : w - 5] = 'L';
        else if (f % 2) g[y - 1][Math.floor(w / 2)] = R() < .5 ? 'B' : 'K';
        below = y; holeAt = hx;
      }
      g[below - 1][holeAt === 2 ? w - 4 : 2] = '#';
      topFloor(g, holeAt === 2 ? w - 5 : 1, holeAt === 2 ? w - 3 : 4);
      return g;
    },
  ];
  // Mirror a climb left to right (its start moves to the bottom right).
  const mirror = g => g.map(row => row.slice().reverse());
  const RUNS = [
    // Pits under planks, a few guards.
    (R, v) => { const w = 46 + v * 4, h = 14, g = runFrame(w, h); for (const px of [12, 30]) { const lava = R() < .5; put(g, px, h - 3, px + 2, h - 2, lava ? '!' : '#'); if (!lava) put(g, px, h - 3, px + 2, h - 3, '^'); put(g, px - 1, h - 6, px + 3, h - 6, '='); } g[h - 4][22] = 'L'; g[h - 4][17] = 'B'; g[h - 4][37] = R() < .5 ? 'K' : 'R'; g[h - 7][26] = 'W'; return g; },
    // A lava moat, crossed on crumbling bridges.
    (R, v) => { const w = 48 + v * 4, h = 14, g = runFrame(w, h); put(g, 6, h - 3, w - 8, h - 2, '!'); for (let x = 7; x < w - 9; x += 9) { put(g, x, h - 5, x + 5, h - 5, 'C'); } put(g, 21, h - 5, 25, h - 5, '#'); g[h - 6][23] = 'L'; g[h - 8][30] = 'Z'; return g; },
    // A pendulum hall under a low roof.
    (R, v) => { const w = 46 + v * 4, h = 14, g = runFrame(w, h); put(g, 1, 1, w - 2, 3, '#'); for (let x = 9; x < w - 6; x += 8) { if (Math.abs(x - 22) < 3) continue; g[4][x] = R() < .5 ? 'e' : 'E'; } g[h - 4][22] = 'L'; g[h - 4][29] = 'B'; return g; },
    // Rooftops: separate roofs with drops between and wasps above.
    (R, v) => { const w = 50 + v * 4, h = 16, g = runFrame(w, h); for (let x = 8; x < w - 6; x += 10) put(g, x, h - 3, x + 2, h - 2, '.'); for (let x = 8; x < w - 6; x += 10) put(g, x - 1, h - 4, x - 1, h - 4, '#'); g[h - 4][22] = 'L'; g[h - 8][18] = 'W'; g[h - 8][38] = 'W'; g[h - 4][32] = 'A'; return g; },
    // Lifts over a spike pit.
    (R, v) => { const w = 46 + v * 4, h = 14, g = runFrame(w, h); put(g, 6, h - 3, w - 8, h - 3, '^'); g[h - 5][7] = 'M'; g[h - 5][5] = '|'; put(g, 20, h - 5, 25, h - 5, '#'); g[h - 5][19] = '|'; g[h - 6][23] = 'L'; g[h - 5][27] = 'M'; g[h - 5][26] = '|'; g[h - 5][w - 7] = '|'; return g; },
    // Fire bars, with blinking blocks to cross a pit.
    (R, v) => { const w = 48 + v * 4, h = 14, g = runFrame(w, h); g[h - 6][14] = 'f'; g[h - 6][36] = 'f'; put(g, 27, h - 3, 32, h - 2, '!'); put(g, 27, h - 5, 28, h - 5, 'T'); put(g, 31, h - 5, 32, h - 5, 'H'); g[h - 4][22] = 'L'; g[h - 4][8] = 'B'; return g; },
  ];
  function runFrame(w, h) {
    const g = grid(w, h);
    put(g, 0, 0, w - 1, 0, '#'); put(g, 0, 0, 0, h - 1, '#'); put(g, w - 1, 0, w - 1, h - 1, '#'); put(g, 1, h - 3, w - 2, h - 2, '#'); put(g, 0, h - 1, w - 1, h - 1, '#');
    g[h - 4][2] = 'n'; g[h - 4][w - 3] = 'j';
    return g;
  }
  let towerNo = 0;

  // The Void's arena: islands over the drop, the Void hanging above them (it sinks to just
  // above them when it collapses).
  const voidDef = () => ({
    name: 'The Sky Spire', dark: .4, giant: 'Ø', sky: true,
    map: B(52, 20, ({ r, s }) => {
      r(0, 0, 51, 0); r(0, 0, 0, 19); r(51, 0, 51, 19);
      r(1, 13, 7, 13); s(3, 12, 'P');
      r(11, 13, 15, 13); s(13, 12, 'a');
      r(19, 14, 24, 14); r(28, 13, 32, 13);
      r(36, 14, 41, 14); s(38, 13, 'a'); r(45, 13, 50, 13);
      s(26, 5, '0');
    }),
    signs: [{ x: 2, y: 9.4, t: 'THE VOID · it pulls you in: run! · stomp it when it collapses' }],
  });
  // The Melon Brute's arena: a long floor to roll along, planks to jump up out of its way.
  const melonDef = () => ({
    name: 'The Melon Vault', dark: .55, giant: 'Ɱ',
    map: easeAccess(B(46, 16, ({ r, s, walls }) => {
      walls(); r(0, 0, 45, 0); r(0, 13, 45, 15);
      s(2, 12, 'P');
      r(8, 9, 13, 9, '='); s(10, 8, 'a'); r(20, 8, 26, 8, '='); r(33, 9, 38, 9, '='); s(35, 8, 'a');
      s(30, 12, '0');
    })),
    signs: [{ x: 2, y: 9.4, t: 'THE MELON BRUTE · it rolls till it hits a wall · stomp it while it’s cracked' }],
  });

  // Castle challenges: each world castle is two of these, then its keeper's hall. Every one
  // is a 16-row hall (floor at F, you stand on S) with its entry on the left and its door
  // on the right; `first` puts the start there instead of an entry. Each has a lantern.
  function course(w, first) {
    const h = 16, g = runFrame(w, h);
    if (first) { g[h - 4][2] = 'P'; g[h - 4][4] = 'a'; }
    return { g, h, F: h - 3, S: h - 4, x0: 7, x1: w - 9 };
  }
  const COURSES = {
    // Hopping stones over lava, lava bubbles leaping up between them.
    lavaHops(R, first) {
      const c = course(64, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F + 1, '!');
      let x = c.x0 + 2, n = 0;
      while (x + 2 < c.x1 - 1) {
        const y = F - 1 - Math.floor(R() * 3);
        put(g, x, y, x + 2, y, '#');
        if (++n === 4) g[y - 1][x + 1] = 'L';
        if (n % 2 === 0) g[F][x - 2] = '*';
        x += 6;
      }
      return g;
    },
    // Crumbling bridges low over lava, with fire bars turning over them.
    crumbleLava(R, first) {
      const c = course(62, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F + 1, '!');
      let n = 0;
      for (let x = c.x0 + 1; x + 3 <= c.x1; x += 7, n++) {
        put(g, x, F - 1, x + 4, F - 1, n === 3 ? '#' : 'C');
        if (n === 3) g[F - 2][x + 2] = 'L';
        else if (n % 2 === 1) g[F - 5][x + 2] = 'f';
      }
      return g;
    },
    // Lifts sliding back and forth over a bed of spikes.
    liftsSpikes(R, first) {
      const c = course(60, first), { g, F } = c, y = F - 2;
      put(g, c.x0 - 1, F, c.x1 + 1, F, '^');
      g[y][c.x0 - 2] = '|'; g[y][c.x0] = 'M';
      put(g, 24, y, 28, y, '#'); g[y - 1][26] = 'L'; g[y][23] = '|';
      g[y][29] = '|'; g[y][31] = 'M'; g[y][c.x1 + 2] = '|';
      return g;
    },
    // A flooded hall: swim the channel past pike and jellies.
    swim(R, first) {
      const c = course(60, first), { g, F } = c;
      put(g, c.x0, F - 3, c.x1, F + 1, '~'); put(g, c.x0 - 1, F - 3, c.x0 - 1, F - 1, '#');
      put(g, 28, F - 3, 31, F + 1, '#'); g[F - 4][29] = 'L';
      g[F][16] = 'Y'; g[F - 1][40] = 'U'; g[F][46] = 'Y';
      return g;
    },
    // Conveyors running against you, crushers waiting overhead.
    conveyCrush(R, first) {
      const c = course(62, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F, '<');
      for (let x = c.x0 + 5; x < c.x1 - 2; x += 9) g[3][x] = 'k';
      g[F - 1][30] = 'L'; put(g, 29, F, 31, F, '#');
      return g;
    },
    // Blinking blocks over lava: cross on whichever set is lit.
    blinkLava(R, first) {
      const c = course(60, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F + 1, '!');
      let n = 0;
      for (let x = c.x0 + 1; x + 1 <= c.x1; x += 4, n++) put(g, x, F - 1, x + 1, F - 1, n === 6 ? '#' : n % 2 ? 'H' : 'T');
      g[F - 2][c.x0 + 1 + 6 * 4] = 'L';
      return g;
    },
    // Sky: no floor at all, islands and turn blocks over the drop.
    skyTurns(R, first) {
      const w = 60, h = 16, g = runFrame(w, h), F = h - 3;
      if (first) { g[h - 4][2] = 'P'; g[h - 4][4] = 'a'; }
      put(g, 1, F, w - 2, h - 1, '.');
      const isle = (a, b) => put(g, a, F, b, F, '#');
      isle(1, 5); g[F][10] = ':'; isle(14, 17); g[F][21] = ';'; isle(25, 28); g[F - 1][26] = 'L';
      g[F][32] = ':'; isle(36, 39); g[F][43] = ';'; isle(47, w - 2);
      return g;
    },
    // Sky: wheels to ride from island to island.
    skyWheels(R, first) {
      const w = 62, h = 16, g = runFrame(w, h), F = h - 3;
      if (first) { g[h - 4][2] = 'P'; g[h - 4][4] = 'a'; }
      put(g, 1, F, w - 2, h - 1, '.');
      const isle = (a, b) => put(g, a, F, b, F, '#');
      isle(1, 5); g[F - 2][10] = ','; isle(15, 18); g[F - 1][17] = 'L'; g[F - 2][23] = 'x'; isle(28, 31);
      g[F - 2][36] = ','; isle(41, 44); g[F - 2][49] = 'x'; isle(54, w - 2);
      return g;
    },
    // Crumbling ledges over a spike pit, beetles on the safe ones.
    crumbleSpikes(R, first) {
      const c = course(62, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F, '^');
      let n = 0;
      for (let x = c.x0 + 1; x + 3 <= c.x1; x += 6, n++) {
        const y = F - 2 - (n % 2);
        put(g, x, y, x + 3, y, n % 3 === 2 ? '#' : 'C');
        if (n === 5) g[y - 1][x + 1] = 'L';
        else if (n % 3 === 2) g[y - 1][x + 2] = 'B';
      }
      return g;
    },
    // Pendulums swinging across a run of narrow ledges over pits.
    pendulums(R, first) {
      const c = course(62, first), { g, F } = c;
      put(g, 1, 1, c.x1 + 6, 2, '#');
      for (let x = c.x0 + 2; x < c.x1 - 1; x += 8) { put(g, x, F, x + 2, F + 1, '.'); g[3][x + 5] = R() < .5 ? 'e' : 'E'; }
      g[F - 1][30] = 'L';
      return g;
    },
    // Springs over lava up onto planks.
    springLava(R, first) {
      const c = course(60, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F + 1, '!');
      for (let x = c.x0 + 2, n = 0; x + 6 <= c.x1; x += 10, n++) {
        put(g, x, F - 1, x + 1, F - 1, '#'); g[F - 1][x + 1] = 'O';
        put(g, x + 3, F - 6, x + 7, F - 6, n === 2 ? '#' : '=');
        if (n === 2) g[F - 7][x + 5] = 'L';
      }
      return g;
    },
    // Lava pits, each with a lava bubble leaping out of it.
    bubblePits(R, first) {
      const c = course(62, first), { g, F } = c;
      for (let x = c.x0 + 1, n = 0; x + 3 <= c.x1; x += 7, n++) {
        put(g, x, F, x + 2, F + 1, '!'); g[F][x + 1] = '*';
        if (n === 3) g[F - 1][x + 5] = 'L';
        if (n % 2 === 1) g[F - 5][x + 5] = 'f';
      }
      return g;
    },
    // Lifts over lava.
    liftsLava(R, first) {
      const g = COURSES.liftsSpikes(R, first);
      for (const row of g) for (let x = 0; x < row.length; x++) if (row[x] === '^') row[x] = '!';
      return g;
    },
    // Ice over spike pits: slippery run-ups to every jump.
    icePits(R, first) {
      const c = course(62, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F, 'i');
      for (let x = c.x0 + 4, n = 0; x + 2 <= c.x1 - 2; x += 7, n++) { put(g, x, F, x + 2, F, '^'); if (n === 3) g[F - 1][x + 5] = 'L'; }
      return g;
    },
    // Ice ledges climbing up and down, crumbling ones between.
    iceSteps(R, first) {
      const c = course(62, first), { g, F } = c;
      put(g, c.x0, F, c.x1, F, '^');
      for (let x = c.x0 + 1, n = 0; x + 3 <= c.x1; x += 6, n++) {
        const y = F - 1 - (n % 3);
        put(g, x, y, x + 3, y, n % 2 ? 'C' : 'i');
        if (n === 4) g[y - 1][x + 1] = 'L';
      }
      return g;
    },
  };

  // The castles: one at the end of every world but the last (whose castle is the Last
  // Dark's), each with its own keeper (see stepKeeper in engine.js). A castle's arena is a
  // hall with planks to get above its keeper; fliers hover high, walkers stand on the floor.
  const CASTLES = [
    { world: 'The Hollow Spire', name: 'Candle Keep', giant: 'Γ', course: ['lavaHops', 'crumbleLava'], sign: 'THE CANDLE KING · mind the wax and the flames · stomp him when he melts after a hop' },
    { world: 'The Lighthouse', name: 'Lighthouse Castle', giant: 'Δ', course: ['swim', 'liftsSpikes'], sign: 'THE LIGHTHOUSE CRAB · it scuttles into walls · stomp it while it’s stuck' },
    { world: 'The Powder Works', name: 'Clockwork Castle', giant: 'Ξ', course: ['conveyCrush', 'blinkLava'], sign: 'THE CLOCKWORK KNIGHT · jump his gears · stomp him while he winds down' },
    { world: 'The Neo Ledges', name: 'Storm Castle', giant: 'Λ', fly: true, course: ['skyTurns', 'skyWheels'], sign: 'THE STORM ROC · it swoops low · stomp it when it lands to rest' },
    { world: 'The Soot Canals', name: 'Rat Castle', giant: 'Π', course: ['crumbleSpikes', 'pendulums'], sign: 'THE RAT KING · dodge his dash · stomp him on his throne' },
    { world: 'The Melon Patch', name: 'Pumpkin Castle', giant: 'Φ', course: ['springLava', 'pendulums'], sign: 'THE PUMPKIN KNIGHT · his bombs land where they’re marked · stomp him when he’s dizzy' },
    { world: 'The Bell Foundry', name: 'Smog Castle', giant: 'Ψ', fly: true, course: ['bubblePits', 'liftsLava'], sign: 'THE SMOG DRAGON · it breathes fire across the floor · stomp it when it lands' },
    { world: 'The Cinder Mines', name: 'Crystal Castle', giant: 'Σ', course: ['icePits', 'iceSteps'], sign: 'THE CRYSTAL MOLE · it bursts up where the floor glows · stomp it while it’s stunned' },
  ];
  function castleOf(k) {
    const c = CASTLES[k];
    const def = {
      name: c.name, dark: .7, giant: c.giant, bossHits: 4,
      course: R => c.course.map((k, n) => COURSES[k](R, n === 0)),
      map: hall(48, 16, ({ r, s }) => {
        r(8, 10, 13, 10, '='); s(10, 9, 'a'); r(34, 10, 39, 10, '='); s(36, 9, 'a');
        r(20, 7, 27, 7, '='); s(30, c.fly ? 4 : 12, '0');
      }),
      signs: [{ x: 2, y: 9.4, t: c.sign }],
    };
    return { ...tower(def, 900 + k * 17, true), chapter: c.world, boss: true, castleOf: k, since: 10 };
  }
  const castleAfter = Object.fromEntries(CASTLES.map((c, k) => [c.world, k]));

  // The Sky Spire, the Sky Roads' tower: no floor, just the long drop under a climb of
  // islands, turn blocks, crumbling stone, a wheel and blinking blocks, then a run of
  // islands across the sky.
  function skyClimb() {
    const w = 24, h = 50, g = frame(w, h);
    put(g, 6, h - 2, w - 2, h - 1, '.');                  // the floor's gone: below is the sky
    const isle = (x0, x1, y) => put(g, x0, y, x1, y, '#');
    isle(7, 9, h - 5);
    g[h - 7][12] = ':';
    isle(15, 17, h - 11);
    put(g, 19, h - 14, 21, h - 14, 'C');
    isle(15, 17, h - 17); g[h - 18][16] = 'L';
    g[h - 21][10] = 'x';
    isle(5, 7, h - 27);
    put(g, 2, h - 30, 4, h - 30, 'T'); put(g, 6, h - 33, 8, h - 33, 'H');
    g[h - 35][11] = ';';
    isle(14, 16, h - 39);
    isle(10, 12, h - 42);
    topFloor(g, 10, 12, w - 3);
    return g;
  }
  function skyRun() {
    const w = 56, h = 16, g = runFrame(w, h);
    put(g, 1, h - 3, w - 2, h - 1, '.');
    const isle = (x0, x1) => put(g, x0, h - 3, x1, h - 3, '#');
    isle(1, 5); g[h - 7][10] = 'W';
    g[h - 3][10] = ':';
    isle(14, 17); g[h - 4][15] = 'L';
    g[h - 5][24] = ',';
    isle(30, 33);
    for (const x of [36, 38, 40]) g[h - 4][x] = 'd';
    isle(43, 46);
    g[h - 4][49] = ':';
    isle(53, w - 2);
    return g;
  }

  // The castle's climb: floors four rows apart, each with one hole up at the end opposite
  // the last, so every floor is crossed end to end; a step under each hole; spikes, crumbling
  // stretches and enemies along the way; lanterns a third and two thirds of the way up.
  function castleClimb(R) {
    const w = 40, h = 74, g = grid(w, h), FOES = ['B', 'K', 'R', 'S', 'A', 'J'];
    put(g, 0, 0, w - 1, 0, '#'); put(g, 0, 0, 0, h - 1, '#'); put(g, w - 1, 0, w - 1, h - 1, '#'); put(g, 0, h - 4, w - 1, h - 1, '#');
    g[h - 5][3] = 'P'; g[h - 5][5] = '$';
    const floors = [];
    for (let y = h - 8; y >= 6; y -= 4) floors.push(y);
    let below = h - 4;
    floors.forEach((y, f) => {
      const holeRight = f % 2 === 0, hx = holeRight ? w - 5 : 3;
      put(g, 1, y, w - 2, y, '#'); put(g, hx, y, hx + 1, y, '.');
      g[below - 1][hx] = '#';                                // a step under the hole
      // Along the floor below: a spike or two to hop and somebody in the way, the spikes at
      // least SPACE tiles apart and the foe FOE_SPACE from them (so you never land from one
      // straight onto the next).
      const from = holeRight ? 6 : 8, to = holeRight ? w - 9 : w - 7, SPACE = 6, FOE_SPACE = 8, spikes = [];
      for (let n = 0; n < 2; n++) { const sx = from + Math.floor(R() * (to - from)); if (g[below][sx] === '#' && g[below - 1][sx] === '.' && spikes.every(x => Math.abs(x - sx) >= SPACE)) { g[below][sx] = '^'; spikes.push(sx); } }
      let ex = from + Math.floor(R() * (to - from));
      for (let k = 0; k < 10 && spikes.some(x => Math.abs(x - ex) < FOE_SPACE); k++) ex = from + Math.floor(R() * (to - from));
      if (g[below - 1][ex] === '.' && !spikes.some(x => Math.abs(x - ex) < FOE_SPACE)) g[below - 1][ex] = FOES[Math.floor(R() * FOES.length)];
      if (f % 3 === 2) { const cx = from + Math.floor(R() * (to - from - 5)); put(g, cx, y, cx + 4, y, 'C'); }
      if (f % 4 === 1 && g[below - 3][20] === '.') g[below - 3][20] = R() < .5 ? 'W' : 'Z';
      if (f === Math.floor(floors.length / 3) || f === Math.floor(floors.length * 2 / 3)) g[y - 1][holeRight ? 6 : w - 7] = 'L';
      else if (f % 2 === 1) g[y - 1][holeRight ? 8 : w - 9] = R() < .5 ? 'q' : 'a';
      below = y;
    });
    // The top floor's door, at the end away from where you come up.
    const lastRight = (floors.length - 1) % 2 === 0;
    g[floors[floors.length - 1] - 1][lastRight ? 2 : w - 3] = 'j';
    return g;
  }
  // The castle's walls: a long run of pits, thorny pendulums and fire bars, one lantern.
  function castleWalls(R) {
    const w = 72, h = 16, g = grid(w, h);
    put(g, 0, 0, w - 1, 0, '#'); put(g, 0, 0, 0, h - 1, '#'); put(g, w - 1, 0, w - 1, h - 1, '#'); put(g, 1, h - 3, w - 2, h - 1, '#');
    g[h - 4][2] = 'n'; g[h - 4][36] = 'L'; g[h - 4][w - 3] = 'j'; g[h - 4][6] = 'Q';
    for (const px of [10, 24, 46, 58]) put(g, px, h - 3, px + 2, h - 2, '!');
    for (const ax of [17, 31, 52, 64]) g[h - 7][ax] = R() < .7 ? 'e' : 'E';
    g[h - 8][40] = 'f'; g[h - 6][28] = 'W'; g[h - 4][43] = 'K';
    return g;
  }
  // Towers are meant to be hard going: on top of each climb's and run's own design, spikes
  // in the middle of the wider ledges (only where the part can still be finished: checked),
  // flyers in the air between the ledges and guards on the wider ones; the run gets an
  // archer and a strip of spikes too. (The castle and the Sky Spire have their own designs.)
  function harden(g, R, run) {
    const h = g.length, w = g[0].length;
    const asLevel = () => ({ map: g.map(r => r.join('').replace(/n/g, 'P').replace(/j/g, 'D')) });
    const ok = () => { const a = LF.analyze(asLevel()); return a.ok && a.litOk === a.lanterns; };
    const free = (x, y) => g[y]?.[x] === '.';
    const near = (x, y, cs) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (cs.includes(g[y + dy]?.[x + dx])) return true; return false; };
    // The ledges: runs of floor with open air above.
    const ledges = [];
    for (let y = 3; y < h - 1; y++) {
      let x0 = -1;
      for (let x = 1; x <= w - 1; x++) {
        const top = '#=C'.includes(g[y][x]) && free(x, y - 1);
        if (top && x0 < 0) x0 = x;
        if ((!top || x === w - 1) && x0 >= 0) { const x1 = top ? x : x - 1; if (x1 - x0 >= 3) ledges.push({ y, x0, x1 }); x0 = -1; }
      }
    }
    for (const l of ledges) {
      const mid = Math.floor((l.x0 + l.x1) / 2);
      if (near(mid, l.y - 1, 'PLjnD')) continue;
      // A spike in the middle of the ledge (kept only if the part can still be finished).
      // (Only on solid stone, never on a plank you come up through, with room either side.)
      if (l.x1 - l.x0 >= 5 && R() < .5 && g[l.y][mid] === '#' && g[l.y][mid - 1] === '#' && g[l.y][mid + 1] === '#' && free(mid, l.y - 1) && free(mid, l.y - 2)) {
        g[l.y - 1][mid] = '^';
        if (!ok()) g[l.y - 1][mid] = '.';
      }
      // A guard on a wide ledge, or a flyer in the air above it.
      const gx = l.x0 + 1;
      if (l.x1 - l.x0 >= 5 && R() < .35 && free(gx, l.y - 1) && g[l.y - 1][gx] === '.') g[l.y - 1][gx] = R() < .25 ? 'K' : 'B';
      else if (R() < .55 && free(mid, l.y - 3) && free(mid, l.y - 4)) g[l.y - 3][mid] = 'FZW'[Math.floor(R() * 3)];
    }
    if (run) {
      const fy = h - 4;
      for (const x of [9, w - 12]) if (free(x, fy) && free(x + 1, fy) && !near(x, fy, 'Ljn')) { g[fy][x] = g[fy][x + 1] = '^'; if (!ok()) g[fy][x] = g[fy][x + 1] = '.'; }
      const ax = Math.floor(w * .7);
      if (free(ax, fy)) g[fy][ax] = 'A';
    }
    return g;
  }

  // Every platform in a boss's arena must be reachable with ordinary jumps (no taking a hit
  // to get there): for each one that isn't, put a plank step half way between it and the
  // nearest spot you can reach, and look again, until they all are.
  function reachAll(map) {
    const g = LF.normalize(map).map(r => r.split('')), h = g.length, w = g[0].length;
    const solidish = c => '#=CTHi<>O123'.includes(c);
    const standable = (x, y) => g[y][x] === '.' && g[y - 1][x] === '.' && solidish(g[y + 1][x]);
    for (let round = 0; round < 30; round++) {
      const a = LF.analyze({ map: g.map(r => r.join('')), noDoor: true });
      const reached = [], missing = [];
      for (let y = 2; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!standable(x, y)) continue;
        (a.seen[y * w + x] ? reached : missing).push({ x, y });
      }
      if (!missing.length || !reached.length) break;
      // The unreached spot closest to anywhere reachable, and that reachable spot.
      let best = null;
      for (const m of missing) for (const r of reached) {
        const d = Math.hypot(m.x - r.x, (m.y - r.y) * 1.5);
        if (!best || d < best.d) best = { m, r, d };
      }
      const { m, r } = best, sy = Math.round((m.y + r.y) / 2), mx = Math.round((m.x + r.x) / 2);
      // A three-wide plank under the half-way spot (nudged sideways if something's in the way).
      let placed = false;
      for (const dx of [0, 1, -1, 2, -2, 3, -3]) {
        const x0 = mx + dx - 1, row = sy + 1;
        if (x0 < 1 || x0 + 2 > w - 2 || row >= h - 1) continue;
        let ok = true;
        for (let x = x0; x <= x0 + 2 && ok; x++) for (const y of [row, sy, sy - 1]) if (g[y]?.[x] !== '.') ok = false;
        if (!ok) continue;
        for (let x = x0; x <= x0 + 2; x++) g[row][x] = '=';
        placed = true; break;
      }
      if (!placed) break;
    }
    return g.map(r => r.join(''));
  }

  // Put the parts side by side and wire up the arena: its start becomes the last entry,
  // its door and boss gate go, and anything it measured in columns or rows moves with it.
  // (design: which climb and run, for towers added later, so the rest keep theirs.)
  function tower(def, seed, castle, sky, design) {
    const R = LF.rng(seed);
    // (The only fruit in an arena is apples: every bit of fruit there becomes one.)
    // (No hordes in boss fights: any horde marker in the arena goes.)
    const arenaRows = reachAll(def.map.map(row => row.replace(/[&%]/g, '.'))).map(row => row.replace(/P/g, 'n').replace(/[Dg]/g, '.').split(''));
    arenaRows.forEach(row => row.forEach((c, x) => { if (LF.FRUITS[c]) row[x] = 'a'; }));
    // (Each tower its own climb and run: see CLIMBS and RUNS.)
    const t = design ?? (castle || sky ? 0 : towerNo++), cv = Math.floor(t / CLIMBS.length);
    const climb = sky ? skyClimb() : castle ? castleClimb(R) : CLIMBS[t % CLIMBS.length](R, cv);
    const run = sky ? skyRun() : castle ? castleWalls(R) : RUNS[(t + Math.floor(t / RUNS.length)) % RUNS.length](R, Math.floor(t / RUNS.length) % 3);
    if (!castle && !sky) { harden(climb, R, false); harden(run, R, true); }
    const parts = def.course ? [...def.course(R), arenaRows] : [castle || sky || cv % 2 === 0 ? climb : mirror(climb), run, arenaRows];
    const h = Math.max(...parts.map(p => p.length));
    const w = parts.reduce((s, p) => s + p[0].length, 0) + GAP * (parts.length - 1);
    const g = grid(w, h, '#'), at = [];
    let x0 = 0;
    for (const p of parts) {
      const y0 = h - p.length;
      at.push({ x: x0, y: y0 });
      p.forEach((row, y) => row.forEach((c, x) => { g[y0 + y][x0 + x] = c; }));
      x0 += p[0].length + GAP;
    }
    const arena = at[at.length - 1], climbAt = at[0], runAt = at[1];
    // A lantern just before the boss's door (the last passage before the arena): a
    // checkpoint right outside the fight.
    for (let y = h - 1; y >= 0; y--) {
      const jx = g[y].lastIndexOf('j', arena.x - 1);
      if (jx < runAt.x) continue;
      const spot = [jx - 2, jx - 1, jx + 1].find(x => g[y][x] === '.' && LF.isSolid(g[y + 1]?.[x]));
      if (spot != null) g[y][spot] = 'L';
      break;
    }
    const out = {
      // No guns in a tower: the boss falls to 3 stomps, and flies into a fury after each.
      ...def, map: g.map(row => row.join('')), noDoor: true, bossEnds: true, arenaX: arena.x, noAmmo: true, bossFury: true, bossHits: def.bossHits ?? (castle ? 5 : 3), castle: !!castle,
      signs: [
        { x: climbAt.x + 2, y: climbAt.y + parts[0].length - 4.6, t: def.course ? `${def.name.toUpperCase()} · no guns here · onward →` : castle ? 'THE CASTLE · climb, floor after floor · no guns here' : 'CLIMB THE TOWER ↑ · no guns here: stomp' },
        { x: runAt.x + 2, y: runAt.y + parts[1].length - 6.6, t: def.course ? 'keep going →' : 'along the battlements →' },
        ...(def.signs || []).map(s => ({ ...s, x: s.x + arena.x, y: s.y + arena.y })),
      ],
    };
    delete out.hordeStop; delete out.course;
    return out;
  }

  // Lay the fights in: a boss fight after every 10th level and a giant halfway between.
  // The Sky Roads (levels-12.js) go in after the Powder Works, as a world of their own.
  const L = LF.LEVELS, regular = L.slice(), out = [];
  regular.forEach((lv, i) => {
    out.push(lv);
    const n = i + 1, chapter = lv.chapter;
    if (n % 10 === 0 && FIGHTS[n / 10 - 1]) out.push({ ...tower(arena(n / 10 - 1, Math.floor((n / 10 - 1) / 5)), 300 + n), chapter, boss: true });
    else if (n % 10 === 5 && GIANT_FIGHTS[(n - 5) / 10]) out.push({ ...tower(giantArena((n - 5) / 10), 300 + n), chapter, boss: true });
    const chapterEnds = regular[i + 1] && regular[i + 1].chapter !== chapter;
    // A world's last chapter ends at its castle.
    if (chapterEnds && castleAfter[chapter] != null) out.push(castleOf(castleAfter[chapter]));
    if (chapter === 'The Powder Works' && chapterEnds) {
      out.push(...(LF.SKY_LEVELS || []));
      // ...ending at the Sky Spire, where the Soot Queen nests above the clouds, then the
      // Sky Roads' castle.
      out.push({ ...tower(voidDef(), 777, false, true), chapter: 'The Neo Ledges', boss: true, sky: true, since: 6 });
      out.push(castleOf(castleAfter['The Neo Ledges']));
    }
    // And the Melon Patch (levels-13.js) closes the Garden Market.
    if (chapter === 'The Ember Gardens' && chapterEnds) {
      out.push(...(LF.MELON_LEVELS || []));
      // ...ending at the Melon Vault, the Melon Brute's tower, then the Garden Market's castle.
      out.push({ ...tower(melonDef(), 778, false, false, 40), chapter: 'The Melon Patch', boss: true, since: 7 });
      out.push(castleOf(castleAfter['The Melon Patch']));
    }
  });
  // ---- The final boss ----
  // The very last level, a chapter of its own: the Last Dark.
  const finalMap = B(60, 20, ({ r, s, walls }) => {
    walls(); r(0, 0, 59, 0); r(1, 17, 58, 18);
    s(2, 16, 'P'); s(4, 16, '$'); s(6, 16, 'Q'); s(8, 16, 'a');
    r(10, 13, 15, 13, '='); s(12, 12, 'o'); r(44, 13, 49, 13, '='); s(46, 12, 'b');
    r(20, 10, 26, 10, '='); s(23, 9, '$'); r(33, 10, 39, 10, '='); s(36, 9, 'Q');
    r(27, 7, 32, 7, '='); s(29, 6, 'a'); s(52, 16, '$');
    s(30, 9, '0'); r(56, 1, 56, 16, 'g'); s(57, 16, 'D');
  });
  out.push({
    ...tower({ name: 'Final Bossfight', dark: .82, map: easeAccess(finalMap), giant: 'Ω',
      signs: [{ x: 2, y: 14.4, t: 'THE LAST DARK · 5 stomps · stomp it when it dives to the floor' }] }, 999, true),
    chapter: 'The Last Night', boss: true, finalFight: true,
  });
  // The newer fruit (strawberry, cherry, blueberry) grow in the story levels too: every
  // third apple outside the towers and the Sky Roads becomes one of them, in turn.
  const NEW_FRUIT = ['s', 'ç', 'ƀ'];
  let apples = 0;
  for (const d of out) {
    if (d.boss || d.sky || !Array.isArray(d.map)) continue;
    d.map = d.map.map(row => row.replace(/a/g, () => (apples++ % 3 === 1 ? NEW_FRUIT[Math.floor(apples / 3) % 3] : 'a')));
  }
  L.length = 0; L.push(...out);
})();
