import bpy, sys, math, mathutils
argv = sys.argv[sys.argv.index('--')+1:]; src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
mn=mathutils.Vector((1e9,)*3); mx=mathutils.Vector((-1e9,)*3)
for o in objs:
    for c in o.bound_box:
        w=o.matrix_world@mathutils.Vector(c); mn=mathutils.Vector(map(min,mn,w)); mx=mathutils.Vector(map(max,mx,w))
ctr=(mn+mx)/2; size=max(mx-mn)
print('BBOX', [round(v,3) for v in (mx-mn)], 'TRIS', sum(len(o.data.polygons) for o in objs))
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=900; sc.render.resolution_y=900; sc.render.film_transparent=False
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[1].default_value=1.0
w.node_tree.nodes['Background'].inputs[0].default_value=(0.6,0.6,0.65,1)
sun=bpy.data.objects.new('sun', bpy.data.lights.new('sun','SUN')); sun.data.energy=3; sun.rotation_euler=(math.radians(50),0,math.radians(30)); sc.collection.objects.link(sun)
cam=bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam
for i,ang in enumerate([0,40,180]):
    a=math.radians(ang); d=size*1.9
    # glTF is Y-up but Blender imports as Z-up
    cam.location=ctr+mathutils.Vector((math.sin(a)*d,-math.cos(a)*d,size*0.1))
    cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=f'{out}-{i}.png'; bpy.ops.render.render(write_still=True)
