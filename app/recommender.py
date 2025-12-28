#app/recommender.py
import os
import json
import threading
from typing import List, Tuple, Optional

import numpy as np
import faiss
import torch
from sentence_transformers import SentenceTransformer

MODEL_DIR = os.getenv("MODEL_DIR", "models_semantic")

DEFAULT_MODEL_NAME = os.getenv("MODEL_NAME", "BAAI/bge-m3")

MODEL_NAME = DEFAULT_MODEL_NAME


def choose_device() -> str:
    forced = os.getenv("EMBED_DEVICE", "").strip().lower()
    if forced in {"cpu", "cuda", "mps"}:
        if forced == "cuda" and not torch.cuda.is_available():
            return "cpu"
        if forced == "mps" and not (getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()):
            return "cpu"
        return forced

    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_meta_model_name(model_dir: str) -> Optional[str]:
    meta_path = os.path.join(model_dir, "meta.json")
    if not os.path.exists(meta_path):
        return None
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        name = (meta.get("model") or meta.get("model_name") or "").strip()
        return name or None
    except Exception:
        return None


def can_use_faiss_gpu() -> bool:
    return torch.cuda.is_available() and hasattr(faiss, "StandardGpuResources")


class Recommender:
    def __init__(self):
        self.index = None
        self.uuid_map: Optional[List[str]] = None
        self.model: Optional[SentenceTransformer] = None

        self.device = choose_device()
        self._lock = threading.RLock()

        self.model_name = load_meta_model_name(MODEL_DIR) or DEFAULT_MODEL_NAME

        global MODEL_NAME
        MODEL_NAME = self.model_name

        self.use_faiss_gpu = os.getenv("USE_FAISS_GPU", "0").strip() == "1"

    def _load_index_and_map_cpu(self):
        index_path = os.path.join(MODEL_DIR, "faiss.index")
        map_path = os.path.join(MODEL_DIR, "uuid_map.json")

        if not os.path.exists(index_path):
            raise FileNotFoundError(f"No existe {index_path}")
        if not os.path.exists(map_path):
            raise FileNotFoundError(f"No existe {map_path}")

        index = faiss.read_index(index_path)
        with open(map_path, "r", encoding="utf-8") as f:
            uuid_map = json.load(f)

        if not isinstance(uuid_map, list) or not uuid_map:
            raise RuntimeError("uuid_map.json inválido o vacío")

        return index, uuid_map

    def _maybe_to_gpu(self, index):
        """
        Convierte a GPU si:
        - USE_FAISS_GPU=1
        - tu FAISS soporta GPU
        - hay CUDA disponible
        """
        if not self.use_faiss_gpu:
            return index
        if not can_use_faiss_gpu():
            return index

        res = faiss.StandardGpuResources()
        try:
            return faiss.index_cpu_to_gpu(res, 0, index)
        except Exception:
            return index

    def load(self):
        """
        Carga index + uuid_map + modelo.
        """
        with self._lock:
            index, uuid_map = self._load_index_and_map_cpu()
            index = self._maybe_to_gpu(index)

            model = SentenceTransformer(self.model_name, device=self.device)

            if self.device == "cuda":
                try:
                    model.half()
                except Exception:
                    pass

            self.index = index
            self.uuid_map = uuid_map
            self.model = model

    def reload_index_only(self):
        """
        Recarga SOLO index + uuid_map (no recarga el modelo).
        Útil si reconstruyes FAISS y quieres hot-reload.
        """
        with self._lock:
            index, uuid_map = self._load_index_and_map_cpu()
            index = self._maybe_to_gpu(index)
            self.index = index
            self.uuid_map = uuid_map

    def _encode_query(self, query: str) -> np.ndarray:
        if not self.model:
            raise RuntimeError("Modelo no cargado. Llama rec.load() primero.")
        q = (query or "").strip()
        if not q:
            raise ValueError("query vacío")

        vec = self.model.encode(
            [q],
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        ).astype(np.float32)

        faiss.normalize_L2(vec)
        return vec

    def search(self, query: str, k: int = 10) -> List[Tuple[str, float]]:
        """
        Retorna [(uuid, score)] donde score ~ similitud coseno (IP en vectores normalizados).
        """
        with self._lock:
            if self.index is None or self.uuid_map is None:
                raise RuntimeError("Index no cargado. Llama rec.load() primero.")

            qvec = self._encode_query(query)

            D, I = self.index.search(qvec, int(k))
            idxs = I[0].tolist()
            sims = D[0].tolist()

            results: List[Tuple[str, float]] = []
            for pos, score in zip(idxs, sims):
                if pos == -1:
                    continue
                if pos < 0 or pos >= len(self.uuid_map):
                    continue
                uuid = self.uuid_map[pos]
                results.append((uuid, float(score)))
            return results
