# Repair Mixamo auto-rig weights on a character that Mixamo does not understand:
#   - the whole head (chin, jaw, crown) follows the Head bone, with a soft band at the neck
#   - the tail is found on the mesh, gets its own bone chain off the hips and loses every arm/spine weight
# Used by build_character.py (pass "fix" as the 7th argument). World space is metres, Z up, character faces -Y.
import bpy, heapq, math
from mathutils import Vector

HEAD = dict(chin_z=1.335, chin_y=-0.20, slope=0.255, band=0.03, axis_y=-0.11, r0=0.18, r_band=0.04)
TAIL = dict(bones=8, step=0.03, flare=1.6, min_len=0.5, max_radius=0.08, root_blend=0.08)
ROOT_KEEP = ('Hips', 'Spine', 'LeftUpLeg', 'RightUpLeg')


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def short(name):
    return name.split(':')[-1]


def bone_name(arm, wanted):
    return next((b.name for b in arm.data.bones if short(b.name) == wanted), None)


def bone_pos(arm, wanted):
    n = bone_name(arm, wanted)
    return arm.matrix_world @ arm.data.bones[n].head_local if n else None


def graph(ob):
    """World positions, a weld map (UV seams split vertices) and a welded edge graph."""
    me, M = ob.data, ob.matrix_world
    co = [M @ v.co for v in me.vertices]
    key, canon = {}, []
    for i, c in enumerate(co):
        canon.append(key.setdefault((round(c.x, 4), round(c.y, 4), round(c.z, 4)), i))
    adj = {}
    for e in me.edges:
        a, b = canon[e.vertices[0]], canon[e.vertices[1]]
        if a == b:
            continue
        w = (co[a] - co[b]).length
        adj.setdefault(a, []).append((b, w))
        adj.setdefault(b, []).append((a, w))
    return co, canon, adj


def dijkstra(adj, seed):
    d, heap = {seed: 0.0}, [(0.0, seed)]
    while heap:
        dv, v = heapq.heappop(heap)
        if dv > d.get(v, 1e9):
            continue
        for n, w in adj.get(v, ()):
            nd = dv + w
            if nd < d.get(n, 1e9):
                d[n] = nd
                heapq.heappush(heap, (nd, n))
    return d


def set_weights(ob, index, weights):
    for g in [g.group for g in ob.data.vertices[index].groups]:
        ob.vertex_groups[g].remove([index])
    total = sum(weights.values()) or 1.0
    for name, w in weights.items():
        if w > 1e-4:
            (ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name)).add([index], w / total, 'REPLACE')


def current_weights(ob, index):
    out = {}
    for g in ob.data.vertices[index].groups:
        if g.weight > 0:
            out[ob.vertex_groups[g.group].name] = g.weight
    total = sum(out.values())
    return {k: v / total for k, v in out.items()} if total else {}


