"""Cosecha shortcodes de posts de Instagram de un perfil usando buscadores
web (DuckDuckGo html/lite + Bing), y los guarda para bajarlos con ig_posts.py.

Uso: python tools/ig_harvest_codes.py --user vuelapelucas3000 --out work/harvest.txt
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse

from curl_cffi import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UA = {"Accept-Language": "es-AR,es;q=0.9", "Accept": "text/html,application/xhtml+xml"}

QUERIES = [
    'site:instagram.com/p "{u}"',
    'site:instagram.com/p {u}',
    'site:instagram.com/reel "{u}"',
    'site:instagram.com "{u}"',
    'instagram.com/p {u}',
    'instagram.com/p vuelapelucas',
    'instagram.com/p vuelapelucas3000 victorica',
    '{u} instagram post',
    '{u} encuentro artistico',
    '{u} victorica la pampa',
    '#vuelapelucas3000',
    '#vuelapelucas',
    'vuelapelucas3000 afiche',
    'vuelapelucas3000 flyer',
    'vuelapelucas3000 grilla artistas',
    'vuelapelucas 3000 diciembre',
    'vuelapelucas3000 video instagram',
    'vuelapelucas3000 reel',
]


def fetch(url, data=None):
    try:
        if data:
            r = requests.post(url, data=data, impersonate="chrome", timeout=40, headers=UA)
        else:
            r = requests.get(url, impersonate="chrome", timeout=40, headers=UA)
        return r.text
    except Exception as e:
        print("    ERR", str(e)[:70])
        return ""


def codes_in(h):
    return set(re.findall(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]{8,})", h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="vuelapelucas3000")
    ap.add_argument("--out", default=os.path.join(ROOT, "work", "harvest_codes.txt"))
    ap.add_argument("--max-queries", type=int, default=len(QUERIES))
    a = ap.parse_args()

    found = set()
    log = {}
    for i, q in enumerate(QUERIES[:a.max_queries], 1):
        qq = q.format(u=a.user)
        got = set()
        # DDG html (+ paginado)
        for s in (0, 30, 60):
            data = {"q": qq, "b": "", "s": str(s), "dc": str(s + 1), "o": "json", "api": "", "v": "l"}
            h = fetch("https://html.duckduckgo.com/html/", data)
            got |= codes_in(h)
            time.sleep(2.5)
        # DDG lite
        h = fetch("https://lite.duckduckgo.com/lite/?q=" + urllib.parse.quote(qq))
        got |= codes_in(h)
        # Bing
        h = fetch("https://www.bing.com/search?q=" + urllib.parse.quote(qq) + "&count=50")
        got |= codes_in(h)
        time.sleep(2.0)
        new = got - found
        found |= got
        log[qq] = sorted(got)
        print(f"  {i}/{len(QUERIES)}  +{len(new):3d}  total={len(found):3d}   {qq[:60]}")
        time.sleep(1.5)

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        for c in sorted(found):
            f.write(c + "\n")
    json.dump(log, open(os.path.join(ROOT, "work", "harvest_log.json"), "w",
                        encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"TOTAL shortcodes unicos: {len(found)} -> {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
