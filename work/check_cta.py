
import asyncio, os
from playwright.async_api import async_playwright
OUT = r"D:\Programacion\vuelapelucas3000\work"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":900})
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/", wait_until="load")
        await pg.wait_for_timeout(3500)
        anim = await pg.eval_on_selector(".vl-cta-pop", "e => getComputedStyle(e).animationName + ' / ' + getComputedStyle(e).animationDuration")
        arr = await pg.eval_on_selector(".vl-cta-arrow", "e => getComputedStyle(e).animationName")
        shine = await pg.eval_on_selector(".vl-cta-pop", "e => getComputedStyle(e, '::before').animationName")
        txt = await pg.inner_text(".vl-sub-note")
        print("ANIM:", anim, "| ARROW:", arr, "| SHINE:", shine)
        print("NOTE:", txt)
        await pg.evaluate("document.getElementById('comunidad-panchodraw').scrollIntoView()")
        await pg.wait_for_timeout(600)
        # capturar el boton en 3 momentos del ciclo
        for i, ms in enumerate([0, 300, 620]):
            await pg.wait_for_timeout(ms)
            await pg.screenshot(path=os.path.join(OUT,"cta_%d.png" % i), clip={"x":560,"y":120,"width":480,"height":220})
        await pg.screenshot(path=os.path.join(OUT,"live_cta_anim.png"))
        print("OK")
        await b.close()
asyncio.run(main())
