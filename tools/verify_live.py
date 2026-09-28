import urllib.request, hashlib, os

BASE = "https://fullscreencode.com/vuelapelucas3000"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36"
CHECKS = [
    ("index.html", "COMMUNITY CREATION"),
    ("css/vuelapelucas2026.css", "vl-gallery"),
    ("js/galeria.js", "removeAttribute"),
    ("js/main.js", "revealCards"),
    ("img/galeria/manifest.json", "\"year\": \"2025\""),
    ("img/nave-vuelapelu.png", None),
    ("img/vuelapelucas-cutout.gif", None),
    ("img/juegos/vuela3000game.jpg", None),
    ("hospedajes.html", "category-icon-img"),
    ("img/galeria/_thumbs/133.jpg", None),
    ("img/galeria/133_2025__lhva0823.jpg", None),
    ("img/ico-comunidad.jpg", None),
]
local_root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
for rel, needle in CHECKS:
    try:
        r = urllib.request.urlopen(urllib.request.Request(BASE + "/" + rel, headers={"User-Agent": UA}), timeout=40)
        b = r.read()
    except Exception as e:
        print(f"{rel:44s} ERR {str(e)[:60]}")
        continue
    lp = os.path.join(local_root, rel.replace("/", os.sep))
    lsz = os.path.getsize(lp) if os.path.exists(lp) else -1
    hit = (needle in b.decode("utf-8", "replace")) if needle else "-"
    ok = "OK " if r.status == 200 and (needle is None or hit is True) and lsz == len(b) else "??"
    print(f"{ok} {rel:44s} http={r.status} remoto={len(b)} local={lsz} needle={hit}")
