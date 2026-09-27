@echo off
echo ============================================
echo  VUELAPELUCAS 3000 - Instalador
echo ============================================
echo.

echo [1/3] Verificando Node.js...
node -v >nul 2>&1 || (echo [ERROR] Node.js no instalado. & pause & exit /b 1)

echo [2/3] Instalando dependencias...
call npm install || (echo [ERROR] Fallo npm install. & pause & exit /b 1)

if not exist .env (
    echo [3/3] Creando .env desde .env.example...
    copy .env.example .env
) else (
    echo [3/3] .env ya existe.
)
echo.
echo Instalacion completada. Ejecuta: run.bat
pause