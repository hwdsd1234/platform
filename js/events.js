// Lanternfall: events. For the first hour of every three (by the clock, the same for
// everyone), an event is on, a different one each time, in turn: double fruit from the
// groves, several powers at once, groves that grow straight back, double ammo, or longer
// level clocks. LF.eventNow() is the event that's on (or null); LF.eventNext() the next
// one and when it starts. (For trying one out: ?event=<id> in the address.)
(() => {
  const LF = window.LF;
  const HOUR = 60 * 60 * 1000, EVERY = 3 * HOUR, LASTS = HOUR;
  const EVENTS = LF.EVENTS = [
    { id: 'harvest', icon: '🧺', name: 'Double Harvest', note: 'every fruit you get in a fruit grove counts twice' },
    { id: 'stack', icon: '✨', name: 'Power Stack', note: 'fruit powers stack: keep more than one at a time (on top of your apple shields), and they stay stacked until you die' },
    { id: 'regrow', icon: '🌱', name: 'Quick Groves', note: 'fruit groves grow straight back: go in as often as you like' },
    { id: 'ammo', icon: '🎯', name: 'Ammo Rain', note: 'ammo crates and enemy drops are worth twice as much' },
    { id: 'clock', icon: '🕰️', name: 'Long Night', note: 'every level clock gets 60 more seconds' },
  ];
  let forced = null;
  try { forced = new URLSearchParams(location.search).get('event'); } catch (e) {}
  const at = now => {
    const k = Math.floor(now / EVERY), into = now - k * EVERY;
    return { ev: EVENTS[k % EVENTS.length], on: into < LASTS, ends: k * EVERY + LASTS, next: { ev: EVENTS[(k + 1) % EVENTS.length], starts: (k + 1) * EVERY } };
  };
  LF.eventNow = (now = Date.now()) => {
    if (forced) return EVENTS.find(e => e.id === forced) ? { ...EVENTS.find(e => e.id === forced), ends: now + LASTS } : null;
    const a = at(now);
    return a.on ? { ...a.ev, ends: a.ends } : null;
  };
  LF.eventNext = (now = Date.now()) => at(now).next;
  LF.eventIs = id => (LF.eventNow() || {}).id === id;
  // "42 min", "1 h 20 min"
  LF.eventLeft = ms => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };
})();
