// The short dramas between the play: a director that runs a scene beat by beat (a camera shot, what the characters
// do, a line of dialogue on screen), and the actors it directs (Sita, Ravana, Lankini: models rigged and animated
// in Lux3D). A tap goes on to the next line; Skip ends the scene.
import * as THREE from 'three';
import { Reach } from './reach.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

const ease = t => t * t * (3 - 2 * t);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _w = new THREE.Quaternion();
// Turn a bone so that the line from it to the bone below points along dir in the world.
function aim(bone, child, dir) {
  bone.updateWorldMatrix(true, true); bone.getWorldQuaternion(_w);
  bone.getWorldPosition(_a); child.getWorldPosition(_b).sub(_a).normalize();
  _q.setFromUnitVectors(_b, dir.normalize());
  bone.parent.getWorldQuaternion(_p); bone.quaternion.copy(_p.invert().multiply(_w.premultiply(_q)));
}

// Draw a camera back along its own line of sight until every one of `points` ([x, y, z] in the world) stands inside
// the safe part of the picture: clear of the sides, of the black bars and of the words at the foot. Wide screen or
// upright phone, nobody a shot is meant to hold is ever cut off by its edge.
const SAFE = { x: 0.8, top: 0.72, bottom: -0.82 };
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
export function fit(camera, look, fov, aspect, points, most = 3.2) {
  const th = Math.tan(fov * Math.PI / 360), tw = th * aspect;
  _f.copy(look).sub(camera.position); const dist = _f.length(); if (dist < 0.01) return 1; _f.divideScalar(dist);
  _r.crossVectors(_f, UP).normalize(); _u.crossVectors(_r, _f);
  const holds = m => points.every(pt => {
    _d.set(pt[0], pt[1], pt[2]).sub(look).addScaledVector(_f, dist * m);      // the point as the camera sees it from m times as far
    const z = _d.dot(_f); if (z < 0.3) return false;
    const x = _d.dot(_r) / (z * tw), y = _d.dot(_u) / (z * th);
    return Math.abs(x) <= SAFE.x && y <= SAFE.top && y >= SAFE.bottom;
  });
  if (holds(1)) return 1;
  let lo = 1, hi = most;
  if (holds(hi)) for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (holds(mid)) hi = mid; else lo = mid; }
  camera.position.copy(look).addScaledVector(_f, -dist * hi);
  return hi;
}

// Fingers posed by the game, not by the clips. A hand remade in Blender no longer fits the finger tracks its clips were
// given (Sita's left hand bent like a claw as she spoke; Sid: "like zombie hands... make it smooth and natural"). Each
// finger bone keeps the pose it was made in and is curled about its own knuckle line, toward the palm, by so many
// degrees (first finger to little finger; knuckle, middle joint, tip): a hand at rest, a hand laid flat (joined in
// prayer, or holding something out), a hand that points.
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const CURL = { relaxed: [[10, 16, 9], [14, 20, 11], [17, 24, 13], [20, 28, 15]], flat: [[0, 1, 0], [0, 1, 0], [0, 2, 0], [1, 2, 1]], point: [[0, 3, 2], [72, 84, 48], [76, 86, 50], [78, 88, 52]] };
const _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _h3 = new THREE.Vector3(), _h4 = new THREE.Vector3(), _h5 = new THREE.Vector3(), _h6 = new THREE.Vector3(), _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _ht = new THREE.Quaternion();

