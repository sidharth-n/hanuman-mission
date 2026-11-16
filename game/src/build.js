// A small mesh builder: flat polygons textured from one shared sheet, so a whole building is a single draw.
// Repeating textures are cut along the tile grid and mirrored on every other tile, so no seams show.
import * as THREE from 'three';
import ATLAS from './atlas.json';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const PAD = 3;   // pixels kept clear inside each cell so neighbours never bleed in
const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();

function clip(poly, axis, limit, keepBelow) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const pin = keepBelow ? p[axis] <= limit + 1e-6 : p[axis] >= limit - 1e-6;
    const qin = keepBelow ? q[axis] <= limit + 1e-6 : q[axis] >= limit - 1e-6;
    if (pin) out.push(p);
    if (pin !== qin) { const t = (limit - p[axis]) / (q[axis] - p[axis]); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

export class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.tint = [1, 1, 1]; }

  // One flat convex polygon. Points run counter-clockwise when seen from outside.
  // opt.along: the direction the texture runs sideways (default: the first edge). opt.fit: stretch the cell once over the polygon.
  // opt.shade: brightness. opt.color: [r, g, b] multiplier. opt.ground: darken toward the ground (default true).
  poly(pts, cell, opt = {}) {
    const [cx, cy, cw, ch, tw0, th0] = ATLAS.cells[cell];
    const P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const n = a3.subVectors(P[1], P[0]).cross(b3.subVectors(P[2], P[0])).normalize().clone();
    const u = (opt.along ? new THREE.Vector3(...opt.along) : new THREE.Vector3().subVectors(P[1], P[0]));
    u.addScaledVector(n, -u.dot(n));
    if (u.lengthSq() < 1e-8) u.subVectors(P[1], P[0]);      // asked-for direction is square-on to this face: use the first edge
    u.normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    let flat = P.map(p => [p.dot(u), p.dot(v)]);
    const minU = Math.min(...flat.map(f => f[0])), minV = Math.min(...flat.map(f => f[1]));
    const maxU = Math.max(...flat.map(f => f[0])) - minU, maxV = Math.max(...flat.map(f => f[1])) - minV;
    flat = flat.map(f => [f[0] - minU, f[1] - minV]);
    const origin = new THREE.Vector3().addScaledVector(u, minU).addScaledVector(v, minV).addScaledVector(n, P[0].dot(n));
    const solid = tw0 < 0;
    const tw = solid || opt.fit || !tw0 ? maxU : (opt.tile ? opt.tile[0] : tw0), th = solid || opt.fit || !th0 ? maxV : (opt.tile ? opt.tile[1] : th0);
    const shade = opt.shade ?? 1, color = opt.color || [1, 1, 1], ground = opt.ground ?? true;
    const emit = (U, V, lu, lv) => {
      const x = origin.x + u.x * U + v.x * V, y = origin.y + u.y * U + v.y * V, z = origin.z + u.z * U + v.z * V;
      this.pos.push(x, y, z); this.nor.push(n.x, n.y, n.z);
      if (solid) this.uv.push((cx + cw / 2) / ATLAS.w, 1 - (cy + ch / 2) / ATLAS.h);
      else this.uv.push((cx + PAD + lu * (cw - 2 * PAD)) / ATLAS.w, 1 - (cy + PAD + (1 - lv) * (ch - 2 * PAD)) / ATLAS.h);
      const k = shade * (ground ? 0.5 + 0.5 * Math.min(1, Math.max(0, y) / 2.2) : 1);
      this.col.push(k * color[0] * this.tint[0], k * color[1] * this.tint[1], k * color[2] * this.tint[2]);
    };
    const nu = Math.max(1, Math.ceil(maxU / tw - 1e-4)), nv = Math.max(1, Math.ceil(maxV / th - 1e-4));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      let piece = flat;
      if (nu > 1 || nv > 1) {
        piece = clip(clip(clip(clip(flat, 0, i * tw, false), 0, (i + 1) * tw, true), 1, j * th, false), 1, (j + 1) * th, true);
        if (piece.length < 3) continue;
      }
      const local = piece.map(([U, V]) => { let lu = (U - i * tw) / tw, lv = (V - j * th) / th; if (i % 2) lu = 1 - lu; if (j % 2) lv = 1 - lv; return [U, V, lu, lv]; });
      for (let k = 1; k < local.length - 1; k++) { emit(...local[0]); emit(...local[k]); emit(...local[k + 1]); }
    }
    return this;
  }

  // A polygon given in any order: it is turned to face the direction asked for.
  face(pts, cell, toward, opt = {}) {
    const [a, b, c] = pts, ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const d = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
    return this.poly(d < 0 ? pts.slice().reverse() : pts, cell, opt);
  }

  // A four-sided spike from a point on a surface, pointing along dir.
  spike(at, dir, r, h, cell = 'iron', shade = 1) {
    const d = new THREE.Vector3(...dir).normalize(), u = new THREE.Vector3(0, 1, 0);
    if (Math.abs(d.y) > 0.9) u.set(1, 0, 0);
    u.cross(d).normalize(); const w = new THREE.Vector3().crossVectors(d, u);
    const c = new THREE.Vector3(...at), tip = c.clone().addScaledVector(d, h).toArray();
    const corner = k => c.clone().addScaledVector(u, [r, -r, -r, r][k]).addScaledVector(w, [r, r, -r, -r][k]);
    for (let k = 0; k < 4; k++) {
      const p = corner(k), q = corner((k + 1) % 4), out = p.clone().add(q).multiplyScalar(0.5).sub(c).addScaledVector(d, 0.2);
      this.face([p.toArray(), q.toArray(), tip], cell, out.toArray(), { ground: false, shade: shade * (k % 2 ? 0.75 : 1.1) });
    }
    return this;
  }

  // Axis-aligned box. faces: any of f (+z) b (-z) l (-x) r (+x) t (top) d (underside).
  box(x0, x1, y0, y1, z0, z1, cell, opt = {}) {
    const faces = opt.faces || 'flrt', top = opt.top || cell;
    if (faces.includes('f')) this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], cell, opt);
    if (faces.includes('b')) this.poly([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], cell, opt);
    if (faces.includes('l')) this.poly([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], cell, { ...opt, shade: (opt.shade ?? 1) * 0.82 });
    if (faces.includes('r')) this.poly([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], cell, { ...opt, shade: (opt.shade ?? 1) * 0.82 });
    if (faces.includes('t')) this.poly([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], top, opt);
    if (faces.includes('d')) this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], cell, { ...opt, shade: (opt.shade ?? 1) * 0.45 });
    return this;
  }

  // A picture (door, window) stretched once over an upright rectangle facing +z.
  panel(x0, x1, y0, y1, z, cell, opt = {}) {
    return this.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], cell, { fit: true, ground: false, ...opt });
  }

  // Hipped tile roof over a rectangle: eaves at height y, ridge along the longer side.
  hip(x0, x1, z0, z1, y, rise, cell = 'roof', opt = {}) {
    const w = x1 - x0, d = z1 - z0, t = 0.14, e = y + t, o = { ground: false, ...opt };
    const alongX = w >= d, inset = Math.min(w, d) / 2, top = e + rise;
    const xa = alongX ? x0 + inset : (x0 + x1) / 2, xb = alongX ? x1 - inset : (x0 + x1) / 2;
    const za = alongX ? (z0 + z1) / 2 : z0 + inset, zb = alongX ? (z0 + z1) / 2 : z1 - inset;
    // ridge runs from A to B; A is the -x (or -z) end
    const A = alongX ? [xa, top, za] : [xa, top, za], B = alongX ? [xb, top, zb] : [xb, top, zb];
    const tri = (p, q, r, along) => this.poly([p, q, r], cell, { ...o, along });
    const quad = (p, q, r, s, along) => this.poly([p, q, r, s], cell, { ...o, along });
    if (alongX) {
      quad([x0, e, z1], [x1, e, z1], B, A, [1, 0, 0]);                       // front slope
      quad([x1, e, z0], [x0, e, z0], A, B, [-1, 0, 0]);                      // back slope
      tri([x0, e, z0], [x0, e, z1], A, [0, 0, 1]);                           // left end
      tri([x1, e, z1], [x1, e, z0], B, [0, 0, -1]);                          // right end
    } else {
      quad([x0, e, z0], [x0, e, z1], B, A, [0, 0, 1]);                       // left slope
      quad([x1, e, z1], [x1, e, z0], A, B, [0, 0, -1]);                      // right slope
      tri([x0, e, z1], [x1, e, z1], B, [1, 0, 0]);                           // front end
      tri([x1, e, z0], [x0, e, z0], A, [-1, 0, 0]);                          // back end
    }
    this.box(x0, x1, y, e, z0, z1, 'lotus', { faces: 'fblr', ground: false, shade: 0.9 });          // carved edge under the tiles
    this.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], 'wood', { ground: false, shade: 0.4 });   // underside
    return top;
  }

  // Sloping band of tiles from an outer rectangle up to a smaller one (the lower roof of a two-tier roof).
  skirt(x0, x1, z0, z1, y, inset, rise, cell = 'roof') {
    const t = 0.14, e = y + t, o = { ground: false }, X0 = x0 + inset, X1 = x1 - inset, Z0 = z0 + inset, Z1 = z1 - inset, top = e + rise;
    this.poly([[x0, e, z1], [x1, e, z1], [X1, top, Z1], [X0, top, Z1]], cell, { ...o, along: [1, 0, 0] });
    this.poly([[x1, e, z0], [x0, e, z0], [X0, top, Z0], [X1, top, Z0]], cell, { ...o, along: [-1, 0, 0] });
    this.poly([[x0, e, z0], [x0, e, z1], [X0, top, Z1], [X0, top, Z0]], cell, { ...o, along: [0, 0, 1] });
    this.poly([[x1, e, z1], [x1, e, z0], [X1, top, Z0], [X1, top, Z1]], cell, { ...o, along: [0, 0, -1] });
    this.box(x0, x1, y, e, z0, z1, 'lotus', { faces: 'fblr', ground: false, shade: 0.9 });
    this.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], 'wood', { ground: false, shade: 0.4 });
    return [X0, X1, Z0, Z1, top];
  }

  // Sloping roof that leans against a wall at z = zWall and comes down to z = zOut.
  lean(x0, x1, zWall, zOut, yWall, yOut, cell = 'roof') {
    const t = 0.1, o = { ground: false };
    this.poly([[x0, yOut + t, zOut], [x1, yOut + t, zOut], [x1, yWall + t, zWall], [x0, yWall + t, zWall]], cell, { ...o, along: [1, 0, 0] });
    this.poly([[x0, yOut, zOut], [x1, yOut, zOut], [x1, yOut + t, zOut], [x0, yOut + t, zOut]], 'lotus', o);
    this.poly([[x0, yWall, zWall], [x1, yWall, zWall], [x1, yOut, zOut], [x0, yOut, zOut]], 'wood', { ...o, shade: 0.4 });
    this.poly([[x0, yWall, zWall], [x0, yOut, zOut], [x0, yOut + t, zOut], [x0, yWall + t, zWall]], 'wood', { ...o, shade: 0.6 });
    this.poly([[x1, yOut, zOut], [x1, yWall, zWall], [x1, yWall + t, zWall], [x1, yOut + t, zOut]], 'wood', { ...o, shade: 0.6 });
    return this;
  }

  // Square pillar with a base, a slimmer shaft and a spreading capital.
  pillar(cx, cz, y0, y1, w = 0.34, cell = 'stone') {
    const h = w / 2, b = h * 1.45, o = { faces: 'fblr', ground: false };
    this.box(cx - b, cx + b, y0, y0 + 0.32, cz - b, cz + b, 'tower', { faces: 'fblrt', tile: [1.2, 1.2] });
    this.box(cx - h, cx + h, y0 + 0.32, y1 - 0.5, cz - h, cz + h, cell, { ...o, tile: [1.5, 3] });
    this.box(cx - b * 0.85, cx + b * 0.85, y1 - 0.5, y1 - 0.3, cz - b * 0.85, cz + b * 0.85, 'lotus', { ...o, faces: 'fblrd' });
    this.box(cx - b * 1.25, cx + b * 1.25, y1 - 0.3, y1, cz - b * 1.25, cz + b * 1.25, 'frieze', { ...o, faces: 'fblrd', tile: [1.2, 0.3] });
    return this;
  }

  // Turned shape (finials, domes, pots) in one flat colour. profile: [[radius, height], ...] from bottom to top.
  lathe(cx, cz, y, profile, cell = 'gold', seg = 8, shade = 1) {
    const [x0, y0, w, h] = ATLAS.cells[cell], tu = (x0 + w / 2) / ATLAS.w, tv = 1 - (y0 + h / 2) / ATLAS.h;
    const put = (r, yy, a, ny) => {
      const c = Math.cos(a), s = Math.sin(a); this.pos.push(cx + c * r, y + yy, cz + s * r);
      const l = Math.hypot(1, ny); this.nor.push(c / l, ny / l, s / l); this.uv.push(tu, tv);
      this.col.push(shade * this.tint[0], shade * this.tint[1], shade * this.tint[2]);
    };
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, h0] = profile[i], [r1, h1] = profile[i + 1], ny = (r0 - r1) / Math.max(1e-3, h1 - h0);
      for (let k = 0; k < seg; k++) {
        const a = k / seg * Math.PI * 2, b = (k + 1) / seg * Math.PI * 2;
        if (r0 > 1e-3) { put(r0, h0, a, ny); put(r1, h1, b, ny); put(r0, h0, b, ny); }
        if (r1 > 1e-3) { put(r0, h0, a, ny); put(r1, h1, a, ny); put(r1, h1, b, ny); }
      }
    }
    return this;
  }

  // The pot-and-spire ornament that tops Indian roofs.
  finial(cx, cz, y, s = 1) {
    return this.lathe(cx, cz, y, [[0.16 * s, 0], [0.2 * s, 0.08 * s], [0.07 * s, 0.2 * s], [0.2 * s, 0.38 * s], [0.17 * s, 0.52 * s], [0.05 * s, 0.62 * s], [0.07 * s, 0.72 * s], [0, 0.98 * s]]);
  }

  // lights: torches painted into the surface so they cost nothing while playing. [{ at: [x, y, z], color: [r, g, b], reach }]
  geometry(lights = []) {
    const col = this.col.slice();
    for (const { at, color, reach } of lights) for (let i = 0; i < this.pos.length; i += 3) {
      const dx = at[0] - this.pos[i], dy = at[1] - this.pos[i + 1], dz = at[2] - this.pos[i + 2], d = Math.hypot(dx, dy, dz) || 1e-3;
      const facing = Math.max(0, (dx * this.nor[i] + dy * this.nor[i + 1] + dz * this.nor[i + 2]) / d * 0.8 + 0.2);
      const k = facing / (1 + (d / reach) ** 2);
      col[i] += this.col[i] * color[0] * k; col[i + 1] += this.col[i + 1] * color[1] * k; col[i + 2] += this.col[i + 2] * color[2] * k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }

  get triangles() { return this.pos.length / 9; }
}
