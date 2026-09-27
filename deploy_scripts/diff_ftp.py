"""Compara los archivos del FTP con los locales ANTES de subir (evita pisar cambios hechos en el server)."""
import ftplib, ssl, os, hashlib, io

BASE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(BASE)
env = {}
with open(os.path.join(PROJ, '.env'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

REMOTE = env.get('FTP_REMOTE_BASE', '/public_html/vuelapelucas3000_2')
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
f = ftplib.FTP_TLS(context=ctx)
f.connect(env['FTP_HOST'], 21, timeout=30)
f.login(env['FTP_USER'], env['FTP_PASS'])
f.prot_p()

local_files = []
for root, _dirs, files in os.walk(os.path.join(PROJ, 'public')):
    for name in files:
        p = os.path.join(root, name)
        local_files.append((p, os.path.relpath(p, os.path.join(PROJ, 'public')).replace('\\', '/')))

for local_path, rel in sorted(local_files, key=lambda x: x[1]):
    with open(local_path, 'rb') as fh:
        ldata = fh.read()
    try:
        buf = io.BytesIO()
        f.retrbinary('RETR ' + REMOTE + '/' + rel, buf.write)
        rdata = buf.getvalue()
    except Exception as e:
        print(f'{rel}: NO EXISTE EN FTP ({type(e).__name__}) -> hay que subirlo')
        continue
    lm = hashlib.md5(ldata).hexdigest()[:8]
    rm = hashlib.md5(rdata).hexdigest()[:8]
    igual = 'IGUAL' if lm == rm else 'DIFERENTE'
    print(f'{rel}: {igual} local={len(ldata)}b({lm}) ftp={len(rdata)}b({rm})')
f.quit()
