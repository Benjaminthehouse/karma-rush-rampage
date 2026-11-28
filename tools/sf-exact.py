#!/usr/bin/env python3
"""Turns a Sprite Fusion preview (an exact enlargement of the sprite) back into the sprite.

    python3 tools/sf-exact.py preview.png out.png

The preview is the sprite blown up by a whole number, so every block of that many pixels is
one flat colour. This finds the number, takes one pixel per block and trims the empty margin.
"""
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
box = im.getbbox()
if not box:
    sys.exit(f'{src}: empty image')


def flat(img, k):
    return all(
        img.getpixel((x, y)) == img.getpixel((x + k - 1, y + k - 1)) == img.getpixel((x + k // 2, y + k // 2))
        for y in range(0, img.height, k)
        for x in range(0, img.width, k)
    )


for k in (16, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1):
    # The margin is a whole number of blocks too, so snap the crop to the grid.
    b = (box[0] // k * k, box[1] // k * k, -(-box[2] // k) * k, -(-box[3] // k) * k)
    c = im.crop(b)
    if c.width % k or c.height % k or not flat(c, k):
        continue
    s = Image.new('RGBA', (c.width // k, c.height // k))
    for y in range(s.height):
        for x in range(s.width):
            s.putpixel((x, y), c.getpixel((x * k + k // 2, y * k + k // 2)))
    s = s.crop(s.getbbox())
    s.save(out, optimize=True)
    print(f'{out}: {s.width}x{s.height} (x{k})')
    break
else:
    sys.exit(f'{src}: not an exact enlargement')