export class Actor {
  // height: how tall he or she stands in the world, in metres
  constructor(gltf, height) {
    this.root = new THREE.Group(); this.root.visible = false;
    this.model = clone(gltf.scene);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const fit = new THREE.Group(); fit.add(this.model); this.model.position.set(-c.x, -box.min.y, -c.z); fit.scale.setScalar(height / size.y);
    this.root.add(fit); this.height = height;
    this.model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMapIntensity = 0.7; } });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {}; for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null; this.name = null; this.moves = null;
    this.legs = ['Left', 'Right'].map(side => ['UpLeg', 'Leg', 'Foot'].map(part => this.model.getObjectByName('mixamorig' + side + part)));
    this.offer = new Reach(this.model, 'Right');
    // hands joined before the breast: 1 the head bowed over them (prayer), 2 the face lifted (thanks). The left hand has its own reach for it.
    this.offerL = new Reach(this.model, 'Left'); this.pray = 0;
    // hand: how each hand's fingers are held ('relaxed', 'flat', 'point'; none: as the clip has them). clipHand: { clip: { Left: 'point' } } for one clip.
    this.hand = { Left: null, Right: null }; this.clipHand = null; this.digits = {};
    // pointAt: { to: a place in the world, clip: the clip it belongs to }: while that clip plays, his left arm is stretched toward the place (a clip's own gesture knows nothing of where anyone stands: Ravana's swept across his own row of heads)
    this.aimL = new Reach(this.model, 'Left'); this.pointAt = null;
    for (const side of ['Left', 'Right']) {
      const B = n => this.model.getObjectByName('mixamorig' + side + 'Hand' + n), W = b => b.getWorldPosition(new THREE.Vector3()), Q = b => b.getWorldQuaternion(new THREE.Quaternion()), wrist = B('');
      if (!wrist || !B('Index1') || !B('Middle1') || !B('Pinky1')) continue;
      // the palm's side of the hand, from the hand's own shape: toward the knuckles crossed with little finger to first finger, turned over for the other hand
      const palm = W(B('Middle1')).sub(W(wrist)).normalize().cross(W(B('Index1')).sub(W(B('Pinky1'))).normalize()).normalize(); if (side === 'Right') palm.negate();
      const list = [];
      FINGERS.forEach((f, fi) => { for (let j = 1; j <= 3; j++) { const b = B(f + j), next = B(f + (j + 1)), prev = B(f + (j - 1)); if (!b || !(next || prev)) continue;
        const dir = (next ? W(next).sub(W(b)) : W(b).sub(W(prev))).normalize();
        list.push({ bone: b, rest: b.quaternion.clone(), axis: dir.cross(palm).normalize().applyQuaternion(Q(b).invert()), f: fi, j: j - 1, now: 0 }); } });
      this.digits[side] = { list, wrist, mid: B('Middle1'), palm: palm.clone().applyQuaternion(Q(wrist).invert()), live: false };
    }
    if (this.digits.Left) this.aimL.palm.copy(this.digits.Left.palm);      // (the palm's side from the hand's own shape: his arms were not rigged held out, palms down)
    this.chest = this.model.getObjectByName('mixamorigSpine2'); this.neck = this.model.getObjectByName('mixamorigNeck'); this.head = this.model.getObjectByName('mixamorigHead'); this.crown = this.model.getObjectByName('mixamorigHeadTop_End');
    // neckKeep: how much of a clip's turning of neck and head is kept (1: all). Ravana's nine other heads are carried by his chest, so a head that turns far by itself goes into its neighbours.
    this.neckKeep = 1; this.neckRest = [this.neck, this.head].map(b => b && b.quaternion.clone());
    this.knees = 0;      // seated, how far the knees are brought together (0 as animated, 1 touching): a long skirt tears when they sit apart
    const blob = new THREE.Mesh(new THREE.CircleGeometry(height * 0.32, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.04; this.blob = blob; this.root.add(blob);
  }

  play(name, { once = false, fade = 0.25, speed = 1, from = 0 } = {}) {
    const next = this.actions[name];
    if (!next || (next === this.current && !once)) { if (next) next.timeScale = speed; return; }
    next.reset(); next.time = from; next.timeScale = speed;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = once;
    next.play();
    if (this.current && this.current !== next) { if (fade > 0) this.current.crossFadeTo(next, fade, false); else this.current.stop(); }
    this.current = next; this.name = name;
  }

  // Stood at a place, facing a heading (the models face +Z).
  place(x, y, z, yaw = 0) { this.root.position.set(x, y, z); this.root.rotation.y = yaw; this.root.visible = true; this.moves = null; return this; }
  hide() { this.root.visible = false; this.moves = null; }

  // Walk to a place in so many seconds, turning to face the way; then stand and face `then` (a heading), playing `after`.
  walk(x, z, secs, { clip = 'walk', after = 'idle', then = null } = {}) {
    const p = this.root.position;
    this.moves = { x0: p.x, z0: p.z, x, z, t: 0, secs, after, then };
    this.root.rotation.y = Math.atan2(x - p.x, z - p.z); this.play(clip, { fade: 0.2 });
  }

  update(dt) {
    if (!this.root.visible) return;
    const m = this.moves;
    if (m) {
      m.t += dt; const u = Math.min(1, m.t / m.secs);
      this.root.position.x = m.x0 + (m.x - m.x0) * u; this.root.position.z = m.z0 + (m.z - m.z0) * u;
      if (u >= 1) { this.moves = null; if (m.then !== null) this.root.rotation.y = m.then; this.play(m.after, { fade: 0.3 }); }
    }
    this.mixer.update(dt);
    if (this.neckKeep < 1) [this.neck, this.head].forEach((b, i) => { if (b) b.quaternion.slerp(this.neckRest[i], 1 - this.neckKeep); });
    if (this.pray || this.offerL.w > 0.002) this.join(dt);
    this.offer.update(dt);      // something held out in an open hand
    if (this.offerL.w > 0.002) this.palms();
    if (this.pointAt || this.aimL.w > 0.002) this.points(dt);
    this.fingers(dt);
    if (this.knees > 0 && this.name && this.name.startsWith('sit') && this.legs[0][0] && this.legs[1][0]) {
      const at = this.legs.map(l => l.map(b => b.getWorldPosition(new THREE.Vector3())));
      const mid = at[0][1].clone().add(at[1][1]).multiplyScalar(0.5);
      this.legs.forEach(([up, low, foot], i) => {
        const shin = at[i][2].clone().sub(at[i][1]);
        aim(up, low, at[i][1].clone().lerp(mid, this.knees).sub(at[i][0]));
        aim(low, foot, shin);      // the shin hangs as it did
      });
    }
  }
}

