# Plan de Consolidación Documental — Love Arcade

**Autor de la auditoría:** Claude (análisis de especificación, no ejecución)
**Ejecutor previsto:** Codex
**Alcance:** todo `docs/`, `README.md`, `AGENTS.md`, `tests/documentation-static-qa.mjs`
**Fuera de alcance:** `.agents/skills/*` (instrucciones de Codex, no documentación del producto — sin conflictos detectados con el corpus de docs)

---

## 0. Resumen del hallazgo principal

El repositorio ya pasó por una limpieza documental previa que produjo un set normativo de 5 documentos con formato consistente (`Estado del documento` + etiquetas `Hecho verificado` / `Inferencia` / `No confirmado`):

- `docs/ARCHITECTURE.md`
- `docs/DOMAIN.md`
- `docs/INTEGRATION.md`
- `docs/OPERATIONS.md`
- `docs/DOCUMENTATION_POLICY.md`

Estos 5 están correctamente enlazados entre sí y desde `README.md`, y son internamente consistentes. **Este set no necesita reescritura de fondo**, solo ajustes menores de cobertura (Ticket DOC-05).

El problema real es que **9 documentos adicionales en `docs/` quedaron fuera de ese barrido**: algunos están duplicados/contradichos por el set normativo (candidatos a eliminación), otros son huérfanos pero precisos (candidatos a indexar y enlazar), y uno contiene una sección con contenido que no existe en el código actual (candidato a reescritura).

No se encontraron enlaces Markdown rotos en el corpus analizado — `tests/documentation-static-qa.mjs` ya cubre esa clase de regresión. El riesgo real no es de sintaxis, es de **autoridad duplicada y contenido obsoleto sin marcar**.

---

## 1. Inventario clasificado

| Archivo | Estado | Veredicto |
|---|---|---|
| `docs/ARCHITECTURE.md` | Normativo, consistente | Conservar; ampliar §3 (Ticket DOC-05) |
| `docs/DOMAIN.md` | Normativo, consistente | Conservar |
| `docs/INTEGRATION.md` | Normativo, consistente | Conservar; absorber ejemplos de código (Ticket DOC-01) |
| `docs/OPERATIONS.md` | Normativo, consistente | Conservar; añadir referencia a ECONOMIA.md (Ticket DOC-03) |
| `docs/DOCUMENTATION_POLICY.md` | Normativo, consistente | Conservar |
| `docs/operations/streak-recovery.md` | Preciso, bien enlazado | Conservar sin cambios |
| `manual de economía heredado` | **Obsoleto y contradictorio** | Eliminar tras fusionar (Ticket DOC-01) |
| `manual de integración heredado` | **Obsoleto y contradictorio** | Eliminar tras fusionar (Ticket DOC-01) |
| `docs/sistema-racha-diaria.md` | Preciso en general, **una sección ficticia** | Reescribir + indexar (Ticket DOC-02) |
| `docs/ECONOMIA.md` | Preciso, redundante en la fórmula | Recortar duplicado + indexar (Ticket DOC-03) |
| `docs/THUMBNAILS_OPTIMIZATION.md` | Preciso, huérfano | Indexar (Ticket DOC-04) |
| `docs/preview-interaction-performance.md` | Preciso, huérfano | Indexar (Ticket DOC-04) |
| `docs/lifecycle-timers.md` | Preciso, huérfano | Indexar (Ticket DOC-04) |
| `docs/JSDOC_GUIDE.md` | Preciso, huérfano | Indexar (Ticket DOC-04) |
| `docs/limpieza-documentacion-temporal.md` | Temporal, contenido ya aplicado | Eliminar (Ticket DOC-06) |
| `README.md` | Mapa incompleto (solo 5 de 15 docs) | Ampliar (Ticket DOC-04) |

---

## TICKET DOC-01 — Retirar los manuales legado de integración de minijuegos

**Prioridad:** Alta
**Dependencias:** ninguna
**Archivos afectados:** dos manuales heredados de integración/economía (eliminar), `docs/INTEGRATION.md` (editar)

### Evidencia del problema

