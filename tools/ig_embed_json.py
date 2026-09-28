import re, json, html as H
from curl_cffi import requests

UA = {"Accept-Language": "es-AR,es;q=0.9"}
for CODE in ["DSI-jALkuWz", "DR7Y634ERJh"]:
    r = requests.get(f"https://www.instagram.com/p/{CODE}/embed/captioned/",
                     impersonate="chrome", timeout=40, headers=UA)
    h = r.text
    open(f"work/embed_{CODE}.html", "w", encoding="utf-8").write(h)
    print(f"=== {CODE} len={len(h)}")
    for m in re.finditer(r".{80}(?:edge_sidecar|sidecar|display_url).{200}", h):
        s = m.group(0).replace("\\u0026", "&")
        print("   ...", s[:300].replace("\n", " "))
        print()
    print("   'display_url' ocurrencias:", h.count("display_url"))
    print("   'children' ocurrencias:", h.count("children"))
    print("   'GraphSidecar':", h.count("GraphSidecar"), "| 'GraphImage':", h.count("GraphImage"), "| 'GraphVideo':", h.count("GraphVideo"))