// Her hands are brought together before her breast, palm to palm, fingers up, elbows down; her head bows over them, or lifts.
const _fw = new THREE.Vector3(), _lf = new THREE.Vector3(), _ch = new THREE.Vector3(), _dir = new THREE.Vector3();
Actor.prototype.join = function (dt) {
  const on = this.pray > 0, yaw = this.root.rotation.y, k = this.height / 1.7;
  _fw.set(Math.sin(yaw), 0, Math.cos(yaw)); _lf.set(Math.cos(yaw), 0, -Math.sin(yaw));
  if (on && this.chest) {
    this.chest.getWorldPosition(_ch); _ch.y += 0.02 * k;
    this.offer.to.copy(_ch).addScaledVector(_fw, 0.17 * k).addScaledVector(_lf, -0.035 * k); this.offerL.to.copy(_ch).addScaledVector(_fw, 0.17 * k).addScaledVector(_lf, 0.035 * k);
    this.offer.face = (this.offer.face || new THREE.Vector3()).copy(_lf); this.offerL.face = (this.offerL.face || new THREE.Vector3()).copy(_lf).negate();
    this.offer.on = this.offerL.on = true;
  } else { this.offerL.on = false; if (this.offer.face) { this.offer.on = false; if (this.offer.w < 0.01) this.offer.face = this.offerL.face = null; } }
  this.offerL.update(dt);
  if (on && this.neck && this.head) {      // the head is turned about the line through her ears: down over her hands, or up
    const by = this.pray === 1 ? [0.16, 0.34] : [-0.06, -0.16];
    [this.neck, this.head].forEach((bone, i) => { bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_w); bone.parent.getWorldQuaternion(_p); bone.quaternion.copy(_p.invert().multiply(_w.premultiply(_q.setFromAxisAngle(_lf, by[i])))); });
  }
};