- `[HECHO]` Un manual de desarrollo de minijuegos heredado afirmaba que la plataforma residía estáticamente en GitHub Pages. Esto es **falso respecto al estado actual**: `vercel.json`, `api/client-config.js`, `api/report.js`, `api/telemetry.js` y `docs/OPERATIONS.md` confirman despliegue en **Vercel** con funciones serverless. Contradicción directa, no ambigua.
- `[HECHO]` Un manual de economía heredado describía un modelo de "juegos incrustados" cuyo `DOMContentLoaded` se dispara *después* del hub en el mismo documento. El modelo real es de **páginas HTML independientes** bajo `games/<juego>/index.html`, cada una con su propio `<script src="../../js/app.js">`. La afirmación de "incrustación" en el mismo DOM es incorrecta.
- `[HECHO]` Ambos documentos heredados declaraban versiones desactualizadas del núcleo mientras que el código actual está en versiones muy superiores (`js/analytics.js` → v12.2, `js/backup-engine.js` → v15.0, `js/spa-router.js` → v10.0, `sw.js` → `v2.04.07.39`). Nadie mantiene estas cifras sincronizadas; son ruido activo, no historial útil.
- `[HECHO]` El manual de economía heredado tenía una inconsistencia interna en sus metadatos de versión.
- `[HECHO]` La lista de "Globales Reservados del Núcleo" en el manual heredado estaba incompleta frente a lo que `js/app.js` expone realmente hoy. Publicar una lista incompleta es peor que no publicarla, porque un integrador externo puede colisionar con un global no listado.
- `[INFERENCIA]` Ambos documentos heredados fueron material entregado a equipos externos antes de que se creara `docs/INTEGRATION.md` como contrato normativo. Ninguno de los dos aparece en el mapa de `README.md` ni en las referencias cruzadas de `docs/ARCHITECTURE.md` o `docs/DOMAIN.md` — quedaron huérfanos del barrido de limpieza anterior por omisión, no por decisión explícita.
- `[HECHO]` `docs/INTEGRATION.md` ya cubre el mismo contrato (`completeLevel(gameId, levelId, rewardAmount)`, namespacing, degradación elegante, `window.THEMES`) de forma normativa y con etiquetado epistémico, pero **en prosa, sin ejemplos de código copiables**. Los manuales heredados sí tenían ejemplos de código útiles que vale la pena preservar.

### Contenido a rescatar antes de eliminar (fusionar en `docs/INTEGRATION.md`)

Añadir una nueva sección `## 14. Ejemplos de referencia` (o numeración equivalente al final del documento) con:

1. Ejemplo de namespacing tomado de un manual heredado de desarrollo, verificado contra el código actual antes de copiar.
2. Ejemplo de conversión de economía interna tomado de un manual heredado de economía, que ya es consistente con `INTEGRATION.md` §4.
3. Ejemplo de llamada con degradación elegante (`if (typeof window.GameCenter !== 'undefined') { ... }`) tomado de un manual heredado de desarrollo.
4. Ejemplo de `window.debounce(fn, delay)` con su firma JSDoc, verificada contra `function debounce(fn, delay = 300)` en `js/app.js`.
5. **No copiar** la tabla de "Globales Reservados del Núcleo" ni la tabla de "Otros Métodos del GameCenter" tal cual — están desactualizadas. Si se incluyen, deben regenerarse a partir de una revisión actual de `window.GameCenter` en `js/app.js` (ver checklist de aceptación).
6. **No copiar** ninguna mención a GitHub Pages ni al modelo de "juegos incrustados". El texto fusionado debe usar el lenguaje ya correcto de `INTEGRATION.md` (páginas independientes bajo `games/`).

### Pasos de implementación

1. Leer `docs/INTEGRATION.md` completo y confirmar los puntos de inserción de la nueva sección de ejemplos.
2. Redactar la sección `## 14. Ejemplos de referencia` con el contenido rescatado (punto anterior), verificando cada fragmento de código contra `js/app.js` vigente antes de pegarlo.
3. Eliminar `docs/love-arcade-coin-system.md`.
4. Eliminar `docs/love-arcade-minigame-dev-manual.md`.
5. Buscar en todo el repo (`grep -rn "love-arcade-coin-system\|love-arcade-minigame-dev-manual"`) cualquier referencia residual y eliminarla. (Auditoría manual ya realizada sobre el corpus entregado: no se encontraron referencias externas a estos dos archivos salvo la mención cruzada entre ellos mismos, que desaparece al borrarlos.)

