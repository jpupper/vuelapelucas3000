"""Baja los posts de Instagram que le pasamos por URL (publicos, sin login)
usando el endpoint de embed. Soporta carruseles parcialmente.

Uso:
  python tools/ig_posts.py --urls-file work/flyer_urls.txt --out work/ig_embed
  python tools/ig_posts.py "https://www.instagram.com/p/AAA/,https://www.instagram.com/p/BBB/"
"""
import argparse
import html as H
import json
import os
import re
import subprocess
import sys
import time

from curl_cffi import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UA = {"Accept-Language": "es-AR,es;q=0.9"}


def shortcodes(text):
    return re.findall(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]{5,})", text)


def clean_html(h):
    """Des-escapa el HTML del embed (viene con JSON doblemente escapado)."""
    return (h.replace("\\\\/", "/")
             .replace("\\/", "/")
             .replace('\\"', '"')
             .replace("\\u0026", "&")
             .replace("\\u003D", "=")
             .replace("\\u003d", "="))


def embed_images(code):
    """Todas las imagenes del post (carrusel incluido) via endpoint embed publico."""
    url = f"https://www.instagram.com/p/{code}/embed/captioned/"
    r = requests.get(url, impersonate="chrome", timeout=40, headers=UA)
    h = clean_html(r.text)

    urls = list(re.findall(r'"display_url":"([^"]+)"', h))
    urls += list(re.findall(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', h))

    seen, out = set(), []
    for u in urls:
        u = H.unescape(u)
        if not u or u in seen:
            continue
        if "cdninstagram" not in u and "fbcdn" not in u:
            continue
        seen.add(u)
        out.append(u)
    return out, r.status_code


def download(url, path):
    try:
        r = requests.get(url, impersonate="chrome", timeout=90)
    except Exception:
        return 0
    if r.status_code != 200 or len(r.content) < 4000:
        return 0
    tmp = path + ".part"
    open(tmp, "wb").write(r.content)
    try:
        from PIL import Image
        im = Image.open(tmp)
        im.verify()
        if min(Image.open(tmp).size) < 320:
            os.remove(tmp)
            return 0
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        return 0
    os.replace(tmp, path)
    return len(r.content)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--urls-file")
    ap.add_argument("--out", default=os.path.join(ROOT, "work", "ig_embed"))
    ap.add_argument("--process", action="store_true")
    a = ap.parse_args()

    text = " ".join(a.urls)
    if a.urls_file:
        text += " " + open(a.urls_file, encoding="utf-8").read()
    codes = list(dict.fromkeys(shortcodes(text)))
    print(f"posts a bajar: {len(codes)}")
    os.makedirs(a.out, exist_ok=True)

    total = 0
    for i, code in enumerate(codes, 1):
        try:
            imgs, status = embed_images(code)
        except Exception as e:
            print(f"  {code}: ERR {str(e)[:70]}")
            continue
        if not imgs:
            print(f"  {code}: sin imagenes (HTTP {status})")
            continue
        got = 0
        for k, u in enumerate(imgs[:10]):
            p = os.path.join(a.out, f"{code}.jpg" if k == 0 else f"{code}_{k}.jpg")
            n = download(u, p)
            if n:
                got += 1
        total += got
        print(f"  {i}/{len(codes)} {code}: {got} imagen(es)")
        time.sleep(0.4)

    print(f"TOTAL imagenes bajadas: {total} -> {a.out}")
    if a.process:
        subprocess.run([sys.executable, os.path.join(HERE, "ig_download.py"),
                        "--from-dir", a.out], cwd=ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
