# PARTE 1 — Resumen ejecutivo

## Problema actual — HECHO COMPROBADO

La Tienda concentra tres experiencias incompatibles con el objetivo planteado: catálogo filtrable/buscable, carrusel de regalos y biblioteca. Todo se carga al iniciar la aplicación: `loadCatalog()` hace `Promise.all()` de `data/shop.json` y `data/shop-gifts.json` en `DOMContentLoaded`, aunque el usuario no entre en Tienda. El catálogo usa tarjetas con texto, precio y CTAs, no una experiencia visual de exploración. `js/shop-logic.js` tiene 2.805 líneas y combina catálogo, filtros, regalos, compra, modales, correo, export/import y navegación interna de Perfil.

## Oportunidad — INFERENCIA

Eliminar filtros, búsqueda global y regalos permite reducir bifurcaciones de estado, listeners, CSS especializado, dos fuentes de catálogo y renderizados redundantes. Una Tienda visual con dos vistas explícitas —**Tienda y Colección**— encaja con el inventario persistente existente (`store.inventory[id]`) sin cambiar los IDs.

## Visión — PROPUESTA

- **Tienda**: catálogo de ítems no poseídos, grid masonry de imágenes, CTA superior no sticky para alternar a Colección y preview de compra ligero.
- **Colección**: se monta únicamente al abrirla; incluye el único buscador, filtrando en memoria por nombre.
- **Datos**: un único `data/shop.json`; URLs originales Cloudinary como fuente de imagen y transformaciones derivadas en cliente.
- **Economía**: mantener `GameCenter.buyItem()` como autoridad para descuento, saldo, cashback, inventario, historial y sincronización.
- **Perfil**: trasladar el canje de promociones a una pantalla dedicada del Perfil, reutilizando `GameCenter.redeemPromoCode()`.

## Principios de diseño — PROPUESTA

1. **Imagen antes que interfaz**: tarjetas sin texto ni CTAs.
2. **Un estado de propiedad**: `GameCenter.getBoughtCount(id) > 0`.
3. **Carga proporcional a la intención**: no montar Colección ni sus listeners hasta abrirla.
4. **Theme-first**: usar variables existentes (`--accent`, `--accent-soft`, `--accent-border`, `--on-accent`) y no colores fijos para controles nuevos.
5. **Movimiento funcional**: transiciones de `opacity`/`transform`, con `prefers-reduced-motion`.
6. **Sin comportamiento huérfano**: la retirada de filtros, búsqueda global y regalos debe borrar HTML, JS, CSS, datos, telemetría y documentación específicos.

---

# PARTE 2 — Auditoría del estado actual

## Arquitectura y flujos — HECHO COMPROBADO

| Área | Evidencia | Estado actual |
|---|---|---|
| Vista SPA | index.html:581, js/spa-router.js:48, 213, 218 | La Tienda es `#view-shop`; SpaRouter invoca `ShopView.onEnter()` al navegar a shop. |
| Catálogo | js/shop-logic.js:2500–2588 | `loadCatalog()` carga shop.json y shop-gifts.json, los combina en `allItems`, renderiza catálogo y biblioteca. |
| Filtros/búsqueda | index.html:639–672, js/shop-logic.js:1504–1577, 2710+ | Filtros por NoObtenidos, Stickers, Mobile, Avatar, Regalos, PC, Todos; búsqueda global con debounce de 300 ms. |
| Render del catálogo | js/shop-logic.js:1602–1770 | Tarjetas con imagen, nombre, precio, estado, preview y compra; lotes de 18 vía IntersectionObserver. |
| Regalos | data/shop-gifts.json; js/shop-logic.js:1286–1503, 1799–1832 | Catálogo paralelo, requisitos game_played, carrusel, autoplay cada 3,8 s, colección secundaria y estado de sesión. |
| Biblioteca | index.html:704–712, js/shop-logic.js:1835–1915 | Se renderiza durante la carga de catálogo y de nuevo tras una compra; tarjetas con descargar y correo. |
| Preview | index.html:1089+, js/shop-logic.js:1001–1260 | Modal visual ligero en relación con versiones anteriores, pero aún resuelve aspecto desde tags, precarga alta resolución y aplica protección/context menu. |
| Compra | js/shop-logic.js:1969–2050; js/app.js:904–935 | Confirmación genérica, `GameCenter.buyItem()` calcula precio con oferta, cashback, descuenta saldo, actualiza inventario, historial y cloud sync. |
| Themes | js/app.js:131–167, 2044–2081 | 25 themes; `applyTheme()` deriva roles y escribe variables CSS de acento. |
| Promociones | index.html:599–625; js/shop-logic.js:2154+; js/app.js:1016+ | UI en Tienda; negocio en `GameCenter.redeemPromoCode()` con SHA-256 y hashes persistidos. |
| Descargas | js/app.js:994–1009; js/shop-logic.js:1140, 1622, 1852 | `getDownloadUrl(id, file)` solo admite ítems poseídos y construye URL de Cloudinary desde `file`, sin `fl_attachment`. |
| Correo | js/shop-logic.js:2323–2417 | `openEmailModal()` y `MailHelper.buildMailtoLink()` siguen disponibles y se usan desde la biblioteca. |
| Documentación | docs/DOCUMENTACION.md:404+, 2049+, 2178+, 2504+, 4646+; docs/ECONOMIA.md | Documentación extensa de Cloudinary, tienda, promociones, descuentos, cashback y regalos. |

