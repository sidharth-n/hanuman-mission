// Hanuman: always runs forward by himself. The player only picks a lane, jumps or slides.
import * as THREE from 'three';
import { Reach } from './reach.js';
import { GRAVITY, JUMP_V, SLIDE_TIME, AIR_TIME } from './pace.js';

export const LANES = [-2.4, 0, 2.4];

const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0), Z_AXIS = new THREE.Vector3(0, 0, 1);

// Mixamo clips move the hips: forward with the run-up, up with a leap, down with a slide. The game alone decides
// where he is, so the hips are pinned in place. Their height is kept in every move made on the ground (a crouch, a
// roar, a landing, a blow, a fall: with the hips held up and the knees bent his feet would leave the road) and pinned
// only where the game itself lifts him: a leap, the hang he flies in, a climb.
// The rig may stand along any axis: his height is whichever part of the hips' place is large when he stands.
export function pinHips(clip, keepHeight) {
  for (const t of clip.tracks) {
    if (!/Hips\.position$/.test(t.name)) continue;
    const v = t.values, H = [0, 1, 2].reduce((a, b) => Math.abs(v[b]) > Math.abs(v[a]) ? b : a), sign = Math.sign(v[H]) || 1;
    // find the part of the clip where the body is really off the ground (leap) or really down (slide),
    // so the game can play exactly that part while he is in the air or under a beam
    let lo = Infinity, hi = -Infinity;
    for (let i = H; i < v.length; i += 3) { lo = Math.min(lo, v[i] * sign); hi = Math.max(hi, v[i] * sign); }
    const base = v[H] * sign, up = hi - base > base - lo, level = up ? base + (hi - base) * 0.2 : base - (base - lo) * 0.4;
    let a = -1, b = -1;
    for (let i = H, n = 0; i < v.length; i += 3, n++) if (up ? v[i] * sign > level : v[i] * sign < level) { if (a < 0) a = n; b = n; }
    clip.userData = { from: a < 0 ? 0 : t.times[a], to: b < 0 ? clip.duration : t.times[b] };
    for (let i = 3; i < v.length; i += 3) for (let k = 0; k < 3; k++) if (k !== H || !keepHeight) v[i + k] = v[k];
  }
  return clip;
}

// In flight he is posed by hand, the way he is always painted: one arm reaching ahead, the mace resting over the
// other shoulder, one leg trailing straight and one bent, chest and head lifted to see where he is going.
// Each entry: a bone, the bone below it, and the way the line between them should point (x: his right, y: up, z: behind him).
const FLIGHT = [
  ['Spine1', 'Spine2', [0, 0.16, -1]], ['Spine2', 'Neck', [0, 0.3, -1]],
  ['Neck', 'Head', [0, 0.7, -0.7]], ['Head', 'HeadTop_End', [0, 1, -0.2]],
  ['LeftArm', 'LeftForeArm', [-0.2, -0.04, -1]], ['LeftForeArm', 'LeftHand', [-0.04, 0.03, -1]],
  ['RightArm', 'RightForeArm', [0.5, -0.4, 0.6]], ['RightForeArm', 'RightHand', [-0.18, 0.38, -0.9]],      // elbow back by his ribs, fist up in front of the shoulder
  ['RightUpLeg', 'RightLeg', [0.1, -0.06, 1]], ['RightLeg', 'RightFoot', [0.04, 0.04, 1]], ['RightFoot', 'RightToeBase', [0, -0.3, 1]],
  ['LeftUpLeg', 'LeftLeg', [-0.12, -0.6, 0.8]], ['LeftLeg', 'LeftFoot', [-0.05, 0.45, 0.9]], ['LeftFoot', 'LeftToeBase', [0, 0.1, 1]],
];
// Thrown forward on his face (his legs caught as he ran): each line as it lies in his own body standing upright (x: his right,
// y: up, z: behind him); it is tipped with him as he goes over. Arms thrown out ahead to break the fall, legs together, head up.
const PRONE = [
  ['Neck', 'Head', [0, 0.8, 0.6]], ['Head', 'HeadTop_End', [0, 0.55, 0.85]],
  ['LeftArm', 'LeftForeArm', [-0.5, 1, -0.15]], ['LeftForeArm', 'LeftHand', [0.28, 1, -0.1]],
  ['RightArm', 'RightForeArm', [0.55, 1, -0.12]], ['RightForeArm', 'RightHand', [-0.22, 1, -0.1]],
  ['LeftUpLeg', 'LeftLeg', [0.03, -1, 0]], ['LeftLeg', 'LeftFoot', [0, -1, 0.03]], ['LeftFoot', 'LeftToeBase', [0, -1, -0.35]],
  ['RightUpLeg', 'RightLeg', [-0.03, -1, 0]], ['RightLeg', 'RightFoot', [0, -1, 0.03]], ['RightFoot', 'RightToeBase', [0, -1, -0.35]],
];
const STRIDE = 4.66;      // metres a second a planted foot passes under him in the run clip at its own pace, at his own size (measured in the game)
const MACE_UP = new THREE.Vector3(-0.22, 0.5, 0.84);      // the mace lies back over his shoulder, head high behind him
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _w = new THREE.Quaternion();

