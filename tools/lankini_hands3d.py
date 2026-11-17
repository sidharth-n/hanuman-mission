# Lankini's hands, made as hands. The generator gave her mittens: one lump with a thumb. Here the lump is cut off at the
# knuckles and four fingers are built in its place, each one along its own three finger bones (her skeleton has them),
# so they are separate, round, jointed, nailed, and they bend with every animation that moves those bones (her grip on
# the sword). Palm, thumb and the new fingers are then drawn over with ONE skin (the hand alone is remade from its solid
# shape, smoothed and slimmed), so the fingers grow out of the hand with knuckles and webs, not out of a cut. Skin and nails take their colour from a small patch painted into a
# part of her texture nothing else uses: the skin's own colour, measured on the old hand, from shadow to light.
#   used by tools/lankini_fix.py (after the model is slimmed, so the fingers keep every point they are made of)
import bpy, bmesh, math
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

FINGERS = (('Index', 1.0, 0.014), ('Middle', 1.0, 0.018), ('Ring', 1.0, 0.014), ('Pinky', 0.86, 0.011))      # name, thickness, how far the tip lies beyond the last bone
CUT = 1.000            # the knuckle line: the lump beyond it is taken off (arms out, the hand runs along x)
RY, RZ = 0.0146, 0.0176      # half the width and half the depth of a finger near the hand, before the skin is drawn over it
VOXEL = 0.0016                # the grain the hand is remade at
TRIS = 3800                   # triangles for one finished hand
SIDES = 12
NAIL = (0.20, 0.022, 0.032)   # dark red, the red of her cloth: the nails of a rakshasi


def swatch(o, skin):
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
            px[y0:y1, xm:x1, :3] = np.array(NAIL) ** (1 / 2.2)
        else:
            px[y0:y1, x0:xm, :3] = (1.0, 0.78, 0.0); px[y0:y1, xm:x1, :3] = (1.0, 0.42, 0.0)      # skin rough, nails smoother, neither metal
        px[y0:y1, x0:x1, 3] = 1; img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
    v = (i + H / 2) / N
    print('SWATCH', W, H, 'cells at', i, j)
    return (lambda s: ((j + 0.6 + max(0.0, min(1.0, s)) * (GW - 1.2)) / N, v)), ((j + GW + NW / 2) / N, v)


def skin_colour(o, side):
    me = o.data; mw = o.matrix_world; mat = me.materials[0]
    base = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image
    w, h = base.size; px = np.empty(w * h * 4, 'f'); base.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    got = []
    for p in me.polygons:
        c = mw @ p.center
        if c.x * side > 0.93 and c.x * side < 1.0 and c.y > -0.10 and p.normal.z > 0.5:      # the back of the hand, clear of thumb and bracer
            for li in p.loop_indices:
                u, v = me.uv_layers.active.data[li].uv; got.append(px[int(v % 1 * (h - 1)), int(u % 1 * (w - 1)), :3])
    a = np.array(got); return tuple(np.median(a, axis=0)) if len(a) else (0.3, 0.4, 0.5)


def blue(o, px, w, h, p):      # is this face skin (blue) or the bracer (gold)?
    uvd = o.data.uv_layers.active.data; c = np.mean([px[int(uvd[li].uv[1] % 1 * (h - 1)), int(uvd[li].uv[0] % 1 * (w - 1)), :3] for li in p.loop_indices], axis=0)
    return c[2] > c[0]


def wrist(o, side):      # where the bracer ends and her skin begins, found by colour
    me = o.data; mw = o.matrix_world; mat = me.materials[0]
    base = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED').inputs['Base Color'].links[0].from_node.image
    w, h = base.size; px = np.empty(w * h * 4, 'f'); base.pixels.foreach_get(px); px = px.reshape(h, w, 4)
    rows = {}
    for p in me.polygons:
        x = (mw @ p.center).x * side
        if 0.80 < x < 0.93: rows.setdefault(int((x - 0.80) / 0.004), []).append(blue(o, px, w, h, p))
    for k in sorted(rows):
        if len(rows[k]) > 8 and sum(rows[k]) / len(rows[k]) > 0.97: return 0.80 + k * 0.004 + 0.003
    return 0.87


def chain_t(p, pts):      # nearest place on a line of joints: (distance, segment, how far along it 0..1)
    best = (1e9, 0, 0.0)
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]; ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared)); d = (p - (a + ab * t)).length
        if d < best[0]: best = (d, k, t)
    return best


