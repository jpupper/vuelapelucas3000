"""Diff del destino real (una carpeta del FTP) contra public/ local. No sube nada."""
import ftplib, ssl, os, hashlib, io, sys

BASE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(BASE)
env = {}
with open(os.path.join(PROJ, '.env'), encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()

REMOTE = sys.argv[1] if len(sys.argv) > 1 else '/public_html/vuelapelucas3000'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
f = ftplib.FTP_TLS(context=ctx)
f.connect(env['FTP_HOST'], 21, timeout=30)
f.login(env['FTP_USER'], env['FTP_PASS'])
f.prot_p()

print('=== contenido actual de', REMOTE, '===')
try:
    f.cwd(REMOTE)
    for n in sorted(f.nlst()):
        if n in ('.', '..'):
            continue
        tipo = '?'
        try:
            f.cwd(n); tipo = 'dir '; f.cwd(REMOTE)
        except Exception:
            tipo = 'file'
        print(f'  [{tipo}] {n}')
except Exception as e:
    sys.exit('No existe la carpeta destino: ' + str(e))

print('\n=== archivos de public/ local vs destino ===')
local_root = os.path.join(PROJ, 'public')
locales = []
for root, _d, files in os.walk(local_root):
    for name in files:
        p = os.path.join(root, name)
        locales.append((p, os.path.relpath(p, local_root).replace('\\', '/')))

for local_path, rel in sorted(locales, key=lambda x: x[1]):
    with open(local_path, 'rb') as fh:
        ldata = fh.read()
    try:
        buf = io.BytesIO()
        f.retrbinary('RETR ' + REMOTE + '/' + rel, buf.write)
        rdata = buf.getvalue()
        estado = 'IGUAL (no hace falta subir)' if hashlib.md5(ldata).hexdigest() == hashlib.md5(rdata).hexdigest() else f'REEMPLAZA ({len(rdata)}b -> {len(ldata)}b)'
    except Exception:
        estado = f'NUEVO (no existia, {len(ldata)}b)'
    print(f'  {rel:32s} {estado}')

print('\n=== NO se toca (no existe en public/ local) ===')
for n in sorted(f.nlst()):
    if n not in ('.', '..') and n not in ('css', 'js', 'img', 'admin.html', 'index.html', 'anotate.html'):
        print('  ', n)
f.quit()
