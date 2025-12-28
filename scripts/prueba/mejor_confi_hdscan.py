import os
import argparse
import numpy as np
import psycopg2
import umap
import hdbscan

DEFAULT_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://unap:unap123@localhost:5432/unap_repo"
)

DEFAULT_MODEL = "BAAI/bge-m3"

def parse_list_int(s: str):
    return [int(x.strip()) for x in s.split(",") if x.strip()]

def parse_list_float(s: str):
    return [float(x.strip()) for x in s.split(",") if x.strip()]

def normalize_l2_inplace(X: np.ndarray) -> None:
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    X /= norms

def load_embeddings(conn, model_name: str):
    with conn.cursor() as cur:
        cur.execute("""
            SELECT dim, embedding
            FROM embeddings
            WHERE model_name = %s
        """, (model_name,))
        rows = cur.fetchall()

    if not rows:
        raise RuntimeError(f"No hay embeddings en DB para model_name={model_name}")

    dim0 = int(rows[0][0])
    vecs = []
    bad_dim = 0
    bad_buf = 0

    for dim, emb in rows:
        if int(dim) != dim0:
            bad_dim += 1
            continue
        v = np.frombuffer(emb, dtype=np.float32)
        if v.shape[0] != dim0:
            bad_buf += 1
            continue
        vecs.append(v)

    if bad_dim or bad_buf:
        print(f"⚠️ Omitidos: {bad_dim} (dim inconsistente) | {bad_buf} (buffer inválido)")

    if not vecs:
        raise RuntimeError("No quedaron embeddings válidos.")

    X = np.vstack(vecs).astype(np.float32)
    return X

def summarize(labels: np.ndarray):
    n = len(labels)
    out = int((labels == -1).sum())
    clusters = len(set(labels)) - (1 if -1 in labels else 0)
    out_pct = (out / n) * 100.0

    sizes = []
    for c in set(labels):
        if c == -1:
            continue
        sizes.append(int((labels == c).sum()))
    sizes.sort(reverse=True)

    largest = sizes[0] if sizes else 0
    median = int(np.median(sizes)) if sizes else 0
    small_lt20 = sum(1 for s in sizes if s < 20)

    return {
        "clusters": clusters,
        "outliers": out,
        "outlier_pct": out_pct,
        "largest_cluster": largest,
        "median_cluster": median,
        "small_clusters_lt20": small_lt20,
    }

def score_config(st: dict):
    """
    Enfocado a: MENOS OUTLIERS.
    Penaliza fuerte outlier%.
    Penaliza clusters demasiado pocos o demasiados.
    Penaliza clusters chiquitos (<20) si aparecieran.
    """
    out_pct = st["outlier_pct"]
    k = st["clusters"]
    small = st["small_clusters_lt20"]

    score = 0.0
    score -= out_pct * 4.0         # <- penalización FUERTE a outliers
    score -= small * 0.5

    # rango razonable de clusters para 36k docs (ajusta si quieres)
    if k < 30:
        score -= (30 - k) * 2.0
    if k > 260:
        score -= (k - 260) * 0.8

    # bonus si outliers <= 25%
    if out_pct <= 25.0:
        score += 25.0
    elif out_pct <= 30.0:
        score += 10.0

    return score

