# Plan técnico actualizado — `marejigweb` (`games/jigsaw/`)

## Estado de este documento

Este documento consolida el plan técnico actualizado para implementar el juego web de producción llamado internamente **`marejigweb`** dentro de `games/jigsaw/`.

El plan reemplaza la idea anterior de niveles diarios por un **catálogo fijo de 200+ niveles**, donde cada nivel usa una imagen alojada en Cloudinary, con fuentes curadas en AVIF y aspecto horizontal 4:3.

No describe una implementación ya realizada; funciona como especificación técnica previa a construir el juego.

---

## 1. Decisiones base que se mantienen

- Carpeta del juego: `games/jigsaw/`.
- Nombre interno: `marejigweb`.
- `gameId` público para economía Love Arcade: `jigsaw`.
- Namespace JS y `localStorage`: `MAREJIG_`.
- Namespace CSS: `.marejig-*`.
- Render principal: Canvas 2D.
- Piezas: poliminós ortogonales tipo Tetris.
- Dificultad estándar: aproximadamente 60 piezas.
- Flujo de puzzle: segmentos progresivos para no saturar pantallas móviles.
- Snap: solo entre piezas vecinas reales según el grafo de solución.
- Debe funcionar en modo standalone si `window.GameCenter` no existe.
- Debe incluir botón de salida hacia `../../index.html`.
- Debe importar `../../js/app.js` al final del `<body>`, después de los scripts propios.
- No debe modificar ni sobrescribir `window.GameCenter`, `window.ECONOMY`, `window.THEMES`, `CONFIG`, `ECONOMY` ni `THEMES`.
- No debe leer ni escribir `localStorage` global de Love Arcade.
- Para monedas, debe usar únicamente `window.GameCenter.completeLevel("jigsaw", levelId, coins)` al completar un nivel.

---

## 2. Conflictos con el plan anterior

### 2.1 Se elimina “rompecabezas diario”

El juego ya no debe usar niveles diarios ni seeds derivados de fecha.

Antes se contemplaban identificadores como:

```text
marejig_daily_YYYY-MM-DD
```

Ahora el juego debe usar un catálogo fijo, y cada seed debe derivarse de:

```text
level.id
```

### 2.2 La economía deja de ser por sesión repetible

La recompensa ahora es por **nivel fijo completado**, no por sesión repetible.

El identificador económico debe ser:

```js
const levelId = "level_" + level.id;
```

Y la llamada permitida es exclusivamente:

```js
window.GameCenter.completeLevel("jigsaw", levelId, coins);
```

### 2.3 El tablero estándar queda fijado a 16×12

El plan anterior aceptaba tableros variables como 12×18 o 12×20 para aproximar 60 piezas.

El plan actualizado fija:

```text
16 columnas × 12 filas = 192 celdas
```

Esto corresponde al aspecto 4:3 de las imágenes del nivel.

### 2.4 El renderer debe dibujar imagen real en las piezas

Antes las piezas podían ser geométricas o coloreadas.

Ahora cada nivel tiene una imagen 4:3 premium. El Canvas debe dibujar esa imagen dentro de clips/máscaras de piezas, sin crear una imagen grande duplicada por pieza.

### 2.5 Se agrega Cloudinary como pipeline de assets

El juego debe construir URLs Cloudinary con transformaciones para:

- tiny placeholder;
- thumbnail;
- full mobile;
- full premium.

Debe evitar precargar las 200 imágenes completas.

### 2.6 El menú principal cambia a niveles pendientes

La pantalla principal debe mostrar únicamente niveles no completados.

Los niveles completados deben desaparecer inmediatamente de esa pantalla.

---

## 3. Arquitectura actualizada

### 3.1 Objetivo de arquitectura

Implementar un jigsaw mobile-first, premium, con catálogo fijo de 200+ niveles visuales, piezas poliminó ortogonales, carga progresiva de imágenes Cloudinary y economía Love Arcade por nivel completado.

### 3.2 Principios técnicos

- El juego debe ser estático y autocontenido.
- El catálogo puede vivir en JS local.
- La UI no debe renderizar las 200+ cards al mismo tiempo.
- Las imágenes full solo se cargan cuando el usuario selecciona un nivel.
- El generador del puzzle no depende de leer píxeles de la imagen.
- El renderer usa una imagen decodificada principal y paths/máscaras por pieza.
- El Canvas debe capar DPR a `Math.min(devicePixelRatio, 2)`.
- El juego debe redibujar solo cuando el estado esté dirty.
- La persistencia debe ser compacta para soportar 200+ niveles.

---

## 4. Estructura de archivos propuesta

```text
games/jigsaw/
├── index.html
├── README.md
├── css/
│   └── marejig.css
├── js/
│   ├── MAREJIG_boot.js
│   ├── MAREJIG_config.js
│   ├── MAREJIG_levels.js
│   ├── MAREJIG_cloudinary.js
│   ├── MAREJIG_imageLoader.js
│   ├── MAREJIG_state.js
│   ├── MAREJIG_storage.js
│   ├── MAREJIG_shapes.js
│   ├── MAREJIG_generator.js
│   ├── MAREJIG_groups.js
│   ├── MAREJIG_segments.js
│   ├── MAREJIG_renderer.js
│   ├── MAREJIG_input.js
│   ├── MAREJIG_menu.js
│   ├── MAREJIG_economy.js
│   └── MAREJIG_main.js
└── assets/
    └── README.md
```

La división puede consolidarse durante la implementación, pero las responsabilidades indicadas deben conservarse.

---

## 5. Módulos nuevos o modificados

