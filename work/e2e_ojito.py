
import asyncio, os
from playwright.async_api import async_playwright
OUT = r"D:\Programacion\vuelapelucas3000\work"
PASS = "rty456fgh"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":900})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:140]))
        pg.on("console", lambda m: errs.append("console: " + m.text[:120]) if m.type == "error" else None)
        await pg.goto("https://fullscreencode.com/vuelapelucas3000/admin.html", wait_until="load")
        await pg.wait_for_timeout(1500)

        await pg.fill("#admin-pass", "MiClaveSecreta123")
        t1 = await pg.get_attribute("#admin-pass", "type")
        ic1 = (await pg.inner_text("#btn-pass-eye")).strip()
        await pg.screenshot(path=os.path.join(OUT, "admin_ojito_oculto.png"))
        await pg.click("#btn-pass-eye"); await pg.wait_for_timeout(400)
        t2 = await pg.get_attribute("#admin-pass", "type")
        ic2 = (await pg.inner_text("#btn-pass-eye")).strip()
        val = await pg.input_value("#admin-pass")
        print("oculto:", t1, ic1, "| al apretar:", t2, ic2, "| se lee:", val)
        await pg.screenshot(path=os.path.join(OUT, "admin_ojito_visible.png"))
        await pg.click("#btn-pass-eye"); await pg.wait_for_timeout(300)
        t3 = await pg.get_attribute("#admin-pass", "type")
        ic3 = (await pg.inner_text("#btn-pass-eye")).strip()
        print("vuelve a ocultar:", t3, ic3)

        # login real con la clave de produccion
        await pg.fill("#admin-pass", PASS)
        await pg.click(".login-btn")
        await pg.wait_for_selector("#admin-section", state="visible", timeout=20000)
        await pg.wait_for_timeout(3500)
        print("LOGIN OK:", await pg.is_visible("#admin-section"), await pg.eval_on_selector_all(".tab", "els=>els.map(e=>e.textContent.trim())"))
        print("ERRORES:", errs[:5])
        await b.close()
asyncio.run(main())
