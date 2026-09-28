import ftplib, os, sys
HOST, USER, PASS = "c1700065.ferozo.com", "c1700065", "Sarosa2026*Sarosa2026*"
BASE = "/public_html/vuelapelucas3000"
f = ftplib.FTP_TLS(HOST, timeout=60); f.login(USER, PASS); f.prot_p()

loc = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")
for rel in ["index.html", "css/vuelapelucas2026.css", "js/galeria.js",
            "img/vuelapelucas-cutout.gif", "img/nave-vuelapelu.png",
            "img/galeria/manifest.json", "img/galeria/002_2022__img-20221218-133536683-hdr.jpg",
            "img/galeria/133_2025__lhva0823.jpg", "img/juegos/vuela3000game.jpg"]:
    lp = os.path.join(loc, rel.replace("/", os.sep))
    lsz = os.path.getsize(lp) if os.path.exists(lp) else None
    try:
        rsz = f.size(BASE + "/" + rel)
    except Exception as e:
        rsz = f"ERR {str(e)[:40]}"
    print(f"{rel:70s} local={lsz} remoto={rsz}")

for d in ["/img", "/img/galeria", "/img/galeria/_thumbs"]:
    try:
        n = []
        f.retrlines(f"LIST {BASE}{d}", n.append)
        print(d, "->", len(n), "entries")
    except Exception as e:
        print(d, "ERR", str(e)[:60])
f.quit()
