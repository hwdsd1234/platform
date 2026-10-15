// Lanternfall app: menus, play loop, HUD, storage, audio.
(() => {
  const LF = window.LF;
  const $ = id => document.getElementById(id);
  const STEP = 1 / 120;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
  // Chapter numbers in Roman numerals: roman(0) is "I".
  const roman = k => { let n = k + 1, out = ''; for (const [v, r] of [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { out += r; n -= v; } return out; };

  const cvs = $('game');
  const R = LF.createRenderer(cvs);
  R.resize(); addEventListener('resize', R.resize);

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('lanternfall.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('lanternfall.' + k, JSON.stringify(v)); } catch (e) {} },
  };
  let progress = store.get('progress', {});
  let customs = store.get('custom', []);
  // Hardcore: every lantern is removed, so the door starts open and there are no checkpoints,
  // and water turns to lava wherever the level can be finished without swimming.
  let hardcore = store.get('hardcore', false);
  let progressHC = store.get('progressHC', {});
  // Saves number the levels by position, and boss fights have been slotted in since: first
  // after every 10th level (save version 2), then giants halfway between (version 3). Move
  // each saved level from where it was in its save's numbering to where it is now (once).
  // Then the Sky Roads, a world of their own, went in mid-story (version 4), and the Melon
  // Patch at the end of the Garden Market (version 5).
  const levelsV = store.get('levelsV', 1);
  // Later additions say which save version brought them in (lv.since): the Storm Heights
  // and the Sky Spire came with version 6, the Melon Vault with 7, the High Winds with 8,
  // the Neo Ledges with 9, the world castles with 10, the Pear Cliffs with 11, the sunken
  // castles with 12. With 13, two castles went (one castle a world): Lighthouse Castle and
  // Rat Castle, the sunken castles taking their places; Drowned Castle moved to after the
  // Pear Cliffs. So a save's numbering is rebuilt as it was (GONE puts the old castles back
  // where they stood), each level found again by name; a cleared castle that's gone counts
  // as its world's castle cleared.
  const SAVE_V = 13;
  const GONE = [{ name: 'Lighthouse Castle', after: 'Sunken Keep', now: 'Sunken Keep' }, { name: 'Rat Castle', after: 'The Long Glide', now: 'Drowned Castle' }];
  if (levelsV < SAVE_V) {
    let old = LF.LEVELS.map((lv, i) => ({ name: lv.name, since: lv.since || 0, boss: lv.boss, giantFight: lv.giantFight, i }));
    if (levelsV < 13) {
      // (Before 13, Drowned Castle stood before the Pear Cliffs, and the two old castles stood.)
      const dc = old.findIndex(o => o.name === 'Drowned Castle'), [d] = old.splice(dc, 1);
      old.splice(old.findIndex(o => o.name === 'Pear Drop'), 0, d);
      for (const g of GONE) old.splice(old.findIndex(o => o.name === g.after) + 1, 0, { name: g.name, since: 10, boss: true, i: null, now: g.now });
    }
    old = old.filter(o => !(o.since > levelsV) && (levelsV >= 3 || (levelsV < 2 ? !o.boss : !o.giantFight)));
    const byName = Object.fromEntries(LF.LEVELS.map((lv, i) => [lv.name, i]));
    const was = old.map(o => o.i);
    const move = book => Object.fromEntries(Object.entries(book).flatMap(([k, v]) => { const o = old[k]; if (!o) return []; if (o.i != null) return [[o.i, v]]; return o.now != null && byName[o.now] != null ? [[byName[o.now], v]] : []; }));
    progress = move(progress); progressHC = move(progressHC);
    store.set('progress', progress); store.set('progressHC', progressHC);
    store.set('secrets', move(store.get('secrets', {}))); store.set('houses', move(store.get('houses', {})));
    const at = old[store.get('mapAt', 0)];
    store.set('mapAt', at ? (at.i ?? byName[at.now] ?? 0) : 0); store.set('midway', null); store.set('launch', null);
    store.set('levelsV', SAVE_V);
  }

  // ---------- audio ----------
  let ac = null, muted = store.get('muted', false);
  const initAudio = () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    // The music starts with the first key or tap (browsers won't play sound before that).
    if (ac && LF.music) { LF.music.setMuted(muted); LF.music.setOn(store.get('music', true)); LF.music.attach(ac); }
  };
  // Which track goes with a level: its world's, the grove's, or in a tower the tower's (the
  // castle's) until you step into the boss's arena, then that boss's own fight music (the
  // Last Dark's for the castle).
  const trackFor = (def, ctx, inArena) => ctx.kind === 'house' ? 'grove' : ctx.kind === 'cannon' ? 'map'
    : def.arenaX ? (inArena ? (def.finalFight ? 'final' : `fight:${def.name}`) : def.castle ? 'castle' : 'tower')
    : `world${(ctx.index != null && LF.LEVELS[ctx.index] ? LF.LEVELS[ctx.index].world : 0) % 9}`;
  function tone(f1, f2, dur, type = 'square', vol = .05, delay = 0) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02);
  }
  const SFX = {
    jump: () => tone(420, 760, .09, 'square', .03),
    land: () => tone(160, 90, .06, 'triangle', .05),
    light: () => { tone(880, 880, .18, 'triangle', .06); tone(1320, 1320, .3, 'triangle', .05, .07); },
    stomp: () => tone(260, 70, .14, 'square', .06),
    die: () => tone(340, 50, .4, 'sawtooth', .05),
    spring: () => tone(300, 1200, .2, 'triangle', .05),
    crumble: () => tone(120, 50, .15, 'sawtooth', .03),
    spit: () => tone(700, 200, .12, 'sawtooth', .02),
    hop: () => tone(200, 380, .08, 'sine', .04),
    drop: () => tone(900, 300, .15, 'sine', .03),
    shoot: () => { tone(900, 200, .08, 'square', .04); tone(160, 60, .08, 'sawtooth', .03); },
    empty: () => tone(200, 180, .05, 'square', .02),
    zap: () => { tone(600, 80, .2, 'sawtooth', .04); tone(1200, 300, .12, 'square', .02, .02); },
    ammotick: () => tone(1100 + Math.random() * 300, 1500, .04, 'square', .02),
    ammo: () => { tone(500, 700, .06, 'square', .03); tone(700, 900, .06, 'square', .03, .05); },
    bigammo: () => [500, 630, 750, 1000].forEach((f, i) => tone(f, f, .1, 'square', .03, i * .05)),
    blink: () => tone(1500, 1500, .03, 'sine', .015),
    key: () => [660, 880, 1320].forEach((f, i) => tone(f, f, .12, 'triangle', .05, i * .06)),
    unlock: () => { tone(300, 600, .15, 'square', .03); tone(900, 900, .2, 'triangle', .04, .1); },
    gatepop: () => tone(500 + Math.random() * 300, 200, .06, 'square', .015),
    growl: () => { tone(70, 45, .5, 'sawtooth', .05); tone(95, 60, .45, 'triangle', .04, .05); },
    slam: () => { tone(120, 40, .25, 'sawtooth', .06); tone(80, 30, .3, 'triangle', .06); },
    buzz: () => tone(220, 260, .3, 'sawtooth', .02),
    bow: () => tone(600, 250, .1, 'triangle', .03),
    clank: () => { tone(1400, 900, .08, 'square', .03); tone(300, 200, .1, 'triangle', .04); },
    flop: () => { tone(260, 120, .08, 'triangle', .04); tone(200, 90, .1, 'triangle', .03, .09); },
    award: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, .16, 'triangle', .045, i * .07)),
    rocket: () => { tone(220, 900, .12, 'sawtooth', .035); tone(120, 60, .15, 'square', .03); },
    lob: () => tone(500, 260, .12, 'triangle', .04),
    pop: () => { tone(220, 60, .18, 'sawtooth', .05); tone(900, 200, .08, 'square', .02); },
    boom: () => { tone(160, 30, .5, 'sawtooth', .07); tone(80, 25, .6, 'square', .05, .02); tone(1200, 200, .15, 'triangle', .03); },
    bubble: () => tone(180, 520, .15, 'sine', .035),
    leap: () => tone(400, 800, .12, 'sine', .03),
    snort: () => tone(140, 90, .2, 'sawtooth', .04),
    roar: () => { tone(90, 50, .7, 'sawtooth', .07); tone(140, 70, .6, 'square', .03, .05); },
    bossdown: () => [400, 300, 500, 700, 1000].forEach((f, i) => tone(f, f * 1.2, .16, 'square', .04, i * .09)),
    splash: () => tone(500, 120, .18, 'sine', .04),
    swim: () => tone(300, 520, .1, 'sine', .035),
    walljump: () => tone(360, 680, .08, 'square', .03),
    djump: () => { tone(520, 980, .1, 'triangle', .04); tone(780, 1400, .08, 'sine', .03, .04); },
    fruit: () => { tone(660, 990, .1, 'triangle', .05); tone(990, 1480, .14, 'triangle', .04, .06); },
    strip: () => { tone(700, 180, .35, 'sawtooth', .04); tone(500, 120, .4, 'triangle', .04, .08); },
    shield: () => { tone(900, 300, .25, 'triangle', .05); tone(1200, 400, .2, 'sine', .03, .03); },
    door: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, .22, 'triangle', .05, .25 + i * .08)),
    clear: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, .3, 'triangle', .05, i * .07)),
  };

  // ---------- state ----------
  let screen = 'title', W = null, playDef = null, playCtx = null;
  const cam = { x: 0, y: 0, zoom: 1 };
  const input = { left: false, right: false, jump: false, down: false, jumpPressed: false, fire: false, firePressed: false, rocket: false, rocketPressed: false, grenade: false, grenadePressed: false, kill: false, killPressed: false, dyn: false, dynPressed: false, spinPressed: false, big: false };
  let attract = LF.createWorld(LF.LEVELS[0]);
  let story = { time: 0, falls: 0 };

  const app = { canvas: cvs, renderer: R };
  const editor = LF.createEditor(app);

  function setVisible({ hud = false, overlay = false, select = false, touch = false, map = false }) {
    $('hud').hidden = !hud; $('overlay').hidden = !overlay; $('select').hidden = !select; $('touch').hidden = !touch; $('map').hidden = !map;
    if (screen !== 'editor' && editor.active) editor.close();
  }
  function card(html) {
    $('card').innerHTML = html;
    for (const b of $('card').querySelectorAll('[data-act]')) b.addEventListener('click', () => { initAudio(); ACTIONS[b.dataset.act](b.dataset); });
    const first = $('card').querySelector('.go');
    if (first) first.focus({ preventScroll: true });
  }
  let flashT = 0;
  const flash = app.flash = text => {
    const el = $('flash'); el.textContent = text; el.classList.add('show');
    clearTimeout(flashT); flashT = setTimeout(() => el.classList.remove('show'), 1800);
  };

  const shapeOf = def => {
    const h = def.map.length, w = def.map[0].length;
    return h > w * 1.2 ? 'upward' : w > h * 2.6 ? 'across' : 'up & across';
  };
  const nextStory = () => { const i = LF.LEVELS.findIndex((_, k) => !progress[k]); return i < 0 ? 0 : i; };

  // Remove every lantern, ammo crate and piece of fruit (each becomes empty space, or water if
  // it was underwater) and any starting ammo, then turn the water and anything swimming in it
  // into lava, unless the level needs swimming.
  // Shot doors (v, w, z) go too: with no ammo they could never open.
  const HARDCORE_GONE = new Set(['L', 'q', 'Q', '$', ...Object.keys(LF.FRUITS), 'v', 'w', 'z']);
  function hardcoreDef(def) {
    const rows = LF.normalize(def.map).map(r => r.split(''));
    rows.forEach((r, y) => r.forEach((c, x) => { if (HARDCORE_GONE.has(c)) r[x] = rows[y - 1]?.[x] === '~' ? '~' : '.'; }));
    const water = { ...def, map: rows.map(r => r.join('')), player: { ...def.player, ammo: 0 }, noSpawnInv: true };
    const lava = { ...water, map: water.map.map(r => r.replace(/[~YUN]/g, '!')) };
    if (!lava.map.some((r, i) => r !== water.map[i])) return water;
    if (!LF.analyze(lava).ok && LF.analyze(water).ok) return { ...water, needsSwim: true };
    return lava;
  }

  // ---------- awards ----------
  function showAwards() {
    setVisible({ overlay: true });
    const { earned, total } = LF.awards.count();
    const items = LF.awards.list().map(a => `
      <li class="${a.earned ? 'won' : ''}">
        <i aria-hidden="true">${a.earned ? '★' : '☆'}</i>
        <div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        ${a.goal && !a.earned ? `<span class="bar"><span style="width:${Math.round(a.have / a.goal * 100)}%"></span></span><em>${a.have} / ${a.goal}</em>` : ''}</div>
      </li>`).join('');
    card(`
      <p class="eyebrow">${earned} of ${total} earned</p>
      <h2>Awards</h2>
      <p class="lede">Awards count in story levels. Random maps only earn Wanderer, and the editor only Architect.</p>
      <ul class="awards">${items}</ul>
      <div class="menu"><button class="go" data-act="menu">Back</button></div>`);
  }
  // The update log (updates.js), newest first. The Updates button has a dot till you've read
  // the latest; entries newer than your last look are marked new.
  function showUpdates() {
    setVisible({ overlay: true });
    const seen = store.get('updatesSeen', ''), log = LF.UPDATES || [];
    const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    card(`
      <p class="eyebrow">What’s new</p>
      <h2>Updates</h2>
      <ul class="updates">${log.map(u => `<li><h3><time datetime="${u.date}">${fmtDate(u.date)}</time>${esc(u.title)}${u.date > seen ? '<span class="new">new</span>' : ''}</h3>
        <ul>${u.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul></li>`).join('')}</ul>
      <div class="menu"><button class="go" data-act="menu">Back</button></div>`);
    if (log[0]) { store.set('updatesSeen', log[0].date); markUpdates(); }
  }
  const markUpdates = () => { const b = $('map-updates'); if (b) b.classList.toggle('unread', !!(LF.UPDATES && LF.UPDATES[0] && LF.UPDATES[0].date > store.get('updatesSeen', ''))); };
  LF.awards.onEarn = () => SFX.award();
  LF.awards.sync({ storyLit: Object.keys(progress).length, hcLit: Object.keys(progressHC).length, first: !!progress[0] });

  // ---------- screens ----------
  // ---------- world map ----------
  // Every story level is a stop on the map, world by world (see worlds.js). Paths run from
  // stop to stop: each world's winding road, plus links down from one row to the next, so
  // there's more than one way to the end of the world (never around a boss fight). A level
  // opens once a level next to it on a path is cleared, so a crossroads opens two or three.
  // At the end of each world a cannon fires the lamplighter to the start of the next.
  // Beside each level with a secret exit stands a secret cannon: leave the level by its
  // secret exit and a path opens to it, and it fires you to a faraway world. The arrow keys
  // walk the lamplighter along whichever path goes that way (arrows round it show which);
  // a click or tap jumps to an open stop; Enter plays.
  let mapAt = Math.min(store.get('mapAt', 0), LF.LEVELS.length - 1);
  let secrets = store.get('secrets', {});
  let mapBusy = false;   // while the cannon's doing its thing
  // Practice mode: every level open, nothing counts (no progress, awards or carried items),
  // and in a level Z sets a checkpoint where you stand and X takes the latest one away.
  let practice = store.get('practice', false);
  // Fruit houses: beside about one level in seven stands a little house; once that level's
  // cleared you can walk in for a Fruit Grove minigame (once per house) whose fruit goes in
  // your inventory. mapHouse is the house the lamplighter's standing at, if any.
  let houses = store.get('houses', {}), mapHouse = null;
  const HOUSE_LEVELS = LF.LEVELS.map((lv, i) => i).filter(i => {
    const lv = LF.LEVELS[i];
    return !lv.boss && lv.secretTo == null && i % 7 === 4 && LF.WORLDS[lv.world].last !== i;
  });
  // A fruit house's grove grows back an hour after you were in, by the clock: whether
  // you're playing or not, or the game's even open. (Fruit in a level is different: it only
  // grows back while you're playing that level.) houses[i] = { at: when you were in }.
  // (Visits saved in older ways count as grown back.)
  const GROVE_REGROW = 60 * 60 * 1000;
  const houseUsed = i => !!houses[i] && typeof houses[i] === 'object' && houses[i].at != null && Date.now() - houses[i].at < GROVE_REGROW;
  const regrowIn = i => { const m = Math.ceil((GROVE_REGROW - (Date.now() - houses[i].at)) / 60000); return m >= 60 ? '1 hour' : `${m} min`; };
  // (In practice every grove is open and never used up: see also cleared.)
  const groveUsed = i => !practice && houseUsed(i);
  const houseOpen = i => practice || (!!progress[i] && !houseUsed(i));
  // The lamplighter can also stand at a cannon: { world: k } at the end of world k, or
  // { secret: i } beside level i. Enter there plays the Cannon Yard (see cannonLevel).
  let mapCannon = null;
  const cannonOpen = how => how.secret != null ? !!secrets[how.secret] : !!progress[LF.WORLDS[how.world].last];
  const cannonDest = how => how.secret != null ? LF.LEVELS[how.secret].secretWorld : how.world + 1;
  const secretInto = {};   // level index -> the levels whose secret cannon lands there
  LF.LEVELS.forEach((lv, i) => { if (lv.secretTo != null) (secretInto[lv.secretTo] ||= []).push(i); });
  const near = i => mapLayout().adj[i];
  const landedBySecret = i => (secretInto[i] || []).some(j => secrets[j]);
  const unlocked = i => {
    if (practice || i === 0 || progress[i] || landedBySecret(i)) return true;
    const L = LF.LEVELS, k = L[i].world;
    if (i === LF.WORLDS[k].first && k > 0 && progress[LF.WORLDS[k - 1].last]) return true;
    // Next to a cleared level, or to where a secret cannon lands you.
    return near(i).some(j => progress[j] || landedBySecret(j));
  };
  const COLS = 8, CW = 104, RH = 150, PAD = 70, BIG_CASTLE = 820;
  const stopR = lv => lv.finalFight ? 22 : lv.boss ? 17 : 12;

  // Where everything goes: each world starts a new block of rows under its title, snaking
  // back and forth; its cannon sits one step past its last stop.
  let layout = null;
  function mapLayout() {
    if (layout) return layout;
    const pos = [], worlds = [], right = PAD + (COLS - 1) * CW;
    let y = PAD + 140;
    LF.WORLDS.forEach((wd, k) => {
      const top = y - 160;
      let row = 0;
      for (let i = wd.first, c = 0; i <= wd.last; i++, c++) {
        // The last castle stands alone at the bottom of the map, room above it for all ten
        // times its size.
        if (LF.LEVELS[i].finalFight) { y += BIG_CASTLE; pos[i] = { x: PAD + (COLS - 1) * CW / 2, y, base: y, row: row + 1, big: true }; continue; }
        if (c === COLS) { c = 0; row++; y += RH; }
        // A good wobble, so the road winds about rather than running ruled.
        pos[i] = { x: PAD + (row % 2 ? COLS - 1 - c : c) * CW + Math.sin(i * 1.9) * 14, y: y + Math.sin(i * 1.1 + row) * 10, base: y, row };
      }
      const last = pos[wd.last], dir = last.row % 2 ? -1 : 1, cx = last.x + dir * CW;
      const cannon = k === LF.WORLDS.length - 1 ? null : cx >= PAD - 20 && cx <= right + 20 ? { x: cx, y: last.y, dir } : { x: last.x, y: last.y + RH * .7, dir };
      worlds.push({ top, bottom: (cannon ? Math.max(cannon.y, y) : y) + 50, cannon });
      y = (cannon ? Math.max(cannon.y, y) : y) + RH + 150;
    });
    // Lots of ways through each world (so lots of crossroads), never around a boss fight
    // and never out of the world:
    // - Braids: between boss fights the road zigzags, its stops stepping up and down, and
    //   two side lanes run along it, each joining every other stop: so most stops are
    //   crossroads, and you can weave through any way you like. Boss fights sit on the
    //   middle of the road, where every lane has to pass through them.
    // - Links down from one row to the next: from a stop to the one straight below it.
    // None may cut out a stretch of road with a boss fight on it.
    const links = [], adj = LF.LEVELS.map(() => []);
    const bossBetween = (i, j) => { for (let t = Math.min(i, j) + 1; t < Math.max(i, j); t++) if (LF.LEVELS[t].boss) return true; return false; };
    const sameRow = (i, j) => pos[i].row === pos[j].row;
    LF.WORLDS.forEach(wd => {
      for (let i = wd.first; i <= wd.last; i++) {
        const lv = LF.LEVELS[i];
        if (lv.boss || lv.finalFight) continue;
        pos[i].y += ((i - wd.first) % 2 ? 1 : -1) * 30;
      }
      for (let i = wd.first; i + 2 <= wd.last; i++) {
        if (!sameRow(i, i + 2) || bossBetween(i, i + 2) || LF.LEVELS[i].boss || LF.LEVELS[i + 2].boss) continue;
        links.push([i, i + 2, 'lane']);
      }
      for (let r = 0; wd.first + (r + 1) * COLS <= wd.last; r++) {
        const used = [];
        for (const c of [1 + (r % 2), 4, 6 - (r % 2), 3, 5, 2, 0, 7]) {
          if (used.length >= 3 || used.some(u => Math.abs(u - c) < 2)) continue;
          const i = wd.first + r * COLS + c, j = wd.first + (r + 1) * COLS + (COLS - 1 - c);
          if (j > wd.last || j - i < 3 || bossBetween(i, j)) continue;
          links.push([i, j]); used.push(c);
        }
      }
    });
    LF.LEVELS.forEach((lv, i) => {
      if (LF.LEVELS[i + 1] && LF.LEVELS[i + 1].world === lv.world) { adj[i].push(i + 1); adj[i + 1].push(i); }
    });
    for (const [i, j] of links) { adj[i].push(j); adj[j].push(i); }
    // Secret cannons sit just below and beside their level's stop.
    const secretCannons = {};
    LF.LEVELS.forEach((lv, i) => { if (lv.secretTo != null) secretCannons[i] = { x: Math.min(right + 30, pos[i].x + 34), y: pos[i].y + 46, dir: 1 }; });
    // Fruit houses sit just below and to the left of their level's stop.
    const houseSpots = {};
    for (const i of HOUSE_LEVELS) houseSpots[i] = { x: Math.max(PAD - 40, pos[i].x - 36), y: pos[i].y + 48 };
    return layout = { pos, worlds, secretCannons, houseSpots, links, adj, w: PAD * 2 + (COLS - 1) * CW, h: y - RH - 150 + PAD + 20 };
  }
  const arcPoint = (a, b, u) => {
    const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 170;
    return { x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y };
  };
  const arcPath = (a, b) => {
    let d = `M${a.x} ${a.y}`;
    for (let u = .05; u <= 1.001; u += .05) { const q = arcPoint(a, b, u); d += ` L${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }
    return d;
  };
  const cannonSvg = (c, d, attr, cls) => `<g class="cannon${cls}" ${attr} transform="translate(${c.x} ${c.y})${cls ? ' scale(.75)' : ''}">
      <g class="barrel" transform="rotate(${d < 0 ? -140 : -40})"><rect x="-4" y="-9" width="34" height="18" rx="5"/><rect class="rim" x="26" y="-11" width="8" height="22" rx="3"/></g>
      <circle class="wheel" r="11"/><circle class="hub" r="4"/></g>`;
  const markerSvg = '<path d="M-7 14 L0 -2 L7 14 Z" fill="#D9D0F0"/><circle cy="-6" r="5" fill="#D9D0F0"/><line x1="6" y1="0" x2="12" y2="-12" stroke="#8F81AB" stroke-width="2"/><circle cx="12" cy="-15" r="3.5" fill="#FFB547"/>';

  function showMap() {
    screen = 'map'; store.set('inLevel', null);
    if (LF.music) LF.music.hurry(false);
    if (LF.music) { LF.music.play('map'); LF.music.duck(false); }
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    attract = LF.createWorld(LF.LEVELS[0]);
    LF.followCamera(attract, cam, 0, true);
    setVisible({ map: true });
    renderMap(true);
    showUnlocks();
    // Just finished a world, or left by a secret exit? Into the cannon.
    const go = store.get('launch', null);
    store.set('launch', null);
    if (typeof go === 'number' && LF.WORLDS[go + 1]) launch({ world: go });
    else if (go && go.world != null && LF.WORLDS[go.world + 1]) launch(go);
    else if (go && go.secret != null && LF.LEVELS[go.secret] && LF.LEVELS[go.secret].secretTo != null) launch(go);
  }

  // Back on the map after a win: the level you lit flares up, then each level (and cannon)
  // it opened pops up in turn, its path fading in. (unlockShow: { lit, fresh: [indexes],
  // cannons: [world indexes], msg }, set by cleared().)
  let unlockShow = null;
  const openSet = () => new Set(LF.LEVELS.map((_, k) => k).filter(k => unlocked(k)));
  const openCannons = () => LF.WORLDS.map((_, k) => k).filter(k => LF.WORLDS[k + 1] && cannonOpen({ world: k }));
  function showUnlocks() {
    const u = unlockShow;
    unlockShow = null;
    if (!u) return;
    const svg = $('map-board'), at = (sel, delay, cls) => { for (const el of svg.querySelectorAll(sel)) { el.classList.add(cls); el.style.animationDelay = `${delay}s`; } };
    at(`.stop[data-i="${u.lit}"]`, 0, 'just-lit');
    u.fresh.forEach((k, n) => {
      const d = .7 + n * .35;
      at(`.stop[data-i="${k}"]`, d, 'fresh');
      at(`.trail[data-b="${k}"], .seg[data-b="${k}"], .trail[data-a="${k}"], .seg[data-a="${k}"]`, d - .25, 'fresh');
    });
    u.cannons.forEach((k, n) => at(`.cannon[data-world="${k}"]`, .7 + (u.fresh.length + n) * .35, 'fresh'));
    for (const k of u.fresh) {
      const g = svg.querySelector(`.stop[data-i="${k}"]`);
      if (g) g.insertAdjacentHTML('beforeend', `<circle class="unlock-ring" r="12" style="animation-delay:${g.style.animationDelay}"/>`);
    }
    if (u.msg) flash(u.msg);
  }

  function renderMap(scroll) {
    const L = LF.LEVELS, n = L.length, { pos, worlds, secretCannons, houseSpots, links, w, h } = mapLayout();
    let out = '';
    // The worlds: each its own landscape (see mapart.js): a sky, its scenery scattered
    // wherever the path and stops leave room, and a couple of creatures wandering about.
    const art = LF.mapArt;
    let defs = '';
    const segs = [];   // the path's segments, as SVG path data, by the index they lead to
    for (let i = 0; i < n - 1; i++) {
      if (L[i].world !== L[i + 1].world) continue;
      const a = pos[i], b = pos[i + 1];
      segs[i + 1] = a.row === b.row
        ? `M${a.x} ${a.y} C${(a.x * 2 + b.x) / 3} ${a.y + 10} ${(a.x + b.x * 2) / 3} ${b.y - 10} ${b.x} ${b.y}`
        : `M${a.x} ${a.y} C${a.x + (a.x > w / 2 ? 60 : -60)} ${a.y} ${b.x + (a.x > w / 2 ? 60 : -60)} ${b.y} ${b.x} ${b.y}`;
    }
    // Spots the scenery has to stay off: stops, points along the path, cannons, labels.
    const keepOff = [];
    pos.forEach((p, i) => {
      keepOff.push({ x: p.x, y: p.y, r: 40 }, { x: p.x + 60, y: p.y - 34, r: 34 });
      const q = pos[i + 1];
      if (q && L[i].world === L[i + 1].world) for (let u = .25; u < 1; u += .25) keepOff.push({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u, r: 30 });
    });
    for (const [i, j] of links) for (let u = .2; u < 1; u += .2) keepOff.push({ x: pos[i].x + (pos[j].x - pos[i].x) * u, y: pos[i].y + (pos[j].y - pos[i].y) * u, r: 28 });
    worlds.forEach(wl => {
      if (wl.cannon) keepOff.push({ x: wl.cannon.x, y: wl.cannon.y, r: 46 });
      for (let x = PAD - 20; x < PAD + 380; x += 30) keepOff.push({ x, y: wl.top + 40, r: 30 });   // the world's title
    });
    Object.values(secretCannons).forEach(c => keepOff.push({ x: c.x, y: c.y, r: 34 }));
    Object.values(houseSpots).forEach(c => keepOff.push({ x: c.x, y: c.y, r: 32 }));
    // (Nothing in front of the last castle.)
    const big = pos.find(p => p && p.big);
    if (big) for (let dy = 0; dy < 760; dy += 60) for (let dx = -300; dx <= 300; dx += 60) keepOff.push({ x: big.x + dx, y: big.y - dy, r: 40 });
    const clear = (x, y) => keepOff.every(o => Math.hypot(x - o.x, y - o.y) > o.r);
    worlds.forEach((wl, k) => {
      const th = art.theme(k), rect = { x0: 12, y0: wl.top, x1: w - 12, y1: wl.bottom };
      defs += `<linearGradient id="sky${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.sky[0]}"/><stop offset="1" stop-color="${th.sky[1]}"/></linearGradient>`;
      out += `<rect class="world" x="12" y="${wl.top}" width="${w - 24}" height="${wl.bottom - wl.top}" rx="22" fill="url(#sky${k})"/>`;
      out += art.scenery(k, rect, clear, 1000 + k * 77);
      out += `<text class="wname" x="${PAD - 30}" y="${wl.top + 36}">World ${k + 1} · ${esc(LF.WORLDS[k].name)}</text>`;
    });
    // The last castle, behind the road that leads to its gate.
    L.forEach((lv, i) => { if (lv.finalFight) out += art.bigCastle(pos[i].x, pos[i].y, !!progress[i]); });
    // The path: a worn trail in each world's color, dotted down the middle; brighter where
    // it's open to you.
    for (let i = 1; i < n; i++) {
      if (!segs[i]) continue;
      const open = unlocked(i), color = art.theme(L[i].world).trail;
      out += `<path class="trail${open ? ' open' : ''}" data-a="${i - 1}" data-b="${i}" d="${segs[i]}" stroke="${color}"/><path class="seg${open ? ' open' : ''}" data-a="${i - 1}" data-b="${i}" d="${segs[i]}"/>`;
    }
    // The links between rows: more paths, the same trail.
    for (const [i, j, kind] of links) {
      const a = pos[i], b = pos[j], my = (a.y + b.y) / 2, open = unlocked(i) && unlocked(j), color = art.theme(L[i].world).trail;
      // (A lane bows a little outwards, away from the road's middle.)
      const bow = kind === 'lane' ? Math.sign(a.y + b.y - 2 * pos[i + 1].y) * 16 : 0;
      const d = kind === 'lane' ? `M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + bow} ${b.x} ${b.y}`
        : `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
      out += `<path class="trail${open ? ' open' : ''}" data-a="${i}" data-b="${j}" d="${d}" stroke="${color}"/><path class="seg${open ? ' open' : ''}" data-a="${i}" data-b="${j}" d="${d}"/>`;
    }
    // Each world's cannon, aimed along the dotted arc to the next world's first stop.
    worlds.forEach((wl, k) => {
      const c = wl.cannon;
      if (!c) return;
      const to = pos[LF.WORLDS[k + 1].first], d = to.x < c.x ? -1 : 1, open = unlocked(LF.WORLDS[k + 1].first);
      out += `<path class="arc${open ? ' open' : ''}" d="${arcPath(c, to)}"/>` + cannonSvg(c, d, `data-world="${k}"`, '');
    });
    // Fruit houses: a cottage with a fruit on its sign; dim until its level is cleared, its
    // door shut once you've been in.
    for (const [i, c] of Object.entries(houseSpots)) {
      const cls = groveUsed(i) ? ' used' : progress[i] || practice ? ' open' : '';
      if (progress[i]) out += `<path class="warp house-path" d="M${pos[i].x} ${pos[i].y} L${c.x} ${c.y}"/>`;
      out += `<g class="house${cls}" data-house="${i}" transform="translate(${c.x} ${c.y})"><circle class="hit" r="18"/>
        <rect x="-13" y="-16" width="26" height="18" rx="2" class="walls"/><path d="M-17 -16 L0 -30 L17 -16 Z" class="roof"/>
        <path d="M-4 2 v-9 a4 4 0 0 1 8 0 v9 Z" class="door"/><circle cx="0" cy="-22" r="3.5" class="fruit"/></g>`;
    }
    // Secret cannons: always there to see, dim until you find their level's secret exit.
    // Then a gold path runs from the level to its cannon, and its arc to the faraway world.
    for (const [i, c] of Object.entries(secretCannons)) {
      const found = !!secrets[i], a = pos[i], to = pos[L[i].secretTo];
      if (found) out += `<path class="warp" d="M${a.x} ${a.y} L${c.x} ${c.y}"/><path class="arc open secret" d="${arcPath(c, to)}"/>`;
      out += cannonSvg(c, to.x < c.x ? -1 : 1, `data-secret="${i}"`, found ? ' secret found' : ' secret');
    }
    // Chapter names where each chapter starts, run the way the path goes (unless that's
    // off the edge) and clear of the lamplighter. (Ones that collide are moved below.)
    L.forEach((lv, i) => {
      if (i && L[i - 1].chapter === lv.chapter) return;
      const p = pos[i], forward = p.row % 2 === 0, right = p.x < 230 || (forward && p.x < w - 230);
      out += `<text class="ch" x="${p.x + (right ? 24 : -24)}" y="${p.base - 66}" text-anchor="${right ? 'start' : 'end'}">${roman(chapterIndex(i))} · ${esc(lv.chapter)}</text>`;
    });
    // Creatures wandering each world, in clear spots between its rows.
    worlds.forEach((wl, k) => {
      const R = LF.rng(500 + k), spots = [];
      for (let tries = 0; tries < 60 && spots.length < 3; tries++) {
        const x = 60 + R() * (w - 120), y = wl.top + 70 + R() * (wl.bottom - wl.top - 90);
        if (clear(x, y) && spots.every(s => Math.hypot(s.x - x, s.y - y) > 120)) spots.push({ x, y });
      }
      out += art.wanderers(k, spots);
    });
    // Crossroads: a cobbled ring under every stop where three or more roads meet.
    const { adj } = mapLayout();
    L.forEach((lv, i) => { if (adj[i].length >= 3) out += `<g class="xroad${unlocked(i) ? ' open' : ''}" transform="translate(${pos[i].x} ${pos[i].y})"><circle r="24"/><circle class="cobble" r="17"/></g>`; });
    // The stops: lamp posts (unlit until cleared), towers for boss fights, a castle at the
    // end. A star marks a secret exit you've found; a blue ? one still hiding in a level
    // you've cleared.
    L.forEach((lv, i) => {
      const p = pos[i], r = stopR(lv), state = !unlocked(i) ? 'locked' : progress[i] ? 'lit' : 'open';
      const cls = ['stop', state, lv.boss ? 'boss' : '', i === mapAt && !mapCannon && mapHouse == null ? 'at' : ''].join(' ');
      let badge = '';
      if (secrets[i]) badge = `<text class="badge found" x="${r + 2}" y="${-r - 14}">★</text>`;
      else if (lv.secretTo != null && progress[i]) badge = `<text class="badge hint" x="${r + 2}" y="${-r - 14}">?</text>`;
      out += `<g class="${cls}" data-i="${i}" transform="translate(${p.x} ${p.y})"><title>${i + 1}. ${esc(lv.name)}</title>${art.stop(lv, state)}<text class="num" y="${lv.finalFight ? 22 : lv.boss ? 20 : 18}">${i + 1}</text>${badge}</g>`;
    });
    // The lamplighter, standing over the current stop (or beside the cannon it's at).
    const at = mapHouse != null ? houseSpots[mapHouse] : mapCannon ? (mapCannon.secret != null ? secretCannons[mapCannon.secret] : worlds[mapCannon.world].cannon) : null;
    const m = at || pos[mapAt], mr = at ? 14 : stopR(L[mapAt]);
    // Little arrows round the stop for each way the lamplighter can walk from here.
    for (const ex of mapExits()) {
      const vx = ex.x - m.x, vy = ex.y - m.y, len = Math.hypot(vx, vy) || 1;
      out += `<path class="exit" d="M-5 -3 L0 3 L5 -3" transform="translate(${m.x + vx / len * 30} ${m.y + vy / len * 30}) rotate(${Math.atan2(vy, vx) * 180 / Math.PI - 90})"/>`;
    }
    out += `<g class="marker" transform="translate(${m.x} ${m.y - mr - 30})"><g class="bob">${markerSvg}</g></g>`;
    $('map-board').innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="World map: ${n} levels in ${LF.WORLDS.length} worlds"><defs>${defs}</defs>${out}</svg>`;
    renderWorldBar();
    // A chapter name that runs into the one before it on its row drops under the path.
    const boxes = [];
    for (const t of $('map-board').querySelectorAll('.ch')) {
      const b = t.getBBox();
      if (boxes.some(o => Math.abs(o.y - b.y) < 2 && o.x < b.x + b.width + 10 && b.x < o.x + o.width + 10)) t.setAttribute('y', +t.getAttribute('y') + 104);
      boxes.push(t.getBBox());
    }
    for (const g of $('map-board').querySelectorAll('.stop')) g.addEventListener('click', () => {
      initAudio();
      if (mapBusy) return;
      const i = +g.dataset.i;
      if (!unlocked(i)) return flash('Clear the levels before it first');
      // A new world is reached by its cannon the first time.
      const wd = LF.WORLDS[L[i].world];
      if (!practice && i === wd.first && L[i].world > 0 && !progress[i] && !landedBySecret(i) && L[mapAt].world < L[i].world) return flash('Take the cannon to get there');
      if (i === mapAt && !mapCannon && mapHouse == null) ACTIONS.story({ i });
      else { mapAt = i; mapCannon = null; mapHouse = null; store.set('mapAt', i); renderMap(); }
    });
    // Houses: click one to stand at it, and again to go in.
    for (const g of $('map-board').querySelectorAll('.house')) g.addEventListener('click', () => {
      initAudio();
      if (mapBusy) return;
      const i = +g.dataset.house;
      if (!progress[i] && !practice) return flash('Clear the level beside it first');
      if (mapHouse === i) return ACTIONS.house({ i });
      mapHouse = i; mapCannon = null; mapAt = i; store.set('mapAt', i); renderMap();
    });
    // Cannons: click one you've reached to stand at it, and again to climb in.
    for (const g of $('map-board').querySelectorAll('.cannon')) g.addEventListener('click', () => {
      initAudio();
      if (mapBusy) return;
      const how = g.dataset.secret != null ? { secret: +g.dataset.secret } : { world: +g.dataset.world };
      if (!cannonOpen(how)) return flash(how.secret != null ? 'Find this level’s secret exit first' : 'Finish this world first');
      const same = mapCannon && mapCannon.secret === how.secret && mapCannon.world === how.world;
      if (same) return ACTIONS.cannon(how);
      mapCannon = how; mapHouse = null; mapAt = how.secret != null ? how.secret : LF.WORLDS[how.world].last; store.set('mapAt', mapAt); renderMap();
    });
    const lit = Object.keys(progress).length, found = Object.keys(secrets).length, total = L.filter(lv => lv.secretTo != null).length;
    $('map-stats').textContent = `World ${L[mapAt].world + 1} of ${LF.WORLDS.length} · ${lit} of ${n} lit · secret exits ${found} of ${total}${hardcore ? ` · hardcore ${Object.keys(progressHC).length} lit` : ''}`;
    $('map-awards').textContent = `Awards · ${LF.awards.count().earned}/${LF.awards.count().total}`;
    markUpdates();
    $('map-hc').textContent = `Hardcore: ${hardcore ? 'on' : 'off'}`; $('map-hc').classList.toggle('hc-on', hardcore);
    $('map-practice').textContent = `Practice: ${practice ? 'on' : 'off'}`; $('map-practice').classList.toggle('pr-on', practice);
    $('map').classList.toggle('practicing', practice);
    mapInfo();
    if (scroll !== false) mapScroll(m.y, scroll === true);
  }
  // W1…W8 along the top: jump the view to any world you've reached.
  function renderWorldBar() {
    let bar = $('map-worlds');
    if (!bar) {
      bar = document.createElement('nav'); bar.id = 'map-worlds'; bar.className = 'map-worlds';
      $('map').querySelector('.map-bar').appendChild(bar);
    }
    const here = LF.LEVELS[mapAt].world;
    bar.innerHTML = LF.WORLDS.map((wd, k) => {
      const reached = practice || LF.LEVELS.some((lv, i) => lv.world === k && (progress[i] || i === mapAt));
      return `<button class="mini${k === here ? ' here' : ''}" data-world="${k}" ${reached ? '' : 'disabled'} title="World ${k + 1} · ${esc(wd.name)}">W${k + 1}</button>`;
    }).join('');
    for (const b of bar.querySelectorAll('button')) b.addEventListener('click', () => {
      const svg = $('map-board').querySelector('svg'), k = svg.getBoundingClientRect().width / mapLayout().w;
      $('map-board').scrollTo({ top: mapLayout().worlds[+b.dataset.world].top * k - 10, behavior: 'smooth' });
    });
  }

  // Keep a point (in map units) in view, centred if asked.
  function mapScroll(y, center) {
    const svg = $('map-board').querySelector('svg'), board = $('map-board');
    const k = svg.getBoundingClientRect().width / mapLayout().w, target = y * k - board.clientHeight / 2;
    if (center || Math.abs(board.scrollTop - target) > board.clientHeight * .35) board.scrollTop = target;
  }

  // A cannon: walk in, shrink inside, BOOM, tumble along the arc. Either the cannon at the
  // end of world k ({ world: k }) or the secret cannon of level i ({ secret: i }).
  function launch(how) {
    const { pos, worlds, secretCannons } = mapLayout(), L = LF.LEVELS;
    const c = how.secret != null ? secretCannons[how.secret] : worlds[how.world].cannon;
    const start = how.secret != null ? how.secret : LF.WORLDS[how.world].last, from = pos[start];
    const dest = how.secret != null ? L[how.secret].secretTo : LF.WORLDS[how.world + 1].first, to = pos[dest];
    const svg = $('map-board').querySelector('svg'), marker = svg.querySelector('.marker');
    const cannon = svg.querySelector(how.secret != null ? `.cannon[data-secret="${how.secret}"]` : `.cannon[data-world="${how.world}"]`);
    if (!c || !marker || !cannon) return;
    mapBusy = true;
    let fired = false;
    const t0 = performance.now() - (how.fromCannon ? 1100 : 0);
    const step = now => {
      const t = (now - t0) / 1000;
      let x, y, turn = 0, size = 1;
      if (t < .7) { const u = t / .7; x = from.x + (c.x - from.x) * u; y = from.y + (c.y - from.y) * u - 28; }
      else if (t < 1.1) { x = c.x; y = c.y - 28 + (t - .7) / .4 * 20; size = 1 - (t - .7) / .4 * .8; }
      else if (t < 2.3) {
        if (!fired) {
          fired = true; SFX.boom(); cannon.classList.add('fire');
          for (let s = 0; s < 6; s++) svg.insertAdjacentHTML('beforeend', `<circle class="puff" cx="${c.x + (Math.random() - .5) * 40}" cy="${c.y - 20 - Math.random() * 30}" r="${8 + Math.random() * 10}"/>`);
        }
        const u = (t - 1.1) / 1.2, q = arcPoint(c, to, u);
        x = q.x; y = q.y - 28; turn = u * 720; size = .6 + Math.sin(u * Math.PI) * .6;
      } else { x = to.x; y = to.y - 28; }
      marker.setAttribute('transform', `translate(${x} ${y}) rotate(${turn}) scale(${size})`);
      mapScroll(y, false);
      if (t < 2.4) return requestAnimationFrame(step);
      mapBusy = false; mapCannon = null;
      mapAt = dest; store.set('mapAt', dest);
      renderMap();
      flash(`World ${L[dest].world + 1} · ${LF.WORLDS[L[dest].world].name}`);
    };
    requestAnimationFrame(step);
  }

  function mapInfo() {
    const L = LF.LEVELS, lv = L[mapAt], p = progress[mapAt], hc = progressHC[mapAt];
    if (mapHouse != null) {
      $('map-info').innerHTML = `<div>
          <small>Fruit house · beside level ${mapHouse + 1}</small>
          <strong>Fruit Grove</strong>
          <em>${groveUsed(mapHouse) ? `You’ve been in here: the fruit grows back in ${regrowIn(mapHouse)}` : '10 seconds to grab all the fruit you can: it all goes in your inventory'}</em>
        </div>
        <div class="map-actions">${groveUsed(mapHouse) ? '' : '<button class="go" data-act="house">Go in</button>'}</div>`;
      const b = $('map-info').querySelector('[data-act]');
      if (b) b.addEventListener('click', () => { initAudio(); if (!mapBusy) ACTIONS.house({ i: mapHouse }); });
      return;
    }
    if (mapCannon) {
      const dw = cannonDest(mapCannon);
      $('map-info').innerHTML = `<div>
          <small>${mapCannon.secret != null ? 'Secret cannon' : `World ${mapCannon.world + 1} · cannon`}</small>
          <strong>Cannon to World ${dw + 1}</strong>
          <em>${esc(LF.WORLDS[dw].name)} · walk to it and press ↓ to climb in</em>
        </div>
        <div class="map-actions"><button class="go" data-act="cannon">Climb in</button></div>`;
      $('map-info').querySelector('[data-act]').addEventListener('click', () => { initAudio(); if (!mapBusy) ACTIONS.cannon(mapCannon); });
      return;
    }
    const secret = lv.secretTo == null ? '' : secrets[mapAt] ? ` · secret exit found ★ (its cannon reaches World ${lv.secretWorld + 1})` : p ? ' · a secret exit hides here' : '';
    const fork = near(mapAt).length > 2 ? ` · a crossroads: ${near(mapAt).length} paths` : '';
    $('map-info').innerHTML = `<div>
        <small>World ${lv.world + 1} · chapter ${roman(chapterIndex(mapAt))} · ${esc(lv.chapter)} · level ${mapAt + 1} · key ${levelKey(lv.name)}</small>
        <strong>${esc(lv.name)}</strong>
        <em>${lv.boss ? 'boss fight · ' : ''}${p ? 'best ' + fmt(p.best) : 'not yet lit'}${hc ? ` · hardcore ${fmt(hc.best)}` : ''}${fork}${secret}</em>
      </div>
      <div class="map-actions">
        <button class="go" data-act="story" data-i="${mapAt}">Play</button>
        ${secrets[mapAt] ? `<button class="mini" data-act="warp" data-i="${mapAt}">Secret cannon → World ${lv.secretWorld + 1}</button>` : ''}
        <button class="mini" data-act="copyStory" data-i="${mapAt}">Copy to editor</button>
      </div>`;
    for (const b of $('map-info').querySelectorAll('[data-act]')) b.addEventListener('click', () => { initAudio(); if (!mapBusy) ACTIONS[b.dataset.act](b.dataset); });
  }
  for (const b of $('map').querySelectorAll('.map-nav [data-act]')) b.addEventListener('click', () => { initAudio(); if (!mapBusy) ACTIONS[b.dataset.act](b.dataset); });
  // Chapter names are measured to keep them apart, so lay the map out again once the
  // web fonts (which are wider than the fallback) have loaded.
  if (document.fonts) document.fonts.ready.then(() => { if (screen === 'map' && !mapBusy) renderMap(false); });

  // The Fruit Grove: 10 seconds on a little hillside of ledges strewn with fruit (different
  // for every house). Whatever you pick goes in your inventory.
  function fruitGrove(i) {
    const R = LF.rng(4242 + i * 31), kinds = [...Object.keys(LF.FRUITS)];
    return {
      name: 'Fruit Grove', dark: .3, timeLimit: 10, noRegrow: true,
      signs: [{ x: 2, y: 9.4, t: '10 seconds: grab all the fruit you can!' }],
      map: LF.build(44, 14, ({ r, s }) => {
        r(0, 12, 43, 13); s(2, 11, 'P');
        for (let k = 0; k < 6; k++) {
          const x = 5 + k * 6 + Math.floor(R() * 3), y = 7 + Math.floor(R() * 3), len = 3 + Math.floor(R() * 2);
          r(x, y, x + len, y, R() < .5 ? '=' : '#');
          s(x + 1 + Math.floor(R() * (len - 1)), y - 1, kinds[Math.floor(R() * kinds.length)]);
          if (R() < .6) s(x + Math.floor(len / 2), y - 4, kinds[Math.floor(R() * kinds.length)]);
        }
        for (let x = 6; x < 42; x += 5) if (R() < .7) s(x, 11, kinds[Math.floor(R() * kinds.length)]);
        s(20, 11, 'B'); s(34, 11, 'B');
      }),
    };
  }

  // The Cannon Yard: a short walk to a cannon. Climb in with ↓ and it fires you off to the
  // next world (or, for a secret cannon, a faraway one): the map takes up the flight.
  function cannonLevel(how) {
    const dw = cannonDest(how);
    return {
      name: `Cannon to World ${dw + 1}`, dark: .45,
      signs: [{ x: 2, y: 5.4, t: `walk to the cannon · press ↓ to climb in · next: ${LF.WORLDS[dw].name}` }],
      map: LF.build(30, 10, ({ r, s }) => {
        r(0, 8, 29, 9); s(2, 7, 'P');
        r(9, 6, 12, 6, '='); s(10, 5, 'a');
        s(22, 7, '+');
      }),
    };
  }

  // Move the lamplighter to stop i if it's open.
  // Where the lamplighter is: a stop, or a cannon.
  function mapHere() {
    const { pos, worlds, secretCannons, houseSpots } = mapLayout();
    if (mapHouse != null) return houseSpots[mapHouse];
    return mapCannon ? (mapCannon.secret != null ? secretCannons[mapCannon.secret] : worlds[mapCannon.world].cannon) : pos[mapAt];
  }
  // The ways on from here: open levels along a path, a world's cannon once its last level is
  // done (and back from the next world's first level once you've cleared it), a secret
  // cannon once found. A new world is reached by its cannon the first time.
  function mapExits() {
    const { pos, worlds, secretCannons, houseSpots } = mapLayout(), W = LF.WORLDS, out = [];
    if (mapHouse != null) return [{ ...pos[mapHouse], level: mapHouse }];
    if (mapCannon) {
      if (mapCannon.secret != null) return [{ ...pos[mapCannon.secret], level: mapCannon.secret }];
      const k = mapCannon.world;
      out.push({ ...pos[W[k].last], level: W[k].last });
      if (practice || progress[W[k + 1].first]) out.push({ ...pos[W[k + 1].first], level: W[k + 1].first });
      return out;
    }
    for (const j of near(mapAt)) if (unlocked(j)) out.push({ ...pos[j], level: j });
    const k = LF.LEVELS[mapAt].world;
    if (mapAt === W[k].last && worlds[k].cannon && (progress[mapAt] || practice)) out.push({ ...worlds[k].cannon, cannon: { world: k } });
    if (mapAt === W[k].first && k > 0 && (progress[mapAt] || practice)) out.push({ ...worlds[k - 1].cannon, cannon: { world: k - 1 } });
    if (secrets[mapAt]) out.push({ ...secretCannons[mapAt], cannon: { secret: mapAt } });
    if (houseSpots[mapAt] && (progress[mapAt] || practice)) out.push({ ...houseSpots[mapAt], house: mapAt });
    return out;
  }
  // Walk the way (dx, dy) points, along whichever path goes most nearly that way.
  function mapGo(dx, dy) {
    if (mapBusy) return;
    const here = mapHere();
    let best = null, bestDot = .4;
    for (const ex of mapExits()) {
      const vx = ex.x - here.x, vy = ex.y - here.y, dot = (vx * dx + vy * dy) / (Math.hypot(vx, vy) || 1);
      if (dot > bestDot) { bestDot = dot; best = ex; }
    }
    if (!best) return;
    walkTo(here, best, () => {
      mapHouse = null;
      if (best.house != null) { mapHouse = best.house; mapCannon = null; mapAt = best.house; }
      else if (best.cannon) { mapCannon = best.cannon; mapAt = best.cannon.secret != null ? best.cannon.secret : LF.WORLDS[best.cannon.world].last; }
      else { mapCannon = null; mapAt = best.level; }
      store.set('mapAt', mapAt); renderMap();
    });
  }
  // A short stroll from a to b, then done().
  function walkTo(a, b, done) {
    const marker = $('map-board').querySelector('.marker');
    if (!marker || reducedMotion) return done();
    mapBusy = true;
    const t0 = performance.now(), lift = 44;
    const step = now => {
      const u = Math.min(1, (now - t0) / 240), e = u * (2 - u);
      marker.setAttribute('transform', `translate(${a.x + (b.x - a.x) * e} ${a.y + (b.y - a.y) * e - lift - Math.sin(u * Math.PI) * 8})`);
      if (u < 1) return requestAnimationFrame(step);
      mapBusy = false; done();
    };
    requestAnimationFrame(step);
  }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A story level's lit lanterns, remembered when you leave it uncleared (by dying, or from
  // the pause menu) so you start at the last one next time, unless you play another first.
  function saveMidway() {
    if (playCtx.kind !== 'story' || !W || W.cleared || !W.lanternLit) return;
    store.set('midway', { index: playCtx.index, lit: W.lanterns.map((l, k) => (l.lit ? k : -1)).filter(k => k >= 0), cp: W.checkpoint, boss: W.cpBoss });
  }

  function giveUp() {
    if (playCtx.kind === 'story' && !hardcore) { carry = null; store.set('powers', null); store.set('ammo', 0); }
    LF.kill(W);
    if (playCtx.kind === 'story') flash('You gave up: your powers and ammo are gone');
  }
  // Hard restart (Shift+R): the whole level from the very start, every lantern out. It counts
  // as a death like giving up (in the story your powers and ammo are gone); not in a grove.
  function hardRestart() {
    if (playCtx.kind === 'house') return;
    if (playCtx.kind === 'story' && !hardcore) { carry = null; store.set('powers', null); store.set('ammo', 0); }
    store.set('midway', null);
    play(playDef, playCtx);
    flash(playCtx.kind === 'story' ? 'Back to the start: lanterns out, powers and ammo gone' : 'Back to the start');
  }

  // ---------- inventory ----------
  // Fruit you've gathered (in Fruit Groves), up to INV_MAX of each. Tab opens it, on the map
  // only (not in a level): using a fruit gets you ready for your next level. Powers last until you
  // die, and carry on from level to level (carry: { shield, boost, dbl }). Not in Hardcore.
  const INV_MAX = 999, FRUIT_ICON = { a: '🍎', o: '🍊', b: '🍌', m: '🍉', p: '🍐', 'ƥ': '🍍', 'ǥ': '🍇', 'ƫ': '🍑', 'ɯ': '🥭', s: '🍓', 'ç': '🍒', 'ƀ': '🫐' };
  let inventory = { ...Object.fromEntries(Object.keys(LF.FRUITS).map(t => [t, 0])), ...store.get('inventory', {}) };
  for (const t in inventory) if (!LF.FRUITS[t]) delete inventory[t];   // (fruit that's since gone, like the pear)
  let carry = store.get('powers', null), invFrom = null;
  function saveCarry(p) {
    carry = p.shield || LF.hasPowers(p) ? { shield: p.shield, ...LF.powerFlags(p) } : null;
    store.set('powers', carry);
  }
  const powersText = p => [p.shield ? `🍎 shield${p.shield > 1 ? ' ×2' : ''}` : '', ...Object.entries(LF.POWERS).map(([t, k]) => p[k] ? `${FRUIT_ICON[t]} ${LF.FRUITS[t].power.toLowerCase()}` : '')].filter(Boolean).join(' · ') || 'none';
  function showInventory() {
    if (screen === 'play') return flash('Your items are on the map, not in a level');
    if (screen !== 'map' && screen !== 'inv') return;
    if (screen === 'inv') return closeInventory();
    invFrom = screen; screen = 'inv';
    $('inv').hidden = false;
    renderInventory();
  }
  function closeInventory() {
    $('inv').hidden = true;
    screen = invFrom || 'map'; invFrom = null;
  }
  function renderInventory() {
    const now = carry || {};
    $('inv').innerHTML = `<div class="inv-card">
      <header><h2>Inventory</h2><button class="mini" id="inv-close">Close · Tab</button></header>
      <ul class="inv-items">${Object.entries(LF.FRUITS).map(([t, f]) => `<li>
        <span class="inv-icon">${FRUIT_ICON[t]}</span><div><b>${f.name} ×${inventory[t] || 0}</b><small>${esc(f.note)}</small></div>
        <button class="mini go-mini" data-use="${t}" ${(inventory[t] || 0) > 0 && !hardcore && !practice ? '' : 'disabled'}>Use</button></li>`).join('')}</ul>
      <p class="lede">${practice ? 'Practice is on: your items stay put till you turn it off.' : hardcore ? 'Hardcore is on: no fruit.' : `Ready for your next level: ${powersText(now)}`}</p>
      <p class="inv-note">Gather fruit in the fruit houses on the map (each one’s grove grows back an hour after you’ve been in, even while you’re away; fruit in a level only grows back while you play it). Powers last until you die and carry on from level to level. Ammo left over when you clear a level carries on too, until you die${hardcore ? '' : ` (you have ${store.get('ammo', 0)})`}.</p>
    </div>`;
    $('inv-close').addEventListener('click', closeInventory);
    for (const b of $('inv').querySelectorAll('[data-use]')) b.addEventListener('click', () => useItem(b.dataset.use));
  }
  function useItem(t) {
    if (hardcore || !(inventory[t] > 0)) return;
    if (practice) return flash('Practice is on: nothing you use or get counts (turn it off to use your items)');
    const target = { shield: 0, airJumps: 0, ...(carry || {}) };
    if (!LF.applyFruit(target, t)) return flash('You already have that power');
    inventory[t]--; store.set('inventory', inventory);
    saveCarry(target);
    flash(`${FRUIT_ICON[t]} ${LF.FRUITS[t].power}`); SFX.fruit && SFX.fruit();
    renderInventory();
  }

  function showHelp() {
    screen = 'help';
    setVisible({ overlay: true });
    card(`
      <p class="eyebrow">How to play</p>
      <h2>Light every lamp</h2>
      <p class="lede">Night is falling on the old town. Light every lantern to open each door: across the rooftops, up the belfry, down through the kilns and into the Hollow Spire. On the map, each level you clear opens the next; some hide a secret exit that opens a shortcut further on.</p>
      <ul class="keys">
        <li>Map: <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> walk along the paths (the little arrows show the ways on) · <kbd>Enter</kbd> play · crossroads open more than one level</li>
        <li><kbd>←</kbd><kbd>→</kbd> walk · <kbd>Space</kbd> jump (hold for height) · <kbd>↓</kbd> drop through planks</li>
        <li>Every level has a clock: 300 seconds, 400 in a castle (a tower’s boss arena adds 100 seconds when you reach it, a castle’s 200); come back at a lantern and the clock gives you the share of the level still ahead of it, plus 30 seconds (never under 150 seconds): at 50 seconds left a hurry-up tune plays and the music speeds up; when it runs out you die (Fruit Groves have their own 10 seconds)</li>
        <li>Push into a wall to slide down it · jump off walls to climb</li>
        <li><kbd>E</kbd> fire: tap for one shot, hold for autofire; shots splash 1 block · <kbd>X</kbd> explosive round (2 ammo, 3-block blast) · <kbd>A</kbd> kill shot (3 ammo): kills whatever it hits in one go, golems and carts too (a boss takes it as one hit) · every shot counts as one hit (a grenade one per blast, up to three), so golems take 3 and TNT carts 5 (stomps count too); a TNT blast kills everything near it but you · <kbd>Q</kbd> bouncing grenade (3 ammo) · <kbd>D</kbd> dynamite (4 ammo): thrown, it falls and sits where it lands, and after a 3-second fuse kills everything within 5 blocks, golems and carts too (a boss takes it as one hit; it never hurts you) · <kbd>Shift</kbd>+<kbd>D</kbd> big dynamite (8 ammo, 10 blocks) · hold any of them to keep firing · hold <kbd>Shift</kbd> for a big shot: 2× size and blast, 2× ammo · ammo crates are hidden through each level; big crates hold 10, huge ones 25; enemies drop 1–5 ammo when killed, more for tougher ones (TNT carts drop none)</li>
        <li>Keys open the locked-door blocks you touch, one block at a time; you keep the key</li>
        <li>Water is safe: you sink slowly and can jump as often as you like</li>
        <li>Fruit: 🍎 shield (a second apple doubles it) · 🍊 jump boost · 🍌 double jump · 🍉 speed · 🍐 glide (hold <kbd>↑</kbd> or jump while falling; press <kbd>Space</kbd> in mid-air for a big lift, after which you can't glide and fall steadily till you land (wall jumps don't give it back); letting go of <kbd>↑</kbd> and pressing it again just keeps you gliding) · 🍍 spikes don't hurt · 🍇 double ammo from enemies · 🍑 stronger swimming · 🥭 a slower clock · 🍓 wall grip · 🍒 ammo magnet · 🫐 night eyes (twice the light) · only one fruit power besides the apple's shield works at a time: a new fruit takes the place of the last · powers last until you die; powers and leftover ammo carry on to the next level · in the Sky Roads only apples work: the wind holds your other powers and gives them back when you leave</li>
        <li>Towers have no guns: the boss falls to 3 stomps, but each stomp throws it into a 10-second fury: it glows red and rampages round the arena, leaping (with a slam where it lands) or darting about dropping bombs, and throwing rings of embers, rocks from the ceiling and fire round your feet; then it's worn out and stands dazed for a moment: stomp it then · its last fury (one stomp left) adds its own signature move · the Last Dark takes 5 stomps and you can't stomp it again until it calms down · your ammo waits for you outside</li>
        <li>Neo: when a slab sits right over your ledge, flush with its edge, run off the edge, jump at once and steer straight back in to land on top (miss, and you just drop back)</li>
        <li>Wheels turn their platforms round and round: ride one to the top · in the Sky Roads there's no floor at all, just the long drop</li>
        <li>Lanterns are checkpoints (one a level, two in a tower, three in the castle): dying sends you back to the map, but go into the same level again and you start at the lantern you lit; play another level first and it's put out</li>
        <li>Towers: climb, then the battlements, then the boss; beating the boss ends the level</li>
        <li>Practice mode (on the map): every level open, and nothing counts: no progress, awards or secret exits, your carried powers and ammo aren't used or changed, Fruit Groves give nothing to keep (and aren't used up), and items can't be used · <kbd>Z</kbd> set a checkpoint · <kbd>X</kbd> remove the latest · <kbd>C</kbd> explosive round</li>
        <li>Dying loses all your ammo (and your fruit powers) · <kbd>R</kbd> give up: you die (back to the map; lit lanterns are kept) · <kbd>Shift</kbd>+<kbd>R</kbd> restart the whole level from the start, lanterns out (also a death: powers and ammo gone) · <kbd>Esc</kbd> pause · <kbd>M</kbd> sound ${muted ? 'off' : 'on'} · <kbd>N</kbd> music ${store.get('music', true) ? 'on' : 'off'}</li>
      </ul>
      ${hardcore ? '<p class="lede hc-note">Hardcore is on: no lanterns, no ammo, no fruit, no invincibility after respawning. The door is already open, but there are no checkpoints: every fall sends you back to the start, in the dark. Water turns to lava.</p>' : ''}
      <div class="menu"><button class="go" data-act="menu">Back to the map</button></div>`);
  }

  // Your own saved levels (the story levels live on the map).
  function showYours() {
    screen = 'select';
    setVisible({ select: true });
    let html = '';
    html += `<section class="chapter"><h3><span>Workshop</span>Saved in this browser</h3>` + (customs.length
      ? `<ul class="customs">${customs.map(c => `<li><div><strong>${esc(c.name)}</strong><small>${c.map[0].length}×${c.map.length} · ${shapeOf(c)} · key <span class="lvl-key">${customKey(c)}</span></small></div>
          <span><button class="mini go-mini" data-act="custom" data-id="${c.id}">Play</button><button class="mini" data-act="editCustom" data-id="${c.id}">Edit</button><button class="mini danger" data-act="deleteCustom" data-id="${c.id}">Delete</button></span></li>`).join('')}</ul>`
      : `<p class="empty">Nothing saved yet. Build one in the editor, or generate a random map and save it.</p>`) + `</section>`;
    $('sel-body').innerHTML = html;
    for (const b of $('sel-body').querySelectorAll('[data-act]')) b.addEventListener('click', () => { initAudio(); ACTIONS[b.dataset.act](b.dataset); });
  }

  function hudLabel() {
    return hudLabelBase() + (hardcore && playCtx.kind !== 'test' ? ' · Hardcore' : '');
  }
  function hudLabelBase() {
    if (playCtx.kind === 'story') return `Chapter ${roman(chapterIndex(playCtx.index))} · Level ${playCtx.index + 1} of ${LF.LEVELS.length} · key ${levelKey(LF.LEVELS[playCtx.index].name)}`;
    if (playCtx.kind === 'random') return `Random · ${playCtx.opts.shape === 'mixed' ? 'up & across' : playCtx.opts.shape === 'up' ? 'upward' : 'across'} · seed ${playCtx.opts.seed}`;
    if (playCtx.kind === 'test') return 'Test play · Esc to edit';
    if (playCtx.kind === 'cannon') return `Cannon Yard · to World ${cannonDest(playCtx.how) + 1}`;
    if (playCtx.kind === 'house') return 'Fruit house · 10 seconds';
    if (playCtx.kind === 'practice') return `Practice · level ${playCtx.index + 1} · Z checkpoint · X remove it · C explosive`;
    if (playCtx.kind === 'shared') return 'Shared level';
    const key = keyFor(playCtx);
    return key ? `Your level · key ${key}` : 'Your level';
  }
  const chapterIndex = i => { const names = [...new Set(LF.LEVELS.map(l => l.chapter))]; return names.indexOf(LF.LEVELS[i].chapter); };

  // A level's clock: 300 seconds; a castle's 400. (A tower's boss arena adds 100 more when
  // you reach it, a castle's 200: see play.)
  const clockFor = def => def.clock || (def.castle ? 400 : 300);
  function play(def, ctx) {
    // Story levels are four times as long (see lengthen.js).
    if ((ctx.kind === 'story' || ctx.kind === 'practice') && LF.lengthen) def = LF.lengthen(def);
    playDef = def; playCtx = ctx;
    // (While you're in a story level, the save says so: see leftMidLevel.)
    store.set('inLevel', ctx.kind === 'story' ? { index: ctx.index } : null);
    // A Fruit Grove counts as visited the moment you walk in: no refreshing for another go.
    if (ctx.kind === 'house' && !ctx.practice) { houses[ctx.i] = { at: Date.now() }; store.set('houses', houses); }
    if (LF.music) { LF.music.play(trackFor(def, ctx, false)); LF.music.duck(false); }
    if (ctx.kind !== 'shared') setHash(keyFor(ctx));
    // Fruit powers and ammo you're carrying come with you into story levels (not in Hardcore).
    const carrying = ctx.kind === 'story' && !hardcore;
    let withPowers = carrying ? { ...def, ...(carry ? { powers: carry } : {}), carryAmmo: store.get('ammo', 0) } : def;
    // Story: dying sends you back to the map. Lanterns you lit stay lit for your next go at
    // the same level; playing any other level puts them out. Practice: plenty of ammo.
    if (ctx.kind === 'story') {
      const mw = store.get('midway', null);
      withPowers = { ...withPowers, toMapOnDeath: true, ...(mw && mw.index === ctx.index ? { resume: mw } : {}) };
      if (!mw || mw.index !== ctx.index) store.set('midway', null);
    }
    if (ctx.kind === 'practice') withPowers = { ...withPowers, carryAmmo: 40 };
    // Every level but a timed one (a Fruit Grove) has a clock set by how long it is (see
    // clockFor), and a tower's boss arena adds 100 seconds more (a castle's, 200); not in
    // practice or when testing in the editor.
    if (!def.timeLimit && ctx.kind !== 'practice' && ctx.kind !== 'test') withPowers = { ...withPowers, deadline: clockFor(def), bossTime: def.arenaX ? (def.castle ? 200 : 100) : 0 };
    if (LF.music) LF.music.hurry(false);
    W = LF.createWorld(hardcore && ctx.kind !== 'test' ? hardcoreDef(withPowers) : withPowers);
    for (const k in input) input[k] = false;
    syncBig(false);
    LF.followCamera(W, cam, 0, true);
    screen = 'play';
    setVisible({ hud: true, touch: true });
    $('hud-num').textContent = hudLabel();
    $('hud-name').textContent = W.name;
    hudCache = '';
    flash(W.def.needsSwim ? `${W.name} · no lava here: you have to swim` : W.name);
  }
  app.play = play;

  function pause() {
    if (screen !== 'play') return;
    screen = 'paused';
    if (LF.music) LF.music.duck(true);
    setVisible({ hud: true, overlay: true });
    const lit = W.lanterns.filter(l => l.lit).length;
    card(`
      <p class="eyebrow">${esc(hudLabel())}</p>
      <h2>Paused</h2>
      <p class="lede">${esc(W.name)} · ${lit} of ${W.total} lanterns lit · ${fmt(W.time)}</p>
      ${keyFor(playCtx) ? `<p class="lede">Level key <b class="lvl-key">${keyFor(playCtx)}</b> · <span class="key-link">${esc(keyLink(keyFor(playCtx)))}</span>${playCtx.kind === 'custom' ? '<br><small>Your own levels’ keys only work in this browser. To share one, use Copy play link in the editor’s Share code.</small>' : ''}</p>` : ''}
      <div class="menu">
        <button class="go" data-act="resume">Resume</button>
        ${playCtx.kind === 'house' ? '' : '<button class="alt" data-act="giveUp">Give up · R</button><button class="alt" data-act="hardRestart">Restart level · Shift+R</button>'}
        ${playCtx.kind === 'test' ? '<button class="alt" data-act="backToEditor">Back to editor</button>' : ''}
        ${playCtx.kind === 'random' ? '<button class="alt" data-act="editRandom">Open in editor</button>' : ''}
        ${playCtx.kind !== 'test' && playCtx.kind !== 'story' ? '<button class="alt" data-act="copyToEditor">Copy to editor</button>' : ''}
        ${playCtx.kind === 'story' || playCtx.kind === 'house' ? '' : '<button class="alt" data-act="menu">Back to the map</button>'}
      </div>
      ${playCtx.kind === 'story' ? '<p class="lede"><small>No walking out of a story level: finish it, or give up (that counts as a death).</small></p>' : playCtx.kind === 'house' ? '<p class="lede"><small>No giving up in a Fruit Grove: the clock’s running till it’s over.</small></p>' : ''}`);
  }

  function cleared() {
    // Clearing a story level carries your fruit powers and leftover ammo on to the next
    // (and its lanterns are done with).
    if (playCtx.kind === 'story') { store.set('midway', null); store.set('inLevel', null); }
    // (Towers have no guns, so the ammo you're carrying waits for you outside.)
    if (playCtx.kind === 'story' && !hardcore) { saveCarry({ ...W.player, ...(W.player.held || {}) }); if (!W.def.noAmmo) store.set('ammo', W.player.ammo); }
    // Out of the Fruit Grove: everything picked goes in the inventory.
    // (In practice, a grove's just for fun: the fruit isn't kept and the grove isn't used up.)
    if (playCtx.kind === 'house' && playCtx.practice) {
      screen = 'clear';
      setVisible({ hud: true, overlay: true });
      card(`<p class="eyebrow">Fruit Grove · practice</p><h2>${W.fruits.filter(f => f.taken).length} picked</h2>
        <p class="lede">Practice is on, so the fruit isn't kept and the grove isn't used up.</p>
        <div class="menu"><button class="go" data-act="menu">Back to the map</button></div>`);
      return;
    }
    if (playCtx.kind === 'house') {
      screen = 'clear';
      setVisible({ hud: true, overlay: true });
      houses[playCtx.i] = { at: Date.now() }; store.set('houses', houses);
      const got = Object.entries(W.got).filter(([, n]) => n > 0);
      for (const [t, n] of got) inventory[t] = Math.min(INV_MAX, (inventory[t] || 0) + n);
      store.set('inventory', inventory);
      mapHouse = null;
      card(`<p class="eyebrow">Fruit Grove · time’s up</p><h2>${got.length ? 'A good haul' : 'Nothing this time'}</h2>
        <p class="lede">${got.length ? 'Into your inventory: ' + got.map(([t, n]) => `${FRUIT_ICON[t]} ×${n}`).join(' · ') : 'The fruit got away.'} Press <kbd>Tab</kbd> on the map to use it (not in a level).</p>
        <div class="menu"><button class="go" data-act="menu">Back to the map</button></div>`);
      return;
    }
    // A practice run: well done, but nothing's kept.
    if (playCtx.kind === 'practice') {
      screen = 'clear';
      setVisible({ hud: true, overlay: true });
      card(`<p class="eyebrow">Practice · level ${playCtx.index + 1}</p><h2>${esc(W.name)}</h2>
        <dl class="tally"><div><dt>Time</dt><dd>${fmt(W.time)}</dd></div><div><dt>Falls</dt><dd>${W.falls}</dd></div></dl>
        <p class="lede">Practice runs don't count toward progress or awards.</p>
        <div class="menu"><button class="go" data-act="restart">Again</button><button class="alt" data-act="menu">Back to the map</button></div>`);
      return;
    }
    // Out of the Cannon Yard: straight back to the map, mid-flight.
    if (playCtx.kind === 'cannon') {
      store.set('launch', { ...playCtx.how, fromCannon: true });
      return showMap();
    }
    screen = 'clear';
    setVisible({ hud: true, overlay: true });
    const t = W.time, falls = W.falls;
    let eyebrow = 'Every lamp lit', title = W.name, stats = '', buttons = '';
    const tally = (extra = '') => `<dl class="tally"><div><dt>Time</dt><dd>${fmt(t)}</dd></div><div><dt>Falls</dt><dd>${falls}</dd></div>${extra}</dl>`;
    if (playCtx.kind === 'story') {
      const openBefore = openSet(), cannonsBefore = new Set(openCannons());
      // Hardcore runs keep their own best times; a hardcore clear also counts the level as lit.
      const book = hardcore ? progressHC : progress, i = playCtx.index, prev = book[i], wasLit = !!progress[i];
      const isBest = !prev || t < prev.best;
      if (isBest) { book[i] = { best: t, falls }; store.set(hardcore ? 'progressHC' : 'progress', book); }
      if (hardcore && !progress[i]) { progress[i] = { best: t, falls }; store.set('progress', progress); }
      LF.awards.clear({ kind: 'story', index: i, time: t, falls, hardcore, horde: !!W.horde, storyLit: Object.keys(progress).length, hcLit: Object.keys(progressHC).length });
      story.time += t; story.falls += falls;
      const last = i === LF.LEVELS.length - 1, secret = W.clearedBy === 'secret' && LF.LEVELS[i].secretTo != null;
      // On the map the lamplighter moves on: to the next level, or down the secret path.
      if (secret) { secrets[i] = true; store.set('secrets', secrets); }
      mapAt = secret ? i : Math.min(i + 1, LF.LEVELS.length - 1); store.set('mapAt', mapAt);
      if (secret) mapCannon = { secret: i };
      // The first time you finish a world, the map fires you out of its cannon to the next.
      const world = LF.WORLDS[LF.LEVELS[i].world], worldDone = !secret && !wasLit && world.last === i && LF.WORLDS[LF.LEVELS[i].world + 1];
      if (worldDone) { mapAt = i; mapCannon = { world: LF.LEVELS[i].world }; store.set('mapAt', i); }
      // Won: straight back to the map, to watch what it opened (the very last level gets
      // its ending instead).
      if (!last) {
        const fresh = [...openSet()].filter(k => !openBefore.has(k)), cannons = openCannons().filter(k => !cannonsBefore.has(k));
        const opened = fresh.length ? ` · ${fresh.length === 1 ? `level ${fresh[0] + 1} open` : `${fresh.length} new levels open`}` : '';
        const msg = worldDone ? `${world.name} complete! Press Enter to climb into the cannon`
          : secret ? 'Secret exit found! Press Enter to climb into the secret cannon'
          : `${esc(W.name)} lit · ${fmt(t)}${isBest && prev ? ' · new best!' : ''}${opened}`;
        unlockShow = { lit: i, fresh, cannons, msg };
        return showMap();
      }
      eyebrow = secret ? `Level ${i + 1} · secret exit found!` : `Level ${i + 1} of ${LF.LEVELS.length} · ${hardcore ? 'hardcore clear' : 'every lamp lit'}`;
      stats = tally(`<div class="best"><dt>${isBest ? 'New best' : 'Best'}</dt><dd>${fmt(isBest ? t : prev.best)}</dd></div>`);
      if (worldDone) {
        const next = LF.WORLDS[LF.LEVELS[i].world + 1];
        eyebrow = `World ${LF.LEVELS[i].world + 1} · ${world.name} · complete!`;
        stats += `<p class="lede">The lamplighter climbs into the cannon at the end of ${esc(world.name)}… next stop, World ${LF.LEVELS[i].world + 2}: ${esc(next.name)}.</p>`;
        buttons = `<button class="go" data-act="toCannon">To the cannon!</button><button class="alt" data-act="menu">Back to the map</button><button class="alt" data-act="restart">Replay</button>`;
      } else if (secret) {
        const sw = LF.LEVELS[i].secretWorld;
        stats += `<p class="lede">A hidden path opens on the map, to a secret cannon… aimed at World ${sw + 1}: ${esc(LF.WORLDS[sw].name)}.</p>`;
        buttons = `<button class="go" data-act="toCannon">To the secret cannon!</button><button class="alt" data-act="menu">Back to the map</button><button class="alt" data-act="restart">Replay</button>`;
      } else if (last) {
        eyebrow = 'The whole town is lit'; title = 'Every lamp burns.';
        stats += `<p class="lede">All ${LF.LEVELS.length} levels done. The lamplighter goes home. Try the random maps, or build a level of your own.</p>`;
        buttons = `<button class="go" data-act="menu">Back to the map</button><button class="alt" data-act="random">Random map</button><button class="alt" data-act="copyToEditor">Copy to editor</button><button class="alt" data-act="editor">Level editor</button>`;
      } else {
        const nx = LF.LEVELS[i + 1];
        stats += `<p class="lede">Next: ${esc(nx.name)} · ${nx.map[0].length}×${nx.map.length}, ${shapeOf(nx)}.</p>`;
        buttons = `<button class="go" data-act="story" data-i="${i + 1}">Next level</button><button class="alt" data-act="menu">Back to the map</button><button class="alt" data-act="restart">Replay</button><button class="alt" data-act="copyToEditor">Copy to editor</button>`;
      }
    } else if (playCtx.kind === 'random') {
      LF.awards.clear({ kind: 'random', time: t, falls, hardcore, horde: !!W.horde });
      eyebrow = `Random map · seed ${playCtx.opts.seed}`; stats = tally();
      buttons = `<button class="go" data-act="rerollRandom">Another random map</button><button class="alt" data-act="saveRandom">Save to Your levels</button><button class="alt" data-act="editRandom">Open in editor</button><button class="alt" data-act="menu">Back to the map</button>`;
    } else if (playCtx.kind === 'test') {
      eyebrow = 'Test play · cleared'; stats = tally();
      buttons = `<button class="go" data-act="backToEditor">Back to editor</button><button class="alt" data-act="restart">Play again</button>`;
    } else if (playCtx.kind === 'shared') {
      eyebrow = 'Shared level · cleared'; stats = tally();
      buttons = `<button class="go" data-act="restart">Play again</button><button class="alt" data-act="editShared">Open in editor</button><button class="alt" data-act="menu">Back to the map</button>`;
    } else {
      LF.awards.clear({ kind: 'custom', time: t, falls, hardcore, horde: !!W.horde });
      eyebrow = 'Your level · cleared'; stats = tally();
      buttons = `<button class="go" data-act="restart">Play again</button><button class="alt" data-act="editCustom" data-id="${playCtx.id}">Edit</button><button class="alt" data-act="yours">Your levels</button>`;
    }
    card(`<p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${stats}<div class="menu">${buttons}</div>`);
  }

  function openEditor(def) {
    setHash(null);
    screen = 'editor';
    setVisible({});
    editor.open(def);
  }

  // ---------- dialogs ----------
  let genFrom = 'menu';
  app.openGenerator = from => {
    genFrom = from;
    $('gen-seed').value = Math.floor(Math.random() * 1e6);
    $('gen-edit').textContent = from === 'editor' ? 'Replace editor map' : 'Open in editor';
    $('gen-dialog').showModal();
  };
  const genOpts = () => ({
    shape: $('gen-shape').value, size: $('gen-size').value,
    difficulty: +$('gen-diff').value, seed: Math.abs(parseInt($('gen-seed').value, 10)) || 1,
  });
  $('gen-reseed').addEventListener('click', () => { $('gen-seed').value = Math.floor(Math.random() * 1e6); });
  $('gen-play').addEventListener('click', () => {
    initAudio();
    const o = genOpts(); $('gen-dialog').close();
    play(LF.generate(o), { kind: 'random', opts: o });
  });
  $('gen-edit').addEventListener('click', () => {
    const o = genOpts(); $('gen-dialog').close();
    openEditor(LF.generate(o));
  });
  $('gen-cancel').addEventListener('click', () => $('gen-dialog').close());

  const encode = d => 'LF1:' + btoa(unescape(encodeURIComponent(JSON.stringify({ n: d.name, d: d.dark, m: d.map.join('/'), t: d.tuning, p: d.player }))));
  // Accepts an LF1: share code, or a raw map: lines of tiles like the editor's (P start, D door...).
  const decode = code => {
    const text = code.trim();
    const lines = text.split(/\r?\n|\//).map(l => l.trimEnd()).filter(l => l.length);
    if (!/^LF1:/.test(text) && lines.length > 1 && lines.join('').includes('P')) return { name: 'Pasted level', dark: .6, map: lines };
    const j = JSON.parse(decodeURIComponent(escape(atob(text.replace(/^LF1:/, '')))));
    if (!j.m) throw new Error('no map');
    return { name: j.n || 'Imported level', dark: typeof j.d === 'number' ? j.d : .6, map: j.m.split('/'), tuning: j.t, player: j.p };
  };
  // Every story level has a short, permanent key made from its name, e.g. K7QXM.
  // Typing the site address followed by #KEY opens that level.
  const KEY_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const hashKey = (text, len) => {
    let h = 2166136261;
    for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    let key = '';
    for (let k = 0; k < len; k++) { key += KEY_ABC[h % 32]; h = Math.floor(h / 32); }
    return key;
  };
  const levelKey = LF.levelKey = name => hashKey(name, 5);
  // Your own saved levels get 6-character keys (so they never clash with story keys).
  // They're stored in this browser, so the key only opens the level here.
  const customKey = c => hashKey('custom:' + c.id, 6);
  const keyFor = ctx => ctx.kind === 'story' ? levelKey(LF.LEVELS[ctx.index].name)
    : ctx.kind === 'custom' ? (customs.find(c => c.id === ctx.id) ? customKey(customs.find(c => c.id === ctx.id)) : null) : null;
  const siteBase = () => `${location.origin}${location.pathname.replace(/lanternfall\.html$/, '')}`;
  const keyLink = key => `${siteBase()}#${key}`;
  // Keep the address bar's #part in step with what's being played.
  const setHash = h => history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : ''));

  // A link that opens straight into a level: lanternfall.html#level=LF1:...  or  #KEY for a story level.
  const linkFor = d => `${location.origin}${location.pathname}#level=${encodeURIComponent(encode(d))}`;
  function openFromLink() {
    const k = location.hash.match(/^#([A-Za-z0-9]{5,6})$/);
    if (k) {
      const key = k[1].toUpperCase();
      const i = LF.LEVELS.findIndex(lv => levelKey(lv.name) === key);
      if (i >= 0) { play(LF.LEVELS[i], { kind: 'story', index: i }); return true; }
      const c = customs.find(x => customKey(x) === key);
      if (c) { play(c, { kind: 'custom', id: c.id }); return true; }
      flash(key.length === 6 ? `${key} is a level saved in someone else's browser — ask them for its play link` : `No level has the key ${key}`);
      return false;
    }
    const m = location.hash.match(/^#level=(.+)$/);
    if (!m) return false;
    try { play(decode(decodeURIComponent(m[1])), { kind: 'shared' }); return true; }
    catch (e) { flash('That level link could not be read'); return false; }
  }
  addEventListener('hashchange', () => { if (screen !== 'editor') openFromLink(); });
  app.openCode = d => {
    $('code-text').value = encode(d);
    $('code-msg').textContent = 'Copy this code or a play link to share your level. Paste someone else’s code (or a raw map) here and choose Load.';
    $('code-link').onclick = async () => {
      const url = linkFor(d);
      try { await navigator.clipboard.writeText(url); $('code-msg').textContent = 'Link copied. Anyone who opens it plays the level straight away.'; }
      catch (e) { $('code-text').value = url; $('code-text').select(); $('code-msg').textContent = 'Copy this link with ⌘C / Ctrl+C.'; }
    };
    $('code-dialog').showModal();
    $('code-text').select();
  };
  $('code-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('code-text').value); $('code-msg').textContent = 'Copied.'; }
    catch (e) { $('code-text').select(); $('code-msg').textContent = 'Select the text and copy it with ⌘C / Ctrl+C.'; }
  });
  $('code-load').addEventListener('click', () => {
    try { const raw = $('code-text').value.trim(), link = raw.match(/#level=(.+)$/); const d = decode(link ? decodeURIComponent(link[1]) : raw); $('code-dialog').close(); openEditor(d); flash('Level loaded'); }
    catch (e) { $('code-msg').textContent = 'That could not be read. Paste a whole LF1: code, a level link, or a raw map with a start (P).'; }
  });
  $('code-cancel').addEventListener('click', () => $('code-dialog').close());

  app.saveCustom = d => {
    LF.awards.saved();
    const id = d.id || 'c' + Date.now().toString(36);
    const rec = { id, name: d.name || 'Untitled', dark: d.dark, map: d.map, tuning: d.tuning, player: d.player, updated: Date.now() };
    const i = customs.findIndex(c => c.id === id);
    if (i >= 0) customs[i] = rec; else customs.unshift(rec);
    store.set('custom', customs);
    return rec;
  };
  app.menu = showMap;

  // ---------- actions ----------
  const ACTIONS = {
    story: d => {
      if (practice) return play(LF.LEVELS[+d.i], { kind: 'practice', index: +d.i });
      story = +d.i === 0 ? { time: 0, falls: 0 } : story; play(LF.LEVELS[+d.i], { kind: 'story', index: +d.i });
    },
    togglePractice: () => { practice = !practice; store.set('practice', practice); mapCannon = null; mapHouse = null; renderMap(false); flash(practice ? 'Practice on: every level open · Z/X set and clear checkpoints · nothing counts: no progress, awards, items or carried powers' : 'Practice off'); },
    select: showMap,
    yours: showYours,
    help: showHelp,
    // Follow a secret path you've found: the lamplighter goes to the level it leads to.
    // Stand at a secret cannon you've found (from the level's button on the map).
    warp: d => { const i = +(d.i ?? mapAt); if (LF.LEVELS[i].secretTo != null && secrets[i]) { mapAt = i; mapCannon = { secret: i }; store.set('mapAt', i); renderMap(); } },
    // Into a fruit house's Fruit Grove (once an hour per house).
    house: d => { const i = +d.i; if (houseOpen(i)) play(fruitGrove(i), { kind: 'house', i, practice }); },
    items: () => showInventory(),
    // From the clear screen: off to the cannon you've just reached.
    toCannon: () => ACTIONS.cannon(mapCannon),
    // Play the Cannon Yard for a cannon.
    cannon: how => { if (how && cannonOpen(how)) play(cannonLevel(how), { kind: 'cannon', how: { world: how.world, secret: how.secret } }); },
    random: () => app.openGenerator('menu'),
    editor: () => openEditor(),
    menu: () => { if (screen === 'paused') saveMidway(); showMap(); },
    awards: showAwards,
    updates: showUpdates,
    toggleHardcore: () => { hardcore = !hardcore; store.set('hardcore', hardcore); renderMap(false); flash(hardcore ? 'Hardcore on' : 'Hardcore off'); },
    resume: () => { screen = 'play'; setVisible({ hud: true, touch: true }); if (LF.music) LF.music.duck(false); },
    restart: () => play(playDef, playCtx),
    giveUp: () => { ACTIONS.resume(); giveUp(); },
    hardRestart: () => { ACTIONS.resume(); hardRestart(); },
    backToEditor: () => { screen = 'editor'; setVisible({}); editor.resume(); },
    editRandom: () => openEditor({ ...playDef }),
    rerollRandom: () => { const o = { ...playCtx.opts, seed: Math.floor(Math.random() * 1e6) }; play(LF.generate(o), { kind: 'random', opts: o }); },
    saveRandom: () => { app.saveCustom({ ...playDef }); flash('Saved to Your levels'); },
    custom: d => { const c = customs.find(x => x.id === d.id); if (c) play(c, { kind: 'custom', id: c.id }); },
    editShared: () => { history.replaceState(null, '', location.pathname); openEditor({ ...playDef }); },
    // Open a copy of any level in the editor (saved as a new level of your own).
    copyToEditor: () => openEditor({ ...playDef, name: `${playDef.name} (copy)`, id: null }),
    copyStory: d => { const lv = LF.LEVELS[+d.i]; openEditor({ ...lv, name: `${lv.name} (copy)`, id: null }); },
    editCustom: d => { const c = customs.find(x => x.id === d.id); if (c) openEditor({ ...c }); },
    deleteCustom: d => {
      const c = customs.find(x => x.id === d.id);
      if (!c || !confirm(`Delete “${c.name}”? This can’t be undone.`)) return;
      customs = customs.filter(x => x.id !== d.id); store.set('custom', customs); showYours();
    },
  };
  $('sel-back').addEventListener('click', showMap);

  // ---------- input ----------
  // (No WASD: A is the kill shot.)
  const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', Space: 'jump', KeyZ: 'jump', ArrowDown: 'down', KeyE: 'fire', KeyF: 'fire', KeyX: 'rocket', KeyC: 'rocket', KeyQ: 'grenade', KeyA: 'kill', KeyD: 'dyn' };
  const SHOTS = ['fire', 'rocket', 'grenade', 'kill', 'dyn'];
  // Big shots: hold Shift, or on a phone tap BIG to switch them on until tapped again.
  let bigLock = false;
  const syncBig = shift => { input.big = shift || bigLock; };
  addEventListener('keydown', e => {
    syncBig(e.shiftKey);
    if (e.target.closest && e.target.closest('input, textarea, select, dialog')) return;
    initAudio();   // (any key wakes the sound up, music and all)
    // N turns the music on or off (anywhere but the editor).
    if (e.code === 'KeyN' && !e.repeat && screen !== 'editor' && !e.metaKey && !e.ctrlKey) {
      initAudio();
      const v = !store.get('music', true); store.set('music', v); if (LF.music) LF.music.setOn(v);
      flash(v ? 'Music on' : 'Music off');
    }
    // Leave browser and OS shortcuts (⌘W, ⌘T, ⌘R…) alone.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (screen === 'editor') { if (e.code === 'Escape') showMap(); return; }
    if (e.code === 'Tab' && (screen === 'map' || screen === 'play' || screen === 'inv')) { e.preventDefault(); initAudio(); showInventory(); return; }
    if (screen === 'inv') { if (e.code === 'Escape') closeInventory(); return; }
    // In practice, Z sets a checkpoint and X removes the latest (C fires explosive rounds).
    if (screen === 'play' && playCtx.kind === 'practice' && (e.code === 'KeyZ' || e.code === 'KeyX')) {
      e.preventDefault();
      if (!e.repeat) { if (e.code === 'KeyZ') { if (!LF.setMark(W)) flash('Stand on solid ground to set a checkpoint'); } else if (!LF.dropMark(W)) flash('No checkpoints to remove'); }
      return;
    }
    const k = KEYMAP[e.code];
    if (screen === 'play') {
      if (k) {
        e.preventDefault();
        if (k === 'jump' && !input.jump && !e.repeat) input.jumpPressed = true;
        // (Space and Z also spin with the pear in mid-air; Up only glides.)
        if ((e.code === 'Space' || e.code === 'KeyZ') && !e.repeat) input.spinPressed = true;
        if (SHOTS.includes(k) && !input[k] && !e.repeat) input[k + 'Pressed'] = true;
        input[k] = true;
      }
      // R gives up: it's a death like any other (back to the map, your lit lanterns kept), and
      // in the story you lose everything you were carrying too: fruit powers and ammo.
      if (e.code === 'KeyR' && !e.repeat && !W.cleared && playCtx.kind !== 'house') { if (e.shiftKey) hardRestart(); else if (!W.player.dead) giveUp(); }
      if (e.code === 'Escape' && playCtx.kind === 'test') ACTIONS.backToEditor();
      else if (e.code === 'Escape' || e.code === 'KeyP') pause();
      if (e.code === 'KeyM') { muted = !muted; store.set('muted', muted); if (LF.music) LF.music.setMuted(muted); flash(muted ? 'Sound off' : 'Sound on'); }
      initAudio();
      return;
    }
    if (screen === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { ACTIONS.resume(); return; }
    if (screen === 'select' && e.code === 'Escape') { showMap(); return; }
    if (screen === 'map') {
      if (mapBusy) { e.preventDefault(); return; }
      if (e.code === 'ArrowRight' && e.shiftKey && secrets[mapAt] && !mapCannon) { e.preventDefault(); mapCannon = { secret: mapAt }; renderMap(); return; }
      const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (dirs[e.code]) { e.preventDefault(); mapGo(...dirs[e.code]); return; }
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); initAudio(); if (mapHouse != null) ACTIONS.house({ i: mapHouse }); else if (mapCannon) ACTIONS.cannon(mapCannon); else ACTIONS.story({ i: mapAt }); return; }
    }
    if (k === 'jump' || e.code === 'Space') e.preventDefault();
  });
  addEventListener('pointerdown', () => initAudio());
  addEventListener('keyup', e => { syncBig(e.shiftKey); const k = KEYMAP[e.code]; if (k) input[k] = false; });
  addEventListener('blur', () => { for (const k in input) input[k] = false; syncBig(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play') pause(); });

  function bindTouch(id, k) {
    const el = $(id);
    const on = e => { e.preventDefault(); initAudio(); if (k === 'jump' && !input.jump) input.jumpPressed = true; if (k === 'jump') input.spinPressed = true; if (SHOTS.includes(k) && !input[k]) input[k + 'Pressed'] = true; input[k] = true; el.classList.add('on'); };
    const off = e => { e.preventDefault(); input[k] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
  }
  bindTouch('t-left', 'left'); bindTouch('t-right', 'right'); bindTouch('t-jump', 'jump'); bindTouch('t-down', 'down'); bindTouch('t-fire', 'fire'); bindTouch('t-rocket', 'rocket'); bindTouch('t-grenade', 'grenade'); bindTouch('t-kill', 'kill'); bindTouch('t-dyn', 'dyn');
  $('t-pause').addEventListener('click', () => pause());
  $('t-big').addEventListener('pointerdown', e => {
    e.preventDefault(); initAudio();
    bigLock = !bigLock; syncBig(false);
    e.currentTarget.classList.toggle('on', bigLock); e.currentTarget.setAttribute('aria-pressed', bigLock);
  });

  // ---------- HUD ----------
  let hudCache = '';
  function hud() {
    const lit = W.lanterns.filter(l => l.lit).length, open = W.door && W.door.open;
    const p = W.player;
    const boss = W.enemies.find(e => e.alive && e.awake && LF.isBoss(e));
    const key = `${lit}|${Math.floor(W.time * 10)}|${W.falls}|${open}|${p.shield}|${Object.values(LF.powerFlags(p)).join('')}|${p.ammo}|${JSON.stringify(p.keys)}|${boss ? boss.type + boss.hp : ''}`;
    if (key === hudCache) return;
    hudCache = key;
    // With no lanterns (a boss arena, or Hardcore) the door is all there is to show.
    $('hud-lamps-label').textContent = W.cannon && !W.door ? 'Cannon' : open || !W.total ? 'Door' : 'Lanterns';
    $('hud-lamps').textContent = W.cannon && !W.door ? '↓ to climb in' : open ? 'open' : W.total ? `${lit}/${W.total}` : 'shut';
    $('hud-lamps-wrap').className = open ? 'open' : 'lamps';
    const clock = W.def.deadline ? Math.max(0, Math.ceil(LF.timeLeft(W))) : null;
    $('hud-time').textContent = clock != null ? clock : fmt(W.def.timeLimit ? Math.max(0, W.def.timeLimit - W.time) : W.time);
    $('hud-time').previousElementSibling.textContent = W.def.timeLimit || clock != null ? 'Left' : 'Time';
    $('hud-time').style.color = clock != null && clock <= (W.def.hurry || LF.HURRY) ? '#FF6B3D' : '';
    $('hud-falls').textContent = W.falls;
    $('hud-ammo').textContent = W.def.noAmmo ? 'stomp!' : p.ammo;
    const held = Object.keys(p.keys);
    $('hud-keys-wrap').hidden = !held.length;
    $('hud-keys').innerHTML = held.map(k => `<i style="color:${LF.KEYS[k].color}">${LF.KEYS[k].name.split(' ')[0]}</i>`).join('');
    $('hud-ammo-wrap').className = p.ammo ? 'ammo' : 'ammo empty';
    const powers = [];
    if (p.shield) powers.push(`<i class="pw-a">Shield${p.shield > 1 ? ' ×2' : ''}</i>`);
    if (p.boost > 0) powers.push('<i class="pw-o">Boost</i>');
    if (p.dbl > 0) powers.push('<i class="pw-b">Double</i>');
    if (p.fast > 0) powers.push('<i class="pw-m">Speed</i>');
    for (const [t, k, label] of [['p', 'glide', 'Glide'], ['ƥ', 'spiky', 'Spike-proof'], ['ǥ', 'lucky', 'Lucky'], ['ƫ', 'swimmer', 'Swimmer'], ['ɯ', 'slowtime', 'Slow clock'], ['s', 'grip', 'Grip'], ['ç', 'magnet', 'Magnet'], ['ƀ', 'glow', 'Eyes']]) if (p[k]) powers.push(`<i style="color:${LF.FRUITS[t].color}">${label}</i>`);
    $('hud-powers-wrap').hidden = !powers.length;
    $('hud-powers').innerHTML = powers.join('');
    $('boss-bar').hidden = !boss;
    if (boss) {
      $('boss-name').textContent = LF.ENEMIES[boss.type].name;
      $('boss-fill').style.width = `${boss.hp / boss.maxHp * 100}%`;
    }
  }

  // ---------- loop ----------
  let last = performance.now(), acc = 0, clearTimer = 0, lostTimer = 0;
  function frame(now) {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (screen === 'editor') editor.frame(dt);
    else if (W && (screen === 'play' || screen === 'paused' || screen === 'clear' || screen === 'inv')) {
      if (screen !== 'paused' && screen !== 'inv') {
        acc += dt;
        while (acc >= STEP) { LF.step(W, input, STEP, true); acc -= STEP; }
      }
      for (const ev of W.events) {
        if (SFX[ev.type]) SFX[ev.type]();
        // Awards only count in story levels (random maps have their own award; the editor only Architect).
        if (playCtx.kind === 'story') LF.awards.event(ev);
        if (ev.type === 'door') flash('The door is open');
        if (ev.type === 'clear') clearTimer = .7;
        if (ev.type === 'warp') LF.followCamera(W, cam, 0, true);
        if (ev.type === 'lost') { lostTimer = .9; saveMidway(); }
        // Dying in the story loses your fruit powers and all the ammo you were carrying.
        if (ev.type === 'hurry') { flash(`Hurry up! ${W.def.hurry || LF.HURRY} seconds left`); if (LF.music) LF.music.hurry(true); }
        if (ev.type === 'calm' && LF.music) LF.music.hurry(false);
        if (ev.type === 'timeup' && LF.music) LF.music.hurry(false);
        if (ev.type === 'die' && playCtx.kind === 'story') { carry = null; store.set('powers', null); store.set('ammo', 0); store.set('inLevel', null); }
      }
      W.events.length = 0;
      if (clearTimer > 0 && screen === 'play') { clearTimer -= dt; if (clearTimer <= 0) cleared(); }
      // Died with no lantern lit: back to the map; the level starts over next time.
      // In a tower, the music changes as you step into the boss's arena (and back, in practice).
      if (screen === 'play' && W.def.arenaX && LF.music) LF.music.play(trackFor(playDef, playCtx, W.player.x >= W.def.arenaX * LF.TS));
      if (lostTimer > 0 && screen === 'play') { lostTimer -= dt; if (lostTimer <= 0) { showMap(); flash(W.lanternLit ? 'Back to the map: go in again to start at your lantern' : 'Back to the map: the level starts over'); } }
      LF.followCamera(W, cam, dt);
      R.render(W, cam, {}, dt);
      hud();
    } else {
      acc += dt;
      while (acc >= STEP) { LF.step(attract, input, STEP, false); acc -= STEP; }
      attract.events.length = 0;
      LF.followCamera(attract, cam, dt);
      R.render(attract, cam, {}, dt);
    }
    requestAnimationFrame(frame);
  }

  // Refreshing (or closing the page) in the middle of a story level counts as dying there:
  // your fruit powers and ammo are gone, and you're back on the map (lanterns you'd lit are
  // kept, as with any death).
  addEventListener('pagehide', () => { if (W && (screen === 'play' || screen === 'paused' || screen === 'inv')) saveMidway(); });
  function leftMidLevel() {
    if (!store.get('inLevel', null)) return false;
    carry = null; store.set('powers', null); store.set('ammo', 0); store.set('inLevel', null);
    showMap(); flash('You left in the middle of a level: that counts as a death (powers and ammo gone)');
    return true;
  }
  function start(data) {
    try { window.claude?.hot?.snapshot?.(() => ({ screen, ctx: playCtx && playCtx.kind === 'story' ? playCtx : null })); } catch (e) {}
    if (data && data.ctx && data.ctx.kind === 'story' && LF.LEVELS[data.ctx.index]) play(LF.LEVELS[data.ctx.index], data.ctx);
    else if (!leftMidLevel() && !openFromLink()) showMap();
    requestAnimationFrame(frame);
  }
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
