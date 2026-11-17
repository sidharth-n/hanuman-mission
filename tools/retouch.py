# Retouching a Lux3D character's texture where the generator left it smeared (a face, the hands), in three steps:
#   1. view:    a flat, shadowless picture of the part is taken straight on (colour only, as the texture holds it);
#   2. the picture is redrawn outside Blender, every feature kept exactly where it is;
#   3. project: the redrawn picture is laid back over the same part through the same view, as a texture of its own,
#               so the part is far sharper than the body's shared texture allows. Toward its edge the new picture gives
#               way to the old colour, so no seam shows where the two materials meet.
# The views are named in VIEWS below, per character. Used by sita_fix.py; as a script it only takes the pictures:
#   blender -b -P tools/retouch.py -- <character> <anim.glb> <out-dir>
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector

# centre: the middle of the picture (model space); size: its width and height; toward: the way the camera looks;
# up: which way is up in the picture; facing: how squarely a face must look at the camera to be repainted (cosine);
# box: the part of the model the view may touch (min, max); feather: how far in from the picture's edge the new gives way
# match: patches of skin (column, row from the top, radius, in picture pixels) where the redrawn picture is brought to
# the old picture's tone, so the part still matches the neck and arms beside it
VIEWS = {
    'sita': {
        'face': dict(centre=(-0.003, 0.0, 0.722), size=0.27, toward=(0, 1, 0), up=(0, 0, 1), facing=0.25,
                     box=((-0.14, -0.2, 0.60), (0.14, 0.0, 0.86)), oval=(-0.003, 0.722, 0.075, 0.118),
                     match=((330, 700, 36), (700, 700, 36))),
        'hand_l': dict(centre=(0.705, -0.035, 0.46), size=0.21, toward=(0, 0, -1), up=(0, 1, 0), facing=0.2,
                       box=((0.615, -0.14, 0.38), (0.82, 0.07, 0.56)), oval=None, match=((330, 470, 40),)),
        'hand_r': dict(centre=(-0.715, -0.035, 0.455), size=0.21, toward=(0, 0, -1), up=(0, 1, 0), facing=0.2,
                       box=((-0.83, -0.14, 0.38), (-0.625, 0.07, 0.56)), oval=None, match=((690, 470, 40),)),
    },
    # Ravana's faces, after ravana_fix has put the heads right (ravana_faces.py): the great head, and the row of small
    # heads on either side of it, each row in one picture (they all look forward)
    'ravana': {
        'face': dict(centre=(0.0, 0.0, 0.79), size=0.40, toward=(0, 1, 0), up=(0, 0, 1), facing=0.25,
                     box=((-0.17, -0.5, 0.64), (0.17, -0.1, 0.94)), oval=(0.0, 0.785, 0.115, 0.135), match=((512, 700, 30),)),
        'heads_l': dict(centre=(0.64, 0.0, 0.79), size=1.0, toward=(0, 1, 0), up=(0, 0, 1), facing=-0.35,
                        box=((0.16, -0.5, 0.64), (1.13, 0.2, 0.875)), oval=None, match=None, rim=(0.004, 0.02), close=28),
        'heads_r': dict(centre=(-0.56, 0.0, 0.79), size=0.86, toward=(0, 1, 0), up=(0, 0, 1), facing=-0.35,
                        box=((-0.97, -0.5, 0.64), (-0.16, 0.2, 0.875)), oval=None, match=None, rim=(0.004, 0.02), close=28),
    },
    'lankini': {
        'face': dict(centre=(0.008, 0.0, 0.93), size=0.36, toward=(0, 1, 0), up=(0, 0, 1), facing=0.25,
                     box=((-0.17, -0.4, 0.76), (0.19, -0.05, 1.10)), oval=(0.008, 0.925, 0.095, 0.125), match=((318, 597, 30), (705, 597, 30))),
        # her hands, seen from above with her arms out (Sid, 18 Nov: "fix the hand or fingers of lankini, it's not good")
        'hand_l': dict(centre=(0.97, -0.06, 0.47), size=0.40, toward=(0, 0, -1), up=(0, 1, 0), facing=0.2,
                       box=((0.82, -0.24, 0.36), (1.22, 0.12, 0.58)), oval=None, match=None),
        'hand_r': dict(centre=(-0.97, -0.06, 0.47), size=0.40, toward=(0, 0, -1), up=(0, 1, 0), facing=0.2,
                       box=((-1.22, -0.24, 0.36), (-0.82, 0.12, 0.58)), oval=None, match=None),
    },
    # near: how far above the picture's middle the view begins, so what stands over the part (his legs, over his feet) is not in it
    'hanuman': {
        'face': dict(centre=(0.0, 0.0, 1.588), size=0.50, toward=(0, 1, 0), up=(0, 0, 1), facing=0.25,
                     box=((-0.24, -0.4, 1.35), (0.24, 0.0, 1.83)), oval=(0.0, 1.588, 0.16, 0.215), match=((369, 754, 30), (655, 754, 30))),
        'hand_l': dict(centre=(0.80, -0.05, 1.237), size=0.30, toward=(0, 0, -1), up=(0, 1, 0), facing=0.2, near=0.2,
                       box=((0.67, -0.22, 1.1), (0.93, 0.12, 1.4)), oval=None, match=((490, 490, 40),)),
        'hand_r': dict(centre=(-0.80, -0.05, 1.237), size=0.30, toward=(0, 0, -1), up=(0, 1, 0), facing=0.2, near=0.2,
                       box=((-0.93, -0.22, 1.1), (-0.67, 0.12, 1.4)), oval=None, match=((512, 480, 40),)),
        'feet': dict(centre=(0.0, -0.125, 0.05), size=0.64, toward=(0, 0, -1), up=(0, -1, 0), facing=0.2, near=0.13,
                     box=((-0.3, -0.3, 0.0), (0.3, 0.06, 0.16)), oval=None, match=((230, 393, 25), (802, 393, 25))),
    },
}
PX = 1024


