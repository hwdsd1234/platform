// Lanternfall: the world map's artwork. Each world has a theme (its colors and its
// scenery), stops are drawn as lamp posts (towers for bosses, a castle for the last one),
// and a few creatures wander about. Everything here returns SVG markup; ui.js lays it out.
(() => {
  const LF = window.LF;

  // One per world, in order: sky (top, bottom), the trail's color, and the scenery kind.
  const THEMES = [
    { sky: ['#2E2552', '#3D2C57'], trail: '#B9935F', kind: 'town', wander: 'beetle' },
    { sky: ['#1B3352', '#21486E'], trail: '#D8C08A', kind: 'harbor', wander: 'gull' },
    { sky: ['#382B3E', '#4A3846'], trail: '#C08A5C', kind: 'gears', wander: 'spark' },
    { sky: ['#1C2858', '#3A4482'], trail: '#E6E0FF', kind: 'sky', wander: 'gull' },
    { sky: ['#183647', '#22495B'], trail: '#CFC6E8', kind: 'canal', wander: 'frog' },
    { sky: ['#1F3528', '#2B4934'], trail: '#E0C48A', kind: 'garden', wander: 'wasp' },
    { sky: ['#382424', '#4A2D2A'], trail: '#B08A6A', kind: 'smoke', wander: 'bat' },
    { sky: ['#1A2542', '#243358'], trail: '#9FD8FF', kind: 'crystal', wander: 'spider' },
    { sky: ['#0F0C24', '#1B1536'], trail: '#8F81AB', kind: 'night', wander: 'wraith' },
  ];
  const theme = k => THEMES[k % THEMES.length];

  // ---- scenery pieces, each drawn around (x, y) at its base ----
  const PIECES = {
    town: [
      (x, y, r) => `<g transform="translate(${x} ${y})"><rect x="-14" y="-22" width="28" height="22" fill="#4C4062"/><path d="M-17 -22 L0 -36 L17 -22 Z" fill="#7A2E1C"/><rect x="5" y="-34" width="5" height="10" fill="#4C4062"/><rect x="-8" y="-15" width="6" height="7" fill="${r() < .6 ? '#FFB547' : '#211C3F'}"/><rect x="3" y="-15" width="6" height="7" fill="${r() < .5 ? '#FFB547' : '#211C3F'}"/>${r() < .5 ? '<circle class="mp-puff" cx="7" cy="-40" r="4"/>' : ''}</g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-8" y="-34" width="16" height="34" fill="#3A3350"/><path d="M-10 -34 L0 -46 L10 -34 Z" fill="#5E5173"/><rect x="-3" y="-26" width="6" height="8" fill="#FFB547"/></g>`,
    ],
    harbor: [
      (x, y) => `<path transform="translate(${x} ${y})" d="M-24 0 q6 -6 12 0 t12 0 t12 0 t12 0" fill="none" stroke="#7FB0E0" stroke-width="2" opacity=".6" class="mp-wave"/>`,
      (x, y) => `<g transform="translate(${x} ${y})" class="mp-bob"><path d="M-16 -6 L16 -6 L10 2 L-10 2 Z" fill="#5C3B24"/><line x1="0" y1="-6" x2="0" y2="-30" stroke="#CFC6E8" stroke-width="2"/><path d="M1 -28 L14 -10 L1 -10 Z" fill="#D9D0F0"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-6" y="-44" width="12" height="44" fill="#D9D0F0"/><rect x="-6" y="-32" width="12" height="6" fill="#E5484D"/><rect x="-6" y="-16" width="12" height="6" fill="#E5484D"/><rect x="-8" y="-52" width="16" height="9" fill="#FFB547" class="mp-glow"/></g>`,
    ],
    gears: [
      (x, y, r) => { const s = 10 + r() * 8; return `<g transform="translate(${x} ${y - s})"><g class="mp-spin${r() < .5 ? ' rev' : ''}"><circle r="${s}" fill="none" stroke="#8F81AB" stroke-width="${s * .5}" stroke-dasharray="${s * .5} ${s * .4}"/><circle r="${s * .55}" fill="#5E5173"/><circle r="${s * .2}" fill="#2A2348"/></g></g>`; },
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-10" y="-30" width="20" height="30" fill="#4C4062"/><circle cy="-38" r="12" fill="#D9D0F0"/><line x1="0" y1="-38" x2="0" y2="-46" stroke="#2A2348" stroke-width="2"/><line x1="0" y1="-38" x2="6" y2="-38" stroke="#2A2348" stroke-width="2"/></g>`,
    ],
    sky: [
      (x, y, r) => { const s = .8 + r() * .6; return `<g transform="translate(${x} ${y - 10}) scale(${s})" class="mp-bob"><ellipse cx="0" cy="0" rx="26" ry="9" fill="#D6CEF0" opacity=".55"/><ellipse cx="-8" cy="-6" rx="13" ry="8" fill="#E6E0FF" opacity=".6"/></g>`; },
      (x, y) => `<g transform="translate(${x} ${y})" class="mp-bob"><path d="M-18 -10 L18 -10 L10 0 L2 6 L-8 2 Z" fill="#5E5173"/><rect x="-18" y="-13" width="36" height="4" fill="#8F81AB"/><rect x="-2" y="-30" width="3" height="17" fill="#D9D0F0"/><rect x="-5" y="-36" width="9" height="7" fill="#FFB547" class="mp-glow"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y - 20})"><g class="mp-spin"><circle r="16" fill="none" stroke="#8F81AB" stroke-width="2" stroke-dasharray="3 4"/><line x1="-16" y1="0" x2="16" y2="0" stroke="#5E5173" stroke-width="2"/><line x1="0" y1="-16" x2="0" y2="16" stroke="#5E5173" stroke-width="2"/></g><circle r="3" fill="#FFB547"/></g>`,
    ],
    canal: [
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-26" y="-8" width="52" height="10" rx="4" fill="#2E4E82" opacity=".8"/><path d="M-20 -3 q5 -3 10 0 t10 0 t10 0 t10 0" fill="none" stroke="#7FB0E0" stroke-width="1.5" class="mp-wave"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-26" y="-6" width="52" height="8" rx="3" fill="#2E4E82" opacity=".8"/><path d="M-18 -4 Q0 -22 18 -4" fill="none" stroke="#9A6A45" stroke-width="5"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-12" y="-20" width="24" height="20" fill="#5E5173"/><path d="M-14 -20 L0 -30 L14 -20 Z" fill="#2F5260"/><rect x="-4" y="-12" width="8" height="12" fill="#211C3F"/></g>`,
    ],
    garden: [
      (x, y, r) => { const s = .8 + r() * .5; return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-3" y="-14" width="6" height="14" fill="#5C3B24"/><circle cy="-24" r="13" fill="#2F6B3E"/><circle cx="-7" cy="-19" r="8" fill="#3A7A48"/><circle cx="6" cy="-28" r="3" fill="#E5484D"/></g>`; },
      (x, y) => `<g transform="translate(${x} ${y})"><circle cx="-6" cy="-3" r="3" fill="#FFE066"/><circle cx="2" cy="-5" r="3" fill="#E5484D"/><circle cx="8" cy="-2" r="3" fill="#D9D0F0"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-14" y="-16" width="28" height="16" fill="#5C3B24"/><path d="M-17 -16 h34 l-3 -8 h-28 Z" fill="#E5484D"/><path d="M-11 -24 h5 v8 h-5 Z M1 -24 h5 v8 h-5 Z" fill="#FFF1CF"/></g>`,
    ],
    smoke: [
      (x, y, r) => `<g transform="translate(${x} ${y})"><rect x="-6" y="-44" width="12" height="44" fill="#4A3B3A"/><rect x="-8" y="-46" width="16" height="5" fill="#2A2348"/><circle class="mp-puff" cy="-52" r="6"/><circle class="mp-puff late" cx="4" cy="-58" r="5"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><path d="M-22 0 L-18 -14 L-8 -10 L-2 -20 L8 -12 L16 -16 L22 0 Z" fill="#3A2A2A"/></g>`,
    ],
    crystal: [
      (x, y, r) => { const s = .7 + r() * .7; return `<g transform="translate(${x} ${y}) scale(${s})" class="mp-glow"><path d="M-8 0 L-5 -22 L0 -30 L5 -22 L8 0 Z" fill="#7FB0E0" opacity=".85"/><path d="M4 0 L8 -14 L13 -8 L12 0 Z" fill="#9FD8FF" opacity=".8"/><path d="M-4 -20 L0 -28 L0 0 L-3 0 Z" fill="#D9F0FF" opacity=".5"/></g>`; },
      (x, y) => `<g transform="translate(${x} ${y})"><rect x="-12" y="-12" width="24" height="9" fill="#4C4062"/><circle cx="-7" cy="-2" r="3" fill="#2A2348"/><circle cx="7" cy="-2" r="3" fill="#2A2348"/><circle cx="-3" cy="-14" r="3" fill="#9FD8FF"/><circle cx="3" cy="-15" r="3" fill="#7FB0E0"/></g>`,
    ],
    night: [
      (x, y, r) => `<circle class="mp-star" cx="${x}" cy="${y - 20 - r() * 20}" r="${1 + r() * 1.5}" fill="#FFF1CF" style="animation-delay:${(r() * 3).toFixed(2)}s"/>`,
      (x, y) => `<g transform="translate(${x} ${y})" stroke="#3A3350" stroke-width="3" fill="none"><path d="M0 0 L0 -26 M0 -16 L-9 -24 M0 -20 L8 -28 M0 -26 L-4 -32"/></g>`,
      (x, y) => `<g transform="translate(${x} ${y})"><path d="M-7 0 L-7 -12 A7 7 0 0 1 7 -12 L7 0 Z" fill="#3A3350"/></g>`,
    ],
  };

  // Scatter a world's scenery over its region wherever it's clear of the path and stops.
  // rect: { x0, y0, x1, y1 }; clear(x, y) says whether a spot is free.
  function scenery(k, rect, clear, seed) {
    const R = LF.rng(seed), kinds = PIECES[theme(k).kind];
    let out = '';
    for (let y = rect.y0 + 60; y < rect.y1 - 6; y += 30) for (let x = rect.x0 + 22; x < rect.x1 - 22; x += 34) {
      const jx = x + (R() - .5) * 18, jy = y + (R() - .5) * 14;
      if (R() < .68 || !clear(jx, jy) || !clear(jx, jy - 30)) continue;   // (its top too: some pieces are tall)
      out += kinds[Math.floor(R() * kinds.length)](jx, jy, R);
    }
    return out;
  }

  // A couple of creatures wandering about a world (decoration only).
  const CRITTERS = {
    beetle: '<path d="M-7 0 A7 6 0 0 1 7 0 Z" fill="#2A2348"/><rect x="4" y="-4" width="3" height="2" fill="#FF6B3D"/>',
    gull: '<path d="M-8 0 Q-4 -5 0 0 Q4 -5 8 0" fill="none" stroke="#D9D0F0" stroke-width="2"/>',
    spark: '<circle r="4" fill="#FFB547"/><circle r="1.8" fill="#FFF1CF"/>',
    frog: '<ellipse cy="-4" rx="7" ry="5" fill="#2F6B3E"/><circle cx="-3" cy="-9" r="2" fill="#FFE066"/><circle cx="3" cy="-9" r="2" fill="#FFE066"/>',
    wasp: '<ellipse rx="6" ry="4" fill="#E0A526"/><rect x="-1" y="-4" width="2" height="8" fill="#2A2348"/><ellipse cy="-5" rx="4" ry="2" fill="#D9D0F0" opacity=".7"/>',
    bat: '<path d="M-10 -2 L-4 -6 L0 -2 L4 -6 L10 -2 L4 0 L0 2 L-4 0 Z" fill="#1F1A3A"/><circle cx="-1.5" cy="-2" r="1" fill="#FF6B3D"/><circle cx="1.5" cy="-2" r="1" fill="#FF6B3D"/>',
    spider: '<line x1="0" y1="-30" x2="0" y2="-6" stroke="#8F81AB"/><circle cy="-3" r="5" fill="#3B2F57"/><circle cx="-1.5" cy="-4" r="1" fill="#FF6B3D"/><circle cx="1.5" cy="-4" r="1" fill="#FF6B3D"/>',
    wraith: '<path d="M-7 4 L-7 -6 A7 7 0 0 1 7 -6 L7 4 L4 1 L0 4 L-4 1 Z" fill="#D9D0F0" opacity=".75"/><circle cx="-2.5" cy="-5" r="1.4" fill="#0E0C22"/><circle cx="2.5" cy="-5" r="1.4" fill="#0E0C22"/>',
  };
  function wanderers(k, spots) {
    const kind = theme(k).wander, flies = ['gull', 'bat', 'wasp', 'wraith', 'spark'].includes(kind);
    return spots.map(({ x, y }, n) => `<g transform="translate(${x} ${y})"><g class="mp-wander ${flies ? 'fly' : 'walk'}" style="animation-delay:-${n * 2.3}s">${CRITTERS[kind]}</g></g>`).join('');
  }

  // A castle: a keep between two towers, a gate, a flag (gold once its keeper's beaten).
  const castleShape = `<rect x="-26" y="-30" width="52" height="34"/><rect x="-32" y="-46" width="14" height="50"/><rect x="18" y="-46" width="14" height="50"/><rect x="-8" y="-56" width="16" height="30"/>
      <path class="crenel" d="M-32 -46 h4 v-5 h3 v5 h4 v-5 h3 v5 M18 -46 h4 v-5 h3 v5 h4 v-5 h3 v5"/><path d="M-6 4 v-14 a6 6 0 0 1 12 0 v14 Z" class="gate"/>
      <line x1="0" y1="-56" x2="0" y2="-72"/><path class="flag" d="M0 -72 L14 -67 L0 -62 Z"/>`;
  // The last castle, ten times the size, standing over the end of the road with lit
  // windows; its stop is the gate (see bigCastle and stop).
  function bigCastle(x, y, lit) {
    const windows = [[-28, -40], [22, -40], [-28, -24], [22, -24], [-16, -20], [-4, -48], [8, -20], [-18, -10], [12, -10]].map(([wx, wy]) => `<rect class="win" x="${wx}" y="${wy}" width="2.4" height="4" rx="1.2"/>`).join('');
    return `<g class="castle giant${lit ? ' won' : ''}" transform="translate(${x} ${y}) scale(10)">${castleShape}${windows}</g>`;
  }
  // A stop: a lamp post (lit once cleared), a tower for a boss fight (its flag turns gold
  // once beaten), a castle for a world's castle. The last castle's stop is its gate (the
  // castle itself is drawn behind the road: see bigCastle). Locked stops are just a dim post.
  function stop(lv, state) {
    const lit = state === 'lit', locked = state === 'locked';
    if (lv.finalFight) return `<circle class="hit" r="34"/>`;
    if (lv.castle) return `<circle class="hit" r="30"/>
      <g class="castle${lit ? ' won' : ''}${locked ? ' locked' : ''}">${castleShape}</g>`;
    if (lv.boss) return `<circle class="hit" r="22"/>
      <g class="tower${lit ? ' won' : ''}${locked ? ' locked' : ''}"><rect x="-12" y="-30" width="24" height="34"/><path class="crenel" d="M-12 -30 v-6 h5 v6 h4 v-6 h6 v6 h4 v-6 h5 v6"/><path d="M-5 4 v-10 a5 5 0 0 1 10 0 v10 Z" class="gate"/>
      <line x1="0" y1="-36" x2="0" y2="-50"/><path class="flag" d="M0 -50 L12 -46 L0 -42 Z"/></g>`;
    return `<circle class="hit" r="16"/>
      <g class="post${lit ? ' lit' : ''}${locked ? ' locked' : ''}">${lit ? '<circle class="halo" cy="-22" r="13"/>' : ''}<line x1="0" y1="4" x2="0" y2="-16"/><rect class="lamp" x="-6" y="-28" width="12" height="13" rx="3"/><path class="cap" d="M-8 -28 L0 -34 L8 -28 Z"/><ellipse class="base" cy="5" rx="9" ry="3"/></g>`;
  }

  LF.mapArt = { theme, scenery, wanderers, stop, bigCastle };
})();
