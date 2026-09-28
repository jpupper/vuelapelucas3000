import re
from curl_cffi import requests

USER = "vuelapelucas3000"
SITES = [
    "https://imgsed.com/{u}/",
    "https://piokok.com/profile/{u}/",
    "https://iganony.io/profile/{u}/",
    "https://anonyig.com/es/profile/{u}/",
    "https://inflact.com/es/profile-viewer/{u}/",
    "https://toolzu.com/profile-viewer/instagram/{u}/",
    "https://instafinsta.com/es/viewer/{u}/",
    "https://www.instanavigation.com/profile/{u}",
    "https://instanavigation.ru/{u}",
    "https://instaviewer.net/profile/{u}",
    "https://storiesig.info/es/{u}",
    "https://gramvio.com/{u}/",
    "https://iqsaved.com/es/profile/{u}/",
    "https://instagramviewer.io/{u}",
    "https://snapinsta.app/profile/{u}",
    "https://sssinstagram.com/es/{u}",
    "https://www.instaxyz.com/{u}",
    "https://insta-stories-viewer.com/{u}/",
    "https://imginn.io/profile/{u}/",
    "https://pixwox.com/profile/{u}/",
    "https://fastdl.app/es/{u}",
    "https://savefrom.net/es/{u}",
    "https://instalker.org/{u}",
    "https://qooh.me/{u}",
    "https://insta-viewer.com/{u}",
]

for tpl in SITES:
    url = tpl.format(u=USER)
    try:
        r = requests.get(url, impersonate="chrome", timeout=30,
                         headers={"Accept-Language": "es-AR,es;q=0.9"})
    except Exception as e:
        print(f"{url[:62]:62s} ERR {str(e)[:60]}")
        continue
    h = r.text
    media = set(re.findall(r"https://[a-z0-9.\-]*(?:cdninstagram|fbcdn)[^\"'\\\\)<> ]+", h))
    posts = set(re.findall(r"/(?:p|reel|tv)/([A-Za-z0-9_-]{8,})", h))
    bot = ("not a bot" in h.lower()) or ("turnstile" in h.lower()) or ("captcha" in h.lower())
    flag = "  <<<< OK" if (media or posts) and not bot else ""
    print(f"{url[:62]:62s} {r.status_code} len={len(h):7d} media={len(media):3d} posts={len(posts):3d} bot={bot}{flag}")