### 5.1 `MAREJIG_config.js`

Responsabilidades:

- Definir constantes propias del juego.
- Evitar nombres globales reservados como `CONFIG`.
- Centralizar parámetros de tablero, imágenes, Canvas, menú, storage y economía.

Modelo conceptual:

```js
MAREJIG_CONFIG = {
  internalName: "marejigweb",
  publicGameId: "jigsaw",
  storagePrefix: "MAREJIG_",

  defaultBoard: {
    cols: 16,
    rows: 12,
    cells: 192,
    aspectRatio: "4:3",
    targetPieceCount: 60
  },

  images: {
    expectedAspectRatio: "4:3",
    recommendedMaster: { width: 2400, height: 1800 },
    runtimeMobile: { width: 1600, height: 1200 },
    runtimePremium: { width: 2048, height: 1536 },
    thumbnailSmall: { width: 480, height: 360 },
    thumbnailLarge: { width: 640, height: 480 },
    tinyPlaceholder: { width: 32, height: 24 }
  },

  canvas: {
    maxDpr: 2
  },

  menu: {
    initialPendingCards: 12,
    batchSize: 12
  }
};
```

### 5.2 `MAREJIG_levels.js`

Responsabilidades:

- Exponer catálogo estático de niveles.
- Incluir 5 niveles iniciales de ejemplo.
- Prepararse para escalar a 200+ entradas.
- Validar estructura mínima de nivel.
- Resolver niveles por ID.
- Ordenar niveles por `order`.
- No renderizar DOM.

API conceptual:

```js
window.MAREJIG_LevelCatalog = {
  levels,
  getById,
  getOrdered,
  validateLevel
};
```

### 5.3 `MAREJIG_cloudinary.js`

Responsabilidades:

- Construir URLs Cloudinary desde `cloudName`, `publicId`, tipo de asset y preset.
- No incluir secretos, API keys ni API secrets.
- Usar transformaciones para:
  - full mobile;
  - full premium;
  - thumbnail;
  - tiny placeholder.
- Usar `f_auto` y `q_auto` por defecto.
- Permitir forzar AVIF solo por configuración explícita de pruebas.
- Usar `c_fill,g_auto,ar_4:3` solo como fallback controlado.
- No iniciar precarga masiva.

API conceptual:

```js
MAREJIG_Cloudinary = {
  buildUrl(level, presetName, options),
  buildTinyPlaceholderUrl(level),
  buildThumbnailUrl(level, size),
  buildFullUrl(level, runtimeProfile),
  getRuntimeProfile(deviceInfo)
};
```

### 5.4 `MAREJIG_imageLoader.js`

Responsabilidades:

- Cargar imágenes con `crossOrigin = "anonymous"`.
- Usar `decode()` cuando esté disponible.
- Usar `createImageBitmap()` cuando esté disponible.
- Tener fallback a `HTMLImageElement` si `createImageBitmap()` no existe.
- Cargar primero placeholder/thumbnail y después imagen full.
- Mantener una cache pequeña.
- Nunca precargar las 200 imágenes full.

API conceptual:

```js
MAREJIG_ImageLoader = {
  loadMenuThumbnail(level),
  loadPlayableImage(level, deviceProfile, onProgress),
  releaseFullImage(levelId),
  clearThumbnailCache()
};
```

### 5.5 `MAREJIG_menu.js`

Responsabilidades:

- Implementar la pantalla principal de niveles pendientes.
- Filtrar niveles completados.
- Renderizar cards por batch.
- Cargar thumbnails lazy.
- Usar `IntersectionObserver` cuando aporte valor.
- Destacar niveles con partida en curso.
- Quitar niveles completados de la lista inmediatamente.

API conceptual:

```js
MAREJIG_Menu = {
  mountPendingLevels(),
  renderNextBatch(),
  refreshAfterCompletion(levelId),
  observeThumbnailCards()
};
```

### 5.6 `MAREJIG_generator.js`

Modificaciones:

- Generar siempre sobre `board.cols = 16` y `board.rows = 12` para niveles estándar.
- Usar seed derivado de `level.id`.
- Generar cerca de 60 piezas sobre 192 celdas.
- Ajustar pesos de formas para promedio de 3.2 celdas por pieza.
- No depender de imagen ni de lectura de píxeles.
- Producir metadata geométrica, paths y grafo de adyacencia.

### 5.7 `MAREJIG_renderer.js`

Modificaciones:

- Dibujar imagen completa dentro de clips de piezas.
- Usar una imagen decodificada principal por nivel activo.
- No cachear 60 imágenes grandes duplicadas.
- Cachear paths, bounds y máscaras ligeras.
- Capar DPR a `Math.min(devicePixelRatio, 2)`.
- Redibujar solo con estado dirty.
- Dibujar placeholder/thumbnail durante carga premium.

### 5.8 `MAREJIG_storage.js`

Modificaciones:

Debe usar únicamente estas claves:

```text
MAREJIG_completedLevels_v1
MAREJIG_levelProgress_v1
MAREJIG_activeSave_v1
MAREJIG_settings_v1
```

Responsabilidades:

- Guardar niveles completados.
- Guardar progreso parcial ligero por nivel.
- Guardar snapshot completo solo de la partida activa.
- Guardar settings.
- No guardar imágenes.
- No tocar `localStorage` global de Love Arcade.

### 5.9 `MAREJIG_economy.js`

Modificaciones:

- Recompensa fija por nivel.
- Usar `levelId = "level_" + level.id`.
- Llamar únicamente a `window.GameCenter.completeLevel("jigsaw", levelId, coins)`.
- No romper si `window.GameCenter` no existe.
- Guardar flag local de recompensa reportada.
- Evitar doble llamada por reload o doble animación.

