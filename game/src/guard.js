// Those who fight Hanuman: the palace guards of Lanka (one rigged model shared by all, each with his own bones, sword
// and strength, in four kinds that fight differently) and Lankini, the guardian of the city.
// The fight (fight.js) decides where each stands and what he does; this only shows it.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { pinHips } from './hero.js';

// The kinds. hp: blows he can take (a great blow counts two). size: against the model as built. pace: how fast he closes.
// tell: seconds added to the warning before his blow. reach: metres. firm: light blows do not stagger him.
// wound: lives his blow costs. twice: he strikes twice in a row. tint: the cast of his armour.
export const KINDS = {
  guard:   { hp: 5, size: 1.12, pace: 1, tell: 0, reach: 2.6, wound: 1 },
  rusher:  { hp: 3, size: 0.98, pace: 1.45, tell: -0.1, reach: 2.4, wound: 1, tint: 0xc9d6ff },                 // lean and quick: on him fast, little warning, soon down
  brute:   { hp: 9, size: 1.34, pace: 0.7, tell: 0.24, reach: 3.0, wound: 2, firm: true, tint: 0xff9a80 },      // huge and slow: a long warning, a terrible blow
  captain: { hp: 12, size: 1.24, pace: 1.1, tell: 0, reach: 2.8, wound: 1, twice: true, tint: 0xffe08a },       // the captain: two blows in a row
  lankini: { hp: 24, size: 1, pace: 1.05, tell: 0.12, reach: 4.2, wound: 1, firm: true, boss: true, stays: true, twice: true },      // as tall as he is when he has grown to meet her: a great sword, two blows in a row
};
const GUARD_CLIPS = { idle: 'great_sword_idle', walk: 'great_sword_walk', run: 'great_sword_run', attack: 'great_sword_slash', hit: 'great_sword_impact', death: 'two_handed_sword_death' };

// The guard's clips walk and lunge by themselves; the fight alone decides where he is, so the hips stay over his feet.
// Only the fall keeps its own movement, so that he really goes down.
export function prepare(gltf) {
  if (gltf.userData.ready) return gltf.animations;
  for (const clip of gltf.animations) if (!/death/.test(clip.name)) pinHips(clip, true);
  gltf.userData.ready = true;
  return gltf.animations;
}

// A plain blade, used only if the made sword is missing.
function standInSword() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d9299, metalness: 0.9, roughness: 0.32 });
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.02, 0.022), steel); blade.position.y = 0.72;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x5c1410, roughness: 0.8 })); grip.position.y = 0.02;
  g.add(grip, blade);
  return g;
}

