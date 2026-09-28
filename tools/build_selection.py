#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_selection.py — arma los manifests + miniaturas de la GALERIA y de FLYERS.

Ahora las dos carpetas son PLANAS y curadas a mano por el usuario:

    public/img/galeria/*.jpg   -> fotos del encuentro
    public/img/flyers/*.jpg    -> flyers / community creation

Este script NO mueve ni borra fotos. Solo:
  1. ignora los archivos que no son fotos (card-*, ico-*, logo-* ...)
  2. genera miniaturas   public/img/<carpeta>/_thumbs/<mismo-nombre>
  3. escribe el manifest public/img/<carpeta>/manifest.json

El anio de cada foto se resuelve asi, en orden:
  a) "_2022__" en el nombre del archivo
  b) el manifest viejo (public/img/galeria/seleccion/manifest.json) por nombre
  c) EXIF DateTimeOriginal
  d) "" -> la pagina lo muestra como SIN FECHA

Uso:  .venv-media/Scripts/python.exe tools/build_selection.py
"""
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
IMG = PUB / "img"

GAL_DIR = IMG / "galeria"
FLY_DIR = IMG / "flyers"
GAL_THUMB_DIR = GAL_DIR / "_thumbs"
FLY_THUMB_DIR = FLY_DIR / "_thumbs"

# manifest legacy: mapea nombre-de-archivo -> {n, year, mp, origen}
LEGACY_MAP = GAL_DIR / "seleccion" / "manifest.json"

NO_FOTO = re.compile(r"^(card|ico|icono|logo|favicon|banner|afiche)[-_.]", re.I)
YEAR_IN_NAME = re.compile(r"_(\d{4})__")
EXTS = (".jpg", ".jpeg", ".png", ".webp")

GAL_THUMB_PX = 520
FLY_THUMB_PX = 460


def load_legacy():
    """nombre de archivo -> {year, mp, origen}"""
    if not LEGACY_MAP.is_file():
        return {}, {}
    try:
        raw = json.loads(LEGACY_MAP.read_text(encoding="utf-8"))
    except Exception:
        return {}, {}
    by_name = {}
    for e in raw:
        name = os.path.basename(e.get("file", ""))
        if name:
            by_name[name] = e
    return by_name, raw


def exif_year(p):
    try:
        ex = Image.open(p).getexif()
        for tag in (36867, 36868, 306):          # DateTimeOriginal, DateTimeDigitized, DateTime
            v = ex.get(tag)
            if v:
                m = re.match(r"(\d{4})", str(v))
                if m and m.group(1) not in ("0000",):
                    return m.group(1)
    except Exception:
        pass
    return ""


def make_thumb(src: Path, dst: Path, maxside: int, quality=80):
    if dst.is_file() and dst.stat().st_mtime >= src.stat().st_mtime:
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "P", "LA"):
            im = im.convert("RGB")
        im.thumbnail((maxside, maxside), Image.LANCZOS)
        tmp = dst.with_suffix(dst.suffix + ".tmp")
        im.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
    os.replace(tmp, dst)
    return True


def prune_thumbs(thumb_dir: Path, keep_names):
    """Borra miniaturas huerfanas (de fotos que ya no estan)."""
    if not thumb_dir.is_dir():
        return 0
    keep = set(keep_names)
    n = 0
    for f in thumb_dir.iterdir():
        if f.is_file() and f.name not in keep:
            try:
                f.unlink()
                n += 1
            except OSError:
                pass
    return n


def fotos(d: Path):
    return sorted(
        f for f in d.iterdir()
        if f.is_file() and f.suffix.lower() in EXTS and not NO_FOTO.match(f.name)
    )


# --------------------------------------------------------------------- galeria
def build_galeria():
    if not GAL_DIR.is_dir():
        print("! no existe", GAL_DIR)
        return 0
    legacy, _ = load_legacy()
    fs = fotos(GAL_DIR)
    items, made, noyear = [], 0, []
    for f in fs:
        year = ""
        m = YEAR_IN_NAME.search(f.name)
        if m:
            year = m.group(1)
        lg = legacy.get(f.name, {})
        if not year and lg.get("year") and lg["year"] != "0000":
            year = lg["year"]
        if not year:
            year = exif_year(f)
        if not year:
            noyear.append(f.name)
        made += make_thumb(f, GAL_THUMB_DIR / f.name, GAL_THUMB_PX)
        try:
            with Image.open(f) as im:
                w, h = im.size
        except Exception:
            w = h = 0
        items.append({
            "n": lg.get("n", 0) or 0,
            "file": "img/galeria/" + f.name,
            "thumb": "img/galeria/_thumbs/" + f.name,
            "year": year,
            "mp": round((w * h) / 1e6, 1),
            "origen": lg.get("origen", ""),
        })

    # orden: anio mas nuevo primero, SIN FECHA al final, y dentro del anio el
    # orden original (numero del manifest viejo / orden alfabetico).
    def _key(i):
        y = i["year"]
        return (1 if not y else 0, -int(y) if y.isdigit() else 0, i["n"])
    items.sort(key=_key)
    items = [dict(i, n=idx + 1) for idx, i in enumerate(items)]

    out = GAL_DIR / "manifest.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    huerfanas = prune_thumbs(GAL_THUMB_DIR, [f.name for f in fs])
    years = {}
    for i in items:
        years[i["year"] or "S/F"] = years.get(i["year"] or "S/F", 0) + 1
    print("GALERIA  -> %d fotos | thumbs nuevas: %d | huerfanas borradas: %d | %s"
          % (len(items), made, huerfanas, years))
    if noyear:
        print("   SIN ANIO: %s" % ", ".join(noyear))
    return len(items)


# ---------------------------------------------------------------------- flyers
def build_flyers():
    if not FLY_DIR.is_dir():
        print("! no existe", FLY_DIR)
        return 0
    fs = fotos(FLY_DIR)
    items, made = [], 0
    for idx, f in enumerate(fs):
        made += make_thumb(f, FLY_THUMB_DIR / f.name, FLY_THUMB_PX)
        try:
            with Image.open(f) as im:
                w, h = im.size
        except Exception:
            w = h = 0
        items.append({
            "n": idx + 1,
            "file": "img/flyers/" + f.name,
            "thumb": "img/flyers/_thumbs/" + f.name,
            "big": "img/flyers/" + f.name,
            "w": w,
            "h": h,
            "autor": "vuelapelucas3000",
            "origen": f.name,
        })
    out = FLY_DIR / "manifest.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    huerfanas = prune_thumbs(FLY_THUMB_DIR, [f.name for f in fs])
    print("FLYERS   -> %d flyers | thumbs nuevas: %d | huerfanas borradas: %d"
          % (len(items), made, huerfanas))
    return len(items)


if __name__ == "__main__":
    g = build_galeria()
    f = build_flyers()
    print("\nTOTAL: galeria %d | flyers %d" % (g, f))
    sys.exit(0 if (g or f) else 1)
