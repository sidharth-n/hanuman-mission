# Finger bones for a character rigged by Mixamo with one finger chain a hand (its skeleton for a mitten: Hanuman's).
# Four fingers and a thumb are laid out on each hand from the shape of the hand itself: the knuckles across its width
# where the lump thins into fingers, each finger running on along the hand, a little fanned and a little bent. Every
# new bone is turned exactly as the bone of the old chain at the same joint is, so the game can give each finger the
# old chain's turning as it stands (hero.js), and every animation that closed the mitten closes the fingers.
#   used by tools/build_character.py (hands=real), before tools/hands3d.py makes the hands themselves
import bpy, math
from mathutils import Vector

FINGERS = (('Index', -1.5, 0.15, 0.93, -0.07), ('Middle', -0.5, 0.0, 1.0, -0.02), ('Ring', 0.5, 0.2, 0.95, 0.03), ('Pinky', 1.5, 0.55, 0.78, 0.10))      # name, place across (knuckle widths), how far back its knuckle sits, length, fan
PARTS = (0.46, 0.30, 0.24)      # the three parts of a finger, of its length
BEND = (0.05, 0.12, 0.17)      # each part's dip below the back of the hand, at rest


def finger_bones(arm, o, tag='Real', long=1.0):
    M = arm.matrix_world; Mi = M.inverted(); mw = o.matrix_world; said = []; plan = {}
    pts = [mw @ v.co for v in o.data.vertices]
    for side, s in (('Left', 1), ('Right', -1)):
        hb = arm.data.bones['mixamorig:%sHand' % side]; d1 = arm.data.bones['mixamorig:%sHandIndex1' % side]
        h = M @ hb.head_local; along = ((M @ d1.head_local) - h).normalized()
        across = Vector((0, 1, 0)); across = (across - along * across.dot(along)).normalized(); up = along.cross(across) * s      # arms out, palms down: the little finger is to the back
        hand = [Vector(((p - h).dot(along), (p - h).dot(across), (p - h).dot(up))) for p in pts]
        hand = [q for q in hand if -0.02 < q.x < 0.4 and math.hypot(q.y, q.z) < 0.16]
        tip = max(q.x for q in hand); ak = 0.6 * tip      # where the lump thins into fingers
        band = [q for q in hand if ak + 0.005 <= q.x < ak + 0.025]
        c0 = (min(q.y for q in band) + max(q.y for q in band)) / 2; sp = (max(q.y for q in band) - min(q.y for q in band)) / 4
        fz = [q.z for q in hand if q.x > ak + 0.01]; zc = (min(fz) + max(fz)) / 2
        W = lambda q, h=h, along=along, across=across, up=up: h + along * q.x + across * q.y + up * q.z
        joints = {}
        for name, place, back, length, fan in FINGERS:
            q = Vector((ak - back * sp, c0 + place * sp, zc)); L = max(1.2 * sp, (tip - ak) * long * length - 0.45 * sp); js = [q.copy()]
            for part, dip in zip(PARTS, BEND):
                q = q + Vector((math.cos(fan) * math.cos(dip), math.sin(fan) * math.cos(dip), -math.sin(dip))) * (L * part); js.append(q.copy())
            joints[name] = [W(j) for j in js]
        joints['Thumb'] = [W(Vector(j)) for j in ((0.25 * ak, c0 - 1.7 * sp, zc - 0.5 * sp), (0.55 * ak, c0 - 2.25 * sp, zc - 0.8 * sp), (0.80 * ak, c0 - 2.45 * sp, zc - 1.0 * sp), (1.0 * ak, c0 - 2.5 * sp, zc - 1.1 * sp))]
        plan[side] = joints; said.append(f'{side.lower()}: knuckles {sp * 100:.1f} cm apart, {ak * 100:.1f} cm from the wrist, fingertips at {tip * 100:.1f}')
    bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); eb = arm.data.edit_bones; names = []
    for side, joints in plan.items():
        drv = [eb['mixamorig:%sHandIndex%d' % (side, k)] for k in (1, 2, 3, 4)]
        for f, js in joints.items():
            par = eb['mixamorig:%sHand' % side]
            for k, q in enumerate(js):
                b = eb.new('mixamorig:%sHand%s%s%d' % (side, tag, f, k + 1)); b.head = (0, 0, 0); b.tail = (0, 1.0, 0)
                m = drv[min(k, 3)].matrix.to_3x3().to_4x4(); m.translation = Mi @ q; b.matrix = m      # turned as the old chain's bone at this joint is
                b.parent = par; b.use_connect = False; par = b; names.append(b.name)
    bpy.ops.object.mode_set(mode='OBJECT')
    for n in names:
        if n not in o.vertex_groups: o.vertex_groups.new(name=n)
    return f'finger bones: {len(names)} added; ' + '; '.join(said)
