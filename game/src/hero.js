// Hanuman: always runs forward by himself. The player only picks a lane, jumps or slides.
import * as THREE from 'three';

export const LANES = [-2.4, 0, 2.4];
const GRAVITY = 26, JUMP_V = 9.2, SLIDE_TIME = 0.75;
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);

// Mixamo clips carry a little forward drift in the hips. Pin it so the game alone decides where he is.
function pinHips(clip, flattenY) {
  for (const t of clip.tracks) {
    if (!/Hips\.position$/.test(t.name)) continue;
    const v = t.values;
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
      pinHips(clip, /jump/.test(clip.name));
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

  reset() {
    this.lane = 1; this.root.position.set(0, 0, 0); this.model.position.y = 0;
    this.y = 0; this.vy = 0; this.slide = 0; this.busy = 0; this.time = 0; this.lean = 0;
    this.root.scale.setScalar(1);
    this.play('breathing_idle', { fade: 0 });
  }

  play(name, { once = false, fade = 0.12, speed = 1 } = {}) {
    const next = this.actions[name];
    if (!next || (next === this.current && !once)) { if (next) next.timeScale = speed; return; }
    next.reset(); next.timeScale = speed;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = once;
    next.play();
    if (this.current && fade > 0) this.current.crossFadeTo(next, fade, false); else if (this.current) this.current.stop();
    this.current = next; this.name = name;
  }

  get airborne() { return this.y > 0.02; }
  get sliding() { return this.slide > 0; }

  move(dir) {
    if (dir === 'left' && this.lane > 0) { this.lane--; return true; }
    if (dir === 'right' && this.lane < 2) { this.lane++; return true; }
    if (dir === 'up' && !this.airborne) {
      this.vy = JUMP_V; this.y = 0.03; this.slide = 0;
      this.play('running_jump', { once: true, speed: 1.25, fade: 0.08 }); return true;
    }
    if (dir === 'down') {
      if (this.airborne) { this.vy = -14; return true; }          // swipe down in the air drops him fast
      this.slide = SLIDE_TIME; this.play('running_slide', { once: true, speed: 2.0, fade: 0.08 }); return true;
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

    if (this.airborne || this.vy > 0) {
      this.vy -= GRAVITY * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.model.position.y = this.y;
    this.blob.scale.setScalar(1 - Math.min(0.5, this.y * 0.25));
    if (this.slide > 0) this.slide -= dt;
    if (this.busy > 0) this.busy -= dt;

    if (running && !this.airborne && this.slide <= 0 && this.busy <= 0) this.play('fast_run', { speed: 0.75 + speed / 28 });
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
