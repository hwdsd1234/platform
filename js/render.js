// Lanternfall renderer: sky, tiles, sprites, darkness and light.
(() => {
  const LF = window.LF;
  const TS = LF.TS, TAU = Math.PI * 2;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  LF.reduced = reduced;

  function skyline(n, minH, maxH, seed) {
    const rr = LF.rng(seed); const items = []; let x = 0;
    for (let i = 0; i < n; i++) {
      const w = 36 + rr() * 60, h = minH + rr() * (maxH - minH);
      const roof = rr() < .25 ? 'spire' : rr() < .55 ? 'peak' : 'flat';
      const wins = [];
      for (let k = 0; k < 4; k++) if (rr() < .35) wins.push({ x: 6 + rr() * (w - 14), y: 12 + rr() * (h - 30) });
      items.push({ x, w, h, roof, wins }); x += w + rr() * 10;
    }
    return { items, total: x };
  }
  const layers = [
    { f: .15, color: '#231D44', win: .28, ...skyline(40, 90, 230, 11) },
    { f: .4, color: '#2D2552', win: .45, ...skyline(40, 50, 150, 23) },
  ];
  // Sky levels: banks of cloud drifting far below and around you.
  const cloudRand = LF.rng(31);
  const clouds = Array.from({ length: 3 }, (_, k) => ({ f: .1 + k * .18, y: .62 + k * .13, a: .18 + k * .12, items: Array.from({ length: 14 }, () => ({ x: cloudRand() * 1600, w: 90 + cloudRand() * 160, h: 22 + cloudRand() * 26 })) }));
  const starRand = LF.rng(7);
  const stars = Array.from({ length: 120 }, () => ({ x: starRand(), y: starRand() * .7, r: starRand() < .15 ? 1.6 : .9, ph: starRand() * TAU }));

  LF.createRenderer = function (cvs) {
    const ctx = cvs.getContext('2d');
    const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
    const R = { W: 0, H: 0, dpr: 1, base: 1, sc: 1 };
    let clock = 0;

    R.resize = () => {
      R.dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = window.innerWidth, ch = window.innerHeight;
      R.W = cvs.width = Math.round(cw * R.dpr);
      R.H = cvs.height = Math.round(ch * R.dpr);
      dark.width = R.W; dark.height = R.H;
      R.base = R.dpr * Math.min(ch / (14 * TS), cw / (22 * TS));
    };
    R.scale = cam => R.base * (cam.zoom || 1);
    R.viewSize = cam => ({ vw: R.W / R.scale(cam), vh: R.H / R.scale(cam) });
    R.screenToWorld = (cx, cy, cam) => {
      const sc = R.scale(cam);
      return { x: cx * R.dpr / sc + cam.x, y: cy * R.dpr / sc + cam.y };
    };

    LF.followCamera = (W, cam, dt, snap) => {
      const { vw, vh } = R.viewSize(cam);
      const p = W.player, ww = W.w * TS, wh = W.h * TS;
      let tx = ww <= vw ? -(vw - ww) / 2 : Math.max(0, Math.min(ww - vw, p.x + p.w / 2 - vw / 2 + p.face * 40));
      let ty = wh <= vh ? wh - vh : Math.max(0, Math.min(wh - vh, p.y + p.h / 2 - vh * .55));
      if (snap) { cam.x = tx; cam.y = ty; return; }
      cam.x += (tx - cam.x) * Math.min(1, dt * 5);
      cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    };

    function drawCloudSky(W, cam) {
      const { W: SW, H: SH } = R, sc = R.scale(cam), bs = R.base;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, SH);
      g.addColorStop(0, '#0E1638'); g.addColorStop(.5, '#24306A'); g.addColorStop(.8, '#4A4A86'); g.addColorStop(1, '#7A6A9E');
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
      ctx.fillStyle = '#E6E0FF';
      for (const s of stars) {
        const tw = reduced ? .7 : .5 + .5 * Math.sin(clock * 1.5 + s.ph);
        ctx.globalAlpha = (.3 + tw * .55) * (1 - s.y);
        const x = ((s.x * SW - cam.x * sc * .02) % SW + SW) % SW, y = ((s.y * SH * .6 - cam.y * sc * .02) % SH + SH) % SH;
        ctx.fillRect(x, y, s.r * R.dpr, s.r * R.dpr);
      }
      ctx.globalAlpha = 1;
      const mx = SW * .2 - cam.x * sc * .03, my = SH * .18, mr = 26 * bs;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 6);
      mg.addColorStop(0, 'rgba(255,240,210,.28)'); mg.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
      ctx.fillStyle = '#FFF1CF'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      // The ground is far, far below: a sea of cloud with the odd lamp glinting through.
      const bottom = (W.h * TS - cam.y) * sc;
      for (const layer of clouds) {
        const span = 1600 * bs, drift = reduced ? 0 : clock * 6 * (1 + layer.f * 4);
        const start = -(((cam.x * layer.f * sc + drift * bs) % span) + span) % span;
        const y0 = Math.min(SH * layer.y, bottom - (1 - layer.y) * SH * .5) - cam.y * sc * layer.f * .2 + (W.h * TS * sc * layer.f * .2);
        ctx.fillStyle = `rgba(214,206,240,${layer.a})`;
        for (let rep = start; rep < SW; rep += span) for (const c of layer.items) {
          const x = rep + c.x * bs, w = c.w * bs, h = c.h * bs;
          if (x > SW || x + w < 0) continue;
          ctx.beginPath(); ctx.ellipse(x + w / 2, y0, w / 2, h / 2, 0, 0, TAU); ctx.ellipse(x + w * .35, y0 - h * .35, w * .25, h * .45, 0, 0, TAU); ctx.fill();
        }
      }
      const sea = Math.min(bottom - 2 * TS * sc, SH * 1.1);
      const sg = ctx.createLinearGradient(0, sea, 0, sea + 4 * TS * sc);
      sg.addColorStop(0, 'rgba(200,190,235,0)'); sg.addColorStop(1, 'rgba(200,190,235,.75)');
      ctx.fillStyle = sg; ctx.fillRect(0, sea, SW, SH);
    }

    function drawSky(W, cam) {
      if (W.def.sky) return drawCloudSky(W, cam);
      const { W: SW, H: SH } = R, sc = R.scale(cam);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, SH);
      g.addColorStop(0, '#100D26'); g.addColorStop(.55, '#261E4A'); g.addColorStop(.85, '#46305E'); g.addColorStop(1, '#5B3A63');
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
      ctx.fillStyle = '#D9D0F0';
      for (const s of stars) {
        const tw = reduced ? .7 : .5 + .5 * Math.sin(clock * 1.5 + s.ph);
        ctx.globalAlpha = .3 + tw * .55;
        const x = ((s.x * SW - cam.x * sc * .03) % SW + SW) % SW;
        const y = ((s.y * SH - cam.y * sc * .03) % SH + SH) % SH;
        ctx.fillRect(x, y, s.r * R.dpr, s.r * R.dpr);
      }
      ctx.globalAlpha = 1;

      const bottom = (W.h * TS - cam.y) * sc;
      const mx = SW * .78 - cam.x * sc * .05, my = SH * .22 - (cam.y - (W.h * TS - SH / sc)) * sc * .05;
      const mr = 22 * R.base;
      const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 5);
      mg.addColorStop(0, 'rgba(217,208,240,.2)'); mg.addColorStop(1, 'rgba(217,208,240,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
      ctx.fillStyle = '#CFC4EA'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2A2150'; ctx.beginPath(); ctx.arc(mx + mr * .4, my - mr * .22, mr * .9, 0, TAU); ctx.fill();

      const base = Math.min(SH * 1.8, SH * .8 + (bottom - SH) * .25);
      const bs = R.base;
      for (const layer of layers) {
        const span = layer.total * bs;
        const start = -((cam.x * layer.f * sc) % span + span) % span;
        for (let rep = start; rep < SW; rep += span) {
          for (const b of layer.items) {
            const x = rep + b.x * bs, w = b.w * bs, h = b.h * bs;
            if (x > SW || x + w < 0) continue;
            ctx.fillStyle = layer.color;
            ctx.fillRect(x, base - h, w, SH * 2);
            ctx.beginPath();
            if (b.roof === 'peak') { ctx.moveTo(x - 3 * bs, base - h); ctx.lineTo(x + w / 2, base - h - 22 * bs); ctx.lineTo(x + w + 3 * bs, base - h); }
            else if (b.roof === 'spire') { ctx.moveTo(x + w * .3, base - h); ctx.lineTo(x + w / 2, base - h - 48 * bs); ctx.lineTo(x + w * .7, base - h); }
            ctx.fill();
            ctx.fillStyle = `rgba(255,181,71,${layer.win})`;
            for (const wn of b.wins) ctx.fillRect(x + wn.x * bs, base - h + wn.y * bs, 4 * bs, 5 * bs);
          }
        }
      }
      const mistTop = bottom - 3 * TS * sc;
      const mist = ctx.createLinearGradient(0, mistTop, 0, bottom);
      mist.addColorStop(0, 'rgba(14,12,34,0)'); mist.addColorStop(1, 'rgba(14,12,34,.95)');
      ctx.fillStyle = mist; ctx.fillRect(0, mistTop, SW, 3 * TS * sc);
      ctx.fillStyle = '#0E0C22'; ctx.fillRect(0, bottom - 1, SW, SH);
    }

    function worldTransform(W, cam, opts) {
      const sc = R.scale(cam);
      let sx = 0, sy = 0;
      if (W.shake > 0 && !reduced && !opts.edit) { sx = (Math.random() - .5) * W.shake * 18 * R.dpr; sy = (Math.random() - .5) * W.shake * 18 * R.dpr; }
      ctx.setTransform(sc, 0, 0, sc, -cam.x * sc + sx, -cam.y * sc + sy);
    }

    function visibleRange(W, cam) {
      const { vw, vh } = R.viewSize(cam);
      return {
        x0: Math.max(0, Math.floor(cam.x / TS) - 1), x1: Math.min(W.w - 1, Math.ceil((cam.x + vw) / TS) + 1),
        y0: Math.max(0, Math.floor(cam.y / TS) - 1), y1: Math.min(W.h - 1, Math.ceil((cam.y + vh) / TS) + 1),
      };
    }

    function drawStone(W, tx, ty, x, y, fill, seam) {
      ctx.fillStyle = fill; ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = seam;
      ctx.fillRect(x, y + 15, TS, 2);
      const off = ty % 2 ? 8 : 24;
      ctx.fillRect(x + off, y, 2, 15);
      ctx.fillRect(x + ((off + 16) % 32), y + 17, 2, 15);
    }

    function drawTiles(W, cam, opts) {
      const { x0, x1, y0, y1 } = visibleRange(W, cam);
      const t = (x, y) => LF.tile(W, x, y);
      const looksSolid = c => LF.isSolid(c) || (c === 'l' && (!W.secretSeen || opts.edit));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const c = W.tiles[ty][tx], x = tx * TS, y = ty * TS;
        // False walls (l) look just like the stone around them until the secret is found
        // (in the editor they're marked).
        if (c === 'l' && W.secretSeen && !opts.edit) {
          ctx.strokeStyle = 'rgba(159,216,255,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4); ctx.setLineDash([]);
        } else if (c === '#' || c === 'l') {
          drawStone(W, tx, ty, x, y, '#5E5173', '#4C4062');
          if (!looksSolid(t(tx, ty - 1))) { ctx.fillStyle = '#8F81AB'; ctx.fillRect(x, y, TS, 4); ctx.fillStyle = '#A99CC4'; ctx.fillRect(x, y, TS, 1.5); }
          if (!looksSolid(t(tx - 1, ty)) && tx > 0) { ctx.fillStyle = '#6E6186'; ctx.fillRect(x, y, 2, TS); }
          if (!looksSolid(t(tx + 1, ty)) && tx < W.w - 1) { ctx.fillStyle = '#433858'; ctx.fillRect(x + TS - 2, y, 2, TS); }
          if (c === 'l' && opts.edit) { ctx.strokeStyle = '#9FD8FF'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 3, y + 3, TS - 6, TS - 6); ctx.setLineDash([]); }
        } else if (c === 'C') {
          const cr = W.crumbles.find(k => k.tx === tx && k.ty === ty);
          const j = cr && !reduced ? (Math.random() - .5) * 3 : 0;
          ctx.fillStyle = '#7B6A8C'; ctx.fillRect(x + 1 + j, y + 1, TS - 2, TS - 2);
          ctx.fillStyle = '#9C8BAE'; ctx.fillRect(x + 1 + j, y + 1, TS - 2, 3);
          ctx.strokeStyle = '#4C4062'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + 6 + j, y + 6); ctx.lineTo(x + 14 + j, y + 15); ctx.lineTo(x + 11 + j, y + 25);
          ctx.moveTo(x + 14 + j, y + 15); ctx.lineTo(x + 25 + j, y + 12); ctx.stroke();
        } else if (c === 'c') {
          ctx.strokeStyle = 'rgba(156,139,174,.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4); ctx.setLineDash([]);
        } else if (c === '=') {
          ctx.fillStyle = '#9A6A45'; ctx.fillRect(x, y, TS, 7);
          ctx.fillStyle = '#C08A5C'; ctx.fillRect(x, y, TS, 2);
          ctx.fillStyle = '#6B452C'; ctx.fillRect(x, y + 7, TS, 3); ctx.fillRect(x + 14, y + 2, 2, 5);
        } else if (c === '^') {
          ctx.fillStyle = '#2A2348'; ctx.fillRect(x, y + TS - 4, TS, 4);
          for (let k = 0; k < 3; k++) {
            const sx = x + 2 + k * 10;
            ctx.fillStyle = '#CFC6E8';
            ctx.beginPath(); ctx.moveTo(sx, y + TS - 4); ctx.lineTo(sx + 4, y + 13); ctx.lineTo(sx + 8, y + TS - 4); ctx.fill();
            ctx.fillStyle = '#8D82B0';
            ctx.beginPath(); ctx.moveTo(sx + 4, y + 13); ctx.lineTo(sx + 8, y + TS - 4); ctx.lineTo(sx + 4, y + TS - 4); ctx.fill();
          }
        } else if (c === '!') {
          // Lava itself is drawn in the emissive pass; leave the tile empty here.
        } else if (c === '~') {
          ctx.fillStyle = 'rgba(46,78,130,.88)';
          if (t(tx, ty - 1) !== '~') {
            const wave = reduced ? 0 : Math.sin(clock * 2.2 + tx * .8) * 2;
            ctx.fillRect(x, y + 8 + wave, TS, TS - 8 - wave);
            ctx.fillStyle = '#7FB0E0'; ctx.fillRect(x, y + 8 + wave, TS, 2);
          } else ctx.fillRect(x, y, TS, TS);
        } else if (c === 'O') {
          drawStone(W, tx, ty, x, y + 12, '#5E5173', '#4C4062');
          ctx.fillStyle = '#2A2348'; ctx.fillRect(x + 2, y + 10, TS - 4, 6);
          ctx.strokeStyle = '#D9D0F0'; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { ctx.moveTo(x + 8, y + 5 + k * 3); ctx.lineTo(x + 24, y + 7 + k * 3); }
          ctx.stroke();
          ctx.fillStyle = '#FF6B3D'; ctx.fillRect(x + 3, y, TS - 6, 4);
        } else if (c === 'T' || c === 'H' || c === 't' || c === 'h') {
          const amber = c === 'T' || c === 't', on = c === 'T' || c === 'H';
          const col = amber ? '#FFB547' : '#7FB0E0', dim = amber ? '#8A5A1E' : '#2E4E82';
          const warn = on && W.blinkT > LF.BLINK - .5 && !reduced && Math.floor(W.blinkT * 12) % 2;
          if (on) {
            ctx.fillStyle = warn ? '#3A2F55' : dim; ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2);
            ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, TS - 2, 3);
            ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, TS - 4, TS - 4);
            ctx.fillStyle = col;
            if (amber) ctx.fillRect(x + 13, y + 13, 6, 6);
            else { ctx.beginPath(); ctx.arc(x + 16, y + 16, 3.5, 0, TAU); ctx.fill(); }
          } else {
            ctx.strokeStyle = amber ? 'rgba(255,181,71,.4)' : 'rgba(127,176,224,.4)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
            ctx.strokeRect(x + 2.5, y + 2.5, TS - 5, TS - 5); ctx.setLineDash([]);
          }
        } else if (LF.SHOT_DOORS[c]) {
          // Shot door: an iron panel showing how many hits it still needs.
          const d = W.shotDoorAt && W.shotDoorAt[ty * W.w + tx], left = d ? d.need - d.hits : LF.SHOT_DOORS[c];
          const col = { v: '#7FB0E0', w: '#FFB547', z: '#FF6B3D' }[c];
          ctx.fillStyle = d && d.flash > 0 ? '#CFC6E8' : '#3A3350'; ctx.fillRect(x + 1, y, TS - 2, TS);
          ctx.fillStyle = '#2A2348'; ctx.fillRect(x + 1, y, 3, TS); ctx.fillRect(x + TS - 4, y, 3, TS);
          ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x + 5, y + 3, TS - 10, TS - 6);
          ctx.fillStyle = col; ctx.font = '700 11px ui-monospace, monospace'; ctx.textAlign = 'center';
          ctx.fillText(String(left), x + 16, y + 20); ctx.textAlign = 'left';
        } else if (c === 'g') {
          // Boss gate: dark bars with a red glow, gone once the boss is down.
          ctx.fillStyle = 'rgba(42,35,72,.85)'; ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#7A2E1C'; for (let k = 0; k < 3; k++) ctx.fillRect(x + 4 + k * 10, y, 4, TS);
          ctx.fillStyle = `rgba(255,107,61,${reduced ? .5 : .35 + Math.sin(clock * 3 + ty) * .15})`; ctx.fillRect(x, y + 14, TS, 3);
        } else if (LF.GATES[c[0]]) {
          // Locked door: colored iron bars with a keyhole. "1*" etc. are doors mid-opening.
          const k = LF.KEYS[LF.GATES[c[0]]], opening = c.length > 1;
          const shake = opening && !reduced ? (Math.random() - .5) * 2 : 0;
          ctx.globalAlpha = opening ? .6 : 1;
          ctx.fillStyle = k.dim; ctx.fillRect(x + shake, y, TS, TS);
          ctx.fillStyle = k.color;
          ctx.fillRect(x + shake, y, TS, 3); ctx.fillRect(x + shake, y + TS - 3, TS, 3);
          for (let b = 0; b < 4; b++) ctx.fillRect(x + 3 + b * 8 + shake, y, 2.5, TS);
          if (t(tx, ty - 1) !== c) {
            ctx.fillStyle = '#211C3F'; ctx.beginPath(); ctx.arc(x + 16 + shake, y + 13, 4, 0, TAU); ctx.fill();
            ctx.fillRect(x + 14.5 + shake, y + 13, 3, 8);
          }
          ctx.globalAlpha = 1;
        } else if (c === 'i') {
          ctx.fillStyle = '#9FC6E8'; ctx.fillRect(x, y, TS, TS);
          ctx.fillStyle = '#C8E2F5'; ctx.fillRect(x, y, TS, 5);
          ctx.fillStyle = '#E8F4FC'; ctx.fillRect(x, y, TS, 1.5);
          ctx.fillStyle = 'rgba(255,255,255,.45)';
          ctx.beginPath(); ctx.moveTo(x + 5, y + 24); ctx.lineTo(x + 15, y + 10); ctx.lineTo(x + 18, y + 10); ctx.lineTo(x + 8, y + 24); ctx.fill();
          ctx.fillStyle = '#7FA8CC'; ctx.fillRect(x, y + TS - 2, TS, 2);
          if (!LF.isSolid(t(tx, ty + 1))) for (let k = 0; k < 3; k++) {
            ctx.fillStyle = '#C8E2F5'; ctx.beginPath(); ctx.moveTo(x + 4 + k * 10, y + TS); ctx.lineTo(x + 8 + k * 10, y + TS + 7 - k % 2 * 3); ctx.lineTo(x + 12 + k * 10, y + TS); ctx.fill();
          }
        } else if (c === '<' || c === '>') {
          const d = c === '>' ? 1 : -1;
          drawStone(W, tx, ty, x, y + 8, '#4C4062', '#3B3150');
          ctx.fillStyle = '#2A2348'; ctx.fillRect(x, y, TS, 9);
          ctx.fillStyle = '#6E6186'; ctx.fillRect(x, y, TS, 2);
          const off = reduced ? 0 : ((clock * 110 * d) % 16 + 16) % 16;
          ctx.fillStyle = '#FF9A2E';
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, TS, 9); ctx.clip();
          for (let k = -1; k < 3; k++) {
            const cx = x + k * 16 + off;
            ctx.beginPath(); ctx.moveTo(cx - 3 * d, y + 2.5); ctx.lineTo(cx + 2 * d, y + 5); ctx.lineTo(cx - 3 * d, y + 7.5); ctx.lineTo(cx - 1 * d, y + 5); ctx.fill();
          }
          ctx.restore();
        } else if (c === '|' && opts.edit) {
          ctx.strokeStyle = 'rgba(255,107,61,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(x + 16, y + 2); ctx.lineTo(x + 16, y + TS - 2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    // A little curved arrow round a hub, showing which way it turns (dir 1: clockwise).
    function spinArrow(x, y, rad, dir, a0) {
      const a1 = a0 + dir * 1.9;
      ctx.strokeStyle = '#FFE2A8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rad, a0, a1, dir < 0); ctx.stroke();
      const hx = x + Math.cos(a1) * rad, hy = y + Math.sin(a1) * rad, tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;
      ctx.fillStyle = '#FFE2A8'; ctx.beginPath();
      ctx.moveTo(hx + tx * 6, hy + ty * 6); ctx.lineTo(hx - ty * 4, hy + tx * 4); ctx.lineTo(hx + ty * 4, hy - tx * 4); ctx.fill();
    }
    function drawPlats(W) {
      // Turn blocks: a square of stone turning on its pivot.
      for (const s of W.spinners) {
        const h = s.half;
        ctx.save(); ctx.translate(s.cx, s.cy); ctx.rotate(s.a);
        ctx.fillStyle = '#4C4062'; ctx.fillRect(-h, -h, h * 2, h * 2);
        ctx.fillStyle = '#5E5173';
        for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) ctx.fillRect(-h + gx * TS + 2, -h + gy * TS + 2, TS - 4, TS - 4);
        ctx.strokeStyle = '#8F81AB'; ctx.lineWidth = 3; ctx.strokeRect(-h + 1.5, -h + 1.5, h * 2 - 3, h * 2 - 3);
        ctx.fillStyle = '#2A2348'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
        ctx.fillStyle = '#C08A5C'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2A2348'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
        ctx.restore();
        spinArrow(s.cx, s.cy, 18, s.dir, -Math.PI / 2 - s.dir * .95);
      }
      // Wheels: the hub and spokes behind their platforms.
      for (const p of W.plats) {
        if (p.kind !== 'wheel') continue;
        ctx.strokeStyle = '#4C4062'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(p.cx, p.cy); ctx.lineTo(p.x + p.w / 2, p.y + 6); ctx.stroke();
        ctx.strokeStyle = 'rgba(143,129,171,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(p.cx, p.cy, LF.WHEEL_R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      for (const p of W.plats) {
        if (p.kind !== 'wheel') continue;
        ctx.fillStyle = '#5E5173'; ctx.beginPath(); ctx.arc(p.cx, p.cy, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(p.cx, p.cy, 3.5, 0, TAU); ctx.fill();
      }
      // (one arrow per wheel: drawn round the hub of its first platform's wheel)
      const hubs = new Set();
      for (const p of W.plats) {
        if (p.kind !== 'wheel' || hubs.has(p.cx + ',' + p.cy)) continue;
        hubs.add(p.cx + ',' + p.cy); spinArrow(p.cx, p.cy, 16, Math.sign(p.spin), -Math.PI / 2 - Math.sign(p.spin) * .95);
      }
      for (const p of W.plats) {
        if (p.kind === 'wheel') {
          ctx.fillStyle = '#3A3350'; ctx.fillRect(p.x + 4, p.y + 10, p.w - 8, 3);
          ctx.fillStyle = '#7F6FA8'; ctx.fillRect(p.x, p.y, p.w, 10);
          ctx.fillStyle = '#B9A8E0'; ctx.fillRect(p.x, p.y, p.w, 2);
          ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + 6, 2.5, 0, TAU); ctx.fill();
          continue;
        }
        if (p.kind === 'fall') {
          if (p.state === 'gone') {
            ctx.strokeStyle = 'rgba(192,138,92,.3)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
            ctx.strokeRect(p.ox + 1.5, p.oy + .5, p.w - 3, p.h); ctx.setLineDash([]); continue;
          }
          const j = p.state === 'shake' && !reduced ? (Math.random() - .5) * 3 : 0;
          ctx.fillStyle = '#7A4A3A'; ctx.fillRect(p.x + 1 + j, p.y, p.w - 2, 10);
          ctx.fillStyle = '#A8604A'; ctx.fillRect(p.x + 1 + j, p.y, p.w - 2, 2.5);
          ctx.fillStyle = '#5A3428';
          for (let ox = 0; ox < p.w; ox += TS) { ctx.fillRect(p.x + ox + 10 + j, p.y + 3, 1.5, 7); ctx.fillRect(p.x + ox + 21 + j, p.y + 3, 1.5, 7); }
          ctx.beginPath(); ctx.moveTo(p.x + 1 + j, p.y + 10); for (let ox = 0; ox < p.w; ox += TS) ctx.lineTo(p.x + ox + 16 + j, p.y + 14); ctx.lineTo(p.x + p.w - 1 + j, p.y + 10); ctx.fill();
          continue;
        }
        ctx.fillStyle = '#6B452C'; ctx.fillRect(p.x + 4, p.y + 10, p.w - 8, 3);
        ctx.fillStyle = '#9A6A45'; ctx.fillRect(p.x, p.y, p.w, 10);
        ctx.fillStyle = '#C08A5C'; ctx.fillRect(p.x, p.y, p.w, 2);
        ctx.fillStyle = '#FFB547';
        if (p.axis === 'x') { ctx.fillRect(p.x + 26, p.y + 4, 4, 2); ctx.fillRect(p.x + 34, p.y + 4, 4, 2); }
        else { ctx.fillRect(p.x + 31, p.y + 2, 2, 6); }
      }
    }

    function drawLantern(l) {
      const s = 1 + l.pop * .25;
      ctx.save(); ctx.translate(l.x, l.y); ctx.scale(s, s);
      ctx.fillStyle = '#2A2348';
      ctx.fillRect(-1.5, 8, 3, 10); ctx.fillRect(-5, 16, 10, 2); ctx.fillRect(-7, -9, 14, 18);
      ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, -9); ctx.lineTo(0, -16); ctx.fill();
      ctx.fillStyle = l.lit ? '#FFB547' : '#3D3458'; ctx.fillRect(-5, -7, 10, 14);
      ctx.fillStyle = '#2A2348'; ctx.fillRect(-.75, -7, 1.5, 14);
      ctx.restore();
    }

    function doorPath(d, inset) {
      const { x, y, w, h } = d;
      ctx.beginPath();
      ctx.moveTo(x + inset, y + h); ctx.lineTo(x + inset, y + 14);
      ctx.arc(x + w / 2, y + 14, w / 2 - inset, Math.PI, 0);
      ctx.lineTo(x + w - inset, y + h);
    }
    function drawDoor(d) {
      if (!d) return;
      if (d.secret) {
        // The secret exit: a pale blue arch with a star over it.
        ctx.fillStyle = '#7FB0E0'; doorPath(d, -4); ctx.fill();
        ctx.fillStyle = '#1E3550'; doorPath(d, 0); ctx.fill();
        ctx.fillStyle = '#FFE2A8'; ctx.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 2.5 : 6; ctx.lineTo(d.x + 16 + Math.cos(a) * rr, d.y - 8 + Math.sin(a) * rr); }
        ctx.fill();
        return;
      }
      ctx.fillStyle = '#8F81AB'; doorPath(d, -4); ctx.fill();
      ctx.fillStyle = d.open ? '#3A2440' : '#0E0C22'; doorPath(d, 0); ctx.fill();
      if (!d.open) {
        ctx.fillStyle = '#5E5173';
        for (let k = 0; k < 3; k++) ctx.fillRect(d.x + 6 + k * 9, d.y + 6, 3, d.h - 6);
        ctx.fillRect(d.x, d.y + 30, d.w, 3);
      }
    }

    // A cannon on its wheel, barrel up and to the right. It rocks back when it fires, and
    // shows a bouncing ↓ while you're standing at it.
    function drawCannon(W, opts) {
      const c = W.cannon;
      if (!c) return;
      const kick = c.state === 'fire' && c.t < .25 ? (1 - c.t / .25) * 6 : 0, shake = c.state === 'in' && !reduced ? Math.sin(c.t * 60) * 1.5 : 0;
      ctx.save(); ctx.translate(c.x - kick + shake, c.y - 18);
      ctx.save(); ctx.rotate(-.7);
      ctx.fillStyle = '#463C6B'; ctx.strokeStyle = '#CFC6E8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-8, -14, 58, 28, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.state === 'fire' && c.t < .3 ? '#FFB547' : '#4C4062'; ctx.beginPath(); ctx.roundRect(44, -17, 12, 34, 4); ctx.fill();
      ctx.fillStyle = '#6E6186'; ctx.fillRect(8, -14, 4, 28); ctx.fillRect(24, -14, 4, 28);
      ctx.restore();
      ctx.fillStyle = '#5C3B24'; ctx.strokeStyle = '#3A2516'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#C08A5C'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
      ctx.restore();
      const p = W.player;
      if (c.state === 'idle' && !opts.edit && Math.abs(p.x + p.w / 2 - c.x) < 40 && Math.abs(p.y + p.h - c.y) < 40) {
        const bob = reduced ? 0 : Math.sin(clock * 6) * 3;
        ctx.fillStyle = '#FFE2A8'; ctx.font = '700 18px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText('↓', c.x, c.y - 78 + bob); ctx.textAlign = 'left';
      }
    }

    // Draw a resized enemy by drawing it at its normal size and scaling the canvas around it.
    function scaled(e, draw) {
      const s = e.scale || 1;
      if (s === 1) return draw(e);
      const cx = e.x + e.w / 2, by = e.y + e.h, w0 = e.w / s, h0 = e.h / s;
      const q = { ...e, x: cx - w0 / 2, y: by - h0, w: w0, h: h0, ox: cx - w0 / 2 + (e.ox - e.x) / s, oy: by + (e.oy - by) / s };
      ctx.save(); ctx.translate(cx, by); ctx.scale(s, s); ctx.translate(-cx, -by);
      draw(q);
      ctx.restore();
    }

    // The castle keepers' looks (hurt: flashing pale).
    const ell = (x, y, rx, ry, c, a = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a, 0, TAU); ctx.fill(); };
    const eyes = (x, y, gap, f, c = '#FF6B3D', r = 4) => { for (const d of [-1, 1]) ell(x + d * gap + f * 3, y, r, r, c); };
    const KEEPER_ART = {
      'Γ+': (e, cx, cy, hurt) => {
        // The Candle King: a tall candle with dripping wax, a gold crown, and his own flame.
        const melt = e.state === 'melted' ? .85 : 1, top = e.y + e.h * (1 - melt), w = e.w * .7;
        ctx.fillStyle = hurt ? '#FFFFFF' : '#F3E6C8'; ctx.fillRect(cx - w / 2, top + 14, w, e.y + e.h - top - 14);
        ctx.fillStyle = hurt ? '#FFFFFF' : '#E2CFA4'; for (const [dx, l] of [[-.35, 16], [-.05, 26], [.25, 12]]) { ctx.fillRect(cx + dx * w, top + 14, 6, l); ell(cx + dx * w + 3, top + 14 + l, 3, 4, ctx.fillStyle); }
        ctx.fillStyle = '#E0A526'; ctx.beginPath(); ctx.moveTo(cx - w / 2, top + 16); for (let k = 0; k <= 4; k++) ctx.lineTo(cx - w / 2 + k * w / 4, top + (k % 2 ? 4 : 0)); ctx.lineTo(cx + w / 2, top + 16); ctx.fill();
        const fl = reduced ? 1 : 1 + Math.sin(clock * 14) * .12;
        ell(cx, top - 8, 7, 12 * fl, '#FF9A2E'); ell(cx, top - 5, 3.5, 7 * fl, '#FFF1CF');
        eyes(cx, top + 34, 9, e.face || 1, e.state === 'melted' ? '#9A8FBF' : '#FF6B3D');
        ctx.fillStyle = '#7A2E1C'; ctx.fillRect(cx - 8 + (e.face || 1) * 3, top + 46, 16, 3);
      },
      'Δ+': (e, cx, cy, hurt) => {
        // The Lighthouse Crab: a red shell, two big claws, eyes on stalks, legs scuttling.
        const f = e.face || 1, body = hurt ? '#FFFFFF' : '#C0392B', by = e.y + e.h;
        ctx.strokeStyle = '#7A2E1C'; ctx.lineWidth = 4;
        for (let k = 0; k < 3; k++) for (const d of [-1, 1]) { const lx = cx + d * (14 + k * 10), kick = reduced ? 0 : Math.sin(clock * 16 + k) * (e.state === 'scuttle' ? 5 : 1); ctx.beginPath(); ctx.moveTo(lx, cy + 6); ctx.lineTo(lx + d * 10, cy + 12 + kick); ctx.lineTo(lx + d * 12, by); ctx.stroke(); }
        ell(cx, cy + 4, e.w * .36, e.h * .34, body);
        ell(cx, cy - 2, e.w * .26, e.h * .16, hurt ? '#FFFFFF' : '#E5484D');
        const snap = e.state === 'snap' ? .5 : 0;
        for (const d of [-1, 1]) { const x = cx + d * e.w * .42 + (d === f ? f * snap * 16 : 0); ell(x, cy - 6, 13, 10, body); ctx.fillStyle = '#211C3F'; ctx.fillRect(x - 2 + d * 6, cy - 8, 8 * d, 3); }
        ctx.strokeStyle = body; ctx.lineWidth = 3; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * 8, cy - 10); ctx.lineTo(cx + d * 10, e.y + 2); ctx.stroke(); ell(cx + d * 10, e.y + 2, 5, 5, '#FFF1CF'); ell(cx + d * 10 + f * 2, e.y + 2, 2.5, 2.5, e.state === 'stuck' ? '#9A8FBF' : '#211C3F'); }
      },
      'Ξ+': (e, cx, cy, hurt) => {
        // The Clockwork Knight: brass-trimmed armour, a slit visor glowing, a wind-up key on his back.
        const f = e.face || 1, steel = hurt ? '#FFFFFF' : '#8F8AA6', dark = '#4A4560', run = e.state === 'winding';
        ctx.fillStyle = steel; ctx.fillRect(cx - e.w * .4, e.y + 24, e.w * .8, e.h - 40);
        ctx.fillStyle = dark; ctx.fillRect(cx - e.w * .32, e.y + e.h - 16, 10, 16); ctx.fillRect(cx + e.w * .32 - 10, e.y + e.h - 16, 10, 16);
        ctx.fillStyle = '#E0A526'; ctx.fillRect(cx - e.w * .4, e.y + 40, e.w * .8, 4);
        ell(cx, e.y + 14, e.w * .3, 15, steel); ctx.fillStyle = dark; ctx.fillRect(cx - 12 + f * 3, e.y + 12, 24, 5);
        ctx.fillStyle = run ? '#463C6B' : '#FF6B3D'; ctx.fillRect(cx - 10 + f * 3, e.y + 13, 20, 3);
        ctx.save(); ctx.translate(cx - f * e.w * .45, e.y + 36); ctx.rotate(reduced ? 0 : clock * (run ? 8 : 2)); ctx.fillStyle = '#E0A526'; ctx.fillRect(-12, -3, 24, 6); ctx.fillRect(-3, -12, 6, 24); ctx.restore();
        ctx.save(); ctx.translate(cx + f * e.w * .42, cy + 4); ctx.rotate(reduced ? 0 : clock); ctx.fillStyle = '#6E6186'; for (let k = 0; k < 8; k++) { ctx.rotate(TAU / 8); ctx.fillRect(-3, -14, 6, 6); } ell(0, 0, 10, 10, '#6E6186'); ell(0, 0, 4, 4, dark); ctx.restore();
      },
      'Λ+': (e, cx, cy, hurt) => {
        // The Storm Roc: a great slate-blue bird, wings beating, a hooked beak and a lightning eye.
        const f = e.face || 1, c = hurt ? '#FFFFFF' : '#5B6E9A', flap = reduced || e.state === 'tired' ? .2 : Math.sin(clock * 9);
        for (const d of [-1, 1]) { ctx.fillStyle = hurt ? '#FFFFFF' : '#3E4C73'; ctx.beginPath(); ctx.moveTo(cx + d * 10, cy - 4); ctx.lineTo(cx + d * e.w * .55, cy - 10 - flap * 20); ctx.lineTo(cx + d * e.w * .4, cy + 8); ctx.fill(); }
        ell(cx, cy + 4, e.w * .28, e.h * .34, c);
        ell(cx + f * e.w * .24, cy - 10, 13, 12, c);
        ctx.fillStyle = '#E0A526'; ctx.beginPath(); ctx.moveTo(cx + f * (e.w * .24 + 10), cy - 12); ctx.lineTo(cx + f * (e.w * .24 + 24), cy - 6); ctx.lineTo(cx + f * (e.w * .24 + 9), cy - 3); ctx.fill();
        ell(cx + f * (e.w * .24 + 3), cy - 13, 3.5, 3.5, e.state === 'tired' ? '#9A8FBF' : '#FFE066');
        ctx.fillStyle = '#3E4C73'; for (const d of [-1, 1]) ctx.fillRect(cx + d * 8 - 2, e.y + e.h - 10, 4, 10);
      },
      'Π+': (e, cx, cy, hurt) => {
        // The Rat King: a fat grey-brown rat in a crown, a long tail, red eyes.
        const f = e.face || 1, c = hurt ? '#FFFFFF' : '#6B5A4C';
        ctx.strokeStyle = '#C9A28A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - f * e.w * .4, cy + 12); ctx.quadraticCurveTo(cx - f * e.w * .8, cy + 30, cx - f * e.w * .7, cy - 10); ctx.stroke();
        ell(cx, cy + 6, e.w * .42, e.h * .4, c);
        ell(cx + f * e.w * .3, cy - 8, 16, 13, c); ell(cx + f * (e.w * .3 + 15), cy - 6, 4, 4, '#E5949A');
        for (const d of [-8, 8]) ell(cx + f * e.w * .3 + d, cy - 22, 7, 8, '#C9A28A');
        ctx.fillStyle = '#E0A526'; ctx.beginPath(); ctx.moveTo(cx + f * e.w * .3 - 12, cy - 22); for (let k = 0; k <= 4; k++) ctx.lineTo(cx + f * e.w * .3 - 12 + k * 6, cy - (k % 2 ? 26 : 34)); ctx.lineTo(cx + f * e.w * .3 + 12, cy - 22); ctx.fill();
        ell(cx + f * (e.w * .3 + 5), cy - 10, 3, 3, e.state === 'throne' ? '#9A8FBF' : '#FF4D3D');
      },
      'Φ+': (e, cx, cy, hurt) => {
        // The Pumpkin Knight: a jack-o'-lantern head, carved face glowing, on dark armour.
        const f = e.face || 1, glow = e.state === 'dizzy' ? '#9A8FBF' : '#FFE066';
        ctx.fillStyle = hurt ? '#FFFFFF' : '#2E2A40'; ctx.fillRect(cx - e.w * .35, e.y + 34, e.w * .7, e.h - 34);
        ctx.fillStyle = '#4C4062'; ctx.fillRect(cx - e.w * .35, e.y + e.h - 12, e.w * .7, 4);
        ell(cx, e.y + 20, e.w * .42, 20, hurt ? '#FFFFFF' : '#E87A1E');
        ctx.strokeStyle = '#B4570F'; ctx.lineWidth = 2; for (const d of [-.2, .2]) { ctx.beginPath(); ctx.ellipse(cx + d * e.w, e.y + 20, 6, 19, 0, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = '#4E7A2E'; ctx.fillRect(cx - 3, e.y - 4, 6, 8);
        ctx.fillStyle = glow; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * 10 + f * 3, e.y + 12); ctx.lineTo(cx + d * 4 + f * 3, e.y + 20); ctx.lineTo(cx + d * 16 + f * 3, e.y + 20); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(cx - 12 + f * 3, e.y + 26); for (let k = 0; k <= 6; k++) ctx.lineTo(cx - 12 + k * 4 + f * 3, e.y + 26 + (k % 2 ? 6 : 0)); ctx.lineTo(cx + 12 + f * 3, e.y + 30); ctx.lineTo(cx - 12 + f * 3, e.y + 30); ctx.fill();
      },
      'Ψ+': (e, cx, cy, hurt) => {
        // The Smog Dragon: a soot-black dragon trailing smoke, wings spread, embers for eyes.
        const f = e.face || 1, c = hurt ? '#FFFFFF' : '#2E2A40', flap = reduced || e.state === 'tired' ? .1 : Math.sin(clock * 6);
        ctx.fillStyle = 'rgba(90,80,110,.45)'; for (let k = 0; k < 5; k++) { const a = clock * 1.5 + k; ell(cx - f * (e.w * .4 + k * 8), cy + Math.sin(a) * 6, 8 + k, 7 + k, ctx.fillStyle); }
        for (const d of [-1, 1]) { ctx.fillStyle = hurt ? '#FFFFFF' : '#463C6B'; ctx.beginPath(); ctx.moveTo(cx + d * 6, cy - 6); ctx.lineTo(cx + d * e.w * .5, cy - 22 - flap * 18); ctx.lineTo(cx + d * e.w * .3, cy + 4); ctx.fill(); }
        ell(cx, cy + 6, e.w * .3, e.h * .3, c);
        ctx.strokeStyle = c; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(cx + f * 10, cy); ctx.quadraticCurveTo(cx + f * e.w * .3, cy - 18, cx + f * e.w * .4, cy - 6); ctx.stroke();
        ell(cx + f * e.w * .42, cy - 4, 15, 10, c);
        ell(cx + f * (e.w * .42 + 2), cy - 8, 3, 3, e.state === 'tired' ? '#9A8FBF' : '#FF6B3D');
        if (e.state === 'breath') ell(cx + f * (e.w * .42 + 14), cy, 6, 4, '#FFB547');
      },
      'Σ+': (e, cx, cy, hurt) => {
        // The Crystal Mole: a plump mole with glowing crystals growing from its back.
        const f = e.face || 1, c = hurt ? '#FFFFFF' : '#5A4A6A';
        for (let k = -2; k <= 2; k++) { ctx.fillStyle = k % 2 ? '#9FD8FF' : '#7FB0E0'; ctx.beginPath(); ctx.moveTo(cx + k * 12 - 6, cy - 4); ctx.lineTo(cx + k * 12, e.y - 12 + Math.abs(k) * 6); ctx.lineTo(cx + k * 12 + 6, cy - 4); ctx.fill(); }
        ell(cx, cy + 4, e.w * .46, e.h * .42, c);
        ell(cx + f * e.w * .38, cy + 2, 8, 6, '#E5949A');
        for (const d of [-1, 1]) { ctx.fillStyle = '#E2CFA4'; ctx.fillRect(cx + d * e.w * .3 - 6, e.y + e.h - 6, 12, 6); }
        ell(cx + f * e.w * .24, cy - 4, 3, 2, e.state === 'stunned' ? '#9A8FBF' : '#211C3F');
      },
    };

    // Giant bosses. Creature giants are their small cousin's drawing, scaled up; the rest are
    // drawn here. Dazed giants get stars over their heads.
    function drawGiant(e) {
      if (!e.alive) return;
      const s = LF.ENEMIES[e.type], cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (s.giant) {
        const proxy = { ...e, type: s.giant };
        if (e.phased && s.giant !== 'G') ctx.globalAlpha = .3;
        if (e.state === 'flip') {
          ctx.save(); ctx.translate(0, cy); ctx.scale(1, -1); ctx.translate(0, -cy); scaled(proxy, drawEnemy); ctx.restore();
        } else scaled(proxy, drawEnemy);
        ctx.globalAlpha = 1;
        if (e.hurt > 0) { ctx.fillStyle = 'rgba(255,241,207,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy, e.w * .45, e.h * .45, 0, 0, TAU); ctx.fill(); }
      } else if (e.type === 'E+' || e.type === 'e+') {
        // A pendulum: the chain (thorny for the Thorn Pendulum), then a huge spiked ball.
        const bx = e.bx ?? cx, by = e.by ?? cy, ax = e.ax ?? cx, ay = e.ay ?? e.y - 100;
        ctx.fillStyle = '#2A2348'; ctx.fillRect(ax - 9, ay - 4, 18, 8);
        if (e.type === 'e+') {
          const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
          ctx.strokeStyle = '#7A2E1C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          ctx.fillStyle = '#CFC6E8';
          for (let k = 1; k < 20; k++) {
            const f = k / 20, px = ax + dx * f, py = ay + dy * f, side = k % 2 ? 1 : -1;
            ctx.beginPath(); ctx.moveTo(px - ux * 4, py - uy * 4); ctx.lineTo(px - uy * side * 9, py + ux * side * 9); ctx.lineTo(px + ux * 4, py + uy * 4); ctx.fill();
          }
        } else {
          ctx.strokeStyle = '#6E6186'; ctx.lineWidth = 3; ctx.setLineDash([6, 3]);
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.save(); ctx.translate(bx, by); ctx.scale(2.5, 2.5);
        ctx.fillStyle = e.hurt > 0 ? '#FFF1CF' : '#CFC6E8';
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * TAU + (e.phase || 0) * .3;
          ctx.beginPath(); ctx.moveTo(Math.cos(a - .25) * 10, Math.sin(a - .25) * 10); ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); ctx.lineTo(Math.cos(a + .25) * 10, Math.sin(a + .25) * 10); ctx.fill();
        }
        ctx.fillStyle = e.hurt > 0 ? '#CFC6E8' : '#4C4062'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6E6186'; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = e.state === 'rest' ? '#9A8FBF' : '#FF6B3D'; ctx.fillRect(-4, 1, 8, 2.5);
        ctx.restore();
      } else if (e.type === 'f+') {
        // The Fire Wheel's core: an iron block with a furnace eye (its arms are drawn with the fire).
        ctx.fillStyle = e.hurt > 0 ? '#CFC6E8' : '#3A3350'; ctx.fillRect(e.x, e.y, e.w, e.h);
        ctx.fillStyle = '#2A2348'; ctx.fillRect(e.x, e.y, e.w, 5); ctx.fillRect(e.x, e.y + e.h - 5, e.w, 5); ctx.fillRect(e.x, e.y, 5, e.h); ctx.fillRect(e.x + e.w - 5, e.y, 5, e.h);
        ctx.fillStyle = e.armsOn ? '#FF6B3D' : '#7A2E1C'; ctx.beginPath(); ctx.arc(cx, cy, 14 * (e.armsOn ? flick(e.ox, .2) : 1), 0, TAU); ctx.fill();
        ctx.fillStyle = e.armsOn ? '#FFE2A8' : '#463C6B'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
      } else if (e.type === 'k+') {
        // The Great Crusher: a crusher block, three times the size.
        const j = e.state === 'shake' && !reduced ? (Math.random() - .5) * 4 : 0;
        ctx.save(); ctx.translate(e.x + j, e.y); ctx.scale(e.w / 30, e.h / 30);
        ctx.fillStyle = '#CFC6E8';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(1 + k * 7, 27); ctx.lineTo(4.5 + k * 7, 33); ctx.lineTo(8 + k * 7, 27); ctx.fill(); }
        ctx.fillStyle = e.hurt > 0 ? '#CFC6E8' : '#4C4062'; ctx.fillRect(0, 0, 30, 28);
        ctx.fillStyle = '#6E6186'; ctx.fillRect(0, 0, 30, 3); ctx.fillRect(0, 0, 3, 28);
        ctx.fillStyle = '#2A2348'; ctx.fillRect(27, 0, 3, 28);
        ctx.fillStyle = e.state === 'stuck' ? '#9A8FBF' : '#FF6B3D'; ctx.fillRect(6, 9, 7, 3); ctx.fillRect(17, 9, 7, 3);
        ctx.fillStyle = '#211C3F'; ctx.fillRect(9, 19, 12, 3);
        ctx.restore();
      } else if (e.type === 'Ø+') {
        // The Void: a black disc ringed with a slow swirl of violet and ember, wider while it
        // pulls; it fades out and back in when it blinks, and cracks and dims as it collapses.
        const R0 = e.w / 2, pulling = e.state === 'pull', down = e.state === 'collapse';
        ctx.save(); ctx.globalAlpha = 1 - (e.fade || 0) * .9;
        const halo = ctx.createRadialGradient(cx, cy, R0 * .6, cx, cy, R0 * (pulling ? 3.2 : 2));
        halo.addColorStop(0, 'rgba(143,129,171,.45)'); halo.addColorStop(1, 'rgba(143,129,171,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R0 * (pulling ? 3.2 : 2), 0, TAU); ctx.fill();
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = k === 1 ? 'rgba(255,107,61,.7)' : 'rgba(207,198,232,.6)'; ctx.lineWidth = 3 - k * .6;
          ctx.beginPath(); ctx.ellipse(cx, cy, R0 * (1.25 + k * .18), R0 * (.42 + k * .08), clock * (pulling ? 2.4 : .8) * (k % 2 ? -1 : 1) + k, 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = e.hurt > 0 ? '#CFC6E8' : down ? '#2A2348' : '#05040E'; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.fill();
        ctx.strokeStyle = down ? '#8F81AB' : '#463C6B'; ctx.lineWidth = 2; ctx.stroke();
        if (down) {
          ctx.strokeStyle = '#CFC6E8'; ctx.lineWidth = 2;
          for (const a of [.4, 2.2, 4.1]) { ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R0 * .2, cy + Math.sin(a) * R0 * .2); ctx.lineTo(cx + Math.cos(a + .3) * R0 * .6, cy + Math.sin(a + .3) * R0 * .6); ctx.lineTo(cx + Math.cos(a) * R0 * .95, cy + Math.sin(a) * R0 * .95); ctx.stroke(); }
        } else {
          ctx.fillStyle = pulling ? '#FF6B3D' : '#CFC6E8';
          for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + d * R0 * .32, cy - R0 * .1, 5, pulling ? 3 : 6, 0, 0, TAU); ctx.fill(); }
        }
        ctx.restore();
      } else if (KEEPER_ART[e.type]) {
        // A castle keeper (under the floor, the mole is just a moving mound of earth).
        if (e.phased) { ctx.fillStyle = '#5E5173'; ctx.beginPath(); ctx.ellipse(cx, e.y + e.h, e.w * .45, 10, 0, Math.PI, 0); ctx.fill(); }
        else { ctx.save(); KEEPER_ART[e.type](e, cx, cy, e.hurt > 0); ctx.restore(); }
      } else if (e.type === 'Ɱ+') {
        // The Melon Brute: a striped watermelon with angry eyes; it turns as it rolls, and
        // cracks open (red inside) when it hits a wall.
        const rx = e.w / 2, ry = e.h / 2, cracked = e.state === 'cracked';
        ctx.save(); ctx.translate(cx, cy);
        ctx.fillStyle = e.hurt > 0 ? '#E8F5E9' : '#2E7D32'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
        ctx.strokeStyle = '#1B5E20'; ctx.lineWidth = 6;
        const sp = e.spin || 0;
        for (let k = -3; k <= 3; k++) { const x = ((k * 20 + sp * 20) % 140 + 140) % 140 - 70; ctx.beginPath(); ctx.moveTo(x, -ry); ctx.quadraticCurveTo(x + 8, 0, x, ry); ctx.stroke(); }
        ctx.restore();
        if (cracked) {
          ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.moveTo(-rx * .5, -ry); ctx.lineTo(-rx * .15, -ry * .2); ctx.lineTo(-rx * .4, ry * .3); ctx.lineTo(rx * .1, ry * .1); ctx.lineTo(rx * .3, -ry); ctx.fill();
          ctx.fillStyle = '#211C3F'; for (const [x, y] of [[-14, -20], [0, -6], [-8, 8]]) ctx.fillRect(x, y, 3, 5);
        }
        ctx.fillStyle = '#FFF1CF';
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * 14 + e.face * 6, -8, 7, 6, 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#211C3F';
        for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(d * 14 + e.face * 8, -7, 3, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#211C3F'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-22 + e.face * 6, -20); ctx.lineTo(-7 + e.face * 6, -14); ctx.moveTo(22 + e.face * 6, -20); ctx.lineTo(7 + e.face * 6, -14); ctx.stroke();
        ctx.restore();
      } else if (e.type === 'Ω+') {
        // The Last Dark: a towering hooded shape under a candle-snuffer, eyes burning hotter
        // with each phase, wisps of smoke circling it.
        const ph = e.chase ? 3 : e.phase || 1, sway = reduced ? 0 : Math.sin(clock * 2) * 3, body = e.hurt > 0 ? '#CFC6E8' : '#0E0C22';
        // (Grown huge for the chase: drawn k times the size about its middle.)
        ctx.save(); if (e.k > 1) { ctx.translate(cx, cy); ctx.scale(e.k, e.k); ctx.translate(-cx, -cy); }
        ctx.fillStyle = 'rgba(70,60,107,.55)';
        for (let k = 0; k < 6; k++) { const a = clock * (.8 + ph * .3) + k / 6 * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 46, cy + Math.sin(a) * 30, 7 + (k % 2) * 3, 0, TAU); ctx.fill(); }
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.moveTo(cx - 20, e.y + 28); ctx.lineTo(cx + 20, e.y + 28);
        for (let k = 0; k <= 6; k++) ctx.lineTo(cx + 36 - k * 12 + (k % 2 ? -sway : sway), e.y + e.h - (k % 2 ? 12 : 0));
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, e.y + 32, 22, 24, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = e.hurt > 0 ? '#A99CC4' : '#463C6B';
        ctx.beginPath(); ctx.moveTo(cx - 19, e.y + 16); ctx.lineTo(cx + 19, e.y + 16); ctx.lineTo(cx + 2, e.y - 18); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8F81AB'; ctx.fillRect(cx - 20, e.y + 14, 40, 4);
        ctx.fillStyle = ['#FF6B3D', '#FFB547', '#FFE2A8'][ph - 1];
        const blink = e.state === 'floor' ? 1 : 3;
        ctx.fillRect(cx - 10, e.y + 31, 7, blink); ctx.fillRect(cx + 3, e.y + 31, 7, blink);
        ctx.restore();
      } else {
        // A horde's heart: a knot of shadow with a red eye that opens when it lunges.
        const pulse = reduced ? 1 : 1 + Math.sin(clock * 6) * .06, open = e.state === 'lunge';
        ctx.fillStyle = e.hurt > 0 ? '#CFC6E8' : '#07060F';
        for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + clock; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 16 * pulse, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.arc(cx, cy, 24 * pulse, 0, TAU); ctx.fill();
        ctx.fillStyle = open ? '#FF6B3D' : '#7A2E1C'; ctx.beginPath(); ctx.ellipse(cx, cy, 11, open ? 9 : 3, 0, 0, TAU); ctx.fill();
        if (open) { ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, TAU); ctx.fill(); }
      }
      if (e.dazed > 0) {
        ctx.fillStyle = '#FFE2A8';
        for (let k = 0; k < 3; k++) { const a = clock * 5 + k * 2.1; ctx.fillRect(cx + Math.cos(a) * e.w * .35 - 2.5, e.y - 10 + Math.sin(a) * 5 - 2.5, 5, 5); }
      }
    }

    function drawEnemy(e) {
      const cx = e.x + e.w / 2, by = e.y + e.h, f = e.face || -1;
      if (!e.alive) {
        if (e.dead > .6 || e.type === 'G') return;
        ctx.globalAlpha = 1 - e.dead / .6;
        ctx.fillStyle = '#2A2348'; ctx.fillRect(cx - 12, by - 4, 24, 4);
        ctx.globalAlpha = 1; return;
      }
      const wob = reduced ? 0 : Math.sin(clock * 20 + e.ox) * 1.5;
      switch (e.type) {
        case 'B': {
          ctx.strokeStyle = '#120F2A'; ctx.lineWidth = 2; ctx.beginPath();
          for (let k = -1; k <= 1; k++) { ctx.moveTo(cx + k * 7, by - 5); ctx.lineTo(cx + k * 8 + (k % 2 ? wob : -wob), by); }
          ctx.stroke();
          ctx.fillStyle = '#2A2348'; ctx.beginPath(); ctx.ellipse(cx, by - 5, 12, 11, 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(cx - 12, by - 6, 24, 3);
          ctx.fillStyle = '#4D4278'; ctx.beginPath(); ctx.ellipse(cx - f * 3, by - 11, 5, 3, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#120F2A'; ctx.fillRect(cx - .75, by - 16, 1.5, 11);
          break;
        }
        case 'K': {
          ctx.fillStyle = '#120F2A'; ctx.fillRect(cx - 9 + wob, by - 4, 4, 4); ctx.fillRect(cx + 5 - wob, by - 4, 4, 4);
          ctx.fillStyle = '#CFC6E8';
          for (let k = -2; k <= 2; k++) {
            const sx = cx + k * 5;
            ctx.beginPath(); ctx.moveTo(sx - 4, by - 10); ctx.lineTo(sx + k, by - 22 + Math.abs(k) * 2); ctx.lineTo(sx + 4, by - 10); ctx.fill();
          }
          ctx.fillStyle = '#3B2F57'; ctx.beginPath(); ctx.ellipse(cx, by - 4, 13, 11, 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(cx - 13, by - 5, 26, 3);
          ctx.fillStyle = '#5A4C7C'; ctx.fillRect(cx + f * 9 - 3, by - 9, 6, 5);
          break;
        }
        case 'F': {
          const flap = reduced ? 0 : Math.sin(clock * 16 + e.ox) * 6;
          const cy = e.y + 7;
          ctx.fillStyle = '#2A2348';
          ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx - 15, cy - 4 + flap); ctx.lineTo(cx - 9, cy + 5); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 15, cy - 4 + flap); ctx.lineTo(cx + 9, cy + 5); ctx.fill();
          ctx.fillStyle = '#3D3458'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx - 5, cy - 3); ctx.lineTo(cx - 4, cy - 9); ctx.lineTo(cx - 1, cy - 5);
          ctx.moveTo(cx + 5, cy - 3); ctx.lineTo(cx + 4, cy - 9); ctx.lineTo(cx + 1, cy - 5); ctx.fill();
          break;
        }
        case 'J': {
          const air = !e.ground;
          const sy = air ? 1.15 : 1, sx = air ? .9 : 1;
          ctx.save(); ctx.translate(cx, by); ctx.scale(sx, sy);
          ctx.fillStyle = '#2F5260'; ctx.beginPath(); ctx.ellipse(0, -7, 11, 8, 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(-11, -8, 22, 6);
          ctx.fillStyle = '#6F9AA8'; ctx.fillRect(-7, -4, 14, 3);
          ctx.fillStyle = '#244250'; ctx.fillRect(-12, -3, 6, 3); ctx.fillRect(6, -3, 6, 3);
          ctx.fillStyle = '#D9D0F0'; ctx.beginPath(); ctx.arc(f * 4 - 3, -15, 3.5, 0, TAU); ctx.arc(f * 4 + 4, -15, 3.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#120F2A'; ctx.fillRect(f * 4 - 3 + f, -16, 2, 2); ctx.fillRect(f * 4 + 4 + f, -16, 2, 2);
          ctx.restore();
          break;
        }
        case 'X': {
          const cy = e.y + 8;
          ctx.strokeStyle = 'rgba(217,208,240,.45)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx, e.oy - 2); ctx.lineTo(cx, cy - 4); ctx.stroke();
          ctx.strokeStyle = '#120F2A'; ctx.lineWidth = 1.6; ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const leg = (k - 1.5) * 3, bend = reduced ? 0 : Math.sin(clock * 12 + k) * 1.2;
            ctx.moveTo(cx - 3, cy + leg * .5); ctx.lineTo(cx - 8, cy + leg - 3 + bend); ctx.lineTo(cx - 10, cy + leg + 3);
            ctx.moveTo(cx + 3, cy + leg * .5); ctx.lineTo(cx + 8, cy + leg - 3 - bend); ctx.lineTo(cx + 10, cy + leg + 3);
          }
          ctx.stroke();
          ctx.fillStyle = '#4A3B2A'; ctx.beginPath(); ctx.ellipse(cx, cy + 1, 6, 7, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#6B5640'; ctx.beginPath(); ctx.arc(cx, cy - 5, 4, 0, TAU); ctx.fill();
          break;
        }
        case 'R': {
          const shake = e.state === 'wind' && !reduced ? (Math.random() - .5) * 2 : 0;
          const run = e.state === 'charge' ? Math.sin(clock * 40) * 2 : wob;
          ctx.fillStyle = '#120F2A'; ctx.fillRect(cx - 10 + run + shake, by - 5, 5, 5); ctx.fillRect(cx + 5 - run + shake, by - 5, 5, 5);
          ctx.fillStyle = '#3A2A20'; ctx.beginPath(); ctx.ellipse(cx + shake, by - 10, 13, 9, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5A2C14'; ctx.fillRect(cx - 9 + shake, by - 16, 18, 4);
          ctx.fillStyle = '#FF6B3D';
          for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * 5 - 1 + shake, by - 14, 2, 2);
          ctx.fillStyle = '#CFC6E8';
          ctx.beginPath(); ctx.moveTo(cx + f * 10 + shake, by - 15); ctx.lineTo(cx + f * 18 + shake, by - 19); ctx.lineTo(cx + f * 13 + shake, by - 11); ctx.fill();
          break;
        }
        case 'W': {
          const cy = e.y + 8, buzz = reduced ? 0 : Math.sin(clock * 60) * 3;
          ctx.fillStyle = 'rgba(217,208,240,.45)';
          ctx.beginPath(); ctx.ellipse(cx - f * 2, cy - 7, 6, 3 + buzz * .4, -.4 * f, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx + f * 3, cy - 6, 5, 2.5 - buzz * .3, .3 * f, 0, TAU); ctx.fill();
          ctx.fillStyle = '#E0A526'; ctx.beginPath(); ctx.ellipse(cx - f * 4, cy + 1, 7, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#211C3F'; ctx.fillRect(cx - f * 4 - 1.5, cy - 4, 3, 10); ctx.fillRect(cx - f * 8 - 1, cy - 3, 2, 8);
          ctx.beginPath(); ctx.moveTo(cx - f * 10, cy); ctx.lineTo(cx - f * 15, cy + 2); ctx.lineTo(cx - f * 10, cy + 3); ctx.fill();
          ctx.fillStyle = '#2A2348'; ctx.beginPath(); ctx.arc(cx + f * 5, cy, 4.5, 0, TAU); ctx.fill();
          break;
        }
        case 'A': {
          ctx.fillStyle = '#211C3F'; ctx.fillRect(cx - 6, by - 7, 4, 7); ctx.fillRect(cx + 2, by - 7, 4, 7);
          ctx.fillStyle = '#5E4B3C';
          ctx.beginPath(); ctx.moveTo(cx - 9, by - 6); ctx.lineTo(cx + 9, by - 6); ctx.lineTo(cx + 6, by - 20); ctx.lineTo(cx - 6, by - 20); ctx.fill();
          ctx.fillStyle = '#3A2E26'; ctx.beginPath(); ctx.moveTo(cx - 7, by - 19); ctx.lineTo(cx + 7, by - 19); ctx.lineTo(cx, by - 30); ctx.fill();
          ctx.save(); ctx.translate(cx + f * 6, by - 15); ctx.scale(f, 1);
          ctx.strokeStyle = '#8A6A45'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(0, 0, 8, -1.2, 1.2); ctx.stroke();
          ctx.strokeStyle = 'rgba(217,208,240,.6)'; ctx.lineWidth = .8;
          ctx.beginPath(); ctx.moveTo(8 * Math.cos(1.2), -8 * Math.sin(1.2)); ctx.lineTo(8 * Math.cos(1.2), 8 * Math.sin(1.2)); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'I': {
          const step = reduced ? 0 : Math.sin(clock * 5 + e.ox) * 2;
          const body = e.hurt > 0 ? '#CFC6E8' : '#4A4560', dark = e.hurt > 0 ? '#A99CC4' : '#2E2A40';
          ctx.fillStyle = dark; ctx.fillRect(cx - 11, by - 9 + Math.max(0, step), 8, 9); ctx.fillRect(cx + 3, by - 9 + Math.max(0, -step), 8, 9);
          ctx.fillStyle = body; ctx.fillRect(cx - 14, by - 30, 28, 22);
          ctx.fillStyle = dark; ctx.fillRect(cx - 14, by - 30, 28, 3); ctx.fillRect(cx - 18, by - 27, 5, 14); ctx.fillRect(cx + 13, by - 27, 5, 14);
          ctx.fillStyle = body; ctx.fillRect(cx - 8, by - 36, 16, 8);
          ctx.fillStyle = '#6E6186';
          for (let k = 0; k < 3; k++) ctx.fillRect(cx - 10 + k * 8, by - 22, 4, 4);
          for (let k = 0; k < e.hp; k++) { ctx.fillStyle = '#FF6B3D'; ctx.fillRect(cx - 7 + k * 5, by - 14, 3, 3); }
          break;
        }
        case '@': {
          // TNT cart: a mine cart full of red sticks, a lit fuse, and a pip per hit left.
          const roll = reduced ? 0 : e.x / 6, hurt = e.hurt > 0;
          ctx.fillStyle = '#C0392B';
          for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * 7 - 2.5, by - 22, 5, 10);
          ctx.fillStyle = '#FFE2A8'; ctx.fillRect(cx - 9.5, by - 20, 19, 2);
          ctx.fillStyle = hurt ? '#CFC6E8' : '#5C3B24'; ctx.fillRect(cx - 14, by - 15, 28, 10);
          ctx.fillStyle = hurt ? '#A99CC4' : '#3A2516'; ctx.fillRect(cx - 14, by - 15, 28, 2); ctx.fillRect(cx - 14, by - 7, 28, 2);
          ctx.fillStyle = '#FFE2A8'; ctx.font = '700 6px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('TNT', cx, by - 8.5); ctx.textAlign = 'left';
          for (const wx of [-8, 8]) {
            ctx.fillStyle = '#1A1530'; ctx.beginPath(); ctx.arc(cx + wx, by - 3, 3.5, 0, TAU); ctx.fill();
            ctx.strokeStyle = '#6E6186'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + wx, by - 3); ctx.lineTo(cx + wx + Math.cos(roll) * 3, by - 3 + Math.sin(roll) * 3); ctx.stroke();
          }
          ctx.strokeStyle = '#2A2348'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, by - 22); ctx.quadraticCurveTo(cx + 3, by - 27, cx + 1, by - 29); ctx.stroke();
          ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(cx + 1, by - 29.5, 2 * flick(e.ox, .4), 0, TAU); ctx.fill();
          for (let k = 0; k < e.hp; k++) { ctx.fillStyle = '#FF6B3D'; ctx.fillRect(cx - 11 + k * 5, by - 33, 3, 2); }
          break;
        }
        // ---- bosses (they flash pale when hit) ----
        case '5': {
          // The Bellwether: a huge woolly ram with curled horns and a bell at its throat.
          const hurt = e.hurt > 0, stun = e.state === 'stun', dip = e.state === 'wind' ? 4 : 0;
          const leg = reduced || stun ? 0 : Math.sin(clock * (e.state === 'charge' ? 28 : 9) + e.ox) * 3;
          ctx.fillStyle = '#1A1530';
          for (const [lx, s] of [[-18, 1], [-8, -1], [6, 1], [16, -1]]) ctx.fillRect(cx + f * lx - 3, by - 13 + Math.max(0, leg * s), 6, 13 - Math.max(0, leg * s));
          ctx.fillStyle = hurt ? '#CFC6E8' : '#55497F';
          ctx.beginPath(); ctx.ellipse(cx - f * 4, by - 24, 25, 15, 0, 0, TAU); ctx.fill();
          for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(cx - f * 4 + k * 9, by - 36 + Math.abs(k) * 2, 7, 0, TAU); ctx.fill(); }
          ctx.fillStyle = hurt ? '#A99CC4' : '#372C5E';
          ctx.beginPath(); ctx.ellipse(cx + f * 21, by - 24 + dip, 10, 9, f * .3, 0, TAU); ctx.fill();
          ctx.strokeStyle = hurt ? '#FFF1CF' : '#CFC6E8'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(cx + f * 15, by - 31 + dip, 7, f > 0 ? Math.PI * .9 : -Math.PI * .1, f > 0 ? Math.PI * 2.5 : Math.PI * 1.5); ctx.stroke();
          ctx.fillStyle = stun ? '#9A8FBF' : e.state === 'charge' || e.state === 'wind' ? '#FFE2A8' : '#FF6B3D';
          ctx.fillRect(cx + f * 25 - 1.5, by - 28 + dip, 3, 3);
          const bx = cx + f * 14, swing = reduced ? 0 : Math.sin(clock * 8) * 2;
          ctx.fillStyle = '#FFB547';
          ctx.beginPath(); ctx.moveTo(bx - 3 + swing, by - 19); ctx.lineTo(bx + 3 + swing, by - 19); ctx.lineTo(bx + 6 + swing, by - 10); ctx.lineTo(bx - 6 + swing, by - 10); ctx.fill();
          ctx.fillStyle = '#7A2E1C'; ctx.beginPath(); ctx.arc(bx + swing, by - 9, 2, 0, TAU); ctx.fill();
          if (stun) {
            ctx.fillStyle = '#FFE2A8';
            for (let k = 0; k < 3; k++) { const a = clock * 5 + k * 2.1; ctx.fillRect(cx + f * 16 + Math.cos(a) * 13 - 2, by - 46 + Math.sin(a) * 4 - 2, 4, 4); }
          }
          break;
        }
        case '6': {
          // The Soot Queen: a giant crowned bat.
          const hurt = e.hurt > 0, cy = e.y + e.h / 2, flap = reduced ? 0 : Math.sin(clock * (e.state === 'rest' ? 3 : 14) + e.ox) * 10;
          ctx.fillStyle = hurt ? '#A99CC4' : '#1F1A3A';
          for (const s of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(cx + s * 8, cy - 4); ctx.lineTo(cx + s * 34, cy - 12 - flap); ctx.lineTo(cx + s * 29, cy + 2 - flap * .4);
            ctx.lineTo(cx + s * 22, cy - 1); ctx.lineTo(cx + s * 17, cy + 7); ctx.lineTo(cx + s * 9, cy + 6); ctx.fill();
          }
          ctx.fillStyle = hurt ? '#CFC6E8' : '#2A2348';
          ctx.beginPath(); ctx.ellipse(cx, cy + 1, 12, 15, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx - 9, cy - 9); ctx.lineTo(cx - 6, cy - 20); ctx.lineTo(cx - 2, cy - 11); ctx.moveTo(cx + 9, cy - 9); ctx.lineTo(cx + 6, cy - 20); ctx.lineTo(cx + 2, cy - 11); ctx.fill();
          ctx.fillStyle = '#FFB547';
          ctx.beginPath(); ctx.moveTo(cx - 6, cy - 12); for (let k = 0; k <= 4; k++) ctx.lineTo(cx - 6 + k * 3, cy - (k % 2 ? 14 : 19)); ctx.lineTo(cx + 6, cy - 12); ctx.fill();
          ctx.fillStyle = e.state === 'aim' ? '#FFE2A8' : '#FF6B3D';
          ctx.fillRect(cx - 5, cy - 5, 3, 3); ctx.fillRect(cx + 2, cy - 5, 3, 3);
          ctx.fillStyle = '#CFC6E8'; ctx.fillRect(cx - 3, cy + 2, 1.5, 3); ctx.fillRect(cx + 1.5, cy + 2, 1.5, 3);
          break;
        }
        case '7': {
          // The Ash Marksman: a tall hooded archer with a longbow. Faded out, he's a ghost.
          if (e.phased) ctx.globalAlpha = .18;
          const hurt = e.hurt > 0, step = reduced || !e.ground ? 0 : Math.sin(clock * 6 + e.ox) * 2;
          ctx.fillStyle = '#1A1530'; ctx.fillRect(cx - 8, by - 12 + Math.max(0, step), 6, 12); ctx.fillRect(cx + 2, by - 12 + Math.max(0, -step), 6, 12);
          ctx.fillStyle = '#7A2E1C'; ctx.fillRect(cx - f * 12 - 3, by - 44, 6, 18);
          ctx.fillStyle = '#FFE2A8'; for (let k = 0; k < 3; k++) ctx.fillRect(cx - f * 12 - 3 + k * 2, by - 48, 1.5, 4);
          ctx.fillStyle = hurt ? '#CFC6E8' : '#5E4B3C';
          ctx.beginPath(); ctx.moveTo(cx - 14, by - 10); ctx.lineTo(cx + 14, by - 10); ctx.lineTo(cx + 9, by - 40); ctx.lineTo(cx - 9, by - 40); ctx.fill();
          ctx.fillStyle = hurt ? '#A99CC4' : '#3E3128'; ctx.beginPath(); ctx.ellipse(cx, by - 42, 10, 10, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#120F2A'; ctx.beginPath(); ctx.ellipse(cx + f * 3, by - 41, 6, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = e.wait < .4 && e.state !== 'leap' ? '#FFE2A8' : '#FF6B3D'; ctx.fillRect(cx + f * 5 - 1.5, by - 43, 3, 2);
          ctx.save(); ctx.translate(cx, by - 28); ctx.scale(f, 1);
          ctx.strokeStyle = '#C08A5C'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(6, 0, 16, -1.15, 1.15); ctx.stroke();
          ctx.strokeStyle = 'rgba(217,208,240,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6 + 16 * Math.cos(1.15), -16 * Math.sin(1.15)); ctx.lineTo(6 + 16 * Math.cos(1.15), 16 * Math.sin(1.15)); ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case '8': {
          // The Iron Colossus: a golem twice the size, glowing at the core.
          const hurt = e.hurt > 0, crouch = e.state === 'crouch' ? 6 : 0, step = reduced || !e.ground ? 0 : Math.sin(clock * 4 + e.ox) * 3;
          const body = hurt ? '#CFC6E8' : '#4A4560', dark = hurt ? '#A99CC4' : '#2E2A40';
          ctx.fillStyle = dark; ctx.fillRect(cx - 24, by - 22 + Math.max(0, step), 16, 22 - Math.max(0, step)); ctx.fillRect(cx + 8, by - 22 + Math.max(0, -step), 16, 22 - Math.max(0, -step));
          ctx.fillStyle = body; ctx.fillRect(cx - 30, by - 64 + crouch, 60, 44);
          ctx.fillStyle = dark; ctx.fillRect(cx - 30, by - 64 + crouch, 60, 6);
          ctx.fillRect(cx - 40, by - 60 + crouch, 10, 30); ctx.fillRect(cx + 30, by - 60 + crouch, 10, 30);
          ctx.fillRect(cx - 43, by - 32 + crouch, 15, 13); ctx.fillRect(cx + 28, by - 32 + crouch, 15, 13);
          ctx.fillStyle = body; ctx.fillRect(cx - 14, by - 76 + crouch, 28, 14);
          ctx.fillStyle = '#FF6B3D'; ctx.fillRect(cx + f * 4 - 8, by - 71 + crouch, 16, 4);
          ctx.fillStyle = '#6E6186'; for (let k = 0; k < 4; k++) ctx.fillRect(cx - 22 + k * 13, by - 30 + crouch, 5, 5);
          ctx.globalAlpha = .9; ctx.fillStyle = '#FF6B3D'; ctx.beginPath(); ctx.arc(cx, by - 46 + crouch, 6 * flick(e.ox, .25), 0, TAU); ctx.fill();
          ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(cx, by - 46 + crouch, 2.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
          if (e.armored) {
            // Armored: a pale shell of light until its golems are broken.
            ctx.strokeStyle = `rgba(207,198,232,${reduced ? .6 : .45 + Math.sin(clock * 6) * .2})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(cx, by - 40, 46, 44, 0, 0, TAU); ctx.stroke();
          }
          break;
        }
        case '9': {
          // The Powder King: a stout crowned miner in a dynamite bandolier, bomb in hand.
          const hurt = e.hurt > 0, step = reduced ? 0 : Math.sin(clock * 6 + e.ox) * 2;
          ctx.fillStyle = '#1A1530'; ctx.fillRect(cx - 12, by - 12 + Math.max(0, step), 8, 12); ctx.fillRect(cx + 4, by - 12 + Math.max(0, -step), 8, 12);
          ctx.fillStyle = hurt ? '#CFC6E8' : '#7A2E1C'; ctx.beginPath(); ctx.ellipse(cx, by - 26, 21, 18, 0, 0, TAU); ctx.fill();
          ctx.save(); ctx.translate(cx, by - 27); ctx.rotate(f * -.5);
          ctx.fillStyle = '#3A2516'; ctx.fillRect(-22, -3, 44, 6);
          ctx.fillStyle = '#C0392B'; for (let k = -2; k <= 2; k++) ctx.fillRect(k * 8 - 2, -6, 4, 12);
          ctx.restore();
          ctx.fillStyle = hurt ? '#A99CC4' : '#5C3B24'; ctx.beginPath(); ctx.arc(cx + f * 2, by - 46, 10, 0, TAU); ctx.fill();
          ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.moveTo(cx - 9, by - 52); for (let k = 0; k <= 4; k++) ctx.lineTo(cx - 9 + k * 4.5, by - (k % 2 ? 56 : 62)); ctx.lineTo(cx + 9, by - 52); ctx.fill();
          ctx.fillStyle = '#FFE2A8'; ctx.fillRect(cx + f * 6 - 1.5, by - 48, 3, 3);
          const hx = cx + f * 22, hy = by - 30;
          ctx.fillStyle = '#1A1530'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.fill();
          ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(hx + f * 3, hy - 7, 2 * flick(e.ox, .5), 0, TAU); ctx.fill();
          break;
        }
        case 'Y': {
          const cy = e.y + 6, tail = reduced ? 0 : Math.sin(clock * 10 + e.ox) * 3;
          ctx.fillStyle = '#244250';
          ctx.beginPath(); ctx.moveTo(cx - f * 12, cy); ctx.lineTo(cx - f * 19, cy - 6 + tail); ctx.lineTo(cx - f * 19, cy + 6 + tail); ctx.fill();
          ctx.fillStyle = '#2F5260'; ctx.beginPath(); ctx.ellipse(cx, cy, 14, 6, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#6F9AA8'; ctx.fillRect(cx - 8, cy + 1, 16, 2);
          ctx.fillStyle = '#CFC6E8';
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(cx + f * (9 + k * 1.5), cy + 2); ctx.lineTo(cx + f * (10 + k * 1.5), cy + 4); ctx.lineTo(cx + f * (11 + k * 1.5), cy + 2); ctx.fill(); }
          ctx.strokeStyle = '#2F5260'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(cx + f * 6, cy - 5); ctx.quadraticCurveTo(cx + f * 14, cy - 16, cx + f * 18, cy - 10); ctx.stroke();
          break;
        }
        case 'N': {
          const cy = e.y + 6, ang = e.state === 'leap' ? Math.atan2(e.vy, Math.abs(e.vx) + 60) * .8 : 0;
          ctx.save(); ctx.translate(cx, cy); ctx.scale(f, 1); ctx.rotate(ang);
          ctx.fillStyle = '#7C8C9E';
          ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-17, -6); ctx.lineTo(-17, 6); ctx.fill();
          ctx.fillStyle = '#A9B8C8'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#D9E2EC'; ctx.fillRect(-7, 1, 14, 2);
          ctx.fillStyle = '#7C8C9E'; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(2, -10); ctx.lineTo(4, -4); ctx.fill();
          ctx.fillStyle = '#A9B8C8'; ctx.fillRect(10, -1, 7, 2);
          ctx.restore();
          break;
        }
        case 'S': {
          ctx.fillStyle = '#7A3E1C';
          ctx.beginPath(); ctx.moveTo(cx - 11, by); ctx.lineTo(cx + 11, by); ctx.lineTo(cx + 9, by - 16); ctx.lineTo(cx - 9, by - 16); ctx.fill();
          ctx.fillStyle = '#A8621E'; ctx.fillRect(cx - 12, by - 20, 24, 5);
          ctx.fillStyle = '#5A2C14'; ctx.fillRect(cx - 9, by - 10, 18, 2);
          break;
        }
      }
    }

    function drawFruit(f) {
      const bob = reduced ? 0 : Math.sin(clock * 3 + f.tx * 1.7) * 2.5;
      const regrow = f.taken ? Math.max(0, 1 - f.regrow / 12) : 1;
      const s = f.taken ? .35 + regrow * .25 : 1 + f.pop * .3;
      ctx.save(); ctx.translate(f.x, f.y + bob); ctx.scale(s, s);
      ctx.globalAlpha = f.taken ? .3 : 1;
      if (!f.taken) {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
        g.addColorStop(0, 'rgba(255,240,200,.28)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = g; ctx.fillRect(-16, -16, 32, 32);
      }
      if (f.type === 'a') {
        ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.arc(-2.5, 1, 5.5, 0, TAU); ctx.arc(2.5, 1, 5.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FF8A8D'; ctx.fillRect(-5, -2, 2.5, 2.5);
        ctx.strokeStyle = '#6B452C'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(1, -8); ctx.stroke();
        ctx.fillStyle = '#5FBF5A'; ctx.beginPath(); ctx.ellipse(4, -7, 3.5, 1.8, -.5, 0, TAU); ctx.fill();
      } else if (f.type === 'o') {
        ctx.fillStyle = '#FF9A2E'; ctx.beginPath(); ctx.arc(0, 1, 6.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFC47A'; ctx.fillRect(-4, -3, 2.5, 2.5);
        ctx.fillStyle = '#C96A12'; ctx.fillRect(2, 3, 1.2, 1.2); ctx.fillRect(-1, 5, 1.2, 1.2); ctx.fillRect(3, -1, 1.2, 1.2);
        ctx.fillStyle = '#5FBF5A'; ctx.beginPath(); ctx.ellipse(2.5, -6, 3.5, 1.8, -.4, 0, TAU); ctx.fill();
      } else if (f.type === 'm') {
        // A watermelon slice: green rind, red flesh, black seeds.
        ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.arc(0, -2, 8.5, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#A5D6A7'; ctx.beginPath(); ctx.arc(0, -2, 7, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.arc(0, -2, 6, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#211C3F'; ctx.fillRect(-3, 0, 1.4, 2); ctx.fillRect(0, 1.5, 1.4, 2); ctx.fillRect(3, 0, 1.4, 2);
      } else if (f.type === 's') {
        // A strawberry: a red heart point down, pale seeds, a green crown.
        ctx.fillStyle = '#F0506E'; ctx.beginPath(); ctx.moveTo(-6.5, -2); ctx.quadraticCurveTo(-6, 7, 0, 8); ctx.quadraticCurveTo(6, 7, 6.5, -2); ctx.quadraticCurveTo(0, -5, -6.5, -2); ctx.fill();
        ctx.fillStyle = '#FFE2A8'; for (const [sx, sy] of [[-3, 0], [1, 1], [3.5, -1], [-1, 4], [2, 5]]) ctx.fillRect(sx, sy, 1.2, 1.2);
        ctx.fillStyle = '#5FBF5A'; ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(0, -7); ctx.lineTo(5, -3); ctx.lineTo(0, -4); ctx.fill();
      } else if (f.type === 'ç') {
        // Two cherries on a forked stalk.
        ctx.strokeStyle = '#4E7A2E'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.quadraticCurveTo(-2, -6, 2, -9); ctx.moveTo(4, 3); ctx.quadraticCurveTo(3, -4, 2, -9); ctx.stroke();
        ctx.fillStyle = '#B3123A'; ctx.beginPath(); ctx.arc(-4, 4, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(4, 5, 4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FF6B8A'; ctx.fillRect(-6, 2, 1.6, 1.6); ctx.fillRect(2, 3, 1.6, 1.6);
      } else if (f.type === 'ƀ') {
        // A little cluster of blueberries.
        ctx.fillStyle = '#5B6EE1'; for (const [bx, by] of [[-3.5, 3], [3.5, 3], [0, -2.5]]) { ctx.beginPath(); ctx.arc(bx, by, 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#A9B8FF'; ctx.fillRect(-5, 1, 1.5, 1.5); ctx.fillRect(2, 1, 1.5, 1.5); ctx.fillRect(-1.5, -4.5, 1.5, 1.5);
        ctx.fillStyle = '#2A2F6B'; ctx.fillRect(-.6, -6, 1.2, 1.2);
      } else {
        ctx.strokeStyle = '#FFE066'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(1, -7, 10, Math.PI * .6, Math.PI * 1.15); ctx.stroke();
        ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(1, -7, 11.5, Math.PI * .65, Math.PI * 1.1); ctx.stroke();
        ctx.fillStyle = '#6B452C'; ctx.fillRect(-7.5, -11, 2.5, 3); ctx.fillRect(-3, 3, 2, 2);
        ctx.lineCap = 'butt';
      }
      ctx.restore();
    }

    function drawAmmo(a) {
      if (a.taken) return;
      const bob = reduced ? 0 : Math.sin(clock * 3 + a.tx) * 2;
      const s = a.huge ? 1.75 : a.big ? 1.35 : 1;
      ctx.save(); ctx.translate(a.x, a.y + bob); ctx.scale(s, s);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, 'rgba(255,226,168,.3)'); g.addColorStop(1, 'rgba(255,226,168,0)');
      ctx.fillStyle = g; ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = a.huge ? '#6B4A2A' : '#5A4C7C'; ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = a.huge ? '#FFB547' : '#8F81AB'; ctx.fillRect(-7, -5, 14, 2);
      ctx.fillStyle = a.big ? '#FF6B3D' : '#FFB547';
      for (let k = -1; k <= 1; k++) { ctx.fillRect(k * 4 - 1, -9, 2, 5); ctx.fillStyle = '#FFE2A8'; ctx.fillRect(k * 4 - 1, -10, 2, 1.5); ctx.fillStyle = a.big ? '#FF6B3D' : '#FFB547'; }
      if (a.big) { ctx.fillStyle = '#FFE2A8'; ctx.font = '700 7px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(String(a.n), 0, 3.5); ctx.textAlign = 'left'; }
      ctx.restore();
    }

    function drawKey(k) {
      if (k.taken) return;
      const spec = LF.KEYS[k.c], bob = reduced ? 0 : Math.sin(clock * 3 + k.tx) * 3;
      ctx.save(); ctx.translate(k.x, k.y + bob); ctx.rotate(reduced ? 0 : Math.sin(clock * 2 + k.tx) * .15);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
      g.addColorStop(0, 'rgba(255,241,207,.35)'); g.addColorStop(1, 'rgba(255,241,207,0)');
      ctx.fillStyle = g; ctx.fillRect(-20, -20, 40, 40);
      ctx.strokeStyle = spec.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -6, 5, 0, TAU); ctx.stroke();
      ctx.fillStyle = spec.color; ctx.fillRect(-1.5, -1, 3, 13); ctx.fillRect(1, 6, 5, 2.5); ctx.fillRect(1, 10, 4, 2.5);
      ctx.fillStyle = '#FFF1CF'; ctx.fillRect(-3, -9, 2, 2);
      ctx.restore();
    }

    function drawShield(p) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2 - 4;
      const pulse = reduced ? 0 : Math.sin(clock * 4) * 1.5;
      // A double shield gets an outer ring too.
      if (p.shield > 1) {
        ctx.strokeStyle = 'rgba(159,216,255,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, 22 - pulse, 28 - pulse, 0, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(159,216,255,.75)'; ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(159,216,255,.12)';
      ctx.beginPath(); ctx.ellipse(cx, cy, 17 + pulse, 23 + pulse, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(cx, cy, 13 + pulse, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
    }

    function drawTraps(W) {
      for (const t of W.traps) {
        if (t.type === 'pend') {
          const b = LF.pendBall(t);
          ctx.fillStyle = '#2A2348'; ctx.fillRect(t.ax - 5, t.ay - 3, 10, 6);
          if (t.spiked) {
            // Thorny chain: a darker red line with barbs sticking out both sides.
            const dx = b.x - t.ax, dy = b.y - t.ay, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
            ctx.strokeStyle = '#7A2E1C'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(t.ax, t.ay); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.fillStyle = '#CFC6E8';
            for (let k = 1; k < 12; k++) {
              const f = k / 12, cx = t.ax + dx * f, cy = t.ay + dy * f, side = k % 2 ? 1 : -1, nx = -uy * side, ny = ux * side;
              ctx.beginPath(); ctx.moveTo(cx - ux * 3, cy - uy * 3); ctx.lineTo(cx + nx * 6, cy + ny * 6); ctx.lineTo(cx + ux * 3, cy + uy * 3); ctx.fill();
            }
          } else {
            ctx.strokeStyle = '#6E6186'; ctx.lineWidth = 2; ctx.setLineDash([4, 2]);
            ctx.beginPath(); ctx.moveTo(t.ax, t.ay); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.fillStyle = '#CFC6E8';
          for (let k = 0; k < 8; k++) {
            const a = k / 8 * TAU + t.a;
            ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a - .25) * 10, b.y + Math.sin(a - .25) * 10);
            ctx.lineTo(b.x + Math.cos(a) * 17, b.y + Math.sin(a) * 17); ctx.lineTo(b.x + Math.cos(a + .25) * 10, b.y + Math.sin(a + .25) * 10); ctx.fill();
          }
          ctx.fillStyle = '#4C4062'; ctx.beginPath(); ctx.arc(b.x, b.y, 11, 0, TAU); ctx.fill();
          ctx.fillStyle = '#6E6186'; ctx.beginPath(); ctx.arc(b.x - 3, b.y - 3, 4, 0, TAU); ctx.fill();
        } else if (t.type === 'bar') {
          ctx.fillStyle = '#2A2348'; ctx.beginPath(); ctx.arc(t.cx, t.cy, 5, 0, TAU); ctx.fill();
        } else {
          const j = t.state === 'wait' && !reduced ? (Math.random() - .5) * 1.5 : 0;
          const x = t.x + j, y = t.y;
          ctx.fillStyle = '#CFC6E8';
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + 1 + k * 7, y + t.h - 3); ctx.lineTo(x + 4.5 + k * 7, y + t.h + 5); ctx.lineTo(x + 8 + k * 7, y + t.h - 3); ctx.fill(); }
          ctx.fillStyle = '#4C4062'; ctx.fillRect(x, y, t.w, t.h - 2);
          ctx.fillStyle = '#6E6186'; ctx.fillRect(x, y, t.w, 3); ctx.fillRect(x, y, 3, t.h - 2);
          ctx.fillStyle = '#2A2348'; ctx.fillRect(x + t.w - 3, y, 3, t.h - 2);
          ctx.fillStyle = '#211C3F';
          ctx.fillRect(x + 6, y + 9, 7, 3); ctx.fillRect(x + 17, y + 9, 7, 3);
          ctx.fillRect(x + 9, y + 19, 12, 3);
        }
      }
    }

    // The horde: a churning wall of shadow behind its front. Drawn in (along, across)
    // terms so one routine serves both a rightward horde and a rising one.
    const hordeEdge = (h, ac) => h.f + (reduced ? 0 : Math.sin(ac * .045 + clock * 3) * 10 + Math.sin(ac * .11 - clock * 5) * 6);
    const hordePt = (h, al, ac) => h.up ? [ac, -al] : [al, ac];
    // The span of the view across the chase, and the along-coordinate of the view's far-behind edge.
    function hordeView(h, cam) {
      const { vw, vh } = R.viewSize(cam);
      return h.up
        ? { a0: cam.x - 40, a1: cam.x + vw + 40, behind: -(cam.y + vh + 40), seen: -h.f < cam.y + vh + 30 }
        : { a0: cam.y - 40, a1: cam.y + vh + 40, behind: cam.x - 40, seen: h.f + 30 > cam.x };
    }
    function drawHorde(W, cam, opts) {
      const h = W.horde;
      if (!h) return;
      if (opts.edit) {
        ctx.fillStyle = 'rgba(7,6,15,.55)';
        if (h.up) ctx.fillRect(0, h.oy, W.w * TS, TS); else ctx.fillRect(h.ox, 0, TS, W.h * TS);
        ctx.fillStyle = '#FF6B3D'; ctx.font = '600 9px ui-monospace, monospace';
        ctx.fillText(h.up ? 'HORDE ↑' : 'HORDE →', h.ox + 2, h.up ? h.oy + 12 : 12);
        return;
      }
      const v = hordeView(h, cam);
      if (!v.seen) return;
      const back = Math.min(v.behind, h.f - 200), pt = (al, ac) => hordePt(h, al, ac);
      ctx.fillStyle = '#07060F';
      ctx.beginPath(); ctx.moveTo(...pt(back, v.a0));
      for (let ac = v.a0; ac <= v.a1; ac += 8) ctx.lineTo(...pt(hordeEdge(h, ac), ac));
      ctx.lineTo(...pt(back, v.a1)); ctx.fill();
      // Grasping hands and heads along the front.
      ctx.strokeStyle = '#07060F';
      for (let ac = Math.floor(v.a0 / 22) * 22; ac < v.a1; ac += 22) {
        const reach = reduced ? 8 : 8 + Math.sin(clock * 4 + ac) * 8, ex = hordeEdge(h, ac);
        ctx.beginPath(); ctx.arc(...pt(ex - 2, ac), 9, 0, TAU); ctx.fill();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...pt(ex, ac + 7)); ctx.lineTo(...pt(ex + reach, ac + 7)); ctx.stroke();
        ctx.lineWidth = 1.5;
        for (let f = 0; f < 3; f++) { ctx.beginPath(); ctx.moveTo(...pt(ex + reach, ac + 4.5 + f * 2.5)); ctx.lineTo(...pt(ex + reach + 4, ac + 4.5 + f * 2.5)); ctx.stroke(); }
      }
      const [gx0, gy0] = pt(h.f, 0), [gx1, gy1] = pt(h.f + 90, 0);
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, 'rgba(7,6,15,.75)'); g.addColorStop(1, 'rgba(7,6,15,0)');
      ctx.fillStyle = g;
      if (h.up) ctx.fillRect(v.a0, -h.f - 90, v.a1 - v.a0, 90); else ctx.fillRect(h.f, v.a0, 90, v.a1 - v.a0);
    }
    function drawHordeEyes(W, cam) {
      const h = W.horde;
      if (!h) return;
      const v = hordeView(h, cam), rr = LF.rng(7);
      if (!v.seen) return;
      for (let k = 0; k < 60; k++) {
        const ac = v.a0 + 20 + rr() * (v.a1 - v.a0 - 40), depth = rr() * 220;
        const al = hordeEdge(h, ac) - 12 - depth;
        const blink = reduced ? 1 : Math.sin(clock * (1 + rr() * 2) + k) > -.85 ? 1 : 0;
        if (!blink || al < v.behind - 20) continue;
        const [x, y] = hordePt(h, al, ac);
        ctx.fillStyle = `rgba(255,${60 + (k % 3) * 30},61,${.9 - depth / 300})`;
        ctx.fillRect(x - 3, y, 2.5, 2); ctx.fillRect(x + 2, y, 2.5, 2);
      }
    }

    function drawGhosts(W) {
      for (const g of W.ghosts) {
        const a = g.life / g.max * .45, bx = g.x + g.w / 2, by = g.y + g.h;
        ctx.fillStyle = `rgba(${g.c},${a})`;
        ctx.beginPath(); ctx.moveTo(bx - 9, by - 5); ctx.lineTo(bx + 9, by - 5); ctx.lineTo(bx + 6, by - 19); ctx.lineTo(bx - 6, by - 19); ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by - 23, 5, 0, TAU); ctx.fill();
        ctx.fillRect(bx - 5, by - 37, 10, 9); ctx.fillRect(bx - 7, by - 28, 14, 2);
      }
    }

    function drawPlayer(p) {
      if (p.dead) return;
      if (p.inv > 0) ctx.globalAlpha = reduced ? .5 : Math.floor(p.inv * 16) % 2 ? .25 : .8;
      const f = p.face, bx = p.x + p.w / 2, by = p.y + p.h, fl = LF.flamePos(p);
      ctx.strokeStyle = '#9A6A45'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx + f * 3, by - 10); ctx.lineTo(fl.x, fl.y + 3); ctx.stroke();
      ctx.save(); ctx.translate(bx, by); ctx.scale(p.sx, p.sy);
      const ph = p.onGround && Math.abs(p.vx) > 30 ? Math.sin(p.anim * 22) : 0;
      ctx.fillStyle = '#211C3F';
      if (!p.onGround) { ctx.fillRect(-6, -7, 4, 5); ctx.fillRect(2, -6, 4, 5); }
      else { ctx.fillRect(-6, -6 - (ph > 0 ? 2 : 0), 4, 6); ctx.fillRect(2, -6 - (ph < 0 ? 2 : 0), 4, 6); }
      ctx.fillStyle = '#D9D0F0';
      ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(9, -5); ctx.lineTo(6, -19); ctx.lineTo(-6, -19); ctx.fill();
      ctx.fillStyle = '#A99CC4';
      ctx.beginPath(); ctx.moveTo(-9 * f, -5); ctx.lineTo(-3 * f, -5); ctx.lineTo(-2 * f, -19); ctx.lineTo(-6 * f, -19); ctx.fill();
      ctx.fillStyle = '#F1D7B8'; ctx.beginPath(); ctx.arc(0, -23, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#211C3F';
      ctx.fillRect(f * 2 - 1, -24, 2, 2); ctx.fillRect(-7, -28, 14, 2); ctx.fillRect(-5, -37, 10, 9);
      ctx.fillStyle = p.boost > 0 ? '#FF9A2E' : p.dbl > 0 ? '#FFE066' : '#FF6B3D'; ctx.fillRect(-5, -30, 10, 2);
      if (p.ammo > 0) {
        ctx.fillStyle = '#2A2348'; ctx.fillRect(f > 0 ? 4 : -14, -15, 10, 4); ctx.fillRect(f > 0 ? 5 : -8, -13, 3, 5);
        ctx.fillStyle = '#8F81AB'; ctx.fillRect(f > 0 ? 4 : -14, -15, 10, 1);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function drawParticles(W, additive) {
      ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      for (const q of W.particles) {
        if (LF.WARM.includes(q.c) !== additive) continue;
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    const flick = (seed, amt) => reduced ? 1 : 1 + (Math.sin(clock * 9 + seed) * .6 + Math.sin(clock * 23 + seed * 2) * .4) * amt;

    function lights(W) {
      const out = [], p = W.player;
      if (!p.dead) { const f = LF.flamePos(p); out.push({ x: f.x, y: f.y, r: 150 * (p.glow ? 2 : 1) * flick(0, .03) }); }
      for (const f of W.fruits) if (!f.taken) out.push({ x: f.x, y: f.y, r: 44 });
      for (let k = 0; k < W.lavaTop.length; k += 3) { const l = W.lavaTop[k]; out.push({ x: l.tx * TS + 16, y: l.ty * TS + 10, r: 95 }); }
      for (const f of W.flows || []) for (let x = f.x0; x <= f.x1; x += 3) out.push({ x: x * TS + 16, y: LF.flowSurface(W, f, x * TS + 16) + 8, r: 100 });
      for (const a of W.ammo) if (!a.taken) out.push({ x: a.x, y: a.y, r: a.huge ? 70 : 40 });
      for (const k of W.keys) if (!k.taken) out.push({ x: k.x, y: k.y, r: 60 });
      for (const b of W.bullets) out.push({ x: b.x, y: b.y, r: 45 * (b.s || 1) });
      for (const b of W.ammoFly) out.push({ x: b.x, y: b.y, r: 28 });
      for (const t of W.traps) if (t.type === 'bar') { const bs = LF.barBalls(t); out.push({ x: bs[2].x, y: bs[2].y, r: 90 }); }
      // The Last Dark's eyes glow, so you can always see where it is.
      for (const e of W.enemies) if (e.alive && e.type === 'Ω+') out.push({ x: e.x + e.w / 2, y: e.y + 32, r: 110 });
      for (const e of W.enemies) if (e.alive && e.type === 'f+') { out.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, r: 200 }); for (const b of LF.wheelBalls(e).filter((_, k) => k % 3 === 2)) out.push({ x: b.x, y: b.y, r: 70 }); }
      for (const l of W.lanterns) if (l.lit) out.push({ x: l.x, y: l.y, r: (200 + l.pop * 60) * flick(l.f, .04) });
      if (W.door && W.door.glow > 0) out.push({ x: W.door.x + 16, y: W.door.y + 30, r: 130 * W.door.glow });
      for (const pd of W.passages) out.push({ x: pd.x + 16, y: pd.y + 30, r: 120 });
      if (W.secret && W.secretSeen) out.push({ x: W.secret.x + 16, y: W.secret.y + 30, r: 90 });
      for (const b of W.projectiles) out.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: 60 * Math.max(1, b.w / 10) });
      for (const e of W.enemies) if (e.alive && e.type === 'S') out.push({ x: e.x + 12, y: e.y + 2, r: 34 });
      for (const e of W.enemies) if (e.alive && e.type === 'Z') out.push({ x: e.x + 7, y: e.y + 7, r: 56 });
      for (const e of W.enemies) if (e.alive && e.type === 'U') out.push({ x: e.x + 10, y: e.y + 8, r: 70 });
      for (const e of W.enemies) if (e.alive && e.type === '*' && e.state !== 'idle') out.push({ x: e.x + e.w / 2, y: e.y + 8, r: 80 });
      for (const e of W.enemies) if (e.alive && e.type === 'Y') out.push({ x: e.x + 14 + e.face * 18, y: e.y - 4, r: 40 });
      return out;
    }

    function drawDarkness(W, cam) {
      const sc = R.scale(cam);
      dctx.setTransform(1, 0, 0, 1, 0, 0);
      dctx.globalCompositeOperation = 'source-over';
      dctx.clearRect(0, 0, R.W, R.H);
      dctx.fillStyle = `rgba(9,7,24,${W.dark})`;
      dctx.fillRect(0, 0, R.W, R.H);
      dctx.globalCompositeOperation = 'destination-out';
      for (const li of lights(W)) {
        const sx = (li.x - cam.x) * sc, sy = (li.y - cam.y) * sc, r = li.r * sc;
        if (sx + r < 0 || sy + r < 0 || sx - r > R.W || sy - r > R.H) continue;
        const g = dctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g; dctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(dark, 0, 0);
    }

    function drawEmissive(W, cam, opts) {
      worldTransform(W, cam, opts);
      ctx.globalCompositeOperation = 'lighter';
      for (const li of lights(W)) {
        if (li.r < 50) continue;
        const g = ctx.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r * .55);
        g.addColorStop(0, 'rgba(255,160,70,.2)'); g.addColorStop(1, 'rgba(255,160,70,0)');
        ctx.fillStyle = g; ctx.fillRect(li.x - li.r, li.y - li.r, li.r * 2, li.r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Lava is drawn over the darkness so it glows: still lava tile by tile, moving lava
      // slice by slice wherever it isn't behind rock.
      const vis = visibleRange(W, cam);
      if (W.lavaTop.length) {
        // Still lava: clip to its tiles (the top ones from their wavy surface down), fill once.
        const surfOf = tx => (reduced ? 0 : Math.sin(clock * 2.6 + tx * .9) * 2) + 7;
        let any = false, ymin = Infinity;
        ctx.save(); ctx.beginPath();
        for (let ty = vis.y0; ty <= vis.y1; ty++) for (let tx = vis.x0; tx <= vis.x1; tx++) {
          if (W.tiles[ty][tx] !== '!') continue;
          const top = LF.tile(W, tx, ty - 1) !== '!', ys = ty * TS + (top ? surfOf(tx) : 0);
          ctx.rect(tx * TS, ys, TS, (ty + 1) * TS - ys); any = true; ymin = Math.min(ymin, ys);
        }
        if (any) { ctx.clip(); lavaFill(vis.x0 * TS, (vis.x1 + 1) * TS, vis.y0 * TS, (vis.y1 + 1) * TS, ymin); }
        ctx.restore();
        for (let ty = vis.y0; ty <= vis.y1; ty++) for (let tx = vis.x0; tx <= vis.x1; tx++) {
          if (W.tiles[ty][tx] !== '!' || LF.tile(W, tx, ty - 1) === '!') continue;
          const ys = ty * TS + surfOf(tx), ys2 = ty * TS + surfOf(tx + 1);
          lavaCrust(tx * TS, TS, x => (x <= tx * TS ? ys : ys2 * ((x - tx * TS) / TS) + ys * (1 - (x - tx * TS) / TS)), tx * 7);
        }
      }
      for (const f of W.flows || []) {
        const fx0 = Math.max(f.x0, vis.x0) * TS, fx1 = (Math.min(f.x1, vis.x1) + 1) * TS, bot = (f.bottom + 1) * TS;
        if (fx1 <= fx0) continue;
        const surf = x => LF.flowSurface(W, f, x) + (reduced ? 0 : Math.sin(clock * 3 + x * .05) * 1.5);
        // Clip to the open tiles it covers, and to below its surface; fill once.
        let ymin = Infinity; for (let x = fx0; x <= fx1; x += 8) ymin = Math.min(ymin, surf(x));
        ctx.save(); ctx.beginPath();
        for (let ty = Math.max(vis.y0, Math.floor(ymin / TS)); ty <= Math.min(vis.y1, f.bottom); ty++) for (let tx = Math.floor(fx0 / TS); tx < fx1 / TS; tx++) if (!LF.isSolid(W.tiles[ty][tx]) && W.tiles[ty][tx] !== '!') ctx.rect(tx * TS, ty * TS, TS, TS);
        ctx.clip();
        ctx.beginPath(); ctx.moveTo(fx0, bot); for (let x = fx0; x <= fx1; x += 8) ctx.lineTo(x, surf(x)); ctx.lineTo(fx1, surf(fx1)); ctx.lineTo(fx1, bot); ctx.closePath(); ctx.clip();
        lavaFill(fx0, fx1, ymin, bot, ymin);
        ctx.restore();
        // (The crust, where it's in open air.)
        for (let x = fx0; x < fx1; x += 8) { const ys = surf(x + 4), c = W.tiles[Math.floor(ys / TS)]?.[Math.floor(x / TS)]; if (c != null && !LF.isSolid(c)) lavaCrust(x, 8, surf, Math.floor(x / 8)); }
      }
      for (const l of W.lanterns) {
        if (l.lit) {
          ctx.globalAlpha = Math.min(1, .85 * flick(l.f, .08)); ctx.fillStyle = '#FFB547'; ctx.fillRect(l.x - 5, l.y - 7, 10, 14);
          ctx.globalAlpha = 1; ctx.fillStyle = '#FFF1CF'; ctx.fillRect(l.x - 1.5, l.y - 2, 3, 5);
        } else {
          const pulse = reduced ? .5 : .35 + .25 * Math.sin(clock * 2.5 + l.f);
          ctx.strokeStyle = `rgba(217,208,240,${pulse})`; ctx.lineWidth = 1;
          ctx.strokeRect(l.x - 7.5, l.y - 9.5, 15, 19);
        }
      }
      ctx.globalAlpha = 1;

      for (const e0 of W.enemies) {
        if (!e0.alive) continue;
        const g0 = LF.ENEMIES[e0.type].giant;
        scaled(g0 ? { ...e0, type: g0 } : e0, e => {
        const cx = e.x + e.w / 2, by = e.y + e.h, f = e.face || -1;
        ctx.fillStyle = '#FF6B3D';
        if (e.type === 'B') { ctx.fillRect(cx + f * 8 - 1.5, by - 9, 3, 3); ctx.fillRect(cx + f * 4 - 1.5, by - 10, 3, 3); }
        else if (e.type === 'K') { ctx.fillRect(cx + f * 10 - 1, by - 8, 2, 2); }
        else if (e.type === 'F') { ctx.fillRect(cx - 3, e.y + 6, 2, 2); ctx.fillRect(cx + 1, e.y + 6, 2, 2); }
        else if (e.type === 'X') { ctx.fillRect(cx - 2.5, e.y + 2, 2, 2); ctx.fillRect(cx + .5, e.y + 2, 2, 2); }
        else if (e.type === 'R') {
          ctx.fillStyle = e.state === 'wind' || e.state === 'charge' ? '#FFE2A8' : '#FF6B3D';
          ctx.fillRect(cx + f * 8 - 1.5, by - 12, 3, 3);
        } else if (e.type === 'W') {
          ctx.fillStyle = e.state === 'aim' ? '#FFE2A8' : '#FF6B3D'; ctx.fillRect(cx + f * 7 - 1, e.y + 6, 2.5, 2.5);
        } else if (e.type === 'A') {
          ctx.fillStyle = e.cool < .5 ? '#FFE2A8' : '#FF6B3D'; ctx.fillRect(cx + f * 2 - 1, by - 24, 2.5, 2);
        } else if (e.type === 'I') {
          ctx.fillStyle = '#FF6B3D'; ctx.fillRect(cx + f * 3 - 4, by - 34, 8, 2.5);
        } else if (e.type === 'Y') {
          ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(cx + f * 18, e.y - 4, 2.5 * flick(e.ox, .2), 0, TAU); ctx.fill();
          ctx.fillStyle = '#FF6B3D'; ctx.fillRect(cx + f * 8 - 1, e.y + 3, 2, 2);
        } else if (e.type === 'N') {
          ctx.fillStyle = '#FF6B3D'; ctx.fillRect(cx + f * 7 - 1, e.y + 4, 2, 2);
        } else if (e.type === 'U') {
          const cy = e.y + 8, pulse = reduced ? 1 : 1 + Math.sin(clock * 3 + e.ox) * .08;
          ctx.strokeStyle = 'rgba(159,216,255,.55)'; ctx.lineWidth = 1.3; ctx.beginPath();
          for (let k = -2; k <= 2; k++) {
            const sway = reduced ? 0 : Math.sin(clock * 4 + k) * 2;
            ctx.moveTo(cx + k * 3.5, cy + 2); ctx.quadraticCurveTo(cx + k * 3.5 + sway, cy + 9, cx + k * 3 - sway, cy + 15);
          }
          ctx.stroke();
          ctx.fillStyle = 'rgba(159,216,255,.55)';
          ctx.beginPath(); ctx.ellipse(cx, cy + 2, 10 * pulse, 10 * pulse, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = 'rgba(230,245,255,.8)'; ctx.beginPath(); ctx.ellipse(cx, cy - 1, 4, 3.5, 0, 0, TAU); ctx.fill();
        } else if (e.type === '*') {
          if (e.state === 'idle') { /* hidden under the lava */ }
          else {
            const cy = e.y + 8, k = flick(e.ox, .12);
            const g = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 10 * k);
            g.addColorStop(0, '#FFF1CF'); g.addColorStop(.45, '#FFB547'); g.addColorStop(1, '#E0561E');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 9 * k, 0, TAU); ctx.fill();
            ctx.fillStyle = '#5A1E0E';
            const look = e.vy < 0 ? -2 : 2;
            ctx.fillRect(cx - 4, cy - 1 + look, 2.5, 3); ctx.fillRect(cx + 1.5, cy - 1 + look, 2.5, 3);
          }
        } else if (e.type === 'Z') {
          const k = flick(e.ox, .25);
          ctx.fillStyle = '#FF6B3D'; ctx.beginPath(); ctx.arc(cx, e.y + 7, 7 * k, 0, TAU); ctx.fill();
          ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(cx, e.y + 7, 3.5, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,181,71,.18)'; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
          ctx.beginPath(); ctx.arc(e.ox + 7, e.oy + 7, 46, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
        else if (e.type === 'S') {
          const charge = Math.max(0, 1 - e.cool / 2.3);
          ctx.fillStyle = `rgba(255,181,71,${.45 + charge * .55})`; ctx.fillRect(cx - 9, by - 22, 18, 3);
        } else if (e.type === 'G') {
          const a = .6 * (1 - e.fade * .8);
          const wy = e.y, bob = reduced ? 0 : Math.sin(clock * 3 + e.ox) * 3;
          ctx.fillStyle = `rgba(201,210,240,${a})`;
          ctx.beginPath(); ctx.moveTo(cx - 12, wy + 28 + bob); ctx.lineTo(cx - 12, wy + 12 + bob);
          ctx.arc(cx, wy + 12 + bob, 12, Math.PI, 0);
          for (let k = 0; k <= 4; k++) ctx.lineTo(cx + 12 - k * 6, wy + 28 + bob - (k % 2 ? 5 : 0) + (reduced ? 0 : Math.sin(clock * 6 + k) * 1.5));
          ctx.fill();
          ctx.fillStyle = `rgba(14,12,34,${a + .2})`;
          ctx.beginPath(); ctx.ellipse(cx + f * 3 - 4, wy + 12 + bob, 2.5, 3.5, 0, 0, TAU); ctx.ellipse(cx + f * 3 + 4, wy + 12 + bob, 2.5, 3.5, 0, 0, TAU); ctx.fill();
        }
        });
      }
      for (const b of W.projectiles) {
        if (b.kind === 'arrow') {
          const a = Math.atan2(b.vy, b.vx);
          ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(a);
          ctx.fillStyle = '#C08A5C'; ctx.fillRect(-9, -1, 14, 2);
          ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -3); ctx.lineTo(3, 3); ctx.fill();
          ctx.fillStyle = '#D9D0F0'; ctx.fillRect(-10, -3, 3, 2); ctx.fillRect(-10, 1, 3, 2);
          ctx.restore(); continue;
        }
        if (b.kind === 'shock') {
          // A shockwave rolling along the floor.
          const x = b.x + b.w / 2, y = b.y + b.h, d = Math.sign(b.vx);
          ctx.fillStyle = 'rgba(255,107,61,.8)';
          ctx.beginPath(); ctx.moveTo(x - d * 14, y); ctx.quadraticCurveTo(x - d * 2, y - b.h * 1.4, x + d * 11, y); ctx.fill();
          ctx.fillStyle = 'rgba(255,226,168,.9)';
          ctx.beginPath(); ctx.moveTo(x - d * 6, y); ctx.quadraticCurveTo(x + d * 2, y - b.h * .8, x + d * 9, y); ctx.fill();
          continue;
        }
        if (b.kind === 'web') {
          // A blob of web from the Widow.
          const x = b.x + b.w / 2, y = b.y + b.h / 2;
          ctx.strokeStyle = 'rgba(217,208,240,.85)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI; ctx.moveTo(x - Math.cos(a) * 8, y - Math.sin(a) * 8); ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); } ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.stroke();
          continue;
        }
        if (b.kind === 'warn') {
          // Where fire's about to burst up: a glow on the floor that pulses faster and
          // brighter as the moment nears, and a "!".
          const x = b.x + b.w / 2, y = b.y + b.h, u = 1 - b.life / b.max, pulse = .5 + .5 * Math.sin(clock * (10 + u * 25));
          const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
          g.addColorStop(0, `rgba(255,107,61,${.35 + .5 * u * pulse})`); g.addColorStop(1, 'rgba(255,107,61,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 1, 18, 7, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = `rgba(255,226,168,${.5 + .5 * pulse})`; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('!', x, y - 8 - u * 4); ctx.textAlign = 'start';
          continue;
        }
        if (b.kind === 'flame') {
          // A patch of fire left on the floor; it dies down as it burns out.
          const x = b.x + b.w / 2, y = b.y + b.h, k = Math.min(1, b.life / .6) * flick(x, .3);
          ctx.fillStyle = 'rgba(255,107,61,.85)'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x - 6, y - 10 * k, x, y - 18 * k); ctx.quadraticCurveTo(x + 6, y - 10 * k, x + 7, y); ctx.fill();
          ctx.fillStyle = 'rgba(255,226,168,.9)'; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.quadraticCurveTo(x, y - 9 * k, x + 3, y); ctx.fill();
          continue;
        }
        if (b.kind === 'rock') {
          ctx.fillStyle = '#5E5173'; ctx.beginPath(); ctx.moveTo(b.x + 3, b.y); ctx.lineTo(b.x + b.w, b.y + 4); ctx.lineTo(b.x + b.w - 2, b.y + b.h); ctx.lineTo(b.x, b.y + b.h - 3); ctx.fill();
          ctx.fillStyle = '#8F81AB'; ctx.fillRect(b.x + 3, b.y + 2, 5, 3);
          continue;
        }
        if (b.kind === 'kgrenade') {
          // The Powder King's grenade, drawn just like yours.
          const x = b.x + b.w / 2, y = b.y + b.h / 2;
          ctx.fillStyle = '#3A2F55'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#8F81AB'; ctx.lineWidth = 1; ctx.stroke();
          const blink = reduced || Math.floor(b.life * (b.bounces >= 2 ? 16 : 6)) % 2;
          ctx.fillStyle = blink ? '#FF6B3D' : '#7A2E1C'; ctx.beginPath(); ctx.arc(x + 1.5, y - 5, 1.8, 0, TAU); ctx.fill();
          continue;
        }
        if (b.kind === 'bomb') {
          // Where it'll land: a red oval the size of its blast, pulsing faster and pulling
          // tighter as it falls, with a "!".
          if (b.land) {
            const left = Math.max(0, b.land.t - (b.flown || 0)), u = Math.max(0, Math.min(1, 1 - left / Math.max(.3, b.land.t))), pulse = .5 + .5 * Math.sin(clock * (8 + u * 24));
            ctx.strokeStyle = `rgba(229,72,77,${.35 + .5 * u})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.ellipse(b.land.x, b.land.y - 2, 52 * (1.25 - .25 * u), 9, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = `rgba(229,72,77,${(.12 + .25 * u) * (.6 + .4 * pulse)})`; ctx.beginPath(); ctx.ellipse(b.land.x, b.land.y - 2, 52, 9, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = `rgba(255,208,210,${.5 + .5 * pulse})`; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('!', b.land.x, b.land.y - 12); ctx.textAlign = 'start';
          }
          const x = b.x + b.w / 2, y = b.y + b.h / 2;
          ctx.fillStyle = '#1A1530'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#8F81AB'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(x + 2, y - 7, 2.2 * flick(x, .5), 0, TAU); ctx.fill();
          continue;
        }
        if (b.kind === 'void') {
          // A void orb: a dark bead in a violet glow.
          const x = b.x + b.w / 2, y = b.y + b.h / 2, g = ctx.createRadialGradient(x, y, 2, x, y, 13);
          g.addColorStop(0, 'rgba(143,129,171,.7)'); g.addColorStop(1, 'rgba(143,129,171,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill();
          ctx.fillStyle = '#05040E'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
          continue;
        }
        if (b.kind === 'bubble') {
          const x = b.x + b.w / 2, y = b.y + b.h / 2;
          ctx.strokeStyle = '#9FD8FF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, b.w / 2, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(159,216,255,.25)'; ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 4, y - 5, 3, 3);
          continue;
        }
        if (b.kind === 'gear') {
          ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(reduced ? 0 : clock * 10 * Math.sign(b.vx || 1));
          ctx.fillStyle = '#A9A3BF'; for (let k = 0; k < 6; k++) { ctx.rotate(TAU / 6); ctx.fillRect(-2.5, -b.w / 2 - 2, 5, 5); }
          ctx.beginPath(); ctx.arc(0, 0, b.w / 2 - 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#4A4560'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
          ctx.restore(); continue;
        }
        if (b.kind === 'feather') {
          ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.fillStyle = '#DCE8FF'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#5B6E9A'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore();
          continue;
        }
        if (b.kind === 'crystal') {
          const x = b.x + b.w / 2, y = b.y + b.h / 2;
          ctx.fillStyle = '#9FD8FF'; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 5, y); ctx.fill();
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x - 1, y - 4, 2, 4);
          continue;
        }
        if (b.kind === 'seed') {
          // A melon seed, pointing the way it flies.
          ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.fillStyle = '#211C3F'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5E5173'; ctx.fillRect(-1, -1.5, 3, 1.2); ctx.restore();
          continue;
        }
        const r = b.w / 2;
        ctx.fillStyle = '#FF6B3D'; ctx.beginPath(); ctx.arc(b.x + r, b.y + r, r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(b.x + r, b.y + r, r * .44, 0, TAU); ctx.fill();
      }
      // The secret exit glows a cool blue (once found).
      if (W.secret && W.secretSeen) {
        const s = W.secret, g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
        g.addColorStop(0, 'rgba(159,216,255,.8)'); g.addColorStop(1, 'rgba(46,78,130,.6)');
        ctx.globalAlpha = .5 + (reduced ? 0 : Math.sin(clock * 2) * .2); ctx.fillStyle = g; doorPath(s, 3); ctx.fill(); ctx.globalAlpha = 1;
      }
      // Passage doors glow like an open door.
      for (const pd of W.passages) {
        const g = ctx.createLinearGradient(0, pd.y, 0, pd.y + pd.h);
        g.addColorStop(0, '#FFE2A8'); g.addColorStop(1, '#FF6B3D');
        ctx.fillStyle = g; doorPath(pd, 3); ctx.fill();
      }
      const d = W.door;
      if (d && d.glow > 0) {
        ctx.globalAlpha = d.glow;
        const g = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
        g.addColorStop(0, '#FFE2A8'); g.addColorStop(1, '#FF6B3D');
        ctx.fillStyle = g; doorPath(d, 3); ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (const fr of W.fruits) drawFruit(fr);
      for (const a of W.ammo) drawAmmo(a);
      // Ammo dropped by enemies: a row of little bullets streaking toward the player, nose
      // first, side by side and spaced so you can count them.
      for (const b of W.ammoFly) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
        for (let k = 0; k < b.n; k++) {
          const o = (k - (b.n - 1) / 2) * 7;
          ctx.fillStyle = 'rgba(255,181,71,.35)'; ctx.fillRect(-12, o - 1, 9, 2);
          ctx.fillStyle = '#C08A3E'; ctx.fillRect(-4, o - 2, 5, 4);
          ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.moveTo(1, o - 2); ctx.lineTo(4, o - 1); ctx.lineTo(5, o); ctx.lineTo(4, o + 1); ctx.lineTo(1, o + 2); ctx.fill();
        }
        ctx.restore();
      }
      for (const k of W.keys) drawKey(k);
      const drawBullet = b => {
        if (b.kind === 'rocket') {
          const d = Math.sign(b.vx) || 1;
          ctx.fillStyle = '#FF6B3D'; ctx.fillRect(b.x - d * 12, b.y - 2.5, d * 10, 5);
          ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.moveTo(b.x - d * 2, b.y - 3.5); ctx.lineTo(b.x + d * 5, b.y); ctx.lineTo(b.x - d * 2, b.y + 3.5); ctx.fill();
          return;
        }
        if (b.kind === 'dyn') {
          // A stick of dynamite, its fuse spitting sparks (and blinking faster as it burns down).
          ctx.fillStyle = '#C0392B'; ctx.fillRect(b.x - 3, b.y - 7, 6, 11);
          ctx.fillStyle = '#7A2E1C'; ctx.fillRect(b.x - 3, b.y - 4, 6, 1.5); ctx.fillRect(b.x - 3, b.y + 1, 6, 1.5);
          ctx.strokeStyle = '#D9C9A0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x, b.y - 7); ctx.quadraticCurveTo(b.x + 3, b.y - 10, b.x + 2, b.y - 12); ctx.stroke();
          const blink = reduced || Math.floor(b.life * (b.life < 1 ? 14 : 5)) % 2;
          ctx.fillStyle = blink ? '#FFE066' : '#FF6B3D'; ctx.beginPath(); ctx.arc(b.x + 2, b.y - 12, 2, 0, TAU); ctx.fill();
          return;
        }
        if (b.kind === 'grenade') {
          ctx.fillStyle = '#3A2F55'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#8F81AB'; ctx.lineWidth = 1; ctx.stroke();
          const blink = reduced || Math.floor(b.life * (b.life < .8 ? 16 : 6)) % 2;
          ctx.fillStyle = blink ? '#FF6B3D' : '#7A2E1C'; ctx.beginPath(); ctx.arc(b.x + 1.5, b.y - 5, 1.8, 0, TAU); ctx.fill();
          return;
        }
        if (b.kill) {
          // The kill shot: a regular bullet's size, in red.
          ctx.fillStyle = '#E5484D'; ctx.fillRect(b.x - (b.vx > 0 ? 10 : -2), b.y - 1.5, 8, 3);
          ctx.fillStyle = '#FFD0D2'; ctx.fillRect(b.x - 2, b.y - 1.5, 4, 3);
          return;
        }
        ctx.fillStyle = '#FFB547'; ctx.fillRect(b.x - (b.vx > 0 ? 10 : -2), b.y - 1.5, 8, 3);
        ctx.fillStyle = '#FFF1CF'; ctx.fillRect(b.x - 2, b.y - 1.5, 4, 3);
      };
      for (const b of W.bullets) {
        // Big (Shift) shots are drawn at twice the size around their centre.
        if (b.s > 1) { ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.s, b.s); ctx.translate(-b.x, -b.y); }
        drawBullet(b);
        if (b.s > 1) ctx.restore();
      }
      if (!W.player.dead && W.player.flash > 0) {
        const g = LF.gunPos(W.player);
        ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(g.x + W.player.face * 3, g.y, 4, 0, TAU); ctx.fill();
      }
      const p = W.player;
      if (!p.dead && !opts.hidePlayer && !p.inCannon && p.shield) drawShield(p);
      if (!p.dead && !opts.hidePlayer && !p.inCannon) {
        const f = LF.flamePos(p), k = flick(3, .15);
        ctx.fillStyle = '#FF6B3D'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 3.4 * k, 4.8 * k, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.ellipse(f.x, f.y + 1, 1.6, 2.4, 0, 0, TAU); ctx.fill();
      }
      // The Fire Wheel's arms glow like fire bars.
      for (const e of W.enemies) if (e.alive && e.type === 'f+') for (const b of LF.wheelBalls(e)) {
        ctx.fillStyle = '#FF6B3D'; ctx.beginPath(); ctx.arc(b.x, b.y, 8 * flick(b.x, .15), 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.6, 0, TAU); ctx.fill();
      }
      for (const t of W.traps) if (t.type === 'bar') for (const b of LF.barBalls(t)) {
        ctx.fillStyle = '#FF6B3D'; ctx.beginPath(); ctx.arc(b.x, b.y, 6 * flick(b.x, .15), 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFE2A8'; ctx.beginPath(); ctx.arc(b.x, b.y, 2.8, 0, TAU); ctx.fill();
      }
      drawHordeEyes(W, cam);
      for (const r of W.rings) {
        ctx.strokeStyle = `rgba(${r.c},${Math.max(0, r.life / r.total) * .8})`; ctx.lineWidth = 2.5 * (r.life / r.total) + .5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      drawParticles(W, true);
      ctx.font = '600 10px "Martian Mono", ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      for (const fl of W.floaters) {
        ctx.globalAlpha = Math.min(1, fl.life * 2); ctx.fillStyle = fl.c; ctx.fillText(fl.t, fl.x, fl.y);
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
    }

    function drawEditOverlay(W, cam, opts) {
      const { x0, x1, y0, y1 } = visibleRange(W, cam);
      const sc = R.scale(cam);
      ctx.strokeStyle = 'rgba(217,208,240,.09)'; ctx.lineWidth = 1 / sc;
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(x * TS, y0 * TS); ctx.lineTo(x * TS, (y1 + 1) * TS); }
      for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(x0 * TS, y * TS); ctx.lineTo((x1 + 1) * TS, y * TS); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,181,71,.7)'; ctx.lineWidth = 2 / sc;
      ctx.strokeRect(0, 0, W.w * TS, W.h * TS);
      if (opts.selected) {
        const { tx, ty } = opts.selected, pad = reduced ? 2 : 2 + Math.sin(clock * 5) * 1.5;
        ctx.strokeStyle = '#FF6B3D'; ctx.lineWidth = 2 / sc; ctx.setLineDash([5 / sc, 3 / sc]);
        ctx.strokeRect(tx * TS - pad, ty * TS - pad, TS + pad * 2, TS + pad * 2); ctx.setLineDash([]);
      }
      if (opts.hover) {
        const { tx, ty } = opts.hover;
        ctx.fillStyle = 'rgba(255,181,71,.18)'; ctx.fillRect(tx * TS, ty * TS, TS, TS);
        ctx.strokeStyle = '#FFB547'; ctx.strokeRect(tx * TS, ty * TS, TS, TS);
      }
    }

    // Lava: a molten body, orange at the top deepening to dark red, with dark crust drifting
    // across it and bright veins; on top a glowing crust where bubbles swell and pop, and
    // heat glowing up off it. lavaBody fills x..x+w from a to b (its surface at ys);
    // lavaCrust draws the top along surf(x).
    // Fill the current clip with lava over x0..x1, y0..y1 (ys: the top of the lava, for the
    // colour): one gradient, then crust drifting and veins wandering in world space, so pools
    // and flows read as one body with no seams.
    function lavaFill(x0, x1, y0, y1, ys) {
      const g = ctx.createLinearGradient(0, ys, 0, ys + TS * 2.5);
      g.addColorStop(0, '#FFA347'); g.addColorStop(.12, '#F26A2A'); g.addColorStop(.55, '#C2361B'); g.addColorStop(1, '#7E1F10');
      ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      if (reduced) return;
      const t = clock;
      ctx.fillStyle = 'rgba(80,16,8,.3)';
      for (let gy = Math.floor(y0 / 26) * 26; gy < y1; gy += 26) for (let gx = Math.floor(x0 / 44) * 44 - 44; gx < x1 + 44; gx += 44) {
        const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0, px = gx + ((h % 44) + t * (6 + h % 5)) % 44, py = gy + (h >> 5) % 20 + Math.sin(t * .6 + h) * 2;
        ctx.beginPath(); ctx.ellipse(px, py, 7 + h % 5, 2.6 + (h >> 3) % 2, Math.sin(t * .3 + h) * .25, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,214,140,.32)'; ctx.lineWidth = 1.3;
      for (let vy = Math.floor(y0 / 30) * 30 + 15; vy < y1; vy += 30) {
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 8) { const y = vy + Math.sin(x * .045 + t * .9 + vy) * 4 + Math.sin(x * .013 - t * .4) * 3; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    function lavaCrust(x, w, surf, seed) {
      const y0 = surf(x), y1 = surf(x + w);
      // Heat glowing up off it.
      if (!reduced) {
        const ym = Math.min(y0, y1), hg = ctx.createLinearGradient(0, ym - 26, 0, ym);
        hg.addColorStop(0, 'rgba(255,140,60,0)'); hg.addColorStop(1, 'rgba(255,140,60,.28)');
        ctx.fillStyle = hg; ctx.fillRect(x, ym - 26, w, 26);
      }
      // The crust: a bright line and a hot rim below it.
      ctx.strokeStyle = '#FFE7B0'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + w, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,70,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y0 + 3); ctx.lineTo(x + w, y1 + 3); ctx.stroke();
      if (reduced || w < TS && seed % 4) return;
      // A bubble now and then: it swells up out of the crust and pops in a ring.
      const b = (clock * .7 + seed * .37) % 1, bx = x + w / 2, by = (y0 + y1) / 2;
      if (b < .8) { const r = 1 + 5 * (b / .8); ctx.fillStyle = '#FF8A3A'; ctx.beginPath(); ctx.arc(bx, by, r, Math.PI, 0); ctx.fill(); ctx.strokeStyle = '#FFE2A8'; ctx.lineWidth = 1; ctx.stroke(); }
      else { const q = (b - .8) / .2; ctx.strokeStyle = `rgba(255,226,168,${1 - q})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bx, by - 2, 6 + q * 6, Math.PI, 0); ctx.stroke(); ctx.fillStyle = `rgba(255,200,120,${1 - q})`; for (const d of [-1, 1]) ctx.fillRect(bx + d * (4 + q * 8), by - 4 - q * 10, 2, 2); }
    }
    R.render = (W, cam, opts = {}, dt = 0) => {
      clock += dt;
      drawSky(W, cam);
      worldTransform(W, cam, opts);
      if (W.def.signs) {
        ctx.font = '600 9px "Martian Mono", ui-monospace, Menlo, monospace';
        ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(217,208,240,.62)';
        for (const s of W.def.signs) ctx.fillText(s.t, s.x * TS, s.y * TS);
        ctx.textBaseline = 'alphabetic';
      }
      drawTiles(W, cam, opts);
      drawPlats(W);
      drawDoor(W.door); if (W.secretSeen || opts.edit) drawDoor(W.secret);
      for (const d of W.passages) drawDoor(d);
      // Practice checkpoints: little blue flags.
      for (const m of W.marks) {
        ctx.strokeStyle = '#D9D0F0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x + 9, m.y + 26); ctx.lineTo(m.x + 9, m.y - 6); ctx.stroke();
        ctx.fillStyle = '#9FD8FF'; ctx.beginPath(); ctx.moveTo(m.x + 9, m.y - 6); ctx.lineTo(m.x + 21, m.y - 2); ctx.lineTo(m.x + 9, m.y + 2); ctx.fill();
      }
      drawCannon(W, opts);
      // The TNT cart waiting at the end of the Last Dark's chase.
      const tc = W.chaseCart;
      if (tc && tc.state !== 'gone') {
        ctx.fillStyle = '#C0392B'; ctx.fillRect(tc.x, tc.y, tc.w, tc.h - 6);
        ctx.fillStyle = '#7A2E1C'; ctx.fillRect(tc.x, tc.y, tc.w, 3);
        ctx.fillStyle = '#FFE2A8'; ctx.font = '700 8px "Martian Mono", ui-monospace, monospace'; ctx.fillText('TNT', tc.x + 5, tc.y + 12);
        ctx.fillStyle = '#211C3F'; for (const d of [6, 22]) { ctx.beginPath(); ctx.arc(tc.x + d, tc.y + tc.h - 4, 4, 0, TAU); ctx.fill(); }
        if (W.chasing && tc.state === 'idle') { ctx.strokeStyle = `rgba(255,181,71,${.5 + .5 * Math.sin(clock * 8)})`; ctx.lineWidth = 2; ctx.strokeRect(tc.x - 3, tc.y - 3, tc.w + 6, tc.h + 2); }
      }
      for (const l of W.lanterns) drawLantern(l);
      // A raging boss glows red (it can't be stomped till it calms down).
      for (const e of W.enemies) {
        if (!(e.fury > 0) || !e.alive) continue;
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2, rr = Math.max(e.w, e.h) * (.8 + .1 * Math.sin(clock * 20));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(255,77,61,.55)'); g.addColorStop(1, 'rgba(255,77,61,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
      for (const e of W.enemies) LF.ENEMIES[e.type].special ? drawGiant(e) : scaled(e, drawEnemy);
      drawTraps(W);
      drawGhosts(W);
      if (!opts.hidePlayer && !W.player.inCannon) drawPlayer(W.player);
      // Fired from the cannon: the lamplighter tumbling through the air.
      if (W.cannon && W.cannon.state === 'fire') {
        const p = W.player;
        ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(W.cannon.t * 9);
        ctx.fillStyle = '#D9D0F0'; ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(0, -4); ctx.lineTo(8, 12); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -8, 5.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#FFB547'; ctx.beginPath(); ctx.arc(12, -14, 3.5, 0, TAU); ctx.fill();
        ctx.restore();
      }
      drawParticles(W, false);
      drawHorde(W, cam, opts);
      if (opts.edit) {
        drawEmissive(W, cam, opts);
        worldTransform(W, cam, opts);
        drawEditOverlay(W, cam, opts);
      } else {
        drawDarkness(W, cam);
        drawEmissive(W, cam, opts);
      }
    };

    return R;
  };
})();
