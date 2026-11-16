# Merge a Mixamo-rigged character and its animation FBXs into one game GLB, with the original Lux3D texture.
# blender -b -P tools/build_character.py -- <skin.fbx> <anim_dir> <texture_source.glb> <out.glb> <target_tris> <tex_px> [fix]
# "fix" repairs the Mixamo weights first (head follows the Head bone, the tail gets its own bones): see fix_weights.py
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

if len(argv) > 6 and argv[6] == 'fix':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import fix_weights
    for m in meshes:
        fix_weights.fix(arm, m)

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

# 4. Every animation FBX: import it, copy its motion onto the character, drop its armature.
# An FBX saved without skin carries no bind pose, so Blender gives its armature a rest pose that differs from the
# character's (forearms about 23 degrees apart on the guard). Its keyframes are offsets from that rest pose, so playing
# them on the character bends every limb by the difference. Instead, read where each bone really is on every frame
# and key the character's own bones to stand in the same place.
scene = bpy.context.scene
rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
parent = {b.name: (b.parent.name if b.parent else None) for b in arm.data.bones}
order = [b.name for b in arm.data.bones]  # parents come before children
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'
arm.animation_data_create()
for f in sorted(os.listdir(anim_dir)):
    if not f.lower().endswith('.fbx') or os.path.join(anim_dir, f) == skin_fbx:
        continue
    existing = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=os.path.join(anim_dir, f), automatic_bone_orientation=False)
    new = [o for o in bpy.data.objects if o not in existing]
    a = next((o for o in new if o.type == 'ARMATURE'), None)
    if a and a.animation_data and a.animation_data.action:
        src = a.animation_data.action
        first, last = int(round(src.frame_range[0])), int(round(src.frame_range[1]))
        act = bpy.data.actions.new(snake(os.path.splitext(f)[0])); act.use_fake_user = True
        arm.animation_data.action = act
        frames, prev = {}, {}
        for fr in range(first, last + 1):
            scene.frame_set(fr)
            pose = {n: a.pose.bones[n].matrix.copy() for n in order if n in a.pose.bones}
            frames[fr] = pose
            for n in order:
                if n not in pose:
                    continue
                p = parent[n]
                if p and p in pose:
                    basis = (rest[p].inverted() @ rest[n]).inverted() @ (pose[p].inverted() @ pose[n])
                else:
                    basis = rest[n].inverted() @ pose[n]
                loc, rot, scl = basis.decompose()
                if n in prev and rot.dot(prev[n]) < 0:
                    rot.negate()
                prev[n] = rot
                pb = arm.pose.bones[n]
                pb.location, pb.rotation_quaternion, pb.scale = loc, rot, scl
                pb.keyframe_insert('location', frame=fr)
                pb.keyframe_insert('rotation_quaternion', frame=fr)
                pb.keyframe_insert('scale', frame=fr)
        # Check: on every frame the character's bones must now sit where the animation's bones sit
        off_pos = off_rot = 0.0
        for fr, pose in frames.items():
            scene.frame_set(fr)
            for n, m in pose.items():
                got = arm.pose.bones[n].matrix
                off_pos = max(off_pos, (got.translation - m.translation).length * arm.scale[0])
                off_rot = max(off_rot, got.to_quaternion().rotation_difference(m.to_quaternion()).angle * 57.2958)
        print('ACTION', act.name, last - first, 'frames; furthest bone from the source: %.5f m, %.3f deg' % (off_pos, off_rot))
        bpy.data.actions.remove(src)
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
