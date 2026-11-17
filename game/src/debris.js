// What is left of a thing he has gone through: pieces of stone and timber thrown out, tumbling, falling, lying a moment
// and gone. One box drawn as many times as there are pieces in the air.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const NONE = new THREE.Matrix4().makeScale(0, 0, 0);

export class Debris {
  constructor(scene, n = 180) {
    this.n = n; this.next = 0; this.busy = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.rot = new Float32Array(n * 3); this.spin = new Float32Array(n * 3);
    this.size = new Float32Array(n * 3); this.life = new Float32Array(n);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, NONE); this.mesh.setColorAt(i, c.setHSL(0.04 + Math.random() * 0.04, 0.2 + Math.random() * 0.25, 0.022 + Math.random() * 0.05)); }      // dark stone, old timber
    scene.add(this.mesh);
  }
  // at (x, y, z): count pieces about `size` metres across, thrown out at about `speed`; (ax, az): the way he was going, which they are carried along
  burst(x, y, z, count, size, speed, ax = 0, az = 0) {
    for (let i = 0; i < count; i++) {
      const k = this.next++ % this.n, j = k * 3, a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.8), w = size * (0.45 + Math.random());
      this.pos[j] = x + (Math.random() - 0.5) * size * 2; this.pos[j + 1] = y + Math.random() * size * 2; this.pos[j + 2] = z + (Math.random() - 0.5) * size;
      this.vel[j] = Math.cos(a) * v + ax; this.vel[j + 1] = 2.5 + Math.random() * speed * 0.9; this.vel[j + 2] = Math.sin(a) * v * 0.6 + az;
      this.size[j] = w * (0.7 + Math.random() * 1.1); this.size[j + 1] = w * (0.16 + Math.random() * 0.4); this.size[j + 2] = w * (0.3 + Math.random() * 0.6);      // slabs and splinters, never dice
      for (let c = 0; c < 3; c++) { this.rot[j + c] = Math.random() * 6.28; this.spin[j + c] = (Math.random() - 0.5) * 14; }
      this.life[k] = 1.5 + Math.random() * 0.8;
    }
    this.busy = 2.4; this.mesh.visible = true;
  }
  // floor(z): the height of the ground there
  update(dt, floor) {
    if (this.busy <= 0) { if (this.mesh.visible) this.mesh.visible = false; return; }
    this.busy -= dt;
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) continue;
      const j = k * 3; this.life[k] -= dt;
      if (this.life[k] <= 0) { this.mesh.setMatrixAt(k, NONE); continue; }
      this.vel[j + 1] -= 24 * dt;
      for (let c = 0; c < 3; c++) { this.pos[j + c] += this.vel[j + c] * dt; this.rot[j + c] += this.spin[j + c] * dt; }
      const g = floor(this.pos[j + 2]) + this.size[j + 1] * 0.5;
      if (this.pos[j + 1] < g) { this.pos[j + 1] = g; this.vel[j + 1] *= -0.3; this.vel[j] *= 0.55; this.vel[j + 2] *= 0.55; for (let c = 0; c < 3; c++) this.spin[j + c] *= 0.4; }
      const f = Math.min(1, this.life[k] / 0.35);      // at the last it shrinks away
      _m.compose(_p.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]), _q.setFromEuler(_e.set(this.rot[j], this.rot[j + 1], this.rot[j + 2])), _s.set(this.size[j] * f, this.size[j + 1] * f, this.size[j + 2] * f));
      this.mesh.setMatrixAt(k, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.life.fill(0); for (let k = 0; k < this.n; k++) this.mesh.setMatrixAt(k, NONE); this.mesh.instanceMatrix.needsUpdate = true; this.busy = 0; this.mesh.visible = false; }
}
