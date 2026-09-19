# 1. Resumen ejecutivo

La documentación actual está sobredimensionada, mezcla arquitectura vigente con histórico de versiones y conserva numerosos documentos que son tickets, propuestas o auditorías ya cerradas. Esto dificulta que una persona o un agente de IA identifique qué comportamiento es contractual hoy.

**Hechos verificados:**

- El proyecto es una SPA estática en HTML, CSS y JavaScript vanilla.
- La entrada principal es `index.html`.
- La navegación principal expone las vistas `home`, `shop` y `profile` mediante `js/spa-router.js`.
- La economía, persistencia local, racha diaria, identidad y parte de la sincronización viven principalmente en `js/app.js`.
- La tienda usa actualmente `data/shop.json`, y `js/shop-logic.js` valida el contrato de catálogo.
- La Colección se monta bajo demanda y el canje de promociones está actualmente en Perfil.
- Los juegos son subaplicaciones independientes dentro de `games/`.
- Existe un backend serverless opcional en `api/`, una integración opcional con Supabase y un Service Worker.
- La sincronización local usa `localStorage`, `sync-worker.js`, checksum SHA-256 y, para backups, compresión gzip.
- El repositorio no contiene `package.json`, bundler ni scripts npm; se sirve como sitio estático.

**Problema principal:** `docs/DOCUMENTACION.md` contiene una gran cantidad de changelog histórico que sigue presentándose junto a la arquitectura actual. Además, varios documentos contienen tickets y propuestas que contradicen el código vigente o describen sistemas retirados.

**Recomendación:** reducir la documentación mantenida a pocos documentos normativos:

1. `README.md`: orientación rápida y cómo ejecutar.
2. `docs/ARCHITECTURE.md`: arquitectura actual y flujo de datos.
3. `docs/DOMAIN.md`: economía, racha, identidad, inventario y promociones.
4. `docs/INTEGRATION.md`: contrato para minijuegos.
5. `docs/OPERATIONS.md`: despliegue, APIs opcionales, Supabase, Service Worker y soporte.
6. `docs/DOCUMENTATION_POLICY.md`: reglas de mantenimiento documental.

El resto debe consolidarse, reescribirse o eliminarse tras extraer su conocimiento permanente.

