# Merge a Mixamo-rigged character and its animation FBXs into one game GLB, with the original Lux3D texture.
# blender -b -P tools/build_character.py -- <skin.fbx> <anim_dir> <texture_source.glb> <out.glb> <target_tris> <tex_px>
import bpy, sys, os, re

argv = sys.argv[sys.argv.index('--') + 1:]
skin_fbx, anim_dir, tex_glb, out_glb, target_tris, tex_px = argv[0], argv[1], argv[2], argv[3], int(argv[4]), int(argv[5])

bpy.ops.wm.read_factory_settings(use_empty=True)

def snake(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

# 1. Rigged character (mesh + armature) from the skinned FBX
bpy.ops.import_scene.fbx(filepath=skin_fbx, automatic_bone_orientation=False)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
arm.name = 'Hanuman'
base_action = arm.animation_data.action if arm.animation_data else None
if base_action:
    base_action.name = snake(os.path.splitext(os.path.basename(skin_fbx))[0])
    base_action.use_fake_user = True

# 2. Original texture from the Lux3D GLB (same UV layout, Mixamo drops embedded textures)
before = set(bpy.data.images)
bpy.ops.import_scene.gltf(filepath=tex_glb)
src_objs = [o for o in bpy.context.selected_objects]
src_mat = None
for o in src_objs:
    if o.type == 'MESH' and o.data.materials:
        src_mat = o.data.materials[0]; break
for o in src_objs:
    bpy.data.objects.remove(o, do_unlink=True)
if src_mat:
    src_mat.name = 'HanumanSkin'
    for m in meshes:
        m.data.materials.clear(); m.data.materials.append(src_mat)
    for img in set(bpy.data.images) - before:
        if img.size[0] > tex_px:
            img.scale(tex_px, tex_px)
print('MATERIAL', src_mat.name if src_mat else 'none')

# 3. Slim the skinned mesh (vertex groups survive the decimate modifier)
for m in meshes:
    tris = sum(len(p.vertices) - 2 for p in m.data.polygons)
    if tris > target_tris:
        bpy.context.view_layer.objects.active = m
        mod = m.modifiers.new('dec', 'DECIMATE'); mod.ratio = target_tris / tris
        m.modifiers.move(len(m.modifiers) - 1, 0)
        bpy.ops.object.modifier_apply(modifier='dec')
    print('MESH', m.name, sum(len(p.vertices) - 2 for p in m.data.polygons), 'tris')

# 4. Every animation FBX: import, keep its action, drop its armature
for f in sorted(os.listdir(anim_dir)):
    if not f.lower().endswith('.fbx') or os.path.join(anim_dir, f) == skin_fbx:
        continue
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(anim_dir, f), automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in existing]
    a = next((o for o in new if o.type == 'ARMATURE'), None)
    if a and a.animation_data and a.animation_data.action:
        act = a.animation_data.action
        act.name = snake(os.path.splitext(f)[0]); act.use_fake_user = True
        print('ACTION', act.name, int(act.frame_range[1] - act.frame_range[0]), 'frames')
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)

# 5. Push every action onto the character's NLA so the glTF exporter writes them all as separate clips
arm.animation_data_create()
arm.animation_data.action = None
for act in bpy.data.actions:
    tr = arm.animation_data.nla_tracks.new(); tr.name = act.name
    tr.strips.new(act.name, int(act.frame_range[0]), act); tr.mute = True

bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_image_format='JPEG',
                          export_jpeg_quality=85, export_apply=True, export_skins=True)
print('EXPORTED', out_glb, round(os.path.getsize(out_glb) / 1e6, 2), 'MB', len(bpy.data.actions), 'actions')
