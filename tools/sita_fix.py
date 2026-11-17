# Sita, put right in Blender. Lux3D left her face smeared and her fingers run together. Her face and the backs of her
# hands are repainted from redrawn pictures (tools/retouch.py), the lumps are eased out of both, and the game's file is
# slimmed so that face and hands keep a good share of the triangles.
#
#   blender -b -P tools/retouch.py -- sita assets/rig/lux3d/sita-anim.glb assets/rig/polish/sita      (the pictures)
#   ... each <part>-before.png is redrawn as <part>-after.png, features kept in place ...
#   blender -b -P tools/sita_fix.py -- assets/rig/lux3d/sita-anim.glb assets/rig/polish/sita game/public/assets/sita.glb 45000 2048
import bpy, bmesh, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ravana_fix as R, retouch as T

NAMES = 'idle,talk,no,sit,sit_talk,sit_exit,sit_enter,give,yes,walk'.split(',')
def face(p): return p.z > 0.625 and p.y < -0.02 and abs(p.x) < 0.11
def hand(p): return abs(p.x) > 0.625
def fine(p): return face(p) or hand(p)


def weld(o):
    bm = R.edit(o); n = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); m = len(bm.verts); R.keep(o, bm)
    return f'welded: {n} -> {m} points'


# The small lumps eased out of the face and the hands; the shapes stay.
def ease(o, rounds_face=6, rounds_hand=3):
    bm = R.edit(o); mw = o.matrix_world
    for where, rounds in ((face, rounds_face), (hand, rounds_hand)):
        verts = [v for v in bm.verts if where(mw @ v.co) and not v.is_boundary]
        for _ in range(rounds): bmesh.ops.smooth_vert(bm, verts=verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    R.keep(o, bm)
    return f'face and hands eased ({rounds_face} and {rounds_hand} passes)'


# The ornament at her parting came out of the generator as a solid lump standing off her forehead like a horn. The
# skin and hair under it are found by letting that patch of the head settle like a stretched membrane; whatever stood
# more than a few millimetres off that is laid down onto it, and given the colour of her hair (the face is repainted after).
def flatten_ornament(o, half=0.02, low=0.745, off=0.003):
    bm = R.edit(o); mw = o.matrix_world; uvl = bm.loops.layers.uv.active
    def spread(f): a, b, c = [l[uvl].uv for l in f.loops][:3]; return abs((b - a).cross(c - a))
    hair = max((f for f in bm.faces if all((mw @ v.co).y > 0.04 and (mw @ v.co).z > 0.73 and abs((mw @ v.co).x) < 0.07 for v in f.verts)), key=spread)
    black = sum((l[uvl].uv for l in hair.loops), hair.loops[0][uvl].uv * 0) / len(hair.loops)      # a point of the texture that is her hair, at the back of her head
    patch = [v for v in bm.verts if abs((mw @ v.co).x + 0.003) < half and (mw @ v.co).z > low and (mw @ v.co).y < 0.02]
    was = {v: v.co.copy() for v in patch}
    for _ in range(150): bmesh.ops.smooth_vert(bm, verts=patch, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    lump = {v for v in patch if (v.co - was[v]).length > off}
    for _ in range(2): lump |= {e.other_vert(v) for v in lump for e in v.link_edges if e.other_vert(v) in was}
    for v in patch:
        if v not in lump: v.co = was[v]
    for _ in range(4): bmesh.ops.smooth_vert(bm, verts=list(lump), factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    n = 0
    for f in bm.faces:
        if all(v in lump for v in f.verts):
            n += 1
            for l in f.loops: l[uvl].uv = black
    R.keep(o, bm)
    return f'ornament laid flat: {len(lump)} points, {n} faces given the colour of her hair'


# Her sari is one cloth round both legs, but the rig tied each point of it to one leg or the other almost at random,
# so it crumpled between her knees when she sat. Each point's hold is shared between the two legs by where it lies
# across her, then evened out with its neighbours, so the cloth spans from knee to knee as cloth does.
def drape(o, arm, rounds=10):
    from collections import defaultdict
    bm = R.edit(o); mw = o.matrix_world; dl = bm.verts.layers.deform.verify()
    idx = {g.name.split(':')[-1]: g.index for g in o.vertex_groups}
    pairs = [(idx['Left' + n], idx['Right' + n]) for n in ('UpLeg', 'Leg', 'Foot', 'ToeBase') if 'Left' + n in idx and 'Right' + n in idx]
    legs = {g for pr in pairs for g in pr}
    hip = arm.matrix_world @ next(b for b in arm.data.bones if b.name.endswith('LeftUpLeg')).head_local
    a = abs(hip.x) * 1.05
    skirt = [v for v in bm.verts if (mw @ v.co).z < hip.z + 0.03 and any(g in legs for g in v[dl].keys())]
    for v in skirt:
        t = max(0.0, min(1.0, ((mw @ v.co).x + a) / (2 * a))); s = t * t * (3 - 2 * t); d = v[dl]
        for L, Rt in pairs:
            tot = d.get(L, 0.0) + d.get(Rt, 0.0)
            if tot > 0: d[L] = tot * s; d[Rt] = tot * (1 - s)
    for _ in range(rounds):
        new = {}
        for v in skirt:
            acc = defaultdict(float); n = 0
            for e in v.link_edges:
                n += 1
                for g, x in e.other_vert(v)[dl].items(): acc[g] += x
            for g, x in v[dl].items(): acc[g] += x * n
            tot = sum(acc.values()) or 1.0
            new[v] = {g: x / tot for g, x in acc.items() if x / tot > 0.004}
        for v, d in new.items():
            v[dl].clear()
            for g, x in d.items(): v[dl][g] = x
    n = len(skirt); R.keep(o, bm)
    return f'sari draped: {n} points shared between the legs and evened over {rounds} passes'


def repaint(o, pictures, parts=('face', 'hand_l', 'hand_r')):
    said = []
    for name in parts:
        after = next((os.path.join(pictures, f'{name}-after.{e}') for e in ('png', 'jpg') if os.path.exists(os.path.join(pictures, f'{name}-after.{e}'))), None)
        if not after: said.append(f'{name}: no redrawn picture, left as it was'); continue
        said.append(T.project(o, 'sita_' + name, T.VIEWS['sita'][name], os.path.join(pictures, name + '-before.png'), after, os.path.join(pictures, name + '-texture.png')))
    for img in bpy.data.images:
        if img.name.startswith('sita_hand') and img.size[0] > 512: img.scale(512, 512)
    return '; '.join(said)


if __name__ == '__main__' and '--' in sys.argv:
    src, pictures, out, tris, tex, *more = sys.argv[sys.argv.index('--') + 1:]
    arm, o = R.load(src); T.rest(arm)
    print('STEP', weld(o)); print('STEP', flatten_ornament(o)); print('STEP', ease(o)); print('STEP', repaint(o, pictures))
    print('STEP', R.slim(o, int(tris), 0.42, fine))
    if 'hands=real' in more:      # her hands made as hands (tools/hands3d.py)
        import hands3d; print('STEP', hands3d.hands(o, arm, nail=(0.55, 0.30, 0.27)))
    print('STEP', drape(o, arm)); print('STEP', R.export(arm, out, int(tex), NAMES))
