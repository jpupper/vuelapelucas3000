
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/", wait_until="load")
        await pg.wait_for_timeout(5500)
        print("dibujos:", await pg.eval_on_selector_all(".vl-draw-grid figure", "e=>e.length"),
              "| descargas:", await pg.eval_on_selector_all(".vl-draw-grid .vl-draw-dl", "e=>e.length"))
        print("flyers:", await pg.inner_text("#count-flyers"),
              "| chips:", await pg.eval_on_selector_all(".vl-filters .vl-filter", "els=>els.map(e=>e.textContent.trim())"))
        print("CTA:", (await pg.inner_text(".vl-cta-pop")).split("\n")[0], "| anim:", await pg.eval_on_selector(".vl-cta-pop","e=>getComputedStyle(e).animationName"))
        print("errores JS:", errs)
        await b.close()
asyncio.run(main())
