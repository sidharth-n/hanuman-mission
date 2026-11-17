// Hanuman Mission: boot, game loop and rules.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Hero, LANES as LANE_X } from './hero.js';
import { World, SECTIONS, FIRE_AT, END_AT, FIGHT_AT, FIGHT_MID, groundAt } from './world.js';
import { Fight, LIVES, PLANS } from './fight.js';
import { Director, fit } from './scene.js';
import { createStory } from './story.js';
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
  pad: $('pad'), strike: $('strike'), dodge: $('dodge'), lives: $('lives'), card: $('card'), fade: $('fade') };
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
let hero, world, tailFire, tailLight, aura, fight, director, story;
let queued = null;      // a leap asked for a moment before he could make it: made as soon as he can
let stick = null;       // the fight's thumb stick

let fixed = null;      // [width, height] when recording at an exact size
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
  const one = name => loader.loadAsync(`assets/${CAST.includes(name) ? '' : 'world/'}${file(name)}.glb`).then(g => { done++; ui.fill.style.width = `${Math.round(done / names.length * 100)}%`; return [name, g]; });
  const tl = new THREE.TextureLoader();
  const [models, city, glow, paving, sky] = await Promise.all([Promise.all(names.map(one)).then(Object.fromEntries),
    tl.loadAsync('assets/tex/city.jpg'), tl.loadAsync('assets/tex/city-glow.jpg'), tl.loadAsync('assets/tex/paving.jpg'), tl.loadAsync('assets/tex/sky.jpg')]);
  world = new World(scene, models, { city, glow, paving, sky }, { lite: settings.gfx !== 'rich', bare: explore });
  world.onBell = () => { if (state.mode !== 'run') return; state.alarm = true; say(LINES.bell, 2.8); buzz([40, 50, 40, 50, 40]); sound.fx('bell', { gap: 4 }); };
  world.onSound = name => { if (state.mode === 'run') sound.fx(name, { gap: 0.3 }); };      // what the road throws at him
  hero = new Hero(models.hanuman); scene.add(hero.root); hero.attachMace(models.gada.scene);
  ui.lives.innerHTML = '<img src="ui/lotus.jpg" alt="">'.repeat(LIVES);
  fight = new Fight({ scene, hero, gltf: models.guard, sword: models['guard-sword'].scene, lankini: models.lankini, sound, buzz, groundAt, more: what => { say(STORY.alerts[what], 2.4); sound.fx('bell', { rate: 0.8, gap: 1 }); buzz([40, 60, 40]); }, shake: v => { state.shake = Math.max(state.shake, v); }, slowMotion });
  stick = fightControls(ui.pad, { live: () => state.mode === 'fight', attack: () => tap('strike', () => fight.attack()), dodge: () => tap('dodge', () => fight.dodge()),
    jump: () => tap('jump', () => fight.jump()), special: () => press2('giant', usePower) }); fight.stick = stick;

  director = new Director(camera, { root: $('drama'), who: $('who'), line: $('line'), skip: $('skip') });
  story = createStory({ scene, hero, fight, director, models, groundAt, sound, buzz, say, card, hold, go: resumeRun, battle: (mid, plan, done, scale) => { state.fightDone = done; startFight(mid, plan, scale); }, ask, grow, giant: GIANT, shake: a => { state.shake = Math.max(state.shake || 0, a); },
    fade, light: on => { tailFire.visible = on; }, ablaze, finish: () => { result('Lanka burns', 'Burned', state.burned); $('fromLine').textContent = STORY.cards.end; $('fromLine').hidden = false; } });
  tailFire = new THREE.Group(); tailFire.visible = false; scene.add(tailFire);
  for (const s of [0.8, 0.55, 0.35]) { const f = new THREE.Sprite(world.flameMat); f.userData.s = s; tailFire.add(f); }
  tailLight = new THREE.PointLight(0xff7a2a, 0, 20, 1.8); scene.add(tailLight);

  // the glow that shows his strength is up
  aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.flameTex, color: 0xffd98a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
  aura.position.y = 1.15; aura.visible = false; hero.root.add(aura);
  world.update(0, 0); placeCamera(1, true);
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
  const inFight = inRun && fight && fight.active;      // the fight's own controls and his lives
  ui.pad.hidden = ui.strike.hidden = ui.dodge.hidden = ui.lives.hidden = $('jump').hidden = !inFight; document.body.classList.toggle('fighting', !!inFight);
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
  world.reset(); fight.clear(); story.reset(true); if (director.active) director.skipQuiet(); unask(); hero.reset(); sound.stop(); ui.fade.classList.remove('on'); ui.card.hidden = true;
  Object.assign(state, { orbit: null, mode: 'ready', fought: false, vast: 0, fightDone: null, tall: 0, tw: null, asking: null, speed: 0, dist: 0, fire: false, blaze: 0, grow: 0, big: 0, giant: 0, flight: 0, shot: null, intro: 0, low: 0, falling: [], tscale: 1, slowT: 0, from: 0, kept: null, inside: 0 });
  tailFire.visible = false; tailLight.intensity = 0; hero.root.scale.setScalar(1); aura.visible = false; world.behind = 3;
  world.update(0, 0); screen('menu');
}

