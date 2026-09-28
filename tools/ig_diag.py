import sys, re
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(
        user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"),
        viewport={"width": 1400, "height": 1000}, locale="es-AR")
    pg = ctx.new_page()
    pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_timeout(8000)
    print("TITLE:", pg.title())
    print("URL:", pg.url)
    txt = pg.inner_text("body")
    print("--- text ---")
    print(re.sub(r"\n{2,}", "\n", txt)[:2000])
    pg.screenshot(path="work/mirror_shot.png", full_page=False)
    print("shot -> work/mirror_shot.png")
    b.close()
