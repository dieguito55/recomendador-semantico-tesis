import os
import json
import hashlib
import argparse

import numpy as np
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

# Embeddings
from sentence_transformers import SentenceTransformer

# FAISS
import faiss


DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://unap:unap123@localhost:5432/unap_repo",
)

DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"  # 384d, bueno español
OUT_DIR = "models_semantic"


def normalize_text(s: str) -> str:
    return (s or "").strip()


def fetch_items_to_embed(cur, model_name: str, limit: int | None):
    """
    Trae items donde:
    - no existe embedding
    - o el text_hash en embeddings != items.text_hash (cambió el item)
    """
    sql = """
    SELECT i.uuid, i.title, i.abstract_norm, i.text_hash
    FROM items i
    LEFT JOIN embeddings e ON e.uuid = i.uuid AND e.model_name = %s
    WHERE e.uuid IS NULL OR e.text_hash IS DISTINCT FROM i.text_hash
    ORDER BY i.updated_at DESC
    """

    if limit and limit > 0:
        sql += " LIMIT %s"
        cur.execute(sql, (model_name, limit))
    else:
        cur.execute(sql, (model_name,))

    return cur.fetchall()


def upsert_embeddings(cur, rows, model_name: str, dim: int):
    """
    rows: list of tuples para execute_values()
    """
    sql = """
    INSERT INTO embeddings (uuid, model_name, dim, embedding, text_hash)
    VALUES %s
    ON CONFLICT (uuid) DO UPDATE
    SET model_name = EXCLUDED.model_name,
        dim = EXCLUDED.dim,
        embedding = EXCLUDED.embedding,
        text_hash = EXCLUDED.text_hash,
        updated_at = now()
    """
    execute_values(cur, sql, rows, page_size=500)


def load_all_embeddings(cur, model_name: str):
    """
    Devuelve (uuids, matrix float32)
    """
    cur.execute(
        """
        SELECT uuid, dim, embedding
        FROM embeddings
        WHERE model_name = %s
        ORDER BY uuid ASC
        """,
        (model_name,),
    )
    data = cur.fetchall()

    if not data:
        return [], None

    uuids = []
    vecs = []
    dim = int(data[0][1])

    for uuid, d, emb in data:
        if int(d) != dim:
            raise RuntimeError(
                "Dimensiones mezcladas en embeddings; usa un solo modelo por tabla/ejecución."
            )
        uuids.append(uuid)
        vec = np.frombuffer(emb, dtype=np.float32)
        vecs.append(vec)

    X = np.vstack(vecs).astype(np.float32)
    return uuids, X


def build_faiss_index(X: np.ndarray):
    """
    Cosine similarity: normalizamos y usamos IndexFlatIP (inner product).
    Para 16k docs, FlatIP va perfecto en laptop.
    """
    faiss.normalize_L2(X)
    dim = X.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(X)
    return index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=DEFAULT_DB_URL)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Para pruebas: limita cuántos items embeddar",
    )
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"DB: {args.db_url}")
    print(f"Model: {args.model}")

    conn = psycopg2.connect(args.db_url)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            # 1) Ver qué items necesitan embedding (nuevos/cambiados)
            to_embed = fetch_items_to_embed(
                cur,
                args.model,
                args.limit if args.limit > 0 else None,
            )
            print(f"Pendientes de embedding (nuevos/cambiados): {len(to_embed)}")

            if to_embed:
                # 2) Cargar modelo
                model = SentenceTransformer(args.model)

                # 3) Preparar textos
                uuids = []
                texts = []
                hashes = []

                for uuid, title, abstract_norm, text_hash in to_embed:
                    t = normalize_text(abstract_norm) or normalize_text(title) or ""
                    uuids.append(uuid)
                    texts.append(t)
                    hashes.append(text_hash)

                # 4) Embeddar en batches
                embeddings = (
                    model.encode(
                        texts,
                        batch_size=64,
                        show_progress_bar=True,
                        convert_to_numpy=True,
                        normalize_embeddings=False,
                    )
                    .astype(np.float32)
                )

                dim = int(embeddings.shape[1])

                # 5) Upsert embeddings en DB
                rows = []
                for uuid, th, vec in zip(uuids, hashes, embeddings):
                    rows.append((uuid, args.model, dim, psycopg2.Binary(vec.tobytes()), th))

                sql = """
                INSERT INTO embeddings (uuid, model_name, dim, embedding, text_hash)
                VALUES %s
                ON CONFLICT (uuid) DO UPDATE
                SET model_name = EXCLUDED.model_name,
                    dim = EXCLUDED.dim,
                    embedding = EXCLUDED.embedding,
                    text_hash = EXCLUDED.text_hash,
                    updated_at = now()
                """
                execute_values(cur, sql, rows, page_size=300)
                conn.commit()
                print(f"✅ Upsert embeddings: {len(rows)}")

            # 6) Reconstruir índice FAISS desde embeddings guardados (rápido)
            uuids_all, X = load_all_embeddings(cur, args.model)
            if X is None:
                raise RuntimeError("No hay embeddings guardados para construir el índice.")

            index = build_faiss_index(X)

            # Guardar index + mapa de uuids (orden coincide con filas del index)
            faiss.write_index(index, os.path.join(OUT_DIR, "faiss.index"))

            with open(os.path.join(OUT_DIR, "uuid_map.json"), "w", encoding="utf-8") as f:
                json.dump(uuids_all, f, ensure_ascii=False)

            meta = {"model": args.model, "count": len(uuids_all), "dim": int(X.shape[1])}
            with open(os.path.join(OUT_DIR, "meta.json"), "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

            print("✅ Índice FAISS construido y guardado en models_semantic/")
            print(meta)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
