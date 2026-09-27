@echo off
echo ===================================================
echo [1/2] CONFIGURACION DE CLAVE SSH (Solo 1 vez en la vida)
echo ===================================================
echo.
echo Vamos a generar una llave de seguridad para que nunca mas
echo tengas que poner contrasena al VPS.
echo.

if not exist "%USERPROFILE%\.ssh\id_rsa" (
    echo Generando una nueva llave SSH en tu PC...
    ssh-keygen -t rsa -b 4096 -N "" -f "%USERPROFILE%\.ssh\id_rsa"
) else (
    echo ¡Ya existe una llave SSH generada en tu sistema!
)

echo.
echo ===================================================
echo [2/2] PASANDO LA LLAVE AL VPS
echo ===================================================
echo ATENCION: Por ultima vez, la consola te pedira la contrasena del VPS.
echo Si te solicita clave, ingresa la contrasena root del VPS.

type "%USERPROFILE%\.ssh\id_rsa.pub" | ssh -p 5752 root@149.50.139.152 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"

echo.
echo ===================================================
echo ¡LISTO! Configuracion SSH Terminada.
echo ===================================================
pause
