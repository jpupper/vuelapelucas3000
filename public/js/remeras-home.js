// ============================================================
// REMERAS EN LA PORTADA — la cinta que pasa
// ------------------------------------------------------------
// Lee el catalogo de la API y arma la cinta duplicando la lista:
// la animacion CSS mueve el track un -50%, asi el loop no corta.
// Si la API no contesta, usa los modelos de respaldo (los mismos
// archivos que estan en img/remeras/) para que la seccion nunca
// quede vacia en la portada.
// ============================================================
(function () {
  'use strict';

  var API_LOCAL = '/apivuelapelucas/api';
  var API_DIRECTA = 'https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api';
  var IS_LOCAL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API = IS_LOCAL ? (location.origin + '/vuelapelucas3000_2/api') : API_LOCAL;
  var apiResuelta = null;

  // Igual criterio que rifa.js / compraremera.js: en producción el dominio es
  // FTP (Apache) y no proxea /apivuelapelucas/, así que si esa ruta no contesta
  // se va directo al backend del VPS. La base que responde se cachea.
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plata(n) {
    return '$' + (Number(n) || 0).toLocaleString('es-AR');
  }

  function pintar(lista, base) {
    var track = document.getElementById('remerasTrack');
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

    // dos copias: el keyframe llega a -50% y vuelve a empezar sin salto
    track.innerHTML = slides + slides;
  }

  function arrancar() {
    var track = document.getElementById('remerasTrack');
    if (!track) return;

    // Mientras llega la API se muestran los modelos de respaldo.
    pintar(RESPALDO.map(function (r) {
      return { nombre: r.nombre, archivo: r.archivo, precio: 50000 };
    }), null);

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
        // Se queda el respaldo: la portada no muestra un cartel de error.
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
