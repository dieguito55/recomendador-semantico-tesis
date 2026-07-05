# Ejecutable

Archivo de arranque para Windows:

```text
bin/INICIAR_RECOMENDADOR.cmd
```

Uso:

1. Abrir Docker Desktop.
2. Hacer doble clic en `INICIAR_RECOMENDADOR.cmd`.
3. Esperar a que instale dependencias, levante PostgreSQL e inicie la API.
4. Abrir `http://localhost:8000/docs`.

El archivo crea `.env` desde `.env.example` si no existe y usa un entorno virtual local `.venv`.

Nota: si el indice semantico no existe en `models_semantic/`, primero debe generarse con el pipeline indicado en `docs/MANUAL_TECNICO.md`.
