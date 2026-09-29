"""Reorganiza el AÑO de las fotos de la galeria segun la fecha REAL de la imagen.

Prioridad de la fuente de fecha (de mas a menos confiable):
  1. EXIF DateTimeOriginal / DateTimeDigitized / DateTime de la foto original (assetsraw/...)
  2. EXIF del archivo ya procesado (public/img/galeria/...)
  3. Fecha de modificacion del archivo
  4. Año de la carpeta de origen (ej: assetsraw/2025/TAKA/ -> 2025)

Reescribe public/img/galeria/manifest.json dejando, por foto:
  year   -> año real
  fecha  -> YYYY-MM-DD (si se pudo)
  fuente -> exif | mtime | carpeta | previa

Uso:  python tools/fix_gallery_years.py [--write]
Sin --write solo muestra que cambiaria (dry run).
"""
import json
import os
import sys
from datetime import datetime
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUBLIC = os.path.join(ROOT, 'public')
MANIFEST = os.path.join(PUBLIC, 'img', 'galeria', 'manifest.json')

# HEIC/HEIF (las fotos del celular) — solo si el entorno lo tiene
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC = True
except Exception:
    HEIC = False

from PIL import Image  # noqa: E402

TAGS_FECHA = (36867, 36868, 306)   # DateTimeOriginal, DateTimeDigitized, DateTime


def fecha_exif(path):
    """Devuelve (datetime|None, fuente) leyendo EXIF de la imagen."""
    if not path or not os.path.isfile(path):
        return None, None
    try:
        with Image.open(path) as im:
            exif = im.getexif()
            # Los tags de fecha viven en el IFD de Exif: hay que mirar ahi tambien.
            try:
                ifd = exif.get_ifd(0x8769) or {}
            except Exception:
                ifd = {}
            for tag in TAGS_FECHA:
                valor = ifd.get(tag) or exif.get(tag)
                if not valor:
                    continue
                texto = str(valor).strip()
                for fmt in ('%Y:%m:%d %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%Y:%m:%d', '%Y-%m-%d'):
                    try:
                        return datetime.strptime(texto, fmt), 'exif'
                    except ValueError:
                        continue
    except Exception:
        return None, None
    return None, None


def año_carpeta(origen):
    """Busca un año de 4 digitos (1990-2100) en el camino del archivo."""
    for parte in str(origen or '').replace('\\', '/').split('/'):
        if len(parte) == 4 and parte.isdigit() and 1990 <= int(parte) <= 2100:
            return parte
    return None


def main():
    write = '--write' in sys.argv
    with open(MANIFEST, encoding='utf-8') as fh:
        items = json.load(fh)

    cambios = []
    sin_fecha = []
    for it in items:
        origen = it.get('origen', '')
        ruta_origen = os.path.join(ROOT, origen.replace('/', os.sep))
        ruta_publica = os.path.join(PUBLIC, (it.get('file') or '').replace('/', os.sep))

        fecha, fuente = fecha_exif(ruta_origen)
        if not fecha:
            fecha, fuente = fecha_exif(ruta_publica)
        if not fecha:
            base = ruta_origen if os.path.isfile(ruta_origen) else ruta_publica
            if os.path.isfile(base):
                fecha = datetime.fromtimestamp(os.path.getmtime(base))
                fuente = 'mtime'
                # OJO: si la foto la procesamos hace poco (build_gallery), el mtime
                # es la fecha de PROCESO, no la de la foto -> preferimos la carpeta.
                if (datetime.now() - fecha).days < 90:
                    a = año_carpeta(origen)
                    if a:
                        fecha = datetime(int(a), 1, 1)
                        fuente = 'carpeta'
        if not fecha:
            a = año_carpeta(origen) or str(it.get('year') or '')
            if a:
                fecha = datetime(int(a), 1, 1)
                fuente = 'carpeta'
            else:
                fuente = 'previa'

        viejo = str(it.get('year') or '')
        it['year'] = fecha.strftime('%Y') if fecha else viejo
        it['fecha'] = fecha.strftime('%Y-%m-%d') if fecha else ''
        it['fuente'] = fuente or ''

        if it['year'] != viejo:
            cambios.append((it.get('n'), os.path.basename(it.get('file', '')), viejo, it['year'], fuente, it.get('fecha')))
        if not it['fecha']:
            sin_fecha.append(it.get('file'))

    print('fotos:', len(items))
    print('antes:', dict(sorted(Counter([c[2] for c in cambios] + [i['year'] for i in items]).items())) )
    print('despues:', dict(sorted(Counter([i['year'] for i in items]).items())))
    print('fuentes:', dict(Counter([i['fuente'] for i in items])))
    print()
    print('CAMBIOS DE AÑO (' + str(len(cambios)) + '):')
    for n, f, viejo, nuevo, fuente, fch in cambios:
        print('  %-4s %-42s %s -> %s   [%s %s]' % (n, f[:42], viejo, nuevo, fuente, fch))
    if sin_fecha:
        print()
        print('SIN FECHA (quedan con el año previo):')
        for f in sin_fecha:
            print('   ', f)

    if write:
        with open(MANIFEST, 'w', encoding='utf-8') as fh:
            json.dump(items, fh, ensure_ascii=False, indent=2)
        print()
        print('ESCRITO:', MANIFEST)
    else:
        print()
        print('(dry run — corré con --write para guardar)')


if __name__ == '__main__':
    main()
