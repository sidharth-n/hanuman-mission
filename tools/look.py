# A picture of a character's file, alone: straight on and from a little to one side, lit plainly, colours as the file has them.
#   blender -b -P tools/look.py -- <file.glb> <out.png> <centre x,y,z> <width> [turn in degrees]
import bpy, sys, math
from mathutils import Vector
src, out, centre, width, *more = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'; sc.display.shading.show_shadows = False; sc.display.shading.show_cavity = False
sc.view_settings.view_transform = 'Standard'; sc.render.resolution_x = 1600; sc.render.resolution_y = 800; sc.render.image_settings.file_format = 'PNG'
w = bpy.data.worlds.new('w'); sc.world = w; w.color = (0.03, 0.035, 0.05)
meshes = [o for o in sc.objects if o.type == 'MESH' and o.find_armature()]
lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
for o in meshes:
    for c in o.bound_box:
        p = o.matrix_world @ Vector(c)
        for i in range(3): lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
print('BOUNDS', [round(x, 3) for x in lo], [round(x, 3) for x in hi])
c = Vector([float(x) for x in centre.split(',')]); turn = math.radians(float(more[0])) if more else 0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = float(width)
f = Vector((math.sin(turn), math.cos(turn), -0.08)).normalized()
cam.location = c - f * 6; cam.rotation_euler = f.to_track_quat('-Z', 'Z').to_euler()
sc.render.filepath = out; bpy.ops.render.render(write_still=True); print('LOOK', out)
