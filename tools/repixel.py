#!/usr/bin/env python3
"""Turns a picture that only looks like pixel art into real pixel art.

Art from an image generator, or pixel art that has been resized or compressed, has soft
"pixels" that sit on no grid. This samples it down so that one art pixel is one image
pixel, snaps the colours to a small palette, and writes a tiny PNG that the game scales
up crisply (`image-rendering: pixelated`).

    python3 tools/repixel.py in.webp out.png --block 5 --colours 48
    python3 tools/repixel.py sprite.webp out.png --block 12 --cutout

--block    how many source pixels make one art pixel (zoom in and measure)
--colours  palette size; fewer is crisper, more keeps gradients smoother. (The octree
           palette keeps rare colours, such as a few gold stars in a blue sky.)
--alpha    keep the transparency the picture already has
--cutout   the picture is a sprite on a plain white background: everything near-white
           that connects to the border becomes transparent (white inside the art stays)
--holes    with --cutout: near-white fully enclosed by the art goes too (the sky seen
           between a tree's branches)
"""
import argparse
from collections import deque
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('out')
ap.add_argument('--block', type=float, default=5)
ap.add_argument('--colours', type=int, default=48)
ap.add_argument('--alpha', action='store_true')
ap.add_argument('--cutout', action='store_true')
ap.add_argument('--holes', action='store_true')
a = ap.parse_args()

im = Image.open(a.src).convert('RGBA' if (a.alpha or a.cutout) else 'RGB')
if a.cutout:
    # Flood in from the border over near-white, so only the background goes.
    px = im.load()
    W, H = im.size
    white = lambda p: p[0] > 228 and p[1] > 228 and p[2] > 228
    seen = bytearray(W * H)
    todo = deque((x, y) for x in range(W) for y in (0, H - 1)) + deque((x, y) for y in range(H) for x in (0, W - 1))
    while todo:
        x, y = todo.popleft()
        if x < 0 or y < 0 or x >= W or y >= H or seen[y * W + x]:
            continue
        seen[y * W + x] = 1
        if not white(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        todo.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    if a.holes:
        for y in range(H):
            for x in range(W):
                if white(px[x, y]):
                    px[x, y] = (0, 0, 0, 0)

w, h = round(im.width / a.block), round(im.height / a.block)
if im.mode == 'RGBA':
    # Average with the alpha multiplied in, so see-through pixels do not tint the edges.
    small = im.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
    alpha = small.getchannel('A').point(lambda v: 255 if v >= 128 else 0)  # there or not there
    rgb = small.convert('RGB').quantize(a.colours, method=Image.FASTOCTREE, dither=Image.NONE).convert('RGB')
    rgb.putalpha(alpha)
    box = rgb.getbbox()  # trim the empty margin
    rgb = rgb.crop(box)
    rgb.save(a.out, optimize=True)
    w, h = rgb.size
else:
    im.resize((w, h), Image.BOX).quantize(a.colours, method=Image.FASTOCTREE, dither=Image.NONE).save(a.out, optimize=True)
print(f'{a.out}: {w}x{h}, {a.colours} colours')