## Datos actuales — HECHO COMPROBADO

`data/shop.json` es un array de 146 objetos. Sus entradas inspeccionadas incluyen: `id`, `name`, `price`, `image`, `file`, `tags`.

Las URLs de `image` actuales ya contienen transformaciones Cloudinary, por ejemplo `f_avif,q_auto,ar_16:9,c_fill,g_auto,w_640`; no cumplen aún el objetivo de conservar únicamente URL original.

`data/shop-gifts.json` es un array de 12 objetos; incorpora además `category: "gift"` y `requirements: { type, value, description }`.

Los regalos inspeccionados usan IDs numéricos que también pertenecen al espacio global de inventario. Dado que `store.inventory` se indexa exclusivamente por ID (`store.inventory[itemData.id]`), una migración debe validar colisiones antes de fusionar o eliminar datos.

## Riesgos técnicos relevantes — HECHO COMPROBADO / INFERENCIA

- **Carga temprana innecesaria**: `loadCatalog()` se dispara en `DOMContentLoaded`, no en `ShopView.onEnter()`. Esto contradice el requisito de coste cero para Colección y añade coste incluso desde Inicio o Perfil.
- La retirada de `tags` afecta más que los filtros: `tags` gobiernan búsqueda, filtros, la relación del preview y analytics (categoría). Eliminar solo los botones rompería `_resolvePreviewAspectRatio()`, `_getMockupUrl()` y eventos.
- Semántica del total actual no coincide con la nueva especificación: `initiatePurchase()` muestra "Costo neto" como `finalPrice - cashback`, pero el objetivo pide "Total" = precio menos descuento, sin restar cashback.
- La biblioteca no es lazy: se renderiza al cargar catálogo y tras cada compra aunque la pestaña de biblioteca esté oculta.
- Descarga no fuerza adjunto: `GameCenter.getDownloadUrl()` devuelve el master Cloudinary y el atributo HTML `download` no garantiza descarga cross-origin. `fl_attachment` debe generarse en la URL Cloudinary.
- El modal usa escape/interpolación inconsistente: diversas tarjetas construyen `innerHTML` directamente desde `item.name`, `item.image` y datos serializados en `data-item`. La migración es una oportunidad para centralizar construcción DOM segura.

---

# PARTE 3 — Propuesta de experiencia final

## Tienda — PROPUESTA

Encabezado mínimo con CTA `btn-primary large`: "Ver colección" en Tienda y "Ver Tienda" en Colección. Debe pertenecer al flujo normal del documento, sin `position: sticky`; ocultarse al desplazarse hacia abajo y reaparecer al desplazarse hacia arriba mediante una clase basada en dirección de scroll, sin leer layout en cada evento.

Grid CSS masonry visual de dos columnas. Para máxima compatibilidad y coste bajo, propongo CSS Grid de dos columnas con dos railes deterministas en JS, no `columns`, porque preserva orden de lectura, control de lazy rendering y foco. Alternar `aspect-ratio: 9 / 16` y `3 / 4` según índice estable del catálogo.

Las tarjetas son `<button>` con imagen, etiqueta accesible `aria-label="Ver <nombre>"`, carga `loading="lazy"`, `decoding="async"` y dimensiones/aspect ratio reservadas para evitar CLS.

Si hay oferta activa, mostrar un badge pequeño en la esquina superior izquierda. Debe usar variables de Theme y texto derivado de `ECONOMY.saleLabel`; no banner global.

Tienda contiene solo ítems no poseídos. Cuando no haya ítems, mostrar estado vacío con CTA a Colección.

## Colección — PROPUESTA

No crear ni poblar el grid hasta la primera navegación a Colección.

Búsqueda local exclusiva de Colección: normalizar una vez `item.name` con `toLocaleLowerCase()` y hacer coincidencia parcial; sin fetch ni debounce obligatorio para un catálogo actual de 146 ítems, aunque un `requestAnimationFrame` coalescedor protege pulsaciones rápidas.

