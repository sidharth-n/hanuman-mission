# Sita, put right in Blender. Lux3D left her face smeared and her fingers run together. Her face and the backs of her
# hands are repainted from redrawn pictures (tools/retouch.py), the lumps are eased out of both, and the game's file is
# slimmed so that face and hands keep a good share of the triangles.
#
#   blender -b -P tools/retouch.py -- sita assets/rig/lux3d/sita-anim.glb assets/rig/polish/sita      (the pictures)
#   ... each <part>-before.png is redrawn as <part>-after.png, features kept in place ...
#   blender -b -P tools/sita_fix.py -- assets/rig/lux3d/sita-anim.glb assets/rig/polish/sita game/public/assets/sita.glb 45000 2048
import bpy, bmesh, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ravana_fix as R, retouch as T

NAMES = 'idle,talk,no,sit,sit_talk,sit_exit,sit_enter,give,yes,walk'.split(',')
def face(p): return p.z > 0.625 and p.y < -0.02 and abs(p.x) < 0.11
def hand(p): return abs(p.x) > 0.625
def fine(p): return face(p) or hand(p)


def weld(o):
    bm = R.edit(o); n = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); m = len(bm.verts); R.keep(o, bm)
    return f'welded: {n} -> {m} points'


# The small lumps eased out of the face and the hands; the shapes stay.
def ease(o, rounds_face=6, rounds_hand=3):
    bm = R.edit(o); mw = o.matrix_world
    for where, rounds in ((face, rounds_face), (hand, rounds_hand)):
        verts = [v for v in bm.verts if where(mw @ v.co) and not v.is_boundary]
        for _ in range(rounds): bmesh.ops.smooth_vert(bm, verts=verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    R.keep(o, bm)
    return f'face and hands eased ({rounds_face} and {rounds_hand} passes)'


def repaint(o, pictures, parts=('face', 'hand_l', 'hand_r')):
    said = []
    for name in parts:
        after = next((os.path.join(pictures, f'{name}-after.{e}') for e in ('png', 'jpg') if os.path.exists(os.path.join(pictures, f'{name}-after.{e}'))), None)
        if not after: said.append(f'{name}: no redrawn picture, left as it was'); continue
        said.append(T.project(o, 'sita_' + name, T.VIEWS['sita'][name], os.path.join(pictures, name + '-before.png'), after, os.path.join(pictures, name + '-texture.png')))
    for img in bpy.data.images:
        if img.name.startswith('sita_hand') and img.size[0] > 512: img.scale(512, 512)
    return '; '.join(said)


if __name__ == '__main__' and '--' in sys.argv:
    src, pictures, out, tris, tex = sys.argv[sys.argv.index('--') + 1:][:5]
    arm, o = R.load(src); T.rest(arm)
    print('STEP', weld(o)); print('STEP', ease(o)); print('STEP', repaint(o, pictures))
    print('STEP', R.slim(o, int(tris), 0.42, fine)); print('STEP', R.export(arm, out, int(tex), NAMES))