### Checklist de limpieza

- [ ] Los manuales heredados de integración/economía ya no existen
- [ ] `docs/INTEGRATION.md` contiene la nueva sección de ejemplos, sin menciones a GitHub Pages ni a "juegos incrustados en el mismo documento"
- [ ] Ningún archivo del repo referencia los nombres de los manuales eliminados

### Criterios de aceptación

- `grep -rn "love-arcade-coin-system\|love-arcade-minigame-dev-manual" .` no devuelve resultados.
- `node tests/documentation-static-qa.mjs` pasa sin errores.
- `docs/INTEGRATION.md` sigue siendo válido como Markdown y conserva su cabecera de "Estado del documento" sin alterar las secciones existentes 1–13.

### Riesgos

- Si algún equipo externo real tiene guardado un enlace directo a estos dos archivos, se rompe. Mitigación: no hay evidencia en el repo de que se publiquen fuera de `docs/`; es un riesgo aceptado y consistente con la filosofía "zero-legacy" del proyecto.

---

## TICKET DOC-02 — Reescribir `docs/sistema-racha-diaria.md`: eliminar el sistema de eventos ficticio y conectarlo al grafo normativo

**Prioridad:** Alta
**Dependencias:** ninguna
**Archivos afectados:** `docs/sistema-racha-diaria.md` (editar), `docs/DOMAIN.md` (editar, referencias cruzadas), `docs/ARCHITECTURE.md` (editar, referencias cruzadas)

### Evidencia del problema

- `[HECHO]` La §12 "Eventos LTE relacionados" describe `streak_boost_v1`, `window.isEventActive('streak_boost_v1')` y un archivo `data/events.json` que **no existen en ningún lugar del código actual**. `js/app.js` (`getStreakInfo()`, `claimDaily()`) no contiene ninguna referencia a boost de eventos, `isEventActive`, ni lectura de `data/events.json`. Tampoco aparece `data/events.json` en `sw.js` (`APP_SHELL_FILES`) ni en ningún otro archivo del corpus.
- `[HECHO]` La tabla "Archivos relacionados" al inicio del documento lista `data/events.json` como archivo relacionado — archivo inexistente.
- `[HECHO]` El campo `streakBoosted` que la §8 (`getStreakInfo()`) documenta como parte del retorno de la función **no existe** en la implementación real de `GameCenter.getStreakInfo()` en `js/app.js` (el objeto retornado es `{ streak, nextReward, canClaim, repairAvailable, repairCost, canAffordRepair }`).
- `[HECHO]` El sistema de Eventos LTE fue retirado por completo del código y funcionalidades del proyecto, sin embargo no toda la documentación fue actualizada en su momento para reflejar qué ese sistema fue eliminado. 
- `[HECHO]` El resto del documento (secciones 1–11, 13–24 salvo las menciones puntuales al boost) **sí es preciso** y está bien alineado con `js/app.js`, `js/streak-hub.js`, `index.html` y `styles.css` — en particular la sección 22 (madrugada flexible de 03:00, reparación de racha por 500 monedas) coincide exactamente con `DAILY_DAY_OFFSET_MS` y `DAILY_REPAIR_COST` en el código. No se recomienda descartar el documento completo.
- `[HECHO]` El documento no sigue el formato de etiquetado epistémico (`Hecho verificado`/`Inferencia`/`No confirmado`) que usan los 5 documentos normativos, y no está enlazado desde `README.md`, `docs/DOMAIN.md` ni `docs/ARCHITECTURE.md`. Queda huérfano pese a ser el documento más detallado del repositorio sobre un sistema de negocio central.

### Pasos de implementación