def find_tail(arm, co, adj, p):
    """Surface distance from the tail tip for every tail vertex, the tail length and its tip, or None."""
    hips = bone_pos(arm, 'Hips')
    near = [i for i in adj if abs(co[i].x - hips.x) < 0.06 and abs(co[i].z - hips.z) < 0.06]
    if not near:
        return None
    d = dijkstra(adj, min(near, key=lambda i: co[i].y))
    ends = [bone_pos(arm, n) for n in ('LeftHand', 'RightHand', 'LeftToeBase', 'RightToeBase', 'LeftFoot',
                                       'RightFoot', 'HeadTop_End', 'Head')]
    ends = [e for e in ends if e is not None]
    peaks = sorted((v for v in d if all(d[v] >= d.get(n, 0) for n, _ in adj[v])), key=lambda v: -d[v])
    for tip in peaks[:40]:
        if any((co[tip] - e).length < 0.32 for e in ends):
            continue
        dt = dijkstra(adj, tip)
        bins = {}
        for v, dv in dt.items():
            bins.setdefault(int(dv / p['step']), []).append(v)
        radii = []
        for b in range(max(bins) + 1):
            vs = bins.get(b)
            if not vs:
                break
            c = sum((co[v] for v in vs), Vector()) / len(vs)
            r = max((co[v] - c).length for v in vs)
            if b >= 5 and r > p['flare'] * sorted(radii)[len(radii) // 2]:
                break
            radii.append(r)
        length = len(radii) * p['step']
        if length >= p['min_len'] and sorted(radii)[len(radii) // 2] <= p['max_radius']:
            return {v: dv for v, dv in dt.items() if dv < length}, length, tip
    return None


def fix_tail(arm, ob, co, canon, adj, p, log):
    found = find_tail(arm, co, adj, p)
    if not found:
        log('TAIL none found')
        return set()
    dt, length, tip = found
    n = p['bones']
    seg = length / n
    joints = []
    for k in range(n + 1):
        dk = length - k * seg
        ring = [v for v, dv in dt.items() if abs(dv - dk) < 0.025] or [tip]
        joints.append(sum((co[v] for v in ring), Vector()) / len(ring))
    joints[-1] = co[tip].copy()

    hips_name = bone_name(arm, 'Hips')
    prefix = hips_name[:len(hips_name) - len('Hips')]
    names = [prefix + 'Tail%d' % (k + 1) for k in range(n)]
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    inv = arm.matrix_world.inverted()
    parent = arm.data.edit_bones[hips_name]
    for k, name in enumerate(names):
        eb = arm.data.edit_bones.new(name)
        eb.head, eb.tail = inv @ joints[k], inv @ joints[k + 1]
        eb.parent, eb.use_connect = parent, k > 0
        parent = eb
    bpy.ops.object.mode_set(mode='OBJECT')

    keep = {bone_name(arm, b) for b in ROOT_KEEP}
    count = 0
    for i in range(len(ob.data.vertices)):
        dv = dt.get(canon[i])
        if dv is None:
            continue
        s = length - dv
        f = s / seg - 0.5
        i0 = math.floor(f)
        t = f - i0
        a, b = min(max(i0, 0), n - 1), min(max(i0 + 1, 0), n - 1)
        w = {names[a]: 1 - t}
        w[names[b]] = w.get(names[b], 0) + t
        mix = smooth(s / p['root_blend'])
        if mix < 1:
            body = {k: v for k, v in current_weights(ob, i).items() if k in keep} or {hips_name: 1.0}
            total = sum(body.values())
            w = {k: v * mix for k, v in w.items()}
            for k, v in body.items():
                w[k] = w.get(k, 0) + (1 - mix) * v / total
        set_weights(ob, i, w)
        count += 1
    log('TAIL', n, 'bones,', round(length, 2), 'm,', count, 'vertices, root', [round(x, 3) for x in joints[0]],
        'tip', [round(x, 3) for x in joints[-1]])
    return set(dt)


def fix_head(arm, ob, co, canon, skip, p, log):
    head_name = bone_name(arm, 'Head')
    hx = bone_pos(arm, 'Head').x
    count = 0
    for i in range(len(ob.data.vertices)):
        if canon[i] in skip:
            continue
        c = co[i]
        cut = p['chin_z'] + p['slope'] * (c.y - p['chin_y'])
        w = smooth((c.z - cut) / p['band'])
        if w <= 0:
            continue
        w *= 1 - smooth((math.hypot(c.x - hx, c.y - p['axis_y']) - p['r0']) / p['r_band'])
        if w <= 0:
            continue
        new = {k: v * (1 - w) for k, v in current_weights(ob, i).items()}
        new[head_name] = new.get(head_name, 0) + w
        set_weights(ob, i, new)
        count += 1
    log('HEAD', count, 'vertices follow', head_name)


def fix(arm, ob, head=None, tail=None, log=print):
    co, canon, adj = graph(ob)
    tail_set = fix_tail(arm, ob, co, canon, adj, {**TAIL, **(tail or {})}, log)
    fix_head(arm, ob, co, canon, tail_set, {**HEAD, **(head or {})}, log)