Mismo grid visual y patrón determinista.

Tap abre un modal plano con imagen, "Descargar" y "Enviar por correo". Mantener el modal de correo existente y `MailHelper`.

## Modal y compra — PROPUESTA

| Estado | Comportamiento |
|---|---|
| preview | Imagen ampliada, "Volver" y "Adquirir". Sin mockup basado en tags, reloj, protección o precarga hi-res específica de dispositivo. |
| confirming | Reemplaza el contenido modal con "¿Adquirir regalo?", Precio, Cashback verde cuando sea mayor que cero, Descuento solo cuando oferta activa y Total = precio con descuento. |
| loading | Botones bloqueados, `aria-busy="true"`, texto "Adquiriendo…". |
| purchased | Cerrar tras éxito, actualizar saldo, confeti existente, eliminar la tarjeta y conservar/restaurar la posición exacta. |
| error | Mantener modal abierto, mensaje accesible, restaurar control activo. |
| cancelled | Cerrar y devolver foco al elemento origen; restaurar scroll sin salto. |

## Scroll vs tap — PROPUESTA

Implementar delegación con Pointer Events sobre el grid:

- Guardar `pointerdown` con coordenadas y hora.
- Considerar activación solo con mismo `pointerId`, duración corta y desplazamiento máximo de 8 px.
- Cancelar si ocurre `pointercancel`, selección, desplazamiento mayor al umbral o scroll.
- No usar listeners por tarjeta; esto mantiene DOM y memoria estables.

## Cloudinary — PROPUESTA

Conservar en datos la URL Cloudinary original, sin segmentos de transformación.

Centralizar:

- `getThumbnailUrl(sourceUrl, aspectRatio)` → inserta `f_auto,q_auto,c_fill,g_auto,ar_<ratio>,w_<width>` después de `/upload/`.
- `getImageDownloadUrl(sourceUrl)` → inserta `fl_attachment` después de `/upload/`.

Para `file`, la thumbnail permanece Cloudinary pero el download debe usar `downloadUrl` directo, iniciado con un `<a>` temporal que se elimina inmediatamente.

Si la URL no coincide con el formato Cloudinary esperado, degradar al original y registrar una advertencia de desarrollo; no inventar transformación.

---

# PARTE 4 — Esquema propuesto de shop.json y migración

## Esquema — PROPUESTA

```json
[
  {
    "id": 1,
    "name": "Rouge the Bat",
    "price": 110,
    "category": "art",
    "type": "image",
    "imageUrl": "https://res.cloudinary.com/dyspgn0sw/image/upload/rouge_the_bat_a94a3cca"
  },
  {
    "id": 147,
    "name": "Pack imprimible",
    "price": 250,
    "category": "art",
    "type": "file",
    "imageUrl": "https://res.cloudinary.com/dyspgn0sw/image/upload/pack-imprimible-preview",
    "downloadUrl": "https://example.invalid/download/pack-imprimible.zip"
  }
]
```

## Contrato propuesto

- `id`: número entero único, obligatorio e inmutable.
- `name`: texto visible, obligatorio.
- `price`: entero no negativo, obligatorio.
- `category`: `"art"` fijo por ahora. Es la categoría editorial interna simple; no se usa para filtros.
- `type`: `"image"` o `"file"`.
- `imageUrl`: URL Cloudinary original, sin transformaciones, obligatoria.
- `downloadUrl`: obligatorio solo para `type: "file"`; URL externa de descarga directa.

Se eliminan `tags`, `file`, `requirements` y `category: "gift"`.

## Migración — PROPUESTA

- Extraer el `public_id` Cloudinary de cada `image` actual y reconstruir la URL original `.../image/upload/<public_id>` sin los parámetros de transformación ni extensión derivada.
- Renombrar `image` a `imageUrl`.
- Para `type: "image"`, eliminar `file`; la descarga se deriva desde `imageUrl`.
- Convertir todos los elementos de catálogo normal a `category: "art"` y `type: "image"`.
- No fusionar automáticamente `shop-gifts.json` con catálogo: el requisito es eliminar el sistema de regalos y los regalos son gratuitos/restringidos. Primero decidir producto para esos 12 activos: retirarlos, convertirlos en ítems comprables con IDs ya existentes, o conservarlos como ítems históricos no publicables. La evidencia actual no permite concluir cuál es el resultado de negocio correcto.
- Añadir una validación estática de IDs únicos entre el catálogo final y el conjunto histórico retirado antes de publicar. Nunca reasignar ni reutilizar un ID que pueda existir en `store.inventory`.
- Mantener temporalmente lectura tolerante de estado persistido, no de datos legacy: `inventory` ya es `{ [id]: count }`, por lo que no requiere migración de usuarios si los IDs sobreviven.

