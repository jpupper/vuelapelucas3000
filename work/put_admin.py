
import sys, os
ROOT = r"D:\Programacion\vuelapelucas3000"
sys.path.insert(0, os.path.join(ROOT, "tools"))
import ftp_deploy as fd

env = fd.load_env()
d = fd.Deployer(env)
pares = [
    (os.path.join(ROOT, "public", "admin.html"), "/public_html/vuelapelucas3000/admin.html"),
]
for lp, rp in pares:
    d.mkd(os.path.dirname(rp))
    d.put(lp, rp, force=True)
    print("subido", rp, os.path.getsize(lp))
d.ftp.quit()
