@echo off
title Deriv Trader Server
echo ================================================
echo   Deriv Trader - Iniciando servidor
echo ================================================
echo.

REM Check if already running
tasklist /FI "WINDOWTITLE eq Deriv Trader Server - Worker" 2>NUL | find /I "cmd.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo El servidor ya parece estar corriendo.
    echo Abre: http://localhost:5000
    pause
    exit
)

pip install -r requirements.txt --quiet

REM Start server in a separate minimizable window
start "Deriv Trader Server - Worker" /MIN python app.py

echo.
echo   Servidor iniciado en ventana minimizada
echo   Puedes minimizar o usar esta ventana libremente
echo.
echo   Abre en tu navegador: http://localhost:5000
echo.
echo   Para detener: cierra la ventana "Deriv Trader Server - Worker"
echo.
pause
