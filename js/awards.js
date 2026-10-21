// Lanternfall awards: counters and one-off feats, saved in this browser, with a toast when earned.
(() => {
  const LF = window.LF;
  const KEY = 'lanternfall.awards', STATS = 'lanternfall.stats';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let got = load(KEY, {}), stats = load(STATS, {});

  // goal + stat: a counter award with a progress bar. Otherwise it's earned by a one-off check.
  const AWARDS = [
    { id: 'first', name: 'First Light', desc: 'Clear the first level.' },
    { id: 'clear10', name: 'Lamplighter', desc: 'Clear 10 story levels.', stat: 'storyLit', goal: 10 },
    { id: 'clear25', name: 'Halfway Home', desc: 'Clear 25 story levels.', stat: 'storyLit', goal: 25 },
    { id: 'clearAll', name: 'Every Lamp Burns', desc: 'Clear every story level.', stat: 'storyLit', goal: () => LF.LEVELS.length },
    { id: 'flawless', name: 'Not a Scratch', desc: 'Clear a story level without falling once.' },
    { id: 'quick', name: 'Quick Flame', desc: 'Clear a story level in under 15 seconds.' },
    { id: 'hc1', name: 'Hard as Wax', desc: 'Clear a story level on Hardcore.' },
    { id: 'hc10', name: 'Iron Wick', desc: 'Clear 10 story levels on Hardcore.', stat: 'hcLit', goal: 10 },
    { id: 'horde', name: 'Outran the Dark', desc: 'Clear a story level with a horde in it.' },
    { id: 'random', name: 'Wanderer', desc: 'Clear a random map.' },
    { id: 'stomp', name: 'Stompy', desc: 'Stomp 50 enemies.', stat: 'stomp', goal: 50 },
    { id: 'zap', name: 'Sharpshooter', desc: 'Shoot 100 enemies.', stat: 'zap', goal: 100 },
    { id: 'golem', name: 'Giant Slayer', desc: 'Bring down an iron golem.' },
    { id: 'boss', name: 'Boss Breaker', desc: 'Defeat a boss.' },
    { id: 'bossAll', name: 'Monster Hunter', desc: 'Defeat 5 different bosses.', stat: 'bossKinds', goal: 5 },
    { id: 'final', name: 'Dawn', desc: 'Defeat the Last Dark.' },
    { id: 'finalShell', name: 'Shell Shock', desc: 'Defeat the Last Dark after hitting it with a Shellback shell.' },
    { id: 'secret', name: 'Off the Path', desc: 'Leave a level by its secret exit.' },
    { id: 'bubble', name: 'Bubble Popper', desc: 'Shoot a lava bubble out of the air.' },
    { id: 'wall', name: 'Wall Runner', desc: 'Wall jump 100 times.', stat: 'walljump', goal: 100 },
    { id: 'djump', name: 'Second Wind', desc: 'Double jump 25 times.', stat: 'djump', goal: 25 },
    { id: 'swim', name: 'Deep Diver', desc: 'Kick 50 times while swimming.', stat: 'swim', goal: 50 },
    { id: 'fruit', name: 'Fruit Salad', desc: 'Eat an apple, an orange and a banana.', stat: 'fruitKinds', goal: 3 },
    { id: 'shield', name: 'Close Call', desc: 'Let an apple shield take a hit for you.' },
    { id: 'keys', name: 'Keymaster', desc: 'Unlock 20 locked-door blocks.', stat: 'unlock', goal: 20 },
    { id: 'crates', name: 'Challenge Accepted', desc: 'Grab 5 big ammo crates.', stat: 'bigammo', goal: 5 },
    { id: 'falls', name: 'Persistence', desc: 'Fall 100 times. It happens.', stat: 'falls', goal: 100 },
    { id: 'architect', name: 'Architect', desc: 'Save a level of your own in the editor.' },
    // ---- More of the story ----
    { id: 'clear50', name: 'Fifty Flames', desc: 'Clear 50 story levels.', stat: 'storyLit', goal: 50 },
    { id: 'clear100', name: 'A Hundred Lamps', desc: 'Clear 100 story levels.', stat: 'storyLit', goal: 100 },
    { id: 'clear150', name: 'Town Ablaze', desc: 'Clear 150 story levels.', stat: 'storyLit', goal: 150 },
    { id: 'clear200', name: 'Beacon', desc: 'Clear 200 story levels.', stat: 'storyLit', goal: 200 },
    ...['Old Town', 'The Waterfront', 'The Clockwork Quarter', 'The Sky Roads', 'The Canal District', 'The Garden Market', 'The Smokelands', 'The Glass Mines', 'Night’s End'].map((w, k) => ({ id: 'world' + k, name: `${w} Aglow`, desc: `Clear every level in ${w}.` })),
    { id: 'secret5', name: 'Pathfinder', desc: 'Find 5 secret exits.', stat: 'secrets', goal: 5 },
    { id: 'secret10', name: 'Hidden Ways', desc: 'Find 10 secret exits.', stat: 'secrets', goal: 10 },
    { id: 'secretAll', name: 'Cartographer', desc: 'Find every secret exit.', stat: 'secrets', goal: () => LF.LEVELS.filter(l => l.secretTo != null).length },
    // ---- Bosses ----
    ...[['5', 'Bellwether'], ['6', 'Soot Queen'], ['7', 'Ash Marksman'], ['8', 'Iron Colossus'], ['9', 'Powder King'], ['Ø+', 'Void'], ['Ɱ+', 'Melon Brute']].map(([t, n]) => ({ id: 'boss' + t, boss: t, name: `Down Goes the ${n}`, desc: `Defeat the ${n}.` })),
    ...[['Γ+', 'Candle King', 'Snuffed'], ['Ξ+', 'Clockwork Knight', 'Unwound'], ['Λ+', 'Storm Roc', 'Grounded'], ['Φ+', 'Pumpkin Knight', 'Carved'], ['Ψ+', 'Smog Dragon', 'Clear Skies'], ['Σ+', 'Crystal Mole', 'Shattered'], ['Θ+', 'Drowned King', 'Dethroned'], ['Ж+', 'Tide Serpent', 'Low Tide']].map(([t, n, title]) => ({ id: 'boss' + t, boss: t, name: title, desc: `Defeat the ${n} in its castle.` })),
    { id: 'boss10', name: 'Trophy Room', desc: 'Defeat 10 different bosses.', stat: 'bossKinds', goal: 10 },
    { id: 'boss25', name: 'Legend of the Lamps', desc: 'Defeat 25 different bosses.', stat: 'bossKinds', goal: 25 },
    // ---- Skill ----
    { id: 'quick60', name: 'Brisk', desc: 'Clear a story level in under a minute.' },
    { id: 'quick120', name: 'No Dawdling', desc: 'Clear a story level in under two minutes.' },
    { id: 'flawless10', name: 'Sure-Footed', desc: 'Clear 10 story levels without falling.', stat: 'flawless', goal: 10 },
    { id: 'flawless25', name: 'Untouchable', desc: 'Clear 25 story levels without falling.', stat: 'flawless', goal: 25 },
    { id: 'hc25', name: 'Tempered', desc: 'Clear 25 story levels on Hardcore.', stat: 'hcLit', goal: 25 },
    { id: 'hc50', name: 'Forged', desc: 'Clear 50 story levels on Hardcore.', stat: 'hcLit', goal: 50 },
    { id: 'hurry', name: 'Photo Finish', desc: 'Clear a level after the hurry-up tune.' },
    { id: 'timeup', name: 'Out of Time', desc: 'Let the clock run out.' },
    // ---- Feats of the hands and feet ----
    { id: 'stomp250', name: 'Heavy Boots', desc: 'Stomp 250 enemies.', stat: 'stomp', goal: 250 },
    { id: 'zap500', name: 'Marksman', desc: 'Shoot 500 enemies.', stat: 'zap', goal: 500 },
    { id: 'wall500', name: 'Parkour', desc: 'Wall jump 500 times.', stat: 'walljump', goal: 500 },
    { id: 'swim250', name: 'Otter', desc: 'Kick 250 times while swimming.', stat: 'swim', goal: 250 },
    { id: 'spring', name: 'Boing', desc: 'Bounce off springs 100 times.', stat: 'spring', goal: 100 },
    { id: 'warp', name: 'Through the Swirl', desc: 'Go through 50 passage doors.', stat: 'warp', goal: 50 },
    { id: 'golem10', name: 'Scrap Merchant', desc: 'Bring down 10 iron golems.', stat: 'golems', goal: 10 },
    { id: 'cart', name: 'Demolition', desc: 'Blow up a TNT cart.' },
    { id: 'cart10', name: 'Powder Monkey', desc: 'Blow up 10 TNT carts.', stat: 'carts', goal: 10 },
    { id: 'shield25', name: 'Well Padded', desc: 'Let apple shields take 25 hits for you.', stat: 'shields', goal: 25 },
    { id: 'ammo100', name: 'Stocked Up', desc: 'Pick up 100 ammo crates.', stat: 'ammo', goal: 100 },
    { id: 'lamps100', name: 'Lantern Bearer', desc: 'Light 100 lanterns.', stat: 'light', goal: 100 },
    // ---- Fruit ----
    ...[['a', 'Apple', 'An Apple a Day'], ['o', 'Orange', 'Zest'], ['b', 'Banana', 'Top Banana'], ['m', 'Watermelon', 'Seed Spitter'], ['p', 'Pear', 'Glider'], ['s', 'Strawberry', 'Sticky Fingers'], ['ç', 'Cherry', 'Magnetic'], ['ƀ', 'Blueberry', 'Night Owl'], ['ƥ', 'Pineapple', 'Prickly'], ['ǥ', 'Grapes', 'Lucky Bunch'], ['ƫ', 'Peach', 'Just Peachy'], ['ɯ', 'Mango', 'Slow Down']].map(([t, n, title]) => ({ id: 'fruit' + t, fruit: t, name: title, desc: `Eat a ${n.toLowerCase()}.` })),
    { id: 'fruitAll', name: 'Orchard Keeper', desc: 'Eat every kind of fruit.', stat: 'fruitKinds', goal: () => Object.keys(LF.FRUITS).length },
    { id: 'fruit100', name: 'Five a Day', desc: 'Eat 100 fruit.', stat: 'fruitEaten', goal: 100 },
    { id: 'fruit500', name: 'Fruit Bat', desc: 'Eat 500 fruit.', stat: 'fruitEaten', goal: 500 },
    { id: 'grove', name: 'Pick of the Crop', desc: 'Visit a Fruit Grove.' },
    { id: 'grove10', name: 'Harvest Moon', desc: 'Visit 10 Fruit Groves.', stat: 'groves', goal: 10 },
    // ---- Off the story ----
    { id: 'random10', name: 'Explorer', desc: 'Clear 10 random maps.', stat: 'randoms', goal: 10 },
    { id: 'custom', name: 'Playtester', desc: 'Clear a level from the editor or a shared link.' },
    { id: 'architect5', name: 'Master Builder', desc: 'Save 5 levels of your own.', stat: 'saves', goal: 5 },
  ];
  const goalOf = a => (typeof a.goal === 'function' ? a.goal() : a.goal);

  // Toasts queue up so two awards at once both get seen.
  const queue = [];
  let showing = false;
  function toast(a) { queue.push(a); if (!showing) next(); }
  function next() {
    const el = document.getElementById('award-toast');
    const a = queue.shift();
    if (!el || !a) { showing = false; return; }
    showing = true;
    el.innerHTML = `<span>Award</span><b>${a.name}</b><small>${a.desc}</small>`;
    el.classList.add('show');
    LF.awards.onEarn && LF.awards.onEarn(a);
    setTimeout(() => { el.classList.remove('show'); setTimeout(next, 400); }, 2800);
  }

  function earn(id) {
    if (got[id]) return;
    got[id] = Date.now(); save(KEY, got);
    toast(AWARDS.find(a => a.id === id));
  }
  function bump(stat, n = 1) {
    stats[stat] = (stats[stat] || 0) + n; save(STATS, stats);
    check();
  }
  function check() {
    for (const a of AWARDS) if (a.stat && !got[a.id] && (stats[a.stat] || 0) >= goalOf(a)) earn(a.id);
  }

  LF.awards = {
    list: () => AWARDS.map(a => ({ ...a, goal: a.stat ? goalOf(a) : null, have: a.stat ? Math.min(stats[a.stat] || 0, goalOf(a)) : null, earned: !!got[a.id] })),
    count: () => ({ earned: AWARDS.filter(a => got[a.id]).length, total: AWARDS.length }),
    // Game events from the play loop.
    event(ev) {
      const d = ev.data || {};
      const killed = t => { if (t === 'I') { earn('golem'); bump('golems'); } if (t === '@') { earn('cart'); bump('carts'); } };
      if (ev.type === 'stomp') { bump('stomp'); if (d.kill) killed(d.type); }
      else if (ev.type === 'zap') { bump('zap'); killed(d.type); if (d.type === '*') earn('bubble'); }
      else if (['spring', 'warp', 'shoot', 'rocket', 'lob', 'ammo', 'light'].includes(ev.type)) bump(ev.type);
      else if (ev.type === 'timeup') earn('timeup');
      else if (ev.type === 'hurry') stats.hurried = true;
      else if (ev.type === 'walljump') bump('walljump');
      else if (ev.type === 'djump') bump('djump');
      else if (ev.type === 'swim') bump('swim');
      else if (ev.type === 'unlock') bump('unlock');
      else if (ev.type === 'bigammo') bump('bigammo');
      else if (ev.type === 'shield') { earn('shield'); bump('shields'); }
      else if (ev.type === 'secretExit') earn('secret');
      else if (ev.type === 'bossdown') {
        earn('boss');
        if (d.type === 'Ω+') earn('final');
        if (d.type === 'Ω+' && d.shelled) earn('finalShell');
        if (AWARDS.some(a => a.id === 'boss' + d.type)) earn('boss' + d.type);
        const kinds = new Set(stats.bossSeen || []); kinds.add(d.type);
        stats.bossSeen = [...kinds]; bump('bossKinds', kinds.size - (stats.bossKinds || 0));
      }
      else if (ev.type === 'die') { bump('falls'); stats.hurried = false; }
      else if (ev.type === 'fruit') {
        if (AWARDS.some(a => a.id === 'fruit' + d.type)) earn('fruit' + d.type);
        bump('fruitEaten');
        const kinds = new Set(stats.fruitSeen || []); kinds.add(d.type);
        stats.fruitSeen = [...kinds]; bump('fruitKinds', kinds.size - (stats.fruitKinds || 0));
      }
    },
    // A level was cleared. Only story levels count, except that a random map earns Wanderer.
    clear({ kind, index, time, falls, hardcore, horde, storyLit, hcLit, progress, secrets }) {
      const hurried = stats.hurried; stats.hurried = false;
      if (kind === 'random') { earn('random'); bump('randoms'); return; }
      if (kind === 'custom') return earn('custom');
      if (kind !== 'story') return;
      if (index === 0) earn('first');
      if (time < 15) earn('quick');
      if (time < 60) earn('quick60');
      if (time < 120) earn('quick120');
      if (hurried) earn('hurry');
      if (falls === 0) { earn('flawless'); bump('flawless'); }
      // (A world all lit.)
      if (progress) LF.WORLDS.forEach((w, k) => { let all = true; for (let i = w.first; i <= w.last; i++) if (!progress[i]) all = false; if (all) earn('world' + k); });
      if (secrets != null) stats.secrets = secrets;
      if (hardcore) earn('hc1');
      if (horde) earn('horde');
      stats.storyLit = storyLit; stats.hcLit = hcLit; save(STATS, stats);
      check();
    },
    saved() { earn('architect'); bump('saves'); },
    grove() { earn('grove'); bump('groves'); },
    // Catch up with levels cleared before awards existed.
    sync({ storyLit, hcLit, first }) {
      stats.storyLit = Math.max(stats.storyLit || 0, storyLit); stats.hcLit = Math.max(stats.hcLit || 0, hcLit); save(STATS, stats);
      if (first) earn('first');
      if (hcLit) earn('hc1');
      check();
    },
    reset() { got = {}; stats = {}; save(KEY, got); save(STATS, stats); },
  };
})();
