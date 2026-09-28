"""Arma un mosaico numerado de thumbs para elegir fotos con vision."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GAL = os.path.join(ROOT, "public", "img", "galeria")
man = json.load(open(os.path.join(GAL, "manifest.json"), encoding="utf-8"))

start = int(sys.argv[1]) if len(sys.argv) > 1 else 0
count = int(sys.argv[2]) if len(sys.argv) > 2 else 24
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
out = sys.argv[4] if len(sys.argv) > 4 else os.path.join(ROOT, "work", "mosaic.jpg")

sel = man[start:start + count]
tw, th = 260, 260
rows = (len(sel) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (20, 20, 26))
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)
except Exception:
    font = ImageFont.load_default()
for i, m in enumerate(sel):
    im = Image.open(os.path.join(GAL, m["thumb"])).convert("RGB")
    im.thumbnail((tw - 8, th - 8), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x + 4, y + 30))
    d.rectangle([x, y, x + 110, y + 30], fill=(255, 214, 44))
    d.text((x + 6, y + 2), str(m["n"]), fill=(0, 0, 0), font=font)
os.makedirs(os.path.dirname(out), exist_ok=True)
sheet.save(out, "JPEG", quality=88)
print(out, sheet.size, "indices", [m["n"] for m in sel])
