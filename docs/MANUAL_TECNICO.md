# Manual tecnico

## 1. Descripcion general

El Sistema Recomendador Semantico de Tesis Universitarias es una aplicacion de aprendizaje automatico orientada a recuperacion semantica de documentos academicos.

El flujo tecnico es:

```text
Repositorios DSpace
  -> scripts/01.harvest_multi.py
  -> PostgreSQL/items
  -> scripts/02.semantic_indexer.py
  -> PostgreSQL/embeddings + models_semantic/faiss.index
  -> scripts/03.build_topics_hdbscan.py
  -> PostgreSQL/clusters + cluster_labels
  -> app/main.py
  -> extension/
```

## 2. Componentes

### Backend API

Ubicacion: `app/`

- `main.py`: define endpoints REST, modelos Pydantic y enriquecimiento de resultados desde PostgreSQL.
- `recommender.py`: carga el modelo `SentenceTransformer`, el indice FAISS y ejecuta busquedas vectoriales.
- `db.py`: administra conexiones PostgreSQL mediante `psycopg2`.
- `pipeline.py`: utilidad para ejecutar scripts desde procesos controlados.

### Base de datos

Ubicacion: `database/schema.sql`

Tablas:

- `items`: metadatos normalizados de tesis.
- `embeddings`: vectores serializados en `BYTEA`.
- `clusters`: asignacion de cada tesis a un cluster tematico.
- `cluster_labels`: etiquetas y palabras clave por cluster.

### Pipeline de procesamiento

Ubicacion: `scripts/`

- `01.harvest_multi.py`: cosecha datos desde repositorios configurados.
- `02.semantic_indexer.py`: calcula embeddings y genera indice FAISS.
- `03.build_topics_hdbscan.py`: reduce dimensionalidad con UMAP, agrupa con HDBSCAN y etiqueta con TF-IDF.

### Extension de navegador

Ubicacion: `extension/`

Extension Manifest V3 para navegadores Chromium. Inyecta un panel sobre paginas compatibles y consume la API local o remota.

## 3. Variables de entorno

Crear `.env` desde `.env.example`.

Variables principales:

```text
DATABASE_URL=postgresql://unap:unap123@localhost:5432/unap_repo
MODEL_DIR=models_semantic
MODEL_NAME=BAAI/bge-m3
EMBED_DEVICE=cpu
USE_FAISS_GPU=0
```

Para GPU NVIDIA:

```text
EMBED_DEVICE=cuda
USE_FAISS_GPU=1
```

FAISS GPU requiere una instalacion compatible adicional; si no esta disponible, el sistema puede operar en CPU.

## 4. Instalacion

Arranque automatico en Windows:

```text
bin/INICIAR_RECOMENDADOR.cmd
```

El ejecutable crea `.env` si no existe, prepara `.venv`, instala dependencias, levanta PostgreSQL con Docker Compose e inicia Uvicorn.

Instalacion manual:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
docker compose up -d
```

Si la base ya existia y Docker no ejecuto el SQL inicial:

```bash
Get-Content database/schema.sql | docker exec -i unap_postgres psql -U unap -d unap_repo
```

## 5. Ejecucion del pipeline

Ejecutar en orden:

```bash
python scripts/01.harvest_multi.py
python scripts/02.semantic_indexer.py
python scripts/03.build_topics_hdbscan.py --reset-db
```

Resultado esperado:

- Registros en `items`.
- Registros en `embeddings`.
- Archivos `models_semantic/faiss.index`, `models_semantic/uuid_map.json` y `models_semantic/meta.json`.
- Registros en `clusters` y `cluster_labels`.

## 6. Ejecucion de API

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verificacion:

```text
GET http://localhost:8000/health
```

Respuesta esperada:

```json
{
  "ok": true,
  "model": "BAAI/bge-m3",
  "device": "cpu"
}
```

## 7. Contrato de recomendacion

Endpoint:

```text
POST /recommend
```

Entrada:

```json
{
  "text": "sistema de recomendacion para tesis universitarias",
  "k": 10,
  "include_abstract": true,
  "same_topic": true,
  "same_topic_k": 10
}
```

Salida principal:

- `model_name`: modelo semantico usado.
- `inferred_topic`: cluster inferido desde el primer resultado.
- `results`: tesis similares.
- `same_topic`: tesis adicionales del mismo tema.

## 8. Consideraciones de seguridad

- No versionar `.env`.
- Cambiar credenciales por defecto antes de despliegue real.
- Restringir CORS en ambientes publicos.
- Revisar permisos de `host_permissions` en la extension antes de publicarla.
- Los datos cosechados desde repositorios institucionales deben respetar condiciones de uso de cada fuente.

## 9. Preparacion para entrega formal

Checklist recomendado:

- `git status` limpio.
- Version etiquetada como `v1.0.0-registro`.
- README actualizado.
- `docs/MANUAL_TECNICO.md` y `docs/MANUAL_USUARIO.md` incluidos.
- `database/schema.sql` incluido.
- `.env.example` incluido, sin secretos reales.
- Artefactos pesados adjuntos como release separado si son requeridos.
