@echo off
cd /d "%~dp0"
if not exist "node_modules" (
  echo Instalando dependencias del frontend...
  npm install
  if errorlevel 1 (
    echo ERROR: No se pudieron instalar las dependencias npm.
    pause
    exit /b 1
  )
)
echo Iniciando interfaz VISION AI en http://localhost:5173
npm run dev
pause
