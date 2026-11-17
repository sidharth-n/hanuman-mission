# Ravana, put right in Blender. Lux3D gave him two rows of heads back to back (nine faces forward, nine behind, and the
# great head twice); this takes the back row away, gives the heads that remain a rounded back (crown above, hair below),
# adds the tenth head, eases the lumps out of the faces, slims the body more than the faces, and writes the game's file.
#
#   blender -b -P tools/ravana_fix.py -- assets/rig/lux3d/ravana-anim.glb game/public/assets/ravana.glb 50000 2048
#
# Each step is a function of its own, so the same work can be done one step at a time in an open Blender window.
import bpy, bmesh, math, os, re, sys
import numpy as np
from mathutils import Vector

NAMES = 'idle,talk,fold_arms,walk,sit,sit_talk,sit_exit,sit_enter,throw,command'.split(',')
HEADS_FROM = 0.63          # the height the row of heads begins at (the model stands from -1.25 to 1.25)
MID = 0.17                 # half the width of the great head in the middle
CROWN = (0.865, 0.94)      # where face gives way to crown: the small heads, the great head
HAIR = (0.045, 0.032, 0.026)


def load(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    return tidy()


def tidy():
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    o = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature())
    for x in [x for x in bpy.context.scene.objects if x.type == 'MESH' and x is not o]:
        bpy.data.objects.remove(x, do_unlink=True)      # the importer's own bone markers
    return arm, o


def edit(o):
    bm = bmesh.new(); bm.from_mesh(o.data); return bm


def keep(o, bm):
    bm.normal_update(); bm.to_mesh(o.data); bm.free(); o.data.update()


# Where the back row begins, at this point of the model.
def back_from(p):
    ax = abs(p.x)
    if p.z < HEADS_FROM: return 9
    outer = -0.02 if p.z < 0.9 else -0.02 + min(1, (p.z - 0.9) / 0.1) * 0.10
    if ax >= MID + 0.07: return outer
    middle = 0.05 if p.z > 0.66 else 9
    if ax < MID: return middle
    return middle + (outer - middle) * (ax - MID) / 0.07 if middle < 9 else outer


# 1. The back row of heads is taken away. The heads in front are left open behind.
def cut_back_row(o):
    bm = edit(o); mw = o.matrix_world
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)      # the importer splits the surface along texture seams
    gone = [v for v in bm.verts if (mw @ v.co).y > back_from(mw @ v.co)]
    n = len(gone); bmesh.ops.delete(bm, geom=gone, context='VERTS')
    seen = set(); parts = []
    for v in bm.verts:
        if v in seen: continue
        st = [v]; seen.add(v); c = []
        while st:
            x = st.pop(); c.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y not in seen: seen.add(y); st.append(y)
        parts.append(c)
    parts.sort(key=len, reverse=True)
    bmesh.ops.delete(bm, geom=[v for c in parts[1:] for v in c], context='VERTS')      # crumbs the cut left floating
    left = len(bm.verts); keep(o, bm)
    return f'back row removed: {n} points taken away, {left} left'


# A patch of the texture nothing uses, painted the colour of his hair: the backs of the heads are given this.
def hair_swatch(o):
    me = o.data; N = 256; used = np.zeros((N, N), bool)
    uv = np.empty(len(me.loops) * 2, 'f'); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2) % 1.0
    ij = np.clip((uv * N).astype(int), 0, N - 1); used[ij[:, 1], ij[:, 0]] = True
    grown = used.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1): grown |= np.roll(np.roll(used, dy, 0), dx, 1)
    B = 6; spot = None
    for i in range(2, N - B - 2):
        for j in range(2, N - B - 2):
            if not grown[i:i + B, j:j + B].any(): spot = (i, j); break
        if spot: break
    if not spot: raise RuntimeError('no free patch in the texture')
    i, j = spot
    mat = me.materials[0]; nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    base = bsdf.inputs['Base Color'].links[0].from_node.image
    for img in [n.image for n in nodes if n.type == 'TEX_IMAGE' and n.image]:
        w, h = img.size; px = np.empty(w * h * 4, 'f'); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
        y0, y1, x0, x1 = i * h // N, (i + B) * h // N, j * w // N, (j + B) * w // N
        if img is base:
            rng = np.random.default_rng(7); tone = 0.8 + rng.random((y1 - y0, x1 - x0, 1)) * 0.4
            px[y0:y1, x0:x1, :3] = np.array(HAIR) ** (1 / 2.2) * tone      # the file holds colour as it is shown
        else: px[y0:y1, x0:x1, :3] = (1.0, 0.82, 0.0)      # rough, and not metal
        px[y0:y1, x0:x1, 3] = 1; img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
    return ((j + B / 2) / N, (i + B / 2) / N)