1. En `docs/sistema-racha-diaria.md`:
   - Eliminar por completo la sección `## 12. Eventos LTE relacionados`.
   - En la tabla "Archivos relacionados" (§2), eliminar la fila que menciona `data/events.json`.
   - En §8, dentro de la descripción de `GameCenter.getStreakInfo()`, eliminar la mención a `streakBoosted` y a que "el cálculo usa `streak_boost_v1`"; el objeto de retorno documentado debe coincidir exactamente con el código: `{ streak, nextReward, canClaim, repairAvailable, repairCost, canAffordRepair }`.
   - Revisar cualquier otra mención residual a "boost", "LTE" o "evento" fuera de las ya identificadas (búsqueda `grep -in "boost\|_lte_\|isEventActive\|events.json"` sobre el archivo) y eliminarla si depende del sistema ficticio.
   - Añadir al inicio del documento (antes de "## 1. Resumen ejecutivo") un bloque de estado breve, consistente con el resto del repo:
     ```
     > **Estado del documento:** informe técnico de profundidad complementario a `docs/DOMAIN.md` §5.
     > Las reglas de negocio autoritativas viven en `docs/DOMAIN.md`; este documento añade detalle de
     > implementación, UX, accesibilidad y motion que `DOMAIN.md` no cubre por diseño.
     ```
   - Actualizar la sección "19. Riesgos técnicos detectados" si alguno de los riesgos listados dependía del sistema de eventos ficticio (revisar puntual, no se detectó ninguno directamente dependiente en el corpus entregado, pero debe confirmarse en la edición real).
2. En `docs/DOMAIN.md` §5 ("Racha diaria"), añadir al final de la sección una línea de referencia cruzada:
   ```
   Para un análisis extendido (UX, accesibilidad, motion, riesgos y diagrama de flujo), ver
   [docs/sistema-racha-diaria.md](./docs/sistema-racha-diaria.md).
   ```
3. En `docs/ARCHITECTURE.md`, dentro de §8 "Referencias cruzadas", no es el lugar correcto (es un doc de arquitectura general); en su lugar, evaluar si `docs/DOMAIN.md` es suficiente como punto de entrada. **Decisión:** solo añadir el enlace en `DOMAIN.md` (paso 2); no duplicar el enlace en `ARCHITECTURE.md` para no crear una tercera fuente de verdad sobre dónde vive la racha diaria.

### Checklist de limpieza

- [ ] `docs/sistema-racha-diaria.md` no contiene "streak_boost_v1", "isEventActive", "events.json" ni "Eventos LTE"
- [ ] El objeto de retorno documentado para `getStreakInfo()` coincide campo por campo con `js/app.js`
- [ ] `docs/DOMAIN.md` §5 enlaza a `docs/sistema-racha-diaria.md`

### Criterios de aceptación

- `grep -in "streak_boost\|isEventActive\|events.json" docs/sistema-racha-diaria.md` no devuelve resultados.
- El enlace nuevo en `docs/DOMAIN.md` resuelve a un archivo existente (`node tests/documentation-static-qa.mjs` pasa).
- Comparación manual campo por campo entre la documentación de `getStreakInfo()` en el archivo editado y la implementación real en `js/app.js`.

---

## TICKET DOC-03 — Eliminar duplicación de fórmula económica entre `ECONOMIA.md` y `DOMAIN.md`

**Prioridad:** Media
**Dependencias:** ninguna
**Archivos afectados:** `docs/ECONOMIA.md` (editar), `docs/DOMAIN.md` (sin cambios de contenido, solo referencia cruzada), `docs/OPERATIONS.md` (editar, referencia cruzada)

### Evidencia del problema

