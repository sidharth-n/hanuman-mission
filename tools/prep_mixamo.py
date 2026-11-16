# blender -b -P tools/prep_mixamo.py -- in.glb out.fbx target_tris
import bpy, sys, os, mathutils
argv = sys.argv[sys.argv.index('--')+1:]; src, out, target = argv[0], argv[1], int(argv[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
# weld the UV-seam splits first, or decimation tears holes along every seam
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.object.mode_set(mode='OBJECT')
if tris > target:
    mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris
    bpy.ops.object.modifier_apply(modifier='dec')
# scale to 1.8 m tall, feet on the ground, centred
bb = [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
h = max(v.z for v in bb) - min(v.z for v in bb); s = 1.8 / h
ob.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
bb = [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
ob.location -= mathutils.Vector(((min(v.x for v in bb)+max(v.x for v in bb))/2, (min(v.y for v in bb)+max(v.y for v in bb))/2, min(v.z for v in bb)))
bpy.ops.object.transform_apply(location=True)
ob.name = os.path.splitext(os.path.basename(out))[0]
print('TRIS', sum(len(p.vertices) - 2 for p in ob.data.polygons), 'HEIGHT', round(max((ob.matrix_world @ mathutils.Vector(c)).z for c in ob.bound_box), 3))
bpy.ops.export_scene.fbx(filepath=out, use_selection=False, path_mode='COPY', embed_textures=True, apply_unit_scale=True, axis_forward='-Z', axis_up='Y')
