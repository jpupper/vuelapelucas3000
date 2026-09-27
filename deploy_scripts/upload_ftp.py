# Vuelapelucas 3000 - Upload FTP del frontend.
#
# SUBE UNICAMENTE LA CARPETA public/ (html, css, js, img).
# Nunca toca server.js, models/, routes/, .env, node_modules ni el backend del VPS.
#
# Destino por defecto: FTP_REMOTE_BASE del .env (/public_html/vuelapelucas3000)
# Se puede pisar por linea de comandos:
#     python upload_ftp.py /public_html/vuelapelucas3000_2
import ftplib
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
SOLO_ESTA_CARPETA = 'public'  # guard: solo se sube esto


def load_env():
    env = {}
    with open(os.path.join(PROJECT_DIR, '.env'), 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def upload_file(ftp, local_path, remote_path):
    with open(local_path, 'rb') as f:
        ftp.storbinary(f'STOR {remote_path}', f)
    print(f'  ok {remote_path}')


def ensure_dir(ftp, remote_dir):
    try:
        ftp.mkd(remote_dir)
    except ftplib.error_perm:
        pass


def upload_dir(ftp, local_dir, remote_dir):
    ensure_dir(ftp, remote_dir)
    for item in sorted(os.listdir(local_dir)):
        local_path = os.path.join(local_dir, item)
        remote_path = f'{remote_dir}/{item}'
        if os.path.isdir(local_path):
            upload_dir(ftp, local_path, remote_path)
        else:
            upload_file(ftp, local_path, remote_path)


def main():
    env = load_env()
    host = env.get('FTP_HOST')
    user = env.get('FTP_USER')
    password = env.get('FTP_PASS')
    remote_base = sys.argv[1] if len(sys.argv) > 1 else env.get('FTP_REMOTE_BASE', '/public_html/vuelapelucas3000')

    if not user or not password:
        sys.exit('FTP_USER / FTP_PASS faltan en .env')

    origen = os.path.join(PROJECT_DIR, SOLO_ESTA_CARPETA)
    if not os.path.isdir(origen):
        sys.exit(f'No existe {origen}')

    # Guard: el destino tiene que estar dentro de /public_html/ (nunca la raiz del FTP)
    if not remote_base.startswith('/public_html/'):
        sys.exit(f'ABORTADO: destino inseguro "{remote_base}" (debe estar dentro de /public_html/)')

    archivos = []
    for root, _dirs, files in os.walk(origen):
        for name in files:
            archivos.append(os.path.relpath(os.path.join(root, name), origen).replace('\\', '/'))

    print(f'Conectando a {host} como {user}...')
    ftp = ftplib.FTP_TLS(host, timeout=30)
    ftp.login(user, password)
    ftp.prot_p()

    print(f'Subiendo SOLO {SOLO_ESTA_CARPETA}/ ({len(archivos)} archivos) -> {remote_base}')
    for a in sorted(archivos):
        print(f'  - {a}')
    upload_dir(ftp, origen, remote_base)
    ftp.quit()
    url = 'https://fullscreencode.com' + remote_base.replace('/public_html', '')
    print(f'Upload completado -> {url.rstrip("/")}/')


if __name__ == '__main__':
    main()