def main():
    ap = argparse.ArgumentParser()

    ap.add_argument("--db-url", default=DEFAULT_DB_URL)
    ap.add_argument("--model", default=DEFAULT_MODEL)

    # UMAP grid
    ap.add_argument("--neighbors", default="30,45,60,80", help="UMAP n_neighbors (coma)")
    ap.add_argument("--dims", default="10,15", help="UMAP n_components (coma)")
    ap.add_argument("--min-dists", default="0.0,0.1", help="UMAP min_dist (coma)")

    # Seed: si -1 => None (permite paralelismo, no determinista)
    ap.add_argument("--seed", type=int, default=42, help="random_state. Usa -1 para None (más rápido)")

    # n_jobs para UMAP (ojo: si seed != -1, UMAP puede forzar n_jobs=1)
    ap.add_argument("--umap-n-jobs", type=int, default=-1)

    # HDBSCAN grid
    ap.add_argument("--mcs", default="30,40,50,60", help="min_cluster_size (coma)")
    ap.add_argument("--ms", default="1,2,5,10", help="min_samples (coma)")
    ap.add_argument("--hdbscan-n-jobs", type=int, default=-1, help="core_dist_n_jobs")

    # rápido
    ap.add_argument("--limit", type=int, default=0, help="0=todos; si >0 usa los primeros N embeddings")

    args = ap.parse_args()

    neighbors_list = parse_list_int(args.neighbors)
    dims_list = parse_list_int(args.dims)
    min_dists_list = parse_list_float(args.min_dists)
    mcs_list = parse_list_int(args.mcs)
    ms_list = parse_list_int(args.ms)

    conn = psycopg2.connect(args.db_url)
    try:
        X = load_embeddings(conn, args.model)
    finally:
        conn.close()

    if args.limit and args.limit > 0:
        X = X[: args.limit]
        print(f"⚠️ LIMIT activado: usando solo {len(X)} embeddings.")

    # Mejor estabilidad con coseno
    normalize_l2_inplace(X)

    seed = None if args.seed == -1 else args.seed

    print("\nUMAP(nei,dim,md) + HDBSCAN(mcs,ms) => clusters / out_% / score")
    print("nei | dim | md  | mcs | ms | clusters | out_% | outliers | median | score")
    print("-" * 86)

    results = []

    for nei in neighbors_list:
        for dim in dims_list:
            for md in min_dists_list:
                reducer = umap.UMAP(
                    n_components=dim,
                    n_neighbors=nei,
                    min_dist=md,
                    metric="cosine",
                    random_state=seed,
                    n_jobs=args.umap_n_jobs
                )
                Xr = reducer.fit_transform(X).astype(np.float32)

                for mcs in mcs_list:
                    for ms in ms_list:
                        cl = hdbscan.HDBSCAN(
                            min_cluster_size=mcs,
                            min_samples=ms,
                            metric="euclidean",
                            prediction_data=False,
                            core_dist_n_jobs=args.hdbscan_n_jobs
                        )
                        labels = cl.fit_predict(Xr)

                        st = summarize(labels)
                        sc = score_config(st)

                        results.append((sc, nei, dim, md, mcs, ms, st))
                        print(
                            f"{nei:3d} | {dim:3d} | {md:0.1f} | {mcs:3d} | {ms:2d} | "
                            f"{st['clusters']:8d} | {st['outlier_pct']:5.1f}% | {st['outliers']:7d} | "
                            f"{st['median_cluster']:6d} | {sc:6.2f}"
                        )

    results.sort(key=lambda x: x[0], reverse=True)
    best = results[0]
    sc, nei, dim, md, mcs, ms, st = best

    print("\n" + "=" * 86)
    print("✅ MEJOR CONFIGURACIÓN (prioriza MENOS OUTLIERS)")
    print(f"UMAP: n_neighbors={nei}, n_components={dim}, min_dist={md}, seed={'None' if seed is None else seed}")
    print(f"HDBSCAN: min_cluster_size={mcs}, min_samples={ms}")
    print(f"clusters={st['clusters']} | outliers={st['outliers']} ({st['outlier_pct']:.1f}%) | median_cluster={st['median_cluster']}")
    print(f"score={sc:.2f}")
    print("=" * 86)

    print("\n➡️ Para tu script principal (build_topics_hdbscan.py) usa:")
    print(f"  --umap-n-neighbors {nei} --umap-dim {dim} --umap-min-dist {md} --min-cluster-size {mcs} --min-samples {ms}")
    print("\nTips rápidos para bajar outliers:")
    print("- Sube UMAP n_neighbors (60-120) suele bajar outliers.")
    print("- Sube UMAP dim (15-30) puede ayudar si hay mucha variedad.")
    print("- min_dist 0.1 a veces reduce ruido frente a 0.0.")
    print("- min_samples muy alto puede subir outliers (ya lo viste).")

if __name__ == "__main__":
    main()
