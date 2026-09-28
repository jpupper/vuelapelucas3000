"""Chequeo final: recorre la pagina entera, detecta 404s e imagenes rotas reales."""
import re, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8793/index.html"
bad, errs = [], []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1440, "height": 1000}, locale="es-AR").new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.on("response", lambda r: bad.append((r.status, r.url)) if r.status >= 400 else None)
    pg.goto(URL, wait_until="load", timeout=60000)
    pg.wait_for_timeout(2500)
    # scrollear todo para forzar lazy-load
    for i in range(28):
        pg.mouse.wheel(0, 2600)
        pg.wait_for_timeout(350)
    pg.wait_for_timeout(2500)
    broken = pg.evaluate("""() => Array.from(document.images)
        .filter(i => i.getAttribute('src') && (!i.complete || i.naturalWidth === 0))
        .map(i => i.getAttribute('src'))""")
    total = pg.evaluate("() => document.images.length")
    print("imagenes en la pagina:", total)
    print("rotas:", len(broken), broken[:10])
    print("respuestas >=400:", len(bad))
    for s, u in bad[:10]:
        print("   ", s, u)
    print("errores JS:", errs[:3])
    print("galeria:", pg.eval_on_selector_all(".vl-gallery figure", "e=>e.length"))
    print("comunidad:", pg.eval_on_selector_all(".vl-community-grid a", "e=>e.length"))
    b.close()
