// Lanternfall: reachability check and random level generator. No DOM.
(() => {
  const LF = window.LF = window.LF || {};
  // 1, 2, 3 are locked doors (red, blue, gold); r, u, y are their keys.
  const solid = c => c === '#' || c === 'C' || c === 'O' || c === 'T' || c === 'H' || c === '<' || c === '>' || c === 'i' || c === 'f' || c === '1' || c === '2' || c === '3';
  const KEY_GATE = { r: '1', u: '2', y: '3' };
  const hazard = c => c === '^' || c === '~' || c === '!' || c === '*';
  const blocksPlat = c => solid(c) || c === '|' || c === '^' || c === '=';

  // Approximate check: can the start reach every lantern and the door?
  LF.analyze = function (def) {
    const rows = (LF.normalize || (r => r))(def.map);
    const h = rows.length, w = rows[0] ? rows[0].length : 0;
    // Locked doors count as open once their key is reachable (see the loop below).
    const unlocked = new Set();
    const T = (x, y) => { const c = (x < 0 || x >= w) ? '#' : (y < 0 || y >= h) ? ' ' : rows[y][x]; return unlocked.has(c) ? '.' : c; };
    const keys = [];
    const problems = [];
    let start = null, door = null, doors = 0;
    const lanterns = [], platStand = new Set();
    // Passage doors: walking into the k-th j (counting left to right) takes you to the k-th n.
    const passIn = [], passOut = [];
    let linkIn = null, linkOut = null;   // (a lengthened level's section doors, ĵ to ň)
    const portIn = [], portOut = [];      // (portals into secret sections, ⓐ to Ⓐ and so on)
    const key = (x, y) => y * w + x;

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === 'P') { if (start) problems.push('There is more than one start (P).'); start = { x, y }; }
      else if (c === 'D') { doors++; door = { x, y }; }
      else if (c === 'L') lanterns.push({ x, y });
      else if (c === 'đ') { for (let sx = x; sx <= x + 2 && sx < w; sx++) platStand.add(key(sx, y - 1)); }
      else if (c === 'j') passIn.push({ x, y });
      else if (c === 'n') passOut.push({ x, y });
      else if (c === 'ĵ') (linkIn ||= []).push({ x, y });
      else if (c === 'ň') (linkOut ||= []).push({ x, y });
      else if (LF.PORTALS && LF.PORTALS.doors.includes(c)) portIn.push({ x, y, c });
      else if (LF.PORTALS && LF.PORTALS.lands.includes(c)) portOut.push({ x, y, c: LF.PORTALS.doors[LF.PORTALS.lands.indexOf(c)] });
      else if (KEY_GATE[c]) keys.push({ x, y, gate: KEY_GATE[c] });
      else if (c === 'M') {
        let l = x, r = x;
        while (l - 1 >= 0 && !blocksPlat(T(l - 1, y))) l--;
        while (r + 1 < w && !blocksPlat(T(r + 1, y))) r++;
        for (let i = l; i <= r; i++) platStand.add(key(i, y - 1));
      } else if (c === ':' || c === ';') {
        // A turn block: stand on top of its 3x3 square (while it holds still).
        for (const sx of [x - 1, x, x + 1]) if (sx >= 0 && sx < w && y - 2 >= 0) platStand.add(key(sx, y - 2));
      } else if (c === 'x' || c === ',') {
        // A wheel: its platforms pass over every spot round a circle 3 tiles from the hub.
        for (let k = 0; k < 48; k++) {
          const a = k / 48 * Math.PI * 2, px = x + Math.round(Math.cos(a) * 3), py = y + Math.round(Math.sin(a) * 3);
          for (const sx of [px - 1, px, px + 1]) if (sx >= 0 && sx < w && py - 1 >= 0 && py < h) platStand.add(key(sx, py - 1));
        }
      } else if (c === 'V') {
        const free = yy => yy >= 0 && yy < h && !blocksPlat(T(x, yy)) && !blocksPlat(T(x + 1, yy));
        let top = y, bot = y;
        while (free(top - 1)) top--;
        while (free(bot + 1)) bot++;
        for (let yy = top; yy <= bot; yy++) { platStand.add(key(x, yy - 1)); platStand.add(key(x + 1, yy - 1)); }
      }
    }
    if (!start) problems.push('Place a start (P).');
    passIn.sort((a, b) => a.x - b.x); passOut.sort((a, b) => a.x - b.x);
    if (linkIn) { passIn.push(...linkIn.sort((a, b) => a.x - b.x)); passOut.push(...(linkOut || []).sort((a, b) => a.x - b.x)); }
    // (Each door to the same letter's landing: pairs [door, landing].)
    const links = passIn.map((d, k) => [d, passOut[k]]);
    for (const c of new Set(portIn.map(d => d.c))) {
      const ds = portIn.filter(d => d.c === c).sort((a, b) => a.x - b.x), ls = portOut.filter(l => l.c === c).sort((a, b) => a.x - b.x);
      ds.forEach((d, k) => links.push([d, ls[k]]));
    }
    // (A boss level ends when the boss falls, so it needs no door: def.noDoor.)
    if (!doors && !def.noDoor) problems.push('Place a door (D).');
    if (doors > 1) problems.push('There is more than one door (D).');

    // Water is swimmable: you can jump from anywhere in it.
    const wet = c => c === '~' || !!(LF.SWIMMERS && LF.SWIMMERS[c]);
    const stand = (x, y) => x >= 0 && x < w && y >= 0 && y < h && (wet(T(x, y)) || !solid(T(x, y)) && !hazard(T(x, y)) &&
      (solid(T(x, y + 1)) || T(x, y + 1) === '=' || T(x, y + 1) === 'd' || T(x, y + 1) === 'ð' || platStand.has(key(x, y))));

    let seen = new Uint8Array(w * h), noGround = false;
    const flood = () => {
    seen = new Uint8Array(w * h);
    // Drop from a spot to the ground under it (null if there's none).
    const ground = (x, y) => { while (y < h && !stand(x, y)) { if (solid(T(x, y)) || hazard(T(x, y))) return null; y++; } return y < h ? y : null; };
    if (start) {
      const sy = ground(start.x, start.y);
      if (sy == null) noGround = true;
      else {
        const q = [[start.x, sy]]; seen[key(start.x, sy)] = 1;
        const used = new Set();
        for (;;) {
        while (q.length) {
          const [x0, y] = q.pop();
          const spring = T(x0, y + 1) === 'O';
          // Take off from where you stand; and at the end of a ledge, also from just past
          // it (run off and jump at once: that's how you get round a slab right over your
          // head, out and back in), a little shorter.
          const takeoffs = [[x0, 0]];
          for (const d of [-1, 1]) if (!spring && x0 + d >= 0 && x0 + d < w && !solid(T(x0 + d, y)) && !hazard(T(x0 + d, y)) && !solid(T(x0 + d, y - 1)) && !stand(x0 + d, y)) takeoffs.push([x0 + d, 1]);
          for (const [x, short] of takeoffs) {
          const upMax = spring ? 8 : 3;
          let head = 0;
          while (head < upMax && !solid(T(x, y - head - 1))) head++;
          for (let y2 = Math.max(0, y - upMax); y2 < h; y2++) {
            const up = y - y2;
            if (up > head) continue;
            const normal = up >= 3 ? 2 : up >= 1 ? 4 : 5 + Math.min(2, Math.floor(-up / 2));
            const reach = (spring && up > 3 ? 3 : normal) - short;
            for (let dx = -reach; dx <= reach; dx++) {
              const x2 = x + dx;
              if (!stand(x2, y2) || seen[key(x2, y2)]) continue;
              const top = Math.min(y, y2), sx = Math.sign(dx);
              let ok = true;
              for (let i = 1; i < Math.abs(dx) && ok; i++) if (solid(T(x + sx * i, top))) ok = false;
              if (ok && up > 0 && dx !== 0) for (let i = 1; i < Math.abs(dx) && ok; i++) if (solid(T(x + sx * i, top - 1)) && Math.abs(dx) > 1) ok = false;
              if (ok && up < 0) for (let r = top; r < y2 && ok; r++) if (solid(T(x2, r))) ok = false;
              if (!ok) continue;
              seen[key(x2, y2)] = 1; q.push([x2, y2]);
            }
          }
          }
        }
        // Through any passage door we've reached, and on from where it lets out.
        let more = false;
        links.forEach(([d, o], k) => {
          if (used.has(k) || !o) return;
          let at = false;
          for (let dx = -1; dx <= 1 && !at; dx++) for (let r = 0; r <= 1; r++) if (seen[key(d.x + dx, d.y + r)]) at = true;
          if (!at) return;
          used.add(k);
          const oy = ground(o.x, o.y);
          if (oy != null && !seen[key(o.x, oy)]) { seen[key(o.x, oy)] = 1; q.push([o.x, oy]); more = true; }
        });
        if (!more) break;
        }
      }
    }
    };
    // Flood, unlock the doors whose keys we reached, and flood again until nothing new opens.
    const touch = (x, y) => { for (let dx = -1; dx <= 1; dx++) for (let k = -1; k <= 2; k++) if (seen[key(x + dx, y + k)] && x + dx >= 0 && x + dx < w && y + k >= 0 && y + k < h) return true; return false; };
    for (;;) {
      flood();
      const before = unlocked.size;
      for (const k of keys) if (!unlocked.has(k.gate) && touch(k.x, k.y)) unlocked.add(k.gate);
      if (unlocked.size === before) break;
    }
    if (noGround) problems.push('The start (P) has no ground beneath it.');

    const reached = (x, y) => x >= 0 && x < w && y >= 0 && y < h && seen[key(x, y)];
    let litOk = 0;
    const missing = [];
    for (const l of lanterns) {
      let ok = false;
      for (let dx = -1; dx <= 1 && !ok; dx++) for (let k = -1; k <= 3 && !ok; k++) {
        const sx = l.x + dx, sy = l.y + k;
        if (!reached(sx, sy)) continue;
        let clear = true;
        for (let r = l.y; r < sy; r++) if (solid(T(sx, r))) clear = false;
        if (clear) ok = true;
      }
      if (ok) litOk++; else missing.push(l);
    }
    let doorOk = false;
    if (door) for (let dx = -1; dx <= 1; dx++) for (let k = 0; k <= 1; k++) if (reached(door.x + dx, door.y + k)) doorOk = true;
    if (missing.length) problems.push(`${missing.length} lantern${missing.length > 1 ? 's look' : ' looks'} out of reach (near column ${missing[0].x + 1}, row ${missing[0].y + 1}).`);
    if (door && start && !doorOk) problems.push(`The door looks out of reach (column ${door.x + 1}, row ${door.y + 1}).`);
    return { ok: !problems.length, problems, w, h, lanterns: lanterns.length, litOk, doorOk, missing, seen };
  };

  // ---------- generator ----------
  const NAMES_A = ['Ashen', 'Crooked', 'Tallow', 'Sooty', 'Hollow', 'Quiet', 'Gutter', 'Bellrope', 'Candle', 'Smoke', 'Moth', 'Cinder', 'Lamp-black', 'Weeping', 'Brass'];
  const NAMES_B = ['Stair', 'Rooftops', 'Alley', 'Spire', 'Cistern', 'Kilns', 'Wharf', 'Belfry', 'Chimneys', 'Gallery', 'Lane', 'Vaults', 'Steeple', 'Terraces', 'Drain'];
  const POOL = { 1: ['B'], 2: ['B', 'B', 'F', 'R'], 3: ['B', 'F', 'J', 'K', 'R', 'Z', 'W'], 4: ['B', 'F', 'J', 'K', 'S', 'R', 'Z', 'W', 'A'], 5: ['F', 'J', 'K', 'S', 'G', 'B', 'R', 'Z', 'W', 'A', 'I'] };

  LF.generate = function (opts = {}) {
    const seed = (opts.seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
    for (let a = 0; a < 80; a++) {
      const def = genOnce((seed + a * 7919) >>> 0, opts);
      if (def && LF.analyze(def).ok) { def.seed = seed; return def; }
    }
    return {
      name: 'Plain Lane', dark: .5, seed,
      map: ['................', '.P....L......D..', '################'],
    };
  };

  function genOnce(s, opts) {
    const R = LF.rng(s);
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const chance = p => R() < p;
    const pick = arr => arr[Math.floor(R() * arr.length)];
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const shape = opts.shape || 'right', size = opts.size || 'm';
    const diff = clamp(opts.difficulty ?? 3, 1, 5);

    let w, h;
    if (shape === 'right') { w = { s: 48, m: 84, l: 130 }[size] + ri(-6, 6); h = ri(15, 19); }
    else if (shape === 'up') { w = ri(22, 30); h = { s: 34, m: 56, l: 84 }[size] + ri(-3, 3); }
    else { w = { s: 46, m: 72, l: 104 }[size] + ri(-4, 4); h = { s: 26, m: 38, l: 52 }[size] + ri(-3, 3); }

    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    const res = Array.from({ length: h }, () => new Uint8Array(w));
    const inb = (x, y) => x >= 0 && x < w && y >= 0 && y < h;
    const set = (x, y, c) => { if (inb(x, y)) g[y][x] = c; };
    const free = (x0, y0, x1, y1) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (y < 0) { if (x < 0 || x >= w) return false; continue; }
        if (!inb(x, y) || g[y][x] !== '.' || res[y][x]) return false;
      }
      return true;
    };
    const reserve = (x0, y0, x1, y1) => {
      for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) res[y][x] = 1;
    };

    const ledges = [];
    const addLedge = (x0, x1, y, kind, fill) => {
      for (let x = x0; x <= x1; x++) {
        set(x, y, kind);
        if (fill) for (let yy = y + 1; yy < h; yy++) set(x, yy, '#');
      }
      reserve(x0, y - 3, x1, y - 1);
      const L = { x0, x1, y, kind, used: new Set() };
      ledges.push(L);
      return L;
    };

    let dir = 1, cur;
    if (shape === 'up') {
      for (let x = 0; x < w; x++) set(x, h - 1, '#');
      for (let y = 0; y < h; y++) { set(0, y, '#'); set(w - 1, y, '#'); }
      cur = { x0: 1, x1: 5, y: h - 1, kind: '#', used: new Set() };
      ledges.push(cur);
      reserve(1, h - 4, w - 2, h - 2);
      dir = chance(.5) ? 1 : -1;
      if (dir < 0) { cur.x0 = w - 6; cur.x1 = w - 2; }
    } else {
      const y = h - 3 - (shape === 'right' ? ri(0, 3) : 0);
      cur = addLedge(0, ri(5, 8), y, '#', true);
    }

    const pickKind = floating => {
      const r = R();
      if (!floating) return '#';
      if (diff >= 2 && r < .1 + diff * .03) return 'C';
      return r < .6 ? '#' : '=';
    };

    let fails = 0;
    for (let steps = 0; steps < 500; steps++) {
      const finished = shape === 'up' ? cur.y <= 7 : cur.x1 >= w - 9;
      if (finished) break;
      let placed = false;
      for (let attempt = 0; attempt < 30 && !placed; attempt++) {
        const roll = R();
        const edge = dir > 0 ? cur.x1 : cur.x0;

        if (shape === 'up') {
          if (dir > 0 && cur.x1 + 9 > w - 2) dir = -1;
          else if (dir < 0 && cur.x0 - 9 < 1) dir = 1;
        }

        // Moving platform across a wide gap
        if (shape !== 'up' && diff >= 2 && roll < .12 && dir > 0) {
          const gap = ri(6, 9), up = ri(0, 1), len = ri(3, 6);
          const xa = edge + gap + 1, xb = xa + len - 1, ny = cur.y - up;
          if (xb > w - 2 || ny < 5) continue;
          if (!free(edge + 1, cur.y - 4, xa - 1, cur.y) || !free(xa - 1, ny - 3, xb + 1, ny + 1)) continue;
          const fill = shape === 'right' && chance(.6) && free(xa, ny + 1, xb, h - 1);
          set(edge + 1, cur.y, '|'); set(xa - 1, cur.y, '|'); set(edge + 2, cur.y, 'M');
          reserve(edge + 1, cur.y - 4, xa - 1, cur.y);
          cur = addLedge(xa, xb, ny, fill ? '#' : pickKind(true) === '=' ? '=' : '#', fill);
          placed = true; continue;
        }

        // Vertical lift
        if (shape !== 'right' && roll > .82) {
          const rise = ri(4, 7), len = ri(3, 5), ny = cur.y - rise;
          const col = dir > 0 ? edge + 2 : edge - 3;
          const xa = dir > 0 ? col + 3 : col - 2 - len + 1, xb = xa + len - 1;
          if (ny < 5 || xa < 1 || xb > w - 2 || col < 1 || col + 1 > w - 2) continue;
          if (!free(Math.min(col, edge + dir), ny - 4, Math.max(col + 1, edge + dir), cur.y + 1)) continue;
          if (!free(xa - 1, ny - 3, xb + 1, ny + 1)) continue;
          set(col, ny - 2, '|'); set(col + 1, ny - 2, '|');
          set(col, cur.y + 1, '|'); set(col + 1, cur.y + 1, '|');
          set(col, cur.y, 'V');
          reserve(Math.min(col, edge + dir), ny - 4, Math.max(col + 1, edge + dir), cur.y + 1);
          cur = addLedge(xa, xb, ny, pickKind(true) === 'C' ? '#' : pickKind(true), false);
          placed = true; continue;
        }

        // Spring on the ledge end
        if (shape !== 'right' && roll > .7 && roll <= .82 && cur.kind !== 'C' && cur.x1 - cur.x0 >= 2 && !cur.used.has(edge)) {
          const rise = ri(5, 7), gap = ri(0, 2), len = ri(3, 5), ny = cur.y - rise;
          const xa = dir > 0 ? edge + gap + 1 : edge - gap - len, xb = xa + len - 1;
          if (ny < 5 || xa < 1 || xb > w - 2) continue;
          // the column above the spring must be open (its own reserved headroom is fine)
          let open = true;
          for (let y = Math.max(0, ny - 3); y <= cur.y - 1; y++) if (g[y][edge] !== '.') open = false;
          if (!open) continue;
          if (!free(xa - 1, ny - 3, xb + 1, ny + 1)) continue;
          set(edge, cur.y, 'O'); cur.used.add(edge);
          reserve(Math.min(edge, xa), ny - 3, Math.max(edge, xb), cur.y - 1);
          cur = addLedge(xa, xb, ny, pickKind(true) === 'C' ? '#' : pickKind(true), false);
          placed = true; continue;
        }

        // Ordinary hop
        let up;
        if (shape === 'right') {
          const target = Math.round(h * .62 + Math.sin(cur.x1 * .09 + (s % 7)) * 3);
          up = chance(.3) ? ri(-2, 2) : clamp(cur.y - target + ri(-1, 1), -3, 2);
        } else if (shape === 'up') up = ri(2, 3);
        else {
          const prog = cur.x1 / (w - 8);
          const targetY = Math.round((h - 3) - prog * (h - 9));
          up = clamp(cur.y - targetY + ri(-1, 1), -2, 3);
        }
        const maxGap = up >= 3 ? 1 : up >= 1 ? 3 : 4;
        const gap = ri(1, Math.max(1, Math.min(maxGap, 1 + Math.ceil(diff * .7))));
        const len = shape === 'up' ? ri(3, 6) : ri(Math.max(2, 5 - diff), 8 - Math.floor(diff / 2));
        const ny = cur.y - up;
        const xa = dir > 0 ? edge + gap + 1 : edge - gap - len, xb = xa + len - 1;
        if (ny < 5 || ny > h - 2 || xa < 1 || xb > w - 2) continue;
        if (!free(xa - 1, ny - 3, xb + 1, ny + 1)) continue;
        const g0 = dir > 0 ? edge + 1 : xb + 1, g1 = dir > 0 ? xa - 1 : edge - 1;
        const top = Math.min(cur.y, ny);
        if (g1 >= g0 && !free(g0, top - 3, g1, Math.max(cur.y, ny) - 1)) continue;
        const wantFill = shape === 'right' ? chance(.6) : shape === 'mixed' ? chance(.2) : false;
        const fill = wantFill && free(xa, ny + 1, xb, h - 1);
        if (g1 >= g0) reserve(g0, top - 3, g1, Math.max(cur.y, ny) - 1);
        cur = addLedge(xa, xb, ny, fill ? '#' : pickKind(true), fill);
        placed = true;
      }
      if (!placed) { fails++; break; }
    }

    const progressOk = shape === 'up' ? cur.y <= h * .4 : cur.x1 >= w * .7;
    if (ledges.length < 5 || !progressOk) return null;

    // Start, door, lanterns, hazards, enemies
    const first = ledges[0];
    const startX = shape === 'up' ? (dir > 0 || first.x0 > w / 2 ? first.x0 + 1 : first.x0 + 1) : 1;
    set(startX, first.y - 1, 'P'); first.used.add(startX);

    const last = ledges[ledges.length - 1];
    if (last.kind === 'C') for (let x = last.x0; x <= last.x1; x++) set(x, last.y, '#');
    const doorX = last.x1 - last.x0 >= 1 ? (g[last.y - 1][last.x1] === '.' ? last.x1 : last.x0) : last.x0;
    set(doorX, last.y - 1, 'D'); last.used.add(doorX);

    const wantL = { s: 3, m: 5, l: 7 }[size];
    const mids = ledges.slice(1, -1).filter(L => L.kind !== 'C');
    for (let k = 0; k < wantL && mids.length; k++) {
      const L = mids[Math.min(mids.length - 1, Math.round((k + .5) * mids.length / wantL))];
      const cols = [];
      for (let x = L.x0; x <= L.x1; x++) if (!L.used.has(x) && g[L.y - 1][x] === '.' && g[L.y][x] !== 'O') cols.push(x);
      if (!cols.length) continue;
      const x = pick(cols); set(x, L.y - 1, 'L'); L.used.add(x);
    }

    let wraiths = 0;
    for (const L of ledges.slice(1, -1)) {
      const len = L.x1 - L.x0 + 1;
      if (L.kind !== 'C' && len >= 5 && chance(.1 + diff * .06)) {
        const x = ri(L.x0 + 2, L.x1 - 2);
        if (!L.used.has(x) && g[L.y - 1][x] === '.' && !L.used.has(x - 1) && !L.used.has(x + 1)) { set(x, L.y - 1, '^'); L.used.add(x); }
      }
      if (L.kind !== 'C' && len >= 4 && chance(.18 + diff * .08)) {
        let type = pick(POOL[diff]);
        if (type === 'G' && wraiths >= diff - 3) type = 'B';
        const x = ri(L.x0 + 1, L.x1 - 1);
        if (L.used.has(x) || [...L.used].some(u => Math.abs(u - x) <= 1 && g[L.y - 1][u] === '^')) continue;
        const y = type === 'F' || type === 'Z' || type === 'W' ? L.y - 3 : type === 'G' ? L.y - 5 : L.y - 1;
        if (!inb(x, y) || g[y][x] !== '.') continue;
        set(x, y, type); L.used.add(x);
        if (type === 'G') wraiths++;
      }
    }

    const fruitLedges = ledges.slice(1, -1).filter(L => L.kind !== 'C');
    const wantF = { s: 1, m: 2, l: 3 }[size];
    for (let k = 0; k < wantF && fruitLedges.length; k++) {
      const L = pick(fruitLedges);
      const cols = [];
      for (let x = L.x0; x <= L.x1; x++) if (!L.used.has(x) && g[L.y - 1][x] === '.' && g[L.y][x] !== 'O') cols.push(x);
      if (!cols.length) continue;
      const x = pick(cols); set(x, L.y - 1, pick(['a', 'o', 'b'])); L.used.add(x);
    }

    if (shape === 'right' && chance(.55)) {
      for (let x = 0; x < w; x++) if (g[h - 1][x] === '.') set(x, h - 1, '~');
    }

    let map = g.map(r => r.join(''));
    if (shape !== 'right') {
      const topLedge = Math.min(...ledges.map(L => L.y));
      map = map.slice(Math.max(0, topLedge - 7));
    }
    if (shape !== 'up') {
      const right = Math.min(w, Math.max(...ledges.map(L => L.x1)) + 4);
      map = map.map(r => r.slice(0, right));
    }
    const name = `${pick(NAMES_A)} ${pick(NAMES_B)}`;
    return { name, dark: +(.42 + diff * .07).toFixed(2), map, shape, size, difficulty: diff, generated: true };
  }
})();
