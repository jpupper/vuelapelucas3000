import re, urllib.request, urllib.parse, html as H

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,*/*",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


q = urllib.parse.quote('"vuelapelucas3000" instagram')
h = get(f"https://html.duckduckgo.com/html/?q={q}")
res = re.findall(r'<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>(.*?)</a>', h, re.S)
if not res:
    res = re.findall(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', h, re.S)
for u, t in res[:25]:
    u = H.unescape(u)
    if "uddg=" in u:
        u = urllib.parse.unquote(u.split("uddg=")[1].split("&")[0])
    print(re.sub(r"<[^>]+>", "", H.unescape(t))[:70], "|", u[:110])
print("=== total results:", len(res))
sc = sorted(set(re.findall(r"instagram\.com/(?:p|reel)/([A-Za-z0-9_-]{5,})", h)))
print("shortcodes:", sc)
# probar embed con el primero real
if sc:
    e = get(f"https://www.instagram.com/p/{sc[0]}/embed/captioned/")
    im = re.findall(r'EmbeddedMediaImage[^>]*src="([^"]+)"', e)
    im2 = re.findall(r'"(https://[^"\\]*cdinstagram[^"]*)"', e)
    print("embed", sc[0], "len", len(e), "img", im[:1], "im2", im2[:1])
    print("has 'Sorry, this page'", "Sorry, this page" in e)
