import re
from curl_cffi import requests

UA = {"Accept-Language": "es-AR,es;q=0.9"}
tests = [
    ("rsshub.app", "https://rsshub.app/instagram/user/vuelapelucas3000"),
    ("rsshub-ig", "https://rsshub.app/picuki/user/vuelapelucas3000"),
    ("rsshub2", "https://rsshub.rssforever.com/instagram/user/vuelapelucas3000"),
    ("ig-json", "https://www.instagram.com/vuelapelucas3000/?__a=1&__d=dis"),
    ("ig-apigql", "https://www.instagram.com/api/graphql"),
]
for name, url in tests:
    try:
        r = requests.get(url, impersonate="chrome", timeout=30, headers=UA)
        n_img = len(re.findall(r"cdninstagram|fbcdn", r.text))
        codes = sorted(set(re.findall(r"/(?:p|reel)/([A-Za-z0-9_-]{8,})", r.text)))
        print(f"{name:12s} {r.status_code} len={len(r.text):7d} cdn={n_img} codes={len(codes)} {codes[:5]}")
        if n_img:
            open(f"work/rss_{name}.xml", "w", encoding="utf-8").write(r.text)
    except Exception as e:
        print(f"{name:12s} ERR {str(e)[:80]}")
