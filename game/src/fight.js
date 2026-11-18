// The fight in the palace court: the run stops, three guards with swords come in, and the player moves Hanuman
// freely with a thumb stick, strikes with the mace and rolls clear. When the last guard is down the run goes on.
// This file holds the rules of the fight and what it throws into the air: sparks, flashes and the trails of swings.
import * as THREE from 'three';
import { Guard } from './guard.js';

const HX = 3.7, HZ = 9;                 // the floor it is fought on: half its width (the paved road) and half its length
export const LIVES = 5;
// Each fight is a list of waves. foes: who comes, by kind (guard.js). most: how many may come at him at once.
// tell: seconds from a sword going up to the blow landing. rest: the pause between attacks.
// On the first wave, for the whole fight: lives: how much health he has in it (LIVES if not said). mercy: on his last life nobody
// begins a blow, so the fight cannot be lost.
// (Sid, 18 Nov, from a beta player who stopped playing when he lost to Lankini: "let's make this first fight an easier one... he can
// fall a few times but Hanuman's energy meter is higher and hers is lower and his few hits kill her, so people win this level
// always. Doesn't feel like first hit wins, but most of Hanuman's hits get to her and she falls easier. Same the next guards
// fight: not too easy but not too tough either." A player who only taps Strike lost both, in 20 and 27 seconds.)
export const PLANS = {
  gate: [{ foes: ['lankini'], most: 1, tell: 0.66, rest: 1.0, lives: 8, mercy: true }],
  court: [{ foes: ['guard', 'rusher', 'guard'], most: 1, tell: 0.7, rest: 1.0, lives: 6 }, { foes: ['guard', 'brute', 'rusher', 'guard'], most: 2, tell: 0.66, rest: 0.9 }],
  grove: [{ foes: ['guard', 'rusher', 'guard'], most: 2, tell: 0.66, rest: 0.8 }],      // three, and he can beat them; then ten more come (story.js) and he is taken
};
// Struck down: the fall he is thrown back in (he lands on his back at `land` seconds of the clip) and the kip up that
// brings him to his feet (he lies still until `from`). Both are played faster than they were made.
const FALL = { clip: 'fall_flying_back', speed: 1.35, land: 0.9 }, KIP = { clip: 'rise_kip_up', from: 0.3, end: 2.0, speed: 1.6, slow: 1.3 };
const PACE = 5.8;                       // how fast he moves under the stick, metres a second
const RING = 3.1;                       // how far the guards who are waiting stand off from him
const HIGH = 1.85;                      // how tall he stands at his own size: his health bar rides that far over his feet, and a little more
const GOLD = [1, 0.74, 0.3], WHITE = [1, 0.95, 0.82], RED = [1, 0.25, 0.12];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The star of light where metal meets metal: a white-hot heart, four long rays and four short between them.
function flareTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.translate(128, 128);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.07, 'rgba(255,252,240,.95)'); r.addColorStop(0.18, 'rgba(255,226,160,.34)'); r.addColorStop(0.45, 'rgba(255,186,90,.07)'); r.addColorStop(1, 'rgba(255,170,70,0)');
  g.fillStyle = r; g.fillRect(-128, -128, 256, 256); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const L = i % 2 ? 58 : 126, w = i % 2 ? 2.4 : 3.6, l = g.createLinearGradient(0, 0, L, 0);
    l.addColorStop(0, 'rgba(255,255,255,.95)'); l.addColorStop(0.3, 'rgba(255,238,196,.5)'); l.addColorStop(1, 'rgba(255,200,120,0)');
    g.save(); g.rotate(i * Math.PI / 4); g.fillStyle = l; g.beginPath(); g.moveTo(0, -w); g.lineTo(L, 0); g.lineTo(0, w); g.closePath(); g.fill(); g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shockTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.78, 'rgba(255,240,200,0)'); r.addColorStop(0.9, 'rgba(255,244,214,.9)'); r.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Sparks: thin blades of hot light thrown out from a blow, each lying along the way it flies with a bright point at its head,
