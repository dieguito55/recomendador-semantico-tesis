CREATE TABLE IF NOT EXISTS items (
  uuid TEXT PRIMARY KEY,
  handle TEXT,
  url TEXT,
  title TEXT,
  abstract TEXT,
  abstract_norm TEXT,
  date_issued TEXT,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  advisors JSONB NOT NULL DEFAULT '[]'::jsonb,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  text_hash TEXT NOT NULL,
  university TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_date_issued ON items(date_issued);
CREATE INDEX IF NOT EXISTS idx_items_university ON items(university);
CREATE INDEX IF NOT EXISTS idx_items_text_hash ON items(text_hash);

CREATE TABLE IF NOT EXISTS embeddings (
  uuid TEXT PRIMARY KEY REFERENCES items(uuid) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  dim INT NOT NULL CHECK (dim > 0),
  embedding BYTEA NOT NULL,
  text_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_embeddings_model_name ON embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_embeddings_text_hash ON embeddings(text_hash);

CREATE TABLE IF NOT EXISTS clusters (
  uuid TEXT PRIMARY KEY REFERENCES items(uuid) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  umap_dim INT NOT NULL CHECK (umap_dim > 0),
  cluster_id INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clusters_model_name ON clusters(model_name);
CREATE INDEX IF NOT EXISTS idx_clusters_cluster_id ON clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_clusters_model_cluster ON clusters(model_name, cluster_id);

CREATE TABLE IF NOT EXISTS cluster_labels (
  model_name TEXT NOT NULL,
  cluster_id INT NOT NULL,
  label TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  size INT NOT NULL CHECK (size >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (model_name, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_cluster_labels_size ON cluster_labels(size DESC);
