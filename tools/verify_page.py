"""Verifica la pagina localmente con Chromium headless: sin errores de consola,
galeria renderizada, y saca capturas."""
import sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8792/index.html"
OUT = sys.argv[2] if len(sys.argv) > 2 else "work/site"

os.makedirs(OUT, exist_ok=True)
msgs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1440, "height": 1000}, locale="es-AR").new_page()
    pg.on("console", lambda m: msgs.append((m.type, m.text)))
    pg.on("pageerror", lambda e: msgs.append(("pageerror", str(e))))
    failed = []
    pg.on("requestfailed", lambda r: failed.append((r.url, r.failure)))
    pg.on("response", lambda r: failed.append((r.status, r.url)) if r.status >= 400 else None)
    pg.goto(BASE, wait_until="load", timeout=60000)
    pg.wait_for_timeout(6000)
    pg.wait_for_selector(".vl-gallery figure", timeout=15000)
    n = pg.eval_on_selector_all(".vl-gallery figure", "els => els.length")
    filters = pg.eval_on_selector_all(".vl-filter", "els => els.map(e=>e.textContent)")
    imgs_ok = pg.evaluate("""() => Array.from(document.images).filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.currentSrc||i.src)""")
    print("galeria items:", n)
    print("filtros:", filters)
    print("imagenes rotas:", imgs_ok)
    print("consola:")
    for t, m in msgs[:20]:
        print("   ", t, m[:180])
    print("respuestas >=400 / fallos:")
    for x in failed[:20]:
        print("   ", x)
    pg.screenshot(path=f"{OUT}/index_full.png", full_page=True)
    pg.screenshot(path=f"{OUT}/index_top.png")
    # test de filtro
    if filters:
        pg.click(".vl-filter:nth-child(2)")
        pg.wait_for_timeout(800)
        print("tras filtro:", pg.eval_on_selector_all(".vl-gallery figure", "els => els.length"))
    # lightbox
    pg.click(".vl-gallery figure")
    pg.wait_for_timeout(1500)
    print("lightbox abierto:", pg.eval_on_selector(".vl-lightbox", "e=>e.classList.contains('is-open')"))
    pg.screenshot(path=f"{OUT}/lightbox.png")
    b.close()
