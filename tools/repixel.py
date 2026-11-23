#!/usr/bin/env python3
"""Turns a picture that only looks like pixel art into real pixel art.

Art from an image generator, or pixel art that has been resized or compressed, has soft
"pixels" that sit on no grid. This samples it down so that one art pixel is one image
pixel, snaps the colours to a small palette, and writes a tiny PNG that the game scales
up crisply (`image-rendering: pixelated`).

    python3 tools/repixel.py in.webp out.png --block 5 --colours 48

--block    how many source pixels make one art pixel (zoom in and measure)
--colours  palette size; fewer is crisper, more keeps gradients smoother. (The octree
           palette keeps rare colours, such as a few gold stars in a blue sky.)
--alpha    keep transparency (for sprites cut out of their background)
"""
import argparse
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('out')
ap.add_argument('--block', type=float, default=5)
ap.add_argument('--colours', type=int, default=48)
ap.add_argument('--alpha', action='store_true')
a = ap.parse_args()

im = Image.open(a.src).convert('RGBA' if a.alpha else 'RGB')
w, h = round(im.width / a.block), round(im.height / a.block)
small = im.resize((w, h), Image.BOX)
if a.alpha:
    # Hard-edged transparency: a pixel is there or it is not.
    alpha = small.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    rgb = small.convert('RGB').quantize(a.colours, method=Image.FASTOCTREE, dither=Image.NONE).convert('RGB')
    rgb.putalpha(alpha)
    rgb.save(a.out, optimize=True)
else:
    small.quantize(a.colours, method=Image.FASTOCTREE, dither=Image.NONE).save(a.out, optimize=True)
print(f'{a.out}: {w}x{h}, {a.colours} colours')
