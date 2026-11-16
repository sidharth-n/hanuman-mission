# A rigged character frozen in one pose as a plain light mesh, for crowds that are drawn many times and never move.
# blender -b -P tools/pose_static.py -- <character.glb> <out.glb> <clip name> <frame> <target_tris> <tex_px>
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
src, out, clip, frame, target, tex_px = argv[0], argv[1], argv[2], int(argv[3]), int(argv[4]), int(argv[5])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature())
act = next(a for a in bpy.data.actions if a.name.startswith(clip))
if arm.animation_data:
    for tr in arm.animation_data.nla_tracks: tr.mute = True
else:
    arm.animation_data_create()
arm.animation_data.action = act
bpy.context.scene.frame_set(frame)
dg = bpy.context.evaluated_depsgraph_get()
data = bpy.data.meshes.new_from_object(mesh.evaluated_get(dg))
still = bpy.data.objects.new('figure', data); bpy.context.scene.collection.objects.link(still)
still.matrix_world = mesh.matrix_world.copy()
for o in [o for o in bpy.context.scene.objects if o is not still]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT'); still.select_set(True); bpy.context.view_layer.objects.active = still
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.object.mode_set(mode='OBJECT')
tris = sum(len(p.vertices) - 2 for p in data.polygons)
if tris > target:
    mod = still.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris; bpy.ops.object.modifier_apply(modifier='dec')
bpy.ops.object.shade_smooth()
for img in bpy.data.images:
    if img.size[0] > tex_px: img.scale(tex_px, tex_px)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_image_format='JPEG', export_jpeg_quality=82, export_apply=True)
print('STATIC', out, sum(len(p.vertices) - 2 for p in still.data.polygons), 'tris', round(os.path.getsize(out) / 1e3), 'kB')
