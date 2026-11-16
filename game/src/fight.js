// The fight in the palace court: the run stops, three guards with swords come in, and the player moves Hanuman
// freely with a thumb stick, strikes with the mace and rolls clear. When the last guard is down the run goes on.
// This file holds the rules of the fight and what it throws into the air: sparks, flashes and the trails of swings.
import * as THREE from 'three';
import { Guard } from './guard.js';

const HX = 3.7, HZ = 9;                 // the floor it is fought on: half its width (the paved road) and half its length
export const LIVES = 4;
const PACE = 5.8;                       // how fast he moves under the stick, metres a second
const RING = 3.1;                       // how far the guards who are waiting stand off from him
const TELL = 0.65;                      // seconds from a guard raising his sword to the blow landing: the time to get clear
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

// Sparks: bright points with a short streak behind each, thrown out from a blow, falling and dying in half a second.
class Sparks {
  constructor(scene, tex, n = 200) {
    this.n = n; this.next = 0; this.floor = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.tone = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.span = new Float32Array(n);
    this.lpos = new Float32Array(n * 6); this.lcol = new Float32Array(n * 6);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(this.lpos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(this.lcol, 3));
    const common = { vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false };
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ ...common, size: 0.17, map: tex, sizeAttenuation: true }));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial(common));
    this.points.frustumCulled = this.lines.frustumCulled = false; this.points.visible = this.lines.visible = false;
    scene.add(this.points, this.lines); this.busy = 0;
  }
  // at: where; count: how many; tone: [r, g, b]; speed: metres a second; (nx, nz): the way the blow was going
  burst(at, count, tone, speed, nx = 0, nz = 0) {
    for (let i = 0; i < count; i++) {
      const k = this.next++ % this.n, a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u), v = speed * (0.3 + Math.random());
      this.pos[k * 3] = at.x; this.pos[k * 3 + 1] = at.y; this.pos[k * 3 + 2] = at.z;
      this.vel[k * 3] = Math.cos(a) * r * v + nx * speed * 0.55; this.vel[k * 3 + 1] = u * v + 2.4; this.vel[k * 3 + 2] = Math.sin(a) * r * v + nz * speed * 0.55;
      const w = 0.65 + Math.random() * 0.6; this.tone[k * 3] = tone[0] * w; this.tone[k * 3 + 1] = tone[1] * w; this.tone[k * 3 + 2] = tone[2] * w;
      this.life[k] = this.span[k] = 0.2 + Math.random() * 0.34;
    }
    this.busy = 0.7; this.points.visible = this.lines.visible = true;
  }
  update(dt) {
    if (this.busy <= 0) return;
    this.busy -= dt;
    const { pos, vel, col, tone, life, span, lpos, lcol } = this;
    for (let k = 0; k < this.n; k++) {
      const j = k * 3, m = k * 6;
      if (life[k] > 0) {
        life[k] -= dt; vel[j + 1] -= 15 * dt;
        pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
        if (pos[j + 1] < this.floor + 0.03) { pos[j + 1] = this.floor + 0.03; vel[j + 1] *= -0.38; vel[j] *= 0.6; vel[j + 2] *= 0.6; }      // they skip once on the stone
        const f = Math.max(0, life[k] / span[k]), g = f * f;
        col[j] = tone[j] * g; col[j + 1] = tone[j + 1] * g; col[j + 2] = tone[j + 2] * g;
      } else col[j] = col[j + 1] = col[j + 2] = 0;
      lpos[m] = pos[j]; lpos[m + 1] = pos[j + 1]; lpos[m + 2] = pos[j + 2];
      lpos[m + 3] = pos[j] - vel[j] * 0.035; lpos[m + 4] = pos[j + 1] - vel[j + 1] * 0.035; lpos[m + 5] = pos[j + 2] - vel[j + 2] * 0.035;
      lcol[m] = col[j]; lcol[m + 1] = col[j + 1]; lcol[m + 2] = col[j + 2]; lcol[m + 3] = lcol[m + 4] = lcol[m + 5] = 0;
    }
    for (const o of [this.points, this.lines]) { o.geometry.attributes.position.needsUpdate = true; o.geometry.attributes.color.needsUpdate = true; }
    if (this.busy <= 0) this.points.visible = this.lines.visible = false;
  }
}

