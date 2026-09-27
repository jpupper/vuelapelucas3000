"""Cambia SOLO la linea FTP_REMOTE_BASE del .env (sin imprimir secretos)."""
import os

ENV = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
NUEVO = '/public_html/vuelapelucas3000'

with open(ENV, 'r', encoding='utf-8') as f:
    lines = f.readlines()

out, visto = [], False
for line in lines:
    if line.startswith('FTP_REMOTE_BASE='):
        out.append(f'FTP_REMOTE_BASE={NUEVO}\n')
        visto = True
    else:
        out.append(line if line.endswith('\n') else line + '\n')
if not visto:
    out.append(f'\nFTP_REMOTE_BASE={NUEVO}\n')

with open(ENV, 'w', encoding='utf-8', newline='\n') as f:
    f.writelines(out)

for line in open(ENV, encoding='utf-8'):
    if line.startswith('FTP_'):
        k, v = line.strip().split('=', 1)
        print(f'  {k} -> {v if k != "FTP_PASS" else "<oculto>"}')