// Joined, each hand stands up from its wrist: fingers to the sky and a little forward, palm against palm (namaste).
Actor.prototype.palms = function () {
  const yaw = this.root.rotation.y; _fw.set(Math.sin(yaw), 0, Math.cos(yaw)); _lf.set(Math.cos(yaw), 0, -Math.sin(yaw));
  for (const side of ['Left', 'Right']) {
    const d = this.digits[side], w = Math.min(1, (side === 'Left' ? this.offerL : this.offer).w); if (!d || w < 0.002) continue;
    d.wrist.updateWorldMatrix(true, false); d.mid.updateWorldMatrix(true, false); d.wrist.getWorldQuaternion(_w);
    const d0 = d.mid.getWorldPosition(_h1).sub(d.wrist.getWorldPosition(_h2)).normalize(), p0 = _h3.copy(d.palm).applyQuaternion(_w); p0.addScaledVector(d0, -p0.dot(d0)).normalize();
    const d1 = _h4.set(0, 1, 0).addScaledVector(_fw, 0.2).normalize(), p1 = _h5.copy(_lf).multiplyScalar(side === 'Right' ? 1 : -1); p1.addScaledVector(d1, -p1.dot(d1)).normalize();
    _m0.makeBasis(d0, p0, _h6.crossVectors(d0, p0)); _m1.makeBasis(d1, p1, _h2.crossVectors(d1, p1)); _m1.multiply(_m0.transpose()); _hq.setFromRotationMatrix(_m1);
    d.wrist.parent.getWorldQuaternion(_p); _ht.copy(_p).invert().multiply(_hq.multiply(_w)); d.wrist.quaternion.slerp(_ht, w);
  }
};
Actor.prototype.points = function (dt) {
  const r = this.aimL, d = this.digits.Left; if (!r.ok || !d) return;
  const on = !!this.pointAt && this.name === this.pointAt.clip;
  if (on) { r.arm.getWorldPosition(_h1); const len = r.fore.getWorldPosition(_h2).distanceTo(_h1) + r.hand.getWorldPosition(_h3).distanceTo(_h2);
    _h4.copy(this.pointAt.to).sub(_h1).normalize(); this.aimDir = (this.aimDir || new THREE.Vector3()).copy(_h4); r.to.copy(_h1).addScaledVector(_h4, len * 0.93); r.face = (r.face || new THREE.Vector3()).set(0, -1, 0); }
  r.on = on; r.update(dt);
  if (this.aimDir && r.w > 0.002) { _ht.copy(d.wrist.quaternion); aim(d.wrist, d.mid, this.aimDir); d.wrist.quaternion.copy(_ht.slerp(d.wrist.quaternion, Math.min(1, r.w))); }      // the hand along the arm, toward what he points at
};
Actor.prototype.fingers = function (dt) {
  for (const side of ['Left', 'Right']) {
    const d = this.digits[side]; if (!d) continue;
    const flat = this.pray > 0 || this.offerL.w > 0.5 || (side === 'Right' && this.offer.on && !this.offer.face), by = this.clipHand && this.clipHand[this.name];
    const want = flat ? 'flat' : (by && by[side]) || this.hand[side]; if (!want) { d.live = false; continue; }
    const C = CURL[want], k = d.live ? Math.min(1, dt * 8) : 1; d.live = true;
    for (const g of d.list) { g.now += (C[g.f][g.j] - g.now) * k; g.bone.quaternion.copy(g.rest).multiply(_hq.setFromAxisAngle(g.axis, g.now * Math.PI / 180)); }
  }
};

export class Director {
  // el: { root, who, line, skip }: the bars and the words on screen
  constructor(camera, el) {
    this.camera = camera; this.el = el; this.active = false; this.beats = []; this.i = -1; this.t = 0; this.len = 0;
    this.cam = null; this.camT = 0; this.camLen = 1; this.look = new THREE.Vector3(); this.gaze = new THREE.Vector3(); this.faced = null; this.done = null;
    this.sound = null;      // the game's sound, once it is there: a beat with a voice is spoken, and lasts as long as its voice
    el.skip.addEventListener('click', e => { e.stopPropagation(); this.skip(); });
  }

  // beats: [{ who, line, secs, cam: { at, to, look, lookTo, fov, secs, keep }, do }]. A beat without a camera keeps the shot it is in.
  // keep: a function giving the points the shot must hold in the picture (heads and feet); the camera draws back until it does.
  play(beats, done) {
    this.beats = beats; this.i = -1; this.done = done || null; this.active = true; this.cam = null;
    if (this.sound) this.sound.learn(beats.map(b => b.voice).filter(Boolean));
    this.el.root.hidden = false; this.next();
  }

