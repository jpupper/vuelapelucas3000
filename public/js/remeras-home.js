// ============================================================
// REMERAS EN LA PORTADA — la cinta que pasa + flechas
// ------------------------------------------------------------
// El track tiene la lista DUPLICADA: el auto-avance (acá, por JS con
// requestAnimationFrame) corre de 0 a -mitad y vuelve a empezar, así el
// loop no corta nunca. Las flechas mueven de a una remera y frenan el
// auto-avance unos segundos para que no se pelee con el click.
//
// Antes era una animación CSS; se pasó a JS para poder mover a mano sin
// que el transform de la animación pise el de las flechas.
// Si la API no contesta, usa los modelos de respaldo (mismos archivos que
// public/img/remeras/): la sección nunca queda vacía.
// ============================================================
(function () {
  'use strict';

  var API_LOCAL = '/apivuelapelucas/api';
  var API_DIRECTA = 'https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api';
  var IS_LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API = IS_LOCAL ? (location.origin + '/vuelapelucas3000_2/api') : API_LOCAL;
  var apiResuelta = null;

  // En producción el dominio es FTP (Apache) y no proxea /apivuelapelucas/,
  // así que si esa ruta no contesta se va directo al backend del VPS.
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

  var RESPALDO = [
    { nombre: 'REMERA X FASOLITO', archivo: 'img/remeras/remera-fasolito.webp' },
    { nombre: 'REMERA X JUANITO', archivo: 'img/remeras/remera-juanito.webp' },
    { nombre: 'REMERA X PAM! PAM!', archivo: 'img/remeras/remera-pam.webp' },
    { nombre: 'REMERA X PANCHO DEL PUEBLO', archivo: 'img/remeras/remera-pancho.webp' },
    { nombre: 'REMERA X JPUPPER', archivo: 'img/remeras/remera-pupper.webp' }
  ];

  var VELOCIDAD = 26;              // px por segundo del auto-avance
  var FRENO_TRAS_CLICK = 2600;     // ms de pausa después de tocar una flecha
  var reductor = false;
  try { reductor = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* nada */ }

  var track = null;
  var offset = 0;        // px (negativo = la cinta se corre a la izquierda)
  var mitad = 0;         // ancho de UNA copia de la lista
  var frenadoHasta = 0;
  var ultimoT = 0;

  function plata(n) { return '$' + (Number(n) || 0).toLocaleString('es-AR'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pintar(lista, base) {
    if (!track) return;
    var slides = lista.map(function (r) {
      var img = r.archivo ? r.archivo : (base || API) + '/remeras/' + r.id + '/img';
      var link = r.id ? 'compraremera.html?remera=' + encodeURIComponent(r.id) : 'compraremera.html';
      return '<a class="vl-remera-slide" href="' + esc(link) + '" aria-label="Comprar ' + esc(r.nombre) + '">' +
        '<span class="vl-remera-foto"><img src="' + esc(img) + '" alt="' + esc(r.nombre) + '" loading="lazy"></span>' +
        '<span class="vl-remera-info">' +
        '<span class="vl-remera-nombre">' + esc(r.nombre) + '</span>' +
        '<span class="vl-remera-precio">' + plata(r.precio) + '</span>' +
        '</span></a>';
    }).join('');
    // dos copias: se corre media lista y vuelve a empezar sin salto
    track.innerHTML = slides + slides;
    medir();
    aplicar();
  }

  // ---------- movimiento ----------
  function medir() {
    mitad = Math.round(track.scrollWidth / 2) || 0;
  }

  function normalizar() {
    if (!mitad) return;
    while (offset <= -mitad) offset += mitad;
    while (offset > 0) offset -= mitad;
  }

  function aplicar() {
    track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
  }

  function pasoAncho() {
    var primera = track.querySelector('.vl-remera-slide');
    if (!primera) return 200;
    var est = getComputedStyle(track);
    var gap = parseFloat(est.columnGap || est.gap) || 16;
    return primera.getBoundingClientRect().width + gap;
  }

  // dir +1 = siguiente (la cinta se corre a la izquierda), -1 = anterior.
  function mover(dir) {
    if (!mitad) medir();
    offset -= dir * pasoAncho();
    normalizar();
    aplicar();
    frenadoHasta = Date.now() + FRENO_TRAS_CLICK;
  }

  function loop(t) {
    if (!ultimoT) ultimoT = t;
    var dt = Math.min(0.06, (t - ultimoT) / 1000);
    ultimoT = t;
    var libre = Date.now() > frenadoHasta;
    if (mitad && libre && !reductor) {
      offset -= VELOCIDAD * dt;
      normalizar();
      aplicar();
    }
    requestAnimationFrame(loop);
  }

  function engancharCinta() {
    var cont = document.getElementById('remerasCinta');
    if (!cont) return;

    cont.querySelectorAll('.vl-remeras-arrow').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        mover(parseInt(b.dataset.dir, 10) || 1);
      });
    });

    // el mouse (o el foco) sobre la cinta frena el auto-avance
    cont.addEventListener('mouseenter', function () { frenadoHasta = Date.now() + 3600000; });
    cont.addEventListener('mouseleave', function () { frenadoHasta = 0; });
    cont.addEventListener('focusin', function () { frenadoHasta = Date.now() + 3600000; });
    cont.addEventListener('focusout', function () { frenadoHasta = 0; });

    window.addEventListener('resize', function () { medir(); normalizar(); aplicar(); });
    track.addEventListener('load', function () { medir(); }, true);
  }

  function arrancar() {
    track = document.getElementById('remerasTrack');
    if (!track) return;

    pintar(RESPALDO.map(function (r) {
      return { nombre: r.nombre, archivo: r.archivo, precio: 50000 };
    }), null);

    engancharCinta();
    requestAnimationFrame(loop);

    var baseApi = null;
    apiBase()
      .then(function (base) {
        baseApi = base;
        return fetch(base + '/remeras', { cache: 'no-store' }).then(function (r) { return r.json(); });
      })
      .then(function (d) {
        if (!d || !d.ok || !d.remeras || !d.remeras.length) throw new Error('sin datos');
        pintar(d.remeras.map(function (r) {
          return { id: r.id, nombre: r.nombre, precio: r.precio || d.precio };
        }), baseApi);
        var nota = document.getElementById('remerasNota');
        if (nota && d.precio) nota.innerHTML = 'TODAS A <b>' + plata(d.precio) + '</b> · ENVÍO A SUCURSAL DE CORREO ARGENTINO';
      })
      .catch(function () {
        // se queda el respaldo: la portada no muestra un cartel de error
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
