# Clean game mesh from a Lux3D high-poly: watertight voxel remesh -> even decimate -> new UVs -> bake colour + normal.
# blender -b -P tools/remesh_bake.py -- <high.glb> <out_dir> <name> <target_tris> <tex_px> <height_m> <voxel_m>
import bpy, sys, os, mathutils, time

argv = sys.argv[sys.argv.index('--') + 1:]
src, out_dir, name = argv[0], argv[1], argv[2]
target, tex_px, height, voxel = int(argv[3]), int(argv[4]), float(argv[5]), float(argv[6])
os.makedirs(out_dir, exist_ok=True)
t0 = time.time()
def log(*a): print('STEP', round(time.time() - t0), 's', *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects: o.select_set(o in meshes)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']: bpy.data.objects.remove(o)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# same normalisation as the Mixamo prep: 1.8 m tall, feet at 0, centred
bb = [high.matrix_world @ mathutils.Vector(c) for c in high.bound_box]
s = height / (max(v.z for v in bb) - min(v.z for v in bb)); high.scale = (s, s, s)
bpy.ops.object.transform_apply(scale=True)
bb = [high.matrix_world @ mathutils.Vector(c) for c in high.bound_box]
high.location -= mathutils.Vector(((min(v.x for v in bb) + max(v.x for v in bb)) / 2, (min(v.y for v in bb) + max(v.y for v in bb)) / 2, min(v.z for v in bb)))
bpy.ops.object.transform_apply(location=True)
high.name = name + '_high'
log('high', sum(len(p.vertices) - 2 for p in high.data.polygons), 'tris')

# low = watertight voxel remesh, then even decimate
bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); bpy.context.view_layer.objects.active = high
bpy.ops.object.duplicate(); low = bpy.context.view_layer.objects.active; low.name = name
low.data.materials.clear()
low.data.remesh_voxel_size = voxel; low.data.use_remesh_fix_poles = True
bpy.ops.object.voxel_remesh()
log('remeshed', len(low.data.polygons), 'faces')
tris = sum(len(p.vertices) - 2 for p in low.data.polygons)
mod = low.modifiers.new('dec', 'DECIMATE'); mod.ratio = target / tris; mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
bpy.ops.object.shade_smooth()
log('decimated', sum(len(p.vertices) - 2 for p in low.data.polygons), 'tris')

# new UVs
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
log('uv done')

# bake targets
mat = bpy.data.materials.new(name + 'Skin'); mat.use_nodes = True; low.data.materials.append(mat)
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
col = bpy.data.images.new(name + '_color', tex_px, tex_px); nrm = bpy.data.images.new(name + '_normal', tex_px, tex_px)
nrm.colorspace_settings.name = 'Non-Color'
n_col = nt.nodes.new('ShaderNodeTexImage'); n_col.image = col
n_nrm = nt.nodes.new('ShaderNodeTexImage'); n_nrm.image = nrm
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.03; bk.max_ray_distance = 0.12; bk.margin = 8
bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
nt.nodes.active = n_col
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
log('baked colour')
nt.nodes.active = n_nrm
bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
log('baked normal')
for img, fn in ((col, name + '_color.png'), (nrm, name + '_normal.png')):
    img.filepath_raw = os.path.join(out_dir, fn); img.file_format = 'PNG'; img.save()

# wire the material and export the clean low-poly only
nt.links.new(n_col.outputs['Color'], bsdf.inputs['Base Color'])
nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n_nrm.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.75
bpy.data.objects.remove(high, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + '_clean.glb'), export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=90)
bpy.ops.export_scene.fbx(filepath=os.path.join(out_dir, name + '_clean_mixamo.fbx'), use_selection=True, path_mode='COPY', embed_textures=True, axis_forward='-Z', axis_up='Y')
log('exported')
