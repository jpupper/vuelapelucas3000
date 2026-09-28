"""Baja el Instagram del festival en cuanto Chrome/Edge suelten la base de cookies.

Flujo:
  1. Espera a poder leer la cookies de Instagram del perfil Default de Chrome
     (o Edge). Mientras los navegadores esten abiertos, la base esta bloqueada.
  2. Escribe work/cookies_ig.txt
  3. Corre tools/ig_download.py, que baja todo y arma
     public/img/flyers/ + manifest.json (lo usa COMMUNITY CREATION).

Uso:
    python tools/ig_now.py                 # espera hasta --wait-min minutos
    python tools/ig_now.py --wait-min 0     # no espera: falla si esta bloqueado
"""
import argparse
import importlib.util
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

COOKIES = os.path.join(ROOT, "work", "cookies_ig.txt")


def try_once(browser):
    """Devuelve la cantidad de cookies de instagram que pudo leer."""
    spec = importlib.util.spec_from_file_location(
        "cc_" + browser, os.path.join(HERE, "chrome_cookies.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.argv = ["chrome_cookies.py", "instagram.com", COOKIES, "--browser", browser]
    spec.loader.exec_module(mod)
    try:
        mod.main()
    except SystemExit:
        pass
    if not os.path.exists(COOKIES):
        return 0
    n = 0
    with open(COOKIES, encoding="utf-8", errors="replace") as f:
        for line in f:
            if "instagram" in line and not line.startswith("#"):
                n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wait-min", type=int, default=30)
    ap.add_argument("--browser", default="chrome")
    ap.add_argument("--user", default="vuelapelucas3000")
    a = ap.parse_args()

    deadline = time.time() + a.wait_min * 60
    browsers = [a.browser] + [b for b in ("chrome", "edge") if b != a.browser]
    while True:
        for b in browsers:
            n = try_once(b)
            print(f"  {b}: {n} cookies de instagram")
            if n > 0:
                print(f"OK cookies -> {COOKIES}")
                rc = subprocess.run([sys.executable,
                                     os.path.join(HERE, "ig_download.py"),
                                     "--cookies", COOKIES, "--user", a.user],
                                    cwd=ROOT)
                return rc.returncode
        if time.time() >= deadline:
            print("Tiempo agotado: cerra Chrome y Edge y volve a correr este script.")
            return 2
        print("Chrome/Edge siguen abiertos (base de cookies bloqueada). "
              "Cerralos y sigo solo... reintento en 15s.", flush=True)
        time.sleep(15)


if __name__ == "__main__":
    raise SystemExit(main())