- `[HECHO]` `docs/ECONOMIA.md` §1 y `docs/DOMAIN.md` §2 documentan **la misma fórmula** (`Precio final = precio_original × saleMultiplier`, `Cashback = precio_final × cashbackRate`) con **el mismo ejemplo numérico** (wallpaper de 1000, oferta 20%, cashback 10% → 800 final, 80 cashback). Ambos son precisos y consistentes entre sí (no hay contradicción), pero es una duplicación literal de contenido normativo en dos archivos, violando el principio de "un único documento propietario por conocimiento" de `docs/DOCUMENTATION_POLICY.md`.
- `[HECHO]` `docs/ECONOMIA.md` tiene valor único y no redundante como **runbook operativo**: instrucciones paso a paso para activar/desactivar una oferta, tabla de conversión `% descuento → saleMultiplier`, ejemplos de eventos temáticos (San Valentín, Flash Sale, Cumpleaños). Nada de esto está en `DOMAIN.md` (que documenta la regla, no el procedimiento) ni en `OPERATIONS.md`.
- `[HECHO]` El pie de página de `docs/ECONOMIA.md` dice *"Última actualización: Rediseño de Tienda — TICKET-07"*. Esta referencia a un ticket histórico no es verificable desde el repositorio (los tickets Codex se generan y entregan fuera de `docs/`, no se archivan aquí) y contraviene la regla de `DOCUMENTATION_POLICY.md`: *"Los tickets y las propuestas históricas no forman parte de la documentación normativa."*
- `[HECHO]` `docs/ECONOMIA.md` no está enlazado desde `docs/OPERATIONS.md` ni desde `docs/DOMAIN.md`, pese a ser el documento operativo natural para quien gestiona eventos de venta.

### Pasos de implementación

1. En `docs/ECONOMIA.md`, en la sección `## 1. ¿Cómo funciona el sistema de economía?`, recortar el bloque de fórmula y el ejemplo de cálculo detallado, reemplazándolos por:
   ```
   La fórmula exacta y su ejemplo de cálculo son responsabilidad de [docs/DOMAIN.md](./docs/DOMAIN.md) §2.
   Esta guía se enfoca en el procedimiento operativo: cómo activar, ajustar y desactivar ofertas y cashback.
   ```
   Conservar el resto de la sección 1 que no sea la fórmula (la explicación de "controlado desde un único lugar").
2. Revisar el resto de `docs/ECONOMIA.md` (secciones 3–7) en busca de repeticiones de la fórmula o del ejemplo de 1000/800/80 monedas; si aparecen de nuevo (p. ej. como parte de la explicación de "Activar una oferta"), simplificar a una referencia a `DOMAIN.md` §2 en lugar de repetir el cálculo completo. Conservar las tablas operativas (`saleMultiplier` por `%` de descuento, `cashbackRate` por `%` de cashback) tal cual — esas SÍ son contenido único de esta guía.
3. Sustituir el pie de página `*Última actualización: Rediseño de Tienda — TICKET-07*` por `*Documento operativo — ver docs/DOMAIN.md §2 para la fórmula normativa.*`.
4. En `docs/OPERATIONS.md`, añadir en la sección más relevante (cerca de §7 "Sistemas retirados relevantes" o crear una nueva subsección breve antes de §8) una línea:
   ```
   Para activar o ajustar ofertas y cashback en producción, ver la guía operativa
   [docs/ECONOMIA.md](./docs/ECONOMIA.md).
   ```
5. En `docs/DOMAIN.md` §2, al final de la sección, añadir:
   ```
   Para el procedimiento operativo de activar/ajustar ofertas y cashback, ver [docs/ECONOMIA.md](./docs/ECONOMIA.md).
   ```

### Checklist de limpieza

- [ ] `docs/ECONOMIA.md` no repite la derivación completa de la fórmula; remite a `DOMAIN.md` §2
- [ ] `docs/ECONOMIA.md` no contiene referencias a números de ticket sin contexto verificable
- [ ] `docs/OPERATIONS.md` y `docs/DOMAIN.md` enlazan a `docs/ECONOMIA.md`

### Criterios de aceptación

- `node tests/documentation-static-qa.mjs` pasa (enlaces nuevos válidos).
- Lectura manual: `docs/ECONOMIA.md` sigue siendo utilizable de forma independiente como runbook (no depende de leer `DOMAIN.md` para saber qué botón tocar), pero ya no es la fuente de la fórmula.

### Riesgos

- Ninguno significativo; es una edición de bajo riesgo sobre contenido ya correcto.

---

## TICKET DOC-04 — Indexar los documentos huérfanos y ampliar el mapa documental de `README.md`

**Prioridad:** Media
**Dependencias:** Ticket DOC-01 y DOC-02 deben ejecutarse primero (para no indexar archivos que luego cambian de nombre/contenido)
**Archivos afectados:** `README.md` (editar), `docs/ARCHITECTURE.md` (editar, referencias cruzadas)