// Turn a bone so that the line from it to the bone below (or, with none given, its own upward axis) points along dir in the world.
function aim(bone, child, dir, weight) {
  bone.updateWorldMatrix(true, true);
  bone.getWorldQuaternion(_w);
  if (child) { bone.getWorldPosition(_a); child.getWorldPosition(_b).sub(_a).normalize(); } else _b.set(0, 1, 0).applyQuaternion(_w);
  _q.setFromUnitVectors(_b, _d.copy(dir).normalize());
  bone.parent.getWorldQuaternion(_p);
  bone.quaternion.slerp(_p.invert().multiply(_w.premultiply(_q)), weight);
}

const CURL = { q: new THREE.Quaternion(), by: [0, 0, 0], axis: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };

export class Hero {
  constructor(gltf) {
    this.root = new THREE.Group();
    this.flyHeight = 2.5;      // how high he flies: clear of everything in the road, low enough to feel the speed
    this.model = gltf.scene;
    this.model.rotation.y = Math.PI;            // the model faces +Z, the run goes toward -Z
    this.root.add(this.model);
    this.model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.6; } });

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      pinHips(clip, !/jump|hang|climb/.test(clip.name));      // on the ground the hips go down with the knees; in a leap or in flight the game lifts him
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
    this.current = null;

    this.tail = [];
    this.model.traverse(o => { const m = o.isBone && /Tail(\d)$/.exec(o.name); if (m) this.tail[+m[1] - 1] = o; });
    this.tailRest = this.tail.map(b => b.quaternion.clone());
    this.hips = this.model.getObjectByName('mixamorigHips');
    this.bones = {};
    this.model.traverse(o => { if (o.isBone && o.name.startsWith('mixamorig')) this.bones[o.name.slice(9)] = o; });
    // His fingers, when his file has them (tools/hero_hands.py): each finger bone is turned as the bone of the old single chain at the
    // same joint is, so every animation that closed the mitten closes the hand (curl(), after the mixer).
    this.fingers = [];
    for (const side of ['Left', 'Right']) { const from = [1, 2, 3].map(n => this.bones[side + 'HandIndex' + n]); if (from.some(b => !b)) continue;
      for (const [f, k] of [['Index', 0.94], ['Middle', 1], ['Ring', 1.04], ['Pinky', 1.08]]) { const to = [1, 2, 3].map(n => this.bones[side + 'HandReal' + f + n]);
        if (to.every(Boolean)) this.fingers.push({ from, to, k, rest: to.map(b => b.quaternion.clone()), inv: to.map(b => b.quaternion.clone().invert()), was: from.map(b => b.quaternion.clone()) }); } }
    this.offer = new Reach(this.model, 'Right');
    this.pronePose = PRONE.filter(([a, b]) => this.bones[a] && this.bones[b]).map(([a, b, d]) => [this.bones[a], this.bones[b], d]);
    this.prone = 0;      // 0 standing .. 1 flat on his face: the story throws him down (the capture)
    this.flightPose = FLIGHT.filter(([a, b]) => this.bones[a] && this.bones[b]).map(([a, b, d]) => [this.bones[a], this.bones[b], new THREE.Vector3(...d)]);

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
    hand.add(grip); this.mace = grip; this.maceUnit = unit; this.maceRest = grip.quaternion.clone();
  }

  reset() {
    this.lane = 1; this.root.position.set(0, 0, 0); this.model.position.y = 0; this.root.rotation.y = 0; this.free = false; this.pace = 0;
    if (this.offer) { this.offer.on = false; this.offer.w = 0; }
    this.y = 0; this.vy = 0; this.slide = 0; this.busy = 0; this.time = 0; this.lean = 0; this.floor = 0; this.sink = 0; this.flying = false; this.fly = 0; this.prone = 0;
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
    if (this.current && this.current !== next) { if (fade > 0) this.current.crossFadeTo(next, fade, false); else this.current.stop(); }      // the same move again simply starts over
    this.current = next; this.name = name;
  }

  get airborne() { return this.y > this.floor + 0.02; }
  // A leap where he stands, in a fight: the same leap as on the run.
  leap() {
    if (this.airborne) return false;
    this.vy = JUMP_V; this.y = this.floor + 0.03; this.slide = 0;
    const w = this.actions.running_jump.getClip().userData, lead = 0.06;
    this.play('running_jump', { once: true, from: Math.max(0, w.from - lead), speed: (w.to - w.from + lead) / AIR_TIME, fade: 0.07 }); return true;
  }
  get sliding() { return this.slide > 0; }
  // How far down he is in a slide, 0..1: eases in as he drops and out as he rises, for the camera to follow.
  get low() {
    if (this.slide <= 0) return 0;
    const a = Math.min(1, (SLIDE_TIME - this.slide) / 0.2), b = Math.min(1, this.slide / 0.3);
    return a * a * (3 - 2 * a) * b * b * (3 - 2 * b);
  }

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
      const clip = this.actions.running_slide.getClip(), w = clip.userData, from = Math.max(0, w.from - 0.12), to = Math.min(clip.duration, w.to + 0.12);
      // the low part of the clip, with a little of going down and coming up, paced to last exactly as long as the slide
      this.play('running_slide', { once: true, from, speed: (to - from) / SLIDE_TIME, fade: 0.1 }); return true;
    }
    return false;
  }

  stumble() { this.busy = 0.45; this.slide = 0; this.play('hit_reaction', { once: true, speed: 2.2, fade: 0.06 }); }

  // groundAt: the height of the floor along the route; his own height (this.y) is measured from it.
  update(dt, speed, running, groundAt) {
    this.time += dt;
    const p = this.root.position;
    // in a fight (free) he is moved and turned by the fight itself: no lanes, no running on by himself
    if (running && !this.free) p.z -= speed * dt;
    if (groundAt) p.y = groundAt(p.z);
    const dx = this.free ? 0 : LANES[this.lane] - p.x;
    p.x += dx * Math.min(1, dt * 13);
    this.lean += ((-dx * 0.16) - this.lean) * Math.min(1, dt * 12);
    this.model.rotation.z = this.lean;

    this.fly += ((this.flying ? 1 : 0) - this.fly) * Math.min(1, dt * 5);
    if (this.flying) { this.y += (this.flyHeight + Math.sin(this.time * 2.6) * 0.12 - this.y) * Math.min(1, dt * 3.5); this.vy = 0; }
    else if (this.y > this.floor || this.vy > 0) { this.vy -= GRAVITY * dt; this.y += this.vy * dt; }
    if (this.y <= this.floor) { this.y = this.floor; this.vy = 0; }      // on the ground, or on top of something he came down on
    // tipped forward to fly level; the body is kept over the spot he is flying above
    this.model.rotation.x = -this.fly * 1.3 - this.prone * 1.5;      // (thrown down, he goes over about his feet)
    this.model.position.set(0, this.y + this.fly * 0.25 - (this.sink || 0) + this.prone * 0.2, this.fly * 0.85);      // sink: a held pose whose clip stands him off the ground is set down by that much
    this.blob.position.y = this.floor + 0.05; this.blob.scale.setScalar(1 - Math.min(0.5, (this.y - this.floor) * 0.25)); this.blob.visible = this.floor > -1;
    if (this.slide > 0) this.slide -= dt;
    if (this.busy > 0) this.busy -= dt;

    if (running && !this.free && !this.airborne && this.slide <= 0 && this.busy <= 0) this.play('fast_run', { speed: this.root.scale.x > 1.05 ? Math.min(0.75 + speed / 28, speed / (STRIDE * this.root.scale.x)) : 0.75 + speed / 28, fade: 0.14 });      // grown, his stride is longer: the legs turn only as fast as plants each foot on the ground it covers, never faster than his usual pace
    this.mixer.update(dt);
    this.curl();
    this.poseTail(this.free ? this.pace : running ? speed : 0);
    this.poseFlight();
    this.poseProne();
    this.offer.update(dt);      // something held out in his open hand, in a scene
  }

  // Each finger closes as the old mitten's one chain does, joint for joint (the little finger a little more, the first a little
  // less). A mitten folds flat at its middle joint, up to 157 degrees in his grip; a finger cannot: past 105 the rest of the
  // bend is shared out to the knuckle and the fingertip, so the hand still closes and no fingertip comes out through the palm.
  curl() {
    for (const F of this.fingers) {
      for (let n = 0; n < 3; n++) { const q = CURL.q.copy(F.inv[n]).multiply(F.from[n].quaternion); if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        const half = Math.acos(Math.min(1, q.w)), sin = Math.sin(half) || 1; CURL.by[n] = 2 * half * F.k; CURL.axis[n].set(q.x / sin, q.y / sin, q.z / sin); }
      const over = Math.max(0, CURL.by[1] - 1.83); CURL.by[1] -= over; CURL.by[0] = Math.min(1.5, CURL.by[0] + over * 0.6); CURL.by[2] = Math.min(1.3, CURL.by[2] + over * 0.4);
      for (let n = 0; n < 3; n++) F.to[n].quaternion.copy(F.rest[n]).multiply(CURL.q.setFromAxisAngle(CURL.axis[n], CURL.by[n]));
    }
  }

  poseProne() {
    const u = Math.min(1, this.prone * 2.5); if (u < 0.01) return;      // his limbs are where they will be well before he lands
    const a = -this.model.rotation.x, c = Math.cos(a), s = Math.sin(a), w = u * u * (3 - 2 * u);
    for (const [bone, child, d] of this.pronePose) aim(bone, child, _t.set(d[0], d[1] * c + d[2] * s, -d[1] * s + d[2] * c), w);
  }

  poseFlight() {
    const w = this.fly * this.fly * (3 - 2 * this.fly);
    if (this.mace) this.mace.quaternion.copy(this.maceRest);
    if (w < 0.01) return;
    for (const [bone, child, dir] of this.flightPose) aim(bone, child, dir, w);
    if (this.mace) aim(this.mace, null, MACE_UP, w);
    // the tail streams out behind him and lifts toward its tip, with a slow wave running down it
    for (let i = 0; i < this.tail.length - 1; i++) {
      const k = i / (this.tail.length - 1);
      _t.set(Math.sin(this.time * 3 - i * 0.8) * 0.1, 0.08 + k * k * 0.9 + Math.sin(this.time * 4.2 - i * 0.9) * 0.07, 1 - k * 0.45);
      aim(this.tail[i], this.tail[i + 1], _t, w);
    }
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
    if (this.root.rotation.y) world.premultiply(this.root.quaternion).multiply(_q.copy(this.root.quaternion).invert());      // turned in a fight: the tail still streams out behind him
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

  // Bound: coils of rope round his chest and arms, and no mace in his hand. Unbound: as he was.
  bind(on) {
    if (!this.ropes) {
      const spine = this.bones.Spine1 || this.bones.Spine; if (!spine) return;
      spine.updateWorldMatrix(true, false);
      const unit = 1 / spine.getWorldScale(new THREE.Vector3()).x, mat = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.95 });
      this.ropes = new THREE.Group();
      for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.335 - i * 0.006, 0.027, 6, 24), mat); t.rotation.x = Math.PI / 2 + (i % 2 ? 0.07 : -0.07); t.position.y = -0.12 + i * 0.075; this.ropes.add(t); }
      this.ropes.scale.setScalar(unit); spine.add(this.ropes);
    }
    this.ropes.visible = on; if (this.mace) this.mace.visible = !on;
  }

  // The head of the mace and its grip in the world, for the bright trail a swing leaves.
  maceEnds(tip, base) {
    if (!this.mace) return false;
    this.mace.updateWorldMatrix(true, false);
    tip.set(0, 0.95, 0).applyMatrix4(this.mace.matrixWorld); base.set(0, 0.3, 0).applyMatrix4(this.mace.matrixWorld);
    return true;
  }

  tailTip(target) {
    const last = this.tail[this.tail.length - 1];
    return last ? last.getWorldPosition(target) : target.copy(this.root.position).setY(1.5);
  }
}
