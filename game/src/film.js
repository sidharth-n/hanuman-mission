// Film mode (?debug&film): the game as a stage. Never loaded in play: main.js fetches this file only when the address asks for it.
// What it adds: a camera that can stand anywhere (film.cam), a key light with real shadows and a rim light that follow whoever
// the shot is of, glow on fire and lamps, and a soft background behind a close subject. Each frame is drawn when the one who
// films asks for it, so a shot can be slowed or stopped without losing sharpness.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createFilm({ renderer, scene, camera, hemi, moon, state, hero, world }) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const key = new THREE.DirectionalLight(0xffffff, 0), rim = new THREE.DirectionalLight(0xffffff, 0), fill = new THREE.PointLight(0xffffff, 0, 30, 1.6);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key, key.target, rim, rim.target, fill);
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 }));
  const bloom = new UnrealBloomPass(size.clone(), 0.3, 0.7, 0.9), bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.0004, maxblur: 0.006 });
  composer.addPass(new RenderPass(scene, camera)); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(new OutputPass());
  const at = new THREE.Vector3(), v = new THREE.Vector3(), look = new THREE.Vector3(); let seen = 0, n = 0;
  const film = {
    cam: null,          // () => ({ pos: [x, y, z], look: [x, y, z], fov, roll, focus }) or null for the game's own view
    skip: false,        // true: nothing is drawn (hurrying to a moment)
    own: false,         // false: the game's own slow motion and shake are put out
    // the look of a shot. Light directions are where the light stands, measured from the subject (x to his left as he runs, y up, z behind him).
    L: { key: [5, 9, -6], keyColor: 0xcfdcff, keyPower: 3.2, rim: [-6, 4, 9], rimColor: 0xffb070, rimPower: 2.2, fill: null, fillColor: 0xffc890, fillPower: 0, amb: 0.55, moon: 0.25,
      exposure: 1.05, bloom: 0.3, bloomAt: 0.9, bloomRadius: 0.7, blur: 0, aperture: 0.0004, span: 16, subject: null, fog: null, env: null, winds: false },
    look(o) { Object.assign(film.L, o); return film.L; },
    // before the game draws: lights, camera
    frame() {
      const L = film.L, h = hero();
      if (!film.own) { state.slowT = 0; state.tscale = 1; state.shake = 0; state.held = null; }
      if (!L.winds && world()) for (const c of world().chunks.values()) if (c.winds) for (const w of c.winds) w.mesh.visible = false;      // the rings of wind are things of play, not of a film
      if (L.subject) at.set(...L.subject); else if (h) { at.copy(h.root.position); at.y += h.y + 1.0 * h.root.scale.x; }
      key.color.set(L.keyColor); key.intensity = L.keyPower; key.position.copy(at).add(v.set(...L.key)); key.target.position.copy(at);
      const s = L.span, c = key.shadow.camera; if (c.right !== s) { c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 0.5; c.far = 80; c.updateProjectionMatrix(); }
      rim.color.set(L.rimColor); rim.intensity = L.rimPower; rim.position.copy(at).add(v.set(...L.rim)); rim.target.position.copy(at);
      if (L.fill) { fill.color.set(L.fillColor); fill.intensity = L.fillPower; fill.position.copy(at).add(v.set(...L.fill)); } else fill.intensity = 0;
      hemi.intensity *= L.amb; moon.intensity *= L.moon;
      if (L.fog !== null) scene.fog.density = L.fog;
      if (L.env !== null) scene.environmentIntensity = L.env;
      renderer.toneMappingExposure = L.exposure;
      if (n++ % 20 === 0 || scene.children.length !== seen) {      // whatever has come into the world since casts and takes shadow (not light itself: flames, glows, mist)
        seen = scene.children.length;
        scene.traverse(o => { if (!o.isMesh || o.userData.filmed) return; o.userData.filmed = true; const m = Array.isArray(o.material) ? o.material[0] : o.material;
          const solid = m && !m.transparent && m.blending === THREE.NormalBlending && m.depthWrite !== false && !m.isMeshBasicMaterial && !m.isShaderMaterial; o.castShadow = !!solid; o.receiveShadow = !!solid; });
      }
      if (film.cam) {
        const c2 = film.cam(); if (c2) {
          camera.position.set(...c2.pos); look.set(...c2.look); camera.up.set(0, 1, 0); camera.lookAt(look); if (c2.roll) camera.rotateZ(c2.roll);
          if (c2.fov && Math.abs(camera.fov - c2.fov) > 0.001) { camera.fov = c2.fov; camera.updateProjectionMatrix(); }
          film.focus = c2.focus ?? camera.position.distanceTo(look);
        }
      } else film.focus = h ? camera.position.distanceTo(at) : 6;
    },
    render() {
      if (film.skip) return;
      const L = film.L; renderer.getDrawingBufferSize(size);
      if (composer._w !== size.x || composer._h !== size.y) { composer._w = size.x; composer._h = size.y; composer.setPixelRatio(1); composer.setSize(size.x, size.y); }
      bloom.strength = L.bloom; bloom.threshold = L.bloomAt; bloom.radius = L.bloomRadius; bloom.enabled = L.bloom > 0;
      bokeh.enabled = L.blur > 0; if (bokeh.enabled) { bokeh.uniforms.focus.value = film.focus; bokeh.uniforms.aperture.value = L.aperture; bokeh.uniforms.maxblur.value = L.blur; bokeh.uniforms.aspect.value = camera.aspect; bokeh.uniforms.nearClip.value = camera.near; bokeh.uniforms.farClip.value = camera.far; }
      composer.render();
    },
    lights: { key, rim, fill },
  };
  return film;
}
