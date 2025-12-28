#scripts/harvest_multi.py
import os
import re
import time
import json
import hashlib
import argparse
import requests
import urllib3
from tqdm import tqdm
import psycopg2
from psycopg2.extras import execute_values, Json

# Desactivar advertencias de seguridad SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- CONFIGURACIÓN DE REPOSITORIOS ---
REPOSITORIES = [
    {
        "name": "UNAP",
        "url": "https://repositorio.unap.edu.pe/server/api/discover/search/objects"
    },
    {
        "name": "UNSA",
        "url": "https://repositorio.unsa.edu.pe/server/api/discover/search/objects"
    }
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ResearchHarvester/1.0)",
    "Accept": "application/json",
}

URL_RE = re.compile(r"https?://\S+|www\.\S+")
WS_RE  = re.compile(r"\s+")

def normalize_text(s: str) -> str:
    s = s or ""
    s = URL_RE.sub(" ", s)
    s = s.replace("\u00a0", " ")
    s = WS_RE.sub(" ", s).strip()
    return s

def sha256_text(*parts: str) -> str:
    h = hashlib.sha256()
    for p in parts:
        if p:
            h.update(p.encode("utf-8"))
        h.update(b"\x1f")  # separador
    return h.hexdigest()

def get_val(meta, key):
    items = meta.get(key, [])
    if items:
        v = items[0].get("value")
        return v
    return None

def get_list(meta, key):
    items = meta.get(key, [])
    return [i.get("value") for i in items if i.get("value")]

# SQL actualizado con la columna 'university'
UPSERT_SQL = """
INSERT INTO items (
  uuid, handle, url, title, abstract, abstract_norm, date_issued,
  authors, advisors, keywords, text_hash, university
)
VALUES %s
ON CONFLICT (uuid) DO UPDATE
SET
  handle = EXCLUDED.handle,
  url = EXCLUDED.url,
  title = EXCLUDED.title,
  abstract = EXCLUDED.abstract,
  abstract_norm = EXCLUDED.abstract_norm,
  date_issued = EXCLUDED.date_issued,
  authors = EXCLUDED.authors,
  advisors = EXCLUDED.advisors,
  keywords = EXCLUDED.keywords,
  text_hash = EXCLUDED.text_hash,
  university = EXCLUDED.university,
  updated_at = now()
WHERE items.text_hash IS DISTINCT FROM EXCLUDED.text_hash
RETURNING (xmax = 0) AS inserted;
"""

