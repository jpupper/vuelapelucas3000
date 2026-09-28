"""Busca TODAS las bases de cookies estilo Chromium en la maquina y reporta
cuales tienen cookies de instagram (y si estan bloqueadas por el proceso dueño).
"""
import base64
import ctypes
import ctypes.wintypes as wt
import glob
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from win_copy import copy_locked  # noqa: E402

ROOTS = [
    os.path.expandvars(r"%LOCALAPPDATA%"),
    os.path.expandvars(r"%APPDATA%"),
    os.path.expandvars(r"%LOCALAPPDATA%\Programs"),
    os.path.expandvars(r"%USERPROFILE%"),
]
SKIP_PARTS = ("\\node_modules\\", "\\hermes-agent\\", "\\.git\\", "\\packages\\",
              "\\windowsapps\\", "\\microsoft\\edgewebview\\")
DEPTH = 5


def find_cookie_files():
    found = []
    for root in ROOTS:
        if not os.path.isdir(root):
            continue
        base_depth = root.rstrip("\\").count("\\")
        for dp, dns, fns in os.walk(root):
            if dp.count("\\") - base_depth > DEPTH:
                dns[:] = []
                continue
            low = dp.lower()
            if any(s in low for s in SKIP_PARTS):
                dns[:] = []
                continue
            for fn in fns:
                if fn in ("Cookies", "cookies.sqlite"):
                    found.append(os.path.join(dp, fn))
    return found


def readable(path):
    try:
        with open(path, "rb") as f:
            f.read(16)
        return "libre"
    except Exception:
        tmp = os.path.join(tempfile.gettempdir(), "ck_probe.db")
        try:
            copy_locked(path, tmp)
            os.remove(tmp)
            return "copiable"
        except Exception:
            return "BLOQUEADA"


def insta_count(path):
    tmp = os.path.join(tempfile.gettempdir(), f"ck_{time.time_ns()}.db")
    try:
        with open(path, "rb") as f:
            data = f.read()
    except Exception:
        try:
            copy_locked(path, tmp)
            data = open(tmp, "rb").read()
        except Exception:
            return None
        finally:
            pass
    try:
        if data[:15] != b"SQLite format 3":
            return None
        open(tmp, "wb").write(data)
        con = sqlite3.connect(tmp)
        n = con.execute("select count(*) from cookies where host_key like '%instagram%'").fetchone()[0]
        tot = con.execute("select count(*) from cookies").fetchone()[0]
        con.close()
        return (n, tot)
    except Exception as e:
        return ("err", str(e)[:40])
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


if __name__ == "__main__":
    files = find_cookie_files()
    print(f"bases de cookies encontradas: {len(files)}")
    hits = []
    for p in files:
        st = readable(p)
        info = insta_count(p) if st != "BLOQUEADA" else None
        if isinstance(info, tuple) and info and isinstance(info[0], int) and info[0] > 0:
            hits.append((p, info, st))
            print(f"  >>> INSTAGRAM {info[0]:4d} cookies  [{st}]  {p}")
        elif info is None and st == "BLOQUEADA":
            print(f"  bloqueada  {p}")
    print("\nhits:", len(hits))
    for p, info, st in hits:
        print("   ", p, info, st)