**Nota sobre la evidencia:** la búsqueda léxica de tickets devuelve un máximo de 10 resultados y puede ser incompleta. Puede ampliarse en GitHub mediante [la búsqueda de `TICKET-` en el repositorio](https://github.com/LilithNML/love_arcade/search?q=TICKET-&type=code).

---

# 2. Matriz por documento

## Documentación raíz y transversal

| Archivo | Categoría | Acción | Destino | Evidencia |
|---|---|---|---|---|
| `README.md` | Entrada de proyecto | Actualizar | Mantener como guía breve; enlazar a `docs/ARCHITECTURE.md`, `DOMAIN.md`, `INTEGRATION.md` y `OPERATIONS.md` | Describe SPA, economía, tienda, juegos y ejecución local, pero contiene versiones históricas y afirmaciones que deben alinearse con el código actual |
| `AGENTS.md` | Instrucciones de agentes | Conservar y separar conceptualmente de la documentación de producto | Mantener en raíz; no duplicar sus reglas en nuevos documentos | Contiene instrucciones operativas para agentes y skills locales |
| `docs/DOCUMENTACION.md` | Referencia técnica + histórico | Reescribir | Sustituir por `docs/ARCHITECTURE.md`, `docs/DOMAIN.md` y `docs/OPERATIONS.md` | Tiene más de veinte secciones históricas, changelogs y referencias a sistemas retirados |
| `docs/ECONOMIA.md` | Dominio económico | Actualizar y reducir | `docs/DOMAIN.md` | Explica `ECONOMY`, descuentos y cashback, pero incluye ejemplos configurables que no deben presentarse como valores vigentes |
| `docs/JSDOC_GUIDE.md` | Convención de código | Conservar, actualizar referencias | Mantener como `docs/JSDOC_GUIDE.md` | Es una guía breve y todavía aplicable; no describe historial |
| `docs/love-arcade-coin-system.md` | Contrato de integración | Consolidar | `docs/INTEGRATION.md` | El contrato `window.GameCenter.completeLevel()` es conocimiento permanente |
| `docs/love-arcade-minigame-dev-manual.md` | Guía de minijuegos | Consolidar | `docs/INTEGRATION.md` | Duplica el contrato económico y añade reglas de aislamiento, rutas y namespacing |
| `docs/lifecycle-timers.md` | Arquitectura runtime | Actualizar | `docs/ARCHITECTURE.md` o sección de lifecycle en `docs/OPERATIONS.md` | Describe `AppScheduler`, pero contiene un inventario etiquetado como “original” que puede quedar obsoleto |
| `docs/preview-interaction-performance.md` | Diseño técnico de tienda | Consolidar | `docs/ARCHITECTURE.md`, sección Tienda | Sus reglas de delegación, umbral de swipe y precarga reflejan el diseño actual de `shop-logic.js` |
| `docs/THUMBNAILS_OPTIMIZATION.md` | Rendimiento de assets | Consolidar | `docs/ARCHITECTURE.md`, sección Assets | El patrón AVIF responsive y `srcset` está reflejado en `index.html` y `sw.js` |
| `docs/material-expressive-design-audit.md` | Auditoría/propuesta de temas | Eliminar tras rescate | Conocimiento mínimo sobre `THEMES` en `docs/DOMAIN.md` o `ARCHITECTURE.md` | Contiene una propuesta de migración a 25 temas; el código actual de `index.html` todavía muestra el mapa de temas inline y requiere revisión humana antes de declarar el número contractual |
| `docs/player-hub.md` | Propuesta y tickets de UI | Eliminar tras rescate | Solo comportamiento vigente de racha en `docs/DOMAIN.md` | Es un documento de diagnóstico y propuestas sobre ambient background, no una especificación actual fiable |
| `docs/player-hub-v2.md` | Propuesta y tickets de UI | Eliminar tras rescate | Solo decisión vigente del ambient, si se confirma en CSS | Contiene tickets cancelados, propuestas y recomendaciones; no debe permanecer como documentación normativa |
| `docs/rediseno-tienda.md` | Plan/tickets de rediseño | Eliminar tras rescate | Contrato actual de tienda en `docs/ARCHITECTURE.md` | El propio documento mezcla estado antiguo, propuesta y tickets; el código actual ya refleja parte importante del rediseño |
| `docs/shop-catalog-migration.md` | Ticket/documentación de migración | Eliminar tras rescate | Regla de catálogo en `docs/ARCHITECTURE.md` | El contrato publicado de `shop.json` y la retirada de regalos son conocimiento permanente |
| `docs/sistema-racha-diaria.md` | Dominio + auditoría | Reescribir | `docs/DOMAIN.md` | Contiene conocimiento valioso, pero también recomendaciones, riesgos históricos, referencias a archivos inexistentes o no confirmados y secciones de actualización mezcladas |
| `docs/operations/streak-recovery.md` | Procedimiento operativo privilegiado | Mantener como guía canónica separada | `docs/operations/streak-recovery.md` | Es un procedimiento de soporte destructivo; debe quedar claramente marcado como operación manual con aprobación humana |

## Documentación de assets

| Archivo | Categoría | Acción | Destino | Evidencia |
|---|---|---|---|---|
| `assets/icon/README.md` | Diseño de assets | Conservar y simplificar | Mantener junto a los assets o mover a `docs/ASSETS.md` | Describe el origen editable `icon_main.piskel` y el flujo de exportación |
| `games/jungle-dash/docs/jungle-dash-docs.md` | Documentación específica de juego | Conservar, pero revisar vigencia | Mantener en `games/jungle-dash/docs/` | Contiene reglas técnicas propias de Jungle Dash |
| `games/jungle-dash/docs/jungle-dash-economy.md` | Economía específica de juego | Conservar si los valores coinciden con código; si no, actualizar | Mantener en el juego | Debe seguir siendo documentación local del juego, no duplicarse en la economía global |
| `games/jungle-dash/docs/jungle-dash-sprites.md` | Assets específicos de juego | Conservar | Mantener en el juego | Especifica sprites, dimensiones y fallback de carga |

## Documentación por minijuego

| Archivo | Categoría | Acción | Destino | Evidencia |
|---|---|---|---|---|
| `games/2048/README.md` | Histórico técnico de juego | Reescribir | `games/2048/README.md` | El documento usa la ruta obsoleta `games/lumina-2048/` y contiene un changelog extenso; el código actual está en `games/2048/` |
| `games/Shooter/README.md` | Documentación específica de juego | Actualizar | Mantener en `games/Shooter/README.md` | Debe describir entrypoint, módulos y contrato actual con el hub |
| `games/Shooter/GUIA_RECOMPENSAS.md` | Economía específica de juego | Consolidar | `games/Shooter/README.md` o `docs/INTEGRATION.md` si es contrato global | Evitar duplicar reglas globales; conservar solo la conversión propia del juego |
| `games/Shooter/assets/CREDITS.md` | Créditos de assets | Conservar | Mantener junto a assets | No es documentación arquitectónica |
| `games/jigsaw/README.md` | Documentación específica de juego | Actualizar | Mantener en el juego | Debe reflejar la ruta `games/jigsaw/` y el estado actual |
| `games/jigsaw/RELEASE_CHECKLIST.md` | Checklist de release | Conservar si sigue siendo operativo; revisar | Mantener en el juego | Es útil para el release del minijuego, pero no debe confundirse con un ticket |
| `games/jigsaw/assets/README.md` | Assets específicos | Conservar | Mantener en el juego | Alcance local |
| `games/rompecabezas/documentacion-rompecabezas-arcade.md` | Documentación específica de juego | Actualizar | Mantener en el juego | Debe contrastarse con `src/` y no duplicar el contrato global |
| `games/rompecabezas/public/criterios-aceptacion-levels.md` | Criterios de juego | Conservar como criterios del juego | Mantener en el juego | No es documentación de plataforma |
| `games/word-hunt/README.md` | Documentación específica de juego | Actualizar | Mantener en el juego | Revisar nombres históricos en `antiguos/` y contrato actual |
| `games/ollin-smash/README.md` | Documentación específica de juego | Actualizar | Mantener en el juego | Alcance local del juego |
| `games/2048/README.md`, `games/Shooter/README.md`, `games/jigsaw/README.md`, `games/word-hunt/README.md`, `games/ollin-smash/README.md` | Conjunto de READMEs de juegos | Normalizar | Un README corto por juego | Todos deberían seguir la misma estructura mínima: entrada, módulos, persistencia propia, integración con `GameCenter`, ejecución standalone y salida al hub |

## Archivos Markdown que no deben tratarse como documentación normativa

| Archivo | Categoría | Acción | Destino | Evidencia |
|---|---|---|---|---|
| `games/*/test/*.js` | Código de pruebas, no Markdown | No modificar en esta auditoría documental | N/A | Son tests ejecutables |
| `games/word-hunt/antiguos/*` | Datos o artefactos retirados | No documentar salvo una línea de contexto | N/A | El directorio se identifica explícitamente como `antiguos` |
| Cualquier nuevo `.md` dentro de una carpeta de juego | Documentación local | Revisar caso por caso | README o docs locales del juego | No debe duplicar contratos de plataforma |

---

# 3. Conocimiento a rescatar de cada ticket

## 3.1 Tickets del rediseño de tienda

Fuente principal: `docs/rediseno-tienda.md` y `docs/shop-catalog-migration.md`.

| Conocimiento permanente | Destino |
|---|---|
| `data/shop.json` es la fuente publicada del catálogo | `docs/ARCHITECTURE.md` |
| El contrato de catálogo usa `id`, `name`, `price`, `category`, `type`, `imageUrl` y opcionalmente `downloadUrl` para archivos | `docs/ARCHITECTURE.md` |
| Los IDs del inventario son estables y no deben reutilizarse | `docs/DOMAIN.md` |
| La tienda muestra artículos no poseídos; la colección muestra artículos poseídos | `docs/ARCHITECTURE.md` |
| La Colección se monta bajo demanda | `docs/ARCHITECTURE.md` |
| La búsqueda está localizada en Colección, no es una búsqueda global de la Tienda | `docs/ARCHITECTURE.md` |
| La compra delega la autoridad económica en `GameCenter.buyItem()` | `docs/DOMAIN.md` |
| Los descuentos se muestran como señal por tarjeta y en la confirmación, no como una arquitectura económica separada | `docs/DOMAIN.md` |
| Las promociones se canjean desde Perfil mediante `GameCenter.redeemPromoCode()` | `docs/DOMAIN.md` |
| La retirada del sistema de regalos no implica borrar el significado de IDs históricos del inventario | `docs/DOMAIN.md` |
| La interacción de tarjetas usa delegación y debe distinguir tap de scroll | `docs/ARCHITECTURE.md` |
| La precarga de imágenes usa `IntersectionObserver`, prioridad baja y cola idle cuando aplica | `docs/ARCHITECTURE.md` |
| Las tarjetas usan imágenes responsive y Cloudinary/CDN según el flujo actual | `docs/ARCHITECTURE.md` |

**No rescatar como conocimiento vigente:**

- `shop-gifts.json` como fuente activa.
- Carrusel de regalos.
- Requisitos de partidas para desbloquear regalos.
- Filtros históricos de Tienda.
- Banner global de ofertas.
- Mockups dependientes de tags antiguos.
- Cualquier propuesta que diga que todavía hay que implementar la migración, porque el código actual ya contiene `_validateCatalog()` y la estructura nueva en `index.html`.

## 3.2 Tickets del Player Hub y ambient background

Fuentes: `docs/player-hub.md`, `docs/player-hub-v2.md` y referencias actuales de `docs/DOCUMENTACION.md`.

| Conocimiento permanente | Destino |
|---|---|
| La racha es una función del dominio económico, no un módulo aislado de UI | `docs/DOMAIN.md` |
| `js/streak-hub.js` es un adaptador visual y de feedback | `docs/ARCHITECTURE.md` |
| El fuego y sus partículas son decorativos y no deben ser el canal principal de anuncios accesibles | `docs/DOMAIN.md` o `docs/ACCESSIBILITY.md` si se crea |
| `#daily-msg` es el canal textual de estado del reclamo | `docs/DOMAIN.md` |
| Las animaciones deben respetar visibilidad y `prefers-reduced-motion` | `docs/ARCHITECTURE.md` |
| El ambient del HUD debe documentarse únicamente según el CSS actual | `docs/ARCHITECTURE.md` |

**Revisión humana requerida:** los documentos de Player Hub se contradicen entre sí sobre si `hudAmbientSweep` sigue existiendo. El código actual debe ser la autoridad final antes de escribir una afirmación sobre:

- ambient animado frente a estático;
- uso de ruido/dithering;
- uso de `filter: blur()`;
- selectores `motion-paused`;
- comportamiento exacto en `prefers-reduced-motion`.

## 3.3 Tickets de Themes

Fuente: `docs/material-expressive-design-audit.md`.

| Conocimiento permanente | Destino |
|---|---|
| Los temas se definen en `THEMES` y se exponen como `window.THEMES` | `docs/DOMAIN.md` |
| `window.THEMES[key].accent` es una superficie de compatibilidad para minijuegos | `docs/INTEGRATION.md` |
| El tema persistido forma parte del store principal | `docs/DOMAIN.md` |
| Existe un script inline de inicialización temprana para evitar parpadeo visual | `docs/ARCHITECTURE.md` |

**No rescatar como hecho:**

- Que existen exactamente 25 temas.
- Que la migración a 25 temas está implementada.
- Que todos los tokens se derivan dinámicamente.
- Que no hay duplicación entre `index.html` y `app.js`.

El propio código de `index.html` demuestra que el mapa inline y `THEMES` tienen una relación de duplicación intencional; el número y contrato definitivo de temas requieren inspección adicional de `app.js` y `styles.css`.

## 3.4 Tickets históricos de arquitectura

De `docs/DOCUMENTACION.md`, `docs/lifecycle-timers.md`, `docs/preview-interaction-performance.md` y `docs/THUMBNAILS_OPTIMIZATION.md` se rescata:

- Router SPA con History API.
- Vistas `home`, `shop` y `profile`.
- `onEnter()`/`onLeave()` para lifecycle de vistas.
- Cola cooperativa `requestAnimationFrame` + idle en el router.
- Catálogo validado antes de renderizar.
- Precarga oportunista de imágenes.
- Uso de AVIF responsive en portadas.
- Service Worker con app shell y cache runtime para Cloudinary.
- SVG sprite estático en lugar de iconos generados dinámicamente.
- Ausencia de bundling o compilación.

Destino principal: `docs/ARCHITECTURE.md`.

## 3.5 Tickets operativos de Supabase y APIs

| Conocimiento permanente | Destino |
|---|---|
| `/api/client-config.js` expone únicamente configuración pública de Supabase desde variables de Vercel | `docs/OPERATIONS.md` |
| `NEXT_PUBLIC_LA_CLOUD_URL` y `NEXT_PUBLIC_LA_CLOUD_ANON_KEY` son necesarias para activar cloud sync | `docs/OPERATIONS.md` |
| La ausencia de esas variables debe producir degradación elegante | `docs/OPERATIONS.md` |
| `/api/report.js` y `/api/telemetry.js` comparten handler | `docs/OPERATIONS.md` |
| El endpoint de reportes acepta POST y enruta eventos a Topics de Telegram | `docs/OPERATIONS.md` |
| El token de Telegram nunca se expone al cliente | `docs/OPERATIONS.md` |
| La recuperación manual de racha modifica snapshots JSON almacenados en Supabase | `docs/operations/streak-recovery.md` |
| La recuperación manual debe actualizar `updated_at` y respetar Last Write Wins | `docs/operations/streak-recovery.md` |
| El sistema de notificaciones push fue retirado por la migración `20260918_remove_notifications.sql` | Una línea en `docs/OPERATIONS.md`: “Retirado; reemplazo: no confirmado en código actual” |

---

# 4. Nueva estructura de carpetas

```text
README.md
AGENTS.md

docs/
├── ARCHITECTURE.md
├── DOMAIN.md
├── INTEGRATION.md
├── OPERATIONS.md
├── DOCUMENTATION_POLICY.md
├── JSDOC_GUIDE.md
├── ASSETS.md                         # opcional; solo si assets/icon/README.md se mueve
└── operations/
    └── streak-recovery.md

games/
├── 2048/
│   └── README.md
├── Dodger/
│   └── README.md                     # crear si no existe y se considera necesario
├── Shooter/
│   └── README.md
├── jigsaw/
│   ├── README.md
│   └── RELEASE_CHECKLIST.md
├── jungle-dash/
│   └── docs/
│       ├── jungle-dash-docs.md
│       ├── jungle-dash-economy.md
│       └── jungle-dash-sprites.md
├── ollin-smash/
│   └── README.md
├── rompecabezas/
│   ├── README.md                     # consolidar documentación actual
│   └── public/
│       └── criterios-aceptacion-levels.md
└── word-hunt/
    └── README.md
```

## Propósito de cada archivo

### `README.md`

Debe responder rápidamente:

- qué es Love Arcade;
- cómo levantarlo localmente;
- cuál es la entrada principal;
- qué tecnologías usa;
- dónde leer arquitectura, dominio e integración;
- qué comandos de validación existen realmente.

No debe contener changelog ni fórmulas detalladas.

### `docs/ARCHITECTURE.md`

Debe describir:

- runtime estático;
- carga de `index.html`;
- orden de los scripts principales;
- vistas SPA y router;
- `app.js`, `shop-logic.js`, `streak-hub.js`, `sync-worker.js`;
- persistencia local;
- cloud sync opcional;
- tienda y catálogo;
- Service Worker;
- ciclo de vida de timers y vistas;
- flujo de assets;
- APIs serverless como componentes externos al frontend.

### `docs/DOMAIN.md`

Debe ser la única fuente de conocimiento para:

- monedas;
- recompensas;
- inventario;
- compras;
- descuentos;
- cashback;
- promociones;
- racha diaria;
- Bendición Lunar;
- identidad;
- temas;
- historial de transacciones.

Debe separar claramente:

- **Hecho verificado:** respaldado por código actual.
- **Inferencia:** comportamiento deducido, pero no probado por un test específico.
- **No confirmado:** requiere revisión humana.

### `docs/INTEGRATION.md`

Debe ser la única fuente para desarrolladores de minijuegos:

- ubicación en `games/`;
- entrypoint HTML;
- botón de salida al hub;
- namespacing;
- persistencia propia;
- `window.GameCenter.completeLevel()`;
- formato de recompensa;
- modo standalone;
- globales reservados;
- contrato de `window.THEMES`;
- checklist de integración.

### `docs/OPERATIONS.md`

Debe describir:

- despliegue Vercel;
- variables de entorno;
- endpoints `/api`;
- Supabase opcional;
- Service Worker y versionado de cache;
- recuperación manual de racha;
- límites de seguridad;
- sistemas retirados relevantes;
- diagnóstico de degradación cloud.

### `docs/operations/streak-recovery.md`

Debe conservar el SQL de soporte, pero con:

- advertencia de privilegios;
- precondiciones;
- backup obligatorio;
- validación posterior;
- prohibición de ejecutarlo sin aprobación humana;
- indicación de que no es una API de aplicación.

### `docs/DOCUMENTATION_POLICY.md`

Debe incluir únicamente reglas breves de mantenimiento.

### READMEs de juegos

Cada README debe limitarse a:

1. Entrada.
2. Módulos principales.
3. Persistencia propia.
4. Controles.
5. Integración con el hub.
6. Comando o servidor local para probarlo.
7. Tests existentes.
8. Riesgos específicos.

No debe repetir la economía global completa.

---

# 5. Política de mantenimiento

## Principios

1. El código y la configuración actuales son la autoridad.
2. Cada conocimiento debe tener un único documento propietario.
3. Los comentarios de código explican implementación local; Markdown explica contratos, decisiones y límites.
4. No se conserva un ticket como documentación vigente.
5. Los changelogs históricos no forman parte de la documentación normativa.
6. Las propuestas deben estar fuera de la documentación actual o marcadas explícitamente como propuestas.
7. Las afirmaciones no verificables deben etiquetarse como `revisión humana`.

## Crear un documento

Crear un archivo solo si:

- tiene un propietario claro;
- responde a una necesidad recurrente;
- no duplica otro documento;
- su coste de actualización es menor que el coste de reconstruir el conocimiento desde el código.

## Actualizar un documento

Actualizarlo cuando cambie:

- un contrato público;
- un formato de datos;
- una regla de negocio;
- una ruta de ejecución;
- una dependencia operativa;
- una decisión de seguridad;
- un comportamiento observable necesario para agentes.

No actualizarlo por:

- cambios internos que el código ya explica bien;
- refactors sin cambio de contrato;
- correcciones de estilo;
- cada commit.

## Consolidar

Consolidar cuando varios archivos explican el mismo conocimiento:

- economía → `DOMAIN.md`;
- arquitectura SPA → `ARCHITECTURE.md`;
- integración de minijuegos → `INTEGRATION.md`;
- despliegue y soporte → `OPERATIONS.md`.

El documento absorbido debe eliminarse después de verificar que no se pierde conocimiento permanente.

## Eliminar

Eliminar un documento cuando:

- es un ticket ya implementado;
- es una propuesta que ya no dirige el sistema;
- es un changelog histórico sin valor operativo;
- describe un sistema retirado;
- duplica completamente otro documento.

Antes de eliminarlo, registrar en el ticket:

- qué conocimiento se rescata;
- destino de cada conocimiento;
- qué se descarta por ser histórico o falso frente al código.

## Automatización justificada

Automatizar solo comprobaciones baratas y deterministas:

- enlaces Markdown rotos;
- rutas de archivos referenciadas que no existen;
- referencias a símbolos públicos inexistentes;
- referencias a documentos eliminados;
- contrato estático de `data/shop.json`.

No automatizar:

- generación automática de documentación desde todos los comentarios;
- sincronización de changelogs;
- duplicación de contratos entre README y docs;
- comprobaciones semánticas que produzcan falsos positivos.

## Validación documental mínima

Antes de fusionar cambios documentales:

```text
1. Buscar enlaces internos rotos.
2. Buscar nombres de archivos eliminados o movidos.
3. Buscar símbolos públicos mencionados y confirmar que existen.
4. Buscar tickets, "propuesta", "pendiente" o "histórico" en documentación normativa.
5. Ejecutar el validador de catálogo si cambia la tienda.
```

---

# 6. Tickets para otro agente

Todos los tickets siguientes son **solo documentales**. No deben modificar código fuente ni configuración runtime.

---

## DOC-001: Definir el mapa documental vigente

**Objetivo:** Crear la estructura documental nueva y establecer la propiedad única de cada conocimiento.

**Archivos:**  
- Crear: `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `docs/INTEGRATION.md`, `docs/OPERATIONS.md`, `docs/DOCUMENTATION_POLICY.md`.
- Modificar: `README.md`.
- Consultar: `index.html`, `js/app.js`, `js/shop-logic.js`, `js/spa-router.js`, `js/streak-hub.js`, `js/sync-worker.js`, `sw.js`, `api/*`, `vercel.json`, `manifest.webmanifest`.

**Dependencias:** Ninguna.

**Alcance:**  
- Crear documentos normativos.
- Declarar hechos, inferencias y elementos no confirmados.
- Añadir referencias cruzadas.

**Fuera de alcance:**  
- No modificar código.
- No eliminar todavía documentación histórica.
- No resolver discrepancias funcionales.

**Criterios de aceptación verificables:**

- Existen los cinco documentos nuevos.
- Cada uno tiene un propósito explícito.
- No hay secciones duplicadas entre ellos.
- `README.md` enlaza a los documentos nuevos.
- Las afirmaciones no confirmadas están marcadas.

**Riesgos:**  
- Documentar como hecho una propuesta de `docs/`.
- Duplicar economía o integración en varios archivos.

---

## DOC-002: Reescribir la referencia de arquitectura

**Objetivo:** Documentar cómo funciona hoy la SPA, el router, la tienda, la persistencia, el worker y el Service Worker.

**Archivos:**  
- Modificar: `docs/ARCHITECTURE.md`.
- Eliminar después de rescatar: `docs/DOCUMENTACION.md`, sujeto a DOC-006.
- Consultar: `index.html`, `js/app.js`, `js/shop-logic.js`, `js/spa-router.js`, `js/sync-worker.js`, `sw.js`, `manifest.webmanifest`, `vercel.json`.

**Dependencias:** DOC-001.

**Alcance:**  
- Flujo de arranque.
- Vistas `home`, `shop`, `profile`.
- Ciclo de vida `onEnter`/`onLeave`.
- Catálogo y Colección.
- Precarga.
- Cache offline.
- Backups locales.

**Fuera de alcance:**  
- No documentar changelogs.
- No documentar propuestas de rediseño.
- No cambiar código.

**Criterios de aceptación verificables:**

- Se puede localizar cada módulo principal desde el documento.
- Se explican las dependencias entre `app.js`, router, tienda y worker.
- Se distinguen claramente funciones locales, cloud y serverless.
- No se describen `shop-gifts.json`, filtros históricos ni sistemas retirados como activos.

**Riesgos:**  
- Confundir el Service Worker con persistencia de negocio.
- Presentar Supabase como obligatorio.
- Declarar detalles de precarga no confirmados por el código actual.

---

## DOC-003: Consolidar el dominio de negocio

**Objetivo:** Crear una única referencia de economía, inventario, compras, promociones, racha, Bendición Lunar, identidad y temas.

**Archivos:**  
- Modificar: `docs/DOMAIN.md`.
- Eliminar después de rescatar: `docs/ECONOMIA.md`, `docs/sistema-racha-diaria.md`.
- Consultar: `js/app.js`, `js/shop-logic.js`, `js/streak-hub.js`, `index.html`, `data/shop.json`.

**Dependencias:** DOC-001.

**Alcance:**  
- Reglas verificadas en el código.
- Fórmulas actuales.
- Estado persistido.
- APIs públicas de `GameCenter`.
- Estados de error y límites conocidos.

**Fuera de alcance:**  
- No cambiar reglas económicas.
- No documentar ejemplos como configuración real si no se verifican.
- No incluir recomendaciones futuras como comportamiento actual.

**Criterios de aceptación verificables:**

- Cada regla tiene etiqueta de evidencia.
- La fórmula de cashback coincide con `app.js`.
- La racha incluye continuidad, ruptura, reparación y reloj según código actual.
- La Bendición Lunar se documenta como modificación de recompensa, no de racha.
- Los temas se documentan solo en el número y forma confirmados por código.

**Riesgos:**  
- Las documentaciones actuales contienen valores históricos o recomendaciones.
- Puede existir discrepancia entre `canClaimDaily()`, `claimDaily()` y la documentación previa.

---

## DOC-004: Consolidar el contrato de integración de minijuegos

**Objetivo:** Crear una guía única para desarrollar e integrar juegos dentro de Love Arcade.

**Archivos:**  
- Crear/modificar: `docs/INTEGRATION.md`.
- Eliminar después de rescatar: `docs/love-arcade-coin-system.md`, `docs/love-arcade-minigame-dev-manual.md`.
- Consultar: `index.html`, `js/app.js`, `games/*/index.html`, `games/*/README.md`.

**Dependencias:** DOC-001.

**Alcance:**  
- Estructura de `games/`.
- Namespacing.
- Salida al hub.
- `GameCenter.completeLevel()`.
- Modo standalone.
- Persistencia local del juego.
- Globales reservados.

**Fuera de alcance:**  
- No modificar juegos.
- No imponer APIs que no existan.
- No describir `GameCenter` como disponible en contextos donde el código no lo cargue.

**Criterios de aceptación verificables:**

- Se define el contrato de parámetros de `completeLevel`.
- Se diferencia recompensa global de economía interna del juego.
- Se documenta la degradación cuando `GameCenter` no está disponible.
- No se repite la economía completa de la plataforma.

**Riesgos:**  
- Algunos READMEs de juegos usan nombres históricos.
- El orden real de carga de `app.js` debe prevalecer sobre la documentación antigua.

---

## DOC-005: Consolidar operaciones y dependencias externas

**Objetivo:** Documentar Vercel, APIs, Supabase, Service Worker y recuperación manual.

**Archivos:**  
- Crear/modificar: `docs/OPERATIONS.md`, `docs/operations/streak-recovery.md`.
- Consultar: `api/client-config.js`, `api/report.js`, `api/telemetry.js`, `vercel.json`, `sw.js`, `supabase/migrations/*`, `js/supabase-loader.js`, `js/app.js`.

**Dependencias:** DOC-001.

**Alcance:**  
- Variables de entorno.
- Contratos de endpoints.
- Degradación cuando faltan credenciales.
- Cache versionado.
- Procedimiento de recuperación de racha.
- Sistemas retirados relevantes.

**Fuera de alcance:**  
- No ejecutar SQL.
- No cambiar variables de entorno.
- No modificar endpoints ni migraciones.

**Criterios de aceptación verificables:**

- Se identifican todas las variables de entorno usadas por `api/`.
- Se distingue configuración pública de secretos.
- La recuperación manual exige backup, aprobación y actualización de `updated_at`.
- Las notificaciones push retiradas se mencionan solo como sistema retirado.
- No se afirma que exista un reemplazo si no está confirmado.

**Riesgos:**  
- Exponer secretos en documentación.
- Presentar Supabase o Telegram como imprescindibles para la experiencia local.

---

## DOC-006: Retirar documentación histórica y tickets

**Objetivo:** Eliminar documentos de tickets y propuestas después de trasladar su conocimiento permanente.

**Archivos:**  
- Eliminar: `docs/DOCUMENTACION.md`, `docs/player-hub.md`, `docs/player-hub-v2.md`, `docs/rediseno-tienda.md`, `docs/shop-catalog-migration.md`, `docs/material-expressive-design-audit.md`.
- Actualizar referencias en: `README.md`, documentos nuevos y READMEs de juegos.
- Consultar todos los archivos Markdown de `docs/`.

**Dependencias:** DOC-002, DOC-003, DOC-004 y DOC-005.

**Alcance:**  
- Eliminar tickets y changelogs de la documentación normativa.
- Rescatar decisiones de tienda, themes, racha y ambient solo cuando estén confirmadas.

**Fuera de alcance:**  
- No borrar READMEs específicos de juegos.
- No borrar créditos ni checklists locales sin revisión individual.
- No modificar código.

**Criterios de aceptación verificables:**

- No existen documentos raíz de tickets sobre tienda, Player Hub o themes.
- Las referencias a esos archivos están actualizadas.
- No se pierde ninguna regla de negocio confirmada.
- No queda ningún ticket presentado como documentación actual.

**Riesgos:**  
- El histórico puede contener alguna decisión no repetida en código.
- La contradicción sobre `hudAmbientSweep` requiere revisión humana antes de redactar el estado final.

---

## DOC-007: Normalizar READMEs de minijuegos

**Objetivo:** Reducir y actualizar la documentación local de cada juego sin duplicar contratos globales.

**Archivos:**  
- Modificar según corresponda: `games/2048/README.md`, `games/Shooter/README.md`, `games/jigsaw/README.md`, `games/ollin-smash/README.md`, `games/rompecabezas/*`, `games/word-hunt/README.md`.
- Consultar los entrypoints y módulos de cada juego.
- No modificar archivos `.js`, `.html`, `.css` ni datos.

**Dependencias:** DOC-004.

**Alcance:**  
- Corregir rutas y nombres obsoletos.
- Describir arquitectura local de cada juego.
- Enlazar al contrato global.

**Fuera de alcance:**  
- No modificar comportamiento de juegos.
- No actualizar números de versión salvo que estén confirmados en código.
- No convertir changelogs en documentación vigente.

**Criterios de aceptación verificables:**

- Cada juego tiene un README corto y actual.
- Las rutas documentadas existen.
- El README enlaza a `docs/INTEGRATION.md` en vez de duplicarlo.
- Las secciones históricas se eliminan o se marcan fuera de la documentación vigente.

**Riesgos:**  
- Algunos juegos tienen arquitecturas y convenciones incompatibles entre sí.
- `games/2048/README.md` contiene una ruta histórica que no coincide con la carpeta real.

---

## DOC-008: Añadir validaciones documentales de bajo coste

**Objetivo:** Automatizar únicamente detecciones justificadas por el coste de mantenimiento.

**Archivos:**  
- Crear: documentación del procedimiento en `docs/DOCUMENTATION_POLICY.md`.
- Opcionalmente crear: script de lectura documental bajo una ruta de herramientas ya existente, previa revisión humana.
- No modificar código de runtime.

**Dependencias:** DOC-006.

**Alcance:**  
- Enlaces Markdown rotos.
- Referencias a rutas inexistentes.
- Referencias a documentos eliminados.
- Contrato de `data/shop.json`, reutilizando `tests/shop-catalog-static-qa.mjs` si existe y sigue siendo válido.

**Fuera de alcance:**  
- No crear un generador completo de documentación.
- No validar afirmaciones visuales automáticamente.
- No añadir dependencias runtime.

**Criterios de aceptación verificables:**

- La política indica qué validaciones existen.
- Las validaciones no requieren modificar la aplicación.
- Los fallos producen mensajes accionables.
- No se inventan scripts que no existan.

**Riesgos:**  
- Añadir herramientas con coste superior al beneficio.
- Confundir validación de código con validación de documentación.

---

# 7. Decisiones que requieren aprobación humana (realizar las recomendaciones)

1. **Eliminar definitivamente la documentación histórica.**  
   Recomendación: sí, porque el objetivo explícito es documentar el sistema actual, no su historial.

2. **Confirmar el estado actual del ambient del Player HUD.**  
   Los documentos se contradicen sobre `hudAmbientSweep`, blur y dithering. Debe aprobarse una afirmación basada en inspección final de `styles.css` y `app.js`.

3. **Confirmar el número y contrato de temas.**  
   La documentación habla de cinco y también de una propuesta de 25. Debe aprobarse el número real leyendo `THEMES` actual y sus consumidores.

4. **Decidir si `docs/operations/streak-recovery.md` queda en el repositorio.**  
   Recomendación: conservarlo, pero restringido a personal autorizado y con una advertencia visible.

5. **Decidir si se mantiene `docs/JSDOC_GUIDE.md`.**  
   Recomendación: conservarlo porque es corto, no duplica arquitectura y define una convención útil.

6. **Decidir el tratamiento de los READMEs específicos de juegos.**  
   Recomendación: conservarlos, pero normalizarlos y eliminar changelogs históricos.

7. **Confirmar el alcance de la documentación de sistemas retirados.**  
   Recomendación: una sola línea por sistema cuando ayude a entender el presente, por ejemplo:  
   “El sistema de notificaciones push fue retirado en `supabase/migrations/20260918_remove_notifications.sql`; no se ha confirmado un reemplazo activo.”

8. **Confirmar si los tests estáticos existentes deben considerarse parte del contrato de publicación.**  
   El código contiene `tests/shop-catalog-static-qa.mjs` y validación interna en `js/shop-logic.js`; se recomienda documentarlos en `README.md` y `ARCHITECTURE.md`, sin crear nuevos checks salvo necesidad.

No se crearon, movieron, borraron ni modificaron archivos, y no se realizaron commits.
