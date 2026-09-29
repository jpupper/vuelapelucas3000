
import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":900})
        dialogs = []
        pg.on("dialog", lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.accept())))
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/admin.html", wait_until="load")
        await pg.wait_for_timeout(1200)
        await pg.fill("#admin-pass", "vivaelgrifobar3000+")
        await pg.click(".login-btn")
        await pg.wait_for_selector("#admin-section", state="visible", timeout=20000)
        await pg.wait_for_timeout(3500)
        print("LOGIN:", await pg.is_visible("#admin-section"),
              "| tabs:", await pg.eval_on_selector_all(".tab", "els=>els.map(e=>e.textContent.trim())"))
        print("alertas:", dialogs)
        await pg.screenshot(path=r"D:\Programacion\vuelapelucas3000\work\admin_login_nueva_clave.png")
        await b.close()
asyncio.run(main())
