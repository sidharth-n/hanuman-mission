# Hanuman's face, hands and feet repainted from redrawn pictures (tools/retouch.py). He is rigged by Mixamo, so he is
# put together here the way tools/build_character.py does it: the skinned FBX, then the Lux3D texture.
#
#   blender -b -P tools/hanuman_fix.py -- pictures assets/rig/polish/hanuman      (the flat pictures to redraw)
import bpy, bmesh, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import retouch as T

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIN = os.path.join(ROOT, 'assets/rig/mixamo/Breathing Idle.fbx'); TEX = os.path.join(ROOT, 'assets/rig/hero-noproj/hanuman_clean.glb')
PARTS = ('face', 'hand_l', 'hand_r', 'feet')


def load(empty=True):
    if empty: bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=SKIN, automatic_bone_orientation=False)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE'); o = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
    arm.name = 'Hanuman'
    had = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=TEX)
    new = [x for x in bpy.data.objects if x not in had]
    mat = next(x.data.materials[0] for x in new if x.type == 'MESH' and x.data.materials); mat.name = 'HanumanSkin'
    for x in new: bpy.data.objects.remove(x, do_unlink=True)
    o.data.materials.clear(); o.data.materials.append(mat)
    bm = bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); bm.to_mesh(o.data); bm.free()      # a few faces came in turned inside out
    for p in o.data.polygons: p.use_smooth = True
    o.data.update()
    return arm, o


def repaint(o, pictures, parts=PARTS):
    said = []
    for name in parts:
        after = next((os.path.join(pictures, f'{name}-after.{e}') for e in ('png', 'jpg') if os.path.exists(os.path.join(pictures, f'{name}-after.{e}'))), None)
        if not after: said.append(f'{name}: no redrawn picture, left as it was'); continue
        said.append(T.project(o, 'hanuman_' + name, T.VIEWS['hanuman'][name], os.path.join(pictures, name + '-before.png'), after, os.path.join(pictures, name + '-texture.png')))
    return '; '.join(said)


if __name__ == '__main__' and '--' in sys.argv:
    argv = sys.argv[sys.argv.index('--') + 1:]
    if argv[0] == 'pictures':
        arm, o = load(); T.rest(arm); T.take(T.VIEWS['hanuman'], argv[1])
