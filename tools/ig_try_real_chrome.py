import re, sys, os
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
HEADLESS = "--headless" in sys.argv
PROF = os.path.abspath("work/pw-profile")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(
        PROF, channel="chrome", headless=HEADLESS, locale="es-AR",
        viewport={"width": 1440, "height": 1000}, user_agent=UA,
        args=["--disable-blink-features=AutomationControlled",
              "--disable-features=IsolateOrigins,site-per-process"])
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")
    pg.goto(URL, wait_until="domcontentloaded", timeout=60000)
    pg.wait_for_timeout(7000)
    for _ in range(6):
        pg.mouse.wheel(0, 4000)
        pg.wait_for_timeout(1200)
    txt = pg.inner_text("body")
    print("TITLE:", pg.title())
    print("BOT?", "verify you're not a bot" in txt.lower())
    print(re.sub(r"\n{2,}", "\n", txt)[:900])
    html = pg.content()
    media = sorted(set(re.findall(r"https://[a-z0-9.\-]*(?:cdninstagram|fbcdn)[^\"'\\\\)<> ]+", html)))
    print("media urls:", len(media))
    for u in media[:10]:
        print("   ", u[:150])
    pg.screenshot(path="work/mirror_shot.png", full_page=False)
    ctx.close()
