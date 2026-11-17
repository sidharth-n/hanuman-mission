# Lankini, put right in Blender: her face repainted from a redrawn picture (tools/retouch.py), the lumps eased out of
# face and hands, and the game's file slimmed so that they keep a good share of the triangles.
#
#   blender -b -P tools/retouch.py -- lankini assets/rig/lux3d/lankini-anim.glb assets/rig/polish/lankini      (the picture)
#   blender -b -P tools/lankini_fix.py -- assets/rig/lux3d/lankini-anim.glb assets/rig/polish/lankini game/public/assets/lankini.glb 65000 2048
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ravana_fix as R, retouch as T
import lankini_hands3d as H

NAMES = 'idle,talk,fold_arms,walk,jog,hook,punch,hit,knockback,death'.split(',')
def face(p): return p.z > 0.78 and p.y < -0.1 and abs(p.x - 0.008) < 0.13
def hand(p): return abs(p.x) > 0.85
def fine(p): return face(p) or hand(p)


def weld(o):
    bm = R.edit(o); n = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); m = len(bm.verts); R.keep(o, bm)
    return f'welded: {n} -> {m} points'


def ease(o, rounds_face=4, rounds_hand=3):
    bm = R.edit(o); mw = o.matrix_world
    for where, rounds in ((face, rounds_face), (hand, rounds_hand)):
        verts = [v for v in bm.verts if where(mw @ v.co) and not v.is_boundary]
        for _ in range(rounds): bmesh.ops.smooth_vert(bm, verts=verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    R.keep(o, bm)
    return f'face and hands eased ({rounds_face} and {rounds_hand} passes)'


# Her hands came from the generator as mittens: one lump with a thumb, the fingers only hinted at. Here three grooves are
# cut along each hand between four fingers, on its back and its palm alike (the hand is pinched toward its own middle
# along three lines that follow its taper), shallow where the fingers leave the knuckles and right through at their tips.
# Arms out as she is rigged: the fingers run along x, lie side by side along y, and the hand is thin along z.
GAPS = (0.265, 0.515, 0.755)      # where the gaps lie across the fingers (the same places tools/lankini_hands.py draws them dark)
WRIST = 0.84                      # where the hand's skin begins beyond the bracer
def fingers(o, depth=0.6, wide=0.0055):
    bm = R.edit(o); mw = o.matrix_world; inv = mw.inverted(); said = []
    step = lambda t: max(0.0, min(1.0, t)) ** 2 * (3 - 2 * max(0.0, min(1.0, t)))
    for side, name in ((1, 'left'), (-1, 'right')):
        faces = [f for f in bm.faces if all((mw @ v.co).x * side > WRIST + 0.02 for v in f.verts)]
        bmesh.ops.subdivide_edges(bm, edges=list({e for f in faces for e in f.edges}), cuts=1, use_grid_fill=True)      # finer, so a groove has points to sit on
        vs = [v for v in bm.verts if (mw @ v.co).x * side > WRIST]
        P = {v: mw @ v.co for v in vs}; tip = max(p.x * side for p in P.values()); span = tip - WRIST
        n = 48; lo = [None] * n; hi = [None] * n; zs = [[] for _ in range(n)]
        for p in P.values():
            u = (p.x * side - WRIST) / span; i = min(n - 1, int(u * n))
            if u < 0.40: continue      # the thumb leaves the hand nearer the wrist than this
            lo[i] = p.y if lo[i] is None else min(lo[i], p.y); hi[i] = p.y if hi[i] is None else max(hi[i], p.y); zs[i].append(p.z)
        ok = [i for i in range(n) if lo[i] is not None and len(zs[i]) > 6]
        ease = lambda a: {i: sum(a[j] for j in ok if abs(j - i) <= 2) / sum(1 for j in ok if abs(j - i) <= 2) for i in ok}
        lo_, hi_ = ease(lo), ease(hi); mid = ease([sum(z) / len(z) if z else 0 for z in zs])
        moved = 0
        for v, p in P.items():
            u = (p.x * side - WRIST) / span; i = min(n - 1, int(u * n))
            if i not in lo_ or u < 0.45: continue
            across = hi_[i] - lo_[i]
            if across < 0.02: continue
            t = (p.y - lo_[i]) / across
            g = max(math.exp(-(((t - a) * across) / wide) ** 2) for a in GAPS)
            if g < 0.02: continue
            d = g * step((u - 0.45) / 0.12) * (depth + (0.97 - depth) * step((u - 0.84) / 0.12))
            q = p.copy(); q.z = mid[i] + (p.z - mid[i]) * (1 - d); v.co = inv @ q; moved += 1
        said.append(f'{name} hand to x {tip:.3f}, {moved} points drawn in')
    R.keep(o, bm)
    return 'fingers cut: ' + '; '.join(said)


def repaint(o, pictures, hands=True):
    after = next((os.path.join(pictures, f'face-after.{e}') for e in ('png', 'jpg') if os.path.exists(os.path.join(pictures, f'face-after.{e}'))), None)
    if not after: return 'face: no redrawn picture, left as it was'
    said = [T.project(o, 'lankini_face', T.VIEWS['lankini']['face'], os.path.join(pictures, 'face-before.png'), after, os.path.join(pictures, 'face-texture.png'))]
    # her hands: the generator left mittens (a lump with a thumb, no fingers); each is repainted from above as a clenched fist
    for name in (('hand_l', 'hand_r') if hands else ()):
        redrawn = next((os.path.join(pictures, f'{name}-after.{e}') for e in ('png', 'jpg') if os.path.exists(os.path.join(pictures, f'{name}-after.{e}'))), None)
        if redrawn: said.append(T.project(o, 'lankini_' + name, T.VIEWS['lankini'][name], os.path.join(pictures, name + '-before.png'), redrawn, os.path.join(pictures, name + '-texture.png')))
    return '; '.join(str(x) for x in said)


# Sword-fighting moves for her, taken from the guards' Mixamo animations. Her skeleton has the same bones by name but
# her own proportions, so each bone is turned, frame by frame, by as much as the guard's bone has turned from his rest
# pose (measured in the world, from the guard's skinned file, since an animation file alone carries no true rest pose).
# Her hips rise and fall with his, scaled to her height; she does not travel (the fight places her), except in the fall.
SWORD = {'Great Sword Idle': 'sword_idle', 'Great Sword Walk': 'sword_walk', 'Great Sword Run': 'sword_run', 'Great Sword Slash': 'sword_slash',
         'Great Sword Impact': 'sword_hit', 'Two Handed Sword Death': 'sword_death'}
def sword_clips(arm, skinned, anim_dir):
    sc = bpy.context.scene; fps = sc.render.fps; had = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=skinned, automatic_bone_orientation=False)
    ref = next(x for x in bpy.data.objects if x not in had and x.type == 'ARMATURE')
    rest_s = {b.name: (ref.matrix_world @ b.matrix_local).to_quaternion() for b in ref.data.bones}
    hips = next(b.name for b in ref.data.bones if b.name.endswith('Hips')); high_s = (ref.matrix_world @ ref.data.bones[hips].matrix_local).translation.z
    for x in [x for x in bpy.data.objects if x not in had]: bpy.data.objects.remove(x, do_unlink=True)
    rest_t = {b.name: (arm.matrix_world @ b.matrix_local).to_quaternion() for b in arm.data.bones}
    frame_t = {b.name: (arm.matrix_world @ b.matrix_local).to_3x3() for b in arm.data.bones}
    high_t = (arm.matrix_world @ arm.data.bones[hips].matrix_local).translation.z; k = high_t / high_s
    order = [b.name for b in arm.data.bones if b.name in rest_s]; parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    made = []
    for f in sorted(os.listdir(anim_dir)):
        name = SWORD.get(os.path.splitext(f)[0])
        if not name: continue
        had = set(bpy.data.objects); bpy.ops.import_scene.fbx(filepath=os.path.join(anim_dir, f), automatic_bone_orientation=False)
        new = [x for x in bpy.data.objects if x not in had]; a = next(x for x in new if x.type == 'ARMATURE'); src = a.animation_data.action
        their = sc.render.fps; sc.render.fps = fps
        first, last = src.frame_range; n = int(round((last - first) / their * fps))
        act = bpy.data.actions.new(name); act.use_fake_user = True; arm.animation_data.action = act
        try:
            if act.slots and arm.animation_data.action_slot is None: arm.animation_data.action_slot = act.slots[0]
        except Exception: pass
        for pb in arm.pose.bones: pb.matrix_basis.identity()
        start = None; prev = {}
        for i in range(n + 1):
            t = first + i * their / fps; sc.frame_set(int(t), subframe=t - int(t))
            pose = {b: (a.matrix_world @ a.pose.bones[b].matrix) for b in order if b in a.pose.bones}
            turn = {b: pose[b].to_quaternion() @ rest_s[b].inverted() @ rest_t[b] for b in pose}      # where her bone should point, in the world
            for b in order:
                if b not in turn: continue
                p = parent[b]; q = rest_t[b].inverted() @ turn[b] if not p or p not in turn else rest_t[b].inverted() @ rest_t[p] @ turn[p].inverted() @ turn[b]
                if b in prev and q.dot(prev[b]) < 0: q.negate()
                prev[b] = q; pb = arm.pose.bones[b]; pb.rotation_quaternion = q; pb.keyframe_insert('rotation_quaternion', frame=i)
            at = pose[hips].translation
            if start is None: start = at.copy()
            move = (at - Vector((start.x, start.y, high_s))) * k if 'death' in name else Vector((0, 0, (at.z - high_s) * k))
            pb = arm.pose.bones[hips]; pb.location = frame_t[hips].inverted() @ move; pb.keyframe_insert('location', frame=i)
        made.append(f'{name} {n}')
        for x in new: bpy.data.objects.remove(x, do_unlink=True)
        bpy.data.actions.remove(src)
    arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis.identity()
    return 'sword moves from the guards: ' + ', '.join(made) + ' frames'


