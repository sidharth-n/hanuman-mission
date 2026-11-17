# Hands made as hands, for any character whose skeleton has finger bones (first made for Lankini, issue 0015). The
# generator gives lumps: a mitten with a thumb, or fingers run together. Here the lump is cut off at the knuckles, four
# fingers are built in its place along the character's own finger bones, and palm, thumb and fingers are drawn over with
# ONE skin (the hand alone is remade from its solid shape, smoothed and slimmed), so the fingers grow out of the hand
# with knuckles and webs and bend with every animation that moves those bones. Skin and nails take their colour from a
# small patch painted into a part of the texture nothing else uses: the skin's own colour, measured on the old hand.
# Every measure is taken in the hand's own frame (along the fingers, across the knuckles, up from the back of the hand)
# and in units of the distance between two knuckles, so a hand of any size, held any way, on either arm, is made alike.
#   used by tools/lankini_fix.py and the other characters' builds, after the model is slimmed
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

FINGERS = (('Index', 1.0, 0.42), ('Middle', 1.0, 0.54), ('Ring', 1.0, 0.42), ('Pinky', 0.86, 0.33))      # name, thickness, how far the tip lies beyond the last bone (in knuckle widths)
SIDES = 12
TRIS = 3800                   # triangles for one finished hand


def swatch(o, skin, nail):
    me = o.data; N = 512; used = np.zeros((N, N), bool)
    uv = np.empty(len(me.loops) * 2, 'f'); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2) % 1.0 * N
    for p in me.polygons:      # every cell any triangle lies on, measured on the triangle itself (and half a cell round it)
        q = uv[p.loop_start:p.loop_start + p.loop_total]
        for t in range(1, len(q) - 1):
            A, B, C = q[0], q[t], q[t + 1]
            x0, x1 = int(max(0, min(A[0], B[0], C[0]) - 1)), int(min(N - 1, max(A[0], B[0], C[0]) + 1)); y0, y1 = int(max(0, min(A[1], B[1], C[1]) - 1)), int(min(N - 1, max(A[1], B[1], C[1]) + 1))
            X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5); inside = np.ones(X.shape, bool)
            area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); sgn = 1.0 if area >= 0 else -1.0
            for P, Q in ((A, B), (B, C), (C, A)):
                ex, ey = Q[0] - P[0], Q[1] - P[1]; L = math.hypot(ex, ey) or 1e-9
                inside &= sgn * (ex * (Y - P[1]) - ey * (X - P[0])) / L >= -0.75
            used[y0:y1 + 1, x0:x1 + 1] |= inside
    grown = used.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1): grown |= np.roll(np.roll(used, dy, 0), dx, 1)
    print('TEXTURE free', round(100 - 100 * grown.mean(), 1), '%')
    free = (~grown).astype(np.int32); spot = None
    for W, H in ((28, 7), (24, 6), (20, 5), (16, 4), (12, 4), (10, 3)):
        run = np.zeros((N, N), np.int32)      # how many free cells in a row end here, then whether H rows of such runs stand one on another
        for x in range(N): run[:, x] = (run[:, x - 1] + 1) * free[:, x] if x else free[:, x]
        ok = run >= W; tall = np.zeros((N, N), np.int32)
        for y in range(N): tall[y] = (tall[y - 1] + 1) * ok[y] if y else ok[y]
        hit = np.argwhere(tall >= H)
        if len(hit): y, x = hit[0]; spot = (y - H + 1, x - W + 1); break
    if not spot: raise RuntimeError('no free patch in the texture')
    i, j = spot
    NW = max(2, W // 4); GW = W - NW      # cells for the nails, cells for the skin from shadow to light
    mat = me.materials[0]; nodes = mat.node_tree.nodes
    base = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image
    for img in [n.image for n in nodes if n.type == 'TEX_IMAGE' and n.image]:
        w, h = img.size; px = np.empty(w * h * 4, 'f'); img.pixels.foreach_get(px); px = px.reshape(h, w, 4)
        y0, y1, x0, xm, x1 = i * h // N, (i + H) * h // N, j * w // N, (j + GW) * w // N, (j + W) * w // N
        if img is base:
            t = np.linspace(0, 1, xm - x0)[None, :, None]
            px[y0:y1, x0:xm, :3] = np.clip(np.array(skin)[None, None, :] * (0.50 + 0.62 * t), 0, 1)      # from the shadow between two fingers to the light on a knuckle
            px[y0:y1, xm:x1, :3] = np.array(nail) ** (1 / 2.2)
        else:
            px[y0:y1, x0:xm, :3] = (1.0, 0.78, 0.0); px[y0:y1, xm:x1, :3] = (1.0, 0.42, 0.0)      # skin rough, nails smoother, neither metal
        px[y0:y1, x0:x1, 3] = 1; img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
    v = (i + H / 2) / N
    print('SWATCH', W, H, 'cells at', i, j)
    return (lambda s: ((j + 0.6 + max(0.0, min(1.0, s)) * (GW - 1.2)) / N, v)), ((j + GW + NW / 2) / N, v)



def chain_t(p, pts):      # nearest place on a line of joints: (distance, segment, how far along it 0..1)
    best = (1e9, 0, 0.0)
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]; ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); d = (p - (a + ab * t)).length
        if d < best[0]: best = (d, k, t)
    return best