export class Guard {
  // sword: the sword model (a scene to copy), or nothing. opt.lux: a Lux3D-rigged character (Lankini): stood to
  // opt.height metres, unarmed, with her own clips { idle, walk, run, attack, hit, death } and the moment her blow lands.
  constructor(gltf, sword, opt = {}) {
    this.root = new THREE.Group();
    this.model = clone(gltf.scene);
    this.lux = !!opt.lux; this.clips = opt.clips || GUARD_CLIPS; this.blowAt = opt.blowAt ?? 0.73; this.hitPlay = opt.hitPlay || { from: 0.08, speed: 1.5 };
    if (this.lux) {      // the model is centred on itself: stand it on the floor at its height
      this.model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.model), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      this.model.position.set(-c.x, -box.min.y, -c.z);
      this.body = new THREE.Group(); this.body.add(this.model); this.base = opt.height / size.y; this.tall = opt.height; this.body.scale.setScalar(this.base);
    } else { this.body = this.model; this.base = this.model.scale.x; this.tall = 1.8; }
    this.root.add(this.body); this.lean0 = [this.body.rotation.x, this.body.rotation.z];      // as he stands, before any blow rocks him
    this.meshes = []; this.model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.6; this.meshes.push(o); } });
    this.plain = this.meshes.map(m => m.material); this.gltf = gltf;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of this.lux ? gltf.animations : prepare(gltf)) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;

    this.hand = this.model.getObjectByName('mixamorigRightHand'); this.arm = this.model.getObjectByName('mixamorigRightForeArm');
    // her sword is a guard's, made for her hand: opt.sword is its length against a guard's sword on a guard (1 would be as long for her as theirs is for them)
    const big = this.lux ? opt.height / 1.8 : 1, hold = big * (this.lux ? 0.88 : 1), long = big * (this.lux ? opt.sword ?? 0.88 : 1); this.blade = 1.2 * long;
    if (!this.lux || opt.armed) {      // the sword rides in the right hand, the way Hanuman's mace does
      this.root.updateWorldMatrix(true, true);
      const unit = 1 / this.hand.getWorldScale(new THREE.Vector3()).x;
      this.sword = new THREE.Group(); this.sword.scale.setScalar(unit); this.sword.position.set(0, 0.09 * unit * hold, 0.03 * unit * hold); this.sword.rotation.set(0, 0, -Math.PI / 2);
      if (opt.grip) { this.sword.position.set(...opt.grip.at).multiplyScalar(unit * hold); this.sword.rotation.set(...opt.grip.turn); }
      if (sword) {      // the made sword, stood on its pommel: sized to 1.35 m, held a little above the pommel
        const s = sword.clone(); s.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(s), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
        s.position.set(-c.x, -box.min.y - size.y * 0.1, -c.z);
        s.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.8; } });
        const fit = new THREE.Group(); fit.add(s); fit.scale.setScalar(1.35 * long / size.y); this.sword.add(fit);
      } else this.sword.add(standInSword());
      this.hand.add(this.sword);
    }
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; this.blob = blob; this.root.add(blob);

    // how much fight is left in him, shown over his head
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a0d08, depthTest: false, fog: false, transparent: true, opacity: 0.85 }));
    const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff5a2a, depthTest: false, fog: false }));
    back.renderOrder = 10; fill.renderOrder = 11;
    this.bar = new THREE.Group(); this.bar.add(back, fill); this.back = back; this.fill = fill; this.root.add(this.bar);
    this.kind(opt.kind || 'guard'); this.reset();
  }

  // What kind of fighter he is this time: his size, his strength and the cast of his armour.
  kind(name) {
    const k = this.k = KINDS[name]; this.hp = this.max = k.hp;
    const s = this.lux ? 1 : k.size; this.body.scale.setScalar(this.base * s);
    const high = this.tall * s, wide = k.boss ? 2.2 : 0.9 * Math.max(1, s / 1.12);
    this.wide = wide; this.back.scale.set(wide, k.boss ? 0.16 : 0.1, 1); this.fill.scale.set(wide - 0.04, k.boss ? 0.11 : 0.06, 1); this.bar.position.y = high + 0.42;
    this.blob.scale.setScalar(this.lux ? this.tall * 0.42 : s / 1.12);
    if (!this.lux) {
      const tints = this.gltf.userData.tints || (this.gltf.userData.tints = {});
      this.meshes.forEach((m, i) => {
        if (!k.tint) { m.material = this.plain[i]; return; }
        const key = name + i; if (!tints[key]) { tints[key] = this.plain[i].clone(); tints[key].color.set(k.tint); }
        m.material = tints[key];
      });
    }
  }

  reset() {
    this.hp = this.max; this.st = 'idle'; this.t = 0; this.vx = 0; this.vz = 0; this.yaw = 0; this.struck = false; this.second = false; this.token = false; this.poise = 0;
    this.rock = null; this.body.rotation.x = this.lean0[0]; this.body.rotation.z = this.lean0[1];
    this.root.visible = false; this.bar.visible = true; this.fill.scale.x = this.wide - 0.04;
    if (this.current) this.current.stop(); this.current = null; this.name = null;
  }

  play(name, { once = false, fade = 0.15, speed = 1, from = 0 } = {}) {
    const next = this.actions[name];
    if (!next || (next === this.current && !once)) { if (next) next.timeScale = speed; return; }
    next.reset(); next.time = from; next.timeScale = speed;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = once;
    next.play();
    if (this.current && this.current !== next) { if (fade > 0) this.current.crossFadeTo(next, fade, false); else this.current.stop(); }      // the same move again simply starts over
    this.current = next; this.name = name;
  }

  // Turn toward a heading (the model faces +Z), quickly but not in one frame.
  turn(yaw, dt, rate = 10) {
    let d = yaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * rate); this.root.rotation.y = this.yaw;
  }
  // Stood at a place facing a heading, for the scenes.
  place(x, y, z, yaw = 0) { this.root.position.set(x, y, z); this.yaw = yaw; this.root.rotation.y = yaw; this.root.visible = true; return this; }

  showHp() { this.fill.scale.x = (this.wide - 0.04) * Math.max(0, this.hp) / this.max; this.bar.visible = this.hp > 0; }

  // The two ends of what he strikes with, in the world, for the trail of the blow: the sword's point and hilt, or her fist and forearm.
  swordEnds(tip, base) {
    if (this.sword) { this.sword.updateWorldMatrix(true, false); tip.set(0, this.blade, 0).applyMatrix4(this.sword.matrixWorld); base.set(0, 0.2, 0).applyMatrix4(this.sword.matrixWorld); }
    else { this.hand.updateWorldMatrix(true, false); this.hand.getWorldPosition(tip); this.arm.getWorldPosition(base); }
  }
}
