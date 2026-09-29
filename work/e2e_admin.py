
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

OUT = r"D:\Programacion\vuelapelucas3000\work"
SITE = "https://fullscreencode.com/vuelapelucas3000/"
API = "https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api"
PASS = "rty456fgh"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1500,"height":1100})
        errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:140]))

        await pg.goto(SITE + "admin.html", wait_until="load")
        await pg.fill("#admin-pass", PASS)
        await pg.click(".login-card button")
        await pg.wait_for_selector("#admin-section", state="visible", timeout=20000)
        await pg.wait_for_timeout(4500)

        print("TABS:", await pg.eval_on_selector_all(".tab", "els=>els.map(e=>e.textContent.trim())"))
        await pg.screenshot(path=os.path.join(OUT, "admin_inscriptos.png"))

        # --- DIBUJOS ---
        await pg.click(".tab[data-tab='dibujos']")
        await pg.wait_for_timeout(1500)
        n = await pg.eval_on_selector_all("#dibujos-grid .media-card", "els=>els.length")
        btns = await pg.eval_on_selector_all("#dibujos-grid .mini-btn", "els=>els.map(e=>e.textContent.trim())")
        print("DIBUJOS en el panel:", n, "| botones:", btns[:4])
        await pg.screenshot(path=os.path.join(OUT, "admin_dibujos.png"))

        # --- GALERIA: cambiar el año de la primera foto y guardar ---
        await pg.click(".tab[data-tab='galeria']")
        await pg.wait_for_timeout(1500)
        cards = await pg.eval_on_selector_all("#galeria-grid .media-card", "els=>els.length")
        stats = await pg.inner_text("#stats-galeria")
        print("GALERIA tarjetas:", cards, "| stats:", " ".join(stats.split()))
        primero = await pg.eval_on_selector("#galeria-grid .media-card .meta", "e=>e.textContent.trim()")
        year_sel = await pg.eval_on_selector("#galeria-grid input.mini-select", "e=>e.value")
        print("primera foto:", primero, "| año actual:", year_sel)
        await pg.fill("#galeria-grid input.mini-select", "2023")
        await pg.dispatch_event("#galeria-grid input.mini-select", "change")
        await pg.click("#btn-save-galeria")
        await pg.wait_for_timeout(4000)
        cur = json.loads(urllib.request.urlopen(API + "/curation/galeria", timeout=60).read())
        print("CURATION years:", json.dumps(cur["years"], ensure_ascii=False)[:160])
        await pg.screenshot(path=os.path.join(OUT, "admin_galeria.png"))

        # revertir el año
        await pg.reload(wait_until="load"); await pg.fill("#admin-pass", PASS)
        await pg.click(".login-card button"); await pg.wait_for_selector("#admin-section", state="visible", timeout=20000)
        await pg.wait_for_timeout(4000)
        await pg.click(".tab[data-tab='galeria']")
        await pg.wait_for_timeout(1200)
        await pg.fill("#galeria-grid input.mini-select", year_sel)
        await pg.dispatch_event("#galeria-grid input.mini-select", "change")
        await pg.click("#btn-save-galeria"); await pg.wait_for_timeout(4000)
        cur = json.loads(urllib.request.urlopen(API + "/curation/galeria", timeout=60).read())
        print("REVERTIDO years:", json.dumps(cur["years"], ensure_ascii=False)[:120])

        # --- FLYERS: quitar el primero, guardar, revertir ---
        await pg.click(".tab[data-tab='flyers']")
        await pg.wait_for_timeout(1800)
        fl = await pg.eval_on_selector_all("#flyers-grid .media-card", "els=>els.length")
        print("FLYERS tarjetas:", fl)
        await pg.click("#flyers-grid .media-card .mini-btn")
        await pg.click("#btn-save-flyers"); await pg.wait_for_timeout(4000)
        cur2 = json.loads(urllib.request.urlopen(API + "/curation/flyers", timeout=60).read())
        print("OCULTOS flyers:", cur2["ocultos"])
        await pg.screenshot(path=os.path.join(OUT, "admin_flyers.png"))
        # revertir
        await pg.reload(wait_until="load"); await pg.fill("#admin-pass", PASS)
        await pg.click(".login-card button"); await pg.wait_for_selector("#admin-section", state="visible", timeout=20000)
        await pg.wait_for_timeout(4000)
        await pg.click(".tab[data-tab='flyers']"); await pg.wait_for_timeout(1500)
        await pg.click("#flyers-grid .media-card .mini-btn")
        await pg.click("#btn-save-flyers"); await pg.wait_for_timeout(4000)
        cur2 = json.loads(urllib.request.urlopen(API + "/curation/flyers", timeout=60).read())
        print("REVERTIDO ocultos:", cur2["ocultos"])

        print("ERRORES:", errs[:6])
        await b.close()

asyncio.run(main())
