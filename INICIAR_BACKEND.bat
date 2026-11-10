@echo off
cd /d "%~dp0server"
if not exist ".venv\Scripts\python.exe" (
  echo Creando entorno virtual de Python...
  python -m venv .venv
)
call ".venv\Scripts\activate.bat"
echo Instalando o verificando dependencias YOLO...
pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: No se pudieron instalar las dependencias de Python.
  pause
  exit /b 1
)
echo Iniciando API VISION AI en http://localhost:8000
python main.py
pause
