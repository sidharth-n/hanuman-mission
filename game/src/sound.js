// Sound: one song on a loop under the whole game, a chant over its big moments, and one switch for both.
// A browser only lets sound begin after the player's first touch or key, so the song starts there, from its beginning.
const DIR = import.meta.env.DEV ? '/local-audio/' : 'assets/audio/';

export function createSound(store) {
  let on = store.get('sound', 'on') === 'on', ok = true, started = false;
  let ctx = null, gain = null, bytes = null, chantBuf = null, voice = null, voiceAt = -10, wanted = 0;

  const music = new Audio();
  music.loop = true; music.preload = 'auto'; music.muted = !on;
  music.addEventListener('error', () => { ok = false; document.body.classList.add('nosound'); });      // no song with this build: no switch either
  music.src = DIR + 'music.mp3';
  fetch(DIR + 'chant.mp3').then(r => (r.ok ? r.arrayBuffer() : null)).then(b => { bytes = b; decode(); }).catch(() => {});

  function decode() {
    if (!ctx || !bytes || chantBuf) return;
    const data = bytes; bytes = null;
    ctx.decodeAudioData(data, buf => { chantBuf = buf; if (performance.now() - wanted < 900) play(); }, () => {});      // asked for a moment before it was ready
  }

  function play() {
    if (ctx.state !== 'running') ctx.resume();
    if (voice) { voice.onended = null; try { voice.stop(); } catch { /* already over */ } }
    voice = ctx.createBufferSource(); voice.buffer = chantBuf; voice.connect(gain); voice.start(); voiceAt = ctx.currentTime;
    music.volume = 0.45;      // the song steps back under the chant (phones that fix the volume simply keep it level)
    const mine = voice; voice.onended = () => { if (voice === mine) { voice = null; music.volume = 1; } };
  }

  // the first touch or key: the song begins, and the chant is made ready
  function begin() {
    if (started || !ok) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = on ? 1 : 0; gain.connect(ctx.destination); }
    if (ctx && ctx.state !== 'running') ctx.resume();
    decode();
    music.currentTime = 0;
    music.play().then(() => { started = true; for (const e of EVENTS) window.removeEventListener(e, begin, true); }).catch(() => {});      // not allowed yet: the next touch tries again
  }
  const EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];
  for (const e of EVENTS) window.addEventListener(e, begin, true);

  // never keep playing behind another app
  document.addEventListener('visibilitychange', () => {
    if (!started) return;
    if (document.hidden) { music.pause(); if (ctx) ctx.suspend(); }
    else { music.play().catch(() => {}); if (ctx) ctx.resume(); }
  });

  return {
    get on() { return on; },
    get info() { return { ok, started, playing: !music.paused, at: +music.currentTime.toFixed(1), chantReady: !!chantBuf, chanting: !!voice, volume: music.volume }; },      // for checking
    toggle() {
      on = !on; store.set('sound', on ? 'on' : 'off');
      music.muted = !on; if (gain) gain.gain.value = on ? 1 : 0;
      if (on && started && music.paused && !document.hidden) music.play().catch(() => {});
      return on;
    },
    // the chant: once per moment, begun again if a new moment comes while it is still sounding
    chant() {
      if (!on || !ok) return;
      wanted = performance.now();
      if (!ctx || !chantBuf) return;
      if (voice && ctx.currentTime - voiceAt < 1.5) return;
      play();
    },
  };
}
