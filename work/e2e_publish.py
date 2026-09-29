
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

OUT = r"D:\Programacion\vuelapelucas3000\work"
SITE = "https://fullscreencode.com/vuelapelucas3000/"
PANCHO = SITE + "panchodraw/"
API = "https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)[:150]))
        await pg.goto(PANCHO, wait_until="load")
        await pg.wait_for_timeout(3000)

        # --- dibujar en el lienzo (trazo a mano alzada) ---
        box = await pg.eval_on_selector("#paintCanvas", "e => {const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        cx, cy = box["x"] + box["w"]/2, box["y"] + box["h"]/2
        await pg.mouse.move(cx-70, cy-70); await pg.mouse.down()
        for i in range(14):
            await pg.mouse.move(cx-70+i*10, cy-70+(i%4)*20)
        await pg.mouse.up()
        await pg.wait_for_timeout(700)

        # --- publicar ---
        await pg.click("#btnQuickPublish")
        await pg.wait_for_timeout(1200)
        await pg.fill("#pubNombre", "E2E navecita del vuela")
        await pg.fill("#pubAutor", "@jpupper_e2e")
        await pg.click("#btnDoPublish")
        for _ in range(20):
            await pg.wait_for_timeout(700)
            st = await pg.inner_text("#pubStatus")
            if "Publicado" in st or "✕" in st: break
        print("PUBLISH_STATUS:", st)
        await pg.screenshot(path=os.path.join(OUT,"live_publish_ok.png"))

        # --- la API lo tiene ---
        lst = json.loads(urllib.request.urlopen(API + "/artworks", timeout=60).read())
        mine = [a for a in lst["artworks"] if a["nombre"].startswith("E2E ")]
        print("API_COUNT:", lst["count"], "| E2E:", json.dumps(mine[:1], ensure_ascii=False))
        if mine:
            print("IMG:", urllib.request.urlopen("https://vps-4455523-x.dattaweb.com" + mine[0]["img"], timeout=60).status)
            print("E2E_ID=" + mine[0]["id"])

        # --- aparece en la pagina ---
        await pg.goto(SITE, wait_until="load")
        await pg.wait_for_timeout(4000)
        n = await pg.eval_on_selector_all(".vl-draw-grid figure", "els=>els.length")
        cap = await pg.eval_on_selector_all(".vl-draw-grid figcaption", "els=>els.map(e=>e.textContent.trim())")
        cnt = await pg.inner_text("#count-draw")
        print("PAGINA: dibujos=" + str(n), "count=" + cnt, cap)
        await pg.evaluate("document.getElementById('comunidad-panchodraw').scrollIntoView()")
        await pg.wait_for_timeout(1000)
        await pg.screenshot(path=os.path.join(OUT,"live_comunidad_final.png"))
        print("ERRORES:", errs[:5])
        await b.close()

asyncio.run(main())