def process_repository(repo_config, conn, page_size, stop_after_empty_pages, verify_ssl):
    repo_name = repo_config["name"]
    api_url = repo_config["url"]
    
    print(f"\nExample: Iniciando cosecha para: {repo_name}...")

    # 1) Obtener total de elementos para la barra de carga
    try:
        init_params = {"dsoType": "item", "page": 0, "size": 1, "sort": "dc.date.accessioned,desc"}
        r = requests.get(api_url, params=init_params, headers=HEADERS, verify=verify_ssl, timeout=30)
        r.raise_for_status()
        init_data = r.json()
        total_elements = (
            init_data.get("_embedded", {})
                    .get("searchResult", {})
                    .get("page", {})
                    .get("totalElements", 0)
        )
    except Exception as e:
        print(f"⚠️ No se pudo obtener el total para {repo_name}: {e}")
        total_elements = 0

    page = 0
    empty_pages = 0
    repo_inserted = 0
    repo_updated = 0

    pbar = tqdm(total=total_elements if total_elements > 0 else None, unit="items", desc=repo_name)

    try:
        # Usamos un cursor nuevo para cada repositorio para mantener limpieza
        with conn.cursor() as cur:
            while True:
                params = {
                    "dsoType": "item",
                    "page": page,
                    "size": page_size,
                    "sort": "dc.date.accessioned,desc",
                }

                try:
                    r = requests.get(api_url, params=params, headers=HEADERS, verify=verify_ssl, timeout=45)
                    if r.status_code != 200:
                        print(f"❌ HTTP {r.status_code} en página {page} de {repo_name}. Reintentando...")
                        time.sleep(5)
                        continue
                    
                    data = r.json()
                except Exception as e:
                    print(f"❌ Error de conexión con {repo_name}: {e}")
                    time.sleep(5)
                    continue

                search_result = data.get("_embedded", {}).get("searchResult", {})
                objects = search_result.get("_embedded", {}).get("objects", [])

                if not objects:
                    # Fin de resultados
                    break

                rows = []
                for obj in objects:
                    item = obj.get("_embedded", {}).get("indexableObject", {}) or obj.get("indexableObject", {})
                    if not item:
                        continue

                    uuid = item.get("uuid") or item.get("id")
                    handle = item.get("handle")
                    meta = item.get("metadata", {})

                    title = get_val(meta, "dc.title")
                    if not title:
                        continue

                    abstract = get_val(meta, "dc.description.abstract") or get_val(meta, "dc.description") or ""
                    abstract_norm = normalize_text(abstract)
                    date_issued = get_val(meta, "dc.date.issued")

                    authors = get_list(meta, "dc.contributor.author")
                    advisors = get_list(meta, "dc.contributor.advisor")
                    keywords = get_list(meta, "dc.subject")

                    # Construir URL base dependiendo del handle
                    # (Típicamente es hdl.handle.net, pero usaremos el dominio del repo para consistencia visual)
                    # Extraer dominio base del repo
                    base_domain = api_url.split("/server")[0]
                    url = f"{base_domain}/handle/{handle}" if handle else None

                    # Hash para detectar cambios
                    text_hash = sha256_text(title or "", abstract_norm or "", date_issued or "")

                    rows.append((
                        uuid,
                        handle,
                        url,
                        title,
                        abstract,
                        abstract_norm,
                        date_issued,
                        Json(authors),
                        Json(advisors),
                        Json(keywords),
                        text_hash,
                        repo_name # <--- Aquí insertamos 'UNAP' o 'UNSA'
                    ))

                if not rows:
                    empty_pages += 1
                    if stop_after_empty_pages and empty_pages >= stop_after_empty_pages:
                        print(f"\n🛑 {repo_name}: {empty_pages} páginas vacías. Cortando.")
                        break
                    page += 1
                    continue

                # UPSERT
                execute_values(cur, UPSERT_SQL, rows, page_size=page_size)
                returned = cur.fetchall()
                
                inserted = sum(1 for (ins,) in returned if ins)
                updated = len(returned) - inserted

                conn.commit()

                repo_inserted += inserted
                repo_updated += updated

                if inserted == 0 and updated == 0:
                    empty_pages += 1
                else:
                    empty_pages = 0

                if pbar.total is not None:
                    pbar.update(len(objects))

                if stop_after_empty_pages and empty_pages >= stop_after_empty_pages:
                    print(f"\n🛑 {repo_name}: Corte por inactividad.")
                    break

                # Paginación check
                page_info = search_result.get("page", {})
                current_page = page_info.get("number", page)
                total_pages = page_info.get("totalPages", page + 1)

                if current_page >= total_pages - 1:
                    break

                page += 1
                # Pequeña pausa para no saturar al servidor de la uni
                time.sleep(0.2)
                
    finally:
        pbar.close()
    
    return repo_inserted, repo_updated

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=os.getenv("DATABASE_URL", "postgresql://unap:unap123@localhost:5432/unap_repo"))
    parser.add_argument("--page-size", type=int, default=50)
    parser.add_argument("--stop-after-empty-pages", type=int, default=10)
    parser.add_argument("--verify-ssl", action="store_true")
    args = parser.parse_args()

    # Conexión única a la BD
    try:
        conn = psycopg2.connect(args.db_url)
        conn.autocommit = False # Manejamos commits explícitamente
    except Exception as e:
        print(f"Error conectando a BD: {e}")
        return

    print("🚀 Iniciando cosecha multi-universidad (UNAP + UNSA)...")
    
    total_new = 0
    total_upd = 0

    for repo in REPOSITORIES:
        ins, upd = process_repository(
            repo, conn, args.page_size, 
            args.stop_after_empty_pages, args.verify_ssl
        )
        total_new += ins
        total_upd += upd
    
    conn.close()

    print("\n📌 RESUMEN TOTAL FINAL:")
    print(f"   Total Insertados: {total_new}")
    print(f"   Total Actualizados: {total_upd}")
    print("✅ Proceso completado.")

if __name__ == "__main__":
    main()