// Hanuman Mission: boot, game loop and rules.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Hero, LANES as LANE_X } from './hero.js';
import { World, SECTIONS, FIRE_AT, END_AT, FIGHT_AT, FIGHT_MID, LANKINI_AT, groundAt } from './world.js';
import { Fight, PLANS } from './fight.js';
import { Director, fit } from './scene.js';
import { createStory } from './story.js';
import { createLanka } from './lanka.js';
import { Debris } from './debris.js';
import STORY from './story.json';
import LINES from './lines.json';
import { START_SPEED, MAX_SPEED, ACCEL, speedAt } from './pace.js';
import { listen, fightControls } from './input.js';
import { createSound } from './sound.js';
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';

const KIT = ['market-stall', 'rakshasa-statue', 'brazier', 'cart', 'pots', 'barricade', 'palace', 'courtier', 'shiva', 'nandi'];
const CAST = ['hanuman', 'guard', 'lankini', 'sita', 'ravana'];      // the characters, kept beside the world's pieces
const LAMPS_FOR_POWER = 20, GIANT_SECS = 5, FLIGHT_SECS = 6, WINDS_FOR_FLIGHT = 3, WIND_SECS = 60, OPEN_FLIGHT = 3.6;      // gusts that charge a flight; seconds for it to charge by itself; the flight every run opens with
//   // lamps that fill the strength meter; how long he stays giant
const NIGHT = new THREE.Color(0x070b1c), BLAZE = new THREE.Color(0x2b0d04);
const FOG_NIGHT = new THREE.Color(0x0b1230), FOG_BLAZE = new THREE.Color(0x3a1407);
const GROVE_SKY = new THREE.Color(0x0b1a33), FOG_GROVE = new THREE.Color(0x1c3a5c), GROVE_LIGHT = new THREE.Color(0xa9c8ff);      // the grove: a clear moonlit blue
const INDOORS = new THREE.Color(0x0d0804), FOG_INDOORS = new THREE.Color(0x1d1208);      // inside the palace: lamplit dark instead of night sky
const SKY_LIGHT = new THREE.Color(0x7f95d8), LAMP_LIGHT = new THREE.Color(0xd9a25e), FIRE_LIGHT = new THREE.Color(0xff9a5a), MOON_LIGHT = new THREE.Color(0xb4c4ff), tint = new THREE.Color();

const $ = id => document.getElementById(id);
const ui = { loading: $('loading'), menu: $('menu'), panel: $('panel'), result: $('result'), fill: $('bar').firstElementChild, loadLine: $('loadLine'),
  hud: $('hud'), dist: $('dist'), gold: $('gold'), meter: $('meter'), fill2: $('meter').querySelector('i'), alert: $('alert'), fps: $('fps'), fly: $('fly'), giant: $('giant'),
  pad: $('pad'), strike: $('strike'), dodge: $('dodge'), card: $('card'), fade: $('fade') };
// what the player chose last time, kept on the device
const store = { get(k, d) { try { return localStorage.getItem('hm.' + k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('hm.' + k, v); } catch { /* private mode */ } } };
const phone = window.matchMedia('(pointer: coarse)').matches;
// Smooth: plainer shading and fewer pixels, the default on a phone. Rich: full shading, the default on a computer.
const settings = { gfx: store.get('gfx', phone ? 'smooth' : 'rich'), vib: store.get('vib', 'on') === 'on' };
const sharpest = () => Math.min(window.devicePixelRatio || 1, settings.gfx === 'rich' ? (phone ? 1.75 : 2) : 1.25);
const buzz = pattern => { if (settings.vib && navigator.vibrate) navigator.vibrate(pattern); };
const sound = createSound(store);      // the song under the game and the chant over its big moments
const query = new URLSearchParams(location.search), debug = query.has('debug');
const explore = query.has('explore');      // ?explore: the whole route with nothing in his way, for looking round
const GIANT = 1.8;      // how many times his own size he grows to meet Lankini (one of his powers, like flight)
const startAt = debug || explore || query.has('fight') ? Math.max(0, SECTIONS.findIndex(s => s.id === (query.get('at') || (query.has('fight') ? 'court' : '')))) : 0;      // ?fight starts at the palace court, a short run from the guards      // &at=court starts a run at that section
const t0 = performance.now();

const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true, powerPreference: 'high-performance' });
let pixelRatio = sharpest();
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = NIGHT.clone();
scene.fog = new THREE.FogExp2(FOG_NIGHT.getHex(), 0.016);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.2;
const hemi = new THREE.HemisphereLight(0x7f95d8, 0x241a12, 1.0); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb4c4ff, 2.4); moon.position.set(-18, 40, 36); scene.add(moon);   // cool fill from behind the camera so his back reads
const camera = new THREE.PerspectiveCamera(56, 1, 0.3, 700);

const state = { mode: 'loading', speed: 0, dist: 0, gold: 0, danger: 0, slow: 0, shake: 0, fire: false, blaze: 0, grow: 0, alertT: 0, falling: [],
  tscale: 1, slowT: 0, slowK: 1, intro: 0, low: 0,        // slow motion, opening sweep, low hero shot
  meter: 0, giant: 0, big: 0, burned: 0, cine: 0,
  wind: 0, flight: 0, safe: 0,
  sec: 0, from: 0, inside: 0, garden: 0, alarm: false, fallT: 0, kept: null };      // section he is in, section a new run starts from, how far indoors 0..1                           // flight charge 0..1, seconds of flight left, seconds nothing can hit him                 // strength meter 0..1, seconds of giant left, how grown he is 0..1
let hero, world, tailFire, tailLight, aura, fight, director, story, lanka, debris;
const rout = { next: 0 };      // the fire run: where the next knot of guards will stand in his road
const SHARE = { title: 'Hanuman Mission', url: 'https://hanuman-mission.pages.dev/' };      // what the Share button hands to the phone's own share sheet
let queued = null;      // a leap asked for a moment before he could make it: made as soon as he can
let stick = null;       // the fight's thumb stick

let fixed = null;      // [width, height] when recording at an exact size
let film = null;       // ?debug&film: the stage for filming (film.js), never fetched in play
function resize() {
  const w = fixed ? fixed[0] : window.innerWidth, h = fixed ? fixed[1] : window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// Every model and picture is asked for under the name of this build of them (vite.config.js), so a changed one is never
// answered from a copy kept by the browser or the offline cache.
THREE.DefaultLoadingManager.setURLModifier(u => (/^(blob:|data:)/.test(u) ? u : u + (u.includes('?') ? '&' : '?') + 'v=' + __STAMP__));

async function load() {
  const loader = new GLTFLoader(); let done = 0;
  const names = [...CAST, 'gada', 'guard-sword', ...KIT];
  const file = name => name === 'hanuman' && query.get('hero') === 'b' ? 'hanuman-b' : name;      // ?hero=b plays a second build of him, when one lies beside the first
  // ?debug&try=ravana:picks/ravana-new-faces : a character's file under trial is loaded in place of the game's own, so a reworked
  // character can be seen in the game before it is put there
  const trial = debug ? Object.fromEntries((query.get('try') || '').split(',').filter(Boolean).map(s => s.split(':'))) : {};
  // A file that does not come is asked for again, by itself (Sid, on his phone with two bars: "sometimes I get this error.
  // reload fixes it mostly... this is bad UX at start"): 25 MB in 22 files, and one dropped request used to fail the whole
  // start. Each file is tried four times, a little longer apart each time, under a fresh address so that no failed answer
  // is handed back; meanwhile the line says it is slow, not that it failed. No more than five files are fetched at once,
  // so a weak signal is not shared out among twenty.
  const words = ui.loadLine.textContent; let slow = 0;
  const again = async get => {
    for (let n = 1; ; n++) {
      try { const got = await get(n > 1 ? (u => u + (u.includes('?') ? '&' : '?') + 'again=' + n) : (u => u)); if (n > 1 && --slow <= 0) { slow = 0; ui.loadLine.textContent = words; } return got; }
      catch (err) { if (n >= 4) throw err; if (n === 1) slow++; ui.loadLine.textContent = 'Slow connection. Still loading'; await new Promise(r => setTimeout(r, 500 * n * n)); }
    }
  };
  const queue = []; let busy = 0;
  const turn = job => new Promise((yes, no) => { const run = () => { busy++; job().then(yes, no).finally(() => { busy--; const next = queue.shift(); if (next) next(); }); }; if (busy < 5) run(); else queue.push(run); });
  const one = name => turn(() => again(u => loader.loadAsync(u(trial[name] ? `${trial[name]}.glb` : `assets/${CAST.includes(name) ? '' : 'world/'}${file(name)}.glb`)))).then(g => { done++; ui.fill.style.width = `${Math.round(done / names.length * 100)}%`; return [name, g]; });
  const tl = new THREE.TextureLoader(), pic = at => again(u => tl.loadAsync(u(at)));
  const [models, city, glow, paving, sky] = await Promise.all([Promise.all(names.map(one)).then(Object.fromEntries),
    pic('assets/tex/city.jpg'), pic('assets/tex/city-glow.jpg'), pic('assets/tex/paving.jpg'), pic(debug && query.get('sky') ? query.get('sky') : 'assets/tex/sky.jpg')]);      // ?debug&sky=<picture>: another sky under trial (a whole panorama is laid once round)
  world = new World(scene, models, { city, glow, paving, sky }, { lite: settings.gfx !== 'rich', bare: explore });
  world.onBell = () => { if (state.mode !== 'run') return; state.alarm = true; say(LINES.bell, 2.8); buzz([40, 50, 40, 50, 40]); sound.fx('bell', { gap: 4 }); };
  world.onSound = name => { if (state.mode === 'run') sound.fx(name, { gap: 0.3 }); };      // what the road throws at him
  hero = new Hero(models.hanuman); scene.add(hero.root); hero.attachMace(models.gada.scene);
  fight = new Fight({ scene, hero, gltf: models.guard, sword: models['guard-sword'].scene, lankini: models.lankini, sound, buzz, groundAt, more: what => { say(STORY.alerts[what], 2.4); sound.fx('bell', { rate: 0.8, gap: 1 }); buzz([40, 60, 40]); }, shake: v => { state.shake = Math.max(state.shake, v); }, slowMotion });
  stick = fightControls(ui.pad, { live: () => state.mode === 'fight', attack: () => tap('strike', () => fight.attack()), dodge: () => tap('dodge', () => fight.dodge()),
    jump: () => tap('jump', () => fight.jump()), special: () => press2('giant', usePower) }); fight.stick = stick;

  director = new Director(camera, { root: $('drama'), who: $('who'), line: $('line'), skip: $('skip') }); director.sound = sound;
  story = createStory({ scene, hero, fight, director, models, groundAt, sound, buzz, say, card, hold, go: resumeRun, dash: v => { state.dash = v; }, keep: list => { world.keep = new Set(list); }, battle: (mid, plan, done, scale) => { state.fightDone = done; startFight(mid, plan, scale); }, ask, grow, giant: GIANT, shake: a => { state.shake = Math.max(state.shake || 0, a); },
    fade, light: on => { tailFire.visible = on; }, ablaze, credits, unask, fireMat: world.flameMat,
    // a great thing broken through in a scene (the doors of Ravana's hall): its pieces thrown on the way he is going
    smash: (x, y, z) => { for (const dx of [-2.6, 0, 2.6]) debris.burst(x + dx, y + (dx ? 2.4 : 4.6), z, 16, 0.6, 10, 0, 7); fight.sparks.floor = y; fight.sparks.burst({ x, y: y + 2.5, z }, 18, [1, 0.6, 0.2], 10, 0, 1); state.shake = Math.max(state.shake, 0.9); sound.fx('smash'); buzz([30, 20, 140]); },
    // the veils of a place (shafts of moonlight, the mist on the grass) put out for a shot that would be taken through them, and lit again after
    // Nobody of the standing crowd is left in the way of a shot: the courtiers within r of the line from a to b (x, z) are taken out of the hall
    clearWay: (a, b, r = 1.6) => { const P = new THREE.Vector3(), dx = b[0] - a[0], dz = b[1] - a[1]; for (const c of world.chunks.values()) c.group.traverse(o => { if (o.spawned !== 'courtier') return; o.getWorldPosition(P);
      const t = Math.max(0, Math.min(1, ((P.x - a[0]) * dx + (P.z - a[1]) * dz) / (dx * dx + dz * dz))); if (Math.hypot(P.x - a[0] - dx * t, P.z - a[1] - dz * t) < r) o.visible = false; }); },
    veil: show => { for (const c of world.chunks.values()) c.group.traverse(o => { if (o.userData.veil) o.visible = show; }); },
    mist: d => { state.thin = d; },      // the air of a place cleared for one shot that looks a long way through it (null: as the place has it)
    moonAt: p => { moon.position.set(...(p || [-18, 40, 36])); },      // and the moon put behind a camera that looks back along the road (null: where it hangs)
    // the picture held for a character's entrance: the air thick and dark so that all but what is close to the lens falls away, and her name under her
    hush: on => { state.held = on ? fight.boss.root : null; },
    name: (title, sub) => { const el = $('intro'); el.hidden = !title; if (title) { el.children[0].textContent = title; el.children[2].textContent = sub || ''; for (const c of el.children) { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } } },
    // the last high shots: the whole city laid round the street, the air cleared so it is seen from far up
    sky: on => { if (on) { const z = hero.root.position.z; lanka.show(z, groundAt(z), { half: 36, front: 132, back: (world.behind + 1) * 24 + 12 }); state.thin = 0.0016; camera.far = 1500; } else { lanka.hide(); state.thin = null; camera.far = 700; } camera.updateProjectionMatrix(); },
    finish: () => { credits(-1); result('Lanka burns', 'Burned', state.burned); $('fromLine').textContent = STORY.cards.end; $('fromLine').hidden = false; $('shareLine').hidden = $('share').hidden = false; } });
  lanka = createLanka(scene, world.flameTex); debris = new Debris(scene);
  tailFire = new THREE.Group(); tailFire.visible = false; scene.add(tailFire);
  for (const s of [0.8, 0.55, 0.35]) { const f = new THREE.Sprite(world.flameMat); f.userData.s = s; tailFire.add(f); }
  tailLight = new THREE.PointLight(0xff7a2a, 0, 20, 1.8); scene.add(tailLight);

  // the glow that shows his strength is up
  aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.flameTex, color: 0xffd98a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
  aura.position.y = 1.15; aura.visible = false; hero.root.add(aura);
  world.update(0, 0); placeCamera(1, true);
  // Everything is made ready before the run, behind the loading screen: the streets, the cast, the grove and Ravana's
  // hall, the burning city of the last shots. Left to their first appearance, Sita, Ravana and the guards held the
  // game still on a phone at the moment he came into the grove.
  world.warm(renderer, camera);
  state.loadMs = Math.round(performance.now() - t0);
  if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);      // lettering in place before the menu shows
  state.mode = 'ready'; screen('menu');
}

