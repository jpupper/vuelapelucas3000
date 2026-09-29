
import asyncio, os, json
from playwright.async_api import async_playwright

OUT = r"D:\Programacion\vuelapelucas3000\work"
SITE = "https://fullscreencode.com/vuelapelucas3000/"
PANCHO = SITE + "panchodraw/"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        errs = []
        pg.on("console", lambda m: errs.append(m.type+": "+m.text[:180]) if m.type=="error" else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: "+str(e)[:180]))

        await pg.goto(SITE, wait_until="load")
        await pg.wait_for_timeout(4000)

        cta = await pg.inner_text(".vl-draw-cta")
        subs = await pg.eval_on_selector_all("#comunidad .vl-sub-title", "els => els.map(e => e.textContent.trim())")
        draw_n = await pg.eval_on_selector_all(".vl-draw-grid figure", "els => els.length")
        flyers_n = await pg.eval_on_selector_all(".vl-community-grid a", "els => els.length")
        games_sub = await pg.eval_on_selector_all("#comunidad-juegos .vl-game h3", "els => els.map(e=>e.textContent.trim())")
        games_main = await pg.eval_on_selector_all("#juegos .vl-game h3", "els => els.map(e=>e.textContent.trim())")
        cnt_draw = await pg.inner_text("#count-draw")
        cnt_fly = await pg.inner_text("#count-flyers")
        print("CTA:", " | ".join(cta.split("\n")))
        print("SUBSECCIONES:", subs)
        print("JUEGOS dentro de comunidad:", games_sub)
        print("JUEGOS seccion propia:", games_main)
        print("CONTADORES: draw=" + cnt_draw + " flyers=" + cnt_fly)
        print("GRILLAS: dibujos=" + str(draw_n) + " flyers=" + str(flyers_n))

        # abrir la subseccion comunidad y capturar
        await pg.evaluate("document.getElementById('comunidad').scrollIntoView()")
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path=os.path.join(OUT,"live_comunidad.png"))

        # click en el primer dibujo -> lightbox
        if draw_n:
            await pg.click(".vl-draw-grid figure")
            await pg.wait_for_timeout(900)
            lb = await pg.eval_on_selector(".vl-lightbox", "e => e.className")
            cap = await pg.inner_text(".vl-lb-cap")
            img = await pg.eval_on_selector(".vl-lightbox img", "e => e.naturalWidth + 'x' + e.naturalHeight")
            print("LIGHTBOX:", lb, "| caption:", cap, "| img:", img)
            await pg.screenshot(path=os.path.join(OUT,"live_lightbox.png"))
            await pg.keyboard.press("Escape")

        # --- PANCHODRAW en vivo ---
        await pg.goto(PANCHO, wait_until="load")
        await pg.wait_for_timeout(3500)
        await pg.click("#btnQuickPublish")
        await pg.wait_for_timeout(2500)
        print("FSC_STATUS_LIVE:", await pg.inner_text("#pubFscStatus"))
        print("BADGE_FSC:", await pg.eval_on_selector_all("#fscBadge img", "els=>els.length"))
        await pg.screenshot(path=os.path.join(OUT,"live_pancho_publish.png"))

        print("ERRORES:", errs[:10])
        await b.close()

asyncio.run(main())
