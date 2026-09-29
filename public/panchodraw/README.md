# VUELAPELUCAS 3000 - Paint & Wiggly Studio (Edición Windows 95) ⚡💇‍♂️

Una recreación auténtica de la interfaz de **Windows 95 Paint** combinada con el motor de trazo tembloroso (*squigglevision*) de **wigglypaint.net**, optimizada para diseñar afiches, flyers y animaciones del **Encuentro Artístico VUELAPELUCAS 3000** ([vuelapelucas3000.com.ar](https://vuelapelucas3000.com.ar)).

---

## 💾 Novedades y Pulido

1. **Lienzo de 256 x 256 Píxeles**:
   - Resolución deliberadamente retro: las líneas del lápiz y pincel se ven con un grosor chunky, crujiente y pixel art puro.
   - Algoritmo **Bresenham** de interpolación entre puntos: los trazos rápidos nunca dejan huecos ni saltos, comportándose exactamente igual que MS Paint.
   - En pantalla se visualiza ampliado al 200% (512x512) por defecto, con opciones de zoom 100% (256px), 200% (512px), 400% (1024px) y 800% (2048px).

2. **Interfaz Fiel a Windows 95 Paint**:
   - **Fondo de escritorio en negro sólido (`#000000`)** para máximo contraste con la ventana retro.
   - Barra de título en azul marino clásico (`#000080`) con ícono retro y botones `_`, `□`, `✕`.
   - **Botón de Maximizar (`□`) con Pantalla Completa**: activa el modo pantalla completa nativo del navegador (o maximizado de ventana completa) con ajuste dinámico del visor de dibujo. También responde al doble clic en la barra de título.
   - Barra de menús completa (*Archivo*, *Edición*, *Ver*, *Imagen*, *Opciones*, *Ayuda*).
   - **Caja de 13 Herramientas Clásicas**:
     - Borrador / Goma de color (usa Color 2 / Secundario)
     - Relleno con color (Bote de pintura)
     - Cuentagotas (Seleccionar color)
     - Lupa / Ampliación
     - Lápiz (con temblor de squigglevision)
     - Pincel (puntas redondas, cuadradas y diagonales)
     - Aerógrafo (Spray de partículas temblorosas)
     - Texto (tipografías retro para afiches)
     - Línea y Curva
     - Rectángulo, Rectángulo redondeado y Elipse
   - Sub-panel contextual inferior según la herramienta activa (grosores, formas de pincel, tamaños de goma, modos de relleno).
   - Muestrario de Color 1 y Color 2 superpuestos y paleta de dos filas con los 12 colores oficiales.

3. **Optimizaciones Extremas para Computadoras de 2005 (Pentium 4 / 256 MB RAM)**:
   - **Búfer de 4 Cuadros Pre-renderizados**: el motor genera los 4 cuadros de temblor en lienzos en memoria una sola vez al terminar cada trazo; el bucle de animación a 8 FPS se reduce a un único `drawImage` (un blit instantáneo de 256x256), consumiendo prácticamente **0% de CPU**.
   - **Tablas Trigonométricas Precalculadas (`fastSin` / `fastCos`)**: sustituye llamadas continuas a `Math.sin` y `Math.cos` por una tabla de 512 valores con máscaras a nivel de bits, ideal para navegadores de 2005 sin compiladores JIT.
   - **Bresenham en Bucle Directo**: dibuja píxel por píxel sin crear arreglos intermedios ni objetos `{x,y}`, eliminando pausas por recolección de basura (*Garbage Collection*).
   - **Caché de Texto Rasterizado**: prerenderiza el texto con su borde negro y relleno a un lienzo en memoria para evitar escanear miles de píxeles en cada cuadro.
   - **ES3/ES5 Estricto y 100% Offline**: sin dependencias ni CDNs, compatible con Firefox 1.5, Opera 9 y navegadores con soporte inicial de Canvas.

4. **Exportación con Vecino Más Cercano (Nearest Neighbor)**:
   - Escalado estricto sin desenfoque ni suavizado (`imageSmoothingEnabled = false`):
     - **1x**: `256 x 256 px` (Pixel art original)
     - **2x**: `512 x 512 px` (Estándar web)
     - **4x**: `1024 x 1024 px` (Flyer para Instagram / Redes Sociales)
     - **8x**: `2048 x 2048 px` (Afiche gigante impreso de alta resolución)
   - Formatos: **PNG** ultra nítido, **GIF Animado** en bucle continuo con las líneas bailando, **Video WebM** y **Proyecto JSON**.

5. **Paleta Oficial de 12 Colores de VUELAPELUCAS 3000**:
   - `#ffffff` (Blanco)
   - `#000000` (Negro)
   - `#ffd62c` (Amarillo Vuelapelucas)
   - `#ef4720` (Rojo Fuego)
   - `#0e75fe` (Azul Eléctrico)
   - `#f5abd0` (Rosa Chicle)
   - `#6cfeb3` (Verde Menta Neón)
   - `#229cff` (Celeste Cian)
   - `#9c51f2` (Violeta Cósmico)
   - `#04ba63` (Verde Esmeralda)
   - `#c2612c` (Naranja Teja)
   - `#ffab00` (Ámbar Dorado)

---

## 🚀 Cómo Ejecutar

Abre el archivo [index.html](file:///C:/Users/Pancho/.gemini/antigravity/scratch/vuelapelucas-3000/index.html) en cualquier navegador web.

---

## ⌨️ Atajos de Teclado de Windows 95 Paint

- `P`: Lápiz
- `B`: Pincel
- `E`: Borrador / Goma
- `G`: Bote de pintura (Relleno)
- `T`: Texto
- `Ctrl + Z`: Deshacer
- `Ctrl + Y`: Rehacer
- `Ctrl + E`: Exportar (PNG, GIF, Video)
- `Ctrl + S`: Guardar proyecto
- `Espacio`: Pausar / Reanudar temblor