function result(title, thirdLabel, third) {
  const best = Math.max(+store.get('best', 0), Math.round(state.dist)); store.set('best', best);
  $('resultTitle').textContent = title; $('rDist').textContent = Math.round(state.dist).toLocaleString(); $('rLamps').textContent = state.gold;
  $('rThirdLabel').textContent = thirdLabel; $('rThird').textContent = (third ?? best).toLocaleString();
  // caught beyond the first stretch: the next run takes up from the start of the place he had reached
  if (state.dist >= END_AT) { state.from = 0; state.kept = null; }
  $('again').textContent = state.from > 0 ? 'Continue' : 'Run again'; $('fromLine').textContent = state.from > 0 ? `From ${SECTIONS[state.from].name}` : ''; $('fromLine').hidden = state.from === 0;
  state.mode = 'ready'; sound.stop(); screen('result');
}

// from: the section the run takes up from (0 = the gate). What he carried when he reached it is given back.
function start(from = 0, fresh = false) {
  if (typeof from !== 'number') from = 0;
  story.reset(fresh); if (director.active) director.skipQuiet(); unask(); ui.fade.classList.remove('on'); ui.card.hidden = true;
  const sec = SECTIONS[from], kept = from > 0 && state.kept ? state.kept : { gold: 0, meter: 0, wind: 1 };      // a new run begins with the wind in hand
  const back = debug ? +query.get('back') || 0 : 0;      // ?debug&at=grove&back=40: a run that takes up 40 m short of a place, to try the way into it
  world.reset(); fight.clear(); hero.reset(); hero.root.position.set(0, groundAt(-sec.from + back), -sec.from + back);
  Object.assign(state, { orbit: null, mode: 'run', fought: false, ramp: 0, vast: 0, fightDone: null, tall: 0, tw: null, asking: null, speed: speedAt(sec.from), dist: sec.from, danger: 0, slow: 0, shake: 0, fire: false, blaze: 0, grow: 0, falling: [],
    tscale: 1, slowT: 0, slowK: 1, intro: INTRO, low: 0, grown: false, shot: null, giant: 0, big: 0, burned: 0, cine: 6, flight: 0, safe: 2, sec: from, from, alarm: false, fallT: 0,
    inside: world.kindAt(-sec.from) === 'hall' ? 1 : 0, ...kept, kept });
  world.behind = 3;
  tailFire.visible = false; tailLight.intensity = 0; hero.root.scale.setScalar(1); aura.visible = false;
  queued = null; view.join = 0; screen(null); last = performance.now();
  world.update(0, hero.root.position.z);
  sound.start();      // the chant as he sets off, then the song
  // every run opens in the air: he rises and flies in over the road as the view comes round behind him, then lands and runs
  state.opening = true; state.flight = OPEN_FLIGHT; hero.startFlight(); slowMotion(1.4, 0.45); sound.fx('wing');
  card(SECTIONS[from].id);
}

