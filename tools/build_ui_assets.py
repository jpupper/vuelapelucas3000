"""Genera los iconos/imagenes que reemplazan a los emojis + capturas de los juegos."""
import os
import shutil
import subprocess
import sys
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(ROOT, "public", "img")
GAL = os.path.join(PUB, "galeria")
OUT = os.path.join(PUB, "juegos")
os.makedirs(OUT, exist_ok=True)


def square(src, dst, size=140):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    im = im.resize((size, size), Image.LANCZOS)
    im.save(dst, "JPEG", quality=88, optimize=True)
    print("ico ->", dst)


def wide(src, dst, w=520):
    im = Image.open(src).convert("RGB")
    ow, oh = im.size
    im = im.resize((w, max(1, int(oh * w / ow))), Image.LANCZOS)
    if im.size[1] > int(w * 0.72):
        im = im.crop((0, 0, w, int(w * 0.72)))
    im.save(dst, "JPEG", quality=86, optimize=True)
    print("wide ->", dst)


def shot(url, dst, wait_ms=9000):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        pg = b.new_context(viewport={"width": 1200, "height": 750},
                           locale="es-AR").new_page()
        pg.goto(url, wait_until="load", timeout=60000)
        pg.wait_for_timeout(wait_ms)
        pg.screenshot(path=dst)
        b.close()
    im = Image.open(dst).convert("RGB")
    im.save(dst, "JPEG", quality=86, optimize=True)
    print("shot ->", dst, im.size)


if __name__ == "__main__":
    # iconos (reemplazan emojis)
    square(os.path.join(PUB, "afiche-vuelapelucas3000.jpg"), os.path.join(PUB, "ico-fecha.jpg"))
    square(os.path.join(GAL, "_thumbs", "051.jpg"), os.path.join(PUB, "ico-lugar.jpg"))
    square(os.path.join(PUB, "nave-vuelapelu.png"), os.path.join(PUB, "ico-nave.jpg"))
    square(os.path.join(GAL, "_thumbs", "041.jpg"), os.path.join(PUB, "ico-musica.jpg"))
    square(os.path.join(GAL, "_thumbs", "006.jpg"), os.path.join(PUB, "ico-arte.jpg"))
    square(os.path.join(GAL, "_thumbs", "030.jpg"), os.path.join(PUB, "ico-camping.jpg"))
    square(os.path.join(GAL, "_thumbs", "052.jpg"), os.path.join(PUB, "ico-comunidad.jpg"))
    square(os.path.join(GAL, "_thumbs", "025.jpg"), os.path.join(PUB, "ico-alojamiento.jpg"))
    square(os.path.join(GAL, "_thumbs", "049.jpg"), os.path.join(PUB, "ico-feria.jpg"))
    square(os.path.join(GAL, "_thumbs", "056.jpg"), os.path.join(PUB, "ico-juego.jpg"))

    # fotos de cards (4:3)
    for n, out in [("049", "card-comunidad.jpg"), ("041", "card-musica.jpg"),
                   ("006", "card-arte.jpg"), ("030", "card-camping.jpg")]:
        wide(os.path.join(GAL, "_thumbs", n + ".jpg"), os.path.join(PUB, out))

    # capturas de los juegos
    for url, name in [("https://fullscreencode.com/jpupper/nftsapps/pamparticles/", "pamparticles.jpg"),
                      ("https://fullscreencode.com/jpupper/nftsapps/pamilo/", "pamilo.jpg")]:
        try:
            shot(url, os.path.join(OUT, name))
        except Exception as e:
            print("shot ERR", name, str(e)[:100])
