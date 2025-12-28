#scripts/build_topics_hdbscan.py
import os
import re
import json
import argparse
import numpy as np
import psycopg2
from psycopg2.extras import execute_values, Json

import umap
import hdbscan

from sklearn.feature_extraction.text import TfidfVectorizer
from stopwordsiso import stopwords

# =========================
# CONFIG
# =========================
DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://unap:unap123@localhost:5432/unap_repo"
)

# ✅ Nuevo default: mismo modelo que tu indexador semántico
DEFAULT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Stopwords “dominio UNAP / academia” para limpiar etiquetas
DOMAIN_STOP = {
    "tesis", "universidad", "unap", "puno", "perú", "peru", "facultad",
    "escuela", "profesional", "estudio", "investigación", "investigacion",
    "trabajo", "grado", "bachiller", "licenciatura", "maestría", "maestria",
    "doctorado", "juliaca", "san", "pedro", "nacional", "altiplano",
    "se", "del", "la", "el", "los", "las"
}

# Tokens individuales (sin espacios) permitidos
TOKEN_RE = re.compile(r"^[a-záéíóúñü][a-záéíóúñü0-9\-]{2,}$", re.IGNORECASE)

def normalize_token(tok: str) -> str | None:
    """
    Normaliza token individual (sin espacios):
    - min 3
    - solo letras/números/guión
    - filtra stopwords dominio
    """
    if not tok:
        return None
    tok = tok.strip().lower()
    tok = (
        tok.replace("á", "a").replace("é", "e").replace("í", "i")
           .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
    )
    if len(tok) < 3:
        return None
    if tok in DOMAIN_STOP:
        return None
    if tok.isdigit():
        return None
    if not TOKEN_RE.match(tok):
        return None
    return tok

def clean_ngram(term: str) -> str | None:
    """
    ✅ Acepta n-grams (1-3) con espacios.
    Limpia cada token y vuelve a unir.
    """
    if not term:
        return None
    parts = [normalize_token(p) for p in term.split()]
    parts = [p for p in parts if p is not None]
    if not parts:
        return None
    # evita 1-gramas demasiado genéricos (opcional)
    return " ".join(parts)

def normalize_l2_inplace(X: np.ndarray) -> None:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    X /= norms

