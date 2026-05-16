# Documentación Técnica — Rompecabezas Arcade

**Proyecto:** Rompecabezas Arcade (Neural Puzzle)
**Plataforma:** Love Arcade
**Versión del motor:** `PuzzleEngine v19.1` · `main.js v9.0` · `UIController v6.0` · `LevelManager v7.0` · `Storage v3.0`
**Última revisión:** Marzo 2026 (v19.1 / v7.0 / v9.0)

---

## Índice

1. [Visión General](#1-visión-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Arquitectura y Flujo de la Aplicación](#3-arquitectura-y-flujo-de-la-aplicación)
4. [Sistema de Diseño Visual](#4-sistema-de-diseño-visual)
   - 4.1 [Paleta de Colores — Flat 2.0](#41-paleta-de-colores--flat-20)
   - 4.2 [Tipografía](#42-tipografía)
   - 4.3 [Componentes y Botones](#43-componentes-y-botones)
   - 4.4 [Iconografía y Animaciones](#44-iconografía-y-animaciones)
   - 4.5 [Micro-interacciones del Motor de Piezas](#45-micro-interacciones-del-motor-de-piezas)
5. [Módulos del Sistema](#5-módulos-del-sistema)
   - 5.1 [main.js — Orquestador](#51-mainjs--orquestador)
   - 5.2 [PuzzleEngine.js — Motor de Juego](#52-puzzleenginejs--motor-de-juego)
   - 5.3 [LevelManager.js — Gestor de Niveles](#53-levelmanagerjs--gestor-de-niveles)
   - 5.4 [UIController.js — Controlador de Interfaz](#54-uicontrollerjs--controlador-de-interfaz)
   - 5.5 [Storage.js — Almacenamiento](#55-storagejs--almacenamiento)
   - 5.6 [Economy.js — Sistema de Economía](#56-economyjs--sistema-de-economía)
   - 5.7 [AudioSynth.js — Síntesis de Audio](#57-audiosynthjs--síntesis-de-audio)
6. [Arquitectura de Activos — Cloudinary](#6-arquitectura-de-activos--cloudinary)
7. [Pantallas y Navegación](#7-pantallas-y-navegación)
8. [Sistema de Progresión del Jugador](#8-sistema-de-progresión-del-jugador)
9. [Motor Visual — PuzzleEngine en Detalle](#9-motor-visual--puzzleengine-en-detalle)
10. [Sistema Háptico](#10-sistema-háptico)
11. [Sistema de Audio Procedural](#11-sistema-de-audio-procedural)
13. [Herramientas de Desarrollo (Dev Tools)](#13-herramientas-de-desarrollo-dev-tools)
14. [Accesibilidad (WCAG 2.2)](#14-accesibilidad-wcag-22)
15. [Guía de Mantenimiento y Expansión](#15-guía-de-mantenimiento-y-expansión)

---

## 1. Visión General

**Rompecabezas Arcade** es un juego de puzzles de arrastrar y soltar, construido con JavaScript vanilla y Canvas API, diseñado para correr como experiencia web dentro del ecosistema **Love Arcade**. El jugador arrastra piezas de una imagen fragmentada hasta reconstruirla dentro de un tablero.

### Características principales

- **150 niveles** generados algorítmicamente desde una constante única (`TOTAL_LEVELS`). No se requiere editar JSON para agregar niveles.
- Activos visuales de **1600×1600 px** servidos desde **Cloudinary** en formato **AVIF calidad máxima** (`f_avif,q_100`). A q_100, el codificador AVIF de Cloudinary activa automáticamente el modo sin pérdida (VP8L), equivalente a `fl_lossless` pero compatible con todos los planes de Cloudinary (evita el error HTTP 400). A partir de v6.1 se elimina `fl_lossless` que causaba fallos de red en cuentas sin transformaciones activas habilitadas.
- Escalado de alta fidelidad en cliente mediante **step-down scaling** (v19.0): la textura 1600×1600 se reduce escalonadamente, nunca más del 50% por paso, neutralizando el blur bilineal y el ruido de mosquito que producía el downsampling en un solo paso.
- **Protección de VRAM (v19.1):** el `sourceCanvas` se limita a un máximo de 1600 px por dimensión, redondeado al múltiplo inferior de `gridSize`. Previene el desbordamiento en dispositivos DPR 3× con tableros grandes sin perder nitidez, ya que la imagen fuente tiene exactamente 1600 px nativos.
- **Prefetching Predictivo de ImageBitmap (v7.0 / v9.0):** mientras el usuario juega el nivel N, el sistema descarga y decodifica en background la imagen del nivel N+1 mediante `fetch({ priority: 'low' })` + `createImageBitmap()`. La decodificación ocurre completamente fuera del Event Loop (worker interno del navegador). Al iniciar el siguiente nivel, la textura está lista en VRAM y la transición es imperceptible. Si la precarga falla o no termina a tiempo, el flujo de carga estándar actúa como fallback transparente.
- Carga progresiva de thumbnails con **IntersectionObserver**: las miniaturas se descargan únicamente cuando están a punto de entrar al área visible de la pantalla, eliminando sobrecarga de red al navegar una lista de 150 niveles.
- Decodificación de imagen fuera del hilo principal con **`createImageBitmap`**: la textura 1600×1600 se transfiere al motor sin bloquear la UI. Liberación determinista con `ImageBitmap.close()` al destruir el motor.
- Gestión estricta de VRAM: en `destroy()` todos los buffers offscreen se invalidan con `width/height = 0`, liberando la memoria de GPU de forma síncrona antes de que actúe el GC.
- **Pixel-perfect alignment (v18.0):** el tablero se trunca al múltiplo exacto de `gridSize`, garantizando que `pieceWidth`, `pieceHeight`, `correctX` y `correctY` sean enteros. El `sourceCanvas` se alinea en el espacio físico del mismo modo, eliminando el muestreo sub-píxel en todo el pipeline de renderizado. Esta propiedad se preserva íntegramente en v19.0.
- Calidad de imagen premium: `imageSmoothingQuality = 'high'` (bicúbico) en todos los contextos canvas; desactivado puntualmente en renders estáticos para un blit 1:1 sin dispersión de color.
- Soporte nativo para **DPR 3×**: el tope del ratio de píxeles del dispositivo cubre iPhone 14/15 Pro, Galaxy S-series y Pixel 6/7.
- Diseño **Flat 2.0** de alta fidelidad: paleta de colores sólidos con contraste elevado, tipografía premium (Outfit + JetBrains Mono) y micro-interacciones táctiles satisfactorias.
- Motor de renderizado en canvas con soporte completo para mouse y pantalla táctil.
- Sistema de recompensas en monedas integrado con **Love Arcade** via `window.GameCenter`.
- Efectos visuales optimizados: pulsos radiales, destellos de encaje y partículas.
- Retroalimentación háptica por vibración (`navigator.vibrate`) para pickup, snap y victoria.
- Audio procedural sintetizado con la Web Audio API, sin archivos externos.
- Persistencia de progreso en `localStorage` con sistema de versionado de esquema.
- Accesibilidad WCAG 2.2: roles ARIA, navegación por teclado, áreas táctiles mínimas de 44×44px.
- Objeto global `window.dev` con utilidades de depuración accesibles desde la consola del navegador.

---

## 2. Estructura del Proyecto

```
/
├── index.html                  # Shell HTML — preconnect Cloudinary, ARIA completo,
│                               # modales personalizados (modal-alert, modal-confirm)
└── src/
    ├── main.js                 # Punto de entrada y orquestador (v9.0)
    ├── style.css               # Estilos globales — Flat 2.0, variables CSS, .sr-only
    ├── core/
    │   ├── PuzzleEngine.js     # Motor de renderizado y lógica de piezas (v19.1)
    │   └── LevelManager.js     # Generación algorítmica de niveles + prefetch (v7.0)
    ├── ui/
    │   └── UIController.js     # Gestión de pantallas y DOM (v6.0)
    └── systems/
        ├── Storage.js          # Persistencia en localStorage (v3.0)
        ├── Economy.js          # Integración con GameCenter (monedas)
        └── AudioSynth.js       # Síntesis de efectos de sonido
```

---

## 3. Arquitectura y Flujo de la Aplicación

```
main.js
 ├── LevelManager   → [genera en memoria] 150 objetos de nivel + URLs Cloudinary
 │                    [prefetch] descarga/decodifica nivel N+1 en background
 ├── UI             → [manipula] DOM / pantallas / IntersectionObserver (lazy thumbnails)
 ├── Storage        → [lee/escribe] localStorage
 ├── PuzzleEngine   → [renderiza] <canvas>
 │     └── callbacks: onSound, onWin, onSnap, onStateChange
 ├── AudioSynth     → [genera] Web Audio API
 └── Economy        → [notifica] window.GameCenter
```

### Secuencia de arranque

```
DOMContentLoaded
  └─ init()
       ├─ await LevelManager.loadLevels()      // genera 150 niveles en memoria
       ├─ Storage.validateUnlockedLevels()     // repara desbloqueados huérfanos
       ├─ UI.initGlobalInteractions()          // botones: release bounce
       ├─ setupNavigation()                    // bind de todos los botones de nav
       ├─ setupSettings()                      // ajustes de sonido
       ├─ setupDevTools()                      // registra window.dev
       └─ UI.showScreen('menu')               // muestra pantalla inicial
```

### Flujo de carga de imagen (v9.0)

```
startGame(levelId)
  │
  ├─ [CAMINO RÁPIDO — bitmap precargado disponible]
  │   levelManager.getAndClearPrefetchedBitmap(levelId) → ImageBitmap
  │   └─ sin red, sin decodificación → loader oculto inmediatamente
  │
  └─ [CAMINO NORMAL — sin bitmap precargado]
      ├─ new Image() + img.decode()               // decodificación DOM (hilo principal)
      ├─ createImageBitmap(img)                   // transfiere textura al worker de GPU
      │   └─ fallback a HTMLImageElement si no disponible
      └─ loader visible hasta resolución

  → new PuzzleEngine(canvas, { image: imageSource })
      └─ resizeCanvas()
          └─ _buildSourceCanvasHQ(img, srcW, srcH)  // step-down scaling (v19.0)
              ├─ Si NW ≤ srcW×2: drawImage directo (bicúbico)
              └─ Si NW > srcW×2: halvening iterativo hasta ≤2× → paso final

  → [2 s después, en requestIdleCallback o setTimeout]
      levelManager.prefetchNextLevel(levelId)
          ├─ fetch(url, { priority: 'low' })        // no compite con nivel activo
          ├─ response.blob()                        // bytes fuera del heap JS
          └─ createImageBitmap(blob)                // decodificación off-thread

  → al destruir: imageBitmap.close()               // liberación determinista de VRAM
```

### Ciclo de vida del ImageBitmap precargado

```
prefetchNextLevel()
  └─ #prefetchedData = { id: 'lvl_N+1', bitmap: ImageBitmap }
                              │
           ┌──────────────────┴──────────────────┐
           │                                     │
  [usuario llega al nivel N+1]          [usuario va al menú /
           │                             cambia nivel / error]
           ▼                                     ▼
  getAndClearPrefetchedBitmap()          clearPrefetch()
  devuelve bitmap → PuzzleEngine         bitmap.close()
  #prefetchedData = null                 #prefetchedData = null
           │
           ▼
  PuzzleEngine.destroy()
  bitmap.close()  ← liberación determinista
```

---

## 4. Sistema de Diseño Visual

### 4.1 Paleta de Colores — Flat 2.0

| Token CSS          | Valor       | Uso                                   |
|--------------------|-------------|---------------------------------------|
| `--bg-dark`        | `#0B0F19`   | Fondo de pantalla                     |
| `--bg-panel`       | `#151C2C`   | Paneles, top-bar                      |
| `--bg-card`        | `#1E293B`   | Tarjetas, botones secundarios         |
| `--primary`        | `#6366F1`   | Botón principal, borde de tablero     |
| `--primary-dark`   | `#4F46E5`   | Sombra 3D del botón primario          |
| `--accent`         | `#38BDF8`   | Subtítulos, highlights                |
| `--text-main`      | `#F8FAFC`   | Texto principal                       |
| `--text-muted`     | `#94A3B8`   | Texto secundario, iconos desactivados |
| `--success`        | `#10B981`   | Nivel completado, flash de snap       |
| `--warning`        | `#F59E0B`   | Monedas                               |
| `--danger`         | `#F43F5E`   | Acciones destructivas                 |

### 4.2 Tipografía

- **Outfit** (Google Fonts): fuente principal. Pesos 600, 700, 800. Cargada con `display=swap`.
- **JetBrains Mono** (Google Fonts): contadores HUD, display de monedas.

### 4.3 Componentes y Botones

- `.btn-primary`: fondo `--primary`, sombra `0 4px 0 var(--primary-dark)`, efecto "presionar" en `:active`.
- `.btn-secondary`: fondo `--bg-card`, sombra oscura.
- `.btn-danger`: fondo `--danger`.
- `.btn-icon` / `.btn-hud-action`: 44×44px, sin texto.
- Todos los botones tienen `touch-action: manipulation` para eliminar el delay de 300ms en móvil.

### 4.4 Iconografía y Animaciones

- Iconos SVG inline en HTML para cero peticiones de red adicionales.
- Shimmer skeleton en `.skeleton::after` para thumbnails en carga.
- Toggle switch CSS puro para ajustes.

### 4.5 Micro-interacciones del Motor de Piezas

- **Pickup**: escala 105% + vibración 10ms.
- **Ghost de snap**: cuando la pieza está a < 40% del destino, se dibuja el contorno del hueco.
- **Snap flash**: borde verde (`--success`) animado 200ms.
- **Edge pulse**: 2 anillos concéntricos (verde + indigo) que se expanden 600ms.
- **Confetti**: 30 partículas cuadradas en los colores del sistema al completar.

---

## 5. Módulos del Sistema

### 5.1 main.js — Orquestador

**Versión actual: v9.0**

Punto de entrada. Responsabilidades:

- Inicializar todos los módulos y registrar `window.dev`.
- Gestionar el ciclo de vida de `PuzzleEngine` (crear, destruir, pausar).
- Cargar imagen: primero intenta consumir el bitmap de `levelManager.getAndClearPrefetchedBitmap()`; si no existe, ejecuta el flujo estándar `img.decode()` + `createImageBitmap()`.
- Disparar `levelManager.prefetchNextLevel()` tras 2 s de juego activo, usando `requestIdleCallback` (con fallback a `setTimeout`) para no interferir con los primeros frames.
- Llamar `levelManager.clearPrefetch()` en todas las salidas del nivel que no sean la transición natural al nivel siguiente (menú, quit, btn-back), para liberar VRAM del bitmap no consumido.
- Manejar victoria: marcar completado, desbloquear siguiente, pagar recompensa.
- Guardar/restaurar estado de partida en curso.
- Auto-pausa en `visibilitychange` y `blur`.

**Cambios en v9.0 respecto a v8.0:**
- `startGame()` comprueba primero `levelManager.getAndClearPrefetchedBitmap(levelId)` antes de abrir el loader y arrancar la descarga. Si el bitmap está disponible, la transición es instantánea.
- `startGame()` llama `levelManager.clearPrefetch()` cuando no existe bitmap para el nivel pedido, descartando posibles residuos de navegación no lineal.
- Se añade el bloque `schedulePrefetch()` al final de `startGame()`, que dispara `levelManager.prefetchNextLevel()` 2 s después de que `GameState.isInGame = true`, con una guardia `currentLevelId === levelId` para cancelar prefetches huérfanos.
- `handleVictory()`: el callback de "Volver al menú" llama `levelManager.clearPrefetch()` antes de destruir el motor.
- Los callbacks de `btn-back` y `btn-quit-level` llaman `levelManager.clearPrefetch()` antes de cambiar de pantalla.

### 5.2 PuzzleEngine.js — Motor de Juego

**Versión actual: v19.1**

Motor canvas 2D de renderizado de piezas de rompecabezas. Maneja geometría, física de arrastrar, detección de snap, partículas, parallax y audio.

**Cambios en v19.1:**
- Se añade la constante `MAX_SRC_PX = 1600` en `resizeCanvas()`.
- Los valores `srcW` / `srcH` del `sourceCanvas` se calculan primero de forma natural (`boardWidth × dpr` alineado a `gridSize`) y luego se limitan a `MAX_SRC_PX` si lo exceden, usando `Math.floor` para que el resultado sea el múltiplo de `gridSize` más cercano sin superarlo. Esto preserva la propiedad pixel-perfect de v18.0 sin blur.
- Efecto práctico: en DPR 3× con tablero de 600 px CSS, `srcW` pasa de 1800 a `Math.floor(1600/gridSize) × gridSize`, ahorrando ~35% de VRAM sin pérdida de calidad, ya que la imagen fuente tiene exactamente 1600 px nativos.
- `_buildSourceCanvasHQ()` recibe `srcW`/`srcH` ya capados; su lógica interna no cambia.

**Cambios en v19.0 (sin modificación en v19.1):**
- Se añade el método privado `_buildSourceCanvasHQ(img, srcW, srcH)` que sustituye el `drawImage` directo en `resizeCanvas()`.
- El método implementa step-down scaling: reduce la imagen nativa iterativamente al 50% en cada paso hasta que la ratio fuente/destino sea ≤ 2:1, luego realiza el paso final bicúbico al tamaño exacto del sourceCanvas.
- Cada buffer intermedio se invalida con `width=0/height=0` inmediatamente tras ser copiado.
- La matemática pixel-perfect de v18.0 (dimensiones múltiplos de gridSize, coordenadas enteras) se preserva íntegramente: el algoritmo no modifica `srcW`/`srcH`.

### 5.3 LevelManager.js — Gestor de Niveles

**Versión actual: v7.0**

Genera algorítmicamente 150 objetos de configuración de nivel, construye las URLs de Cloudinary y gestiona el sistema de prefetching predictivo de ImageBitmap.

**Cambios en v7.0:**

- Se añade el campo privado `#prefetchedData` (`{ id, bitmap } | null`) que almacena el único bitmap precargado vigente.
- Se añade `async prefetchNextLevel(currentId)`:
  - Resuelve el nivel N+1 con `getNextLevelId()`.
  - Salida temprana si el bitmap correcto ya existe (idempotente).
  - Limpia cualquier bitmap previo no consumido (`clearPrefetch()`) antes de sobreescribir.
  - Ejecuta el pipeline off-thread: `fetch({ priority: 'low' })` → `response.blob()` → `createImageBitmap(blob)`.
  - Errores capturados silenciosamente; `#prefetchedData` queda en `null` para que `startGame()` use el flujo normal.
- Se añade `getAndClearPrefetchedBitmap(id)`:
  - Devuelve el `ImageBitmap` si el ID coincide y limpia `#prefetchedData` en el mismo acto.
  - Devuelve `null` si no coincide, sin efecto secundario.
- Se añade `clearPrefetch()`:
  - Llama `bitmap.close()` si existe un bitmap pendiente, liberando VRAM de forma determinista.
  - Idempotente: no hace nada si `#prefetchedData` es `null`.

**Cambios en v6.1 (heredados, sin modificación en v7.0):**
- `buildImageUrl()` sustituye `fl_lossless` por `q_100`. Compatible con todos los planes de Cloudinary.

**Cambios en v6.0 (heredados, sin modificación en v7.0):**
- Eliminados `_fullW` / `getFullImageWidth()`. Resolución nativa 1600×1600 siempre.
- `buildThumbnailUrl()` sin cambios: thumbnails usan `f_auto,q_auto`.

### 5.4 UIController.js — Controlador de Interfaz

Gestiona las transiciones entre pantallas, el grid de niveles con IntersectionObserver para lazy thumbnails, y los modales (`alert`, `confirm`, `victory`, `pause`, `resume`). Sin cambios en v6.0/v19.0.

### 5.5 Storage.js — Almacenamiento

Abstracción sobre `localStorage` con:
- Versionado de esquema automático.
- `validateUnlockedLevels()`: repara estados huérfanos.
- `isUnlocked()`, `isCompleted()`, `unlockLevel()`, `markCompleted()`.

### 5.6 Economy.js — Sistema de Economía

Puente hacia `window.GameCenter`. Si `GameCenter` no está disponible (modo standalone), simula la operación con un log de consola. Método principal: `Economy.payout(levelId, coins)`.

### 5.7 AudioSynth.js — Síntesis de Audio

Síntesis procedural mediante Web Audio API. Eventos: `click`, `snap`, `win`. El `AudioContext` se reanuda automáticamente en el primer toque del usuario (restricción de autoplay iOS/Android).

---

## 6. Arquitectura de Activos — Cloudinary

### Imagen de juego — v6.1

| Parámetro       | Valor         | Efecto                                                                 |
|-----------------|---------------|------------------------------------------------------------------------|
| `f_avif`        | AVIF          | Formato AVIF usado en los assets originales de Cloudinary.             |
| `q_100`         | Calidad 100   | Activa automáticamente el modo VP8L (sin pérdida): sin submuestreo de croma, sin artefactos DCT, perfil ICC preservado. Compatible con todos los planes de Cloudinary. |
| *(sin `w_`)*    | 1600×1600     | Resolución nativa, sin reescalado en servidor. El cliente escala via step-down. |

**URL ejemplo:**
```
https://res.cloudinary.com/dyspgn0sw/image/upload/f_avif,q_100/v1/Nivel05
```

**Por qué se usa `q_100` en lugar de `fl_lossless`:**
`fl_lossless` es un flag del pipeline de transformación activa de Cloudinary que no está disponible en todos los planes. Cuando la cuenta no tiene ese permiso, Cloudinary retorna HTTP 400, bloqueando la carga. `q_100` en combinación con `f_avif` mantiene la máxima calidad de codificación AVIF a través de la API estándar de calidad numérica, válida en todos los planes.

**Por qué se elimina `w_` para la imagen de juego:**
En v5.0 los parámetros `w_700`/`w_900`/`w_1200` reducían la imagen en el servidor con un filtro Lanczos de Cloudinary. Aunque Lanczos es de calidad alta, la imagen resultante llegaba al cliente ya degradada: el `drawImage` del sourceCanvas partía de una fuente de menor resolución, y el PuzzleEngine no podía recuperar la información perdida. Con AVIF `q_100` a 1600 px, el motor dispone de la textura completa y aplica su propio pipeline de reducción de alta fidelidad.

**Impacto en ancho de banda:**
Un AVIF Lossless 1600×1600 de ilustración/anime típico ocupa entre 800 KB y 2 MB. El AVIF lossy q_auto equivalente oscilaba entre 150–400 KB. La diferencia se justifica porque:
1. El archivo se descarga una sola vez y el navegador lo cachea con URL única.
2. La URL única (sin parámetro `w_`) maximiza los aciertos del CDN y del Service Worker caché.
3. La ganancia visual es perceptible y permanente en todo el ciclo de vida de la partida.

### Thumbnail — sin cambios

| Parámetro   | Valor              | Efecto                           |
|-------------|--------------------|----------------------------------|
| `c_thumb`   | Crop centrado      | Encuadre centrado de la imagen.  |
| `w_N`       | 160–320px          | Ancho dinámico según DPR.        |
| `g_center`  | Gravedad central   | Mantiene el sujeto visible.      |
| `f_auto`    | AVIF/AVIF/JPEG     | Mejor formato soportado.         |
| `q_auto`    | Calidad automática | Balance calidad/tamaño óptimo.   |

### Nomenclatura de assets

| Rango de nivel | Nombre en Cloudinary | Ejemplo        |
|----------------|----------------------|----------------|
| 1–9            | `NivelNN` (2 dígitos)| `Nivel01`      |
| 10–99          | `NivelNN`            | `Nivel42`      |
| 100–150        | `NivelNNN`           | `Nivel100`     |

---

## 7. Pantallas y Navegación

```
[Menu]
  ├─ [Play] → último nivel desbloqueado/no completado
  ├─ [Levels] → cuadrícula de 150 niveles
  ├─ [Settings]
  └─ [Exit] → window.location.href = '../../index.html'

[Game]
  ├─ HUD: nivel, piezas restantes, tiempo, acciones
  ├─ [Pause] → modal-pause
  │     ├─ [Resume]
  │     └─ [Quit] → clearPrefetch() + guarda progreso → [Menu]
  ├─ [Preview] (hold): muestra imagen completa translúcida
  └─ [Magnet]: auto-coloca una pieza suelta (cuesta monedas)

[Victory] → modal-victory
  ├─ [Next Level] → startGame(nextLvlId)  ← consume bitmap precargado
  └─ [Menu]       → clearPrefetch() + destroy()
```

Los modales de confirmación y alerta (`modal-alert`, `modal-confirm`) son genéricos y se invocan desde `UI.showAlert()` / `UI.showConfirm()`.

---

## 8. Sistema de Progresión del Jugador

- **Nivel 1** desbloqueado por defecto (`Storage.validateUnlockedLevels` garantiza que siempre exista al menos un nivel desbloqueado).
- Al completar el nivel `N`, se desbloquea el nivel `N+1`.
- Recompensa en monedas: `150 + (n × 2)`. El nivel 150 da 450 monedas.
- Las piezas por nivel escalan: niveles 1–10 tienen 16 piezas (cuadrícula 4×4); niveles 11–150 tienen 25 piezas (cuadrícula 5×5).
- El progreso se guarda automáticamente en `localStorage` en cada snap y al pausar/salir.

---

## 9. Motor Visual — PuzzleEngine en Detalle

### Buffers offscreen

| Buffer          | Propósito                                                         | Dimensiones                                          |
|-----------------|-------------------------------------------------------------------|------------------------------------------------------|
| `sourceCanvas`  | Textura de la imagen completa, reducida al tamaño del tablero×DPR | `srcW × srcH` (múltiplos de gridSize, **máx. 1600 px** por v19.1) |
| `staticCanvas`  | Tablero + todas las piezas encajadas (se actualiza por evento)    | Igual que el canvas principal                        |
| `gridCanvas`    | Rejilla de fondo con paralax (precalculada)                       | Ligeramente mayor que la pantalla                    |

### Step-down scaling — `_buildSourceCanvasHQ()` (v19.0, sin cambios en v19.1)

**Problema resuelto:** el anterior `drawImage(img, 0, 0, srcW, srcH)` realizaba una reducción de hasta 2.67:1 en un solo paso (1600→600 en una pantalla de 300px CSS con DPR 2×). La interpolación bilineal a esa ratio descarta ciclos de frecuencia enteros, produciendo:

- Aliasing en líneas diagonales y bordes de alto contraste.
- Desaturación: el promediado de 4 píxeles diluye los valores de color.
- "Ruido de mosquito": rebote de alta frecuencia no filtrado.
- Blur generalizado: pérdida de energía en frecuencias medias-altas.

**Solución:** reducción escalonada al 50% máximo por paso, con bicúbico (`imageSmoothingQuality = 'high'`) en cada iteración.

```
Ejemplo: imagen 1600×1600 → sourceCanvas 560×560 (DPR 2×, tablero 280px CSS)

  Paso 0: fuente = 1600×1600  (ratio destino: 1600/560 = 2.86:1 → supera 2:1)
  Paso 1: intermedio = 800×800  (ratio: 800/560 = 1.43:1 → OK)
  Paso 2 (final): sourceCanvas ← drawImage(800×800 → 560×560) [bicúbico]
```

```
Ejemplo: imagen 1600×1600 → sourceCanvas 840×840 (DPR 3×, tablero 280px CSS)
         [sin cap: rawSrcW = 840 ≤ 1600 → srcW = 840]

  Paso 0: fuente = 1600×1600  (ratio: 1600/840 = 1.90:1 → ≤2:1)
  Paso 1 (final): sourceCanvas ← drawImage(1600×1600 → 840×840) [bicúbico, directo]
```

```
Ejemplo con cap de VRAM (v19.1): DPR 3×, tablero 600px CSS, gridSize 5
  rawSrcW = round(600 × 3 / 5) × 5 = 1800  →  supera MAX_SRC_PX=1600
  srcW    = floor(1600 / 5) × 5 = 1600  (múltiplo de gridSize más cercano ≤ 1600)

  Paso 0: fuente = 1600×1600  (ratio: 1600/1600 = 1.0:1 → camino directo)
  Paso 1 (final): sourceCanvas ← drawImage(1600×1600 → 1600×1600) [blit 1:1]
  Ahorro: 1800² × 4 bytes = 12.4 MB  →  1600² × 4 bytes = 9.8 MB  (−21% VRAM)
```

**Preservación pixel-perfect:** los canvases intermedios usan `Math.ceil(N/2)` para sus dimensiones; el tamaño final `srcW × srcH` (múltiplo de `gridSize`, capado a ≤ 1600 px) llega sin modificar desde `resizeCanvas()`. La matemática de coordenadas en `renderPieceToContext()` no cambia.

**VRAM:** cada intermedio se invalida (`width=0/height=0`) inmediatamente después de copiarse al siguiente. Sólo existe un intermedio en memoria en cada momento. El cap de 1600 px de v19.1 garantiza que el `sourceCanvas` nunca supera la resolución nativa de la imagen fuente.

### Pipeline de renderizado por frame

Capa | Fuente | Frecuencia de actualización
-----|--------|-----------------------------
1. Fondo sólido | `ctx.clearRect` | Cada frame
2. Rejilla paralax | `gridCanvas` | Cada frame (interpolación lerp)
3. Puntos parpadeantes | Cálculo en CPU | Cada frame
4. Tablero + encajadas | `staticCanvas` | Solo en `needsStaticUpdate`
5. Preview (hold) | `sourceCanvas` | Solo con `showPreview = true`
6. Piezas sueltas | `sourceCanvas` → `ctx` | Cada frame
7. Ghost de snap | Geométrico | Solo pieza seleccionada
8. Pieza seleccionada | `sourceCanvas` → `ctx` | Cada frame (escala 105%)
9. Partículas | CPU | Hasta agotarse
10. Snap flash | Borde animado | 200ms post-snap
11. Edge pulses | 2 anillos concéntricos | 600ms post-snap

### Idle loop

El loop de animación se detiene automáticamente cuando no hay eventos pendientes (sin drag, sin partículas, sin flashes, sin preview). Se reactiva ante cualquier interacción o por un timer de 5s para refrescar los puntos parpadeantes.

---

## 10. Sistema Háptico

| Evento         | Patrón                    | Sensación percibida  |
|----------------|---------------------------|----------------------|
| Levantar pieza | `10`                      | Pulso suave          |
| Encajar pieza  | `[30, 20, 10]`            | Doble pulso          |
| Victoria       | `[100, 50, 80, 50, 200]`  | Celebración intensa  |

Implementado mediante `navigator.vibrate()`. En dispositivos o navegadores que no soporten la API, la llamada falla silenciosamente.

---

## 11. Sistema de Audio Procedural

Sin archivos de audio externos. Todo el audio se sintetiza en tiempo real mediante la **Web Audio API** a través de la clase `AudioSynth`. El `AudioContext` se reanuda automáticamente en el primer toque del usuario, respetando las restricciones de autoplay de iOS y Android.

---

## 12. Distribución Web

- En v9.1 se eliminó la capa PWA: el juego se distribuye como experiencia web estándar sin manifiesto ni Service Worker.
- Viewport: `user-scalable=no`, `viewport-fit=cover`.

---

## 13. Herramientas de Desarrollo (Dev Tools)

`window.dev` está disponible en la consola del navegador tras el arranque de la aplicación.

| Comando              | Descripción                                                      |
|----------------------|------------------------------------------------------------------|
| `dev.unlockAll()`    | Desbloquea los 150 niveles en localStorage                       |
| `dev.addCoins(n)`    | Suma `n` monedas via `GameCenter`. Avisa si está en modo standalone |
| `dev.skipLevel()`    | Fuerza la victoria del nivel activo                              |

```js
// Ejemplos:
dev.unlockAll()       // → [Dev] ✅ 150 niveles desbloqueados.
dev.addCoins(1000)    // → [Dev] ✅ +1000 monedas añadidas via GameCenter.
dev.skipLevel()       // → [Dev] ✅ Saltando nivel lvl_5.
```

---

## 14. Accesibilidad (WCAG 2.2)

### Atributos implementados

| Elemento                         | Atributo                                                  | Propósito                                        |
|----------------------------------|-----------------------------------------------------------|--------------------------------------------------|
| Capas decorativas (bg, grid…)    | `aria-hidden="true"`                                      | Ocultas a lectores de pantalla                   |
| Botones de solo-icono            | `aria-label`                                              | Descripción textual de la acción                 |
| Tarjetas de nivel desbloqueadas  | `role="button"`, `tabindex="0"`, `aria-label`             | Navegables por teclado                           |
| Tarjetas de nivel bloqueadas     | `role="img"`, `aria-disabled="true"`                      | Anunciadas como imagen bloqueada                 |
| Modales                          | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`   | Anunciados correctamente por AT                  |
| SVGs decorativos                 | `aria-hidden="true"`                                      | Evita lectura del nombre del elemento SVG        |
| Texto solo para AT               | `.sr-only`                                                | Visible a lectores, invisible visualmente        |

### Foco visible (WCAG 2.4.11)

Todos los elementos interactivos tienen `:focus-visible` con `outline: 2px solid var(--accent)`.

### Tamaños táctiles (WCAG 2.5.5)

Todos los botones e iconos del HUD tienen un tamaño mínimo de **44×44px**. Las tarjetas de nivel tienen `min-height: 100px`.

---

## 15. Guía de Mantenimiento y Expansión

### Agregar niveles nuevos (dos pasos)

1. Subir la imagen 1600×1600 a Cloudinary con el nombre `NivelNN`:
   - n < 10: `Nivel01`…`Nivel09`
   - 10 ≤ n < 100: `Nivel10`…`Nivel99`
   - n ≥ 100: `Nivel100`…`Nivel150` (sin cero adicional)
2. En `LevelManager.js`: incrementar `const TOTAL_LEVELS = N;`

No se requiere ningún otro cambio.

---

### Cambiar el tamaño de thumbnail

Modificar la función `getThumbnailWidth()` en `LevelManager.js`. La fórmula base es:

```
anchoCSSMinimo × min(DPR, 2) × 1.07 → redondeado al múltiplo de 80 más cercano
```

Con tarjetas de 100px y DPR 2×: `100 × 2 × 1.07 ≈ 214` → snapped a `240px`. El valor resultante se limita entre 160 y 320px.

---

### Revertir a imagen lossy (si se requiere reducir ancho de banda)

Editar `buildImageUrl()` en `LevelManager.js`:

```js
// AVIF calidad máxima / sin pérdida efectiva (v6.1, actual — máxima fidelidad, compatible con todos los planes)
return `${CLOUDINARY_BASE}/f_avif,q_100/v1/${publicId}`;

// AVIF lossy con ancho adaptativo (v5.0 legacy — menor tamaño de archivo)
const wTransform = _fullW === 1600 ? '' : `,w_${_fullW}`;
return `${CLOUDINARY_BASE}/f_auto,q_auto${wTransform}/v1/${publicId}`;
```

Si se revierte a lossy, restaurar también `getFullImageWidth()` y `_fullW` del archivo v5.0. El step-down scaling de PuzzleEngine v19.1 es compatible con cualquier fuente; la diferencia es únicamente la calidad colorimétrica de partida.

---

### Deshabilitar el prefetching predictivo

El sistema de prefetch es transparente; si `createImageBitmap` no está disponible o el fetch falla, `startGame()` carga el nivel normalmente. Para desactivarlo completamente, eliminar el bloque `schedulePrefetch()` del final de `startGame()` en `main.js` y los tres métodos de `LevelManager` (`prefetchNextLevel`, `getAndClearPrefetchedBitmap`, `clearPrefetch`). Eliminar también las llamadas a `clearPrefetch()` en los callbacks de navegación.

---

### Diagnóstico de errores comunes

| Síntoma                                               | Causa probable                                                      | Solución                                                                                   |
|-------------------------------------------------------|---------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Imagen de nivel no carga (pantalla infinita)          | `publicId` incorrecto o asset no subido a Cloudinary                | Verificar que el nombre sea `Nivel${NN}` en el cloud `dyspgn0sw`                           |
| **HTTP 400 / Network Error al cargar imagen**         | **`fl_lossless` en la URL (flag no disponible en el plan)**         | **Verificado en v6.1: `buildImageUrl()` usa `f_avif,q_100` en lugar de `fl_lossless`**    |
| Error CORS al iniciar partida                         | Falta `crossOrigin = 'Anonymous'`                                   | Ya corregido en `startGame()`; no revertir                                                 |
| Thumbnails no aparecen al abrir pantalla niveles      | Observer desconectado o `data-src` no asignado                      | Verificar que `renderLevelsGrid()` se llame después de `loadLevels()`                     |
| Tarjeta de nivel no responde al teclado               | `tabindex` o `role` faltante en el elemento                         | Verificar UIController v6.0 o superior                                                     |
| `dev.skipLevel()` no hace nada                        | No hay nivel activo en ese momento                                  | Iniciar una partida antes de llamar al comando                                             |
| El audio no suena en iOS al inicio                    | Restricción de autoplay del sistema operativo                       | Normal; el AudioContext se activa automáticamente en el primer toque                       |
| Imagen borrosa al escalar en canvas                   | `imageSmoothingQuality` reseteado por cambio de dim.                | Verificar que `_applySmoothing()` se llame tras cambios de `width`/`height`                |
| Bordes de pieza con antialiasing visible              | `imageSmoothingEnabled = true` en renders estáticos                 | Verificado en v18.0: se deshabilita puntualmente en `renderPieceToContext(isStaticRender=true)` |
| Piezas encajadas con grietas sub-píxel                | `overlapFix` fraccionario (0.6) en drawImage                        | Verificado en v18.0: `overlapFix = 1` (entero)                                            |
| Nitidez degradada en iPhone 14 Pro / Galaxy S         | DPR 3× escalado por software por cap en `dpr = 2`                  | Verificado en v18.0: `dpr = Math.min(devicePixelRatio, 3)`                                |
| **Desbordamiento de VRAM / OOM en DPR 3× tablero grande** | **`sourceCanvas` supera la resolución nativa 1600px**           | **Verificado en v19.1: `MAX_SRC_PX = 1600` limita `srcW`/`srcH` con `Math.floor` a gridSize** |
| Alto consumo de RAM al cambiar niveles                | Buffers offscreen no liberados en `destroy()`                       | Verificar que `destroy()` asigne `width=0`/`height=0` y llame a `bitmap.close()`          |
| Thumbnails cargados dos veces en la grid              | Observer huérfano del render anterior                               | Verificar que `UI._thumbObserver.disconnect()` se llame al inicio de `renderLevelsGrid()` |
| Pieza queda "flotando" al pausar                      | `cancelDrag()` no invocado antes de `togglePause()`                 | Verificar que `togglePause()` en main.js llame a `activeGame.cancelDrag()`                |
| Colores lavados / desaturados en las piezas           | URL de Cloudinary con `q_auto` (compresión lossy)                   | Verificado en v6.1: `buildImageUrl()` usa `f_avif,q_100`                                  |
| "Ruido de mosquito" en líneas de alto contraste       | Artefactos DCT del JPEG/AVIF lossy                                  | Verificado en v6.1: `q_100` activa VP8L, eliminando el codificador DCT                    |
| Blur generalizado en el tablero                       | `drawImage` único 1600→target (bilineal en un paso)                 | Verificado en v19.0: `_buildSourceCanvasHQ()` implementa step-down ≤2:1 por paso          |
| Canvas intermedio no liberado (posible OOM)           | Referencia a canvas intermedio sobrevive el scope                   | `_buildSourceCanvasHQ()` invalida `width=0/height=0` en cada iteración                    |
| **Fuga de VRAM entre niveles (bitmap precargado)**    | **`clearPrefetch()` no invocado en salida del nivel**               | **Verificado en v9.0: todos los puntos de salida del nivel llaman `levelManager.clearPrefetch()`** |
| **Petición de red huérfana tras cambio rápido de nivel** | **Prefetch disparado para nivel que ya no es el activo**         | **Verificado en v9.0: guardia `currentLevelId === levelId` en `schedulePrefetch()`**      |
| **Nivel N+2 descargado al repasar la grid**           | **`prefetchNextLevel()` llamado desde la pantalla de niveles**      | **El prefetch solo se dispara dentro de `startGame()` con `isInGame = true`; no aplica a la grid** |