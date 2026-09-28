import os
from playwright.sync_api import sync_playwright
OUT = "work/site"
os.makedirs(OUT, exist_ok=True)
PAGES = [("hospedajes.html", "hospedajes"), ("anotate.html", "anotate")]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for path, name in PAGES:
        pg = b.new_context(viewport={"width": 1440, "height": 1000}).new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        bad = []
        pg.on("response", lambda r: bad.append((r.status, r.url)) if r.status >= 400 else None)
        pg.goto("http://127.0.0.1:8792/" + path, wait_until="load")
        pg.wait_for_timeout(3500)
        pg.screenshot(path=f"{OUT}/page_{name}.png", full_page=True)
        print(name, "errores:", errs[:3], "404:", bad[:5])
        b_ = pg.eval_on_selector_all("img", "els=>els.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src'))")
        print("   imgs rotas:", b_[:5])
