/**
 * Vuelapelucas 3000 - Background Shader Manager
 * - Carga el shader exclusivamente desde el archivo .frag (public/shadres/backgroundshader.frag).
 * - Tecla 'R': Recarga y recompila el shader en caliente para vibecoding en vivo.
 * - Tecla 'P': Abre/cierra el panel secreto de control de uniforms (0.0 a 1.0).
 * - Parser dinámico: Cualquier 'uniform float <nombre>;' que agregues al .frag aparecerá
 *   automáticamente como un slider en el panel 'P' (excepto time y resolution).
 */
(function() {
    'use strict';

    let canvas, gl, program;
    let positionBuffer;
    let startTime = performance.now();
    let isInitialized = false;
    let currentFragSource = '';

    // Cache de ubicaciones de uniforms
    let reservedUniforms = {
        resolution: null,
        time: null
    };

    // Objeto con los parámetros dinámicos (nombre -> { location, value, min, max, step })
    let dynamicUniforms = {};

    // Valores por defecto para uniforms conocidos
    const defaultValues = {
        speed: 0.18,
        scale: 0.35,
        colorCycle: 0.20,
        contrast: 0.50,
        brightness: 0.65
    };

    // Cargar valores guardados en localStorage
    function loadSavedUniformValues() {
        try {
            const saved = localStorage.getItem('vuelapelucas_shader_params');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    function saveUniformValues() {
        try {
            const data = {};
            for (const name in dynamicUniforms) {
                data[name] = dynamicUniforms[name].value;
            }
            localStorage.setItem('vuelapelucas_shader_params', JSON.stringify(data));
        } catch (e) {}
    }

    // Inicializar Canvas
    function setupCanvas() {
        canvas = document.getElementById('vuelapelucas-bg');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'vuelapelucas-bg';
            canvas.setAttribute('aria-hidden', 'true');
            document.body.prepend(canvas);
        }

        gl = canvas.getContext('webgl2', { alpha: false, depth: false, antialias: true }) ||
             canvas.getContext('webgl', { alpha: false, depth: false, antialias: true });

        if (!gl) {
            console.warn('WebGL no está soportado en este navegador');
            return false;
        }

        return true;
    }

    // Compilar un shader individual
    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error((type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT') + ' ERROR: ' + error);
        }
        return shader;
    }

    // Parsear dinámicamente cualquier "uniform float <nombre>;"
    function parseDynamicUniforms(fragSource) {
        const regex = /uniform\s+float\s+([a-zA-Z0-9_]+)\s*;/g;
        const found = [];
        let match;

        while ((match = regex.exec(fragSource)) !== null) {
            const name = match[1];
            if (name !== 'time' && name !== 'resolution') {
                found.push(name);
            }
        }

        const savedValues = loadSavedUniformValues();
        const newDynamicUniforms = {};

        found.forEach(name => {
            let val = 0.5; // fallback
            if (dynamicUniforms[name] !== undefined) {
                val = dynamicUniforms[name].value;
            } else if (savedValues[name] !== undefined) {
                val = savedValues[name];
            } else if (defaultValues[name] !== undefined) {
                val = defaultValues[name];
            }

            newDynamicUniforms[name] = {
                location: null,
                value: Math.max(0.0, Math.min(1.0, val))
            };
        });

        dynamicUniforms = newDynamicUniforms;
    }

    // Crear/actualizar el programa WebGL
    function buildGLProgram(fragSource) {
        const isWebGL2 = (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext);

        const vertSource = isWebGL2 ? `#version 300 es
        in vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }` : `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

        let finalFragSource = fragSource;
        if (isWebGL2) {
            if (!finalFragSource.includes('#version 300 es')) {
                finalFragSource = '#version 300 es\n' + finalFragSource;
            }
        } else {
            if (finalFragSource.includes('#version 300 es')) {
                finalFragSource = finalFragSource.replace('#version 300 es', '');
            }
        }

        const vertShader = compileShader(gl.VERTEX_SHADER, vertSource);
        const fragShader = compileShader(gl.FRAGMENT_SHADER, finalFragSource);

        const newProgram = gl.createProgram();
        gl.attachShader(newProgram, vertShader);
        gl.attachShader(newProgram, fragShader);
        gl.linkProgram(newProgram);

        if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
            const err = gl.getProgramInfoLog(newProgram);
            gl.deleteProgram(newProgram);
            throw new Error('LINK ERROR: ' + err);
        }

        if (program) {
            gl.deleteProgram(program);
        }
        program = newProgram;
        gl.useProgram(program);

        // Quad de pantalla completa
        if (!positionBuffer) {
            const positions = new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1
            ]);
            positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        }

        const posAttr = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posAttr);
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

        // Obtener locations de uniforms reservados
        reservedUniforms.resolution = gl.getUniformLocation(program, 'resolution');
        reservedUniforms.time = gl.getUniformLocation(program, 'time');

        // Parsear uniforms dinámicos y obtener sus locations
        parseDynamicUniforms(fragSource);
        for (const name in dynamicUniforms) {
            dynamicUniforms[name].location = gl.getUniformLocation(program, name);
        }

        currentFragSource = fragSource;
        updateGuiControls();
        return true;
    }

    // Redimensionar canvas
    function resize() {
        if (!canvas || !gl) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = Math.floor(window.innerWidth * dpr);
        const displayHeight = Math.floor(window.innerHeight * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, displayWidth, displayHeight);
        }
    }

    // Ciclo de animación
    function render() {
        if (!gl || !program) return;

        const elapsed = (performance.now() - startTime) * 0.001;

        gl.useProgram(program);

        if (reservedUniforms.resolution) {
            gl.uniform2f(reservedUniforms.resolution, canvas.width, canvas.height);
        }
        if (reservedUniforms.time) {
            gl.uniform1f(reservedUniforms.time, elapsed);
        }

        // Pasar todos los uniforms float dinámicos (0.0 a 1.0)
        for (const name in dynamicUniforms) {
            const u = dynamicUniforms[name];
            if (u.location !== null) {
                gl.uniform1f(u.location, u.value);
            }
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }

    // Carga del archivo desde el servidor (con cache-buster opcional)
    // Compara tanto 'shaders/' como 'shadres/' y elige el archivo modificado más recientemente
    async function loadShaderSource(cacheBust = false) {
        const bust = cacheBust ? `?_cb=${Date.now()}` : '';
        const paths = [
            'shaders/backgroundshader.frag',
            'shadres/backgroundshader.frag',
            '/shaders/backgroundshader.frag',
            '/shadres/backgroundshader.frag'
        ];

        const locPath = window.location.pathname;
        const dir = locPath.substring(0, locPath.lastIndexOf('/') + 1);
        if (dir && dir !== '/') {
            paths.unshift(dir + 'shaders/backgroundshader.frag');
            paths.unshift(dir + 'shadres/backgroundshader.frag');
        }

        const uniquePaths = Array.from(new Set(paths));
        const found = [];

        for (const candidatePath of uniquePaths) {
            try {
                const res = await fetch(candidatePath + bust);
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.includes('void main')) {
                        const lastMod = res.headers.get('Last-Modified');
                        const time = lastMod ? new Date(lastMod).getTime() : 0;
                        found.push({ path: candidatePath, text, time });
                    }
                }
            } catch (err) {}
        }

        if (found.length === 0) {
            throw new Error('No se pudo encontrar backgroundshader.frag en las rutas locales');
        }

        // Si hay varios, ordenar por fecha de modificación más reciente (o preferencia por shaders/ si empatan)
        found.sort((a, b) => {
            if (b.time !== a.time) return b.time - a.time;
            if (a.path.includes('shaders/') && !b.path.includes('shaders/')) return -1;
            if (b.path.includes('shaders/') && !a.path.includes('shaders/')) return 1;
            return 0;
        });

        return found[0];
    }

    // Toast de notificación en pantalla
    function showToast(message, isError = false) {
        let toast = document.getElementById('shader-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'shader-toast';
            document.body.appendChild(toast);
        }

        toast.className = isError ? 'error' : 'success';
        toast.textContent = message;
        toast.style.display = 'block';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.display = 'none';
        }, isError ? 5000 : 3000);
    }

    // Recargar shader (Hotkey 'R' o botón en panel)
    async function reloadShader() {
        showToast('🔄 Recargando shader...');
        try {
            const result = await loadShaderSource(true);
            buildGLProgram(result.text);
            showToast(`✅ Shader recargado [${result.path}]`);
            console.log(`⚡ Shader recargado exitosamente desde: ${result.path}`);
        } catch (err) {
            console.error('Error al recargar shader:', err);
            showToast('❌ Error en shader: ' + err.message, true);
        }
    }

    // ==========================================
    // PANEL SECRETO DE CONTROL [P]
    // ==========================================
    let guiPanel = null;

    function createGuiPanel() {
        if (guiPanel) return;

        guiPanel = document.createElement('div');
        guiPanel.id = 'shader-gui-panel';
        guiPanel.innerHTML = `
            <div class="gui-header">
                <div class="gui-title">
                    <span>🎛️ VIBECODING SHADER</span>
                    <small>Atajos: [R] Recargar | [P] Ocultar</small>
                </div>
                <button class="gui-close" title="Cerrar panel (P)">✕</button>
            </div>
            <div class="gui-body" id="gui-controls-list">
                <!-- Se puebla dinámicamente según los 'uniform float' encontrados -->
            </div>
            <div class="gui-footer">
                <button id="gui-btn-reload" class="gui-btn primary">🔄 Recargar Shader [R]</button>
                <button id="gui-btn-reset" class="gui-btn">↺ Reset</button>
            </div>
        `;

        document.body.appendChild(guiPanel);

        guiPanel.querySelector('.gui-close').addEventListener('click', toggleGui);
        document.getElementById('gui-btn-reload').addEventListener('click', reloadShader);
        document.getElementById('gui-btn-reset').addEventListener('click', resetUniformDefaults);
    }

    function toggleGui() {
        if (!guiPanel) createGuiPanel();
        const isVisible = guiPanel.style.display === 'block';
        guiPanel.style.display = isVisible ? 'none' : 'block';
    }

    function resetUniformDefaults() {
        for (const name in dynamicUniforms) {
            const def = defaultValues[name] !== undefined ? defaultValues[name] : 0.5;
            dynamicUniforms[name].value = def;
        }
        saveUniformValues();
        updateGuiControls();
        showToast('Valores reseteados a defaults');
    }

    // Actualizar sliders del panel
    function updateGuiControls() {
        if (!guiPanel) return;
        const list = document.getElementById('gui-controls-list');
        if (!list) return;

        list.innerHTML = '';
        const names = Object.keys(dynamicUniforms);

        if (names.length === 0) {
            list.innerHTML = '<p class="gui-empty">No se encontraron uniforms float dinámicos en el shader.</p>';
            return;
        }

        names.forEach(name => {
            const item = dynamicUniforms[name];
            const row = document.createElement('div');
            row.className = 'gui-row';

            const isCustom = defaultValues[name] === undefined;
            row.innerHTML = `
                <div class="gui-label-wrap">
                    <span class="gui-name ${isCustom ? 'custom-uniform' : ''}">${name}</span>
                    <span class="gui-val" id="gui-val-${name}">${item.value.toFixed(3)}</span>
                </div>
                <input type="range" class="gui-slider" id="gui-slider-${name}" min="0" max="1" step="0.005" value="${item.value}">
            `;

            const slider = row.querySelector(`#gui-slider-${name}`);
            const valDisplay = row.querySelector(`#gui-val-${name}`);

            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                item.value = val;
                valDisplay.textContent = val.toFixed(3);
                saveUniformValues();
            });

            list.appendChild(row);
        });
    }

    // Inyectar estilos para el panel secreto y toast
    function injectStyles() {
        if (document.getElementById('shader-gui-styles')) return;
        const style = document.createElement('style');
        style.id = 'shader-gui-styles';
        style.textContent = `
            #shader-gui-panel {
                display: none;
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 320px;
                max-height: 80vh;
                background: #ffffff;
                color: #000000;
                border: 3px solid #000000;
                border-radius: 16px;
                box-shadow: 6px 6px 0px #000000;
                z-index: 99999;
                font-family: 'Inter', -apple-system, sans-serif;
                overflow: hidden;
                user-select: none;
                animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            @keyframes popIn {
                from { transform: scale(0.9) translateY(20px); opacity: 0; }
                to { transform: scale(1) translateY(0); opacity: 1; }
            }
            .gui-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #ffd62c;
                border-bottom: 3px solid #000000;
            }
            .gui-title {
                display: flex;
                flex-direction: column;
            }
            .gui-title span {
                font-weight: 800;
                font-size: 0.95rem;
                letter-spacing: 0.05em;
            }
            .gui-title small {
                font-size: 0.72rem;
                color: #333;
                font-weight: 600;
            }
            .gui-close {
                background: #ffffff;
                border: 2px solid #000000;
                border-radius: 8px;
                box-shadow: 2px 2px 0px #000000;
                font-weight: 800;
                cursor: pointer;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .gui-close:hover {
                background: #ef4720;
                color: #ffffff;
            }
            .gui-body {
                padding: 14px 16px;
                overflow-y: auto;
                max-height: 50vh;
            }
            .gui-row {
                margin-bottom: 12px;
            }
            .gui-label-wrap {
                display: flex;
                justify-content: space-between;
                font-size: 0.82rem;
                font-weight: 700;
                margin-bottom: 4px;
            }
            .gui-name.custom-uniform {
                color: #c5612d;
            }
            .gui-val {
                font-family: monospace;
                background: #f0f0f0;
                padding: 1px 6px;
                border-radius: 4px;
                border: 1px solid #ccc;
            }
            .gui-slider {
                width: 100%;
                accent-color: #ef4720;
                cursor: pointer;
            }
            .gui-footer {
                padding: 10px 16px;
                display: flex;
                gap: 8px;
                background: #f8f9fa;
                border-top: 2px solid #000000;
            }
            .gui-btn {
                flex: 1;
                padding: 8px 10px;
                font-weight: 700;
                font-size: 0.8rem;
                background: #ffffff;
                border: 2px solid #000000;
                border-radius: 8px;
                box-shadow: 2px 2px 0px #000000;
                cursor: pointer;
                transition: transform 0.1s;
            }
            .gui-btn:active {
                transform: translate(1px, 1px);
                box-shadow: 1px 1px 0px #000000;
            }
            .gui-btn.primary {
                background: #ef4720;
                color: #ffffff;
            }
            .gui-empty {
                font-size: 0.82rem;
                color: #666;
                text-align: center;
                padding: 10px;
            }
            #shader-toast {
                display: none;
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                padding: 10px 20px;
                font-weight: 700;
                font-size: 0.9rem;
                border-radius: 12px;
                z-index: 100000;
                font-family: 'Inter', sans-serif;
                box-shadow: 4px 4px 0px #000000;
                border: 2px solid #000000;
            }
            #shader-toast.success {
                background: #6cfeb5;
                color: #000000;
            }
            #shader-toast.error {
                background: #ff4d4f;
                color: #ffffff;
                max-width: 80vw;
                white-space: pre-wrap;
            }
        `;
        document.head.appendChild(style);
    }

    // Manejar atajos de teclado globales ('R' y 'P')
    function setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Ignorar si el usuario está escribiendo en un input, textarea o select
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
                return;
            }

            if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                reloadShader();
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                toggleGui();
            }
        });
    }

    // Inicialización principal
    async function init() {
        if (isInitialized) return;
        if (!setupCanvas()) return;

        injectStyles();
        createGuiPanel();
        setupKeyboardShortcuts();

        resize();
        window.addEventListener('resize', resize, { passive: true });

        try {
            const result = await loadShaderSource(false);
            if (buildGLProgram(result.text)) {
                isInitialized = true;
                requestAnimationFrame(render);
                console.log(`🌀 Vuelapelucas 3000 - Background Shader inicializado desde: ${result.path}. Presioná [P] para panel o [R] para recargar.`);
            }
        } catch (err) {
            console.error('Error al iniciar el shader de fondo:', err);
            showToast('Error cargando shader: ' + err.message, true);
        }
    }

    // Exponer API global por si se quiere manipular por consola
    window.VuelapelucasShader = {
        reload: reloadShader,
        togglePanel: toggleGui,
        setUniform: function(name, val) {
            if (dynamicUniforms[name]) {
                dynamicUniforms[name].value = Math.max(0.0, Math.min(1.0, val));
                updateGuiControls();
            }
        },
        getUniforms: function() {
            const res = {};
            for (const k in dynamicUniforms) res[k] = dynamicUniforms[k].value;
            return res;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
