import re, html as H
from curl_cffi import requests

UA = {"Accept-Language": "es-AR,es;q=0.9"}
CODE = "DSI-jALkuWz"   # uno de los que paso con ?img_index=1

for suffix in ["/embed/captioned/", "/embed/captioned/?img_index=1", "/embed/"]:
    url = f"https://www.instagram.com/p/{CODE}{suffix}"
    r = requests.get(url, impersonate="chrome", timeout=40, headers=UA)
    h = r.text
    emi = re.findall(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', h)
    print(f"\n=== {suffix}  HTTP {r.status_code} len={len(h)}")
    print(f"   EmbeddedMediaImage: {len(emi)}")
    for u in emi[:3]:
        print("      ", H.unescape(u)[:130])
    for k in ["carousel", "Carousel", "children", "sidecar", "edge_sidecar", "img_index", "display_url", "image_versions"]:
        print(f"   {k}: {h.count(k)}")
    # otras imagenes grandes
    big = [H.unescape(u).replace("\\u0026", "&") for u in
           re.findall(r'https://[a-z0-9.\-]*(?:cdninstagram|fbcdn)\.net/[^"\'\\ )<>]+', h)]
    big = [u for u in big if not re.search(r"s100x100|s150x150|s\d\d x", u)]
    print("   urls cdn grandes:", len(big))
    for u in big[:4]:
        print("      ", u[:130])