def load_embeddings(conn, model_name: str):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT uuid, dim, embedding
            FROM embeddings
            WHERE model_name = %s
            ORDER BY uuid ASC
        """, (model_name,))
        rows = cur.fetchall()

    if not rows:
        raise RuntimeError("No hay embeddings en tabla embeddings para ese model_name.")

    dim = int(rows[0][1])
    uuids, vecs = [], []

    bad_dim = 0
    bad_buf = 0

    for uuid, d, emb in rows:
        if int(d) != dim:
            bad_dim += 1
            continue
        v = np.frombuffer(emb, dtype=np.float32)
        if v.shape[0] != dim:
            bad_buf += 1
            continue
        uuids.append(uuid)
        vecs.append(v)

    if not vecs:
        raise RuntimeError("Embeddings inválidos (buffers vacíos o dimensiones inconsistentes).")

    if bad_dim or bad_buf:
        print(f"⚠️ Omitidos: {bad_dim} (dim inconsistente) | {bad_buf} (buffer inválido)")

    X = np.vstack(vecs).astype(np.float32)
    return uuids, X

def load_texts_for_uuids(conn, uuids):
    if not uuids:
        return {}
    with conn.cursor() as cur:
        cur.execute("""
            SELECT uuid, COALESCE(title,''), COALESCE(abstract_norm,'')
            FROM items
            WHERE uuid = ANY(%s)
        """, (uuids,))
        rows = cur.fetchall()

    out = {}
    for uuid, title, absn in rows:
        text = (str(title) + " " + str(absn)).strip()
        out[str(uuid)] = text
    return out

def build_labels_global_tfidf(cid_to_indices, texts, topn=10, label_top=3):
    """
    ✅ Global TF-IDF (1 sola vez) + top términos por cluster.
    - Soporta ngram (1,3)
    - Respeta min_df/max_df
    """
    labels = {}

    es_stop = set(stopwords("es"))
    # normaliza dominio stopwords
    domain_stop_norm = {normalize_token(w) for w in DOMAIN_STOP if normalize_token(w)}
    stop_list = sorted(list(es_stop.union(domain_stop_norm)))

    vec = TfidfVectorizer(
        max_features=18000,
        ngram_range=(1, 3),
        min_df=2,
        max_df=0.95,
        stop_words=stop_list
    )

    X = vec.fit_transform(texts)  # sparse
    terms = np.array(vec.get_feature_names_out())

    for cid, idxs in cid_to_indices.items():
        size = len(idxs)
        if size < 3:
            labels[int(cid)] = (f"Tema {cid}", [], size)
            continue

        sub = X[idxs]
        scores = np.asarray(sub.mean(axis=0)).ravel()
        top_idx = scores.argsort()[::-1]

        keywords = []
        for j in top_idx:
            t = terms[j]
            t_clean = clean_ngram(t)
            if not t_clean:
                continue
            if t_clean not in keywords:
                keywords.append(t_clean)
            if len(keywords) >= topn:
                break

        label = ", ".join(keywords[:label_top]) if keywords else f"Tema {cid}"
        labels[int(cid)] = (label, keywords, size)

    return labels

def main():
    ap = argparse.ArgumentParser()

    ap.add_argument("--db-url", default=DEFAULT_DB_URL)
    ap.add_argument("--model", default=DEFAULT_MODEL)

    # UMAP (tu estilo agresivo por defecto)
    ap.add_argument("--umap-dim", type=int, default=5)
    ap.add_argument("--umap-n-neighbors", type=int, default=15)
    ap.add_argument("--umap-min-dist", type=float, default=0.0)
    ap.add_argument("--umap-low-memory", action="store_true", help="Activa low_memory en UMAP")

    # HDBSCAN (tu estilo: clusters grandes)
    ap.add_argument("--min-cluster-size", type=int, default=40)
    ap.add_argument("--min-samples", type=int, default=10)

    # etiquetas
    ap.add_argument("--topn", type=int, default=10, help="keywords por cluster")
    ap.add_argument("--label-top", type=int, default=3, help="cuántas keywords en el label final")
    ap.add_argument("--reset-db", action="store_true", help="Borra clusters/labels de este model antes de insertar")
    args = ap.parse_args()

    print("DB:", args.db_url)
    print("Model:", args.model)

    conn = psycopg2.connect(args.db_url)
    conn.autocommit = False

    try:
        # 1) embeddings
        uuids, X = load_embeddings(conn, args.model)
        print(f"Embeddings cargados: {len(uuids)} | dim={X.shape[1]}")

        # ✅ Normaliza antes de UMAP+cosine (más estable)
        normalize_l2_inplace(X)

        # 2) UMAP
        reducer = umap.UMAP(
            n_components=args.umap_dim,
            n_neighbors=args.umap_n_neighbors,
            min_dist=args.umap_min_dist,
            metric="cosine",
            random_state=42,
            low_memory=bool(args.umap_low_memory)
        )
        Xr = reducer.fit_transform(X).astype(np.float32)
        print(f"UMAP listo: {Xr.shape}")

        # 3) HDBSCAN
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=args.min_cluster_size,
            min_samples=args.min_samples,
            metric="euclidean",
            prediction_data=False
        )
        cluster_ids = clusterer.fit_predict(Xr)  # -1 outliers
        unique_c = sorted(set(cluster_ids.tolist()))
        print(f"Clusters encontrados (incluye -1 outliers): {len(unique_c)}")
        if -1 in unique_c:
            print(" - Incluye outliers (-1)")

        # 4) Guardar clusters en DB
        with conn.cursor() as cur:
            if args.reset_db:
                cur.execute("DELETE FROM cluster_labels WHERE model_name = %s", (args.model,))
                cur.execute("DELETE FROM clusters WHERE model_name = %s", (args.model,))

            rows = [(u, args.model, args.umap_dim, int(c)) for u, c in zip(uuids, cluster_ids.tolist())]

            execute_values(cur, """
                INSERT INTO clusters (uuid, model_name, umap_dim, cluster_id)
                VALUES %s
                ON CONFLICT (uuid) DO UPDATE
                SET model_name = EXCLUDED.model_name,
                    umap_dim = EXCLUDED.umap_dim,
                    cluster_id = EXCLUDED.cluster_id,
                    updated_at = now()
            """, rows, page_size=5000)

        conn.commit()
        print("✅ clusters guardados.")

        # 5) Preparar textos para etiquetar (sin outliers)
        cid_to_uuids = {}
        for u, c in zip(uuids, cluster_ids.tolist()):
            if int(c) == -1:
                continue
            cid_to_uuids.setdefault(int(c), []).append(str(u))

        flat_uuids = [u for sub in cid_to_uuids.values() for u in sub]
        uuid_to_text = load_texts_for_uuids(conn, flat_uuids)

        texts = []
        valid_uuids = []
        for u in flat_uuids:
            t = (uuid_to_text.get(u) or "").strip()
            if t:
                valid_uuids.append(u)
                texts.append(t)

        uuid_to_idx = {u: i for i, u in enumerate(valid_uuids)}

        cid_to_indices = {}
        for cid, ulist in cid_to_uuids.items():
            idxs = [uuid_to_idx[u] for u in ulist if u in uuid_to_idx]
            if idxs:
                cid_to_indices[int(cid)] = idxs

        labels = build_labels_global_tfidf(
            cid_to_indices, texts, topn=args.topn, label_top=args.label_top
        )

        # 6) Guardar etiquetas
        with conn.cursor() as cur:
            label_rows = [
                (args.model, int(cid), lab, Json(keys), int(sz))
                for cid, (lab, keys, sz) in labels.items()
            ]

            execute_values(cur, """
                INSERT INTO cluster_labels (model_name, cluster_id, label, keywords, size)
                VALUES %s
                ON CONFLICT (model_name, cluster_id) DO UPDATE
                SET label = EXCLUDED.label,
                    keywords = EXCLUDED.keywords,
                    size = EXCLUDED.size,
                    updated_at = now()
            """, label_rows, page_size=2000)

        conn.commit()
        print(f"✅ Etiquetas guardadas: {len(labels)} clusters (sin outliers).")

        n_out = int((cluster_ids == -1).sum())
        print("\nRESUMEN:")
        print(" - Total docs:", len(uuids))
        print(" - Outliers (-1):", n_out)
        print(" - min_cluster_size:", args.min_cluster_size, "| min_samples:", args.min_samples)
        print(" - UMAP:", f"dim={args.umap_dim}, neighbors={args.umap_n_neighbors}, min_dist={args.umap_min_dist}")

    finally:
        conn.close()

if __name__ == "__main__":
    main()
