"""Abre un mirror de Instagram (sin login) con Chromium headless y extrae
las URLs de media del perfil.

Uso: python tools/ig_mirror_play.py vuelapelucas3000 [salida.json]
"""
import json
import re
import sys

from playwright.sync_api import sync_playwright

MIRRORS = [
    "https://dumpor.io/v/{u}",
    "https://greatfon.com/v/{u}",
    "https://www.picnob.com/profile/{u}/",
    "https://gramsnap.com/profile/{u}/",
    "https://smihub.com/v/{u}",
]


def try_mirror(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(5000)
    # scroll para lazy-load
    for _ in range(8):
        page.mouse.wheel(0, 4000)
        page.wait_for_timeout(1200)
    html = page.content()
    media = set(re.findall(r"https://[a-z0-9.\-]*(?:cdninstagram|fbcdn)[^\"'\\\\)<> ]+", html))
    posts = set(re.findall(r"/(?:p|reel|tv)/([A-Za-z0-9_-]{5,})", html))
    imgs = set(re.findall(r"<img[^>]+src=\"(https?://[^\"]+)\"", html))
    return html, media, posts, imgs


if __name__ == "__main__":
    user = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "work/ig_mirror.json"
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = b.new_context(
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"),
            viewport={"width": 1400, "height": 1000}, locale="es-AR")
        page = ctx.new_page()
        best = None
        for m in MIRRORS:
            url = m.format(u=user)
            try:
                html, media, posts, imgs = try_mirror(page, url)
            except Exception as e:
                print(f"{url} ERR {type(e).__name__}: {str(e)[:80]}")
                continue
            print(f"{url} len={len(html)} media={len(media)} posts={len(posts)} imgs={len(imgs)}")
            if media or posts:
                best = {"mirror": url, "media": sorted(media), "posts": sorted(posts),
                        "imgs": sorted(imgs)}
                open(f"work/mirror_{user}.html", "w", encoding="utf-8").write(html)
                break
        if best:
            json.dump(best, open(out, "w", encoding="utf-8"), indent=1)
            print("OK ->", out, "media:", len(best["media"]))
            for u in best["imgs"][:10]:
                print("  img", u[:120])
        else:
            print("NADA")
        b.close()
