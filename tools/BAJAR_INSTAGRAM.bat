@echo off
REM Baja TODAS las imagenes de Instagram de @vuelapelucas3000 y arma la
REM seccion COMMUNITY CREATION de la pagina.
REM
REM Como usarlo:
REM   1) Cerrá Chrome y Edge (si estan abiertos, la base de cookies esta
REM      bloqueada y no se puede leer la sesion de Instagram).
REM   2) Doble clic en este archivo y deja la ventana abierta.
REM
REM El script espera hasta 30 minutos a que sueltes los navegadores.
cd /d "%~dp0.."
echo ============================================================
echo   VUELAPELUCAS 3000 - Descarga de Instagram
echo ============================================================
echo.
echo Cerrá Chrome y Edge si los tenes abiertos. Espero hasta 30 min...
echo.
".venv-media\Scripts\python.exe" tools\ig_now.py --wait-min 30
echo.
echo Terminado. Revisá public\img\flyers\
pause
