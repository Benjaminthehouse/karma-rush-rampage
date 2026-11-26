#!/usr/bin/env python3
"""Cuts a sheet of separate drawings on a white (or transparent) background into one
file per drawing.

    python3 tools/sheetcut.py sheet.png out_dir [--gap 12]

Anything closer together than --gap source pixels counts as one drawing. The pieces are
numbered left to right, top to bottom, and a contact sheet with the numbers is written
too, so each can be named. Run tools/repixel.py on a piece afterwards to snap it to the
pixel grid.
"""
import argparse
import os
from collections import deque
from PIL import Image, ImageDraw, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('out')
ap.add_argument('--gap', type=int, default=12)
a = ap.parse_args()

im = Image.open(a.src).convert('RGBA')
W, H = im.size
# What is drawing: not see-through and not near-white.
r, g, b, al = im.split()
white = Image.eval(r, lambda v: 255 if v > 236 else 0)
for ch in (g, b):
    white = Image.composite(white, Image.new('L', im.size, 0), Image.eval(ch, lambda v: 255 if v > 236 else 0))
ink = Image.composite(Image.new('L', im.size, 0), Image.eval(al, lambda v: 255 if v > 40 else 0), white)
# Work at a quarter size, and grow the ink so the parts of one drawing join up.
q = 4
small = ink.resize((W // q, H // q), Image.BOX).point(lambda v: 255 if v > 20 else 0)
grow = max(1, a.gap // (2 * q))
small = small.filter(ImageFilter.MaxFilter(grow * 2 + 1))
px = small.load()
w, h = small.size
seen = bytearray(w * h)
boxes = []
for sy in range(h):
    for sx in range(w):
        if not px[sx, sy] or seen[sy * w + sx]:
            continue
        x0 = x1 = sx
        y0 = y1 = sy
        todo = deque([(sx, sy)])
        seen[sy * w + sx] = 1
        while todo:
            x, y = todo.popleft()
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                    seen[ny * w + nx] = 1
                    todo.append((nx, ny))
        box = (max(0, (x0 - 1) * q), max(0, (y0 - 1) * q), min(W, (x1 + 2) * q), min(H, (y1 + 2) * q))
        if (box[2] - box[0]) * (box[3] - box[1]) >= 1600:  # skip specks
            boxes.append(box)
boxes.sort(key=lambda bx: (round(bx[1] / (H / 8)), bx[0]))
os.makedirs(a.out, exist_ok=True)
sheet = im.copy()
d = ImageDraw.Draw(sheet)
for i, bx in enumerate(boxes):
    im.crop(bx).save(f'{a.out}/p{i:02d}.png')
    d.rectangle(bx, outline=(255, 0, 255, 255), width=3)
    d.rectangle((bx[0], bx[1], bx[0] + 44, bx[1] + 30), fill=(255, 0, 255, 255))
    d.text((bx[0] + 6, bx[1] + 6), str(i), fill=(255, 255, 255, 255))
    print(i, bx, f'{bx[2] - bx[0]}x{bx[3] - bx[1]}')
sheet.save(f'{a.out}/contact.png')
