
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width":1440,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/", wait_until="load")
        await pg.wait_for_timeout(4000)
        txt = await pg.eval_on_selector_all(".vl-draw-grid .vl-empty", "els=>els.map(e=>e.textContent.trim())")
        n = await pg.eval_on_selector_all(".vl-draw-grid figure", "els=>els.length")
        print("VACIO:", txt, "| figuras:", n, "| errores:", errs[:3])
        await b.close()
asyncio.run(main())
