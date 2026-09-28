"""Renombra TODAS las imagenes de assetsraw y las prepara para la web.

Salida:
  public/img/galeria/NNN_AAAA__slug.jpg        (version web, max 1600px, q82)
  public/img/galeria/_thumbs/NNN.jpg           (thumb 520px, q80)
  public/img/galeria/manifest.json             (orden, año, tamaño, origen)
  public/img/galeria/PREVIEW.html              (para revisar)

Uso: python tools/build_gallery.py [--max 1600] [--q 82]
"""
import argparse
import hashlib
import json
import os
import re
import unicodedata

import numpy as np
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, "assetsraw")
OUT = os.path.join(ROOT, "public", "img", "galeria")
THUMBS = os.path.join(OUT, "_thumbs")

PHOTO_EXT = {".jpg", ".jpeg", ".heic", ".png", ".gif", ".webp"}
SKIP_DIRS = {"_hojas_de_contacto", "seleccion_fotos"}


def year_of(path):
    rel = os.path.relpath(path, RAW).replace("\\", "/")
    parts = rel.split("/")
    for p in parts:
        m = re.search(r"(20\d\d)", p)
        if m:
            return m.group(1)
    m = re.search(r"(20\d\d)", os.path.basename(path))
    if m:
        return m.group(1)
    return "0000"


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s or "imagen"


def collect():
    out = []
    for dp, dns, fns in os.walk(RAW):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        if any(part in SKIP_DIRS for part in dp.replace("\\", "/").split("/")):
            continue
        for fn in fns:
            if os.path.splitext(fn)[1].lower() in PHOTO_EXT:
                out.append(os.path.join(dp, fn))
    return sorted(out)


def load(p, maxside):
    im = Image.open(p)
    im = ImageOps.exif_transpose(im)
    if getattr(im, "is_animated", False):
        im.seek(0)
    im = im.convert("RGB")
    w, h = im.size
    sc = min(1.0, maxside / max(w, h))
    if sc < 1.0:
        im = im.resize((max(1, int(w * sc)), max(1, int(h * sc))), Image.LANCZOS)
    return im


def score(im, orig_px):
    g = np.asarray(im.convert("L"), np.float32)
    core = g[1:-1, 1:-1]
    sharp = float((g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:] - 4 * core).var())
    a = np.asarray(im, np.float32)
    rg = a[:, :, 0] - a[:, :, 1]
    yb = 0.5 * (a[:, :, 0] + a[:, :, 1]) - a[:, :, 2]
    col = float(np.sqrt(rg.std() ** 2 + yb.std() ** 2)) / 60.0
    lum = float(g.mean())
    pen = 1.0
    if lum < 45 or lum > 215:
        pen = 0.6
    return (0.6 * min(1.0, np.log1p(sharp) / 9.0) + 0.25 * min(1.0, col) + 0.15 * min(1.0, orig_px / 12e6)) * pen


def ahash(im, hs=8):
    g = np.asarray(im.convert("L").resize((hs, hs), Image.LANCZOS), np.float32)
    return "".join("1" if b else "0" for b in (g > g.mean()).flatten())


def dhash(im, hs=8):
    g = np.asarray(im.convert("L").resize((hs + 1, hs), Image.LANCZOS), np.float32)
    return "".join("1" if g[y][x + 1] > g[y][x] else "0" for y in range(hs) for x in range(hs))


def signature(im):
    """Firma 8x8 normalizada (para comparar por correlacion, robusta a rafagas)."""
    v = np.asarray(im.convert("L").resize((8, 8), Image.LANCZOS), np.float32).ravel()
    v = v - v.mean()
    n = float(np.linalg.norm(v)) or 1.0
    return v / n


def ham(a, b):
    return sum(1 for x, y in zip(a, b) if x != y)


def is_dup(a, b, corr_hard=0.965, corr_soft=0.90, ar_tol=0.06):
    """Near-duplicado por correlacion de la firma 8x8.

    - corr muy alta = misma foto (aunque tenga otro recorte/tamano) -> dup
    - corr alta + mismo encuadre = rafaga de la misma escena       -> dup
    """
    c = float(np.dot(a["sig"], b["sig"]))
    if c >= corr_hard:
        return True, c
    if abs(a["ar"] - b["ar"]) <= ar_tol and c >= corr_soft:
        return True, c
    return False, c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=1600)
    ap.add_argument("--q", type=int, default=82)
    a = ap.parse_args()

    os.makedirs(THUMBS, exist_ok=True)
    for f in os.listdir(OUT):
        if f.lower().endswith((".jpg", ".jpeg")):
            os.remove(os.path.join(OUT, f))
    for f in os.listdir(THUMBS):
        os.remove(os.path.join(THUMBS, f))

    srcs = collect()
    print(f"fuentes: {len(srcs)}")
    items = []
    for i, p in enumerate(srcs, 1):
        try:
            im = load(p, a.max)
            ow, oh = Image.open(p).size
            items.append({"src": p, "im": im, "orig": (ow, oh),
                          "year": year_of(p), "hash": ahash(im), "dhash": dhash(im),
                          "sig": signature(im), "ar": round(ow / oh, 3),
                          "score": score(im, ow * oh),
                          "name": os.path.splitext(os.path.basename(p))[0]})
        except Exception as e:
            print("  ERR", os.path.relpath(p, ROOT), str(e)[:80])
        if i % 25 == 0:
            print(f"  leidas {i}/{len(srcs)}", flush=True)

    # dedupe por parecido real (misma foto con otro recorte, rafagas, IMG_x/IMG_E_x)
    kept, dropped = [], []
    for it in sorted(items, key=lambda x: -x["score"]):
        twin, corr = None, 0.0
        for k in kept:
            d, c = is_dup(k, it)
            if d:
                twin, corr = k, c
                break
        if twin:
            dropped.append((it, twin, corr))
            continue
        kept.append(it)
    print(f"unicas={len(kept)}  duplicadas_descartadas={len(dropped)}")
    for it, twin, c in dropped[:8]:
        print(f"   dup({c:.3f}):", os.path.relpath(it['src'], RAW), "<-", os.path.relpath(twin['src'], RAW))

    kept.sort(key=lambda x: (x["year"], -x["score"]))
    man = []
    for n, it in enumerate(kept, 1):
        fname = f"{n:03d}_{it['year']}__{slug(it['name'])}.jpg"
        it["im"].save(os.path.join(OUT, fname), "JPEG", quality=a.q, optimize=True, progressive=True)
        th = it["im"].copy()
        th.thumbnail((520, 520), Image.LANCZOS)
        th.save(os.path.join(THUMBS, f"{n:03d}.jpg"), "JPEG", quality=80, optimize=True)
        man.append({
            "n": n, "file": fname, "thumb": f"_thumbs/{n:03d}.jpg",
            "w": it["im"].size[0], "h": it["im"].size[1],
            "mp": round(it["orig"][0] * it["orig"][1] / 1e6, 1),
            "year": it["year"],
            "origen": os.path.relpath(it["src"], ROOT).replace("\\", "/"),
            "score": round(it["score"], 3),
        })

    json.dump(man, open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"LISTO {len(man)} fotos -> {OUT}")
    for y in sorted({m['year'] for m in man}):
        print("  ", y, sum(1 for m in man if m["year"] == y))


if __name__ == "__main__":
    main()
