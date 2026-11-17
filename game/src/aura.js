// What is seen round Hanuman when he changes his size: a wheel of light turning on the ground under him, rings running
// out from his feet, a column of light, sparks spiralling up round him, and lightning striking in from above.
// Nothing here is lit by the scene's lamps: it is all drawn as light, added over the picture.
import * as THREE from 'three';

const N = 260, BOLTS = 5, SEG = 7, COPIES = 3;

function wheelTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.translate(256, 256); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
  for (const [r, w] of [[240, 5], [222, 2], [168, 3], [112, 2], [60, 3]]) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  for (let i = 0; i < 16; i++) {      // sixteen petals between the outer rings, eight spokes within
    const a = i / 16 * Math.PI * 2; g.save(); g.rotate(a);
    g.lineWidth = 2.5; g.beginPath(); g.moveTo(172, 0); g.quadraticCurveTo(200, 18, 220, 0); g.quadraticCurveTo(200, -18, 172, 0); g.stroke();
    if (i % 2 === 0) { g.lineWidth = 2; g.beginPath(); g.moveTo(62, 0); g.lineTo(166, 0); g.stroke(); g.beginPath(); g.arc(140, 0, 6, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.moveTo(112, 0); g.lineTo(150, 12); g.lineTo(150, -12); g.closePath(); g.stroke(); }
    g.restore();
  }
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 231, Math.sin(a) * 231, 2.2, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function columnTexture() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 128;
  const g = c.getContext('2d'), v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.55, 'rgba(255,255,255,.35)'); v.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = v; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Aura {
  constructor(scene, dot) {
    const light = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false };
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.wheel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ ...light, map: wheelTexture(), color: 0xffc860, side: THREE.DoubleSide }));
    this.wheel.rotation.x = -Math.PI / 2; this.wheel.position.y = 0.06;
    this.rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 56), new THREE.MeshBasicMaterial({ ...light, color: 0xffe2a0, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.08; return m; });
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true), new THREE.MeshBasicMaterial({ ...light, map: columnTexture(), color: 0xffb648, side: THREE.DoubleSide }));
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ ...light, map: dot, color: 0xffcf7a, depthTest: false }));
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ ...light, map: dot, color: 0xcfe0ff, depthTest: false })); this.flash.visible = false;
    // the sparks: each has its bearing, its distance out, its height and its own speeds
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.par = new Float32Array(N * 5);
    for (let i = 0; i < N; i++) {
      this.par.set([Math.random() * Math.PI * 2, 0.5 + Math.random() * 0.9, Math.random(), 2.2 + Math.random() * 3.4, 0.25 + Math.random() * 0.5], i * 5);
      const hot = Math.random(); this.col.set([1, 0.55 + hot * 0.4, 0.15 + hot * 0.5], i * 3);
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.sparks = new THREE.Points(pg, new THREE.PointsMaterial({ ...light, vertexColors: true, size: 0.22, map: dot, sizeAttenuation: true }));
    this.lpos = new Float32Array(BOLTS * SEG * COPIES * 6);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(this.lpos, 3));
    this.bolts = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ ...light, color: 0xd8e6ff }));
    for (const o of [this.wheel, ...this.rings, this.column, this.glow, this.flash, this.sparks, this.bolts]) { o.frustumCulled = false; o.renderOrder = 6; this.root.add(o); }
    this.level = 0; this.want = 0; this.size = 1; this.storm = false; this.t = 0; this.next = 0; this.struck = 0;
  }

  // Begun where he stands. tone: the colour of the light.
  begin(x, y, z, tone = 0xffc860) {
    this.root.position.set(x, y, z); this.root.visible = true; this.want = 1; this.t = 0; this.struck = 0;
    this.wheel.material.color.set(tone); this.column.material.color.set(tone);
  }
  end() { this.want = 0; this.storm = false; }
  stop() { this.want = this.level = 0; this.storm = false; this.root.visible = false; }

  // size: how many times his own height he stands now. Returns true at the instant a bolt strikes (for the sound and the shake).
  update(dt, size = 1) {
    if (!this.root.visible) return false;
    this.level += (this.want - this.level) * Math.min(1, dt * (this.want ? 3.5 : 2.2)); this.t += dt; this.size = size;
    if (this.want === 0 && this.level < 0.02) { this.root.visible = false; return false; }
    const k = this.level, s = size, t = this.t;
    this.wheel.scale.setScalar(3.6 * s * (0.6 + 0.4 * k)); this.wheel.rotation.z = t * 0.9; this.wheel.material.opacity = 0.8 * k;
    this.rings.forEach((r, i) => { const u = (t * 0.9 + i / 3) % 1; r.scale.setScalar((0.6 + u * 4.2) * s); r.material.opacity = (1 - u) * 0.45 * k; });
    this.column.scale.set(1.15 * s, 7 * s, 1.15 * s); this.column.position.y = 3.5 * s; this.column.material.opacity = (0.15 + 0.05 * Math.sin(t * 17)) * k;
    this.glow.position.y = 1.1 * s; this.glow.scale.setScalar((3.0 + Math.sin(t * 23) * 0.4) * s); this.glow.material.opacity = 0.24 * k;
    const p = this.par, pos = this.pos;
    for (let i = 0; i < N; i++) {
      const j = i * 5; p[j] += p[j + 3] * dt; p[j + 2] += p[j + 4] * dt * (0.6 + k);
      if (p[j + 2] > 1) { p[j + 2] = 0; p[j + 1] = 0.5 + Math.random() * 0.9; }
      const r = p[j + 1] * (1.25 - 0.6 * p[j + 2]) * s;
      pos[i * 3] = Math.cos(p[j]) * r; pos[i * 3 + 1] = p[j + 2] * 3.4 * s; pos[i * 3 + 2] = Math.sin(p[j]) * r;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true; this.sparks.material.opacity = 0.9 * k; this.sparks.material.size = 0.115 * (0.6 + 0.4 * s);
    let struck = false; this.next -= dt; this.struck -= dt;
    this.bolts.visible = this.storm && k > 0.3;
    if (this.bolts.visible && this.next <= 0) {      // the lightning is drawn anew many times a second, so it writhes
      this.next = 0.05 + Math.random() * 0.06; const l = this.lpos; let n = 0;
      for (let b = 0; b < BOLTS; b++) {
        const a = Math.random() * Math.PI * 2, ex = Math.cos(a) * 0.3 * s, ez = Math.sin(a) * 0.3 * s, ey = (0.4 + Math.random() * 1.5) * s;
        const sx = Math.cos(a) * (2.2 + Math.random() * 1.6) * s, sz = Math.sin(a) * (2.2 + Math.random() * 1.6) * s, sy = (4.2 + Math.random() * 2) * s;
        const pts = []; for (let i = 0; i <= SEG; i++) { const u = i / SEG, w = i === 0 || i === SEG ? 0 : 0.42 * s; pts.push([sx + (ex - sx) * u + (Math.random() - 0.5) * w, sy + (ey - sy) * u + (Math.random() - 0.5) * w, sz + (ez - sz) * u + (Math.random() - 0.5) * w]); }
        for (let c = 0; c < COPIES; c++) for (let i = 0; i < SEG; i++) { const o = (c - 1) * 0.035 * s; l.set([pts[i][0] + o, pts[i][1], pts[i][2] + o, pts[i + 1][0] + o, pts[i + 1][1], pts[i + 1][2] + o], n); n += 6; }
        if (b === 0) this.flash.position.set(ex, ey, ez);
      }
      this.bolts.geometry.attributes.position.needsUpdate = true;
      if (this.struck <= 0) { this.struck = 0.34 + Math.random() * 0.3; struck = true; }
    }
    this.flash.visible = this.bolts.visible; this.flash.scale.setScalar((1.4 + Math.random() * 1.0) * s); this.flash.material.opacity = 0.4 * k;
    return struck;
  }
}
