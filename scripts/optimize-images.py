# usage: python3 -I optimize-images.py <uploads-dir> <out-dir>
import sys, os
from PIL import Image, ImageOps
src, out = sys.argv[1], sys.argv[2]
MAP = {
 'merc-before':'14eea162','merc-after':'b028957a',
 'front-before':'7f5059d1','front-after':'905dee3b',
 'rear-before':'04be9427','rear-after':'d8981988',
 'chevy-before':'a71d3187','chevy-after':'cfcf3708',
 'award-plaque':'2655ffa8',
}
for name, pre in MAP.items():
    im = ImageOps.exif_transpose(Image.open(os.path.join(src, pre + '-image.jpg'))).convert('RGB')
    for w in (480, 800, 1200):
        if im.width < w and w != 480: continue
        t = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if im.width > w else im
        t.save(os.path.join(out, f'{name}-{w}.webp'), 'WEBP', quality=80, method=6)
    print(name, im.size)
