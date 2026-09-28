import re
from curl_cffi import requests

for base, path in [("https://dumpor.io", "/v/vuelapelucas3000"),
                   ("https://greatfon.com", "/v/vuelapelucas3000"),
                   ("https://www.picnob.com", "/profile/vuelapelucas3000/"),
                   ("https://imginn.com", "/vuelapelucas3000/")]:
    s = requests.Session(impersonate="chrome",
                         headers={"Accept-Language": "es-AR,es;q=0.9"})
    try:
        r = s.get(base + path, timeout=40)
    except Exception as e:
        print(base, "ERR", str(e)[:90]); continue
    h = r.text
    bot = "not a bot" in h.lower()
    media = set(re.findall(r"https://[a-z0-9.\-]*(?:cdninstagram|fbcdn)[^\"'\\\\)<> ]+", h))
    posts = set(re.findall(r"/(?:p|reel|tv)/([A-Za-z0-9_-]{6,})", h))
    print(f"{base:28s} {r.status_code} len={len(h):7d} bot={bot} media={len(media)} posts={len(posts)}")
    if media:
        for u in list(media)[:4]:
            print("     ", u[:140])
    # guardar por si hay que mirar
    open("work/m_" + base.split("//")[1].split(".")[0] + ".html", "w", encoding="utf-8").write(h)
