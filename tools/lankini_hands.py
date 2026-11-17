# Lankini's hands, drawn right: the generator gave her mittens whose texture only hints at fingers (faint dark streaks
# where the gaps should be). Here the flat picture of each hand (tools/retouch.py, from above) is redrawn by rule, its
# outline untouched: along the fingers' part of the hand three gaps are drawn, dark and clean, following the hand's own
# taper to its tip; the backs of the four fingers between are lifted a little, and a row of knuckles is set where they begin.
#   blender -b -P tools/lankini_hands.py -- <pictures dir>      (reads hand_l-before.png, hand_r-before.png; writes -after.png)
import bpy, sys, os
import numpy as np
d = sys.argv[sys.argv.index('--') + 1]

def blur(a, n, axis):      # a box blur, n pixels across, along one axis
    k = np.ones(n, 'f') / n
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), axis, a)

for name, tip_right in (('hand_l', True), ('hand_r', False)):
    img = bpy.data.images.load(os.path.join(d, name + '-before.png')); w, h = img.size
    a = np.empty(w * h * 4, 'f'); img.pixels.foreach_get(a); a = a.reshape(h, w, 4); rgb = a[:, :, :3].copy()
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    skin = ((b > r * 1.12) & (b > 0.12)).astype('f')      # her blue skin: not the grey behind, not the gold bracer
    cols = np.where(skin.sum(0) > 8)[0]; c0, c1 = cols.min(), cols.max(); span = c1 - c0
    x = np.arange(w, dtype='f'); u = (x - c0) / span if tip_right else (c1 - x) / span      # 0 at the wrist, 1 at the finger tips
    out = rgb.copy(); rows = np.arange(h, dtype='f')
    # the fingers' own band in each column: the longest unbroken run of skin (the thumb, where it shows beside it, is a shorter one)
    lo = np.full(w, np.nan, 'f'); hi = np.full(w, np.nan, 'f')
    for c in range(w):
        if u[c] < 0.40 or u[c] > 1 or skin[:, c].sum() < 12: continue
        on = np.where(skin[:, c] > 0.5)[0]; runs = np.split(on, np.where(np.diff(on) > 2)[0] + 1); run = max(runs, key=len)
        if run[-1] - run[0] >= 30: lo[c], hi[c] = run[0], run[-1]
    ok = ~np.isnan(lo); cs = np.where(ok)[0]
    smooth = lambda v: np.convolve(np.pad(v[cs], 20, mode='edge'), np.ones(41, 'f') / 41, mode='valid')      # the band's edges eased along the hand, so no line jumps where the outline is notched
    lo[cs] = smooth(lo); hi[cs] = smooth(hi)
    for c in cs:
        wide = hi[c] - lo[c]; t = min(1.0, max(0.0, (u[c] - 0.45) / 0.10)); fade = t * t * (3 - 2 * t)      # the gaps open out of the knuckles
        v = (rows - lo[c]) / wide
        dark = np.zeros(h, 'f')
        for at in (0.265, 0.515, 0.755):      # three gaps between four fingers
            dark = np.maximum(dark, np.exp(-((v - at) * wide / (3.2 + 3.0 * fade)) ** 2))
        inside = ((v > 0.02) & (v < 0.98)).astype('f')
        lift = np.clip(np.sin(v * np.pi * 4) ** 2, 0, 1) * inside      # the back of each finger a little lighter than its sides
        k = (1 - 0.62 * fade * dark) * (1 + 0.07 * fade * lift * (1 - dark))
        k = k * (1 + 0.16 * np.exp(-((u[c] - 0.50) / 0.035) ** 2) * lift * (1 - dark))      # a row of knuckles where the fingers begin
        out[:, c, :] = rgb[:, c, :] * (np.where(skin[:, c] > 0.5, k, 1.0))[:, None]
    a[:, :, :3] = np.clip(out, 0, 1)
    res = bpy.data.images.new(name + '-after', w, h, alpha=True); res.pixels.foreach_set(a.ravel())
    res.filepath_raw = os.path.join(d, name + '-after.png'); res.file_format = 'PNG'; res.save()
    print('DREW', name, 'hand spans columns', int(c0), int(c1))