---

## 6. Modelo definitivo de `Level`

### 6.1 Estructura mínima obligatoria

```js
{
  id: "reef_001",
  order: 1,
  title: "Buceo profundo",
  pack: "Océano",
  difficulty: "standard",
  cloudinaryPublicId: "marejig/levels/reef_001",
  sourceFormat: "avif",
  aspectRatio: "4:3",
  master: { width: 2400, height: 1800 },
  board: { cols: 16, rows: 12 },
  targetPieceCount: 60,
  segmentPlan: [10, 10, 12, 12, 16],
  rewardCoins: 55
}
```

### 6.2 Modelo extendido recomendado

```js
MAREJIG_Level = {
  id: "reef_001",
  order: 1,

  title: "Buceo profundo",
  pack: "Océano",
  difficulty: "standard",

  cloudinaryPublicId: "marejig/levels/reef_001",
  cloudinaryAssetType: "image",
  cloudinaryDeliveryType: "upload",

  sourceFormat: "avif",
  aspectRatio: "4:3",

  master: {
    width: 2400,
    height: 1800
  },

  runtime: {
    mobile: { width: 1600, height: 1200 },
    premium: { width: 2048, height: 1536 }
  },

  thumbnails: {
    small: { width: 480, height: 360 },
    large: { width: 640, height: 480 },
    tiny: { width: 32, height: 24 }
  },

  board: {
    cols: 16,
    rows: 12
  },

  targetPieceCount: 60,

  segmentPlan: [10, 10, 12, 12, 16],

  rewardCoins: 55,

  flags: {
    curatedFourByThree: true,
    allowCropFallback: false,
    premiumMasterAllowed: false
  }
};
```

### 6.3 Reglas de validación del catálogo

Cada nivel debe cumplir:

- `id` estable, único y seguro para storage.
- `order` entero y estable.
- `aspectRatio === "4:3"`.
- `master.width / master.height === 4 / 3`.
- Resolución fuente recomendada: `2400x1800`.
- `sourceFormat === "avif"`.
- `board.cols === 16`.
- `board.rows === 12`.
- `targetPieceCount` ideal: 60.
- Rango aceptable de generación estándar: 56–64 piezas.
- `segmentPlan` debe sumar el objetivo esperado o poder ajustarse al conteo real.
- `rewardCoins` debe ser entero positivo.
- `cloudinaryPublicId` debe existir y ser estable.

### 6.4 Ejemplo de catálogo inicial

```js
[
  {
    id: "reef_001",
    order: 1,
    title: "Buceo profundo",
    pack: "Océano",
    difficulty: "standard",
    cloudinaryPublicId: "marejig/levels/reef_001",
    sourceFormat: "avif",
    aspectRatio: "4:3",
    master: { width: 2400, height: 1800 },
    board: { cols: 16, rows: 12 },
    targetPieceCount: 60,
    segmentPlan: [10, 10, 12, 12, 16],
    rewardCoins: 55
  },
  {
    id: "forest_001",
    order: 2,
    title: "Luz del bosque",
    pack: "Bosque",
    difficulty: "standard",
    cloudinaryPublicId: "marejig/levels/forest_001",
    sourceFormat: "avif",
    aspectRatio: "4:3",
    master: { width: 2400, height: 1800 },
    board: { cols: 16, rows: 12 },
    targetPieceCount: 60,
    segmentPlan: [10, 10, 12, 12, 16],
    rewardCoins: 55
  }
]
```

---

## 7. Estrategia Cloudinary

### 7.1 Objetivo

Entregar imágenes de alta calidad y sensación premium sin descargar recursos innecesarios en móvil.

### 7.2 Configuración pública

```js
MAREJIG_CLOUDINARY_CONFIG = {
  cloudName: "example-cloud",
  baseUrl: "https://res.cloudinary.com",
  defaultAssetType: "image",
  defaultDeliveryType: "upload",

  forceFormat: null,

  presets: {
    tiny: {
      width: 32,
      height: 24,
      crop: "fill",
      gravity: "auto",
      quality: "auto:eco",
      format: "auto"
    },

    thumbnail: {
      width: 480,
      height: 360,
      crop: "fill",
      gravity: "auto",
      quality: "auto",
      format: "auto"
    },

    thumbnailLarge: {
      width: 640,
      height: 480,
      crop: "fill",
      gravity: "auto",
      quality: "auto",
      format: "auto"
    },

    fullMobile: {
      width: 1600,
      height: 1200,
      crop: "fit",
      quality: "auto:good",
      format: "auto"
    },

    fullPremium: {
      width: 2048,
      height: 1536,
      crop: "fit",
      quality: "auto:best",
      format: "auto"
    }
  }
};
```

La configuración no debe incluir secretos.

### 7.3 Forma conceptual de URLs

```text
https://res.cloudinary.com/<cloudName>/image/upload/<transformations>/<publicId>
```

### 7.4 Transformaciones por preset

#### Tiny placeholder

```text
f_auto,q_auto:eco,w_32,h_24,c_fill,g_auto,ar_4:3
```

Uso:

- blur inicial;
- fondo de card;
- pantalla de carga premium.

#### Thumbnail

```text
f_auto,q_auto,w_480,h_360,c_fill,g_auto,ar_4:3
```

O:

```text
f_auto,q_auto,w_640,h_480,c_fill,g_auto,ar_4:3
```

Uso:

- cards de menú;
- lazy loading;
- preview antes de cargar full.

