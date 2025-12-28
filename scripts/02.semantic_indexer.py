#scripts/semantic_indexer.py
import os
import json
import argparse
import numpy as np
import psycopg2
from psycopg2.extras import execute_values
import torch
from sentence_transformers import SentenceTransformer
import faiss

# --- CONFIGURACIÓN ---
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://unap:unap123@localhost:5432/unap_repo"
)

DEFAULT_MODEL = "BAAI/bge-m3"
OUT_DIR = "models_semantic"

def normalize_text(s: str) -> str:
    return (s or "").strip()

def fetch_items_to_embed(cur, model_name: str, limit: int | None):
    """
    Recupera items:
    1) Nuevos (uuid no existe en tabla embeddings para este modelo)
    2) Modificados (text_hash es diferente)
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

def load_all_embeddings(cur, model_name: str):
    print("⏳ Cargando todos los embeddings desde DB para indexar...")
    cur.execute("""
        SELECT uuid, dim, embedding
        FROM embeddings
        WHERE model_name = %s
        ORDER BY uuid ASC
    """, (model_name,))

    data = cur.fetchall()
    if not data:
        return [], None

    uuids = []
    vecs = []

    dim = int(data[0][1])
    skipped_dim = 0
    skipped_buf = 0

    for uuid, d, emb in data:
        if int(d) != dim:
            skipped_dim += 1
            continue
        vec = np.frombuffer(emb, dtype=np.float32)
        if vec.shape[0] != dim:
            skipped_buf += 1
            continue
        uuids.append(uuid)
        vecs.append(vec)

    if skipped_dim > 0 or skipped_buf > 0:
        print(f"⚠️ Advertencia: omitidos {skipped_dim} por dim inconsistente y {skipped_buf} por buffer inválido.")

    if not vecs:
        return [], None

    X = np.vstack(vecs).astype(np.float32)
    return uuids, X

def build_faiss_index(X: np.ndarray):
    d = X.shape[1]
    faiss.normalize_L2(X)  # Normalización crítica para similitud coseno
    index = faiss.IndexFlatIP(d)
    index.add(X)
    return index

def choose_device():
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"

def configure_torch_for_speed(device: str):
    # Optimizaciones seguras para NVIDIA CUDA
    if device == "cuda":
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True

def upsert_embeddings_batch(cur, conn, rows):
    """Inserta o actualiza un lote de embeddings en la BD"""
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
    execute_values(cur, sql, rows, page_size=1000)
    conn.commit()

def encode_with_dynamic_batch(model, texts, device: str, start_batch: int):
    """
    Intenta codificar con un batch grande. Si falla por memoria (OOM),
    reduce el batch a la mitad y reintenta.
    """
    batch = start_batch
    while True:
        try:
            emb = model.encode(
                texts,
                batch_size=batch,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True
            ).astype(np.float32)
            return emb, batch
        except RuntimeError as e:
            msg = str(e).lower()
            if ("out of memory" in msg or "cuda" in msg) and device == "cuda" and batch > 4:
                torch.cuda.empty_cache()
                batch = max(4, batch // 2)
                print(f"⚠️ OOM. Reduciendo batch_size a {batch} y reintentando...")
                continue
            raise

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-url", default=DEFAULT_DB_URL)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--limit", type=int, default=0, help="0 = todos")
    parser.add_argument("--chunk", type=int, default=256, help="Documentos procesados antes de guardar en DB")
    # ✅ CAMBIO CLAVE: por tesis largas, default 2048
    parser.add_argument("--max-len", type=int, default=2048, help="Longitud máxima de tokens (Default: 2048)")
    args = parser.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    device = choose_device()
    configure_torch_for_speed(device)

    if device == "cuda":
        start_batch = 48  # agresivo; si hay OOM baja solo
        fp16 = True
    elif device == "mps":
        start_batch = 16
        fp16 = False
    else:
        start_batch = 16
        fp16 = False

    print(f"🚀 Iniciando Sistema de Embeddings [Modo: {device.upper()}]")
    if device == "cuda":
        print(f"🖥️  GPU Detectada: {torch.cuda.get_device_name(0)}")
        print("⚡ Optimizaciones CUDA: TF32 + cuDNN benchmark activados")
        print("⚡ Precisión: intentaremos FP16 (Half Precision)")

    print(f"🧠 Modelo: {args.model}")
    print(f"📏 Max Tokens: {args.max_len}")
    print(f"📦 Chunk: {args.chunk} | Batch inicial: {start_batch}")

    conn = psycopg2.connect(args.db_url)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            to_embed = fetch_items_to_embed(cur, args.model, args.limit)
            total = len(to_embed)
            print(f"📋 Documentos pendientes de procesar: {total}")

            if total > 0:
                print("⏳ Cargando modelo en memoria...")
                model = SentenceTransformer(args.model, device=device)

                try:
                    model.max_seq_length = int(args.max_len)
                except Exception:
                    pass

                if fp16 and device == "cuda":
                    try:
                        model = model.half()
                        print("✅ FP16 habilitado (half precision) en CUDA")
                    except Exception as e:
                        print(f"⚠️ No se pudo habilitar FP16, seguimos en FP32. Detalle: {e}")

                processed = 0
                current_batch = start_batch

                for i in range(0, total, args.chunk):
                    chunk = to_embed[i:i + args.chunk]

                    uuids, texts, hashes = [], [], []
                    skipped_empty = 0

                    for uuid, title, abstract_norm, text_hash in chunk:
                        t = normalize_text(title)
                        a = normalize_text(abstract_norm)
                        full_text = f"{t}\n{a}".strip()
                        if not full_text:
                            skipped_empty += 1
                            continue
                        uuids.append(uuid)
                        texts.append(full_text)
                        hashes.append(text_hash)

                    if skipped_empty > 0:
                        print(f"ℹ️  Se omitieron {skipped_empty} registros sin texto.")

                    if not texts:
                        continue

                    emb, used_batch = encode_with_dynamic_batch(
                        model, texts, device=device, start_batch=current_batch
                    )
                    current_batch = used_batch

                    dim = int(emb.shape[1])

                    rows = [
                        (uuid, args.model, dim, psycopg2.Binary(vec.tobytes()), th)
                        for uuid, th, vec in zip(uuids, hashes, emb)
                    ]

                    upsert_embeddings_batch(cur, conn, rows)
                    processed += len(rows)

                    if device == "cuda":
                        torch.cuda.empty_cache()

                    print(f"✅ Progreso: {processed}/{total} (Batch actual: {current_batch})")

            uuids_all, X = load_all_embeddings(cur, args.model)

            if X is None:
                print("⚠️ No hay embeddings en la base de datos para crear índice.")
                return

            print(f"🏗️  Construyendo índice FAISS con {len(uuids_all)} vectores...")
            index = build_faiss_index(X)

            faiss_path = os.path.join(OUT_DIR, "faiss.index")
            uuid_map_path = os.path.join(OUT_DIR, "uuid_map.json")
            meta_path = os.path.join(OUT_DIR, "meta.json")

            faiss.write_index(index, faiss_path)

            with open(uuid_map_path, "w", encoding="utf-8") as f:
                json.dump(uuids_all, f, ensure_ascii=False)

            meta = {
                "model": args.model,
                "count": len(uuids_all),
                "dim": int(X.shape[1]),
                "type": "dense_bge_m3",
                "device": device,
                "max_seq_length": int(args.max_len)
            }
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

            print("-" * 40)
            print("✅ PROCESO COMPLETADO EXITOSAMENTE")
            print(f"   Archivos guardados en: {OUT_DIR}/")
            print(f"   - {faiss_path}")
            print(f"   - {uuid_map_path}")
            print(f"   - {meta_path}")
            print("-" * 40)

    except Exception as e:
        conn.rollback()
        print(f"\n❌ ERROR CRÍTICO: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
