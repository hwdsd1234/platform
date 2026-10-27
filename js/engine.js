// Lanternfall engine: level parsing, physics, enemies. No DOM.
(() => {
  const LF = window.LF = window.LF || {};
  const TS = LF.TS = 32;
  const G = 2100, MAXFALL = 900, RUN = 250, JUMP = 700, SPRING = 1080;
  const FAST = 1.4;
  // The pear: the slowest you fall gliding, how high its spin lifts you (as a share of the
  // banana's double jump at full height), the fastest you fall after it.
  const GLIDE_FALL = 95, SPIN_HEIGHT = .75, SPUN_FALL = 300;
  // (SINK: the fastest you sink in water; WATER_G: how much of gravity you feel in it.)
  const WALL_SLIDE = 110, WALL_KICK = 330, BOOST = 1.22, REGROW = 12, SINK = 110, WATER_G = .8;

  // Per-level player settings, set in the editor's Player dialog (def.player).
  // Most are multipliers on the normal feel; airJumps and ammo are counts.
  LF.PLAYER_TUNE = {
    jump: { label: 'Jump height', min: .5, max: 2.5, step: .05, def: 1 },
    run: { label: 'Run speed', min: .5, max: 2.5, step: .05, def: 1 },
    air: { label: 'Air control', min: .25, max: 2, step: .05, def: 1 },
    gravity: { label: 'Gravity', min: .4, max: 2, step: .05, def: 1, note: 'lower = floatier; jump height stays the same' },
    wallKick: { label: 'Wall jump distance', min: 0, max: 2.5, step: .05, def: 1 },
    wallJump: { label: 'Wall jump height', min: .3, max: 2, step: .05, def: 1 },
    wallSlide: { label: 'Wall slide speed', min: .2, max: 3, step: .05, def: 1 },
    airJumps: { label: 'Extra mid-air jumps', min: 0, max: 3, step: 1, def: 0, count: true },
    ammo: { label: 'Starting ammo', min: 0, max: 30, step: 1, def: 0, count: true },
  };
  const playerTune = LF.playerTune = def => {
    const t = {};
    for (const [k, s] of Object.entries(LF.PLAYER_TUNE)) t[k] = def && def.player && def.player[k] != null ? def.player[k] : s.def;
    return t;
  };
  // Every enemy runs this much faster than its base numbers (movement, timers, attacks).
  const ENEMY_SPEED = LF.ENEMY_SPEED = 1.35;
  // Special shots: X fires an explosive round, Q lobs a bouncing grenade, D throws a stick of
  // dynamite, W primes a nuke. All use shared ammo.
  const SPECIAL = LF.SPECIAL = {
    rocket: { cost: 2, name: 'explosive round' },
    grenade: { cost: 3, name: 'grenade' },
    dyn: { cost: 4, name: 'dynamite' },
    nuke: { cost: 10, name: 'nuke' },
  };
  // The nuke: primed right where you are when you press W (it stays put, in the air or on the
  // ground), and when its FUSE burns down it kills everything within NUKE_R blocks (twice that
  // for a big one): golems, carts, the lot. A boss takes it as one hit. It never hurts you.
  const NUKE_R = 30;
  const FUSE = 3, DYN_R = 5;   // dynamite: seconds of fuse, and blocks of blast (twice that when big)
  // A: the kill shot. 3 ammo, and whatever it hits dies at once: golems, TNT carts, armor
  // and all (a boss just takes it as one hit). It doesn't splash.
  const KILL_COST = LF.KILL_COST = 3;
  const BLINK = LF.BLINK = 2, CONVEY = 110, BULLET = 620, AMMO = { q: 3, Q: 10, $: 25 };
  const TAU = Math.PI * 2;

  // Fruit: touch to gain a power, which lasts until you die (and carries on into the next
  // level). Picked fruit grows back after REGROW seconds.
  LF.FRUITS = {
    a: { name: 'Apple', power: 'Shield', color: '#E5484D', note: 'shield: blocks one hit (a second apple doubles it, no more)' },
    o: { name: 'Orange', power: 'Jump boost', color: '#FF9A2E', note: 'higher jumps, until you die' },
    b: { name: 'Banana', power: 'Double jump', color: '#FFE066', note: 'jump again in mid-air, until you die' },
    m: { name: 'Watermelon', power: 'Speed', color: '#4CAF50', note: 'run faster, until you die' },
    p: { name: 'Pear', power: 'Glide', color: '#C5D94A', note: 'hold up (or jump) while falling to glide down slowly; press Space in mid-air for a small lift, after which you can’t glide and fall steadily till you land, until you die' },
    s: { name: 'Strawberry', power: 'Wall grip', color: '#F0506E', note: 'slide down walls at a third of the speed, until you die' },
    'ç': { name: 'Cherry', power: 'Ammo magnet', color: '#B3123A', note: 'ammo crates within 4 blocks fly to you, until you die' },
    'ƥ': { name: 'Pineapple', power: 'Spike-proof', color: '#F2C94C', note: 'spikes don’t hurt you (lava and spiked pendulums still do), until you die' },
    'ǥ': { name: 'Grapes', power: 'Lucky', color: '#8E5BC2', note: 'enemies drop twice the ammo, until you die' },
    'ƫ': { name: 'Peach', power: 'Swimmer', color: '#FFA07A', note: 'swim strokes are stronger and you sink slower, until you die' },
    'ɯ': { name: 'Mango', power: 'Slow clock', color: '#FFB347', note: 'the level clock runs at two-thirds speed, until you die' },
    'ƀ': { name: 'Blueberry', power: 'Night eyes', color: '#5B6EE1', note: 'your light reaches twice as far, until you die' },
    // The green apple isn't a power of its own and takes no power slot: it ripens the rest.
    'ǵ': { name: 'Green apple', power: 'Ripe', color: '#7BC043', note: 'takes no power slot: with it you can take one more of each fruit: a third apple shield, and a second of any power fruit makes its power stronger (a triple jump, a bigger boost, faster, a slower glide and slide, a wider magnet, brighter eyes, spiked chains harmless, triple ammo, stronger swimming, a half-speed clock, two second chances), until you die' },
    'ŧ': { name: 'Tomato', power: 'Second chance', color: '#E8402A', note: 'takes no power slot: a hit with no shield doesn’t kill you: the tomato takes it, then for 5 seconds you run fast, jump high and can’t be hurt, and whatever you touch dies (a boss takes a hit)' },
  };
  // Every fruit but the apple gives a power that's on or off: the player's flag for each.
  const POWERS = LF.POWERS = { o: 'boost', b: 'dbl', m: 'fast', p: 'glide', s: 'grip', 'ç': 'magnet', 'ƀ': 'glow', 'ƥ': 'spiky', 'ǥ': 'lucky', 'ƫ': 'swimmer', 'ɯ': 'slowtime', 'ŧ': 'tomato' };
  const FLAGS = Object.values(POWERS);
  // (A power's level: 1, or 2 when ripened by a green apple. The green apple's own flag
  // rides along.)
  // (p.stack: caught a Power Stack event, so powers stack till you die: see applyFruit.)
  LF.powerFlags = p => ({ ...Object.fromEntries(FLAGS.map(k => [k, p[k] || 0])), green: p.green ? 1 : 0, stack: p.stack ? 1 : 0 });
  LF.hasPowers = p => FLAGS.some(k => p[k]) || !!p.green || !!p.stack;

  // drop: ammo an enemy leaves behind when you kill it — the harder it is to kill, the more.
  LF.ENEMIES = {
    B: { name: 'Wick-beetle', w: 24, h: 16, stomp: true, drop: 1, note: 'walks, turns at edges' },
    K: { name: 'Thornback', w: 26, h: 18, stomp: false, drop: 2, note: 'fast walker, spiky — jump over' },
    F: { name: 'Soot bat', w: 24, h: 14, stomp: true, drop: 1, note: 'flies back and forth' },
    J: { name: 'Puddle frog', w: 22, h: 18, stomp: true, drop: 1, note: 'hops toward you' },
    S: { name: 'Ember pot', w: 24, h: 22, stomp: true, drop: 2, note: 'spits embers' },
    G: { name: 'Wraith', w: 24, h: 28, stomp: false, drop: 3, note: 'drifts toward you, fears lit lanterns' },
    X: { name: 'Wick spider', w: 20, h: 16, stomp: true, drop: 1, note: 'hangs from a ceiling, drops when you pass below' },
    R: { name: 'Coal ram', w: 26, h: 20, stomp: true, drop: 2, note: 'walks, then charges when it sees you, bowling over any enemy in its way' },
    Z: { name: 'Spark', w: 14, h: 14, stomp: false, drop: 3, note: 'circles its spot — time your way past' },
    Y: { name: 'Lantern pike', w: 28, h: 12, stomp: false, drop: 2, note: 'place in water: swims back and forth' },
    U: { name: 'Glow jelly', w: 20, h: 20, stomp: false, drop: 2, note: 'place in water: bobs slowly up and down' },
    W: { name: 'Wasp', w: 22, h: 16, stomp: true, drop: 2, note: 'hovers, then dashes straight at you' },
    A: { name: 'Ash archer', w: 22, h: 26, stomp: true, drop: 2, note: 'shoots aimed arrows' },
    I: { name: 'Iron golem', w: 30, h: 34, stomp: true, hp: 3, drop: 5, note: 'slow, armored: takes 3 shots or 3 stomps' },
    '*': { name: 'Lava bubble', w: 16, h: 16, stomp: false, drop: 3, note: 'place in lava: hides, then shoots up out of it every few seconds' },
    N: { name: 'Leaping gar', w: 24, h: 12, stomp: true, drop: 2, note: 'place in water: leaps out at you' },
    'ĸ': { name: 'Shellback', w: 24, h: 20, stomp: true, drop: 1, note: 'walks, turns at edges; stomp it and it hides in its shell (it climbs back out after 5 seconds); touch the shell and it shoots off the other way, knocking out enemies, and it hurts you too' },
    '@': { name: 'TNT cart', w: 28, h: 22, stomp: true, hp: 5, note: 'rolls along; 5 hits of any kind (stomps too) and it blows up, killing everything within 10 blocks (but not you)' },
    // Bosses: wake when you come near, take an exact number of hits (shots or stomps on the
    // head; see BOSS_HITS), and keep the door shut until they fall.
    5: { name: 'The Bellwether', boss: true, w: 60, h: 46, stomp: true, drop: 10, hits: 20, note: 'boss: charges across the arena and is dazed when it hits a wall' },
    6: { name: 'The Soot Queen', boss: true, w: 64, h: 34, stomp: true, drop: 10, hits: 15, note: 'boss: flies, drops embers, swoops at you, then rests on the ground' },
    7: { name: 'The Ash Marksman', boss: true, w: 36, h: 50, stomp: true, drop: 10, hits: 16, note: 'boss: leaps about firing fans of arrows' },
    8: { name: 'The Iron Colossus', boss: true, w: 64, h: 76, stomp: true, drop: 10, hits: 22, note: 'boss: slow; its leaps send shockwaves along the floor' },
    9: { name: 'The Powder King', boss: true, w: 48, h: 56, stomp: true, drop: 10, hits: 18, note: 'boss: lobs bombs and sends TNT carts' },
  };
  // A fruit's power on the player: apple adds a shield layer (up to 2), orange the jump
  // boost, banana the double jump, watermelon speed, and so on (POWERS). Only one of those
  // works at a time: a new one takes the place of the last (but in a Power Stack event,
  // see events.js, they pile up). False if it would add nothing.
  // With a green apple (p.green), each can be taken once more: a third shield, or a power
  // you have already goes up to level 2 (stronger: see where each is used).
  LF.applyFruit = (p, type) => {
    if (type === 'ǵ') { if (p.green) return false; p.green = 1; return true; }
    if (type === 'a') { if (p.shield >= (p.green ? 3 : 2)) return false; p.shield++; return true; }
    const k = POWERS[type];
    if (!k || p[k] >= (p.green ? 2 : 1)) return false;
    if (p[k]) { p[k] = 2; if (k === 'dbl') p.airJumps++; if (k === 'tomato') p.tomato = 2; return true; }
    // (Playing during a Power Stack event marks you: powers stack until you die, event or no.)
    if (LF.eventIs && LF.eventIs('stack')) p.stack = 1;
    // (The tomato takes no power slot either: it neither replaces another power nor is replaced.)
    if (!p.stack && k !== 'tomato') { if (p.dbl) p.airJumps = Math.max(0, p.airJumps - p.dbl); for (const f of FLAGS) if (f !== 'tomato') p[f] = 0; }
    p[k] = 1; if (k === 'dbl') p.airJumps = Math.max(p.airJumps, 1);
    return true;
  };

  // Giant bosses: one for every enemy and hazard without a boss of its own. They only come
  // from boss arenas, whose map marks the spot with 0 and whose def.giant names the giant.
  // Creature giants are their own enemy drawn k times bigger; the rest are drawn specially.
  // Ones whose small cousin can't be stomped can only be stomped while dazed.
  const GIANTS = {
    B: { name: 'The Wick Matriarch', k: 3, hits: 20 },
    J: { name: 'The Bog King', k: 3, hits: 18 },
    W: { name: 'The Hive Mother', k: 3, fly: true, hits: 15 },
    X: { name: 'The Widow', k: 3, hits: 15 },
    S: { name: 'The Great Kiln', k: 3, hits: 22 },
    K: { name: 'The Thorn Tyrant', k: 3, hits: 14 },
    U: { name: 'The Moon Jelly', k: 3, hits: 12 },
    Z: { name: 'The Living Spark', k: 3, fly: true, hits: 12 },
    G: { name: 'The Pale Wraith', k: 3, fly: true, hits: 12 },
    Y: { name: 'The Lantern Leviathan', k: 3, hits: 14 },
    N: { name: 'The Gar Lord', k: 3, hits: 14 },
    '*': { name: 'The Magma Heart', k: 3, hits: 12 },
    E: { name: 'The Great Pendulum', w: 56, h: 56, stomp: true, hits: 15 },
    e: { name: 'The Thorn Pendulum', w: 56, h: 56, stomp: true, hits: 15 },
    f: { name: 'The Fire Wheel', w: 56, h: 56, stomp: true, hits: 15 },
    k: { name: 'The Great Crusher', w: 96, h: 64, stomp: true, hits: 18 },
    '&': { name: 'The Shadow Wall', w: 56, h: 56, stomp: true, hits: 12 },
    '%': { name: 'The Rising Dark', w: 56, h: 56, stomp: true, hits: 12 },
    // The final boss: the darkness itself, and it takes twice the hits.
    'Ω': { name: 'The Last Dark', w: 72, h: 96, stomp: true, hits: 50 },
    // Bosses of their own: the Void (the Sky Spire's) and the Melon Brute (the Melon Patch's).
    'Ø': { name: 'The Void', w: 64, h: 64, stomp: false, fly: true, hits: 3 },
    'Ɱ': { name: 'The Melon Brute', w: 76, h: 60, stomp: false, hits: 3 },
    // The castle keepers, one at the end of each world (see stepKeeper). Like most giants,
    // they can only be stomped while dazed.
    'Γ': { name: 'The Candle King', w: 54, h: 72, stomp: false, hits: 4 },
    'Δ': { name: 'The Lighthouse Crab', w: 92, h: 46, stomp: false, hits: 4 },
    'Ξ': { name: 'The Clockwork Knight', w: 48, h: 70, stomp: false, hits: 4 },
    'Λ': { name: 'The Storm Roc', w: 84, h: 52, stomp: false, fly: true, hits: 4 },
    'Π': { name: 'The Rat King', w: 62, h: 56, stomp: false, hits: 4 },
    'Φ': { name: 'The Pumpkin Knight', w: 56, h: 66, stomp: false, hits: 4 },
    'Ψ': { name: 'The Smog Dragon', w: 100, h: 58, stomp: false, fly: true, hits: 4 },
    'Σ': { name: 'The Crystal Mole', w: 66, h: 48, stomp: false, hits: 4 },
    // The keepers of the two sunken castles, swimming in their flooded halls.
    'Θ': { name: 'The Drowned King', w: 70, h: 56, stomp: false, fly: true, hits: 4 },
    'Ж': { name: 'The Tide Serpent', w: 96, h: 44, stomp: false, fly: true, hits: 4 },
  };
  for (const [c, g] of Object.entries(GIANTS)) {
    const base = LF.ENEMIES[c];
    LF.ENEMIES[c + '+'] = base
      ? { name: g.name, boss: true, special: true, giant: c, k: g.k, w: base.w * g.k, h: base.h * g.k, stomp: base.stomp, drop: 10, fly: g.fly, hits: g.hits }
      : { name: g.name, boss: true, special: true, w: g.w, h: g.h, stomp: g.stomp, drop: 10, fly: g.fly, hits: g.hits };
  }
  const isBoss = LF.isBoss = e => !!LF.ENEMIES[e.type].boss;
  // Each boss falls to an exact number of hits, its `hits` (an arena can set its own with
  // def.bossHits): fewer for the ones that are hard to hit, 50 for the final boss. A stomp,
  // a bullet, an explosive round, a grenade blast or a TNT blast each count as one (a
  // grenade's three blasts can land three). And every dazed (or stunned, or resting)
  // moment lasts DAZE times as long as it would otherwise.
  const BOSS_HITS = 20, DAZE = 1.75, SPAWN_HOLD = 1.5;
  // In a tower (def.bossFury) a stomped boss flies into a fury for FURY seconds: it lashes
  // out every FURY_EVERY seconds the whole time, moves faster, and can't be stomped (you
  // bounce off) or hurt until it calms down. Then it's worn out: dazed for FURY_REST seconds.
  const FURY = 10, FURY_EVERY = 1.6, FURY_REST = 2.5;
  // Enemies that live in water: their map cell stays water.
  LF.SWIMMERS = { Y: 1, U: 1, N: 1 };

  LF.rng = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // T and H are blink blocks (lowercase while switched off); < and > are conveyor belts.
  // i is ice: solid but slippery. 1, 2, 3 are locked doors opened by keys r, u, y.
  // v, w, z are shot doors (open after 3, 10, 25 hits); g is a boss gate (opens when the bosses fall).
  // § is a switch block; Ʀ/ʀ red blocks (solid while the switch is on, as it starts), Ɓ/ɓ blue
  // ones (solid while it's off): see stepSwitch.
  const isSolid = LF.isSolid = c => c === '§' || c === 'ǩ' || c === 'Ʀ' || c === 'Ɓ' || c === '#' || c === 'C' || c === 'O' || c === 'T' || c === 'H' || c === '<' || c === '>' || c === 'i' || c === '1' || c === '2' || c === '3' || c === 'v' || c === 'w' || c === 'z' || c === 'g';
  LF.SHOT_DOORS = { v: 3, w: 10, z: 25 };
  LF.KEYS = {
    r: { name: 'Red key', gate: '1', color: '#FF6B3D', dim: '#7A2E1C' },
    u: { name: 'Blue key', gate: '2', color: '#7FB0E0', dim: '#2E4E82' },
    y: { name: 'Gold key', gate: '3', color: '#FFD447', dim: '#7A5A12' },
  };
  LF.GATES = { 1: 'r', 2: 'u', 3: 'y' };
  const isFloor = LF.isFloor = c => isSolid(c) || c === '=' || !!SLOPES[c];
  // Slopes: / rises to the right (up from the floor on its left to the top of the block on its
  // right), \\ to the left. You walk up and down them; on one, a Shellback's shell slides.
  // They're open tiles with a surface across them (slopeAt), not solid ones.
  const SLOPES = LF.SLOPES = { '/': 1, '\\': -1 };
  const slopeAt = (c, tx, ty, px) => { const u = Math.max(0, Math.min(TS, px - tx * TS)); return c === '/' ? ty * TS + TS - u : ty * TS + u; };
  // The slope under e's middle, if its feet are on or in one: { y: its surface there, c, down:
  // which way is downhill }.
  // (Slopes join up: going from one to the next, a row up or down, the surface carries on, so
  // the row over the feet is looked at too, and the highest surface no more than a step up
  // from them is the one.)
  function slopeUnder(W, e) {
    const fx = e.x + e.w / 2, tx = Math.floor(fx / TS), feet = e.y + e.h, row = Math.floor((feet - 1) / TS);
    let best = null;
    for (const ty of [row - 1, row, row + 1]) {
      const c = tile(W, tx, ty);
      if (!SLOPES[c]) continue;
      const y = slopeAt(c, tx, ty, fx);
      if (y >= feet - 14 && (!best || y < best.y)) best = { y, c, down: -SLOPES[c] };
    }
    return best;
  }
  // Stand e on the slope under it: pushed up out of it, or (stick: walking down it) kept on it.
  function onSlope(W, e, stick) {
    const s = slopeUnder(W, e);
    if (!s || e.vy < 0) return null;
    const d = s.y - (e.y + e.h);
    if (d < 0 || (stick && d < 14)) { e.y = s.y - e.h; e.vy = 0; return s; }
    return null;
  }
  const blocksPlat = c => isSolid(c) || c === '|' || c === '^' || c === '=';

  function tile(W, tx, ty) {
    if (tx < 0 || tx >= W.w) return '#';
    if (ty < 0 || ty >= W.h) return ' ';
    return W.tiles[ty][tx];
  }
  LF.tile = tile;

  LF.normalize = rows => {
    const w = Math.max(1, ...rows.map(r => r.length));
    return rows.map(r => r.padEnd(w, '.'));
  };

  LF.createWorld = function (def) {
    const rows = LF.normalize(def.map);
    const h = rows.length, w = rows[0].length;
    const tiles = rows.map(r => r.split('').map(c => (c === '.' ? ' ' : c)));
    const W = {
      def, name: def.name || 'Untitled', dark: def.dark ?? .6, w, h, tiles,
      lanterns: [], coins: [], spinners: [], fruits: [], ammo: [], ammoFly: [], passages: [], entries: [], marks: [], blinks: [], bullets: [], traps: [], rings: [], ghosts: [], keys: [], unlocking: [], freeze: 0, enemies: [], plats: [], projectiles: [], particles: [], floaters: [], crumbles: [],
      door: null, start: { tx: 1, ty: h - 2 }, clock: 0, time: 0, falls: 0, shake: 0,
      deadTimer: 0, cleared: false, events: [],
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = tiles[y][x];
      if (c === 'P') { W.start = { tx: x, ty: y }; tiles[y][x] = ' '; }
      else if (c === 'L') { W.lanterns.push({ tx: x, ty: y, x: x * TS + 16, y: y * TS + 14, lit: false, f: (x * 7 + y * 3) % 9, pop: 0 }); tiles[y][x] = ' '; }
      else if (LF.KEYS[c]) { W.keys.push({ c, tx: x, ty: y, x: x * TS + 16, y: y * TS + 16, taken: false }); tiles[y][x] = ' '; }
      // & starts a horde chasing right from this column; % one rising from this row.
      else if (c === '&') { W.horde = { c, up: false, f: x * TS, ox: x * TS, oy: y * TS, growl: 0, wait: HORDE_WAIT }; tiles[y][x] = ' '; }
      else if (c === '%') { W.horde = { c, up: true, f: -y * TS, ox: x * TS, oy: y * TS, growl: 0, wait: HORDE_WAIT }; tiles[y][x] = ' '; }
      // E is a pendulum (only the ball hurts); e is a spiked pendulum whose thorny chain hurts too.
      else if (c === 'E' || c === 'e') { W.traps.push({ type: 'pend', spiked: c === 'e', ax: x * TS + 16, ay: y * TS + 2, len: TS * 3.5, amp: 1.1, per: 2.8, ph: (x * 1.3) % TAU, a: 0 }); tiles[y][x] = ' '; }
      else if (c === 'f') { W.traps.push({ type: 'bar', cx: x * TS + 16, cy: y * TS + 16, n: 5, a: (x + y) * .7, spin: (x + y) % 2 ? 1.7 : -1.7 }); tiles[y][x] = '#'; }
      else if (c === 'k') { W.traps.push({ type: 'crush', x: x * TS + 1, y: y * TS + 1, ox: x * TS + 1, oy: y * TS + 1, w: 30, h: 30, state: 'idle', vy: 0, wait: 0 }); tiles[y][x] = ' '; }
      // q ammo, Q big ammo, $ huge ammo.
      else if (AMMO[c] && def.noAmmo) tiles[y][x] = ' ';
      else if (AMMO[c]) { W.ammo.push({ big: c !== 'q', huge: c === '$', n: AMMO[c] * (LF.eventIs && LF.eventIs('ammo') ? 2 : 1), tx: x, ty: y, x: x * TS + 16, y: y * TS + 20, taken: false }); tiles[y][x] = ' '; }
      else if (c === 'T' || c === 'H') { W.blinks.push({ tx: x, ty: y, c, wait: false }); if (c === 'H') tiles[y][x] = 'h'; }
      // ǩ is a grove panel: bump it from below to turn it over (see hitPanel).
      else if (c === 'ǩ') (W.panels ||= []).push({ tx: x, ty: y, sym: null, open: false, done: false, pop: 0 });
      else if (c === 'Ʀ' || c === 'ʀ' || c === 'Ɓ' || c === 'ɓ') { (W.swBlocks ||= []).push({ tx: x, ty: y, red: c === 'Ʀ' || c === 'ʀ', wait: true }); }
      else if (LF.FRUITS[c]) { W.fruits.push({ type: c, tx: x, ty: y, x: x * TS + 16, y: y * TS + 18, taken: false, regrow: 0, pop: 0 }); tiles[y][x] = ' '; }
      else if (c === 'D') { W.door = { tx: x, ty: y, x: x * TS, y: (y - 1) * TS + 4, w: 32, h: 60, open: false, glow: 0 }; tiles[y][x] = ' '; }
      // j is a passage door: walk into it and you come out at the matching n (the k-th j,
      // counting left to right, leads to the k-th n). They join the parts of a tower.
      else if (c === 'j') { W.passages.push({ tx: x, ty: y, x: x * TS, y: (y - 1) * TS + 4, w: 32, h: 60, open: true, glow: 1 }); tiles[y][x] = ' '; }
      else if (c === 'n') { W.entries.push({ tx: x, ty: y }); tiles[y][x] = ' '; }
      // ¢ is a star coin (three to a story level, see coins.js). def.coinsHave says which of
      // them you've already got (they show faded).
      else if (c === '¢') { const k = W.coins.length; W.coins.push({ k, tx: x, ty: y, x: x * TS + 16, y: y * TS + 16, taken: false, had: !!(def.coinsHave && def.coinsHave[k]), pop: 0 }); tiles[y][x] = ' '; }
      // ĵ and ň: the doors joining a lengthened level's sections (see lengthen.js), paired
      // among themselves left to right, after the level's own passages.
      else if (c === 'ĵ') { (W.linkOut ||= []).push({ tx: x, ty: y, x: x * TS, y: (y - 1) * TS + 4, w: 32, h: 60, open: true, glow: 1 }); tiles[y][x] = ' '; }
      else if (c === 'ň') { (W.linkIn ||= []).push({ tx: x, ty: y }); tiles[y][x] = ' '; }
      // The Last Dark's chase (def.finalChase): Ħ is the wall that breaks open when it begins,
      // Ŧ the TNT cart waiting at the end of the run.
      else if (c === 'Ħ') { (W.chaseGate ||= []).push([x, y]); tiles[y][x] = '#'; }
      else if (c === 'Ŧ') { W.chaseCart = { x: x * TS + 2, y: (y + 1) * TS - 22, w: 28, h: 22, state: 'idle', vx: 0 }; tiles[y][x] = ' '; }
      // + is a cannon: climb in with ↓ and it fires you out of the level (that finishes it).
      else if (c === '+') { W.cannon = { x: x * TS + 16, y: (y + 1) * TS, state: 'idle', t: 0 }; tiles[y][x] = ' '; }
      // ? is a secret exit: a second door, always open, in a hard spot to get to.
      // (Next to a false wall (l) it's in a hidden room: it looks like rock until you step in.)
      else if (c === '?') {
        const hidden = [rows[y][x - 1], rows[y][x + 1], rows[y - 1]?.[x]].includes('l');
        W.secret = { tx: x, ty: y, x: x * TS, y: (y - 1) * TS + 4, w: 32, h: 60, open: true, glow: 1, secret: true, hidden };
        tiles[y][x] = hidden ? 'l' : ' ';
        // (It's a secret: nothing shows it till you find it (see below).)
      }
      else if (c === 'M' || c === 'V') {
        W.plats.push({ axis: c === 'M' ? 'x' : 'y', x: x * TS, y: y * TS, ox: x * TS, oy: y * TS, w: TS * 2, h: 12, v: 70, dir: 1, dx: 0, dy: 0, prevY: y * TS });
        tiles[y][x] = ' ';
      } else if (c === ':' || c === ';') {
        // Turn block: a 3x3 square of stone centred here that turns smoothly about its middle,
        // round and round (see stepSpinners): : clockwise, ; anticlockwise.
        W.spinners.push({ cx: x * TS + 16, cy: y * TS + 16, half: TS * 1.5, a: (x * 3 + y) % 7 * .2, da: 0, dir: c === ':' ? 1 : -1 });
        tiles[y][x] = ' ';
      } else if (c === 'x' || c === ',') {
        // Wheel: WHEEL_CARS platforms turning around this spot (they stay level as they go):
        // x clockwise, , anticlockwise.
        const spin = c === 'x' ? WHEEL_SPIN : -WHEEL_SPIN;
        for (let k = 0; k < WHEEL_CARS; k++) {
          const pl = { kind: 'wheel', cx: x * TS + 16, cy: y * TS + 16, a: k / WHEEL_CARS * TAU, spin, w: TS * 2, h: 12, dx: 0, dy: 0 };
          wheelAt(pl); pl.prevY = pl.y; W.plats.push(pl);
        }
        tiles[y][x] = ' ';
      } else if (c === 'd' || c === 'đ' || c === 'ð') {
        // Falling shingle: shakes when stood on, drops, then grows back. đ is a big one, three
        // tiles wide (it takes up the two to its right too), that holds out longer. ð is a
        // cracked one: it falls the same, but it's gone for good.
        const big = c === 'đ';
        W.plats.push({ kind: 'fall', big, once: c === 'ð', state: 'idle', t: 0, vy: 0, x: x * TS, y: y * TS, ox: x * TS, oy: y * TS, w: TS * (big ? 3 : 1), h: 12, dx: 0, dy: 0, prevY: y * TS });
        tiles[y][x] = ' ';
      } else if (c === '0' && def.giant) {
        const liquid = ['~', '!'].find(l => rows[y - 1]?.[x] === l || rows[y + 1]?.[x] === l || rows[y][x - 1] === l || rows[y][x + 1] === l);
        tiles[y][x] = liquid || ' ';
        W.giantAt = { x, y };
      } else if (LF.ENEMIES[c]) { W.enemies.push(makeEnemy(c, x, y, def.tuning)); tiles[y][x] = LF.SWIMMERS[c] ? '~' : c === '*' ? '!' : ' '; }
    }
    // Markers placed underwater (start, lanterns, fruit…) leave water behind, not an air pocket.
    for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) {
      if (tiles[y][x] === ' ' && (tiles[y - 1][x] === '~' || tiles[y - 1][x] === '!') && rows[y][x] !== '.') tiles[y][x] = tiles[y - 1][x];
    }
    // Lava surface tiles: they glow and throw off embers.
    // In a tower or castle the sections run left to right, each door (j) leading into the
    // next section's entry (n): pair them by column.
    if (def.arenaX) { W.passages.sort((a, b) => a.tx - b.tx); W.entries.sort((a, b) => a.tx - b.tx); }
    if (W.linkOut) { W.passages.push(...W.linkOut.sort((a, b) => a.tx - b.tx)); W.entries.push(...(W.linkIn || []).sort((a, b) => a.tx - b.tx)); }
    // Moving lava (def.flows): see stepFlows.
    W.flows = (def.flows || []).map(f => ({ ...f, s: (f.mode === 'fall' ? f.hi : f.lo) * TS, on: f.trigger == null && f.triggerY == null, t: 0 }));
    W.lavaTop = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tiles[y][x] === '!' && (y === 0 || tiles[y - 1][x] !== '!')) W.lavaTop.push({ tx: x, ty: y });
    // Every lava pool gets lava bubbles, spread evenly and centered along each stretch of
    // surface: one per ~7 tiles, only where there's room above to jump.
    const runs = [];
    for (const l of W.lavaTop) {
      const last = runs[runs.length - 1];
      if (last && last.ty === l.ty && last.x1 === l.tx - 1) last.x1 = l.tx; else runs.push({ ty: l.ty, x0: l.tx, x1: l.tx });
    }
    for (const r of runs) {
      const n = r.x1 - r.x0 + 1, count = Math.max(1, Math.round(n / 7));
      for (let k = 0; k < count; k++) {
        const tx = r.x0 + Math.floor((k + .5) * n / count);
        if (W.enemies.some(e => e.type === '*' && Math.abs(e.ox / TS - tx) < 3)) continue;
        let room = true;
        for (let j = 1; j <= 3; j++) if (isSolid(tile(W, tx, r.ty - j))) room = false;
        if (room) W.enemies.push(makeEnemy('*', tx, r.ty, def.tuning));
      }
    }
    for (const e of W.enemies) if (e.type === '*') e.wait = 1 + Math.floor(e.ox / TS) % 4 * .5;
    // Jellies bob only within their water: find the surface above and the bottom below.
    for (const e of W.enemies) {
      if (e.type !== 'U') continue;
      const tx = Math.floor((e.x + e.w / 2) / TS);
      let top = Math.floor((e.y + e.h / 2) / TS), bot = top;
      while (top > 0 && tiles[top - 1][tx] === '~') top--;
      while (bot < h - 1 && tiles[bot + 1][tx] === '~') bot++;
      e.minY = top * TS + 10; e.maxY = Math.max(e.minY, (bot + 1) * TS - e.h);
    }
    if (W.giantAt) W.enemies.push(makeGiant(W, def.giant, W.giantAt.x, W.giantAt.y));
    W.passages.sort((a, b) => a.tx - b.tx); W.entries.sort((a, b) => a.tx - b.tx);
    // Shot doors: each patch of touching blocks of the same kind is one door with one counter.
    W.shotDoors = []; W.shotDoorAt = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = tiles[y][x];
      if (!LF.SHOT_DOORS[c] || W.shotDoorAt[y * w + x]) continue;
      const d = { c, need: LF.SHOT_DOORS[c], hits: 0, tiles: [], hitBy: {}, flash: 0, open: false };
      const stack = [[x, y]]; W.shotDoorAt[y * w + x] = d;
      while (stack.length) {
        const [cx, cy] = stack.pop(); d.tiles.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || tiles[ny][nx] !== c || W.shotDoorAt[ny * w + nx]) continue;
          W.shotDoorAt[ny * w + nx] = d; stack.push([nx, ny]);
        }
      }
      W.shotDoors.push(d);
    }
    // Later boss arenas make their boss tougher.
    // Every boss takes an exact number of hits, however it's hit (see BOSS_HITS).
    for (const e of W.enemies) if (isBoss(e)) e.hp = e.maxHp = def.bossHits || LF.ENEMIES[e.type].hits || BOSS_HITS;
    W.total = W.lanterns.length;
    // (A grove's bonus door, def.bonusDoor, stays shut till you've got everything: see stepBonus.)
    if (W.door && !W.total && !W.enemies.some(isBoss) && !def.bonusDoor) W.door.open = true;
    W.checkpoint = { ...W.start };
    W.blinkT = 0; W.blinkOn = 'T';
    W.player = makePlayer(W.start);
    W.player.ammo = playerTune(def).ammo;
    // Ammo brought from the last level, on top of the level's own.
    if (def.carryAmmo) W.player.ammo += def.carryAmmo;
    // Boss towers: no ammo at all (stomp!).
    if (def.noAmmo) W.player.ammo = 0;
    W.ammoStart = W.player.ammo;   // (what an ammo grove counts from)
    // Powers brought from the last level (or the inventory): def.powers = { shield, boost, dbl }.
    if (def.powers) {
      const pw = def.powers;
      W.player.shield = Math.min(pw.green ? 3 : 2, pw.shield || 0); W.player.green = pw.green ? 1 : 0; W.player.stack = pw.stack ? 1 : 0;
      // (Every power you're carrying: powers stacked in a Power Stack event stay stacked
      // until you die, even once the event's over.)
      for (const k of FLAGS) if (pw[k]) W.player[k] = Math.min(pw.green ? 2 : 1, pw[k]);
    }
    if (LF.eventIs && LF.eventIs('stack')) W.player.stack = 1;
    W.got = {};   // fruit picked up, by type
    // A panel grove (def.panelGame = { mode, syms }): what's under each panel, left to right.
    if (W.panels && def.panelGame) { W.panels.sort((a, b) => a.tx - b.tx || a.ty - b.ty); W.panels.forEach((q, k) => { q.sym = def.panelGame.syms[k]; }); W.panelBad = 0; W.panelPeek = def.panelGame.peek || 0; }
    // Back into a level whose lanterns you'd lit last time (def.resume = { lit: [lantern
    // indexes], cp: { tx, ty } }): they're still lit, and you start at the last one.
    if (def.resume) {
      for (const k of def.resume.lit) if (W.lanterns[k]) W.lanterns[k].lit = true;
      W.lanternLit = true; W.checkpoint = { ...def.resume.cp };
      const { ammo } = W.player;
      Object.assign(W.player, makePlayer(W.checkpoint), { ammo, shield: W.player.shield, ...LF.powerFlags(W.player), held: W.player.held });
      if (W.door && W.lanterns.every(l => l.lit) && !W.enemies.some(isBoss)) W.door.open = true;
      // (The clock is what that checkpoint gives you: see cpClock.)
      if (def.deadline) { W.cpBoss = W.bossClock = !!def.resume.boss; setClock(W, LF.cpClock(W)); }
    }
    // def.noSpawnInv (Hardcore): no invincible second at the start or after respawning.
    if (def.noSpawnInv) W.player.inv = 0;
    // The horde begins HORDE_BACK behind the start, the same distance it falls back to after a death.
    // (In a tower its arena comes last, and the horde sleeps till you get there.)
    if (W.horde) W.horde.f = playerAlong(W.horde, W.player) - HORDE_BACK;
    if (W.horde && def.arenaX) W.horde.dormant = true;
    W.emit = (type, data) => W.events.push({ type, data });
    // Star coins are numbered by the third of the level they're in (start to end: left to
    // right, or bottom to top in a tall level), not by where they are, which can change with
    // an update: so the coin you got from a third stays got, and can't be got again.
    // (coins.js says which third each is in, def.coinSlots, as some are down in secret
    // sections under the level; failing that, they go by where they are.)
    if (W.coins.length) {
      const tall = h > w * 1.2, slot = c => (def.coinSlots || []).findIndex(([x, y]) => x === c.tx && y === c.ty);
      W.coins.sort((a, b) => (def.coinSlots ? slot(a) - slot(b) : tall ? b.ty - a.ty : a.tx - b.tx));
      W.coins.forEach((c, k) => { c.k = k; c.had = !!(def.coinsHave && def.coinsHave[k]); });
      // (Back at a lantern: the coins you'd got before it are picked up already.)
      if (def.resume && def.resume.coins) W.coins.forEach((c, k) => { if (def.resume.coins[k] && !c.had) { c.taken = true; c.pop = 0; (W.coinsGot ||= [])[k] = true; } });
      W.coinsAtLamp = W.coins.map(c => !!c.taken);
    }
    return W;
  };

  // A level can resize and speed up or slow down each enemy type (set in the editor):
  // def.tuning = { B: { size: 1.5, speed: 2 }, ... }.
  const tune = LF.tune = (tuning, type) => ({ size: 1, speed: 1, ...(tuning || {})[type] });

  // The pool (of water or lava) around tile (tx, ty): its surface, bottom and sides.
  function measurePool(W, e, tx, ty) {
    const liq = W.tiles[ty][tx];
    let top = ty, l = tx, r = tx, bot = ty;
    while (top > 0 && W.tiles[top - 1][tx] === liq) top--;
    while (bot < W.h - 1 && W.tiles[bot + 1][tx] === liq) bot++;
    while (l > 0 && W.tiles[top][l - 1] === liq) l--;
    while (r < W.w - 1 && W.tiles[top][r + 1] === liq) r++;
    e.surface = top * TS; e.bottom = (bot + 1) * TS; e.left = l * TS; e.right = Math.max(l * TS, (r + 1) * TS - e.w);
  }
  // A giant boss at tile (tx, ty), set up for where it lives.
  function makeGiant(W, c, tx, ty) {
    const key = c + '+', s = LF.ENEMIES[key];
    const e = makeEnemy(key, tx, ty);
    e.scale = s.k || 1; e.reach = -TS;
    const cx = tx * TS + TS / 2, cy = ty * TS + TS / 2;
    if (s.fly || c === 'f' || c === 'Ω') { e.x = cx - e.w / 2; e.y = cy - e.h / 2; }
    // The Melon Brute and the castle keepers that walk stand on the floor under their spot.
    if (c === 'Ɱ' || (KEEPERS.has(key) && !s.fly)) { e.x = cx - e.w / 2; e.y = (ty + 1) * TS - e.h; }
    // Swimmers and the Magma Heart: find their pool's surface and sides.
    if (c === 'U' || c === 'Y' || c === 'N' || c === '*') {
      measurePool(W, e, tx, ty);
      e.x = cx - e.w / 2; e.y = Math.min(e.bottom - e.h, e.surface + (c === 'U' ? TS * 1.5 : 6));
    }
    // Pendulums hang from the spot, swinging just above the floor below.
    if (c === 'E' || c === 'e') {
      let fy = ty + 1;
      while (fy < W.h && !isFloor(W.tiles[fy][tx])) fy++;
      e.ax = cx; e.ay = ty * TS; e.len = fy * TS - 40 - e.ay; e.phase = 0;
      e.x = e.ax - e.w / 2; e.y = e.ay + e.len - e.h / 2;
    }
    e.ox = e.x; e.oy = e.y;
    return e;
  }

  function makeEnemy(type, tx, ty, tuning) {
    const s = LF.ENEMIES[type];
    let x = tx * TS + (TS - s.w) / 2;
    let y = (ty + 1) * TS - s.h;
    if (type === 'F') y = ty * TS + 9;
    if (type === 'G') y = ty * TS + 2;
    if (type === 'X') y = ty * TS + 2;
    if (type === 'Z' || LF.SWIMMERS[type]) y = ty * TS + (TS - s.h) / 2;
    if (type === '*') y = ty * TS + 12;
    if (type === 'W') y = ty * TS + 8;
    if (type === '6') y = ty * TS;
    const vx = { B: -48, K: -72, F: -64, R: -40, Y: -85, I: -30, '@': -36, 'ĸ': -44 }[type] || 0;
    // Resize around the spot the enemy is anchored to: its top if it hangs from a ceiling,
    // its middle if it flies or swims, otherwise its feet.
    const scale = tune(tuning, type).size;
    let w = s.w, h = s.h;
    if (scale !== 1) {
      const cx = x + w / 2, anchor = type === 'X' ? 0 : 'FWZGYUN6'.includes(type) ? .5 : 1, ay = y + h * anchor;
      w = s.w * scale; h = s.h * scale; x = cx - w / 2; y = ay - h * anchor;
    }
    return { scale, hp: s.hp || 1, maxHp: s.hp || 1, stompCool: 0, hurt: 0, type, x, y, w, h, ox: x, oy: y, vx, vy: 0, alive: true, dead: 0, t: (tx * 13 + ty * 5) % 7 * .3, face: -1, cool: 1.2, wait: .8, ground: false, fade: 0, state: 'idle' };
  }

  function makePlayer(cp) {
    const w = 18, h = 26;
    return {
      x: cp.tx * TS + (TS - w) / 2, y: (cp.ty + 1) * TS - h, w, h,
      vx: 0, vy: 0, face: 1, onGround: false, onPlat: null, ammo: 0, keys: {},
      coyote: 0, buffer: 0, jumping: false, drop: 0, sx: 1, sy: 1, anim: 0, dead: false,
      wall: 0, wallDir: 0, wallCoyote: 0, sliding: false, lock: 0, wet: false,
      // One second of invincibility at the start of a level and after every respawn.
      shield: 0, boost: 0, dbl: 0, fast: 0, airJumps: 0, inv: 1, conv: 0, cool: 0, flash: 0,
    };
  }

  // ---------- collision ----------
  function moveX(W, e, dx) {
    if (!dx) return false;
    e.x += dx;
    const top = Math.floor(e.y / TS), bot = Math.floor((e.y + e.h - .01) / TS);
    const tx = dx > 0 ? Math.floor((e.x + e.w - .001) / TS) : Math.floor(e.x / TS);
    for (let ty = top; ty <= bot; ty++) {
      const c = tile(W, tx, ty);
      // (A slope's steep side, the back of it, is a wall: run into it below its top and you
      // stop. Its sloping side you just walk up.)
      if (SLOPES[c] && Math.sign(dx) === -SLOPES[c] && e.y + e.h > slopeAt(c, tx, ty, dx > 0 ? e.x + e.w : e.x) + e.w / 2 + 16) { e.x = dx > 0 ? tx * TS - e.w : (tx + 1) * TS; return true; }
      if (!isSolid(c)) continue;
      // (Feet just under the top of the block ahead, as at the high end of a slope: step up
      // onto it, if there's room. On a slope its front reaches the block while its middle,
      // which it stands on, is still a little lower: so a little more, there. Not falling.)
      const lift = e.y + e.h - ty * TS, most = slopeUnder(W, e) ? e.w / 2 + 16 : 14;
      if (ty === bot && lift > 0 && lift <= most && !(e.vy < 0) && !(e.vy > 100)) {
        let room = true;
        for (let r = Math.floor((ty * TS - e.h) / TS); r < ty && room; r++) if (isSolid(tile(W, tx, r))) room = false;
        if (room) { e.y = ty * TS - e.h; return false; }
      }
      e.x = dx > 0 ? tx * TS - e.w : (tx + 1) * TS;
      return true;
    }
    return false;
  }

  function moveY(W, e, dy, dropping) {
    const prevBottom = e.y + e.h;
    e.y += dy;
    const l = Math.floor(e.x / TS), r = Math.floor((e.x + e.w - .01) / TS);
    if (dy > 0) {
      const ty = Math.floor((e.y + e.h) / TS);
      let hit = null;
      for (let tx = l; tx <= r; tx++) {
        const c = tile(W, tx, ty);
        if (isSolid(c) || (c === '=' && !dropping && prevBottom <= ty * TS + .01)) {
          hit = hit || { dir: 'down', under: [] };
          hit.under.push({ tx, ty, c });
        }
      }
      if (hit) e.y = ty * TS - e.h;
      return hit;
    } else if (dy < 0) {
      const ty = Math.floor(e.y / TS);
      for (let tx = l; tx <= r; tx++) if (isSolid(tile(W, tx, ty))) {
        e.y = (ty + 1) * TS;
        const sw = [...Array(r - l + 1)].map((_, k) => l + k).find(x => tile(W, x, ty) === '§');
        const pn = [...Array(r - l + 1)].map((_, k) => l + k).find(x => tile(W, x, ty) === 'ǩ');
        return { dir: 'up', sw: sw != null ? [sw, ty] : null, panel: pn != null ? [pn, ty] : null };
      }
    }
    return null;
  }

  const approach = (v, t, a) => v < t ? Math.min(v + a, t) : Math.max(v - a, t);
  const overlap = LF.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  LF.flamePos = p => ({ x: p.x + p.w / 2 + p.face * 12, y: p.y - 7 });
  LF.gunPos = p => ({ x: p.x + p.w / 2 + p.face * 14, y: p.y + p.h - 13 });

  const WARM = ['#FFB547', '#FF6B3D', '#FFE2A8'];
  LF.WARM = WARM;
  function burst(W, x, y, n, colors, speed = 180, grav = 400, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (.3 + Math.random() * .7);
      const life = .4 + Math.random() * .5;
      W.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * .3, life, max: life, c: colors[i % colors.length], size: size * (.6 + Math.random() * .7), g: grav });
    }
    if (W.particles.length > 600) W.particles.splice(0, W.particles.length - 600);
  }

  // Water only drowns enemies; the player swims (see inWater). Lava (!) kills anything.
  const lavaAt = (W, p) => {
    const x0 = Math.floor((p.x + 3) / TS), x1 = Math.floor((p.x + p.w - 3) / TS);
    const y0 = Math.floor((p.y + 4) / TS), y1 = Math.floor((p.y + p.h - 1) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tile(W, tx, ty) === '!' && (tile(W, tx, ty - 1) === '!' || p.y + p.h > ty * TS + 10)) return true;
    }
    return false;
  };
  function hazardHit(W, p, swims = false) {
    if (lavaAt(W, p) || (p === W.player && inFlow(W, p))) return true;
    const x0 = Math.floor((p.x + 3) / TS), x1 = Math.floor((p.x + p.w - 3) / TS);
    const y0 = Math.floor((p.y + 4) / TS), y1 = Math.floor((p.y + p.h - 1) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const c = tile(W, tx, ty);
      // (Spikes hurt you, not enemies; the pineapple makes you spike-proof too.)
      if (c === '^' && p === W.player && p.y + p.h > ty * TS + 14 && !p.spiky) return true;
      if (c === '~' && !swims && p.y + p.h > ty * TS + 10) return true;
    }
    return p.y > W.h * TS + 60;
  }

  function kill(W) {
    const p = W.player;
    if (p.dead || W.cleared) return;
    p.dead = true; W.deadTimer = .85; W.falls++;
    burst(W, p.x + p.w / 2, p.y + p.h / 2, 26, ['#FF6B3D', '#FFB547', '#D9D0F0'], 240, 500);
    W.shake = .35; W.freeze = .07; ring(W, p.x + p.w / 2, p.y + p.h / 2, 40, '255,107,61', .4); W.emit('die');
  }

  LF.kill = kill;
  const HURRY = LF.HURRY = 50, CLOCK_MIN = 30, CP_MIN = 150;
  // Set the clock to read `left` seconds (never less than CLOCK_MIN, so a checkpoint can't
  // leave you no time at all), and let the hurry-up come again if it's under HURRY.
  function setClock(W, left) {
    left = Math.max(CLOCK_MIN, left);
    W.clockFrom = W.time - (W.def.deadline - left);
    if (W.hurried && left > (W.def.hurry || HURRY)) W.emit('calm');
    W.hurried = false;
  }
  // The clock you come back to depends on the checkpoint: the share of the level still ahead
  // of it (by how far along it is: across, or up for a level that climbs; in a tower or
  // castle, of the way to the boss), plus 30 seconds, never under CP_MIN, never more than
  // the full clock; and if you'd reached the boss, its time on top. No checkpoint: the full clock.
  LF.cpClock = W => {
    const cp = W.checkpoint, d = W.def;
    if (!cp || !W.lanternLit) return d.deadline + (W.cpBoss ? d.bossTime || 0 : 0);
    const along = d.arenaX ? Math.min(1, cp.tx / d.arenaX) : W.w >= W.h ? cp.tx / W.w : 1 - cp.ty / W.h;
    return Math.min(d.deadline, Math.max(CP_MIN, Math.round((d.deadline * (1 - along) + 30) / 5) * 5)) + (W.cpBoss ? d.bossTime || 0 : 0);
  };
  LF.timeLeft = W => W.def.deadline - (W.time - (W.clockFrom || 0));
  // Practice: set a checkpoint where you stand (Z), or take the latest one away (X).
  LF.setMark = W => {
    const p = W.player;
    if (p.dead || !p.onGround) return false;
    W.marks.push({ x: p.x, y: p.y });
    W.floaters.push({ x: p.x + p.w / 2, y: p.y - 12, t: `checkpoint ${W.marks.length}`, life: 1, c: '#9FD8FF' });
    W.emit('key');
    return true;
  };
  LF.dropMark = W => {
    const m = W.marks.pop();
    if (m) W.floaters.push({ x: m.x + 9, y: m.y - 12, t: 'checkpoint removed', life: 1, c: '#D9D0F0' });
    return !!m;
  };

  // A hit: the apple shield soaks it (with a short grace period), otherwise the player dies.
  function hurt(W) {
    const p = W.player;
    if (p.dead || p.inv > 0) return;
    // Carrying a shell, it takes the hit: it breaks, and you're unhurt (a moment's grace).
    if (p.carrying && p.carrying.alive) {
      const s = p.carrying; s.alive = false; p.carrying = null; p.inv = .8;
      burst(W, s.x + s.w / 2, s.y + s.h / 2, 14, ['#2E7D66', '#7FD8B4', '#E8DDB5'], 160, 400);
      W.floaters.push({ x: s.x + s.w / 2, y: s.y - 8, t: 'the shell breaks', life: .9, c: '#9FF0C8' });
      W.shake = .12; W.emit('shield');
      return;
    }
    if (!p.shield && p.tomato) return tomatoSave(W, p);
    if (!p.shield) return kill(W);
    // p.shield counts layers: 1, or 2 after a second apple. A hit takes one off.
    p.shield--; p.inv = 1.2; p.vy = -520; p.jumping = false;
    burst(W, p.x + p.w / 2, p.y + p.h / 2, 20, ['#9FD8FF', '#D9D0F0'], 200, 300);
    W.floaters.push({ x: p.x + p.w / 2, y: p.y - 8, t: p.shield ? 'shield cracked' : 'shield broke', life: 1, c: '#9FD8FF' });
    W.shake = .15; W.freeze = .06; ring(W, p.x + p.w / 2, p.y + p.h / 2, 46, '159,216,255', .45); W.emit('shield');
  }

  // The tomato: a hit with no shield, and it takes the hit instead (and is gone). Then
  // RUSH seconds of all three: speed, a high jump, and invincibility that kills whatever you
  // touch (p.rush; see stepPlayer and the enemy checks).
  const RUSH = 5;
  function tomatoSave(W, p) {
    p.tomato = Math.max(0, (p.tomato || 1) - 1); p.rush = RUSH; p.inv = RUSH; p.vy = -520; p.jumping = false;
    burst(W, p.x + p.w / 2, p.y + p.h / 2, 28, ['#E8402A', '#FFB547', '#FFE066', '#7FD87A'], 240, 200);
    ring(W, p.x + p.w / 2, p.y + p.h / 2, 60, '232,64,42', .5);
    W.floaters.push({ x: p.x + p.w / 2, y: p.y - 8, t: 'TOMATO RUSH!', life: 1.4, c: '#FF6B3D' });
    W.shake = .2; W.freeze = .06; W.emit('shield');
  }

  function respawn(W) {
    // In the story, dying always sends you back to the map (the lanterns you lit are kept
    // for your next go at this level: see def.resume).
    if (W.def.toMapOnDeath) { W.lost = true; W.emit('lost'); return; }
    // Dying costs you all your ammo; the level's crates fill up again, so a shot door can
    // never be left out of reach.
    const { keys } = W.player;
    // (Every fruit power goes too, the green apple's ripeness and Power Stack's stacking with them.)
    Object.assign(W.player, makePlayer(W.checkpoint), Object.fromEntries(FLAGS.map(k => [k, 0])), { ammo: 0, keys, green: 0, stack: 0 });
    for (const f of W.flows) if (f.trigger != null || f.triggerY != null) Object.assign(f, { s: (f.mode === 'fall' ? f.hi : f.lo) * TS, on: false, t: 0 });
    // (Cracked shingles you'd broken are back, for another go.)
    for (const pl of W.plats) if (pl.once && pl.state === 'gone') Object.assign(pl, { state: 'idle', t: 0, y: pl.oy, prevY: pl.oy });
    for (const e of W.enemies) if (e.alive && e.chase) { e.chase.x = W.player.x - TS * 14; e.chase.t = 1; }
    // The clock goes back to what your checkpoint gives you (see cpClock).
    if (W.def.deadline) { W.bossClock = !!W.cpBoss; setClock(W, LF.cpClock(W)); }
    for (const a of W.ammo) a.taken = false;
    // Practice: back at the latest checkpoint you set, if any.
    const mark = W.marks[W.marks.length - 1];
    if (mark) { W.player.x = mark.x; W.player.y = mark.y; }
    if (W.def.noSpawnInv) W.player.inv = 0;
    // In a boss fight you can't fire until your spawn protection is over (and at least
    // SPAWN_HOLD seconds), so you can't spam shots from safety at a boss beside your spawn.
    if (W.enemies.some(e => e.alive && isBoss(e))) W.player.cool = W.player.hold = Math.max(SPAWN_HOLD, W.player.inv);
    W.projectiles = [];
    // A boss fight carries on where it was: the boss, its damage, its guards, carts and other
    // minions all stay as they are. (Only the horde falls back, below.)
    for (const e of W.enemies) {
      if (isBoss(e) || e.summoned) continue;
      if (e.type === 'G') { e.x = e.ox; e.y = e.oy; e.vx = e.vy = 0; }
      if (e.type === 'X') { e.y = e.oy; e.state = 'idle'; }
      if (e.type === 'R' && e.state !== 'idle') { e.state = 'idle'; e.vx = 40 * (e.face || -1); }
      if (e.type === 'N') { e.x = e.ox; e.y = e.oy; e.state = 'idle'; e.wait = 1.8; }
      if (e.type === 'W') { e.x = e.ox; e.y = e.oy; e.state = 'idle'; e.cool = 1.2; }
    }
    burst(W, W.player.x + 9, W.player.y + 26, 12, ['#D9D0F0', '#FFB547'], 90, -60, 2);
    // After a death the horde falls back so the respawn is fair.
    if (W.horde) {
      W.horde.f = playerAlong(W.horde, W.player) - HORDE_BACK; W.horde.wait = HORDE_WAIT;
      if (W.def.arenaX && W.player.x < W.def.arenaX * TS) W.horde.dormant = true;
      if (W.def.hordeStop != null) W.horde.f = Math.min(W.horde.f, hordeLimit(W, W.horde));
    }
    W.emit('respawn');
  }

  // ---------- step ----------
  // Moving lava: a body of lava filling columns x0..x1 from its surface down to row
  // `bottom`, the surface (rows, top of the map is 0) moving one of four ways:
  //   tide  rises to row hi and sinks back to row lo, over and over (period seconds);
  //   wave  waves of height amp rows roll along it (wavelength len columns, period seconds),
  //         about row lo;
  //   rise  floods: creeps up from lo to hi at speed rows a second;
  //   fall  drains: sinks from hi to lo at speed rows a second.
  // A flow with a trigger column waits until you reach it, or with a triggerY until you're
  // up above that row within its columns (and starts again from the beginning if you come
  // back at a checkpoint).
  LF.flowSurface = (W, f, x) => {
    if (f.mode === 'tide') return (f.lo - (f.lo - f.hi) * (.5 - .5 * Math.cos(f.t / f.period * TAU))) * TS;
    if (f.mode === 'wave') return (f.lo - f.amp * (.5 + .5 * Math.sin((x / TS) / f.len * TAU - f.t / f.period * TAU))) * TS;
    return f.s;
  };
  function stepFlows(W, dt) {
    const p = W.player;
    for (const f of W.flows) {
      if (!f.on) {
        const cx = p.x + p.w / 2, there = f.triggerY != null ? cx >= f.x0 * TS && cx <= (f.x1 + 1) * TS && p.y + p.h <= f.triggerY * TS : p.x >= f.trigger * TS;
        if (there && !p.dead) f.on = true; else continue;
      }
      f.t += dt;
      if (f.mode === 'rise') f.s = Math.max(f.hi * TS, f.s - f.speed * TS * dt);
      if (f.mode === 'fall') f.s = Math.min(f.lo * TS, f.s + f.speed * TS * dt);
      if (Math.random() < dt * (f.x1 - f.x0) * .3) { const x = (f.x0 + Math.random() * (f.x1 - f.x0 + 1)) * TS; burst(W, x, LF.flowSurface(W, f, x), 2, ['#FFB547', '#FF6B3D'], 60, 300, 2); }
    }
  }
  const inFlow = (W, p) => W.flows.some(f => {
    const cx = p.x + p.w / 2;
    if (!f.on && f.mode === 'rise') return false;   // (a flood that hasn't started is still just below its floor)
    return cx >= f.x0 * TS && cx <= (f.x1 + 1) * TS && p.y < (f.bottom + 1) * TS && p.y + p.h > LF.flowSurface(W, f, cx) + 8;
  });

  LF.step = function (W, input, dt, playing = true) {
    // Hit-freeze: a few frames of stillness make stomps and kills land harder.
    if (W.freeze > 0) { W.freeze -= dt; return; }
    W.clock += dt;
    stepFlows(W, dt);
    stepChaseCart(W, dt);
    stepPlats(W, dt);
    stepSpinners(W, dt);
    stepCrumbles(W, dt);
    for (const e of W.enemies) {
      if (!e.alive) { e.dead += dt; continue; }
      // (A boss's fury runs on the real clock: FURY is in seconds you live through.)
      if (e.fury > 0 && e.alive) stepFury(W, e, dt);
      // Worn out after a fury: dazed (stompable whatever it is) till it gets its breath back.
      if (e.rest > 0) { e.rest -= dt; e.dazed = Math.max(e.dazed || 0, Math.min(e.rest, .2)); }
      stepEnemy(W, e, dt * ENEMY_SPEED * tune(W.def.tuning, e.type).speed, playing);
    }
    stepProjectiles(W, dt, playing);
    stepBlinks(W, dt);
    stepSwitch(W, dt);
    stepPanels(W, dt);
    stepRain(W, dt);
    stepBonus(W);
    stepBullets(W, dt);
    stepAmmoFly(W, dt);
    stepTraps(W, dt, playing);
    if (W.lavaTop.length && Math.random() < dt * Math.min(40, W.lavaTop.length * .6)) {
      const l = W.lavaTop[Math.floor(Math.random() * W.lavaTop.length)];
      W.particles.push({ x: l.tx * TS + Math.random() * TS, y: l.ty * TS + 8, vx: (Math.random() - .5) * 30, vy: -60 - Math.random() * 90, life: .9, max: .9, c: LF.WARM[Math.floor(Math.random() * 3)], size: 2 + Math.random() * 2, g: 60 });
    }
    stepUnlocking(W, dt);
    stepHorde(W, dt, playing);
    for (const d of W.shotDoors) d.flash = Math.max(0, d.flash - dt);
    for (const r of W.rings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 10); }
    W.rings = W.rings.filter(r => r.life > 0);
    for (const g of W.ghosts) g.life -= dt;
    W.ghosts = W.ghosts.filter(g => g.life > 0);
    for (const l of W.lanterns) l.pop = Math.max(0, l.pop - dt * 2.5);
    for (const f of W.fruits) {
      f.pop = Math.max(0, f.pop - dt * 2.5);
      if (f.taken && (f.regrow -= dt) <= 0) { f.taken = false; f.pop = 1; }
    }
    if (W.door) W.door.glow = approach(W.door.glow, W.door.open ? 1 : 0, dt * 1.5);

    const p = W.player;
    // A boss level ends a moment after its boss falls.
    if (W.endTimer > 0 && !W.cleared && (W.endTimer -= dt) <= 0) { W.cleared = true; W.clearedBy = 'boss'; W.emit('clear'); }
    // A timed level (def.timeLimit, in seconds) ends when the time is up.
    if (playing && !W.cleared && W.def.timeLimit && W.time >= W.def.timeLimit) { W.cleared = true; W.clearedBy = 'time'; W.emit('clear'); }
    // The clock (def.deadline, in seconds): with HURRY seconds left it's 'hurry' (once), and
    // when it runs out you die. (If you come back at a checkpoint, the clock starts again.)
    // Stepping into a boss arena adds def.bossTime seconds (and calms the hurry, if it's
    // back over HURRY).
    if (playing && !W.cleared && !p.dead && W.def.deadline) {
      if (W.def.bossTime && !W.bossClock && W.def.arenaX && p.x >= W.def.arenaX * TS) {
        W.bossClock = true; W.clockFrom = (W.clockFrom || 0) + W.def.bossTime;
        W.floaters.push({ x: p.x + p.w / 2, y: p.y - 30, t: `+${W.def.bossTime} seconds`, life: 1.6, c: '#9FD8FF' });
        if (W.hurried && LF.timeLeft(W) > (W.def.hurry || HURRY)) { W.hurried = false; W.emit('calm'); }
      }
      const left = LF.timeLeft(W);
      if (left <= (W.def.hurry || HURRY) && !W.hurried) { W.hurried = true; W.emit('hurry'); }
      if (left <= 0) {
        W.floaters.push({ x: p.x + p.w / 2, y: p.y - 18, t: 'time’s up!', life: 1.6, c: '#FF6B3D' });
        W.emit('timeup'); kill(W);
      }
    }
    if (playing && !W.cleared) {
      W.time += dt;
      // (The mango slows the level clock to two-thirds speed.)
      if (W.player.slowtime && W.def.deadline && !W.player.dead) W.clockFrom = (W.clockFrom || 0) + dt / (W.player.slowtime > 1 ? 2 : 3);
      if (p.dead) { if (!W.lost) { W.deadTimer -= dt; if (W.deadTimer <= 0) respawn(W); } }
      else if (p.inCannon) stepCannon(W, p, dt);
      else stepPlayer(W, p, input, dt);
    }
    for (const q of W.particles) { q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    W.particles = W.particles.filter(q => q.life > 0);
    for (const f of W.floaters) { f.y -= 28 * dt; f.life -= dt; }
    W.floaters = W.floaters.filter(f => f.life > 0);
    W.shake = Math.max(0, W.shake - dt);
  };

  // Wheels: x marks the hub; its platforms ride round it WHEEL_R from the middle.
  const WHEEL_R = TS * 3, WHEEL_CARS = 4, WHEEL_SPIN = 1.15;
  LF.WHEEL_R = WHEEL_R;
  function wheelAt(pl) { pl.x = pl.cx + Math.cos(pl.a) * WHEEL_R - pl.w / 2; pl.y = pl.cy + Math.sin(pl.a) * WHEEL_R - pl.h / 2; }
  // Turn blocks turn smoothly at SPIN radians a second (a full turn every 3 seconds or so,
  // like the rotating blocks in NSMBW): walk to stay on top as the face under you tilts.
  const SPIN = 2.2;
  function stepSpinners(W, dt) {
    for (const s of W.spinners) { s.da = s.dir * SPIN * dt; s.a += s.da; }
  }
  // Push a box out of a turn block (a square turned by s.a), along the shortest way out.
  // Returns that push, or null if they don't touch.
  function spinnerPush(s, b) {
    const c = Math.cos(s.a), sn = Math.sin(s.a), bx = b.x + b.w / 2, by = b.y + b.h / 2;
    let best = null;
    for (const [ax, ay] of [[1, 0], [0, 1], [c, sn], [-sn, c]]) {
      // The box's half-width along this axis, and the square's.
      const rb = Math.abs(ax) * b.w / 2 + Math.abs(ay) * b.h / 2;
      const rs = s.half * (Math.abs(ax * c + ay * sn) + Math.abs(-ax * sn + ay * c));
      const d = (bx - s.cx) * ax + (by - s.cy) * ay, over = rb + rs - Math.abs(d);
      if (over <= 0) return null;
      if (!best || over < best.over) best = { over, x: ax * Math.sign(d || 1) * over, y: ay * Math.sign(d || 1) * over };
    }
    return best;
  }
  LF.spinnerCorners = s => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({ x: s.cx + (u * Math.cos(s.a) - v * Math.sin(s.a)) * s.half, y: s.cy + (u * Math.sin(s.a) + v * Math.cos(s.a)) * s.half }));
  function stepPlats(W, dt) {
    for (const pl of W.plats) {
      pl.prevY = pl.y; pl.dx = 0; pl.dy = 0;
      if (pl.kind === 'fall') {
        // A shingle under moving lava is sunk out of sight (and out of reach) till the lava
        // drains down past it.
        pl.sunk = W.flows.some(f => pl.ox + pl.w / 2 >= f.x0 * TS && pl.ox + pl.w / 2 <= (f.x1 + 1) * TS && pl.oy + 2 >= LF.flowSurface(W, f, pl.ox + pl.w / 2) && pl.oy <= (f.bottom + 1) * TS);
        if (pl.sunk) { pl.state = 'idle'; pl.t = 0; pl.y = pl.prevY = pl.oy; continue; }
        stepShingle(W, pl, dt); continue;
      }
      if (pl.kind === 'wheel') { const ox = pl.x, oy = pl.y; pl.a += pl.spin * dt; wheelAt(pl); pl.dx = pl.x - ox; pl.dy = pl.y - oy; continue; }
      const sp = pl.v * dt * pl.dir;
      if (pl.axis === 'x') {
        const nx = pl.x + sp;
        const col = Math.floor((sp > 0 ? nx + pl.w - .01 : nx) / TS), row = Math.floor((pl.y + 6) / TS);
        if (blocksPlat(tile(W, col, row)) || nx < 0 || nx + pl.w > W.w * TS) pl.dir *= -1;
        else { pl.dx = nx - pl.x; pl.x = nx; }
      } else {
        const ny = pl.y + sp;
        const row = Math.floor((sp > 0 ? ny + pl.h : ny) / TS);
        const c0 = tile(W, Math.floor(pl.x / TS), row), c1 = tile(W, Math.floor((pl.x + pl.w - 1) / TS), row);
        if (blocksPlat(c0) || blocksPlat(c1) || ny < 0 || ny + pl.h > W.h * TS) pl.dir *= -1;
        else { pl.dy = ny - pl.y; pl.y = ny; }
      }
    }
  }

  // Switches: hit a switch block (§) from below with your head, or knock a kicked shell into
  // it, and the switch flips: the red blocks go and the blue ones come (and back again on
  // the next hit). A block never comes in on top of you or an enemy; it waits till it's
  // clear.
  function hitSwitch(W, tx, ty) {
    if ((W.switchCool || 0) > 0) return;
    W.switchOn = !(W.switchOn ?? true); W.switchCool = .2;
    for (const b of W.swBlocks || []) b.wait = true;
    burst(W, tx * TS + 16, ty * TS + 16, 14, W.switchOn ? ['#FF6B6B', '#FFE2A8'] : ['#6FA8FF', '#E2EEFF'], 160, 200);
    W.floaters.push({ x: tx * TS + 16, y: ty * TS - 8, t: W.switchOn ? 'red on' : 'blue on', life: 1, c: W.switchOn ? '#FF8A8A' : '#9FC4FF' });
    W.shake = Math.max(W.shake, .12); W.emit('blink');
  }
  LF.hitSwitch = hitSwitch;

  // Panel groves. Lucky Panels: every panel hides a fruit (yours) or a skull; turn them over
  // till you've found two skulls (or every fruit). Panel Pairs: a few seconds' peek at them
  // all to remember where the fruit is, then turn them over two at a time, as often as the
  // clock allows;
  // a pair that matches is two of that fruit for you, one that doesn't flips back, and two
  // bad matches and it's over. (It ends a moment later, so you see what you turned up.)
  function hitPanel(W, tx, ty) {
    const g = W.def.panelGame, pn = (W.panels || []).find(q => q.tx === tx && q.ty === ty);
    if (!g || !pn || pn.open || W.cleared || W.panelOver || W.panelWait > 0 || W.panelPeek > 0) return;
    const say = (t, c) => W.floaters.push({ x: tx * TS + 16, y: ty * TS - 10, t, life: 1.2, c });
    pn.open = true; pn.pop = 1; W.emit('blink');
    if (g.mode === 'lucky') {
      if (pn.sym[0] === '+') {
        // (An ammo panel: that much ammo.)
        const n = +pn.sym.slice(1); pn.done = true; W.player.ammo += n; W.emit('bigammo'); say(`+${n} ammo`, '#FFE2A8');
        burst(W, tx * TS + 16, ty * TS + 32, 12, ['#FFE2A8', '#FFB547'], 160, 200);
        if (W.panels.every(q => q.sym === '☠' || q.open) && !W.def.bonusDoor) W.panelOver = 1.4;
      } else if (pn.sym === '☠') {
        W.panelBad++; W.shake = Math.max(W.shake, .2); W.emit('buzz');
        say(W.panelBad >= 2 ? 'two skulls!' : 'a skull! (one more and it’s over)', '#FF8A8A');
        if (W.panelBad >= 2) W.panelOver = 1.4;
      } else {
        pn.done = true; W.got[pn.sym] = (W.got[pn.sym] || 0) + 1; W.emit('fruit'); say('+1', '#FFE2A8');
        burst(W, tx * TS + 16, ty * TS + 32, 12, [(LF.FRUITS[pn.sym] || LF.FRUITS.a).color, '#FFFFFF'], 160, 200);
        if (W.panels.every(q => q.sym === '☠' || q.open) && !W.def.bonusDoor) W.panelOver = 1.4;
      }
      return;
    }
    const first = W.panels.find(q => q.open && !q.done && q !== pn);
    if (!first) return;
    if (first.sym === pn.sym) {
      first.done = pn.done = true; W.got[pn.sym] = (W.got[pn.sym] || 0) + 2; W.emit('fruit'); say('a match! +2', '#FFE2A8');
      burst(W, tx * TS + 16, ty * TS + 32, 16, [(LF.FRUITS[pn.sym] || LF.FRUITS.a).color, '#FFFFFF'], 180, 200);
      if (W.panels.every(q => q.done) && !W.def.bonusDoor) W.panelOver = 1.4;
    } else {
      // (No match: they just turn back over. Try again till the clock runs out.)
      W.emit('buzz'); say('no match', '#9FC4FF');
      W.panelWait = 1; W.panelBack = [first, pn];
    }
  }
  // Fruit Rain (def.fruitRain = { every, kinds }): fruit falling from the sky, one every
  // `every` seconds somewhere along the grove, the kinds coming round in turn (so every kind
  // falls); catch it before it lands, or soon after (it lies there a moment, then it's gone).
  // (Crate Rain, def.ammoRain = { every }: ammo crates instead, every sixth a big one.)
  function stepRain(W, dt) {
    const fr = W.def.fruitRain || W.def.ammoRain;
    if (!fr || W.cleared) return;
    W.rainT = (W.rainT ?? .5) - dt;
    if (W.rainT <= 0) {
      W.rainT += fr.every; W.rainN = (W.rainN || 0) + 1;
      const tx = 2 + Math.floor(Math.random() * (W.w - 4));
      if (W.def.ammoRain) { const big = W.rainN % 6 === 0; W.ammo.push({ big, huge: false, n: (big ? 10 : 3) * (LF.eventIs && LF.eventIs('ammo') ? 2 : 1), tx, ty: 1, x: tx * TS + 16, y: TS * 1.5, taken: false, vy: 40, rain: true }); }
      else W.fruits.push({ type: fr.kinds[W.rainN % fr.kinds.length], tx, ty: 1, x: tx * TS + 16, y: TS * 1.5, taken: false, regrow: 0, pop: 1, vy: 40, rain: true });
    }
    for (const f of [...W.fruits, ...W.ammo]) {
      if (!f.rain || f.taken) continue;
      if (f.landed != null) { f.landed -= dt; continue; }
      f.vy = Math.min(190, f.vy + 220 * dt); f.y += f.vy * dt;
      const below = tile(W, Math.floor(f.x / TS), Math.floor((f.y + 12) / TS));
      if (isSolid(below) || below === '=') { f.y = Math.floor((f.y + 12) / TS) * TS - 14; f.landed = 1.6; }
    }
    W.fruits = W.fruits.filter(f => !f.rain || (!f.taken && !(f.landed < 0)));
    W.ammo = W.ammo.filter(f => !f.rain || (!f.taken && !(f.landed < 0)));
  }
  // A grove's bonus door (def.bonusDoor): get every fruit, every crate, every panel's prize,
  // and it opens; go through it and everything you got there counts twice (see ui.js).
  function stepBonus(W) {
    if (!W.def.bonusDoor || !W.door || W.door.open || W.cleared || W.panelOver) return;
    const panels = W.panels || [], prize = q => q.sym !== '☠';
    const any = W.fruits.length + W.ammo.length + panels.length > 0;
    const all = W.fruits.every(f => f.taken) && W.ammo.every(a => a.taken) && panels.every(q => !prize(q) || (W.def.panelGame.mode === 'pairs' ? q.done : q.open));
    if (!any || !all) return;
    W.door.open = true; W.emit('door'); W.shake = Math.max(W.shake, .15);
    W.floaters.push({ x: W.player.x + W.player.w / 2, y: W.player.y - 30, t: 'every one! the bonus door is open: double it all', life: 2.6, c: '#FFE066' });
  }
  function stepPanels(W, dt) {
    if (!W.panels) return;
    for (const q of W.panels) q.pop = Math.max(0, q.pop - dt * 3);
    // (Panel Pairs starts with a peek: every panel face up for a few seconds, then over.)
    if (W.panelPeek > 0 && (W.panelPeek -= dt) <= 0) { for (const q of W.panels) q.pop = 1; W.emit('blink'); }
    if (W.panelWait > 0 && (W.panelWait -= dt) <= 0 && W.panelBack) { for (const q of W.panelBack) q.open = false; W.panelBack = null; }
    // (Lucky Panels: when it's over, every panel left turns over, to show what you missed.)
    if (W.def.panelGame?.mode === 'lucky' && (W.panelOver || W.cleared) && !W.revealed) {
      W.revealed = true;
      for (const q of W.panels) if (!q.open) { q.open = true; q.missed = true; q.pop = 1; }
    }
    if (W.panelOver && !W.cleared && (W.panelOver -= dt) <= 0) { W.cleared = true; W.clearedBy = 'panels'; W.emit('clear'); }
  }
  function stepSwitch(W, dt) {
    // (The pause between hits runs down whether or not there are any blocks to switch.)
    W.switchCool = Math.max(0, (W.switchCool || 0) - dt);
    if (!W.swBlocks) return;
    const on = W.switchOn ?? true, p = W.player;
    for (const b of W.swBlocks) {
      if (!b.wait) continue;
      const solid = b.red ? on : !on, box = { x: b.tx * TS, y: b.ty * TS, w: TS, h: TS };
      if (solid && ((!p.dead && overlap(p, box)) || W.enemies.some(e => e.alive && !e.phased && overlap(e, box)))) continue;
      W.tiles[b.ty][b.tx] = b.red ? (solid ? 'Ʀ' : 'ʀ') : (solid ? 'Ɓ' : 'ɓ'); b.wait = false;
    }
  }

  // Blink blocks: every BLINK seconds the T set and the H set swap between solid and empty.
  // A block never switches on inside the player; it waits until they step out.
  function stepBlinks(W, dt) {
    if (!W.blinks.length) return;
    W.blinkT += dt;
    if (W.blinkT >= BLINK) { W.blinkT -= BLINK; W.blinkOn = W.blinkOn === 'T' ? 'H' : 'T'; for (const b of W.blinks) b.wait = true; W.emit('blink'); }
    const p = W.player;
    for (const b of W.blinks) {
      if (!b.wait) continue;
      const on = b.c === W.blinkOn;
      if (on && !p.dead && overlap(p, { x: b.tx * TS, y: b.ty * TS, w: TS, h: TS })) continue;
      W.tiles[b.ty][b.tx] = on ? b.c : b.c.toLowerCase(); b.wait = false;
    }
  }

  // An explosion hits every enemy within `r` once (the horde is immune) and destroys any
  // embers or arrows in range. `shot` is the shot it came from: a grenade's bounces all
  // share one, so a grenade hits each enemy at most three times, once per blast.
  // A `lethal` blast (a TNT cart going up) kills outright instead: golems die and other
  // carts explode too. To a boss it's just one more hit.
  function explode(W, x, y, r, big, shot = newShot(W), lethal = false) {
    for (const e of W.enemies) {
      if (!e.alive || e.phased || Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y) > r + Math.max(e.w, e.h) / 2) continue;
      if (lethal && !isBoss(e)) e.hp = 1;
      shootEnemy(W, e, Math.sign(e.x + e.w / 2 - x) || 1, shot, lethal && e.armored ? 'KO' : 'boom');
    }
    for (const q of W.projectiles) if (Math.hypot(q.x + q.w / 2 - x, q.y + q.h / 2 - y) < r) q.life = 0;
    for (const d of W.shotDoors) if (!d.open && d.tiles.some(([tx, ty]) => Math.hypot(tx * TS + 16 - x, ty * TS + 16 - y) < r + 16)) hitShotDoor(W, d, shot);
    burst(W, x, y, big ? 40 : 22, ['#FFF1CF', '#FFB547', '#FF6B3D', '#463C6B'], big ? 320 : 220, 300, big ? 4 : 3);
    ring(W, x, y, r, '255,181,71', big ? .5 : .35);
    ring(W, x, y, r * .55, '255,241,207', .25);
    W.shake = Math.max(W.shake, big ? .3 : .15); W.freeze = Math.max(W.freeze, big ? .06 : .03);
    W.emit(big ? 'boom' : 'pop');
  }

  // In water or lava (the tile it's in), a bomb, a grenade or a stick of dynamite sinks
  // slowly, as you do (SINK), and slows as it goes along: returns true if it's in.
  function sinkIn(W, b, dt) {
    const c = tile(W, Math.floor(b.x / TS), Math.floor(b.y / TS));
    if (c !== '~' && c !== '!') return false;
    b.vy = Math.min(b.vy, SINK); if (b.vy < -SINK) b.vy = -SINK;
    b.vx *= Math.pow(.15, dt);
    return true;
  }

  function stepSpecial(W, b, dt) {
    b.life -= dt;
    const inHorde = () => W.horde && along(W.horde, b.x, b.y) < W.horde.f;
    // Dynamite: thrown in an arc, it falls and settles wherever it lands (sliding to a stop,
    // and riding along on whatever it's sitting on; into water or lava, it sinks slowly). When its 3-second fuse burns down it
    // goes up, killing everything within 5 blocks (10 for a big stick): golems, carts, all
    // of it. A boss takes it as one hit. It doesn't hurt you.
    if (b.kind === 'dyn') {
      b.vy = Math.min(MAXFALL, b.vy + G * .8 * dt);
      sinkIn(W, b, dt);
      const wall = c => isSolid(c) || c === '^';
      const nx = b.x + b.vx * dt;
      if (wall(tile(W, Math.floor((nx + Math.sign(b.vx) * 4) / TS), Math.floor(b.y / TS)))) b.vx *= -.3;
      else b.x = nx;
      const ny = b.y + b.vy * dt, foot = Math.floor((ny + 4) / TS), c = tile(W, Math.floor(b.x / TS), foot);
      const plat = b.vy >= 0 && W.plats.find(pl => pl.state !== 'gone' && b.x > pl.x && b.x < pl.x + pl.w && b.y + 4 <= pl.y + 2 && ny + 4 >= pl.y);
      if (plat) { b.y = plat.y - 4; b.vy = 0; b.x += (plat.dx || 0); b.vx *= Math.pow(.01, dt); }
      else if (b.vy > 0 && Math.floor((b.y + 4) / TS) < foot + 1 && (wall(c) || c === '=')) { b.y = foot * TS - 4; b.vy = 0; b.vx *= Math.pow(.01, dt); }
      else if (b.vy < 0 && wall(tile(W, Math.floor(b.x / TS), Math.floor((ny - 4) / TS)))) b.vy = 0;
      else b.y = ny;
      if (Math.random() < .5) W.particles.push({ x: b.x + 3, y: b.y - 8 * b.s, vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 60, life: .25, max: .25, c: Math.random() < .5 ? '#FFE066' : '#FF6B3D', size: 1.6, g: 200 });
      if (b.y > W.h * TS + 40) { b.life = 0; return; }
      if (b.life <= 0) explode(W, b.x, b.y, TS * DYN_R * b.s, true, b.id, true);
      return;
    }
    if (b.kind === 'nuke') {
      if (Math.random() < .6) W.particles.push({ x: b.x + (Math.random() - .5) * 10, y: b.y - 10, vx: (Math.random() - .5) * 40, vy: -50, life: .4, max: .4, c: Math.random() < .5 ? '#9FF07A' : '#FFE066', size: 2, g: 0 });
      if (b.life <= 0) {
        explode(W, b.x, b.y, TS * NUKE_R * b.s, true, b.id, true);
        ring(W, b.x, b.y, TS * NUKE_R * b.s, '210,255,170', .9); ring(W, b.x, b.y, TS * 6, '255,255,255', .5);
        for (let n = 0; n < 8; n++) burst(W, b.x + (Math.random() - .5) * 120, b.y + (Math.random() - .5) * 80, 30, ['#FFFFFF', '#E9FFB8', '#FFE066', '#FF6B3D'], 420, 200, 5);
        W.shake = Math.max(W.shake, 1.4); W.freeze = Math.max(W.freeze, .15); W.nukeFlash = 1;
        W.floaters.push({ x: b.x, y: b.y - 40, t: 'NUKE!', life: 2, c: '#E9FFB8' });
      }
      return;
    }
    if (b.kind === 'rocket') {
      b.x += b.vx * dt;
      if (Math.random() < .6) W.particles.push({ x: b.x - Math.sign(b.vx) * 6, y: b.y, vx: -b.vx * .15, vy: (Math.random() - .5) * 30, life: .3, max: .3, c: LF.WARM[Math.floor(Math.random() * 3)], size: 2.5, g: 0 });
      if (inHorde()) { b.life = 0; return; }
      const hitWall = isSolid(tile(W, Math.floor(b.x / TS), Math.floor(b.y / TS)));
      const hitEnemy = W.enemies.some(e => e.alive && !e.phased && overlap({ x: b.x - 5 * b.s, y: b.y - 3 * b.s, w: 10 * b.s, h: 6 * b.s }, e));
      if (hitWall || hitEnemy || b.life <= 0) { b.life = 0; explode(W, b.x - Math.sign(b.vx) * (hitWall ? 6 : 0), b.y, TS * 3 * b.s, true, b.id); }
      return;
    }
    // Grenade: falls and bounces; every contact counts. The first two blast 2 blocks,
    // the third explodes on impact with the big 3-block blast (the fuse is just a backstop).
    // It bounces off anything: blocks and spikes from any side; the tops of planks, lifts,
    // shingles and crushers when coming down on them; and enemies. Into water or lava it
    // sinks slowly.
    b.vy = Math.min(MAXFALL, b.vy + G * .8 * dt);
    sinkIn(W, b, dt);
    let bounced = false;
    const wall = c => isSolid(c) || c === '^';
    const surface = c => wall(c) || c === '=';
    const nx = b.x + b.vx * dt;
    if (wall(tile(W, Math.floor(nx / TS), Math.floor(b.y / TS)))) { b.vx *= -.6; bounced = true; }
    else b.x = nx;
    const ny = b.y + b.vy * dt, row = Math.floor(ny / TS), c = tile(W, Math.floor(b.x / TS), row);
    const topHit = b.vy > 0 && Math.floor(b.y / TS) < row && surface(c);
    const onPlat = b.vy > 0 && [...W.plats.filter(pl => pl.state !== 'gone'), ...W.traps.filter(t => t.type === 'crush')]
      .some(pl => b.x > pl.x && b.x < pl.x + pl.w && b.y <= pl.y + 1 && ny >= pl.y);
    if ((b.vy < 0 && wall(c)) || (b.vy > 0 && wall(c)) || topHit || onPlat) {
      b.vy *= -.55; b.vx *= .8; bounced = true;
    } else b.y = ny;
    const foe = W.enemies.find(e => e.alive && !e.phased && overlap({ x: b.x - 5 * b.s, y: b.y - 5 * b.s, w: 10 * b.s, h: 10 * b.s }, e));
    if (foe && !b.lastFoe) { b.vx = -b.vx * .7; b.vy = -Math.max(220, Math.abs(b.vy) * .6); bounced = true; }
    b.lastFoe = foe;
    if (inHorde()) { b.life = 0; return; }
    if (bounced) {
      b.bounces++;
      if (b.bounces >= 3) { b.life = 0; return explode(W, b.x, b.y, TS * 3 * b.s, true, b.id); }
      explode(W, b.x, b.y, TS * 2 * b.s, false, b.id);
    }
    if (b.life <= 0 || b.y > W.h * TS + 40) { b.life = 0; if (b.y <= W.h * TS + 40) explode(W, b.x, b.y, TS * 3 * b.s, true, b.id); }
  }

  // Killing an enemy (shot, blown up or stomped) pops out one bullet per point of its drop
  // value. They fly to the player side by side as one group (n bullets, spaced so you can
  // count them) and arrive together for +n ammo. Hardcore has no ammo, so nothing drops there.
  function dropAmmo(W, e) {
    const n = LF.ENEMIES[e.type].drop * (W.player.lucky > 1 ? 3 : W.player.lucky ? 2 : 1) * (LF.eventIs && LF.eventIs('ammo') ? 2 : 1);   // (grapes, or an Ammo Rain event: twice the ammo)
    if (!n || W.def.noSpawnInv || W.def.noAmmo) return;
    W.ammoFly.push({ n, x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - .5) * 80, vy: -300, t: 0 });
  }
  // A group of bullets pops up for a moment, then homes in on the player faster and faster.
  function stepAmmoFly(W, dt) {
    const p = W.player, px = p.x + p.w / 2, py = p.y + p.h / 2;
    for (const b of W.ammoFly) {
      b.t += dt;
      if (b.t < .25) { b.vx *= 1 - 3 * dt; b.vy *= 1 - 3 * dt; }
      else {
        const dx = px - b.x, dy = py - b.y, d = Math.hypot(dx, dy) || 1, sp = 300 + (b.t - .25) * 1400;
        const k = Math.min(1, 10 * dt);
        b.vx += (dx / d * sp - b.vx) * k; b.vy += (dy / d * sp - b.vy) * k;
        if (d < 14 + sp * dt) {
          b.done = true; p.ammo += b.n;
          burst(W, px, py, 3 + b.n, ['#FFE2A8', '#FFB547'], 70, 0, 1.5);
          W.floaters.push({ x: px, y: p.y - 10, t: `+${b.n} ammo`, life: .8, c: '#FFE2A8' });
          W.emit('ammotick');
          continue;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    W.ammoFly = W.ammoFly.filter(b => !b.done);
  }

  // A shot door takes one hit per shot (a grenade up to three) and opens on its last one.
  function hitShotDoor(W, d, shot) {
    if (shot) {
      const n = d.hitBy[shot] || 0;
      if (n >= (W.shotMax[shot] || 1)) return;
      d.hitBy[shot] = n + 1;
    }
    d.hits++; d.flash = .15;
    const [mx, my] = d.tiles[Math.floor(d.tiles.length / 2)];
    if (d.hits < d.need) { W.emit('clank'); return; }
    d.open = true;
    for (const [tx, ty] of d.tiles) {
      W.tiles[ty][tx] = ' ';
      burst(W, tx * TS + 16, ty * TS + 16, 8, ['#CFC6E8', '#8F81AB', '#FFB547'], 140, 300, 2.5);
    }
    W.floaters.push({ x: mx * TS + 16, y: my * TS - 4, t: 'door open', life: 1.2, c: '#FFE2A8' });
    W.shake = Math.max(W.shake, .2); W.emit('unlock');
  }

  // Every shot (bullet, explosive round or grenade) gets an id and a limit on how many
  // times it can hit the same enemy however often it splashes or blasts: once, or three
  // times for a grenade (once per blast).
  const newShot = (W, max = 1) => { W.shots = (W.shots || 0) + 1; (W.shotMax ||= {})[W.shots] = max; return W.shots; };
  // One hit on an enemy: armored ones (golems, TNT carts, bosses) lose `dmg` points, the rest die.
  function shootEnemy(W, e, dir, shot, how = 'zap', dmg = 1) {
    const boss = isBoss(e);
    if (shot) {
      // (A grenade's three blasts can each land a hit, bosses included.)
      const hits = (e.hitBy ||= {})[shot] || 0;
      if (hits >= (W.shotMax[shot] || 1)) return;
      e.hitBy[shot] = hits + 1;
    }
    if (boss) { if (e.fury > 0) return; dmg = 1; wakeBoss(W, e); }
    if (e.armored && how !== 'KO') {
      W.floaters.push({ x: e.x + e.w / 2, y: e.y - 6, t: 'armored', life: .6, c: '#CFC6E8' });
      burst(W, e.x + e.w / 2, e.y + e.h / 2, 6, ['#CFC6E8'], 100, 300, 2); W.emit('clank');
      return;
    }
    if (e.hp > dmg) {
      e.hp -= dmg; e.hurt = .15; if (!boss && e.type !== '@') e.x += dir * 5;
      if (boss && W.def.bossFury) startFury(W, e);
      burst(W, e.x + e.w / 2, e.y + e.h / 2, 8, ['#CFC6E8', '#FFE2A8'], 120, 300, 2); W.emit('clank');
      return;
    }
    e.alive = false; dropAmmo(W, e);
    burst(W, e.x + e.w / 2, e.y + e.h / 2, 16, ['#FFE2A8', '#FF6B3D', '#463C6B'], 180, 400);
    W.floaters.push({ x: e.x + e.w / 2, y: e.y - 6, t: how, life: .8, c: how === 'boom' ? '#FFB547' : '#FFE2A8' });
    W.shake = Math.max(W.shake, .1); W.freeze = .04; ring(W, e.x + e.w / 2, e.y + e.h / 2, 30, '255,226,168'); W.emit('zap', { type: e.type });
    if (boss) bossDown(W, e);
    // A TNT cart goes up in a 10-block blast that kills everything it reaches, golems
    // included, and sets off any other carts.
    if (e.type === '@') {
      explode(W, e.x + e.w / 2, e.y + e.h / 2, TS * 10, true, newShot(W), true);
      W.shake = Math.max(W.shake, .6); W.freeze = Math.max(W.freeze, .1);
    }
  }
  // Regular bullets splash: every other enemy within a block of where it hit takes a hit too
  // (two blocks for a big Shift shot).
  function splash(W, x, y, dir, except, s = 1, shot) {
    ring(W, x, y, TS * s, '255,226,168', .2);
    for (const e of W.enemies) if (e.alive && !e.phased && e !== except && circleHits(x, y, TS * s, e)) shootEnemy(W, e, dir, shot);
  }

  function stepBullets(W, dt) {
    for (const b of W.bullets) {
      if (b.kind) { stepSpecial(W, b, dt); continue; }
      b.x += b.vx * dt; b.life -= dt;
      const btx = Math.floor(b.x / TS), bty = Math.floor(b.y / TS);
      if (isSolid(tile(W, btx, bty)) || tile(W, btx, bty) === 'l') {
        const d = W.shotDoorAt[bty * W.w + btx];
        if (d && !d.open) hitShotDoor(W, d, b.id);
        b.life = 0; burst(W, b.x, b.y, 5, ['#FFE2A8', '#FFB547'], 80, 200, 2); if (!b.kill) splash(W, b.x - Math.sign(b.vx) * 4, b.y, Math.sign(b.vx), null, b.s, b.id); continue; }
      // Bullets just vanish into the horde.
      if (W.horde && along(W.horde, b.x, b.y) < W.horde.f) { b.life = 0; burst(W, b.x, b.y, 4, ['#463C6B'], 60, 0, 2); continue; }
      for (const e of W.enemies) {
        if (!e.alive || e.phased || !overlap({ x: b.x - 4 * b.s, y: b.y - 2 * b.s, w: 8 * b.s, h: 4 * b.s }, e)) continue;
        b.life = 0;
        if (b.kill) { shootEnemy(W, e, Math.sign(b.vx), b.id, 'KO', 999); ring(W, e.x + e.w / 2, e.y + e.h / 2, 40, '229,72,77', .3); break; }
        shootEnemy(W, e, Math.sign(b.vx), b.id);
        splash(W, e.x + e.w / 2, e.y + e.h / 2, Math.sign(b.vx), e, b.s, b.id);
        break;
      }
      // Bullets knock embers, arrows, bombs and shockwaves out of the air, but fly through fire.
      for (const q of W.projectiles) if (b.life > 0 && q.kind !== 'flame' && q.kind !== 'warn' && Math.abs(q.x + q.w / 2 - b.x) < q.w / 2 + 4 * b.s && Math.abs(q.y + q.h / 2 - b.y) < q.h / 2 + 2 * b.s + 2) { q.life = 0; b.life = 0; burst(W, b.x, b.y, 8, LF.WARM, 100, 200, 2); }
    }
    W.bullets = W.bullets.filter(b => b.life > 0);
  }

  // ---------- effects ----------
  const ring = (W, x, y, max, c, life = .35) => W.rings.push({ x, y, r: 2, max, c, life, total: life });
  // Leave a fading copy of the player every few frames while `trail` lasts.
  function trail(W, p, dt, c) {
    p.trail -= dt; p.trailT = (p.trailT || 0) - dt;
    if (p.trail > 0 && p.trailT <= 0) { p.trailT = .03; W.ghosts.push({ x: p.x, y: p.y, w: p.w, h: p.h, face: p.face, life: .22, max: .22, c: p.trailC || c }); }
  }

  // ---------- traps: pendulums, fire bars, crushers ----------
  const circleHits = (cx, cy, r, b) => {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w)), ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  };
  LF.pendBall = t => ({ x: t.ax + Math.sin(t.a) * t.len, y: t.ay + Math.cos(t.a) * t.len });
  LF.barBalls = t => Array.from({ length: t.n }, (_, k) => ({ x: t.cx + Math.cos(t.a) * (k + 1) * 13, y: t.cy + Math.sin(t.a) * (k + 1) * 13 }));
  function stepTraps(W, dt, playing) {
    const p = W.player;
    for (const t of W.traps) {
      if (t.type === 'pend') t.a = t.amp * Math.sin(W.clock * TAU / t.per + t.ph);
      else if (t.type === 'bar') t.a += t.spin * dt;
      else if (t.type === 'crush') {
        t.prevY = t.y; t.dx = 0;
        if (t.state === 'idle') {
          const below = p.y > t.y && p.y - t.y < TS * 10 && Math.abs(p.x + p.w / 2 - (t.x + t.w / 2)) < TS * 1.1;
          if (playing && !p.dead && below) { t.state = 'fall'; t.vy = 0; }
        } else if (t.state === 'fall') {
          t.vy = Math.min(900, t.vy + G * 1.2 * dt); t.y += t.vy * dt;
          const ty = Math.floor((t.y + t.h) / TS);
          const hit = isSolid(tile(W, Math.floor((t.x + 2) / TS), ty)) || isSolid(tile(W, Math.floor((t.x + t.w - 2) / TS), ty));
          if (hit || t.y > W.h * TS) {
            if (hit) t.y = ty * TS - t.h;
            t.state = 'wait'; t.wait = .8;
            W.shake = Math.max(W.shake, .22);
            burst(W, t.x + t.w / 2, t.y + t.h, 14, ['#8F81AB', '#D9D0F0'], 160, 400, 3);
            ring(W, t.x + t.w / 2, t.y + t.h, 40, '217,208,240');
            W.emit('slam');
          }
        } else if (t.state === 'wait') { if ((t.wait -= dt) <= 0) t.state = 'rise'; }
        else if ((t.y -= 70 * dt) <= t.oy) { t.y = t.oy; t.state = 'idle'; }
        t.dy = t.y - t.prevY;
      }
    }
  }
  function trapHit(W, p) {
    for (const t of W.traps) {
      if (t.type === 'pend') {
        const b = LF.pendBall(t);
        if (circleHits(b.x, b.y, 12, p)) return true;
        // A spiked chain hurts along its whole length.
        if (t.spiked && !(p.spiky > 1)) for (let k = 1; k < 14; k++) { const f = k / 14; if (circleHits(t.ax + (b.x - t.ax) * f, t.ay + (b.y - t.ay) * f, 4, p)) return true; }
      }
      else if (t.type === 'bar') { for (const b of LF.barBalls(t)) if (circleHits(b.x, b.y, 5, p)) return true; }
      // Crushers: only the spiked underside hurts. The top is a platform and the sides are solid.
      else if (p.onPlat !== t && overlap(p, { x: t.x + 3, y: t.y + t.h - 6, w: t.w - 6, h: 12 })) return true;
    }
    return false;
  }

  // ---------- the horde ----------
  // A wall of shadows that advances at a steady pace (right, or up for a rising horde), so
  // you can outrun it. It can't be shot or blocked, and a touch kills you even through a
  // shield. h.f is its front measured along the chase: x for right, -y for up.
  LF.HORDES = {
    '&': { name: 'Horde →', speed: 80, note: 'a wall of shadows that chases you right from this column' },
    '%': { name: 'Horde ↑', speed: 64, note: 'a wall of shadows that rises up after you from this row' },
  };
  // At level start and after every respawn it sits this far behind you, then pauses briefly.
  const HORDE_BACK = TS * 4, HORDE_WAIT = .5;
  const along = LF.hordeAlong = (h, x, y) => h.up ? -y : x;
  const playerAlong = (h, p) => along(h, p.x + p.w / 2, p.y + p.h / 2);
  const hordeLimit = (W, h) => (h.up ? -1 : 1) * W.def.hordeStop * TS;
  function stepHorde(W, dt, playing) {
    const h = W.horde, p = W.player;
    if (!h || !playing || W.cleared || p.dead) return;
    if (h.dormant) {
      if (p.x < W.def.arenaX * TS) return;
      h.dormant = false; h.f = playerAlong(h, p) - HORDE_BACK; h.wait = HORDE_WAIT;
    }
    if ((h.wait -= dt) > 0) return;
    h.f += LF.HORDES[h.c].speed * tune(W.def.tuning, h.c).speed * dt;
    // In a boss level the horde stops at hordeStop (a column, or a row for a rising horde),
    // so it hems you into the arena, and it never takes the boss.
    if (W.def.hordeStop != null) h.f = Math.min(h.f, hordeLimit(W, h));
    for (const e of W.enemies) if (e.alive && !isBoss(e) && along(h, e.x + e.w, e.y) < h.f - 10) e.alive = false;
    const gap = playerAlong(h, p) - h.f;
    if (gap < TS * 5 && (h.growl -= dt) <= 0) { h.growl = .9 + gap / TS * .2; W.emit('growl'); W.shake = Math.max(W.shake, .05); }
  }
  function hordeCaught(W, p) {
    if (!W.horde || p.inv > 0 || playerAlong(W.horde, p) > W.horde.f) return false;
    p.shield = 0; p.inv = 0; kill(W);
    return true;
  }

  // ---------- keys & locked doors ----------
  // Touching a locked door with its key opens just the block you touched.
  function unlock(W, gate, sx, sy, fx, fy) {
    W.unlocking.push({ tx: sx, ty: sy, gate, t: .1 });
    W.tiles[sy][sx] = gate + '*';
    W.floaters.push({ x: sx * TS + 16, y: sy * TS - 6, t: 'unlocked', life: .9, c: LF.KEYS[LF.GATES[gate]].color });
    W.emit('unlock');
  }
  function stepUnlocking(W, dt) {
    for (const u of W.unlocking) {
      if ((u.t -= dt) > 0) continue;
      W.tiles[u.ty][u.tx] = ' ';
      const k = LF.KEYS[LF.GATES[u.gate]];
      burst(W, u.tx * TS + 16, u.ty * TS + 16, 10, [k.color, '#FFF1CF'], 120, 200, 2.5);
      W.emit('gatepop');
    }
    W.unlocking = W.unlocking.filter(u => u.t > 0);
  }

  function stepShingle(W, pl, dt) {
    pl.t += dt;
    if (pl.state === 'shake' && pl.t > (pl.big ? .9 : .4)) { pl.state = 'fall'; pl.t = 0; pl.vy = 0; W.emit('crumble'); }
    else if (pl.state === 'fall') {
      pl.vy = Math.min(700, pl.vy + G * .6 * dt); pl.dy = pl.vy * dt; pl.y += pl.dy;
      if (pl.y > W.h * TS + 40 || pl.t > 2.5) { pl.state = 'gone'; pl.t = 0; }
    } else if (pl.state === 'gone' && pl.t > 3 && !pl.once) {
      const box = { x: pl.ox, y: pl.oy - 4, w: pl.w, h: pl.h + 4 };
      if (W.player.dead || !overlap(W.player, box)) { pl.state = 'idle'; pl.y = pl.prevY = pl.oy; pl.t = 0; }
    }
  }

  function stepCrumbles(W, dt) {
    const p = W.player;
    for (const c of W.crumbles) {
      c.t += dt;
      if (c.state === 'shake' && c.t > .45) {
        c.state = 'gone'; c.t = 0; W.tiles[c.ty][c.tx] = 'c';
        burst(W, c.tx * TS + 16, c.ty * TS + 16, 8, ['#8F81AB', '#5E5173'], 80, 600, 4);
        W.emit('crumble');
      } else if (c.state === 'gone' && c.t > 3.2) {
        const box = { x: c.tx * TS, y: c.ty * TS, w: TS, h: TS };
        if (p.dead || !overlap(p, box)) { W.tiles[c.ty][c.tx] = 'C'; c.state = 'done'; }
      }
    }
    W.crumbles = W.crumbles.filter(c => c.state !== 'done');
  }

  // Walkers turn at stop markers, and at false walls (l) so they don't give them away.
  function turnMarker(W, tx, ty) { const c = tile(W, tx, ty); return c === '|' || c === 'l'; }

  // Ground enemies fall when there's nothing under them (placed in mid-air, or their floor
  // crumbled or blinked away), and die if they land in water or lava or leave the level.
  const WALKERS = new Set(['B', 'K', 'R', 'I', 'S', 'A', '@', 'ĸ']);
  // The Shellback's shell: how long it lies still before it climbs back out, and how fast
  // it shoots along once kicked.
  const SHELL_WAIT = 5, SHELL_SPEED = 430;
  // A Shellback lost into the void comes back to where it started this many seconds later; for
  // the last SHELL_WARN of them its spot shows a warning (render.js).
  const SHELL_BACK = 2, SHELL_WARN = 1.5;
  // A shell flying off the top of a slope: up at its speed times LAUNCH_BASE + LAUNCH_ROW for
  // every row it climbed (no more than LAUNCH_MAX).
  const LAUNCH_BASE = .9, LAUNCH_ROW = .35, LAUNCH_MAX = 1.9;
  LF.SHELL_WARN = SHELL_WARN;
  // A stomp on a Shellback or its shell in mid-air (flying off the top of a slope, or off a
  // ledge): how hard you spring up off it. That's the shell jump: throw a shell at a wall, get
  // ahead of it while it's away, and as it comes back and flies off a slope, stomp it in the air.
  const AIR_STOMP = 720;
  function supported(W, e) {
    const s = slopeUnder(W, e);
    if (s && s.y - (e.y + e.h) < 14) return true;
    const ty = Math.floor((e.y + e.h + 1) / TS);
    for (let tx = Math.floor((e.x + 2) / TS); tx <= Math.floor((e.x + e.w - 2) / TS); tx++) if (isFloor(tile(W, tx, ty))) return true;
    return false;
  }

  function stepEnemy(W, e, dt, playing) {
    e.t += dt;
    if (isBoss(e)) {
      // Raging walkers and flyers rampage round the arena instead of their usual routine;
      // the rest keep to it, faster.
      if (e.fury > 0 && furyKind(e)) return furyMove(W, e, dt);
      if (e.fury > 0) stepBoss(W, e, dt * .3, playing);
      return stepBoss(W, e, dt, playing);
    }
    // (TNT carts take stomps one at a time, like golems.)
    if (e.type === '@') { e.hurt = Math.max(0, e.hurt - dt); e.stompCool = Math.max(0, e.stompCool - dt); }
    if (WALKERS.has(e.type) && e.state !== 'carried' && e.state !== 'away') {
      if (!supported(W, e) || e.vy < 0) {
        // (A Shellback's shell, kicked, flies on off the ledge as it falls.)
        if (e.type === 'ĸ' && e.state === 'spin') shellSlide(W, e, dt);
        // (In water it sinks slowly, as you do, and walks on along the bottom: water never
        // drowns an enemy.)
        const wet = tile(W, Math.floor((e.x + e.w / 2) / TS), Math.floor((e.y + e.h / 2) / TS)) === '~';
        e.vy = wet ? Math.min(SINK * 2, (e.vy || 0) + G * WATER_G * .5 * dt) : Math.min(MAXFALL, (e.vy || 0) + G * dt);
        const hit = moveY(W, e, e.vy * dt, false);
        if (hit && hit.dir === 'down') e.vy = 0;
        if (hit && hit.dir === 'up') e.vy = 0;
        onSlope(W, e, false);
        // (A Shellback lost into the void comes back where it started, after a warning: see
        // SHELL_BACK. Anything else that falls out, or into lava, is gone.)
        if (e.type === 'ĸ' && e.y > W.h * TS + 40 && e !== W.player.carrying) Object.assign(e, { state: 'away', back: SHELL_BACK, phased: true, vx: 0, vy: 0 });
        else if (e.y > W.h * TS + 40 || hazardHit(W, e, true)) e.alive = false;
        return;
      }
      e.vy = 0;
      onSlope(W, e, true);
    }
    const p = W.player;
    const px = p.x + p.w / 2, py = p.y + p.h / 2, ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    switch (e.type) {
      case 'B': case 'K': case '@': {
        e.hurt = Math.max(0, e.hurt - dt);
        walk(W, e, dt);
        break;
      }
      case 'ĸ': {
        // The Shellback: walks like a beetle; stomped, it's a shell lying still (SHELL_WAIT
        // seconds, then it climbs back out and walks on); kicked, the shell shoots along
        // (see shellSlide), flying on off ledges as it falls.
        e.stompCool = Math.max(0, e.stompCool - dt);
        // Gone into the void: back where it started when its time's up (real seconds), walking.
        if (e.state === 'away') {
          if ((e.back -= dt / (ENEMY_SPEED * tune(W.def.tuning, e.type).speed)) <= 0) {
            Object.assign(e, { state: 'walk', phased: false, x: e.ox, y: e.oy, vx: -44, vy: 0, stompCool: .5 });
            burst(W, e.x + e.w / 2, e.y + e.h / 2, 14, ['#7FD8B4', '#E8DDB5', '#FFFFFF'], 140, 100);
            W.emit('hop');
          }
          break;
        }
        // Carried (see stepPlayer): held out in front of you; it can't come out of its shell,
        // and it knocks out whatever it touches. Put down when you let go, or die.
        if (e.state === 'carried') {
          if (p.carrying !== e || p.dead) { e.state = 'shell'; e.shellT = SHELL_WAIT; e.vx = 0; if (p.carrying === e) p.carrying = null; break; }
          e.x = p.x + p.w / 2 + p.face * 15 - e.w / 2; e.y = p.y + p.h - e.h - 4; e.face = p.face;
          // (Whatever it runs into goes down, golems and TNT carts too (a boss takes one hit),
          // and the shell breaks. Not what you're stomping, though: that's an ordinary stomp.)
          const stomping = o => p.vy > 0 && p.y + p.h - o.y < 18 && overlap(p, o);
          const o = W.enemies.find(o => o !== e && o.alive && !o.phased && overlap(e, o) && !stomping(o));
          if (o) {
            if (!(isBoss(o) && o.fury > 0)) { if (isBoss(o)) o.shelled = true; W.emit('stomp', { type: o.type }); shootEnemy(W, o, p.face, null, isBoss(o) ? 'shell' : 'KO', isBoss(o) ? 1 : 999); }
            e.alive = false; p.carrying = null;
            burst(W, e.x + e.w / 2, e.y + e.h / 2, 14, ['#2E7D66', '#7FD8B4', '#E8DDB5'], 160, 400);
            W.floaters.push({ x: e.x + e.w / 2, y: e.y - 8, t: 'the shell breaks', life: .9, c: '#9FF0C8' });
          }
          break;
        }
        if (e.state === 'shell') {
          // (Lying on a slope, it slides off down it, shooting along like a kicked one.)
          const sl = slopeUnder(W, e);
          if (sl && sl.y - (e.y + e.h) < 4) { e.state = 'spin'; e.vx = sl.down * 80; W.floaters.push({ x: ex, y: e.y - 8, t: 'it slides!', life: .8, c: '#9FF0C8' }); break; }
          // (Real seconds, whatever pace the level's enemies keep.)
          if ((e.shellT -= dt / (ENEMY_SPEED * tune(W.def.tuning, e.type).speed)) <= 0) { e.state = 'walk'; e.vx = 44 * (e.face || -1); W.floaters.push({ x: ex, y: e.y - 8, t: 'it’s back out!', life: .8, c: '#9FF0C8' }); }
          break;
        }
        if (e.state === 'spin') { shellSlide(W, e, dt); break; }
        walk(W, e, dt);
        break;
      }
      case 'X': {
        // Hang, drop on the player, wait, climb back up the thread.
        if (e.state === 'idle') {
          e.y = e.oy + Math.sin(e.t * 2) * 2;
          const below = py > ey && py - ey < TS * 8 && Math.abs(px - ex) < TS * 1.3;
          if (playing && !p.dead && below) { e.state = 'drop'; W.emit('drop'); }
        } else if (e.state === 'drop') {
          e.y += 420 * dt;
          const ty = Math.floor((e.y + e.h) / TS), tx = Math.floor(ex / TS);
          if (isFloor(tile(W, tx, ty)) || e.y - e.oy > TS * 8) { e.y = Math.min(e.y, ty * TS - e.h); e.state = 'wait'; e.wait = .7; }
        } else if (e.state === 'wait') {
          if ((e.wait -= dt) <= 0) e.state = 'climb';
        } else if ((e.y -= 90 * dt) <= e.oy) { e.y = e.oy; e.state = 'idle'; }
        break;
      }
      case 'R': {
        // Walk; when the player is level and ahead, wind up, then charge until a wall or edge, then rest.
        const f = Math.sign(e.vx) || e.face;
        if (e.state === 'idle') {
          const seen = playing && !p.dead && Math.abs(py - ey) < TS * .9 && Math.abs(px - ex) < TS * 7 && Math.sign(px - ex) === f;
          if (seen) { e.state = 'wind'; e.wait = .4; W.emit('snort'); }
        } else if (e.state === 'wind') {
          if ((e.wait -= dt) <= 0) { e.state = 'charge'; e.vx = f * 280; }
        } else if (e.state === 'rest') {
          if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.vx = -f * 40; }
          break;
        }
        if (e.state === 'wind') { e.face = f; break; }
        const nx = e.x + e.vx * dt;
        const tx = Math.floor((e.vx < 0 ? nx : nx + e.w) / TS);
        const tyBody = Math.floor((e.y + e.h - 1) / TS), below = tile(W, tx, Math.floor((e.y + e.h + 2) / TS));
        if (isSolid(tile(W, tx, tyBody)) || turnMarker(W, tx, tyBody) || !isFloor(below)) {
          if (e.state === 'charge') {
            e.state = 'rest'; e.wait = .9; e.vx = f * 40;
            if (isSolid(tile(W, tx, tyBody))) { W.shake = Math.max(W.shake, .1); burst(W, e.vx > 0 ? e.x + e.w : e.x, ey, 8, ['#8F81AB', '#FF6B3D'], 100, 300, 2); }
          } else e.vx *= -1;
        } else e.x = nx;
        e.face = Math.sign(e.vx) || e.face;
        // Charging, it bowls over any enemy in its way: an ordinary one's knocked out, a tough
        // one (a golem, a cart) takes a hit each charge; another ram's left be, and a boss
        // stops it.
        if (e.state === 'charge') for (const o of W.enemies) {
          if (o === e || !o.alive || o.phased || o.type === 'R' || !overlap(e, o)) continue;
          if (isBoss(o)) { e.state = 'rest'; e.wait = .9; e.vx = -f * 40; W.shake = Math.max(W.shake, .1); break; }
          if (!e.charge) e.charge = newShot(W);
          shootEnemy(W, o, f, e.charge, 'KO', o.hp > 1 ? 1 : 999);
        }
        if (e.state !== 'charge') e.charge = 0;
        break;
      }
      case 'W': {
        // Hover, lock on, dash at where the player was, drift home.
        e.hurt = Math.max(0, e.hurt - dt);
        if (e.state === 'idle') {
          e.x += (e.ox - e.x) * Math.min(1, dt * 2); e.y += (e.oy + Math.sin(e.t * 4) * 6 - e.y) * Math.min(1, dt * 3);
          e.face = Math.sign(px - ex) || e.face;
          e.cool -= dt;
          if (e.cool <= 0 && playing && !p.dead && Math.hypot(px - ex, py - ey) < TS * 6) { e.state = 'aim'; e.wait = .5; e.tx = px; e.ty = py; W.emit('buzz'); }
        } else if (e.state === 'aim') {
          e.tx = px; e.ty = py;
          if ((e.wait -= dt) <= 0) {
            const d = Math.hypot(e.tx - ex, e.ty - ey) || 1;
            e.vx = (e.tx - ex) / d * 340; e.vy = (e.ty - ey) / d * 340; e.state = 'dash'; e.wait = .8;
          }
        } else if (e.state === 'dash') {
          e.x += e.vx * dt; e.y += e.vy * dt; e.face = Math.sign(e.vx) || e.face;
          if ((e.wait -= dt) <= 0 || isSolid(tile(W, Math.floor((e.x + e.w / 2) / TS), Math.floor((e.y + e.h / 2) / TS)))) { e.state = 'idle'; e.cool = 1.4; }
        }
        break;
      }
      case 'A': {
        e.cool -= dt;
        const d = px - ex, dy = py - ey, dist = Math.hypot(d, dy);
        if (dist < TS * 10) e.face = Math.sign(d) || e.face;
        if (e.cool <= 0 && playing && !p.dead && dist < TS * 10) {
          e.cool = 2.4;
          const sp = 210, ax = ex + e.face * 10, ay = e.y + 8;
          const n = Math.hypot(px - ax, py - ay) || 1;
          W.projectiles.push({ kind: 'arrow', x: ax - 5, y: ay - 5, w: 10, h: 6, vx: (px - ax) / n * sp, vy: (py - ay) / n * sp, life: 5 });
          W.emit('bow');
        }
        break;
      }
      case 'I': {
        e.hurt = Math.max(0, e.hurt - dt); e.stompCool = Math.max(0, e.stompCool - dt);
        const nx = e.x + e.vx * dt;
        const tx = Math.floor((e.vx < 0 ? nx : nx + e.w) / TS);
        const tyBody = Math.floor((e.y + e.h - 1) / TS), below = tile(W, tx, Math.floor((e.y + e.h + 2) / TS));
        if (isSolid(tile(W, tx, tyBody)) || turnMarker(W, tx, tyBody) || !isFloor(below)) e.vx *= -1;
        else e.x = nx;
        e.face = Math.sign(e.vx);
        if (Math.floor(e.t * 1.6) !== Math.floor((e.t - dt) * 1.6) && Math.abs(px - ex) < TS * 8) { W.shake = Math.max(W.shake, .06); }
        break;
      }
      case 'Y': {
        // Stays in the water: turns where the water (or a stop marker) ends.
        const nx = e.x + e.vx * dt;
        const tx = Math.floor((e.vx < 0 ? nx : nx + e.w) / TS), row = Math.floor((e.oy + e.h / 2) / TS);
        const c = tile(W, tx, row);
        if (c !== '~' || turnMarker(W, tx, row)) e.vx *= -1;
        else e.x = nx;
        e.y = e.oy + Math.sin(e.t * 2.5) * 3;
        e.face = Math.sign(e.vx);
        break;
      }
      case 'U': {
        // Bob up and down, but stop at the water's surface and bottom.
        e.y = Math.max(e.minY, Math.min(e.maxY, e.oy + Math.sin(e.t * 1.1) * 44));
        e.x = e.ox + Math.sin(e.t * .5) * 6;
        break;
      }
      case 'N': {
        // Wait under the surface, then leap toward the player in an arc.
        if (e.state === 'idle') {
          e.y = e.oy + Math.sin(e.t * 3) * 2;
          if ((e.wait -= dt) <= 0 && playing && !p.dead && Math.abs(px - ex) < TS * 7) {
            e.state = 'leap'; e.vy = -680; e.vx = Math.sign(px - ex) * 70 || 0; e.face = Math.sign(e.vx) || e.face;
            W.emit('leap');
          }
        } else {
          // Falling back: splash down wherever it meets water and stay there;
          // land on anything solid (or fall out of the level) and it dies.
          e.vy += G * .8 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.vy > 0) {
            const cx = e.x + e.w / 2, tx = Math.floor(cx / TS);
            if (tile(W, tx, Math.floor((e.y + e.h / 2) / TS)) === '~') {
              e.ox = e.x; e.oy = e.y; e.vx = 0; e.state = 'idle'; e.wait = 1.8;
              burst(W, cx, e.y, 6, ['#7FB0E0', '#D9D0F0'], 70, 300, 2);
            } else if (isSolid(tile(W, tx, Math.floor((e.y + e.h) / TS))) || e.y > W.h * TS) {
              e.alive = false;
              burst(W, cx, e.y + e.h / 2, 12, ['#A9B8C8', '#7C8C9E', '#D9E2EC'], 120, 400, 2.5);
              W.emit('flop');
            }
          }
        }
        break;
      }
      case '*': {
        // Rest just under the lava, then rise slowly about 5.5 tiles, hang at the top for
        // half a second, and sink back in.
        if (e.state === 'idle') {
          e.y = e.oy;
          if ((e.wait -= dt) <= 0) { e.state = 'up'; e.vy = -640; burst(W, ex, e.oy, 8, LF.WARM, 110, 300, 2); W.emit('bubble'); }
        } else if (e.state === 'hang') {
          e.y = e.hangY + Math.sin(e.t * 12) * 1.5;
          if ((e.wait -= dt) <= 0) { e.state = 'down'; e.vy = 0; }
        } else {
          e.vy += G * .55 * dt; e.y += e.vy * dt;
          if (e.state === 'up' && e.vy >= 0) { e.state = 'hang'; e.wait = .5 * ENEMY_SPEED; e.hangY = e.y; e.vy = 0; break; }
          if (Math.random() < .5) W.particles.push({ x: ex + (Math.random() - .5) * 8, y: e.y + e.h, vx: 0, vy: 20, life: .35, max: .35, c: LF.WARM[Math.floor(Math.random() * 3)], size: 2.5, g: 0 });
          if (e.vy > 0 && e.y >= e.oy) {
            e.y = e.oy; e.state = 'idle'; e.wait = 2 + Math.floor(e.ox / TS) % 3 * .6;
            burst(W, ex, e.oy, 10, LF.WARM, 130, 400, 2.5);
          }
        }
        break;
      }
      case 'Z': {
        const a = e.t * 2.4, r = 46;
        e.x = e.ox + Math.cos(a) * r; e.y = e.oy + Math.sin(a) * r;
        if (Math.random() < .3) W.particles.push({ x: e.x + 7, y: e.y + 7, vx: 0, vy: 0, life: .25, max: .25, c: '#FFB547', size: 2, g: 0 });
        break;
      }
      case 'F': {
        const nx = e.x + e.vx * dt;
        const tx = Math.floor((e.vx < 0 ? nx : nx + e.w) / TS), row = Math.floor((e.oy + e.h / 2) / TS);
        const far = Math.abs(nx - e.ox) > TS * 4 && Math.sign(nx - e.ox) === Math.sign(e.vx);
        if (isSolid(tile(W, tx, row)) || turnMarker(W, tx, row) || far) e.vx *= -1;
        else e.x = nx;
        // (In a level of stomp chains, def.batChain, they bob only a little, so a chain holds.)
        e.y = e.oy + Math.sin(e.t * 3) * (W.def.batChain ? 3 : 14);
        e.face = Math.sign(e.vx);
        break;
      }
      case 'J': {
        e.vy = Math.min(MAXFALL, e.vy + G * dt);
        if (moveX(W, e, e.vx * dt)) e.vx = 0;
        const hit = moveY(W, e, e.vy * dt, false);
        if (hit && hit.dir === 'down') { e.vy = 0; e.vx = 0; e.ground = true; }
        else { if (hit && hit.dir === 'up') e.vy = 0; e.ground = false; }
        if (e.ground) {
          e.wait -= dt;
          if (e.wait <= 0 && playing && !p.dead && Math.abs(px - ex) < TS * 8 && Math.abs(py - ey) < TS * 5) {
            const d = Math.sign(px - ex) || 1;
            e.face = d; e.vx = d * 130; e.vy = -560; e.wait = 1.2; e.ground = false;
            W.emit('hop');
          }
        }
        if (e.y > W.h * TS + 40 || hazardHit(W, e, true)) e.alive = false;
        break;
      }
      case 'S': {
        e.cool -= dt;
        const d = px - ex;
        if (Math.abs(d) < TS * 11) e.face = Math.sign(d) || e.face;
        if (e.cool <= 0 && playing && !p.dead && Math.abs(d) < TS * 11 && Math.abs(py - ey) < TS * 2.5) {
          // Fireball settings from the editor: shotSpeed, fireRate and shotSize (all 1 by default).
          const t = tune(W.def.tuning, 'S'), r = 5 * (t.shotSize ?? 1);
          e.cool = 2.3 / (t.fireRate ?? 1);
          W.projectiles.push({ x: ex + e.face * (7 + r) - r, y: e.y + 9 - r, w: r * 2, h: r * 2, vx: e.face * 175 * (t.shotSpeed ?? 1), life: 6, ember: e });
          W.emit('spit');
        }
        break;
      }
      case 'G': {
        let tx = 0, ty = 0;
        if (playing && !p.dead) {
          const dx = px - ex, dy = py - ey, dist = Math.hypot(dx, dy) || 1;
          if (dist < TS * 10) { tx = dx / dist * 44; ty = dy / dist * 44; }
        } else { tx = (e.ox - e.x) * .8; ty = (e.oy - e.y) * .8; }
        let fear = 0;
        for (const l of W.lanterns) {
          if (!l.lit) continue;
          const lx = ex - l.x, ly = ey - l.y, ld = Math.hypot(lx, ly) || 1;
          if (ld < 170) { const push = (170 - ld) / 170 * 170; tx += lx / ld * push; ty += ly / ld * push; fear = Math.max(fear, (170 - ld) / 170); }
        }
        e.vx += (tx - e.vx) * Math.min(1, dt * 2);
        e.vy += (ty - e.vy) * Math.min(1, dt * 2);
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.face = Math.sign(e.vx) || e.face;
        e.fade += (fear - e.fade) * Math.min(1, dt * 4);
        break;
      }
    }
  }

  // A walker on its way: on along the floor (up and down slopes), turning at walls, edges and
  // stop markers.
  function walk(W, e, dt) {
    const nx = e.x + e.vx * dt, ahead = e.vx < 0 ? nx : nx + e.w, tx = Math.floor(ahead / TS);
    const tyBody = Math.floor((e.y + e.h - 1) / TS), below = tile(W, tx, Math.floor((e.y + e.h + 2) / TS));
    if (turnMarker(W, tx, tyBody) || (!isFloor(below) && !isFloor(tile(W, tx, tyBody)) && !slopeUnder(W, e))) e.vx *= -1;
    else if (moveX(W, e, e.vx * dt)) e.vx *= -1;
    else onSlope(W, e, true);
    e.face = Math.sign(e.vx);
  }
  // A kicked Shellback shell sliding along (on the ground or flying off a ledge): it turns
  // back off walls and knocks out any enemy it runs into (a boss takes a hit and turns it
  // back). On a
  // slope it speeds up going down, goes all the way up one at no less than SHELL_SPEED, and
  // flies off the top; on the flat it settles back to SHELL_SPEED.
  function shellSlide(W, e, dt) {
    const sl = slopeUnder(W, e), grounded = !(e.vy < 0) && (sl ? sl.y - (e.y + e.h) < 4 : supported(W, e));
    const uphill = !!(sl && grounded && Math.sign(e.vx) === -sl.down);
    if (sl && grounded && Math.sign(e.vx || sl.down) === sl.down) e.vx += sl.down * 700 * dt;
    else if (grounded) e.vx = Math.sign(e.vx || 1) * approach(Math.abs(e.vx), SHELL_SPEED, 260 * dt);
    // (Over the top of a slope it was going up, it flies up off it, and comes down again.)
    // (How high it flies goes with how high the slope was: a lip of one row gives a little hop,
    // a ramp of two a big leap, and taller ones a little more again.)
    if (uphill && !e.climbing) e.climbFrom = e.y + e.h;
    if (e.climbing && !uphill && grounded) {
      const rows = Math.max(1, Math.round(((e.climbFrom ?? e.y + e.h) - (e.y + e.h)) / TS));
      e.vy = -Math.abs(e.vx) * Math.min(LAUNCH_MAX, LAUNCH_BASE + LAUNCH_ROW * rows); W.emit('hop');
    }
    e.climbing = uphill;
    e.vx = Math.max(-620, Math.min(620, e.vx));
    if (moveX(W, e, e.vx * dt)) {
      // (What it hit: a switch block flips the switch.)
      const fx = e.vx > 0 ? Math.floor((e.x + e.w + 1) / TS) : Math.floor((e.x - 1) / TS);
      for (const ty of [Math.floor(e.y / TS), Math.floor((e.y + e.h - 1) / TS)]) if (tile(W, fx, ty) === '§') { hitSwitch(W, fx, ty); break; }
      e.vx *= -1; W.emit('clank');
    }
    if (grounded && !(e.vy < 0)) onSlope(W, e, true);
    // A gap just one block wide under its middle: it drops into it (it doesn't skim over),
    // still spinning, and goes on bouncing about wherever it lands (off the gap's sides, or
    // along the floor it comes down on).
    // (Narrower than the gap, it has nothing under it there: so this is looked at whenever it's
    // level with the floor, not only when it's standing on it.)
    const cx = Math.floor((e.x + e.w / 2) / TS), row = Math.floor((e.y + e.h + 2) / TS);
    if (!sl && !(e.vy < 0) && e.y + e.h - row * TS > -8) {
      if (!isFloor(tile(W, cx, row)) && isFloor(tile(W, cx - 1, row)) && isFloor(tile(W, cx + 1, row)) && !isSolid(tile(W, cx, row - 1))) {
        e.x = cx * TS + (TS - e.w) / 2; e.y += 2; e.vy = Math.max(e.vy || 0, 160); W.emit('clank');
      }
    }
    shellHits(W, e, Math.sign(e.vx));
  }
  // What a shell (kicked or carried) hits: any enemy it runs into is knocked out (a boss takes
  // a hit, as from a stomp, none while it rages, and a kicked shell bounces back off it).
  function shellHits(W, e, sgn) {
    for (const o of W.enemies) {
      if (o === e || !o.alive || o.phased || !overlap(e, o)) continue;
      // (Two shells both shooting along meet: they smash each other, and both are gone.)
      if (e.state === 'spin' && o.type === 'ĸ' && o.state === 'spin') {
        for (const q of [e, o]) { q.alive = false; burst(W, q.x + q.w / 2, q.y + q.h / 2, 16, ['#2E7D66', '#7FD8B4', '#E8DDB5'], 200, 400); }
        ring(W, (e.x + o.x) / 2 + e.w / 2, e.y + e.h / 2, 40, '159,240,200', .4);
        W.floaters.push({ x: (e.x + o.x) / 2 + e.w / 2, y: e.y - 10, t: 'crash!', life: .9, c: '#9FF0C8' });
        W.shake = Math.max(W.shake, .25); W.emit('clank');
        return;
      }
      if (isBoss(o)) {
        const dir = Math.sign(o.x - e.x || 1);
        if (!(o.fury > 0) && W.clock - (o.shellHitAt ?? -9) > .6) {
          o.shellHitAt = W.clock; o.shelled = true; W.shake = Math.max(W.shake, .2);
          W.floaters.push({ x: o.x + o.w / 2, y: o.y - 10, t: 'shell hit!', life: .9, c: '#9FF0C8' });
          W.emit('stomp', { type: o.type });
          shootEnemy(W, o, dir, null, 'shell');
        }
        if (e.state === 'spin') { e.vx = -dir * SHELL_SPEED; e.x -= dir * 6; }
        continue;
      }
      // (Anything that isn't a boss goes down to one shell, golems and TNT carts too.)
      if (!e.shot) e.shot = newShot(W);
      shootEnemy(W, o, sgn, e.shot, 'KO', 999);
    }
    if (e.state === 'spin') e.face = Math.sign(e.vx);
  }

  // ---------- bosses ----------
  function startFury(W, e) {
    if (W.def.finalChase && e.type === 'Ω+' && e.hp === 1) return startChase(W, e);
    e.fury = FURY; e.furyHit = .5; e.furyN = 0; e.dazed = 0;
    // One stomp left: the last fury, with the boss's signature move.
    e.finale = e.hp === 1 && FINALE[e.type] ? FINALE[e.type] : null;
    if (e.finale) W.floaters.push({ x: e.x + e.w / 2, y: e.y - 40, t: `FINAL FURY: ${e.finale[0]}!`, life: 2.4, c: '#FFB547' });
    if (e.wait > .3) e.wait = .3;
    W.floaters.push({ x: e.x + e.w / 2, y: e.y - 22, t: 'FURY!', life: 1.4, c: '#FF4D3D' });
    W.shake = Math.max(W.shake, .3); W.emit('roar');
  }
  // The Last Dark's last stand: one stomp from the end, it grows to three times its size,
  // the arena's far wall breaks open, and it comes after you, through anything, faster the
  // further behind it falls. Touch it and you're done for. At the end of the run waits a
  // TNT cart: touch that and it rolls back into the Last Dark and blows it apart.
  function startChase(W, e) {
    e.chase = { t: 0, x: e.x + e.w / 2, y: e.y + e.h / 2 }; e.phased = true; e.k = 1;
    e.fury = 0; e.dazed = 0; e.rest = 0; W.chasing = true;
    for (const [x, y] of W.chaseGate || []) { W.tiles[y][x] = ' '; burst(W, x * TS + 16, y * TS + 16, 6, ['#8F81AB', '#463C6B', '#FF6B3D'], 160, 300, 3); }
    W.floaters.push({ x: e.x + e.w / 2, y: e.y - 40, t: 'THE LAST DARK GROWS… RUN →', life: 3, c: '#FF4D3D' });
    W.shake = Math.max(W.shake, .8); W.emit('roar'); W.emit('unlock');
  }
  function stepChase(W, e, dt) {
    const c = e.chase, p = W.player, px = p.x + p.w / 2, py = p.y + p.h / 2;
    c.t += dt; e.k = Math.min(3, 1 + c.t * 1.3);
    if (c.t > 1.6 && !p.dead) c.x += Math.max(170, Math.min(420, 170 + (px - c.x - TS * 9) * 1.2)) * dt;
    c.y += (Math.min(py, (W.h - 2) * TS - e.h * e.k / 2) - c.y) * Math.min(1, dt * 2);
    e.x = c.x - e.w / 2; e.y = c.y - e.h / 2; e.face = 1;
    if (Math.random() < dt * 40) burst(W, c.x - e.w * e.k * .4, c.y + (Math.random() - .5) * e.h * e.k, 1, ['#463C6B', '#0E0C22', '#FF4D3D'], 80, -40, 4);
    const hw = e.w * e.k * .38, hh = e.h * e.k * .42;
    if (!p.dead && Math.abs(px - c.x) < hw + p.w / 2 && Math.abs(py - c.y) < hh + p.h / 2) kill(W);
  }
  function stepChaseCart(W, dt) {
    const k = W.chaseCart, p = W.player;
    if (!k || k.state === 'gone') return;
    if (k.state === 'idle') {
      if (p.dead || !overlap(p, k)) return;
      if (!W.chasing) { if (!W.floaters.some(f => f.t.startsWith('a TNT cart'))) W.floaters.push({ x: k.x + 14, y: k.y - 14, t: 'a TNT cart… save it for the Last Dark', life: 1.6, c: '#FFE2A8' }); return; }
      k.state = 'roll'; k.vx = -720; W.floaters.push({ x: k.x + 14, y: k.y - 14, t: 'GO!', life: 1.2, c: '#FFB547' }); W.emit('rocket');
      return;
    }
    k.x += k.vx * dt;
    if (Math.random() < .6) W.particles.push({ x: k.x + 28, y: k.y + 4, vx: 60, vy: -30, life: .3, max: .3, c: '#FFB547', size: 2.5, g: 0 });
    const e = W.enemies.find(b => b.alive && b.chase);
    if (e && Math.abs(k.x + 14 - e.chase.x) < e.w * e.k * .45 + 14) {
      k.state = 'gone'; W.chasing = false;
      const x = e.chase.x, y = e.chase.y;
      for (let n = 0; n < 6; n++) burst(W, x + (Math.random() - .5) * e.w * e.k, y + (Math.random() - .5) * e.h * e.k, 30, ['#FFF1CF', '#FFB547', '#FF6B3D', '#463C6B'], 360, 300, 5);
      ring(W, x, y, TS * 10, '255,181,71', .8); W.shake = 1.2; W.freeze = .2; W.emit('boom');
      W.floaters.push({ x, y: y - 60, t: 'KABOOM!', life: 2, c: '#FFB547' });
      e.hp = 0; e.alive = false; e.phased = false; e.chase = null; bossDown(W, e);
    } else if (k.x < 0) k.state = 'gone';
  }
  // Raging, the boss rampages round its arena: every FURY_EVERY seconds it does the next
  // thing in turn: a leap (walkers) or a dart (flyers) to somewhere new, a ring of embers,
  // patches of fire round your feet, a shower of rocks from the ceiling. Walkers slam down
  // where they land (shockwaves and falling rocks). Bosses fixed in place (pendulums, the
  // wheel, the crusher, hearts, swimmers) keep to their spot but still do all the rest.
  const FURY_FIXED = new Set(['E+', 'e+', 'f+', 'k+', '&+', '%+', '*+', 'U+', 'Y+', 'N+']);
  const furyKind = e => FURY_FIXED.has(e.type) ? null : e.type === '6' || e.type === 'Ω+' || LF.ENEMIES[e.type].fly ? 'fly' : 'leap';
  // The ceiling over a spot (the top of the open air above it), and the floor under it
  // (null if the drop ends in lava or water, or not at all).
  function ceilingOver(W, x, y) { const tx = Math.floor(x / TS); let ty = Math.floor(y / TS); while (ty > 0 && !isSolid(tile(W, tx, ty - 1))) ty--; return ty * TS; }
  function floorUnder(W, x, y) {
    const tx = Math.floor(x / TS);
    for (let ty = Math.max(0, Math.floor(y / TS)); ty < W.h; ty++) { const c = tile(W, tx, ty); if (c === '!' || c === '~') return null; if (isFloor(c)) return ty * TS; }
    return null;
  }
  const arenaRight = W => (W.w - 1) * TS;
  function rockRain(W, n, spread) {
    const p = W.player, px = p.x + p.w / 2;
    for (let k = 0; k < n; k++) {
      const x = Math.max(arenaLeft(W) + 8, Math.min(arenaRight(W) - 8, px + (k / Math.max(1, n - 1) * 2 - 1) * spread * TS + (Math.random() - .5) * TS));
      const top = ceilingOver(W, x, p.y);
      W.projectiles.push({ kind: 'rock', x: x - 7, y: top + 2, w: 14, h: 14, vx: 0, vy: 0, g: 600 + Math.random() * 400, life: 4 });
      burst(W, x, top + 2, 4, ['#8F81AB', '#5E5173'], 40, 200, 2);
    }
  }
  function fireAround(W) {
    const p = W.player;
    for (const d of [-2.5, 2.5]) {
      const x = p.x + p.w / 2 + d * TS, fy = floorUnder(W, x, p.y);
      if (fy == null || x < arenaLeft(W) || x > arenaRight(W)) continue;
      // A glowing warning on the floor first; the fire bursts up FLAME_WARN seconds later.
      W.projectiles.push({ kind: 'warn', x: x - 7, y: fy - 18, w: 14, h: 18, vx: 0, vy: 0, life: FLAME_WARN, max: FLAME_WARN, then: { kind: 'flame', x: x - 7, y: fy - 18, w: 14, h: 18, vx: 0, vy: 0, life: 2.4 } });
    }
  }
  const FLAME_WARN = .8;
  function emberRing(W, e) {
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, p = W.player, toP = Math.atan2(p.y + p.h / 2 - ey, p.x + p.w / 2 - ex);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * TAU, off = Math.abs(((a - toP) % TAU + TAU + Math.PI) % TAU - Math.PI);
      if (off < .8) continue;
      W.projectiles.push({ x: ex - 6, y: ey - 6, w: 12, h: 12, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 4 });
    }
  }
  // Leap somewhere new with floor under it: half the time near you, else across the arena.
  function furyLeap(W, e) {
    const p = W.player, px = p.x + p.w / 2, lo = arenaLeft(W) + TS, hi = arenaRight(W) - TS - e.w;
    if (hi <= lo) return;
    for (let k = 0; k < 16; k++) {
      const near = (e.furyN + k) % 3 === 0;
      const tx = Math.max(lo, Math.min(hi, near ? px - e.w / 2 + (Math.random() - .5) * TS * 6 : lo + Math.random() * (hi - lo)));
      if (Math.abs(tx - e.x) < TS * 3 || floorUnder(W, tx + e.w / 2, e.y) == null) continue;
      e.fjump = true; e.ground = false; e.vy = -1000; e.vx = Math.max(-650, Math.min(650, (tx - e.x) / .95));
      burst(W, e.x + e.w / 2, e.y + e.h, 14, ['#FF4D3D', '#9A8FBF'], 160, 300, 3);
      return;
    }
  }
  function furyDart(W, e) {
    const p = W.player, lo = arenaLeft(W) + TS, hi = arenaRight(W) - TS - e.w;
    if (hi <= lo) return;
    const top = ceilingOver(W, p.x + p.w / 2, p.y) + TS;
    e.ft = { x: lo + Math.random() * (hi - lo), y: Math.max(top, Math.min(p.y - e.h - TS * 2, top + Math.random() * TS * 3)) };
  }
  function furySlam(W, e) {
    shock(W, e, [[-1, 280], [1, 280]]);
    rockRain(W, 2, 4);
    ring(W, e.x + e.w / 2, e.y + e.h, e.w * 1.5, '255,77,61', .4);
    burst(W, e.x + e.w / 2, e.y + e.h, 20, ['#FF4D3D', '#FFB547', '#9A8FBF'], 220, 400, 3);
    W.shake = Math.max(W.shake, .45); W.emit('stomp', { type: e.type });
  }
  // Movement while raging, for bosses that leap or dart (instead of their usual routine).
  function furyMove(W, e, dt) {
    e.hurt = Math.max(0, e.hurt - dt); e.stompCool = Math.max(0, e.stompCool - dt);
    const p = W.player;
    e.face = Math.sign(p.x + p.w / 2 - (e.x + e.w / 2)) || e.face;
    if (e.y > W.h * TS + 40) { e.x = e.ox; e.y = e.oy; e.vx = e.vy = 0; e.fjump = false; }
    if (furyKind(e) === 'leap') {
      if (e.fjump && moveX(W, e, e.vx * dt)) e.vx = 0;
      e.x = Math.max(arenaLeft(W), Math.min(arenaRight(W) - e.w, e.x));
      const landed = bossFall(W, e, dt);
      if (e.fjump && landed) { e.fjump = false; e.vx = 0; furySlam(W, e); }
    } else if (e.ft) {
      const dx = e.ft.x - e.x, dy = e.ft.y - e.y, d = Math.hypot(dx, dy), sp = 560 * dt;
      if (d <= sp) {
        e.x = e.ft.x; e.y = e.ft.y; e.ft = null;
        // At the end of a dart it drops a bomb or three on you.
        for (const vx of [-70, 70]) W.projectiles.push({ kind: 'bomb', fury: true, x: e.x + e.w / 2 - 6, y: e.y + e.h, w: 12, h: 12, vx, vy: 60, g: 900, life: 3 });
      } else { e.x += dx / d * sp; e.y += dy / d * sp; }
    }
  }
  // The last fury (the one before the stomp that finishes a boss) adds the boss's own
  // signature move, every other beat. FINALE: name and what it does, by boss.
  const floorY = (W, x) => floorUnder(W, x, W.player.y) ?? W.player.y + W.player.h;
  const shot = (W, x, y, vx, vy, extra) => W.projectiles.push({ x: x - 6, y: y - 6, w: 12, h: 12, vx, vy, life: 5, ...extra });
  const warnAt = (W, x, then) => { const fy = floorY(W, x); W.projectiles.push({ kind: 'warn', x: x - 7, y: fy - 18, w: 14, h: 18, vx: 0, vy: 0, life: .8, max: .8, then: then(fy) }); };
  const acrossArena = (W, n, f) => { const lo = arenaLeft(W) + TS, hi = arenaRight(W) - TS; for (let k = 0; k < n; k++) f(lo + (k + .5) / n * (hi - lo), k); };
  const minionsNear = (W, e, type, n) => { for (let k = 0; k < n && minions(W) < 6; k++) spawnMinion(W, type, e.x + e.w / 2 + (k - (n - 1) / 2) * TS * 2, e.y + e.h - 4); };
  const FINALE = {
    '5': ['Stampede', (W, e) => { for (const d of [-1, 1]) if (minions(W) < 6) { const m = spawnMinion(W, 'R', d < 0 ? arenaLeft(W) + TS * 2 : arenaRight(W) - TS * 2, e.y + e.h - 4); m.face = -d; } }],
    '6': ['Ember Storm', (W) => { let k = 0; acrossArena(W, 10, x => shot(W, x, ceilingOver(W, x, W.player.y) + 8, 0, 60, { g: 300 + (k++ % 2) * 200 })); }],
    '7': ['Arrow Volley', (W) => { const px = W.player.x + W.player.w / 2; for (let k = -3; k <= 3; k++) { const x = px + k * TS * 1.5; W.projectiles.push({ kind: 'arrow', x: x - 5, y: ceilingOver(W, x, W.player.y) + 6, w: 10, h: 6, vx: 0, vy: 120 + Math.abs(k) * 30, g: 500, life: 5 }); } }],
    '8': ['Earthquake', (W, e) => { shock(W, e, [[-1, 320], [1, 320], [-1, 200], [1, 200]]); rockRain(W, 6, 7); W.shake = Math.max(W.shake, .8); }],
    '9': ['Cart Barrage', (W, e) => { for (const d of [-1, 1]) if (minions(W) < 6) { const m = spawnMinion(W, '@', e.x + e.w / 2 + d * e.w, e.y + e.h - 4); m.vx = d * 60; } }],
    'B+': ['Brood', (W, e) => minionsNear(W, e, 'B', 4)],
    'J+': ['Frog Rain', (W) => { const px = W.player.x + W.player.w / 2; for (const d of [-3, 0, 3]) if (minions(W) < 6) spawnMinion(W, 'J', px + d * TS, ceilingOver(W, px + d * TS, W.player.y) + 4); }],
    'W+': ['Swarm', (W, e) => minionsNear(W, e, 'W', 3)],
    'X+': ['Web Net', (W, e) => { const ex = e.x + e.w / 2; for (let k = -3; k <= 3; k++) W.projectiles.push({ kind: 'web', x: ex - 7, y: e.y + e.h, w: 14, h: 14, vx: k * 70, vy: 160, life: 4 }); }],
    'S+': ['Eruption', (W, e) => { const ex = e.x + e.w / 2; for (let k = -4; k <= 4; k++) shot(W, ex, e.y, k * 55, -520 - Math.abs(k) * 20, { g: 700 }); }],
    'K+': ['Thorn Burst', (W, e) => { const ex = e.x + e.w / 2; for (const d of [-1, 1]) for (const h of [10, 40]) shot(W, ex, e.y + e.h - h, d * 300, 0, { w: 16, h: 8 }); }],
    'U+': ['Glow Pulse', (W, e) => ring8(W, e.x + e.w / 2, e.y + e.h / 2, 16, 110)],
    'Z+': ['Spark Split', (W, e) => minionsNear(W, e, 'Z', 3)],
    'G+': ['Phantoms', (W, e) => minionsNear(W, e, 'G', 3)],
    'Y+': ['Geysers', (W) => { const px = W.player.x + W.player.w / 2; for (const d of [-4, -1.5, 1.5, 4]) warnAt(W, px + d * TS, fy => ({ x: px + d * TS - 10, y: fy - 20, w: 20, h: 20, vx: 0, vy: -560, g: 600, life: 1.6 })); }],
    'N+': ['Needle Rain', (W) => { const px = W.player.x + W.player.w / 2; for (let k = 0; k < 6; k++) { const x = px - TS * 6 + k * TS * 2; W.projectiles.push({ kind: 'arrow', x, y: ceilingOver(W, x, W.player.y) + 6, w: 10, h: 6, vx: 90, vy: 150, g: 300, life: 5 }); } }],
    '*+': ['Lava Tide', (W) => acrossArena(W, 7, (x, k) => { if (k % 2 === 0) warnAt(W, x, fy => ({ kind: 'flame', x: x - 7, y: fy - 18, w: 14, h: 18, vx: 0, vy: 0, life: 2.6 })); })],
    'E+': ['Bolas', (W) => { const y = W.player.y + W.player.h - 10; for (const d of [-1, 1]) shot(W, d < 0 ? arenaRight(W) - 10 : arenaLeft(W) + 10, y, -d * 260, 0, { w: 18, h: 18 }); }],
    'e+': ['Thorn Shards', (W) => acrossArena(W, 8, x => shot(W, x, ceilingOver(W, x, W.player.y) + 6, 0, 80, { g: 650, w: 10, h: 10 }))],
    'f+': ['Fire Spiral', (W, e) => { const ex = e.x + e.w / 2, ey = e.y + e.h / 2; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + (e.furyN || 0) * .4; shot(W, ex, ey, Math.cos(a) * (120 + k * 10), Math.sin(a) * (120 + k * 10)); } }],
    'k+': ['Ceiling Slam', (W) => { const gap = Math.floor(Math.random() * 9); acrossArena(W, 9, (x, k) => { if (Math.abs(k - gap) > 1) W.projectiles.push({ kind: 'rock', x: x - 7, y: ceilingOver(W, x, W.player.y) + 2, w: 14, h: 14, vx: 0, vy: 0, g: 700, life: 4 }); }); }],
    '&+': ['Dark Tide', (W) => { const y = W.player.y + W.player.h - 12; shot(W, arenaLeft(W) + 10, y, 230, 0, { kind: 'void', w: 14, h: 14 }); shot(W, arenaRight(W) - 10, y - TS * 2, -230, 0, { kind: 'void', w: 14, h: 14 }); }],
    '%+': ['Dark Tide', (W) => { const y = W.player.y + W.player.h - 12; shot(W, arenaLeft(W) + 10, y, 230, 0, { kind: 'void', w: 14, h: 14 }); shot(W, arenaRight(W) - 10, y - TS * 2, -230, 0, { kind: 'void', w: 14, h: 14 }); }],
    'Ω+': ['Eclipse', (W, e) => { W.dark = Math.min(.95, W.dark + .08); ring8(W, e.x + e.w / 2, e.y + e.h / 2, 20, 150); minionsNear(W, e, 'G', 2); }],
    'Ø+': ['Singularity', (W, e) => { const ex = e.x + e.w / 2, ey = e.y + e.h / 2; for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; const r = TS * 7; shot(W, ex + Math.cos(a) * r, ey + Math.sin(a) * r, -Math.cos(a) * 140 + Math.sin(a) * 60, -Math.sin(a) * 140 - Math.cos(a) * 60, { kind: 'void', w: 14, h: 14, life: 3 }); } }],
    'Γ+': ['Wax Flood', (W, e) => { e.flip = !e.flip; acrossArena(W, 8, (x, k) => { if (k % 2 === (e.flip ? 1 : 0)) warnAt(W, x, fy => ({ kind: 'flame', x: x - 7, y: fy - 18, w: 14, h: 18, vx: 0, vy: 0, life: 2.4 })); }); }],
    'Δ+': ['Bubble Storm', (W) => acrossArena(W, 9, x => W.projectiles.push({ kind: 'bubble', x: x - 8, y: floorY(W, x) - 18, w: 16, h: 16, vx: 0, vy: -70, life: 6 }))],
    'Ξ+': ['Gear Storm', (W) => { const y = floorY(W, W.player.x) - 20; for (const d of [-1, 1]) for (const k of [0, 1]) W.projectiles.push({ kind: 'gear', x: (d < 0 ? arenaRight(W) - 24 : arenaLeft(W) + 6) , y: y - k * TS * 2, w: 18, h: 18, vx: -d * (220 + k * 60), vy: 0, life: 5 }); }],
    'Λ+': ['Feather Gale', (W) => acrossArena(W, 10, x => W.projectiles.push({ kind: 'feather', x: x - 5, y: ceilingOver(W, x, W.player.y) + 6, w: 10, h: 10, vx: 60, vy: 120, g: 250, life: 5 }))],
    'Π+': ['Rat Swarm', (W) => { for (const d of [-1, 1]) for (const k of [0, 1]) if (minions(W) < 6) { const m = spawnMinion(W, 'B', d < 0 ? arenaLeft(W) + TS * (2 + k * 2) : arenaRight(W) - TS * (2 + k * 2), W.player.y); m.face = -d; } }],
    'Φ+': ['Pumpkin Patch', (W) => acrossArena(W, 5, x => W.projectiles.push({ kind: 'bomb', fury: true, x: x - 6, y: ceilingOver(W, x, W.player.y) + 8, w: 12, h: 12, vx: 0, vy: 0, g: 700, life: 4 }))],
    'Ψ+': ['Firestorm', (W, e) => { ring8(W, e.x + e.w / 2, e.y + e.h / 2, 16, 170); minionsNear(W, e, 'F', 2); }],
    'Σ+': ['Crystal Spikes', (W) => acrossArena(W, 7, x => warnAt(W, x, fy => ({ kind: 'crystal', x: x - 6, y: fy - 14, w: 12, h: 12, vx: 0, vy: -560, g: 900, life: 2 })))],
    'Ɱ+': ['Seed Storm', (W, e) => { const ex = e.x + e.w / 2; for (let k = -3; k <= 3; k++) W.projectiles.push({ kind: 'seed', x: ex - 4, y: e.y + 6, w: 8, h: 8, vx: k * 80, vy: -480 + Math.abs(k) * 30, g: 900, life: 3 }); }],
  };
  function stepFury(W, e, dt) {
    e.fury -= dt; e.dazed = 0;
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    if (Math.random() < dt * 30) burst(W, ex + (Math.random() - .5) * e.w, ey + (Math.random() - .5) * e.h, 1, ['#FF4D3D', '#FFB547'], 60, -80, 2.5);
    if (e.fury <= 0) {
      // Calming down: back to its usual routine, from the top.
      if (furyKind(e)) { e.fjump = false; e.ft = null; e.vx = 0; e.state = 'idle'; e.wait = FURY_REST; }
      e.rest = FURY_REST;
      W.floaters.push({ x: ex, y: e.y - 18, t: 'worn out!', life: 1.4, c: '#FFE2A8' });
      return;
    }
    e.furyHit -= dt;
    if (e.furyHit > 0) return;
    e.furyHit = FURY_EVERY; e.furyN++;
    if (e.finale && e.furyN % 2 === 0) { e.finale[1](W, e); ring(W, ex, ey, Math.max(e.w, e.h) * 1.4, '255,181,71', .5); W.shake = Math.max(W.shake, .3); W.emit('roar'); return; }
    const kind = furyKind(e), step = e.furyN % 4;
    if (step === 1) {
      if (kind === 'leap' && e.ground) furyLeap(W, e);
      else if (kind === 'fly') furyDart(W, e);
      else rockRain(W, 4, 5);
    } else if (step === 2) emberRing(W, e);
    else if (step === 3) fireAround(W);
    else rockRain(W, 4, 6);
    ring(W, ex, ey, Math.max(e.w, e.h), '255,77,61', .4);
    W.shake = Math.max(W.shake, .25);
  }
  function wakeBoss(W, e) {
    if (e.awake) return;
    e.awake = true; e.state = 'idle'; e.wait = e.type === '6' ? 3 : 1; e.cool = 1;
    W.shake = Math.max(W.shake, .35);
    W.floaters.push({ x: e.x + e.w / 2, y: e.y - 16, t: LF.ENEMIES[e.type].name, life: 2, c: '#FF6B3D' });
    W.emit('roar');
  }
  function bossDown(W, e) {
    const x = e.x + e.w / 2, y = e.y + e.h / 2;
    for (let k = 0; k < 4; k++) burst(W, x + (Math.random() - .5) * e.w, y + (Math.random() - .5) * e.h, 24, ['#FFF1CF', '#FFB547', '#FF6B3D', '#463C6B'], 300, 300, 4);
    ring(W, x, y, TS * 4, '255,181,71', .7);
    W.shake = Math.max(W.shake, .8); W.freeze = .15;
    W.floaters.push({ x, y: e.y - 18, t: `${LF.ENEMIES[e.type].name} falls!`, life: 2.2, c: '#FFB547' });
    W.projectiles = [];
    for (const c of W.enemies) if (c.summoned && c.alive) { c.alive = false; burst(W, c.x + c.w / 2, c.y + c.h / 2, 10, ['#8F81AB', '#463C6B'], 100, 300, 2); }
    // The heart of a horde takes the horde with it.
    if ((e.type === '&+' || e.type === '%+') && W.horde) {
      for (let k = 0; k < 6; k++) burst(W, x + (Math.random() - .5) * TS * 6, y + (Math.random() - .5) * TS * 6, 20, ['#463C6B', '#2A2348', '#FF6B3D'], 260, 100, 4);
      W.horde = null;
    }
    W.emit('bossdown', { type: e.type, shelled: !!e.shelled });
    if (W.def.bossEnds && !W.enemies.some(b => b.alive && isBoss(b))) W.endTimer = 1.6;
    // With the last boss down, the boss gates (g) crumble.
    if (!W.enemies.some(b => b.alive && isBoss(b))) {
      for (let ty = 0; ty < W.h; ty++) for (let tx = 0; tx < W.w; tx++) {
        if (W.tiles[ty][tx] !== 'g') continue;
        W.tiles[ty][tx] = ' ';
        burst(W, tx * TS + 16, ty * TS + 16, 8, ['#FF6B3D', '#7A2E1C', '#463C6B'], 150, 300, 2.5);
      }
    }
    openDoorIfDone(W);
  }
  // The door opens once every lantern is lit and no boss is left standing.
  function openDoorIfDone(W) {
    if (!W.door || W.door.open || W.def.bonusDoor || W.lanterns.some(l => !l.lit) || W.enemies.some(e => e.alive && isBoss(e))) return;
    W.door.open = true; W.emit('door');
  }
  // Gravity for bosses that walk. Returns the falling speed on the frame it lands, else 0.
  function bossFall(W, e, dt) {
    e.vy = Math.min(MAXFALL, e.vy + G * dt);
    const v = e.vy, hit = moveY(W, e, e.vy * dt, false);
    if (hit && hit.dir === 'down') { const landed = e.ground ? 0 : v; e.vy = 0; e.ground = true; return landed; }
    if (hit) e.vy = 0;
    e.ground = false;
    return 0;
  }
  // Minions a boss calls in. They vanish when the boss falls or you respawn.
  function spawnMinion(W, type, x, y) {
    const m = makeEnemy(type, Math.floor(x / TS), Math.floor(y / TS), W.def.tuning);
    m.summoned = true; W.enemies.push(m);
    burst(W, m.x + m.w / 2, m.y + m.h / 2, 10, ['#8F81AB', '#463C6B'], 100, 0, 2);
    return m;
  }
  const minions = W => W.enemies.filter(m => m.alive && m.summoned).length;
  // Is there floor just ahead of a walking boss's front foot?
  const groundAhead = (W, e, dir) => isFloor(tile(W, Math.floor((dir > 0 ? e.x + e.w + 2 : e.x - 2) / TS), Math.floor((e.y + e.h + 2) / TS)));
  // The Last Keg's minion waves draw from every kind of enemy.
  const WAVE = ['B', 'K', 'F', 'J', 'S', 'G', 'R', 'Z', 'W', 'A', 'I', 'X'];

  // Shockwaves from a boss's feet: list of [direction, speed].
  function shock(W, e, list) {
    for (const [d, sp] of list) W.projectiles.push({ kind: 'shock', x: e.x + e.w / 2 - 11 + d * e.w / 2, y: e.y + e.h - 16, w: 22, h: 16, vx: d * sp, vy: 0, life: 3 });
  }
  // A ring of embers flying out from a point.
  function ring8(W, x, y, n, sp) {
    for (let k = 0; k < n; k++) { const a = k / n * TAU; W.projectiles.push({ x: x - 6, y: y - 6, w: 12, h: 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 4 }); }
  }
  // The Fire Wheel's arms: rings of fireballs around its core.
  LF.wheelBalls = e => {
    if (!e.armsOn) return [];
    const out = [], arms = e.arms || 4, len = e.armLen || 6;
    for (let a = 0; a < arms; a++) for (let k = 0; k < len; k++) {
      const ang = e.ang + a / arms * TAU, r = 40 + k * 20;
      out.push({ x: e.x + e.w / 2 + Math.cos(ang) * r, y: e.y + e.h / 2 + Math.sin(ang) * r });
    }
    return out;
  };
  // Distance from point (x, y) to the segment a-b.
  const segDist = (x, y, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - ax - dx * t, y - ay - dy * t);
  };

  // Each arena's def.bossMode gives its fight a twist (see bosses.js).
  function stepBoss(W, e, dt, playing) {
    const p = W.player, px = p.x + p.w / 2, py = p.y + p.h / 2, ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const live = playing && !p.dead, rage = e.hp <= e.maxHp / 2, toward = Math.sign(px - ex) || e.face;
    const mode = W.def.bossMode;
    e.hurt = Math.max(0, e.hurt - dt); e.stompCool = Math.max(0, e.stompCool - dt); e.dazed = Math.max(0, (e.dazed || 0) - dt);
    if (e.y > W.h * TS + 40) { e.x = e.ox; e.y = e.oy; e.vx = e.vy = 0; }
    // Flyers, swimmers, hazards and hearts don't fall while they wait.
    const spec = LF.ENEMIES[e.type], grounded = !(e.type === '6' || spec.fly || (spec.special && !spec.giant) || 'UYN*'.includes(spec.giant || '-'));
    if (!e.awake) {
      if (grounded) bossFall(W, e, dt);
      // The pendulums swing and the wheel turns even before the fight starts.
      if (e.type === 'E+' || e.type === 'e+' || e.type === 'f+') stepGiant(W, e, dt, false, px, py, false, 1);
      // (Giants' arenas are wider, so they notice you from further off.)
      const range = spec.special ? 20 : 12;
      if (!live || Math.abs(px - ex) > TS * range || Math.abs(py - ey) > TS * 14) return;
      wakeBoss(W, e);
    }
    // Colossus Reborn: at half health it calls two golems and is armored until they fall.
    if (mode === 'armor' && rage && !e.armorCalled) {
      e.armorCalled = true;
      for (const d of [-1, 1]) spawnMinion(W, 'I', e.ox + d * TS * 8, e.y + e.h - 4).guard = true;
      W.floaters.push({ x: ex, y: e.y - 16, t: 'armored! break its golems', life: 2, c: '#CFC6E8' }); W.emit('clank');
    }
    e.armored = mode === 'armor' && W.enemies.some(m => m.alive && m.guard);
    if (spec.special) return stepGiant(W, e, dt, live, px, py, rage, toward);
    switch (e.type) {
      case '5': {
        // The Bellwether: plod toward you, wind up, charge until it hits a wall, then reel.
        bossFall(W, e, dt);
        if (e.state === 'idle') {
          e.face = toward;
          if (e.ground && groundAhead(W, e, e.face)) moveX(W, e, e.face * 55 * dt);
          if ((e.wait -= dt) <= 0 && live && e.ground) { e.state = 'wind'; e.wait = rage ? .45 : .7; W.emit('snort'); }
        } else if (e.state === 'wind') {
          if (!e.rebound) e.face = toward;
          if ((e.wait -= dt) <= 0) { e.state = 'charge'; e.wait = 3; }
        } else if (e.state === 'charge') {
          if (Math.random() < .5) W.particles.push({ x: ex - e.face * e.w / 2, y: e.y + e.h - 2, vx: -e.face * 60, vy: -40, life: .4, max: .4, c: '#8F81AB', size: 3, g: 100 });
          // The Last Charge: it leaves a trail of fire.
          if (mode === 'fire' && (e.trail = (e.trail || 0) - dt) <= 0) {
            e.trail = .1;
            W.projectiles.push({ kind: 'flame', x: ex - 7, y: e.y + e.h - 18, w: 14, h: 18, vx: 0, vy: 0, life: 2.2 });
          }
          if (moveX(W, e, e.face * (rage ? 520 : 420) * dt) || (e.wait -= dt) <= 0) {
            e.state = 'stun'; e.wait = (rage ? 1.4 : 1.8) * DAZE;
            W.shake = Math.max(W.shake, .35); W.emit('slam');
            burst(W, e.face > 0 ? e.x + e.w : e.x, ey, 18, ['#CFC6E8', '#FFB547', '#8F81AB'], 200, 300, 3);
            // The Bell Pit: the slam shakes beetles down from the ceiling.
            if (mode === 'beetles' && minions(W) < 4) for (let k = 0; k < 2; k++) spawnMinion(W, 'B', ex - e.face * TS * (2 + k * 3), TS * 2);
            // The Thunder Fold: on the ice it bounces off and charges straight back once.
            if (mode === 'ice' && !e.rebound) { e.rebound = true; e.state = 'wind'; e.wait = .35; e.face = -e.face; }
            else e.rebound = false;
          }
        } else if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? .8 : 1.3; }
        break;
      }
      case '6': {
        // The Soot Queen: sweep back and forth overhead dropping embers, then swoop at you,
        // rest on the ground for a moment (stomp her!) and fly back up.
        const hx = e.ox + Math.sin(e.t * .7) * TS * 9, hy = e.oy + Math.sin(e.t * 1.4) * 18;
        if (e.state === 'idle' || e.state === 'fly') {
          e.state = 'fly'; e.face = toward;
          e.x += (hx - e.x) * Math.min(1, dt * 2); e.y += (hy - e.y) * Math.min(1, dt * 2);
          if ((e.cool -= dt) <= 0 && live) {
            e.cool = rage ? .55 : .9; W.emit('spit');
            // The Blackened Sky: embers fall three at a time, fanning out.
            for (const vx of mode === 'storm' ? [-90, 0, 90] : [0]) W.projectiles.push({ x: ex - 5, y: e.y + e.h - 4, w: 10, h: 10, vx, vy: 230, life: 4 });
          }
          if ((e.wait -= dt) <= 0 && live) { e.state = 'aim'; e.wait = .6; W.emit('buzz'); }
        } else if (e.state === 'aim') {
          e.face = toward; e.y -= 30 * dt;
          if ((e.wait -= dt) <= 0) {
            const d = Math.hypot(px - ex, py - ey) || 1;
            e.vx = (px - ex) / d * 460; e.vy = (py - ey) / d * 460; e.state = 'swoop'; e.wait = 1.4;
          }
        } else if (e.state === 'swoop') {
          // She dives straight through planks and only stops at solid ground.
          const side = moveX(W, e, e.vx * dt), hit = moveY(W, e, e.vy * dt, true);
          if ((hit && hit.dir === 'down') || (e.wait -= dt) <= 0 || side) {
            e.state = 'rest'; e.wait = (rage ? 1.2 : 1.7) * DAZE; e.vx = e.vy = 0; e.ground = false;
            W.shake = Math.max(W.shake, .2); W.emit('slam');
          }
        } else if (e.state === 'rest') {
          bossFall(W, e, dt);
          if ((e.wait -= dt) <= 0) {
            e.state = 'rise';
            // The Soot Nest: she calls a soot bat as she takes off.
            if (mode === 'bats' && minions(W) < 3) spawnMinion(W, 'F', ex, e.oy + TS * 2);
          }
        } else {
          e.y -= 170 * dt; e.x += (hx - e.x) * Math.min(1, dt);
          if (e.y <= hy) { e.state = 'fly'; e.wait = rage ? 3.5 : 5; }
        }
        break;
      }
      case '7': {
        // The Ash Marksman: fire a fan of arrows, again, then leap somewhere new.
        const land = bossFall(W, e, dt);
        // Hollow Range: he fades out (and can't be hit) while he leaps and just after.
        e.phased = mode === 'fade' && (e.state === 'leap' || e.state === 'vanish');
        if (e.state === 'leap') {
          moveX(W, e, e.vx * dt);
          if (land) { e.state = mode === 'fade' ? 'vanish' : 'idle'; e.wait = mode === 'fade' ? .9 : .6; e.vx = 0; W.shake = Math.max(W.shake, .12); }
          break;
        }
        if (e.state === 'vanish') { if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = .5; } break; }
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        e.moves = (e.moves || 0) + 1;
        if (e.moves % 3 === 0) {
          // The Archery Loft: he keeps to his own bank of the pool.
          const spread = mode === 'lifts' ? 5 : 10;
          const tx = e.ox + (Math.random() * 2 - 1) * TS * spread;
          e.vx = Math.max(-420, Math.min(420, (tx - e.x) / .9)); e.vy = -760; e.ground = false; e.state = 'leap'; W.emit('hop');
        } else if (mode === 'rain' && e.moves % 3 === 2) {
          // The Final Volley: arrows loosed high that come down around you.
          for (let k = 0; k < (rage ? 7 : 5); k++) {
            const t = 1.1 + Math.random() * .3, g = 700, tx = px + (k - 2) * 40;
            W.projectiles.push({ kind: 'arrow', x: ex - 5, y: e.y - 6, w: 10, h: 6, vx: (tx - ex) / t, vy: (py - e.y) / t - g * t / 2, g, life: 5 });
          }
          e.wait = 1.4; W.emit('bow');
        } else {
          const n = rage ? 5 : 3, ax = ex + e.face * 14, ay = e.y + 14, base = Math.atan2(py - ay, px - ax);
          for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * .16;
            W.projectiles.push({ kind: 'arrow', x: ax - 5, y: ay - 3, w: 10, h: 6, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, life: 5 });
          }
          e.wait = rage ? .9 : 1.3; W.emit('bow');
        }
        break;
      }
      case '8': {
        // The Iron Colossus: lumber toward you, crouch, leap at you, and land with shockwaves
        // that run along the floor both ways (two pairs once it's angry).
        const land = bossFall(W, e, dt);
        const waves = list => shock(W, e, list);
        if (land > 300) {
          W.shake = Math.max(W.shake, .45); W.emit('slam');
          burst(W, ex, e.y + e.h, 20, ['#8F81AB', '#CFC6E8'], 220, 300, 3);
          waves(rage ? [[-1, 300], [1, 300], [-1, 190], [1, 190]] : [[-1, 300], [1, 300]]);
          // The Iron Quarry: the landing shakes rocks down from the ceiling around you.
          if (mode === 'quarry') for (let k = 0; k < 4; k++) W.projectiles.push({ kind: 'rock', x: px + (Math.random() * 2 - 1) * TS * 6 - 7, y: TS + 4, w: 14, h: 14, vx: 0, vy: 0, g: 700 + Math.random() * 300, life: 4 });
          e.state = 'idle'; e.wait = rage ? 2.2 : 3.2;
          // Landed in lava? It heaves itself straight back out toward its spot.
          if (tile(W, Math.floor(ex / TS), Math.floor((e.y + e.h - 4) / TS)) === '!') {
            e.state = 'leap'; e.vy = -820; e.ground = false; e.vx = Math.max(-220, Math.min(220, (e.ox - e.x) * 1.1));
          }
        }
        if (e.state === 'leap') { moveX(W, e, e.vx * dt); break; }
        e.face = toward;
        if (e.state === 'idle') {
          if (e.ground && groundAhead(W, e, e.face)) moveX(W, e, e.face * 45 * dt);
          // The Anvil Floor: it pounds the ground as it walks, sending small waves.
          if (mode === 'anvil' && e.ground && (e.cool -= dt) <= 0) {
            e.cool = rage ? 1.2 : 1.8; W.shake = Math.max(W.shake, .15); W.emit('slam');
            waves([[-1, 220], [1, 220]]);
          }
          if ((e.wait -= dt) <= 0 && live && e.ground) { e.state = 'crouch'; e.wait = .5; }
        } else if (e.state === 'crouch' && (e.wait -= dt) <= 0) {
          e.state = 'leap'; e.vy = -820; e.ground = false; e.vx = Math.max(-220, Math.min(220, (px - ex) * 1.1)); W.emit('hop');
        }
        break;
      }
      case '9': {
        // The Powder King: paces near his spot, lobs bombs (two, or three once angry) aimed
        // where you're heading, sends out TNT carts every other move (up to three at once),
        // and every fourth move leaps to land near you with shockwaves, making that his new spot.
        // In his last third of health the bombs become bouncing grenades.
        const land = bossFall(W, e, dt);
        e.face = toward;
        if (e.state === 'leap') {
          moveX(W, e, e.vx * dt);
          if (land) {
            shock(W, e, rage ? [[-1, 300], [1, 300], [-1, 190], [1, 190]] : [[-1, 280], [1, 280]]);
            W.shake = Math.max(W.shake, .35); W.emit('slam');
            e.state = 'idle'; e.ox = e.x; e.wait = .6;
          }
          break;
        }
        if (e.ground) {
          const dir = e.dir || -1;
          if (!groundAhead(W, e, dir) || moveX(W, e, dir * 60 * dt) || Math.abs(e.x - e.ox) > TS * 5) e.dir = -dir;
        }
        // The Last Keg: every few seconds he calls in another kind of enemy.
        if (mode === 'waves' && live && (e.cool -= dt) <= 0) {
          e.cool = rage ? 5 : 7;
          if (minions(W) < 4) {
            const type = WAVE[(e.wave = ((e.wave ?? -1) + 1) % WAVE.length)];
            const fly = 'FGWZ'.includes(type), x = e.ox + (Math.random() < .5 ? -1 : 1) * TS * (4 + Math.random() * 6);
            spawnMinion(W, type, x, fly ? e.y - TS * 3 : type === 'X' ? TS * 2 : e.y + e.h - 4);
            W.floaters.push({ x: ex, y: e.y - 10, t: 'to me!', life: 1, c: '#FF6B3D' });
          }
        }
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        e.moves = (e.moves || 0) + 1;
        const carts = W.enemies.filter(c => c.alive && c.summoned && c.type === '@').length;
        if (e.moves % 4 === 0) {
          const tx = px + (Math.random() < .5 ? -1 : 1) * TS * 3;
          e.state = 'leap'; e.vy = -850; e.ground = false; e.vx = Math.max(-420, Math.min(420, (tx - ex) / .9));
          W.emit('hop');
        } else if (e.moves % 2 === 1 && carts < 3) {
          const c = spawnMinion(W, '@', ex, e.y + e.h - 4);
          c.hp = c.maxHp = 3; c.vx = toward * 110;
          W.floaters.push({ x: ex, y: e.y - 10, t: 'TNT!', life: 1, c: '#FF6B3D' });
          e.wait = 1.1; W.emit('snort');
        } else if (e.hp <= e.maxHp / 3) {
          // Down to his last third: bouncing grenades instead of bombs.
          for (let k = 0; k < 2; k++) {
            const t = .9 + k * .25, g = 900, tx = px + W.player.vx * t * .6 + (k ? toward * 60 : 0);
            W.projectiles.push({ kind: 'kgrenade', x: ex - 5, y: e.y - 10, w: 10, h: 10, vx: (tx - ex) / t, vy: (py - e.y) / t - g * t / 2, g, life: 5, bounces: 0 });
          }
          e.wait = .9; W.emit('lob');
        } else {
          const n = rage ? 3 : 2, pvx = W.player.vx;
          for (let k = 0; k < n; k++) {
            const t = .85 + k * .2, g = 900, tx = px + pvx * t * .8 + (k - (n - 1) / 2) * 44;
            // The Fuse Hall: bombs leave fire. The Blasting Court: bombs split in three.
            W.projectiles.push({ kind: 'bomb', x: ex - 6, y: e.y - 6, w: 12, h: 12, vx: (tx - ex) / t, vy: (py - e.y) / t - g * t / 2, g, life: 4, burn: mode === 'fuse', cluster: mode === 'cluster' });
          }
          e.wait = rage ? .8 : 1.1; W.emit('lob');
        }
        break;
      }
    }
  }

  // The castle keepers. Each works through its own round of moves (acts), and each has a
  // moment it's dazed and open to a stomp: the Candle King melts after a hop, the crab gets
  // stuck in a wall, the knight winds down, the roc and the dragon land to rest, the Rat
  // King sits back on his throne, the Pumpkin Knight reels after every other leap, and the
  // mole is stunned when it bursts back up out of the floor.
  const reducedBob = e => Math.sin(e.t * 2) * 6;
  const KEEPERS = new Set(['Γ+', 'Δ+', 'Ξ+', 'Λ+', 'Π+', 'Φ+', 'Ψ+', 'Σ+', 'Θ+', 'Ж+']);
  function stepKeeper(W, e, dt, live, px, py, rage, toward) {
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, fast = rage ? 1.25 : 1, fly = LF.ENEMIES[e.type].fly;
    const daze = (t, state = 'dazed') => { e.state = state; e.dazed = e.wait = t * DAZE; };
    const lo = arenaLeft(W), hi = arenaRight(W) - e.w;
    const clampX = () => { e.x = Math.max(lo, Math.min(hi, e.x)); };
    const land = fly ? 0 : bossFall(W, e, dt);
    const lob = (kind, n, spread, extra) => { for (let k = 0; k < n; k++) W.projectiles.push({ kind, x: ex - 6, y: e.y + 8, w: 12, h: 12, vx: toward * (120 + k * spread), vy: -460 - (k % 2) * 60, g: 900, life: 3.5, ...extra }); };
    const leap = () => { e.state = 'leap'; e.vy = -800; e.ground = false; e.vx = Math.max(-280, Math.min(280, (px - ex) * 1.2)); W.emit('jump'); };
    const next = acts => acts[(e.moves = (e.moves || 0) + 1) % acts.length];
    // (Fliers: rest on the floor below, then rise back up to where they hover.)
    if (fly) {
      if (e.state === 'descend') {
        const hit = moveY(W, e, 320 * dt, false);
        if (hit && hit.dir === 'down') { W.shake = Math.max(W.shake, .3); W.emit('slam'); burst(W, ex, e.y + e.h, 16, ['#CFC6E8', '#9A8FBF'], 160, 300, 3); daze(2, 'tired'); W.floaters.push({ x: ex, y: e.y - 14, t: 'it’s resting!', life: 1.2, c: '#FFE2A8' }); }
        return;
      }
      if (e.state === 'tired') { if ((e.wait -= dt) <= 0) e.state = 'ascend'; return; }
      if (e.state === 'ascend') { e.y -= 200 * dt; if (e.y <= e.oy) { e.y = e.oy; e.state = 'idle'; e.wait = .8 / fast; } return; }
    }
    // (Walkers: a leap lands with a shockwave each way.)
    if (e.state === 'leap') {
      moveX(W, e, e.vx * dt); clampX();
      if (land) {
        shock(W, e, rage ? [[-1, 300], [1, 300], [-1, 180], [1, 180]] : [[-1, 260], [1, 260]]); W.shake = Math.max(W.shake, .35); W.emit('slam');
        e.leaps = (e.leaps || 0) + 1;
        if (e.type === 'Γ+') { daze(1.6, 'melted'); W.floaters.push({ x: ex, y: e.y - 14, t: 'it’s melting!', life: 1.2, c: '#FFE2A8' }); }
        else if (e.type === 'Φ+' && e.leaps % 2 === 0) { daze(1.8, 'dizzy'); W.floaters.push({ x: ex, y: e.y - 14, t: 'dizzy!', life: 1.2, c: '#FFE2A8' }); }
        else { e.state = 'idle'; e.wait = .8 / fast; }
      }
      return;
    }
    if (e.dazed > 0 && e.state !== 'idle') { if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = .7 / fast; } return; }
    switch (e.type) {
      case 'Γ+': {
        // The Candle King: a great living candle. Flings wax, sets the floor alight round
        // you (marked first), and hops at you, melting a little when he lands.
        e.face = toward;
        if (e.ground) moveX(W, e, toward * 50 * fast * dt), clampX();
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const act = next(['wax', 'flare', 'hop', 'wax', 'hop']);
        if (act === 'wax') { lob('wax', 3, 70); e.wait = 1.2 / fast; W.emit('spit'); }
        else if (act === 'flare') { fireAround(W); warnAt(W, px, fy => ({ kind: 'flame', x: px - 7, y: fy - 18, w: 14, h: 18, vx: 0, vy: 0, life: 2.2 })); e.wait = 1.4 / fast; W.emit('roar'); }
        else leap();
        break;
      }
      case 'Δ+': {
        // The Lighthouse Crab: scuttles sideways at you till it slams into a wall (and sticks
        // there a moment), blows bubbles that drift at you, and snaps forward with a claw.
        if (e.state === 'scuttle' || e.state === 'snap') {
          if ((e.state === 'snap' && (e.wait -= dt) <= 0)) { e.state = 'idle'; e.wait = .9 / fast; break; }
          if (moveX(W, e, e.vx * dt) || e.x <= lo + 1 || e.x >= hi - 1) {
            clampX();
            if (e.state === 'scuttle') {
              W.shake = Math.max(W.shake, .45); W.emit('slam'); rockRain(W, 3, 5);
              burst(W, ex + Math.sign(e.vx) * e.w / 2, ey, 18, ['#E5484D', '#FFE2A8'], 200, 400, 3);
              e.vx = 0; daze(1.8, 'stuck'); W.floaters.push({ x: ex, y: e.y - 14, t: 'stuck!', life: 1.2, c: '#FFE2A8' });
            } else { e.state = 'idle'; e.wait = .9 / fast; }
          }
          break;
        }
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const act = next(['scuttle', 'bubbles', 'snap', 'scuttle', 'bubbles']);
        if (act === 'scuttle') { e.state = 'scuttle'; e.vx = toward * 380 * fast; W.emit('snort'); }
        else if (act === 'snap') { e.state = 'snap'; e.vx = toward * 520 * fast; e.wait = .35; W.emit('snort'); }
        else { for (let k = 0; k < 5; k++) W.projectiles.push({ kind: 'bubble', x: ex - 8, y: e.y + 6, w: 16, h: 16, vx: toward * (50 + k * 25), vy: -30 - k * 18, life: 5.5 }); e.wait = 1.4 / fast; W.emit('spit'); }
        break;
      }
      case 'Ξ+': {
        // The Clockwork Knight: marches at you, rolls gears along the floor, leaps, and every
        // so often runs down and has to wind himself up again.
        e.face = toward;
        if (e.ground) moveX(W, e, toward * 70 * fast * dt), clampX();
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const act = next(['gears', 'leap', 'gears', 'wind']);
        if (act === 'gears') { for (const sp of [260, 170]) W.projectiles.push({ kind: 'gear', x: ex - 9, y: e.y + e.h - 20, w: 18, h: 18, vx: toward * sp * fast, vy: 0, life: 4 }); e.wait = 1.1 / fast; W.emit('clank'); }
        else if (act === 'leap') leap();
        else { daze(2, 'winding'); W.floaters.push({ x: ex, y: e.y - 14, t: 'winding down…', life: 1.4, c: '#FFE2A8' }); }
        break;
      }
      case 'Λ+':
      case 'Ψ+': {
        // The Storm Roc: hovers over you, drops feathers, swoops low across the arena, and lands
        // to rest. The Smog Dragon: hovers, sweeps a stream of fire across the floor, calls soot
        // bats, and lands to catch its breath.
        const roc = e.type === 'Λ+';
        if (e.state === 'swoop') {
          e.st += dt; const T = 1.5, fy = floorY(W, ex) - e.h - 6;
          e.x = e.sx + e.dir * e.st * 380 * fast; clampX();
          e.y = e.oy + Math.sin(Math.min(1, e.st / T) * Math.PI) * Math.max(0, fy - e.oy);
          if (e.st >= T) { e.y = e.oy; e.state = 'idle'; e.wait = .8 / fast; }
          break;
        }
        if (e.state === 'breath') {
          e.st += dt;
          if ((e.bt -= dt) <= 0) { e.bt = .09; const a = Math.PI / 2 - e.dir * (1 - e.st / 1.3) * 1.1; shot(W, ex + e.dir * e.w * .4, e.y + e.h * .7, Math.cos(a) * 300, Math.sin(a) * 300, { life: 3 }); }
          if (e.st >= 1.3) { e.state = 'idle'; e.wait = 1 / fast; }
          break;
        }
        // Hover over you, bobbing.
        const tx = Math.max(lo, Math.min(hi, px - e.w / 2));
        e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 90 * fast * dt);
        e.y += (e.oy + Math.sin(e.t * 2.4) * 8 - e.y) * Math.min(1, dt * 3);
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live) break;
        const act = next(roc ? ['feathers', 'swoop', 'feathers', 'swoop', 'land'] : ['breath', 'bats', 'breath', 'land']);
        if (act === 'feathers') { for (let k = -2; k <= 2; k++) W.projectiles.push({ kind: 'feather', x: ex - 5 + k * 14, y: e.y + e.h - 6, w: 10, h: 10, vx: k * 50, vy: 240, g: 150, life: 4 }); e.wait = 1.1 / fast; W.emit('spit'); }
        else if (act === 'swoop') { e.state = 'swoop'; e.st = 0; e.sx = e.x; e.dir = (ex < (lo + hi + e.w) / 2) ? 1 : -1; W.emit('roar'); }
        else if (act === 'breath') { e.state = 'breath'; e.st = 0; e.bt = 0; e.dir = toward; W.emit('roar'); }
        else if (act === 'bats') { minionsNear(W, e, 'F', 2); e.wait = 1.2 / fast; }
        else { e.state = 'descend'; }
        break;
      }
      case 'Π+': {
        // The Rat King: dashes at you, sweeps his tail (shockwaves both ways), and calls his
        // rats (beetles, here) before sitting back on his throne to watch.
        if (e.state === 'dash') {
          if ((e.wait -= dt) <= 0 || moveX(W, e, e.vx * dt) || e.x <= lo + 1 || e.x >= hi - 1) { clampX(); e.vx = 0; e.state = 'idle'; e.wait = .7 / fast; }
          break;
        }
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const act = next(['dash', 'sweep', 'dash', 'summon']);
        if (act === 'dash') { e.state = 'dash'; e.vx = toward * 430 * fast; e.wait = .75; W.emit('snort'); }
        else if (act === 'sweep') { shock(W, e, [[-1, 300], [1, 300]]); W.shake = Math.max(W.shake, .3); W.emit('slam'); e.wait = 1 / fast; }
        else { if (minions(W) < 4) for (const d of [-1, 1]) spawnMinion(W, 'B', ex + d * e.w * .8, e.y + e.h - 4); daze(2, 'throne'); W.floaters.push({ x: ex, y: e.y - 14, t: 'he sits back…', life: 1.2, c: '#FFE2A8' }); }
        break;
      }
      case 'Φ+': {
        // The Pumpkin Knight: lobs pumpkin bombs (their landing spots marked) and leaps at you;
        // every other landing leaves him dizzy.
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const act = next(['bombs', 'leap', 'bombs', 'leap']);
        if (act === 'bombs') {
          for (const off of [-TS * 2, TS * 2]) { const t = 1.1, g = 900, tx = px + off; W.projectiles.push({ kind: 'bomb', fury: true, x: ex - 6, y: e.y - 6, w: 12, h: 12, vx: (tx - ex) / t, vy: (py - e.y) / t - g * t / 2, g, life: 4 }); }
          e.wait = 1.2 / fast; W.emit('lob');
        } else leap();
        break;
      }
      case 'Θ+':
      case 'Ж+': {
        // The sunken keepers swim about their flooded hall after you. The Drowned King charges
        // across the hall and is stunned when he rams a wall; he blows rings of bubbles and
        // calls pike. The Tide Serpent surges along in waves, rams the walls the same way,
        // and blows bubbles that drift at you.
        const king = e.type === 'Θ+';
        if (e.state === 'ram') {
          if (moveX(W, e, e.vx * dt) || e.x <= lo + 1 || e.x >= hi - 1) {
            clampX(); W.shake = Math.max(W.shake, .45); W.emit('slam');
            burst(W, ex + Math.sign(e.vx) * e.w / 2, ey, 18, ['#9FD8FF', '#FFFFFF'], 200, 100, 3);
            e.vx = 0; daze(1.9, 'stunned'); W.floaters.push({ x: ex, y: e.y - 14, t: 'stunned!', life: 1.2, c: '#FFE2A8' });
          }
          if (!king) e.y = e.ry + Math.sin(e.st * 6) * TS * 1.2, e.st += dt;
          break;
        }
        // Swim toward you, slowly (and keep in the hall).
        const tx = Math.max(lo, Math.min(hi, px - e.w / 2)), ty = Math.max(TS * 2, Math.min((W.h - 3) * TS - e.h, py - e.h / 2));
        e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 55 * fast * dt);
        e.y += Math.sign(ty - e.y) * Math.min(Math.abs(ty - e.y), 45 * fast * dt) + (reducedBob(e) * dt);
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live) break;
        const act = next(king ? ['ram', 'rings', 'ram', 'pike'] : ['ram', 'bubbles', 'ram', 'bubbles']);
        if (act === 'ram') { e.state = 'ram'; e.vx = toward * (king ? 360 : 300) * fast; e.ry = e.y; e.st = 0; W.emit('snort'); }
        else if (act === 'rings') { for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; W.projectiles.push({ kind: 'bubble', x: ex - 8, y: ey - 8, w: 16, h: 16, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 4 }); } e.wait = 1.4 / fast; W.emit('spit'); }
        else if (act === 'pike') { if (minions(W) < 3) for (const d of [-1, 1]) spawnMinion(W, 'Y', ex + d * e.w, ey); e.wait = 1.2 / fast; }
        else { for (let k = 0; k < 5; k++) W.projectiles.push({ kind: 'bubble', x: ex - 8, y: ey - 8, w: 16, h: 16, vx: toward * (40 + k * 25), vy: (k - 2) * 25, life: 5 }); e.wait = 1.2 / fast; W.emit('spit'); }
        break;
      }
      case 'Σ+': {
        // The Crystal Mole: throws crystal shards, and burrows: it slips under the floor (you
        // can't touch it there), tunnels under you, and bursts up (the spot glows first),
        // spraying shards, stunned for a moment by the light.
        if (e.state === 'under') {
          e.phased = true;
          const tx = Math.max(lo, Math.min(hi, px - e.w / 2));
          e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 300 * fast * dt);
          if (Math.random() < .5) burst(W, ex, e.y + e.h, 2, ['#7FB0E0', '#5E5173'], 90, 300, 2);
          if ((e.wait -= dt) <= 0) { e.state = 'rising'; e.wait = .8; warnAt(W, ex, fy => ({ kind: 'crystal', x: ex - 6, y: fy - 14, w: 12, h: 12, vx: 0, vy: -520, g: 900, life: 2 })); }
          break;
        }
        if (e.state === 'rising') {
          if ((e.wait -= dt) <= 0) {
            e.phased = false;
            for (let k = -3; k <= 3; k++) if (k) W.projectiles.push({ kind: 'crystal', x: ex - 6, y: e.y, w: 12, h: 12, vx: k * 70, vy: -520 + Math.abs(k) * 40, g: 900, life: 3 });
            W.shake = Math.max(W.shake, .35); W.emit('slam'); daze(1.8, 'stunned'); W.floaters.push({ x: ex, y: e.y - 14, t: 'stunned!', life: 1.2, c: '#FFE2A8' });
          }
          break;
        }
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const act = next(['shards', 'burrow', 'shards', 'burrow']);
        if (act === 'shards') { lob('crystal', 4, 55); e.wait = 1.1 / fast; W.emit('spit'); }
        else { e.state = 'under'; e.wait = 1.3; burst(W, ex, e.y + e.h, 16, ['#7FB0E0', '#5E5173'], 160, 300, 3); W.emit('slam'); }
        break;
      }
    }
  }

  // A boss's left wall: the level's edge, or in a tower the arena's own left wall.
  const arenaLeft = W => ((W.def.arenaX || 0) + 1) * TS;

  // The giants. Each has an attack or two and a moment where it's dazed (stompable whatever
  // it is); most call in a few of their small cousins.
  function stepGiant(W, e, dt, live, px, py, rage, toward) {
    if (KEEPERS.has(e.type)) return stepKeeper(W, e, dt, live, px, py, rage, toward);
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
    const daze = (t, state = 'dazed') => { e.state = state; e.dazed = e.wait = t * DAZE; };
    // Keep inside the level.
    const clampIn = () => { e.x = Math.max(arenaLeft(W), Math.min((W.w - 1) * TS - e.w, e.x)); e.y = Math.max(TS, Math.min((W.h - 1) * TS - e.h, e.y)); };
    switch (e.type) {
      case 'B+': {
        // The Wick Matriarch: plods after you, rears up and slams, and hatches beetles.
        bossFall(W, e, dt);
        if (e.state === 'rear') {
          if ((e.wait -= dt) <= 0) {
            shock(W, e, rage ? [[-1, 300], [1, 300], [-1, 180], [1, 180]] : [[-1, 260], [1, 260]]);
            W.shake = Math.max(W.shake, .3); W.emit('slam');
            if ((e.moves = (e.moves || 0) + 1) % 2 === 0 && minions(W) < 4) for (const d of [-1, 1]) spawnMinion(W, 'B', ex + d * e.w * .6, e.y + e.h - 4);
            e.dazed = (rage ? .7 : 1) * DAZE; e.state = 'idle'; e.wait = rage ? 2 : 3;
          }
          break;
        }
        e.face = toward;
        if (e.ground && groundAhead(W, e, e.face)) moveX(W, e, e.face * (rage ? 80 : 60) * dt);
        if ((e.wait -= dt) <= 0 && live && e.ground) { e.state = 'rear'; e.wait = .6; W.emit('snort'); }
        break;
      }
      case 'J+': {
        // The Bog King: big hops at you that land with shockwaves; croaks (dazed) every third.
        const land = bossFall(W, e, dt);
        if (e.state === 'hop') {
          moveX(W, e, e.vx * dt);
          if (land) {
            shock(W, e, [[-1, 260], [1, 260]]); W.shake = Math.max(W.shake, .3); W.emit('slam');
            e.hops = (e.hops || 0) + 1;
            if (e.hops % 2 === 0 && minions(W) < 3) spawnMinion(W, 'J', ex, e.y + e.h - 4);
            if (e.hops % 3 === 0) daze(rage ? 1.2 : 1.8, 'croak'); else { e.state = 'idle'; e.wait = rage ? .4 : .7; }
          }
          break;
        }
        if (e.state === 'croak') { if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = .5; } break; }
        e.face = toward;
        if ((e.wait -= dt) <= 0 && live && e.ground) { e.state = 'hop'; e.vy = -900; e.ground = false; e.vx = Math.max(-280, Math.min(280, (px - ex) * 1.2)); W.emit('hop'); }
        break;
      }
      case 'W+': case 'Z+': {
        // The Hive Mother hovers at home; the Living Spark circles the arena. Both lock on and
        // dash at you, and a dash that hits something (or runs out) leaves them dazed on the ground.
        if (e.state === 'idle') {
          let tx = e.ox, ty = e.oy + Math.sin(e.t * 3) * 10;
          if (e.type === 'Z+') { e.orb = (e.orb || 0) + dt * (rage ? 1.4 : 1); tx = e.ox + Math.cos(e.orb) * TS * 7; ty = e.oy + Math.sin(e.orb) * TS * 2.5; }
          e.x += (tx - e.x) * Math.min(1, dt * 2); e.y += (ty - e.y) * Math.min(1, dt * 2);
          e.face = toward;
          if ((e.cool -= dt) <= 0 && live) { e.cool = rage ? 4 : 6; if (minions(W) < 3) spawnMinion(W, e.type[0], ex, ey); }
          if ((e.wait -= dt) <= 0 && live) { e.state = 'aim'; e.wait = .6; W.emit('buzz'); }
        } else if (e.state === 'aim') {
          e.face = toward;
          if ((e.wait -= dt) <= 0) { const d = Math.hypot(px - ex, py - ey) || 1; e.vx = (px - ex) / d * 480; e.vy = (py - ey) / d * 480; e.state = 'dash'; e.wait = 1.4; }
        } else if (e.state === 'dash') {
          const side = moveX(W, e, e.vx * dt), hit = moveY(W, e, e.vy * dt, true);
          e.face = Math.sign(e.vx) || e.face;
          if (side || hit || (e.wait -= dt) <= 0) {
            if (side || hit) { W.shake = Math.max(W.shake, .25); W.emit('slam'); }
            daze(rage ? 1.2 : 1.7); e.vy = 0; e.ground = false;
          }
        } else {
          bossFall(W, e, dt);
          if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? 2 : 3; }
        }
        break;
      }
      case 'X+': {
        // The Widow: creeps along the ceiling spitting webs, drops on you, waits (dazed), climbs back.
        if (e.state === 'idle') {
          e.y += (e.oy - e.y) * Math.min(1, dt * 4);
          const dx = px - ex;
          // (It clings to the ceiling, so it slides along rather than bumping into it.)
          e.x += Math.sign(dx) * Math.min(Math.abs(dx), (rage ? 130 : 90) * dt); clampIn();
          if ((e.cool -= dt) <= 0 && live) { e.cool = rage ? 1 : 1.5; W.projectiles.push({ kind: 'web', x: ex - 7, y: e.y + e.h, w: 14, h: 14, vx: dx * .35, vy: 190, life: 4 }); W.emit('spit'); }
          if ((e.wait -= dt) <= 0 && live && Math.abs(dx) < TS * 1.5) { e.state = 'drop'; e.vy = 0; e.ground = false; W.emit('drop'); }
        } else if (e.state === 'drop') {
          if (bossFall(W, e, dt)) {
            shock(W, e, [[-1, 240], [1, 240]]); W.shake = Math.max(W.shake, .3); W.emit('slam');
            if (minions(W) < 3) spawnMinion(W, 'X', ex + (Math.random() < .5 ? -1 : 1) * TS * 4, TS * 1.5);
            daze(rage ? 1.3 : 1.8, 'ground');
          }
        } else if (e.state === 'ground') { if ((e.wait -= dt) <= 0) e.state = 'climb'; }
        else { e.y -= 200 * dt; if (e.y <= e.oy) { e.y = e.oy; e.state = 'idle'; e.wait = rage ? 2 : 3; } }
        break;
      }
      case 'S+': {
        // The Great Kiln: a fan of fireballs, a lob of three, a fountain, then it cools (dazed).
        bossFall(W, e, dt); e.face = toward;
        if (e.state === 'cool') { if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = .8; } break; }
        if ((e.wait -= dt) > 0 || !live) break;
        const v = (e.moves = (e.moves || 0) + 1) % 4, mx = ex + e.face * e.w * .4, my = e.y + e.h * .35;
        if (v === 0) { daze(rage ? 1.6 : 2.2, 'cool'); W.floaters.push({ x: ex, y: e.y - 10, t: 'cooling', life: 1, c: '#9FD8FF' }); break; }
        if (v === 1) for (const vy of [-60, 0, 60]) W.projectiles.push({ x: mx - 8, y: my - 8, w: 16, h: 16, vx: e.face * 230, vy, life: 5 });
        else if (v === 2) for (let k = 0; k < 3; k++) { const t = 1 + k * .2, g = 800, tx = px + (k - 1) * 60; W.projectiles.push({ x: ex - 7, y: e.y - 8, w: 14, h: 14, vx: (tx - ex) / t, vy: (py - e.y) / t - g * t / 2, g, life: 5 }); }
        else for (let k = 0; k < (rage ? 9 : 6); k++) W.projectiles.push({ x: ex - 6, y: e.y - 6, w: 12, h: 12, vx: (Math.random() * 2 - 1) * 220, vy: -500 - Math.random() * 250, g: 900, life: 5 });
        e.wait = 1.15; W.emit('spit');
        break;
      }
      case 'K+': {
        // The Thorn Tyrant: can't be stomped... until it charges into a wall, sprays thorns
        // and lands on its back.
        bossFall(W, e, dt);
        if (e.state === 'idle') {
          e.face = toward;
          if (e.ground && groundAhead(W, e, e.face)) moveX(W, e, e.face * 70 * dt);
          if ((e.wait -= dt) <= 0 && live && e.ground) { e.state = 'wind'; e.wait = rage ? .4 : .6; W.emit('snort'); }
        } else if (e.state === 'wind') {
          e.face = toward;
          if ((e.wait -= dt) <= 0) { e.state = 'charge'; e.wait = 3; }
        } else if (e.state === 'charge') {
          if (moveX(W, e, e.face * (rage ? 560 : 460) * dt) || !groundAhead(W, e, e.face) || (e.wait -= dt) <= 0) {
            W.shake = Math.max(W.shake, .35); W.emit('slam');
            const n = rage ? 7 : 5;
            for (let k = 0; k < n; k++) { const a = -Math.PI / 2 + (k - (n - 1) / 2) * .35; W.projectiles.push({ kind: 'arrow', x: ex - 5, y: e.y - 4, w: 10, h: 6, vx: Math.cos(a) * 300, vy: Math.sin(a) * 420, g: 700, life: 5 }); }
            daze(rage ? 1.4 : 2, 'flip');
          }
        } else if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? .8 : 1.4; }
        break;
      }
      case 'U+': {
        // The Moon Jelly: drifts under the water after you, pulses rings of sparks, calls
        // small jellies, and floats up to the surface now and then (dazed: stomp it there).
        e.face = toward;
        if (e.state === 'surface') {
          e.y += (e.surface - e.h * .5 - e.y) * Math.min(1, dt * 3);
          if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? 3.5 : 5; }
          break;
        }
        const tx = Math.max(e.left, Math.min(e.right, px - e.w / 2));
        e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 50 * dt);
        e.y += (Math.min(e.bottom - e.h, e.oy + Math.sin(e.t * 1.5) * 20) - e.y) * Math.min(1, dt * 2);
        if ((e.cool -= dt) <= 0 && live) { e.cool = rage ? 1.8 : 2.6; ring8(W, ex, ey, rage ? 10 : 8, 160); W.emit('buzz'); }
        if ((e.calls = (e.calls ?? 4) - dt) <= 0 && live) {
          e.calls = 7;
          if (minions(W) < 3) { const m = spawnMinion(W, 'U', ex, ey); m.minY = e.surface + 10; m.maxY = e.bottom - m.h; m.oy = ey; }
        }
        if ((e.wait -= dt) <= 0 && live) daze(rage ? 1.6 : 2.2, 'surface');
        break;
      }
      case 'G+': {
        // The Pale Wraith: drifts after you, vanishes (can't be touched), and reappears beside
        // you with a shriek of embers, dazed for a moment.
        e.phased = e.state === 'gone';
        if (e.state === 'idle') {
          const d = Math.hypot(px - ex, py - ey) || 1, sp = rage ? 75 : 55;
          e.vx += ((px - ex) / d * sp - e.vx) * Math.min(1, dt * 2); e.vy += ((py - ey) / d * sp - e.vy) * Math.min(1, dt * 2);
          e.x += e.vx * dt; e.y += e.vy * dt; e.face = Math.sign(e.vx) || e.face;
          e.fade = Math.max(0, e.fade - dt * 3);
          if ((e.wait -= dt) <= 0 && live) { e.state = 'gone'; e.wait = 1.4; W.emit('buzz'); }
        } else if (e.state === 'gone') {
          e.fade = Math.min(1, e.fade + dt * 3);
          if ((e.wait -= dt) <= 0) {
            e.x = px + (Math.random() < .5 ? -1 : 1) * TS * 5 - e.w / 2; e.y = py - e.h / 2 - TS; e.vx = e.vy = 0; clampIn();
            e.fade = 0; daze(rage ? 1 : 1.5, 'shriek');
            ring8(W, e.x + e.w / 2, e.y + e.h / 2, rage ? 12 : 8, 170); W.emit('roar');
            if (minions(W) < 2) spawnMinion(W, 'G', e.x + e.w / 2, e.y);
          }
        } else if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? 3 : 4.5; }
        clampIn();
        break;
      }
      case 'Y+': case 'N+': {
        // The Lantern Leviathan swims after you and fires from its lure; the Gar Lord lurks.
        // Both leap out at you; landing on dry ground leaves them flopping (dazed) until they
        // throw themselves back into the water.
        if (e.state === 'idle' || e.state === 'swim') {
          e.state = 'swim'; e.face = toward;
          e.y += (e.oy + Math.sin(e.t * 2.5) * 4 - e.y) * Math.min(1, dt * 4);
          const tx = Math.max(e.left, Math.min(e.right, px - e.w / 2));
          e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), (e.type === 'Y+' ? 110 : 60) * dt);
          if (e.type === 'Y+' && (e.cool -= dt) <= 0 && live) {
            e.cool = rage ? 1.6 : 2.2;
            const lx = ex + e.face * e.w / 2, ly = e.y - 10, d = Math.hypot(px - lx, py - ly) || 1;
            for (const k of [-1, 0, 1]) W.projectiles.push({ x: lx - 6, y: ly - 6, w: 12, h: 12, vx: (px - lx) / d * 220 + k * 40, vy: (py - ly) / d * 220 + k * 40, life: 4 });
            W.emit('spit');
          }
          if ((e.wait -= dt) <= 0 && live) {
            e.state = 'leap'; e.vy = e.type === 'N+' ? -1050 : -950; e.vx = Math.max(-480, Math.min(480, (px - ex) * 1.3)); W.emit('hop');
            burst(W, ex, e.surface, 14, ['#7FB0E0', '#D9D0F0'], 140, 300, 2.5);
          }
          break;
        }
        if (e.state === 'leap' || e.state === 'throw') {
          e.vy = Math.min(MAXFALL, e.vy + G * dt);
          moveX(W, e, e.vx * dt);
          const hit = moveY(W, e, e.vy * dt, false);
          e.face = Math.sign(e.vx) || e.face;
          // The Gar Lord sprays drops from the top of its leap.
          if (e.type === 'N+' && e.vy > 0 && !e.sprayed) { e.sprayed = true; ring8(W, ex, ey, rage ? 8 : 6, 150); }
          const wet = tile(W, Math.floor(ex / TS), Math.floor(ey / TS)) === '~';
          if (e.vy > 0 && wet) {
            // Splashed down, maybe in another pool: that's home now.
            measurePool(W, e, Math.floor(ex / TS), Math.floor(ey / TS)); e.oy = Math.min(e.bottom - e.h, e.surface + 6);
            e.state = 'swim'; e.sprayed = false; e.wait = rage ? 3.5 : 5;
            burst(W, ex, e.surface, 14, ['#7FB0E0', '#D9D0F0'], 140, 300, 2.5);
          } else if (hit && hit.dir === 'down') { e.vy = 0; e.sprayed = false; daze(rage ? 1.5 : 2.2, 'flop'); W.shake = Math.max(W.shake, .25); W.emit('slam'); }
          break;
        }
        // Flopping on dry land; then a throw back toward its pool.
        if ((e.wait -= dt) <= 0) {
          const home = (e.left + e.right) / 2;
          e.state = 'throw'; e.vy = -700; e.vx = Math.max(-300, Math.min(300, (home - e.x) * 1.4));
        }
        break;
      }
      case '*+': {
        // The Magma Heart: hides in the lava under you (can't be hit), erupts in a high arc
        // raining lava, and sometimes lands on a ledge and crusts over (dazed).
        e.phased = e.state === 'idle' || e.state === 'hide';
        if (e.state === 'idle' || e.state === 'hide') {
          e.state = 'hide'; e.y += (e.surface + 10 - e.y) * Math.min(1, dt * 4);
          // Lurk a little to one side of you, under open sky, so it can arc up onto your ledge.
          const open = x => x > e.left && x < e.right + e.w && [1, 2, 3, 4].every(k => !isSolid(tile(W, Math.floor(x / TS), Math.floor(e.surface / TS) - k)));
          let spot = px;
          for (let d = 3; d <= 12; d++) {
            if (open(px + d * TS)) { spot = px + d * TS; break; }
            if (open(px - d * TS)) { spot = px - d * TS; break; }
          }
          const tx = Math.max(e.left, Math.min(e.right, spot - e.w / 2));
          e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 140 * dt);
          // Every other eruption arcs at you, so it lands (and crusts) on your ledge.
          if ((e.wait -= dt) <= 0 && live) {
            e.state = 'erupt'; e.vy = -1050;
            e.vx = (e.erupts = (e.erupts || 0) + 1) % 2 === 0 ? Math.max(-320, Math.min(320, (px - ex) * 1.1)) : (Math.random() * 2 - 1) * 160;
            W.emit('boom'); burst(W, ex, e.surface, 20, LF.WARM, 220, 300, 3);
          }
          break;
        }
        if (e.state === 'erupt') {
          e.vy = Math.min(MAXFALL, e.vy + G * dt);
          moveX(W, e, e.vx * dt);
          const hit = moveY(W, e, e.vy * dt, false);
          if (e.vy > 0 && !e.rained) {
            e.rained = true;
            for (let k = 0; k < (rage ? 9 : 6); k++) W.projectiles.push({ x: ex - 6, y: ey - 6, w: 12, h: 12, vx: (Math.random() * 2 - 1) * 260, vy: -200 - Math.random() * 200, g: 900, life: 5 });
          }
          if (hit && hit.dir === 'down') { e.rained = false; daze(rage ? 1.6 : 2.2, 'crust'); W.shake = Math.max(W.shake, .25); W.emit('slam'); }
          else if (e.vy > 0 && e.y + e.h / 2 > e.surface) { e.rained = false; e.state = 'hide'; e.wait = rage ? 1.6 : 2.4; burst(W, ex, e.surface, 16, LF.WARM, 180, 300, 3); }
          break;
        }
        if ((e.wait -= dt) <= 0) { e.state = 'erupt'; e.vy = -700; e.vx = Math.max(-260, Math.min(260, ((e.left + e.right) / 2 - e.x) * 1.4)); }
        break;
      }
      case 'E+': case 'e+': {
        // The pendulums: a huge ball swinging from its pivot, wider and faster once hurt,
        // shedding shards at each end of its swing. Every third time through the bottom it
        // stops dead for a moment (dazed). The Thorn Pendulum's chain cuts too, and the chain
        // stretches and shrinks so the ball sweeps different heights.
        if (e.state === 'rest') { if ((e.wait -= dt) <= 0) e.state = 'idle'; }
        else {
          const before = e.phase;
          e.phase += dt * TAU / (rage ? 2.2 : 3);
          const crossed = Math.floor(before / Math.PI) !== Math.floor(e.phase / Math.PI);
          const turned = Math.floor((before - Math.PI / 2) / Math.PI) !== Math.floor((e.phase - Math.PI / 2) / Math.PI);
          if (live && turned) {
            const n = rage ? 5 : 3;
            for (let k = 0; k < n; k++) W.projectiles.push({ x: ex - 6, y: ey - 6, w: 12, h: 12, vx: (k - (n - 1) / 2) * 70, vy: -150, g: 800, life: 4 });
          }
          if (live && crossed && (e.swings = (e.swings || 0) + 1) % 3 === 0) { e.phase = Math.round(e.phase / Math.PI) * Math.PI; daze(rage ? 1.1 : 1.6, 'rest'); W.emit('clank'); }
        }
        const a = (rage ? 1.25 : .95) * Math.sin(e.phase);
        const len = e.type === 'e+' ? e.len * (.78 + .22 * Math.cos(e.t * .7)) : e.len;
        e.bx = e.ax + Math.sin(a) * len; e.by = e.ay + Math.cos(a) * len;
        e.x = e.bx - e.w / 2; e.y = e.by - e.h / 2;
        if (e.type === 'e+' && live && segDist(px, py, e.ax, e.ay, e.bx, e.by) < 12 && Math.hypot(px - e.bx, py - e.by) > e.w / 2) hurt(W);
        break;
      }
      case 'f+': {
        // The Fire Wheel: arms of fire turn around its core, flip direction now and then,
        // flare out longer, then go dark for a moment (dazed: the safe time to stomp the core).
        e.ang = (e.ang || 0) + dt * (rage ? 1.6 : 1.1) * (e.dir || 1);
        e.arms = rage ? 5 : 4;
        if (e.state === 'idle') {
          e.armsOn = true; e.armLen = 6;
          if ((e.cool -= dt) <= 0) { e.cool = 6; e.dir = -(e.dir || 1); }
          if ((e.wait -= dt) <= 0 && live) { e.state = 'flare'; e.wait = 2; W.emit('boom'); }
        } else if (e.state === 'flare') {
          e.armLen = 9;
          if ((e.wait -= dt) <= 0) { e.armsOn = false; daze(rage ? 1.2 : 1.8, 'dark'); }
        } else if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? 4 : 6; }
        if (live) for (const b of LF.wheelBalls(e)) if (Math.hypot(px - b.x, py - b.y) < 15) { hurt(W); break; }
        break;
      }
      case 'k+': {
        // The Great Crusher: tracks you along the ceiling, shakes, slams down, sticks (dazed),
        // and grinds back up.
        if (e.state === 'idle') {
          e.y += (e.oy - e.y) * Math.min(1, dt * 3);
          const tx = px - e.w / 2;
          e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), (rage ? 170 : 120) * dt);
          if (Math.abs(tx - e.x) < 10 && (e.wait -= dt) <= 0 && live) { e.state = 'shake'; e.wait = rage ? .35 : .55; W.emit('snort'); }
        } else if (e.state === 'shake') {
          if ((e.wait -= dt) <= 0) { e.state = 'slam'; e.vy = 0; }
        } else if (e.state === 'slam') {
          e.vy = Math.min(1100, e.vy + G * 1.5 * dt);
          const hit = moveY(W, e, e.vy * dt, false);
          if (hit && hit.dir === 'down') {
            W.shake = Math.max(W.shake, .5); W.emit('slam');
            shock(W, e, rage ? [[-1, 300], [1, 300], [-1, 180], [1, 180]] : [[-1, 260], [1, 260]]);
            if (rage) for (let k = 0; k < 4; k++) W.projectiles.push({ kind: 'rock', x: px + (Math.random() * 2 - 1) * TS * 5 - 7, y: TS + 4, w: 14, h: 14, vx: 0, vy: 0, g: 700 + Math.random() * 300, life: 4 });
            daze(rage ? 1.4 : 1.9, 'stuck');
          }
        } else if (e.state === 'stuck') { if ((e.wait -= dt) <= 0) e.state = 'rise'; }
        else { e.y -= 150 * dt; if (e.y <= e.oy) { e.y = e.oy; e.state = 'idle'; e.wait = rage ? .6 : 1; } }
        e.x = Math.max(arenaLeft(W), Math.min((W.w - 1) * TS - e.w, e.x));
        break;
      }
      case 'Ø+': {
        // The Void: a hole in the night sky that hunts you round the islands. In turn it
        // drifts after you, pulls you toward it (run against it: touching it hurts), throws
        // rings of void orbs, and blinks to the far side of the arena. After every pull it
        // collapses, sinking low and dazed: the moment to stomp it.
        const fast = rage ? 1.3 : 1;
        if (e.state === 'pull') {
          if (live) {
            const p = W.player, dx = ex - (p.x + p.w / 2), dy = ey - (p.y + p.h / 2), d = Math.hypot(dx, dy) || 1;
            const pull = 135 * fast * Math.max(.35, 1 - d / (TS * 24));
            moveX(W, p, dx / d * pull * dt);
            if (!p.onGround && dy < 0) p.vy -= 260 * dt;
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * TAU, r = 60 + Math.random() * 90;
              W.particles.push({ x: ex + Math.cos(a) * r, y: ey + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.2, vy: -Math.sin(a) * r * 2.2, life: .45, max: .45, c: '#8F81AB', size: 2, g: 0 });
            }
          }
          if ((e.wait -= dt) <= 0) {
            e.state = 'collapse'; e.home = e.y; e.vy = 0;
            W.floaters.push({ x: ex, y: e.y - 14, t: 'it collapses!', life: 1.4, c: '#CFC6E8' });
            daze(rage ? 1.6 : 2, 'collapse');
          }
          break;
        }
        if (e.state === 'collapse') {
          // Sink to the lowest it goes (a little above the islands), then wait out the daze.
          e.y = Math.min(e.y + 140 * dt, e.oy + TS * 6.5);
          if ((e.wait -= dt) <= 0) { e.state = 'rise'; }
          break;
        }
        if (e.state === 'rise') { e.y -= 160 * dt; if (e.y <= e.oy) { e.y = e.oy; e.state = 'idle'; e.wait = 1.2 / fast; } break; }
        if (e.state === 'blink') {
          e.fade = Math.min(1, (e.fade || 0) + dt * 3);
          if (e.fade >= 1 && !e.blinked) {
            const lo = arenaLeft(W) + TS * 2, hi = (W.w - 3) * TS - e.w;
            e.x = px < (lo + hi) / 2 ? hi - Math.random() * TS * 4 : lo + Math.random() * TS * 4; e.blinked = true;
            const toP = Math.atan2(py - (e.y + e.h / 2), px - (e.x + e.w / 2));
            for (const da of [-.25, 0, .25]) W.projectiles.push({ x: e.x + e.w / 2 - 7, y: e.y + e.h / 2 - 7, w: 14, h: 14, vx: Math.cos(toP + da) * 190, vy: Math.sin(toP + da) * 190, life: 4, kind: 'void' });
          }
          if (e.blinked) { e.fade = Math.max(0, e.fade - dt * 6); if (e.fade <= 0) { e.blinked = false; e.state = 'idle'; e.wait = 1 / fast; } }
          break;
        }
        // Drift toward a spot above you.
        const tx = Math.max(arenaLeft(W) + TS, Math.min((W.w - 3) * TS - e.w, px - e.w / 2)), ty = Math.max(TS * 2, Math.min(e.oy + TS * 2, py - TS * 4 - e.h / 2));
        e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 110 * fast * dt);
        e.y += (ty + Math.sin(e.t * 2) * 8 - e.y) * Math.min(1, dt * 1.5);
        if ((e.wait -= dt) > 0 || !live) break;
        const acts = ['pull', 'orbs', 'blink', 'pull', 'orbs'];
        const act = acts[(e.moves = (e.moves || 0) + 1) % acts.length];
        if (act === 'pull') { e.state = 'pull'; e.wait = 2.4; W.emit('buzz'); W.floaters.push({ x: ex, y: e.y - 14, t: 'it pulls…', life: 1.2, c: '#8F81AB' }); }
        else if (act === 'orbs') {
          const n = rage ? 12 : 9, toP = Math.atan2(py - ey, px - ex);
          for (let k = 0; k < n; k++) {
            const a = toP + Math.PI / n + k / n * TAU, off = Math.abs(((a - toP) % TAU + TAU + Math.PI) % TAU - Math.PI);
            if (off < .5) continue;
            W.projectiles.push({ x: ex - 7, y: ey - 7, w: 14, h: 14, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 4.5, kind: 'void' });
          }
          e.wait = 1.6 / fast; W.emit('spit');
        } else { e.state = 'blink'; e.fade = 0; e.blinked = false; W.emit('buzz'); }
        break;
      }
      case 'Ɱ+': {
        // The Melon Brute: a giant watermelon. It rolls at you and keeps rolling till it hits
        // a wall, cracking itself (dazed: stomp it then); spits fans of seeds; hops at you,
        // landing with shockwaves.
        const fast = rage ? 1.25 : 1, land = bossFall(W, e, dt);
        if (e.state === 'roll') {
          e.spin = (e.spin || 0) + e.vx * dt / (e.h / 2);
          if (Math.random() < .3) burst(W, ex - Math.sign(e.vx) * e.w / 2, e.y + e.h, 2, ['#7A4A3A', '#A5D6A7'], 60, 300, 2);
          if (moveX(W, e, e.vx * dt) || e.x <= arenaLeft(W) + 1 || e.x + e.w >= (W.w - 1) * TS - 1) {
            e.x = Math.max(arenaLeft(W), Math.min((W.w - 1) * TS - e.w, e.x));
            W.shake = Math.max(W.shake, .5); W.emit('slam');
            burst(W, ex + Math.sign(e.vx) * e.w / 2, ey, 22, ['#E5484D', '#A5D6A7', '#2E7D32'], 220, 400, 3);
            for (let k = 0; k < 5; k++) W.projectiles.push({ x: ex - 4, y: e.y + 6, w: 8, h: 8, vx: -Math.sign(e.vx) * (60 + k * 50), vy: -380 - k * 40, g: 900, life: 3, kind: 'seed' });
            e.vx = 0; W.floaters.push({ x: ex, y: e.y - 14, t: 'crack!', life: 1.2, c: '#A5D6A7' });
            daze(rage ? 1.6 : 2.1, 'cracked');
          }
          break;
        }
        if (e.state === 'cracked') { if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = .8 / fast; } break; }
        if (e.state === 'hop') {
          moveX(W, e, e.vx * dt);
          e.x = Math.max(arenaLeft(W), Math.min((W.w - 1) * TS - e.w, e.x));
          if (land) { shock(W, e, [[-1, 260], [1, 260]]); W.shake = Math.max(W.shake, .35); W.emit('slam'); e.state = 'idle'; e.wait = .7 / fast; }
          break;
        }
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live || !e.ground) break;
        const acts = ['roll', 'seeds', 'hop', 'roll', 'hop', 'seeds'];
        const act = acts[(e.moves = (e.moves || 0) + 1) % acts.length];
        if (act === 'roll') { e.state = 'roll'; e.vx = toward * 330 * fast; W.emit('snort'); }
        else if (act === 'hop') { e.state = 'hop'; e.vy = -760; e.ground = false; e.vx = Math.max(-260, Math.min(260, (px - ex) * 1.2)); W.emit('jump'); }
        else {
          for (let k = -2; k <= 2; k++) W.projectiles.push({ x: ex - 4, y: e.y + 10, w: 8, h: 8, vx: toward * (140 + Math.abs(k) * 20) + k * 40, vy: -420 + Math.abs(k) * 60, g: 900, life: 3, kind: 'seed' });
          e.wait = 1.3 / fast; W.emit('spit');
        }
        break;
      }
      case 'Ω+': {
        if (e.chase) { stepChase(W, e, dt); break; }
        // The Last Dark: the final boss. It hovers over you, and grows wilder as it weakens:
        // three phases, each faster and with more attacks. Its dives slam the floor and leave
        // it dazed there, the best moment to stomp it.
        const phase = e.hp > 33 ? 1 : e.hp > 16 ? 2 : 3, fast = [1, 1.25, 1.55][phase - 1];
        if (phase !== e.phase) {
          if (e.phase) {
            W.floaters.push({ x: ex, y: e.y - 20, t: phase === 2 ? 'the dark gathers…' : 'the dark rages!', life: 2, c: '#FF6B3D' });
            W.shake = Math.max(W.shake, .6); W.emit('roar'); ring8(W, ex, ey, 16, 200);
          }
          e.phase = phase;
        }
        if (e.state === 'dive') {
          e.vy = Math.min(1100, e.vy + G * 1.4 * dt);
          const hit = moveY(W, e, e.vy * dt, true);
          if (hit && hit.dir === 'down') {
            shock(W, e, phase === 3 ? [[-1, 320], [1, 320], [-1, 200], [1, 200]] : [[-1, 300], [1, 300]]);
            W.shake = Math.max(W.shake, .5); W.emit('slam');
            daze(phase === 3 ? 1.1 : 1.4, 'floor');
          }
          break;
        }
        if (e.state === 'floor') { if ((e.wait -= dt) <= 0) e.state = 'rise'; break; }
        if (e.state === 'rise') { e.y -= 220 * dt; if (e.y <= e.oy) { e.y = e.oy; e.state = 'idle'; e.wait = 1 / fast; } break; }
        // Hover over you.
        const tx = Math.max(arenaLeft(W) + TS, Math.min((W.w - 3) * TS - e.w, px - e.w / 2));
        e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 90 * fast * dt);
        e.y += (e.oy + Math.sin(e.t * 2) * 10 - e.y) * Math.min(1, dt * 3);
        e.face = toward;
        if ((e.wait -= dt) > 0 || !live) break;
        const acts = [['bombs', 'rain', 'dive'], ['bombs', 'summon', 'ring', 'dive', 'rain'], ['bombs', 'ring', 'rocks', 'dive', 'summon', 'rain']][phase - 1];
        const act = acts[(e.moves = (e.moves || 0) + 1) % acts.length];
        e.wait = 1.4 / fast;
        if (act === 'dive') { e.state = 'dive'; e.vy = 0; W.emit('buzz'); }
        else if (act === 'bombs') {
          const n = phase + 1, pvx = W.player.vx;
          for (let k = 0; k < n; k++) {
            const t = .9 + k * .15, g = 900, bx = px + pvx * t * .8 + (k - (n - 1) / 2) * 50;
            W.projectiles.push({ kind: 'bomb', x: ex - 6, y: e.y + e.h - 10, w: 12, h: 12, vx: (bx - ex) / t, vy: (py - e.y - e.h) / t - g * t / 2, g, life: 4 });
          }
          W.emit('lob');
        } else if (act === 'rain') {
          const n = 6 + phase * 2;
          for (let k = 0; k < n; k++) W.projectiles.push({ x: px + (k - n / 2) * 48 + Math.random() * 20, y: TS + 4, w: 12, h: 12, vx: 0, vy: 80, g: 500, life: 5 });
          W.emit('spit');
        } else if (act === 'ring') { ring8(W, ex, ey, 10 + phase * 2, 170); W.emit('buzz'); }
        else if (act === 'rocks') {
          for (let k = 0; k < 6; k++) W.projectiles.push({ kind: 'rock', x: px + (Math.random() * 2 - 1) * TS * 6 - 7, y: TS + 4, w: 14, h: 14, vx: 0, vy: 0, g: 700 + Math.random() * 300, life: 4 });
          W.emit('slam');
        } else if (act === 'summon' && minions(W) < 4) {
          for (let k = 0; k < 2; k++) {
            const type = WAVE[(e.wave = ((e.wave ?? -1) + 1) % WAVE.length)];
            const fly = 'FGWZ'.includes(type), x = px + (k ? 1 : -1) * TS * 6;
            spawnMinion(W, type, Math.max(arenaLeft(W) + TS, Math.min((W.w - 4) * TS, x)), fly ? e.y + e.h : type === 'X' ? TS * 1.5 : (W.h - 4) * TS + 16);
          }
          W.floaters.push({ x: ex, y: e.y - 10, t: 'rise, my dark!', life: 1.2, c: '#FF6B3D' });
        }
        break;
      }
      case '&+': case '%+': {
        // The horde's heart rides its front, deep in the dark, and every few seconds lunges
        // out at you: the only time it can be hit. Kill it and the whole horde goes.
        // (In a boss fight there's no horde: the heart hunts you on its own, hovering after
        // you and lunging; after each lunge it hangs dazed for a moment.)
        const h = W.horde;
        if (!h) {
          if (e.state === 'lunge') {
            e.x += e.vx * dt; e.y += e.vy * dt; clampIn();
            if ((e.wait -= dt) <= 0) { e.vx = e.vy = 0; daze(rage ? .9 : 1.2, 'spent'); W.floaters.push({ x: ex, y: e.y - 14, t: 'spent!', life: 1.1, c: '#CFC6E8' }); }
            break;
          }
          if (e.state === 'spent') { if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? 1.6 : 2.2; } break; }
          const tx = px - e.w / 2 + (px < ex ? 1 : -1) * TS * 4, ty = py - TS * 2.5 - e.h / 2;
          e.x += Math.sign(tx - e.x) * Math.min(Math.abs(tx - e.x), 100 * dt);
          e.y += Math.sign(ty - e.y) * Math.min(Math.abs(ty - e.y), 80 * dt);
          clampIn();
          if ((e.wait -= dt) <= 0 && live) {
            const d = Math.hypot(px - ex, py - ey) || 1, sp = rage ? 430 : 360;
            e.state = 'lunge'; e.vx = (px - ex) / d * sp; e.vy = (py - ey) / d * sp; e.wait = Math.min(.9, d / sp + .15); W.emit('growl');
          }
          break;
        }
        if (e.state === 'lunge') {
          e.reach = Math.min(TS * (rage ? 6 : 5), e.reach + dt * TS * 12);
          if ((e.wait -= dt) <= 0) { e.state = 'idle'; e.wait = rage ? 2.2 : 3.2; }
        } else {
          e.reach = Math.max(-TS * 1.5, e.reach - dt * TS * 4);
          if ((e.wait -= dt) <= 0 && live) { e.state = 'lunge'; e.wait = rage ? 1.6 : 1.2; W.emit('growl'); }
        }
        if (h.up) { e.y = -h.f - e.reach - e.h / 2; e.x += (px - e.w / 2 - e.x) * Math.min(1, dt * 2); }
        else {
          // Level with the ground you're standing on (it doesn't rise with your jumps).
          if (W.player.onGround || e.restY == null) e.restY = W.player.y + W.player.h - e.h;
          e.x = h.f + e.reach - e.w / 2; e.y += (e.restY - e.y) * Math.min(1, dt * 2);
        }
        clampIn();
        break;
      }
    }
  }

  // A blast from a boss's weapon: hurts you if you're within r.
  function enemyBlast(W, x, y, r, big, playing) {
    const p = W.player;
    burst(W, x, y, big ? 34 : 22, ['#FFF1CF', '#FFB547', '#FF6B3D', '#463C6B'], big ? 280 : 220, 300, big ? 4 : 3);
    ring(W, x, y, r, '255,107,61', big ? .5 : .35);
    W.shake = Math.max(W.shake, big ? .3 : .15); W.emit(big ? 'boom' : 'pop');
    if (playing && !p.dead && Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y) < r) hurt(W);
  }
  // The Powder King's grenade: just like yours, it bounces, blasting 2 blocks on its first
  // two bounces and 3 on the third, when it's spent.
  function stepKingGrenade(W, b, dt, playing) {
    b.vy = Math.min(MAXFALL, b.vy + b.g * dt); b.life -= dt;
    let bounced = false;
    const nx = b.x + b.vx * dt;
    if (isSolid(tile(W, Math.floor((nx + b.w / 2 + Math.sign(b.vx) * b.w / 2) / TS), Math.floor((b.y + b.h / 2) / TS)))) { b.vx *= -.6; bounced = true; }
    else b.x = nx;
    const ny = b.y + b.vy * dt, c = tile(W, Math.floor((b.x + b.w / 2) / TS), Math.floor((b.vy > 0 ? ny + b.h : ny) / TS));
    if (isSolid(c) || (b.vy > 0 && (c === '=' || c === '~' || c === '!'))) { b.vy *= -.55; b.vx *= .8; bounced = true; }
    else b.y = ny;
    const x = b.x + b.w / 2, y = b.y + b.h / 2;
    if (bounced && (b.bounce = (b.bounce || 0) - dt) <= 0) {
      b.bounce = .15;
      if (++b.bounces >= 3) { b.life = 0; return enemyBlast(W, x, y, TS * 3, true, playing); }
      enemyBlast(W, x, y, TS * 2, false, playing);
    }
    if (b.life <= 0) enemyBlast(W, x, y, TS * 3, true, playing);
  }

  // Where a falling bomb will hit (the point it first meets solid ground), or null.
  function bombLanding(W, b) {
    let x = b.x + b.w / 2, y = b.y + b.h / 2, vx = b.vx, vy = b.vy || 0, t = 0;
    const dt = 1 / 60;
    for (let k = 0; k < 60 * Math.min(4, b.life); k++) {
      vy += (b.g || 0) * dt; x += vx * dt; y += vy * dt; t += dt;
      if (y > W.h * TS + 40) return null;
      if (isSolid(tile(W, Math.floor(x / TS), Math.floor(y / TS)))) return { x, y: Math.floor(y / TS) * TS, t };
    }
    return null;
  }
  function stepProjectiles(W, dt, playing) {
    const p = W.player;
    for (const b of W.projectiles) {
      if (b.kind === 'kgrenade') { stepKingGrenade(W, b, dt, playing); continue; }
      // A raging boss's bomb works out where it'll land the moment it's dropped, so that
      // spot can be marked. (The Powder King's bombs give no warning.)
      if (b.kind === 'bomb' && b.fury) { if (b.land === undefined) { b.land = bombLanding(W, b); b.flown = 0; } b.flown += dt; }
      // A warning mark is harmless; when it runs out, what it warned of appears.
      if (b.kind === 'warn') { b.life -= dt; if (b.life <= 0) { W.projectiles.push({ ...b.then }); burst(W, b.x + b.w / 2, b.y + b.h, 8, ['#FF6B3D', '#FFE2A8'], 90, -60, 2); } continue; }
      if (b.g) b.vy += b.g * dt;
      // (A bomb in water or lava sinks slowly, as you do.)
      if (b.g || b.kind === 'bomb') sinkIn(W, { get x() { return b.x + b.w / 2; }, get y() { return b.y + b.h / 2; }, get vx() { return b.vx; }, set vx(v) { b.vx = v; }, get vy() { return b.vy || 0; }, set vy(v) { b.vy = v; } }, dt);
      b.x += b.vx * dt; b.y += (b.vy || 0) * dt; b.life -= dt;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      // A shockwave runs out where the floor under it ends.
      if (b.kind === 'shock' && !isFloor(tile(W, Math.floor(bx / TS), Math.floor((b.y + b.h + 2) / TS)))) {
        b.life = 0; burst(W, bx, b.y + b.h, 6, ['#FF6B3D', '#FFE2A8'], 80, 200, 2); continue;
      }
      // A cluster bomb splits in three at the top of its arc.
      if (b.kind === 'bomb' && b.cluster && b.vy > 0) {
        b.cluster = false;
        for (const d of [-1, 1]) W.projectiles.push({ ...b, x: b.x + d * 4, vx: b.vx + d * 130, land: undefined });
      }
      if (isSolid(tile(W, Math.floor(bx / TS), Math.floor(by / TS)))) {
        b.life = 0; burst(W, bx, by, 6, WARM, 90, 200, 2);
        // The Powder King's bombs burst where they land and hurt anyone close by.
        if (b.kind === 'bomb') {
          burst(W, bx, by - 6, 22, ['#FFF1CF', '#FFB547', '#FF6B3D', '#463C6B'], 220, 300, 3);
          ring(W, bx, by - 6, 52, '255,181,71', .35); W.shake = Math.max(W.shake, .15); W.emit('pop');
          if (playing && !p.dead && Math.hypot(p.x + p.w / 2 - bx, p.y + p.h / 2 - by) < 52) hurt(W);
          // In the Fuse Hall the bombs leave a patch of fire behind.
          if (b.burn) W.projectiles.push({ kind: 'flame', x: bx - 7, y: Math.floor(by / TS) * TS - 18, w: 14, h: 18, vx: 0, vy: 0, life: 2.5 });
        }
      } else if (playing && !p.dead && overlap(p, b)) { b.life = 0; hurt(W); }
      // (An ember pot's ember hurts any other enemy it hits, too: one hit, and it's spent. Not
      // a boss, nor the pot that spat it.)
      else if (b.ember) {
        const o = W.enemies.find(o => o !== b.ember && o.alive && !o.phased && !isBoss(o) && overlap(o, b));
        if (o) { b.life = 0; shootEnemy(W, o, Math.sign(b.vx) || 1, null, 'burnt', 1); burst(W, bx, by, 8, WARM, 100, 200, 2); }
      }
      if (Math.random() < .4) W.particles.push({ x: bx, y: by, vx: -b.vx * .1, vy: -20, life: .3, max: .3, c: '#FF6B3D', size: 2, g: 0 });
    }
    W.projectiles = W.projectiles.filter(b => b.life > 0);
  }

  // Is there a wall directly beside the player on this side (-1 left, 1 right)?
  function wallBeside(W, p, side) {
    const tx = Math.floor(side > 0 ? (p.x + p.w + 1) / TS : (p.x - 1) / TS);
    const top = Math.floor((p.y + 4) / TS), bot = Math.floor((p.y + p.h - 4) / TS);
    for (let ty = top; ty <= bot; ty++) {
      const c = tile(W, tx, ty);
      // (A slope's steep back is a wall too: slide down it, jump off it.)
      if (isSolid(c) || SLOPES[c] === -side) return true;
    }
    return false;
  }

  // Is the lower part of the body under the water surface?
  function inWater(W, p) {
    const x0 = Math.floor((p.x + 3) / TS), x1 = Math.floor((p.x + p.w - 3) / TS);
    const y0 = Math.floor((p.y + p.h * .4) / TS), y1 = Math.floor((p.y + p.h - 1) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tile(W, tx, ty) !== '~') continue;
      if (tile(W, tx, ty - 1) === '~' || p.y + p.h > ty * TS + 10) return true;
    }
    return false;
  }

  // The cannon: climb in (↓ beside it), a moment's pause, BOOM, and away up and to the
  // right in a long arc, which finishes the level. While inside or flying, the player is
  // just a passenger.
  const CANNON_MOUTH = { x: 30, y: -46 };
  LF.cannonMouth = c => ({ x: c.x + CANNON_MOUTH.x, y: c.y + CANNON_MOUTH.y });
  function stepCannon(W, p, dt) {
    const c = W.cannon, m = LF.cannonMouth(c);
    c.t += dt;
    if (c.state === 'in' && c.t > .7) {
      c.state = 'fire'; c.t = 0;
      burst(W, m.x, m.y, 30, ['#FFF1CF', '#FFB547', '#FF6B3D', '#D9D0F0'], 260, -40, 4);
      W.shake = Math.max(W.shake, .5); W.emit('boom');
    }
    if (c.state === 'fire') {
      const t = c.t;
      p.x = m.x + 520 * t - p.w / 2; p.y = m.y - 900 * t + 450 * t * t - p.h / 2;
      if (Math.random() < .7) W.particles.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: (Math.random() - .5) * 40, vy: 20, life: .5, max: .5, c: LF.WARM[Math.floor(Math.random() * 3)], size: 3, g: 0 });
      if (t > 1.4 && !W.cleared) { W.cleared = true; W.clearedBy = 'cannon'; W.emit('clear'); }
    }
  }

  function stepPlayer(W, p, input, dt) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    // S (carry): carrying a shell, a press lets it go, kicked off ahead of you. (Picking one
    // up is in the enemy checks below: hold S and run into a shell lying still.)
    const carryPress = !!input.carryPressed; input.carryPressed = false;
    if (p.carrying && (carryPress || p.dead)) {
      const s = p.carrying; p.carrying = null;
      if (s.alive && !p.dead) { s.state = 'spin'; s.vx = p.face * SHELL_SPEED; s.stompCool = .3; s.shot = 0; s.x = p.x + p.w / 2 + p.face * (p.w / 2 + 2) - (p.face > 0 ? 0 : s.w); W.emit('stomp', { type: s.type }); }
    }
    // Standing at the cannon and pressing ↓ climbs in.
    const cn = W.cannon;
    if (cn && cn.state === 'idle' && input.down && p.onGround && Math.abs(p.x + p.w / 2 - cn.x) < 26 && Math.abs(p.y + p.h - cn.y) < 8) {
      cn.state = 'in'; cn.t = 0; p.inCannon = true; p.vx = p.vy = 0; p.inv = 99;
      p.x = cn.x - p.w / 2; p.y = cn.y - p.h - 10;
      W.emit('hop');
      return;
    }
    p.lock -= dt; p.inv -= dt;
    if (p.rush > 0) p.rush -= dt;

    if (dir && p.lock <= 0) p.face = dir;
    // Right after a wall jump, steering is weak so the kick carries you off the wall.
    const wet = inWater(W, p);
    if (wet && !p.wet) {
      burst(W, p.x + p.w / 2, p.y + p.h, 10, ['#7FB0E0', '#D9D0F0'], 110, 500, 2);
      W.emit('splash');
    }
    p.wet = wet;
    // (A watermelon makes you FAST times quicker on your feet. In water you move along just as
    // fast as you run on land.)
    const T = playerTune(W.def), grav = G * T.gravity, run = RUN * T.run * (p.fast > 1 ? FAST * 1.15 : p.fast > 0 || p.rush > 0 ? FAST : 1);
    const accel = p.onGround ? (p.ice ? (dir ? 450 : 120) : dir ? 2600 : 2200) : p.lock > 0 ? 250 : (dir ? 1700 : 700) * T.air;
    p.vx = approach(p.vx, dir * run, accel * dt);

    if (input.jumpPressed) { p.buffer = .13; input.jumpPressed = false; } else p.buffer -= dt;
    // (The pear's spin goes on Space (or Z, or the touch jump button), not on Up: Up only
    // glides, however often you press it.)
    const spin = !!input.spinPressed; input.spinPressed = false;
    p.coyote = p.onGround ? .1 : p.coyote - dt;
    if (input.down && p.onGround) p.drop = .2;
    p.drop -= dt;
    const dropping = p.drop > 0;

    // Walls: touching one in the air allows a wall jump; pushing into it while falling slides slowly.
    p.wall = p.onGround ? 0 : wallBeside(W, p, -1) ? -1 : wallBeside(W, p, 1) ? 1 : p.spinWallT > 0 ? p.spinWallSide : 0;
    const airJumps = T.airJumps + (p.dbl || 0);   // (a ripe banana: a triple jump)
    if (p.wall) { p.wallDir = p.wall; p.wallCoyote = .1; p.airJumps = airJumps; }
    else p.wallCoyote -= dt;
    if (p.onGround || wet) { p.airJumps = airJumps; p.spun = false; }
    p.sliding = !!p.wall && dir === p.wall && p.vy > 0;

    // Jump speed scales with sqrt(height x gravity) so the height setting is exact at any gravity.
    const jumpV = JUMP * Math.sqrt(T.jump * T.gravity) * (p.boost > 1 ? BOOST * 1.12 : p.boost > 0 || p.rush > 0 ? BOOST : 1);
    if (p.buffer > 0 && p.coyote > 0 && !dropping) {
      p.vy = -jumpV; p.buffer = 0; p.coyote = 0; p.jumping = true;
      p.onGround = false; p.onPlat = null; p.sx = .75; p.sy = 1.3;
      burst(W, p.x + p.w / 2, p.y + p.h, 6, p.boost > 0 ? ['#FFB547', '#FF6B3D'] : ['#9A8FBF'], 60, 200, 2);
      W.emit('jump');
    } else if (p.buffer > 0 && wet) {
      // Swimming: as many jumps as you like while in the water.
      p.vy = -jumpV * .88 * (p.swimmer > 1 ? 1.3 : p.swimmer ? 1.15 : 1); p.buffer = 0; p.jumping = true; p.sx = .85; p.sy = 1.2;   // (the peach: stronger strokes)
      burst(W, p.x + p.w / 2, p.y + p.h, 6, ['#7FB0E0', '#D9D0F0'], 70, 150, 2);
      W.emit('swim');
    } else if (p.buffer > 0 && p.wallCoyote > 0 && !p.onGround) {
      const away = -p.wallDir;
      p.vy = -jumpV * .92 * Math.sqrt(T.wallJump); p.vx = away * WALL_KICK * T.wallKick; p.face = away; p.lock = .16;
      p.buffer = 0; p.wallCoyote = 0; p.jumping = true; p.sliding = false; p.sx = .8; p.sy = 1.25;
      burst(W, p.wallDir > 0 ? p.x + p.w : p.x, p.y + p.h / 2, 7, ['#9A8FBF', '#D9D0F0'], 90, 200, 2);
      const wx = p.wallDir > 0 ? p.x + p.w : p.x;
      burst(W, wx, p.y + p.h / 2, 10, ['#D9D0F0', '#9A8FBF', '#A99CC4'], 150, 300, 2.5);
      for (let k = 0; k < 5; k++) W.particles.push({ x: wx, y: p.y + 4 + k * 5, vx: away * (60 + k * 25), vy: -30 - k * 10, life: .3, max: .3, c: '#D9D0F0', size: 2, g: 200 });
      ring(W, wx, p.y + p.h / 2, 22, '217,208,240', .25);
      p.trail = .22; p.trailC = '154,143,191'; W.shake = Math.max(W.shake, .05);
      W.emit('walljump');
    } else if (p.buffer > 0 && p.airJumps > 0 && !p.onGround) {
      p.vy = -jumpV * .9; p.airJumps--; p.buffer = 0; p.jumping = true; p.sx = .8; p.sy = 1.25;
      burst(W, p.x + p.w / 2, p.y + p.h, 12, ['#FFE066', '#FFF6C2'], 110, 100, 2.5);
      ring(W, p.x + p.w / 2, p.y + p.h, 26, '255,224,102', .3);
      p.trail = .25; p.trailC = '255,224,102';
      W.emit('djump');
    } else if (spin && p.glide && !p.onGround && !p.spun && !wet) {
      // The pear's spin: a small lift in mid-air, once (after the acorn of the Mario games). After
      // it you can't glide and fall at up to SPUN_FALL till you land: a wall jump doesn't give
      // it back (or you could spin your way up any wall).
      // (The banana's double jump goes up at .9 of a jump; height goes with the square of that.)
      p.vy = Math.min(p.vy, -jumpV * .9 * Math.sqrt(SPIN_HEIGHT)); p.spun = true; p.buffer = 0; p.jumping = false; p.sx = 1.2; p.sy = .85;
      burst(W, p.x + p.w / 2, p.y + p.h / 2, 12, ['#C5D94A', '#E4F08A'], 120, 60, 2.5);
      ring(W, p.x + p.w / 2, p.y + p.h / 2, 24, '197,217,74', .3);
      W.emit('djump');
    }
    if (p.jumping && !input.jump && p.vy < 0) { p.vy *= .45; p.jumping = false; }
    if (p.vy >= 0) p.jumping = false;
    if (wet) {
      p.vy = Math.min(SINK * (p.swimmer > 1 ? .3 : p.swimmer ? .5 : 1), p.vy + grav * WATER_G * dt);
      if (Math.random() < .05) W.particles.push({ x: p.x + p.w / 2 + p.face * 4, y: p.y + 4, vx: 0, vy: -40, life: .6, max: .6, c: '#9FD8FF', size: 2, g: -60 });
    } else p.vy = Math.min(MAXFALL * Math.sqrt(T.gravity), p.vy + grav * dt * (p.vy > 0 ? 1.15 : 1));
    // The pear's glide: holding jump while falling, you float down slowly. After its spin you
    // can't glide, and fall at up to SPUN_FALL, wall jumps and all, till you land.
    if (p.glide && p.spun && !wet) p.vy = Math.min(p.vy, SPUN_FALL);
    p.gliding = !!(p.glide && !p.spun && !p.onGround && !wet && !p.sliding && input.jump && p.vy > 0);
    if (p.gliding) { p.vy = Math.min(p.vy, GLIDE_FALL * (p.glide > 1 ? .6 : 1)); if (Math.random() < .15) W.particles.push({ x: p.x + p.w / 2 + (Math.random() - .5) * 20, y: p.y, vx: 0, vy: -30, life: .4, max: .4, c: '#C5D94A', size: 2, g: 0 }); }
    if (p.sliding) {
      p.vy = Math.min(p.vy, WALL_SLIDE * T.wallSlide / (p.grip > 1 ? 6 : p.grip ? 3 : 1));
      if (Math.random() < .12) W.particles.push({ x: p.wall > 0 ? p.x + p.w : p.x, y: p.y + p.h - 4, vx: -p.wall * 20, vy: -30, life: .35, max: .35, c: '#9A8FBF', size: 2, g: 200 });
    }
    if (p.boost > 0 && Math.random() < .08) W.particles.push({ x: p.x + Math.random() * p.w, y: p.y + p.h, vx: 0, vy: -40, life: .4, max: .4, c: '#FFB547', size: 2, g: -40 });
    if (p.fast > 0 && p.onGround && Math.abs(p.vx) > RUN && Math.random() < .3) W.particles.push({ x: p.x + p.w / 2 - Math.sign(p.vx) * 8, y: p.y + p.h - 2, vx: -p.vx * .2, vy: -20, life: .3, max: .3, c: '#7FD87A', size: 2, g: 0 });
    if (p.dbl > 0 && Math.random() < .08) W.particles.push({ x: p.x + Math.random() * p.w, y: p.y + p.h * Math.random(), vx: 0, vy: -20, life: .4, max: .4, c: '#FFE066', size: 2, g: 0 });

    if (p.onPlat && !dropping) { moveX(W, p, p.onPlat.dx); p.y += p.onPlat.dy; }
    // Standing on a turn block, you turn with it (about its middle, from where your feet are).
    if (p.spinOn && p.spinOn.da) {
      const s = p.spinOn, fx = p.x + p.w / 2 - s.cx, fy = p.y + p.h - s.cy, c = Math.cos(s.da), sn = Math.sin(s.da);
      moveX(W, p, fx * c - fy * sn - fx); p.y += fx * sn + fy * c - fy;
    }
    if (p.onGround && p.conv) moveX(W, p, p.conv * CONVEY * dt);

    // Gun: finite ammo, kills anything it hits. Each press fires one shot;
    // holding fire keeps shooting until you let go or run out.
    // Holding Shift makes any shot big: twice the size and blast, twice the ammo.
    p.cool -= dt; p.flash -= dt;
    if (p.hold > 0) {
      p.hold -= dt;
      if (input.firePressed || input.rocketPressed || input.grenadePressed || input.killPressed || input.dynPressed || input.nukePressed) {
        input.firePressed = input.rocketPressed = input.grenadePressed = input.killPressed = input.dynPressed = input.nukePressed = false;
        if (!W.floaters.some(f => f.t === 'steady…')) W.floaters.push({ x: p.x + p.w / 2, y: p.y - 10, t: 'steady…', life: .8, c: '#D9D0F0' });
      }
    }
    const s = input.big ? 2 : 1;
    if ((input.firePressed || input.fire) && p.cool <= 0) {
      const tapped = input.firePressed;
      input.firePressed = false;
      if (p.ammo >= s) {
        p.ammo -= s; p.cool = .16; p.flash = .08;
        const g = LF.gunPos(p);
        W.bullets.push({ id: newShot(W), x: g.x, y: g.y, vx: p.face * BULLET, life: 1.1, s });
        p.vx -= p.face * 40;
        W.emit('shoot');
      } else if (tapped) {
        p.cool = .5; W.emit('empty');
        W.floaters.push({ x: p.x + p.w / 2, y: p.y - 10, t: W.def.noAmmo ? 'no guns in a tower: stomp!' : p.ammo > 0 ? `big shot needs ${s} ammo` : 'no ammo — find a crate', life: 1, c: '#D9D0F0' });
      }
    }
    if (input.killPressed && p.cool <= 0) {
      input.killPressed = false;
      if (p.ammo >= KILL_COST) {
        p.ammo -= KILL_COST; p.cool = .35; p.flash = .12;
        const g = LF.gunPos(p);
        W.bullets.push({ id: newShot(W), x: g.x, y: g.y, vx: p.face * BULLET * 1.25, life: 1.1, s: 1, kill: true });
        p.vx -= p.face * 60;
        W.emit('rocket');
      } else {
        p.cool = .3; W.emit('empty');
        W.floaters.push({ x: p.x + p.w / 2, y: p.y - 10, t: W.def.noAmmo ? 'no guns in a tower: stomp!' : `kill shot needs ${KILL_COST} ammo`, life: 1, c: '#D9D0F0' });
      }
    }
    // X, Q and D work like E: tap for one, hold to keep firing while there's ammo for it.
    for (const kind of ['rocket', 'grenade', 'dyn', 'nuke']) {
      const tapped = input[kind + 'Pressed'];
      // (A nuke only on a fresh press: holding W doesn't keep priming them.)
      if (!tapped && (!input[kind] || kind === 'nuke')) continue;
      if (p.cool > 0) continue;
      input[kind + 'Pressed'] = false;
      const spec = SPECIAL[kind], cost = spec.cost * s;
      if (p.ammo < cost) {
        if (tapped) {
          p.cool = .3; W.emit('empty');
          W.floaters.push({ x: p.x + p.w / 2, y: p.y - 10, t: `${s > 1 ? 'big ' : ''}${spec.name} needs ${cost} ammo`, life: 1, c: '#D9D0F0' });
        }
        continue;
      }
      p.ammo -= cost; p.cool = .4; p.flash = .1;
      const g = LF.gunPos(p);
      if (kind === 'rocket') W.bullets.push({ id: newShot(W), kind, x: g.x, y: g.y, vx: p.face * 430, vy: 0, life: 1.6, s });
      else if (kind === 'dyn') W.bullets.push({ id: newShot(W), kind, x: g.x, y: g.y - 4, vx: p.face * 240 + p.vx * .3, vy: -380, life: FUSE, s });
      else if (kind === 'nuke') W.bullets.push({ id: newShot(W), kind, x: p.x + p.w / 2, y: p.y + p.h - 8, vx: 0, vy: 0, life: FUSE, s });
      else W.bullets.push({ id: newShot(W, 3), kind, x: g.x, y: g.y - 4, vx: p.face * 270 + p.vx * .3, vy: -420, life: 2.2, bounces: 0, s });
      if (kind !== 'dyn' && kind !== 'nuke') p.vx -= p.face * 70;
      W.emit(kind === 'rocket' ? 'rocket' : 'lob');
    }

    const wasAir = !p.onGround, fallSpeed = p.vy;
    p.onGround = false; p.onPlat = null; p.spinOn = null; p.conv = 0; p.ice = false;
    if (moveX(W, p, p.vx * dt)) p.vx = 0;
    const pb = p.y + p.h;
    const hit = moveY(W, p, p.vy * dt, dropping);
    let bounced = false;
    if (hit && hit.dir === 'down') {
      p.vy = 0; p.onGround = true;
      for (const u of hit.under) {
        if (u.c === 'O') bounced = true;
        if (u.c === '<') p.conv = -1; else if (u.c === '>') p.conv = 1;
        if (u.c === 'i') p.ice = true;
        if (u.c === 'C' && !W.crumbles.some(c => c.tx === u.tx && c.ty === u.ty)) W.crumbles.push({ tx: u.tx, ty: u.ty, t: 0, state: 'shake' });
      }
    } else if (hit && hit.dir === 'up') { p.vy = 0; p.jumping = false; if (hit.sw) hitSwitch(W, ...hit.sw); if (hit.panel) hitPanel(W, ...hit.panel); }
    // On a slope: stood on its surface (and kept on it walking down).
    if (onSlope(W, p, !wasAir)) { p.onGround = true; p.coyote = .1; }

    if (!p.onGround && p.vy >= 0 && !dropping) {
      for (const pl of W.plats) {
        if (pl.state === 'gone' || pl.sunk) continue;
        if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && pb <= Math.max(pl.prevY, pl.y) + 1 && p.y + p.h >= pl.y) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.onPlat = pl;
          if (pl.kind === 'fall' && pl.state === 'idle') { pl.state = 'shake'; pl.t = 0; }
          break;
        }
      }
      // Crusher tops work like a moving platform (you can ride them, not stomp them).
      if (!p.onGround) for (const t of W.traps) {
        if (t.type !== 'crush') continue;
        if (p.x + p.w > t.x + 2 && p.x < t.x + t.w - 2 && pb <= Math.max(t.prevY ?? t.y, t.y) + 1 && p.y + p.h >= t.y) {
          p.y = t.y - p.h; p.vy = 0; p.onGround = true; p.onPlat = t; break;
        }
      }
    }
    // Turn blocks: pushed out of the square the shortest way. Pushed up out of its top (a
    // face no steeper than about 50°), you're standing on it; against a steeper face in the
    // air, it's a wall: slide down it and jump off it like any other.
    p.spinWallT = Math.max(0, (p.spinWallT || 0) - dt);
    for (const sp of W.spinners) {
      const m = spinnerPush(sp, p);
      if (!m) continue;
      p.x += m.x; p.y += m.y;
      if (m.y < 0 && -m.y > Math.abs(m.x) * .8) { if (p.vy > 0) p.vy = 0; p.onGround = true; p.spinOn = sp; }
      else if (m.y > 0 && m.y > Math.abs(m.x)) { if (p.vy < 0) { p.vy = 0; p.jumping = false; } }
      else {
        if (Math.sign(m.x) !== Math.sign(p.vx)) p.vx = 0;
        if (Math.abs(m.x) >= Math.abs(m.y)) { p.spinWallT = .12; p.spinWallSide = -Math.sign(m.x); }
      }
    }
    if (bounced) {
      p.vy = -SPRING * Math.sqrt(T.gravity); p.onGround = false; p.coyote = 0; p.jumping = false; p.sx = .7; p.sy = 1.35;
      burst(W, p.x + p.w / 2, p.y + p.h, 10, ['#FFB547', '#D9D0F0'], 120, 300, 2);
      ring(W, p.x + p.w / 2, p.y + p.h, 30, '255,181,71', .3);
      p.trail = .4; p.trailC = '255,181,71';
      W.emit('spring');
    } else if (p.onGround && wasAir && fallSpeed > 250) {
      p.sx = 1.3; p.sy = .72;
      burst(W, p.x + p.w / 2, p.y + p.h, fallSpeed > 700 ? 16 : 8, ['#9A8FBF', '#D9D0F0'], fallSpeed > 700 ? 140 : 80, 250, 2);
      if (fallSpeed > 700) { ring(W, p.x + p.w / 2, p.y + p.h, 30, '217,208,240', .3); W.shake = Math.max(W.shake, .08); }
      W.emit('land');
    }
    p.sx += (1 - p.sx) * Math.min(1, dt * 14);
    p.sy += (1 - p.sy) * Math.min(1, dt * 14);
    p.anim += dt * (Math.abs(p.vx) / run);
    trail(W, p, dt, '154,143,191');

    // Water at the bottom edge of the map has a floor: you can't sink out of the world.
    if (p.y + p.h > W.h * TS && tile(W, Math.floor((p.x + p.w / 2) / TS), W.h - 1) === '~') { p.y = W.h * TS - p.h; p.vy = Math.min(p.vy, 0); }
    if (p.y > W.h * TS + 60) return kill(W);
    // Lava kills outright, still or moving: the shield doesn't help, and nor does being
    // invincible for a moment after a hit (or you could fall into it and walk out).
    if (lavaAt(W, p) || inFlow(W, p)) { p.shield = 0; return kill(W); }
    if (hazardHit(W, p, true)) { hurt(W); if (p.dead) return; }
    if (p.inv <= 0 && trapHit(W, p)) { hurt(W); if (p.dead) return; }
    // Crusher sides push you out instead of hurting.
    for (const t of W.traps) {
      if (t.type !== 'crush' || p.onPlat === t || !overlap(p, { x: t.x, y: t.y + 4, w: t.w, h: t.h - 10 })) continue;
      if (p.x + p.w / 2 < t.x + t.w / 2) p.x = t.x - p.w; else p.x = t.x + t.w;
      p.vx = 0;
    }
    if (hordeCaught(W, p)) return;

    for (const e of W.enemies) {
      if (!e.alive || e.phased || !overlap(p, e)) continue;
      const spec = LF.ENEMIES[e.type];
      if (e.type === 'G' && e.fade > .85) continue;
      // The Shellback (see stepEnemy): stomp it, walking or shooting along, and it's a shell
      // lying still; touch a still shell and you kick it, off the other way from the side you
      // touched it on; a shell shooting along hurts you like any enemy (but not in the
      // moment just after you kick it).
      if (e.type === 'ĸ' && !(p.rush > 0)) {
        // (Just kicked or thrown it can't hurt you, but only while it's going away from you:
        // one that comes straight back off a wall does.)
        const coming = e.state === 'spin' && Math.sign(e.vx) === Math.sign(p.x + p.w / 2 - (e.x + e.w / 2));
        if (e.state === 'carried' || (e.stompCool > 0 && !coming)) continue;
        // (Up in the air, a shell's easier to land on: feet anywhere over its middle will do,
        // rising or falling. That's what makes the shell jump possible.)
        const top = p.vy > 0 && p.y + p.h - e.y < 14 || (!supported(W, e) && p.y + p.h < e.y + e.h * .6);
        // (Holding S, run into a shell lying still: you pick it up and carry it.)
        if (e.state === 'shell' && input.carry && !p.carrying && !top) {
          e.state = 'carried'; e.vx = 0; p.carrying = e; W.emit('hop');
          W.floaters.push({ x: e.x + e.w / 2, y: e.y - 10, t: 'S to let go', life: 1.2, c: '#9FF0C8' });
          continue;
        }
        if (e.state === 'shell') {
          const dir = p.x + p.w / 2 < e.x + e.w / 2 ? 1 : -1;
          e.state = 'spin'; e.vx = dir * SHELL_SPEED; e.stompCool = .3; e.shot = 0;
          if (top) { p.vy = (input.jump ? -620 : -460) * Math.sqrt(T.gravity); p.jumping = input.jump; p.spun = false; }
          ring(W, e.x + e.w / 2, e.y + e.h / 2, 26, '159,240,200'); W.emit('stomp', { type: e.type });
        } else if (top) {
          // (Stomped in mid-air, it gives you a far bigger bounce.)
          const midair = !supported(W, e);
          e.state = 'shell'; e.shellT = SHELL_WAIT; e.vx = 0; e.stompCool = .3;
          p.vy = (midair ? -AIR_STOMP : input.jump ? -620 : -460) * Math.sqrt(T.gravity); p.jumping = input.jump && !midair; p.spun = false;
          if (midair) W.floaters.push({ x: e.x + e.w / 2, y: e.y - 18, t: 'air stomp!', life: .9, c: '#9FF0C8' });
          W.floaters.push({ x: e.x + e.w / 2, y: e.y - 6, t: 'stomp', life: .8, c: '#FF6B3D' });
          W.shake = .1; W.emit('stomp', { type: e.type });
        } else { hurt(W); if (p.dead) return; }
        continue;
      }
      // A tomato rush: whatever you touch dies; a boss takes a hit (and flies into its fury,
      // or falls on its last), at most one a stomp's pause apart. Nothing hurts you.
      if (p.rush > 0) {
        if (!spec.boss) { shootEnemy(W, e, Math.sign(e.x - p.x) || 1, null, 'KO', 999); continue; }
        if (!(e.fury > 0) && !(e.stompCool > 0)) { e.stompCool = .4; W.shake = .15; shootEnemy(W, e, 0, null, 'rush'); }
        continue;
      }
      // (Any stomp, or a bounce off a raging boss, ends the pear's spin: you can glide again.)
      // A boss in a fury can't be stomped: you just bounce off it.
      if (spec.boss && e.fury > 0) {
        if (p.vy > 0 && p.y + p.h - e.y < 18) {
          p.vy = -560 * Math.sqrt(T.gravity); p.jumping = false; p.spun = false;
          if (!W.floaters.some(f => f.t === 'it’s raging!')) W.floaters.push({ x: e.x + e.w / 2, y: e.y - 8, t: 'it’s raging!', life: .8, c: '#FF4D3D' });
        } else if (e.stompCool <= 0) { hurt(W); if (p.dead) return; }
        continue;
      }
      // Armored heads (bosses, golems until their last hit, and TNT carts, whose last stomp
      // sets them off) can be stomped again and again, with a short pause between.
      if ((spec.stomp || e.dazed > 0) && (spec.boss || e.hp > 1 || e.type === '@')) {
        if (p.vy > 0 && p.y + p.h - e.y < 18) {
          p.vy = (input.jump ? -680 : -520) * Math.sqrt(T.gravity); p.jumping = input.jump; p.spun = false;
          if (e.stompCool <= 0) {
            e.stompCool = .4; W.shake = .15;
            W.floaters.push({ x: e.x + e.w / 2, y: e.y - 6, t: 'stomp', life: .8, c: '#FF6B3D' });
            W.emit('stomp', { type: e.type });
            shootEnemy(W, e, 0, null, 'stomp');
          }
        } else if (e.stompCool <= 0) { hurt(W); if (p.dead) return; }
        continue;
      }
      // (In a level of stomp chains, def.batChain, a bat you brush past on the way up doesn't
      // hurt: only coming down on it counts, as a stomp.)
      if (W.def.batChain && e.type === 'F' && p.vy <= 0) continue;
      // (In a level of stomp chains, def.batChain, falling onto a bat anywhere counts.)
      if (spec.stomp && p.vy > 0 && (p.y + p.h - e.y < 14 || (W.def.batChain && e.type === 'F'))) {
        // (def.batLift: an updraft in a tower of bats, every bounce higher.)
        e.alive = false; dropAmmo(W, e); p.vy = (input.jump ? -620 : -460) * Math.sqrt(T.gravity) * (W.def.batLift || 1); p.jumping = input.jump; p.spun = false;
        burst(W, e.x + e.w / 2, e.y + e.h / 2, 14, ['#FF6B3D', '#463C6B'], 160, 500);
        W.floaters.push({ x: e.x + e.w / 2, y: e.y - 6, t: 'stomp', life: .8, c: '#FF6B3D' });
        W.shake = .12; W.freeze = .05; ring(W, e.x + e.w / 2, e.y + e.h / 2, 28, '255,107,61'); W.emit('stomp', { type: e.type, kill: true });
      } else { hurt(W); if (p.dead) return; }
    }

    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    for (const l of W.lanterns) {
      if (l.lit || Math.abs(cx - l.x) > 22 || Math.abs(cy - l.y) > 26) continue;
      l.lit = true; l.pop = 1; W.lanternLit = true;
      // (The coins you've got so far are kept now: come back after a fall and they're still
      // yours for this go. See def.resume.)
      W.coinsAtLamp = W.coins.map(c => !!c.taken);
      const cp = checkpointAt(W, l);
      if (cp) { W.checkpoint = cp; W.cpBoss = !!W.bossClock; }
      burst(W, l.x, l.y, 22, WARM, 150, 120, 2.5);
      const lit = W.lanterns.filter(q => q.lit).length;
      W.floaters.push({ x: l.x, y: l.y - 22, t: `${lit}/${W.total}`, life: 1, c: '#FFB547' });
      W.emit('light', { lit, total: W.total });
      openDoorIfDone(W);
    }

    for (const k of W.keys) {
      if (k.taken || Math.abs(cx - k.x) > 20 || Math.abs(cy - k.y) > 22) continue;
      const spec = LF.KEYS[k.c];
      k.taken = true; p.keys[k.c] = true;
      burst(W, k.x, k.y, 22, [spec.color, '#FFF1CF'], 150, 150, 2.5);
      ring(W, k.x, k.y, 34, '255,241,207', .4);
      W.floaters.push({ x: k.x, y: k.y - 20, t: spec.name.toLowerCase(), life: 1.2, c: spec.color });
      W.emit('key');
    }
    // Touching a locked door block while holding its key opens that one block. You keep the key.
    for (const kc in p.keys) {
      const gate = LF.KEYS[kc].gate;
      const x0 = Math.floor((p.x - 3) / TS), x1 = Math.floor((p.x + p.w + 3) / TS);
      const y0 = Math.floor((p.y - 3) / TS), y1 = Math.floor((p.y + p.h + 3) / TS);
      let hit = null;
      for (let ty = y0; ty <= y1 && !hit; ty++) for (let tx = x0; tx <= x1 && !hit; tx++) if (tile(W, tx, ty) === gate) hit = { tx, ty };
      if (!hit) continue;
      unlock(W, gate, hit.tx, hit.ty, cx, cy);
    }

    for (const a of W.ammo) {
      // (With the cherry's magnet, crates nearby come flying to you.)
      if (!a.taken && p.magnet && Math.hypot(cx - a.x, cy - a.y) < (p.magnet > 1 ? 8 : 4) * TS && !(Math.abs(cx - a.x) <= 20 && Math.abs(cy - a.y) <= 22)) {
        a.taken = true; W.ammoFly.push({ n: a.n, x: a.x, y: a.y, vx: 0, vy: -120, t: .2 });
        burst(W, a.x, a.y, 10, ['#FFE2A8', '#B3123A'], 110, 100, 2); W.emit('ammo');
        continue;
      }
      if (a.taken || Math.abs(cx - a.x) > 20 || Math.abs(cy - a.y) > 22) continue;
      a.taken = true; p.ammo += a.n;
      burst(W, a.x, a.y, a.huge ? 40 : a.big ? 24 : 12, ['#FFE2A8', '#FFB547'], a.huge ? 180 : 130, 150, 2.5);
      W.floaters.push({ x: a.x, y: a.y - 20, t: `+${a.n} ammo`, life: 1.1, c: '#FFE2A8' });
      W.emit(a.big ? 'bigammo' : 'ammo');
    }

    for (const f of W.fruits) {
      if (f.taken || Math.abs(cx - f.x) > 20 || Math.abs(cy - f.y) > 22) continue;
      const spec = LF.FRUITS[f.type];
      f.taken = true; f.regrow = W.def.noRegrow ? Infinity : REGROW; f.pop = 1;
      LF.applyFruit(p, f.type);
      W.got[f.type] = (W.got[f.type] || 0) + 1;
      burst(W, f.x, f.y, 16, [spec.color, '#FFF6C2'], 130, 150, 2.5);
      W.floaters.push({ x: f.x, y: f.y - 20, t: f.type === 'a' && p.shield > 1 ? `shield ×${p.shield}` : spec.power.toLowerCase(), life: 1.1, c: spec.color });
      W.emit('fruit', { type: f.type });
    }

    // Star coins: touch one to pick it up (it's yours for good when you finish the level; die
    // first and it isn't). One you already have is only a ring: nothing to pick up.
    // (A shell you've kicked or are carrying picks a coin up for you too.)
    const shellOn = c => W.enemies.some(s => s.type === 'ĸ' && s.alive && (s.state === 'spin' || s.state === 'carried') && Math.abs(s.x + s.w / 2 - c.x) < s.w / 2 + 10 && Math.abs(s.y + s.h / 2 - c.y) < s.h / 2 + 10);
    for (const c of W.coins) {
      if (c.taken || c.had || (!(Math.abs(cx - c.x) <= 22 && Math.abs(cy - c.y) <= 24) && !shellOn(c))) continue;
      c.taken = true; c.pop = 1; (W.coinsGot ||= [])[c.k] = true;
      burst(W, c.x, c.y, 26, ['#FFE066', '#FFF6C2', '#FFB547'], 180, 120, 3);
      ring(W, c.x, c.y, 40, '255,224,102', .5);
      W.floaters.push({ x: c.x, y: c.y - 24, t: `★ coin ${W.coins.filter(q => q.taken || q.had).length}/${W.coins.length}`, life: 1.4, c: '#FFE066' });
      W.emit('coin', { k: c.k });
    }

    // A passage door takes you through to the next part of the level.
    for (const [k, d] of W.passages.entries()) {
      const to = W.entries[k];
      if (!to || !overlap(p, { x: d.x + 8, y: d.y + 10, w: 16, h: d.h - 10 })) continue;
      // (A flash where you go in and where you come out: see drawPassage.)
      W.warps = [{ x: d.x + 16, y: d.y + 32, t: W.clock }, { x: to.tx * TS + 16, y: to.ty * TS, t: W.clock }];
      p.x = to.tx * TS + (TS - p.w) / 2; p.y = (to.ty + 1) * TS - p.h; p.vx = p.vy = 0;
      burst(W, p.x + p.w / 2, p.y + p.h / 2, 24, ['#9FF0E0', '#B9A6FF', '#FFFFFF'], 180, 60, 2.5);
      W.emit('warp');
      break;
    }
    // The secret exit shows itself when you step into its hidden room (through a false
    // wall), or, if it isn't in one, when you come within 3 tiles of it.
    const sd = W.secret;
    if (sd && !W.secretSeen) {
      let found = false;
      if (sd.hidden) {
        for (let ty = Math.floor(p.y / TS); ty <= Math.floor((p.y + p.h - 1) / TS) && !found; ty++)
          for (let tx = Math.floor(p.x / TS); tx <= Math.floor((p.x + p.w - 1) / TS); tx++) if (tile(W, tx, ty) === 'l' && Math.abs(tx - sd.tx) <= 3 && Math.abs(ty - sd.ty) <= 3) { found = true; break; }
      } else found = Math.hypot(cx - (sd.x + 16), cy - (sd.y + 30)) < TS * 3;
      if (found) {
        W.secretSeen = true;
        W.floaters.push({ x: sd.x + 16, y: sd.y - 14, t: 'a secret!', life: 1.4, c: '#9FD8FF' });
        W.emit('key');
      }
    }
    // Leaving by the secret exit clears the level too, the secret way.
    if (sd && overlap(p, { x: sd.x + 8, y: sd.y + 10, w: 16, h: sd.h - 10 })) {
      W.cleared = true; W.clearedBy = 'secret';
      burst(W, sd.x + 16, sd.y + 20, 40, ['#9FD8FF', '#D9D0F0', '#FFE2A8'], 260, 200, 3);
      W.emit('secretExit'); W.emit('clear');
      return;
    }
    const d = W.door;
    if (d && d.open && overlap(p, { x: d.x + 8, y: d.y + 10, w: 16, h: d.h - 10 })) {
      W.cleared = true; W.clearedBy = 'door';
      burst(W, d.x + 16, d.y + 20, 40, WARM, 260, 200, 3);
      W.emit('clear');
    }
  }

  // Checkpoint: the first safe standing tile at or below the lantern; null keeps the old checkpoint.
  // Where you come back at a lantern: on firm ground under it, or the nearest firm ground
  // to either side a little lower down (not crumbling stone or blinking blocks, which might
  // not be there).
  // Failing that, blinking or crumbling ground; failing that (a lantern over falling
  // shingles, say), right at the lantern.
  const firm = c => (isSolid(c) && c !== 'C' && c !== 'T' && c !== 'H') || c === '=' || c === 'O';
  const footing = c => isSolid(c) || c === '=';
  function checkpointAt(W, l) {
    const dxs = [0]; for (let d = 1; d <= 10; d++) dxs.push(-d, d);
    for (const ok of [firm, footing]) for (const dx of dxs) {
      const tx = l.tx + dx;
      for (let y = l.ty - (dx ? 2 : 0); y < Math.min(W.h - 1, l.ty + 14); y++) {
        const here = tile(W, tx, y);
        if (isSolid(here) || here === '^' || here === '~' || here === '!') break;
        if (ok(tile(W, tx, y + 1)) && !isSolid(tile(W, tx, y - 1))) return { tx, ty: y };
      }
    }
    return { tx: l.tx, ty: l.ty };
  }
})();
