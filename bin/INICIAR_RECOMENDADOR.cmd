@echo off
setlocal

cd /d "%~dp0.."

echo ================================================
echo  Sistema Recomendador Semantico de Tesis
echo ================================================
echo.

if not exist ".env" (
  if exist ".env.example" (
    echo Creando archivo .env desde .env.example...
    copy ".env.example" ".env" >nul
  )
)

where docker >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker no esta instalado o no esta disponible en PATH.
  echo Instale Docker Desktop y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python no esta instalado o no esta disponible en PATH.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creando entorno virtual .venv...
  python -m venv .venv
  if errorlevel 1 (
    echo ERROR: No se pudo crear el entorno virtual.
    pause
    exit /b 1
  )
)

echo Instalando/verificando dependencias...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: No se pudieron instalar las dependencias.
  pause
  exit /b 1
)

echo.
echo Levantando PostgreSQL con Docker Compose...
docker compose up -d
if errorlevel 1 (
  echo ERROR: No se pudo iniciar PostgreSQL.
  pause
  exit /b 1
)

if not exist "models_semantic\faiss.index" (
  echo.
  echo ADVERTENCIA: No se encontro models_semantic\faiss.index.
  echo Si la API no inicia, genere el indice con:
  echo   python scripts\02.semantic_indexer.py
  echo.
)

echo.
echo Iniciando API en http://localhost:8000
echo Documentacion interactiva: http://localhost:8000/docs
echo.
echo Para cerrar el servidor, presione CTRL+C.
echo.

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

pause