// One full-screen layer at a time: 'loading' | 'menu' | 'panel' | 'result', or none while running.
function screen(name) {
  for (const k of ['loading', 'menu', 'panel', 'result']) ui[k].hidden = k !== name;
  const inRun = state.mode === 'run' || state.mode === 'paused' || state.mode === 'fight';
  ui.hud.hidden = ui.fly.hidden = ui.giant.hidden = !inRun;
  const inFight = inRun && fight && fight.active;      // the fight's own controls
  ui.pad.hidden = ui.strike.hidden = ui.dodge.hidden = $('jump').hidden = !inFight; document.body.classList.toggle('fighting', !!inFight);
  if (!inRun) ui.alert.hidden = true;
}

function pause() {
  if (state.mode !== 'run' && state.mode !== 'fight' && state.mode !== 'scene') return;
  state.was = state.mode; state.mode = 'paused'; sound.pause(); if (stick) stick.release(); $('panelTitle').textContent = 'Paused'; $('resume').textContent = 'Resume'; $('quit').hidden = false; screen('panel');
}
function openSettings() { $('panelTitle').textContent = 'Settings'; $('resume').textContent = 'Done'; $('quit').hidden = true; screen('panel'); }
function resume() { if (state.mode === 'paused') { state.mode = state.was || 'run'; sound.resume(); if (state.fire) sound.blaze(true); last = performance.now(); screen(null); } else screen('menu'); }

// Back to the title: the street as it was before the run.
function home() {
  unrout(); world.reset(); fight.clear(); story.reset(true); if (director.active) director.skipQuiet(); unask(); credits(-1); $('intro').hidden = true; state.thin = null; state.dusk = 0; state.held = null; hero.reset(); sound.stop(); ui.fade.classList.remove('on'); ui.card.hidden = true;
  Object.assign(state, { orbit: null, mode: 'ready', fought: false, vast: 0, fightDone: null, tall: 0, tw: null, asking: null, speed: 0, dist: 0, fire: false, blaze: 0, grow: 0, big: 0, giant: 0, flight: 0, shot: null, intro: 0, low: 0, falling: [], tscale: 1, slowT: 0, from: 0, kept: null, inside: 0 });
  tailFire.visible = false; tailLight.intensity = 0; hero.root.scale.setScalar(1); aura.visible = false; world.behind = 3;
  world.update(0, 0); screen('menu');
}

