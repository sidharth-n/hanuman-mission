// Hanuman: always runs forward by himself. The player only picks a lane, jumps or slides.
import * as THREE from 'three';

export const LANES = [-2.4, 0, 2.4];
const GRAVITY = 28, JUMP_V = 10.4, SLIDE_TIME = 0.85, FLY_HEIGHT = 3.1;      // leap: 1.9 m high, 0.74 s in the air
const AIR_TIME = 2 * JUMP_V / GRAVITY;
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);

// Mixamo clips carry a little forward drift in the hips. Pin it so the game alone decides where he is.
function pinHips(clip, flattenY) {
  for (const t of clip.tracks) {
    if (!/Hips\.position$/.test(t.name)) continue;
    const v = t.values;
    // find the part of the clip where the body is really off the ground (jump) or really down (slide),
    // so the game can play exactly that part while he is in the air or under a beam
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < v.length; i += 3) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
    const base = v[1], up = hi - base > base - lo, level = up ? base + (hi - base) * 0.2 : base - (base - lo) * 0.4;
    let a = -1, b = -1;
    for (let i = 1, n = 0; i < v.length; i += 3, n++) if (up ? v[i] > level : v[i] < level) { if (a < 0) a = n; b = n; }
    clip.userData = { from: a < 0 ? 0 : t.times[a], to: b < 0 ? clip.duration : t.times[b] };
    for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; if (flattenY) v[i + 1] = v[1]; }
  }
  return clip;
}