// The player is asked before he grows to meet Lankini: one button, or Enter.
function ask(then) { $('ask').hidden = false; state.asking = () => { $('ask').hidden = true; state.asking = null; sound.fx('tap'); then(); }; }
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

function hit(o, chunk) {
  o.done = true;
  state.falling.push({ mesh: o.mesh, t: 0, dir: o.x <= hero.root.position.x ? -1 : 1 });
  if (state.fire) { world.burn(o, chunk); state.burned++; state.shake = 0.25; sound.fx('smash', { gap: 0.25 }); return; }
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
  state.mode = 'fight'; state.orbit = null; state.shot = null; state.danger = 0; state.slow = 0; queued = null;
  if (state.flight > 0) { state.flight = 0; hero.endFlight(); if (state.opening) { state.opening = false; state.wind = 1; } }      // on the wing when the horn sounds: he comes down to meet them
  fight.begin(mid, plan, scale); painted.lives = null;
  if (scale === 1) say(STORY.alerts.guards, 2.6);
  sound.fx('bell', { rate: 0.8, gap: 1 }); sound.chant(); buzz([40, 60, 40]); screen(null);
}
function endFight(how) {
  fight.result = null; if (stick) stick.release();
  const then = state.fightDone; state.fightDone = null;
  if (how === 'lost') {
    for (const foe of fight.all) foe.bar.visible = false;      // nothing of the fight is left hanging over what comes next
    screen(null); if (then && then(how)) return;      // the story takes him as he fell: in the grove he is bound and led to Ravana
    return caught(true);      // he stays where he fell, among them, until the next run
  }
  sound.fx('power'); buzz([40, 40, 120]);
  if (then) return then(how);      // the story goes on from here
  say(STORY.alerts.cleared, 2.4); resumeRun();
}
// A scene of the story begins: the run stops where it is, and nothing of the play is on screen.
function hold() {
  state.mode = 'scene'; state.orbit = null; state.shot = null; state.danger = 0; state.slow = 0; queued = null; state.tscale = 1; state.slowT = 0;
  if (state.flight > 0) { state.flight = 0; hero.endFlight(); if (state.opening) { state.opening = false; state.wind = 1; } }
  hero.free = true; if (stick) stick.release(); ui.card.hidden = true; screen(null);
}
// The run goes on from where he stands: after a fight, after a scene.
function resumeRun() {
  const p = hero.root.position; hero.free = false; hero.floor = 0;
  hero.root.rotation.y = 0; hero.lane = [0, 1, 2].reduce((a, b) => Math.abs(LANE_X[b] - p.x) < Math.abs(LANE_X[a] - p.x) ? b : a);
  state.mode = 'run'; state.ramp = Math.max(state.speed, speedAt(-p.z)); state.speed = 7; state.safe = 2; state.dist = -p.z; last = performance.now(); view.join = 1;
  state.kept = { gold: state.gold, meter: state.meter, wind: state.wind }; screen(null);
}
// Out of Ravana's court with his tail alight: the fire run begins.
function ablaze() {
  const z = -(FIRE_AT + 7);      // well past the wall Shiva sits against, so the view behind him is past it too
  hero.root.position.set(0, groundAt(z), z); state.dist = -z; world.update(0, z);
  resumeRun(); placeCamera(1, true);
}

function ignite() {
  state.fire = true; state.danger = 0; tailFire.visible = true; slowMotion(0.9, 0.3); state.low = 1.9; world.behind = 2;
  say(LINES.ignite, 3.2); sound.fx('fire'); sound.blaze(true); buzz([40, 40, 90]);
}

function won() { story.ending(); }      // the last scene; it ends in the result

