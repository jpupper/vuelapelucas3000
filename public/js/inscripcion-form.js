// Vuelapelucas 3000 - Formulario de inscripcion (compartido por index.html y anotate.html)
(function () {
    'use strict';

    const CONFIG = {
        BASE: '/vuelapelucas3000_2',
        API_URL: (function () {
            const IS_NODE_SERVER = (
                location.hostname === 'localhost' ||
                location.hostname === '127.0.0.1' ||
                location.host.includes('localhost') ||
                location.hostname === 'vps-4455523-x.dattaweb.com'
            );
            return IS_NODE_SERVER ? '' : 'https://vps-4455523-x.dattaweb.com';
        })()
    };

    // Roles que deben cargar especificaciones tecnicas
    const ROLES_CON_TECNICA = ['feriante', 'artista_escenario', 'vj', 'instalacion_multimedia'];

    // Devuelve que filas condicionales corresponden a cada rol (logica pura, testeable)
    function rowVisibility(rol) {
        const r = rol || 'espectador';
        return {
            // "Como queres colaborar": todos menos espectador
            colaborar: !(r === '' || r === 'espectador'),
            // Especificaciones tecnicas: solo roles tecnicos
            tecnicas: ROLES_CON_TECNICA.includes(r)
        };
    }

    function init(opts) {
        opts = opts || {};
        const form = document.getElementById(opts.formId || 'form-inscripcion');
        if (!form) return;

        const messageDiv = document.getElementById(opts.messageId || 'form-message');
        const btn = form.querySelector('.btn-submit');
        const btnLabel = btn ? btn.textContent : '¡INSCRIBIRME!';
        const rolSel = form.querySelector('[name="rol"]');
        const rowColaborar = form.querySelector('[data-row="colaborar"]');
        const rowTecnicas = form.querySelector('[data-row="tecnicas"]');

        function syncRows() {
            const vis = rowVisibility(rolSel ? rolSel.value : 'espectador');
            if (rowColaborar) rowColaborar.hidden = !vis.colaborar;
            if (rowTecnicas) rowTecnicas.hidden = !vis.tecnicas;
        }

        function fieldValue(name) {
            const el = form.querySelector('[name="' + name + '"]');
            return el ? el.value.trim() : '';
        }

        function fieldVisible(name) {
            const el = form.querySelector('[name="' + name + '"]');
            if (!el) return true;
            const row = el.closest('[data-row]');
            return !row || !row.hidden;
        }

        if (rolSel) {
            rolSel.addEventListener('change', syncRows);
            syncRows();
        }

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (btn) { btn.textContent = 'ENVIANDO...'; btn.disabled = true; }
            if (messageDiv) { messageDiv.textContent = ''; messageDiv.className = 'form-message'; }

            const formData = {
                nombre: fieldValue('nombre'),
                apellido: fieldValue('apellido'),
                email: fieldValue('email'),
                telefono: fieldValue('telefono'),
                ciudad: fieldValue('ciudad'),
                hospedaje: fieldValue('hospedaje'),
                rol: fieldValue('rol') || 'espectador',
                como_colaborar: fieldVisible('como_colaborar') ? fieldValue('como_colaborar') : '',
                especificaciones_tecnicas: fieldVisible('especificaciones_tecnicas') ? fieldValue('especificaciones_tecnicas') : ''
            };

            try {
                const url = CONFIG.API_URL + CONFIG.BASE + '/api/inscripciones';
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include',
                    mode: 'cors',
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (messageDiv) {
                        messageDiv.textContent = '🎉 ¡Inscripción exitosa! Te esperamos en Vuelapelucas 3000';
                        messageDiv.className = 'form-message success';
                    }
                    form.reset();
                    syncRows();
                } else if (messageDiv) {
                    messageDiv.textContent = '❌ ' + (data.error || 'Error al procesar la inscripción');
                    messageDiv.className = 'form-message error';
                }
            } catch (error) {
                console.error('Error:', error);
                if (messageDiv) {
                    messageDiv.textContent = (error.message.includes('Failed to fetch') || error.message.includes('CORS'))
                        ? '⚠️ Error de conexión. Por favor, intentá de nuevo o contactanos por Instagram.'
                        : '❌ Error de conexión. Probá de nuevo.';
                    messageDiv.className = 'form-message error';
                }
            }

            if (btn) { btn.textContent = btnLabel; btn.disabled = false; }
        });
    }

    window.InscripcionForm = { init: init, rowVisibility: rowVisibility };
})();