# 2. Every head left open behind is closed with a rounded back: the crown carried round in gold, hair below it.
def round_backs(o):
    hair = hair_swatch(o)
    bm = edit(o); mw = o.matrix_world; inv = mw.inverted(); uvl = bm.loops.layers.uv.active
    bm.edges.ensure_lookup_table()
    edges = [e for e in bm.edges if e.is_boundary]; used = set(); rims = []
    for e in edges:
        if e in used: continue
        loop = [e.link_loops[0]]      # walked the way the face beside it runs, so the new faces are wound to match
        used.add(e); rim = [(e.link_loops[0].vert, e)]
        a, cur = e.link_loops[0].vert, e.link_loops[0].link_loop_next.vert
        ok = True
        while cur is not a:
            nxt = [x for x in cur.link_edges if x.is_boundary and x not in used and x.link_loops[0].vert is cur]
            if not nxt: ok = False; break
            used.add(nxt[0]); rim.append((cur, nxt[0])); cur = nxt[0].link_loops[0].link_loop_next.vert
        if ok and len(rim) >= 3: rims.append(rim)
    made = 0; K = 5
    for rim in rims:
        P = [mw @ v.co for v, _ in rim]
        xs = [p.x for p in P]; x0, x1 = min(xs), max(xs)
        if x1 - x0 < 0.05 or len(rim) < 24: continue      # a small tear: filled flat below
        step = 0.02; nb = int((x1 - x0) / step) + 1
        zlo = [9] * nb; zhi = [-9] * nb; ys = [[] for _ in range(nb)]
        for p in P:
            b = min(nb - 1, int((p.x - x0) / step)); zlo[b] = min(zlo[b], p.z); zhi[b] = max(zhi[b], p.z); ys[b].append(p.y)
        zm = [(zlo[b] + zhi[b]) / 2 if zhi[b] > -9 else None for b in range(nb)]
        ym = [sum(ys[b]) / len(ys[b]) if ys[b] else None for b in range(nb)]
        for arr in (zm, ym):      # empty stretches take their neighbours' value, then the line is eased
            last = next(a for a in arr if a is not None)
            for b in range(nb):
                if arr[b] is None: arr[b] = last
                last = arr[b]
            for _ in range(2):
                arr[:] = [(arr[max(0, b - 1)] + arr[b] * 2 + arr[min(nb - 1, b + 1)]) / 4 for b in range(nb)]
        line = CROWN[1 if abs((x0 + x1) / 2) < MID and x1 - x0 < 0.6 else 0]
        zm = [min(z, line - 0.01) for z in zm]      # the ridge lies under the crown's edge, so gold and hair part along a level line
        def at(arr, x):
            f = (x - x0) / step - 0.5; b = max(0, min(nb - 2, int(math.floor(f)))); t = max(0, min(1, f - b))
            return arr[b] * (1 - t) + arr[b + 1] * t
        # the texture each rim edge already wears: carried back over the crown
        cols = []
        for (v, e), p in zip(rim, P):
            l = e.link_loops[0]; great = abs(p.x) < MID
            cols.append({'uv': (l[uvl].uv.copy(), l.link_loop_next[uvl].uv.copy()), 'gold': p.z > CROWN[1 if great else 0]})
        rings = [[v for v, _ in rim]]
        for k in range(1, K + 1):
            th = k / K * math.pi / 2; ring = []
            for (v, _), p in zip(rim, P):
                deep = (0.11 if abs(p.x) < MID else 0.085) * min(1, max(0.0, min(p.x - x0, x1 - p.x)) / 0.05 + 0.25) ** 0.5
                q = Vector((p.x, p.y + (at(ym, p.x) - p.y) * (1 - math.cos(th)) + deep * math.sin(th), at(zm, p.x) + (p.z - at(zm, p.x)) * math.cos(th)))
                nv = bm.verts.new(inv @ q, v); ring.append(nv)      # made from the rim point, so it moves with the same bones
            rings.append(ring)
        n = len(rim)
        for k in range(K):
            for i in range(n):
                j = (i + 1) % n
                try: f = bm.faces.new((rings[k][j], rings[k][i], rings[k + 1][i], rings[k + 1][j]))
                except ValueError: continue
                c = cols[i]; mid = sum((mw @ v.co for v in f.verts), Vector()) / 4
                gold = c['gold'] and cols[j]['gold'] and mid.z > CROWN[1 if abs(mid.x) < MID else 0]
                for l in f.loops:
                    if not gold: l[uvl].uv = hair
                    else: l[uvl].uv = c['uv'][0] if l.vert in (rings[k][i], rings[k + 1][i]) else c['uv'][1]
                f.smooth = True; made += 1
        bmesh.ops.remove_doubles(bm, verts=rings[K], dist=0.02)      # the two sides meet along the ridge
    before = set(bm.faces)
    left = [e for e in bm.edges if e.is_boundary]
    if left: bmesh.ops.holes_fill(bm, edges=left, sides=0)
    caps = [f for f in bm.faces if f not in before]
    for f in caps:
        for l in f.loops: l[uvl].uv = hair
    if caps: bmesh.ops.triangulate(bm, faces=caps)
    keep(o, bm)
    return f'backs made: {made} new faces over {len(rims)} openings, {len(caps)} small tears closed'