// falling, skipping once on the stone and dying in half a second.
class Sparks {
  constructor(scene, tex, n = 220) {
    this.n = n; this.next = 0; this.floor = 0; this.k = 1;      // k: the size of those who fight (2 when he stands at Lankini's height)
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.tone = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.span = new Float32Array(n); this.wide = new Float32Array(n);
    this.bpos = new Float32Array(n * 12); this.bcol = new Float32Array(n * 12);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const bg = new THREE.BufferGeometry(), idx = []; for (let i = 0; i < n; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    bg.setIndex(idx); bg.setAttribute('position', new THREE.BufferAttribute(this.bpos, 3)); bg.setAttribute('color', new THREE.BufferAttribute(this.bcol, 3));
    const common = { vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false };
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ ...common, size: 0.075, map: tex, sizeAttenuation: true }));
    this.blades = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ ...common, side: THREE.DoubleSide }));
    this.points.frustumCulled = this.blades.frustumCulled = false; this.points.visible = this.blades.visible = false;
    scene.add(this.points, this.blades); this.busy = 0;
  }
  // at: where; count: how many; tone: [r, g, b]; speed: metres a second; (nx, nz): the way the blow was going; hot: 0..1, how many of them are white
  burst(at, count, tone, speed, nx = 0, nz = 0, hot = 0.25) {
    const K = this.k; this.points.material.size = 0.075 * K;
    for (let i = 0; i < count; i++) {
      const k = this.next++ % this.n, a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), v = speed * (0.35 + Math.random() * 1.25);
      this.pos[k * 3] = at.x; this.pos[k * 3 + 1] = at.y; this.pos[k * 3 + 2] = at.z;
      this.vel[k * 3] = Math.cos(a) * r * v + nx * speed * 0.55; this.vel[k * 3 + 1] = u * v + 2.4 * K; this.vel[k * 3 + 2] = Math.sin(a) * r * v + nz * speed * 0.55;
      const white = Math.random() < hot, w = 0.7 + Math.random() * 0.7;
      this.tone[k * 3] = (white ? 1 : tone[0]) * w; this.tone[k * 3 + 1] = (white ? 0.96 : tone[1]) * w; this.tone[k * 3 + 2] = (white ? 0.86 : tone[2]) * w;
      this.life[k] = this.span[k] = 0.2 + Math.random() * 0.42; this.wide[k] = (0.011 + Math.random() * 0.016) * K;
    }
    this.busy = 0.8; this.points.visible = this.blades.visible = true;
  }
  // eye: where the camera stands (each blade is turned to face it)
  update(dt, eye) {
    if (this.busy <= 0) return;
    this.busy -= dt;
    const { pos, vel, col, tone, life, span, wide, bpos, bcol } = this, ex = eye ? eye.x : 0, ey = eye ? eye.y : 50, ez = eye ? eye.z : 0;
    for (let k = 0; k < this.n; k++) {
      const j = k * 3, m = k * 12;
      if (life[k] > 0) {
        life[k] -= dt; vel[j + 1] -= 15 * dt;
        pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
        if (pos[j + 1] < this.floor + 0.03) { pos[j + 1] = this.floor + 0.03; vel[j + 1] *= -0.38; vel[j] *= 0.6; vel[j + 2] *= 0.6; }      // they skip once on the stone
        const f = Math.max(0, life[k] / span[k]), g = f * f;
        col[j] = tone[j] * g; col[j + 1] = tone[j + 1] * g; col[j + 2] = tone[j + 2] * g;
        // the blade: from the head back along the way it came, as long as it is fast; its width lies across the line of sight
        const vx = vel[j], vy = vel[j + 1], vz = vel[j + 2], tail = 0.05 * (0.4 + 0.6 * f), bx = pos[j] - vx * tail, by = pos[j + 1] - vy * tail, bz = pos[j + 2] - vz * tail;
        const dx = pos[j] - ex, dy = pos[j + 1] - ey, dz = pos[j + 2] - ez; let sx = vy * dz - vz * dy, sy = vz * dx - vx * dz, sz = vx * dy - vy * dx; const sl = Math.hypot(sx, sy, sz) || 1, w = wide[k] * (0.5 + 0.5 * f) / sl; sx *= w; sy *= w; sz *= w;
        bpos[m] = pos[j] + sx; bpos[m + 1] = pos[j + 1] + sy; bpos[m + 2] = pos[j + 2] + sz; bpos[m + 3] = pos[j] - sx; bpos[m + 4] = pos[j + 1] - sy; bpos[m + 5] = pos[j + 2] - sz;
        bpos[m + 6] = bx + sx * 0.15; bpos[m + 7] = by + sy * 0.15; bpos[m + 8] = bz + sz * 0.15; bpos[m + 9] = bx - sx * 0.15; bpos[m + 10] = by - sy * 0.15; bpos[m + 11] = bz - sz * 0.15;
        bcol[m] = bcol[m + 3] = col[j]; bcol[m + 1] = bcol[m + 4] = col[j + 1]; bcol[m + 2] = bcol[m + 5] = col[j + 2];
        for (let q = 6; q < 12; q++) bcol[m + q] = 0;
      } else { col[j] = col[j + 1] = col[j + 2] = 0; for (let q = 0; q < 12; q++) { bcol[m + q] = 0; bpos[m + q] = 0; } }
    }
    for (const o of [this.points, this.blades]) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; }
    if (this.busy <= 0) this.points.visible = this.blades.visible = false;
  }
}

