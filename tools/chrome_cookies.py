"""Extrae cookies de Chrome (Windows) y escribe un cookies.txt formato Netscape.

Sirve para que gallery-dl / yt-dlp / instaloader usen la sesion ya logueada del
navegador sin pedir credenciales.

Uso: python tools/chrome_cookies.py instagram.com out/cookies.txt [--browser chrome|edge]
"""
import base64
import ctypes
import ctypes.wintypes as wt
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time

from Crypto.Cipher import AES

BROWSERS = {
    "chrome": r"%LOCALAPPDATA%\Google\Chrome\User Data",
    "edge": r"%LOCALAPPDATA%\Microsoft\Edge\User Data",
    "brave": r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\User Data",
}


def dpapi(unprot):
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wt.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    blob_in = DATA_BLOB(len(unprot), ctypes.cast(ctypes.create_string_buffer(unprot, len(unprot)),
                                                 ctypes.POINTER(ctypes.c_char)))
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)):
        raise OSError("CryptUnprotectData fallo")
    data = ctypes.string_at(blob_out.pbData, blob_out.cbData)
    ctypes.windll.kernel32.LocalFree(blob_out.pbData)
    return data


def get_key(user_data):
    ls = os.path.join(user_data, "Local State")
    with open(ls, "r", encoding="utf-8") as f:
        key_b64 = json.load(f)["os_crypt"]["encrypted_key"]
    key = base64.b64decode(key_b64)
    assert key[:5] == b"DPAPI", key[:5]
    return dpapi(key[5:])


def decrypt(value, key):
    if value[:3] in (b"v10", b"v11", b"v20"):
        nonce, payload = value[3:15], value[15:]
        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        return cipher.decrypt_and_verify(payload[:-16], payload[-16:])
    return dpapi(value)


def find_profiles(user_data):
    out = [os.path.join(user_data, "Default")]
    for d in os.listdir(user_data):
        if d.startswith("Profile "):
            out.append(os.path.join(user_data, d))
    return [p for p in out if os.path.exists(os.path.join(p, "Network", "Cookies"))]


def main():
    host = sys.argv[1]
    out = sys.argv[2]
    browser = "chrome"
    if "--browser" in sys.argv:
        browser = sys.argv[sys.argv.index("--browser") + 1]
    if "--user-data" in sys.argv:
        user_data = sys.argv[sys.argv.index("--user-data") + 1]
    else:
        user_data = os.path.expandvars(BROWSERS[browser])
    if not os.path.isdir(user_data):
        print("no existe", user_data)
        return 1
    key = get_key(user_data)

    rows = []
    for prof in find_profiles(user_data):
        src = os.path.join(prof, "Network", "Cookies")
        tmp = os.path.join(tempfile.gettempdir(), f"ck_{os.path.basename(prof)}_{time.time_ns()}.db")
        try:
            shutil.copy2(src, tmp)
        except Exception:
            try:
                from win_copy import copy_locked
                copy_locked(src, tmp)
                print(f"[lock] {prof}: copiado con FILE_SHARE")
            except Exception as e:
                print(f"[skip] {prof}: {e}")
                continue
        try:
            con = sqlite3.connect(tmp)
            cur = con.execute(
                "SELECT host_key,name,encrypted_value,path,is_secure,expires_utc "
                "FROM cookies WHERE host_key LIKE ?", (f"%{host}%",))
            n = 0
            for hk, name, enc, path, sec, exp in cur:
                try:
                    val = decrypt(enc, key).decode("utf-8", "replace")
                except Exception:
                    continue
                rows.append((hk, name, val, path, sec, exp))
                n += 1
            con.close()
            print(f"{prof}: {n} cookies")
        finally:
            try:
                os.remove(tmp)
            except OSError:
                pass

    # dedupe por (host,name) quedando el ultimo
    seen = {}
    for r in rows:
        seen[(r[0], r[1])] = r
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("# Netscape HTTP Cookie File\n")
        for (hk, name, val, path, sec, exp) in seen.values():
            f.write("\t".join([hk, "TRUE" if hk.startswith(".") else "FALSE", path,
                               "TRUE" if sec else "FALSE",
                               str(int((exp / 1e6) - 11644473600) if exp else 0),
                               name, val]) + "\n")
    print(f"OK -> {out}  ({len(seen)} cookies)")


if __name__ == "__main__":
    raise SystemExit(main())
