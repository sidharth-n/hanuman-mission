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