#### Full mobile

```text
f_auto,q_auto:good,w_1600,h_1200,c_fit
```

Fallback controlado:

```text
f_auto,q_auto:good,w_1600,h_1200,c_fill,g_auto,ar_4:3
```

#### Full premium

```text
f_auto,q_auto:best,w_2048,h_1536,c_fit
```

Fallback controlado:

```text
f_auto,q_auto:best,w_2048,h_1536,c_fill,g_auto,ar_4:3
```

### 7.5 `f_auto` vs AVIF forzado

Aunque la fuente esté en AVIF, el runtime debe usar `f_auto` y `q_auto` para que Cloudinary entregue el formato más adecuado al navegador.

Solo se debe forzar AVIF para pruebas explícitas:

```text
f_avif
```

### 7.6 Selección de resolución runtime

Perfil recomendado:

```js
function MAREJIG_getRuntimeImageProfile() {
  const longSide = Math.max(window.innerWidth, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const connection = navigator.connection;

  const constrained =
    connection &&
    (connection.saveData ||
      ["slow-2g", "2g", "3g"].includes(connection.effectiveType));

  if (constrained) return "fullMobile";
  if (longSide >= 768 && dpr >= 1.5) return "fullPremium";
  return "fullMobile";
}
```

La resolución 2400×1800 debe ser opcional y solo usarse si el dispositivo, memoria y conexión lo justifican.

### 7.7 CORS y decodificación

Carga requerida:

```js
const img = new Image();
img.crossOrigin = "anonymous";
img.src = url;

if (img.decode) {
  await img.decode();
}

const drawable = window.createImageBitmap
  ? await createImageBitmap(img)
  : img;
```

Debe existir fallback si `decode()` o `createImageBitmap()` no están disponibles.

### 7.8 Política de precarga

Permitido:

- tiny placeholders visibles;
- thumbnails de cards visibles o próximas;
- imagen full del nivel seleccionado.

Prohibido:

- precargar las 200 imágenes completas;
- guardar imágenes en `localStorage`;
- crear una imagen grande por pieza;
- guardar base64 de thumbnails o imágenes full.

---

## 8. Estrategia de menú de pendientes

### 8.1 Objetivo

La pantalla principal debe responder a la pregunta: “¿qué niveles me faltan?”.

Debe mostrar solo niveles no completados y debe evitar renderizar o cargar assets para todo el catálogo a la vez.

### 8.2 Flujo

1. Cargar catálogo local.
2. Cargar `MAREJIG_completedLevels_v1`.
3. Cargar `MAREJIG_levelProgress_v1` y `MAREJIG_activeSave_v1`.
4. Filtrar pendientes:

```js
pendingLevels = levels.filter(level => !completedLevels[level.id]);
```

5. Ordenar:
   - niveles con partida en curso primero;
   - después por `order` ascendente.
6. Renderizar primer batch de 12 o 20 cards.
7. Renderizar siguientes batches con scroll o botón “ver más”.
8. Cargar thumbnails lazy.
9. Al completar un nivel:
   - actualizar storage;
   - quitar card;
   - renderizar una card adicional si quedan pendientes.

### 8.3 Card de nivel

Cada card debe mostrar:

- thumbnail 4:3;
- título;
- pack;
- dificultad;
- recompensa;
- estado “Nuevo” o “Continuar”;
- progreso si hay partida en curso.

Ejemplo:

```text
[thumbnail 4:3]
Buceo profundo
Océano · Standard · +55 🪙
Continuar · Segmento 3/5
```

### 8.4 Lazy loading de thumbnails

Cuando se use `<img>`:

```html
<img
  class="marejig-level-card__thumb"
  loading="lazy"
  decoding="async"
  alt="Buceo profundo"
>
```

Estrategia recomendada:

- `src` inicial: tiny placeholder;
- `data-src`: thumbnail 480×360 o 640×480;
- `IntersectionObserver`: reemplaza `src` cuando la card entra al viewport.

### 8.5 Virtualización simple

Para v1 basta con carga incremental:

```js
let renderedCount = 0;
const batchSize = 12;
```

Cuando el sentinel entra en viewport:

```js
renderNextBatch();
```

Si el rendimiento cae con 200+ niveles, añadir ventana de DOM de 40–60 cards.

### 8.6 Estado sin pendientes

Si el usuario completa todo el catálogo pendiente:

```text
¡Catálogo completado!
Vuelve pronto para nuevos packs.
```

---

## 9. Estrategia de persistencia para 200+ niveles

### 9.1 Claves obligatorias

```text
MAREJIG_completedLevels_v1
MAREJIG_levelProgress_v1
MAREJIG_activeSave_v1
MAREJIG_settings_v1
```

No debe usarse ninguna clave global de Love Arcade.

### 9.2 `MAREJIG_completedLevels_v1`

Estructura:

```js
{
  version: 1,
  levels: {
    reef_001: {
      completedAt: "2026-05-28T18:20:30.000Z",
      bestTimeMs: 742000,
      fewestMoves: 138,
      hintsUsed: 1,
      rewardReported: true,
      rewardLevelId: "level_reef_001",
      rewardCoins: 55
    }
  }
}
```

Reglas:

- Si un nivel está en `completedLevels`, no aparece en pendientes.
- `rewardReported` ayuda a evitar dobles llamadas locales.
- Si el dato local se corrompe, `GameCenter.completeLevel` sigue siendo idempotente por `levelId`.

### 9.3 `MAREJIG_levelProgress_v1`

Debe guardar progreso parcial ligero por nivel:

```js
{
  version: 1,
  levels: {
    reef_001: {
      updatedAt: "2026-05-28T18:10:00.000Z",
      elapsedMs: 420000,
      moves: 91,
      hintsUsed: 1,
      currentSegmentIndex: 2,
      completedSegments: ["s_0", "s_1"],
      placedPieceCount: 24,
      totalPieceCount: 60,
      puzzleSeed: 123456789,
      generatorVersion: 1,
      groupSnapshotRef: "active"
    }
  }
}
```

Debe evitar snapshots pesados para 200+ niveles.

### 9.4 `MAREJIG_activeSave_v1`

Snapshot detallado solo de la partida activa:

```js
{
  version: 1,
  levelId: "reef_001",
  updatedAt: "2026-05-28T18:10:00.000Z",
  puzzleSeed: 123456789,
  generatorVersion: 1,

  elapsedMs: 420000,
  moves: 91,
  hintsUsed: 1,

  pieces: {
    p_001: {
      groupId: "g_010",
      revealed: true,
      locked: false
    }
  },

  groups: {
    g_010: {
      pieceIds: ["p_001", "p_002"],
      x: 120,
      y: 320,
      lockedToBoard: false
    }
  },

  segments: {
    currentSegmentIndex: 2,
    completedSegmentIds: ["s_0", "s_1"],
    revealedSegmentIds: ["s_0", "s_1", "s_2"]
  },

  completion: {
    completed: false,
    rewardReported: false
  }
}
```

Reglas:

- Solo una partida activa detallada.
- Si el usuario inicia otro nivel, pedir confirmación o reemplazar el save activo.
- Al completar, migrar métricas a `completedLevels` y limpiar progreso parcial.
- No guardar imágenes, bitmaps, blobs, base64 ni thumbnails.

### 9.5 `MAREJIG_settings_v1`

```js
{
  version: 1,
  reducedMotion: false,
  haptics: true,
  sound: true,
  forceAvifForTesting: false,
  imageQualityPreference: "auto"
}
```

### 9.6 Validación y recuperación

Cada lectura debe:

- parsear con fallback seguro;
- validar `version`;
- ignorar niveles que ya no existan en catálogo;
- ignorar datos corruptos;
- no romper si `localStorage` está lleno o deshabilitado.

---

## 10. Carga de imagen al seleccionar nivel

### 10.1 Flujo de carga premium

Al seleccionar un nivel:

1. Cambiar a pantalla de carga premium.
2. Mostrar tiny placeholder o thumbnail.
3. Resolver perfil de imagen:
   - mobile: 1600×1200;
   - tablet/desktop premium: 2048×1536;
   - master 2400×1800 solo opcionalmente.
4. Construir URL Cloudinary.
5. Cargar con `crossOrigin = "anonymous"`.
6. Decodificar con `decode()` si existe.
7. Crear `ImageBitmap` si existe.
8. Generar puzzle cuando ya están disponibles los metadatos del nivel.
9. Entregar drawable al renderer.
10. Entrar a partida.

### 10.2 Independencia del generador

El generador solo necesita:

- `level.id`;
- `level.board.cols`;
- `level.board.rows`;
- `level.targetPieceCount`;
- `level.segmentPlan`.

No necesita leer píxeles.

### 10.3 Renderer con clips

El renderer debe:

- usar una imagen principal;
- construir paths por poliminó;
- clippear cada pieza;
- dibujar la imagen alineada a su posición de solución;
- dibujar borde, sombra y feedback de snap.

No debe generar 60 bitmaps grandes por pieza.

---

## 11. Generación de piezas con 4:3 y grilla 16×12

### 11.1 Contrato de entrada

```js
{
  levelId: "reef_001",
  seed: hash("reef_001"),
  cols: 16,
  rows: 12,
  targetPieceCount: 60,
  segmentPlan: [10, 10, 12, 12, 16]
}
```

### 11.2 Contrato de salida

```js
{
  pieces,
  adjacency,
  groups,
  segments,
  board: {
    cols: 16,
    rows: 12,
    cellCount: 192
  }
}
```

### 11.3 Implicación matemática

```text
192 celdas / 60 piezas = 3.2 celdas por pieza
```

Esto implica que la dificultad estándar debe favorecer dominós, trominós y tetrominós pequeños.

### 11.4 Pesos recomendados

```js
standardWeights = [
  { size: 2, shapes: ["I2"], weight: 15 },
  { size: 3, shapes: ["I3", "L3"], weight: 40 },
  { size: 4, shapes: ["I4", "O4", "T4", "L4", "S4", "Z4"], weight: 38 },
  { size: 5, shapes: ["P5", "U5", "V5"], weight: 5 },
  { size: 1, shapes: ["O1"], weight: 2 }
];
```

### 11.5 Algoritmo de generación

1. Crear matriz 16×12 vacía.
2. Derivar seed desde `level.id`.
3. Elegir celda semilla vacía.
4. Seleccionar forma ponderada.
5. Probar rotaciones/reflejos permitidos.
6. Colocar si entra en tablero y no colisiona.
7. Si falla, probar forma más pequeña.
8. Si todo falla, colocar relleno.
9. Repetir hasta cubrir 192 celdas.
10. Validar conteo de piezas.
11. Si el conteo queda fuera de rango, regenerar con seed variant.
12. Si queda cerca del objetivo, ajustar con merge/split controlado.
13. Crear grafo de adyacencia.
14. Crear segmentos según `segmentPlan`.

### 11.6 Ajuste de conteo

Rango aceptable:

```text
56–64 piezas
```

Si `pieceCount !== sum(segmentPlan)`:

- diferencia pequeña: ajustar último segmento o distribuir desde el final;
- diferencia grande: regenerar con `level.id + ":retry:" + attempt`.

### 11.7 Coordenadas imagen ↔ grilla

Con imagen 4:3 y board 16×12:

```js
sourceCellW = imageWidth / 16;
sourceCellH = imageHeight / 12;
```

Cada celda de pieza corresponde a una región de la imagen.

---

## 12. Snap y grupos

### 12.1 Regla principal

Solo hacen snap piezas o grupos que contienen piezas vecinas reales en el tablero solución.

### 12.2 Grafo de adyacencia

Cada edge debe contener:

```js
MAREJIG_Edge = {
  a: "p_001",
  b: "p_002",
  expectedDeltaPx: {
    x: deltaGridX * cellSize,
    y: deltaGridY * cellSize
  },
  sharedSides: []
};
```

### 12.3 Detección

Al soltar un grupo:

1. Recorrer piezas del grupo activo.
2. Buscar edges reales hacia piezas fuera del grupo.
3. Ignorar piezas no reveladas.
4. Comparar delta actual vs delta esperado.
5. Elegir candidato más cercano dentro de threshold.
6. Aplicar corrección.
7. Fusionar grupos.

### 12.4 Threshold recomendado

```js
snapThreshold = isTouch
  ? Math.max(14, cellSize * 0.35)
  : Math.max(10, cellSize * 0.25);
```

### 12.5 Fusión

Al fusionar:

- crear grupo combinado;
- actualizar `groupId` de piezas;
- recalcular bounds;
- guardar progreso;
- evaluar segmento completado;
- evaluar puzzle completado.

---

## 13. Segmentos progresivos

### 13.1 Objetivo

Evitar mostrar ~60 piezas sueltas en móvil.

### 13.2 Segment plan estándar

Para 60 piezas:

```js
[10, 10, 12, 12, 16]
```

Esto produce 5 segmentos.

### 13.3 Construcción

1. Construir grafo de adyacencia de piezas.
2. Elegir región inicial.
3. Hacer region growing/BFS.
4. Crear segmentos conectados espacialmente.
5. Cada nuevo segmento debe tocar, si es posible, un segmento anterior.
6. Ajustar último segmento al conteo real.

### 13.4 Revelado

- Inicio: revelar `s_0`.
- Al completar segmento: revelar siguiente.
- Piezas futuras permanecen ocultas.
- Grupos ya resueltos pueden quedar bloqueados o semi-bloqueados.
- El HUD muestra `Segmento X/Y`.

---

## 14. Economía por nivel fijo

### 14.1 Contrato final

```js
const rewardLevelId = "level_" + level.id;
const coins = Math.max(1, Math.floor(level.rewardCoins));

if (window.GameCenter && typeof window.GameCenter.completeLevel === "function") {
  window.GameCenter.completeLevel("jigsaw", rewardLevelId, coins);
}
```

### 14.2 Orden recomendado al completar nivel

1. Detectar victoria con estado `playing`.
2. Cambiar a estado `completing` para evitar doble animación.
3. Calcular `rewardLevelId = "level_" + level.id`.
4. Calcular `coins = Math.floor(level.rewardCoins)`.
5. Si `rewardReported` local ya es `true`, no llamar.
6. Si existe `window.GameCenter.completeLevel`, llamar.
7. Guardar completado local.
8. Guardar `rewardReported`.
9. Eliminar progreso parcial.
10. Quitar card de pendientes.

### 14.3 Standalone

Si no existe `window.GameCenter`:

- no lanzar error;
- completar localmente;
- guardar métricas;
- mostrar mensaje de que las monedas solo se acreditan dentro de Love Arcade.

Recomendación v1:

- no reportar recompensas retroactivas de completados standalone para evitar abuso.

### 14.4 Protección contra duplicidad

Capas:

1. Runtime: `state.completionStarted`.
2. Storage local: `rewardReported`.
3. Core Love Arcade: idempotencia por `gameId + levelId`.

---

## 15. Rendimiento

### 15.1 Canvas

- Usar DPR:

```js
const dpr = Math.min(window.devicePixelRatio || 1, 2);
```

- Redibujar solo si `state.dirty === true`.
- Usar `requestAnimationFrame` solo cuando haya cambios.
- Evitar render loop constante.

### 15.2 Imágenes

- Una imagen decodificada principal por nivel activo.
- No crear 60 bitmaps grandes por pieza.
- Cachear paths y bounds.
- Cachear thumbnails visibles con límite.
- Liberar referencias al salir de nivel.

### 15.3 DOM

- No renderizar 200 cards iniciales.
- Render incremental de 12 o 20 cards.
- Lazy thumbnails.
- `IntersectionObserver` para thumbnails y sentinel.

---

## 16. Riesgos nuevos y mitigaciones

### 16.1 Canvas contaminado por CORS

Riesgo: Cloudinary podría entregar imágenes sin CORS adecuado o el juego podría olvidar `crossOrigin`.

Mitigación:

- Configurar Cloudinary con CORS público.
- Setear `img.crossOrigin = "anonymous"` antes de `src`.
- Probar dibujo en Canvas.

### 16.2 Memoria móvil

Riesgo: 2048×1536 ocupa memoria significativa, especialmente si se duplica.

Mitigación:

- Mobile usa 1600×1200.
- No crear bitmaps por pieza.
- Liberar full image al salir.
- Capar DPR a 2.

### 16.3 `f_auto` puede no entregar AVIF

Riesgo: aunque la fuente sea AVIF, Cloudinary puede entregar WebP/JPEG según navegador.