// A held picture in which one figure alone is sharp: the world is drawn small and soft behind her (its light kept, only
// a little lowered), and she is drawn over it as she is. No black screen: the place stays, out of focus.
let soft = null;
function renderHeld(sharp) {
  if (!soft) {
    const rt = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType });
    const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: rt.texture }, px: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 px; varying vec2 vUv;
        void main() {
          vec3 c = vec3(0.0); float n = 0.0;
          for (int x = -3; x <= 3; x++) for (int y = -3; y <= 3; y++) { float w = max(0.0, 1.0 - length(vec2(float(x), float(y))) / 4.6); c += texture2D(map, vUv + vec2(float(x), float(y)) * px).rgb * w; n += w; }
          gl_FragColor = vec4(c / n * 0.66, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    // softened once more at the small size and only then laid over the screen: enlarged straight from the first pass, bright lamps showed as a grid of dots
    const rt2 = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType, depthBuffer: false });
    const lay = new THREE.Mesh(quad.geometry, new THREE.ShaderMaterial({ uniforms: { map: { value: rt2.texture } }, depthTest: false, depthWrite: false, vertexShader: mat.vertexShader,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` })); lay.frustumCulled = false;
    soft = { rt, rt2, mat, stage: new THREE.Scene(), over: new THREE.Scene(), eye: new THREE.Camera() }; soft.stage.add(quad); soft.over.add(lay);
  }
  const w = Math.max(64, Math.round(renderer.domElement.width / 5)), h = Math.max(64, Math.round(renderer.domElement.height / 5));
  if (soft.rt.width !== w || soft.rt.height !== h) { soft.rt.setSize(w, h); soft.rt2.setSize(w, h); }
  soft.mat.uniforms.px.value.set(1.4 / w, 1.4 / h);
  const was = sharp.visible; sharp.visible = false;
  renderer.setRenderTarget(soft.rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
  sharp.visible = was;
  renderer.setRenderTarget(soft.rt2); renderer.render(soft.stage, soft.eye); renderer.setRenderTarget(null);
  renderer.render(soft.over, soft.eye);
  const hidden = []; for (const o of scene.children) if (o !== sharp && o.visible && !o.isLight) { o.visible = false; hidden.push(o); }      // her alone, in the same light, over it
  const sky = scene.background; scene.background = null; renderer.autoClear = false; renderer.clearDepth();
  renderer.render(scene, camera);
  renderer.autoClear = true; scene.background = sky; for (const o of hidden) o.visible = true;
}

// The end credits: card n of them is shown (-1: none).
function credits(n) { const el = $('credits'); el.hidden = n < 0; [...el.children].forEach((c, i) => c.classList.toggle('on', i === n)); }
// The phone's own share sheet; where there is none, the address is copied instead.
function share() {
  const b = $('share'), said = t => { b.textContent = t; setTimeout(() => { b.textContent = 'Share'; }, 2200); };
  if (navigator.share) navigator.share(SHARE).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(SHARE.url).then(() => said('Link copied'), () => said(SHARE.url.replace('https://', '')));
  else said(SHARE.url.replace('https://', ''));
}

function result(title, thirdLabel, third) {
  const best = Math.max(+store.get('best', 0), Math.round(state.dist)); store.set('best', best);
  $('resultTitle').textContent = title; $('rDist').textContent = Math.round(state.dist).toLocaleString(); $('rLamps').textContent = state.gold;
  $('rThirdLabel').textContent = thirdLabel; $('rThird').textContent = (third ?? best).toLocaleString();
  // caught beyond the first stretch: the next run takes up from the start of the place he had reached
  if (state.dist >= END_AT) { state.from = 0; state.kept = null; }
  $('shareLine').hidden = $('share').hidden = true;      // offered only when the tale is told to its end
  $('again').textContent = state.retry ? 'Fight again' : state.from > 0 ? 'Continue' : 'Run again'; $('fromLine').textContent = state.retry ? 'Straight back to the fight' : state.from > 0 ? `From ${SECTIONS[state.from].name}` : ''; $('fromLine').hidden = !state.retry && state.from === 0;
  state.mode = 'ready'; sound.stop(); screen('result');
}

// from: the section the run takes up from (0 = the gate). What he carried when he reached it is given back.
function start(from = 0, fresh = false, straight = false) {
  if (typeof from !== 'number') from = 0;
  state.retry = null; teach(null); nudge(null);
  if (fresh || from === 0) lesson.known.clear();      // a game begun from the title or from the gate is taught again: each arrow once
  story.reset(fresh); if (director.active) director.skipQuiet(); unask(); credits(-1); $('intro').hidden = true; state.thin = null; state.dusk = 0; state.held = null; ui.fade.classList.remove('on'); ui.card.hidden = true;
  const sec = SECTIONS[from], kept = from > 0 && state.kept ? state.kept : { gold: 0, meter: 0, wind: 1 };      // a new run begins with the wind in hand
  const back = debug ? +query.get('back') || 0 : 0;      // ?debug&at=grove&back=40: a run that takes up 40 m short of a place, to try the way into it
  unrout(); world.reset(); fight.clear(); hero.reset(); hero.root.position.set(0, groundAt(-sec.from + back), -sec.from + back);
  Object.assign(state, { orbit: null, dash: 0, mode: 'run', fought: false, ramp: 0, vast: 0, fightDone: null, tall: 0, tw: null, asking: null, speed: speedAt(sec.from), dist: sec.from, danger: 0, slow: 0, shake: 0, fire: false, blaze: 0, grow: 0, falling: [],
    tscale: 1, slowT: 0, slowK: 1, intro: INTRO, low: 0, grown: false, shot: null, giant: 0, big: 0, burned: 0, cine: 6, flight: 0, safe: 2, sec: from, from, alarm: false, fallT: 0,
    inside: world.kindAt(-sec.from) === 'hall' ? 1 : 0, ...kept, kept });
  world.behind = 3;
  tailFire.visible = false; tailLight.intensity = 0; hero.root.scale.setScalar(1); aura.visible = false;
  queued = null; view.join = 0; screen(null); last = performance.now();
  world.update(0, hero.root.position.z);
  // ?debug&at=grove&scene=court: straight to one scene of the story, to see and hear it by itself
  if (debug && typeof story[query.get('scene')] === 'function') { const name = query.get('scene'); setTimeout(() => { if (state.mode !== 'run') return; state.flight = 0.02; setTimeout(() => story[name](), 1300); }, 1500); }
  const opening = !story.done.lankini && -hero.root.position.z < LANKINI_AT;
  sound.start(opening); if (opening) sound.score('run', { rise: 1.2 });      // the way in from the sea gate has its own music      // the song is for the journey proper: it begins when Lankini has let him pass (a run that takes up beyond her has it from the first step)
  // every run opens in the air: he rises and flies in over the road as the view comes round behind him, then lands and runs
  if (straight) return;      // straight into a fight he lost: no flight in, no name of the place
  state.opening = true; state.flight = OPEN_FLIGHT; hero.startFlight(); slowMotion(1.4, 0.45); sound.fx('wing');
  card(SECTIONS[from].id);
}
// He was thrown down in a fight: the next try is that fight, at once (Sid: "when he fails don't start the story part:
// start from the fight only, always"). The place is made as a run from its start makes it, and he is put before them.
function rematch() {
  const kind = state.retry; start(state.from, false, true);
  if (kind === 'boss') { state.dist = LANKINI_AT; hero.root.position.set(0, groundAt(-LANKINI_AT), -LANKINI_AT); world.update(0, hero.root.position.z); return story.rematch(); }
  state.dist = FIGHT_AT; state.fought = true; hero.root.position.set(0, groundAt(-FIGHT_AT), -FIGHT_AT); world.update(0, hero.root.position.z); startFight();
}

// The player is asked before he grows to meet Lankini: one button, or Enter.
// A question the story waits on. With no words of its own it is the one the page carries (Lankini's); label: what the button says.
function ask(then, label = 'Yes', text = null) {
  const el = $('ask'), p = el.firstElementChild; p.dataset.own ??= p.innerHTML;
  p.innerHTML = text ?? p.dataset.own; p.hidden = text === ''; $('askYes').textContent = label;
  el.hidden = false; state.asking = () => { el.hidden = true; state.asking = null; sound.fx('tap'); then(); };
}
function unask() { $('ask').hidden = true; state.asking = null; }
// to: 0 his own size, 1 grown to hers; secs: how long the change takes
function grow(to, secs) { state.tw = { from: state.tall, to, t: 0, secs: Math.max(0.01, secs) }; }
function say(text, secs = 2.2) { ui.alert.textContent = text; ui.alert.hidden = false; state.alertT = secs; }
// The name of a place as he comes to it, with its line of the story.
function card(id, secs = 4.2) {
  const sec = SECTIONS.find(s => s.id === id); if (!sec) return;
  ui.card.firstElementChild.textContent = sec.name; ui.card.lastElementChild.textContent = STORY.cards[id] || '';
  ui.card.hidden = false; ui.card.style.animation = 'none'; void ui.card.offsetWidth; ui.card.style.animation = ''; state.cardT = secs;
}
// A cut through black, for going from one place of the story to another.
function fade(then) { ui.fade.classList.add('on'); setTimeout(() => { then(); setTimeout(() => ui.fade.classList.remove('on'), 260); }, 460); }

// Grown, his arms and his mace reach the house fronts on either side: whatever he touches breaks. The front he comes
// level with bursts at the height of his arm and the house goes down behind it; nothing of him passes through a wall
// that still stands. (Sid, 18 Nov: "when he grows and burns Lanka his hands go through buildings; whatever he touches,
// break it: physics need to be there.")
const crumbling = [];
function brush(dt) {
  const k = hero.root.scale.x, p = hero.root.position;
  if (k >= 3 && hero.root.visible) {
    const reach = 1.3 * k, still = state.mode === 'scene', ahead = still ? reach : 2 + state.speed * 0.12, back = still ? reach : 1 + reach * 0.5;
    for (const c of world.chunks.values()) for (const b of c.buildings) {
      if (b.down || !b.mesh || b.z < p.z - ahead || b.z > p.z + back || Math.abs(b.front - p.x) > reach) continue;
      b.down = true; crumbling.push({ b, t: 0, y: b.mesh.position.y, x: b.mesh.position.x, s: Math.sign(b.front) });
      const y = groundAt(b.z);
      debris.burst(b.front, y + Math.min(b.h, 1.2 * k), b.z, 9, 0.5, 7 + k, Math.sign(b.front) * 2, -state.speed * 0.4);
      fight.sparks.floor = y; fight.sparks.burst({ x: b.front, y: y + Math.min(b.h, 1.3 * k), z: b.z }, 8, [1, 0.6, 0.2], 8, 0, -1);
      state.shake = Math.max(state.shake, 0.22); sound.fx('smash', { gap: 0.22, rate: 0.85 }); state.burned++;
    }
  }
  for (let i = crumbling.length - 1; i >= 0; i--) { const f = crumbling[i]; f.t += dt; const u = Math.min(1, f.t / 0.55), e = u * u * (3 - 2 * u), m = f.b.mesh;
    m.scale.y = 1 - 0.62 * e; m.position.x = f.x + f.s * 1.1 * e; if (u >= 1) crumbling.splice(i, 1); }
}

// Set alight, nothing in his road stands: what he meets flies to pieces, and fire is left where it stood.
function shatter(o, chunk) {
  const k = hero.root.scale.x, y = groundAt(o.z);
  if (o.mesh) o.mesh.visible = false;
  debris.burst(o.x, y + 0.5, o.z, 14, 0.36, 6 + k, 0, -state.speed * 0.55);
  fight.sparks.floor = y; fight.sparks.burst({ x: o.x, y: y + 1, z: o.z }, 14, [1, 0.6, 0.2], 9, 0, -1);
  world.burn(o, chunk); state.burned++; state.shake = Math.max(state.shake, 0.3); sound.fx('smash', { gap: 0.18 }); buzz(20);
}
// The guards of Lanka stand in his road in twos and threes as he runs out, and he goes through them: each is flung
// aside as he reaches him. The street gates he is too big for burst as he passes under them.
function gauntlet(dt) {
  const p = hero.root.position, k = hero.root.scale.x;
  if (state.dist >= rout.next && state.dist < END_AT - 70) {
    rout.next = state.dist + 30 + Math.random() * 16;
    const free = fight.guards.filter(e => !e.rout), lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.7 ? 3 : 2);
    lanes.forEach((l, i) => {
      const e = free[i]; if (!e) return; const z = p.z - 64 - i * 1.7;
      e.kind('guard'); e.reset(); e.place(LANE_X[l], groundAt(z), z, 0); e.st = 'idle'; e.bar.visible = false; e.play('great_sword_idle', { fade: 0 }); e.rout = { t: -1 };
    });
  }
  for (const e of fight.guards) {
    const r = e.rout; if (!r) continue; const q = e.root.position;
    if (r.t < 0) {
      if (q.z < p.z - (1.6 + 0.9 * k)) continue;      // not yet on him
      r.t = 0; r.vx = (q.x > p.x + 0.2 ? 1 : q.x < p.x - 0.2 ? -1 : Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 6); r.vy = 10 + Math.random() * 4 + k; r.vz = -(state.speed * 0.9 + 6); r.spin = (Math.random() - 0.5) * 12;
      e.play('two_handed_sword_death', { once: true, fade: 0.06 });
      fight.sparks.floor = groundAt(q.z); fight.sparks.burst({ x: q.x, y: q.y + 1.2, z: q.z }, 10, [1, 0.9, 0.7], 8, 0, -1);
      sound.fx('hit', { gap: 0.07 }); sound.fx('smash', { gap: 0.2, rate: 1.3 }); state.shake = Math.max(state.shake, 0.32); buzz(28); state.burned++;
    } else {
      r.t += dt; r.vy -= 24 * dt; q.x += r.vx * dt; q.y += r.vy * dt; q.z += r.vz * dt; e.root.rotation.z += r.spin * dt;
      const floor = groundAt(q.z);
      if (q.y < floor) { q.y = floor; r.vy *= -0.25; r.vx *= 0.5; r.vz *= 0.5; r.spin *= 0.3; }
      if (r.t > 1.9 || q.z > p.z + 8) { e.rout = null; e.root.rotation.z = 0; e.reset(); }
    }
  }
  for (const c of world.nearby(p.z)) {
    const gate = c.group.userData.gate;
    if (!gate || !gate.visible || k < 1.6) continue;      // at his own size he runs under it
    const gz = c.group.position.z + gate.position.z;
    if (gz < p.z - (5 + 2.2 * k)) continue;
    gate.visible = false; const y = groundAt(gz);
    for (const x of [-4.6, 0, 4.6]) debris.burst(x, y + (x ? 2.5 : 6), gz, 18, 0.62, 9 + k, 0, -state.speed * 0.5);
    sound.fx('smash', { rate: 0.7, gap: 0.1 }); sound.fx('stone', { gap: 0.3 }); state.shake = Math.max(state.shake, 0.55); buzz([30, 30, 60]); state.burned++;
  }
}
function unrout() { rout.next = 0; if (fight) for (const e of fight.guards) if (e.rout) { e.rout = null; e.root.rotation.z = 0; e.reset(); } if (debris) debris.clear(); }

function hit(o, chunk) {
  o.done = true;
  if (state.fire) return shatter(o, chunk);
  state.falling.push({ mesh: o.mesh, t: 0, dir: o.x <= hero.root.position.x ? -1 : 1 });
  if (state.big > 0.3) { state.shake = 0.3; sound.fx('smash', { gap: 0.25 }); buzz(25); return; }       // giant: he simply goes through it
  if (state.danger > 0) return caught();
  state.danger = 6; state.slow = 1; state.shake = 0.5; buzz(50); sound.fx('hit'); sound.chant();
  hero.stumble(); say(LINES.stumble);
}

function caught(down) {
  if (!down) hero.play('hit_reaction', { once: true, fade: 0.08 });      // struck down in a fight he is left lying where he fell buzz([80, 60, 140]); sound.fx('hit'); sound.chant();
  result('Captured', 'Best');
}

// He ran off the raised drawbridge: down into the moat.
function fell() {
  state.mode = 'fall'; state.fallT = 0.85; hero.floor = -30; hero.vy = -2; hero.play('falling_idle', { fade: 0.1 }); buzz([120, 40, 60]); sound.fx('splash', { delay: 0.45 }); sound.chant();
}

// The palace court: the guards make their stand. The run stops, the fight's controls come up, and he must put all three
// down to go on. If they take all his lives he is captured, and the next run takes up from the gate of the court.
function startFight(mid = FIGHT_MID, plan = PLANS.court, scale = 1) {
  state.mode = 'fight'; state.orbit = null; state.shot = null; state.danger = 0; state.slow = 0; queued = null; sound.rest(); sound.score('fight', { rise: 0.3, fade: 0.5 });
  if (state.flight > 0) { state.flight = 0; hero.endFlight(); if (state.opening) { state.opening = false; state.wind = 1; } }      // on the wing when the horn sounds: he comes down to meet them
  fight.begin(mid, plan, scale);
  if (state.meter >= 1 && +store.get('smashFight', 0) < 3) { store.set('smashFight', +store.get('smashFight', 0) + 1); nudge('Mace is full. Tap Smash when they close in', 9); }
  if (scale === 1) say(STORY.alerts.guards, 2.6);
  sound.fx('bell', { rate: 0.8, gap: 1 }); sound.chant(); buzz([40, 60, 40]); screen(null);
}
function endFight(how) {
  sound.score(null, { fade: 1.3 });      // the drums die away
  fight.result = null; if (stick) stick.release();
  const then = state.fightDone; state.fightDone = null;
  if (how === 'lost') {
    for (const foe of fight.all) foe.bar.visible = false;      // nothing of the fight is left hanging over what comes next
    screen(null); if (then && then(how)) return;      // the story takes him as he fell: in the grove he is bound and led to Ravana
    state.retry = then ? 'boss' : 'guards';      // thrown down: the next try begins at this fight itself, nothing before it
    return caught(true);      // he stays where he fell, among them, until the next run
  }
  sound.fx('power'); buzz([40, 40, 120]);
  if (then) return then(how);      // the story goes on from here
  say(STORY.alerts.cleared, 2.4); resumeRun();
}
// A scene of the story begins: the run stops where it is, and nothing of the play is on screen.
function hold() {
  state.mode = 'scene'; state.orbit = null; state.shot = null; state.danger = 0; state.slow = 0; queued = null; state.tscale = 1; state.slowT = 0; state.dash = 0; sound.rest();
  if (state.flight > 0) { state.flight = 0; hero.endFlight(); if (state.opening) { state.opening = false; state.wind = 1; } }
  hero.free = true; if (stick) stick.release(); ui.card.hidden = true; screen(null);
}
// The run goes on from where he stands: after a fight, after a scene.
function resumeRun() {
  const p = hero.root.position; hero.free = false; hero.floor = 0; sound.run();
  hero.root.rotation.y = 0; hero.lane = [0, 1, 2].reduce((a, b) => Math.abs(LANE_X[b] - p.x) < Math.abs(LANE_X[a] - p.x) ? b : a);
  state.mode = 'run'; state.ramp = Math.max(state.speed, speedAt(-p.z)); state.speed = 7; state.safe = 2; state.dist = -p.z; last = performance.now(); view.join = 1;
  state.kept = { gold: state.gold, meter: state.meter, wind: state.wind }; screen(null);
}
// Out of Ravana's court with his tail alight: the fire run begins.
function ablaze() {
  const z = -(FIRE_AT + 14), y = groundAt(z);      // well past the wall at the hall's far end, so that the view behind him is past it too (he is grown here, and the view stands further back)
  hero.root.position.set(0, y, z); state.dist = -z; world.update(0, z);
  resumeRun(); state.speed = 10.5; state.vast = 0.57;      // at the pace and the size he had going down the hall: the picture before this frame was that run, seen from this same place behind him
  placeCamera(1, true); rout.next = state.dist + 22;
  for (const dx of [-2.8, 0, 2.8]) debris.burst(dx, y + (dx ? 2.2 : 4.2), z + 2, 16, 0.62, 10, 0, -9);      // what is left of the doors goes out ahead of him
  fight.sparks.floor = y; fight.sparks.burst({ x: 0, y: y + 2.4, z: z + 1 }, 16, [1, 0.6, 0.2], 10, 0, -1); state.shake = Math.max(state.shake, 0.8);
}

function ignite() {
  state.fire = true; state.danger = 0; tailFire.visible = true; slowMotion(0.9, 0.3); state.low = 1.9; world.behind = 2;
  say(LINES.ignite, 3.2); sound.fx('fire'); sound.blaze(true); buzz([40, 40, 90]);
}

function won() { unrout(); story.ending(); }      // the last scene; it ends in the result

function rules(dt) {
  state.speed = Math.min(MAX_SPEED, state.speed + ACCEL * dt);
  if (state.ramp) { state.speed = Math.min(state.ramp, state.speed + 5 * dt); if (state.speed >= state.ramp) state.ramp = 0; }      // back up to pace after the fight
  if (state.dash) { state.ramp = 0; state.speed = Math.min(state.dash, Math.max(state.speed, 7.2) + 6 * dt); }      // the story has him run flat out (from the grove fight, to where he is brought down)
  if (state.danger > 0) state.danger -= dt;
  if (state.slow > 0) state.slow = Math.max(0, state.slow - dt * 1.1);
  const p = hero.root.position;
  state.dist = -p.z;
  // on the way in from the sea gate, before the song: his feet on the stone, and now and then his breath
  if (!story.done.lankini && state.dist < LANKINI_AT + 4 && hero.name === 'fast_run' && hero.current) {
    const stride = Math.floor(hero.current.time / hero.current.getClip().duration * 2);
    if (stride !== state.stride) {
      state.stride = stride; state.steps = (state.steps || 0) + 1;
      sound.fx('step' + (1 + state.steps % 4), { rate: 0.94 + Math.random() * 0.12, gap: 0.12 });
      if (state.steps % 11 === 6) sound.fx('breath' + (1 + Math.floor(state.steps / 11) % 3), { gap: 1.5 });
    }
  }
  if (!explore && story.check(state.dist, state.fire)) return;
  if (state.giant > 0) state.giant -= dt;
  if (state.safe > 0) state.safe -= dt;
  if (state.flight > 0) { state.flight -= dt; if (state.flight <= 0) { hero.endFlight(); state.safe = 1.1; if (state.opening) { state.opening = false; state.wind = 1; } } }
  else if (state.wind < 1 && !state.fire) { state.wind = Math.min(1, state.wind + dt / WIND_SECS); if (state.wind >= 1) say(LINES.wind, 2.4); }      // the wind gathers by itself, slowly
  state.big += ((state.giant > 0 ? 1 : 0) - state.big) * Math.min(1, dt * 4);
  // each new place along the route is named as he enters it, and becomes where the next run takes up from
  const sec = SECTIONS.findLastIndex(s => state.dist >= s.from);
  if (sec > state.sec) {
    state.sec = sec; state.from = sec; state.kept = { gold: state.gold, meter: state.meter, wind: state.wind };
    if (!SECTIONS[sec].fire) card(SECTIONS[sec].id);
  }
  if (!state.fought && !state.fire && !explore && state.dist >= FIGHT_AT && state.dist < FIGHT_MID + 6) { state.fought = true; return startFight(); }
  if (!state.fire && state.dist >= FIRE_AT) ignite();
  if (state.fire) {
    state.blaze = Math.min(1, state.blaze + dt * 0.35);
    state.grow = Math.min(1, Math.max(0, (state.dist - (END_AT - 190)) / 120));      // he grows only at the last, as he breaks out through the city
    if (state.grow > 0 && !state.grown) { state.grown = true; slowMotion(1.1, 0.35); state.low = 2.4; }
    state.burned += world.igniteUpTo(p.z); gauntlet(dt);
    if (state.dist >= END_AT) return won();
  }
  state.vast += ((state.fire ? 1 : 0) - state.vast) * Math.min(1, dt * 1.1);
  hero.root.scale.setScalar((1 + state.vast * 1.4 + state.grow * 3.1) * (1 + state.tall * (GIANT - 1)));      // set alight, he grows vast: half as tall again as the doors allow in the palace, a giant over the roofs at the last
  aura.visible = state.big > 0.02; aura.material.opacity = state.big * 0.55; aura.scale.setScalar(3.4 + Math.sin(performance.now() * 0.012) * 0.25);
  const smash = state.fire || state.big > 0.3, pace = state.speed * (state.fire ? 1.15 : 1);
  const reach = 0.82 * hero.root.scale.x;
  let floor = 0;
  if (state.cine > 0) state.cine -= dt;
  const flying = state.flight > 0;
  let next = null;      // the first run: what is next in his way, for the arrow that shows the move
  for (const c of world.nearby(p.z)) {
    for (const o of c.obstacles) {
      if (o.kind === 'gap' && !state.hinted && o.z < p.z && o.z > p.z - 34) { state.hinted = true; say(LINES.gap, 2.2); }
      if (o.kind === 'gap' && !o.heard && o.z < p.z && o.z > p.z - 30) { o.heard = true; sound.fx('bridge', { gap: 1 }); }      // every raised drawbridge creaks on its chains as he nears it      // the first raised drawbridge is called out
      if (o.type === 'tunnel' && !o.done && o.z < p.z && o.z > p.z - 30) {      // the wall of the grove: nobody flies through it, and the low way under it is called out
        if (state.flight > 0) { state.flight = 0; hero.endFlight(); state.safe = Math.max(state.safe, 0.9); }
        if (!o.heard && o.z > p.z - 26) { o.heard = true; say(LINES.tunnel, 2.4); }
      }
      if (lesson.known.size < 3 && !flying && !smash && !o.done && !o.off && o.z < p.z - 1.2 && p.z - o.z < pace * 1.25 + 2 && (o.wide || Math.abs(o.x - p.x) <= reach) && (!next || o.z > next.z)) next = o;
      // on a long frame he and the thing coming at him cover more ground than it is deep: widen the test by what the frame skipped
      const dz = Math.abs(o.z - p.z), sweep = Math.max(0, (pace + (o.vz || 0)) * dt / 2 - 0.12);
      if (flying || o.done || o.off || dz > o.hd + 0.2 + sweep || (!o.wide && Math.abs(o.x - p.x) > reach)) continue;
      if (o.kind === 'gap') {      // the raised drawbridge: only a leap carries him over
        if (explore) { if (!hero.airborne && o.z < p.z && dz < o.hd + 0.2) hero.move('up'); continue; }
        if (hero.y < 0.25 && dz < o.hd - 0.3) return fell();
        continue;
      }
      // things on the ground: above them he is safe, and he can come down on top and run across.
      // a beam: safe only while sliding. Only the real footprint counts as a hit, not the space around it.
      const lift = o.kind === 'high' ? 0 : groundAt(o.z) - p.y;      // on a stairway the thing stands on higher or lower ground than he does
      const over = o.kind === 'high' ? hero.sliding : hero.y >= o.top + lift - 0.45;
      if (smash) hit(o, c);
      else if (over) {
        if (o.kind !== 'high' && !o.sharp && hero.vy <= 0) floor = Math.max(floor, o.top + lift);      // coming down or standing on it
        if (!o.near) {       // now and then a good leap is shown from the roadside, a good slide from low in front, in slow motion.
          o.near = true;     // Both shots are over before he lands or rises, so the road ahead is back in view with all his time to act.
          if (o.type === 'tunnel' && !explore) { shot('under', 1.15); slowMotion(1.05, 0.3); state.cine = 12; }      // sliding in under the wall is always held: the grove is first seen in that moment
          else if (state.cine <= 0 && !state.shot && !explore) {
            if (o.kind === 'high') { shot('under', 0.7); slowMotion(0.55, 0.42); state.cine = 16 + Math.random() * 10; }
            else if (hero.y > o.top + lift && hero.vy > -2) { shot('side', 0.8); slowMotion(0.65, 0.36); state.cine = 16 + Math.random() * 10; }
          }
        }
      } else if (dz <= o.hd - 0.05 + sweep && state.safe <= 0) hit(o, c);
      if (state.mode !== 'run') return;
    }
    for (const w of c.winds) {
      if (w.got || Math.abs(w.z - p.z) > 0.9 || Math.abs(w.x - p.x) > reach) continue;
      w.got = true; w.mesh.visible = false; sound.fx('wind');
      if (state.wind < 1 && !flying) { state.wind = Math.min(1, state.wind + 1 / WINDS_FOR_FLIGHT); if (state.wind >= 1) say(LINES.wind, 2.4); }
    }
    for (const k of c.coins) {
      // in flight the lamps below come up to him
      if (k.got || Math.abs(k.z - p.z) > 0.8 || Math.abs(k.x - p.x) > reach * (flying ? 1.5 : 1) || (!flying && Math.abs(k.y - (hero.y + 1)) > 1.3 * hero.root.scale.x)) continue;
      k.got = true; k.mesh.visible = false; state.gold++;
      const t = performance.now(); state.chain = t - (state.lampT || 0) < 600 ? (state.chain || 0) + 1 : 0; state.lampT = t;
      if (state.chain % 4 === 0) sound.fx('lamp', { gap: 0.15 });      // a soft tick for the first of a row and every fourth after it, never a stream
      if (!state.fire && state.giant <= 0 && state.meter < 1) {
        state.meter = Math.min(1, state.meter + 1 / LAMPS_FOR_POWER);
        if (state.meter >= 1) { say(LINES.strength, 2.2); const told = +store.get('smashTold', 0); if (told < 3) { store.set('smashTold', told + 1); nudge('Mace is full. Tap Smash to break through', 8); } }
      }
    }
  }
  if (lesson.known.size < 4) {      // the arrow for what is next in his way: a beam is slid under, a gap or a thing right across is leapt, a thing in one lane is leapt the first time and stepped round after
    let move = !next ? null : next.kind === 'high' ? 'down' : next.kind === 'gap' || next.wide || (!lesson.known.has('up') && next.top < 2.3) ? 'up' : 'side';      // a leap is 1.9 m: the tall rock and the weapon rack are never taught as things to leap
    if (move && ((move !== 'side' && lesson.known.has(move)) || next === lesson.met)) move = null;      // the thing he has just learned a move on teaches no second one while he is still passing it
    lesson.next = next;
    if (move === 'side' && lesson.for !== next) {      // the arrow points to a lane that is there and has nothing standing in it beside this thing; with no such lane this thing teaches nothing
      const clear = d => {
        const x = LANE_X[hero.lane + d]; if (x === undefined) return false;
        for (const c of world.nearby(p.z)) for (const o of c.obstacles) if (!o.done && !o.off && o.z < next.z + 2 && o.z > next.z - Math.max(3, pace * 0.5) && (o.wide || Math.abs(o.x - x) < 0.6)) return false;
        return true;
      };
      const right = clear(1) && !lesson.known.has('right'), left = clear(-1) && !lesson.known.has('left');      // a way he has not yet been shown
      lesson.for = next; lesson.away = right && (!left || hero.lane < 1) ? 1 : left ? -1 : 0;
    }
    teach(move === 'side' ? (lesson.away > 0 ? 'right' : lesson.away < 0 ? 'left' : null) : move);
  }
  hero.floor = floor;
}

const look = new THREE.Vector3(), want = new THREE.Vector3(), tip = new THREE.Vector3();
const INTRO = 2.6;      // seconds for the opening sweep from in front of him to the chase view
const view = { fov: 60, dip: 0, air: false, back: 5, duck: 0, join: 0 };
const lookWant = new THREE.Vector3();
// The view in flight: just behind and above him, looking well down the road, so that what is coming is never hidden by his back.
const flyCam = { back: 2.3, up: 1.5, ahead: 14, lookY: 0.8, fov: 60 };      // Sid's pick: over the shoulder and close, then closer twice
const ease = t => t * t * (3 - 2 * t);
// How to play, taught once, on the first run, as the first things come (Sid: "like in temple run... an arrow or something
// when an obstacle comes, to swipe up and then swipe down and then move, just at the start so people will know how to play").
// Each of the four moves (up, down, left, right) is shown until the player has made it once in this game, and then not again.
// It is not remembered from one game to the next: kept in the browser for good, a player who had once learned them never saw an
// arrow again (Sid, 18 Nov: "now I see no game help arrows... it was fully removed... just need to show swipe up, swipe left,
// swipe right, slide down with an arrow instruction when the player does it for the first time, then don't show it").
const lesson = { known: new Set(), show: null };
if (phone) $('teach').dataset.swipe = '';      // a swish of light the way the thumb goes; with keys, the arrow
const WORDS = phone ? { up: 'Swipe up', down: 'Swipe down', left: 'Swipe left', right: 'Swipe right' } : { up: 'Up arrow: leap', down: 'Down arrow: slide', left: 'Left arrow', right: 'Right arrow' };
function teach(move) {
  if (move === lesson.show) return; lesson.show = move; const el = $('teach');
  el.hidden = !move; if (!move) return;
  el.className = move; el.lastElementChild.textContent = WORDS[move];
}
function learned(dir) {
  if (lesson.known.has(dir) || !WORDS[dir]) return;
  lesson.known.add(dir); lesson.met = lesson.next; if (lesson.show === dir || ((dir === 'left' || dir === 'right') && (lesson.show === 'left' || lesson.show === 'right'))) teach(null);
}
// A word beside a button the player has not found yet.
let tipT = 0;
function nudge(text, secs = 7) { const el = $('tip'); el.textContent = text || ''; el.hidden = !text; tipT = text ? secs : 0; }
function slowMotion(secs, scale) { state.slowT = secs; state.slowK = scale; sound.chant(); buzz(30); }      // every slow-motion moment carries the chant and a touch on the hand

// Cinematic shots: for a few seconds the camera leaves the chase view. He keeps running and the player keeps control.
const SHOTS = {
  side:  (p, k, u) => camera.aspect < 1
    ? [[p.x + (p.x > 0.5 ? -2.6 : 2.6), 1.5 * k + hero.y * 0.6, p.z - 5.2], [p.x, 1.2 * k + hero.y * 0.9, p.z - 0.4], 66]      // phone upright: from ahead and to one side, so the whole leap stays inside the tall frame
    : [[p.x + (p.x > 0.5 ? -3.6 : 3.6), 1.25 * k + hero.y * 0.85, p.z - 0.6], [p.x, 1.15 * k + hero.y, p.z - 0.9], 62],            // alongside him, like a runner filmed from the roadside
  front: (p, k, u) => [[p.x * 0.4 + 1.1, 1.35 * k + hero.y * 0.7, p.z - 6.5 * k], [p.x, 1.3 * k + hero.y, p.z], 50],                               // ahead of him, looking back at his face
  low:   (p, k, u) => [[p.x + 1.6, 0.35, p.z - 4.2 * k], [p.x, 1.7 * k + hero.y, p.z], 58],                                         // near the ground, looking up
  drone: (p, k, u) => [[p.x * 0.3 + 2 - u * 4, 15 + u * 5, p.z + 12], [0, 1, p.z - 16], 52],                               // high above the street
  under: (p, k, u) => [[p.x + (p.x > 0.5 ? -2.2 : 2.2), 0.42, p.z - 3.0], [p.x, 0.6, p.z + 0.4], 56],                                              // low on the road ahead, as he slides toward it
  hero:  (p, k, u) => [[p.x + (1.5 - u * 0.5) * k, (0.75 + u * 0.25) * k, p.z - (3.3 - u * 0.5) * k], [p.x, 1.3 * k, p.z], 46],                 // slow push-in on him from the front, low
  orbit: (p, k, u) => [[p.x + Math.sin(u * 2.4 + 0.5) * 5.5 * k, hero.y + (1.0 + u) * k, p.z + Math.cos(u * 2.4 + 0.5) * 5.5 * k], [p.x, hero.y + 0.8 * k, p.z - 0.6], 58],      // swings round him from behind to the side
};
function shot(type, secs = 3) { if (SHOTS[type]) state.shot = { type, t: 0, secs }; }

// Wind gathered: he flies above the street for a few seconds and nothing below can touch him.
function useFlight() {
  if (state.mode !== 'run' || state.wind < 1 || state.flight > 0 || state.fire || state.giant > 0) return false;
  state.wind = 0; state.flight = FLIGHT_SECS; state.danger = 0; hero.startFlight(); sound.fx('wing');
  slowMotion(3.4, 0.32); state.shot = null; state.orbit = { t: 0, secs: 4.2, dir: hero.root.position.x > 0.5 ? -1 : 1 };      // as he rises the view is carried once round him, in slow motion, and home again
  return true;
}

// Strength meter full and a touch on its button: for a few seconds he glows and breaks through whatever is in his way.
// In a fight the same strength goes into one blow that throws every guard near him back.
function usePower() {
  nudge(null);
  if (state.mode === 'fight') { if (state.meter < 1 || !fight.special()) return false; state.meter = 0; slowMotion(0.5, 0.4); sound.fx('power'); return true; }
  if (state.mode !== 'run' || state.meter < 1 || state.fire || state.giant > 0 || state.flight > 0) return false;
  state.meter = 0; state.giant = GIANT_SECS; state.danger = 0;
  slowMotion(0.5, 0.4); state.shake = 0.4; sound.fx('power');
  return true;
}

// Taking wing: the chase view itself is carried once round him and back. It leaves from exactly where it was and arrives exactly
// where it belongs, so there is no cut at either end; it comes in closer and lower as it passes his side and his face.
const base = new THREE.Vector3(), pivot = new THREE.Vector3(), SIDE = 5.2;      // SIDE: how far from the middle of the road the view may swing
function sweep(dt, p, G) {
  const o = state.orbit; if (state.mode !== 'paused') o.t += dt;
  const u = Math.min(1, o.t / o.secs), e = u * u * u * (u * (u * 6 - 15) + 10), w = Math.sin(Math.PI * u) ** 2;      // e: slow away, quicker through the middle, slow home; w: how far into the sweep it is
  const a = e * Math.PI * 2 * o.dir, cs = Math.cos(a), sn = Math.sin(a), near = camera.aspect < 1 ? 1 + 0.35 * w : 1 + 0.1 * w;      // swings wider as it passes his side, more so on an upright phone, so all of him stays in the narrow frame
  const eye = ease(Math.min(1, u / 0.18)) * ease(Math.min(1, (1 - u) / 0.18));      // the view turns onto him early and lets go of him late, so he is never out of frame
  base.copy(camera.position); view.swept = true;
  pivot.set(p.x, G + hero.y + 0.75, p.z - 0.2);
  const dx = base.x - pivot.x, dy = base.y - pivot.y, dz = base.z - pivot.z;
  camera.position.set(pivot.x + (dx * cs + dz * sn) * near, pivot.y + dy * (1 - 0.6 * w), pivot.z + (dz * cs - dx * sn) * near);
  camera.position.x += (SIDE * Math.tanh(camera.position.x / SIDE) - camera.position.x) * eye;      // eased in toward the road's edge, never stopped dead against it
  camera.position.y = Math.max(camera.position.y, groundAt(camera.position.z) + 0.7);
  look.lerp(pivot, eye);
  if (u >= 1) state.orbit = null;
}

// The chase camera: close behind and above so he fills the lower third; it lags a little on lane changes, rises less
// than he does on a jump, drops with a slide, widens with speed and pushes in during slow motion.
function placeCamera(dt, snap) {
  const p = hero.root.position, k = hero.root.scale.x, tall = camera.aspect < 1;
  const G = p.y, slope = groundAt(p.z - 9) - G;      // the floor under him, and how much it climbs or falls just ahead
  const fast = Math.min(1, Math.max(0, (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED)));
  const slow = 1 - state.tscale, low = ease(Math.min(1, state.low));
  if (view.air && !hero.airborne && hero.fly < 0.2) view.dip = 0.28;      // landing
  view.air = hero.airborne; view.dip *= Math.exp(-dt * 9);
  const big = state.grow;
  view.duck += (hero.low - view.duck) * Math.min(1, dt * 18);      // down and up again with the slide itself, back level as he rises
  const f = hero.fly;
  let back = (tall ? 6.0 : 5.1) * (0.55 + 0.45 * k) + big * 2.6 + (1 - f) * Math.max(0, Math.min(2.2, hero.y)) * (tall ? 1.0 : 0.45);      // drawn back on a leap so he is never cut off
  let height = (tall ? 3.3 : 2.55) * (0.6 + 0.4 * k) + big * 2.0 + hero.y * 0.4 - view.duck * 0.4 - view.dip;
  back = back * (1 - 0.32 * low) - slow * 0.8; height *= 1 - 0.62 * low;
  let lookY = (1.25 + hero.y * 0.5) * k * (1 + 0.45 * low), fov = (tall ? 70 : 58) + fast * 6 - slow * 8, ahead = 9;
  if (f > 0.001) {      // taking wing: the view moves to its place above and behind him
    back += ((tall ? flyCam.back * 1.15 : flyCam.back) - back) * f; height += (hero.y + flyCam.up - height) * f;
    lookY += (flyCam.lookY - lookY) * f; ahead += (flyCam.ahead - ahead) * f; fov += ((tall ? flyCam.fov + 10 : flyCam.fov) - fov) * f;
  }

  if (director.active && director.cam) {      // a scene of the story: the director holds the camera
    fov = director.frame(camera.aspect, tall);      // an upright phone sees a narrow slice: there the director widens the lens, and draws back until those the shot must hold are in it
    look.copy(director.look); view.back = back; view.join = 1; view.fov = fov;
  } else if (fight.active && fight.cine && fight.cine.ready && state.mode !== 'ready') {
    // struck down in the fight, and the moment is held: the fight itself says where the view stands
    const c = fight.cine;
    if (c.cut) { camera.position.copy(c.at); look.copy(c.look); c.cut = false; } else { camera.position.lerp(c.at, Math.min(1, dt * 9)); look.lerp(c.look, Math.min(1, dt * 9)); }
    fov = tall ? 66 : 50; view.fov = fov; view.back = back; view.join = 1;
    fit(camera, look, fov, camera.aspect, c.keep);
  } else if (state.shot) {
    const s = state.shot; s.t += dt;
    const [at, to, f] = SHOTS[s.type](p, k, Math.min(1, s.t / s.secs));
    camera.position.set(...at); camera.position.y = Math.max(camera.position.y + G, groundAt(camera.position.z) + 0.5);      // never under a stairway
    look.set(...to); look.y += G; view.fovWant = f; view.back = back;
    if (s.t >= s.secs) state.shot = null;
  } else if (fight.active && state.mode !== 'ready') {
    // the fight: the view stands off, behind and above, the way action games hold it, so the whole floor and every guard are seen
    const c = fight.focus;
    const far = 1 + (fight.s - 1) * 0.55;      // grown, he and she are seen from further off, so both still stand whole in the view
    want.set(c.x * 0.8, G + (tall ? 6.0 : 3.9) * far, c.z + (tall ? 7.4 : 5.9) * far);
    lookWant.set(c.x * 0.92, G + 0.9 * fight.s, c.z - (tall ? 0 : 1.6));      // he stands just below the middle of the screen, clear of the thumbs, with room to see a guard coming up behind him
    camera.position.lerp(want, Math.min(1, dt * 4.5)); look.lerp(lookWant, Math.min(1, dt * 5.5));
    fov = tall ? 62 : 50; view.back = back; view.join = 1;
    // he never goes out under the picture: when a dodge or a throw brings him in beneath the view faster than it follows, it backs away with him, keeping the road he is on above its lower edge
    { const down = Math.atan2(camera.position.y - look.y, Math.hypot(camera.position.z - look.z, camera.position.x - look.x)) + fov * Math.PI / 360, need = (camera.position.y - G) / Math.tan(Math.min(1.45, down)) + 0.25 * k;      // measured to the road under him: in a roll his body is down on it
      if (camera.position.z - p.z < need) camera.position.z = p.z + need; }
  } else if (state.mode === 'ready' || state.intro > 0) {
    // title: a slow drift in front of him. On Run the camera sweeps round behind as he takes off.
    const e = state.mode === 'ready' ? 0 : ease(1 - state.intro / INTRO);
    const a = (2.5 + Math.sin(performance.now() * 0.0004) * 0.16) * (1 - e), R = 4.0 * k + (back - 4.0 * k) * e, y0 = (tall ? 0.95 : 0.75) * k;
    const lift = hero.y * (1 - e);      // while the view is still in front of him it rises with him as he takes wing
    camera.position.set(p.x + Math.sin(a) * R, G + 1.3 * k + lift * 0.7 + (height - 1.3 * k) * e, p.z + Math.cos(a) * R);
    if (!ui.result.hidden) camera.position.x = Math.max(-3, Math.min(3, camera.position.x));      // behind the result of a run the view stays on the road: grown, he would put it among the braziers
    look.set(p.x * (1 - 0.15 * e), G + y0 + lift + (lookY - y0) * e + slope * 0.5 * e, p.z - 9 * e * e * e);      // the view stays on him until it is nearly behind him, then looks down the road
    view.back = back;
  } else {
    if (view.swept) { camera.position.copy(base); view.swept = false; }      // last frame's sweep is set aside before the chase view eases on
    // the distance behind him is held exactly (a camera that trails by speed shakes whenever a frame runs long); only the amount eases
    view.back = snap ? back : view.back + (back - view.back) * Math.min(1, dt * 7);
    want.set(p.x * 0.72 + slow * (p.x > 0 ? -1 : 1), G + height, p.z + view.back);
    want.y = Math.max(want.y, groundAt(want.z) + 1.4);      // coming down a stairway, the steps behind him are higher than he is
    lookWant.set(p.x * 0.85, G + lookY + slope * 0.5, p.z - ahead);      // the view tips up a climb and down a descent
    if (snap) camera.position.copy(want);
    else if (view.join > 0) { view.join -= dt; camera.position.lerp(want, Math.min(1, dt * 5)); look.lerp(lookWant, Math.min(1, dt * 6)); }      // coming back from the fight: eased round, never cut
    else { const c = camera.position; c.x += (want.x - c.x) * Math.min(1, dt * 7); c.y += (want.y - c.y) * Math.min(1, dt * 9); c.z = want.z; }
    if (snap || view.join <= 0) look.copy(lookWant);
    if (state.orbit) sweep(dt, p, G);
  }
  if (state.shake > 0) { camera.position.x += (Math.random() - 0.5) * state.shake * 0.5; camera.position.y += (Math.random() - 0.5) * state.shake * 0.35; }
  camera.position.y = Math.max(camera.position.y, groundAt(camera.position.z) + 0.2);      // whatever placed it, the view is never under the road: from there the world is seen from below
  camera.lookAt(look); camera.rotateZ(-hero.lean * 0.3);
  const wantFov = state.shot ? view.fovWant : fov;
  view.fov = snap ? wantFov : view.fov + (wantFov - view.fov) * Math.min(1, dt * (state.shot ? 30 : 6));
  if (Math.abs(camera.fov - view.fov) > 0.02) { camera.fov = view.fov; camera.updateProjectionMatrix(); }
}

let last = performance.now(), frames = 0, acc = 0, slowFrames = 0, shown = 0;
const painted = {};      // the display is only touched when a value changes
function paint(key, value, apply) { if (painted[key] !== value) { painted[key] = value; apply(value); } }
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; last = now;
  const real = Math.min(0.05, raw);
  if (!hero) return;
  if (state.slowT > 0) state.slowT -= real;
  state.tscale += ((state.slowT > 0 ? state.slowK : 1) - state.tscale) * Math.min(1, real * 7);
  const dt = state.mode === 'paused' ? 0 : real * state.tscale;      // game time; the camera and the screen keep real time
  if (state.intro > 0) { state.intro -= real; if (state.intro <= 0 && !state.fire) world.behind = 1; }
  if (state.low > 0) state.low -= real;
  const running = state.mode === 'run', fighting = state.mode === 'fight';
  if (running) rules(dt);
  if (fighting) { fight.update(dt, real); if (fight.result) endFight(fight.result); }
  fight.tick(dt, state.mode === 'paused' ? 0 : real);
  if (state.mode === 'scene') director.update(real);
  story.update(state.mode === 'paused' ? 0 : real);
  if (state.tw) {      // he is changing size: eased from what he was to what he will be
    const w = state.tw; w.t += real; const u = Math.min(1, w.t / w.secs); state.tall = w.from + (w.to - w.from) * u * u * (3 - 2 * u); if (u >= 1) state.tw = null;
    hero.root.scale.setScalar((1 + state.vast * 1.4 + state.grow * 3.1) * (1 + state.tall * (GIANT - 1)));
  }
  if (state.cardT > 0) { state.cardT -= real; if (state.cardT <= 0) ui.card.hidden = true; }
  if (tipT > 0 && (tipT -= real) <= 0) nudge(null);
  if (!running && lesson.show) teach(null);
  if (running && queued) { queued.t -= real; const went = hero.move('up'); if (went) sound.fx('leap'); if (went || queued.t <= 0) queued = null; }
  const falling = state.mode === 'fall';
  if (falling) { state.fallT -= dt; if (state.fallT <= 0) result(LINES.fell, 'Best'); }
  const speed = falling ? 2.4 : state.speed * (1 - state.slow * 0.45) * (state.fire ? 1.15 : 1) * (state.flight > 0 ? 1.3 : 1);
  hero.update(fighting && fight.frozen ? 0 : dt, speed, state.mode === 'run' || falling, groundAt);
  world.shotOn = !!state.shot; world.sceneOn = state.mode === 'scene' || director.active; world.update(dt, hero.root.position.z);
  if (state.fire || crumbling.length) brush(dt);
  for (const f of state.falling) { f.t += dt; f.mesh.rotation.z = f.dir * Math.min(1.35, f.t * 7); f.mesh.position.y = -Math.min(0.5, f.t * 1.2); }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - real * 1.6);

  // night outside, lamplight inside the palace, firelight once the city burns
  const kind = world.kindAt(hero.root.position.z);
  state.inside += ((kind === 'hall' || kind === 'throne' ? 1 : 0) - state.inside) * Math.min(1, real * 2.5);
  state.garden += ((kind === 'grove' ? 1 : 0) - state.garden) * Math.min(1, real * 1.5);
  scene.background.copy(NIGHT).lerp(INDOORS, state.inside).lerp(GROVE_SKY, state.garden).lerp(BLAZE, state.blaze); scene.fog.color.copy(FOG_NIGHT).lerp(FOG_INDOORS, state.inside).lerp(FOG_GROVE, state.garden).lerp(FOG_BLAZE, state.blaze);
  scene.fog.density = state.thin ?? 0.016 + state.garden * 0.007;      // the grove lies in a thin mist; for the last shots from the sky the air is cleared
  if (state.dusk) scene.fog.color.multiplyScalar(0.16);
  lanka.update(now * 0.001); debris.update(dt, groundAt);
  hemi.intensity = 1.0 + state.garden * 0.3 + state.blaze * 0.25; hemi.color.copy(SKY_LIGHT).lerp(LAMP_LIGHT, state.inside * 0.85).lerp(GROVE_LIGHT, state.garden).lerp(FIRE_LIGHT, state.blaze * 0.7);
  moon.intensity = 2.4 + state.garden * 0.5;
  moon.color.copy(MOON_LIGHT).lerp(LAMP_LIGHT, state.inside);
  world.cap.material.color.copy(scene.fog.color); world.heavens.visible = state.inside < 0.5;
  if (tailFire.visible) {
    hero.tailTip(tip); const k = hero.root.scale.x;
    tailFire.children.forEach((f, n) => { const s = f.userData.s * k * (1.5 + Math.sin(now * 0.02 + n * 2) * 0.25); f.scale.set(s, s * 1.3, 1); f.position.set(tip.x, tip.y + n * 0.35 * k, tip.z + n * 0.25 * k); });
    tailLight.position.set(tip.x, tip.y + 1.2 * k, tip.z + 1.5 * k); tailLight.intensity = 26 * k * (1 + Math.sin(now * 0.03) * 0.15);
  }
  tint.setRGB(1 - state.blaze * 0.25, 1 - state.blaze * 0.7, 1 - state.blaze * 0.82).multiplyScalar(1 - state.inside); if (state.dusk) tint.multiplyScalar(0.22); if (world.pano) tint.multiplyScalar(world.panoDim);      // (a panorama made for a bright screen is taken down to the game's night)
  world.skyMat.color.copy(tint);
  placeCamera(real, false);
  if (film) film.frame();
  if (state.held) renderHeld(state.held); else if (film) film.render(); else renderer.render(scene, camera);
  if (debug) audit();

  if (running || fighting) {
    const giant = state.giant > 0 ? state.giant / GIANT_SECS : state.fire ? 1 : state.meter, fly = state.flight > 0 ? state.flight / FLIGHT_SECS : state.wind;
    paint('dist', Math.round(state.dist), v => ui.dist.textContent = v);
    paint('lamps', state.gold, v => ui.gold.textContent = v);
    paint('meter', Math.round(giant * 100), v => ui.fill2.style.width = v + '%');
    paint('full', state.meter >= 1 && state.giant <= 0 && !state.fire, v => ui.meter.classList.toggle('full', v));
    // each power: dim until charged, glowing when ready, and a ring that fills with the charge then runs down while in use
    paint('gRing', Math.round(giant * 50), v => ui.giant.style.setProperty('--p', v / 50));
    paint('gState', state.giant > 0 ? 'active' : state.meter >= 1 && !state.fire ? 'ready' : '', v => { ui.giant.classList.toggle('ready', v === 'ready'); ui.giant.classList.toggle('active', v === 'active'); });
    paint('fRing', Math.round(fly * 50), v => ui.fly.style.setProperty('--p', v / 50));
    paint('fState', state.flight > 0 ? 'active' : state.wind >= 1 && !state.fire ? 'ready' : '', v => { ui.fly.classList.toggle('ready', v === 'ready'); ui.fly.classList.toggle('active', v === 'active'); });
  }
  if (state.alertT > 0) { state.alertT -= dt; if (state.alertT <= 0) ui.alert.hidden = true; }

  // keep it smooth: if frames run long, render fewer pixels rather than stutter
  frames++; acc += raw; if (raw > 1 / 45) slowFrames++;
  if (frames >= 60) {
    const fps = frames / acc;
    if (slowFrames > 18 && pixelRatio > 0.85 && running) { pixelRatio = Math.max(0.85, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
    state.fps = Math.round(fps);
    if (debug) { ui.fps.hidden = false; ui.fps.textContent = `${state.fps} fps  px ${pixelRatio}\n${renderer.info.render.calls} draws  ${Math.round(renderer.info.render.triangles / 1000)}k tris\nload ${state.loadMs} ms\nsound ${sound.on ? 'on' : 'off'}  track ${sound.info.track} ${sound.info.at}s r${sound.info.ready}\nengine ${sound.info.engine}  effects ${sound.info.effects}`; }
    frames = 0; acc = 0; slowFrames = 0; shown++;
  }
}

listen(window, dir => {
  if (state.mode === 'scene') return director.tap();      // any touch or key goes on to the next line
  if (state.mode === 'fight' && dir === 'giant') return press2('giant', usePower);
  if (state.mode !== 'run') return;
  if (dir === 'giant') press2('giant', usePower); else if (dir === 'fly') press2('fly', useFlight);
  else if (dir !== 'tap') { const done = hero.move(dir); if (done) learned(dir); if (done && dir === 'up') sound.fx('leap'); else if (done && dir === 'down') sound.fx('slide'); queued = !done && dir === 'up' && !hero.flying ? { t: 0.28 } : null; }
});
// A power button answers every touch: a pulse and a buzz when it fires, a shake when it is not charged.
function press2(id, fn) {
  const el = $(id), ok = fn();
  el.classList.remove('hit', 'no'); void el.offsetWidth; el.classList.add(ok ? 'hit' : 'no'); if (ok) buzz([30, 30, 60]);
}
const press = (id, fn) => $(id).addEventListener('click', e => { sound.fx('tap'); fn(e); });
press('share', share); press('go', () => start(startAt, true)); press('again', () => (state.retry ? rematch() : start(state.from))); press('home', home); press('quit', home); press('resume', resume); press('openSettings', openSettings); press('pause', pause);
for (const [id, fn] of [['giant', usePower], ['fly', useFlight]]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); if (state.mode === 'run' || (state.mode === 'fight' && id === 'giant')) press2(id, fn); });
// the fight's two buttons answer on touch down, with a pulse when the move is made
function tap(id, fn) { const el = $(id), ok = fn(); if (ok) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } return ok; }
$('strike').addEventListener('pointerdown', e => { e.preventDefault(); if (state.mode === 'fight') tap('strike', () => fight.attack()); });
$('dodge').addEventListener('pointerdown', e => { e.preventDefault(); if (state.mode === 'fight') tap('dodge', () => fight.dodge()); });
$('jump').addEventListener('pointerdown', e => { e.preventDefault(); if (state.mode === 'fight') tap('jump', () => fight.jump()); });
$('askYes').addEventListener('click', e => { e.stopPropagation(); if (state.asking) state.asking(); });      // on touch down, not on release
// settings
function showSettings() {
  for (const b of $('gfx').children) b.classList.toggle('on', b.dataset.v === settings.gfx);
  $('vib').classList.toggle('on', settings.vib); $('vib').setAttribute('aria-checked', settings.vib);
}
$('gfx').addEventListener('click', e => {
  const v = e.target.dataset.v; if (!v) return;
  settings.gfx = v; store.set('gfx', v); pixelRatio = sharpest(); renderer.setPixelRatio(pixelRatio); resize(); showSettings();      // the shading itself changes the next time the game is opened
});
function showSound() { $('mute').classList.toggle('on', sound.on); $('mute').setAttribute('aria-checked', sound.on); }
press('mute', () => { sound.toggle(); showSound(); sound.fx('tap'); }); showSound();
press('vib', () => { settings.vib = !settings.vib; store.set('vib', settings.vib ? 'on' : 'off'); showSettings(); buzz(40); });
showSettings();
window.addEventListener('keydown', e => {
  if (state.asking && (e.key === 'Enter' || e.key === 'y' || e.key === 'Y' || e.key === ' ')) { e.preventDefault(); return state.asking(); }
  if (e.key === 'Enter' && (!ui.menu.hidden || !ui.result.hidden)) start(ui.menu.hidden ? state.from : startAt, !ui.menu.hidden);
  if (e.key === 'Escape' || e.key === 'p') { if (state.mode === 'run') pause(); else if (state.mode === 'paused') resume(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });      // never keep running behind another app

// ── a game, not a page: no pinch, no double-tap zoom, no long-press menu. An iPhone ignores the viewport's own word on
// zooming, and two thumbs down at once (the stick and Strike) are a pinch to it, so the gestures are refused here. ──
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {      // a second quick tap on the open screen would zoom; on a button it must stay a tap
  const now = Date.now(), quick = now - lastTouchEnd < 320; lastTouchEnd = now;
  if (quick && !(e.target.closest && e.target.closest('button, a, input'))) e.preventDefault();
}, { passive: false });
document.addEventListener('contextmenu', e => e.preventDefault());

// ── installing it: offered on the title, small, put away for good with one tap, and never shown once it is installed ──
{
  const installed = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  let ask = null;
  const put = away => { $('install').hidden = away; ui.menu.classList.toggle('offer', !away); };
  const offer = (html, button) => { if (installed || store.get('install', '') === 'no') return; $('installText').innerHTML = html; $('installGo').hidden = !button; put(false); };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ask = e; offer('Install Hanuman Mission as an app', true); });      // Chrome, Android, desktop: the browser's own prompt, when the player asks for it
  window.addEventListener('appinstalled', () => put(true));
  $('installGo').addEventListener('click', () => { if (!ask) return; ask.prompt(); ask.userChoice.catch(() => null).then(() => { ask = null; put(true); }); });
  $('installNo').addEventListener('click', () => { store.set('install', 'no'); put(true); });
  // an iPhone has no prompt of its own: the player is told where it is
  if (apple) offer('Install: tap <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8"/></svg>Share, then Add to Home Screen', false);
}

load().catch(err => {      // four tries of some file have failed: one tap starts again
  ui.loadLine.textContent = 'Could not load. Tap to try again'; console.error(err);
  window.addEventListener('pointerdown', () => location.reload(), { once: true });
});
requestAnimationFrame(frame);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js?v=' + __STAMP__);
  // once everything has loaded, hand the offline cache the exact files this visit used
  window.addEventListener('load', () => navigator.serviceWorker.ready.then(reg => setTimeout(() => {
    const used = performance.getEntriesByType('resource').map(r => r.name).filter(u => u.startsWith(location.origin) && !/\.mp3($|\?)/.test(u));
    reg.active && reg.active.postMessage({ cache: [location.origin + location.pathname, ...new Set(used)] });
  }, 6000)));
}
// ── for the tests (checklist.md is run before anything is shown): what a picture must never have wrong ──
// Is anything of the world standing between the camera and those the picture is of, or is the camera inside something?
// Returns a line for each one that is hidden; nothing when all are clear. Only those inside the frame are judged.
function blocked() {
  const k = hero.root.scale.x, v = new THREE.Vector3(), pts = [];
  for (const n of ['Head', 'Spine2']) { const b = hero.model.getObjectByName('mixamorig' + n); if (b) pts.push(['hanuman ' + (n === 'Head' ? 'head' : 'chest'), b.getWorldPosition(v).toArray()]); }
  for (const g of fight.all) if (g.root.visible && g.st !== 'dead' && !g.rout) {      // those he runs through in the fire are part of the road, not people a shot is of
     const q = g.root.position; pts.push([(g.k.boss ? 'lankini' : 'guard') + ' chest', [q.x, q.y + g.tall * 0.62, q.z]]); }
  // soft: leaves, which are cards with holes in them, are not counted as hiding anyone
  const solid = []; scene.traverseVisible(o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (o.isMesh && !o.isSkinnedMesh && !o.userData.soft && m && !m.transparent && m.depthWrite !== false) solid.push(o); });
  const ray = new THREE.Raycaster(), out = [], t = new THREE.Vector3(), d = new THREE.Vector3(), ndc = new THREE.Vector3(), mine = new Set(); hero.root.traverse(o => mine.add(o)); fight.all.forEach(g => g.root.traverse(o => mine.add(o)));
  for (const [name, pt] of pts) {
    t.set(...pt); ndc.copy(t).project(camera); if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) continue;
    const len = d.copy(t).sub(camera.position).length(); d.divideScalar(len);
    if (len > 32 * Math.max(1, k)) continue;      // so far off that he is a part of the place, not one the picture is of
    if (hero.sink && name[0] === 'h' && len > 8) continue;      // squatting behind his tree he is meant to be hidden from where the others stand

    for (const back of [false, true]) {      // from the lens to him, and from him to the lens: the second finds a lens that is inside a wall
      ray.set(back ? t : camera.position, back ? d.clone().negate() : d); ray.near = 0.05; ray.far = len - 0.4 * k;
      const hit = ray.intersectObjects(solid, false).find(x => !mine.has(x.object));
      if (hit) { out.push(`${name} hidden by ${hit.object.name || (hit.object.parent && hit.object.parent.name) || 'a mesh'} ${hit.distance.toFixed(1)} m ${back ? 'from him (lens inside or behind it)' : 'from the lens'}`); break; }
    }
  }
  return out;
}
// How far the lowest part of him is above the road, in his own metres, with the height the game itself gives him (a
// leap, flight) taken off: near 0.1 when he stands or lies. Much more, and he is hanging in the air.
function feet() {
  const k = hero.root.scale.x, p = hero.root.position, v = new THREE.Vector3(); let low = Infinity;
  hero.model.traverse(o => { if (o.isBone && /(Foot|ToeBase|Hips|Spine|Head)$/.test(o.name)) low = Math.min(low, o.getWorldPosition(v).y); });
  return +((low - groundAt(p.z)) / k - hero.y).toFixed(2);
}
// Every frame of a test is judged, not a sample of them: a bad view can last two frames (one did, at the cut to a held
// fall) and still spoil the moment. What is found is kept as spans: what, in which mode, from when to when, how many frames.
const faults = []; let audited = 0;
const _mace = new THREE.Vector3();
// The lens inside someone who stands in the place (a courtier, a guard): no shot may start in a body or pass through one
// (Sid, 18 Nov, on the court's opening: "it starts behind someone's vest and the camera goes through that. camera can never pass through objects").
const _fig = new THREE.Vector3();
function lensIn() {
  const c = camera.position; let who = null;
  const test = (o, name) => { if (who || !o.visible) return; o.getWorldPosition(_fig); const k = o.scale.x || 1; if (Math.hypot(_fig.x - c.x, _fig.z - c.z) < 0.5 * k && c.y > _fig.y - 0.1 && c.y < _fig.y + 2.1 * k) who = name; };
  for (const ch of world.chunks.values()) if (ch.group.visible && Math.abs(ch.group.position.z - c.z) < 60) ch.group.traverse(o => { if (o.spawned === 'courtier') test(o, 'a courtier'); });
  if (fight) for (const e of fight.all) test(e.root, 'a guard');
  return who;
}
function audit() {
  const add = what => { const t = +(performance.now() / 1000).toFixed(2), last = faults.findLast(f => f.what === what); if (last && t - last.to < 0.6) { last.to = t; last.frames++; } else faults.push({ what, mode: state.mode, from: t, to: t, frames: 1 }); };
  const c = camera.position;
  if (c.y < groundAt(c.z) + 0.1) add('lens under the road');
  if (state.mode !== 'fight' && state.mode !== 'run' && state.mode !== 'scene') return;
  if (state.mode !== 'scene') {      // in play he is always in the picture
    const hips = hero.model.getObjectByName('mixamorigHips'), n = hips.getWorldPosition(new THREE.Vector3()).project(camera);
    if (Math.abs(n.x) > 1.02 || Math.abs(n.y) > 1.02 || n.z > 1) add('Hanuman out of the picture');
  }
  if (!hero.flying && hero.y < 0.02 && !/fall_|rise_|jump|hang|slide|roll|falling/.test(hero.name || '') && feet() > 0.3) add('he is off the road in ' + hero.name);
  if (hero.mace && hero.mace.visible && hero.root.visible && !hero.flying) { const k = hero.root.scale.x, m = hero.maceHeadAt(_mace); if (m.y - hero.maceR * k < groundAt(m.z) - 0.06 * k) add('his mace is under the road in ' + hero.name); }      // whatever he carries stays above the road in every pose
  if (++audited % 6 === 0) for (const line of blocked()) add(line.replace(/ [\d.]+ m .*$/, ''));
  if (state.mode === 'scene' && audited % 3 === 0) { const who = lensIn(); if (who) add('the lens is inside ' + who); }
}
if (debug || import.meta.env.DEV) window.__game = { blocked, feet, faults, scene, get fight() { return fight; }, get story() { return story; }, get director() { return director; }, flyCam, sound, state, get hero() { return hero; }, get world() { return world; }, renderer, camera, start, sections: SECTIONS, groundAt, move: d => hero.move(d), shot, slowMotion, usePower, useFlight,
  size(w, h) { fixed = w ? [w, h] : null; renderer.setPixelRatio(w ? 1 : pixelRatio); resize(); } };
if (debug && query.has('film')) import('./film.js').then(m => { film = m.createFilm({ renderer, scene, camera, hemi, moon, state, hero: () => hero, world: () => world }); window.__game.film = film; });
