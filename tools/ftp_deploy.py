"""Deploy robusto del frontend por FTP (Ferozo).

- Compara el tamano remoto (SIZE) y saltea lo que ya esta igual -> se puede
  cortar y volver a correr sin resubir todo.
- Reintenta y reconecta si el server corta la conexion de datos.
- Guard: SOLO sube la carpeta public/ y SOLO dentro de /public_html/.

Uso: python tools/ftp_deploy.py [remote_dir] [--only subpath]
"""
import argparse
import ftplib
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUBLIC = os.path.join(ROOT, "public")


def load_env():
    env = {}
    with open(os.path.join(ROOT, ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


class Deployer:
    def __init__(self, env):
        self.host = env["FTP_HOST"]
        self.user = env["FTP_USER"]
        self.pw = env["FTP_PASS"]
        self.ftp = None
        self.connect()

    def connect(self):
        if self.ftp:
            try:
                self.ftp.quit()
            except Exception:
                pass
        self.ftp = ftplib.FTP_TLS(self.host, timeout=60)
        self.ftp.login(self.user, self.pw)
        self.ftp.prot_p()
        self.ftp.set_pasv(True)
        try:
            self.ftp.voidcmd("TYPE I")   # binario: habilita SIZE
        except Exception:
            pass

    def mkd(self, path):
        cur = ""
        for p in [x for x in path.split("/") if x]:
            cur += "/" + p
            try:
                self.ftp.mkd(cur)
            except ftplib.error_perm:
                pass

    def remote_size(self, rp):
        try:
            return self.ftp.size(rp)
        except Exception:
            return None

    def put(self, lp, rp, tries=4):
        want = os.path.getsize(lp)
        for attempt in range(1, tries + 1):
            try:
                if self.remote_size(rp) == want:
                    return "skip"
                with open(lp, "rb") as f:
                    self.ftp.storbinary("STOR " + rp, f, blocksize=65536)
                return "ok"
            except Exception as e:
                print(f"    retry {attempt}/{tries} {os.path.basename(rp)}: {str(e)[:70]}", flush=True)
                time.sleep(2 * attempt)
                try:
                    self.connect()
                except Exception as e2:
                    print("    reconexion fallida:", str(e2)[:70], flush=True)
                    time.sleep(5)
        return "fail"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("remote", nargs="?", default=None)
    ap.add_argument("--only", default=None, help="subir solo este subpath de public/")
    a = ap.parse_args()
    env = load_env()
    remote_base = a.remote or env.get("FTP_REMOTE_BASE", "/public_html/vuelapelucas3000")
    if not remote_base.startswith("/public_html/"):
        sys.exit(f"ABORTADO: destino inseguro {remote_base}")

    src_root = os.path.join(PUBLIC, a.only) if a.only else PUBLIC
    files = []
    for dp, _d, fns in os.walk(src_root):
        for fn in fns:
            files.append(os.path.join(dp, fn))
    files.sort()
    print(f"{len(files)} archivos -> {remote_base}")

    d = Deployer(env)
    ok = skip = fail = 0
    fails = []
    for i, lp in enumerate(files, 1):
        rel = os.path.relpath(lp, PUBLIC).replace("\\", "/")
        rp = remote_base + "/" + rel
        rdir = os.path.dirname(rp)
        try:
            d.mkd(rdir)
        except Exception as e:
            print(f"    mkd retry {rel}: {str(e)[:60]}", flush=True)
            try:
                d.connect()
                d.mkd(rdir)
            except Exception as e2:
                print("    mkd fallo definitivo:", str(e2)[:70], flush=True)
        r = d.put(lp, rp)
        if r == "ok":
            ok += 1
        elif r == "skip":
            skip += 1
        else:
            fail += 1
            fails.append(rel)
        # el server de Ferozo corta la conexion cada ~130 comandos: reconectamos
        if i % 80 == 0:
            try:
                d.connect()
            except Exception:
                pass
        if i % 20 == 0 or i == len(files):
            print(f"  {i}/{len(files)}  nuevos={ok} iguales={skip} fallos={fail}", flush=True)
    print(f"LISTO nuevos={ok} iguales={skip} fallos={fail}")
    for f in fails[:20]:
        print("   FALLO", f)
    try:
        d.ftp.quit()
    except Exception:
        pass


if __name__ == "__main__":
    main()
