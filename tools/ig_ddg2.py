import re, urllib.request, urllib.parse

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
q = urllib.parse.quote('site:instagram.com/p vuelapelucas3000')
h = urllib.request.urlopen(urllib.request.Request(
    f"https://html.duckduckgo.com/html/?q={q}",
    headers={"User-Agent": UA}), timeout=30).read().decode("utf-8", "replace")
open("work/ddg.html", "w", encoding="utf-8").write(h)
# bloques de resultado
blocks = re.split(r'class="result__body"', h)[1:]
print("bloques:", len(blocks))
for b in blocks[:12]:
    txt = re.sub(r"<[^>]+>", " ", b)
    txt = re.sub(r"\s+", " ", txt).strip()
    m = re.search(r"instagram\.com/(?:p|reel)/([A-Za-z0-9_-]+)", b)
    print("-", (m.group(1) if m else "?"), "::", txt[:160])