def bone(arm, name):
    return next((b for b in arm.data.bones if b.name.replace(':', '').endswith('mixamorig' + name)), None)


def group(o, b):
    return o.vertex_groups[b.name].index


# nail: its colour, or None for a hand without nails. wrist: how far beyond the hand's joint the new hand begins, in
# knuckle widths (past a bangle). only: 'Left' or 'Right' to make one hand. like: 'Left' or 'Right', the hand whose
# fingers both hands are laid out as (a rigger can leave one hand's finger bones short and curled). long: the fingers
# made so many times as long as their bones, measured from the knuckle.
def hands(o, arm, nail=(0.20, 0.022, 0.032), wrist=0.0, only=None, thick=1.0, like=None, long=1.0):
    said = []; mw = o.matrix_world; inv = mw.inverted(); M = arm.matrix_world; made = {}; skins = []
    base = next(n for n in o.data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image
    tw, th = base.size; px = np.empty(tw * th * 4, 'f'); base.pixels.foreach_get(px); px = px.reshape(th, tw, 4)
    bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.verify(); uvl = bm.loops.layers.uv.active
    width = {}      # a hand whose finger bones the rigger bunched together (a fist to him) cannot be made from them: it is left as it was
    for name in ('Left', 'Right'):
        i1, r1 = bone(arm, name + 'HandIndex1'), bone(arm, name + 'HandRing1')
        if i1 and r1: width[name] = (M @ r1.head_local - M @ i1.head_local).length / 2
    shape = {}      # each made hand's finger joints in its own frame, in knuckle widths
    for name in sorted(('Left', 'Right'), key=lambda n: n != like):
        if only and name != only: continue
        if width and width.get(name, 0) < 0.6 * max(width.values()): said.append(f'{name.lower()} hand: its finger bones are bunched together ({width.get(name, 0) * 100:.1f} cm between knuckles against {max(width.values()) * 100:.1f}), left as it was'); continue
        B = lambda n: bone(arm, name + 'Hand' + n); hand = B('')
        chains = {f: [B(f + str(k)) for k in (1, 2, 3)] for f in ('Index', 'Middle', 'Ring', 'Pinky', 'Thumb')}
        if not hand or any(b is None for c in chains.values() for b in c): said.append(f'{name.lower()} hand: no finger bones, left as it was'); continue
        H = lambda b: M @ b.head_local; Tl = lambda b: M @ b.tail_local
        origin = H(hand); along = (H(chains['Middle'][0]) - origin).normalized(); a0 = H(chains['Pinky'][0]) - H(chains['Index'][0]); across = (a0 - along * a0.dot(along)).normalized()
        s = 1 if name == 'Left' else -1; up = along.cross(across) * s; R3 = Matrix((along, across, up))      # rows: the hand's own three directions
        C = lambda p, origin=origin, R3=R3: R3 @ (p - origin); W = lambda q, origin=origin, R3=R3: origin + R3.transposed() @ q      # into the hand's frame and back
        sp = (C(H(chains['Ring'][0])).y - C(H(chains['Index'][0])).y) / 2
        if sp < 1e-3 or (Tl(chains['Index'][2]) - H(chains['Index'][0])).length < 1.2 * sp: said.append(f'{name.lower()} hand: its finger bones are folded to nothing, left as it was'); continue
        near = lambda q: q.x > -2 * sp and math.hypot(q.y, q.z) < 6.5 * sp and q.x < 12 * sp
        IN = 0.36 * sp; W0 = wrist * sp
        # 1. the hand is taken off the arm; what its points were carried by is remembered
        for at in (W0 - IN, W0):
            geom = [f for f in bm.faces if all(near(C(mw @ v.co)) for v in f.verts)]
            geom = list({e for f in geom for e in f.edges}) + list({v for f in geom for v in f.verts}) + geom
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=inv @ W(Vector((at, 0, 0))), plane_no=(inv.to_3x3() @ along).normalized())
        cs = {f: C(mw @ f.calc_center_median()) for f in bm.faces}
        off = [f for f, q in cs.items() if q.x > W0 and near(q)]; srcf = [f for f, q in cs.items() if q.x > W0 - IN and near(q)]
        tone = [px[int(l[uvl].uv[1] % 1 * (th - 1)), int(l[uvl].uv[0] % 1 * (tw - 1)), :3] for f in off if 2.1 * sp < cs[f].x < 4.2 * sp and -1.2 * sp < cs[f].y < 3 * sp and (mw.to_3x3() @ f.normal).dot(up) > 0.5 for l in f.loops]
        if tone: skins.append(np.median(np.array(tone), axis=0))
        old = list({v for f in srcf for v in f.verts}); kd = KDTree(len(old)); carried = []
        for n, v in enumerate(old): kd.insert(C(mw @ v.co), n); carried.append(dict(v[dl]))
        kd.balance()
        hb = bmesh.new(); new = {v: hb.verts.new(C(mw @ v.co)) for v in old}
        for f in srcf:
            try: hb.faces.new([new[v] for v in f.verts])
            except ValueError: pass
        bmesh.ops.delete(bm, geom=off, context='FACES')
        # 2. the lump comes off at the knuckles; the fingers are set in its place, solid, a little way into the palm
        J = {f: [C(H(c[0])), C(H(c[1])), C(H(c[2])), C(Tl(c[2]))] for f, c in chains.items()}
        shape[name] = {f: [q / sp for q in J[f]] for f, _, _ in FINGERS}
        if like and like != name and like in shape: J.update({f: [q * sp for q in shape[like][f]] for f, _, _ in FINGERS})
        if long != 1.0: J.update({f: [J[f][0]] + [J[f][0] + (q - J[f][0]) * long for q in J[f][1:]] for f, _, _ in FINGERS})
        CUT = min(J[f][0].x for f in ('Index', 'Middle', 'Ring')) - 0.36 * sp
        bmesh.ops.bisect_plane(hb, geom=hb.faces[:] + hb.edges[:] + hb.verts[:], dist=1e-6, plane_co=Vector((CUT, 0, 0)), plane_no=Vector((1, 0, 0)), clear_outer=True)
        bmesh.ops.holes_fill(hb, edges=[e for e in hb.edges if e.is_boundary], sides=0)
        rim = [v.co for v in hb.verts if abs(v.co.x - CUT) < 2e-4]
        if not rim: said.append(f'{name.lower()} hand: nothing of it reaches the knuckles, left as it was'); hb.free(); continue
        zc = (min(p.z for p in rim) + max(p.z for p in rim)) / 2; zh = (max(p.z for p in rim) - min(p.z for p in rim)) / 2
        digits = []; mix = lambda a, c, t: a + (c - a) * t
        for fname, fat, ext in FINGERS:
            j = J[fname]; d2 = (j[3] - j[2]).normalized(); tip = j[3] + d2 * ext * sp; ry, rz = 0.436 * sp * fat * thick, 0.525 * sp * fat * thick
            digits.append({'pts': [j[0], j[1], j[2], tip], 'g': [group(o, x) for x in chains[fname]], 'r': rz, 'd': d2, 'thick': fat * thick * sp / 0.0335})
            wz = max(1.0, zh / rz)      # as deep as the palm where it leaves it
            st = [(Vector((CUT - 0.9 * sp, j[0].y, zc)), 1.12, wz), (Vector((CUT, j[0].y, zc)), 1.12, wz), (Vector((j[0].x + 0.12 * sp, j[0].y, zc + (j[0].z - zc) * 0.6)), 1.10, wz * 1.02),
                  (mix(j[0], j[1], 0.34), 1.05, 1.0 + (wz - 1.0) * 0.45), (mix(j[0], j[1], 0.68), 0.97, 0.99), (j[1], 1.06, 1.06), (mix(j[1], j[2], 0.5), 0.93, 0.93), (j[2], 1.01, 1.01),
                  (mix(j[2], tip, 0.45), 0.90, 0.90), (tip - d2 * rz * 0.80, 0.78, 0.78), (tip - d2 * rz * 0.40, 0.60, 0.60), (tip - d2 * rz * 0.10, 0.32, 0.32)]
            rings = []
            for k, (c, sy, sz) in enumerate(st):
                d = (st[min(k + 1, len(st) - 1)][0] - st[max(k - 1, 0)][0]).normalized(); sv = Vector((0, 0, 1)).cross(d).normalized(); uq = d.cross(sv).normalized()
                taper = 1.0 - 0.15 * max(0, k - 3) / (len(st) - 4)
                rings.append([hb.verts.new(c + sv * (ry * sy * taper * math.cos(2 * math.pi * a / SIDES)) + uq * (rz * sz * taper * math.sin(2 * math.pi * a / SIDES))) for a in range(SIDES)])
            ends = [hb.verts.new(st[0][0]), hb.verts.new(tip)]; fs = []
            for k in range(len(rings) - 1):
                for a in range(SIDES): fs.append(hb.faces.new((rings[k][a], rings[k][(a + 1) % SIDES], rings[k + 1][(a + 1) % SIDES], rings[k + 1][a])))
            for a in range(SIDES): fs.append(hb.faces.new((rings[0][(a + 1) % SIDES], rings[0][a], ends[0]))); fs.append(hb.faces.new((rings[-1][a], rings[-1][(a + 1) % SIDES], ends[1])))
            bmesh.ops.recalc_face_normals(hb, faces=fs)
        thumb = {'pts': J['Thumb'], 'g': [group(o, x) for x in chains['Thumb']], 'd': (J['Thumb'][3] - J['Thumb'][2]).normalized(), 'thick': 1.15 * thick * sp / 0.0335, 'r': 0.66 * sp}
        # 3. one skin over palm, thumb and fingers: remade from the solid shape, smoothed, slimmed
        me = bpy.data.meshes.new('hand'); hb.normal_update(); hb.to_mesh(me); hb.free()
        ob = bpy.data.objects.new('hand', me); bpy.context.scene.collection.objects.link(ob)
        r = ob.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = 0.048 * sp; r.adaptivity = 0
        sm = ob.modifiers.new('s', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 7
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); raw = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); n = len(raw.polygons)
        rb = bmesh.new(); rb.from_mesh(raw)      # the line where the lump was cut is worked over again, until palm and fingers are one slope
        seam = [v for v in rb.verts if abs(v.co.x - CUT) < 0.66 * sp]
        for _ in range(16): bmesh.ops.smooth_vert(rb, verts=seam, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        rb.to_mesh(raw); rb.free(); ob2 = bpy.data.objects.new('hand2', raw); bpy.context.scene.collection.objects.link(ob2)
        dc = ob2.modifiers.new('d', 'DECIMATE'); dc.ratio = min(1.0, TRIS / max(1, n * 2)); dc.use_collapse_triangulate = True
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); fin = bpy.data.meshes.new_from_object(ob2.evaluated_get(dg)); bpy.data.objects.remove(ob2, do_unlink=True)
        fb = bmesh.new(); fb.from_mesh(fin); fb.normal_update()
        made[name] = (fb, digits, thumb, kd, carried, W0, sp, CUT, W, s, up); bpy.data.objects.remove(ob, do_unlink=True)
        said.append(f'{name.lower()} hand, knuckles {sp * 100:.1f} cm apart: {n} faces remade, {len(fb.faces)} kept')
    bm.normal_update(); bm.to_mesh(o.data); bm.free(); o.data.update()
    if not made: return 'hands: ' + '; '.join(said)
    skin = tuple(float(x) for x in np.mean(np.array(skins), axis=0)) if skins else (0.5, 0.4, 0.35)
    shade, nail_uv = swatch(o, skin, nail or skin)      # the old hands' place in the texture is free now
    bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.verify(); uvl = bm.loops.layers.uv.active
    for name, (fb, digits, thumb, kd, carried, W0, sp, CUT, W, s, up) in made.items():
        verts = {}
        for v in fb.verts:
            p = v.co.copy(); x = p.x
            if x < W0 + 0.06 * sp: k = 1 - 0.035 * min(1.0, (W0 + 0.06 * sp - x) / (0.12 * sp)); p.y *= k; p.z *= k      # the end that sits in the arm is drawn in under the arm's own skin
            nv = bm.verts.new(inv @ W(p)); w = dict(carried[kd.find(v.co)[1]])      # carried as the old hand was carried, there
            nr = min(digits, key=lambda g: chain_t(v.co, g['pts'])[0]); dist, seg, t = chain_t(v.co, nr['pts']); j0 = nr['pts'][0]; isf = x > j0.x - 0.48 * sp and dist < nr['r'] * 2.2
            if isf:      # a finger: each part by its own bone, shared across a joint; into the hand it gives way to what carried the palm
                g = nr['g']; L = [(nr['pts'][k + 1] - nr['pts'][k]).length for k in range(3)]; al = sum(L[:seg]) + L[seg] * t; fw = {}; e1, e2 = L[0], L[0] + L[1]; soft = 0.27 * sp
                for k, (a, b_) in enumerate(((-1e9, e1), (e1, e2), (e2, 1e9))):
                    lo = 1.0 if a < -1e8 else max(0.0, min(1.0, (al - a) / (2 * soft) + 0.5)); hi = 1.0 if b_ > 1e8 else max(0.0, min(1.0, (b_ - al) / (2 * soft) + 0.5)); fw[g[k]] = max(0.0, lo + hi - 1.0)
                tot = sum(fw.values()) or 1.0; into = max(0.0, min(1.0, (x - (j0.x - 0.48 * sp)) / (0.6 * sp)))
                w = {k: q * (1 - into) for k, q in w.items()}
                for k, q in fw.items(): w[k] = w.get(k, 0.0) + q / tot * into
            tot = sum(w.values()) or 1.0
            for k, q in w.items():
                if q > 1e-4: nv[dl][k] = q / tot
            side_of = abs((v.co - (nr['pts'][seg] + (nr['pts'][seg + 1] - nr['pts'][seg]) * t)).y) / nr['r'] if isf and x > CUT else 0.0
            verts[v] = (nv, 0.56 + 0.20 * v.normal.z - 0.16 * min(1.0, side_of))      # lighter on top, darker underneath and between the fingers
        for f in fb.faces:
            vs = list(f.verts) if s > 0 else list(f.verts)[::-1]      # the right hand is the left one seen in a mirror: its faces are turned the right way out again
            try: nf = bm.faces.new([verts[v][0] for v in vs])
            except ValueError: continue
            nf.smooth = True
            for l, v in zip(nf.loops, vs): l[uvl].uv = shade(verts[v][1])
        # 4. nails: a small pointed plate on the top of each fingertip, lying on the new skin
        fb.verts.ensure_lookup_table(); upo = (inv.to_3x3() @ up).normalized()
        for g in digits if nail else []:      # (not the thumb: its top is not where a rule can find it)
            d = g['d']; best = None
            for v in fb.verts:
                dist, seg, t = chain_t(v.co, g['pts'])
                if seg == 2 and 0.40 < t < 0.72 and dist < g['r'] * 2.4 and min([g] + digits + [thumb], key=lambda q: chain_t(v.co, q['pts'])[0]) is g:
                    if best is None or v.co.z > best.co.z: best = v
            if best is None: continue
            at = best.co.copy(); u2 = best.normal.copy(); u2 = (u2 - d * u2.dot(d)).normalized(); sv = u2.cross(d).normalized(); k = g['thick']
            b0 = at + u2 * 0.0010 * k; outline = [(-0.008, 0.0), (-0.007, 0.0066), (0.0, 0.0086), (0.008, 0.0070), (0.0145, 0.0), (0.008, -0.0070), (0.0, -0.0086), (-0.007, -0.0066)]; ring = []
            for a, c in outline:
                q = bm.verts.new(inv @ W(b0 + d * (a * k) + sv * (c * k) - u2 * k * (0.0030 * (abs(c) / 0.0086) ** 2 + (0.0030 if a > 0.008 else 0.0)))); q[dl][g['g'][2]] = 1.0; ring.append(q)
            mid = bm.verts.new(inv @ W(b0 + d * (0.003 * k) + u2 * 0.0024 * k)); mid[dl][g['g'][2]] = 1.0
            for a in range(len(ring)):
                nf = bm.faces.new((ring[a], ring[(a + 1) % len(ring)], mid)); nf.smooth = True; nf.normal_update()
                if nf.normal.dot(upo) < 0: nf.normal_flip()
                for l in nf.loops: l[uvl].uv = nail_uv
        fb.free()
    bm.normal_update(); bm.to_mesh(o.data); bm.free(); o.data.update()
    o.name = o.data.name = 'body_fingers'      # the game reads this name: a body with fingers is given its grip there (guard.js)
    return 'hands made: ' + '; '.join(said) + f'; skin {tuple(round(x, 2) for x in skin)}'
