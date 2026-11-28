#!/usr/bin/env python3
"""Gives drawn props one solid black outline.

    python3 tools/art-ink.py art/sprites/*.png

The house look is a black outline (#0b1020, the game's ink) round saturated colour. The
generator mixes in a navy (#151c33) and sometimes leaves grey or blue-grey pixels on the
edge; this turns the navy black everywhere and any grey pixel that touches the outside
black. Run it on new props before tools/art-sprites.py.
"""
import sys
from PIL import Image

INK = (0x0b, 0x10, 0x20)
NAVY = {(0x15, 0x1c, 0x33)}
GREYS = {tuple(bytes.fromhex(h)) for h in ('2c3763', '3a4370', '4b5890', '646e9c', '7c86b0', 'a8b1d6', 'a9cbff')}
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA')
    px = im.load()
    w, h = im.size
    clear = lambda x, y: not (0 <= x < w and 0 <= y < h) or px[x, y][3] < 128
    edge = [(x, y) for y in range(h) for x in range(w) if not clear(x, y) and px[x, y][:3] in GREYS
            and any(clear(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    n = len(edge)
    for x, y in edge:
        px[x, y] = INK + (255,)
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= 128 and px[x, y][:3] in NAVY:
                px[x, y] = INK + (255,)
                n += 1
    if n:
        im.save(f, optimize=True)
        print(f'{f}: {n} pixels inked')
