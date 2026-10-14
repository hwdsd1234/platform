// Lanternfall: worlds on the map. Load after bosses.js, so level indexes are final.
// - Worlds group the chapters. On the map each world is a region of its own, and at the
//   end of each one a cannon fires the lamplighter to the start of the next (lv.world is
//   the world's index; LF.WORLDS[w].first / .last are its first and last level indexes).
(() => {
  const LF = window.LF, L = LF.LEVELS;
  const WORLDS = [
    { name: 'Old Town', chapters: ['The Chandlery', 'The Belfry', 'The Kilns', 'The Hollow Spire'] },
    { name: 'The Waterfront', chapters: ['The Orchard', 'The Drowned Quarter', 'The Lighthouse'] },
    { name: 'The Clockwork Quarter', chapters: ['The Clockworks', 'The Frost Roofs', 'The Clock Tower', 'The Vault', 'The Horde', 'The Powder Works'] },
    { name: 'The Sky Roads', chapters: ['The Cloud Steps', 'The Wind Wheels', 'The Storm Heights', 'The High Winds', 'The Neo Ledges'] },
    { name: 'The Canal District', chapters: ['The Tallow Docks', 'The Soot Canals', 'The Pear Cliffs'] },
    { name: 'The Garden Market', chapters: ['The Wax Market', 'The Ember Gardens', 'The Melon Patch'] },
    { name: 'The Smokelands', chapters: ['The Smoke Stacks', 'The Ash Barrens', 'The Bell Foundry'] },
    { name: 'The Glass Mines', chapters: ['The Glass Works', 'The Moth Archive', 'The Cinder Mines'] },
    { name: 'Night’s End', chapters: ['The Wick Bridges', 'The Ember Coast', 'The Chimney Peaks', 'The Last Lamps', 'The Dawn Tower', 'The Last Night'] },
  ];
  const worldOf = {};
  WORLDS.forEach((w, k) => w.chapters.forEach(c => { worldOf[c] = k; }));
  L.forEach((lv, i) => { lv.world = worldOf[lv.chapter] ?? WORLDS.length - 1; });
  WORLDS.forEach((w, k) => {
    w.first = L.findIndex(lv => lv.world === k);
    w.last = L.length - 1 - [...L].reverse().findIndex(lv => lv.world === k);
  });
  LF.WORLDS = WORLDS;

})();