### Evidencia del problema

- `[HECHO]` `README.md` § "Documentación normativa" solo lista 5 de los documentos que quedarán en `docs/` tras los tickets DOC-01/02/03/06. Los siguientes documentos, todos verificados como precisos contra el código actual, no aparecen en ningún índice: `docs/THUMBNAILS_OPTIMIZATION.md`, `docs/preview-interaction-performance.md`, `docs/lifecycle-timers.md`, `docs/JSDOC_GUIDE.md`, `docs/sistema-racha-diaria.md`, `docs/ECONOMIA.md`, `docs/operations/streak-recovery.md` (este último sí está enlazado desde `OPERATIONS.md`, pero no desde `README.md`).
- `[HECHO]` `docs/ARCHITECTURE.md` §3 "Módulos principales" no menciona `js/spa-router.js` (sí se describe en §2 pero no aparece en la lista de módulos de §3), `js/lifecycle-scheduler.js`, `js/analytics.js`, `js/backup-engine.js`, ni `js/supabase-loader.js`, pese a que todos están cargados en `index.html` y tienen documentación dedicada o presencia central en el código. Esto no es una contradicción, es una omisión que reduce la utilidad de `ARCHITECTURE.md` como mapa completo.

### Pasos de implementación

1. En `README.md`, reestructurar la sección "Documentación normativa" en dos sub-listas con encabezado propio, sin eliminar la existente:
   ```markdown
   ## Documentación normativa

   El mapa documental vigente para la plataforma es:

   - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura actual, SPA, router, persistencia y runtime
   - [docs/DOMAIN.md](docs/DOMAIN.md) — economía, monedas, tienda, racha, historial y temas
   - [docs/INTEGRATION.md](docs/INTEGRATION.md) — contrato de integración para minijuegos
   - [docs/OPERATIONS.md](docs/OPERATIONS.md) — despliegue, variables de entorno, Supabase y soporte
   - [docs/DOCUMENTATION_POLICY.md](docs/DOCUMENTATION_POLICY.md) — reglas de mantenimiento documental

   ## Guías y auditorías complementarias

   Documentos de profundidad sobre un subsistema concreto; no sustituyen al set normativo anterior
   en caso de conflicto:

   - [docs/ECONOMIA.md](docs/ECONOMIA.md) — guía operativa de ofertas y cashback
   - [docs/sistema-racha-diaria.md](docs/sistema-racha-diaria.md) — informe técnico y UX de la racha diaria
   - [docs/operations/streak-recovery.md](docs/operations/streak-recovery.md) — recuperación manual de racha (Supabase)
   - [docs/preview-interaction-performance.md](docs/preview-interaction-performance.md) — interacción y rendimiento del preview de Tienda/Colección
   - [docs/lifecycle-timers.md](docs/lifecycle-timers.md) — contrato del scheduler central de timers
   - [docs/THUMBNAILS_OPTIMIZATION.md](docs/THUMBNAILS_OPTIMIZATION.md) — optimización AVIF de portadas
   - [docs/JSDOC_GUIDE.md](docs/JSDOC_GUIDE.md) — convención de comentarios JSDoc del proyecto
   ```
2. En `docs/ARCHITECTURE.md` §3 "Módulos principales", añadir entradas breves (mismo formato que las existentes) para `js/spa-router.js`, `js/lifecycle-scheduler.js`, `js/analytics.js`, `js/backup-engine.js`, `js/supabase-loader.js`. Cada entrada debe describir responsabilidad en una o dos frases, sin re-explicar código, y enlazar a `docs/lifecycle-timers.md` y `docs/preview-interaction-performance.md` donde exista documentación dedicada.
3. En `docs/ARCHITECTURE.md` §6 "Assets y flujo visual", añadir una línea de referencia a `docs/THUMBNAILS_OPTIMIZATION.md`.

### Checklist de limpieza

- [ ] `README.md` indexa los 15 documentos vigentes de `docs/` (tras los tickets 01/02/06, el total real puede variar; ajustar el conteo en el momento de ejecución)
- [ ] `docs/ARCHITECTURE.md` §3 incluye los 5 módulos JS previamente omitidos
- [ ] `docs/ARCHITECTURE.md` §6 enlaza a `docs/THUMBNAILS_OPTIMIZATION.md`