---

# PARTE 5 — Tickets para Codex

## TICKET-01 — Consolidar el modelo de catálogo y retirar regalos

**Tipo / Prioridad / Dependencias / Confianza:** Datos + lógica / P0 / Ninguna / Alta

**Hallazgo — HECHO COMPROBADO:** `loadCatalog()` carga y combina `data/shop.json` y `data/shop-gifts.json` (js/shop-logic.js:2500–2545). Los regalos dependen de `category: "gift"`, `tags: ["regalo"]`, `requirements`, sesión `la_session_game_completed`, `la:levelcomplete`, carrusel, autoplay y analytics `gift_claimed`. `data/shop-gifts.json` contiene 12 entradas separadas.

**Tarea sugerida:** Eliminar el catálogo y flujo de regalos y normalizar shop.json

```md
En `data/shop.json`, migrar cada ítem que permanezca publicado al contrato final: `id`, `name`, `price`, `category: "art"`, `type`, `imageUrl` y, solo para `type: "file"`, `downloadUrl`. Preservar literalmente todos los IDs de los ítems publicados.

Crear una utilidad de migración/revisión usada solo en desarrollo o una comprobación estática documentada que detecte IDs duplicados entre el catálogo final y `data/shop-gifts.json` antes de borrar este último. No fusionar automáticamente regalos gratuitos/restringidos: documentar y aplicar la decisión de producto para esos 12 ítems antes de publicar.

Eliminar `data/shop-gifts.json`. En `js/shop-logic.js`, sustituir el `Promise.all([fetch('data/shop.json'), fetch('data/shop-gifts.json')])` de `loadCatalog()` por una única carga de `data/shop.json`, validando el contrato mínimo y rechazando entradas sin ID único, nombre, precio válido, tipo válido o URL de imagen.

Eliminar `_isGiftItem`, `_isGiftUnlocked`, `_getGiftRequirementText`, `_readGiftClaimOrder`, `_writeGiftClaimOrder`, `_rememberGiftClaim`, `_buildGiftFocus`, `_stopGiftAutoplay`, `_updateGiftFilterGlow`, `_advanceGiftCarousel`, `_initGiftAutoplay`, `_renderGiftCarousel`, `_handleGiftAction` y todo estado `_gift*`.

Eliminar los listeners de `la:levelcomplete` y cualquier inicialización de `window.__laSessionGameCompleted` que quede sin consumidores. Eliminar el evento analítico `gift_claimed` solo si no tiene otros productores; conservar `click_download` con fuentes nuevas coherentes.

Actualizar o eliminar las secciones de regalos de `docs/DOCUMENTACION.md`, y revisar `README.md`, `docs/THUMBNAILS_OPTIMIZATION.md`, `docs/material-expressive-design-audit.md` y `docs/player-hub.md` para retirar referencias que resulten específicas del flujo eliminado.
```

*Iniciar tarea*

**Comportamiento esperado:** sólo hay una fuente de catálogo y ningún regalo, requisito, carrusel o filtro de regalo se puede cargar o activar.

**Performance:** un único fetch de datos del catálogo; ninguna lectura/escritura de `la_gift_claim_order` ni temporizador de autoplay.

**Preservación:** no cambiar el significado ni la clave de `store.inventory[id]`.

**Riesgos:** los 12 regalos actuales pueden tener compras/claims persistidos; la decisión de visibilidad debe validarse con producto antes de eliminar sus metadatos.

## TICKET-02 — Reemplazar filtros y búsqueda global por dos vistas explícitas

**Tipo / Prioridad / Dependencias / Confianza:** UX + frontend / P0 / TICKET-01 / Alta

**Hallazgo — HECHO COMPROBADO:** el HTML de Tienda contiene `#search-input`, `#search-clear`, `#filter-pills`, siete botones de filtro, `#search-results-count` y `#filter-empty` (index.html:639–702). `filterItems()` mezcla filtro por tags, inventario y búsqueda (js/shop-logic.js:1504–1564); los listeners se registran al final del módulo.

**Tarea sugerida:** Construir las vistas Tienda y Colección sin filtros ni búsqueda global

```md
En `index.html`, reemplazar el bloque de tabs, toolbar de catálogo, filtros, buscador global, contador y estado vacío de filtros dentro de `#view-shop` por una estructura de dos vistas: un CTA superior de alternancia, un contenedor de grid para Tienda y un contenedor de Colección inicialmente no montado/oculto. El CTA debe usar texto dinámico: “Ver colección” desde Tienda y “Ver Tienda” desde Colección.

