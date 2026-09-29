
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

OUT = r"D:\Programacion\vuelapelucas3000\work"
SITE = "https://fullscreencode.com/vuelapelucas3000/"
API = "https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:140]))
        pg.on("console", lambda m: errs.append("console: " + m.text[:140]) if m.type == "error" else None)

        # ---------- A) PAGINA PRINCIPAL ----------
        await pg.goto(SITE, wait_until="load")
        await pg.wait_for_timeout(5000)
        print("CTA:", (await pg.inner_text(".vl-cta-pop")).split("\n")[0])
        anim = await pg.eval_on_selector(".vl-cta-pop", "e=>getComputedStyle(e).animationName")
        print("CTA animacion:", anim)
        n = await pg.eval_on_selector_all(".vl-draw-grid figure", "els=>els.length")
        dls = await pg.eval_on_selector_all(".vl-draw-grid .vl-draw-dl", "els=>els.length")
        srcs = await pg.eval_on_selector_all(".vl-draw-grid figure img", "els=>els.slice(0,4).map(e=>e.src.split('/').pop())")
        badge = await pg.eval_on_selector_all("#fscBadge img", "els=>els.length")
        cred = await pg.eval_on_selector_all(".footer-credits .credit-name", "els=>els.map(e=>e.textContent.trim())")
        fly = await pg.inner_text("#count-flyers")
        print("dibujos:", n, "| botones descarga:", dls, "| imgs:", srcs)
        print("badge FSC:", badge, "| flyers:", fly)
        print("creditos:", cred)

        # lightbox de un dibujo
        if n:
            await pg.eval_on_selector("#comunidad-panchodraw", "e=>e.scrollIntoView()")
            await pg.click(".vl-draw-grid figure")
            await pg.wait_for_timeout(900)
            dl = await pg.eval_on_selector(".vl-lb-dl", "e=>({vis:getComputedStyle(e).display, href:e.getAttribute('href')})")
            cap = await pg.inner_text(".vl-lb-cap")
            print("LIGHTBOX:", cap, "| descarga:", dl)
            await pg.screenshot(path=os.path.join(OUT, "live_draw_lightbox.png"))
            await pg.keyboard.press("Escape")

        # ---------- B) PUBLICAR ANIMADO EN PANCHODRAW ----------
        await pg.goto(SITE + "panchodraw/", wait_until="load")
        await pg.wait_for_timeout(3000)
        box = await pg.eval_on_selector("#paintCanvas", "e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        cx, cy = box["x"]+box["w"]/2, box["y"]+box["h"]/2
        await pg.mouse.move(cx-60, cy-60); await pg.mouse.down()
        for i in range(12):
            await pg.mouse.move(cx-60+i*10, cy-60+(i%3)*24)
        await pg.mouse.up(); await pg.wait_for_timeout(600)
        await pg.click("#btnQuickPublish")
        await pg.wait_for_timeout(1000)
        await pg.fill("#pubNombre", "E2E ANIMADO")
        await pg.fill("#pubAutor", "@jpupper_e2e")
        fsc_link = await pg.inner_text("#pubFscLink")
        fsc_st = await pg.inner_text("#pubFscStatus")
        print("FSC link:", fsc_link, "| estado:", fsc_st)
        await pg.click("#btnDoPublish")
        st = ""
        for _ in range(30):
            await pg.wait_for_timeout(700)
            st = await pg.inner_text("#pubStatus")
            if "Publicado" in st or "✕" in st: break
        print("PUBLISH:", st)
        await pg.screenshot(path=os.path.join(OUT, "live_pub_animado.png"))

        lst = json.loads(urllib.request.urlopen(API + "/artworks", timeout=60).read())
        mine = [a for a in lst["artworks"] if a["nombre"].startswith("E2E ")]
        print("API total:", lst["count"], "| E2E:", json.dumps(mine[:1], ensure_ascii=False))
        if mine:
            g = "https://vps-4455523-x.dattaweb.com" + mine[0]["gif"]
            print("GIF:", urllib.request.urlopen(g, timeout=60).status, "bytes:", len(urllib.request.urlopen(g, timeout=60).read()))
            print("GIF dl:", urllib.request.urlopen(g + "?dl=1", timeout=60).headers.get("Content-Disposition"))
            print("E2E_ID=" + mine[0]["id"])

        # ---------- C) SE VE ANIMADO EN LA COMUNIDAD ----------
        await pg.goto(SITE, wait_until="load")
        await pg.wait_for_timeout(5000)
        imgs = await pg.eval_on_selector_all(".vl-draw-grid figure img", "els=>els.map(e=>({f:e.src.split('/').slice(-2).join('/'), w:e.naturalWidth}))")
        print("IMGS COMUNIDAD:", imgs)
        await pg.eval_on_selector("#comunidad-panchodraw", "e=>e.scrollIntoView()")
        await pg.wait_for_timeout(800)
        await pg.screenshot(path=os.path.join(OUT, "live_comunidad_animada.png"))
        print("ERRORES:", errs[:8])
        await b.close()

asyncio.run(main())
