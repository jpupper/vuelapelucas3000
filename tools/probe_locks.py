import os, glob
from win_copy import copy_locked

base = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
cands = []
for prof in ["Default", "Profile 1", "Profile 2", "Guest Profile", "System Profile"]:
    for rel in ["Cookies", "Network/Cookies", "Login Data", "Network/Login Data",
                "Web Data", "History", "Network/TransportSecurity",
                "Network/Network Persistent State"]:
        p = os.path.join(base, prof, rel.replace("/", os.sep))
        if os.path.exists(p):
            cands.append(p)
for p in cands:
    ok = "?"
    try:
        n = os.path.getsize(p)
        with open(p, "rb") as f:
            f.read(16)
        ok = "LIBRE"
    except Exception as e:
        try:
            copy_locked(p, os.path.join(os.environ.get("TEMP", "."), "probe.tmp"))
            ok = "COPIABLE"
        except Exception as e2:
            ok = "BLOQUEADO"
    print(f"{ok:10s} {p}")
