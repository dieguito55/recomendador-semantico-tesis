# Manual de usuario

## 1. Proposito del sistema

El sistema permite encontrar tesis o trabajos academicos relacionados a partir de texto libre, titulo, resumen o una tesis abierta en un repositorio compatible.

La recomendacion se basa en similitud semantica: el sistema busca documentos con significado parecido, incluso cuando no usan exactamente las mismas palabras.

## 2. Usuarios previstos

- Estudiantes que buscan antecedentes de investigacion.
- Asesores o docentes que revisan temas similares.
- Investigadores que exploran lineas tematicas.
- Personal academico que organiza repositorios de tesis.

## 3. Acceso mediante API

Con la API activa, abrir:

```text
http://localhost:8000/docs
```

Desde esa pantalla se pueden probar los endpoints.

## 4. Buscar recomendaciones

Endpoint:

```text
POST /recommend
```

Ejemplo de consulta:

```json
{
  "text": "deteccion de enfermedades en cultivos usando aprendizaje automatico",
  "k": 10,
  "include_abstract": true,
  "same_topic": true,
  "same_topic_k": 10
}
```

El sistema devuelve:

- Lista de tesis recomendadas.
- Puntaje de similitud.
- Universidad de origen.
- Tema inferido.
- Tesis adicionales del mismo grupo tematico.

## 5. Usar la extension

1. Abrir el navegador Chrome o Edge.
2. Ir a `chrome://extensions/`.
3. Activar modo desarrollador.
4. Cargar la carpeta `extension/`.
5. Abrir una pagina compatible del repositorio.
6. Hacer clic en el icono de la extension.
7. Consultar recomendaciones desde el panel lateral.

## 6. Interpretacion de resultados

- `score`: valor de similitud semantica. Mientras mas alto, mas parecido es el documento a la consulta.
- `label`: etiqueta del tema detectado.
- `cluster_id`: identificador tecnico del grupo tematico.
- `same_topic`: documentos que pertenecen al mismo tema del resultado principal.

## 7. Exportacion y gestion

La extension incluye funciones para guardar referencias y exportar informacion bibliografica cuando estan disponibles en el panel.

## 8. Recomendaciones de uso

- Usar consultas descriptivas de una o dos oraciones.
- Incluir problema, metodo y area de aplicacion cuando sea posible.
- Comparar varios resultados, no solo el primero.
- Revisar el resumen y la fuente original antes de citar una tesis.

## 9. Limitaciones

- La calidad depende de los metadatos disponibles en los repositorios.
- Si una tesis no tiene resumen, la recomendacion puede ser menos precisa.
- Los clusters son aproximaciones automaticas y pueden requerir revision humana.
- El sistema no reemplaza una revision academica formal.
