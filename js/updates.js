// Lanternfall: the update log, newest first. Each entry is a day's changes, as players see
// them (the game as it is now: things later changed or taken back aren't listed as they
// first were). The map's Updates button shows it, with a dot when there's something you
// haven't read (see ui.js). Load before ui.js.
(() => {
  const LF = window.LF;
  LF.UPDATES = [
    { date: '2026-10-14', title: 'Pear power-ups and practice', items: [
      'The pear’s mid-air spin lifts you twice as high. After it you can’t glide, and you drop fast, until you land or touch a wall.',
      'Wall jumps give the pear back (its spin and its glide), and there’s no limit on wall jumps.',
      'The Pear Cliffs have a ceiling, so no going over the top.',
      'Practice mode counts for nothing: no progress, awards or secret exits, your carried powers and ammo stay as they are, items can’t be used, and Fruit Groves are always open, never used up, and give nothing to keep.',
      'This update log!',
    ] },
    { date: '2026-10-13', title: 'The Pear Cliffs, fairer towers, the drain room', items: [
      'New chapter: the Pear Cliffs, five gliding levels at the end of the Canal District.',
      'The pear is back: hold jump while falling to glide (after NSMBU’s acorn).',
      'The dark no longer takes your fruit in boss arenas, and arenas grow every kind of fruit again.',
      'Towers are all climbing: two tall shafts of jump stages (ledges, springs, crumbling, lifts, blinking blocks, chimneys, ice, stepping stones, wheels, belts, turn blocks, shingles, rising lava), then the boss. Two doors and two lanterns each.',
      'Castles are two long halls of challenges, with two doors and two lanterns.',
      'An apple in every tower stage and castle section.',
      'Fairer climbs: turn blocks have stone ledges to wait on, the springs land on wide planks, and there are fewer fliers.',
      'Rising lava comes right after a door and starts once you’re on its first ledge.',
      'The final castle’s drain room: arrive on a shingle over a room of lava that drains away. There’s no stone to stand on, and the walls slide faster than the lava drains. More shingles come up as it goes down.',
      'Cracked shingles fall once and are gone for good; the brown ones grow back. There are big 3-wide shingles too.',
      'Story levels are about half as long as before, each with one lantern near its middle.',
      'Coming back at a checkpoint always gives you at least 150 seconds.',
      'Shift+R restarts the whole level (a death, like giving up).',
      'Songs play much longer before they repeat.',
    ] },
    { date: '2026-10-12', title: 'Castles and the Last Dark', items: [
      'A castle at the end of every world, each with its own keeper: the Candle King, the Lighthouse Crab, the Clockwork Knight, the Storm Roc, the Rat King, the Pumpkin Knight, the Smog Dragon and the Crystal Mole.',
      'The final castle is five times the size, with tides, waves and floods of moving lava.',
      'The Last Dark takes 4 stomps. After the third it grows huge and chases you out of its hall, to a TNT cart that finishes it.',
      'Moving lava kills in one hit, like still lava.',
      'Every boss fight shares one boss theme (after NSMBW); the Last Dark keeps its own.',
      'Every lantern is a checkpoint, and the time you come back with depends on how far along it is.',
      'A lantern by every boss door.',
      'Clocks: 300 seconds a level, 400 in a castle, more when you reach the boss.',
      'Only one fruit power at a time besides the apple’s shield.',
      'Grander music: a concert-hall echo, strings, timpani and a written-out castle theme.',
    ] },
    { date: '2026-10-11', title: 'Dynamite, new fruit and the clock', items: [
      'Dynamite: D throws a stick (4 ammo) that kills everything within 5 blocks after 3 seconds. Shift+D throws a big one.',
      'New fruit: strawberry (wall grip), cherry (ammo magnet), blueberry (night eyes).',
      'A clock on every level, with a hurry-up tune when time runs low.',
      'Spooky tower music and a grand castle march.',
      'Refreshing in the middle of a level counts as a death. No giving up in Fruit Groves.',
      'The inventory is used from the map, holds up to 999 of each fruit, and in the Sky Roads only apples work.',
    ] },
    { date: '2026-10-10', title: 'Neo jumps', items: [
      'The Neo Ledges: Sky Roads levels of leaping out past an edge and back in.',
    ] },
    { date: '2026-10-08', title: 'Music and the Sky Roads', items: [
      'Music for every world, the map, towers, the castle, the groves and the Sky Roads.',
      'More Sky Roads levels; turn blocks and wheels in both directions.',
      'TNT carts can be stomped.',
      'Every platform in a boss arena can be reached without taking a hit.',
      'No walking out of a story level: finish it or give up.',
    ] },
    { date: '2026-10-07', title: 'New bosses and the Melon Patch', items: [
      'New bosses: the Void in the Sky Spire and the Melon Brute in the Melon Vault.',
      'The Melon Patch: levels built for the watermelon’s speed.',
      'Winning a level shows what it opened on the map.',
      'A wilder map with braided roads and crossroads.',
      'Bombs and fire patches mark where they’ll land.',
    ] },
    { date: '2026-10-06', title: 'The Sky Roads and boss fury', items: [
      'The Sky Roads, a world of pure platforming.',
      'Boss towers: no guns, three stomps, and a fury after each.',
      'The kill shot (A) and the watermelon.',
    ] },
    { date: '2026-10-05', title: 'Worlds, towers and fruit', items: [
      'Worlds joined by cannons, with secret exits to find.',
      'Towers and a castle, lanterns as checkpoints, and practice mode.',
      'Fruit powers, the inventory and Fruit Groves.',
    ] },
  ];
})();
