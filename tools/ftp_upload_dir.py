"""Sube una carpeta local a una carpeta remota del FTP de Ferozo (FTP_TLS).

Uso: python tools/ftp_upload_dir.py <local_dir> <remote_dir>
"""
import ftplib
import os
import sys

HOST = "c1700065.ferozo.com"
USER = "c1700065"
PASS = "Sarosa2026*Sarosa2026*"
SKIP = {".git", "node_modules", "__pycache__", ".venv-media", "work"}


def ensure(ftp, path):
    parts = [p for p in path.split("/") if p]
    cur = ""
    for p in parts:
        cur += "/" + p
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass


def main():
    local, remote = sys.argv[1], sys.argv[2]
    ftp = ftplib.FTP_TLS(HOST, timeout=60)
    ftp.login(USER, PASS)
    ftp.prot_p()
    n = 0
    for dp, dns, fns in os.walk(local):
        dns[:] = [d for d in dns if d not in SKIP]
        rel = os.path.relpath(dp, local).replace("\\", "/")
        rdir = remote if rel == "." else remote + "/" + rel
        ensure(ftp, rdir)
        for fn in fns:
            lp = os.path.join(dp, fn)
            rp = rdir + "/" + fn
            with open(lp, "rb") as f:
                ftp.storbinary("STOR " + rp, f)
            n += 1
            if n % 25 == 0:
                print(f"  subidos {n}", flush=True)
    ftp.quit()
    print(f"LISTO {n} archivos -> {remote}")


if __name__ == "__main__":
    main()
