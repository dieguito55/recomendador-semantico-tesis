# Preparacion para registro de software

Este archivo resume los elementos recomendados para presentar el repositorio como evidencia tecnica del software.

## Identificacion sugerida

- Nombre del software: Sistema Recomendador Semantico de Tesis Universitarias.
- Version sugerida: `v1.0.0-registro`.
- Tipo de obra: software o programa de ordenador.
- Componentes: API, pipeline de procesamiento, base de datos, extension de navegador e indice semantico generado.

## Contenido incluido en el repositorio

- Codigo fuente del backend: `app/`.
- Codigo fuente del pipeline: `scripts/`.
- Codigo fuente de la extension: `extension/`.
- Esquema de base de datos: `database/schema.sql`.
- Manual tecnico: `docs/MANUAL_TECNICO.md`.
- Manual de usuario: `docs/MANUAL_USUARIO.md`.
- Archivo de dependencias: `requirements.txt`.
- Variables de entorno de ejemplo: `.env.example`.
- Licencia restrictiva: `LICENSE`.

## Elementos que no deben subirse directamente

- `.env` con credenciales reales.
- `__pycache__/` y archivos `.pyc`.
- Artefactos pesados generados, salvo que se publiquen como release o anexo.
- Dumps de base de datos con informacion sensible.

## Evidencias complementarias recomendadas

- Capturas de la API funcionando.
- Capturas de la extension en uso.
- Archivo comprimido de `models_semantic/` si la entidad revisora necesita ejecutar la version exacta.
- Hash o etiqueta Git de la version entregada.
- Relacion de autores y titularidad patrimonial definida por la institucion o equipo.

## Cierre de version

Antes de enviar el enlace de GitHub:

```bash
git status
git add .
git commit -m "Preparar version formal para registro de software"
git tag -a v1.0.0-registro -m "Version para registro de software"
git push origin main --tags
```

Si existen archivos eliminados intencionalmente, deben quedar registrados en el commit. Si fueron eliminados por error, restaurarlos antes de crear la etiqueta.
