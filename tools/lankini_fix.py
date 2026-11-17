# Lankini, put right in Blender: her face repainted from a redrawn picture (tools/retouch.py), the lumps eased out of
# face and hands, and the game's file slimmed so that they keep a good share of the triangles.
#
#   blender -b -P tools/retouch.py -- lankini assets/rig/lux3d/lankini-anim.glb assets/rig/polish/lankini      (the picture)
#   blender -b -P tools/lankini_fix.py -- assets/rig/lux3d/lankini-anim.glb assets/rig/polish/lankini game/public/assets/lankini.glb 65000 2048
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ravana_fix as R, retouch as T

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


def repaint(o, pictures):
    after = next((os.path.join(pictures, f'face-after.{e}') for e in ('png', 'jpg') if os.path.exists(os.path.join(pictures, f'face-after.{e}'))), None)
    if not after: return 'face: no redrawn picture, left as it was'
    return T.project(o, 'lankini_face', T.VIEWS['lankini']['face'], os.path.join(pictures, 'face-before.png'), after, os.path.join(pictures, 'face-texture.png'))


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
    src, pictures, out, tris, tex = sys.argv[sys.argv.index('--') + 1:][:5]
    arm, o = R.load(src); T.rest(arm)
    print('STEP', weld(o)); print('STEP', ease(o)); print('STEP', repaint(o, pictures))
    print('STEP', R.slim(o, int(tris), 0.16, fine)); print('STEP', R.export(arm, out, int(tex), NAMES))