### Criterios de aceptación

- `node tests/documentation-static-qa.mjs` pasa.
- Verificación manual: cada archivo `.md` existente en `docs/` (tras los tickets previos) aparece enlazado desde `README.md` al menos una vez.

### Riesgos

- Ninguno; es trabajo puramente aditivo de indexación.

---

## TICKET DOC-05 — (Opcional / baja prioridad) Simetría de referencias cruzadas en el set normativo

**Prioridad:** Baja
**Dependencias:** ninguna
**Archivos afectados:** `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `docs/INTEGRATION.md`, `docs/OPERATIONS.md`

### Evidencia del problema

- `[HECHO]` `README.md` enlaza a los 5 documentos normativos incluyendo `DOCUMENTATION_POLICY.md`, pero ninguno de `ARCHITECTURE.md`, `DOMAIN.md`, `INTEGRATION.md` ni `OPERATIONS.md` incluye `DOCUMENTATION_POLICY.md` en su propia sección de "Referencias cruzadas". Es una asimetría menor, no un error funcional.

### Pasos de implementación

1. Añadir `[docs/DOCUMENTATION_POLICY.md](./docs/DOCUMENTATION_POLICY.md)` a la lista de referencias cruzadas de cada uno de los 4 documentos normativos restantes.

### Criterios de aceptación

- `node tests/documentation-static-qa.mjs` pasa.

### Riesgos

- Ninguno. Ejecutar solo si hay margen después de los tickets DOC-01 a DOC-04; no bloquea nada.

---

## TICKET DOC-06 — Eliminar el documento temporal de limpieza y reconciliar la excepción del validador

**Prioridad:** Alta (bloqueante para considerar la limpieza "cerrada")
**Dependencias:** debe ejecutarse **después** de DOC-01, DOC-02, DOC-03, DOC-04 (para que sus propuestas ya aplicadas queden reflejadas antes de borrar el rastro)
**Archivos afectados:** `docs/limpieza-documentacion-temporal.md` (eliminar), posiblemente `limpieza-documentacion.md` en la raíz del repo (verificar), `tests/documentation-static-qa.mjs` (editar si aplica)

### Evidencia del problema

- `[PROPUESTA DEL USUARIO]` Se indica que `docs/limpieza-documentacion-temporal.md` es un documento temporal cuyas propuestas ya están mayormente implementadas y que debe eliminarse sin que ningún otro documento lo mencione.
- `[HECHO]` Este archivo **no fue incluido en el corpus analizado**; no se pudo leer su contenido para esta auditoría. No se puede confirmar desde aquí qué porcentaje de sus propuestas ya se aplicó ni si contiene alguna pendiente real.
- `[HECHO]` `tests/documentation-static-qa.mjs` contiene una excepción explícita de nombre de archivo:
  ```js
  if (relPath === 'limpieza-documentacion.md') {
    continue;
  }
  ```
  Este nombre (`limpieza-documentacion.md`, en la **raíz** del repo, sin "-temporal" y sin prefijo `docs/`) **no coincide exactamente** con `docs/limpieza-documentacion-temporal.md` mencionado por el usuario. Puede tratarse de: (a) el mismo archivo con una ruta o nombre distinto al que recuerda el usuario, (b) dos archivos de limpieza distintos coexistiendo, o (c) un resto de una excepción para un archivo que ya no existe. **Esto debe verificarse directamente contra el repositorio antes de ejecutar cualquier borrado.**

### Pasos de implementación

1. Listar el repositorio real (`git ls-files | grep -i limpieza`) para confirmar cuántos archivos de limpieza existen y sus rutas exactas.
2. Eliminar `limpieza-documentacion-temporal.md`.
3. Si además existe `limpieza-documentacion.md` en la raíz y es un archivo distinto y también temporal/ya aplicado, aplicar el mismo tratamiento (eliminar).
4. Si tras el paso 3 el archivo `limpieza-documentacion.md` deja de existir, eliminar también su excepción en `tests/documentation-static-qa.mjs` (el bloque `if (relPath === 'limpieza-documentacion.md') { continue; }`), para que el validador no conserve una regla muerta.
5. Buscar en todo el repo cualquier mención a `limpieza-documentacion` (ambos nombres) y confirmar que no quede ninguna referencia cruzada desde otros documentos, tal como exige el enunciado original.

### Checklist de limpieza

- [ ] Confirmado el nombre/ruta real del/de los archivo(s) de limpieza antes de borrar nada
- [ ] `limpieza-documentacion-temporal.md` no existe
- [ ] Si aplica, la excepción en `tests/documentation-static-qa.mjs` se eliminó junto con el archivo que la motivaba
- [ ] `grep -rin "limpieza-documentacion" .` no devuelve resultados fuera del propio historial de git

### Criterios de aceptación

- `node tests/documentation-static-qa.mjs` pasa.
- `grep -rin "limpieza-documentacion" --include="*.md" --include="*.mjs" .` no devuelve resultados.

---

## TICKET DOC-07 — Validación final de la consolidación

**Prioridad:** Alta
**Dependencias:** DOC-01 a DOC-06 completados
**Archivos afectados:** ninguno (solo verificación)

### Pasos de implementación

1. Ejecutar `node tests/documentation-static-qa.mjs` — debe pasar sin errores ni advertencias.
2. Ejecutar `node tests/shop-catalog-static-qa.mjs` — no debería verse afectado por estos cambios, pero confirma que no se tocó accidentalmente ningún contrato de datos mencionado en la documentación editada (`data/shop.json`, IDs retirados).
3. Búsqueda manual de referencias muertas específicas de este plan:
   ```bash
   grep -rn "love-arcade-coin-system\|love-arcade-minigame-dev-manual" .
   grep -in "streak_boost\|isEventActive\|events\.json" docs/
   grep -rin "limpieza-documentacion" --include="*.md" --include="*.mjs" .
   grep -n "TICKET-07" docs/ECONOMIA.md
   grep -n "GitHub Pages" docs/*.md
   ```
   Todas deben devolver **cero resultados** (salvo, si aplica, coincidencias intencionales nuevas creadas por este mismo plan, que deben revisarse una por una).
4. Confirmar que `README.md` enlaza a cada archivo `.md` que sobrevive en `docs/` (conteo manual: número de archivos `.md` en `docs/` recursivo == número de enlaces distintos a `docs/` en `README.md`, con la única excepción justificada de `docs/DOCUMENTATION_POLICY.md` §"Validación documental mínima" si se decide no indexar algún artefacto puramente interno — no se prevé ningún caso así tras este plan).
5. Revisión de coherencia cruzada final: abrir `docs/DOMAIN.md`, `docs/ARCHITECTURE.md`, `docs/INTEGRATION.md`, `docs/OPERATIONS.md`, `docs/ECONOMIA.md`, `docs/sistema-racha-diaria.md` en conjunto y confirmar que ninguno contradice a otro en: modelo de despliegue (Vercel, no GitHub Pages), modelo de integración de minijuegos (páginas independientes, no incrustación), fórmula de economía (una sola fuente: `DOMAIN.md` §2), y reglas de racha diaria (sin sistema de eventos LTE).

### Criterios de aceptación

- Todos los comandos del paso 3 devuelven cero resultados no intencionales.
- `node tests/documentation-static-qa.mjs` y `node tests/shop-catalog-static-qa.mjs` pasan.
- Revisión de coherencia cruzada del paso 5 sin hallazgos.

---

## Orden de ejecución recomendado

```
DOC-01 ──┐
DOC-02 ──┼──► DOC-04 ──► DOC-06 ──► DOC-07
DOC-03 ──┘
DOC-05 (independiente, ejecutar en cualquier momento antes de DOC-07)
```

DOC-01, DOC-02 y DOC-03 son independientes entre sí y pueden ejecutarse en paralelo o en cualquier orden. DOC-04 depende de que los anteriores hayan terminado porque construye el índice sobre el estado final de `docs/`. DOC-06 debe ir después de todo lo demás para no eliminar un rastro de propuestas aún no verificadas. DOC-07 cierra el plan.
