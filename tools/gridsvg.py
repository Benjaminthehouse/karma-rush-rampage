#!/usr/bin/env python3
"""Turns a pixel-art SVG made of grid squares into a PNG with one pixel per square.

Reads the <rect> cells directly, so the cell size, an offset and slightly non-square
cells are all fine (tools/pixelize.cjs needs whole 8-unit cells).

    python3 tools/gridsvg.py in.svg out.png [--merge N]

--merge N  the drawing is finer than its real pixels: every N by N cells is one art pixel
"""
import argparse
import re
from collections import Counter
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('out')
ap.add_argument('--merge', type=int, default=1)
a = ap.parse_args()

NAMED = {'black': '#000000', 'white': '#ffffff'}
cells = []
for m in re.finditer(r'<rect ([^>]*)/>', open(a.src).read()):
    at = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
    if 'fill' not in at or at['fill'] == 'none' or float(at.get('width', 0)) > 40:
        continue  # the clip rectangle, not a cell
    f = NAMED.get(at['fill'], at['fill'])
    cells.append((float(at.get('x', 0)), float(at.get('y', 0)), float(at['width']), float(at['height']), f))
cw = Counter(c[2] for c in cells).most_common(1)[0][0]
ch = Counter(c[3] for c in cells).most_common(1)[0][0]
x0 = min(c[0] for c in cells)
y0 = min(c[1] for c in cells)
cols = round((max(c[0] for c in cells) - x0) / cw) + 1
rows = round((max(c[1] for c in cells) - y0) / ch) + 1
im = Image.new('RGBA', (cols, rows), (0, 0, 0, 0))
for x, y, _, _, f in cells:
    im.putpixel((round((x - x0) / cw), round((y - y0) / ch)), (int(f[1:3], 16), int(f[3:5], 16), int(f[5:7], 16), 255))
if a.merge > 1:
    n = a.merge
    out = Image.new('RGBA', ((cols + n - 1) // n, (rows + n - 1) // n), (0, 0, 0, 0))
    for by in range(out.height):
        for bx in range(out.width):
            block = [im.getpixel((x, y)) for y in range(by * n, min(rows, by * n + n)) for x in range(bx * n, min(cols, bx * n + n))]
            out.putpixel((bx, by), Counter(block).most_common(1)[0][0])  # the block's commonest colour
    im = out
im.save(a.out, optimize=True)
print(f'{a.out}: {im.width}x{im.height} from {len(cells)} cells of {cw:g}x{ch:g}')
