# Make a game character from a Lux3D auto-rigged model with its retargeted animations (one GLB holding the mesh, the
# skeleton and every animation): weld, slim to a triangle budget, shrink the textures, give the animations their names.
# blender -b -P tools/build_lux_character.py -- <animation.glb> <out.glb> <target_tris> <tex_px> <name1,name2,...>
# The names are the animations in the order they were asked for (the file calls them animation_1, animation_2, ...).
import bpy, sys, os, re

argv = sys.argv[sys.argv.index('--') + 1:]
src, out, target, tex_px, names = argv[0], argv[1], int(argv[2]), int(argv[3]), argv[4].split(',')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature()]
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in meshes]:
    bpy.data.objects.remove(o, do_unlink=True)      # the importer's own bone markers

acts = sorted(bpy.data.actions, key=lambda a: int(re.search(r'(\d+)', a.name).group(1)))
for a, n in zip(acts, names):
    a.name = n; a.use_fake_user = True
    print('ACTION', n, round((a.frame_range[1] - a.frame_range[0]) / bpy.context.scene.render.fps, 2), 's')

for m in meshes:
    bpy.ops.object.select_all(action='DESELECT'); m.select_set(True); bpy.context.view_layer.objects.active = m
    before = sum(len(p.vertices) - 2 for p in m.data.polygons)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)      # the importer splits the surface along texture seams: weld before slimming
    bpy.ops.object.mode_set(mode='OBJECT')
    tris = sum(len(p.vertices) - 2 for p in m.data.polygons)
    if tris > target:
        mod = m.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris
        m.modifiers.move(len(m.modifiers) - 1, 0)
        bpy.ops.object.modifier_apply(modifier='dec')
    bpy.ops.object.shade_smooth()
    print('MESH', m.name, before, '->', sum(len(p.vertices) - 2 for p in m.data.polygons), 'tris')

for img in bpy.data.images:
    if img.size[0] > tex_px:
        img.scale(tex_px, tex_px)

# every animation on its own track, so the exporter writes each as a separate clip
if arm.animation_data:
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(tr)
else:
    arm.animation_data_create()
for a in acts[:len(names)]:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name
    tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
for a in list(bpy.data.actions):
    if a not in acts[:len(names)]:
        bpy.data.actions.remove(a)

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_image_format='JPEG', export_jpeg_quality=85, export_apply=True, export_skins=True)
print('EXPORTED', out, round(os.path.getsize(out) / 1e6, 2), 'MB')
