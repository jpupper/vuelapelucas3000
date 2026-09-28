import re, json
from curl_cffi import requests

SC = "DSX1_aTEfQ5"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

# 1) embed publico (sin login)
u = f"https://www.instagram.com/p/{SC}/embed/captioned/"
r = requests.get(u, impersonate="chrome", headers={"User-Agent": UA,
                 "Accept-Language": "es-AR,es;q=0.9"}, timeout=40)
h = r.text
print("embed:", r.status_code, len(h))
imgs = re.findall(r'class="EmbeddedMediaImage"[^>]*src="([^"]+)"', h)
print("EmbeddedMediaImage:", len(imgs))
for x in imgs[:3]:
    print("   ", x[:160])
alt = sorted(set(re.findall(r"https://[a-z0-9.\-]*cdninstagram\.com/[^\"'\\\\)<> ]+", h)))
print("cdn urls:", len(alt))
for x in alt[:6]:
    print("   ", x[:150])
print("tiene carousel?", "EmbeddedMediaImage" in h, h.count("EmbeddedMediaImage"))
print("texto:", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h))[:300])
