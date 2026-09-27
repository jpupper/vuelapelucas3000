#!/bin/bash

# 1. SOLUCIÓN AL ERROR DE WINDOWS (CRLF to LF)
sed -i 's/\r$//' deploy_scripts/server_update.sh 2>/dev/null
sed -i 's/\r$//' .env 2>/dev/null

# Configuración de la aplicación
APP_NAME="vuelapelucas3000"
REPO="jpupper/vuelapelucas3000"

echo "------------------------------------------------"
echo "🚀 INICIANDO DEPLOY INTEGRAL: $APP_NAME ($REPO)"
echo "------------------------------------------------"

# 2. RESPALDO PREVENTIVO DE .ENV DEL VPS
if [ -f ".env" ]; then
    cp .env /tmp/.env_vp3000_backup
fi

# 3. INICIALIZACIÓN O ACTUALIZACIÓN DE GIT VIA SSH
if [ ! -d ".git" ]; then
    echo "📦 No se detectó Git. Inicializando repositorio..."
    git init
    git remote add origin "git@github.com:$REPO.git"
    git fetch origin main
    git checkout -f main
    git branch --set-upstream-to=origin/main main
else
    echo "🔄 Repositorio detectado. Actualizando desde GitHub..."
    git remote set-url origin "git@github.com:$REPO.git"
    git fetch origin main
    git reset --hard origin/main
fi

# Restaurar .env del VPS para que no se pierdan variables de entorno
if [ -f "/tmp/.env_vp3000_backup" ]; then
    cp /tmp/.env_vp3000_backup .env
fi

# 4. INSTALACIÓN DE DEPENDENCIAS
echo "📦 Instalando dependencias de producción..."
npm install --omit=dev

# 5. REINICIO DE PM2
echo "⚡ Reiniciando servicio PM2: $APP_NAME..."
pm2 restart "$APP_NAME" --update-env || pm2 start server.js --name "$APP_NAME"
pm2 save

echo "------------------------------------------------"
echo "✅ DEPLOY FINALIZADO CON ÉXITO EN EL VPS"
echo "------------------------------------------------"
echo "ESTADO DE LAS APLICACIONES PM2:"
pm2 list | grep -E "vuelapelucas3000|name"
echo "------------------------------------------------"
