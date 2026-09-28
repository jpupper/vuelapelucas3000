import base64, json, os, sqlite3, shutil, tempfile, time
from Crypto.Cipher import AES

UD = r"C:\Users\JPupper\.gemini\antigravity-browser-profile"
ls_path = os.path.join(UD, "Local State")
ls = json.load(open(ls_path, encoding="utf-8"))
oc = ls.get("os_crypt", {})
key_b64 = oc.get("encrypted_key")
print("os_crypt keys:", list(oc.keys()))
print("encrypted_key prefix:", base64.b64decode(key_b64)[:5] if key_b64 else None)

src = os.path.join(UD, "Default", "Network", "Cookies")
tmp = os.path.join(tempfile.gettempdir(), "ag.db")
shutil.copy2(src, tmp)
con = sqlite3.connect(tmp)
rows = con.execute("select host_key,name,encrypted_value,length(encrypted_value),value,is_secure,is_httponly from cookies where host_key like '%instagram%'").fetchall()
for hk, name, ev, ln, val, sec, ho in rows:
    print(f"{hk:28s} {name:20s} len={ln} prefix={ev[:3]!r} plain={val!r} secure={sec} httponly={ho}")
print("total cookies:", con.execute("select count(*) from cookies").fetchone()[0])
print("hosts con mas cookies:", con.execute("select host_key,count(*) c from cookies group by host_key order by c desc limit 12").fetchall())
con.close()
