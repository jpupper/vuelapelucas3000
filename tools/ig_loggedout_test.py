import os, re, sys
from playwright.sync_api import sync_playwright

URL = "https://www.instagram.com/vuelapelucas3000/"
PROF = os.path.abspath("work/pw-ig")
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        PROF, channel="chrome", headless=True, locale="es-AR",
        viewport={"width": 1400, "height": 1000},
        user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"))
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(7000)
    for _ in range(6):
        pg.mouse.wheel(0, 3000)
        pg.wait_for_timeout(1500)
    html = pg.content()
    txt = pg.inner_text("body")
    print("URL final:", pg.url)
    print("login wall?:", ("Iniciar sesión" in txt or "Log in" in txt or "loginForm" in html))
    print("texto (600):", re.sub(r"\s+", " ", txt)[:600])
    posts = sorted(set(re.findall(r"/(?:p|reel|tv)/([A-Za-z0-9_-]{8,})", html)))
    imgs = re.findall(r'<img[^>]+src="(https://[^"]+)"', html)
    print("posts:", len(posts), posts[:8])
    print("imgs:", len(imgs))
    for u in imgs[:6]:
        print("   ", u[:130])
    print("meta description:", re.findall(r'<meta property="og:description" content="([^"]{0,200})', html))
    print("meta title:", re.findall(r'<meta property="og:title" content="([^"]{0,120})', html))
    ctx.close()
