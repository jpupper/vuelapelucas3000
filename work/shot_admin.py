
import asyncio, os
from playwright.async_api import async_playwright

URL = "http://localhost:4000/admin.html"
OUT = r"D:\Programacion\vuelapelucas3000\work"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        await pg.goto(URL, wait_until="load")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=os.path.join(OUT,"admin_login.png"), full_page=True)
        # simular panel logueado con datos de prueba (solo visual)
        await pg.evaluate("""() => {
            document.getElementById('login-section').style.display='none';
            document.getElementById('admin-section').style.display='block';
            document.getElementById('stats').innerHTML = `<div class="stat-card"><div class="stat-number">42</div><div class="stat-label">Total Inscriptos</div></div>`;
            document.getElementById('inscripciones-body').innerHTML = `
              <tr><td class="col-md">Ana</td><td class="col-md">Gomez</td><td class="col-lg">ana@mail.com</td><td class="col-sm">11-5555</td><td class="col-sm">Victorica</td><td class="col-md"><span class="badge-rol">VJ</span></td><td class="col-lg">Set visual + mapping</td><td class="col-lg">Resolume, TouchDesigner</td><td class="col-sm">Camping</td><td class="col-sm">28/9/2026</td><td class="col-accion"><button class="delete-btn">&#128465;</button></td></tr>
              <tr><td class="col-md">Juan</td><td class="col-md">Perez</td><td class="col-lg">juan@mail.com</td><td class="col-sm">11-4444</td><td class="col-sm">Santa Rosa</td><td class="col-md"><span class="badge-rol">Artista de escenario</span></td><td class="col-lg">Banda en vivo</td><td class="col-lg">-</td><td class="col-sm">Hotel</td><td class="col-sm">28/9/2026</td><td class="col-accion"><button class="delete-btn">&#128465;</button></td></tr>`;
        }""")
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=os.path.join(OUT,"admin_panel.png"), full_page=True)
        errs = await pg.evaluate("() => (window.__errs||[])")
        print("screenshots ok", errs)
        await b.close()

asyncio.run(main())
