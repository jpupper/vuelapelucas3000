import re, urllib.request
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
for name, url in [("greatfon", "https://greatfon.com/v/vuelapelucas3000"),
                  ("dumpor", "https://dumpor.io/v/vuelapelucas3000")]:
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept-Language": "es-AR,es;q=0.9"})
    h = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "replace")
    open(f"work/{name}.html", "w", encoding="utf-8").write(h)
    txt = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", h)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"\s+", " ", txt)
    print("=== ", name, len(h))
    print(txt[:1500])
    print()
