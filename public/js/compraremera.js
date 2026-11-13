// ============================================================
// COMPRAR REMERA — Vuelapelucas 3000
// ------------------------------------------------------------
// 1) Lee el catálogo de la API (/remeras): modelos, precios y ajustes.
// 2) Arma el pedido y lo guarda en el server (POST /compras).
// 3) Abre WhatsApp con el mensaje ya escrito para el número configurado.
//
// El comprobante es OPCIONAL: si no lo suben, el pedido se guarda igual.
// El precio y el número de WhatsApp los manda el servidor: acá no se
// inventan (el cliente nunca decide cuánto sale la remera).
// ============================================================
(function () {
  'use strict';

  var API_LOCAL = '/apivuelapelucas/api';
  var API_DIRECTA = 'https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api';
  var IS_LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API = IS_LOCAL ? (location.origin + '/vuelapelucas3000_2/api') : API_LOCAL;
  var apiResuelta = null;

  // Catálogo de respaldo: si la API no contesta, la página no queda vacía.
  var RESPALDO = [
    { nombre: 'REMERA X FASOLITO', archivo: 'img/remeras/remera-fasolito.webp' },
    { nombre: 'REMERA X JUANITO', archivo: 'img/remeras/remera-juanito.webp' },
    { nombre: 'REMERA X PAM! PAM!', archivo: 'img/remeras/remera-pam.webp' },
    { nombre: 'REMERA X PANCHO DEL PUEBLO', archivo: 'img/remeras/remera-pancho.webp' },
    { nombre: 'REMERA X JPUPPER', archivo: 'img/remeras/remera-pupper.webp' }
  ];

  // Sugerencias de sucursales (se puede escribir cualquier otra).
  var SUCURSALES = [
    'Correo Argentino Victorica (La Pampa)',
    'Correo Argentino Santa Rosa (La Pampa)',
    'Correo Argentino General Pico (La Pampa)',
    'Correo Argentino Eduardo Castex (La Pampa)',
    'Correo Argentino Realicó (La Pampa)',
    'Correo Argentino Santa Isabel (La Pampa)',
    'Correo Argentino General Acha (La Pampa)',
    'Correo Argentino 25 de Mayo (La Pampa)',
    'Correo Argentino Telén (La Pampa)',
    'Correo Argentino Loventuel (La Pampa)',
    'Correo Argentino Luan Toro (La Pampa)',
    'Correo Argentino Toay (La Pampa)',
    'Correo Argentino Colonia Barón (La Pampa)',
    'Correo Argentino Quemú Quemú (La Pampa)',
    'Correo Argentino Macachín (La Pampa)',
    'Correo Argentino Guatraché (La Pampa)',
    'Correo Argentino Ingeniero Luiggi (La Pampa)',
    'Correo Argentino Intendente Alvear (La Pampa)',
    'Correo Argentino Trenel (La Pampa)',
    'Correo Argentino Winifreda (La Pampa)',
    'Correo Argentino Alta Italia (La Pampa)',
    'Correo Argentino Embajador Martini (La Pampa)',
    'Correo Argentino Bernasconi (La Pampa)',
    'Correo Argentino Jacinto Arauz (La Pampa)',
    'Correo Argentino Miguel Riglos (La Pampa)',
    'Correo Argentino Doblas (La Pampa)',
    'Correo Argentino Ataliva Roca (La Pampa)',
    'Correo Argentino Caleufú (La Pampa)',
    'Correo Argentino Parera (La Pampa)',
    'Correo Argentino Rancul (La Pampa)'
  ];

  var estado = {
    remeras: [],
    precio: 50000,
    whatsapp: '2954541104',
    abierta: true,
    sel: null,        // { id, nombre, precio }
    talle: '',
    comprobante: '',  // data URL opcional
    enviando: false,
    mensaje: ''
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plata(n) {
    var v = Number(n) || 0;
    return '$' + v.toLocaleString('es-AR');
  }
  function params() {
    var o = {};
    try {
      new URLSearchParams(location.search).forEach(function (v, k) { o[k] = v; });
    } catch (e) { /* nada */ }
    return o;
  }

  function apiBase() {
    if (apiResuelta) return Promise.resolve(apiResuelta);
    return fetch(API + '/remeras', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('status ' + r.status)); })
      .then(function (d) { if (!d || !d.ok) throw new Error('sin ok'); apiResuelta = API; return apiResuelta; })
      .catch(function () {
        if (IS_LOCAL) throw new Error('api local caída');
        return fetch(API_DIRECTA + '/remeras', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('status ' + r.status)); })
          .then(function (d) {
            if (!d || !d.ok) throw new Error('sin ok');
            apiResuelta = API_DIRECTA;
            return apiResuelta;
          });
      });
  }

  // ---------- mensajes en pantalla (nunca alert/confirm/prompt) ----------
  function aviso(texto, ok) {
    var m = $('remMsg');
    m.textContent = texto || '';
    m.className = 'rem-msg' + (texto ? ' is-on' : '') + (ok ? ' ok' : '');
  }

  // ============================================================
  // MAPITA DE SUCURSALES DE CORREO ARGENTINO
  // ------------------------------------------------------------
  // data/sucursales-correo.json son 879 sucursales con coordenadas (salen
  // de OpenStreetMap, tools/build_sucursales.js). Se lee la ubicación del
  // navegador, se calculan las distancias y se marcan las más cercanas en
  // un mapa Leaflet. Sin permiso de ubicación (o sin Leaflet) la lista por
  // distancia sigue andando y el campo se puede escribir a mano.
  // ============================================================
  var sucursales = null;
  var miPos = null;
  var mapa = null;
  var capaMarcas = null;
  var cercaActual = [];

  function cargarSucursales() {
    if (sucursales) return Promise.resolve(sucursales);
    return fetch('data/sucursales-correo.json', { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('status ' + r.status)); })
      .then(function (d) {
        sucursales = (d && d.sucursales) || [];
        return sucursales;
      });
  }

  function distanciaKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLon = (b.lng - a.lng) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function kmTxt(km) {
    if (km < 1) return Math.round(km * 1000) + ' m';
    return km.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' km';
  }

  function nombreSucursal(s) {
    return 'Correo Argentino ' + (s.c || 'sucursal');
  }

  function detalleSucursal(s) {
    return [s.d, s.p].filter(Boolean).join(' · ');
  }

  function estadoUbic(txt) { $('remUbicEstado').textContent = txt; }

  function seleccionarSucursal(s) {
    var valor = (nombreSucursal(s) + (s.d ? ' (' + s.d + ')' : '')).slice(0, 120);
    $('remSucursal').value = valor;
    $('remSucursal').classList.remove('rem-falta');
    $('remCercanas').querySelectorAll('.rem-cercana').forEach(function (b) {
      b.classList.toggle('is-sel', cercaActual[Number(b.dataset.i)] === s);
    });
    estadoUbic('Elegiste: ' + valor + (s._km != null ? ' — a ' + kmTxt(s._km) : '') + '.');
  }

  function pintarCercanas(cerca) {
    var cont = $('remCercanas');
    if (!cerca.length) {
      cont.innerHTML = '<p class="rem-cercanas-vacio">No encontramos sucursales cerca.</p>';
      return;
    }
    cont.innerHTML = cerca.map(function (s, i) {
      var det = detalleSucursal(s);
      return '<button type="button" class="rem-cercana" data-i="' + i + '">' +
        '<span><b>' + esc(nombreSucursal(s)) + '</b>' + (i === 0 ? ' <small>(la más cercana)</small>' : '') +
        (det ? '<span class="dir">' + esc(det) + '</span>' : '') + '</span>' +
        '<span class="km">' + kmTxt(s._km) + '</span></button>';
    }).join('');
    cont.querySelectorAll('.rem-cercana').forEach(function (b) {
      b.addEventListener('click', function () { seleccionarSucursal(cerca[Number(b.dataset.i)]); });
    });
  }

  function pintarMapa(yo, cerca) {
    var cont = $('remMapa');
    if (typeof L === 'undefined') { cont.hidden = true; return; }
    cont.hidden = false;
    if (!mapa) {
      mapa = L.map(cont, { scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap'
      }).addTo(mapa);
      capaMarcas = L.layerGroup().addTo(mapa);
    }
    capaMarcas.clearLayers();
    var pts = [[yo.lat, yo.lng]];
    cerca.forEach(function (s) {
      var m = L.circleMarker([s.y, s.x], { radius: 8, color: '#000', weight: 3, fillColor: '#ffd62c', fillOpacity: 1 })
        .addTo(capaMarcas)
        .bindTooltip(nombreSucursal(s) + ' · ' + kmTxt(s._km));
      m.on('click', function () { seleccionarSucursal(s); });
      pts.push([s.y, s.x]);
    });
    // "estás acá" va ÚLTIMO para que no lo tape la sucursal que tiene al lado
    L.circleMarker([yo.lat, yo.lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#2247ff', fillOpacity: 1 })
      .addTo(capaMarcas).bindTooltip('Estás acá');
    mapa.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
    setTimeout(function () { mapa.invalidateSize(); }, 250);
  }

  function ubicar() {
    var btn = $('remUbicar');
    if (!navigator.geolocation) {
      estadoUbic('Tu navegador no comparte la ubicación. Escribí la sucursal a mano.');
      return;
    }
    btn.disabled = true;
    estadoUbic('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(function (pos) {
      miPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      cargarSucursales().then(function (lista) {
        var ordenadas = lista.map(function (s) {
          s._km = distanciaKm(miPos, { lat: s.y, lng: s.x });
          return s;
        }).sort(function (a, b) { return a._km - b._km; });
        cercaActual = ordenadas.slice(0, 6);
        pintarCercanas(cercaActual);
        pintarMapa(miPos, cercaActual);
        estadoUbic('La más cercana: ' + nombreSucursal(cercaActual[0]) + ' — a ' +
          kmTxt(cercaActual[0]._km) + '. Tocá una para elegirla.');
        btn.disabled = false;
      }).catch(function () {
        estadoUbic('No pudimos cargar la lista de sucursales. Escribila a mano.');
        btn.disabled = false;
      });
    }, function (err) {
      btn.disabled = false;
      estadoUbic(err && err.code === 1
        ? 'No diste permiso de ubicación. Escribí la sucursal a mano.'
        : 'No pudimos leer tu ubicación. Escribí la sucursal a mano.');
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }

  // ============================================================
  // CATÁLOGO
  // ============================================================
  function pintarRemeras() {
    var g = $('remGrid');
    if (!estado.remeras.length) {
      g.innerHTML = '<p class="rem-vacio">Todavía no hay remeras cargadas. Escribinos al ' +
        esc(estado.whatsapp) + '.</p>';
      return;
    }
    g.innerHTML = estado.remeras.map(function (r) {
      var img = r.archivo ? r.archivo : (apiResuelta || API) + '/remeras/' + r.id + '/img';
      return '<button type="button" class="rem-card' + (estado.sel && estado.sel.nombre === r.nombre ? ' is-sel' : '') +
        '" data-nombre="' + esc(r.nombre) + '" data-id="' + esc(r.id || '') + '" data-precio="' + (r.precio || estado.precio) + '">' +
        '<span class="rem-card-foto"><img src="' + esc(img) + '" alt="' + esc(r.nombre) + '" loading="lazy"></span>' +
        '<span class="rem-card-info">' +
        '<span class="rem-card-nombre">' + esc(r.nombre) + '</span>' +
        '<span class="rem-card-precio">' + plata(r.precio || estado.precio) + '</span>' +
        (r.descripcion ? '<span class="rem-card-desc">' + esc(r.descripcion) + '</span>' : '') +
        '</span></button>';
    }).join('');

    g.querySelectorAll('.rem-card').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.sel = {
          id: b.dataset.id || '',
          nombre: b.dataset.nombre || '',
          precio: Number(b.dataset.precio) || estado.precio
        };
        g.querySelectorAll('.rem-card').forEach(function (x) { x.classList.remove('is-sel'); });
        b.classList.add('is-sel');
        pintarResumen();
        aviso('');
      });
    });
  }

  function pintarTalles() {
    var cont = $('remTalles');
    var talles = estado.talles || ['S', 'M', 'L', 'XL', 'XXL'];
    cont.innerHTML = talles.map(function (t) {
      return '<button type="button" class="rem-talle' + (estado.talle === t ? ' is-sel' : '') +
        '" data-talle="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    cont.querySelectorAll('.rem-talle').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.talle = b.dataset.talle;
        cont.querySelectorAll('.rem-talle').forEach(function (x) { x.classList.remove('is-sel'); });
        b.classList.add('is-sel');
        pintarResumen();
        aviso('');
      });
    });
  }

  function pintarResumen() {
    $('remSelNombre').textContent = estado.sel ? estado.sel.nombre : '—';
    $('remSelTalle').textContent = estado.talle || '—';
    var precio = estado.sel ? (estado.sel.precio || estado.precio) : estado.precio;
    $('remSelPrecio').textContent = plata(precio);
  }

  function pintarSucursales() {
    $('remSucursales').innerHTML = SUCURSALES.map(function (s) {
      return '<option value="' + esc(s) + '"></option>';
    }).join('');
  }

  function cargarCatalogo() {
    return apiBase()
      .then(function (base) {
        return fetch(base + '/remeras', { cache: 'no-store' }).then(function (r) { return r.json(); });
      })
      .then(function (d) {
        if (!d || !d.ok) throw new Error('respuesta inválida');
        estado.precio = d.precio || 50000;
        estado.whatsapp = d.whatsapp || estado.whatsapp;
        estado.talles = d.talles || null;
        estado.abierta = d.abierta !== false;
        estado.remeras = (d.remeras || []).map(function (r) {
          return { id: r.id, nombre: r.nombre, descripcion: r.descripcion || '', precio: r.precio || estado.precio };
        });
        $('remLead').innerHTML = 'Remeras del Vuelapelucas 3000. <b>' + plata(estado.precio) +
          '</b> cada una. Elegís modelo y talle, y te la mandamos a la sucursal de Correo Argentino que quieras.';
        $('remFine').innerHTML = 'Guardamos tu pedido y se abre WhatsApp con el mensaje ya escrito para el <b>' +
          esc(estado.whatsapp) + '</b>. El comprobante de pago es opcional: si todavía no lo tenés, lo mandás después por WhatsApp.';
        if (!estado.abierta) {
          $('remBtnComprar').disabled = true;
          aviso('Las compras están cerradas por ahora. Escribinos al ' + estado.whatsapp + '.');
        }
      })
      .catch(function (e) {
        console.warn('[REMERAS] catálogo:', e.message);
        // Respaldo: se muestran los modelos con el precio de lista.
        estado.remeras = RESPALDO.map(function (r) {
          return { id: '', nombre: r.nombre, descripcion: '', precio: estado.precio, archivo: r.archivo };
        });
        aviso('No pudimos leer los precios del servidor. Igual podés mandar el pedido por WhatsApp.');
      });
  }

  // ============================================================
  // COMPROBANTE (opcional)
  // ============================================================
  // Reduce la imagen en el navegador: el tráfico del festival es móvil.
  function achicar(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('no se pudo leer el archivo')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { resolve(String(fr.result)); }; // si no abre, se manda tal cual
        img.onload = function () {
          var max = 1200;
          var w = img.width, h = img.height;
          var k = Math.min(1, max / Math.max(w, h));
          var cw = Math.round(w * k), ch = Math.round(h * k);
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          var out = '';
          try { out = cv.toDataURL('image/webp', 0.85); } catch (e) { out = ''; }
          if (!out || out.indexOf('data:image/webp') !== 0) {
            try { out = cv.toDataURL('image/jpeg', 0.85); } catch (e2) { out = String(fr.result); }
          }
          resolve(out);
        };
        img.src = String(fr.result);
      };
      fr.readAsDataURL(file);
    });
  }

  function engancharComprobante() {
    $('remComprobante').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        aviso('El comprobante tiene que ser una imagen (foto o captura).');
        e.target.value = '';
        return;
      }
      aviso('Preparando el comprobante…');
      achicar(f).then(function (dataUrl) {
        estado.comprobante = dataUrl;
        $('remPreviewImg').src = dataUrl;
        $('remPreview').hidden = false;
        aviso('');
      }).catch(function () {
        aviso('No pudimos leer esa imagen. Probá con otra.');
      });
    });

    $('remQuitarComprobante').addEventListener('click', function () {
      estado.comprobante = '';
      $('remComprobante').value = '';
      $('remPreview').hidden = true;
      $('remPreviewImg').removeAttribute('src');
      aviso('');
    });
  }

  // ============================================================
  // ENVIAR EL PEDIDO
  // ============================================================
  function falta(id, mal) {
    var el = $(id);
    if (!el) return false;
    el.classList.toggle('rem-falta', !!mal);
    return !!mal;
  }

  function validar() {
    var problemas = [];
    if (!estado.sel) problemas.push('elegí la remera');

    var nombre = $('remNombre').value.trim();
    var email = $('remEmail').value.trim();
    var tel = $('remTelefono').value.trim();
    var suc = $('remSucursal').value.trim();

    var fNombre = falta('remNombre', !nombre);
    var fMail = falta('remEmail', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
    var fTel = falta('remTelefono', tel.replace(/\D/g, '').length < 6);
    var fSuc = falta('remSucursal', !suc);

    if (fNombre) problemas.push('tu nombre y apellido');
    if (fSuc) problemas.push('la sucursal de Correo Argentino');
    if (fMail) problemas.push('un mail válido');
    if (fTel) problemas.push('tu teléfono');
    if (!estado.talle) problemas.push('el talle');

    if (problemas.length) {
      aviso('Falta completar: ' + problemas.join(', ') + '.');
      var primero = document.querySelector('.rem-falta');
      if (primero) primero.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    return true;
  }

  function comprar() {
    if (estado.enviando) return;
    if (!validar()) return;

    var btn = $('remBtnComprar');
    estado.enviando = true;
    btn.disabled = true;
    btn.textContent = 'GUARDANDO EL PEDIDO…';
    aviso('');

    var cuerpo = {
      remeraId: estado.sel.id || '',
      remeraNombre: estado.sel.nombre,
      talle: estado.talle,
      sucursal: $('remSucursal').value.trim(),
      nombreApellido: $('remNombre').value.trim(),
      email: $('remEmail').value.trim(),
      telefono: $('remTelefono').value.trim(),
      nota: $('remNota').value,
      comprobante: estado.comprobante || ''
    };

    apiBase()
      .then(function (base) {
        return fetch(base + '/compras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cuerpo)
        });
      })
      .then(function (r) {
        return r.json().then(function (d) { return { status: r.status, d: d }; });
      })
      .then(function (res) {
        var d = res.d || {};
        if (res.status !== 201 || !d.ok) throw new Error(d.error || 'No se pudo guardar el pedido');
        estado.mensaje = d.mensaje || '';
        $('remOkCode').textContent = d.codigo || '';
        $('remOkWa').href = d.whatsapp || '#';
        $('remOk').hidden = false;
        $('paso-remera').hidden = true;
        $('paso-talle').hidden = true;
        $('paso-datos').hidden = true;
        $('paso-confirmar').hidden = true;
        $('remOk').scrollIntoView({ block: 'start', behavior: 'smooth' });
        // Intento de abrir WhatsApp directo; si el navegador lo bloquea,
        // el botón grande del panel hace lo mismo con un click.
        try { window.open(d.whatsapp, '_blank', 'noopener'); } catch (e) { /* bloqueado */ }
        $('remOkMsg').className = 'rem-msg is-on ok';
        // El comprobante viaja como LINK: se lo mostramos para que lo pueda
        // abrir/guardar y saber qué está mandando.
        if (d.comprobanteUrl) {
          $('remOkMsg').innerHTML = 'Pedido ' + esc(d.codigo || '') +
            ' guardado con comprobante. El link de tu comprobante ya va dentro del mensaje: ' +
            '<a href="' + esc(d.comprobanteUrl) + '" target="_blank" rel="noopener">ver mi comprobante</a>.';
        } else {
          $('remOkMsg').textContent = 'Pedido ' + (d.codigo || '') +
            ' guardado sin comprobante: mandalo por WhatsApp cuando lo tengas.';
        }
      })
      .catch(function (e) {
        aviso('No se pudo guardar el pedido: ' + e.message + '. Probá de nuevo o escribinos al ' + estado.whatsapp + '.');
        estado.enviando = false;
        btn.disabled = false;
        btn.textContent = 'CONFIRMAR PEDIDO Y ENVIAR POR WHATSAPP';
      });
  }

  function copiarMensaje() {
    var t = estado.mensaje || '';
    if (!t) return;
    var ok = function () {
      $('remOkMsg').className = 'rem-msg is-on ok';
      $('remOkMsg').textContent = 'Mensaje copiado. Pegalo en WhatsApp si no se abrió solo.';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(ok).catch(function () { seleccionarTexto(t); });
    } else {
      seleccionarTexto(t);
    }
  }

  function seleccionarTexto(t) {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* nada */ }
    document.body.removeChild(ta);
    $('remOkMsg').className = 'rem-msg is-on ok';
    $('remOkMsg').textContent = 'Mensaje copiado. Pegalo en WhatsApp si no se abrió solo.';
  }

  // ============================================================
  // ARRANQUE
  // ============================================================
  function init() {
    pintarSucursales();
    pintarTalles();
    pintarResumen();
    engancharComprobante();
    $('remBtnComprar').addEventListener('click', comprar);
    $('remOkCopiar').addEventListener('click', copiarMensaje);
    $('remUbicar').addEventListener('click', ubicar);

    // Campos: al escribir se limpia la marca de "falta".
    ['remNombre', 'remEmail', 'remTelefono', 'remSucursal'].forEach(function (id) {
      $(id).addEventListener('input', function () { $(id).classList.remove('rem-falta'); });
    });

    cargarCatalogo().then(function () {
      pintarRemeras();
      pintarResumen();
      // Preselección por link: compraremera.html?remera=<id>&talle=M
      var q = params();
      if (q.talle && (estado.talles || ['S', 'M', 'L', 'XL', 'XXL']).indexOf(String(q.talle).toUpperCase()) >= 0) {
        estado.talle = String(q.talle).toUpperCase();
        pintarTalles();
      }
      if (q.remera) {
        var card = document.querySelector('.rem-card[data-id="' + q.remera + '"]');
        if (card) card.click();
      }
      pintarResumen();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
