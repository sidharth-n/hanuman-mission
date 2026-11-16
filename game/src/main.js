// Hanuman Mission: boot, game loop and rules.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Hero } from './hero.js';
import { World } from './world.js';
import { listen } from './input.js';

const KIT = ['house', 'tower-house', 'market-stall', 'street-arch', 'rakshasa-statue', 'brazier', 'cart', 'pots', 'barricade', 'palace'];
const START_SPEED = 9.5, MAX_SPEED = 15.5, ACCEL = 0.11;
const FIRE_AT = 380, END_AT = 820;       // metres: where the tail catches fire, where the run ends
const NIGHT = new THREE.Color(0x070b1c), BLAZE = new THREE.Color(0x2b0d04);
const FOG_NIGHT = new THREE.Color(0x0b1230), FOG_BLAZE = new THREE.Color(0x3a1407);

const $ = id => document.getElementById(id);
const ui = { screen: $('screen'), line: $('line'), bar: $('bar'), fill: $('bar').firstElementChild, go: $('go'), how: $('how'),
  hud: $('hud'), dist: $('dist'), gold: $('gold'), alert: $('alert'), fps: $('fps'), title: document.querySelector('#screen h1') };
const debug = new URLSearchParams(location.search).has('debug');
const t0 = performance.now();

const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: true, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
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

const state = { mode: 'loading', speed: 0, dist: 0, gold: 0, danger: 0, slow: 0, shake: 0, fire: false, blaze: 0, grow: 0, alertT: 0, falling: [] };
let hero, world, tailFire, tailLight;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = h > w ? 70 : 56; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

async function load() {
  const loader = new GLTFLoader(); let done = 0;
  const names = ['hanuman', ...KIT];
  const one = name => loader.loadAsync(`assets/${name === 'hanuman' ? '' : 'world/'}${name}.glb`).then(g => { done++; ui.fill.style.width = `${Math.round(done / names.length * 100)}%`; return [name, g]; });
  const models = Object.fromEntries(await Promise.all(names.map(one)));
  world = new World(scene, models);
  hero = new Hero(models.hanuman); scene.add(hero.root);

  tailFire = new THREE.Group(); tailFire.visible = false; scene.add(tailFire);
  for (const s of [0.8, 0.55, 0.35]) { const f = new THREE.Sprite(world.flameMat); f.userData.s = s; tailFire.add(f); }
  tailLight = new THREE.PointLight(0xff7a2a, 0, 20, 1.8); scene.add(tailLight);

  world.update(0, 0); placeCamera(1, true);
  renderer.compile(scene, camera);
  state.loadMs = Math.round(performance.now() - t0);
  ready('Lanka sleeps. One guard has seen you.', 'Run');
}

function ready(line, label) {
  state.mode = 'ready';
  ui.screen.classList.remove('loading'); ui.screen.hidden = false; ui.bar.hidden = true;
  ui.line.textContent = line; ui.go.textContent = label; ui.go.hidden = false; ui.how.hidden = false;
}

function start() {
  world.reset(); hero.reset();
  Object.assign(state, { mode: 'run', speed: START_SPEED, dist: 0, gold: 0, danger: 0, slow: 0, shake: 0, fire: false, blaze: 0, grow: 0, falling: [] });
  tailFire.visible = false; tailLight.intensity = 0;
  ui.title.textContent = 'Hanuman Mission';
  ui.screen.hidden = true; ui.hud.hidden = false; ui.alert.hidden = true;
  world.update(0, 0);
  hero.play('fast_run', { fade: 0.15 });
}

function say(text, secs = 2.2) { ui.alert.textContent = text; ui.alert.hidden = false; state.alertT = secs; }

function hit(o, chunk) {
  o.done = true;
  state.falling.push({ mesh: o.mesh, t: 0, dir: o.x <= hero.root.position.x ? -1 : 1 });
  if (state.fire) { world.burn(o, chunk); state.gold += 3; state.shake = 0.25; return; }
  if (state.danger > 0) return caught();
  state.danger = 6; state.slow = 1; state.shake = 0.5;
  hero.stumble(); say('The guards are closing in');
}

function caught() {
  state.mode = 'over'; hero.play('hit_reaction', { once: true, fade: 0.08 });
  ui.title.textContent = 'Caught';
  ready(`You ran ${Math.round(state.dist)} metres through Lanka.`, 'Run again'); ui.hud.hidden = true; ui.alert.hidden = true;
}

function ignite() {
  state.fire = true; state.danger = 0; tailFire.visible = true;
  say('The tail is on fire. Burn Lanka!', 3.2);
}

function won() {
  state.mode = 'over'; hero.play('mutant_roaring', { once: true, fade: 0.2 });
  ui.title.textContent = 'Lanka burns';
  ready(`${Math.round(state.dist)} metres, ${state.gold} gold. Sita's message is on its way to Rama.`, 'Run again'); ui.hud.hidden = true; ui.alert.hidden = true;
}