function rules(dt) {
  state.speed = Math.min(MAX_SPEED, state.speed + ACCEL * dt);
  if (!state.fire && world.kindAt(hero.root.position.z) === 'grove') state.speed = Math.max(7.2, state.speed - 9 * dt);      // in the grove he goes softly: the place is to be seen
  if (state.ramp) { state.speed = Math.min(state.ramp, state.speed + 5 * dt); if (state.speed >= state.ramp) state.ramp = 0; }      // back up to pace after the fight
  if (state.danger > 0) state.danger -= dt;
  if (state.slow > 0) state.slow = Math.max(0, state.slow - dt * 1.1);
  const p = hero.root.position;
  state.dist = -p.z;
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
    state.burned += world.igniteUpTo(p.z);
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
  for (const c of world.nearby(p.z)) {
    for (const o of c.obstacles) {
      if (o.kind === 'gap' && !state.hinted && o.z < p.z && o.z > p.z - 34) { state.hinted = true; say(LINES.gap, 2.2); }
      if (o.kind === 'gap' && !o.heard && o.z < p.z && o.z > p.z - 30) { o.heard = true; sound.fx('bridge', { gap: 1 }); }      // every raised drawbridge creaks on its chains as he nears it      // the first raised drawbridge is called out
      if (o.type === 'tunnel' && !o.done && o.z < p.z && o.z > p.z - 30) {      // the wall of the grove: nobody flies through it, and the low way under it is called out
        if (state.flight > 0) { state.flight = 0; hero.endFlight(); state.safe = Math.max(state.safe, 0.9); }
        if (!o.heard && o.z > p.z - 26) { o.heard = true; say(LINES.tunnel, 2.4); }
      }
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
        if (state.meter >= 1) say(LINES.strength, 2.2);
      }
    }
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
  if (running && queued) { queued.t -= real; const went = hero.move('up'); if (went) sound.fx('leap'); if (went || queued.t <= 0) queued = null; }
  const falling = state.mode === 'fall';
  if (falling) { state.fallT -= dt; if (state.fallT <= 0) result(LINES.fell, 'Best'); }
  const speed = falling ? 2.4 : state.speed * (1 - state.slow * 0.45) * (state.fire ? 1.15 : 1) * (state.flight > 0 ? 1.3 : 1);
  hero.update(fighting && fight.frozen ? 0 : dt, speed, state.mode === 'run' || falling, groundAt);
  world.shotOn = !!state.shot; world.update(dt, hero.root.position.z);
  for (const f of state.falling) { f.t += dt; f.mesh.rotation.z = f.dir * Math.min(1.35, f.t * 7); f.mesh.position.y = -Math.min(0.5, f.t * 1.2); }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - real * 1.6);

  // night outside, lamplight inside the palace, firelight once the city burns
  const kind = world.kindAt(hero.root.position.z);
  state.inside += ((kind === 'hall' || kind === 'throne' ? 1 : 0) - state.inside) * Math.min(1, real * 2.5);
  state.garden += ((kind === 'grove' ? 1 : 0) - state.garden) * Math.min(1, real * 1.5);
  scene.background.copy(NIGHT).lerp(INDOORS, state.inside).lerp(GROVE_SKY, state.garden).lerp(BLAZE, state.blaze); scene.fog.color.copy(FOG_NIGHT).lerp(FOG_INDOORS, state.inside).lerp(FOG_GROVE, state.garden).lerp(FOG_BLAZE, state.blaze);
  scene.fog.density = 0.016 + state.garden * 0.007;      // the grove lies in a thin mist
  hemi.intensity = 1.0 + state.garden * 0.3 + state.blaze * 0.25; hemi.color.copy(SKY_LIGHT).lerp(LAMP_LIGHT, state.inside * 0.85).lerp(GROVE_LIGHT, state.garden).lerp(FIRE_LIGHT, state.blaze * 0.7);
  moon.intensity = 2.4 + state.garden * 0.5;
  moon.color.copy(MOON_LIGHT).lerp(LAMP_LIGHT, state.inside);
  world.cap.material.color.copy(scene.fog.color); world.heavens.visible = state.inside < 0.5;
  if (tailFire.visible) {
    hero.tailTip(tip); const k = hero.root.scale.x;
    tailFire.children.forEach((f, n) => { const s = f.userData.s * k * (1.5 + Math.sin(now * 0.02 + n * 2) * 0.25); f.scale.set(s, s * 1.3, 1); f.position.set(tip.x, tip.y + n * 0.35 * k, tip.z + n * 0.25 * k); });
    tailLight.position.set(tip.x, tip.y + 1.2 * k, tip.z + 1.5 * k); tailLight.intensity = 26 * k * (1 + Math.sin(now * 0.03) * 0.15);
  }
  tint.setRGB(1 - state.blaze * 0.25, 1 - state.blaze * 0.7, 1 - state.blaze * 0.82).multiplyScalar(1 - state.inside); world.skyMat.color.copy(tint);
  placeCamera(real, false);
  renderer.render(scene, camera);
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
    if (fighting) paint('lives', fight.lives, v => [...ui.lives.children].forEach((el, i) => el.classList.toggle('lost', i >= v)));
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
  else if (dir !== 'tap') { const done = hero.move(dir); if (done && dir === 'up') sound.fx('leap'); else if (done && dir === 'down') sound.fx('slide'); queued = !done && dir === 'up' && !hero.flying ? { t: 0.28 } : null; }
});
// A power button answers every touch: a pulse and a buzz when it fires, a shake when it is not charged.
function press2(id, fn) {
  const el = $(id), ok = fn();
  el.classList.remove('hit', 'no'); void el.offsetWidth; el.classList.add(ok ? 'hit' : 'no'); if (ok) buzz([30, 30, 60]);
}
const press = (id, fn) => $(id).addEventListener('click', e => { sound.fx('tap'); fn(e); });
press('go', () => start(startAt, true)); press('again', () => start(state.from)); press('home', home); press('quit', home); press('resume', resume); press('openSettings', openSettings); press('pause', pause);
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

