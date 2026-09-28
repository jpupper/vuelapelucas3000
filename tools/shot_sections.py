import os, sys
from playwright.sync_api import sync_playwright

OUT = "work/site"
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8793/index.html"
os.makedirs(OUT, exist_ok=True)
IDS = ["inicio", "festival", "galeria", "comunidad", "juegos", "hospedajes", "inscripcion"]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1440, "height": 1000}).new_page()
    pg.goto(BASE, wait_until="load")
    pg.wait_for_timeout(3500)
    for i in IDS:
        el = pg.query_selector("#" + i)
        if not el:
            print("falta #" + i); continue
        el.scroll_into_view_if_needed()
        pg.wait_for_timeout(1400)
        el.screenshot(path=f"{OUT}/sec_{i}.png")
        print("ok", i)
    b.close()