Mantener el CTA en flujo normal del documento, sin `position: sticky`. Implementar un único listener pasivo de scroll para alternar una clase de visibilidad según dirección, con trabajo coalescido en `requestAnimationFrame`; no leer múltiples métricas de layout por frame.

En `js/shop-logic.js`, eliminar `activeFilter`, `searchQuery`, `_pendingFilterFrame`, `_computeCatalogSignature` dependiente de filtros, `scheduleFilterItems`, `filterItems`, `resetFilters`, `window.resetFilters` y los listeners de `.pill`, `#search-input`, `#search-clear`, `#btn-reset-filters` y `.shop-tab`.

Crear un estado explícito de vista `shop` o `collection`. En Tienda, filtrar solamente por `GameCenter.getBoughtCount(item.id) === 0`; en Colección, filtrar solamente por propiedad. Añadir el único input de búsqueda a Colección, buscando de forma case-insensitive por coincidencia parcial contra `item.name`, sin llamadas de red.

Al abrir Colección por primera vez, crear el input, delegación y grid; antes de ello no renderizar ni procesar sus ítems. En compras posteriores, actualizar Colección solo si ya fue abierta.

Eliminar de `styles.css` las reglas específicas de `.shop-tabs`, `.shop-tab`, `.shop-toolbar`, `.search-*`, `.filter-pills`, `.pill` usadas solo por Tienda, `.search-count` y `.filter-empty`. Conservar cualquier regla `.pill` que tenga consumidores fuera de Tienda después de una búsqueda de usos.
```

*Iniciar tarea*

**Comportamiento esperado:** Tienda no muestra categorías ni búsqueda; Colección es el único lugar que permite buscar nombres ya comprados.

**Performance:** no renderizar ni indexar Colección hasta que se abra; la búsqueda opera sobre el array ya cargado, sin red.

**Riesgos:** `.pill` y `.promo-icon-wrap` tienen usos fuera de Tienda; eliminar únicamente selectores sin consumidores.

## TICKET-03 — Implementar grid visual mobile-first y transformaciones Cloudinary derivadas

**Tipo / Prioridad / Dependencias / Confianza:** UI + rendimiento / P0 / TICKET-01, TICKET-02 / Alta

**Hallazgo — HECHO COMPROBADO:** `_buildShopCard()` genera texto, precio, botones de preview/compra y badges (js/shop-logic.js:1602–1671). `.shop-grid` y `.shop-card` están definidos desde styles.css:1677; las imágenes actuales ya incluyen transformaciones Cloudinary en los datos.

**Tarea sugerida:** Rehacer las tarjetas de Tienda y Colección como masonry visual de dos columnas

```md
Crear un helper central de URL Cloudinary que reciba `item.imageUrl` original y produzca thumbnails con `f_auto,q_auto,c_fill,g_auto`, ancho adecuado a DPR/contenedor y relación `ar_9:16` o `ar_3:4`. Insertar la transformación inmediatamente después de `/upload/` y conservar la URL original como fallback si no se reconoce el patrón Cloudinary.

Sustituir `_buildShopCard()` por una construcción DOM segura de una tarjeta interactiva que contenga solamente imagen y, cuando `ECONOMY.isSaleActive` y el ítem no sea poseído, un pill de descuento discreto en esquina superior izquierda. No renderizar nombre, precio, botón ni estado de propiedad sobre la tarjeta.

Implementar dos railes CSS Grid o una estrategia equivalente que garantice dos columnas en móvil y reparta los ítems de forma determinista por índice de catálogo. Aplicar `aspect-ratio: 9 / 16` o `3 / 4` de forma determinista por posición; no usar aleatoriedad. Reservar espacio con `aspect-ratio`, usar `loading="lazy"` y `decoding="async"` y mantener un fallback visual de error de imagen.

Actualizar `renderShop()` y el lazy batching existente para el nuevo markup. Conservar el render incremental si sigue reduciendo nodos; adaptar el observer para que no busque `.shop-preview-btn`, sino el elemento interactivo de tarjeta.