Mitigación:

- Aceptarlo como optimización correcta.
- Forzar AVIF solo para pruebas.

### 16.4 Catálogo JS grande

Riesgo: 200+ objetos pueden aumentar bundle.

Mitigación:

- Mantener metadata compacta.
- Construir URLs dinámicamente.
- No incluir base64.
- Futuro: dividir por packs si crece demasiado.

### 16.5 Menú con demasiados thumbnails

Riesgo: thumbnails de 200 niveles pueden afectar red y memoria.

Mitigación:

- Render incremental.
- Lazy loading.
- Cache limitada.
- No cargar full hasta selección.

### 16.6 Assets no curados en 4:3

Riesgo: imágenes verticales, 1:1 o 16:9 rompen composición.

Mitigación:

- Validación de catálogo.
- Curación previa en Cloudinary a 2400×1800.
- `c_fill,g_auto,ar_4:3` solo fallback.

### 16.7 Dificultad de generar 60 piezas en 192 celdas

Riesgo: promedio 3.2 celdas por pieza puede producir demasiadas piezas pequeñas.

Mitigación:

- Pesos calibrados.
- Reintentos por seed variant.
- Rango aceptable 56–64.
- Merge/split controlado.

### 16.8 `localStorage` inflado

Riesgo: guardar snapshots completos para muchos niveles puede exceder límites.

Mitigación:

- Snapshot completo solo en `MAREJIG_activeSave_v1`.
- `MAREJIG_levelProgress_v1` guarda resumen.
- No guardar imágenes.

### 16.9 Recompensas standalone

Riesgo: completados offline usados para reclamar monedas después.

Mitigación:

- V1 no reclama recompensas retroactivas standalone.
- Paga monedas solo cuando GameCenter está disponible al completar.

### 16.10 Orden de scripts

Riesgo: los scripts propios cargan antes de `../../js/app.js`, así que `window.GameCenter` puede no existir durante parseo.

Mitigación:

- No consultar GameCenter al cargar módulos.
- Consultar GameCenter solo en `MAREJIG_economy.js` al completar nivel.
- Mantener todo standalone-safe.

---

## 17. Checklist actualizado de aceptación

### 17.1 Estructura

- [ ] Existe `games/jigsaw/index.html`.
- [ ] Todo el juego está autocontenido en `games/jigsaw/`.
- [ ] Existe CSS propio con namespace `.marejig-*`.
- [ ] Existe `MAREJIG_levels.js` con 5 niveles iniciales de ejemplo.
- [ ] La arquitectura soporta 200+ niveles.

### 17.2 Integración Love Arcade

- [ ] Botón de salida apunta a `../../index.html`.
- [ ] `../../js/app.js` se importa al final del `<body>`, después de scripts propios.
- [ ] El juego funciona sin `window.GameCenter`.
- [ ] No se sobrescribe `window.GameCenter`.
- [ ] No se toca `window.ECONOMY`.
- [ ] No se toca `window.THEMES`.
- [ ] No se declara global `CONFIG`, `ECONOMY` ni `THEMES`.
- [ ] No se usa `localStorage` global de Love Arcade.

### 17.3 Namespacing

- [ ] Todas las claves `localStorage` empiezan con `MAREJIG_`.
- [ ] Todos los selectores CSS propios empiezan con `.marejig-*`.
- [ ] Módulos/objetos JS propios usan prefijo `MAREJIG_`.
- [ ] No hay selectores globales como `.modal`, `.btn`, `.screen` sin prefijo.

### 17.4 Catálogo

- [ ] Cada `Level.id` es único y estable.
- [ ] Cada `Level.order` es estable.
- [ ] Cada nivel tiene `cloudinaryPublicId`.
- [ ] Cada nivel declara `sourceFormat: "avif"`.
- [ ] Cada nivel declara `aspectRatio: "4:3"`.
- [ ] Cada nivel recomienda `master: { width: 2400, height: 1800 }`.
- [ ] Cada nivel usa `board: { cols: 16, rows: 12 }`.
- [ ] Cada nivel tiene `targetPieceCount: 60` o rango estándar documentado.
- [ ] Cada nivel tiene `segmentPlan`.
- [ ] Cada nivel tiene `rewardCoins` entero positivo.
- [ ] El seed deriva de `level.id`, no de fecha.

### 17.5 Cloudinary

- [ ] Existe `MAREJIG_cloudinary.js` o equivalente.
- [ ] Construye URLs desde `cloudName`, `publicId`, asset type y preset.
- [ ] No contiene API keys ni secretos.
- [ ] Usa `f_auto` y `q_auto` por defecto.
- [ ] Permite forzar AVIF solo para pruebas explícitas.
- [ ] Tiene presets tiny, thumbnail, full mobile y full premium.
- [ ] Usa `c_fill,g_auto,ar_4:3` solo como fallback.
- [ ] No precarga las 200 imágenes full.
- [ ] Carga imágenes con `crossOrigin = "anonymous"`.
- [ ] Usa `decode()` cuando está disponible.
- [ ] Usa `createImageBitmap()` cuando está disponible y tiene fallback.

### 17.6 Menú de pendientes

- [ ] No existe flujo de rompecabezas diario.
- [ ] La pantalla principal muestra solo niveles no completados.
- [ ] Los niveles completados no aparecen.
- [ ] Se renderizan inicialmente solo 12 o 20 cards.
- [ ] Hay carga incremental o virtualización simple.
- [ ] Thumbnails usan lazy loading.
- [ ] `<img>` usa `loading="lazy"` y `decoding="async"` cuando aplique.
- [ ] No se carga imagen full hasta seleccionar nivel.
- [ ] Cada card muestra título, pack, dificultad y recompensa.
- [ ] Si hay partida en curso, la card destaca “Continuar”.
- [ ] Al completar un nivel, se quita inmediatamente de pendientes.