# 3. The tenth head: the outermost one on his left is made again beside itself, a little back and a little smaller.
def tenth_head(o, side=1, at=0.745, across=0.165):
    bm = edit(o); mw = o.matrix_world; inv = mw.inverted()
    faces = [f for f in bm.faces if all((mw @ v.co).x * side > at and (mw @ v.co).z > HEADS_FROM for v in f.verts)]
    new = bmesh.ops.duplicate(bm, geom=faces)['geom']
    verts = [g for g in new if isinstance(g, bmesh.types.BMVert)]
    P = [mw @ v.co for v in verts]; c = sum(P, Vector()) / len(P)
    for v, p in zip(verts, P):
        v.co = inv @ (c + (p - c) * 0.95 + Vector((across * side, 0.03, -0.012)))
    keep(o, bm)
    return f'tenth head added: {len(verts)} points'


# 4. The small lumps the generator left on the faces are eased out. The shapes of the features stay.
def ease_faces(o, rounds=3):
    bm = edit(o); mw = o.matrix_world
    verts = [v for v in bm.verts if (mw @ v.co).z > HEADS_FROM - 0.03 and not v.is_boundary]
    for _ in range(rounds): bmesh.ops.smooth_vert(bm, verts=verts, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    keep(o, bm)
    return f'faces eased: {len(verts)} points, {rounds} passes'


# 5. Slimmed for the game in two passes, so the faces keep a set share of the triangles: first the body alone is
# slimmed (a point with no weight in the group is left untouched by Blender's decimation), then the faces alone.
def slim(o, target, share=0.48, keep=None):
    mw = o.matrix_world
    def tris(): return sum(len(p.vertices) - 2 for p in o.data.polygons)
    def is_face(v): p = mw @ v.co; return keep(p) if keep else p.z > HEADS_FROM and p.y < 0.0
    def in_faces(): 
        f = {v.index for v in o.data.vertices if is_face(v)}
        return f, sum(len(p.vertices) - 2 for p in o.data.polygons if all(i in f for i in p.vertices))
    def decimate(which, ratio):
        f, _ = in_faces(); g = o.vertex_groups.new(name='slim')
        g.add([v.index for v in o.data.vertices if (v.index in f) == (which == 'faces')], 1.0, 'REPLACE')
        mod = o.modifiers.new('slim', 'DECIMATE'); mod.ratio = min(1, ratio); mod.vertex_group = 'slim'
        o.modifiers.move(len(o.modifiers) - 1, 0)      # before the armature
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]): bpy.ops.object.modifier_apply(modifier='slim')
        o.vertex_groups.remove(o.vertex_groups['slim'])
    start = tris(); _, faces = in_faces()
    decimate('body', (faces + target * (1 - share)) / start)
    decimate('faces', target / tris())
    for p in o.data.polygons: p.use_smooth = True
    o.data.update(); _, faces = in_faces()
    return f'slimmed: {start} -> {tris()} triangles, {faces} of them in the faces'


# 6. The game's file: every animation under its name, the colour texture at tex_px.
def export(arm, out, tex_px, names=NAMES):
    acts = sorted([a for a in bpy.data.actions if re.search(r'animation_(\d+)', a.name)], key=lambda a: int(re.search(r'(\d+)', a.name).group(1)))
    for a, n in zip(acts, names): a.name = n; a.use_fake_user = True
    acts = [bpy.data.actions[n] for n in names if n in bpy.data.actions]
    mat = next(o for o in bpy.context.scene.objects if o.type == 'MESH').data.materials[0]
    base = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image
    for img in bpy.data.images:
        px = tex_px if img is base else min(tex_px, 1024)
        if img.size[0] > px: img.scale(px, px)
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(tr)
    for a in acts:
        tr = arm.animation_data.nla_tracks.new(); tr.name = a.name
        tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
    for a in list(bpy.data.actions):
        if a not in acts: bpy.data.actions.remove(a)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_image_format='JPEG', export_jpeg_quality=88, export_apply=True, export_skins=True)
    return f'written {out}: {os.path.getsize(out) / 1e6:.2f} MB, {len(acts)} animations'


if __name__ == '__main__' and '--' in sys.argv:
    argv = sys.argv[sys.argv.index('--') + 1:]
    arm, o = load(argv[0])
    for step in (cut_back_row, round_backs, tenth_head, ease_faces): print('STEP', step(o))
    print('STEP', slim(o, int(argv[2])))
    print('STEP', export(arm, argv[1], int(argv[3])))