def axes(v):
    f = Vector(v['toward']).normalized(); u = Vector(v['up']).normalized(); r = f.cross(u).normalized()
    return r, u, f


def rest(arm):
    if arm.animation_data: arm.animation_data.action = None
    for pb in arm.pose.bones: pb.matrix_basis.identity()
    bpy.context.view_layer.update()


# 1. The pictures: colour only, no light or shadow, straight on.
def take(views, out_dir):
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'; sc.display.shading.show_backface_culling = True
    sc.view_settings.view_transform = 'Standard'; sc.render.film_transparent = False
    sc.render.resolution_x = sc.render.resolution_y = PX; sc.render.image_settings.file_format = 'PNG'
    w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.5, 0.5, 0.5)
    cam = bpy.data.objects.new('view', bpy.data.cameras.new('view')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; os.makedirs(out_dir, exist_ok=True)
    for name, v in views.items():
        r, u, f = axes(v); cam.data.ortho_scale = v['size']; cam.data.clip_start = 2 - v['near'] if v.get('near') else 0.1
        cam.location = Vector(v['centre']) - f * 2
        cam.rotation_euler = f.to_track_quat('-Z', 'Y').to_euler()
        # the track leaves the roll free: turn the camera about its own axis until its up is the view's up
        bpy.context.view_layer.update(); cu = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
        roll = math.atan2(cu.cross(u).dot(f), cu.dot(u)); cam.rotation_euler.rotate_axis('Z', -roll)
        bpy.context.view_layer.update(); cu = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
        if cu.dot(u) < 0.99: cam.rotation_euler.rotate_axis('Z', 2 * roll)
        sc.render.filepath = os.path.join(out_dir, name + '-before.png'); bpy.ops.render.render(write_still=True)
        print('VIEW', name, sc.render.filepath)
    bpy.data.objects.remove(cam, do_unlink=True)


def pixels(path, size=None):
    img = bpy.data.images.load(path, check_existing=False)
    if size and tuple(img.size) != (size, size): img.scale(size, size)
    w, h = img.size; a = np.empty(w * h * 4, 'f'); img.pixels.foreach_get(a); bpy.data.images.remove(img)
    return a.reshape(h, w, 4)


# 3. The redrawn picture laid back over the part, as its own material. before/after: the two pictures of step 1 and 2.
def project(o, name, v, before, after, out_png, strength=1.0):
    old, new = pixels(before, PX), pixels(after, PX)
    yy, xx = np.mgrid[0:PX, 0:PX].astype('f'); s = v['size']
    if v.get('oval'):      # the new picture holds inside an oval (a face), fading out over its rim
        cx, cz, rx, rz = v['oval']; r, u, f = axes(v); c = Vector(v['centre'])
        ox = ((Vector((cx, 0, cz)) - c).dot(r) / s + 0.5) * PX; oy = ((Vector((cx, 0, cz)) - c).dot(u) / s + 0.5) * PX
        d = np.sqrt(((xx - ox) / (rx / s * PX)) ** 2 + ((yy - oy) / (rz / s * PX)) ** 2)
        mask = np.clip((1.0 - d) / 0.22, 0, 1)
    else:      # or wherever the part itself is in the picture (not the grey behind it), fading at its outline
        part = (np.abs(old[..., :3] - 0.5).max(axis=2) > 0.03).astype('f')
        if v.get('close'):      # a grey smear inside the part (the generator's blind eyes) is still the part: holes up to so many pixels across are closed
            n = int(v['close']); grown = part
            for _ in range(n): grown = np.maximum.reduce([grown, np.roll(grown, 1, 0), np.roll(grown, -1, 0), np.roll(grown, 1, 1), np.roll(grown, -1, 1)])
            for _ in range(n): grown = np.minimum.reduce([grown, np.roll(grown, 1, 0), np.roll(grown, -1, 0), np.roll(grown, 1, 1), np.roll(grown, -1, 1)])
            part = grown
        for _ in range(10): part = np.minimum(part, (np.roll(part, 1, 0) + np.roll(part, -1, 0) + np.roll(part, 1, 1) + np.roll(part, -1, 1) + part) / 5)
        mask = np.clip(part * 1.6 - 0.3, 0, 1)
        ground = new[4:40, 4:40, :3].reshape(-1, 3).mean(axis=0)      # and never where the redrawn picture shows only its background
        mask *= np.clip((np.abs(new[..., :3] - ground).max(axis=2) - 0.05) / 0.05, 0, 1)
    if v.get('match'):
        def tone(a): return np.mean([a[PX - 1 - row - rad:PX - 1 - row + rad, col - rad:col + rad, :3].reshape(-1, 3).mean(axis=0) for col, row, rad in v['match']], axis=0)
        gain = tone(old) / np.maximum(tone(new), 1e-3); new = new.copy(); new[..., :3] = np.clip(new[..., :3] * gain, 0, 1)
        print('TONE', name, [round(float(g), 3) for g in gain])
    edge = np.minimum(np.minimum(xx, PX - 1 - xx), np.minimum(yy, PX - 1 - yy)) / PX      # and it gives way toward the picture's own edge (a wrist)
    lo_, span = v.get('rim', (0.03, 0.12))      # rim: where the fade toward the picture's edge begins and how wide it is (a row of heads runs right up to the edge)
    mask = mask * np.clip((edge - lo_) / span, 0, 1)
    mask = (mask * mask * (3 - 2 * mask) * strength)[..., None]
    mix = old.copy(); mix[..., :3] = old[..., :3] * (1 - mask) + new[..., :3] * mask; mix[..., 3] = 1
    img = bpy.data.images.new(name, PX, PX, alpha=False); img.pixels.foreach_set(mix.ravel())
    img.filepath_raw = out_png; img.file_format = 'PNG'; img.save(); img.pack()
    # a material like the body's, with this picture for its colour
    body = o.data.materials[0]; mat = body.copy(); mat.name = name
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = bsdf.inputs['Base Color'].links[0].from_node; tex.image = img
    for l in list(bsdf.inputs['Normal'].links): mat.node_tree.links.remove(l)      # the body's relief map is laid out for the body's texture, not this one
    for k, val in (('Metallic', 0.0), ('Roughness', 0.62)):
        for l in list(bsdf.inputs[k].links): mat.node_tree.links.remove(l)
        bsdf.inputs[k].default_value = val
    o.data.materials.append(mat); slot = len(o.data.materials) - 1
    bm = bmesh.new(); bm.from_mesh(o.data); uvl = bm.loops.layers.uv.active; mw = o.matrix_world
    r, u, f = axes(v); c = Vector(v['centre']); lo, hi = Vector(v['box'][0]), Vector(v['box'][1]); n = 0
    def uv(p): return ((p - c).dot(r) / s + 0.5, (p - c).dot(u) / s + 0.5)
    for face in bm.faces:
        P = [mw @ x.co for x in face.verts]
        if not all(lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y and lo.z <= p.z <= hi.z for p in P): continue
        if (mw.to_3x3() @ face.normal).normalized().dot(-f) < v['facing']: continue
        T = [uv(p) for p in P]
        if not all(0.02 < a < 0.98 and 0.02 < b < 0.98 for a, b in T): continue
        if v.get('oval'):
            cx, cz, rx, rz = v['oval']
            if not all(((p.x - cx) / (rx * 1.3)) ** 2 + ((p.z - cz) / (rz * 1.3)) ** 2 < 1 for p in P): continue
        face.material_index = slot; n += 1
        for l, t in zip(face.loops, T): l[uvl].uv = t
    bm.to_mesh(o.data); bm.free(); o.data.update()
    return f'{name}: {n} faces repainted from {os.path.basename(after)}'


if __name__ == '__main__' and '--' in sys.argv:
    who, src, out = sys.argv[sys.argv.index('--') + 1:][:3]
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    for x in [x for x in bpy.context.scene.objects if x.type == 'MESH' and not x.find_armature()]: bpy.data.objects.remove(x, do_unlink=True)
    rest(arm); take(VIEWS[who], out)
