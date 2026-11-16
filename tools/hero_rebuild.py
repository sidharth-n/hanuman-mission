# Hero rebuild: watertight remesh, extra density on head and feet, new UVs with a bigger share for the face,
# bake colour + normal from the Lux3D high-poly, then project the approved concept art onto face and feet.
# blender -b -P tools/hero_rebuild.py -- <high.glb> <concept.jpg> <out_dir> <name> <target_tris> <tex_px> <detail_factor>
import bpy, sys, os, bmesh, mathutils, time

argv = sys.argv[sys.argv.index('--') + 1:]
src, concept, out_dir, name = argv[0], argv[1], argv[2], argv[3]
target, tex_px, factor = int(argv[4]), int(argv[5]), float(argv[6])
H = 1.8
# figure bounds inside the 1024 concept image (measured): x 24..1000, y (bottom-up) 16..984
FIG = (24, 1000, 16, 984); IMG = 1024
os.makedirs(out_dir, exist_ok=True)
t0 = time.time()
def log(*a): print('STEP', round(time.time() - t0), 's', *a, flush=True)
def clamp(v): return max(0.0, min(1.0, v))

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
bb = [high.matrix_world @ mathutils.Vector(c) for c in high.bound_box]
s = H / (max(v.z for v in bb) - min(v.z for v in bb)); high.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
bb = [high.matrix_world @ mathutils.Vector(c) for c in high.bound_box]
high.location -= mathutils.Vector(((min(v.x for v in bb) + max(v.x for v in bb)) / 2, (min(v.y for v in bb) + max(v.y for v in bb)) / 2, min(v.z for v in bb)))
bpy.ops.object.transform_apply(location=True)
bb = [mathutils.Vector(c) for c in high.bound_box]
XMIN, XMAX = min(v.x for v in bb), max(v.x for v in bb)
high.name = name + '_high'

bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); bpy.context.view_layer.objects.active = high
bpy.ops.object.duplicate(); low = bpy.context.view_layer.objects.active; low.name = name
low.data.materials.clear(); low.data.remesh_voxel_size = 0.005; bpy.ops.object.voxel_remesh()
log('remeshed', len(low.data.polygons))

# region-by-region decimation in edit mode (selection boundaries stay stitched)
def region(co):
    if co.z > 1.40: return 'head'
    if co.z < 0.16: return 'feet'
    return 'body'
BUDGET = {'head': 7000, 'feet': 4000, 'body': target - 11000}
bpy.context.view_layer.objects.active = low
for reg, want in BUDGET.items():
    bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(low.data)
    for f in bm.faces: f.select_set(region(f.calc_center_median()) == reg)
    have = sum(len(f.verts) - 2 for f in bm.faces if f.select); bmesh.update_edit_mesh(low.data)
    if have > want: bpy.ops.mesh.decimate(ratio=want / have)
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.quads_convert_to_tris(); bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
head = sum(1 for p in low.data.polygons if p.center.z > 1.40); feet = sum(1 for p in low.data.polygons if p.center.z < 0.16)
log('decimated', len(low.data.polygons), 'tris; head', head, 'feet', feet)

# UVs: smart project, then give face islands twice the space before packing
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
bm = bmesh.from_edit_mesh(low.data); uv = bm.loops.layers.uv.active
for f in bm.faces:
    if f.calc_center_median().z > 1.42 and f.normal.y < 0.2:
        c = mathutils.Vector((0, 0))
        for l in f.loops: c += l[uv].uv
        c /= len(f.loops)
        for l in f.loops: l[uv].uv = c + (l[uv].uv - c) * 2.0
bmesh.update_edit_mesh(low.data)
bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
bpy.ops.object.mode_set(mode='OBJECT')
log('uv done')

