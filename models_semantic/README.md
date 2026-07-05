# Modelos semanticos generados

Esta carpeta contiene artefactos generados por el pipeline semantico:

- `faiss.index`: indice FAISS para busqueda por similitud.
- `uuid_map.json`: correspondencia entre posiciones del indice y UUID de tesis.
- `meta.json`: metadatos del modelo usado, dimension y cantidad de vectores.

Estos archivos no se versionan en Git porque pueden ser pesados y se regeneran con:

```bash
python scripts/02.semantic_indexer.py
```

Para entregar una version cerrada del software, conservar estos artefactos como anexo o release binario separado si la entidad revisora los solicita.
