"""Borra archivos sueltos del FTP (solo dentro de /public_html/).

Uso: python tools/ftp_rm.py /public_html/vuelapelucas3000/img/vuelapelucas-cutout.gif [...]
"""
import ftplib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def main():
    targets = sys.argv[1:]
    if not targets:
        sys.exit("nada para borrar")
    for t in targets:
        if not t.startswith("/public_html/"):
            sys.exit(f"ABORTADO: destino inseguro {t}")
    env = load_env()
    f = ftplib.FTP_TLS(env["FTP_HOST"], timeout=60)
    f.login(env["FTP_USER"], env["FTP_PASS"])
    f.prot_p()
    for t in targets:
        try:
            f.delete(t)
            print("BORRADO", t)
        except Exception as e:
            print("no se pudo borrar", t, "->", str(e)[:80])
    try:
        f.quit()
    except Exception:
        pass


if __name__ == "__main__":
    main()
