// A palace guard of Lanka: one rigged model shared by every guard, each with his own bones, sword and strength.
// The fight (fight.js) decides where he stands and what he does; this only shows it.
import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { pinHips } from './hero.js';

export const GUARD_HP = 5;      // a full row of three blows and one more
const TALL = 1.12;      // a head taller than the build: he should loom over Hanuman

// The clips walk and lunge by themselves; the fight alone decides where a guard is, so the hips stay over his feet.
// Only the fall keeps its own movement, so that he really goes down.
export function prepare(gltf) {
  if (gltf.userData.ready) return gltf.animations;
  for (const clip of gltf.animations) if (!/death/.test(clip.name)) pinHips(clip, true);
  gltf.userData.ready = true;
  return gltf.animations;
}

// A plain blade until the chosen sword is made: grip, cross-guard and a broad dark blade, about 1.3 m.
function standInSword() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d9299, metalness: 0.9, roughness: 0.32 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a6b2c, metalness: 0.8, roughness: 0.45 });
  const g = new THREE.Group();
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x5c1410, roughness: 0.8 })); grip.position.y = 0.02;
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), bronze); cross.position.y = 0.19;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.02, 0.022), steel); blade.position.y = 0.72;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 4), steel); tip.position.y = 1.31; tip.scale.z = 0.26; tip.rotation.y = Math.PI / 4;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), bronze); pommel.position.y = -0.15;
  g.add(grip, cross, blade, tip, pommel);
  return g;
}

export class Guard {
  constructor(gltf) {
    this.root = new THREE.Group();
    this.model = clone(gltf.scene);
    this.model.scale.multiplyScalar(TALL);
    this.root.add(this.model);
    this.model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.6; } });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of prepare(gltf)) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;

    // the sword rides in the right hand, the way Hanuman's mace does
    const hand = this.model.getObjectByName('mixamorigRightHand');
    this.root.updateWorldMatrix(true, true);
    const unit = 1 / hand.getWorldScale(new THREE.Vector3()).x;
    this.sword = new THREE.Group(); this.sword.scale.setScalar(unit); this.sword.position.set(0, 0.09 * unit, 0.03 * unit); this.sword.rotation.set(0, 0, -Math.PI / 2);
    this.sword.add(standInSword()); hand.add(this.sword);

    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.85, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; this.root.add(blob);

    // how much fight is left in him, shown over his head
    const back = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a0d08, depthTest: false, fog: false, transparent: true, opacity: 0.85 }));
    const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff5a2a, depthTest: false, fog: false }));
    back.scale.set(0.9, 0.1, 1); fill.scale.set(0.86, 0.06, 1);
    back.renderOrder = 10; fill.renderOrder = 11;
    this.bar = new THREE.Group(); this.bar.add(back, fill); this.fill = fill; this.bar.position.y = 2.42; this.root.add(this.bar);
    this.reset();
  }

  reset() {
    this.hp = GUARD_HP; this.st = 'idle'; this.t = 0; this.vx = 0; this.vz = 0; this.yaw = 0; this.struck = false; this.gone = 0;
    this.root.visible = false; this.bar.visible = true; this.fill.scale.x = 0.86;
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

  showHp() { this.fill.scale.x = 0.86 * Math.max(0, this.hp) / GUARD_HP; this.bar.visible = this.hp > 0; }

  // The point and the hilt of the sword in the world, for the trail of a slash and the sparks where it lands.
  swordEnds(tip, base) {
    this.sword.updateWorldMatrix(true, false);
    tip.set(0, 1.3, 0).applyMatrix4(this.sword.matrixWorld); base.set(0, 0.25, 0).applyMatrix4(this.sword.matrixWorld);
  }
}
