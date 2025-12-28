# scripts/plot_clusters_umap.py
import os
import json
import csv
import argparse
import numpy as np
import psycopg2
import umap
import matplotlib.pyplot as plt

DEFAULT_DB_URL = os.getenv("DATABASE_URL", "postgresql://unap:unap123@localhost:5432/unap_repo")
DEFAULT_MODEL = "BAAI/bge-m3"

DEFAULT_OUT_DIR = "figures"
DEFAULT_OUT_MAP = "umap_clusters_annotated.png"
DEFAULT_OUT_BAR = "top_clusters_bar.png"
DEFAULT_OUT_CSV = "top_clusters_table.csv"
DEFAULT_OUT_META = "plot_meta.json"


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def normalize_l2_inplace(X: np.ndarray, eps: float = 1e-12) -> None:
    """Normaliza filas (L2) para que cosine en UMAP sea más estable."""
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.maximum(norms, eps)
    X /= norms


def _parse_keywords(value):
    """keywords puede ser list, string JSON, o None."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def load_embeddings_and_cluster_ids(conn, model_name: str):
    """
    Carga embeddings + cluster_id por uuid (JOIN embeddings + clusters).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.uuid, e.dim, e.embedding, c.cluster_id
            FROM embeddings e
            JOIN clusters c ON c.uuid = e.uuid
            WHERE e.model_name = %s AND c.model_name = %s
            ORDER BY e.uuid ASC
            """,
            (model_name, model_name),
        )
        rows = cur.fetchall()

    if not rows:
        raise RuntimeError(
            f"No hay join embeddings+clusters para model={model_name}. "
            "Verifica que ya ejecutaste build_topics_hdbscan.py y que MODEL coincide."
        )

    dim = int(rows[0][1])
    uuids, vecs, cids = [], [], []

    for uuid, d, emb, cid in rows:
        if int(d) != dim:
            raise RuntimeError("Dimensiones mezcladas en embeddings (dim inconsistente).")
        uuids.append(str(uuid))
        vecs.append(np.frombuffer(emb, dtype=np.float32))
        cids.append(int(cid))

    X = np.vstack(vecs).astype(np.float32)
    cluster_ids = np.array(cids, dtype=np.int32)
    return uuids, X, cluster_ids


def load_cluster_labels(conn, model_name: str):
    """
    Carga label + keywords + size por cluster_id.
    Retorna dict cluster_id -> {label, keywords(list), size}
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cluster_id, label, keywords, size
            FROM cluster_labels
            WHERE model_name = %s
            """,
            (model_name,),
        )
        rows = cur.fetchall()

    out = {}
    for cid, label, keywords, size in rows:
        out[int(cid)] = {
            "label": (label or f"Tema {cid}").strip(),
            "keywords": _parse_keywords(keywords),
            "size": int(size) if size is not None else 0,
        }
    return out


def compute_sizes_from_assignments(cluster_ids: np.ndarray):
    """Si size en cluster_labels falta o está en 0, lo calculamos desde clusters."""
    sizes = {}
    for cid in cluster_ids.tolist():
        sizes[int(cid)] = sizes.get(int(cid), 0) + 1
    return sizes


def shorten(s: str, max_len: int = 60):
    s = (s or "").strip()
    return s if len(s) <= max_len else s[: max_len - 3] + "..."


def umap_2d(X: np.ndarray, n_neighbors: int, min_dist: float, seed: int):
    # seed=-1 => sin random_state (permite paralelismo y evita warning)
    random_state = None if seed is None or int(seed) < 0 else int(seed)

    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=int(n_neighbors),
        min_dist=float(min_dist),
        metric="cosine",
        random_state=random_state,
        low_memory=True,
    )
    XY = reducer.fit_transform(X).astype(np.float32)
    return XY, {
        "n_components": 2,
        "n_neighbors": int(n_neighbors),
        "min_dist": float(min_dist),
        "metric": "cosine",
        "random_state": random_state,
        "low_memory": True,
    }


def top_clusters_by_size(cluster_labels: dict, sizes_fallback: dict, topn: int, exclude_outliers: bool = True):
    items = []
    for cid, info in cluster_labels.items():
        if exclude_outliers and int(cid) == -1:
            continue
        sz = int(info.get("size") or 0)
        if sz <= 0:
            sz = int(sizes_fallback.get(int(cid), 0))
        items.append((int(cid), sz))

    # Si no hay labels (raro), usamos fallback por asignaciones
    if not items:
        for cid, sz in sizes_fallback.items():
            if exclude_outliers and int(cid) == -1:
                continue
            items.append((int(cid), int(sz)))

    items.sort(key=lambda x: x[1], reverse=True)
    return [cid for cid, _ in items[: int(topn)]]


def cluster_centroid(XY: np.ndarray, cluster_ids: np.ndarray, cid: int):
    pts = XY[cluster_ids == cid]
    if pts.shape[0] == 0:
        return None
    return pts.mean(axis=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db-url", default=DEFAULT_DB_URL)
    ap.add_argument("--model", default=DEFAULT_MODEL)

    # UMAP 2D (solo visual)
    ap.add_argument("--umap-n-neighbors", type=int, default=30)
    ap.add_argument("--umap-min-dist", type=float, default=0.0)
    ap.add_argument("--seed", type=int, default=-1, help="-1 = sin random_state (más rápido / paralelismo)")

    # Visual
    ap.add_argument("--topn-annotate", type=int, default=15)
    ap.add_argument("--topn-bar", type=int, default=20)
    ap.add_argument("--sample", type=int, default=0, help="0 = sin sample, sino N puntos para el scatter (acelera).")
    ap.add_argument("--point-size", type=float, default=3.0)
    ap.add_argument("--alpha", type=float, default=0.65)

    # Outputs
    ap.add_argument("--out-dir", default=DEFAULT_OUT_DIR)
    ap.add_argument("--out-map", default=DEFAULT_OUT_MAP)
    ap.add_argument("--out-bar", default=DEFAULT_OUT_BAR)
    ap.add_argument("--out-csv", default=DEFAULT_OUT_CSV)
    ap.add_argument("--out-meta", default=DEFAULT_OUT_META)

    args = ap.parse_args()

    ensure_dir(args.out_dir)

    out_map = os.path.join(args.out_dir, args.out_map)
    out_bar = os.path.join(args.out_dir, args.out_bar)
    out_csv = os.path.join(args.out_dir, args.out_csv)
    out_meta = os.path.join(args.out_dir, args.out_meta)

    conn = psycopg2.connect(args.db_url)
    try:
        uuids, X, cluster_ids = load_embeddings_and_cluster_ids(conn, args.model)
        cluster_labels = load_cluster_labels(conn, args.model)
    finally:
        conn.close()

    n = X.shape[0]
    outliers = int((cluster_ids == -1).sum())
    unique = set(cluster_ids.tolist())
    n_clusters = len(unique) - (1 if -1 in unique else 0)

    print(f"Docs: {n} | clusters: {n_clusters} | outliers: {outliers} ({outliers/n*100:.2f}%)")

    # Fallback sizes por asignaciones
    sizes_fallback = compute_sizes_from_assignments(cluster_ids)

    # ✅ Normaliza embeddings (cosine estable)
    normalize_l2_inplace(X)

    # 1) UMAP 2D
    XY, umap_params = umap_2d(
        X,
        n_neighbors=args.umap_n_neighbors,
        min_dist=args.umap_min_dist,
        seed=args.seed,
    )

    # 2) Scatter (opcional con sample para acelerar)
    if args.sample and int(args.sample) > 0 and int(args.sample) < n:
        rng = np.random.default_rng(42)
        idx = rng.choice(n, size=int(args.sample), replace=False)
        XYp = XY[idx]
        Cp = cluster_ids[idx]
        title_extra = f" (sample={len(idx)}/{n})"
    else:
        XYp = XY
        Cp = cluster_ids
        title_extra = ""

    plt.figure(figsize=(12, 8))
    plt.scatter(XYp[:, 0], XYp[:, 1], c=Cp, s=float(args.point_size), alpha=float(args.alpha), rasterized=True)
    plt.title(f"UMAP 2D (visualización) + Clusters HDBSCAN (color = cluster_id){title_extra}")
    plt.xlabel("UMAP-1")
    plt.ylabel("UMAP-2")

    # 3) Anotar Top-N clusters (label + 3 keywords)
    top_cids = top_clusters_by_size(cluster_labels, sizes_fallback, args.topn_annotate, exclude_outliers=True)

    for cid in top_cids:
        center = cluster_centroid(XY, cluster_ids, cid)
        if center is None:
            continue

        info = cluster_labels.get(cid, {"label": f"Tema {cid}", "keywords": [], "size": sizes_fallback.get(cid, 0)})
        label = info.get("label") or f"Tema {cid}"
        kws = (info.get("keywords") or [])[:3]
        text = f"[{cid}] {shorten(label, 45)}\n" + (", ".join(kws) if kws else "")
        plt.text(center[0], center[1], text, fontsize=7)

    plt.tight_layout()
    plt.savefig(out_map, dpi=220)
    plt.close()
    print(f"✅ Guardado mapa anotado: {out_map}")

    # 4) Bar chart Top-N clusters (sin outliers)
    top_bar_cids = top_clusters_by_size(cluster_labels, sizes_fallback, args.topn_bar, exclude_outliers=True)

    sizes = []
    labels = []
    for c in top_bar_cids:
        info = cluster_labels.get(c, {})
        sz = int(info.get("size") or 0)
        if sz <= 0:
            sz = int(sizes_fallback.get(int(c), 0))
        sizes.append(sz)

        lbl = shorten((info.get("label") or f"Tema {c}"), 45)
        labels.append(f"{c}: {lbl}")

    plt.figure(figsize=(12, 8))
    y = np.arange(len(top_bar_cids))
    plt.barh(y, sizes)
    plt.yticks(y, labels)
    plt.gca().invert_yaxis()
    plt.title(f"Top {int(args.topn_bar)} clusters por tamaño (sin outliers)")
    plt.xlabel("N documentos")
    plt.tight_layout()
    plt.savefig(out_bar, dpi=220)
    plt.close()
    print(f"✅ Guardado barras: {out_bar}")

    # 5) CSV para documentación
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["cluster_id", "size", "label", "keywords_top8"])
        for cid in top_bar_cids:
            info = cluster_labels.get(cid, {})
            sz = int(info.get("size") or 0)
            if sz <= 0:
                sz = int(sizes_fallback.get(int(cid), 0))
            label = info.get("label") or f"Tema {cid}"
            keywords = (info.get("keywords") or [])[:8]
            w.writerow([cid, sz, label, ", ".join(keywords)])
    print(f"✅ Guardado tabla CSV: {out_csv}")

    # 6) meta (para tu informe)
    meta = {
        "model_name": args.model,
        "n_docs": n,
        "n_clusters_without_outliers": n_clusters,
        "n_outliers": outliers,
        "outlier_pct": outliers / n * 100.0,
        "umap_plot_params": umap_params,
        "outputs": {
            "umap_annotated_png": out_map,
            "top_clusters_bar_png": out_bar,
            "top_clusters_csv": out_csv,
        },
        "notes": "UMAP es solo visualización (2D). No altera clustering real guardado en DB.",
    }

    with open(out_meta, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"✅ Guardado meta: {out_meta}")


if __name__ == "__main__":
    main()
