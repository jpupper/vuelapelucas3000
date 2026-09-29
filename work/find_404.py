
import asyncio
from playwright.async_api import async_playwright

async def main():
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        pg.on("response", lambda r: bad.append(str(r.status)+" "+r.url) if r.status >= 400 else None)
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/", wait_until="load")
        await pg.wait_for_timeout(4500)
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/panchodraw/", wait_until="load")
        await pg.wait_for_timeout(3000)
        print("FALLOS:", bad)
        await b.close()

asyncio.run(main())
