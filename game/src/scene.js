// The short dramas between the play: a director that runs a scene beat by beat (a camera shot, what the characters
// do, a line of dialogue on screen), and the actors it directs (Sita, Ravana, Lankini: models rigged and animated
// in Lux3D). A tap goes on to the next line; Skip ends the scene.
import * as THREE from 'three';
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

export class Director {
  // el: { root, who, line, skip }: the bars and the words on screen
  constructor(camera, el) {
    this.camera = camera; this.el = el; this.active = false; this.beats = []; this.i = -1; this.t = 0; this.len = 0;
    this.cam = null; this.camT = 0; this.camLen = 1; this.look = new THREE.Vector3(); this.done = null;
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
      const d = b.voice ? this.sound.speak(b.voice) : (this.sound.quiet(), 0);
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
    const lens = (c.fov || 48) + ((c.fovTo ?? c.fov ?? 48) - (c.fov || 48)) * u;      // fovTo: the lens the shot ends on, when it changes as the camera travels
    const fov = tall ? Math.min(80, lens * 1.6) : lens;
    if (c.keep) fit(this.camera, this.look, fov, aspect, c.keep());
    return fov;
  }
}
