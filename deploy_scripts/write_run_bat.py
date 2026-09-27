import io, os

PROJ = r'D:\Programacion\vuelapelucas3000'

# Limpieza en UN solo llamado a PowerShell: sin pipes ni comillas escapadas (cmd rompe el parseo).
# Se ejecuta ANTES de matar nada, porque necesita el arbol de procesos vivo para subir hasta
# el padre nodemon/npm (si ya matamos el hijo, Windows borra el PID y no hay a quien consultar).
PS_LIMPIEZA = (
    'powershell -NoProfile -Command "'
    '$raiz = \'%~dp0\'; '
    '$puerto = %PORT%; '
    '$todos = @{}; '
    'foreach ($x in (Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) { $todos[[int]$x.ProcessId] = $x }; '
    '$duenos = @(); '
    'foreach ($c in (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue)) { '
    '$op = [int]$c.OwningProcess; if ($op -gt 0 -and -not ($duenos -contains $op)) { $duenos += $op } }; '
    'foreach ($k in @($todos.Keys)) { '
    '$x = $todos[$k]; '
    'if ($x.Name -eq \'node.exe\' -and $x.CommandLine -and $x.CommandLine.Contains($raiz)) { '
    'Write-Host (\'    - matando nodemon/npm huerfano PID \' + $x.ProcessId); '
    'Stop-Process -Id $x.ProcessId -Force -ErrorAction SilentlyContinue } }; '
    'foreach ($d in $duenos) { '
    'Write-Host (\'    - matando lo que escucha en el puerto: PID \' + $d); '
    'Stop-Process -Id $d -Force -ErrorAction SilentlyContinue; '
    '$cur = $d; '
    'for ($i = 0; $i -lt 6; $i++) { '
    'if (-not $todos.ContainsKey($cur)) { break }; '
    '$par = [int]$todos[$cur].ParentProcessId; '
    'if (-not $par) { break }; '
    'if ($todos.ContainsKey($par) -and $todos[$par].Name -eq \'node.exe\') { '
    'Write-Host (\'    - matando padre node PID \' + $par); '
    'Stop-Process -Id $par -Force -ErrorAction SilentlyContinue }; '
    '$cur = $par } }; '
    'if ($duenos.Count -eq 0) { Write-Host \'    (nada escuchando en el puerto)\' }" 2>nul'
)

PS_CHECK = (
    'powershell -NoProfile -Command "'
    '$raiz = \'%~dp0\'; '
    'foreach ($x in (Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) { '
    'if ($x.Name -eq \'node.exe\' -and $x.CommandLine -and $x.CommandLine.Contains($raiz)) { '
    'Write-Host (\'    [WARN] sigue vivo PID \' + $x.ProcessId) } }" 2>nul'
)

lines = [
    '@echo off',
    'rem ==========================================================================',
    'rem  VUELAPELUCAS 3000 - Arranque del servidor local',
    'rem  Cada vez que se abre, primero limpia lo anterior:',
    'rem    [1/3] mata lo que este escuchando en el puerto + nodemon/npm huerfanos',
    'rem          de este proyecto (si no, reaccionan al guardar un archivo y',
    'rem          vuelven a robar el puerto)',
    'rem    [2/3] chequeo extra con netstat + taskkill',
    'rem    [3/3] verifica que el puerto quedo libre antes de arrancar',
    'rem ==========================================================================',
    'setlocal enabledelayedexpansion',
    '',
    'if not exist .env (echo [ERROR] Falta .env. Ejecuta install.bat primero. & pause & exit /b 1)',
    'if not exist node_modules (echo [ERROR] Falta node_modules. Ejecuta install.bat primero. & pause & exit /b 1)',
    '',
    'rem --- Puerto del servidor (se lee de .env, default 4000) ---',
    'set "PORT=4000"',
    'for /f "usebackq tokens=1,* delims==" %%A in (".env") do (',
    '    if /i "%%A"=="PORT" set "PORT=%%B"',
    ')',
    '',
    'echo ============================================',
    'echo  VUELAPELUCAS 3000 - Iniciando servidor',
    'echo ============================================',
    'echo.',
    '',
    'rem --- [1/3] Limpieza (con el arbol de procesos todavia vivo) ---',
    'echo  [1/3] Limpiando procesos anteriores del puerto %PORT%...',
    PS_LIMPIEZA,
    '%SystemRoot%\\System32\\timeout.exe /t 1 /nobreak >nul 2>&1',
    '',
    'rem --- [2/3] Chequeo extra: netstat + taskkill por si quedo algo ---',
    'echo  [2/3] Chequeo extra con netstat + taskkill...',
    'set "KILLED=0"',
    'for /f "tokens=5" %%a in (\'netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING\') do (',
    '    echo    - matando PID %%a',
    '    taskkill /F /PID %%a >nul 2>&1',
    '    set "KILLED=1"',
    ')',
    'if "!KILLED!"=="0" echo    (nada mas escuchando en %PORT%)',
    '',
    'rem --- [3/3] Verificacion: el puerto tiene que quedar libre ---',
    'echo  [3/3] Verificando que el puerto %PORT% quede libre...',
    'set "LIBRE=1"',
    'for /f "tokens=5" %%a in (\'netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING\') do set "LIBRE=0"',
    'if "!LIBRE!"=="0" (',
    '    echo    [WARN] El puerto %PORT% sigue ocupado. Cerra esa ventana y volve a intentar.',
    '    pause',
    '    exit /b 1',
    ')',
    'echo    OK - puerto %PORT% libre',
    PS_CHECK,
    '',
    'echo.',
    'echo  Abrir en el navegador:',
    'echo  http://localhost:%PORT%/vuelapelucas3000_2',
    'echo.',
    'echo ============================================',
    'call npm run dev',
    'pause',
    '',
]

with io.open(os.path.join(PROJ, 'run.bat'), 'w', encoding='utf-8', newline='\r\n') as f:
    f.write('\n'.join(lines))
raw = open(os.path.join(PROJ, 'run.bat'), 'rb').read()
print('run.bat escrito:', raw.count(b'\r\n'), 'lineas CRLF |', len(raw), 'bytes')
