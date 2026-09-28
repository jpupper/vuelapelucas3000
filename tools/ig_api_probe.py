import json, re, sys
from curl_cffi import requests

USER = "vuelapelucas3000"
APPID = "936619743392459"
UA_WEB = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
UA_APP = ("Instagram 219.0.0.12.117 Android (30/11; 420dpi; 1080x1920; "
          "samsung; SM-G991B; o1s; exynos2100; es_ES; 348833724)")

s = requests.Session(impersonate="chrome")
s.headers.update({"Accept-Language": "es-AR,es;q=0.9"})

# 1) pagina del perfil: sacar user id y el JSON preload
h = s.get(f"https://www.instagram.com/{USER}/", headers={"User-Agent": UA_WEB}, timeout=40).text
open("work/ig_profile.html", "w", encoding="utf-8").write(h)
uid = None
for pat in [r'"id":"(\d{6,})","username":"%s"' % USER,
            r'"pk":"?(\d{6,})"?',
            r'"profile_id":"(\d{6,})"',
            r'"user_id":"?(\d{6,})"?']:
    m = re.search(pat, h)
    if m:
        uid = m.group(1)
        break
print("user id:", uid)
print("end_cursor en HTML:", "end_cursor" in h, "| has_next_page:", "has_next_page" in h)
cis = re.findall(r'"code":"([A-Za-z0-9_-]{8,})"', h)
print("codes en HTML:", len(set(cis)))
# csrftoken del HTML
m = re.search(r'"csrf_token":"([^"]+)"', h)
print("csrf en html:", bool(m))

tests = []
if uid:
    tests += [
        ("web_profile_info", f"https://www.instagram.com/api/v1/users/web_profile_info/?username={USER}",
         {"x-ig-app-id": APPID, "User-Agent": UA_WEB}),
        ("feed_user_id_v1", f"https://www.instagram.com/api/v1/feed/user/{uid}/?count=33",
         {"x-ig-app-id": APPID, "User-Agent": UA_WEB}),
        ("feed_username_v1", f"https://www.instagram.com/api/v1/feed/user/{USER}/username/?count=33",
         {"x-ig-app-id": APPID, "User-Agent": UA_WEB}),
        ("i_feed_user", f"https://i.instagram.com/api/v1/feed/user/{uid}/?count=33",
         {"x-ig-app-id": APPID, "User-Agent": UA_APP}),
    ]
for name, url, hdr in tests:
    try:
        r = s.get(url, headers=hdr, timeout=40)
        j = None
        try:
            j = r.json()
        except Exception:
            pass
        n_img = len(re.findall(r"cdninstagram", r.text))
        stat = j.get("status") if isinstance(j, dict) else None
        msg = (j.get("message") if isinstance(j, dict) else "")[:60]
        items = 0
        if isinstance(j, dict):
            items = len(j.get("items", []) or (j.get("data", {}) or {}).get("user", {}).get("edge_owner_to_timeline_media", {}).get("edges", []) or [])
        print(f"{name:18s} {r.status_code} json={j is not None} status={stat} items={items} cdn={n_img} msg={msg}")
    except Exception as e:
        print(f"{name:18s} ERR {str(e)[:80]}")