  next() {
    this.i++;
    if (this.i >= this.beats.length) return this.finish();
    const b = this.beats[this.i]; this.t = 0;
    this.len = b.secs ?? (b.line ? 2.3 + b.line.length * 0.07 : 1.6);      // long enough to read at ease on a phone (Sid: "need enough time to read"); a tap still goes on
    if (this.sound) {      // spoken, a line sets its own pace: the voice and a breath after it; unspoken, it stays long enough to read
      if (b.cue !== undefined) this.sound.score(b.cue);      // the music changes here, or fades away: it never stops short
      if (b.hit) this.sound.hit(b.hit);
      const d = b.voice ? this.sound.speak(b.voice, b.lead || 0) : (this.sound.quiet(), 0);
      if (d) this.len = Math.max(b.secs || 0, d + 0.9);
    }
    if (b.cam) { this.cam = b.cam; this.camT = 0; this.camLen = b.cam.secs || this.len + 0.4; }
    if (b.do) b.do();
    const { who, line } = this.el;
    who.textContent = b.who || ''; who.hidden = !b.who;
    line.textContent = b.line || ''; line.parentElement.hidden = !b.line; line.parentElement.classList.toggle('told', !b.who);
    line.parentElement.style.animation = 'none'; void line.parentElement.offsetWidth; line.parentElement.style.animation = '';
  }

  tap() { if (this.active && this.t > 0.35 && !(this.beats[this.i] && this.beats[this.i].hold)) this.next(); }      // a beat that holds waits for its own answer, not for a tap
  // Stopped without going on to what follows: the player has left for the title.
  skipQuiet() { this.active = false; this.done = null; this.el.root.hidden = true; if (this.sound) this.sound.quiet(); }
  skip() { if (this.active) this.finish(); }

  finish() {
    this.active = false; this.el.root.hidden = true; if (this.sound) this.sound.quiet();
    const d = this.done; this.done = null; if (d) d();
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt; this.camT += dt;
    if (this.t >= this.len) this.next();
  }

  // Sets the camera for this frame. Returns the lens (field of view) the shot is taken with.
  // aspect: the screen's width over its height. tall: an upright phone, which sees a narrow slice and is given a wider lens.
  frame(aspect = 16 / 9, tall = false) {
    const c = this.cam; if (!c) return null;
    const u = ease(Math.min(1, this.camT / this.camLen)), to = c.to || c.at, lookTo = c.lookTo || c.look;
    if (c.round) {      // carried round a point instead of straight from place to place: { c, from, to (bearings), r: [near, far], y: [low, high] }
      const o = c.round, a = o.from + (o.to - o.from) * u, r = o.r[0] + (o.r[1] - o.r[0]) * u;
      this.camera.position.set(o.c[0] + Math.sin(a) * r, o.c[1] + o.y[0] + (o.y[1] - o.y[0]) * u, o.c[2] + Math.cos(a) * r);
    } else this.camera.position.set(c.at[0] + (to[0] - c.at[0]) * u, c.at[1] + (to[1] - c.at[1]) * u, c.at[2] + (to[2] - c.at[2]) * u);
    this.look.set(c.look[0] + (lookTo[0] - c.look[0]) * u, c.look[1] + (lookTo[1] - c.look[1]) * u, c.look[2] + (lookTo[2] - c.look[2]) * u);
    if (c.ride) { const r = c.ride(u); this.camera.position.set(r.at[0], r.at[1], r.at[2]); this.look.set(r.look[0], r.look[1], r.look[2]); }      // a shot that rides with someone who is moving: its place and its look are worked out afresh each frame
    if (c.face) {      // a shot of one person looks at that person's face, wherever the pose has put it, and follows it gently: never every nod
      const f = c.face(); if (this.faced !== c) { this.faced = c; this.gaze.copy(f); } else this.gaze.lerp(f, 0.05);
      this.look.copy(this.gaze);
    } else this.faced = null;
    const lens = (c.fov || 48) + ((c.fovTo ?? c.fov ?? 48) - (c.fov || 48)) * u;      // fovTo: the lens the shot ends on, when it changes as the camera travels
    const fov = tall ? Math.min(80, lens * 1.6) : lens;
    if (c.keep) fit(this.camera, this.look, fov, aspect, c.keep());
    return fov;
  }
}
