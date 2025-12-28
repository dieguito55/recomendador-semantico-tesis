# Guía de Implementación: PostgreSQL (Docker Compose) + Pipeline + API + Extensión Chrome

> Esta guía resume el flujo completo para: levantar PostgreSQL, crear el esquema, ejecutar el pipeline (harvest → index → topics), levantar la API y cargar la extensión en Chrome.

---

## 2) Levantar PostgreSQL con Docker Compose

### 2.1 Crear el archivo `docker-compose.yml`

Guarda este contenido en la raíz del proyecto:

```yaml
services:
  db:
    image: postgres:16
    container_name: unap_postgres
    environment:
      POSTGRES_USER: unap
      POSTGRES_PASSWORD: unap123
      POSTGRES_DB: unap_repo
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U unap -d unap_repo"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
```

### 2.2 Iniciar el servicio

Desde la carpeta donde está el `docker-compose.yml`:

```bash
docker compose up -d
```

### 2.3 Verificar que PostgreSQL esté “healthy”

```bash
docker ps
```

Debe aparecer `unap_postgres` en estado **Up** (idealmente con **healthy**).

---

## 3) Conectarse a PostgreSQL (dentro del contenedor)

Abrir consola `psql`:

```bash
docker exec -it unap_postgres psql -U unap -d unap_repo
```

Desde aquí ya puedes ejecutar los `CREATE TABLE` y `CREATE INDEX`.

---

## 4) Crear el esquema de base de datos

**Recomendación:** ejecutar en este orden porque hay llaves foráneas (`embeddings`, `clusters`) que dependen de `items`.

### 4.1 Parte 1: Tabla `items`

Ejecutar en `psql`:

```sql
CREATE TABLE IF NOT EXISTS items (
  uuid          TEXT PRIMARY KEY,
  handle        TEXT,
  url           TEXT,
  title         TEXT,
  abstract      TEXT,

  abstract_norm TEXT,
  date_issued   TEXT,
  authors       JSONB,
  advisors      JSONB,
  keywords      JSONB,
  text_hash     TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);
CREATE INDEX IF NOT EXISTS idx_items_date_issued ON items(date_issued);
```

**Objetivo del `text_hash`:** permitir “upsert inteligente” (si cambió el contenido, se recalcula embedding; si no, se omite).

---

### 4.2 Parte 2: Tabla `embeddings`

Ejecutar:

```sql
CREATE TABLE IF NOT EXISTS embeddings (
  uuid         TEXT PRIMARY KEY REFERENCES items(uuid) ON DELETE CASCADE,
  model_name   TEXT NOT NULL,
  dim          INT NOT NULL,
  embedding    BYTEA NOT NULL,      -- vector float32 serializado
  text_hash    TEXT NOT NULL,       -- hash del item cuando se calculó
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model_name);
```

**Notas técnicas:**
- `embedding` se guarda como `BYTEA` (vector serializado float32).
- `ON DELETE CASCADE`: si borras un item, se borra su embedding.

---

### 4.3 Parte 3: Tablas de clustering (`clusters` y `cluster_labels`)

#### 4.3.1 Tabla `clusters`

```sql
CREATE TABLE IF NOT EXISTS clusters (
  uuid          TEXT PRIMARY KEY REFERENCES items(uuid) ON DELETE CASCADE,
  model_name    TEXT NOT NULL,
  umap_dim      INT NOT NULL,
  cluster_id    INT NOT NULL,            -- -1 = outlier (ruido)
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clusters_cluster_id ON clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_clusters_model ON clusters(model_name);
```

#### 4.3.2 Tabla `cluster_labels`

```sql
CREATE TABLE IF NOT EXISTS cluster_labels (
  model_name    TEXT NOT NULL,
  cluster_id    INT NOT NULL,
  label         TEXT NOT NULL,
  keywords      JSONB,
  size          INT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_name, cluster_id)
);
```

---

## 5) Campo adicional: `university` en `items`

Ejecutar:

```sql
ALTER TABLE items ADD COLUMN IF NOT EXISTS university TEXT;
CREATE INDEX IF NOT EXISTS idx_items_university ON items(university);
```

---

## 6) Ejecutar el pipeline (harvest → semantic index → topics)

> Antes de correr scripts, asegúrate de estar en la raíz del proyecto y con el entorno virtual activo.

### 6.1 Activar el entorno virtual (ejemplo)
```bash
cd "/mnt/d/.../unap-reco"
source .venv/bin/activate
```

### 6.2 Asegurar conexión a la base de datos local

Si estás usando el Postgres local (Docker), fuerza esta variable:

```bash
export DATABASE_URL="postgresql://unap:unap123@localhost:5432/unap_repo"
```

> **Tip:** si antes tenías `DATABASE_URL` apuntando a Supabase, primero limpia:
```bash
unset DATABASE_URL
export DATABASE_URL="postgresql://unap:unap123@localhost:5432/unap_repo"
```

### 6.3 Correr scripts en orden

1) **Harvest/ingesta** (extrae metadatos y los inserta/actualiza en `items`):
```bash
python 01.harvest_multi.py
```

2) **Indexación semántica** (calcula embeddings, crea/actualiza índice FAISS y mapeos):
```bash
python 02.semantic_indexer.py
```

3) **Clustering y tópicos** (genera clusters, y etiquetas/keywords por cluster):
```bash
python 03.build_topics_hdbscan.py
```

> Si alguno falla, revisa el log que imprime el script; normalmente es por:
> - dependencia faltante en `.venv`
> - base de datos apagada / `DATABASE_URL` incorrecta
> - archivos de modelos/índices no generados aún (si intentas saltarte pasos)

---

## 7) Levantar la API FastAPI (Uvicorn)

Una vez que el pipeline terminó (y ya existe el índice/embeddings), levanta la API:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verifica:
- Swagger UI: `http://localhost:8000/docs`
- OpenAPI: `http://localhost:8000/openapi.json`

---

## 8) Cargar la extensión en Google Chrome

1) Abre Chrome y ve a:
- **chrome://extensions**

2) Activa:
- **Modo de desarrollador** (Developer mode)

3) Click en:
- **Load unpacked** (Cargar sin empaquetar)

4) Selecciona la carpeta de la extensión (la que contiene `manifest.json`, `service_worker.js`, `content.js`, etc.)

5) Asegúrate de que en tu `manifest.json` tengas permisos para llamar a tu API local (ejemplo):
- `http://localhost:8000/*`
- `http://127.0.0.1:8000/*`

6) Entra a un ítem del repositorio:
- `https://repositorio.unap.edu.pe/...`

7) Haz clic en el ícono de la extensión para abrir el panel.

---

## 9) Checklist final

- [ ] `docker compose up -d` (Postgres arriba)
- [ ] Tablas creadas (`items`, `embeddings`, `clusters`, `cluster_labels`)
- [ ] `python 01.harvest_multi.py` OK
- [ ] `python 02.semantic_indexer.py` OK
- [ ] `python 03.build_topics_hdbscan.py` OK
- [ ] `python -m uvicorn ...` OK y `/docs` abre
- [ ] Extensión cargada en Chrome (Load unpacked) y puede llamar a la API local
