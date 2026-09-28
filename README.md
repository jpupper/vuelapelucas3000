# vuelapelucas3000

Sitio oficial de Vuelapelucas 3000 (encuentro de artistas, Victorica, La Pampa).

- Frontend: `public/` (estático: `index.html`, `hospedajes.html`, `anotate.html`, CSS y JS).
- Backend: `server.js` (Express + Mongo, API de inscripciones en `routes/`).
- Deploy del frontend: FTP Ferozo → `FTP_REMOTE_BASE` del `.env`
  (`/public_html/vuelapelucas3000` ⇒ https://fullscreencode.com/vuelapelucas3000/).

## Pipeline de imágenes (2026)

Todo se genera con Python. El entorno de trabajo vive en `.venv-media/`
(no se commitea; se crea con `uv venv .venv-media --python 3.11`).

```bash
uv pip install --python .venv-media/Scripts/python.exe \
    pillow pillow-heif numpy imageio "rembg[cpu]" playwright curl_cffi pycryptodome gallery-dl instaloader
.venv-media/Scripts/python.exe -m playwright install chromium
```

| Paso | Comando | Salida |
|---|---|---|
| 1. Renombrar **todas** las fotos de `assetsraw/` y armar la galería web | `tools/build_gallery.py --max 1600 --q 82` | `public/img/galeria/NNN_AAAA__slug.jpg` + `_thumbs/` + `manifest.json` |
| 2. GIF recortando **solo personas** de un video | `tools/make_gif.py --in video.MOV --out public/img/vuelapelucas-cutout.gif --width 380 --fps 8 --colors 128` | GIF con el fondo eliminado (`rembg u2net_human_seg`) |
| 3. Iconos/imágenes de la UI + capturas de los juegos | `tools/build_ui_assets.py` | `public/img/ico-*.jpg`, `card-*.jpg`, `juegos/*.jpg` |
| 4. Fotos del Instagram del festival | `tools\BAJAR_INSTAGRAM.bat` | `public/img/flyers/` + `manifest.json` |
| 5. Deploy | `tools/ftp_deploy.py` | sube `public/` al hosting (idempotente: compara tamaños) |

### Esquema de nombres de la galería

`assetsraw/2022/IMG_20221218_133536683_HDR.jpg` → `002_2022__img-20221218-133536683-hdr.jpg`

- `NNN` = orden dentro de la galería (por año, y dentro del año por score de
  nitidez/color/tamaño).
- `AAAA` = año detectado del nombre o de la carpeta.
- Se descartan duplicados exactos (mismo hash perceptual y mismo año).
- La web usa `public/img/galeria/manifest.json` (lo consume `public/js/galeria.js`).

### Instagram (COMMUNITY CREATION)

Instagram hoy exige sesión para leer un perfil completo. Probado y descartado:

- `gallery-dl` / `instaloader` anónimos → **401 require_login**.
- Visores tipo dumpor / greatfon / picuki / imginn / picnob / piokok / imgsed / smiHub
  (~30 probados) → Cloudflare **Turnstile** o 404.
- Chromium headless (y Chrome real automatizado) sin cookies → **detectado como bot**.
- `https://www.instagram.com/<user>/` sin login → sólo expone **los 12 posts más nuevos**
  (la cuenta tiene 192). El resto necesita sesión.
- La base `Cookies` de Chrome/Edge está **bloqueada mientras el navegador corre**
  (`ERROR_SHARING_VIOLATION`; también falla `esentutl /y`). Se destraba sólo cerrando el navegador.

Por eso hay tres caminos:

1. **Posts puntuales (sin login):** `tools/ig_posts.py --urls-file work/flyer_urls.txt`
   baja los posts que le pasemos por URL (acepta `/p/<code>/`, ignora `?img_index`),
   usando el endpoint público de embed `/p/<code>/embed/captioned/`. **Respeta los
   carruseles completos** (los hijos vienen en `edge_sidecar_to_children` →
   `display_url`, hay que des-escapar el JSON dos veces). Deja los archivos en
   `work/ig_embed/`.
2. **Cosecha de links:** `tools/ig_harvest_codes.py` busca en DuckDuckGo/Bing los
   posts del perfil y junta los shortcodes en `work/harvest_codes.txt`
   (limitado: los buscadores indexan una parte).
3. **Todo el perfil (con sesión):** cerrar Chrome y Edge y correr
   `tools\BAJAR_INSTAGRAM.bat`. El script espera a que sueltes los navegadores,
   extrae la cookie con `tools/chrome_cookies.py`, baja **toda** la cuenta con
   `gallery-dl` y rearma `public/img/flyers/manifest.json`.

Después de cualquiera de los 1-2, para armar la carpeta final:

```bash
python tools/ig_download.py --from-dir work/ig_embed   # dedupe + webp->jpg + thumbs + manifest
```


La sección **COMMUNITY CREATION** de `index.html` se llena sola desde ese manifest
(y muestra un aviso si no existe).