En `styles.css`, sustituir los estilos de tarjetas con texto/precio/CTA (`.shop-card .card-name`, `.shop-price`, `.owned-badge`, `.vault-btn` y selectores relacionados si no tienen consumidores) por clases específicas de la nueva tarjeta. El badge debe usar `--accent`, `--accent-soft`, `--accent-border` y `--on-accent`, no amarillo o violeta codificado.
```

*Iniciar tarea*

**Comportamiento esperado:** dos columnas estables, tarjetas sólo de imagen, alternancia visual 9:16 / 3:4, sin CLS relevante.

**Performance:** no usar medición de alturas para el layout, `backdrop-filter` ni animaciones de propiedades de layout; no precargar todas las imágenes.

**Preservación:** el ID debe viajar en `dataset.itemId` o equivalente sin alteración.

## TICKET-04 — Simplificar preview y hacer la compra coherente con la economía

**Tipo / Prioridad / Dependencias / Confianza:** UX + accesibilidad / P0 / TICKET-03 / Alta

**Hallazgo — HECHO COMPROBADO:** el preview actual aún usa tags para aspecto/hi-res (`_resolvePreviewAspectRatio`, `_getMockupUrl`, `openPreviewModal` en js/shop-logic.js:320–598, 1001–1260). `initiatePurchase()` calcula `netCost = finalPrice - cashback` y muestra "Costo neto" (1969–2050), mientras `GameCenter.buyItem()` descuenta `finalPrice` y luego acredita cashback (js/app.js:904–935).

**Tarea sugerida:** Reemplazar el preview por un modal ligero y corregir el desglose de compra

```md
En `index.html`, reemplazar `#preview-modal`, `#preview-mockup-stage` y `#mockup-slot` por un modal reutilizable de preview con imagen ampliada, botón “Volver” y botón “Adquirir”. Mantener atributos de diálogo, foco y cierre por Escape/backdrop de acuerdo con el helper `ModalA11y` existente.

En `js/shop-logic.js`, retirar `_resolvePreviewAspectRatio`, `_applyPreviewFrameSize`, `_getMockupTimeString`, `updateMockupTime`, `_getMockupUrl`, `_buildMockupHTML`, `_stageCtxHandler`, `_mockupClockInterval`, la protección anti-extracción y la precarga hi-res basada en tags si no tiene consumidores fuera del preview. Reemplazar `openPreviewModal()` por un flujo de imagen única con thumbnail derivada y una imagen de preview optimizada desde `imageUrl`.

Cuando “Adquirir” se active, sustituir el contenido del mismo diálogo por la confirmación “¿Adquirir regalo?”. Mostrar: Precio original; Descuento únicamente si `ECONOMY.isSaleActive`; Cashback verde únicamente si es mayor que cero; y Total igual al precio tras descuento. No llamar “Costo neto” ni restar cashback del Total. Etiquetar controles con `aria-busy` y deshabilitarlos durante confirmación.

Conservar `GameCenter.buyItem(item)` como autoridad económica. Tras éxito: actualizar saldo, disparar `_scheduleConfetti('purchase')`, retirar el ítem de Tienda, actualizar Colección solo si está montada, anunciar éxito mediante región viva/toast y devolver foco de forma predecible.

Implementar delegación Pointer Events en el grid: registrar posición en `pointerdown`, abrir sólo si el desplazamiento es menor o igual a 8 px, el pointer coincide y no hubo cancelación; ignorar arrastres/scroll. Usar un único listener por grid.

Actualizar `view_preview` y `buy_item` para enviar una categoría estable (`item.category`) en vez de `tags[0]`. Conservar los eventos y sus campos económicos útiles.
```

*Iniciar tarea*

**Comportamiento esperado:** tap intencional abre preview; scroll no abre modales; la confirmación refleja exactamente el débito y cashback reales.

**Performance:** un modal, una imagen de preview, sin SVG mockups, intervalos, listeners `contextmenu` ni doble carga específica Mobile/PC.

**Riesgos:** el requisito usa "regalo" en el título de compra, pero el nuevo catálogo agrupa arte y elimina regalos. Mantener ese copy literalmente si es decisión de producto; de lo contrario, validar si debe ser "¿Adquirir ítem?".

## TICKET-05 — Lazy Collection con descarga Cloudinary correcta y correo existente

**Tipo / Prioridad / Dependencias / Confianza:** Funcionalidad + rendimiento / P0 / TICKET-01, TICKET-02, TICKET-03 / Alta

**Hallazgo — HECHO COMPROBADO:** `renderLibrary(allItems)` se invoca al cargar catálogo y tras comprar (js/shop-logic.js:2540, 2015). `GameCenter.getDownloadUrl()` sólo toma `file` y devuelve el master Cloudinary sin `fl_attachment` (js/app.js:994–1009). El correo está implementado por `openEmailModal()` y `_handleEmailConfirm()` (js/shop-logic.js:2323–2417).

**Tarea sugerida:** Convertir Mis Tesoros en Colección lazy y unificar descargas por tipo

```md
Renombrar la experiencia visible “Mis Tesoros” a “Colección” y reemplazar `renderLibrary()` por un renderer que no se ejecute hasta la primera apertura de Colección. Mantener un flag privado de inicialización y actualizar el DOM sólo si ese flag está activo.

