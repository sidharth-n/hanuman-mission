// The story told between the play, staged scene by scene: Lankini at the gate, Ravana and Sita in the grove,
// Hanuman and Sita, the fight in the grove and his binding, Ravana's court, the fire, and the end.
// Every line of dialogue comes from story.json; this file only places the characters and the camera.
import * as THREE from 'three';
import STORY from './story.json';
import { Actor } from './scene.js';
import { Aura } from './aura.js';
import { PLANS } from './fight.js';
import { SITA, TREE, HIDE, THRONE, STAND } from './places.js';
import { HALL } from './court.js';
import { GROVE_AT, THRONE_AT, FIRE_AT, LANKINI_AT, LANKINI_MID, CHUNK } from './world.js';

const S = STORY.scenes;
const heroYaw = (fx, fz) => Math.atan2(-fx, -fz);      // Hanuman's model faces the other way from the rest
const yawTo = (fx, fz) => Math.atan2(fx, fz);
const GROVE_MID = GROVE_AT + (HIDE.n - 1) * CHUNK + 38;      // the floor the grove fight is fought on: between the tree he hides behind and the stretch before it

// g: what the game lends the story: { scene, hero, fight, director, models, groundAt, sound, buzz, say(text, secs),
//   hold() (stop the run for a scene), go() (run on), battle(mid, plan, done(how)), fade(then), light(on), ablaze(), finish() }
export function createStory(g) {
  const { hero, fight, director } = g;
  const sita = new Actor(g.models.sita, 1.72), ravana = new Actor(g.models.ravana, 2.75);
  g.scene.add(sita.root, ravana.root);
  sita.knees = 0.8; sita.model.traverse(o => { if (o.isMesh) o.material.side = THREE.DoubleSide; });      // seated, the folds of her sari open: their inner side must show as cloth, not as holes
  const lankini = fight.boss, escort = [fight.guards[6], fight.guards[7]], wardens = [fight.guards[4], fight.guards[5]];      // the two who lead him, the two who stand by the throne
  // a small light on whatever lies in an open hand: Rama's ring, Sita's jewel
  const gift = new THREE.Sprite(new THREE.SpriteMaterial({ map: fight.sparks.points.material.map, color: 0xffd36a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true }));
  gift.visible = false; g.scene.add(gift);
  // and a glint on the jewel: a small four-pointed star that turns and flashes, as a cut stone does when it catches the light
  const star = document.createElement('canvas'); star.width = star.height = 64;
  { const c = star.getContext('2d'), core = c.createRadialGradient(32, 32, 0, 32, 32, 12); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = core; c.fillRect(0, 0, 64, 64);
    for (const [w, h] of [[64, 3], [3, 64]]) { const ray = c.createRadialGradient(32, 32, 0, 32, 32, 32); ray.addColorStop(0, 'rgba(255,255,255,0.95)'); ray.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = ray; c.fillRect(32 - w / 2, 32 - h / 2, w, h); } }
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(star), color: 0xe8f6ff, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true }));
  glint.visible = false; g.scene.add(glint);
  // Rama's ring and Sita's hair jewel themselves, small things of gold that lie in an open hand and are seen close
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.28, emissive: 0x4a3206, envMapIntensity: 1.6 });
  const stone = (color, glow) => new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.12, emissive: glow, envMapIntensity: 2 });
  const ring = new THREE.Group(), jewel = new THREE.Group();
  { const band = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.0055, 10, 28), gold); ring.add(band);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.012, 12), gold); seat.position.set(0, 0.03, 0); ring.add(seat);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), stone(0xb3122a, 0x4a0510)); gem.position.set(0, 0.039, 0); ring.add(gem);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.007, 20), gold); plate.rotation.x = Math.PI / 2; jewel.add(plate);
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 1), stone(0x9fd0f5, 0x16344f)); heart.scale.set(1, 1, 0.6); heart.position.z = 0.012; jewel.add(heart);
    for (let i = 0; i < 8; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), stone(0xe9dcc0, 0x1c1912)); p.position.set(Math.cos(i * Math.PI / 4) * 0.036, Math.sin(i * Math.PI / 4) * 0.036, 0.004); jewel.add(p); }
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), stone(0xe9dcc0, 0x1c1912)); drop.scale.y = 1.5; drop.position.set(0, -0.058, 0.002); jewel.add(drop);
    heart.material.emissive.set(0x2a6ea8); jewel.scale.setScalar(0.46); }      // a small jewel, the width of two fingers, its stone bright (Sid: "a good small one that shines, not a big one")
  for (const o of [ring, jewel]) { o.visible = false; o.traverse(m => { m.userData.soft = true; }); g.scene.add(o); }      // soft: a thing in his hand is not something standing in front of him
  let held = null;      // { thing: the ring or the jewel, who: whose open hand it lies in }
  let clear = null;      // { beats, i, on }: the beat that is shown without the veils of the place
  let vowT = -1, vowRoar = null;      // how long until he roars after his vow, and the roar
  const palmUp = new THREE.Vector3(), flat = new THREE.Vector3(0, 0, 1);
  // who holds out a hand to a point with the thing in it; who: null puts everything away
  const offer = (who, thing, to) => {
    for (const a of [hero, sita]) if (a !== who) a.offer.on = false;
    ring.visible = jewel.visible = gift.visible = glint.visible = false; held = null; if (!who) return;
    who.offer.to.set(...to); who.offer.on = true; who.offer.lift = who === hero ? 0.045 : 0.03; held = { thing, who }; thing.visible = true;
  };
  const aura = new Aura(g.scene, fight.sparks.points.material.map);      // the light round him when he changes size
  // the burning brand a guard of the court puts to his tail: a flame that rides the point of the guard's sword
  const brand = new THREE.Group(); brand.visible = false; g.scene.add(brand);
  for (const [size, up] of [[1.25, 0], [0.95, 0.3], [0.6, 0.62]]) { const f = new THREE.Sprite(g.fireMat); f.userData.s = size; f.position.y = up; brand.add(f); }
  let torch = null;      // { e: the guard, t, stage, from, to }: he walks round behind Hanuman, strikes at the tail, and it is alight
  const tipOf = new THREE.Vector3();
  const done = { lankini: false, challenged: false, grove: false, end: false, present: false };
  // What brings him down (the capture): three iron weights on cords, thrown from far off, that wind round his ankles as he runs
  const iron = new THREE.MeshStandardMaterial({ color: 0x4a423a, metalness: 0.7, roughness: 0.45, emissive: 0x2a1406 }), hemp = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.95 });
  const bola = new THREE.Group(), cuff = new THREE.Group();
  for (let i = 0; i < 3; i++) { const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 3;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5), hemp); cord.rotation.z = Math.PI / 2; cord.position.x = 0.25;
    const weight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), iron); weight.position.x = 0.52; arm.add(cord, weight); bola.add(arm); }
  { const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: fight.sparks.points.material.map, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.8 })); flare.scale.setScalar(1.5); bola.add(flare); }
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.2 - i * 0.012, 0.02, 6, 20), hemp); t.rotation.x = Math.PI / 2 + (i % 2 ? 0.12 : -0.1); t.position.y = i * 0.05; cuff.add(t); }
  for (const side of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), iron); w.position.set(side * 0.2, 0.02, 0.12); cuff.add(w); }
  for (const o of [bola, cuff]) { o.visible = false; o.traverse(m => { m.userData.soft = true; }); }
  g.scene.add(bola); hero.root.add(cuff);
  let snare = null;      // { at: where along the route it takes him, t: how long it has been in the air (-1: not thrown yet), from, fall: { t, v, hit, rest } }
  const unsnare = () => { snare = null; bola.visible = cuff.visible = false; hero.prone = 0; };
  let trek = null, leapTo = null, turn = null;      // Hanuman moving by himself in a scene: along the ground from mark to mark, or through the air
  let G = 0;      // the height of the floor where the scene is played

  const v = (x, y, z) => [x, G + y, z];
  const shot = (at, look, o = {}) => ({ cam: { at, look, ...o } });
  // A shot of two people side by side does not fit an upright phone: there the same moment is taken along the line between them.
  const either = (wide, upright) => (window.innerHeight > window.innerWidth ? upright : wide);
  // Those a shot must hold in the picture, head and foot: the director draws the camera back until they are all in it
  const span = (o, tall) => [[o.x, o.y, o.z], [o.x, o.y + tall, o.z]];
  const him = () => span(hero.root.position, 1.95 * hero.root.scale.x);
  const both = () => [...him(), ...span(lankini.root.position, 3.85)];
  // The score (Hans's audio screenplay): where the music changes or stops dead (null), the hits that land on a line, and
  // the lines that wait a moment for a great sound to pass before they are spoken.
  const CUES = { 'throne-0': 'court', 'throne-8': null, 'grove_ravana-8': null };      // the court's opening music holds until Ravana speaks
  const HITS = { 'lankini_yields-1': 'toll', 'grove_sita-5': 'gift', 'grove_bound-1': 'bind', 'ignite-1': 'burst' };      // the fire catching ('alight') is heard as the brand touches his tail
  const LEAD = { 'ignite-1': 1.2 };
  const beats = (key, shots = []) => S[key].map((l, i) => { const id = key + '-' + i, b = { who: l.who, line: l.line, voice: id, ...(shots[i] || {}) };
    if (id in CUES) b.cue = CUES[id]; if (HITS[id]) b.hit = HITS[id]; if (LEAD[id]) b.lead = LEAD[id]; return b; });
  function putHero(x, z, yaw, clip = 'breathing_idle', up = 0) {
    hero.free = true; hero.pace = 0; hero.slide = 0; hero.busy = 0; hero.flying = false; hero.fly = 0; hero.sink = 0;
    hero.root.position.set(x, g.groundAt(z), z); hero.root.rotation.y = yaw; hero.floor = up; hero.y = up; hero.vy = 0; hero.lane = 1;
    hero.play(clip, { fade: 0.25 });
  }
  // Behind his tree he sits low on his heels, hands down, head forward, and watches, quite still (Sid's pick of four
  // poses: "he should sit and listen, his posture clear"): the last of the climb-down, held. His mace is put by: held,
  // its shaft crossed his face in every close shot.
  function squat(x, z, yaw) {
    trek = null; putHero(x, z, yaw, 'braced_hang_to_crouch');
    const a = hero.current; a.time = a.getClip().duration * 0.97; a.timeScale = 0; hero.sink = 0.1; if (hero.mace) hero.mace.visible = false;      // the clip ends a hand's breadth off the ground (its hips are held where a hang has them)
  }
  // The shot of him there (H: where he sits, d: the way he looks, side: toward the path): from the path side and low,
  // the whole of him clear above the words, coming round from three-quarter to his profile against the trunk he hides behind
  const hidShot = (H, d, side) => shot(v(H[0] + d[0] * 1.4 + side[0] * 2.5, 0.85, H[1] + d[1] * 1.4 + side[1] * 2.5), v(H[0], 0.55, H[1]), { to: v(H[0] + d[0] * 0.6 + side[0] * 2.95, 0.9, H[1] + d[1] * 0.6 + side[1] * 2.95), fov: 40 });
  // The face of one of the cast, for a shot that is of that person: the camera looks there, wherever the pose has put the head
  const _face = new THREE.Vector3();
  const faceOf = (actor, up = 0) => { const b = actor.model.getObjectByName('mixamorigHead'); return () => { b.getWorldPosition(_face); _face.y += up; return _face; }; };
  function standGuards(list, who = escort, up = 0) { list.forEach(([x, z, yaw], i) => { const e = who[i]; e.kind('guard'); e.reset(); e.place(x, g.groundAt(z) + up, z, yaw); e.st = 'idle'; e.bar.visible = false; e.play('great_sword_idle', { fade: 0 }); }); }

  // ── the gate: Lankini bars the way. She is far bigger than he is, so the player is asked whether he should grow to
  // her size (one of his powers, like flight); he grows in a storm of light, she gives ground, and they fight as equals.
  // When she is down he takes his own size again, and she yields. ──
  const hz = -LANKINI_AT, lz = hz - 7.5;
  let retreat = 0, thaw = null;      // thaw: what ends the held picture of her entrance, while it is held
  // She stands in the road, sword in hand: seen from far off as he runs toward her.
  function bars() { lankini.kind('lankini'); lankini.reset(); lankini.place(0, g.groundAt(lz), lz, 0); lankini.st = 'idle'; lankini.bar.visible = false; lankini.play('sword_idle', { fade: 0 }); }
  function gate() {
    g.hold(); g.sound.score('gate'); G = g.groundAt(hz); retreat = 0;
    bars();
    if (done.challenged) { putHero(0, hz, 0); return transform(true); }      // she threw him back before: the words are said, he grows at once
    // Her entrance, as a film names a character: the picture holds (he is caught in mid stride, the street falls away
    // into the dark), the camera is carried round her close, and her name stands under her. Then the scene begins.
    const held = hero.current; if (held) held.timeScale = 0;
    // (Sid: "in that posture itself camera pan over her like a character intro and show this title, freeze. instead of
    // blacking the screen just background blur... camera movement from her chest to her face".) She stands as she
    // stood, held; the street behind her goes soft; the camera rises from her chest to her face.
    const enter = { ...shot(v(1.5, 2.0, lz + 3.9), v(0, 2.25, lz), { to: v(1.05, either(3.0, 3.15), lz + 3.1), lookTo: v(0, either(3.05, 2.95), lz), fov: either(34, 30), secs: 3.4 }), secs: 4.8,
      do: () => { g.hush(true); g.name('Lankini', 'Guardian of Lanka'); g.sound.hit('reveal', { delay: 0.15 }); lankini.play('sword_idle', { speed: 0 }); g.buzz([30, 40, 90]); } };
    thaw = () => { thaw = null; g.hush(false); g.name(null); if (held) held.timeScale = 1; putHero(0, hz, 0); };
    director.play([
      enter,
      ...beats('lankini_challenge', [
        { ...shot(v(1.9, 1.1, hz - 4.6), v(0, 2.7, lz), { to: v(1.5, 1.3, hz - 5.4), fov: 46 }), do: () => { if (thaw) thaw(); lankini.play('talk', { speed: 1 }); } },
        { ...shot(v(-1.4, 1.5, hz - 3.4), v(0, 1.35, hz), { to: v(-1.1, 1.5, hz - 2.9), fov: 42 }), do: () => lankini.play('sword_idle') },
        { ...shot(v(1.3, 2.1, hz + 2.6), v(0, 2.5, lz), { to: v(1.0, 2.0, hz + 2.0), fov: 50 }), do: () => lankini.play('talk') },
        { ...either(shot(v(6.4, 1.5, (hz + lz) / 2), v(0, 1.7, (hz + lz) / 2), { to: v(5.6, 1.5, (hz + lz) / 2), fov: 52, keep: both }), shot(v(1.9, 2.7, hz + 3.6), v(0, 2.0, lz), { to: v(1.5, 2.5, hz + 3.0), fov: 46 })), do: () => lankini.play('sword_idle') },
        { ...shot(v(-1.7, 0.9, hz - 4.4), v(0, 3.0, lz), { to: v(-1.3, 0.8, hz - 5.1), fov: 42 }), do: () => lankini.play('talk') },      // she will not have it: seen from below, the whole height of her over the lens
      ]),
      // the question: he stands small before her (seen from the side; on an upright phone, over her shoulder and down on him) until the player answers
      { hold: true, secs: 1e9, ...either(shot(v(6.2, 0.9, (hz + lz) / 2 + 0.6), v(0, 1.7, (hz + lz) / 2), { to: v(5.4, 1.0, (hz + lz) / 2 + 0.4), fov: 54, secs: 7, keep: both }),
          shot(v(1.5, 4.6, lz - 2.6), v(0, 0.7, hz), { to: v(1.2, 4.4, lz - 2.1), fov: 46, secs: 7, keep: him })), do: () => { lankini.play('sword_idle'); done.challenged = true; g.ask(() => director.skip()); } },
    ], () => { if (thaw) thaw(); transform(false); });
  }
  // He grows to her size. quick: the short telling, for a second meeting.
  function transform(quick) {
    g.hold(); const mid = (hz + lz) / 2;
    putHero(0, hz, 0); lankini.place(0, G, lz, 0); lankini.play('sword_idle');
    const rise = { ...shot(v(0, 1, hz), v(0, 1.2, hz), { lookTo: v(0, 2.4, hz), fov: 56, round: { c: v(0, 0, hz), from: Math.PI * 1.22, to: Math.PI * 0.72, r: [3.9, 6.4], y: [0.9, 2.7] } }), secs: quick ? 1.7 : 3.0,
      do: () => { aura.begin(0, G, hz); g.sound.fx('power'); g.grow(1, quick ? 1.4 : 2.6); aura.storm = true; g.sound.fx('fire'); g.sound.fx('beam', { gap: 0.3 }); g.sound.chant(); g.buzz([40, 30, 40, 30, 120]); hero.play('mutant_roaring', { once: true, fade: 0.15 }); } };
    // face to face, seen from the road behind his shoulder with her beyond him (from the side, far enough off to hold them both, the lens would stand inside the houses)
    const face = { ...either(shot(v(3.0, 1.5, hz + 5.8), v(0, 2.5, mid), { to: v(2.5, 1.7, hz + 5.0), fov: 50, keep: both }), shot(v(2.7, 1.3, hz + 5.4), v(0, 2.7, mid), { to: v(2.2, 1.5, hz + 4.6), fov: 50, keep: him })), secs: 1.4,
      do: () => { aura.end(); hero.play('great_sword_idle', { fade: 0.3 }); lankini.play('sword_idle', { fade: 0.2 }); g.sound.fx('bell', { rate: 0.7, gap: 0.5 }); } };
    director.play(quick ? [rise, face] : [
      rise,      // the answer is given and he grows at once: nothing stands between the question and the change
      { ...shot(v(2.0, 3.1, hz + 3.6), v(0, 2.6, lz), { to: v(1.5, 3.2, hz + 2.7), fov: 44 }), secs: 1.7,      // over his shoulder, level with her now: she gives ground
        do: () => { aura.want = 0.3; aura.storm = false; lankini.play('sword_hit', { once: true, fade: 0.06 }); retreat = 1.35; g.sound.fx('hit', { rate: 0.7 }); } },
      face,
    ], () => {      // however it was watched or skipped, it ends the same: he is her size, she has stepped back, the light is gone
      g.grow(1, 0.05); aura.end(); retreat = 0; lankini.root.position.z = Math.min(lankini.root.position.z, lz - (quick ? 0 : 1.4)); lankini.play('sword_idle');
      g.battle(LANKINI_MID, PLANS.gate, how => how === 'won' ? victory() : null, g.giant);
    });
  }
  // Thrown down by her, he stands before her again at her size and the fight begins at once: nothing is said or shown
  // again (Sid: "when he fails don't start the story part: start from the fight only, always").
  function rematch() {
    g.hold(); G = g.groundAt(hz); retreat = 0; done.challenged = true; bars();
    putHero(0, hz, 0, 'great_sword_idle'); g.grow(1, 0.05); lankini.play('sword_idle');
    g.battle(LANKINI_MID, PLANS.gate, how => how === 'won' ? victory() : null, g.giant);
  }
  // She is down: still at her size he roars over her, the light of his strength about him. Then he lets it go.
  function victory() {
    g.hold(); const p = hero.root.position, l = lankini.root.position, k = g.giant; G = g.groundAt(p.z);
    const dx = l.x - p.x, dz = l.z - p.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
    putHero(p.x, p.z, heroYaw(fx, fz), 'great_sword_idle'); lankini.bar.visible = false;
    const side = Math.abs(p.x + fz * 2.4 * k) < Math.abs(p.x - fz * 2.4 * k) ? 1 : -1;      // seen from the side nearer the middle of the road, low, a little toward her
    const cx = p.x + fx * 1.2 * k + fz * 2.4 * k * side, cz = p.z + fz * 1.2 * k - fx * 2.4 * k * side;
    director.play([{ ...shot(v(cx, 0.45 * k, cz), v(p.x, 1.2 * k, p.z), { to: v(p.x + (cx - p.x) * 0.75, 0.6 * k, p.z + (cz - p.z) * 0.75), lookTo: v(p.x, 1.4 * k, p.z), fov: 50, keep: him }), secs: 2.7,
      do: () => { hero.play('mutant_roaring', { once: true, from: 0.9, speed: 1.2, fade: 0.2 }); aura.begin(p.x, G, p.z); aura.want = 0.6; g.sound.fx('power'); g.sound.fx('smash', { rate: 0.6, delay: 0.45 }); g.sound.chant(); g.shake(0.6); g.buzz([60, 40, 200]); } }],
      () => shrink());
  }
  // The view is carried round him as he takes his own size again.
  function shrink() {
    g.hold(); const p = hero.root.position; G = g.groundAt(p.z);
    putHero(p.x, p.z, hero.root.rotation.y, 'great_sword_idle'); lankini.bar.visible = false;
    director.play([{ ...shot(v(p.x, 1, p.z), v(p.x, 2.3, p.z), { lookTo: v(p.x, 1.2, p.z), fov: 54, round: { c: v(p.x, 0, p.z), from: Math.PI * 0.2, to: Math.PI * 1.25, r: [6.2, 3.6], y: [3.0, 1.3] } }), secs: 3.0,
      do: () => { aura.begin(p.x, G, p.z, 0xbfdcff); g.grow(0, 2.5); g.sound.fx('wing'); g.sound.chant(); g.buzz([30, 30, 60]); } }],
      () => { g.grow(0, 0.05); aura.end(); yields(); });
  }
  function yields() {
    done.lankini = true; g.hold(); g.sound.score('yield');
    const p = hero.root.position, l = lankini.root.position, dx = l.x - p.x, dz = l.z - p.z, d = Math.hypot(dx, dz) || 1;
    hero.root.rotation.y = heroYaw(dx / d, dz / d); hero.play('breathing_idle', { fade: 0.3 }); lankini.bar.visible = false;
    director.play(beats('lankini_yields', [
      shot(v(l.x + 2.2, 0.9, l.z + 2.4), v(l.x, 0.45, l.z), { to: v(l.x + 1.6, 0.8, l.z + 2.9), fov: 46 }),
      shot(v(l.x - 1.2, 0.5, l.z + 0.6), v(p.x, 1.5, p.z), { to: v(l.x - 1.0, 0.7, l.z + 0.4), fov: 50 }),
      shot(v(p.x * 0.5 + 2.4, 3.2, p.z + 6.5), v(l.x * 0.5, 1.2, l.z - 6), { to: v(p.x * 0.5 + 1.6, 3.6, p.z + 5), fov: 56, keep: him }),
    ]), () => g.go());
  }

  // ── the grove ──
  const sitaAt = { x: SITA.x, z: -(GROVE_AT + SITA.n * CHUNK) + SITA.z }, treeAt = { x: TREE.x, z: -(GROVE_AT + TREE.n * CHUNK) + TREE.z };
  const hideAt = { x: HIDE.x, z: -(GROVE_AT + HIDE.n * CHUNK) + HIDE.z };
  // Hanuman goes by himself along marks [[x, z, seconds, clip, speed]], facing the way he goes; then stands as `then` says.
  function go(marks, then = null) { const p = hero.root.position; hero.sink = 0; hero.free = true; hero.pace = 0; hero.slide = 0; hero.busy = 0; hero.flying = false; hero.fly = 0; hero.floor = 0; hero.y = 0; hero.vy = 0; hero.lane = 1; leapTo = null; trek = { marks, i: 0, t: 0, x: p.x, z: p.z, then }; hero.play(marks[0][3], { speed: marks[0][4] || 1, fade: 0.2 }); }
  // Those who are in the grove when he comes: Sita on her seat, Ravana standing over her, his two guards. Seen from far off as he runs in.
  // Sita on her seat again, for a cut to her from far away: hands joined (1: bowed in prayer, 2: her face lifted). Returns
  // where she sits, the way she faces and the way to her left, for the shot.
  function seated(pray) {
    const sx = sitaAt.x, sz = sitaAt.z, Gs = g.groundAt(sz), yaw = yawTo(-2.3, 2.5), f = [Math.sin(yaw), Math.cos(yaw)], at = [sx + f[0] * SITA.edge, Gs + SITA.up, sz + f[1] * SITA.edge];
    sita.place(at[0], at[1], at[2], yaw); sita.play('sit', { fade: 0 }); sita.pray = pray; sita.offer.w = sita.offerL.w = 1;
    const to = (ahead, left, up) => [at[0] + f[0] * ahead + f[1] * left, at[1] + up, at[2] + f[1] * ahead - f[0] * left];
    return { at, to };
  }
  const unseat = () => { sita.pray = 0; sita.offer.on = sita.offerL.on = false; sita.offer.face = sita.offerL.face = null; sita.offer.w = sita.offerL.w = 0; sita.hide(); };
  const groveKept = () => { const n = Math.floor((GROVE_AT + SITA.n * CHUNK) / CHUNK); g.keep([n - 1, n, n + 1]); };      // her seat, her tree and the stretches on either side stay standing while the story may cut back to her
  function present() {
    done.present = true; groveKept(); const sx = sitaAt.x, sz = sitaAt.z, rx = sx - 2.3, rz = sz + 2.5, Gs = g.groundAt(sz), yaw = yawTo(rx - sx, rz - sz);
    sita.place(sx + Math.sin(yaw) * SITA.edge, Gs + SITA.up, sz + Math.cos(yaw) * SITA.edge, yaw); sita.play('sit', { fade: 0 });
    ravana.place(rx, Gs, rz, yawTo(sx - rx, sz - rz)); ravana.play('idle', { fade: 0 });
    standGuards([[rx - 4.2, rz + 2.0, yawTo(1, -0.6)], [rx + 1.2, rz + 4.4, yawTo(-0.1, -1)]]);      // well to either side of the way he goes by: he is broad
  }
  // The grove, in one unbroken move: the run slows, he slips behind an old tree at the side of the path, and from there,
  // over his shoulder, Ravana and Sita are watched. Ravana leaves to the left; then he leaps out to her.
  function grove() {
    done.grove = true; g.hold(); g.sound.score('night'); G = g.groundAt(sitaAt.z); if (!done.present) present();
    const sx = sitaAt.x, sz = sitaAt.z, rx = sx - 2.3, rz = sz + 2.5, U = SITA.up, T = hideAt, p = hero.root.position;
    // d: the way he looks from the tree, toward the two of them; side: across it, toward the path
    const dl = Math.hypot(sx - 1.2 - T.x, sz + 1 - T.z), d = [(sx - 1.2 - T.x) / dl, (sz + 1 - T.z) / dl], side = [-d[1], d[0]];
    const H = [T.x - d[0] * 2.3 + side[0] * 1.0, T.z - d[1] * 2.3 + side[1] * 1.0];      // where he hides: behind the trunk and clear of its great root (nearer, the root ran through his feet, then under his forward hand)
    const hid = () => squat(H[0], H[1], heroYaw(d[0], d[1]));
    go([[(p.x + H[0]) / 2 + 0.6, (p.z + H[1]) / 2, 1.1, 'running', 1], [H[0], H[1], 1.5, 'crouched_walking', 1.4]], hid);
    // the view from his hiding place: behind him, past the trunk, to the two under the great tree
    const eye = [T.x - d[0] * 4.3 + side[0] * 2.5, 2.0, T.z - d[1] * 4.3 + side[1] * 2.5], them = v(sx - 1.3, 1.5, sz + 1.2), cam = director.camera.position;
    const watch = (o = {}) => shot(v(...eye), them, { fov: 30, ...o });
    const arrive = { cam: { at: [cam.x, cam.y, cam.z], look: [p.x * 0.85, G + 1.4, p.z - 9], to: v(...eye), lookTo: them, fov: either(58, 44), fovTo: 30, secs: 3.2 } };      // the view he was run with is carried round to it: no cut
    const onHim = hidShot(H, d, side);
    const onRavana = shot(v(sx - 0.4, 1.0, sz + 0.9), v(rx, 2.35, rz), { to: v(sx - 0.7, 1.2, sz + 0.6), fov: 44 });
    const onSita = shot(v(sx - 1.7, 1.15 + U, sz + 1.5), v(sx, 1.02 + U, sz + 0.2), { to: v(sx - 1.3, 1.1 + U, sz + 1.2), fov: 40, face: faceOf(sita) });      // she sits on the platform, that much above the ground; the shot is of her face (it looked at her neck)
    const out = [sx - 13.8, sz - 5.4];      // the way Ravana goes: off to the left of what Hanuman sees, between the trees
    director.play(beats('grove_ravana', [
      arrive,
      { ...watch({ to: v(eye[0] + d[0] * 1.0, 1.95, eye[2] + d[1] * 1.0), fov: 30, fovTo: 23 }), do: () => { hid(); ravana.play('talk'); } },      // there already, even if the line before was tapped past
      { ...onRavana, do: () => ravana.play('talk') },
      { ...onSita, do: () => { ravana.play('idle'); sita.play('sit_talk'); } },
      { ...shot(v(sx - 1.5, 1.1 + U, sz + 1.0), v(sx, 1.05 + U, sz + 0.2), { to: v(sx - 1.2, 1.08 + U, sz + 0.8), fov: 36, face: faceOf(sita) }), do: () => sita.play('sit_talk') },
      { ...shot(v(sx + 1.5, 2.25, sz - 1.5), v(rx, 2.0, rz), { to: v(sx + 1.2, 2.2, sz - 1.2), fov: 48 }), do: () => { clear = { beats: director.beats, i: director.i, on: false }; } },      // over her head and the back of her seat. From here the lens looks through the shaft of moonlight that falls on her and across the mist on the grass, toward the moon: a white wash lay over him. For this one shot the veils are put out and the moon stands behind the camera
      { ...onRavana, do: () => { sita.play('sit'); ravana.play('command', { once: true }); ravana.rise = 1.3; } },
      { ...watch({ fov: 34 }), do: () => { hid(); ravana.walk(out[0], out[1], 6.2); escort.forEach((e, i) => { e.root.rotation.y = yawTo(out[0] - rx, out[1] - rz); e.play('great_sword_walk'); e.leave = 1; e.go = [(out[0] - rx) / Math.hypot(out[0] - rx, out[1] - rz), (out[1] - rz) / Math.hypot(out[0] - rx, out[1] - rz)]; }); } },
      { ...onHim, do: hid },
    ]), meets);
  }
  function meets() {
    g.sound.score('sita');
    g.hold(); G = g.groundAt(sitaAt.z); const sx = sitaAt.x, sz = sitaAt.z, hx = sx - 2.0, hz = sz + 2.1, U = SITA.up, T = hideAt;
    ravana.hide(); escort.forEach(e => { e.reset(); e.leave = 0; });
    const yaw = yawTo(hx - sx, hz - sz);
    sita.place(sx + Math.sin(yaw) * SITA.edge, G + U, sz + Math.cos(yaw) * SITA.edge, yaw); sita.play('sit', { fade: 0.2 });
    const dl = Math.hypot(sx - 1.2 - T.x, sz + 1 - T.z), d = [(sx - 1.2 - T.x) / dl, (sz + 1 - T.z) / dl], side = [-d[1], d[0]];
    const H = [T.x - d[0] * 2.3 + side[0] * 1.0, T.z - d[1] * 2.3 + side[1] * 1.0];
    squat(H[0], H[1], heroYaw(d[0], d[1]));      // behind his tree, whatever was skipped; he comes to her with empty hands
    const eye = [T.x - d[0] * 4.3 + side[0] * 2.5, 2.0, T.z - d[1] * 4.3 + side[1] * 2.5];
    // out from hiding in one leap, down beside her, and a bow
    const leap = () => { hero.bow(0); hero.sink = 0; leapTo = { x0: H[0], z0: H[1], x: hx, z: hz, t: 0, secs: 1.25, up: 3.4, then: () => { putHero(hx, hz, heroYaw(sx - hx, sz - hz), 'hard_landing'); hero.play('hard_landing', { once: true, fade: 0.08 }); } }; hero.root.rotation.y = heroYaw(hx - H[0], hz - H[1]); const w = hero.actions.running_jump.getClip().userData; hero.play('running_jump', { once: true, from: Math.max(0, w.from - 0.06), speed: (w.to - w.from + 0.06) / 1.25, fade: 0.1 }); };
    const landed = () => { if (leapTo || hero.root.position.x < hx - 1) { leapTo = null; putHero(hx, hz, heroYaw(sx - hx, sz - hz), 'breathing_idle'); } };      // there already, even if the leap was tapped past
    // where the hands go (the two sit and stand three paces apart, so each giving is seen close, on the hand that gives):
    // f: the way from him to her along the ground; r: toward his right hand
    const fl = Math.hypot(sx - hx, sz - hz), f = [(sx - hx) / fl, (sz - hz) / fl], r = [-f[1], f[0]];
    const hand = [hx + f[0] * 0.5 + r[0] * 0.22, G + 1.2, hz + f[1] * 0.5 + r[1] * 0.22], keeps = [hx + f[0] * 0.42 + r[0] * 0.2, G + 1.3, hz + f[1] * 0.42 + r[1] * 0.2];
    const qx = sita.root.position.x, qz = sita.root.position.z;      // where she really sits: at the edge of her seat, toward him
    const hers = [qx - f[0] * 0.3 - r[0] * 0.14, G + U + 1.0, qz - f[1] * 0.3 - r[1] * 0.14], gives = [qx - f[0] * 0.5 - r[0] * 0.2, G + U + 0.98, qz - f[1] * 0.5 - r[1] * 0.2];
    const near = (p, df, dr, dy, look, fov) => shot([p[0] + f[0] * df + r[0] * dr, p[1] + dy, p[2] + f[1] * df + r[1] * dr], [p[0], p[1] + look, p[2]], { to: [p[0] + f[0] * df * 0.86 + r[0] * dr * 0.86, p[1] + dy * 0.92, p[2] + f[1] * df * 0.86 + r[1] * dr * 0.86], fov });
    const ringShot = near(hand, 0.66, 0.34, 0.26, 0.12, either(40, 30)), jewelShot = near(gives, -0.62, -0.3, 0.32, 0.1, either(40, 30)), keepShot = near(keeps, 0.7, 0.3, 0.24, 0.1, either(40, 30));
    const onHero = shot(v(hx + 1.44, 1.5, hz - 0.21), v(hx, 1.52, hz), { to: v(hx + 1.3, 1.5, hz - 0.3), fov: either(36, 27) });      // close on him as he speaks, the grove behind him: nothing of her seat in the picture (on a phone its back came up under the words)
    const onHeroBow = shot(v(hx + 1.75, 1.42, hz - 0.26), v(hx, 1.34, hz), { to: v(hx + 1.6, 1.42, hz - 0.36), fov: either(40, 30) });      // a little wider and lower as he names himself: his joined hands stand clear above the words
    const onSita = shot(v(hx + 0.2, 1.3 + U, hz - 0.2), v(sx, 1.1 + U, sz + 0.2), { to: v(hx + 0.4, 1.25 + U, hz - 0.4), fov: 38, face: faceOf(sita) });
    const two = either(shot(v(sx - 3.2, 1.2, sz - 1.7), v(sx - 1.0, 1.1, sz + 1.2), { to: v(sx - 2.7, 1.25, sz - 2.1), fov: 46 }), shot(v(hx - 2.1, 1.9, hz + 0.9), v(sx - 0.5, 1.05, sz + 0.5), { to: v(hx - 1.8, 1.85, hz + 0.7), fov: 46 }));
    director.play(beats('grove_sita', [
      shot(v(...eye), v(sx, 1.2 + U, sz + 0.3), { to: v(eye[0] + d[0] * 1.2, 1.95, eye[2] + d[1] * 1.2), fov: 26, fovTo: 20 }),      // from his hiding place: she is alone now
      hidShot(H, d, side),
      { ...shot(v(1.4, 2.3, H[1] + 5.5), v((H[0] + hx) / 2, 1.9, (H[1] + hz) / 2), { to: v(1.0, 2.0, H[1] + 3.5), lookTo: v(hx - 0.6, 1.2, hz), fov: 56 }), secs: 3.4, do: leap },      // from the path behind him: the tree, the leap, and her under the great tree beyond
      { ...onHeroBow, do: () => { landed(); hero.play('breathing_idle', { fade: 0.4 }); hero.bow(1); } },      // "Mother": he stands before her with joined hands
      { ...onSita, do: () => { landed(); sita.play('sit_talk'); hero.bow(0); } },      // while she answers (he is out of the picture) his hands come apart, so the ring is first seen in a hand already open
      { ...ringShot, do: () => { landed(); sita.play('sit'); hero.bow(0); offer(hero, ring, hand); } },      // the ring, lying in his open hand held out to her
      { ...onSita, do: () => { sita.play('sit_talk'); offer(sita, ring, hers); } },      // and now in hers: she holds it before her and looks at it
      { ...onHero, do: () => offer(null) },
      { ...jewelShot, do: () => { landed(); sita.play('sit_talk'); offer(sita, jewel, gives); } },      // her jewel, held out to him
      { ...keepShot, do: () => { sita.play('sit'); offer(hero, jewel, keeps); } },      // and it lies in his hand as he gives his word
      { ...shot(v(sx - 5.2, 2.4, sz + 5.4), v(sx - 0.8, 1.1, sz + 0.8), { to: v(sx - 6.4, 3.4, sz + 7.2), fov: 50 }), do: () => { landed(); sita.play('sit_talk'); offer(null); hero.bow(1); } },      // he takes his leave of her with joined hands
    ]), wreck);
  }
  function wreck() {
    trek = null; leapTo = null; hero.bow(0); if (hero.mace) hero.mace.visible = true; g.hold(); g.sound.score('vow'); const z = -GROVE_MID - 7; offer(null); sita.play('sit');
    putHero(0, z, heroYaw(0, 1), 'great_sword_idle');
    // His vow, and then his roar (Hans's timing): a cue rises under the two lines; he says the second and only then throws
    // his head back, a breath after its last word, so the roar does not bury what it is for; the fight begins on its tail.
    let roared = false;
    const roar = () => { if (roared) return; roared = true; vowT = -1; hero.play('mutant_roaring', { once: true, from: 0.9, fade: 0.2 }); g.sound.hit('roar'); g.shake(0.35); g.buzz([40, 30, 120]); };
    director.play(beats('grove_wreck', [
      shot(v(1.6, 1.2, z + 3.6), v(0, 1.4, z), { to: v(1.2, 1.3, z + 3.0), fov: 42 }),
      { ...shot(v(-2.4, 0.7, z + 4.2), v(0, 1.6, z), { to: v(-1.8, 0.8, z + 3.4), fov: 50 }), secs: 4.9, do: () => { vowT = 3.2; vowRoar = roar; } },
    ]), () => { roar(); g.battle(GROVE_MID, PLANS.grove, how => { if (how === 'lost') bound(true); else chase(); return true; }); });      // tapped past before the roar: he roars as the fight begins. Won or overcome, the grove ends the same way: he is bound and led to Ravana
  }
  // He has beaten the three; then ten more come running out from among the trees on both sides and along the path,
  // and close a ring round him: there is no fighting his way out of that. Taken either way, he is bound where he stands.
  // He has put the three down. He runs on, flat out, for the palace (this is play: the lanes are his); from far ahead
  // something is thrown, low and spinning; it winds round his ankles and he goes over on his face at full speed.
  function chase() {
    for (const e of fight.all) e.bar.visible = false;
    snare = { at: THRONE_AT - 18, t: -1, from: null, fall: null };
    g.go(); g.dash(10.5);
  }
  function trip() {
    const p = hero.root.position; g.grow(0, 0.15); g.hold(); G = g.groundAt(p.z);
    bola.visible = false; cuff.visible = true; cuff.position.set(0, 0.16, 0); cuff.rotation.set(0, 0, 0);
    hero.play('falling_idle', { fade: 0.12 }); hero.y = hero.floor = 0; hero.vy = 0;
    snare.fall = { t: 0, v: 10, hit: false, rest: false };
    g.sound.score('bound'); g.sound.fx('hit', { rate: 1.3 }); g.buzz(40);
    // seen from in front of him and low, close
    const x0 = p.x, z0 = p.z, side = x0 > 0.4 ? 1 : -1;
    const ride = () => { const q = hero.root.position, k = hero.prone; return { at: [x0 - side * (1.7 + 0.9 * k), G + 0.85 - 0.2 * k, q.z - 4.4 + 1.9 * k], look: [q.x, G + 1.2 - 0.9 * k, q.z - 0.9 * k] }; };      // it goes with him, in front and to one side, and comes round and nearer as he lands: he fills the picture from the first frame to the last
    director.play([{ secs: 2.8, cam: { at: ride().at, look: ride().look, fov: 40, ride } }], () => { if (snare && snare.fall) { snare.fall.rest = true; hero.prone = 1; cuff.rotation.x = -1.5; cuff.position.y = 0.28; } bound(false, true); });
  }
  function bound(taken, fallen = false) {
    if (!fallen) g.sound.score('bound');
    g.hold(); const hp = hero.root.position, p = fallen ? { x: hp.x, z: hp.z - 0.95 } : { x: Math.max(-2, Math.min(2, hp.x)), z: hp.z }, base = -(GROVE_AT + HIDE.n * CHUNK);      // fallen, he lies ahead of his feet: the ring closes round the middle of him
    for (const e of fight.all) { e.reset(); e.trail.clear(); }
    if (!fallen) putHero(p.x, p.z, heroYaw(0, -1), 'great_sword_idle'); G = g.groundAt(p.z);
    const bind = () => { if (fallen) { unsnare(); putHero(p.x, p.z, heroYaw(0, -1), 'great_sword_idle'); }      // hauled to his feet, and bound
      fight.guards.forEach(e => { if (e.march) { e.place(e.march.x, G, e.march.z, yawTo(p.x - e.march.x, p.z - e.march.z)); e.play('great_sword_idle'); e.march = null; } }); hero.bind(true); standGuards([[p.x - 1.5, p.z + 0.5, yawTo(1, -0.4)], [p.x + 1.5, p.z + 0.5, yawTo(-1, -0.4)]]); };
    const tied = beats('grove_bound', [
      { ...shot(v(p.x + 3.4, 1.5, p.z - 3.8), v(p.x, 1.3, p.z), { to: v(p.x + 2.8, 1.5, p.z - 3.2), fov: 48 }), do: bind },
      shot(v(p.x - 0.9, 1.5, p.z - 2.6), v(p.x, 1.45, p.z), { to: v(p.x - 0.6, 1.5, p.z - 2.2), fov: 38 }),
      shot(v(p.x + 0.6, 2.4, p.z + 5.2), v(p.x, 1.2, p.z - 4), { to: v(p.x + 0.4, 2.8, p.z + 6.4), fov: 52 }),
    ]);
    if (taken) return director.play(tied, () => g.fade(court));
    // where the ten start from: the gaps between the trees on either side (clear of the trunks and of the pond), and the path behind him
    const from = [];
    for (const gap of [base - 8, base - 16]) for (const s of [-1, 1]) from.push([s * 7.2, gap - 0.8], [s * 6.2, gap + 0.8]);
    from.push([-1.3, p.z + 13], [1.3, p.z + 14]);
    fight.guards.forEach((e, i) => {
      const a = (i + 0.5) / 10 * Math.PI * 2, to = [p.x + Math.sin(a) * 3.4, p.z + Math.cos(a) * 3.4];
      const at = from.reduce((best, f) => f.used || (best && Math.hypot(best[0] - to[0], best[1] - to[1]) <= Math.hypot(f[0] - to[0], f[1] - to[1])) ? best : f, null); at.used = true;      // each from the place nearest where he will stand
      e.kind(['guard', 'rusher', 'guard', 'brute', 'guard', 'captain'][i % 6]); e.reset(); e.place(at[0], G, at[1], yawTo(to[0] - at[0], to[1] - at[1])); e.st = 'idle'; e.bar.visible = false;
      e.play('great_sword_run', { fade: 0 }); e.march = { x0: at[0], z0: at[1], x: to[0], z: to[1], t: -0.15 * (i % 4), secs: fallen ? 1.8 : 2.3 };      // (he is down: they are on him at once)
    });
    g.sound.fx('bell', { rate: 0.8, gap: 1 }); g.buzz([40, 60, 40]); g.sound.warm('hall');      // the court's opening is made ready now: it must sound on the hall's first frame
    director.play([
      { secs: 2.9, ...shot(v(p.x + 0.6, 5.4, p.z + 9), v(p.x, 1.0, p.z - 1), { to: v(p.x + 0.4, 4.6, p.z + 7.6), fov: 60 }), do: () => { if (!fallen) hero.play('great_sword_idle', { fade: 0.2 }); } },      // from above and behind: they pour in from both sides
      { secs: 3.0, cam: { round: { c: [p.x, G + 1.25, p.z], from: -0.52, to: 0.52, r: [6.8, 5.6], y: fallen ? [2.2, 2.8] : [0.3, 1.1] }, at: v(p.x, 1, p.z + 6), look: v(p.x, fallen ? 0.7 : 1.3, p.z), fov: 52 },      // (brought down, he is low among them: the view looks in over their shoulders)
        do: () => { g.say(STORY.alerts.bound, 2.6); if (fallen) { hero.prone = 0; squat(p.x, p.z, heroYaw(0, -1)); } } },      // he has got as far as his heels, the cords still round his ankles, and goes no further      // carried across the road behind the ring as it closes (never out among the lanterns): swords levelled at him on every side
      ...tied,
    ], () => g.fade(court));
  }

  // ── Ravana's court ──
  function court() {
    g.hold(); g.sound.score('hall', { rise: 0.05 });      // the court's own opening music, an original: its great stroke falls as Ravana is first seen
    sita.hide(); offer(null); unsnare(); groveKept();
    const base = -(THRONE_AT + THRONE.n * CHUNK), tz = base + THRONE.z, hz = base + STAND.z, T = THRONE.top; G = g.groundAt(hz);
    putHero(0, hz, 0); hero.bind(true);
    fight.guards.forEach(e => { e.march = null; e.reset(); });      // the ring of the grove is left behind
    standGuards([[-1.6, hz + 0.7, Math.PI], [1.6, hz + 0.7, Math.PI]]);
    standGuards([[-3.3, tz + 0.6, 0.5], [3.3, tz + 0.6, -0.5]], wardens, T - 0.35);      // on the second step of the dais
    ravana.place(0, G + T + 0.34, tz + 0.62, 0); ravana.play('sit', { fade: 0 });
    g.card('throne');
    const wide = shot(v(0, 2.3, -THRONE_AT - 3), v(0, 3.2, tz), { to: v(0, 2.0, -THRONE_AT - 15), fov: 56 });
    const crane = shot(v(-5.2, 7, hz + 9), v(0, 2.6, tz), { to: v(-3.4, 5.2, hz + 3), fov: 52 });
    const onRavana = shot(v(1.5, T + 2.0, tz + 4.4), v(0, T + either(2.2, 1.7), tz + 0.4), { to: v(1.1, T + 2.05, tz + 3.7), fov: either(32, 27) });      // close on him: his face and shoulders, the dark red of the throne behind
    const onHero = shot(v(-1.2, 1.55, hz - 2.6), v(0, 1.45, hz), { to: v(-0.9, 1.55, hz - 2.2), fov: either(38, 30) });
    const over = shot(v(1.5, 2.3, hz + 3.0), v(0, T + 2.2, tz), { to: v(1.1, 2.2, hz + 2.4), fov: 46 });
    const down = shot(v(1.0, T + 3.7, tz + 1.3), v(0, 1.2, hz), { to: v(0.7, T + 3.5, tz + 1.6), fov: 50 });
    // first the hall itself, in four looks without a word: Shiva's face and the length of him, a Nandi by the steps, the fires along the aisle, and the whole of it from the door
    const sy = HALL.seat, szv = base + HALL.shivaZ, see = (at, look, o, secs) => ({ ...shot(at, look, o), secs });
    const hall = [
      see(v(2.8, sy + 10.2, base - 11.5), v(0, sy + 11.6, szv), { to: v(2.2, sy + 6.4, base - 11), lookTo: v(0, sy + 6.8, szv), fov: 40 }, 3.4),
      see(v(4.4, 1.5, tz + 9.6), v(8.1, 2.1, tz + 6.3), { to: v(5.0, 1.9, tz + 9.0), fov: 42 }, 2.4),
      see(v(-2.6, 0.7, base + 19), v(-5.6, 2.3, base + 8), { to: v(-2.9, 1.2, base + 15.5), lookTo: v(-4.6, 3.4, base - 4), fov: 50 }, 2.8),
      see(v(0, 9.5, base + 21.5), v(0, 7.5, szv), { to: v(0, 3.4, base + 18), lookTo: v(0, 5.5, szv), fov: 62 }, 3.4),
    ];
    // his tail is alight: he grows, the ropes burst, and the two who hold him are thrown back
    const RING = [[-3.5, -1.0], [3.4, 1.5], [-2.6, 3.2], [0.6, 4.4]];      // where the guards who run in take their stand round him (x, and z from where he stands)
    const hurl = (e, dx, dz) => { if (!e.root.visible) return; const q = e.root.position; e.play('two_handed_sword_death', { once: true, fade: 0.08 }); e.march = { x0: q.x, z0: q.z, x: q.x + dx, z: q.z + dz, t: 0, secs: 0.6, stay: true }; };
    const burst = () => {
      hero.bind(false); aura.begin(0, G, hz); aura.storm = true; g.grow(1, 2.2); hero.play('mutant_roaring', { once: true, fade: 0.15 });
      brand.visible = false; torch = null; g.light(true);
      escort.forEach((e, i) => hurl(e, (i ? 1 : -1) * 2.6, 1.6)); wardens.forEach(e => e.play('great_sword_impact', { once: true, fade: 0.1 }));
      // the guards of the court come running up the hall and close round him, swords out, and none of them comes nearer
      RING.forEach(([x, z], i) => { const e = fight.guards[i], from = [x * 0.55, hz + 13 + (i % 2) * 1.5]; e.kind(i === 3 ? 'captain' : 'guard'); e.reset(); e.place(from[0], G, from[1], Math.PI); e.st = 'idle'; e.bar.visible = false;
        e.play('great_sword_run', { fade: 0 }); e.march = { x0: from[0], z0: from[1], x, z: hz + z, t: -0.5 - 0.2 * i, secs: 2.0 }; });
      g.sound.fx('power'); g.sound.fx('fire'); g.sound.chant(); g.shake(0.5); g.buzz([60, 40, 160]);
    };
    // The brand: the guard at his right hand walks round behind him with fire on his blade and strikes at the tail.
    const kindle = () => { const e = escort[1], q = e.root.position; torch = { e, t: 0, stage: 0, from: [q.x, q.z], to: [1.05, hz + 1.75] }; brand.visible = true; e.play('great_sword_walk', { fade: 0.15 }); };
    // The word is given: he roars and those round him are thrown outward, seen from where the camera already is; the
    // picture goes to black from that view, and the run begins. (Ending the scene at once showed the chase camera in
    // the court for a few frames before the black: a view from nowhere between the choice and what it brings.)
    let loosed = false, gone = false;
    const bars = open => director.el.root.querySelectorAll('.bar').forEach((b, i) => { b.style.transition = open ? 'transform .5s ease-in' : ''; b.style.transform = open ? `translateY(${i ? 100 : -100}%)` : ''; });      // the black bands of a scene draw back as the run begins, so the picture is already whole when play takes it
    const leave = () => { g.keep([]); unseat(); bars(false); trek = null; leapTo = null; turn = null; hero.bind(false); aura.end(); brand.visible = false; torch = null; g.light(true); g.grow(0, 0.01); ravana.hide(); fight.guards.forEach(e => { e.march = null; e.reset(); }); g.ablaze(); };
    const loose = () => {
      loosed = true; hero.play('mutant_roaring', { once: true, from: 0.9, fade: 0.1 }); g.sound.hit('roar'); g.shake(0.7); g.buzz([40, 30, 140]);
      RING.forEach(([x, z], i) => { const k = 2.4 / Math.hypot(x, z); hurl(fight.guards[i], Math.sign(x) * Math.max(Math.abs(x) * k, 3.2 - Math.abs(x)), z * k); });      // none of them is left lying in the road he is about to take down the hall
      setTimeout(() => { if (!gone) breakout(); }, 850);
    };
    // No black and no cut between the word and the run, and Ravana is left behind him (Sid: "he runs in the opposite
    // direction... straight from the courtroom to the outside, and we need not show Ravana on that side... it's continuous,
    // breaking the courtroom wall as he goes"): he turns his back on the throne and runs down the length of the hall, the
    // guards who come at him from the doors are flung to either side, and he goes through the shut doors without slowing.
    // The camera does not cut either: from where it stood for the choice it swings in behind him and ends where the chase
    // view of the run stands, so that the run takes over in the frame the doors give way (ablaze() in main.js).
    const breakout = () => {
      const doors = base + CHUNK - 0.7, end = doors - 2.1, pace = 10.5, turnSecs = 0.36, secs = (end - hz) / pace;
      const road = [[4, -1.3, 5.4], [5, 1.3, 6.6], [6, -1.0, 10.6], [7, 1.1, 11.8], [8, -1.5, 16.2], [9, 1.5, 17.3]];      // guard, x, z from where he stands
      road.forEach(([i, x, dz]) => {
        const e = fight.guards[i], at = turnSecs + (dz - 1.2) / pace, run = 0.75, from = Math.min(doors - 1.4, hz + dz + 6.5), wait = Math.max(0, at - 0.08 - run);
        e.march = null; e.kind('guard'); e.reset(); e.place(x * 1.5, G, from, yawTo(-x * 0.2, -1)); e.st = 'idle'; e.bar.visible = false; e.play('great_sword_idle', { fade: 0 });
        setTimeout(() => { if (gone) return; e.play('great_sword_run', { fade: 0.12 }); e.march = { x0: x * 1.5, z0: from, x, z: hz + dz, t: 0, secs: at - 0.08 - wait }; }, wait * 1000);
        setTimeout(() => { if (!gone) { hurl(e, Math.sign(x) * 4.2, 1.5); g.sound.fx('hit', { gap: 0.05 }); g.shake(0.35); g.buzz(25); } }, at * 1000);
      });
      const c0 = director.camera.position.toArray(), l0 = director.look.toArray(), back = either(6.94, 8.16), high = either(3.37, 4.36);      // where the chase view stands behind him at this size (placeCamera in main.js)
      let struck = false;
      const ride = w => {      // from the first moment of his turn the view is on its way: it does not wait among the ranks where it stood
        const p = hero.root.position, m = (a, b) => a + (b - a) * w;
        if (!struck && p.z > end - 0.9) { struck = true; g.smash(0, G, doors); }      // the doors give way a moment before the picture is the run's
        return { at: [m(c0[0], 0), m(c0[1], G + high), m(c0[2], p.z - back)], look: [m(l0[0], 0), m(l0[1], G + 2.25), m(l0[2], p.z + 9)] };
      };
      director.play([{ secs: 9, cam: { at: c0, look: l0, ride, fov: either(60, 50), fovTo: either(58, 43.75), secs: turnSecs + secs * 0.72 } }], () => { gone = true; g.unask(); leave(); });
      hero.play('fast_run', { speed: 1.15, fade: 0.2 }); bars(true);
      turn = { from: hero.root.rotation.y, to: hero.root.rotation.y + Math.PI, t: 0, secs: turnSecs, then: () => go([[0, end, secs, 'fast_run', 1.15]], () => { if (!gone) director.skip(); }) };
    };
    director.play([
      ...hall,
      ...beats('court_arrival', [wide, crane]),
      ...beats('throne', [
        { ...onRavana, do: () => ravana.play('sit_talk') },
        { ...onHero, do: () => ravana.play('sit') },
        { ...down, do: () => ravana.play('sit_talk') },
        { ...onHero, do: () => ravana.play('sit') },
        over,
        { ...onRavana, do: () => ravana.play('sit_talk') },
        { ...onHero, do: () => ravana.play('sit') },
        { ...shot(v(-2.3, 1.2, hz - 1.3), v(0, 1.6, hz - 0.4), { to: v(-2.0, 1.3, hz - 1.9), fov: 50 }) },
        { ...shot(v(-1.6, T + 1.9, tz + 4.4), v(0, T + 2.5, tz), { to: v(-1.2, T + 2.2, tz + 3.8), fov: 44 }), do: () => { ravana.play('sit_exit', { once: true }); ravana.rise = 1.1; ravana.root.position.y = G + T; ravana.root.position.z = tz + 1.5; } },
        // his order, seen from in front of him and a little below: the whole of him standing before his throne, the row of heads, the arm thrown out (Sid: "where he points his fingers and tells them to burn... the camera more to the front"; it had been taken from far behind Hanuman, and he was small)
        { ...shot(v(-1.6, T + 1.25, tz + 5.9), v(either(0.15, 0.38), T + 1.42, tz + 1.5), { to: v(-1.15, T + 1.35, tz + 5.2), fov: either(40, 34) }), do: () => ravana.play('command', { once: true, fade: 0.2 }) },
      ]),
      // Ravana's word is carried out before our eyes: a guard brings a burning brand round behind him and puts it to his tail
      { ...shot(v(-1.5, 0.8, hz + 3.5), v(0.35, 1.3, hz + 1.0), { to: v(-1.2, 0.85, hz + 3.0), fov: either(50, 40) }), secs: 3.4, do: kindle },
      ...beats('ignite', [
        // "Sita prays": she is seen, in the grove, on her seat, her hands joined and her head bowed over them (Sid: "show her in praying
        // posture, that cut"); then his face, quiet, the fire at his back
        (() => { let s = null, back = false; const mix = (a, b, u) => a.map((x, i) => x + (b[i] - x) * u), A = v(1.4, 1.15, hz - 2.9), B = v(1.0, 1.3, hz - 2.3), L = v(0, 1.5, hz);
          const ride = u => { if (!s) return { at: A, look: L }; if (u < 0.6) return { at: mix(s.to(1.75, 0.55, 1.02), s.to(1.45, 0.4, 1.0), u / 0.6), look: s.to(0.1, 0, 0.93) }; if (!back) { back = true; unseat(); } return { at: mix(A, B, (u - 0.6) / 0.4), look: L }; };
          return { cam: { at: A, look: L, fov: either(38, 30), ride }, do: () => { g.light(true); s = seated(1); } }; })(),
        { ...shot(v(0, 1, hz), v(0, 1.3, hz), { lookTo: v(0, 2.3, hz), fov: 60, round: { c: v(0, 0, hz), from: Math.PI * 1.2, to: Math.PI * 0.78, r: [3.0, 3.9], y: [0.8, 2.0] } }), secs: 3.6, do: () => { unseat(); burst(); } },      // carried round him inside the ranks as he grows
      ]),
      // and there he stands, grown, his tail burning, the guards of the court closing round him: the player is given the word.
      // The camera goes on round him from where it was, slowly, until the answer comes.
      { hold: true, secs: 1e9, ...shot(v(0, 1, hz), v(0, 2.3, hz), { fov: 60, secs: 11, keep: him, round: { c: v(0, 0, hz), from: Math.PI * 0.78, to: Math.PI * 0.56, r: [3.9, 5.2], y: [2.0, 1.5] } }),
        do: () => { aura.end(); hero.play('breathing_idle', { fade: 0.3 }); g.ask(loose, 'Burn Lanka', ''); } },
    ], () => { gone = true; g.unask(); if (loosed) leave(); else g.fade(leave); });      // skipped before the word was given: through the black
  }

  // ── the end: grown vast, he roars in the middle of the burning city, then leaps for the sea ──
  const VAST = 13;      // how many times his own height he stands at the last: head and shoulders over the towers of Lanka
  const swell = { t: 0, secs: 0, from: 1, to: 1 }, leap = { on: false, t: 0 };
  function ending() {
    done.end = true; g.hold(); g.sound.score('end'); const p = hero.root.position, z = p.z; G = g.groundAt(z);
    putHero(0, z, heroYaw(0, 1), 'mutant_roaring'); hero.play('mutant_roaring', { once: true, fade: 0.2 });
    swell.from = hero.root.scale.x; swell.to = VAST; swell.t = 0; swell.secs = 3.2; leap.on = false;
    g.sound.fx('power'); g.sound.chant(); g.buzz([80, 60, 80, 60, 200]);
    g.sky(true);      // all Lanka is laid round the street now, for the shots from the sky
    groveKept();      // and the grove stands again where it stood, for the cut back to Sita
    const H = 1.9 * VAST;      // every low shot stays over the street itself: the houses and towers stand close on both sides
    const flies = () => { hero.root.rotation.y = 0; hero.flyHeight = 4.2; hero.startFlight(); leap.on = true; leap.t = 0; g.sound.fx('wing'); g.sound.fx('power'); g.buzz([60, 40, 160]); };
    const gone = () => { leap.on = false; hero.root.visible = false; g.light(false); };
    director.play([
      ...beats('roar', [
        shot(v(1.6, 1.6, z + 20), v(0, H * 0.34, z), { to: v(2.2, 2.4, z + 33), lookTo: v(0, H * 0.6, z), fov: 64, secs: 4.6 }),
        { ...shot(v(-3.4, H * 0.5, z + 15), v(0, H * 0.62, z), { to: v(3.4, H * 0.56, z + 17), fov: 56, secs: 5.5 }), do: () => { g.sound.hit('roar'); hero.play('mutant_roaring', { once: true, fade: 0.2 }); g.sound.chant(); g.sound.fx('power'); g.buzz([80, 60, 200]); } },
      ]),
      ...beats('ending', [
        // from the sky, drawing back and up: the whole city burning under him, the smoke closing round it
        { ...shot(v(-10, H * 1.25, z + 58), v(0, H * 0.6, z), { to: v(-70, 190, z + 270), lookTo: v(0, 16, z - 24), fov: 50, secs: 9 }), secs: 8.4, do: () => hero.play('victory', { fade: 0.5 }) },
        // "Sita is safe in the grove": she is seen there, under her tree, her hands joined and her face lifted, the grove whole
        // about her (Sid: "a nice cut: she is safe")
        (() => { let s = null; const ride = u => (s ? { at: s.to(4.4 - 1.3 * u, 1.5 - 0.5 * u, 1.35), look: s.to(0, 0, 0.82) } : { at: v(2.6, 3.2, z + 30), look: v(0, H * 0.7, z) });
          return { cam: { at: v(2.6, 3.2, z + 30), look: v(0, H * 0.7, z), fov: either(40, 32), secs: 5.5, ride }, secs: 5, do: () => { s = seated(2); } }; })(),
        // and he is away: seen from far ahead and high as he comes over the roofs and passes overhead
        { ...shot(v(30, 66, z - 138), v(0, H * 1.1, z - 10), { to: v(22, 58, z - 150), lookTo: v(0, H * 2.5, z - 104), fov: 56, secs: 6 }), secs: 5.6, do: () => { unseat(); flies(); } },
      ]),
      // the credits, over the city burning far below
      { ...shot(v(0, 150, z + 250), v(0, 14, z), { fov: 46, round: { c: v(0, 0, z), from: 0.2, to: 0.95, r: [255, 285], y: [150, 185] }, secs: 19 }), secs: 4.6, do: () => { gone(); g.credits(0); } },
      { secs: 8.2, do: () => g.credits(1) },
      { secs: 5.2, do: () => g.credits(2) },
    ], () => { leap.on = false; hero.flyHeight = 2.5; g.sky(false); g.keep([]); unseat(); hero.root.visible = true; g.finish(); });
  }

  return {
    done, sita, ravana, gate, rematch, yields, grove, meets, wreck, chase, trip, bound, court, brand,
    // Everything of the story put away: a new journey from the gate.
    reset(fresh) {
      if (thaw) thaw(); unsnare(); g.keep([]); sita.pray = 0; sita.offer.face = sita.offerL.face = null; sita.offerL.on = false; g.hush(false); g.name(null); g.sky(false); hero.root.visible = true; sita.hide(); ravana.hide(); offer(null); brand.visible = false; torch = null; vowT = -1; hero.bind(false); if (fresh) done.lankini = done.challenged = false; aura.stop(); retreat = 0; done.grove = false; done.present = false; trek = null; leapTo = null; turn = null; done.end = false; fight.guards.forEach(e => { e.march = null; }); swell.t = swell.secs = 0; leap.on = false;
    },
    // Called while he runs: does the story take over here? d: metres along the route.
    check(d, fire) {
      if (!done.lankini && !fire && d >= LANKINI_AT && d < LANKINI_MID + 8) { gate(); return true; }
      if (!done.lankini && !fire && !lankini.root.visible && d > LANKINI_AT - 150 && d < LANKINI_AT) bars();      // on the run in, she is there ahead, growing as he nears
      if (lankini.root.visible && !fight.active && d > LANKINI_MID + 70) lankini.reset();      // long past her: put her away
      if (snare && snare.t < 0 && !fire && d >= snare.at - 17) {      // thrown from far ahead, from the dark under the palace wall
        const p = hero.root.position; snare.t = 0; snare.from = [p.x > 0 ? -2.6 : 2.6, g.groundAt(p.z - 40) + 2.4, p.z - 46]; bola.visible = true; g.sound.fx('wing', { rate: 1.7 });
      }
      if (!done.present && !done.grove && !fire && d >= GROVE_AT - 12 && d < FIRE_AT) present();      // they are there under the great tree before he comes
      if (!done.grove && !fire && d >= GROVE_AT + HIDE.n * CHUNK - HIDE.z - 10 && d < FIRE_AT) { grove(); return true; }      // ten metres short of the tree he will hide behind
      return false;
    },
    ending,
    // Every frame of a scene: the characters move, and what is held out lies in the hand that holds it.
    update(dt) {
      sita.update(dt); ravana.update(dt);
      if (aura.update(dt, hero.root.scale.x)) { g.sound.fx('smash', { rate: 1.9, gap: 0.12 }); g.shake(0.4); g.buzz(25); }      // each bolt that strikes is heard and felt
      if (retreat > 0) {      // Lankini gives ground: back two paces, her eyes on him
        retreat -= dt; lankini.root.position.z -= 1.5 * dt;
        if (retreat < 0.95) lankini.play('sword_walk', { speed: -1, fade: 0.15 });
        if (retreat <= 0) lankini.play('sword_idle', { fade: 0.25 });
      }
      if (ravana.rise > 0) { ravana.rise -= dt; if (ravana.rise <= 0) ravana.play('idle', { fade: 0.3 }); }
      if (swell.t < swell.secs) { swell.t += dt; const u = Math.min(1, swell.t / swell.secs); hero.root.scale.setScalar(swell.from + (swell.to - swell.from) * u * u * (3 - 2 * u)); }      // he grows as the player watches
      if (leap.on) { leap.t += dt; hero.root.position.z -= (2 + leap.t * leap.t * 2.2) * dt; }      // and at the last he leaps for the sea
      for (const e of escort) if (e.leave > 0 && e.root.visible) { const w = e.go || [0, 0.72]; e.root.position.x += w[0] * 2.1 * dt; e.root.position.z += w[1] * 2.1 * dt; }      // they go the way their lord goes
      if (torch) {      // the guard with the brand: round behind him, the blow at his tail, the fire catching
        const { e } = torch, hp = hero.root.position; torch.t += dt;
        if (torch.stage === 0) {
          const u = Math.min(1, torch.t / 1.3), x = torch.from[0] + (torch.to[0] - torch.from[0]) * u, z = torch.from[1] + (torch.to[1] - torch.from[1]) * u;
          e.root.position.x = x; e.root.position.z = z; e.root.rotation.y = e.yaw = yawTo(hp.x + 0.1 - x, hp.z + 0.7 - z);
          if (u >= 1) { torch.stage = 1; torch.t = 0; e.play('great_sword_slash', { once: true, fade: 0.12 }); }
        } else if (torch.stage === 1 && torch.t >= e.blowAt) { torch.stage = 2; g.light(true); g.sound.hit('alight'); g.sound.blaze(true); g.shake(0.25); g.buzz([30, 30, 80]); }      // and from here the fire is heard burning, through the wait for the player's word and into the run
        else if (torch.stage === 2 && torch.t >= 1.7) { torch.stage = 3; e.play('great_sword_idle', { fade: 0.3 }); }
        if (e.sword) { e.sword.localToWorld(tipOf.set(0, 0.78, 0)); brand.position.copy(tipOf); brand.children.forEach((f, n) => { const k = f.userData.s * (1 + Math.sin(torch.t * 23 + n * 2) * 0.12); f.scale.set(k, k * 1.3, 1); }); }      // the upper half of the blade burns
      }
      for (const e of fight.guards) if (e.march) {      // the ten who close the ring in the grove
        const m = e.march; m.t += dt; const u = Math.min(1, Math.max(0, m.t / m.secs));
        e.root.position.x = m.x0 + (m.x - m.x0) * u; e.root.position.z = m.z0 + (m.z - m.z0) * u;
        if (u >= 1) { e.march = null; if (!m.stay) { const hp = hero.root.position; e.root.rotation.y = e.yaw = yawTo(hp.x - m.x, hp.z - m.z); e.play('great_sword_idle', { fade: 0.25 }); } }      // stay: thrown down, he lies where he fell
      }
      if (turn) {      // he turns where he stands, and then does what follows
        turn.t += dt; const u = Math.min(1, turn.t / turn.secs); hero.root.rotation.y = turn.from + (turn.to - turn.from) * u * u * (3 - 2 * u);
        if (u >= 1) { const then = turn.then; turn = null; then(); }
      }
      if (trek) {      // Hanuman on his way from mark to mark
        const m = trek.marks[trek.i], p = hero.root.position; trek.t += dt; const u = Math.min(1, trek.t / m[2]);
        p.x = trek.x + (m[0] - trek.x) * u; p.z = trek.z + (m[1] - trek.z) * u; hero.root.rotation.y = heroYaw(m[0] - trek.x, m[1] - trek.z);
        if (u >= 1) { trek.x = m[0]; trek.z = m[1]; trek.t = 0; trek.i++; const n = trek.marks[trek.i]; if (n) hero.play(n[3], { speed: n[4] || 1, fade: 0.25 }); else { const then = trek.then; trek = null; if (then) then(); } }
      }
      if (leapTo) {      // and through the air: a long low arc from where he was to where he lands
        const l = leapTo, p = hero.root.position; l.t += dt; const u = Math.min(1, l.t / l.secs);
        p.x = l.x0 + (l.x - l.x0) * u; p.z = l.z0 + (l.z - l.z0) * u; hero.y = 4 * l.up * u * (1 - u); hero.vy = 0;
        if (u >= 1) { leapTo = null; hero.y = 0; l.then(); }
      }
      if (vowT > 0 && (vowT -= dt) <= 0 && vowRoar) vowRoar();
      if (snare && snare.t >= 0 && !snare.fall) {      // it comes on, low and turning, and finds his ankles wherever he has gone
        snare.t += dt; const u = Math.min(1, snare.t / 1.5), p = hero.root.position, f = snare.from;
        bola.position.set(f[0] + (p.x - f[0]) * u, f[1] + (p.y + 0.3 - f[1]) * u + 3.6 * u * (1 - u), f[2] + (p.z - f[2]) * u); bola.rotation.set(0.5, snare.t * 26, 0.2);
        if (u >= 1) trip();
      }
      if (snare && snare.fall && !snare.fall.rest) {      // over he goes: the going over is seen slowly, the slide at its own speed
        const f = snare.fall, step = dt * (f.t < 0.08 ? 1 : f.t < 0.42 ? 0.3 : Math.min(1, 0.3 + (f.t - 0.42) * 3)), p = hero.root.position; f.t += step;
        hero.prone = Math.min(1, Math.pow(f.t / 0.42, 2)); cuff.rotation.x = -hero.prone * 1.5; cuff.position.y = 0.16 + hero.prone * 0.12;
        if (!f.hit && f.t >= 0.42) { f.hit = true; g.shake(0.8); g.buzz([60, 30, 160]); g.sound.fx('smash'); fight.sparks.floor = G; fight.sparks.burst({ x: p.x, y: G + 0.15, z: p.z - 1.2 }, 26, [0.75, 0.68, 0.55], 6, 0, -1); }
        if (f.hit) f.v *= Math.exp(-step * 4.2);
        p.z -= f.v * step; if (f.hit && f.v < 0.15) f.rest = true;
      }
      if (clear) { const on = director.active && director.beats === clear.beats && director.i === clear.i; if (on !== clear.on) { clear.on = on; g.veil(!on); g.moonAt(on ? [16, 40, -36] : null); g.mist(on ? 0.008 : null); } if (!on) clear = null; }
      if (held) {      // the ring or the jewel lies in the open hand that holds it, a small light on it
        held.who.offer.hold(held.thing.position, palmUp); held.thing.quaternion.setFromUnitVectors(flat, palmUp);
        gift.visible = true; gift.position.copy(held.thing.position).addScaledVector(palmUp, 0.02); gift.material.color.set(held.thing === ring ? 0xffd36a : 0xbfe6ff); gift.scale.setScalar((held.thing === ring ? 0.11 : 0.05) + Math.sin(performance.now() * 0.006) * (held.thing === ring ? 0.012 : 0.006));
        glint.visible = held.thing === jewel;
        if (glint.visible) { const t = performance.now() * 0.001, flash = Math.pow(Math.max(0, Math.sin(t * 2.3) * 0.6 + Math.sin(t * 5.1 + 1) * 0.4), 2);      // mostly a small steady star, now and then a flash
          glint.position.copy(jewel.position).addScaledVector(palmUp, 0.012); glint.material.rotation = t * 0.5; glint.scale.setScalar(0.035 + flash * 0.06); }
      }
    },
  };
}
