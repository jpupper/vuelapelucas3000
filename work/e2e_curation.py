
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright

SITE = "https://fullscreencode.com/vuelapelucas3000/"
API = "https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api"
PASS = "rty456fgh"

def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=60).read().decode()

async def main():
    # 1) ocultar 2 flyers por API y ver que la pagina muestre 32
    post(API + "/curation/flyers?pass=" + PASS, {"ocultos": ["img/flyers/001.jpg", "img/flyers/002.jpg"]})
    post(API + "/curation/galeria?pass=" + PASS, {"ocultos": ["img/galeria/002_2022__img-20221218-133536683-hdr.jpg"]})
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width":1440,"height":1000})
        await pg.goto(SITE, wait_until="load")
        await pg.wait_for_timeout(5000)
        fly = await pg.inner_text("#count-flyers")
        chips = await pg.eval_on_selector_all(".vl-filters .vl-filter", "els=>els.map(e=>e.textContent.trim())")
        print("CON 2 OCULTOS -> flyers:", fly, "| chips galeria:", chips)
        await b.close()

    # 2) revertir
    post(API + "/curation/flyers?pass=" + PASS, {"ocultos": []})
    post(API + "/curation/galeria?pass=" + PASS, {"ocultos": []})
    st = json.loads(urllib.request.urlopen(API + "/curation/flyers", timeout=60).read())
    print("REVERTIDO:", st["ocultos"])

    # 3) borrar el dibujo E2E (si quedo)
    lst = json.loads(urllib.request.urlopen(API + "/artworks", timeout=60).read())
    for a in lst["artworks"]:
        if a["nombre"].startswith("E2E "):
            req = urllib.request.Request(API + "/artworks/" + a["id"] + "?pass=" + PASS, method="DELETE")
            print("BORRADO:", a["nombre"], urllib.request.urlopen(req, timeout=60).read().decode()[:60])
    lst = json.loads(urllib.request.urlopen(API + "/artworks", timeout=60).read())
    print("DIBUJOS FINAL:", lst["count"], [ (x["nombre"], 'gif' if x["gif"] else 'png') for x in lst["artworks"] ])

asyncio.run(main())