# bake colour + normal from the high-poly
mat = bpy.data.materials.new(name + 'Skin'); mat.use_nodes = True; low.data.materials.append(mat)
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
baked = bpy.data.images.new(name + '_baked', tex_px, tex_px); nrm = bpy.data.images.new(name + '_normal', tex_px, tex_px)
nrm.colorspace_settings.name = 'Non-Color'
n_b = nt.nodes.new('ShaderNodeTexImage'); n_b.image = baked
n_n = nt.nodes.new('ShaderNodeTexImage'); n_n.image = nrm
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'
bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = 0.03; bk.max_ray_distance = 0.12; bk.margin = 8
bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
nt.nodes.active = n_b; bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}); log('baked colour')
nt.nodes.active = n_n; bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT'); log('baked normal')
bpy.data.objects.remove(high, do_unlink=True)

# front projection of the concept art onto face and feet, feathered
me = low.data
proj = me.uv_layers.new(name='proj'); main = me.uv_layers[0].name
mask = me.color_attributes.new('mask', 'FLOAT_COLOR', 'POINT')
fx0, fx1, fy0, fy1 = FIG
for li, loop in enumerate(me.loops):
    co = me.vertices[loop.vertex_index].co
    u = (fx0 + (co.x - XMIN) / (XMAX - XMIN) * (fx1 - fx0)) / IMG
    v = (fy0 + co.z / H * (fy1 - fy0)) / IMG
    proj.data[li].uv = (u, v)
for v in me.vertices:
    front = clamp((-v.normal.y - 0.55) / 0.3)
    face = clamp((v.co.z - 1.46) / 0.05) * clamp((0.16 - abs(v.co.x)) / 0.05) * front
    feet = clamp((0.15 - v.co.z) / 0.04) * clamp((-v.normal.y + v.normal.z - 0.1) / 0.4)
    w = face * 0.9
    mask.data[v.index].color = (w, w, w, 1)
n_uvm = nt.nodes.new('ShaderNodeUVMap'); n_uvm.uv_map = main
n_uvp = nt.nodes.new('ShaderNodeUVMap'); n_uvp.uv_map = 'proj'
n_c = nt.nodes.new('ShaderNodeTexImage'); n_c.image = bpy.data.images.load(concept); n_c.extension = 'EXTEND'
nt.links.new(n_uvm.outputs['UV'], n_b.inputs['Vector']); nt.links.new(n_uvp.outputs['UV'], n_c.inputs['Vector'])
n_m = nt.nodes.new('ShaderNodeAttribute'); n_m.attribute_name = 'mask'
mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
nt.links.new(n_m.outputs['Fac'], mix.inputs['Factor']); nt.links.new(n_b.outputs['Color'], mix.inputs[6]); nt.links.new(n_c.outputs['Color'], mix.inputs[7])
emit = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes['Material Output']
nt.links.new(mix.outputs[2], emit.inputs['Color']); nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
final = bpy.data.images.new(name + '_color', tex_px, tex_px)
n_f = nt.nodes.new('ShaderNodeTexImage'); n_f.image = final; nt.nodes.active = n_f
nt.links.new(n_uvm.outputs['UV'], n_f.inputs['Vector'])
bk.use_selected_to_active = False; sc.cycles.samples = 1
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True)
bpy.ops.object.bake(type='EMIT'); log('baked projection')

# final material: colour + normal on the main UVs, drop helpers
for n in list(nt.nodes):
    if n not in (bsdf, out, n_f, n_n, n_uvm): nt.nodes.remove(n)
nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface']); nt.links.new(n_f.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(n_uvm.outputs['UV'], n_n.inputs['Vector'])
nm = nt.nodes.new('ShaderNodeNormalMap'); nm.uv_map = main
nt.links.new(n_n.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.75
me.uv_layers.remove(me.uv_layers['proj']); me.color_attributes.remove(me.color_attributes['mask'])
low.vertex_groups.clear()
for img, fn in ((final, name + '_color.png'), (nrm, name + '_normal.png'), (baked, name + '_baked_only.png')):
    img.filepath_raw = os.path.join(out_dir, fn); img.file_format = 'PNG'; img.save()
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, name + '_clean.glb'), export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=90)
bpy.ops.export_scene.fbx(filepath=os.path.join(out_dir, name + '_clean_mixamo.fbx'), use_selection=True, path_mode='COPY', embed_textures=True, axis_forward='-Z', axis_up='Y')
log('exported')