### 17.7 Carga de imagen de juego

- [ ] Al seleccionar nivel se muestra pantalla de carga premium.
- [ ] Se carga primero tiny placeholder o thumbnail.
- [ ] Se carga después full mobile o full premium según dispositivo/conexión.
- [ ] Mobile usa 1600×1200.
- [ ] Tablet/desktop premium usa 2048×1536.
- [ ] 2400×1800 es opcional y condicionado.
- [ ] El generador no lee píxeles de imagen.
- [ ] El renderer dibuja imagen dentro de clips/máscaras de piezas.

### 17.8 Puzzle

- [ ] Render principal usa Canvas 2D.
- [ ] Canvas capa DPR con `Math.min(devicePixelRatio, 2)`.
- [ ] Board estándar es 16×12.
- [ ] El puzzle estándar se genera sobre 192 celdas.
- [ ] Se generan aproximadamente 60 piezas.
- [ ] Las piezas son poliminós ortogonales.
- [ ] El grafo de adyacencia se calcula desde vecinos reales.
- [ ] Snap solo ocurre entre piezas/grupos con vecindad real.
- [ ] Al hacer snap se fusionan grupos.
- [ ] Hay segmentos progresivos según `segmentPlan`.
- [ ] No se muestran 60 piezas sueltas simultáneamente en móvil.

### 17.9 Persistencia

- [ ] Se usa `MAREJIG_completedLevels_v1`.
- [ ] Se usa `MAREJIG_levelProgress_v1`.
- [ ] Se usa `MAREJIG_activeSave_v1`.
- [ ] Se usa `MAREJIG_settings_v1`.
- [ ] Se guardan IDs completados.
- [ ] Se guarda fecha de completado.
- [ ] Se guarda mejor tiempo.
- [ ] Se guarda menor número de movimientos.
- [ ] Se guardan pistas usadas.
- [ ] Se guarda si la recompensa fue reportada.
- [ ] Se guarda progreso de partida activa por nivel.
- [ ] No se guardan imágenes en `localStorage`.
- [ ] No se guardan thumbnails/base64/bitmaps en `localStorage`.
- [ ] Lecturas corruptas de `localStorage` no rompen el juego.

### 17.10 Economía

- [ ] Al completar nivel se usa:

```js
window.GameCenter.completeLevel("jigsaw", "level_" + level.id, coins);
```

- [ ] `coins` es entero positivo.
- [ ] La recompensa viene de `level.rewardCoins`.
- [ ] La recompensa es por nivel fijo, no por sesión.
- [ ] Si `window.GameCenter` no existe, el juego no rompe.
- [ ] Se guarda localmente que el nivel está completado.
- [ ] Se evita doble llamada por reload.
- [ ] Se evita doble llamada por doble animación de victoria.
- [ ] No se llama `addCoins`.
- [ ] No se llama `spendCoins`.
- [ ] No se modifica saldo manualmente.

### 17.11 Performance

- [ ] No hay render loop continuo si no hay cambios.
- [ ] `requestAnimationFrame` se usa solo con estado dirty.
- [ ] No se cachean 60 imágenes grandes por pieza.
- [ ] Hay una imagen decodificada principal por nivel activo.
- [ ] Se cachean paths/bounds/máscaras, no bitmaps innecesarios.
- [ ] Se liberan referencias de imagen full al salir de nivel.
- [ ] Thumbnails visibles usan cache limitada.
- [ ] Segmentos activos limitan piezas manipulables en móvil.

### 17.12 QA recomendado

- [ ] `rg -n "localStorage\\.(getItem|setItem|removeItem)" games/jigsaw` muestra solo claves `MAREJIG_`.
- [ ] `rg -n "\\b(CONFIG|ECONOMY|THEMES)\\b" games/jigsaw` no muestra declaraciones prohibidas.
- [ ] `rg -n "completeLevel|addCoins|spendCoins|getBalance" games/jigsaw` confirma que solo se usa `completeLevel`.
- [ ] Probar standalone abriendo `games/jigsaw/index.html`.
- [ ] Probar integrado desde Love Arcade.
- [ ] Probar viewport 360×740.
- [ ] Probar viewport 390×844.
- [ ] Probar tablet.
- [ ] Probar desktop.
- [ ] Probar carga lenta simulada.
- [ ] Probar completar nivel y verificar que desaparece de pendientes.
- [ ] Probar recarga durante victoria y confirmar que no duplica recompensa.
- [ ] Probar que no se descargan imágenes full de niveles no seleccionados.

---

## 18. Resumen ejecutivo

`marejigweb` será un jigsaw premium, mobile-first, de catálogo fijo, con imágenes 4:3 en Cloudinary, piezas poliminó renderizadas en Canvas 2D y economía Love Arcade por nivel completado.

La clave técnica del proyecto será equilibrar tres dimensiones:

1. **Calidad visual:** imágenes AVIF curadas a 2400×1800 y runtime 1600×1200/2048×1536.
2. **Rendimiento móvil:** carga incremental, lazy thumbnails, una imagen principal, Canvas dirty-render y DPR capado.
3. **Aislamiento Love Arcade:** namespaces `MAREJIG_` y `.marejig-*`, sin tocar storage/globales del hub y usando solo `GameCenter.completeLevel("jigsaw", "level_" + level.id, coins)` para monedas.