def hands(o, arm):
    said = []; skins = [skin_colour(o, s) for s in (1, -1)]; skin = tuple(float(a + b) / 2 for a, b in zip(*skins))
    mw = o.matrix_world; inv = mw.inverted(); M = arm.matrix_world; cuts = {s: wrist(o, s) for s in (1, -1)}
    bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.verify(); made = {}
    for side, name in ((1, 'Left'), (-1, 'Right')):
        pre = 'mixamorig:' + name + 'Hand'; W = cuts[side]
        # 1. her hand is taken off the arm at the end of the bracer; what its points were carried by is remembered
        IN = 0.012      # the new hand begins this far inside the arm's skin, so its rounded end is never seen
        for at in (W - IN, W):
            geom = [f for f in bm.faces if all((mw @ v.co).x * side > 0.80 for v in f.verts)]
            geom = list({e for f in geom for e in f.edges}) + list({v for f in geom for v in f.verts}) + geom
            bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=inv @ Vector((at * side, 0, 0)), plane_no=(inv.to_3x3() @ Vector((side, 0, 0))).normalized())
        off = [f for f in bm.faces if (mw @ f.calc_center_median()).x * side > W]; src = [f for f in bm.faces if (mw @ f.calc_center_median()).x * side > W - IN]
        old = list({v for f in src for v in f.verts}); kd = KDTree(len(old)); carried = []
        for n, v in enumerate(old): kd.insert(mw @ v.co, n); carried.append(dict(v[dl]))
        kd.balance()
        hb = bmesh.new(); new = {v: hb.verts.new(mw @ v.co) for v in old}
        for f in src:
            try: hb.faces.new([new[v] for v in f.verts])
            except ValueError: pass
        bmesh.ops.delete(bm, geom=off, context='FACES')
        # 2. the lump comes off at the knuckles; the fingers are set in its place, solid, a little way into the palm
        g2 = hb.faces[:] + hb.edges[:] + hb.verts[:]
        bmesh.ops.bisect_plane(hb, geom=g2, dist=1e-6, plane_co=Vector((CUT * side, 0, 0)), plane_no=Vector((side, 0, 0)), clear_outer=True)
        bmesh.ops.holes_fill(hb, edges=[e for e in hb.edges if e.is_boundary], sides=0)
        rim = [v.co for v in hb.verts if abs(v.co.x * side - CUT) < 2e-4]
        zc = (min(p.z for p in rim) + max(p.z for p in rim)) / 2; zh = (max(p.z for p in rim) - min(p.z for p in rim)) / 2
        digits = []; mix = lambda a, c, t: a + (c - a) * t
        for fname, thick, ext in FINGERS:
            b = [arm.data.bones[pre + fname + str(k)] for k in (1, 2, 3)]
            j = [M @ b[0].head_local, M @ b[1].head_local, M @ b[2].head_local, M @ b[2].tail_local]
            d2 = (j[3] - j[2]).normalized(); tip = j[3] + d2 * ext; ry, rz = RY * thick, RZ * thick
            digits.append({'pts': [j[0], j[1], j[2], tip], 'g': [o.vertex_groups[x.name].index for x in b], 'r': rz, 'd': d2, 'thick': thick})
            wz = zh / rz      # as deep as the palm where it leaves it
            st = [(Vector((CUT * side - 0.030 * side, j[0].y, zc)), 1.12, wz), (Vector((CUT * side, j[0].y, zc)), 1.12, wz), (Vector((j[0].x + 0.004 * side, j[0].y, zc + (j[0].z - zc) * 0.6)), 1.10, wz * 1.02),
                  (mix(j[0], j[1], 0.34), 1.05, 1.0 + (wz - 1.0) * 0.45), (mix(j[0], j[1], 0.68), 0.97, 0.99), (j[1], 1.06, 1.06), (mix(j[1], j[2], 0.5), 0.93, 0.93), (j[2], 1.01, 1.01),
                  (mix(j[2], tip, 0.45), 0.90, 0.90), (tip - d2 * rz * 0.80, 0.78, 0.78), (tip - d2 * rz * 0.40, 0.60, 0.60), (tip - d2 * rz * 0.10, 0.32, 0.32)]
            rings = []
            for k, (c, sy, sz) in enumerate(st):
                d = (st[min(k + 1, len(st) - 1)][0] - st[max(k - 1, 0)][0]).normalized(); sv = Vector((0, 0, 1)).cross(d).normalized(); up = d.cross(sv).normalized()
                taper = 1.0 - 0.15 * max(0, k - 3) / (len(st) - 4)
                rings.append([hb.verts.new(c + sv * (ry * sy * taper * math.cos(2 * math.pi * a / SIDES)) + up * (rz * sz * taper * math.sin(2 * math.pi * a / SIDES))) for a in range(SIDES)])
            ends = [hb.verts.new(st[0][0]), hb.verts.new(tip)]; fs = []
            for k in range(len(rings) - 1):
                for a in range(SIDES): fs.append(hb.faces.new((rings[k][a], rings[k][(a + 1) % SIDES], rings[k + 1][(a + 1) % SIDES], rings[k + 1][a])))
            for a in range(SIDES): fs.append(hb.faces.new((rings[0][(a + 1) % SIDES], rings[0][a], ends[0]))); fs.append(hb.faces.new((rings[-1][a], rings[-1][(a + 1) % SIDES], ends[1])))
            bmesh.ops.recalc_face_normals(hb, faces=fs)
        tb = [arm.data.bones[pre + 'Thumb' + str(k)] for k in (1, 2, 3)]
        thumb = {'pts': [M @ tb[0].head_local, M @ tb[1].head_local, M @ tb[2].head_local, M @ tb[2].tail_local], 'g': [o.vertex_groups[x.name].index for x in tb], 'd': (M @ tb[2].tail_local - M @ tb[2].head_local).normalized(), 'thick': 1.15, 'r': 0.022}
        # 3. one skin over palm, thumb and fingers: remade from the solid shape, smoothed, slimmed
        me = bpy.data.meshes.new('hand'); hb.normal_update(); hb.to_mesh(me); hb.free()
        ob = bpy.data.objects.new('hand', me); bpy.context.scene.collection.objects.link(ob)
        r = ob.modifiers.new('r', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = VOXEL; r.adaptivity = 0
        sm = ob.modifiers.new('s', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 7
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); raw = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); n = len(raw.polygons)
        rb = bmesh.new(); rb.from_mesh(raw)      # the line where the lump was cut is worked over again, until palm and fingers are one slope
        seam = [v for v in rb.verts if abs(v.co.x * side - CUT) < 0.022]
        for _ in range(16): bmesh.ops.smooth_vert(rb, verts=seam, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        rb.to_mesh(raw); rb.free(); ob2 = bpy.data.objects.new('hand2', raw); bpy.context.scene.collection.objects.link(ob2)
        dc = ob2.modifiers.new('d', 'DECIMATE'); dc.ratio = min(1.0, TRIS / max(1, n * 2)); dc.use_collapse_triangulate = True
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); fin = bpy.data.meshes.new_from_object(ob2.evaluated_get(dg)); bpy.data.objects.remove(ob2, do_unlink=True)
        fb = bmesh.new(); fb.from_mesh(fin); fb.normal_update()
        made[side] = (fb, digits, thumb, kd, carried, W, o.vertex_groups[pre].index); bpy.data.objects.remove(ob, do_unlink=True)
        said.append(f'{name.lower()} hand from x {W:.3f}: {n} faces remade, {len(fb.faces)} kept')
    bm.normal_update(); bm.to_mesh(o.data); bm.free(); o.data.update()
    shade, nail_uv = swatch(o, skin)      # the old hands' place in the texture is free now
    bm = bmesh.new(); bm.from_mesh(o.data); dl = bm.verts.layers.deform.verify(); uvl = bm.loops.layers.uv.active
    for side in (1, -1):
        fb, digits, thumb, kd, carried, W, hand_g = made[side]; verts = {}
        for v in fb.verts:
            p = v.co.copy(); x = p.x * side
            if x < W + 0.002:      # the end that sits in the bracer is drawn in under the arm's own skin
                c = Vector((p.x, -0.061, 0.471)); p = c + (p - c) * (1 - 0.035 * min(1.0, (W + 0.002 - x) / 0.004))
            nv = bm.verts.new(inv @ p); w = dict(carried[kd.find(v.co)[1]])      # carried as her own hand was carried, there
            near = min(digits, key=lambda g: chain_t(v.co, g['pts'])[0]); dist, seg, t = chain_t(v.co, near['pts']); j0 = near['pts'][0]
            if x > j0.x * side - 0.016 and dist < near['r'] * 2.2:      # a finger: each part by its own bone, shared across a joint; into the hand it gives way to what carried the palm
                g = near['g']; L = [(near['pts'][k + 1] - near['pts'][k]).length for k in range(3)]; along = sum(L[:seg]) + L[seg] * t; fw = {}
                e1, e2 = L[0], L[0] + L[1]; soft = 0.009
                for k, (a, b_) in enumerate(((-1e9, e1), (e1, e2), (e2, 1e9))):
                    lo = 1.0 if a < -1e8 else max(0.0, min(1.0, (along - a) / (2 * soft) + 0.5)); hi = 1.0 if b_ > 1e8 else max(0.0, min(1.0, (b_ - along) / (2 * soft) + 0.5)); fw[g[k]] = max(0.0, lo + hi - 1.0)
                tot = sum(fw.values()) or 1.0; into = max(0.0, min(1.0, (x - (j0.x * side - 0.016)) / 0.020))
                w = {k: q * (1 - into) for k, q in w.items()}
                for k, q in fw.items(): w[k] = w.get(k, 0.0) + q / tot * into
            tot = sum(w.values()) or 1.0
            for k, q in w.items():
                if q > 1e-4: nv[dl][k] = q / tot
            side_of = abs((v.co - (near['pts'][seg] + (near['pts'][seg + 1] - near['pts'][seg]) * t)).y) / near['r'] if dist < near['r'] * 2.2 and x > CUT else 0.0
            verts[v] = (nv, 0.56 + 0.20 * v.normal.z - 0.16 * min(1.0, side_of))      # lighter on top, darker underneath and between the fingers
        new = []
        for f in fb.faces:
            try: nf = bm.faces.new([verts[v][0] for v in f.verts])
            except ValueError: continue
            nf.smooth = True; new.append(nf)
            for l, v in zip(nf.loops, f.verts): l[uvl].uv = shade(verts[v][1])
        # 4. nails: a small pointed plate on the top of each fingertip and of the thumb, lying on the new skin
        fb.verts.ensure_lookup_table()
        for g in digits + [thumb]:
            # the nail lies on the highest point of the last joint of this finger, a little short of its tip
            d = g['d']; tip = g['pts'][3]; best = None
            for v in fb.verts:
                dist, seg, t = chain_t(v.co, g['pts'])
                if seg == 2 and 0.40 < t < 0.72 and dist < g['r'] * 2.4 and min([g] + digits + [thumb], key=lambda q: chain_t(v.co, q['pts'])[0]) is g:
                    if best is None or v.co.z > best.co.z: best = v
            if best is None: continue
            at = best.co.copy(); up = best.normal.copy(); up = (up - d * up.dot(d)).normalized(); sv = up.cross(d).normalized(); k = g['thick']
            base = at + up * 0.0010; outline = [(-0.008, 0.0), (-0.007, 0.0066), (0.0, 0.0086), (0.008, 0.0070), (0.0145, 0.0), (0.008, -0.0070), (0.0, -0.0086), (-0.007, -0.0066)]
            ring = []
            for a, c in outline:
                q = bm.verts.new(inv @ (base + d * (a * k) + sv * (c * k) - up * (0.0030 * (abs(c) / 0.0086) ** 2 + (0.0030 if a > 0.008 else 0.0)))); q[dl][g['g'][2]] = 1.0; ring.append(q)
            mid = bm.verts.new(inv @ (base + d * (0.003 * k) + up * 0.0024)); mid[dl][g['g'][2]] = 1.0
            for a in range(len(ring)):
                nf = bm.faces.new((ring[a], ring[(a + 1) % len(ring)], mid)); nf.smooth = True; nf.normal_update()
                if nf.normal.dot(inv.to_3x3() @ up) < 0: nf.normal_flip()
                for l in nf.loops: l[uvl].uv = nail_uv
        fb.free()
    bm.normal_update(); bm.to_mesh(o.data); bm.free(); o.data.update()
    o.name = o.data.name = 'body_fingers'      # the game reads this name: a body with fingers is given its grip there (guard.js)
    return 'hands made: ' + '; '.join(said) + f'; skin {tuple(round(x, 2) for x in skin)}'
