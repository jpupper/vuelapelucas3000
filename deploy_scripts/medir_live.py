"""Mide con Chrome headless los archivos LIVE (bajados del FTP): overflow del form + boton WhatsApp."""
import os, re, shutil, subprocess, json, sys

LIVE = os.environ.get('LIVE_DIR') or os.path.join(os.environ['LOCALAPPDATA'], 'Temp', 'vplive2')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
TMP = os.path.join(os.environ['LOCALAPPDATA'], 'Temp', 'vpmeasure2')
shutil.rmtree(TMP, ignore_errors=True)
os.makedirs(TMP, exist_ok=True)
shutil.copy(os.path.join(LIVE, 'css', 'styles.css'), os.path.join(TMP, 'styles.css'))

SCRIPT = """
window.addEventListener('load', function () {
  var out = {};
  var form = document.querySelector('.inscripcion-form');
  if (form) {
    out.contenedor = Math.round(form.parentElement.clientWidth);
    out.formulario = Math.round(form.getBoundingClientRect().width);
    out.formulario_scroll = form.scrollWidth;
    out.se_sale = form.scrollWidth > form.clientWidth + 1;
    out.fuera_del_form = [];
    document.querySelectorAll('.form-group select, .form-group input, .form-group textarea').forEach(function (s) {
      var r = s.getBoundingClientRect(), fr = form.getBoundingClientRect();
      if (r.right > fr.right + 1 || r.left < fr.left - 1) out.fuera_del_form.push(s.id + ' (ancho ' + Math.round(r.width) + ')');
    });
  }
  var w = document.querySelector('.whatsapp-float');
  if (w) {
    var cs = getComputedStyle(w), r = w.getBoundingClientRect(), svg = w.querySelector('svg');
    out.whatsapp = {
      href: w.getAttribute('href'),
      posicion: cs.position,
      bottom: cs.bottom, right: cs.right,
      verde: cs.backgroundColor,
      tamano: Math.round(r.width) + 'x' + Math.round(r.height),
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
      svg_px: svg ? Math.round(svg.getBoundingClientRect().width) : null
    };
  }
  document.body.setAttribute('data-medicion', JSON.stringify(out));
});
"""

def medir(page_file, etiqueta):
    src = open(os.path.join(LIVE, page_file), encoding='utf-8').read()
    body = re.search(r'<body[^>]*>(.*)</body>', src, re.S).group(1)
    body = re.sub(r'<script.*?</script>', '', body, flags=re.S)  # sin JS de la pagina
    page = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
            '<link rel="stylesheet" href="styles.css"></head><body>' + body +
            '<script>' + SCRIPT + '</script></body></html>')
    open(os.path.join(TMP, 'm.html'), 'w', encoding='utf-8').write(page)
    url = 'file:///' + os.path.join(TMP, 'm.html').replace('\\', '/')
    p = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1400,1000',
                        '--virtual-time-budget=5000', '--dump-dom', url],
                       capture_output=True, text=True, timeout=120, errors='replace')
    m = re.search(r'data-medicion="([^"]+)"', p.stdout)
    print('\n=== ' + etiqueta + ' (LIVE) ===')
    if not m:
        print('  sin medicion. stderr:', (p.stderr or '')[:200]); return None
    d = json.loads(m.group(1).replace('&quot;', '"'))
    print('  formulario: contenedor=%spx ancho=%spx scroll=%s  ->  SE SALE: %s'
          % (d.get('contenedor'), d.get('formulario'), d.get('formulario_scroll'), d.get('se_sale')))
    print('  elementos fuera del form:', d.get('fuera_del_form') or 'ninguno')
    w = d.get('whatsapp')
    if w:
        print('  whatsapp: %s | %s | tamano=%s | fondo=%s | visible=%s | icono=%spx | bottom=%s right=%s'
              % (w['href'], w['posicion'], w['tamano'], w['verde'], w['visible'], w['svg_px'], w['bottom'], w['right']))
        print('  link correcto:', w['href'] == 'https://chat.whatsapp.com/CDzwewC5EdQHqiC5IqmpGL')
    else:
        print('  [FALTA] boton de whatsapp')
    return d

ok = True
for f, e in [('index.html', 'PAGINA PRINCIPAL'), ('anotate.html', 'FORMULARIO APARTE')]:
    d = medir(f, e)
    if not d or d.get('se_sale') or d.get('fuera_del_form') or not d.get('whatsapp') or not d['whatsapp']['visible'] or d['whatsapp']['href'] != 'https://chat.whatsapp.com/CDzwewC5EdQHqiC5IqmpGL':
        ok = False
print('\n' + ('TODO OK' if ok else 'HAY FALLOS'))
sys.exit(0 if ok else 1)
