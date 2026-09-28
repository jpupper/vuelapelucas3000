import json, re, sys, time
from curl_cffi import requests

USER = "vuelapelucas3000"
UA = {"Accept-Language": "es-AR,es;q=0.9"}

# 1) snapshots del perfil en el Wayback Machine
cdx = ("https://web.archive.org/cdx/search/cdx?url=instagram.com/"
       f"{USER}*&output=json&fl=timestamp,original,statuscode&collapse=timestamp:8&limit=500")
r = requests.get(cdx, impersonate="chrome", timeout=60, headers=UA)
print("cdx:", r.status_code, len(r.text))
try:
    rows = r.json()
except Exception:
    print(r.text[:300]); sys.exit(1)
print("snapshots:", len(rows))
tss = [x[0] for x in rows[1:]] if rows and rows[0][0] == "timestamp" else [x[0] for x in rows]
print("ejemplos:", tss[:10], "...", tss[-5:] if tss else "")
open("work/wayback_snapshots.json", "w").write(json.dumps(tss))
