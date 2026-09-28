"""Analiza cuan parecidas son las fotos de la galeria y sugiere umbral de dedupe."""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GAL = os.path.join(ROOT, "public", "img", "galeria")
man = json.load(open(os.path.join(GAL, "manifest.json"), encoding="utf-8"))
man = [m for m in man if m["year"] != "0000"]

sig, ar = [], []
for m in man:
    im = Image.open(os.path.join(GAL, m["file"])).convert("L").resize((8, 8), Image.LANCZOS)
    v = np.asarray(im, np.float32).ravel()
    v = v - v.mean()
    n = np.linalg.norm(v) or 1.0
    sig.append(v / n)
    ar.append(m["w"] / m["h"])
S = np.array(sig)
C = S @ S.T

for thr in [0.80, 0.85, 0.88, 0.90, 0.92, 0.94, 0.96]:
    kept = []
    for i in range(len(man)):
        dup = any(j in kept for j in range(len(man))
                  if j != i and abs(ar[i] - ar[j]) <= 0.05 and C[i, j] >= thr)
        if not dup:
            kept.append(i)
    print(f"thr={thr:.2f} -> unicas={len(kept)} (descarta {len(man)-len(kept)})")

print("\npares mas parecidos (top 20):")
pairs = []
for i in range(len(man)):
    for j in range(i + 1, len(man)):
        if abs(ar[i] - ar[j]) <= 0.05:
            pairs.append((C[i, j], man[i]["n"], man[j]["n"]))
pairs.sort(reverse=True)
for c, a, b in pairs[:20]:
    print(f"   {c:.3f}  {a:3d} - {b:3d}")
print("pares con corr>=0.94:", sum(1 for c, _, _ in pairs if c >= 0.94))
