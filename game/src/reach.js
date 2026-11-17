import * as THREE from 'three';

// A hand brought to a point in the world and opened to the sky, whatever the clip is doing with that arm: the ring
// held out in Hanuman's palm, the jewel in Sita's. Upper arm and forearm are set so the wrist arrives (the elbow
// hanging below the line from shoulder to hand), and the forearm is then turned about its own length until the palm
// faces up. Which way the palm faces is read from the pose the model was skinned in: arms out, palms down.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _p = new THREE.Quaternion();
const S = new THREE.Vector3(), E = new THREE.Vector3(), W = new THREE.Vector3(), ax = new THREE.Vector3(), n = new THREE.Vector3(), up = new THREE.Vector3(), t = new THREE.Vector3(), m = new THREE.Matrix4(), _s = new THREE.Vector3();

// the bone, as it stands in the world, is turned by q (a rotation in the world); weight: how far
function turn(bone, q, weight) {
  bone.getWorldQuaternion(_w); bone.parent.getWorldQuaternion(_p);
  bone.quaternion.slerp(_p.invert().multiply(_w.premultiply(q)), weight); bone.updateWorldMatrix(false, true);
}
function point(bone, child, dir, weight) {
  bone.getWorldPosition(_a); child.getWorldPosition(_b).sub(_a).normalize();
  turn(bone, _q.setFromUnitVectors(_b, _d.copy(dir).normalize()), weight);
}

export class Reach {
  constructor(model, side = 'Right') {
    const get = name => model.getObjectByName('mixamorig' + side + name);
    this.arm = get('Arm'); this.fore = get('ForeArm'); this.hand = get('Hand'); this.finger = get('HandMiddle1') || get('HandIndex1');
    this.ok = !!(this.arm && this.fore && this.hand);
    this.palm = new THREE.Vector3(0, -1, 0); this.w = 0; this.on = false; this.to = new THREE.Vector3(); this.lift = 0.03;
    this.face = null;      // the way the palm is turned to face, in the world; none: up to the sky
    let skin = null; model.traverse(o => { if (!skin && o.isSkinnedMesh && o.skeleton.bones.includes(this.hand)) skin = o; });
    if (skin && this.ok) { m.copy(skin.skeleton.boneInverses[skin.skeleton.bones.indexOf(this.hand)]).invert().decompose(_a, _q, _s); this.palm.set(0, -1, 0).applyQuaternion(_q.invert()).normalize(); }
  }

  // Each frame, after the clips have moved the bones. to: where the wrist is brought; on: reaching or letting the arm go back.
  update(dt) {
    this.w += ((this.on ? 1 : 0) - this.w) * Math.min(1, dt * 4.5);
    if (!this.ok || this.w < 0.002) return;
    const w = this.w * this.w * (3 - 2 * this.w);
    this.arm.updateWorldMatrix(true, true);
    this.arm.getWorldPosition(S); this.fore.getWorldPosition(E); this.hand.getWorldPosition(W);
    const l1 = S.distanceTo(E), l2 = E.distanceTo(W), d = Math.min(l1 + l2 - 0.002, Math.max(Math.abs(l1 - l2) + 0.002, S.distanceTo(this.to)));
    ax.copy(this.to).sub(S).normalize();
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    n.set(0, -1, 0).addScaledVector(ax, ax.y); if (n.lengthSq() < 1e-6) n.set(0, 0, 1); n.normalize();      // straight down from the line, as far as the line allows
    t.copy(S).addScaledVector(ax, along).addScaledVector(n, off);      // where the elbow goes
    point(this.arm, this.fore, _b.copy(t).sub(S).clone(), w);
    this.fore.getWorldPosition(E);
    point(this.fore, this.hand, t.copy(S).addScaledVector(ax, d).sub(E).clone(), w);
    this.fore.getWorldPosition(E); this.hand.getWorldPosition(W); ax.copy(W).sub(E).normalize();
    this.hand.getWorldQuaternion(_w); n.copy(this.palm).applyQuaternion(_w); n.addScaledVector(ax, -n.dot(ax)).normalize();
    if (this.face) up.copy(this.face); else up.set(0, 1, 0);
    up.addScaledVector(ax, -up.dot(ax)).normalize();
    turn(this.fore, _q.setFromAxisAngle(ax, Math.atan2(t.crossVectors(n, up).dot(ax), n.dot(up))), w);
  }

  // Where a small thing lies in the open hand (pos), and the way the palm faces (normal).
  hold(pos, normal) {
    this.hand.getWorldPosition(pos); this.hand.getWorldQuaternion(_w); normal.copy(this.palm).applyQuaternion(_w).normalize();
    if (this.finger) pos.lerp(this.finger.getWorldPosition(_a), 0.62);
    return pos.addScaledVector(normal, this.lift);
  }
}
