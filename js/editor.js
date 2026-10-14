// Lanternfall level editor.
(() => {
  const LF = window.LF;
  const TS = LF.TS;
  const $ = id => document.getElementById(id);

  const TOOLS = [
    { c: 'hand', label: 'Pan', group: 'Tools', chip: '#3A2A55', glyph: '✥' },
    { c: 'select', label: 'Select', group: 'Tools', chip: '#3A2A55', glyph: '↖', note: 'click an enemy to see and tune its stats; Delete erases it' },
    { c: '.', label: 'Erase', group: 'Tools', chip: '#17142F', glyph: '⌫' },
    { c: '#', label: 'Stone', group: 'Terrain', chip: '#5E5173' },
    { c: '=', label: 'Plank', group: 'Terrain', chip: '#9A6A45', note: 'jump up through, ↓ to drop' },
    { c: 'C', label: 'Crumble', group: 'Terrain', chip: '#7B6A8C', note: 'breaks after you stand on it' },
    { c: 'O', label: 'Spring', group: 'Terrain', chip: '#FF6B3D', note: 'launches about 8 tiles up' },
    { c: '^', label: 'Spikes', group: 'Terrain', chip: '#CFC6E8' },
    { c: '~', label: 'Water', group: 'Terrain', chip: '#2E4E82' },
    { c: '!', label: 'Lava', group: 'Terrain', chip: '#E0561E', note: 'kills on touch, even through a shield' },
    { c: 'T', label: 'Blink A', group: 'Terrain', chip: '#FFB547', note: 'solid, then gone — swaps with Blink B every 2s' },
    { c: 'H', label: 'Blink B', group: 'Terrain', chip: '#7FB0E0', note: 'starts gone — swaps with Blink A every 2s' },
    { c: '<', label: 'Belt ←', group: 'Terrain', chip: '#FF9A2E', glyph: '‹', note: 'conveyor: carries you left' },
    { c: '>', label: 'Belt →', group: 'Terrain', chip: '#FF9A2E', glyph: '›', note: 'conveyor: carries you right' },
    { c: 'i', label: 'Ice', group: 'Terrain', chip: '#9FC6E8', note: 'slippery: hard to stop on' },
    { c: 'd', label: 'Shingle', group: 'Terrain', chip: '#A8604A', note: 'falls soon after you land on it, grows back' },
    { c: 'đ', label: 'Big shingle', group: 'Terrain', chip: '#8A4E3A', note: 'three tiles wide (leave the two to its right empty); holds out longer before it falls' },
    { c: 'E', label: 'Pendulum', group: 'Terrain', chip: '#6E6186', note: 'spiked ball swinging below this tile; you can pass through its chain' },
    { c: 'e', label: 'Spiked pendulum', group: 'Terrain', chip: '#7A2E1C', note: 'like a pendulum, but its thorny chain is deadly too' },
    { c: 'f', label: 'Fire bar', group: 'Terrain', chip: '#FF6B3D', note: 'block with a spinning arm of fireballs' },
    { c: 'k', label: 'Crusher', group: 'Terrain', chip: '#4C4062', note: 'slams down when you pass beneath' },
    { c: '|', label: 'Stop', group: 'Terrain', chip: '#FF6B3D', glyph: '┆', note: 'invisible: turns lifts, walkers and bats' },
    { c: 'P', label: 'Start', group: 'Level', chip: '#D9D0F0' },
    { c: 'L', label: 'Lantern', group: 'Level', chip: '#FFB547' },
    { c: 'D', label: 'Door', group: 'Level', chip: '#8F81AB' },
    { c: '?', label: 'Secret exit', group: 'Level', chip: '#7FB0E0', note: 'a second door, always open, unseen until you come near: leaving by it opens a secret path on the map' },
    { c: 'j', label: 'Passage door', group: 'Level', chip: '#FFB547', note: 'walk in to come out at the matching entry (the 1st door, left to right, leads to the 1st entry…)' },
    { c: 'n', label: 'Passage entry', group: 'Level', chip: '#FFE2A8', note: 'where a passage door lets you out' },
    { c: '+', label: 'Cannon', group: 'Level', chip: '#5C3B24', note: 'press ↓ beside it to climb in and be fired out: that finishes the level' },
    { c: 'l', label: 'False wall', group: 'Level', chip: '#5E5173', note: 'looks like stone but you can walk through it: hide a secret exit behind it' },
    { c: 'M', label: 'Lift ↔', group: 'Level', chip: '#C08A5C', note: '2 wide, bounces between blocks or stops' },
    { c: ':', label: 'Turn block ⟳', group: 'Level', chip: '#5E5173', note: 'a 3×3 stone square centred here that turns clockwise, smoothly: walk to stay on top, wall-jump off its sides' },
    { c: ';', label: 'Turn block ⟲', group: 'Level', chip: '#5E5173', note: 'a turn block that turns anticlockwise' },
    { c: ',', label: 'Wheel ⟲', group: 'Level', chip: '#7F6FA8', note: 'a wheel that turns anticlockwise' },
    { c: 'x', label: 'Wheel ⟳', group: 'Level', chip: '#7F6FA8', note: 'the hub: 4 platforms turn clockwise round it, 3 tiles out' },
    { c: 'V', label: 'Lift ↕', group: 'Level', chip: '#C08A5C', note: '2 wide, bounces between blocks or stops' },
    { c: 'q', label: 'Ammo', group: 'Level', chip: '#FFB547', note: '+3 shots' },
    { c: 'Q', label: 'Big ammo', group: 'Level', chip: '#FF6B3D', note: '+10 shots: put it somewhere hard to reach' },
    { c: '$', label: 'Huge ammo', group: 'Level', chip: '#E0A526', note: '+25 shots: make it really hard to reach' },
    ...Object.entries(LF.FRUITS).map(([c, f]) => ({ c, label: f.name, group: 'Fruit', chip: f.color, note: f.note })),
    ...Object.entries(LF.KEYS).flatMap(([c, k]) => [
      { c, label: k.name, group: 'Keys & locks', chip: k.color, glyph: '⚷' },
      { c: k.gate, label: k.name.replace('key', 'lock'), group: 'Keys & locks', chip: k.dim, note: `solid until you touch it holding the ${k.name.toLowerCase()}` },
    ]),
    ...Object.entries(LF.SHOT_DOORS).map(([c, n]) => ({ c, label: `Shot door ${n}`, group: 'Keys & locks', chip: { v: '#7FB0E0', w: '#FFB547', z: '#FF6B3D' }[c], glyph: String(n), note: `solid until shot ${n} times; touching blocks of it are one door (gone in Hardcore)` })),
    { c: 'g', label: 'Boss gate', group: 'Keys & locks', chip: '#7A2E1C', note: 'solid until every boss in the level is down' },
    ...Object.entries(LF.ENEMIES).filter(([, e]) => !e.boss).map(([c, e]) => ({ c, label: e.name, group: 'Enemies', chip: { B: '#2A2348', K: '#3B2F57', F: '#3D3458', J: '#2F5260', S: '#7A3E1C', G: '#C9D2F0', X: '#4A3B2A', R: '#5A2C14', Z: '#FFB547', Y: '#2F5260', U: '#9FD8FF', N: '#A9B8C8', W: '#E0A526', A: '#5E4B3C', I: '#4A4560', '*': '#FF6B3D', '@': '#C0392B', 5: '#3B2F57', 6: '#1F1A3A', 7: '#5E4B3C', 8: '#4A4560', 9: '#7A2E1C' }[c], note: e.note })),
    ...Object.entries(LF.HORDES).map(([c, h]) => ({ c, label: h.name, group: 'Enemies', chip: '#07060F', note: `${h.note}; can’t be shot` })),
    // (Giant bosses only live in their arenas, so they aren't offered here.)
    ...Object.entries(LF.ENEMIES).filter(([, e]) => e.boss && !e.special).map(([c, e]) => ({ c, label: e.name, group: 'Bosses', chip: { B: '#2A2348', K: '#3B2F57', F: '#3D3458', J: '#2F5260', S: '#7A3E1C', G: '#C9D2F0', X: '#4A3B2A', R: '#5A2C14', Z: '#FFB547', Y: '#2F5260', U: '#9FD8FF', N: '#A9B8C8', W: '#E0A526', A: '#5E4B3C', I: '#4A4560', '*': '#FF6B3D', '@': '#C0392B', 5: '#3B2F57', 6: '#1F1A3A', 7: '#5E4B3C', 8: '#4A4560', 9: '#7A2E1C' }[c], note: e.note })),
  ];

  LF.createEditor = function (app) {
    const cvs = app.canvas, R = app.renderer;
    const E = { active: false };
    let grid = [], meta = { name: 'My level', dark: .6, id: null, tuning: {}, player: {} };
    let tool = TOOLS[2], world = null, dirty = true;
    const cam = { x: 0, y: 0, zoom: 1 };
    let hover = null, painting = null, panning = null, spaceDown = false;
    let undo = [], redo = [];

    // ---------- palette ----------
    const pal = $('ed-palette');
    let lastGroup = '';
    for (const t of TOOLS) {
      if (t.group !== lastGroup) {
        const g = document.createElement('span'); g.className = 'ed-group'; g.textContent = t.group; pal.appendChild(g);
        lastGroup = t.group;
      }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ed-tool'; b.id = 'tool-' + (t.c === '.' ? 'erase' : t.c.length > 1 ? t.c : t.c.charCodeAt(0));
      b.title = t.note ? `${t.label} — ${t.note}` : t.label;
      b.innerHTML = `<i style="background:${t.chip}">${t.glyph || ''}</i>${t.label}`;
      b.addEventListener('click', () => selectTool(t));
      t.el = b; pal.appendChild(b);
    }
    function selectTool(t) {
      tool = t;
      for (const x of TOOLS) x.el.classList.toggle('on', x === t);
      status(t.note ? `${t.label}: ${t.note}` : t.label);
      cvs.style.cursor = t.c === 'hand' ? 'grab' : t.c === 'select' ? 'default' : 'crosshair';
      if (t.c !== 'select') closeInspect();
    }

    // ---------- grid helpers ----------
    const H = () => grid.length, Wd = () => grid[0].length;
    const toRows = () => grid.map(r => r.join(''));
    function load(def) {
      grid = LF.normalize(def.map).map(r => r.split(''));
      meta = { name: def.name || 'My level', dark: def.dark ?? .6, id: def.id || null, signs: def.signs, tuning: { ...def.tuning }, player: { ...def.player } };
      undo = []; redo = [];
      syncInputs(); fitCamera(); dirty = true;
    }
    function def() { return { name: meta.name, dark: meta.dark, map: toRows(), id: meta.id, tuning: tuningOut(), player: playerOut() }; }
    function playerOut() {
      const out = {};
      for (const [k, s] of Object.entries(LF.PLAYER_TUNE)) if (meta.player[k] != null && meta.player[k] !== s.def) out[k] = meta.player[k];
      return Object.keys(out).length ? out : undefined;
    }

    // ---------- player settings ----------
    function openPlayer() {
      const t = LF.playerTune({ player: meta.player });
      const show = (k, v) => LF.PLAYER_TUNE[k].count ? String(Math.round(v)) : (+v).toFixed(2) + '×';
      $('player-body').innerHTML = '<div class="insp-sliders player-sliders">' + Object.entries(LF.PLAYER_TUNE).map(([k, s]) => `
        <label title="${s.note || ''}">${s.label}
          <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${t[k]}" data-p="${k}" aria-label="${s.label}">
          <output>${show(k, t[k])}</output></label>`).join('') + '</div>';
      for (const inp of $('player-body').querySelectorAll('input[data-p]')) inp.addEventListener('input', () => {
        const k = inp.dataset.p;
        meta.player[k] = +inp.value;
        inp.nextElementSibling.textContent = show(k, inp.value);
        dirty = true;
      });
      $('player-dialog').showModal();
    }
    $('ed-player').addEventListener('click', openPlayer);
    $('player-reset').addEventListener('click', () => { meta.player = {}; dirty = true; openPlayer(); });
    $('player-done').addEventListener('click', () => { $('player-dialog').close(); status('Player settings saved with this level. Test play to try them.'); });
    // Only keep the settings that differ from normal, so levels stay small.
    function tuningOut() {
      const out = {};
      for (const [c, t] of Object.entries(meta.tuning)) {
        const keep = {};
        if (t.size != null && t.size !== 1) keep.size = t.size;
        for (const k of ['speed', 'shotSpeed', 'fireRate', 'shotSize']) if (t[k] != null && t[k] !== 1) keep[k] = t[k];
        if (Object.keys(keep).length) out[c] = keep;
      }
      return Object.keys(out).length ? out : undefined;
    }

    // ---------- enemy size & speed ----------
    // Hordes count as enemies here too; they only have a speed setting.
    const info = c => LF.ENEMIES[c] || LF.HORDES[c];
    const sliders = c => LF.HORDES[c] ? ['speed'] : ['size', 'speed', ...(EXTRA[c] || [])];
    const fmtX = v => (+v).toFixed(2) + '×';
    function tuneSlider(c, k) {
      const t = LF.tune(meta.tuning, c), v = t[k] ?? 1, e = info(c);
      return `<label>${TUNE[k].label}
        <input type="range" min="${TUNE[k].min}" max="${TUNE[k].max}" step="0.05" value="${v}" data-t="${c}" data-k="${k}" aria-label="${e.name} ${TUNE[k].label}">
        <output>${fmtX(v)}</output></label>`;
    }
    function bindSliders(root, after) {
      for (const inp of root.querySelectorAll('input[type=range][data-t]')) inp.addEventListener('input', () => {
        const { t, k } = inp.dataset;
        meta.tuning[t] = { ...meta.tuning[t], [k]: +inp.value };
        inp.nextElementSibling.textContent = fmtX(inp.value);
        dirty = true;
        if (after) after();
      });
    }

    // What each enemy does, with its numbers after this level's size & speed settings.
    const STATS = {
      B: v => [['Moves', `walks ${v(48)} px/s, turns at edges`]],
      K: v => [['Moves', `walks ${v(72)} px/s, turns at edges`]],
      F: v => [['Moves', `flies ${v(64)} px/s, up to 4 tiles each way`]],
      J: v => [['Moves', `hops ${v(130)} px/s toward you when within 8 tiles`]],
      S: (v, t) => [['Attack', `fireball ${Math.round(175 * (t.shotSpeed ?? 1))} px/s, ${Math.round(10 * (t.shotSize ?? 1))} px wide`], ['Fire rate', `every ${(2.3 / (t.fireRate ?? 1) / (LF.ENEMY_SPEED * t.speed)).toFixed(1)} s within 11 tiles`]],
      G: v => [['Moves', `drifts toward you up to ${v(44)} px/s; backs off lit lanterns`]],
      X: v => [['Attack', `drops ${v(420)} px/s when you pass below, climbs back ${v(90)} px/s`]],
      R: v => [['Moves', `walks ${v(40)} px/s`], ['Attack', `charges ${v(280)} px/s when it sees you`]],
      Z: v => [['Moves', `circles a 46 px loop, ${(2.4 * v(1) / 1).toFixed(1)} rad/s`]],
      Y: v => [['Moves', `swims ${v(85)} px/s, stays in the water`]],
      U: v => [['Moves', 'bobs up and down about 1.4 tiles']],
      N: v => [['Attack', 'leaps about 4 tiles out of the water toward you'], ['Landing', 'stays where it splashes down; dies if it lands on dry ground']],
      W: v => [['Attack', `dashes ${v(340)} px/s at you when within 6 tiles`]],
      A: v => [['Attack', `arrows 210 px/s, aimed, every ${(2.4 / v(1)).toFixed(1)} s`]],
      I: v => [['Moves', `walks ${v(30)} px/s, turns at edges`]],
      '*': v => [['Attack', `rises about 5.5 tiles out of the lava, hangs for ${(.5 * LF.ENEMY_SPEED / v(1)).toFixed(2)} s, sinks back`], ['Where', 'lava only; lava pools also get them automatically']],
    };
    function statRows(c) {
      if (LF.HORDES[c]) {
        const h = LF.HORDES[c], t = LF.tune(meta.tuning, c);
        return [
          ['Moves', `${c === '%' ? 'rises' : 'advances'} a steady ${Math.round(h.speed * t.speed)} px/s`],
          ['Starts', '0.5 s after the level starts and after each respawn'],
          ['Touch', 'kills you, even through a shield'],
          ['Stomp / shoot', 'no — bullets vanish into it'],
          ['Starts / respawn', '4 tiles behind you'],
        ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
      }
      const s = LF.ENEMIES[c], t = LF.tune(meta.tuning, c), k = LF.ENEMY_SPEED * t.speed;
      const v = base => Math.round(base * k * 100) / 100;
      const rows = [
        ['Hitbox', `${Math.round(s.w * t.size)} × ${Math.round(s.h * t.size)} px`],
        ['Stomp', s.stomp ? 'yes' : 'no — touching it hurts'],
        ['Shots to kill', String(s.hp || 1)],
        ...(STATS[c] ? STATS[c]((b) => b === 1 ? k : Math.round(b * k), t) : []),
      ];
      return rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
    }

    // ---------- select tool: inspect an enemy ----------
    let selected = null;
    function inspect(tx, ty) {
      const c = grid[ty] && grid[ty][tx];
      if (!c || !info(c)) { closeInspect(); status('Nothing to inspect there — click an enemy.'); return; }
      selected = { tx, ty, c };
      const e = info(c), count = grid.flat().filter(x => x === c).length;
      $('ed-inspect').innerHTML = `
        <header><b>${e.name}</b><button class="mini" type="button" id="insp-close" aria-label="Close">✕</button></header>
        <p>${e.note}</p>
        <dl id="insp-stats">${statRows(c)}</dl>
        <div class="insp-sliders">${sliders(c).map(k => tuneSlider(c, k)).join('')}</div>
        <p class="insp-note">${count === 1 ? `Changes apply to this ${e.name.toLowerCase()} (the only one in this level).` : `Changes apply to all ${count} ${e.name.toLowerCase()}s in this level.`}</p>`;
      $('ed-inspect').hidden = false;
      $('insp-close').addEventListener('click', closeInspect);
      bindSliders($('ed-inspect'), () => { $('insp-stats').innerHTML = statRows(c); });
      status(`${e.name} at column ${tx + 1}, row ${ty + 1}`);
    }
    function closeInspect() { selected = null; if ($('ed-inspect')) $('ed-inspect').hidden = true; }

    const TUNE = {
      size: { label: 'Size', min: .5, max: 2 }, speed: { label: 'Speed', min: .25, max: 3 },
      shotSpeed: { label: 'Fireball speed', min: .25, max: 3 }, fireRate: { label: 'Fire rate', min: .25, max: 4 }, shotSize: { label: 'Fireball size', min: .5, max: 3 },
    };
    const EXTRA = { S: ['shotSpeed', 'fireRate', 'shotSize'] };
    function openTuning() {
      const present = [...new Set(grid.flat().filter(c => info(c)))];
      const rows = present.map(c => {
        const [a, b, ...extra] = sliders(c);
        return `<div class="tune-row"><b>${info(c).name}</b>${tuneSlider(c, a)}${b ? tuneSlider(c, b) : '<span></span>'}${extra.length ? `<div class="tune-extra">${extra.map(k => tuneSlider(c, k)).join('')}</div>` : ''}</div>`;
      }).join('');
      $('tune-body').innerHTML = present.length ? `<div class="tune">${rows}</div>`
        : '<p>There are no enemies in this level yet. Place some from the Enemies group, then come back here.</p>';
      bindSliders($('tune-body'));
      $('tune-dialog').showModal();
    }
    $('ed-tune').addEventListener('click', openTuning);
    $('tune-reset').addEventListener('click', () => { meta.tuning = {}; dirty = true; openTuning(); });
    $('tune-done').addEventListener('click', () => { $('tune-dialog').close(); if (selected) inspect(selected.tx, selected.ty); status('Enemy size & speed saved with this level. Test play to try them.'); });
    function snapshot() { undo.push(toRows().join('\n')); if (undo.length > 80) undo.shift(); redo = []; }
    function restore(str) { grid = str.split('\n').map(r => r.split('')); syncInputs(); dirty = true; }

    function put(tx, ty, c) {
      if (tx < 0 || ty < 0 || ty >= H() || tx >= Wd()) return;
      if (c === '*' && grid[ty][tx] !== '!' && grid[ty][tx] !== '*') { status('Lava bubbles can only go in lava — paint some lava first.'); return; }
      if (c === 'P' || c === 'D') for (const row of grid) for (let x = 0; x < row.length; x++) if (row[x] === c) row[x] = '.';
      if (grid[ty][tx] === c) return;
      grid[ty][tx] = c;
      if ((c === 'M' || c === 'V') && tx + 1 < Wd()) grid[ty][tx + 1] = '.';
      dirty = true;
    }

    function resize(nw, nh) {
      nw = Math.max(12, Math.min(300, nw | 0)); nh = Math.max(10, Math.min(200, nh | 0));
      snapshot();
      let rows = grid.map(r => r.slice(0, nw).concat(Array(Math.max(0, nw - r.length)).fill('.')));
      if (nh > rows.length) rows = Array.from({ length: nh - rows.length }, () => Array(nw).fill('.')).concat(rows);
      else rows = rows.slice(rows.length - nh);
      grid = rows; dirty = true; syncInputs();
    }

    function syncInputs() {
      $('ed-name').value = meta.name;
      $('ed-w').value = Wd(); $('ed-h').value = H();
      $('ed-dark').value = meta.dark;
    }

    function fitCamera() {
      cam.zoom = 1;
      const { vw, vh } = R.viewSize(cam);
      const fit = Math.min((vw - 40) / (Wd() * TS), (vh - 200) / (H() * TS));
      cam.zoom = Math.max(.25, Math.min(1.25, fit));
      const v = R.viewSize(cam);
      cam.x = Math.min(0, (Wd() * TS - v.vw) / 2);
      if (Wd() * TS > v.vw) cam.x = -20;
      cam.y = (H() * TS - v.vh) + 40 / cam.zoom;
    }

    function status(msg) { $('ed-status').textContent = msg; }
    function counts() {
      let l = 0, e = 0;
      for (const row of grid) for (const c of row) { if (c === 'L') l++; else if (info(c)) e++; }
      return `${Wd()}×${H()} · ${l} lantern${l === 1 ? '' : 's'} · ${e} enem${e === 1 ? 'y' : 'ies'}`;
    }

    // ---------- pointer ----------
    function cellAt(ev) {
      const rect = cvs.getBoundingClientRect();
      const p = R.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, cam);
      return { tx: Math.floor(p.x / TS), ty: Math.floor(p.y / TS) };
    }
    cvs.addEventListener('pointerdown', ev => {
      if (!E.active) return;
      cvs.setPointerCapture(ev.pointerId);
      if (ev.button === 1 || spaceDown || tool.c === 'hand') {
        panning = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y }; cvs.style.cursor = 'grabbing'; return;
      }
      const cell = cellAt(ev);
      if (tool.c === 'select') { inspect(cell.tx, cell.ty); return; }
      snapshot();
      painting = { erase: ev.button === 2 };
      put(cell.tx, cell.ty, painting.erase ? '.' : tool.c);
    });
    cvs.addEventListener('pointermove', ev => {
      if (!E.active) return;
      if (panning) {
        const k = R.dpr / R.scale(cam);
        cam.x = panning.cx - (ev.clientX - panning.x) * k;
        cam.y = panning.cy - (ev.clientY - panning.y) * k;
        return;
      }
      const cell = cellAt(ev);
      hover = cell;
      if (painting) put(cell.tx, cell.ty, painting.erase ? '.' : tool.c);
      if (cell.tx >= 0 && cell.ty >= 0 && cell.tx < Wd() && cell.ty < H()) {
        const ch = grid[cell.ty][cell.tx];
        const t = TOOLS.find(x => x.c === ch);
        $('ed-coords').textContent = `col ${cell.tx + 1} · row ${cell.ty + 1}${t && ch !== '.' ? ' · ' + t.label : ''}`;
      }
    });
    const endStroke = () => {
      if (painting && undo.length && undo[undo.length - 1] === toRows().join('\n')) undo.pop();
      painting = null; panning = null;
      if (E.active) cvs.style.cursor = tool.c === 'hand' ? 'grab' : 'crosshair';
      saveDraft();
    };
    cvs.addEventListener('pointerup', endStroke);
    cvs.addEventListener('pointercancel', endStroke);
    cvs.addEventListener('pointerleave', () => { hover = null; });
    cvs.addEventListener('contextmenu', ev => { if (E.active) ev.preventDefault(); });
    cvs.addEventListener('wheel', ev => {
      if (!E.active) return;
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) {
        const rect = cvs.getBoundingClientRect();
        const before = R.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, cam);
        cam.zoom = Math.max(.2, Math.min(2.5, cam.zoom * Math.exp(-ev.deltaY * .002)));
        const after = R.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, cam);
        cam.x += before.x - after.x; cam.y += before.y - after.y;
      } else {
        const k = R.dpr / R.scale(cam);
        cam.x += (ev.shiftKey ? ev.deltaY : ev.deltaX) * k;
        if (!ev.shiftKey) cam.y += ev.deltaY * k;
      }
    }, { passive: false });

    addEventListener('keydown', ev => {
      // Delete or Backspace erases the enemy picked with the Select tool (undo brings it back).
      // Works even while one of its sliders has focus, but not while typing in a text box.
      if (E.active && selected && (ev.code === 'Delete' || ev.code === 'Backspace') &&
          !ev.target.closest('input[type=text], input[type=number], textarea, dialog')) {
        ev.preventDefault();
        const { tx, ty, c } = selected;
        snapshot(); put(tx, ty, '.'); closeInspect();
        status(`Deleted ${info(c).name.toLowerCase()} · ⌘/Ctrl-Z to undo`);
        return;
      }
      if (!E.active || ev.target.closest('input, textarea, dialog')) return;
      if (ev.code === 'Space') { spaceDown = true; ev.preventDefault(); }
      const mod = ev.ctrlKey || ev.metaKey;
      if (mod && ev.code === 'KeyZ') {
        ev.preventDefault();
        const cur = toRows().join('\n');
        if (ev.shiftKey) { if (redo.length) { undo.push(cur); restore(redo.pop()); } }
        else if (undo.length) { redo.push(cur); restore(undo.pop()); }
        return;
      }
      if (mod || ev.altKey) return;
      const step = 64 / cam.zoom;
      if (ev.code === 'ArrowLeft') cam.x -= step;
      if (ev.code === 'ArrowRight') cam.x += step;
      if (ev.code === 'ArrowUp') cam.y -= step;
      if (ev.code === 'ArrowDown') cam.y += step;
      if (ev.code === 'KeyT') testPlay();
      if (ev.code === 'KeyF') fitCamera();
    });
    addEventListener('keyup', ev => { if (ev.code === 'Space') spaceDown = false; });

    // ---------- toolbar ----------
    $('ed-name').addEventListener('input', e => { meta.name = e.target.value || 'Untitled'; saveDraft(); });
    $('ed-dark').addEventListener('input', e => { meta.dark = +e.target.value; dirty = true; });
    const applySize = () => resize(+$('ed-w').value, +$('ed-h').value);
    $('ed-w').addEventListener('change', applySize);
    $('ed-h').addEventListener('change', applySize);

    function check() {
      const a = LF.analyze(def());
      if (a.ok) status(`Looks playable: start reaches all ${a.lanterns} lantern${a.lanterns === 1 ? '' : 's'} and the door. ${counts()}`);
      else status(a.problems.join(' '));
      return a;
    }
    function testPlay() {
      const a = LF.analyze(def());
      if (!grid.some(r => r.includes('P'))) { status('Place a start (P) before test playing.'); return; }
      saveDraft();
      app.play(def(), { kind: 'test' });
      if (!a.ok) app.flash('Heads up: ' + a.problems[0]);
    }
    $('ed-check').addEventListener('click', check);
    $('ed-play').addEventListener('click', testPlay);
    $('ed-fit').addEventListener('click', fitCamera);
    $('ed-save').addEventListener('click', () => {
      const d = def();
      const saved = app.saveCustom(d);
      meta.id = saved.id;
      status(`Saved “${saved.name}” to Your levels. ${counts()}`);
    });
    $('ed-new').addEventListener('click', () => { snapshot(); load(blank()); status('New blank level. Paint stone, then place a start, lanterns and a door.'); });
    $('ed-gen').addEventListener('click', () => app.openGenerator('editor'));
    $('ed-code').addEventListener('click', () => app.openCode(def()));
    $('ed-exit').addEventListener('click', () => { saveDraft(); app.menu(); });

    function blank() {
      return {
        name: 'My level', dark: .6,
        map: LF.build(40, 16, ({ r, s }) => { r(0, 13, 39, 15); s(2, 12, 'P'); s(20, 12, 'L'); s(37, 12, 'D'); }),
      };
    }
    function saveDraft() { try { localStorage.setItem('lanternfall.draft', JSON.stringify(def())); } catch (e) {} }
    function loadDraft() { try { const d = JSON.parse(localStorage.getItem('lanternfall.draft')); return d && d.map ? d : null; } catch (e) { return null; } }

    // ---------- lifecycle ----------
    // A level that can't be opened (a broken draft or save) gives way to a blank one, so
    // the editor always opens.
    function safeLoad(d) {
      try { load(d); LF.createWorld(def()); return true; } catch (e) { console.error('Editor: could not open level', e); load(blank()); return false; }
    }
    E.open = d => {
      let ok = true;
      if (d) ok = safeLoad(d); else if (!grid.length) ok = safeLoad(loadDraft() || blank());
      if (!ok) try { localStorage.removeItem('lanternfall.draft'); } catch (e) {}
      E.active = true;
      $('editor').hidden = false;
      selectTool(tool);
      status(ok ? `${counts()} · paint with the mouse, right-click erases, space-drag or wheel pans, ⌘/Ctrl-wheel zooms, T test plays.` : 'That level couldn’t be opened, so here’s a new blank one.');
    };
    E.resume = () => { E.active = true; $('editor').hidden = false; selectTool(tool); };
    E.close = () => { E.active = false; $('editor').hidden = true; cvs.style.cursor = ''; closeInspect(); };
    E.frame = dt => {
      if (dirty) {
        dirty = false;
        try { world = LF.createWorld(def()); } catch (e) { console.error('Editor: could not build the level', e); if (!world) { load(blank()); world = LF.createWorld(def()); } }
      }
      world.clock += dt;
      if (selected && grid[selected.ty]?.[selected.tx] !== selected.c) closeInspect();
      R.render(world, cam, { edit: true, hover, selected }, dt);
    };
    E.current = def;
    return E;
  };
})();
