"""Composes the 3:2 listing thumbnail (art/thumbnail.png, 1800x1200) from the game's own art.

    python3 tools/thumbnail.py
"""
from PIL import Image, ImageDraw
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = lambda n: Image.open(f'{R}/src/client/art/{n}.png').convert('RGBA')
C = lambda n: Image.open(f'{R}/src/client/kit/art/{n}.png').convert('RGBA')
P = lambda n: Image.open(f'{R}/art/sprites/{n}.png').convert('RGBA')
W, H = 300, 200
im = Image.new('RGBA', (W, H), '#151c33')
sky = A('sky'); sky = sky.resize((sky.width * 2, sky.height * 2), Image.NEAREST)
im.paste(sky.crop((200, 60, 200 + W, 60 + H)), (0, 0))
put = lambda art, x, y: im.alpha_composite(art, (x, y))
mount = A('mountain'); put(mount, 8, 62); put(mount, 150, 70)
put(A('pagoda'), 196, 14)
put(A('trees'), -22, 52); put(A('trees-r'), 228, 58)
logo = A('logo'); put(logo, (W - logo.width) // 2, 4)
# props drifting in the sky
for n, x, y in [('rocket', 24, 10), ('coin', 258, 14)]:
    put(P(n), x, y)
# the cast, standing behind the three buttons
cast = ['lurker-idle', 'dev-happy', 'troll-idle', 'modbear-idle', 'op-happy', 'automod-idle', 'ape-cool', 'npc-happy']
xs = [-6, 30, 66, 104, 140, 180, 216, 254]
ys = [138, 136, 138, 132, 134, 132, 139, 136]
order = [0, 7, 1, 6, 2, 5, 3, 4]
for i in order:
    put(C(cast[i]), xs[i], ys[i])
d = ImageDraw.Draw(im)
INK = '#0b1020'
for i, (main, shade, light) in enumerate([('#ff4b55', '#a81f2e', '#ffa3a8'), ('#2fd66f', '#128a41', '#9df5bd'), ('#3f8cff', '#1c4fb8', '#a9cbff')]):
    x0 = 4 + i * 98; x1 = x0 + 95
    d.rectangle([x0, 172, x1, 199], fill=INK)
    d.rectangle([x0 + 2, 174, x1 - 2, 197], fill=main)
    d.rectangle([x0 + 2, 174, x1 - 2, 176], fill=light)
    d.rectangle([x0 + 2, 192, x1 - 2, 197], fill=shade)
im = im.convert('RGB')
im.resize((W * 6, H * 6), Image.NEAREST).save(f'{R}/art/thumbnail.png', optimize=True)
print(im.size)
