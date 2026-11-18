// Swipes on touch screens, arrow keys or WASD on a keyboard. Calls back with 'left' | 'right' | 'up' | 'down' | 'tap'.
export function listen(target, on) {
  let start = null;
  const MIN = 16;
  target.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button, .tablet')) return; start = { x: e.clientX, y: e.clientY, t: performance.now(), fired: false, last: null }; });
  target.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.abs(dx) < MIN && Math.abs(dy) < MIN) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    // fire as soon as the finger has travelled far enough, not on release; then measure the next stroke from here,
    // so that a second swipe another way counts without lifting the finger (the same stroke carried on does not)
    start.x = e.clientX; start.y = e.clientY;
    if (dir === start.last) return;
    start.last = dir; start.fired = true; on(dir);
  });
  const end = () => { if (start && !start.fired && performance.now() - start.t < 350) on('tap'); start = null; };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', () => { start = null; });
  const KEYS = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ' ': 'up', ArrowDown: 'down', s: 'down', Enter: 'tap', g: 'giant', f: 'fly', Shift: 'fly' };
  window.addEventListener('keydown', e => { const k = KEYS[e.key]; if (k && !e.repeat) { e.preventDefault(); on(k); } });
}

// The fight's controls, laid out the way action games on a phone lay them out: a thumb stick on the left that comes to
// wherever the thumb lands; strike, dodge and jump under the right thumb. On a keyboard, as games there have it: WASD or the
// arrows to move, Space to jump, J (or F, Enter, or the mouse) to strike, Shift (or K) to dodge, G (or E, Q) for the great blow.
// live(): whether a fight is on. Returns the stick: x to the right of the screen, y toward the player, each -1..1.
export function fightControls(pad, { live, attack, dodge, jump, special }) {
  const stick = { x: 0, y: 0 }, knob = pad.firstElementChild, R = 46, held = new Set();
  let id = null, ox = 0, oy = 0;
  const keys = () => { if (id !== null) return; stick.x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0); stick.y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0); };
  const drop = () => { id = null; knob.style.transform = ''; pad.style.transform = ''; pad.classList.remove('held'); stick.x = stick.y = 0; keys(); };
  window.addEventListener('pointerdown', e => {
    if (live() && e.pointerType === 'mouse' && !(e.target.closest && e.target.closest('button, .tablet'))) { attack(); return; }      // with a mouse, a click is a blow: he is moved by the keys
    if (!live() || id !== null || (e.target.closest && e.target.closest('button, .tablet')) || e.clientX > window.innerWidth * 0.5) return;      // the right half belongs to the buttons
    const r = pad.getBoundingClientRect(); id = e.pointerId; ox = e.clientX; oy = e.clientY;
    pad.style.transform = `translate(${ox - r.left - r.width / 2}px, ${oy - r.top - r.height / 2}px)`; pad.classList.add('held');
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const m = Math.hypot(dx, dy);
    if (m > R) { dx *= R / m; dy *= R / m; }
    stick.x = dx / R; stick.y = dy / R; knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, e => { if (e.pointerId === id) drop(); });
  const MOVE = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
  window.addEventListener('keydown', e => {
    if (!live()) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (MOVE[k]) { held.add(MOVE[k]); keys(); e.preventDefault(); }
    else if (!e.repeat && k === ' ') { jump(); e.preventDefault(); }
    else if (!e.repeat && (k === 'j' || k === 'f' || k === 'Enter')) { attack(); e.preventDefault(); }
    else if (!e.repeat && (k === 'Shift' || k === 'k')) { dodge(); e.preventDefault(); }
    else if (!e.repeat && (k === 'e' || k === 'q' || k === 'g')) { special(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (MOVE[k]) { held.delete(MOVE[k]); keys(); } });
  stick.release = () => { held.clear(); drop(); };
  return stick;
}
