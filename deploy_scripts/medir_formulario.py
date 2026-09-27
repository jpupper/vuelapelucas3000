"""Mide con Chrome headless si el select '¿Cómo te sumás?' se sale del formulario.
Compara la CSS vieja (la que esta en el FTP) contra la nueva (con el fix)."""
import os, re, shutil, subprocess, json, sys

PROJ = r'D:\Programacion\vuelapelucas3000'
OLD_CSS = os.path.join(os.environ['LOCALAPPDATA'], 'Temp', 'vplive', 'css', 'styles.css')  # bajada del FTP
NEW_CSS = os.path.join(PROJ, 'public', 'css', 'styles.css')
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
TMP = os.path.join(os.environ['LOCALAPPDATA'], 'Temp', 'vpmeasure')
shutil.rmtree(TMP, ignore_errors=True)
os.makedirs(TMP, exist_ok=True)

html = open(os.path.join(PROJ, 'public', 'index.html'), encoding='utf-8').read()
form = re.search(r'<form id="form-inscripcion".*?</form>', html, re.S).group(0)

page = """<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head><body>
<section class="section inscripcion-section"><div class="container">
<h2 class="section-title">T</h2>
""" + form + """
</div></section>
<script>
window.addEventListener('load', function () {
  var form = document.querySelector('.inscripcion-form');
  var cont = form.parentElement;
  var out = {
    contenedor: Math.round(cont.clientWidth),
    formulario: Math.round(form.getBoundingClientRect().width),
    formulario_scroll: form.scrollWidth,
    se_sale: form.scrollWidth > form.clientWidth + 1,
    filas: [], selects: [], fuera_del_form: []
  };
  document.querySelectorAll('.form-row').forEach(function (r) {
    out.filas.push({ clase: r.className, w: Math.round(r.getBoundingClientRect().width), scroll: r.scrollWidth });
  });
  document.querySelectorAll('.form-group select, .form-group input, .form-group textarea').forEach(function (s) {
    var r = s.getBoundingClientRect();
    var fr = form.getBoundingClientRect();
    out.selects.push({ id: s.id, w: Math.round(r.width), derecha_ok: r.right <= fr.right + 1 });
    if (r.right > fr.right + 1 || r.left < fr.left - 1) out.fuera_del_form.push(s.id);
  });
  document.body.setAttribute('data-medicion', JSON.stringify(out));
});
</script></body></html>
"""
open(os.path.join(TMP, 'measure.html'), 'w', encoding='utf-8').write(page)

def medir(css_src, etiqueta):
    shutil.copy(css_src, os.path.join(TMP, 'styles.css'))
    url = 'file:///' + os.path.join(TMP, 'measure.html').replace('\\', '/')
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1400,1000',
           '--virtual-time-budget=5000', '--dump-dom', url]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=120, errors='replace')
    m = re.search(r'data-medicion="([^"]+)"', p.stdout)
    print('\n=== ' + etiqueta + ' ===')
    if not m:
        print('  no se pudo medir. stderr:', (p.stderr or '')[:300])
        return None
    data = json.loads(m.group(1).replace('&quot;', '"'))
    print('  contenedor=%spx  formulario=%spx  scrollWidth=%s  ->  SE SALE DEL FORM: %s'
          % (data['contenedor'], data['formulario'], data['formulario_scroll'], data['se_sale']))
    for s in data['selects']:
        print('    %-28s ancho=%spx  entra en el form: %s' % (s['id'], s['w'], s['derecha_ok']))
    if data['fuera_del_form']:
        print('  elementos que se salen:', data['fuera_del_form'])
    return data

old = medir(OLD_CSS, 'CSS VIEJA (la que estaba en el FTP)')
new = medir(NEW_CSS, 'CSS NUEVA (con el fix)')
print('\nRESULTADO:', end=' ')
if old and new:
    print('antes se salia=%s  ->  ahora se sale=%s' % (old['se_sale'], new['se_sale']))
    sys.exit(0 if (old['se_sale'] and not new['se_sale']) else 1)
sys.exit(1)