Crear un resolver de descarga por tipo. Para `type: "image"`, derivar una URL Cloudinary que incluya `fl_attachment` desde `imageUrl`. Para `type: "file"`, devolver directamente `item.downloadUrl`. Verificar propiedad mediante `GameCenter.getBoughtCount(item.id)` antes de exponer cualquier URL.

Para ambas variantes, iniciar descarga mediante un `<a>` temporal programáticamente activado y eliminado, sin navegar fuera de la SPA. No depender solamente del atributo `download` para una URL Cloudinary cross-origin. Conservar analytics `click_download`, renombrando `fuente: "biblioteca"` a una fuente consistente con “colección”.

Al tocar una tarjeta de Colección, abrir modal plano con “Descargar” y “Enviar por correo”. Reutilizar `openEmailModal(item, absoluteUrl)`, `MailHelper.isValidEmail()`, `MailHelper.buildMailtoLink()` y el fallback de copiar URL existentes. Actualizar el texto visible de la cabecera/modal de correo de “biblioteca” a “Colección” donde corresponda.

Eliminar estilos y markup exclusivos de `.treasury-grid`, `#library-container`, `.library-mail-btn` y tarjetas antiguas de biblioteca tras migrar sus consumidores. Mantener los estilos genéricos del modal de correo.
```

*Iniciar tarea*

**Comportamiento esperado:** Colección no tiene coste de render hasta abrirse; las imágenes descargan como adjunto y los archivos usan su URL directa; correo continúa funcionando.

**Performance:** no serializar el objeto entero en `data-item`; asociar el ID en `dataset` y resolverlo desde el catálogo en memoria.

**Preservación:** no exponer descargas de ítems no poseídos.

## TICKET-06 — Mover canje de promociones al Perfil

**Tipo / Prioridad / Dependencias / Confianza:** UX + migración de funcionalidad / P1 / TICKET-02 / Alta

**Hallazgo — HECHO COMPROBADO:** la UI de promociones vive dentro de Tienda (index.html:599–625), pero la lógica de negocio es independiente: `GameCenter.redeemPromoCode()` en js/app.js:1016+. El Perfil ya tiene navegación interna por paneles a través de `data-profile-panel` y `data-profile-target` (index.html:721–1002, js/shop-logic.js:2665–2705).

**Tarea sugerida:** Trasladar el canje de códigos promocionales a un panel de Perfil

```md
En `index.html`, eliminar `#btn-promo-toggle`, `#promo-section`, `#promo-input`, `#btn-redeem` y `#promo-msg` de `#view-shop`. Añadir una tarjeta de acción “Códigos promocionales” en el panel principal `data-profile-panel="home"` y una pantalla `data-profile-panel="promotions"` con encabezado y botón de retorno siguiendo el patrón de las pantallas de Perfil existentes.

Mover el formulario de canje al nuevo panel, preservando IDs o actualizando de manera centralizada los selectores de `handleRedeem()`. Hacer que `showProfilePanel()` enfoque el primer control de promociones al abrirse y restaure el foco a la tarjeta origen al volver.

Mantener `GameCenter.redeemPromoCode()`, hashes SHA-256, persistencia en `redeemedHashes`, historial de transacción y analytics `redeem_code`/`invalid_promo_code`. No duplicar la lógica de validación en el Perfil.

Mover o adaptar en `styles.css` los estilos de `.promo-toggle-wrap`, `.promo-toggle-btn`, `.promo-chevron`, `.promo-section--collapsed`, `.promo-section--open` y la animación `promoFadeIn`; conservar sólo los estilos reutilizables para formulario, input, feedback e icono dentro de Perfil. Usar variables Theme para todos los controles.

Actualizar `docs/DOCUMENTACION.md` sección de códigos promocionales y cualquier captura/flujo que indique que el canje está en Tienda.
```

*Iniciar tarea*

**Comportamiento esperado:** el canje funciona igual, pero sólo se descubre y usa desde Perfil.

**Riesgos:** `promo-icon-wrap` ya se reutiliza dentro de Perfil; no borrarlo globalmente sin separar selector compartido de selector específico de Tienda.

## TICKET-07 — Retirar banner global de oferta y mantener descuentos por tarjeta

**Tipo / Prioridad / Dependencias / Confianza:** UI + documentación / P1 / TICKET-03, TICKET-04 / Alta

**Hallazgo — HECHO COMPROBADO:** `ECONOMY` contiene `isSaleActive`, `saleMultiplier`, `saleLabel` y `cashbackRate` (js/app.js:120–125). La UI actual usa `initSaleBanner()` y el bloque `#sale-banner` (index.html:583–597; js/shop-logic.js:2296+), además de un badge actual de oferta en cada card.

**Tarea sugerida:** Eliminar el banner de oferta y conservar el descuento como badge temático

