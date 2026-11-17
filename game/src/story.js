// The story told between the play, staged scene by scene: Lankini at the gate, Ravana and Sita in the grove,
// Hanuman and Sita, the fight in the grove and his binding, Ravana's court, the fire, and the end.
// Every line of dialogue comes from story.json; this file only places the characters and the camera.
import * as THREE from 'three';
import STORY from './story.json';
import { Actor } from './scene.js';
import { Aura } from './aura.js';
import { PLANS } from './fight.js';
import { SITA, TREE, THRONE, STAND } from './places.js';
import { GROVE_AT, THRONE_AT, FIRE_AT, LANKINI_AT, LANKINI_MID, CHUNK } from './world.js';

const S = STORY.scenes;
const heroYaw = (fx, fz) => Math.atan2(-fx, -fz);      // Hanuman's model faces the other way from the rest
const yawTo = (fx, fz) => Math.atan2(fx, fz);
const GROVE_MID = GROVE_AT + 38;                        // the floor the grove fight is fought on

// g: what the game lends the story: { scene, hero, fight, director, models, groundAt, sound, buzz, say(text, secs),
//   hold() (stop the run for a scene), go() (run on), battle(mid, plan, done(how)), fade(then), light(on), ablaze(), finish() }
export function createStory(g) {
  const { hero, fight, director } = g;
  const sita = new Actor(g.models.sita, 1.72), ravana = new Actor(g.models.ravana, 2.75);
  g.scene.add(sita.root, ravana.root);
  sita.knees = 0.8; sita.model.traverse(o => { if (o.isMesh) o.material.side = THREE.DoubleSide; });      // seated, the folds of her sari open: their inner side must show as cloth, not as holes
  const lankini = fight.boss, escort = [fight.guards[6], fight.guards[7]], wardens = [fight.guards[4], fight.guards[5]];      // the two who lead him, the two who stand by the throne
  // a small bright thing passed from hand to hand: Rama's ring, Sita's jewel
  const gift = new THREE.Sprite(new THREE.SpriteMaterial({ map: fight.sparks.points.material.map, color: 0xffd36a, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true }));
  gift.visible = false; g.scene.add(gift);
  const aura = new Aura(g.scene, fight.sparks.points.material.map);      // the light round him when he changes size
  const pass = { t: 0, secs: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
  const done = { lankini: false, challenged: false, grove: false, end: false };
  let G = 0;      // the height of the floor where the scene is played

  const v = (x, y, z) => [x, G + y, z];
  const shot = (at, look, o = {}) => ({ cam: { at, look, ...o } });
  // A shot of two people side by side does not fit an upright phone: there the same moment is taken along the line between them.
  const either = (wide, upright) => (window.innerHeight > window.innerWidth ? upright : wide);
  // Those a shot must hold in the picture, head and foot: the director draws the camera back until they are all in it
  const span = (o, tall) => [[o.x, o.y, o.z], [o.x, o.y + tall, o.z]];
  const him = () => span(hero.root.position, 1.95 * hero.root.scale.x);
  const both = () => [...him(), ...span(lankini.root.position, 3.85)];
  const beats = (key, shots = []) => S[key].map((l, i) => ({ who: l.who, line: l.line, ...(shots[i] || {}) }));
  function putHero(x, z, yaw, clip = 'breathing_idle', up = 0) {
    hero.free = true; hero.pace = 0; hero.slide = 0; hero.busy = 0; hero.flying = false; hero.fly = 0;
    hero.root.position.set(x, g.groundAt(z), z); hero.root.rotation.y = yaw; hero.floor = up; hero.y = up; hero.vy = 0; hero.lane = 1;
    hero.play(clip, { fade: 0.25 });
  }
  function give(from, to, color, secs = 1.3) { pass.from.set(...from); pass.to.set(...to); pass.t = 0; pass.secs = secs; gift.material.color.set(color); gift.visible = true; }
  function standGuards(list, who = escort, up = 0) { list.forEach(([x, z, yaw], i) => { const e = who[i]; e.kind('guard'); e.reset(); e.place(x, g.groundAt(z) + up, z, yaw); e.st = 'idle'; e.bar.visible = false; e.play('great_sword_idle', { fade: 0 }); }); }

  // ── the gate: Lankini bars the way. She is far bigger than he is, so the player is asked whether he should grow to
  // her size (one of his powers, like flight); he grows in a storm of light, she gives ground, and they fight as equals.
  // When she is down he takes his own size again, and she yields. ──
  const hz = -LANKINI_AT, lz = hz - 7.5;
  let retreat = 0;
  // She stands in the road, sword in hand: seen from far off as he runs toward her.
  function bars() { lankini.kind('lankini'); lankini.reset(); lankini.place(0, g.groundAt(lz), lz, 0); lankini.st = 'idle'; lankini.bar.visible = false; lankini.play('sword_idle', { fade: 0 }); }
  function gate() {
    g.hold(); G = g.groundAt(hz); retreat = 0;
    putHero(0, hz, 0);
    bars();
    if (done.challenged) return transform(true);      // she threw him back before: the words are said, he grows at once
    director.play([
      ...beats('lankini_challenge', [
        { ...shot(v(1.9, 1.1, hz - 4.6), v(0, 2.7, lz), { to: v(1.5, 1.3, hz - 5.4), fov: 46 }), do: () => lankini.play('talk') },
        { ...shot(v(-1.4, 1.5, hz - 3.4), v(0, 1.35, hz), { to: v(-1.1, 1.5, hz - 2.9), fov: 42 }), do: () => lankini.play('sword_idle') },
        { ...shot(v(1.3, 2.1, hz + 2.6), v(0, 2.5, lz), { to: v(1.0, 2.0, hz + 2.0), fov: 50 }), do: () => lankini.play('talk') },
        { ...either(shot(v(6.4, 1.5, (hz + lz) / 2), v(0, 1.7, (hz + lz) / 2), { to: v(5.6, 1.5, (hz + lz) / 2), fov: 52, keep: both }), shot(v(1.9, 2.7, hz + 3.6), v(0, 2.0, lz), { to: v(1.5, 2.5, hz + 3.0), fov: 46 })), do: () => lankini.play('sword_idle') },
      ]),
      // the question: he stands small before her (seen from the side; on an upright phone, over her shoulder and down on him) until the player answers
      { hold: true, secs: 1e9, ...either(shot(v(6.2, 0.9, (hz + lz) / 2 + 0.6), v(0, 1.7, (hz + lz) / 2), { to: v(5.4, 1.0, (hz + lz) / 2 + 0.4), fov: 54, secs: 7, keep: both }),
          shot(v(1.5, 4.6, lz - 2.6), v(0, 0.7, hz), { to: v(1.2, 4.4, lz - 2.1), fov: 46, secs: 7, keep: him })), do: () => { done.challenged = true; g.ask(() => director.skip()); } },
    ], () => transform(false));
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
    done.lankini = true; g.hold();
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
  function grove() {
    done.grove = true; g.hold(); G = g.groundAt(sitaAt.z);
    const sx = sitaAt.x, sz = sitaAt.z, rx = sx - 2.3, rz = sz + 2.5, perch = [sx + 1.7, sz - 1.5, 4.3];
    const yaw = yawTo(rx - sx, rz - sz);
    sita.place(sx + Math.sin(yaw) * SITA.edge, G + SITA.up, sz + Math.cos(yaw) * SITA.edge, yaw); sita.play('sit', { fade: 0 });
    ravana.place(sx - 5.5, G, sz + 10, 0); ravana.play('idle', { fade: 0 });
    standGuards([[rx - 4.2, rz + 2.0, yawTo(1, -0.6)], [rx + 1.2, rz + 4.4, yawTo(-0.1, -1)]]);      // well to either side of the way he comes and goes by: he is broad, and walked through the nearer one
    putHero(perch[0], perch[1], heroYaw(sx - perch[0], sz - perch[1]), 'crouched_walking', perch[2]); hero.current.timeScale = 0.02;      // crouched on a branch, still
    const onHanuman = shot(v(perch[0] - 2.2, perch[2] + 1.2, perch[1] + 2.3), v(perch[0], perch[2] + 0.9, perch[1]), { to: v(perch[0] - 1.7, perch[2] + 1.1, perch[1] + 1.9), fov: 40 });
    const fromTree = shot(v(sx - 4.4, 5.4, sz + 5.0), v(sx - 0.8, 0.9, sz + 0.9), { to: v(sx - 3.8, 4.8, sz + 4.2), fov: 50 });      // looking down on them, as he does
    const onRavana = shot(v(sx - 0.4, 1.0, sz + 0.9), v(rx, 2.35, rz), { to: v(sx - 0.7, 1.2, sz + 0.6), fov: 44 });
    const U = SITA.up, onSita = shot(v(sx - 1.7, 1.15 + U, sz + 1.5), v(sx, 1.02 + U, sz + 0.2), { to: v(sx - 1.3, 1.1 + U, sz + 1.2), fov: 40 });      // she sits on the platform, that much above the ground
    director.play(beats('grove_ravana', [
      onHanuman,
      { ...fromTree, do: () => ravana.walk(rx, rz, 3.4, { then: yawTo(sx - rx, sz - rz) }) },
      { ...onRavana, do: () => { ravana.place(rx, G, rz, yawTo(sx - rx, sz - rz)); ravana.play('talk'); } },      // there already, even if the line before was tapped past
      { ...onSita, do: () => { ravana.play('idle'); sita.play('sit_talk'); } },
      { ...shot(v(sx - 1.5, 1.1 + U, sz + 1.0), v(sx, 1.05 + U, sz + 0.2), { to: v(sx - 1.2, 1.08 + U, sz + 0.8), fov: 36 }), do: () => sita.play('sit_talk') },
      shot(v(sx + 1.5, 2.25, sz - 1.5), v(rx, 2.0, rz), { to: v(sx + 1.2, 2.2, sz - 1.2), fov: 48 }),      // over her head and the back of her seat
      { ...onRavana, do: () => { sita.play('sit'); ravana.play('command', { once: true }); ravana.rise = 1.3; } },
      { ...either(shot(v(sx - 6.5, 1.8, sz - 2.5), v(sx - 1.2, 1.3, sz + 2.2), { to: v(sx - 5.6, 1.9, sz - 3.4), fov: 54 }), shot(v(sx - 1.2, 2.4, sz - 3.6), v(sx - 3.4, 1.5, sz + 6), { to: v(sx - 0.8, 2.6, sz - 4.4), fov: 50 })), do: () => { ravana.walk(sx - 5.5, sz + 13, 4.2); escort.forEach((e, i) => { e.root.rotation.y = 0; e.play('great_sword_walk'); e.leave = 1.9 + i * 0.3; }); } },
      onHanuman,
    ]), meets);
  }
  function meets() {
    g.hold(); const sx = sitaAt.x, sz = sitaAt.z, hx = sx - 2.0, hz = sz + 2.1;
    ravana.hide(); escort.forEach(e => { e.reset(); e.leave = 0; });
    const yaw = yawTo(hx - sx, hz - sz);
    sita.place(sx + Math.sin(yaw) * SITA.edge, G + SITA.up, sz + Math.cos(yaw) * SITA.edge, yaw); sita.play('sit', { fade: 0.2 });
    const perch = [sx + 1.7, sz - 1.5, 4.3];
    const down = () => { putHero(hx, hz, heroYaw(sx - hx, sz - hz), 'hard_landing'); hero.play('hard_landing', { once: true, fade: 0.1 }); };
    const hand = [hx + 0.5, G + 1.25, hz - 0.5], hers = [sx - 0.45, G + 1.0 + SITA.up, sz + 0.5];
    const onHero = shot(v(sx - 0.5, 1.25, sz + 0.2), v(hx, 1.45, hz), { to: v(sx - 0.7, 1.3, sz + 0.4), fov: 40 });
    const onSita = shot(v(hx + 0.2, 1.3 + SITA.up, hz - 0.2), v(sx, 1.1 + SITA.up, sz + 0.2), { to: v(hx + 0.4, 1.25 + SITA.up, hz - 0.4), fov: 38 });
    const two = either(shot(v(sx - 3.2, 1.2, sz - 1.7), v(sx - 1.0, 1.1, sz + 1.2), { to: v(sx - 2.7, 1.25, sz - 2.1), fov: 46 }), shot(v(hx - 2.1, 1.9, hz + 0.9), v(sx - 0.5, 1.05, sz + 0.5), { to: v(hx - 1.8, 1.85, hz + 0.7), fov: 46 }));
    director.play(beats('grove_sita', [
      shot(v(sx - 3.6, 4.6, sz + 4.4), v(sx, 0.9, sz + 0.3), { to: v(sx - 2.9, 3.9, sz + 3.6), fov: 44 }),
      shot(v(perch[0] - 2.2, perch[2] + 1.2, perch[1] + 2.3), v(perch[0], perch[2] + 0.9, perch[1]), { fov: 40 }),
      { ...either(shot(v(sx - 4.6, 1.3, sz - 0.6), v(sx - 1.1, 0.9, sz + 1.2), { to: v(sx - 4.0, 1.2, sz - 1.2), fov: 50 }), shot(v(hx - 1.8, 1.6, hz + 3.0), v(sx - 0.7, 0.9, sz + 0.7), { to: v(hx - 1.5, 1.5, hz + 2.5), fov: 48 })), do: down },
      { ...onHero, do: () => hero.play('breathing_idle', { fade: 0.4 }) },
      { ...onSita, do: () => sita.play('sit_talk') },
      { ...two, do: () => { sita.play('sit'); give(hand, hers, 0xffd36a); } },
      { ...onSita, do: () => sita.play('sit_talk') },
      onHero,
      { ...two, do: () => { sita.play('sit_talk'); give(hers, hand, 0xbfe6ff); } },
      { ...onHero, do: () => sita.play('sit') },
      { ...shot(v(sx - 5.2, 2.4, sz + 5.4), v(sx - 0.8, 1.1, sz + 0.8), { to: v(sx - 6.4, 3.4, sz + 7.2), fov: 50 }), do: () => sita.play('sit_talk') },
    ]), wreck);
  }
  function wreck() {
    g.hold(); const z = -GROVE_MID - 7; gift.visible = false; sita.play('sit');
    putHero(0, z, heroYaw(0, 1), 'great_sword_idle');
    director.play(beats('grove_wreck', [
      shot(v(1.6, 1.2, z + 3.6), v(0, 1.4, z), { to: v(1.2, 1.3, z + 3.0), fov: 42 }),
      { ...shot(v(-2.4, 0.7, z + 4.2), v(0, 1.6, z), { to: v(-1.8, 0.8, z + 3.4), fov: 50 }), do: () => hero.play('mutant_roaring', { once: true, fade: 0.2 }) },
    ]), () => g.battle(GROVE_MID, PLANS.grove, how => { bound(how === 'lost'); return true; }));      // won or overcome, the grove ends the same way: he is bound and led to Ravana
  }
  function bound(taken) {
    g.hold(); const p = hero.root.position;
    if (taken) for (const e of fight.all) { e.reset(); e.trail.clear(); }      // those still standing round him give way to the two who bind him
    putHero(p.x, p.z, heroYaw(0, -1)); hero.bind(true);
    standGuards([[p.x - 1.5, p.z + 0.5, yawTo(1, -0.4)], [p.x + 1.5, p.z + 0.5, yawTo(-1, -0.4)]]);
    if (!taken) g.say(STORY.alerts.bound, 2.4);
    director.play(beats('grove_bound', [
      shot(v(p.x + 3.4, 1.5, p.z - 3.8), v(p.x, 1.3, p.z), { to: v(p.x + 2.8, 1.5, p.z - 3.2), fov: 48 }),
      shot(v(p.x - 0.9, 1.5, p.z - 2.6), v(p.x, 1.45, p.z), { to: v(p.x - 0.6, 1.5, p.z - 2.2), fov: 38 }),
      shot(v(p.x + 0.6, 2.4, p.z + 5.2), v(p.x, 1.2, p.z - 4), { to: v(p.x + 0.4, 2.8, p.z + 6.4), fov: 52 }),
    ]), () => g.fade(court));
  }

  // ── Ravana's court ──
  function court() {
    g.hold(); sita.hide(); gift.visible = false;
    const base = -(THRONE_AT + THRONE.n * CHUNK), tz = base + THRONE.z, hz = base + STAND.z, T = THRONE.top; G = g.groundAt(hz);
    putHero(0, hz, 0); hero.bind(true);
    standGuards([[-1.6, hz + 0.7, Math.PI], [1.6, hz + 0.7, Math.PI]]);
    standGuards([[-3.3, tz + 0.6, 0.5], [3.3, tz + 0.6, -0.5]], wardens, T - 0.35);      // on the second step of the dais
    ravana.place(0, G + T + 0.34, tz + 0.62, 0); ravana.play('sit', { fade: 0 });
    g.card('throne');
    const wide = shot(v(0, 2.3, -THRONE_AT - 3), v(0, 3.2, tz), { to: v(0, 2.0, -THRONE_AT - 15), fov: 56 });
    const crane = shot(v(-5.2, 7, hz + 9), v(0, 2.6, tz), { to: v(-3.4, 5.2, hz + 3), fov: 52 });
    const onRavana = shot(v(1.7, T + 2.5, tz + 4.6), v(0, T + 2.35, tz), { to: v(1.3, T + 2.4, tz + 4.0), fov: 40 });
    const onHero = shot(v(-1.2, 1.55, hz - 2.6), v(0, 1.45, hz), { to: v(-0.9, 1.55, hz - 2.2), fov: 38 });
    const over = shot(v(1.5, 2.3, hz + 3.0), v(0, T + 2.2, tz), { to: v(1.1, 2.2, hz + 2.4), fov: 46 });
    const down = shot(v(1.0, T + 3.7, tz + 1.3), v(0, 1.2, hz), { to: v(0.7, T + 3.5, tz + 1.6), fov: 50 });
    director.play([
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
        { ...over, do: () => ravana.play('command', { once: true, fade: 0.2 }) },
      ]),
      ...beats('ignite', [
        { ...shot(v(2.2, 0.9, hz + 3.2), v(0, 1.3, hz), { to: v(1.6, 1.1, hz + 2.6), fov: 48 }), do: () => { g.light(true); escort.forEach(e => e.reset()); } },
        { ...shot(v(-1.8, 0.6, hz - 3.4), v(0, 1.9, hz), { to: v(-1.4, 0.7, hz - 2.8), fov: 54 }), do: () => { hero.bind(false); hero.play('mutant_roaring', { once: true, fade: 0.2 }); g.sound.fx('power'); g.buzz([60, 40, 160]); } },
      ]),
    ], () => g.fade(() => { hero.bind(false); ravana.hide(); [...escort, ...wardens].forEach(e => e.reset()); g.ablaze(); }));
  }

  // ── the end: grown vast, he roars in the middle of the burning city, then leaps for the sea ──
  const VAST = 13;      // how many times his own height he stands at the last: head and shoulders over the towers of Lanka
  const swell = { t: 0, secs: 0, from: 1, to: 1 }, leap = { on: false, t: 0 };
  function ending() {
    done.end = true; g.hold(); const p = hero.root.position, z = p.z; G = g.groundAt(z);
    putHero(0, z, heroYaw(0, 1), 'mutant_roaring'); hero.play('mutant_roaring', { once: true, fade: 0.2 });
    swell.from = hero.root.scale.x; swell.to = VAST; swell.t = 0; swell.secs = 3.2; leap.on = false;
    g.sound.fx('power'); g.sound.chant(); g.buzz([80, 60, 80, 60, 200]);
    const H = 1.9 * VAST;      // every shot stays over the street itself: the houses and towers stand close on both sides
    director.play([
      ...beats('roar', [
        shot(v(1.6, 1.6, z + 20), v(0, H * 0.34, z), { to: v(2.2, 2.4, z + 33), lookTo: v(0, H * 0.6, z), fov: 64, secs: 4.6 }),
        { ...shot(v(-3.4, H * 0.5, z + 15), v(0, H * 0.62, z), { to: v(3.4, H * 0.56, z + 17), fov: 56, secs: 5.5 }), do: () => { hero.play('mutant_roaring', { once: true, fade: 0.2 }); g.sound.chant(); g.sound.fx('power'); g.buzz([80, 60, 200]); } },
      ]),
      ...beats('ending', [
        shot(v(0, H * 1.35, z + 44), v(0, H * 0.55, z), { to: v(0, H * 1.6, z + 52), fov: 58, secs: 5 }),
        { ...shot(v(2.6, 3.2, z + 30), v(0, H * 0.7, z), { to: v(-2.6, 4.2, z + 36), fov: 66, secs: 5 }), do: () => hero.play('victory', { fade: 0.4 }) },
        { ...shot(v(0, H * 0.5, z + 42), v(0, H * 0.75, z), { to: v(0, H * 0.9, z + 50), lookTo: v(0, H * 1.6, z - 60), fov: 60, secs: 5.5 }), secs: 5.2, do: () => { hero.root.rotation.y = 0; hero.flyHeight = 4.2; hero.startFlight(); leap.on = true; leap.t = 0; g.sound.fx('wing'); } },
      ]),
    ], () => { leap.on = false; hero.flyHeight = 2.5; g.finish(); });
  }

  return {
    done, sita, ravana, gate, yields, grove, meets, wreck, bound, court,
    // Everything of the story put away: a new journey from the gate.
    reset(fresh) {
      sita.hide(); ravana.hide(); gift.visible = false; hero.bind(false); if (fresh) done.lankini = done.challenged = false; aura.stop(); retreat = 0; done.grove = false; done.end = false; swell.t = swell.secs = 0; leap.on = false;
    },
    // Called while he runs: does the story take over here? d: metres along the route.
    check(d, fire) {
      if (!done.lankini && !fire && d >= LANKINI_AT && d < LANKINI_MID + 8) { gate(); return true; }
      if (!done.lankini && !fire && !lankini.root.visible && d > LANKINI_AT - 150 && d < LANKINI_AT) bars();      // on the run in, she is there ahead, growing as he nears
      if (lankini.root.visible && !fight.active && d > LANKINI_MID + 70) lankini.reset();      // long past her: put her away
      if (!done.grove && !fire && d >= GROVE_AT + 30 && d < FIRE_AT) { grove(); return true; }
      return false;
    },
    ending,
    // Every frame of a scene: the characters move, the gift passes from hand to hand.
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
      for (const e of escort) if (e.leave > 0 && e.root.visible) { e.root.position.z += 1.5 * dt; }
      if (gift.visible) {
        pass.t += dt; const u = Math.min(1, pass.t / pass.secs), e = u * u * (3 - 2 * u);
        gift.position.lerpVectors(pass.from, pass.to, e); gift.position.y += Math.sin(u * Math.PI) * 0.25; gift.scale.setScalar(0.34 + Math.sin(pass.t * 9) * 0.05);
      }
    },
  };
}
