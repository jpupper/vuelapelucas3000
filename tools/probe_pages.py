import urllib.request, hashlib
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")
urls = [
 "https://fullscreencode.com/jpupper/nftsapps/vuelapelucas3000/",
 "https://fullscreencode.com/jpupper/nftsapps/pamparticles/",
 "https://fullscreencode.com/jpupper/nftsapps/pamilo/",
 "https://fullscreencode.com/jpupper/nftsapps/pampam/",
 "https://fullscreencode.com/jpupper/nftsapps/nave7/",
]
for u in urls:
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=25)
        b = r.read()
        print(f"{u}\n   {r.status} {len(b)}b md5={hashlib.md5(b).hexdigest()[:10]}")
        print("   ", b[:220].decode("utf-8", "replace").replace("\n", " ").replace("\r", ""))
    except Exception as e:
        print(u, "ERR", e)
