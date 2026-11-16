// Sound: one song under the run, a chant over its big moments, and one switch for both.
// The song plays only while he runs: it comes in from its beginning once the opening chant is over, is held while the game is
// paused, and is silent once the run is over.
const DIR = import.meta.env.DEV ? '/local-audio/' : 'assets/audio/';

export function createSound(store) {
  let on = store.get('sound', 'on') === 'on', ok = true;
  let ctx = null, gain = null, bytes = null, chantBuf = null, voice = null, voiceAt = -10, wanted = 0;
  let held = false, timer = 0;      // the song waiting, unheard, for the opening chant to finish

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

  // a browser only lets sound begin after the player's first touch or key: that touch makes the chant ready
  const EVENTS = ['pointerup', 'touchend', 'click', 'keydown'];
  function unlock() {
    if (!ok) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !ctx) { ctx = new AC(); gain = ctx.createGain(); gain.gain.value = on ? 1 : 0; gain.connect(ctx.destination); }
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume();
    decode();
    if (ctx.state === 'running') for (const e of EVENTS) window.removeEventListener(e, unlock, true);
  }
  for (const e of EVENTS) window.addEventListener(e, unlock, true);

  // never keep sounding behind another app (the game itself pauses the run, and with it the song)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { music.pause(); if (ctx) ctx.suspend(); } else if (ctx) ctx.resume();
  });

  return {
    get on() { return on; },
    get info() { return { ok, held, muted: music.muted, playing: !music.paused, at: +music.currentTime.toFixed(1), chantReady: !!chantBuf, chanting: !!voice, volume: music.volume }; },      // for checking
    toggle() { on = !on; store.set('sound', on ? 'on' : 'off'); music.muted = held || !on; if (gain) gain.gain.value = on ? 1 : 0; return on; },
    // A run begins: the chant first, then the song from its beginning. The song is set going at once but unheard, because a phone
    // only lets it start from the player's own touch; when the chant is over it is taken back to its beginning and let through.
    start() {
      if (!ok) return;
      unlock(); clearTimeout(timer);
      const wait = on && chantBuf ? chantBuf.duration : on && ctx ? 5.5 : 0;
      held = wait > 0; music.muted = held || !on; music.currentTime = 0; music.volume = 1; music.play().catch(() => {});
      this.chant();
      if (held) timer = setTimeout(() => { held = false; music.currentTime = 0; music.muted = !on; }, wait * 1000);
    },
    pause() { music.pause(); if (voice) { voice.onended = null; try { voice.stop(); } catch { /* already over */ } voice = null; music.volume = 1; } },      // the game is paused: the song held where it is, the chant cut
    resume() { if (ok) music.play().catch(() => {}); },                                   // and taken up again from there
    stop() { music.pause(); clearTimeout(timer); held = false; },                         // the run is over
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
