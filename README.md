# Sistema Recomendador Semantico de Tesis Universitarias

Software academico para cosechar, indexar, agrupar y recomendar tesis universitarias mediante tecnicas de aprendizaje automatico, embeddings semanticos y busqueda vectorial.

El sistema integra una API en FastAPI, una base de datos PostgreSQL, scripts de procesamiento semantico y una extension de navegador para consultar recomendaciones dentro de repositorios institucionales compatibles.

## Autores

- Jhon Aracayo
- Juan Diego Canaza
- Ximara Aquino
- Vanessa Castro

## Objetivo

Facilitar la exploracion de trabajos academicos relacionados a partir de un titulo, resumen, texto de consulta o tesis abierta en el navegador. El sistema compara significado semantico, no solo coincidencias exactas de palabras.

## Funcionalidades principales

- Cosecha de metadatos desde repositorios DSpace compatibles.
- Almacenamiento estructurado en PostgreSQL.
- Generacion de embeddings con `BAAI/bge-m3`.
- Construccion de indice FAISS para busqueda semantica.
- Agrupamiento tematico con UMAP y HDBSCAN.
- Etiquetado de temas mediante TF-IDF.
- API REST para recomendaciones, detalles de tesis y temas.
- Extension de navegador para recomendaciones desde repositorios web.

## Estructura del repositorio

```text
app/                 API FastAPI y motor de recomendacion
database/            Esquema SQL reproducible
docs/                Manuales y material para registro de software
extension/           Extension de navegador Chromium
models_semantic/     Artefactos generados del indice semantico
scripts/             Pipeline de cosecha, embeddings y clustering
docker-compose.yml   Servicio PostgreSQL local
requirements.txt     Dependencias Python
.env.example         Variables de entorno de referencia
```

Documentacion principal:

- [Manual tecnico](docs/MANUAL_TECNICO.md)
- [Manual de usuario](docs/MANUAL_USUARIO.md)
- [Preparacion para registro de software](docs/REGISTRO_SOFTWARE.md)

## Requisitos

- Python 3.10 o superior.
- Docker y Docker Compose.
- Google Chrome, Microsoft Edge o navegador Chromium compatible.
- Memoria suficiente para cargar el modelo semantico. GPU CUDA es opcional.

## Instalacion rapida

1. Crear entorno virtual e instalar dependencias:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Copiar variables de entorno:

```bash
copy .env.example .env
```

3. Levantar PostgreSQL:

```bash
docker compose up -d
```

4. Crear esquema si el volumen ya existia antes de agregar `database/schema.sql`:

```bash
Get-Content database/schema.sql | docker exec -i unap_postgres psql -U unap -d unap_repo
```

5. Ejecutar el pipeline:

```bash
python scripts/01.harvest_multi.py
python scripts/02.semantic_indexer.py
python scripts/03.build_topics_hdbscan.py --reset-db
```

6. Levantar API:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

7. Verificar:

```text
http://localhost:8000/health
http://localhost:8000/docs
```

## Extension de navegador

1. Abrir `chrome://extensions/`.
2. Activar modo desarrollador.
3. Seleccionar "Cargar sin empaquetar".
4. Elegir la carpeta `extension/`.
5. Abrir una pagina compatible del repositorio institucional y activar el panel desde el icono de la extension.

## Endpoints principales

- `GET /health`: estado de API, modelo y dispositivo.
- `POST /recommend`: recomendaciones semanticas.
- `GET /items/{uuid}`: detalle de una tesis.
- `GET /topics/top`: temas principales detectados.
- `GET /topics/{cluster_id}`: tesis asociadas a un tema.

## Notas para registro de software

Este repositorio contiene el codigo fuente principal, estructura de base de datos, manual tecnico, manual de usuario y archivos de configuracion necesarios para reproducir el sistema. Los artefactos generados de modelo e indice pueden adjuntarse como evidencia complementaria o publicarse como release separado.

Revisar tambien [docs/REGISTRO_SOFTWARE.md](docs/REGISTRO_SOFTWARE.md).

Antes de presentar una version oficial, se recomienda crear una etiqueta Git:

```bash
git status
git add .
git commit -m "Preparar version formal para registro de software"
git tag -a v1.0.0-registro -m "Version para registro de software"
git push origin main --tags
```