# For looking at her in Blender only: a sword in her right hand (in the game the sword is put there by the game itself).
def show_sword(arm, path, length=1.35):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    parts = [x for x in bpy.data.objects if x not in before]; root = next(x for x in parts if x.parent is None)
    bpy.context.view_layer.update()
    pts = [x.matrix_world @ Vector(c) for x in parts if x.type == 'MESH' for c in x.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); tall = max(p.z for p in pts) - lo.z
    pb = next(b for b in arm.pose.bones if b.name.endswith('RightHand'))
    palm = arm.matrix_world @ ((pb.head + pb.tail) / 2 + (pb.tail - pb.head) * 0.6) + Vector((0, 0, -0.03))
    k = length / tall      # stood on its pommel, it is laid forward out of her fist: the grip in her palm, the blade ahead of her
    want = Matrix.Translation(palm + Vector((0, 0.12 * length, 0))) @ Matrix.Rotation(math.radians(90), 4, 'X') @ Matrix.Scale(k, 4) @ Matrix.Translation(-Vector(((lo.x + max(p.x for p in pts)) / 2, (lo.y + max(p.y for p in pts)) / 2, lo.z)))
    hold = arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))
    root.parent = arm; root.parent_type = 'BONE'; root.parent_bone = pb.name; root.matrix_parent_inverse = Matrix.Identity(4)
    root.matrix_basis = hold.inverted() @ want @ root.matrix_world
    return f'sword in her right hand, {length} long'


if __name__ == '__main__' and '--' in sys.argv:
    src, pictures, out, tris, tex, *more = sys.argv[sys.argv.index('--') + 1:]
    real = 'hands=real' in more      # her hands made as hands (tools/lankini_hands3d.py) in place of grooves cut in the lump
    arm, o = R.load(src); T.rest(arm)
    print('STEP', weld(o)); print('STEP', ease(o))
    if not real: print('STEP', fingers(o))
    print('STEP', repaint(o, pictures, hands=not real))
    print('STEP', R.slim(o, int(tris), 0.24, fine))      # a larger share for face and hands now that the fingers are cut
    if real: print('STEP', H.hands(o, arm))      # after the slimming, so the fingers keep every point they are made of
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print('STEP', sword_clips(arm, os.path.join(root, 'assets/rig/guard/Breathing Idle.fbx'), os.path.join(root, 'assets/rig/guard/anims')))
    print('STEP', R.export(arm, out, int(tex), NAMES + list(SWORD.values())))
