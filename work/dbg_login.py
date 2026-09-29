
import asyncio, json
from playwright.async_api import async_playwright
PASS = "vivaelgrifobar3000+"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":900})
        dialogs = []
        pg.on("dialog", lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.accept())))
        resp = []
        pg.on("response", lambda r: resp.append((r.status, r.url)) if "inscripciones" in r.url else None)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/admin.html", wait_until="load")
        await pg.wait_for_timeout(1200)
        print("togglePass existe:", await pg.evaluate("typeof togglePass"))
        await pg.fill("#admin-pass", PASS)
        await pg.click(".login-btn")
        await pg.wait_for_timeout(4000)
        print("respuestas:", resp)
        print("dialogs:", dialogs)
        print("panel visible:", await pg.is_visible("#admin-section"))
        print("errores:", errs[:4])
        await b.close()
asyncio.run(main())
