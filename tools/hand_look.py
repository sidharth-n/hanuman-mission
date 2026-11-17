# Close pictures of a character's two hands, alone: the back, the palm, end-on at the fingertips, and from above and in front.
#   blender -b -P tools/hand_look.py -- <file.glb> <out-dir> [width]
import bpy, sys, math, os
from mathutils import Vector
src, out, *more = sys.argv[sys.argv.index('--') + 1:]; width = float(more[0]) if more else 0.34
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'; sc.display.shading.show_shadows = True; sc.display.shading.show_cavity = True
sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x = sc.render.resolution_y = 640; sc.render.image_settings.file_format = 'PNG'
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.16, 0.17, 0.2)
arm = next(o for o in sc.objects if o.type == 'ARMATURE'); arm.animation_data_clear() if arm.animation_data else None
for b in arm.pose.bones: b.matrix_basis.identity()
bpy.context.view_layer.update()
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = width
n = 0
for side in (1, -1):
    hb = arm.pose.bones['mixamorig:' + ('Left' if side > 0 else 'Right') + 'Hand']; c = arm.matrix_world @ hb.head + Vector((0.13 * side, 0.0, 0.0))
    for name, f, up in (('back', Vector((0, 0.001, -1)), 'Y'), ('palm', Vector((0, 0.001, 1)), 'Y'), ('end', Vector((-side, 0.25, -0.35)), 'Z'), ('front', Vector((-0.45 * side, 1, -0.75)), 'Z')):
        f = f.normalized(); cam.location = c - f * 3; cam.rotation_euler = f.to_track_quat('-Z', up).to_euler(); n += 1
        sc.render.filepath = os.path.join(out, '%02d.png' % n); bpy.ops.render.render(write_still=True)
print('HANDS', n)