```md
Eliminar el markup `#sale-banner` de `index.html`, la función `initSaleBanner()` de `js/shop-logic.js`, su llamada durante `DOMContentLoaded` y todos los selectores `.sale-banner*`, `@keyframes laserScan` y comentarios asociados de `styles.css`.

Mantener `ECONOMY.isSaleActive`, `saleMultiplier`, `saleLabel` y `cashbackRate`; son dependencias de `GameCenter.buyItem()` y del desglose de compra. Reemplazar el badge actual de `.sale-card-badge` por un pill pequeño en la esquina superior izquierda de la tarjeta visual, usando tokens Theme en vez de gradientes amarillos hard-coded.

Actualizar `docs/ECONOMIA.md` para retirar el comportamiento del banner y las cards con precio tachado. Documentar que la señal de descuento es únicamente el pill de la tarjeta y el desglose de confirmación.
```

*Iniciar tarea*

**Comportamiento esperado:** activar una oferta no añade banner ni animación global; cada ítem disponible muestra una señal discreta y temática.

**Performance:** eliminar la animación infinita `laserScan` y su capa compositada.

## TICKET-08 — Actualizar documentación, analítica y pruebas estáticas del contrato

**Tipo / Prioridad / Dependencias / Confianza:** Mantenimiento / P1 / TICKET-01 a TICKET-07 / Alta

**Hallazgo — HECHO COMPROBADO:** `docs/DOCUMENTACION.md` documenta el catálogo, tags de ratios, filtros, regalos, preview, promociones, Cloudinary, carga única y biblioteca. `docs/ECONOMIA.md` documenta banner, precios de card y el "costo neto" con cashback. El repositorio tiene pruebas estáticas `tests/*.mjs`, pero no se inspeccionó un test específico de Tienda durante esta revisión.

**Tarea sugerida:** Alinear documentación y validaciones estáticas con la nueva arquitectura de Tienda

```md
Actualizar `README.md` y `docs/DOCUMENTACION.md` para describir un único `data/shop.json`, las vistas Tienda/Colección, carga lazy de Colección, el contrato de `imageUrl` original Cloudinary, transformaciones derivadas, tipos `image`/`file`, descarga `fl_attachment`, búsqueda exclusiva de Colección, y el nuevo lugar de promociones en Perfil.

Eliminar de `docs/DOCUMENTACION.md` toda sección específica de `shop-gifts.json`, regalos, requisitos de juego, carrusel, autoplay, filtro Regalos, tags Mobile/PC/Avatar/Sticker como contrato funcional, mockups de preview basados en tags, búsqueda global y tabs Catálogo/Mis Tesoros.

Actualizar `docs/ECONOMIA.md`: Total es precio tras descuento; cashback es una devolución separada, no parte del total. Retirar referencias al banner y a precios dentro de tarjetas.

Añadir o adaptar una prueba estática de catálogo que valide: IDs únicos; campos requeridos por tipo; ausencia de `tags`, `file`, `requirements`, `category: "gift"` y `shop-gifts.json`; `downloadUrl` obligatorio para `type: "file"`; y URL Cloudinary original sin segmento de transformación para `imageUrl`.

Añadir o adaptar comprobaciones estáticas de DOM/JS que aseguren ausencia de filtros, búsqueda en Tienda, listeners/eventos de regalos, banner de oferta y referencias a `shop-gifts.json`; y presencia de lazy mount de Colección, búsqueda local y acceso a promociones desde Perfil.
```

*Iniciar tarea*

**Criterios de aceptación:** ninguna documentación describe comportamiento retirado como actual; el contrato de datos se puede verificar automáticamente antes de despliegue.

**Riesgos:** parte de `docs/DOCUMENTACION.md` contiene historial de versiones. Si se preserva por motivos históricos, etiquetarlo explícitamente como obsoleto/archivado en vez de presentarlo como arquitectura vigente.

---

## Orden recomendado de implementación

1. **TICKET-01** — Resolver datos, IDs y retirada completa de regalos antes de tocar la UI.
2. **TICKET-02** — Simplificar el modelo de navegación Tienda/Colección y eliminar filtros/búsqueda global.
3. **TICKET-03** — Aplicar grid visual y derivación de thumbnails desde datos limpios.
4. **TICKET-04** — Sustituir preview y confirmación, preservando economía e inventario.
5. **TICKET-05** — Hacer Colección realmente lazy y corregir descargas/correo.
6. **TICKET-06** — Reubicar promociones en Perfil.
7. **TICKET-07** — Retirar banner global y pulir señal de descuento.
8. **TICKET-08** — Cerrar legacy documental y blindar el contrato con verificaciones estáticas.
