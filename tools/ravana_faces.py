# Ravana's faces, repainted the way Hanuman's and Sita's were (tools/retouch.py): flat pictures of the great head and
# of the two rows of small heads are taken from the model after ravana_fix has put the heads right; each picture is
# redrawn outside Blender with every feature kept in place; and the redrawn pictures are laid back through the same views.
#
#   blender -b -P tools/ravana_faces.py -- views assets/rig/lux3d/ravana-anim.glb assets/rig/polish/ravana
#   ... each <part>-before.png is redrawn as <part>-after.jpg ...
#   blender -b -P tools/ravana_faces.py -- build assets/rig/lux3d/ravana-anim.glb assets/rig/polish/ravana <out.glb> 50000 2048
import bpy, bmesh, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ravana_fix as R, retouch as T

if __name__ == '__main__' and '--' in sys.argv:
    mode, src, d, *more = sys.argv[sys.argv.index('--') + 1:]
    arm, o = R.load(src)
    for step in (R.cut_back_row, R.round_backs, R.tenth_head, R.ease_faces, R.flatten_spikes, R.rigid_heads, R.great_head): print('STEP', step(o))
    V = T.VIEWS['ravana']
    if mode == 'views':
        T.rest(arm); T.take(V, d)
    else:
        for name, v in V.items():
            after = next((os.path.join(d, name + '-after' + e) for e in ('.png', '.jpg') if os.path.exists(os.path.join(d, name + '-after' + e))), None)
            if after: print('STEP', T.project(o, name, v, os.path.join(d, name + '-before.png'), after, os.path.join(d, name + '-texture.png')))
        # welded before it is slimmed: the importer splits the surface along every seam of the texture, and slimming a split
        # surface drags its loose edges out (one small head came out of it with a spike for a nose)
        bm = R.edit(o); n = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); m = len(bm.verts); R.keep(o, bm); print('STEP', f'welded: {n} -> {m} points')
        print('STEP', R.slim(o, int(more[1])))
        if 'hands=real' in more:      # his hands made as hands (tools/hands3d.py), after the slimming so the fingers keep every point
            import hands3d; print('STEP', hands3d.hands(o, arm, nail=(0.40, 0.27, 0.22)))
        print('STEP', R.export(arm, more[0], int(more[2])))
