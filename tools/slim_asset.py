# Slim a Lux3D model for phones: join, decimate to a triangle budget, shrink textures, export a small GLB.
# blender -b -P tools/slim_asset.py -- <in.glb> <out.glb> <target_tris> <tex_px> [draco]
import bpy, sys, os
argv = sys.argv[sys.argv.index('--') + 1:]
src, out, target, tex_px = argv[0], argv[1], int(argv[2]), int(argv[3])
draco = len(argv) > 4 and argv[4] == 'draco'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
# glTF splits vertices along UV seams; weld them first or the decimation tears the surface open along every seam
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.object.mode_set(mode='OBJECT')
if tris > target:
    mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris
    bpy.ops.object.modifier_apply(modifier='dec')
bpy.ops.object.shade_smooth()
maps = []
for img in bpy.data.images:
    if img.size[0] > 0:
        maps.append(f'{img.name}:{img.size[0]}')
        if max(img.size) > tex_px: img.scale(tex_px, tex_px)
ob.name = os.path.splitext(os.path.basename(out))[0]
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_image_format='JPEG',
                          export_jpeg_quality=80, export_draco_mesh_compression_enable=draco)
print('SLIM', ob.name, tris, '->', sum(len(p.vertices) - 2 for p in ob.data.polygons), 'tris; maps', ' '.join(maps),
      '->', tex_px, 'px;', round(os.path.getsize(out) / 1e6, 2), 'MB')
