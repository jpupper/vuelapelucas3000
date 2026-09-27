"""Mide con Chrome headless si la columna Accion del admin queda visible o recortada.
Compara el admin VIEJO (overflow:hidden, sin columna fija) contra el deployado."""
import os, re, shutil, subprocess, json, sys, urllib.request

PROJ = r'D:\Programacion\vuelapelucas3000'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
TMP = os.path.join(os.environ['LOCALAPPDATA'], 'Temp', 'vpadmin')
shutil.rmtree(TMP, ignore_errors=True)
os.makedirs(TMP, exist_ok=True)

NUEVO = open(os.path.join(PROJ, 'public', 'admin.html'), encoding='utf-8').read()

# --- reconstruyo el "antes": CSS con overflow:hidden y sin columna sticky ---
VIEJO = NUEVO.replace('overflow-x: auto;\n            overflow-y: visible;', 'overflow: hidden;')
VIEJO = VIEJO.replace('th.col-accion, td.col-accion {', '.col-accion-desactivado {')
VIEJO = VIEJO.replace('th.col-accion { background: #3a2318; z-index: 3; }', '')
VIEJO = VIEJO.replace('tr:hover td.col-accion { background: #1d1d33; }', '')

INJECT = """
<script>
window.addEventListener('load', function () {
  // datos de prueba con textos largos (peor caso)
  const filas = [1,2,3].map(function (n) {
    return {
      _id: 'id' + n, nombre: 'Nombre' + n, apellido: 'Apellido' + n,
      email: 'persona' + n + '@ejemplo.com.ar', telefono: '2954-123456',
      ciudad: 'Santa Rosa, La Pampa', rol: 'instalacion_multimedia',
      como_colaborar: 'Quiero armar una instalacion interactiva con sensores y proyeccion',
      especificaciones_tecnicas: 'Necesito 2 proyectores de 5000 lumens, pantalla de 3x2 m, electricidad 220v y mesa',
      hospedaje: 'camping', createdAt: new Date().toISOString()
    };
  });
  window.fetch = function () {
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ success: true, count: filas.length, inscripciones: filas }); } });
  };
  document.getElementById('admin-pass').value = 'test';
  login().then(function () {
    var cont = document.querySelector('.table-container');
    var tabla = document.querySelector('table');
    var btn = document.querySelector('.delete-btn') || document.querySelector('td.col-accion');
    var out = {
      contenedor_ancho: Math.round(cont.clientWidth),
      contenedor_scroll: cont.scrollWidth,
      tabla_ancho: Math.round(tabla.getBoundingClientRect().width),
      se_puede_scrollear: cont.scrollWidth > cont.clientWidth + 1,
      overflow_css: getComputedStyle(cont).overflowX,
      filas: document.querySelectorAll('#inscripciones-body tr').length
    };
    if (btn) {
      var rb = btn.getBoundingClientRect(), rc = cont.getBoundingClientRect();
      out.boton = {
        existe: true, ancho: Math.round(rb.width), alto: Math.round(rb.height),
        borde_derecho_boton: Math.round(rb.right),
        borde_derecho_contenedor: Math.round(rc.right),
        visible_sin_scrollear: rb.right <= rc.right + 1 && rb.left >= rc.left - 1 && rb.width > 0,
        dentro_del_documento: rb.right <= window.innerWidth + 1
      };
    } else { out.boton = { existe: false }; }
    document.body.setAttribute('data-medicion', JSON.stringify(out));
  });
});
</script>
"""

def medir(html, etiqueta):
    open(os.path.join(TMP, 'a.html'), 'w', encoding='utf-8').write(html.replace('</body>', INJECT + '</body>'))
    url = 'file:///' + os.path.join(TMP, 'a.html').replace('\\', '/')
    p = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1400,1000',
                        '--virtual-time-budget=6000', '--dump-dom', url],
                       capture_output=True, text=True, timeout=150, errors='replace')
    m = re.search(r'data-medicion="([^"]+)"', p.stdout)
    print('\n=== ' + etiqueta + ' ===')
    if not m:
        print('  sin medicion. stderr:', (p.stderr or '')[:200]); return None
    d = json.loads(m.group(1).replace('&quot;', '"'))
    print('  overflow-x: %s | contenedor=%spx scroll=%spx tabla=%spx | filas=%s'
          % (d['overflow_css'], d['contenedor_ancho'], d['contenedor_scroll'], d['tabla_ancho'], d['filas']))
    b = d['boton']
    if b['existe']:
        print('  boton Accion: %sx%s px | borde derecho boton=%s vs contenedor=%s | VISIBLE sin scrollear: %s'
              % (b['ancho'], b['alto'], b['borde_derecho_boton'], b['borde_derecho_contenedor'], b['visible_sin_scrollear']))
    else:
        print('  [FALTA] no se encontro ni el boton ni la celda de accion')
    return d

viejo = medir(VIEJO, 'ADMIN VIEJO (overflow:hidden)')
nuevo = medir(NUEVO, 'ADMIN DEPLOYADO (fix)')

ok = bool(nuevo and nuevo['boton']['existe'] and nuevo['boton']['visible_sin_scrollear'] and nuevo['filas'] == 3)
print('\nANTES visible=%s  ->  AHORA visible=%s' % (viejo['boton']['visible_sin_scrollear'] if viejo else '?', nuevo['boton']['visible_sin_scrollear'] if nuevo else '?'))
print('RESULTADO:', 'OK' if ok else 'FALLOS')
sys.exit(0 if ok else 1)
