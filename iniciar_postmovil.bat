@echo off
:: Asegurar que el directorio de trabajo es el del BAT, incluso como Administrador
cd /d "%~dp0"

title POSTMOVIL - Servidor de Desarrollo
color 0B

echo ========================================================
echo         INICIANDO EL SISTEMA POSTMOVIL
echo ========================================================
echo.
echo 1. Abriendo tu navegador web predeterminado...
echo 2. Levantando el motor de Ionic y base de datos...
echo.
echo *** POR FAVOR NO CIERRES ESTA VENTANA NEGRA ***
echo.

:: Abre el navegador apuntando a la ruta de Vite
start http://localhost:5173

:: Inicia el servidor de desarrollo
call npm run dev

pause
