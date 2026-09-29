
import asyncio, os
from playwright.async_api import async_playwright
from PIL import Image

OUT = r"D:\Programacion\vuelapelucas3000\work"
URL = "http://localhost:4000/panchodraw/"

async def main():
    errs = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1400,"height":1000})
        pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type in ("error","warning") else None)
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        await pg.goto(URL, wait_until="load")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=os.path.join(OUT,"pancho_full.png"), full_page=True)
        # abrir el dialogo de publicacion
        await pg.click("#btnQuickPublish")
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path=os.path.join(OUT,"pancho_publish.png"))
        # estado del bloque fscauth
        txt = await pg.inner_text("#pubFscStatus")
        link = await pg.get_attribute("#pubFscLink","class")
        print("FSC_STATUS:", txt)
        print("FSC_LINK_CLASS:", link)
        print("ERRORES:", errs[:15])
        await b.close()

    # ---- tarjeta 1200x750 a partir del screenshot del dialogo/window ----
    src = Image.open(os.path.join(OUT,"pancho_full.png")).convert("RGB")
    tw, th = 1200, 750
    canvas = Image.new("RGB", (tw, th), (0,0,0))
    # escalar la captura completa para que entre con margen
    scale = min(tw*0.92/src.width, th*0.92/src.height)
    new = src.resize((int(src.width*scale), int(src.height*scale)), Image.LANCZOS)
    canvas.paste(new, ((tw-new.width)//2, (th-new.height)//2))
    dst = r"D:\Programacion\vuelapelucas3000\public\img\juegos\panchodraw.jpg"
    canvas.save(dst, "JPEG", quality=88, optimize=True)
    print("CARD:", dst, os.path.getsize(dst))

asyncio.run(main())