load().catch(err => { ui.loadLine.textContent = 'Could not load. Check the connection and reload'; console.error(err); });
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
  for (const g of fight.all) if (g.root.visible && g.st !== 'dead') { const q = g.root.position; pts.push([(g.k.boss ? 'lankini' : 'guard') + ' chest', [q.x, q.y + g.tall * 0.62, q.z]]); }
  // soft: leaves, which are cards with holes in them, are not counted as hiding anyone
  const solid = []; scene.traverseVisible(o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (o.isMesh && !o.isSkinnedMesh && !o.userData.soft && m && !m.transparent && m.depthWrite !== false) solid.push(o); });
  const ray = new THREE.Raycaster(), out = [], t = new THREE.Vector3(), d = new THREE.Vector3(), ndc = new THREE.Vector3(), mine = new Set(); hero.root.traverse(o => mine.add(o)); fight.all.forEach(g => g.root.traverse(o => mine.add(o)));
  for (const [name, pt] of pts) {
    t.set(...pt); ndc.copy(t).project(camera); if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) continue;
    const len = d.copy(t).sub(camera.position).length(); d.divideScalar(len);
    if (len > 32 * Math.max(1, k)) continue;      // so far off that he is a part of the place, not one the picture is of

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
  if (++audited % 6 === 0) for (const line of blocked()) add(line.replace(/ [\d.]+ m .*$/, ''));
}
if (debug || import.meta.env.DEV) window.__game = { blocked, feet, faults, scene, get fight() { return fight; }, get story() { return story; }, get director() { return director; }, flyCam, sound, state, get hero() { return hero; }, get world() { return world; }, renderer, camera, start, sections: SECTIONS, groundAt, move: d => hero.move(d), shot, slowMotion, usePower, useFlight,
  size(w, h) { fixed = w ? [w, h] : null; renderer.setPixelRatio(w ? 1 : pixelRatio); resize(); } };