// The arc a swing leaves behind it: a thin blade of light along the far end of the weapon, white at its leading edge and gone in a
// tenth of a second (Sid, 18 Nov: "not like these yellow lines passing": it was a wide pale fan the whole length of the weapon).
class Trail {
  constructor(scene, tone, n = 18, keep = 0.11, part = 0.3) {
    this.part = part;      // how much of the weapon's length, from its tip, leaves the arc
    this.n = n; this.keep = keep; this.tone = tone; this.pts = [];
    this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry(), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
  }
  add(tip, base) { const u = this.part; this.pts.unshift([tip.x, tip.y, tip.z, tip.x + (base.x - tip.x) * u, tip.y + (base.y - tip.y) * u, tip.z + (base.z - tip.z) * u, 0]); if (this.pts.length > this.n) this.pts.pop(); }
  clear() { this.pts.length = 0; this.mesh.visible = false; }
  update(dt) {
    const p = this.pts;
    for (const q of p) q[6] += dt;
    while (p.length && p[p.length - 1][6] > this.keep) p.pop();
    this.mesh.visible = p.length > 1; if (!this.mesh.visible) return;
    for (let i = 0; i < p.length; i++) {
      const q = p[i], j = i * 6, f = (1 - q[6] / this.keep) ** 2, hot = Math.max(0, 1 - q[6] / (this.keep * 0.35));      // hot: the newest stretch is white
      for (let k = 0; k < 6; k++) this.pos[j + k] = q[k];
      this.col[j] = (this.tone[0] + hot * 0.5) * f; this.col[j + 1] = (this.tone[1] + hot * 0.5) * f; this.col[j + 2] = (this.tone[2] + hot * 0.55) * f;
      this.col[j + 3] = this.tone[0] * f * 0.12; this.col[j + 4] = this.tone[1] * f * 0.12; this.col[j + 5] = this.tone[2] * f * 0.12;
    }
    this.mesh.geometry.setDrawRange(0, (p.length - 1) * 6);
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

export class Fight {
  // game: { scene, hero, gltf (the guard), sword (his sword's model), lankini (her model), sound, buzz, groundAt, shake(amount), slowMotion(secs, scale), more(what) }
  constructor(game) {
    Object.assign(this, game);
    const tex = dotTexture();
    this.sparks = new Sparks(this.scene, tex);
    this.flashes = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true })); s.visible = false; s.userData = { t: 0, secs: 1, size: 1 }; this.scene.add(s); return s; });
    // where metal meets metal: a star of light that leaps out and is gone, and a thin ring running out from it (both face the eye)
    { const star = flareTexture(), ring = shockTexture(), lit = { blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true };
      this.flares = [0, 1, 2].map(() => { const f = new THREE.Sprite(new THREE.SpriteMaterial({ ...lit, map: star })), r = new THREE.Sprite(new THREE.SpriteMaterial({ ...lit, map: ring })); f.visible = r.visible = false; f.userData = { t: 0, secs: 1, size: 1, ring: r }; this.scene.add(f, r); return f; }); }
    this.heroTrail = new Trail(this.scene, [1, 0.72, 0.28]);
    // the ring of light that runs out over the ground from the mace's great blow
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc860, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    this.ring.visible = false; this.ring.frustumCulled = false; this.scene.add(this.ring); this.blast = null;
    // his own health, over his head as theirs is over theirs: the same bar, green where theirs are red; not shown while a fall is held
    // (Sid, 18 Nov: "place the health bar of Hanuman as the other guards... do not show it in cinematic cuts... maybe in a different colour")
    const hb = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1a0d08, depthTest: false, fog: false, transparent: true, opacity: 0.85 })), hf = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x4fd872, depthTest: false, fog: false }));
    hb.renderOrder = 10; hf.renderOrder = 11; this.health = new THREE.Group(); this.health.add(hb, hf); this.health.visible = false; this.scene.add(this.health); this.hb = hb; this.hf = hf;
    const add = g => { g.trail = new Trail(this.scene, [1, 0.42, 0.24]); this.scene.add(g.root); return g; };
    this.guards = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(() => add(new Guard(this.gltf, this.sword)));      // ten: the ring that closes round him in the grove
    // Lankini fights with a great sword, in the guards' own way: far stronger, and she does not fall back from a light blow
    this.boss = add(new Guard(this.lankini, this.sword, { lux: true, armed: true, height: 3.6, sword: 0.6, kind: 'lankini',
      clips: { idle: 'sword_idle', walk: 'sword_walk', run: 'sword_run', attack: 'sword_slash', hit: 'sword_hit', death: 'knockback' } }));
    this.all = [...this.guards, this.boss];
    this.stick = { x: 0, y: 0 };      // the thumb stick: x to his right on the screen, y toward the player
    this.s = 1; this.focus = new THREE.Vector3(); this.active = false; this.over = null; this.result = null; this.lives = this.full = LIVES; this.mercy = false; this.freeze = 0; this.left = 0; this.hz = HZ;
    this.falls = 0; this.cineAt = 3; this.cine = null;      // how often he has been struck down, the fall that will be held next, and the view of it while it is held
  }

  get frozen() { return this.freeze > 0; }

  // mid: the middle of the floor, in metres along the route. plan: the waves (PLANS).
  // scale: how many times his own size he fights at (grown to meet Lankini): every distance of the fight grows with him
  begin(mid, plan = PLANS.court, scale = 1) {
    this.s = scale; this.hz = HZ * (scale > 1 ? 1.5 : 1);      // grown, they need a longer floor: a blow throws him further
    const hero = this.hero, p = hero.root.position;
    this.cz = -mid; this.plan = plan; this.active = true; this.over = null; this.result = null; this.overT = 0; this.full = plan[0].lives || LIVES; this.lives = this.full; this.mercy = !!plan[0].mercy; this.freeze = 0; this.falls = 0; this.cineAt = plan === PLANS.gate ? 1 : 3; this.cine = null;      // against Lankini the very first fall is the one that is held: it opens the game
    this.t = 0; this.wave = 0; this.nextT = 0; this.used = 0;
    this.h = { act: null, t: 0, len: 0, strikeAt: 0, struck: false, heavy: false, combo: 0, comboT: 0, queued: false, safe: 0, dodgeCd: 0, vx: 0, vz: 0, fx: 0, fz: -1, reach: 0, dmg: 1, slam: false, down: 0, up: 0, epic: false, roared: false };
    hero.free = true; hero.pace = 0; hero.slide = 0; hero.busy = 0; hero.floor = 0;
    this.sparks.floor = this.groundAt(this.cz); this.sparks.k = this.s || 1;
    for (const g of this.guards) g.reset();
    if (!plan.some(w => w.foes.includes('lankini'))) this.boss.reset();
    this.send();
    this.focus.copy(p);
  }

  // The next wave comes in: the first three from ahead, any more from behind him as well, so he is ringed.
  send() {
    const w = this.rules = this.plan[this.wave++];
    for (const g of this.all) if (g.st === 'dead' && !g.k.stays) g.t = Math.max(g.t, 3);      // the fallen of the wave before sink away now
    this.left = w.foes.length; this.cool = 1.6;
    w.foes.forEach((kind, i) => {
      const boss = kind === 'lankini', g = boss ? this.boss : this.guards[this.used++], front = i < 3, k = front ? i - 1 : i - 3.5;
      const stood = boss && g.root.visible ? g.root.position.clone() : null, yaw = g.yaw;      // she is already standing in his way, from the scene before
      g.kind(kind); g.reset(); g.root.visible = true; g.showHp();
      if (stood) { g.root.position.copy(stood); g.yaw = yaw; g.root.rotation.y = yaw; g.st = 'ready'; g.angle = 0; }
      else {
        g.root.position.set(k * 2.3, 0, front ? this.cz - HZ - 8 - (i === 1 ? 0 : 2.6) : this.cz + HZ + 7); g.root.position.y = this.groundAt(g.root.position.z);
        g.yaw = front ? 0 : Math.PI; g.root.rotation.y = g.yaw; g.st = 'enter'; g.angle = front ? k * 0.9 : Math.PI + k * 1.1;
      }
      g.wob = i * 2.1; g.play(stood ? g.clips.idle : g.clips.run, { fade: stood ? 0.2 : 0 });
    });
    if (this.wave > 1 && this.more) this.more(w.foes.includes('captain') ? 'captain' : 'more');
  }

  // Everything put away: a new run, or back to the title.
  clear() {
    this.active = false; this.over = null; this.result = null; this.nextT = 0; this.stick.x = this.stick.y = 0; this.cine = null; this.blast = null; this.ring.visible = false; this.health.visible = false;
    for (const g of this.all) { g.reset(); g.trail.clear(); }
    this.heroTrail.clear(); this.hero.free = false; this.hero.root.rotation.y = 0;
  }

  nearest(p, within) {
    let best = null, bd = within;
    for (const g of this.all) { if (g.st === 'dead' || !g.root.visible || g.st === 'idle') continue; const d = Math.hypot(g.root.position.x - p.x, g.root.position.z - p.z); if (d < bd) { bd = d; best = g; } }
    return best;
  }

  flash(at, tone, size, secs = 0.12) {
    const s = this.flashes.find(f => !f.visible) || this.flashes[0];
    s.position.copy(at); s.material.color.setRGB(tone[0], tone[1], tone[2]); s.userData.t = 0; s.userData.secs = secs; s.userData.size = size; s.visible = true; s.scale.setScalar(size * 0.6);
  }

  // The star of light of a blow that meets steel or strikes home. size: metres across at its fullest.
  flare(at, tone, size, secs = 0.2) {
    const f = this.flares.find(x => !x.visible) || this.flares[0], u = f.userData, r = u.ring;
    f.position.copy(at); r.position.copy(at); f.material.color.setRGB(tone[0], tone[1], tone[2]); r.material.color.setRGB(tone[0], tone[1], tone[2]);
    u.t = 0; u.secs = secs; u.size = size; f.material.rotation = Math.random() * Math.PI; f.visible = r.visible = true; f.scale.setScalar(size * 0.5); r.scale.setScalar(size * 0.2); f.material.opacity = r.material.opacity = 1;
  }

  // ── what the player does ──
  attack() {
    const h = this.h; if (!this.active || this.over) return false;
    if (this.hero.airborne) { if (h.slam) return false; h.slam = true; h.act = null; this.hero.vy = -17; return true; }      // struck from the air: he comes down on them with the mace
    if (h.act === 'attack') { if (h.t > 0.1) h.queued = true; return true; }      // pressed again in mid swing: the next blow follows on
    if (h.act) return false;                                                       // rolling or reeling
    const hero = this.hero, p = hero.root.position, s = this.stick, m = Math.hypot(s.x, s.y);
    h.combo = h.comboT > 0 && h.combo < 3 ? h.combo + 1 : 1;
    const S = this.s, g = this.nearest(p, 5.2 * S);
    h.vx = h.vz = 0;
    if (g) {      // he turns on the nearest of them and closes the distance, as fighting games do
      const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz));
      h.fx = dx / d; h.fz = dz / d;
      const go = Math.min(2.2 * S, Math.max(0, d - (g.k.boss ? 3.0 : 1.55 * S))); h.vx = h.fx * go * 11; h.vz = h.fz * go * 11;      // he is beside his man by the time the blow lands: it counts only where it is seen to reach
    } else if (m > 0.15) { h.fx = s.x / m; h.fz = s.y / m; }
    h.heavy = h.combo === 3; h.act = 'attack'; h.t = 0; h.struck = false; h.queued = false;
    if (h.heavy) { hero.play('great_sword_slash', { once: true, from: 0.45, speed: 1.25, fade: 0.06 }); h.strikeAt = 0.22; h.len = 0.62; h.reach = 2.45 * S; h.dmg = 2; }      // the third blow of a row is the great one
    else { hero.play('mutant_punch', { once: true, from: 0.1, speed: 1.3, fade: 0.05 }); h.strikeAt = 0.15; h.len = 0.4; h.reach = 2.0 * S; h.dmg = 1; }
    this.sound.fx('slide', { rate: h.heavy ? 1.5 : 2.1, gap: 0.04 }); if (h.heavy) this.sound.hit('surge1');      // the great swing is heard coming
    return true;
  }

  dodge() {
    const h = this.h; if (!this.active || this.over || h.dodgeCd > 0 || h.act === 'hurt') return false;
    const s = this.stick, m = Math.hypot(s.x, s.y);
    const dx = m > 0.2 ? s.x / m : -h.fx, dz = m > 0.2 ? s.y / m : -h.fz;      // no direction held: away from what he is facing
    h.act = 'dodge'; h.t = 0; h.len = 0.46; h.queued = false; h.safe = Math.max(h.safe, 0.4); h.dodgeCd = 0.7;
    h.vx = dx * 11 * this.s; h.vz = dz * 11 * this.s; h.fx = dx; h.fz = dz;
    this.hero.play('sprinting_forward_roll', { once: true, from: 0.2, speed: 1.55, fade: 0.06 });
    this.sound.fx('slide', { rate: 1.2, gap: 0.04 });
    return true;
  }

  // A leap: over a blade swung low, and into a blow from above if he strikes in the air.
  jump() {
    const h = this.h; if (!this.active || this.over || h.act === 'hurt' || h.act === 'dodge') return false;
    if (!this.hero.leap()) return false;
    h.act = null; h.queued = false; this.sound.fx('leap'); return true;
  }

  // The mace charged with all his strength: he brings it down, a ring of light runs out from him over the ground, and
  // each of them is thrown back as it reaches him. (Sid: "hanuman does something and at a distance the guards fall even
  // without hitting them": they fell all at once, eight metres off, with nothing seen to touch them.)
  special() {
    if (!this.active || this.over || this.blast) return false;
    const p = this.hero.root.position, R = 5.5 * this.s;
    if (!this.all.some(g => g.st !== 'dead' && g.root.visible && Math.hypot(g.root.position.x - p.x, g.root.position.z - p.z) < R)) return false;
    // he whirls the mace round him in one great sweep (a move of his that the fights had not used), and the ring
    // leaves him as the sweep begins; nothing can touch him while it lasts
    const h = this.h; if (h.act !== 'hurt' && !this.hero.airborne) { h.act = 'power'; h.t = 0; h.len = 0.78; h.vx = h.vz = 0; h.queued = false; h.safe = Math.max(h.safe, 0.85);
      this.hero.play('great_sword_high_spin_attack', { once: true, from: 0.36, speed: 1.7, fade: 0.06 }); }
    this.blast = { t: -0.12, x: p.x, z: p.z, R, speed: 17 * this.s, done: new Set() };
    this.ring.position.set(p.x, this.groundAt(p.z) + 0.09, p.z); this.ring.scale.setScalar(0.1); this.ring.material.opacity = 1; this.ring.visible = true;
    _a.set(p.x, p.y + 0.4 * this.s, p.z); this.sparks.burst(_a, 60, GOLD, 11 * this.s); this.flash(_a, GOLD, 4, 0.22);
    this.freeze = 0.1; this.shake(0.6); this.sound.hit('surge3');
    return true;
  }

  // ── blows landing ──
  heroStrike() {
    const h = this.h, p = this.hero.root.position; let hit = 0;
    for (const g of this.all) {
      if (g.st === 'dead' || !g.root.visible) continue;
      const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz));
      if (d > h.reach + (g.k.boss ? 1.0 : 0) || (!this.round && (dx * h.fx + dz * h.fz) / d < 0.3)) continue;      // in reach and in front of him
      hit++; this.hurt(g, h.dmg, dx / d, dz / d, h.heavy);
    }
    if (hit) {
      this.freeze = h.heavy ? 0.11 : 0.06; this.shake(h.heavy ? 0.45 : 0.24); this.buzz(h.heavy ? [30, 20, 60] : 25);
      this.sound.fx(h.heavy ? 'smash' : 'hit', { rate: h.heavy ? 1 : 1.25, gap: 0.04 }); if (h.heavy) this.sound.hit('surge2'); h.comboT = 0.85;      // a great blow lands on the fight music's own drum
    } else h.comboT = 0.5;
  }

  hurt(g, dmg, nx, nz, heavy) {
    const gp = g.root.position, clash = g.st === 'windup' && !g.struck, high = g.k.boss ? g.tall * 0.6 : 1.3;      // clash: the blow was already coming, mace meets steel
    _a.set(gp.x - nx * 0.45, gp.y + high, gp.z - nz * 0.45);
    // a guard standing ready sometimes turns the first blow of a row aside on his sword: sparks, no hurt, and he is driven back a step
    if (!heavy && !g.lux && g.st === 'ready' && this.h.combo === 1 && Math.random() < 0.25) {
      this.sparks.burst(_a, 30, WHITE, 8, -nx, -nz, 0.7); this.flare(_a, WHITE, 1.7 * (this.s || 1), 0.2); this.flash(_a, WHITE, 0.8); this.sound.fx('tap', { rate: 1.6, gap: 0.03 });
      g.vx = nx * 3.5; g.vz = nz * 3.5; g.play(g.clips.hit, { once: true, from: 0.1, speed: 2.2, fade: 0.05 }); g.st = 'hurt'; g.t = 0.25;
      return;
    }
    const K = this.s || 1;      // mace on steel throws the most and the whitest; a blow that lands on a body is gold
    this.sparks.burst(_a, heavy ? 46 : clash ? 44 : 24, clash ? WHITE : GOLD, (heavy ? 10.5 : clash ? 9.5 : 6.5) * (0.6 + 0.4 * K), nx, nz, clash ? 0.7 : heavy ? 0.4 : 0.25);
    this.flare(_a, clash ? WHITE : GOLD, (heavy ? 2.5 : clash ? 2.3 : 1.35) * K, clash || heavy ? 0.24 : 0.17);
    this.flash(_a, clash ? WHITE : GOLD, (heavy ? 1.4 : 0.9) * K, 0.1);
    g.hp -= dmg; g.showHp();
    // Lankini is not driven back by a great blow: she takes it and comes on. Only when enough of them have told on her is she stopped for a moment, where she stands.
    // (Sid: "even when i strike lankini the stroke is not hit and she does not react": she took six blows without a sign. Now every
    // blow that lands rocks her where she stands, and a full row of three makes her reel.)
    if (g.k.boss && g.hp > 0) { g.poise += dmg; if (g.poise < 3 || g.st === 'windup') { g.vx = nx * 1.2; g.vz = nz * 1.2; this.flinch(g, nx, nz, heavy); return; } g.poise = 0; }
    // a light blow does not stop a sword that is already falling, nor one of the firm ones at any time: get clear, or land the great blow
    if (!heavy && g.hp > 0 && (clash || g.k.firm)) { g.vx = nx * 1.5; g.vz = nz * 1.5; this.flinch(g, nx, nz, false); return; }
    g.t = 0; g.struck = false; g.second = false;
    if (g.token) { g.token = false; this.cool = this.rules.rest + Math.random() * 0.4; }
    const push = (heavy ? 9 : 5) * (g.k.boss ? 0.12 : g.k.firm ? 0.45 : 1) * this.s; g.vx = nx * push; g.vz = nz * push;
    if (g.hp <= 0) {
      g.st = 'dead'; g.play(g.clips.death, { once: true, fade: 0.08, speed: 1.15 });
      if (--this.left === 0) {
        if (this.wave < this.plan.length) this.nextT = 1.4;      // a breath, and the next wave is on him
        else { this.over = 'won'; this.overT = 1.9; this.slowMotion(1.3, 0.28); }      // the last one of all falls slowly
      }
    } else { g.st = 'hurt'; g.play(g.clips.hit, { once: true, fade: 0.05, ...g.hitPlay }); }
  }

  // A blow that lands and does not throw its man back is still seen to land: his body rocks away from it and comes
  // upright again, without a step of his fight being changed (a sword already falling still falls).
  flinch(g, nx, nz, heavy) {
    const fwd = nx * Math.sin(g.yaw) + nz * Math.cos(g.yaw), right = nx * Math.cos(g.yaw) - nz * Math.sin(g.yaw);
    g.rock = { t: 0, x: fwd * (heavy ? 0.34 : 0.24), z: -right * (heavy ? 0.34 : 0.24) };
  }

  // A blow lands on him: he is thrown backward off his feet and lands on his back, lies a moment, and springs up; nothing
  // can touch him until he is standing, and those who fight him hold off until then. The fall that is held (the first
  // against Lankini, every third to sixth after) is slow and seen from close; he rises with a roar and his next blow
  // is the great one.
  hitHero(g) {
    const h = this.h; if (h.safe > 0 || this.over || this.hero.y > 0.55) return false;      // in the air the blade passes under him
    const hero = this.hero, p = hero.root.position, gp = g.root.position, d = Math.max(0.01, Math.hypot(p.x - gp.x, p.z - gp.z));
    this.lives -= g.k.wound; this.falls++;
    const epic = this.lives > 0 && this.falls >= this.cineAt;
    h.act = 'hurt'; h.t = 0; h.len = 9; h.down = 0; h.up = 0; h.epic = epic; h.roared = false; h.queued = false; h.combo = 0; h.slam = false; h.safe = 9; this.cool = Math.max(this.cool, epic ? 5.4 : 2.4);
    const push = (g.k.wound > 1 || g.k.boss ? 8 : 6) * this.s; h.vx = (p.x - gp.x) / d * push; h.vz = (p.z - gp.z) / d * push;
    h.fx = (gp.x - p.x) / d; h.fz = (gp.z - p.z) / d;      // thrown back with his face to the one who struck him
    hero.play(FALL.clip, { once: true, speed: FALL.speed, fade: 0.08 });
    for (const o of this.all) { o.second = true; if (o !== g && o.st === 'approach') { o.st = 'ready'; o.token = false; } }      // nobody strikes at a man on the ground
    if (epic) {
      this.cineAt = this.falls + 3 + Math.floor(Math.random() * 4);
      this.cine = { cut: true, from: g, side: 0, at: new THREE.Vector3(), look: new THREE.Vector3(), keep: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] };
      this.slowMotion(1.7, 0.24); this.cineView();
    }
    _a.set(p.x, p.y + 1.2 * this.s, p.z); this.sparks.burst(_a, 18 * g.k.wound, RED, 6 * this.s); this.flash(_a, RED, 2 * g.k.wound);
    this.freeze = 0.08; this.shake(0.4 + 0.2 * g.k.wound); this.buzz([60, 30, 60]); this.sound.fx('hit', { rate: 0.8, gap: 0.04 });
    if (this.lives <= 0) { this.lives = 0; this.over = 'lost'; this.overT = 1.5; }
    return true;
  }

  // Where the view of the held fall stands, worked out the instant the blow lands and on every frame after (also while
  // the fight is frozen for the blow): a view that is not yet worked out when it is first used shows the world from
  // its origin, under the road.
  cineView() {
    const c = this.cine; if (!c) return;
    const hero = this.hero, h = this.h, p = hero.root.position, S = this.s;
    // The held moment, in one shot that goes with him: close, low, from his front and a little to one side, so the
    // fall itself fills the picture. It follows his body (hips, head and feet, wherever the fall has put them), never
    // leaves the paved road (the braziers and stalls along its edge would stand in front of the lens) and is never far off.
    const q = c.from.root.position, fx = q.x - p.x, fz = q.z - p.z, fd = Math.max(0.01, Math.hypot(fx, fz)), ux = fx / fd, uz = fz / fd;
    const B = this.bones || (this.bones = ['Hips', 'Head', 'LeftFoot', 'RightFoot'].map(n => hero.model.getObjectByName('mixamorig' + n)));
    B.forEach((bone, i) => { bone.getWorldPosition(_b); c.keep[i][0] = _b.x; c.keep[i][1] = _b.y + (i === 1 ? 0.3 * S : 0); c.keep[i][2] = _b.z; });      // all of him stays in the picture
    const hx = c.keep[0][0], hy = c.keep[0][1], hz = c.keep[0][2], rise = h.up ? Math.min(1, (h.t - h.up) / 1.2) : 0;
    if (!c.side) c.side = Math.abs(p.x - uz * 3) < Math.abs(p.x + uz * 3) ? 1 : -1;      // the side nearer the middle of the road
    const D = (1.5 + 1.25 * S) * (1 - 0.15 * rise), across = 0.86 * c.side;
    c.at.set(Math.max(-3.2, Math.min(3.2, hx + ux * D * 0.5 - uz * D * across)), p.y + (0.35 + 0.3 * rise) * S, hz + uz * D * 0.5 + ux * D * across);
    c.look.set(hx, hy + 0.1 * S, hz);

    c.ready = true;
  }

  // His sword goes up (or her fist goes back): a glint and a sound warn the player before the blow comes down.
  raise(g, tell) {
    g.st = 'windup'; g.t = 0; g.struck = false;
    g.play(g.clips.attack, { once: true, fade: 0.1, from: Math.max(0, g.blowAt - tell), speed: g.blowAt < tell ? g.blowAt / tell : 1 });
    g.swordEnds(_a, _b); this.flash(_a, RED, g.k.boss ? 2.4 : 1.5, 0.3); this.sound.fx('tap', { rate: 0.6, gap: 0.05 });
  }

  // ── every frame of the fight. dt: game time; real: clock time (the fight's short freezes are in clock time) ──
  // His bar: over his head, as wide as the bar of the one he fights (Lankini's when he has grown to meet her).
  healthBar() {
    const on = this.active && !this.cine && this.lives > 0; this.health.visible = on; if (!on) return;
    const p = this.hero.root.position, S = this.s, big = S > 1.5, wide = big ? 2.2 : 0.9;
    this.health.position.set(p.x, p.y + HIGH * S + 0.42, p.z);
    this.hb.scale.set(wide, big ? 0.16 : 0.1, 1); this.hf.scale.set((wide - 0.04) * this.lives / this.full, big ? 0.11 : 0.06, 1);
  }

  update(dt, real) {
    if (!this.active) return;
    if (this.over) { this.overT -= real; if (this.overT <= 0) { this.active = false; this.result = this.over; this.health.visible = false; return; } }
    this.healthBar();
    if (this.freeze > 0) { this.freeze -= real; this.cineView(); return; }      // the instant a blow lands, everything holds
    const hero = this.hero, h = this.h, p = hero.root.position, s = this.stick, m = Math.hypot(s.x, s.y);
    h.comboT -= dt; h.safe -= dt; h.dodgeCd -= dt;
    if (this.blast) {      // the ring runs out, and throws back each of them as it reaches him
      const b = this.blast; b.t += dt; const r = Math.min(b.R, Math.max(0, b.t) * b.speed);
      for (const g of this.all) {
        if (b.done.has(g) || g.st === 'dead' || !g.root.visible) continue;
        const dx = g.root.position.x - b.x, dz = g.root.position.z - b.z, d = Math.max(0.01, Math.hypot(dx, dz));
        if (d <= r) { b.done.add(g); this.hurt(g, 2, dx / d, dz / d, true); }
      }
      this.ring.scale.setScalar(Math.max(0.1, r)); this.ring.material.opacity = 1 - (r / b.R) ** 2 * 0.85;
      if (r >= b.R) { this.blast = null; this.ring.visible = false; }
    }
    const S = this.s;
    if (h.slam && !hero.airborne) {      // down out of the air, mace first: all of them round him feel it
      h.slam = false; h.heavy = true; h.dmg = 2; h.reach = 2.9 * S; this.round = true; this.heroStrike(); this.round = false;
      _a.set(p.x, p.y + 0.25, p.z); this.sparks.burst(_a, 44, GOLD, 9 * S); this.flash(_a, GOLD, 3.2 * S, 0.2); this.shake(0.55); this.sound.fx('smash', { gap: 0.04 }); this.sound.hit('surge3');
    }
    if (h.act) {
      h.t += dt;
      p.x += h.vx * dt; p.z += h.vz * dt; const drag = Math.exp(-dt * (h.act === 'dodge' ? 2.2 : h.act === 'hurt' && !h.down ? 2.5 : h.act === 'attack' ? 11 : 9)); h.vx *= drag; h.vz *= drag;
      if (h.act === 'hurt') {
        if (!h.down && h.t * FALL.speed >= FALL.land) {      // he comes down on his back
          h.down = h.t;
          _a.set(p.x, p.y + 0.15, p.z); this.sparks.burst(_a, 18, WHITE, 5 * S); this.shake(0.4); this.buzz(40); this.sound.fx('stone', { rate: 1.3, gap: 0.1 });
        }
        if (h.down && !h.up && h.t >= h.down + (h.epic ? 0.75 : 0.22)) {      // a moment on the ground, and he springs to his feet
          const speed = h.epic ? KIP.slow : KIP.speed; h.up = h.t; h.len = h.t + (KIP.end - KIP.from) / speed - 0.06 + (h.epic ? 1.2 : 0);
          hero.play(KIP.clip, { once: true, from: KIP.from, speed, fade: 0.12 });
        }
        if (h.epic && h.up && !h.roared && h.t >= h.up + (KIP.end - KIP.from) / KIP.slow - 0.12) {      // on his feet, and he roars
          h.roared = true; hero.play('mutant_roaring', { once: true, from: 1.0, speed: 1.35, fade: 0.2 });
          _a.set(p.x, p.y + 1.2 * S, p.z); this.sparks.burst(_a, 50, GOLD, 9 * S); this.flash(_a, GOLD, 4 * S, 0.3); this.shake(0.5); this.buzz([40, 30, 120]); this.sound.fx('power', { gap: 0.2 });
        }
      }
      if (h.act === 'attack') {
        if (h.t > h.strikeAt - 0.13 && h.t < h.strikeAt + 0.12 && hero.maceEnds(_a, _b)) this.heroTrail.add(_a, _b);
        if (!h.struck && h.t >= h.strikeAt) { h.struck = true; this.heroStrike(); }
      }
      if (h.t >= h.len) {
        if (h.act === 'hurt') { h.safe = 0.8; if (h.epic) { h.epic = false; h.combo = 2; h.comboT = 2.5; this.cine = null; } }      // a breath's mercy as he rises; after the roar his next blow is the great one
        const again = h.queued; h.act = null; h.queued = false; if (again) this.attack();
      }
    }
    if (!h.act) {
      if (m > 0.15) {
        const k = Math.min(1, m); p.x += s.x / m * k * PACE * S * dt; p.z += s.y / m * k * PACE * S * dt; h.fx = s.x / m; h.fz = s.y / m;
        if (!hero.airborne) hero.play('fast_run', { speed: 0.7 + 0.22 * k, fade: 0.12 }); hero.pace = PACE * k;
      } else {
        if (!hero.airborne) hero.play('great_sword_idle', { fade: 0.18 }); hero.pace = 0;
        const g = this.nearest(p, 7 * S);      // standing still, he keeps his eyes on the nearest of them
        if (g) { const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz)); h.fx += (dx / d - h.fx) * Math.min(1, dt * 6); h.fz += (dz / d - h.fz) * Math.min(1, dt * 6); }
      }
    }
    p.x = Math.max(-HX, Math.min(HX, p.x)); p.z = Math.max(this.cz - this.hz, Math.min(this.cz + this.hz, p.z));
    this.cineView();
    const yaw = Math.atan2(-h.fx, -h.fz); hero.root.rotation.y += wrap(yaw - hero.root.rotation.y) * Math.min(1, dt * (h.act ? 26 : 14));

    const alive = this.all.filter(g => g.root.visible && g.st !== 'dead' && g.st !== 'idle');
    if (this.nextT > 0) { this.nextT -= dt; if (this.nextT <= 0) this.send(); }
    this.cool -= dt;
    const coming = alive.filter(g => g.token).length, spared = this.mercy && this.lives <= 1;      // spared: on his last life in a fight that is not to be lost, nobody begins a blow
    if (coming < this.rules.most && this.cool <= 0 && !this.over && !spared) {      // only so many come at him at a time; the others hold the ring
      const ready = alive.filter(g => g.st === 'ready');
      if (ready.length) {
        const g = ready.reduce((a, b) => Math.hypot(a.root.position.x - p.x, a.root.position.z - p.z) + Math.random() < Math.hypot(b.root.position.x - p.x, b.root.position.z - p.z) + Math.random() ? a : b);
        g.st = 'approach'; g.t = 0; g.token = true; g.second = false; this.cool = this.rules.rest + Math.random() * 0.5;
      }
    }
    let cx = 0, czs = 0;
    for (const g of alive) {
      const gp = g.root.position, k = g.k, TELL = this.rules.tell + k.tell, near = k.boss ? 3.7 : 2.05 * S, body = (k.boss ? 1.2 : 1.15) * S; g.t += dt;
      const dx = p.x - gp.x, dz = p.z - gp.z, d = Math.max(0.01, Math.hypot(dx, dz)), toHero = Math.atan2(dx, dz);
      gp.x += g.vx * dt; gp.z += g.vz * dt; const drag = Math.exp(-dt * 8); g.vx *= drag; g.vz *= drag;
      cx += gp.x; czs += gp.z;
      if (g.st === 'hurt') {
        g.turn(toHero, dt);
        if (g.t > 0.5) {      // on his feet again: often he answers at once, if no other is already coming
          g.st = 'ready'; g.t = 0;
          if (coming < this.rules.most && !this.over && !spared && this.cool <= (k.boss ? 0 : 9) && d < near + 1.2 && Math.random() < (k.boss ? 1 : 0.3)) { g.st = 'approach'; g.token = true; g.second = false; }
        }
      } else if (g.st === 'enter' || g.st === 'ready') {
        if (k.boss) {      // Lankini keeps no distance and gives no ground: between her blows she comes on at a walk
          const v = d > near + 0.5 && h.act !== 'hurt' ? 2.5 * S : 0;      // (she stands while he is down)
          if (v > 0) { gp.x += dx / d * v * dt; gp.z += dz / d * v * dt; }
          g.play(v > 0 ? g.clips.walk : g.clips.idle, { fade: 0.2 }); g.turn(toHero, dt, 8);
          if (g.st === 'enter') { g.st = 'ready'; g.t = 0; }
        } else {
        // each holds his own bearing round him, eased apart from the others, drifting a little so the ring is never still
        for (const o of alive) { if (o === g) continue; const diff = wrap(g.angle - o.angle); if (Math.abs(diff) < 0.95) g.angle += Math.sign(diff || 1) * (0.95 - Math.abs(diff)) * dt * 2.2; }
        g.angle += Math.sin(this.t * 0.55 + g.wob) * 0.22 * dt;
        const ring = (RING + (k.boss ? 0.8 : 0)) * S, tx = Math.max(-HX, Math.min(HX, p.x + Math.sin(g.angle) * ring)), tz = Math.max(this.cz - this.hz - 1.5, Math.min(this.cz + this.hz + 0.5, p.z - Math.cos(g.angle) * ring));
        const ex = tx - gp.x, ez = tz - gp.z, e = Math.hypot(ex, ez), v = (e > 4 * S ? 5.4 : e > 0.4 ? 2.3 : 0) * Math.min(1.2, k.pace) * S;
        if (v > 0) { gp.x += ex / e * v * dt; gp.z += ez / e * v * dt; }
        g.play(v > 3 * S ? g.clips.run : v > 0 ? g.clips.walk : g.clips.idle, { fade: 0.2 });
        g.turn(v > 3 * S ? Math.atan2(ex, ez) : toHero, dt, 8);
        if (g.st === 'enter' && d < ring + 1.6) { g.st = 'ready'; g.t = 0; }
        }
      } else if (g.st === 'approach') {
        if (d > near) { gp.x += dx / d * 4.6 * k.pace * S * dt; gp.z += dz / d * 4.6 * k.pace * S * dt; g.play(g.clips.run, { fade: 0.15 }); }
        g.turn(toHero, dt, 12);
        if (d <= near || g.t > 2.4) {
          if (d < near + 1.4 * S) this.raise(g, TELL);
          else { g.st = 'ready'; g.t = 0; g.token = false; this.cool = 0.4; }      // he could not reach him: back to the ring
        }
      } else if (g.st === 'windup') {
        if (g.t < TELL - 0.25) g.turn(toHero, dt, 12);                    // he commits to where the player was a quarter of a second before the blow
        else if (g.t < TELL && d > body) { gp.x += Math.sin(g.yaw) * 3.4 * S * dt; gp.z += Math.cos(g.yaw) * 3.4 * S * dt; }      // and steps into it, never through him
        if (g.t > TELL - 0.16 && g.t < TELL + 0.14) { g.swordEnds(_a, _b); g.trail.add(_a, _b); }
        if (!g.struck && g.t >= TELL) {
          g.struck = true; this.sound.fx('slide', { rate: k.boss ? 1.1 : 1.7, gap: 0.04 });
          const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw), hx = p.x - gp.x, hz = p.z - gp.z, hd = Math.max(0.01, Math.hypot(hx, hz));
          if (hd < k.reach && (hx * fx + hz * fz) / hd > 0.42) this.hitHero(g);
          else if (k.boss) { _a.set(gp.x + fx * 3.8, gp.y + 0.2, gp.z + fz * 3.8); this.sparks.burst(_a, 22, WHITE, 7); this.shake(0.3); }      // her sword comes down on the stone
        }
        if (k.twice && !g.second && g.t >= TELL + 0.3) { g.second = true; this.raise(g, Math.max(0.42, TELL - 0.12)); }      // the captain's second blow follows the first
        else if (g.t >= TELL + 0.55) { g.st = 'ready'; g.t = 0; g.token = false; }
      }
      if (d < body) {      // bodies are solid: nobody stands in or passes through another. She is not moved by him, nor is one whose blow is already coming; the rest give way with him
        const over = body - d;
        if (k.boss || g.st === 'windup') { p.x += dx / d * over; p.z += dz / d * over; }
        else { gp.x -= dx / d * over * 0.6; gp.z -= dz / d * over * 0.6; p.x += dx / d * over * 0.4; p.z += dz / d * over * 0.4; }
      }
      // they keep to the paved road, as he does: beside it stand the braziers and stalls, and one who waits there is hidden behind them
      gp.x = Math.max(-HX, Math.min(HX, gp.x)); if (g.st !== 'enter') gp.z = Math.max(this.cz - this.hz - 2.5, Math.min(this.cz + this.hz + 0.5, gp.z)); gp.y = this.groundAt(gp.z);
    }
    p.x = Math.max(-HX, Math.min(HX, p.x)); p.z = Math.max(this.cz - this.hz, Math.min(this.cz + this.hz, p.z));
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {      // nor inside one another
      const a = alive[i].root.position, b = alive[j].root.position, dx = b.x - a.x, dz = b.z - a.z, d = Math.max(0.01, Math.hypot(dx, dz));
      if (d < 1.5) { const k = (1.5 - d) / 2; a.x -= dx / d * k; a.z -= dz / d * k; b.x += dx / d * k; b.z += dz / d * k; }
    }
    this.t += dt;
    // what the view should hold: him, leaning a little toward those who are left
    const n = alive.length; _a.copy(p);
    if (n) { _a.x += Math.max(-2, Math.min(2, (cx / n - p.x) * 0.3)); _a.z += Math.max(-0.5, Math.min(0.5, (czs / n - p.z) * 0.2)); }
    this.focus.lerp(_a, Math.min(1, dt * 5));
  }

  // Sparks, flashes, trails and the fighters' own movement: these run on whenever anything of the fight is in view.
  tick(dt, real) {
    this.sparks.update(real, this.camera && this.camera.position); this.heroTrail.update(real);
    for (const f of this.flares) { if (!f.visible) continue; const u = f.userData, r = u.ring; u.t += real; const k = u.t / u.secs; if (k >= 1) { f.visible = r.visible = false; continue; }
      const up = Math.min(1, k * 7), out = 1 - k; f.scale.setScalar(u.size * (0.5 + 0.5 * up) * (0.55 + 0.45 * out)); f.material.opacity = out * out; f.material.rotation += real * 1.2;
      r.scale.setScalar(u.size * (0.2 + 1.1 * Math.sqrt(k))); r.material.opacity = 0.75 * out * out; }
    for (const s of this.flashes) { if (!s.visible) continue; const u = s.userData; u.t += real; const k = u.t / u.secs; if (k >= 1) { s.visible = false; continue; } s.scale.setScalar(u.size * (0.6 + 0.6 * k)); s.material.opacity = 1 - k * k; }
    const hold = this.freeze > 0 ? 0 : dt;
    for (const g of this.all) {
      g.trail.update(real); if (!g.root.visible) continue;
      g.mixer.update(hold);
      if (g.rock) { const r = g.rock; r.t += hold; const u = r.t / 0.34, k = u >= 1 ? 0 : Math.min(1, u * 7) * (1 - u) * (1 - u); g.body.rotation.x = g.lean0[0] + r.x * k; g.body.rotation.z = g.lean0[1] + r.z * k; if (u >= 1) g.rock = null; }
      if (g.st === 'dead') {      // thrown back by the blow, down, and after a moment sinking away (Lankini stays where she fell)
        const gp = g.root.position; g.t += hold; gp.x += g.vx * hold; gp.z += g.vz * hold; const drag = Math.exp(-hold * 8); g.vx *= drag; g.vz *= drag;
        if (g.t > 3 && !g.k.stays) { gp.y -= hold * 0.7; if (g.t > 4.3) g.root.visible = false; }
      }
    }
  }
}