function rules(dt) {
  state.speed = Math.min(MAX_SPEED, state.speed + ACCEL * dt);
  if (state.danger > 0) state.danger -= dt;
  if (state.slow > 0) state.slow = Math.max(0, state.slow - dt * 1.1);
  const p = hero.root.position;
  state.dist = -p.z;
  if (!state.fire && state.dist >= FIRE_AT) ignite();
  if (state.fire) {
    state.blaze = Math.min(1, state.blaze + dt * 0.35);
    state.grow = Math.min(1, Math.max(0, (state.dist - FIRE_AT - 140) / 160));
    hero.root.scale.setScalar(1 + state.grow * 0.9);
    state.gold += world.igniteUpTo(p.z);
    if (state.dist >= END_AT) return won();
  }
  const reach = 1.05 * hero.root.scale.x;
  for (const c of world.nearby(p.z)) {
    for (const o of c.obstacles) {
      if (o.done || Math.abs(o.z - p.z) > o.hd + 0.35 || Math.abs(o.x - p.x) > reach) continue;
      const clear = !state.fire && (o.kind === 'low' ? hero.y > 0.75 : o.kind === 'high' ? hero.sliding : false);
      if (!clear) hit(o, c);
      if (state.mode !== 'run') return;
    }
    for (const k of c.coins) {
      if (k.got || Math.abs(k.z - p.z) > 0.8 || Math.abs(k.x - p.x) > reach || Math.abs(k.y - (hero.y + 1)) > 1.3 * hero.root.scale.x) continue;
      k.got = true; k.mesh.visible = false; state.gold++;
    }
  }
}

const look = new THREE.Vector3(), want = new THREE.Vector3(), tip = new THREE.Vector3();
function placeCamera(dt, snap) {
  const p = hero.root.position, k = hero.root.scale.x, tall = window.innerHeight > window.innerWidth;
  want.set(p.x * 0.5, (tall ? 3.7 : 3.0) * (0.6 + 0.4 * k) + state.grow * 2.5, p.z + (tall ? 7.4 : 6.1) * k);
  if (snap) camera.position.copy(want); else camera.position.lerp(want, Math.min(1, dt * 9));
  if (state.shake > 0) { camera.position.x += (Math.random() - 0.5) * state.shake * 0.5; camera.position.y += (Math.random() - 0.5) * state.shake * 0.35; }
  look.set(p.x * 0.65, 1.55 * k, p.z - 8); camera.lookAt(look);
}

let last = performance.now(), frames = 0, acc = 0, slowFrames = 0, shown = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; last = now;
  const dt = Math.min(0.05, raw);
  if (!hero) return;
  const running = state.mode === 'run';
  if (running) rules(dt);
  const speed = state.speed * (1 - state.slow * 0.45) * (state.fire ? 1.15 : 1);
  hero.update(dt, speed, state.mode === 'run');
  world.update(dt, hero.root.position.z);
  for (const f of state.falling) { f.t += dt; f.mesh.rotation.z = f.dir * Math.min(1.35, f.t * 7); f.mesh.position.y = -Math.min(0.5, f.t * 1.2); }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);

  scene.background.copy(NIGHT).lerp(BLAZE, state.blaze); scene.fog.color.copy(FOG_NIGHT).lerp(FOG_BLAZE, state.blaze);
  hemi.intensity = 1.0 + state.blaze * 0.25; hemi.color.setHex(0x7f95d8).lerp(new THREE.Color(0xff9a5a), state.blaze * 0.7);
  if (tailFire.visible) {
    hero.tailTip(tip); const k = hero.root.scale.x;
    tailFire.children.forEach((f, n) => { const s = f.userData.s * k * (1.5 + Math.sin(now * 0.02 + n * 2) * 0.25); f.scale.set(s, s * 1.3, 1); f.position.set(tip.x, tip.y + n * 0.35 * k, tip.z + n * 0.25 * k); });
    tailLight.position.set(tip.x, tip.y + 1.2 * k, tip.z + 1.5 * k); tailLight.intensity = 26 * k * (1 + Math.sin(now * 0.03) * 0.15);
  }
  placeCamera(dt, false);
  renderer.render(scene, camera);

  if (running) { ui.dist.textContent = Math.round(state.dist); ui.gold.textContent = state.gold; }
  if (state.alertT > 0) { state.alertT -= dt; if (state.alertT <= 0) ui.alert.hidden = true; }

  // keep it smooth: if frames run long, render fewer pixels rather than stutter
  frames++; acc += raw; if (raw > 1 / 45) slowFrames++;
  if (frames >= 90) {
    const fps = frames / acc;
    if (slowFrames > 30 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
    state.fps = Math.round(fps);
    if (debug) { ui.fps.hidden = false; ui.fps.textContent = `${state.fps} fps  px ${pixelRatio}\n${renderer.info.render.calls} draws  ${Math.round(renderer.info.render.triangles / 1000)}k tris\nload ${state.loadMs} ms`; }
    frames = 0; acc = 0; slowFrames = 0; shown++;
  }
}

listen(window, dir => {
  if (state.mode === 'run' && dir !== 'tap') hero.move(dir);
});
ui.go.addEventListener('click', () => { if (state.mode === 'ready' || state.mode === 'over') start(); });
window.addEventListener('keydown', e => { if (e.key === 'Enter' && !ui.go.hidden && state.mode !== 'run') start(); });

ui.screen.classList.add('loading');
load().catch(err => { ui.line.textContent = 'Could not load the game. Check the connection and reload.'; console.error(err); });
requestAnimationFrame(frame);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
  // once everything has loaded, hand the offline cache the exact files this visit used
  window.addEventListener('load', () => navigator.serviceWorker.ready.then(reg => setTimeout(() => {
    const used = performance.getEntriesByType('resource').map(r => r.name).filter(u => u.startsWith(location.origin));
    reg.active && reg.active.postMessage({ cache: [location.origin + location.pathname, ...new Set(used)] });
  }, 6000)));
}
if (debug || import.meta.env.DEV) window.__game = { state, get hero() { return hero; }, get world() { return world; }, renderer, start, move: d => hero.move(d) };
