import sys, re, urllib.request, urllib.error

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
CANDIDATES = [
    ("picuki", "https://www.picuki.com/profile/vuelapelucas3000"),
    ("imginn", "https://imginn.com/vuelapelucas3000/"),
    ("greatfon", "https://greatfon.com/v/vuelapelucas3000"),
    ("pixwox", "https://pixwox.com/profile/vuelapelucas3000/"),
    ("gramhir", "https://gramhir.com/profile/vuelapelucas3000"),
    ("instastories", "https://instanavigation.online/vuelapelucas3000"),
    ("dumpor", "https://dumpor.io/v/vuelapelucas3000"),
    ("instalkr", "https://www.instalkr.com/profile/vuelapelucas3000"),
]
for name, url in CANDIDATES:
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": UA, "Accept": "text/html,*/*",
            "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"})
        with urllib.request.urlopen(req, timeout=25) as r:
            h = r.read().decode("utf-8", "replace")
        posts = set(re.findall(r"/(?:p|reel|video)/[A-Za-z0-9_-]{5,}", h))
        imgs = set(re.findall(r"https://[^\"'<> ]*cdninstagram[^\"'<> ]*", h))
        imgs |= set(re.findall(r"https://[^\"'<> ]*fbcdn[^\"'<> ]*", h))
        print(f"{name:14s} HTTP {r.status} len={len(h):7d} posts={len(posts):3d} img={len(imgs):3d}")
        if posts:
            print("      ej:", list(posts)[:3])
    except Exception as e:
        print(f"{name:14s} ERR {type(e).__name__}: {str(e)[:90]}")
