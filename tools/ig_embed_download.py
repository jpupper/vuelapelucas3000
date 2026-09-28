"""Baja las imagenes de posts PUBLICOS de Instagram usando el endpoint de embed
(no requiere login). Necesita la lista de shortcodes.

Fuentes de shortcodes:
  --html work/ig_profile.html     (los que se ven sin login: los 12 mas nuevos)
  --codes DSX1_aTEfQ5,DSX2uAqkZez (lista explicita)

Uso:
  python tools/ig_embed_download.py --html work/ig_profile.html
"""
import argparse
import html as H
import os
import re
import subprocess
import sys

from curl_cffi import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "work", "ig_embed")


def codes_from_html(path):
    h = open(path, encoding="utf-8", errors="replace").read()
    return sorted(set(re.findall(r'"code":"([A-Za-z0-9_-]{8,})"', h)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html")
    ap.add_argument("--codes")
    ap.add_argument("--process", action="store_true", help="correr ig_download.py al final")
    a = ap.parse_args()

    codes = []
    if a.html:
        codes += codes_from_html(a.html)
    if a.codes:
        codes += [c.strip() for c in a.codes.split(",") if c.strip()]
    codes = [c for c in dict.fromkeys(codes)]
    print("shortcodes:", len(codes))
    if not codes:
        return 1

    os.makedirs(OUT, exist_ok=True)
    ok = 0
    for i, sc in enumerate(codes, 1):
        url = f"https://www.instagram.com/p/{sc}/embed/captioned/"
        try:
            r = requests.get(url, impersonate="chrome", timeout=40,
                             headers={"Accept-Language": "es-AR,es;q=0.9"})
            m = re.search(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', r.text)
            if not m:
                print(f"  {sc}: sin imagen ({r.status_code})")
                continue
            src = H.unescape(m.group(1)).replace("\\u0026", "&")
            img = requests.get(src, impersonate="chrome", timeout=60)
            if img.status_code != 200 or len(img.content) < 4000:
                print(f"  {sc}: imagen fallo ({img.status_code}, {len(img.content)}b)")
                continue
            p = os.path.join(OUT, f"{sc}.jpg")
            open(p, "wb").write(img.content)
            ok += 1
            print(f"  {i}/{len(codes)} {sc} -> {len(img.content)//1024} KB")
        except Exception as e:
            print(f"  {sc}: ERR {str(e)[:70]}")

    print(f"bajadas {ok}/{len(codes)} -> {OUT}")
    if a.process and ok:
        subprocess.run([sys.executable, os.path.join(HERE, "ig_download.py"),
                        "--from-dir", OUT], cwd=ROOT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
