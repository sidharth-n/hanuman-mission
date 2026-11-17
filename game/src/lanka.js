// Lanka seen from the sky at the very end: the whole city burning round the street he ran, lying in smoke.
// The street itself is only a strip a few houses wide, so this lays a city about it for the last high shots: some
// hundreds of plain blocks and towers drawn in one call, fires on their roofs drawn in another, and smoke that
// thickens with the distance from the middle until city, ground and sky are one colour. Nothing has an edge.
import * as THREE from 'three';
import { rng } from './build.js';

const R0 = 150, R1 = 300;      // where the smoke begins to take the city, and where nothing is left of it
const HAZE = new THREE.Color(0x4a1a08);

const VERT = `
  varying float vUp; varying float vR; varying vec3 vN; varying float vSeed; varying vec2 vAt; varying vec3 vBox;
  uniform vec3 centre;
  void main() {
    #ifdef USE_INSTANCING
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vSeed = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.71;
      vBox = position * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));      // where on the house, in metres
    #else
      vec4 w = modelMatrix * vec4(position, 1.0);
      vSeed = 0.0; vBox = position;
    #endif
    vUp = position.y; vN = normal; vR = length(w.xz - centre.xz); vAt = w.xz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
// kind: 0 a house, 1 the ground, 2 the smoke standing round the city, 3 a roof
const FRAG = `
  varying float vUp; varying float vR; varying vec3 vN; varying float vSeed; varying vec2 vAt; varying vec3 vBox;
  uniform vec3 haze; uniform float time; uniform float kind;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float flick = 0.85 + 0.15 * sin(time * 3.1 + vSeed);
    vec3 c; float a = 1.0;
    if (kind > 1.5 && kind < 2.5) {         // smoke: thick below, thinning into the sky
      c = haze; a = 1.0 - smoothstep(0.0, 1.0, vUp);
    } else if (kind > 0.5 && kind < 1.5) {  // streets and yards between the houses, lit from the fires
      float glow = 0.5 + 0.27 * sin(vAt.x * 0.083 + 1.3) + 0.23 * sin(vAt.y * 0.061 + vAt.x * 0.047);      // firelight lying unevenly over the streets, never a pattern
      c = mix(vec3(0.02, 0.008, 0.006), vec3(0.13, 0.04, 0.014), glow * glow) * flick;
    } else if (kind > 2.5) {                // a roof of dark tile, its slopes catching the fire from one side
      float lit = 0.45 + 0.75 * max(0.0, dot(normalize(vN), normalize(vec3(0.35, 0.55, 0.75))));
      c = vec3(0.15, 0.045, 0.028) * lit * flick;
    } else {                                // a house: dark stone, firelight on its upper walls, windows lit from within
      float top = step(0.5, vN.y);
      vec3 side = mix(vec3(0.03, 0.014, 0.011), vec3(0.3, 0.095, 0.03), vUp * vUp * flick);
      float across = abs(vN.x) > 0.5 ? vBox.z : vBox.x;
      vec2 cell = vec2(across / 3.1, vBox.y / 3.7), in_ = fract(cell);
      float pane = step(0.3, in_.x) * step(in_.x, 0.7) * step(0.32, in_.y) * step(in_.y, 0.78);
      float lamp = step(0.5, hash(floor(cell) + vSeed));
      side += vec3(1.25, 0.62, 0.2) * pane * lamp * (0.75 + 0.25 * sin(time * 5.0 + hash(floor(cell)) * 40.0));
      c = mix(side, vec3(0.05, 0.018, 0.012), top);
    }
    if (kind < 1.5 || kind > 2.5) c = mix(c, haze, smoothstep(${R0.toFixed(1)}, ${R1.toFixed(1)}, vR));
    gl_FragColor = vec4(c, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createLanka(scene, flameTex) {
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const mats = [];
  const mat = (kind, three = {}) => { const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, fog: false, ...three,
    uniforms: { centre: { value: new THREE.Vector3() }, haze: { value: HAZE }, time: { value: 0 }, kind: { value: kind } } }); mats.push(m); return m; };

  // the ground, far wider than the city: beyond the smoke line it is the smoke's own colour, out to where the sky begins
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 48).rotateX(-Math.PI / 2), mat(1));
  ground.position.y = -0.4; root.add(ground);
  // the houses: one box, drawn some hundreds of times
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), COUNT = 900;
  const houses = new THREE.InstancedMesh(box, mat(0), COUNT); houses.frustumCulled = false; root.add(houses);
  // and their roofs: one four-sided peak, as many times
  const peak = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  const roofs = new THREE.InstancedMesh(peak, mat(3), COUNT); roofs.frustumCulled = false; root.add(roofs);
  // the fires on their roofs: one cloud of points
  const fireGeo = new THREE.BufferGeometry(), fireMat = new THREE.PointsMaterial({ map: flameTex, size: 26, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffb060 });
  const fires = new THREE.Points(fireGeo, fireMat); fires.frustumCulled = false; root.add(fires);
  // and the smoke standing round it all, so the far edge of the ground is never seen against the sky
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R1 + 60, R1 + 60, 1, 48, 1, true).translate(0, 0.5, 0), mat(2, { transparent: true, side: THREE.BackSide, depthWrite: false }));
  ring.scale.y = 190; root.add(ring);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let built = null;

  // The city laid round a middle (x 0, the given z), the floor at y. clear: the strip the real street stands on
  // ({ half, front, back }: its half width, and how far it runs ahead of the middle and behind it); nothing is put there.
  function lay(z, y, clear) {
    const key = z + ':' + y; if (built === key) return; built = key;
    const r = rng(4242); let n = 0, k = 0; const flames = [];
    const put = (x, zz, w, d, h, yaw, up = 0) => { if (n >= COUNT) return; q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); m4.compose(p.set(x, y + up, zz), q, s.set(w, h, d)); houses.setMatrixAt(n++, m4); };
    const cap = (x, zz, w, d, h, yaw, up) => { if (k >= COUNT) return; q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw); m4.compose(p.set(x, y + up, zz), q, s.set(w, h, d)); roofs.setMatrixAt(k++, m4); };
    const CELL = 21;
    for (let gx = -15; gx <= 15; gx++) for (let gz = -15; gz <= 15; gz++) {
      const x = gx * CELL + (r() - 0.5) * 6, dz = gz * CELL + (r() - 0.5) * 6, rad = Math.hypot(x, dz);
      if (rad > R1 + 10 || r() < 0.1) continue;
      if (Math.abs(x) < clear.half && dz < clear.back && dz > -clear.front) continue;      // the street he ran, with its own houses
      const yaw = (r() - 0.5) * 0.24, w = 11 + r() * 6, d = 11 + r() * 6;
      const tall = r() < 0.16, h = tall ? 17 + r() * 13 : 6 + r() * 7;
      put(x, z + dz, w, d, h, yaw);
      if (tall) {      // a tower: storeys stepping in, a skirt of roof round each, a peak on the last
        cap(x, z + dz, w * 1.22, d * 1.22, 2.6, yaw, h - 0.4); put(x, z + dz, w * 0.7, d * 0.7, h * 0.42, yaw, h);
        cap(x, z + dz, w * 0.9, d * 0.9, 2.3, yaw, h * 1.42 - 0.4); put(x, z + dz, w * 0.45, d * 0.45, h * 0.34, yaw, h * 1.42);
        cap(x, z + dz, w * 0.62, d * 0.62, 5.5, yaw, h * 1.76);
      } else cap(x, z + dz, w * 1.14, d * 1.14, 2.4 + r() * 2.2, yaw, h);
      if (rad < R0 + 40 && r() < (tall ? 0.85 : 0.4)) flames.push(x + (r() - 0.5) * 5, y + (tall ? h * 1.4 : h) + 6, z + dz + (r() - 0.5) * 5);
    }
    houses.count = n; houses.instanceMatrix.needsUpdate = true; roofs.count = k; roofs.instanceMatrix.needsUpdate = true;
    fireGeo.setAttribute('position', new THREE.Float32BufferAttribute(flames, 3));
    ground.position.set(0, y - 0.4, z); ring.position.set(0, y - 2, z);
    for (const m of mats) m.uniforms.centre.value.set(0, y, z);
  }

  return {
    haze: HAZE,
    show(z, y, clear) { lay(z, y, clear); root.visible = true; },
    hide() { root.visible = false; },
    get on() { return root.visible; },
    update(t) { if (!root.visible) return; for (const m of mats) m.uniforms.time.value = t; fireMat.size = 26 + Math.sin(t * 9) * 2.5 + Math.sin(t * 23) * 1.2; },
  };
}
