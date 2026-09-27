@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo INICIANDO PROCESO COMPLETO DE DEPLOY: VUELAPELUCAS 3000
echo ===================================================

:: 1. Cargar variables de entorno desde .env
set "ENV_FILE=%~dp0..\.env"
if exist "%ENV_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
        set "KEY=%%A"
        set "VAL=%%B"
        if not "!KEY!"=="" (
            if not "!KEY:~0,1!"=="#" (
                set "!KEY!=!VAL!"
            )
        )
    )
)

if "%VPS_HOST%"=="" set VPS_HOST=149.50.139.152
if "%VPS_PORT%"=="" set VPS_PORT=5752
if "%VPS_USER%"=="" set VPS_USER=root
if "%FTP_HOST%"=="" set FTP_HOST=c1700065.ferozo.com

:: 2. Auto-commit y push a GitHub antes de desplegar
echo.
echo [1/3] VERIFICANDO REPOSITORIO LOCAL Y PUSH A GITHUB...
cd /d "%~dp0.."
git status --porcelain > "%temp%\vp_git_status.txt"
for %%I in ("%temp%\vp_git_status.txt") do set SIZE=%%~zI
if %SIZE% GTR 0 (
    echo Hay cambios locales sin comitear. Guardando y subiendo a GitHub...
    git add .
    git commit -m "Deploy vuelapelucas3000: %date% %time%"
    git push origin main
) else (
    echo Repositorio local limpio. Asegurando push a origin main...
    git push origin main
)

:: 3. Despliegue en el VPS por SSH
echo.
echo [2/3] DESPLEGANDO EN EL VPS (%VPS_HOST%:%VPS_PORT%) POR SSH...
echo Conectando como %VPS_USER% y actualizando vuelapelucas3000...
echo.
ssh -p %VPS_PORT% %VPS_USER%@%VPS_HOST% "mkdir -p /root/vuelapelucas3000 && cd /root/vuelapelucas3000 && [ -f .env ] && cp .env /tmp/.env_vp_bak ; (git remote set-url origin git@github.com:jpupper/vuelapelucas3000.git 2>/dev/null || (git init && git remote add origin git@github.com:jpupper/vuelapelucas3000.git)) && git fetch origin main && git reset --hard origin/main && [ -f /tmp/.env_vp_bak ] && cp /tmp/.env_vp_bak .env ; bash deploy_scripts/server_update.sh"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ADVERTENCIA] El despliegue en VPS reportó algún aviso. Revisa la salida arriba.
)

:: 4. Subida de frontend al FTP
echo.
echo [3/3] SUBIENDO ARCHIVOS DE FRONTEND AL FTP (%FTP_HOST%)...
node "%~dp0upload_ftp.js"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Falló la subida por FTP. Revisa los detalles arriba.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo ¡DEPLOY DE VUELAPELUCAS 3000 FINALIZADO CON EXITO!
echo Backend actualizado en VPS (PM2 vuelapelucas3000)
echo Frontend sincronizado en FTP (%FTP_HOST%)
echo ===================================================
pause
