// ============================================================
// RIFA DEL VUELAPELUCAS 3000 — cartón de números + premios
// ------------------------------------------------------------
// La API vive en el mismo dominio pero proxeada por nginx en
// /apivuelapelucas/ (así se evitan los problemas de x-frame / mixto).
// La sesión JPCONNECT se lee del localStorage que deja el login del
// ecosistema (token/username/userId) y el SERVIDOR la verifica contra
// fscauth: acá sólo se manda el Bearer, nunca se decide la identidad.
// ============================================================
(function () {
  'use strict';

  // La API vive en el VPS (mismo criterio que PanchoDraw). En producción nginx
  // también la proxea en /apivuelapelucas/, así que si esa ruta responde se usa
  // (mismo origen) y si no se va directo al backend.
  var API_LOCAL = '/apivuelapelucas/api';
  var API_DIRECTA = 'https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api';
  var IS_LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API = IS_LOCAL ? (location.origin + '/vuelapelucas3000_2/api') : API_LOCAL;
  var apiResuelta = null;

  // prueba una vez qué base responde y la cachea
  function apiBase() {
    if (apiResuelta) return Promise.resolve(apiResuelta);
    return fetch(API + '/rifa', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('status ' + r.status)); })
      .then(function (d) { if (!d || !d.ok) throw new Error('sin ok'); apiResuelta = API; return apiResuelta; })
      .catch(function () {
        if (IS_LOCAL) throw new Error('api local caída');
        return fetch(API_DIRECTA + '/rifa', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('status ' + r.status)); })
          .then(function (d) {
            if (!d || !d.ok) throw new Error('sin ok');
            apiResuelta = API_DIRECTA;
            return apiResuelta;
          });
      });
  }
  var FSC_LOGIN = 'https://fullscreencode.com/jpconnect/login.html?redirect=' +
    encodeURIComponent(location.origin + location.pathname) + '&origin=vuelapelucas';

  var estado = {
    total: 100,
    ocupados: {},          // numero -> true
    seleccion: [],         // números elegidos
    premios: [],
    abierta: true
  };

  function $(id) { return document.getElementById(id); }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sesion() {
    var t = ls('token'), u = ls('username');
    return (t && u) ? { token: t, username: u, userId: ls('userId') } : null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function msg(el, txt, tipo) {
    if (!el) return;
    el.className = 'rifa-msg' + (tipo ? ' is-' + tipo : '');
    el.innerHTML = txt;
  }
  function headers(conJson) {
    var h = conJson ? { 'Content-Type': 'application/json' } : {};
    var s = sesion();
    if (s) h['Authorization'] = 'Bearer ' + s.token;
    return h;
  }

  // ---------- estado de la rifa ----------
  function cargarRifa() {
    return apiBase().then(function (base) { return fetch(base + '/rifa', { cache: 'no-store' }); })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.ok) throw new Error('sin datos');
        estado.total = d.total;
        estado.abierta = d.abierta !== false;
        estado.ocupados = {};
        (d.ocupados || []).forEach(function (n) { estado.ocupados[n] = true; });
        $('statTotal').textContent = d.total;
        $('statVendidos').textContent = d.vendidos;
        $('statDisponibles').textContent = d.disponibles;
        $('statPremios').textContent = d.premios || 0;

        var partes = ['Se sortea el último día del festival.'];
        if (d.cierre) partes.push('Fecha del sorteo: ' + d.cierre + '.');
        if (d.precio) partes.push('Valor del número: ' + d.precio + '.');
        if (d.info) partes.push(d.info);
        if (d.abierta === false) partes.push('La rifa está cerrada por ahora.');
        $('rifaLead').textContent = partes.join(' ');

        // sacar de la selección los que se vendieron mientras tanto
        estado.seleccion = estado.seleccion.filter(function (n) { return !estado.ocupados[n]; });
        pintarCarton();
        pintarSeleccion();
        return d;
      })
      .catch(function () {
        $('rifaLead').textContent = 'No se pudo cargar la rifa. Probá recargar la página en un rato.';
      });
  }

  // ---------- cartón ----------
  function pintarCarton() {
    var cont = $('cartonGrid');
    if (!cont) return;
    var html = [];
    for (var n = 1; n <= estado.total; n++) {
      var vendido = !!estado.ocupados[n];
      var mio = estado.seleccion.indexOf(n) >= 0;
      var cls = 'num' + (vendido ? ' is-vendido' : '') + (mio ? ' is-mio' : '');
      html.push('<div class="' + cls + '" data-n="' + n + '" role="button" tabindex="0" ' +
        'aria-label="Número ' + n + (vendido ? ' vendido' : ' libre') + '">' + n + '</div>');
    }
    cont.innerHTML = html.join('');
  }

  function pintarSeleccion() {
    var n = estado.seleccion.length;
    var placas = n === 1 ? 'número elegido' : 'números elegidos';
    $('selCount').textContent = n + ' ' + placas;
    var chips = $('selChips');
    if (!n) {
      chips.innerHTML = '<span class="carton-empty">Todavía no elegiste ninguno.</span>';
    } else {
      chips.innerHTML = estado.seleccion.slice().sort(function (a, b) { return a - b; }).map(function (x) {
        return '<button type="button" class="chip" data-quitar="' + x + '">' + x + ' <span>✕</span></button>';
      }).join('');
    }
    $('btnComprar').disabled = !n || !estado.abierta;
    $('btnComprar').textContent = estado.abierta ? 'COMPRAR TU RIFA' : 'RIFA CERRADA';
  }

  function alternar(n) {
    n = parseInt(n, 10);
    if (!n || n < 1 || n > estado.total) return;
    if (estado.ocupados[n]) return;                 // vendido: no se puede elegir
    var i = estado.seleccion.indexOf(n);
    if (i >= 0) estado.seleccion.splice(i, 1);
    else {
      if (estado.seleccion.length >= 50) {
        msg($('cartonMsg'), 'Máximo 50 números por compra.', 'err');
        return;
      }
      estado.seleccion.push(n);
    }
    pintarCarton();
    pintarSeleccion();
    msg($('cartonMsg'), '');
  }

  // ---------- compra ----------
  function comprar() {
    var btn = $('btnComprar');
    if (!estado.seleccion.length) { msg($('cartonMsg'), 'Elegí al menos un número.', 'err'); return; }
    var nombre = ($('compNombre').value || '').replace(/\s+/g, ' ').trim();
    if (!nombre) { msg($('cartonMsg'), 'Escribí tu nombre para reservar los números.', 'err'); $('compNombre').focus(); return; }

    btn.disabled = true;
    msg($('cartonMsg'), 'Guardando tus números…', 'info');

    apiBase().then(function (base) { return fetch(base + '/rifa/numeros', {
      method: 'POST',
      headers: headers(true),
      credentials: 'include',
      body: JSON.stringify({
        numeros: estado.seleccion,
        comprador: nombre,
        telefono: ($('compTel').value || '').trim(),
        email: ($('compEmail').value || '').trim(),
        nota: ($('compNota').value || '').trim()
      })
    }); }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          if (res.d && res.d.tomados) {
            res.d.tomados.forEach(function (n) { estado.ocupados[n] = true; });
            estado.seleccion = estado.seleccion.filter(function (n) { return res.d.tomados.indexOf(n) < 0; });
            pintarCarton(); pintarSeleccion();
            msg($('cartonMsg'), 'Estos ya estaban tomados: <b>' + res.d.tomados.join(', ') + '</b>. Elegí otros.', 'err');
          } else {
            msg($('cartonMsg'), (res.d && res.d.error) ? esc(res.d.error) : 'No se pudo guardar.', 'err');
            btn.disabled = false;
          }
          return;
        }
        var nums = res.d.numeros || [];
        nums.forEach(function (n) { estado.ocupados[n] = true; });
        estado.seleccion = [];
        pintarCarton(); pintarSeleccion();
        estado.abierta = true;
        msg($('cartonMsg'), '✓ ¡Listo! Tus números: <b>' + nums.join(', ') + '</b>. Guardá este comprobante.', 'ok');
        cargarRifa();
        cargarPremios();
      })
      .catch(function () {
        msg($('cartonMsg'), 'No se pudo conectar. Revisá tu conexión e intentá de nuevo.', 'err');
        btn.disabled = false;
      });
  }

  // ---------- premios ----------
  function cargarPremios() {
    apiBase().then(function (base) { return fetch(base + '/rifa/premios', { cache: 'no-store' }); })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        estado.premios = (d && d.premios) || [];
        pintarPremios();
        $('statPremios').textContent = estado.premios.length;
      })
      .catch(function () {
        $('premiosGrid').innerHTML = '<p class="rifa-vacio">No se pudieron cargar los premios.</p>';
      });
  }

  function pintarPremios() {
    var cont = $('premiosGrid');
    if (!estado.premios.length) {
      cont.innerHTML = '<p class="rifa-vacio">Todavía no hay premios anotados. ¡Podés ser el primero!</p>';
      return;
    }
    cont.innerHTML = estado.premios.map(function (p) {
      var img = p.tieneImagen
        ? '<img src="' + API + '/rifa/premios/' + encodeURIComponent(p.id) + '/img" alt="' + esc(p.titulo) + '" loading="lazy">'
        : '<span class="sin-foto">SIN FOTO</span>';
      var quien = p.username ? '@' + esc(p.username) : esc(p.ofrecidoPor || 'Comunidad');
      var tag = (p.numeroGanador != null)
        ? '<span class="premio-tag ganador">GANADOR N° ' + p.numeroGanador + '</span>'
        : '';
      return '<article class="premio-card">' +
        '<div class="premio-card-img">' + img + '</div>' +
        '<div class="premio-card-body">' +
          '<h3>' + esc(p.titulo) + '</h3>' +
          (p.descripcion ? '<p>' + esc(p.descripcion) + '</p>' : '') +
          '<div class="quien">' + quien + tag + '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  // ---------- sesión JPCONNECT ----------
  function pintarSesion() {
    var s = sesion();
    var txt = $('cartonFscTxt'), btn = $('btnFscCarton');
    if (s) {
      txt.innerHTML = '● Sesión JPCONNECT: <b>@' + esc(s.username) + '</b> — tus números quedan en tu cuenta.';
      $('cartonFsc').className = 'carton-fsc is-on';
      btn.textContent = 'CAMBIAR DE CUENTA';
    } else {
      txt.innerHTML = '◌ Sin sesión JPCONNECT: tus números quedan con el nombre que escribas.';
      $('cartonFsc').className = 'carton-fsc';
      btn.textContent = 'ENTRAR CON JPCONNECT';
    }

    var pf = $('premioFsc');
    if (s) {
      pf.className = 'premio-fsc is-on';
      $('premioFscUser').textContent = '@' + s.username;
      $('premioFscSub').textContent = 'Tu premio queda vinculado a esta cuenta y se publica al instante.';
      $('btnFscPremio').textContent = 'CAMBIAR';
      if (!$('prNombre').value) $('prNombre').value = s.username;
    } else {
      pf.className = 'premio-fsc';
      $('premioFscUser').textContent = 'Sin sesión';
      $('premioFscSub').textContent = 'Entrá con JPCONNECT para que el premio figure a tu nombre de usuario.';
      $('btnFscPremio').textContent = 'ENTRAR';
    }
  }

  function irALogin() { location.href = FSC_LOGIN; }

  // Captura el retorno del SSO (?token=&username=), igual que PanchoDraw.
  function capturarRetorno() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var tok = q.get('token'), usr = q.get('username');
    if (!tok || !usr) return;
    try {
      localStorage.setItem('token', tok);
      localStorage.setItem('username', usr);
      if (q.get('userId')) localStorage.setItem('userId', q.get('userId'));
      if (q.get('role')) localStorage.setItem('role', q.get('role'));
    } catch (e) {}
    ['token', 'username', 'userId', 'role', 'ssoset'].forEach(function (k) { q.delete(k); });
    var resto = q.toString();
    try { history.replaceState({}, document.title, location.pathname + (resto ? '?' + resto : '')); } catch (e) {}
    msg($('cartonMsg'), '✓ Entraste con JPCONNECT.', 'ok');
  }

  // ---------- formulario de premio ----------
  var fotoData = '';

  function leerFoto(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      msg($('premioMsg'), 'La foto no puede pasar los 8 MB.', 'err');
      $('prFoto').value = '';
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      // se achica en el navegador: la API guarda hasta 8 MB y así anda en 3G
      var img = new Image();
      img.onload = function () {
        var max = 1100;
        var w = img.width, h = img.height;
        if (w > max || h > max) {
          var k = Math.min(max / w, max / h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        fotoData = c.toDataURL('image/jpeg', 0.85);
        $('prPreviewImg').src = fotoData;
        $('prPreview').hidden = false;
      };
      img.onerror = function () { msg($('premioMsg'), 'No pudimos leer esa imagen.', 'err'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function enviarPremio() {
    var btn = $('btnEnviarPremio');
    var titulo = ($('prTitulo').value || '').replace(/\s+/g, ' ').trim();
    var nombre = ($('prNombre').value || '').replace(/\s+/g, ' ').trim();
    if (!titulo) { msg($('premioMsg'), 'Contanos qué premio ofrecés.', 'err'); $('prTitulo').focus(); return; }
    if (!nombre) { msg($('premioMsg'), 'Escribí cómo querés figurar.', 'err'); $('prNombre').focus(); return; }

    btn.disabled = true;
    msg($('premioMsg'), 'Enviando tu premio…', 'info');

    apiBase().then(function (base) { return fetch(base + '/rifa/premios', {
      method: 'POST',
      headers: headers(true),
      credentials: 'include',
      body: JSON.stringify({
        titulo: titulo,
        descripcion: ($('prDesc').value || '').trim(),
        ofrecidoPor: nombre,
        contacto: ($('prContacto').value || '').trim(),
        image: fotoData
      })
    }); }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          msg($('premioMsg'), (res.d && res.d.error) ? esc(res.d.error) : 'No se pudo guardar el premio.', 'err');
          btn.disabled = false;
          return;
        }
        msg($('premioMsg'), '✓ ' + esc(res.d.message || 'Premio anotado') +
          (res.d.username ? ' — vinculado a <b>@' + esc(res.d.username) + '</b>' : '') + '.', 'ok');
        $('prTitulo').value = ''; $('prDesc').value = ''; $('prContacto').value = '';
        fotoData = '';
        $('prPreview').hidden = true; $('prFoto').value = '';
        btn.disabled = false;
        cargarPremios();
        cargarRifa();
      })
      .catch(function () {
        msg($('premioMsg'), 'No se pudo conectar. Intentá de nuevo.', 'err');
        btn.disabled = false;
      });
  }

  // ---------- eventos ----------
  function init() {
    capturarRetorno();

    var grid = $('cartonGrid');
    grid.addEventListener('click', function (e) {
      var cel = e.target.closest ? e.target.closest('.num') : null;
      if (cel) alternar(cel.getAttribute('data-n'));
    });
    grid.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var cel = e.target.closest ? e.target.closest('.num') : null;
      if (cel) { e.preventDefault(); alternar(cel.getAttribute('data-n')); }
    });

    $('selChips').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-quitar]') : null;
      if (b) alternar(b.getAttribute('data-quitar'));
    });
    $('btnLimpiarSel').addEventListener('click', function () {
      estado.seleccion = [];
      pintarCarton(); pintarSeleccion(); msg($('cartonMsg'), '');
    });
    $('btnAgregarNumero').addEventListener('click', function () {
      var v = parseInt($('numManual').value, 10);
      if (!v || v < 1 || v > estado.total) { msg($('cartonMsg'), 'Ese número no existe en la rifa.', 'err'); return; }
      if (estado.ocupados[v]) { msg($('cartonMsg'), 'El ' + v + ' ya está vendido.', 'err'); return; }
      if (estado.seleccion.indexOf(v) < 0) { estado.seleccion.push(v); pintarCarton(); pintarSeleccion(); }
      $('numManual').value = '';
    });
    $('numManual').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('btnAgregarNumero').click(); }
    });
    $('btnRandom').addEventListener('click', function () {
      var libres = [];
      for (var n = 1; n <= estado.total; n++) if (!estado.ocupados[n]) libres.push(n);
      if (!libres.length) { msg($('cartonMsg'), 'No quedan números libres.', 'err'); return; }
      var pick = libres[Math.floor(Math.random() * libres.length)];
      if (estado.seleccion.indexOf(pick) < 0) { estado.seleccion.push(pick); pintarCarton(); pintarSeleccion(); }
      msg($('cartonMsg'), 'Te tocó el <b>' + pick + '</b>.', 'info');
    });
    $('btnComprar').addEventListener('click', comprar);
    $('btnFscCarton').addEventListener('click', irALogin);
    $('btnFscPremio').addEventListener('click', irALogin);
    $('prFoto').addEventListener('change', function (e) { leerFoto(e.target.files && e.target.files[0]); });
    $('btnQuitarFoto').addEventListener('click', function () {
      fotoData = ''; $('prFoto').value = '';
      $('prPreview').hidden = true;
    });
    $('btnEnviarPremio').addEventListener('click', enviarPremio);

    pintarSesion();
    cargarRifa().then(cargarPremios);
    // si vuelve de otra pestaña habiendo entrado, se actualiza
    window.addEventListener('focus', pintarSesion);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