// The bright ribbon a swing leaves behind it: the last few places the weapon was, fading as they age.
class Trail {
  constructor(scene, tone, n = 18, keep = 0.17) {
    this.n = n; this.keep = keep; this.tone = tone; this.pts = [];
    this.pos = new Float32Array(n * 6); this.col = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry(), idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.visible = false; scene.add(this.mesh);
  }
  add(tip, base) { this.pts.unshift([tip.x, tip.y, tip.z, base.x, base.y, base.z, 0]); if (this.pts.length > this.n) this.pts.pop(); }
  clear() { this.pts.length = 0; this.mesh.visible = false; }
  update(dt) {
    const p = this.pts;
    for (const q of p) q[6] += dt;
    while (p.length && p[p.length - 1][6] > this.keep) p.pop();
    this.mesh.visible = p.length > 1; if (!this.mesh.visible) return;
    for (let i = 0; i < p.length; i++) {
      const q = p[i], j = i * 6, f = (1 - q[6] / this.keep) ** 2;
      for (let k = 0; k < 6; k++) this.pos[j + k] = q[k];
      this.col[j] = this.tone[0] * f; this.col[j + 1] = this.tone[1] * f; this.col[j + 2] = this.tone[2] * f;
      this.col[j + 3] = this.tone[0] * f * 0.12; this.col[j + 4] = this.tone[1] * f * 0.12; this.col[j + 5] = this.tone[2] * f * 0.12;
    }
    this.mesh.geometry.setDrawRange(0, (p.length - 1) * 6);
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

export class Fight {
  // game: { scene, hero, gltf (the guard), sound, buzz, groundAt, shake(amount), slowMotion(secs, scale) }
  constructor(game) {
    Object.assign(this, game);
    const tex = dotTexture();
    this.sparks = new Sparks(this.scene, tex);
    this.flashes = [0, 1, 2, 3].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, transparent: true })); s.visible = false; s.userData = { t: 0, secs: 1, size: 1 }; this.scene.add(s); return s; });
    this.heroTrail = new Trail(this.scene, [1, 0.72, 0.28]);
    this.guards = [0, 1, 2].map(() => { const g = new Guard(this.gltf); g.trail = new Trail(this.scene, [1, 0.42, 0.24]); this.scene.add(g.root); return g; });
    this.stick = { x: 0, y: 0 };      // the thumb stick: x to his right on the screen, y toward the player
    this.focus = new THREE.Vector3(); this.active = false; this.over = null; this.result = null; this.lives = LIVES; this.freeze = 0; this.left = 0;
  }

  get frozen() { return this.freeze > 0; }

  // mid: the middle of the floor, in metres along the route
  begin(mid) {
    const hero = this.hero, p = hero.root.position;
    this.cz = -mid; this.active = true; this.over = null; this.result = null; this.overT = 0; this.lives = LIVES; this.freeze = 0;
    this.cool = 2.2; this.attacker = null; this.left = this.guards.length; this.t = 0;
    this.h = { act: null, t: 0, len: 0, strikeAt: 0, struck: false, heavy: false, combo: 0, comboT: 0, queued: false, safe: 0, dodgeCd: 0, vx: 0, vz: 0, fx: 0, fz: -1, reach: 0, dmg: 1 };
    hero.free = true; hero.pace = 0; hero.slide = 0; hero.busy = 0;
    this.sparks.floor = this.groundAt(this.cz);
    this.guards.forEach((g, i) => {
      g.reset(); g.root.visible = true; g.showHp();
      g.root.position.set((i - 1) * 2.3, 0, this.cz - HZ - 8 - (i === 1 ? 0 : 2.6)); g.root.position.y = this.groundAt(g.root.position.z);
      g.yaw = 0; g.root.rotation.y = 0; g.st = 'enter'; g.angle = (i - 1) * 0.9; g.wob = i * 2.1;
      g.play('great_sword_run', { fade: 0 });
    });
    this.focus.copy(p);
  }

  // Everything put away: a new run, or back to the title.
  clear() {
    this.active = false; this.over = null; this.result = null; this.attacker = null; this.stick.x = this.stick.y = 0;
    for (const g of this.guards) { g.reset(); g.trail.clear(); }
    this.heroTrail.clear(); this.hero.free = false; this.hero.root.rotation.y = 0;
  }

  nearest(p, within) {
    let best = null, bd = within;
    for (const g of this.guards) { if (g.st === 'dead' || !g.root.visible) continue; const d = Math.hypot(g.root.position.x - p.x, g.root.position.z - p.z); if (d < bd) { bd = d; best = g; } }
    return best;
  }

  flash(at, tone, size, secs = 0.12) {
    const s = this.flashes.find(f => !f.visible) || this.flashes[0];
    s.position.copy(at); s.material.color.setRGB(tone[0], tone[1], tone[2]); s.userData.t = 0; s.userData.secs = secs; s.userData.size = size; s.visible = true; s.scale.setScalar(size * 0.6);
  }

  // ── what the player does ──
  attack() {
    const h = this.h; if (!this.active || this.over) return false;
    if (h.act === 'attack') { if (h.t > 0.1) h.queued = true; return true; }      // pressed again in mid swing: the next blow follows on
    if (h.act) return false;                                                       // rolling or reeling
    const hero = this.hero, p = hero.root.position, s = this.stick, m = Math.hypot(s.x, s.y);
    h.combo = h.comboT > 0 && h.combo < 3 ? h.combo + 1 : 1;
    const g = this.nearest(p, 5.2);
    h.vx = h.vz = 0;
    if (g) {      // he turns on the nearest guard and closes the distance, as fighting games do
      const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz));
      h.fx = dx / d; h.fz = dz / d;
      const go = Math.min(2.2, Math.max(0, d - 1.55)); h.vx = h.fx * go * 9; h.vz = h.fz * go * 9;
    } else if (m > 0.15) { h.fx = s.x / m; h.fz = s.y / m; }
    h.heavy = h.combo === 3; h.act = 'attack'; h.t = 0; h.struck = false; h.queued = false;
    if (h.heavy) { hero.play('great_sword_slash', { once: true, from: 0.45, speed: 1.25, fade: 0.06 }); h.strikeAt = 0.22; h.len = 0.62; h.reach = 2.8; h.dmg = 2; }      // the third blow of a row is the great one
    else { hero.play('mutant_punch', { once: true, from: 0.1, speed: 1.3, fade: 0.05 }); h.strikeAt = 0.15; h.len = 0.4; h.reach = 2.35; h.dmg = 1; }
    this.sound.fx('slide', { rate: h.heavy ? 1.5 : 2.1, gap: 0.04 });
    return true;
  }

  dodge() {
    const h = this.h; if (!this.active || this.over || h.dodgeCd > 0 || h.act === 'hurt') return false;
    const s = this.stick, m = Math.hypot(s.x, s.y);
    const dx = m > 0.2 ? s.x / m : -h.fx, dz = m > 0.2 ? s.y / m : -h.fz;      // no direction held: away from what he is facing
    h.act = 'dodge'; h.t = 0; h.len = 0.46; h.queued = false; h.safe = Math.max(h.safe, 0.4); h.dodgeCd = 0.7;
    h.vx = dx * 11; h.vz = dz * 11; h.fx = dx; h.fz = dz;
    this.hero.play('sprinting_forward_roll', { once: true, from: 0.2, speed: 1.55, fade: 0.06 });
    this.sound.fx('slide', { rate: 1.2, gap: 0.04 });
    return true;
  }

  // The mace charged with all his strength: every guard near him is thrown back.
  special() {
    if (!this.active || this.over) return false;
    const p = this.hero.root.position; let any = false;
    for (const g of this.guards) {
      if (g.st === 'dead') continue;
      const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz));
      if (d < 8) { this.hurt(g, 2, dx / d, dz / d, true); any = true; }
    }
    _a.set(p.x, p.y + 1.1, p.z); this.sparks.burst(_a, 60, GOLD, 11); this.flash(_a, GOLD, 5, 0.22);
    this.freeze = 0.12; this.shake(0.6);
    return any;
  }

  // ── blows landing ──
  heroStrike() {
    const h = this.h, p = this.hero.root.position; let hit = 0;
    for (const g of this.guards) {
      if (g.st === 'dead' || !g.root.visible) continue;
      const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz));
      if (d > h.reach || (dx * h.fx + dz * h.fz) / d < 0.3) continue;      // in reach and in front of him
      hit++; this.hurt(g, h.dmg, dx / d, dz / d, h.heavy);
    }
    if (hit) {
      this.freeze = h.heavy ? 0.11 : 0.06; this.shake(h.heavy ? 0.45 : 0.24); this.buzz(h.heavy ? [30, 20, 60] : 25);
      this.sound.fx(h.heavy ? 'smash' : 'hit', { rate: h.heavy ? 1 : 1.25, gap: 0.04 }); h.comboT = 0.85;
    } else h.comboT = 0.5;
  }

  hurt(g, dmg, nx, nz, heavy) {
    const gp = g.root.position, clash = g.st === 'windup' && !g.struck;      // his sword was already coming: mace meets steel
    _a.set(gp.x - nx * 0.45, gp.y + 1.3, gp.z - nz * 0.45);
    // a guard standing ready sometimes turns the first blow of a row aside on his sword: sparks, no hurt, and he is driven back a step
    if (!heavy && g.st === 'ready' && this.h.combo === 1 && Math.random() < 0.22) {
      this.sparks.burst(_a, 26, WHITE, 7.5, -nx, -nz); this.flash(_a, WHITE, 1.5); this.sound.fx('tap', { rate: 1.6, gap: 0.03 });
      g.vx = nx * 3.5; g.vz = nz * 3.5; g.play('great_sword_impact', { once: true, from: 0.1, speed: 2.2, fade: 0.05 }); g.st = 'hurt'; g.t = 0.25;
      return;
    }
    this.sparks.burst(_a, heavy ? 36 : clash ? 30 : 20, clash ? WHITE : GOLD, heavy ? 9.5 : 6.5, nx, nz);
    this.flash(_a, clash ? WHITE : GOLD, heavy ? 2.6 : 1.7);
    g.hp -= dmg; g.showHp();
    if (clash && !heavy && g.hp > 0) { g.vx = nx * 1.5; g.vz = nz * 1.5; return; }      // a light blow does not stop a sword that is already falling: get clear, or land the great blow
    g.t = 0; g.struck = false;
    if (this.attacker === g) { this.attacker = null; this.cool = 0.35 + Math.random() * 0.4; }
    g.vx = nx * (heavy ? 9 : 5); g.vz = nz * (heavy ? 9 : 5);
    if (g.hp <= 0) {
      g.st = 'dead'; g.play('two_handed_sword_death', { once: true, fade: 0.08, speed: 1.15 });
      if (--this.left === 0) { this.over = 'won'; this.overT = 1.9; this.slowMotion(1.3, 0.28); }      // the last one falls slowly
    } else { g.st = 'hurt'; g.play('great_sword_impact', { once: true, from: 0.08, speed: 1.5, fade: 0.05 }); }
  }

  hitHero(g) {
    const h = this.h; if (h.safe > 0 || this.over) return false;
    const hero = this.hero, p = hero.root.position, gp = g.root.position, d = Math.max(0.01, Math.hypot(p.x - gp.x, p.z - gp.z));
    this.lives--; h.act = 'hurt'; h.t = 0; h.len = 0.42; h.queued = false; h.combo = 0; h.safe = 1.4; this.cool = Math.max(this.cool, 1.2);      // a moment's mercy after every wound
    h.vx = (p.x - gp.x) / d * 7; h.vz = (p.z - gp.z) / d * 7;
    hero.play('hit_reaction', { once: true, speed: 2.2, fade: 0.06 });
    _a.set(p.x, p.y + 1.2, p.z); this.sparks.burst(_a, 18, RED, 6); this.flash(_a, RED, 2);
    this.freeze = 0.08; this.shake(0.55); this.buzz([60, 30, 60]); this.sound.fx('hit', { rate: 0.8, gap: 0.04 });
    if (this.lives <= 0) { this.over = 'lost'; this.overT = 0.9; }
    return true;
  }

  // ── every frame of the fight. dt: game time; real: clock time (the fight's short freezes are in clock time) ──
  update(dt, real) {
    if (!this.active) return;
    if (this.over) { this.overT -= real; if (this.overT <= 0) { this.active = false; this.result = this.over; return; } }
    if (this.freeze > 0) { this.freeze -= real; return; }      // the instant a blow lands, everything holds
    const hero = this.hero, h = this.h, p = hero.root.position, s = this.stick, m = Math.hypot(s.x, s.y);
    h.comboT -= dt; h.safe -= dt; h.dodgeCd -= dt;
    if (h.act) {
      h.t += dt;
      p.x += h.vx * dt; p.z += h.vz * dt; const drag = Math.exp(-dt * (h.act === 'dodge' ? 2.2 : 9)); h.vx *= drag; h.vz *= drag;
      if (h.act === 'attack') {
        if (h.t > h.strikeAt - 0.13 && h.t < h.strikeAt + 0.12 && hero.maceEnds(_a, _b)) this.heroTrail.add(_a, _b);
        if (!h.struck && h.t >= h.strikeAt) { h.struck = true; this.heroStrike(); }
      }
      if (h.t >= h.len) { const again = h.queued; h.act = null; h.queued = false; if (again) this.attack(); }
    }
    if (!h.act) {
      if (m > 0.15) {
        const k = Math.min(1, m); p.x += s.x / m * k * PACE * dt; p.z += s.y / m * k * PACE * dt; h.fx = s.x / m; h.fz = s.y / m;
        hero.play('fast_run', { speed: 0.7 + 0.22 * k, fade: 0.12 }); hero.pace = PACE * k;
      } else {
        hero.play('great_sword_idle', { fade: 0.18 }); hero.pace = 0;
        const g = this.nearest(p, 7);      // standing still, he keeps his eyes on the nearest guard
        if (g) { const dx = g.root.position.x - p.x, dz = g.root.position.z - p.z, d = Math.max(0.01, Math.hypot(dx, dz)); h.fx += (dx / d - h.fx) * Math.min(1, dt * 6); h.fz += (dz / d - h.fz) * Math.min(1, dt * 6); }
      }
    }
    p.x = Math.max(-HX, Math.min(HX, p.x)); p.z = Math.max(this.cz - HZ, Math.min(this.cz + HZ, p.z));
    const yaw = Math.atan2(-h.fx, -h.fz); hero.root.rotation.y += wrap(yaw - hero.root.rotation.y) * Math.min(1, dt * (h.act ? 26 : 14));

    // the guards
    const alive = this.guards.filter(g => g.st !== 'dead');
    this.cool -= dt;
    if (!this.attacker && this.cool <= 0 && !this.over) {      // one comes at him at a time; the others hold the ring
      const ready = alive.filter(g => g.st === 'ready');
      if (ready.length) {
        const g = ready.reduce((a, b) => Math.hypot(a.root.position.x - p.x, a.root.position.z - p.z) + Math.random() < Math.hypot(b.root.position.x - p.x, b.root.position.z - p.z) + Math.random() ? a : b);
        g.st = 'approach'; g.t = 0; this.attacker = g;
      }
    }
    let cx = 0, czs = 0;
    for (const g of this.guards) {
      if (!g.root.visible) continue;
      if (g.st === 'dead') continue;      // the fallen are seen to in tick()
      const gp = g.root.position; g.t += dt;
      const dx = p.x - gp.x, dz = p.z - gp.z, d = Math.max(0.01, Math.hypot(dx, dz)), toHero = Math.atan2(dx, dz);
      gp.x += g.vx * dt; gp.z += g.vz * dt; const drag = Math.exp(-dt * 8); g.vx *= drag; g.vz *= drag;
      cx += gp.x; czs += gp.z;
      if (g.st === 'hurt') {
        g.turn(toHero, dt);
        if (g.t > 0.5) {      // on his feet again: often he answers at once, if no other guard is already coming
          g.st = 'ready'; g.t = 0;
          if (!this.attacker && !this.over && d < 3.2 && Math.random() < 0.3) { g.st = 'approach'; this.attacker = g; }
        }
      }
      else if (g.st === 'enter' || g.st === 'ready') {
        // each holds his own bearing round him, eased apart from the others, drifting a little so the ring is never still
        for (const o of alive) { if (o === g) continue; const diff = wrap(g.angle - o.angle); if (Math.abs(diff) < 0.95) g.angle += Math.sign(diff || 1) * (0.95 - Math.abs(diff)) * dt * 2.2; }
        g.angle += Math.sin(this.t * 0.55 + g.wob) * 0.22 * dt;
        const tx = Math.max(-HX - 0.9, Math.min(HX + 0.9, p.x + Math.sin(g.angle) * RING)), tz = Math.max(this.cz - HZ - 1.5, Math.min(this.cz + HZ + 0.5, p.z - Math.cos(g.angle) * RING));
        const ex = tx - gp.x, ez = tz - gp.z, e = Math.hypot(ex, ez), v = e > 4 ? 5.4 : e > 0.4 ? 2.3 : 0;
        if (v > 0) { gp.x += ex / e * v * dt; gp.z += ez / e * v * dt; }
        g.play(v > 3 ? 'great_sword_run' : v > 0 ? 'great_sword_walk' : 'great_sword_idle', { fade: 0.2 });
        g.turn(v > 3 ? Math.atan2(ex, ez) : toHero, dt, 8);
        if (g.st === 'enter' && d < RING + 1.6) { g.st = 'ready'; g.t = 0; }
      } else if (g.st === 'approach') {
        if (d > 2.05) { gp.x += dx / d * 4.6 * dt; gp.z += dz / d * 4.6 * dt; g.play('great_sword_run', { fade: 0.15 }); }
        g.turn(toHero, dt, 12);
        if (d <= 2.05 || g.t > 2.2) {
          if (d < 3.4) {      // the sword goes up: a glint and a sound warn the player before the blow comes down
            g.st = 'windup'; g.t = 0; g.struck = false; g.play('great_sword_slash', { once: true, from: 0.73 - TELL, fade: 0.1 });
            g.swordEnds(_a, _b); this.flash(_a, RED, 1.5, 0.3); this.sound.fx('tap', { rate: 0.6, gap: 0.05 });
          } else { g.st = 'ready'; g.t = 0; this.attacker = null; this.cool = 0.5; }      // he could not reach him: back to the ring
        }
      } else if (g.st === 'windup') {
        if (g.t < TELL - 0.25) g.turn(toHero, dt, 12);                    // he commits to where the player was a quarter of a second before the blow
        else if (g.t < TELL) { gp.x += Math.sin(g.yaw) * 3.4 * dt; gp.z += Math.cos(g.yaw) * 3.4 * dt; }      // and steps into it
        if (g.t > TELL - 0.16 && g.t < TELL + 0.14) { g.swordEnds(_a, _b); g.trail.add(_a, _b); }
        if (!g.struck && g.t >= TELL) {
          g.struck = true; this.sound.fx('slide', { rate: 1.7, gap: 0.04 });
          const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw), hx = p.x - gp.x, hz = p.z - gp.z, hd = Math.max(0.01, Math.hypot(hx, hz));
          if (hd < 2.6 && (hx * fx + hz * fz) / hd > 0.42) this.hitHero(g);
        }
        if (g.t >= TELL + 0.55) { g.st = 'ready'; g.t = 0; if (this.attacker === g) { this.attacker = null; this.cool = 0.55 + Math.random() * 0.7 + 0.2 * alive.length; } }
      }
      if (d < 1.15 && g.st !== 'windup') { gp.x -= dx / d * (1.15 - d); gp.z -= dz / d * (1.15 - d); }      // never standing inside him
      gp.x = Math.max(-HX - 1.2, Math.min(HX + 1.2, gp.x)); gp.z = Math.min(this.cz + HZ + 0.5, gp.z); gp.y = this.groundAt(gp.z);
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {      // nor inside one another
      const a = alive[i].root.position, b = alive[j].root.position, dx = b.x - a.x, dz = b.z - a.z, d = Math.max(0.01, Math.hypot(dx, dz));
      if (d < 1.5) { const k = (1.5 - d) / 2; a.x -= dx / d * k; a.z -= dz / d * k; b.x += dx / d * k; b.z += dz / d * k; }
    }
    this.t += dt;
    // what the view should hold: him, leaning a little toward the guards who are left
    const n = alive.length; _a.copy(p);
    if (n) { _a.x += Math.max(-2, Math.min(2, (cx / n - p.x) * 0.3)); _a.z += Math.max(-3, Math.min(3, (czs / n - p.z) * 0.3)); }
    this.focus.lerp(_a, Math.min(1, dt * 5));
  }

  // Sparks, flashes, trails and the guards' own movement: these run on whenever anything of the fight is in view.
  tick(dt, real) {
    this.sparks.update(real); this.heroTrail.update(real);
    for (const s of this.flashes) { if (!s.visible) continue; const u = s.userData; u.t += real; const k = u.t / u.secs; if (k >= 1) { s.visible = false; continue; } s.scale.setScalar(u.size * (0.6 + 0.6 * k)); s.material.opacity = 1 - k * k; }
    const hold = this.freeze > 0 ? 0 : dt;
    for (const g of this.guards) {
      g.trail.update(real); if (!g.root.visible) continue;
      g.mixer.update(hold);
      if (g.st === 'dead') {      // thrown back by the blow, down, and after a moment sinking away
        const gp = g.root.position; g.t += hold; gp.x += g.vx * hold; gp.z += g.vz * hold; const drag = Math.exp(-hold * 8); g.vx *= drag; g.vz *= drag;
        if (g.t > 3) { gp.y -= hold * 0.7; if (g.t > 4.3) g.root.visible = false; }
      }
    }
  }
}