export class Hero {
  constructor(gltf) {
    this.root = new THREE.Group();
    this.model = gltf.scene;
    this.model.rotation.y = Math.PI;            // the model faces +Z, the run goes toward -Z
    this.root.add(this.model);
    this.model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.6; } });

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      pinHips(clip, /jump|hang/.test(clip.name));
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
    this.current = null;

    this.tail = [];
    this.model.traverse(o => { const m = o.isBone && /Tail(\d)$/.exec(o.name); if (m) this.tail[+m[1] - 1] = o; });
    this.tailRest = this.tail.map(b => b.quaternion.clone());
    this.hips = this.model.getObjectByName('mixamorigHips');

    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03;
    this.blob = blob; this.root.add(blob);
    this.reset();
  }

  // His mace rides in the right hand, so every clip (run, jump, slide, roar) carries it with the arm.
  attachMace(src, length = 1.15) {
    const hand = this.model.getObjectByName('mixamorigRightHand'); if (!hand) return;
    src.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    src.position.set(-c.x, -box.min.y - size.y * 0.3, -c.z);            // origin on the grip, a third of the way up the handle
    src.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.7; } });
    const inner = new THREE.Group(); inner.add(src); inner.scale.setScalar(length / size.y);
    const grip = new THREE.Group(); grip.add(inner);
    hand.updateWorldMatrix(true, false);
    const unit = 1 / hand.getWorldScale(new THREE.Vector3()).x;          // the skeleton may be in other units than metres
    grip.scale.setScalar(unit); grip.position.set(0, 0.09 * unit, 0.03 * unit); grip.rotation.set(0, 0, -Math.PI / 2);      // hammer grip: head up when the forearm is level
    hand.add(grip); this.mace = grip; this.maceUnit = unit;
  }

  reset() {
    this.lane = 1; this.root.position.set(0, 0, 0); this.model.position.y = 0;
    this.y = 0; this.vy = 0; this.slide = 0; this.busy = 0; this.time = 0; this.lean = 0; this.floor = 0; this.flying = false; this.fly = 0;
    this.model.rotation.x = 0; this.model.position.z = 0;
    this.root.scale.setScalar(1);
    this.play('breathing_idle', { fade: 0 });
  }

  play(name, { once = false, fade = 0.12, speed = 1, from = 0 } = {}) {
    const next = this.actions[name];
    if (!next || (next === this.current && !once)) { if (next) next.timeScale = speed; return; }
    next.reset(); next.time = from; next.timeScale = speed;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = once;
    next.play();
    if (this.current && fade > 0) this.current.crossFadeTo(next, fade, false); else if (this.current) this.current.stop();
    this.current = next; this.name = name;
  }

  get airborne() { return this.y > this.floor + 0.02; }
  get sliding() { return this.slide > 0; }

  // Wind flight: he rises above the street and flies level, mace arm forward, until the wind runs out.
  startFlight() {
    this.flying = true; this.slide = 0; this.vy = 0;
    const clip = this.actions.braced_hang.getClip();
    this.play('braced_hang', { once: true, from: clip.duration - 0.03, speed: 0.001, fade: 0.3 });      // hold the arms-up pose
  }
  endFlight() { this.flying = false; this.vy = 0; this.play('falling_idle', { fade: 0.25 }); }

  move(dir) {
    if (dir === 'left' && this.lane > 0) { this.lane--; return true; }
    if (dir === 'right' && this.lane < 2) { this.lane++; return true; }
    if (this.flying) return false;
    if (dir === 'up' && !this.airborne) {
      this.vy = JUMP_V; this.y = this.floor + 0.03; this.slide = 0; this.jumpZ = this.root.position.z;
      const w = this.actions.running_jump.getClip().userData, lead = 0.06;      // start just before the feet leave the ground
      this.play('running_jump', { once: true, from: Math.max(0, w.from - lead), speed: (w.to - w.from + lead) / AIR_TIME, fade: 0.07 }); return true;
    }
    if (dir === 'down') {
      if (this.airborne) { this.vy = -14; return true; }          // swipe down in the air drops him fast
      if (this.slide > 0.25) return false;                          // already down: a second swipe must not restart the move
      this.slide = SLIDE_TIME; this.slideZ = this.root.position.z;
      const clip = this.actions.running_slide.getClip(), from = Math.max(0, clip.userData.from - 0.1);
      // paced so the clip reaches its last frame exactly as the slide ends: no held pose, no skipped frames
      this.play('running_slide', { once: true, from, speed: (clip.duration - from) / SLIDE_TIME, fade: 0.1 }); return true;
    }
    return false;
  }

  stumble() { this.busy = 0.45; this.slide = 0; this.play('hit_reaction', { once: true, speed: 2.2, fade: 0.06 }); }

  update(dt, speed, running) {
    this.time += dt;
    const p = this.root.position;
    if (running) p.z -= speed * dt;
    const tx = LANES[this.lane];
    const dx = tx - p.x;
    p.x += dx * Math.min(1, dt * 13);
    this.lean += ((-dx * 0.16) - this.lean) * Math.min(1, dt * 12);
    this.model.rotation.z = this.lean;

    this.fly += ((this.flying ? 1 : 0) - this.fly) * Math.min(1, dt * 5);
    if (this.flying) { this.y += (FLY_HEIGHT + Math.sin(this.time * 2.6) * 0.18 - this.y) * Math.min(1, dt * 3.5); this.vy = 0; }
    else if (this.y > this.floor || this.vy > 0) { this.vy -= GRAVITY * dt; this.y += this.vy * dt; }
    if (this.y <= this.floor) { this.y = this.floor; this.vy = 0; }      // on the ground, or on top of something he came down on
    // tipped forward to fly level; the body is kept over the spot he is flying above
    this.model.rotation.x = -this.fly * 1.22;
    this.model.position.set(0, this.y + this.fly * 0.25, this.fly * 0.85);
    this.blob.position.y = this.floor + 0.03; this.blob.scale.setScalar(1 - Math.min(0.5, (this.y - this.floor) * 0.25));
    if (this.slide > 0) this.slide -= dt;
    if (this.busy > 0) this.busy -= dt;

    if (running && !this.airborne && this.slide <= 0 && this.busy <= 0) this.play('fast_run', { speed: 0.75 + speed / 28, fade: 0.14 });
    this.mixer.update(dt);
    this.poseTail(running ? speed : 0);
  }

  // The tail has no animation of its own: swing it out behind him and let a wave travel down it.
  poseTail(speed) {
    if (!this.tail.length || !this.hips) return;
    this.hips.updateWorldMatrix(true, false);
    const parentQ = this.hips.getWorldQuaternion(new THREE.Quaternion());
    const out = 0.45 + Math.min(0.35, speed * 0.02) + Math.sin(this.time * 3.1) * 0.05;
    const tilt = new THREE.Quaternion().setFromAxisAngle(X_AXIS, out);
    const side = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.sin(this.time * 4.2) * 0.12 - this.lean * 1.2);
    const world = side.multiply(tilt);
    // world-space tilt expressed in the first tail bone's local frame
    const local = parentQ.clone().invert().multiply(world).multiply(parentQ);
    this.tail[0].quaternion.copy(local.multiply(this.tailRest[0]));
    const q = new THREE.Quaternion();
    for (let i = 1; i < this.tail.length; i++) {
      const wave = Math.sin(this.time * (5 + speed * 0.25) - i * 0.7) * 0.05 * (1 + i * 0.12);
      q.setFromAxisAngle(i % 2 ? X_AXIS : Z_AXIS, wave);
      this.tail[i].quaternion.copy(this.tailRest[i]).multiply(q);
    }
  }

  tailTip(target) {
    const last = this.tail[this.tail.length - 1];
    return last ? last.getWorldPosition(target) : target.copy(this.root.position).setY(1.5);
  }
}
