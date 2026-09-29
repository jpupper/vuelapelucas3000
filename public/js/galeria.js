/* =========================================================
   VUELAPELUCAS 3000 — galeria + community creation
   Carga los manifests generados por tools/build_gallery.py
   y tools/ig_download.py (o el fallback manual).
   ========================================================= */
(function () {
    'use strict';

    var PAGE = 24;

    // Las rutas del manifest ya vienen relativas a public/ ("img/...").
    // Si vinieran cortas ("008.jpg") se asume el prefijo de la carpeta.
    function url(p, fallbackDir) {
        if (!p) return '';
        if (p.indexOf('img/') === 0 || p.indexOf('/') === 0 || p.indexOf('http') === 0) return p;
        return fallbackDir + p;
    }

    function el(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }

    /* ---------------- galeria ---------------- */
    function initGallery(root) {
        var filtersBox = root.querySelector('.vl-filters');
        var grid = root.querySelector('.vl-gallery');
        var moreBtn = root.querySelector('.vl-more');
        if (!grid) return;

        fetch('img/galeria/manifest.json', { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (items) {
                buildGallery(items.filter(function (i) { return i.year !== '0000'; }));
            })
            .catch(function () {
                grid.parentNode.insertBefore(
                    el('div', 'vl-empty', 'No se encontro la galeria (img/galeria/manifest.json).' +
                        ' Corré tools/build_selection.py y volvé a subir la carpeta img/galeria.'), grid);
            });

        function buildGallery(items) {
            var years = [];
            items.forEach(function (i) { if (years.indexOf(i.year) < 0) years.push(i.year); });
            years.sort();
            years.reverse();

            var state = { year: 'all', shown: PAGE };
            var lb = lightbox();

            function chips() {
                filtersBox.innerHTML = '';
                var all = [['all', 'TODAS (' + items.length + ')']].concat(
                    years.map(function (y) {
                        var n = items.filter(function (i) { return i.year === y; }).length;
                        return [y, (y || 'SIN FECHA') + ' (' + n + ')'];
                    }));
                all.forEach(function (pair) {
                    var b = el('button', 'vl-filter' + (state.year === pair[0] ? ' is-active' : ''), pair[1]);
                    b.type = 'button';
                    b.addEventListener('click', function () {
                        state.year = pair[0];
                        state.shown = PAGE;
                        render();
                    });
                    filtersBox.appendChild(b);
                });
            }

            function render() {
                chips();
                var list = state.year === 'all'
                    ? items
                    : items.filter(function (i) { return i.year === state.year; });
                grid.innerHTML = '';
                list.slice(0, state.shown).forEach(function (i, idx) {
                    var fig = el('figure');
                    fig.title = 'Foto ' + i.n + ' — ' + i.year;
                    var im = el('img');
                    im.loading = 'lazy';
                    im.src = url(i.thumb, 'img/galeria/');
                    im.alt = 'Vuelapelucas 3000 ' + i.year + ' — foto ' + i.n;
                    fig.appendChild(im);
                    if (state.year === 'all') fig.appendChild(el('span', 'vl-year', i.year));
                    fig.addEventListener('click', function () { lb.open(list, idx); });
                    grid.appendChild(fig);
                });
                moreBtn.style.display = list.length > state.shown ? 'block' : 'none';
                moreBtn.textContent = 'VER ' + Math.min(PAGE, list.length - state.shown) + ' FOTOS MAS';
            }

            moreBtn.addEventListener('click', function () {
                state.shown += PAGE;
                render();
            });
            render();
        }
    }

    /* ---------------- lightbox (compartido) ---------------- */
    // El mismo visor lo usan la galeria de fotos y las creaciones de la
    // comunidad: click en una imagen la abre ahi mismo y se pasa con las
    // flechas ‹ › (o las flechas del teclado).
    function lbSrc(it) {
        return url(it.file || it.big, 'img/galeria/');
    }
    function lbCaption(it) {
        if (it.year != null) {
            return 'VUELAPELUCAS 3000 · ' + it.year + ' · ' + it.n + '/' + it.mp + 'MP';
        }
        if (it.isDraw) {
            var ar = String(it.autor || '').replace(/^@+/, '');
            return 'PANCHODRAW · ' + it.nombre + (ar ? ' · @' + ar : '');
        }
        return 'CREACIÓN DE LA COMUNIDAD' + (it.autor ? ' · @' + it.autor : '');
    }

    var _lb = null;
    function lightbox() { if (!_lb) _lb = makeLightbox(); return _lb; }

    function makeLightbox() {
        var box = el('div', 'vl-lightbox');
        var img = el('img');
        var cap = el('div', 'vl-lb-cap');
        var prev = el('button', 'vl-lb-prev', '‹');
        var next = el('button', 'vl-lb-next', '›');
        var close = el('button', 'vl-lb-close', '✕');
        [prev, next, close].forEach(function (b) { b.type = 'button'; });
        box.appendChild(img); box.appendChild(cap);
        box.appendChild(prev); box.appendChild(next); box.appendChild(close);
        document.body.appendChild(box);

        var list = [], idx = 0;

        function show() {
            var it = list[idx];
            if (!it) return;
            img.src = lbSrc(it);
            cap.textContent = lbCaption(it);
        }
        function open(l, i) { list = l; idx = i; show(); box.classList.add('is-open'); }
        function closeIt() {
            box.classList.remove('is-open');
            img.removeAttribute('src');
        }
        function step(d) {
            if (!list.length) return;
            idx = (idx + d + list.length) % list.length;
            show();
        }

        prev.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
        next.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
        close.addEventListener('click', closeIt);
        box.addEventListener('click', function (e) { if (e.target === box) closeIt(); });
        document.addEventListener('keydown', function (e) {
            if (!box.classList.contains('is-open')) return;
            if (e.key === 'Escape') closeIt();
            if (e.key === 'ArrowLeft') step(-1);
            if (e.key === 'ArrowRight') step(1);
        });

        return { open: open };
    }

    /* ---------------- creaciones de la comunidad ---------------- */
    function initCommunity(root) {
        var grid = root.querySelector('.vl-community-grid');
        if (!grid) return;
        fetch('img/flyers/manifest.json', { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (items) {
                if (!items || !items.length) throw new Error('vacio');
                var lb = lightbox();
                grid.innerHTML = '';
                items.forEach(function (it, idx) {
                    var a = el('a');
                    // El href queda para "abrir en otra pestaña"; el click normal
                    // abre el visor acá mismo, con flechas.
                    a.href = url(it.file || it.big, 'img/flyers/');
                    a.target = '_blank';
                    a.rel = 'noopener';
                    a.title = it.autor ? ('@' + it.autor) : 'Vuelapelucas 3000';
                    var im = el('img');
                    im.loading = 'lazy';
                    im.src = url(it.thumb || it.file, 'img/flyers/');
                    im.alt = 'Creación de la comunidad — ' + (it.autor || 'vuelapelucas3000');
                    a.appendChild(im);
                    a.addEventListener('click', function (e) {
                        e.preventDefault();
                        lb.open(items, idx);
                    });
                    grid.appendChild(a);
                });
                var cnt = root.querySelector('#count-flyers') || root.querySelector('.vl-community-count');
                if (cnt) cnt.textContent = items.length + ' PUBLICACIONES';
            })
            .catch(function () {
                grid.innerHTML = '';
                var n = el('div', 'vl-empty', 'Todavia no hay flyers descargados. ' +
                    'Usá el botón de Instagram para ver las creaciones de la comunidad.');
                grid.parentNode.insertBefore(n, grid);
            });
    }

    /* ---------------- dibujos de PANCHODRAW ---------------- */
    // Las creaciones viven en la base de la app (VPS): aca se listan y se
    // muestran en la subseccion PANCHODRAW de CREACIONES DE LA COMUNIDAD.
    var API_VUELA = (function () {
        var h = location.hostname;
        var local = (h === 'localhost' || h === '127.0.0.1');
        return local
            ? (location.protocol + '//' + location.host + '/vuelapelucas3000_2')
            : 'https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2';
    })();

    function initDrawings(root) {
        var grid = root.querySelector('.vl-draw-grid');
        if (!grid) return;

        fetch(API_VUELA + '/api/artworks', { cache: 'no-cache' })
            .then(function (r) {
                if (r.headers.get('content-type') && r.headers.get('content-type').indexOf('json') < 0) {
                    throw new Error('no-json');
                }
                return r.json();
            })
            .then(function (d) {
                var items = (d && d.artworks) || [];
                if (!items.length) {
                    grid.appendChild(el('div', 'vl-empty',
                        'Todavía no hay dibujos. Entrá a PanchoDraw, dibujá tu arte del vuela y publicalo.'));
                    setCount('#count-draw', 0);
                    return;
                }

                var lb = lightbox();
                // Items para el visor compartido (mismo formato que galeria/flyers)
                var lbItems = items.map(function (it) {
                    return {
                        isDraw: true,
                        big: API_VUELA + it.img,
                        nombre: it.nombre,
                        autor: it.username || it.autor
                    };
                });
                items.forEach(function (it, idx) {
                    var fig = el('figure');
                    fig.title = 'PanchoDraw — ' + it.nombre + (it.autor ? ' (@' + it.autor + ')' : '');

                    var im = el('img');
                    im.loading = 'lazy';
                    im.src = API_VUELA + it.img;
                    im.alt = 'Dibujo de ' + (it.autor || 'la comunidad') + ': ' + it.nombre;
                    fig.appendChild(im);

                    var cap = el('figcaption');
                    cap.appendChild(el('b', null, it.nombre));
                    var aut = el('span', 'vl-draw-autor', (it.username ? '@' + it.username : it.autor));
                    cap.appendChild(aut);
                    fig.appendChild(cap);

                    fig.addEventListener('click', function () { lb.open(lbItems, idx); });
                    grid.appendChild(fig);
                });

                setCount('#count-draw', items.length);
            })
            .catch(function () {
                grid.innerHTML = '';
                grid.appendChild(el('div', 'vl-empty',
                    'No se pudieron cargar los dibujos de PanchoDraw en este momento. ' +
                    'Entrá a PanchoDraw y publicá el primero.'));
            });

        function setCount(sel, n) {
            var e = root.querySelector(sel);
            if (e) e.textContent = n ? '(' + n + ')' : '';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        var g = document.getElementById('galeria');
        if (g) initGallery(g);
        var c = document.getElementById('comunidad');
        if (c) { initCommunity(c); initDrawings(c); }
    });
})();
