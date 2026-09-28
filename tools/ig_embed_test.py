import re, urllib.request, urllib.parse, json

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")


def get(url, extra=None):
    h = {"User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"}
    if extra:
        h.update(extra)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")


# 1) embed publico (sin login) con un shortcode candidato
for sc in ["-Zc6zTvAHYu", "-vY8he8Gl4s"]:
    try:
        st, h = get(f"https://www.instagram.com/p/{sc}/embed/captioned/")
        imgs = re.findall(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', h)
        alt = re.findall(r'"(https://[^"]*cdninstagram[^"]*)"', h)
        print(f"embed {sc}: HTTP {st} len={len(h)} img={len(imgs)} cdn={len(alt)} login={('login' in h.lower())}")
        for u in (imgs or alt)[:3]:
            print("   ", u[:160].replace("\\u0026", "&"))
    except Exception as e:
        print(f"embed {sc}: ERR {type(e).__name__} {str(e)[:100]}")

# 2) buscadores para enumerar shortcodes
q = urllib.parse.quote('site:instagram.com/p vuelapelucas3000')
for name, url in [("ddg", f"https://html.duckduckgo.com/html/?q={q}"),
                  ("bing", f"https://www.bing.com/search?q={q}&count=50"),
                  ("ddg2", f"https://lite.duckduckgo.com/lite/?q={q}")]:
    try:
        st, h = get(url)
        sc = sorted(set(re.findall(r"instagram\.com/(?:p|reel)/([A-Za-z0-9_-]{5,})", h)))
        print(f"{name}: HTTP {st} len={len(h)} shortcodes={len(sc)} {sc[:8]}")
    except Exception as e:
        print(f"{name}: ERR {type(e).__name__} {str(e)[:100]}")
