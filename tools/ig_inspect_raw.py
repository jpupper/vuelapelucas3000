import os, sys
from PIL import Image
import numpy as np

d = sys.argv[1] if len(sys.argv) > 1 else "work/ig_embed"
rows = []
for f in sorted(os.listdir(d)):
    p = os.path.join(d, f)
    try:
        im = Image.open(p).convert("RGB")
    except Exception as e:
        print(f"  IGNORAR {f}: {str(e)[:50]}")
        os.remove(p) if os.path.basename(p).endswith(('.jpg', '.jpeg', '.png')) else None
        continue
    g = np.asarray(im.convert("L").resize((8, 8)), np.float32)
    g = g - g.mean()
    n = np.linalg.norm(g) or 1
    rows.append((f, im.size, os.path.getsize(p) // 1024, (g / n).ravel()))

print(f"validas: {len(rows)}")
# grupos por post
from collections import defaultdict
grp = defaultdict(list)
for f, s, k, sig in rows:
    grp[f.split("_")[0] if "_" in f else f.split(".")[0]].append((f, s, k, sig))
for code, items in grp.items():
    print(f"\n{code}: {len(items)}")
    for f, s, k, sig in items:
        print(f"   {f:24s} {s} {k}KB")
