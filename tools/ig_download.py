"""Baja TODAS las imagenes del Instagram del festival y las deja listas para la web.

Uso normal (con cookies del navegador):
    python tools/ig_download.py --cookies work/cookies_ig.txt
    python tools/ig_download.py --user vuelapelucas3000 --cookies work/cookies_ig.txt

Uso con un lote ya bajado a mano (carpeta con jpg/png/webp):
    python tools/ig_download.py --from-dir C:/ruta/a/las/imagenes

Resultado:
    public/img/flyers/NNN.jpg          version web (max 1400px, q84)
    public/img/flyers/_thumbs/NNN.jpg  thumb 460px
    public/img/flyers/manifest.json    lo consume la seccion COMMUNITY CREATION
    public/img/flyers/_big/NNN.jpg     version grande para el lightbox/zoom
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

import numpy as np
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RAW = os.path.join(ROOT, "work", "ig_raw")
OUT = os.path.join(ROOT, "public", "img", "flyers")
THUMBS = os.path.join(OUT, "_thumbs")
BIG = os.path.join(OUT, "_big")
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".gif"}


def run_gallery_dl(user, cookies, limit):
    gdl = os.path.join(ROOT, ".venv-media", "Scripts", "gallery-dl.exe")
    if not os.path.exists(gdl):
        gdl = "gallery-dl"
    url = f"https://www.instagram.com/{user}/"
    cmd = [gdl, "-D", RAW,
           "--filename", "{num:04}_{filename}.{extension}",
           "--filter", "extension not in ('mp4','webm')",
           "--sleep-request", "1.2", "--retries", "4", "--timeout", "30"]
    if cookies:
        cmd += ["--cookies", cookies]
    if limit:
        cmd += ["--range", f"1-{limit}"]
    cmd += [url]
    print("$", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=ROOT)
    return r.returncode


def ahash(im, hs=8):
    g = np.asarray(im.convert("L").resize((hs, hs), Image.LANCZOS), np.float32)
    return "".join("1" if b else "0" for b in (g > g.mean()).flatten())


def collect(src):
    out = []
    for dp, _, fns in os.walk(src):
        for fn in fns:
            if os.path.splitext(fn)[1].lower() in EXTS:
                out.append(os.path.join(dp, fn))
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="vuelapelucas3000")
    ap.add_argument("--cookies")
    ap.add_argument("--from-dir")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--min-side", type=int, default=300, help="descartar mas chicas que esto")
    a = ap.parse_args()

    if a.from_dir:
        RAW_DIR = os.path.abspath(a.from_dir)
    else:
        RAW_DIR = RAW
        os.makedirs(RAW_DIR, exist_ok=True)
        rc = run_gallery_dl(a.user, a.cookies, a.limit or None)
        if rc != 0:
            print("gallery-dl salio con", rc)

    files = collect(RAW_DIR)
    print("archivos bajados:", len(files))
    if not files:
        print("NADA para procesar")
        return 1

    for d in (THUMBS, BIG):
        os.makedirs(d, exist_ok=True)
    for d in (OUT, THUMBS, BIG):
        for f in os.listdir(d):
            p = os.path.join(d, f)
            if os.path.isfile(p) and f.lower().endswith((".jpg", ".jpeg", ".png")):
                os.remove(p)

    items = []
    for p in files:
        try:
            it = Image.open(p)
            it = ImageOps.exif_transpose(it)
            if getattr(it, "is_animated", False):
                it.seek(0)
            it = it.convert("RGB")
            if min(it.size) < a.min_side:
                continue
            items.append({"src": p, "im": it, "hash": ahash(it),
                          "score": it.size[0] * it.size[1]})
        except Exception as e:
            print("  skip", os.path.basename(p), str(e)[:60])

    seen, kept = set(), []
    for it in sorted(items, key=lambda x: -x["score"]):
        if it["hash"] in seen:
            continue
        seen.add(it["hash"])
        kept.append(it)

    man = []
    for n, it in enumerate(kept, 1):
        im = it["im"]
        web = im.copy()
        web.thumbnail((1400, 1400), Image.LANCZOS)
        web.save(os.path.join(OUT, f"{n:03d}.jpg"), "JPEG", quality=84, optimize=True)
        big = im.copy()
        big.thumbnail((2000, 2000), Image.LANCZOS)
        big.save(os.path.join(BIG, f"{n:03d}.jpg"), "JPEG", quality=88, optimize=True)
        th = im.copy()
        th.thumbnail((460, 460), Image.LANCZOS)
        th.save(os.path.join(THUMBS, f"{n:03d}.jpg"), "JPEG", quality=80, optimize=True)
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", os.path.basename(it["src"]))
        man.append({
            "n": n, "file": f"{n:03d}.jpg",
            "thumb": f"img/flyers/_thumbs/{n:03d}.jpg",
            "big": f"img/flyers/_big/{n:03d}.jpg",
            "w": im.size[0], "h": im.size[1],
            "fecha": f"{'-'.join(m.groups())}" if m else "",
            "autor": a.user,
            "origen": os.path.basename(it["src"]),
        })

    json.dump(man, open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"LISTO {len(man)} imagenes -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
